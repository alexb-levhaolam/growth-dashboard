import { createClient } from '@supabase/supabase-js'

// ═══ Напоминания в Slack: «пора написать отчёт за прошлую неделю» ═══
// GET  /api/pm-remind?action=cron      — по расписанию (понедельник, 12:00 по Израилю), Vercel Cron
// GET  /api/pm-remind?action=preview   — кому и что уйдёт (для администратора)
// POST /api/pm-remind?action=send      — отправить сейчас (администратор)
// POST /api/pm-remind?action=ping      — тестовое сообщение одному человеку { slack_id, name }

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const APP_URL = process.env.APP_URL || 'https://growth-dashboard-olive-beta.vercel.app'
const DAY = 864e5
const iso = (d) => d.toISOString().slice(0, 10)
const lastMonday = () => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setTime(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY - 7 * DAY); return d }
const MG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MGE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (ws, lang) => { const a = new Date(ws + 'T12:00:00Z'), b = new Date(a.getTime() + 6 * DAY); return lang === 'en' ? `${MGE[a.getUTCMonth()]} ${a.getUTCDate()}–${a.getUTCMonth() === b.getUTCMonth() ? '' : MGE[b.getUTCMonth()] + ' '}${b.getUTCDate()}` : `${a.getUTCDate()}${a.getUTCMonth() === b.getUTCMonth() ? '' : ' ' + MG[a.getUTCMonth()]}–${b.getUTCDate()} ${MG[b.getUTCMonth()]}` }
const first = (s) => String(s || '').toLowerCase().trim().split(' ')[0]
const isMe = (owner, name) => { const m = first(name); return !!m && String(owner || '').toLowerCase().split(/[,;/&]| и /).some((x) => first(x) === m) }

const isCron = (req) => { const s = process.env.CRON_SECRET; const a = req.headers.authorization || ''; return s ? a === `Bearer ${s}` : /vercel-cron/i.test(req.headers['user-agent'] || '') }
const clientFor = (req) => { if (process.env.SUPABASE_SERVICE_KEY) return createClient(URL, process.env.SUPABASE_SERVICE_KEY); const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return createClient(URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY, { global: { headers: token && !isCron(req) ? { Authorization: `Bearer ${token}` } : {} }, auth: { persistSession: false } }) }
async function adminOnly(req, sb) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); if (!token) return false; const { data } = await sb.auth.getUser(token); if (!data?.user) return false; const { data: pr } = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); return pr?.role === 'admin' }

async function slack(channel, text) {
  const token = process.env.SLACK_BOT_TOKEN; if (!token) return { ok: false, error: 'SLACK_BOT_TOKEN не задан в Vercel для этого окружения' }
  const r = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }, body: JSON.stringify({ channel, text, unfurl_links: false }) })
  return r.json()
}

// кто должен отчёт за прошлую неделю и по каким проектам
async function buildPlan(sb) {
  const ws = iso(lastMonday()), we = iso(new Date(lastMonday().getTime() + 6 * DAY))
  const [{ data: team }, { data: projects }, { data: steps, error: se }, { data: comments }] = await Promise.all([
    sb.from('team_members').select('*'), sb.from('projects').select('id,name,owner,status,parent_id,archived_at'),
    sb.from('project_steps').select('project_id,owner,start_date,end_date,hidden'), sb.from('project_comments').select('project_id,author,week_start,source').eq('week_start', ws)])
  const live = (projects || []).filter((p) => !p.archived_at && p.status !== 'done')
  const st = (steps || []).filter((s) => !s.hidden)
  const activeFor = (p) => { const ps = st.filter((s) => s.project_id === p.id); return ps.length ? ps.some((s) => s.start_date <= we && s.end_date >= ws) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status) }
  const plan = []
  for (const m of team || []) {
    if (m.active === false) continue
    const mine = live.filter((p) => isMe(p.owner, m.name) || st.some((s) => s.project_id === p.id && isMe(s.owner, m.name))).filter(activeFor)
    const missing = mine.filter((p) => !(comments || []).some((c) => c.project_id === p.id && c.source !== 'sheet' && first(c.author) === first(m.name)))
    if (!missing.length) continue
    plan.push({ name: m.name, slack_id: m.slack_id || '', lang: m.lang || 'ru', projects: missing.map((p) => ({ id: p.id, name: p.name })) })
  }
  return { week: ws, plan, stepsNote: se ? 'этапы недоступны: ' + se.message : '' }
}
const textFor = (r, ws) => r.lang === 'en'
  ? `Hi ${r.name}! Time to write your weekly update for ${label(ws, 'en')}:\n${r.projects.map((p) => `• ${p.id} · ${p.name}`).join('\n')}\nIt takes 2 minutes: ${APP_URL} → My report`
  : `Привет, ${r.name}! Пора написать отчёт за неделю ${label(ws, 'ru')}:\n${r.projects.map((p) => `• ${p.id} · ${p.name}`).join('\n')}\nЭто 2 минуты: ${APP_URL} → «Мой отчёт»`

async function sendAll(sb) {
  const { week, plan, stepsNote } = await buildPlan(sb); const results = []
  for (const r of plan) { if (!r.slack_id) { results.push({ name: r.name, ok: false, error: 'нет Slack ID' }); continue } const j = await slack(r.slack_id, textFor(r, week)); results.push({ name: r.name, ok: !!j.ok, error: j.ok ? '' : j.error }) }
  return { week, sent: results.filter((x) => x.ok).length, results, stepsNote }
}

export default async function handler(req, res) {
  try {
    const action = req.query.action
    if (action === 'cron') { if (!isCron(req)) return res.status(401).json({ error: 'unauthorized' }); return res.json(await sendAll(clientFor(req))) }
    const sb = clientFor(req)
    if (!(await adminOnly(req, sb))) return res.status(403).json({ error: 'Только для администраторов' })
    if (action === 'preview') { const p = await buildPlan(sb); return res.json({ ...p, messages: p.plan.map((r) => ({ ...r, text: textFor(r, p.week) })) }) }
    if (action === 'send' && req.method === 'POST') return res.json(await sendAll(sb))
    if (action === 'ping' && req.method === 'POST') { const { slack_id, name, lang } = req.body || {}; if (!slack_id) return res.status(400).json({ error: 'нет Slack ID' }); const j = await slack(slack_id, lang === 'en' ? `Test message from Growth Dashboard ✅ ${name || ''}` : `Тестовое сообщение из Growth Dashboard ✅ ${name || ''}`); return res.json({ ok: !!j.ok, error: j.ok ? '' : j.error }) }
    return res.status(400).json({ error: 'unknown action' })
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }) }
}
