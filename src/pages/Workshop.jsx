import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { S, Label, chipStyle, ACC } from '../lib/ui'

// ═══ WORKSHOP 2027 — зеркало таблицы Growth Workshop 2027 ═══
const STAGES = ['Brand Awareness', 'Acquisition', 'Win-Back', 'Retention', 'Strategy']
const ST = {
  'In progress': { bg: '#C9E58A', tx: '#3B6402', w: 3 },
  'Planned': { bg: '#CFE0F8', tx: '#1A56B8', w: 1 },
  'Wait': { bg: '#FFE0B0', tx: '#8A3500', w: 2 },
  'At risk': { bg: '#FFC6B8', tx: '#A71F00', w: 4 },
  'Done': { bg: '#E4E6E9', tx: '#3B6402', w: 0 },
  '': { bg: '#E4E6E9', tx: '#585E65', w: 0 },
}
const st = (s) => ST[s] || ST['']
const MN = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 86400000

const num = (v) => { if (v == null || v === '') return null; const s = String(v).replace(/[\s\u00a0$%]/g, '').replace(/,(?=\d{3}(\D|$))/g, ''); const n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : null }
const fmt = (v) => v == null ? '' : Math.round(v).toLocaleString('ru-RU')
const parseDate = (v) => {
  if (!v) return null; const s = String(v).trim(); let m
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3], 12)
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[1] - 1, +m[2], 12)
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1], 12)
  return null
}
const dm = (d) => d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') : ''
const dmy = (d) => d ? dm(d) + '.' + String(d.getFullYear()).slice(2) : ''
const objs = (values) => { const h = (values?.[0] || []).map((x) => String(x || '').trim()); return (values || []).slice(1).map((r) => { const o = {}; h.forEach((k, i) => { if (k) o[k] = r[i] ?? '' }); return o }).filter((o) => Object.values(o).some((v) => String(v).trim() !== '')) }
const pick = (o, prefix) => { const k = Object.keys(o).find((x) => x.startsWith(prefix)); return k ? o[k] : '' }
const stagesOf = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)

function parse(tabs) {
  // Projects Plan
  const plan = objs(tabs['Projects Plan']).filter((o) => o.ID).map((o) => ({
    id: String(o.ID).trim(), name: o.Project, brief: o.Brief, desc: o.Description, owner: o.Owner, stage: o.Stage, type: o.Type, outcome: o.Outcome,
    base: num(o.Baseline), exp: num(o['Expected Sales']), total: num(o['Total Sales']), expTotal: num(o['Expected Sales (total)']),
    prio: num(o.Priority), c: pick(o, 'Сложность'), i: pick(o, 'Импакт'), u: o.Urgency, parent: String(o['Parent ID'] || '').trim(), level: o.Level, budget: o['Additional Budget'], oldId: o['Old ID'],
  }))
  const byId = {}; plan.forEach((p) => { byId[p.id] = p })
  const subs = {}; plan.forEach((p) => { if (p.parent) (subs[p.parent] = subs[p.parent] || []).push(p) })
  // Monthly Report
  const mrVals = tabs['Monthly Report'] || []
  const mrHead = (mrVals[0] || []).map((x) => String(x || '').trim())
  const monthCols = mrHead.map((h, i) => [h, i]).filter(([h]) => /^\d{4}-\d{2}$/.test(h))
  const mrRows = mrVals.slice(1).map((r) => { const o = {}; mrHead.forEach((k, i) => { o[k] = r[i] ?? '' }); o.months = monthCols.map(([, i]) => num(r[i])); return o })
  const special = {}; const top = []
  mrRows.forEach((o) => { const name = String(o.Project || '').trim(); if (['TOTAL-SALES', 'TOTAL-CPO', 'PLAN SALES', 'PLAN CPO'].includes(name)) special[name] = o.months; else if (o.ID) top.push({ status: o.Status, id: String(o.ID).trim(), name, stage: o.Stage, type: o.Type, prio: num(o.Priority), base: num(o.Baseline), exp: num(o['Expected Sales']), total: num(o['Total Sales']), months: o.months }) })
  const months = monthCols.map(([h]) => h)
  const lastIdx = (special['TOTAL-SALES'] || []).reduce((a, v, i) => (v != null ? i : a), -1)
  // Timeline
  const steps = {}
  objs(tabs['Timeline']).forEach((o) => {
    const id = String(o.ID || '').trim(); const start = parseDate(o.Start); const end = parseDate(o.End)
    if (!id || !o.Step || !start || !end) return
    (steps[id] = steps[id] || []).push({ id, n: String(o['Step #'] || '').trim(), name: o.Step, status: String(o.Status || '').trim(), start, end, weeks: o.Weeks, note: o.Notes, wk: Array.from({ length: 10 }, (_, i) => o['Week ' + (i + 1)] || '') })
  })
  // Dashboard: блок PLAN VS ACTUAL
  const dv = tabs['Dashboard'] || []; let pva = [], pvaHead = [], planStart = '', planEnd = ''
  const hr = dv.findIndex((r) => (r || []).some((c) => String(c).trim() === 'Stage') && (r || []).some((c) => String(c).trim() === 'Baseline'))
  if (hr >= 0) {
    const c0 = dv[hr].findIndex((c) => String(c).trim() === 'Stage'); pvaHead = dv[hr].slice(c0, c0 + 7)
    for (let r = hr + 1; r < dv.length; r++) { const row = (dv[r] || []).slice(c0, c0 + 7); if (!row[0]) break; pva.push(row); if (/^Total/.test(row[0])) break }
  }
  dv.forEach((r) => { (r || []).forEach((c, i) => { if (String(c).trim() === 'Plan start') planStart = r[i + 1]; if (String(c).trim() === 'Plan end') planEnd = r[i + 1] }) })
  // Chart Data
  const chart = objs(tabs['Chart Data']).map((o) => ({ m: o.Month, fact: num(o['Actual sales']), plan: num(o.Plan) }))
  return { plan, byId, subs, top, months, special, lastIdx, steps, pva, pvaHead, planStart, planEnd, chart }
}

const card = { background: S.sf, borderRadius: 14, boxShadow: S.sh, padding: '18px 20px' }
const th = { fontSize: 12, fontWeight: 600, color: S.i3 }

const PREFS_KEY = 'lh_workshop_prefs'
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch (e) { return {} } }
const CSS = `
.ws-row:hover .ws-lbl{background:#F1F8E3 !important}
.ws-row:hover{background:#FCFDF8}
.ws-scroll{scrollbar-gutter:stable}
.ws-cell:focus-visible{outline:2px solid #121416;outline-offset:-2px}
`
const toggleStyle = (on) => ({ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: S.i2, cursor: 'pointer', userSelect: 'none', padding: '6px 4px' })
const Box = ({ on }) => <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${on ? '#8CC63F' : '#C9CDD2'}`, background: on ? '#8CC63F' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}</span>

export default function Workshop({ ce }) {
  const P0 = loadPrefs()
  const [raw, setRaw] = useState(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(P0.tab || 'road'); const [stage, setStage] = useState(P0.stage || 'all'); const [owner, setOwner] = useState(P0.owner || 'all')
  const [q, setQ] = useState(''); const [ptype, setPtype] = useState('all')
  const [hideNoDates, setHideNoDates] = useState(P0.hideNoDates ?? true); const [hideDone, setHideDone] = useState(P0.hideDone ?? true)
  const [details, setDetails] = useState(P0.details ?? false); const [hideEmpty, setHideEmpty] = useState(P0.hideEmpty ?? false)
  const [open, setOpen] = useState({}); const [closedGroups, setClosedGroups] = useState({}); const [popen, setPopen] = useState({}); const [cell, setCell] = useState(null)
  const [detail, setDetail] = useState(''); const [year, setYear] = useState('2026'); const [tlStatus, setTlStatus] = useState('all')
  const [drafts, setDrafts] = useState({}); const [saving, setSaving] = useState('')

  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ tab, stage, owner, hideNoDates, hideDone, details, hideEmpty })) } catch (e) {} }, [tab, stage, owner, hideNoDates, hideDone, details, hideEmpty])
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') setCell(null) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
  const load = async () => {
    setLoading(true); setErr('')
    try { const r = await fetch('/api/workshop'); const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'Ошибка загрузки'); setRaw(d) } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const D = useMemo(() => (raw ? parse(raw.tabs) : null), [raw])

  if (loading && !D) return <div style={{ ...card, color: S.i3 }}>Загружаю Growth Workshop 2027…</div>
  if (err && !D) return <div style={{ ...card, color: '#A71F00' }}>Не удалось загрузить таблицу: {err} <button onClick={load} style={{ ...chipStyle(false), marginLeft: 8 }}>Повторить</button></div>
  if (!D) return null

  // ---------- фильтры: направление, владелец, поиск ----------
  const inStage = (s) => stage === 'all' || stagesOf(s).includes(stage)
  const ownerCount = {}; D.plan.forEach((p) => String(p.owner || '').split(/,|\(|\)/).map((x) => x.trim()).filter((x) => x && x.length < 30 && !/^-/.test(x)).forEach((o) => { ownerCount[o] = (ownerCount[o] || 0) + 1 }))
  const owners = Object.keys(ownerCount).sort((a, b) => ownerCount[b] - ownerCount[a]).slice(0, 14)
  const ql = q.trim().toLowerCase()
  const selfMatch = (id) => { const p = D.byId[id]; if (!p) return !ql && owner === 'all'; const okQ = !ql || (p.id + ' ' + p.name + ' ' + p.owner).toLowerCase().includes(ql); const okO = owner === 'all' || String(p.owner || '').includes(owner); return okQ && okO }
  const matchTop = (id) => selfMatch(id) || (D.subs[id] || []).some((s) => selfMatch(s.id))
  const subsShown = (id) => selfMatch(id) ? (D.subs[id] || []) : (D.subs[id] || []).filter((s) => selfMatch(s.id))
  const filtering = !!ql || owner !== 'all'

  const weeks = (() => { const t = new Date(); t.setHours(12, 0, 0, 0); const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const start = new Date(mon); start.setDate(start.getDate() - 14); const end = new Date(2027, 11, 27, 12); const w = []; for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * DAY)) w.push([new Date(d), new Date(d.getTime() + 6 * DAY)]); return w })()
  const todayIdx = 2
  const stepsAt = (id, w) => (D.steps[id] || []).filter((s) => s.start <= w[1] && s.end >= w[0])
  const weekN = (s, w) => Math.max(1, Math.floor((w[0] - s.start) / (7 * DAY)) + 1)
  const noteOf = (s, w) => { const n = weekN(s, w); return n <= 10 ? s.wk[n - 1] : '' }

  const saveNote = async (s, w, text) => {
    const n = weekN(s, w); if (n > 10) { alert('В Timeline есть только колонки Week 1–10'); return }
    const key = s.id + '|' + s.n + '|' + n; setSaving(key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') }, body: JSON.stringify({ id: s.id, step: s.n, week: n, text }) })
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'Ошибка')
      s.wk[n - 1] = text; setDrafts((p) => { const x = { ...p }; delete x[key]; return x })
    } catch (e) { alert('Не сохранилось: ' + e.message) } finally { setSaving('') }
  }

  const tabs = [['dash', 'Дашборд'], ['road', 'Roadmap'], ['monthly', 'Monthly Report'], ['quarter', 'Quarterly'], ['plan', 'Projects Plan'], ['timeline', 'Timeline']]
  const scrollBox = (minW, extra) => ({ ...card, padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 210px)', minHeight: 320, ...extra, '--minw': minW })

  // ---------- шапка: закреплённая панель ----------
  const toolbar = <div style={{ position: 'sticky', top: 0, zIndex: 20, background: S.bg, padding: '10px 0 12px', marginBottom: 6, borderBottom: `1px solid ${S.ln}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>Workshop 2027</span>
        <span style={{ fontSize: 12, color: S.i3 }}>обновлено {raw?.fetchedAt ? new Date(raw.fetchedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: проект, ID, владелец" aria-label="Поиск" style={{ height: 36, width: 240, border: `1px solid ${S.ln}`, borderRadius: 10, padding: '0 12px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }} />
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Владелец" style={{ height: 36, border: `1px solid ${S.ln}`, borderRadius: 10, padding: '0 10px', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}><option value="all">Все владельцы</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <a href="https://docs.google.com/spreadsheets/d/1MtyFbfbESIxm8SRlDe6tRvQSwJ62-4Yaw8RfTa-dR4k/edit" target="_blank" rel="noreferrer" style={{ ...chipStyle(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Таблица ↗</a>
        <button onClick={load} disabled={loading} style={{ fontSize: 13, color: ACC.tx, background: ACC.bg, border: `1px solid ${ACC.bd}`, borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, minHeight: 36 }}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 12, padding: 4, boxShadow: S.sh }}>{tabs.map(([v, l]) => <button key={v} onClick={() => { setTab(v); setCell(null) }} style={{ fontSize: 13, border: 'none', borderRadius: 9, padding: '7px 13px', cursor: 'pointer', background: tab === v ? ACC.bg : 'transparent', color: tab === v ? ACC.tx : S.ink, fontWeight: tab === v ? 600 : 500, fontFamily: 'inherit' }}>{l}</button>)}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{['all', ...STAGES].map((v) => <button key={v} onClick={() => setStage(v)} style={{ ...chipStyle(stage === v), padding: '5px 11px', minHeight: 30, fontSize: 12 }}>{v === 'all' ? 'Все направления' : v}</button>)}</div>
      {filtering && <button onClick={() => { setQ(''); setOwner('all') }} style={{ fontSize: 12, color: '#1761CB', background: 'none', border: 'none', cursor: 'pointer' }}>Сбросить поиск и владельца</button>}
    </div>
  </div>

  // ---------- Дашборд ----------
  const Dash = () => {
    const scope = D.plan.filter((p) => !p.parent && inStage(p.stage) && (ptype === 'all' || p.type === ptype) && matchTop(p.id))
    const topScope = D.top.filter((t) => inStage(t.stage) && (ptype === 'all' || t.type === ptype) && matchTop(t.id))
    const base = topScope.reduce((a, t) => a + (t.base || 0), 0); const now = topScope.reduce((a, t) => a + (t.months[D.lastIdx] || 0), 0)
    const tgt = scope.reduce((a, p) => a + ((p.expTotal ?? p.exp) || 0), 0); const gr = now - base
    const agg = (k, keys) => { const t = {}; scope.forEach((p) => { t[p[k]] = (t[p[k]] || 0) + ((p.expTotal ?? p.exp) || 0) }); return keys.map((x) => [x, t[x] || 0]) }
    const maxC = Math.max(1, ...D.chart.map((c) => Math.max(c.fact || 0, c.plan || 0)))
    const top5 = scope.slice().sort((a, b) => ((b.expTotal ?? b.exp) || 0) - ((a.expTotal ?? a.exp) || 0)).slice(0, 6)
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        {D.pva.filter((r) => stage === 'all' || r[0] === stage || /^Total/.test(r[0])).map((r, i) => { const tot = /^Total/.test(r[0]); const pct = Math.min(100, Math.max(0, parseFloat(String(r[5]).replace('%', '').replace(',', '.')) || 0))
          return <div key={i} style={{ ...card, padding: '14px 16px', background: tot ? ACC.soft : '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{tot ? 'Вся компания' : r[0]}</span><span style={{ fontSize: 11, color: S.i2, background: '#F1F2F4', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{r[6]}</span></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ fontSize: 26, fontWeight: 600 }}>{r[2]}</span><span style={{ fontSize: 13, color: S.i2 }}>→ {r[3]}</span></div>
            <span style={{ fontSize: 12, color: S.i3 }}>{tot ? 'продаж в месяц · сейчас → цель' : `база ${r[1]} · рост ${r[4] || 0} · ${r[5]} цели`}</span>
            <span style={{ height: 5, background: '#EEF0F2', borderRadius: 3, marginTop: 4 }}><span style={{ display: 'block', height: 5, width: pct + '%', background: '#8CC63F', borderRadius: 3 }} /></span>
          </div> })}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '2 1 520px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 16, fontWeight: 600 }}>Продажи компании: факт и план</span><span style={{ display: 'flex', gap: 14, fontSize: 12, color: S.i2 }}><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8CC63F', marginRight: 5 }} />факт</span><span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#1761CB', marginRight: 5, verticalAlign: 'middle' }} />план</span></span></div>
          <div style={{ overflowX: 'auto' }}><div style={{ display: 'grid', gridTemplateColumns: `repeat(${D.chart.length},minmax(26px,1fr))`, gap: 5, alignItems: 'end', height: 190, minWidth: D.chart.length * 31 }}>
            {D.chart.map((c, i) => <div key={i} title={`${c.m}: факт ${fmt(c.fact) || '—'}, план ${fmt(c.plan)}`} style={{ position: 'relative', height: 190, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              {c.plan != null && <span style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#1761CB', bottom: Math.round(c.plan / maxC * 160) }} />}
              <span style={{ fontSize: 9, color: S.i2, marginBottom: 3 }}>{fmt(c.fact)}</span>
              <span style={{ width: '100%', maxWidth: 26, height: c.fact ? Math.round(c.fact / maxC * 160) : 0, background: '#8CC63F', borderRadius: '5px 5px 2px 2px' }} />
            </div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${D.chart.length},minmax(26px,1fr))`, gap: 5, minWidth: D.chart.length * 31, marginTop: 6 }}>{D.chart.map((c, i) => <span key={i} style={{ fontSize: 10, color: S.i3, textAlign: 'center' }}>{String(c.m || '').split(' ')[0]}</span>)}</div></div>
        </div>
        <div style={{ ...card, flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Срез по типу</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['all', 'Channel', 'Funnel', 'SMM', 'Offline'].map((v) => <button key={v} onClick={() => setPtype(v)} style={{ ...chipStyle(ptype === v), padding: '5px 11px', minHeight: 30, fontSize: 12 }}>{v === 'all' ? 'Все типы' : v}</button>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            {[['Baseline (старт)', fmt(base)], [`Сейчас (${D.months[D.lastIdx] || '—'})`, fmt(now)], ['Цель: +продаж в мес', fmt(tgt)], ['Прирост · % плана', `${gr > 0 ? '+' : ''}${gr} · ${tgt ? (gr / tgt * 100).toFixed(1) : 0}%`]].map(([l, v], i) => <div key={i} style={{ background: S.bg, borderRadius: 12, padding: '12px 14px' }}><div style={{ fontSize: 12, color: S.i2 }}>{l}</div><div style={{ fontSize: 20, fontWeight: 600, color: i === 3 ? (gr < 0 ? '#A71F00' : '#3B6402') : S.ink }}>{v}</div></div>)}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {[['Ожидаемые продажи по типу', agg('type', ['Channel', 'Funnel', 'SMM', 'Offline'])], ['По результату', agg('outcome', ['Sales', 'Lead', 'Affiliate', 'Retention', 'Reach/Awareness'])]].map(([t, rows]) => <div key={t} style={card}><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t}</div>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '7px 0', borderBottom: '1px solid #F1F2F4' }}><span>{l}</span><span style={{ fontWeight: 600 }}>{fmt(v)}</span></div>)}</div>)}
        <div style={card}><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Самый большой вклад</div>{top5.map((p) => <button key={p.id} onClick={() => { setDetail(p.id); setTab('plan'); setPopen({ ...popen, [p.id]: true }); setQ(p.id) }} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', fontSize: 14, padding: '7px 0', border: 'none', borderBottom: '1px solid #F1F2F4', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: S.ink }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ color: S.i3, fontSize: 12 }}>{p.id}</span> {p.name}</span><span style={{ fontWeight: 600, color: '#3B6402', flexShrink: 0 }}>+{fmt(p.expTotal ?? p.exp)}</span></button>)}</div>
      </div>
    </div>
  }

  // ---------- Roadmap ----------
  const LW = 320; const CW = 22
  const Road = () => {
    const cellsFor = (id, isParent) => weeks.map((w, wi) => {
      let text = '', status = null, hasNote = false
      const own = stepsAt(id, w)
      if (isParent) {
        const act = (D.subs[id] || []).filter((s) => stepsAt(s.id, w).length)
        const all = act.map((s) => stepsAt(s.id, w)[0]).concat(own)
        if (all.length) { status = all.sort((a, b) => st(b.status).w - st(a.status).w)[0].status; text = act.length ? '▸' + act.length : own[0].n }
        hasNote = (D.subs[id] || []).some((s) => stepsAt(s.id, w).some((x) => noteOf(x, w))) || own.some((x) => noteOf(x, w))
      } else if (own.length) { const s = own[own.length - 1]; status = s.status; text = s.n; hasNote = own.some((x) => noteOf(x, w)) }
      return { text, status, hasNote, wi }
    })
    const spanOf = (id, isParent) => { const ids = isParent ? (D.subs[id] || []).map((s) => s.id).concat([id]) : [id]; const ds = []; ids.forEach((k) => (D.steps[k] || []).forEach((s) => { ds.push(s.start); ds.push(s.end) })); if (!ds.length) return null; ds.sort((a, b) => a - b); return [ds[0], ds[ds.length - 1]] }
    const Row = ({ id, label, sub, isParent, cnt }) => {
      const cs = cellsFor(id, isParent); const sp = spanOf(id, isParent); const bg = sub ? '#FBFBFC' : '#fff'
      return <div className="ws-row" style={{ display: 'flex', borderBottom: '1px solid #F1F2F4', background: bg, width: LW + weeks.length * CW }}>
        <div className="ws-lbl" style={{ width: LW, flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', padding: sub ? '3px 10px 3px 40px' : '3px 10px', boxSizing: 'border-box', minWidth: 0, position: 'sticky', left: 0, background: bg, zIndex: 2, borderRight: `1px solid ${S.ln}` }}>
          {isParent && <button onClick={() => setOpen({ ...open, [id]: !open[id] })} aria-label={open[id] ? 'Свернуть подпроекты' : 'Раскрыть подпроекты'} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, border: `1px solid ${S.ln}`, background: '#fff', cursor: 'pointer', padding: 0, fontSize: 12, color: S.i2 }}>{open[id] ? '−' : '+'}</button>}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 12, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}><span style={{ color: S.i3 }}>{id}</span> {label}{isParent && <span style={{ color: S.i3 }}> · {cnt} подпр.</span>}</span>
            <span style={{ fontSize: 10, color: S.i3 }}>{sp ? dmy(sp[0]) + ' – ' + dmy(sp[1]) : 'без дат'}{D.byId[id]?.owner ? ' · ' + D.byId[id].owner : ''}</span>
          </span>
        </div>
        {cs.map((c) => { const sel = cell && cell.id === id && cell.wi === c.wi; const s = c.status != null ? st(c.status) : null
          return <button key={c.wi} className="ws-cell" onClick={() => setCell(c.status != null || c.hasNote ? { id, wi: c.wi, isParent, label } : null)} title={c.status != null ? `${label} · ${dm(weeks[c.wi][0])} · ${c.status || 'без статуса'}` : ''} style={{ position: 'relative', width: CW, height: 26, margin: '3px 0', flexShrink: 0, border: 'none', borderLeft: '1px solid #fff', padding: 0, fontSize: 10, fontWeight: 600, cursor: c.status != null ? 'pointer' : 'default', background: s ? s.bg : (c.wi === todayIdx ? '#FFF1EE' : 'transparent'), color: s ? s.tx : '#B7BCC2', outline: sel ? '2px solid #121416' : 'none', outlineOffset: -2, boxShadow: c.wi === todayIdx ? 'inset 0 0 0 1px #DD2A02' : 'none' }}>{c.text}{c.hasNote && <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: '#A71F00' }} />}</button> })}
      </div>
    }
    const first = (t) => { const sp = spanOf(t.id, !!D.subs[t.id]); return sp ? sp[0].getTime() : Infinity }
    const groups = ['Brand Awareness', 'Acquisition', 'Retention', 'Strategy'].map((g) => [g, D.top.filter((t) => stagesOf(t.stage)[0] === g && inStage(t.stage) && matchTop(t.id) && (!hideNoDates || spanOf(t.id, !!D.subs[t.id]))).sort((a, b) => first(a) - first(b))]).filter(([, it]) => it.length)
    const parents = groups.flatMap(([, it]) => it).filter((t) => D.subs[t.id]).map((t) => t.id)
    const allOpen = parents.length && parents.every((id) => open[id])
    const W = LW + weeks.length * CW
    return <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span onClick={() => setHideNoDates(!hideNoDates)} style={toggleStyle()}><Box on={hideNoDates} />Скрыть проекты без дат</span>
        <button onClick={() => { const o = {}; parents.forEach((id) => { o[id] = !allOpen }); setOpen({ ...open, ...o }) }} style={{ ...chipStyle(false), padding: '5px 11px', minHeight: 30, fontSize: 12 }}>{allOpen ? 'Свернуть все подпроекты' : 'Раскрыть все подпроекты'}</button>
        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: S.i2, marginLeft: 'auto' }}>{['In progress', 'Planned', 'Wait', 'At risk', ''].map((k) => <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: st(k).bg }} />{k || 'без статуса'}</span>)}<span>· ▸N — подпроектов в работе · <span style={{ color: '#A71F00' }}>●</span> комментарий</span></span>
      </div>
      <div className="ws-scroll" style={scrollBox(W)}>
        <div style={{ width: W, position: 'relative' }}>
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: `1px solid ${S.ln}`, width: W }}>
            <span style={{ width: LW, flexShrink: 0, padding: '8px 10px', ...th, position: 'sticky', left: 0, background: '#fff', zIndex: 6, borderRight: `1px solid ${S.ln}`, boxSizing: 'border-box' }}>Проект · сроки · владелец</span>
            <div>
              <div style={{ display: 'flex' }}>{weeks.map((w, i) => { const f = i === 0 || w[0].getMonth() !== weeks[i - 1][0].getMonth(); return <span key={i} style={{ width: CW, flexShrink: 0, fontSize: 10, fontWeight: 600, color: S.i2, whiteSpace: 'nowrap', overflow: 'visible', paddingTop: 6, paddingLeft: 2, borderLeft: `1px solid ${f ? '#C9CDD2' : 'transparent'}`, boxSizing: 'border-box' }}>{f ? MS[w[0].getMonth()] + ' ' + String(w[0].getFullYear()).slice(2) : ''}</span> })}</div>
              <div style={{ display: 'flex' }}>{weeks.map((w, i) => <span key={i} style={{ width: CW, flexShrink: 0, fontSize: 9, textAlign: 'center', padding: '3px 0 6px', ...(i === todayIdx ? { background: '#DD2A02', color: '#fff', fontWeight: 600, borderRadius: '4px 4px 0 0' } : { color: S.i3 }) }}>{String(w[0].getDate()).padStart(2, '0')}</span>)}</div>
            </div>
          </div>
          {groups.length === 0 && <div style={{ padding: 24, color: S.i3, fontSize: 14, position: 'sticky', left: 0 }}>Ничего не найдено. Сбросьте поиск или фильтры.</div>}
          {groups.map(([g, items]) => { const closed = !!closedGroups[g]
            return <div key={g}>
              <button onClick={() => setClosedGroups({ ...closedGroups, [g]: !closed })} style={{ display: 'block', width: W, textAlign: 'left', border: 'none', borderBottom: `1px solid ${S.ln}`, background: ACC.soft, cursor: 'pointer', padding: 0, position: 'sticky', top: 46, zIndex: 4 }}>
                <span style={{ position: 'sticky', left: 0, display: 'inline-block', padding: '8px 10px', fontSize: 13, fontWeight: 600, color: '#3B6402' }}>{closed ? '▸' : '▾'} {g} · {items.length}</span>
              </button>
              {!closed && items.map((t) => { const isP = !!D.subs[t.id]; const subs = isP ? subsShown(t.id) : []; const show = isP && (open[t.id] || (filtering && subs.length))
                return <div key={t.id}>{Row({ id: t.id, label: t.name, isParent: isP, cnt: (D.subs[t.id] || []).length })}{show && subs.map((s) => <Fragment key={s.id}>{Row({ id: s.id, label: s.name, sub: true })}</Fragment>)}</div> })}
            </div> })}
        </div>
      </div>
    </>
  }

  // ---------- выезжающая панель недели ----------
  const Drawer = () => {
    if (!cell) return null
    const w = weeks[cell.wi]
    const list = cell.isParent ? (D.subs[cell.id] || []).flatMap((s) => stepsAt(s.id, w).map((x) => ({ ...x, who: s.id + ' · ' + s.name }))).concat(stepsAt(cell.id, w)) : stepsAt(cell.id, w)
    return <>
      <div onClick={() => setCell(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(18,20,22,.18)', zIndex: 1000 }} />
      <aside role="dialog" aria-label="Неделя проекта" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)', background: '#fff', zIndex: 1001, boxShadow: '-8px 0 32px rgba(18,20,22,.14)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${S.ln}`, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: S.i3 }}>Неделя {dm(w[0])} – {dmy(w[1])}</div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{cell.id} · {cell.label}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => setCell({ ...cell, wi: Math.max(0, cell.wi - 1) })} aria-label="Предыдущая неделя" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${S.ln}`, background: '#fff', cursor: 'pointer' }}>‹</button>
            <button onClick={() => setCell({ ...cell, wi: Math.min(weeks.length - 1, cell.wi + 1) })} aria-label="Следующая неделя" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${S.ln}`, background: '#fff', cursor: 'pointer' }}>›</button>
            <button onClick={() => setCell(null)} aria-label="Закрыть" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${S.ln}`, background: '#fff', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.length === 0 && <span style={{ fontSize: 13, color: S.i3 }}>На этой неделе этапов нет.</span>}
          {list.map((s, i) => { const n = weekN(s, w); const key = s.id + '|' + s.n + '|' + n; const val = drafts[key] ?? (n <= 10 ? s.wk[n - 1] : ''); const changed = drafts[key] != null && drafts[key] !== (s.wk[n - 1] || '')
            return <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 14, borderBottom: '1px solid #F1F2F4' }}>
              {s.who && <span style={{ fontSize: 12, color: S.i3 }}>{s.who}</span>}
              <span style={{ fontSize: 14, fontWeight: 600 }}>Этап {s.n}: {s.name}</span>
              <span style={{ fontSize: 12, color: S.i2 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: st(s.status).bg, marginRight: 6 }} />{s.status || 'без статуса'} · {dmy(s.start)} – {dmy(s.end)} · неделя {n} этапа</span>
              {s.note && <span style={{ fontSize: 12, color: S.i2 }}>Заметка: {s.note}</span>}
              {n > 10 ? <span style={{ fontSize: 12, color: S.i3 }}>Комментарии хранятся в Week 1–10, эта неделя — {n}-я.</span> : ce ? <>
                <textarea value={val || ''} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} placeholder={`Комментарий к неделе ${n}: что сделано, что мешает`} rows={3} style={{ border: `1px solid ${S.ln}`, borderRadius: 10, padding: 10, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button disabled={!changed || saving === key} onClick={() => saveNote(s, w, val || '')} style={{ fontSize: 13, fontWeight: 600, border: `1px solid ${changed ? ACC.bd : S.ln}`, background: changed ? ACC.bg : '#F7F8F9', color: changed ? ACC.tx : S.i3, borderRadius: 9, padding: '7px 14px', cursor: changed ? 'pointer' : 'default' }}>{saving === key ? 'Сохраняю…' : 'Сохранить в таблицу'}</button><span style={{ fontSize: 11, color: S.i3 }}>→ Timeline, Week {n}</span></div>
              </> : <span style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{val || '—'}</span>}
            </div> })}
        </div>
      </aside>
    </>
  }

  // ---------- таблицы с закреплёнными колонками ----------
  const med3 = (a) => [...a].sort((x, y) => x - y)[1]
  const cellBg = (v, prev, invert) => v == null || prev == null || v === prev ? 'transparent' : ((invert ? v < prev : v > prev) ? '#E4F2C8' : '#FFE1DA')
  const stickyCol = (left, bg, extra) => ({ position: 'sticky', left, background: bg, zIndex: 2, ...extra })
  const Grid = ({ cols, head, totals, rows, minW }) => {
    // cols: [{w, sticky?, align?}], head: [labels], totals/rows: [{cells, bg, bold, color}]
    const tpl = cols.map((c) => c.w + 'px').join(' ')
    let acc = 0; const lefts = cols.map((c) => { const l = acc; if (c.sticky) acc += c.w; return c.sticky ? l : null })
    const R = (r, i, extraStyle) => <div key={i} className="ws-row" style={{ display: 'grid', gridTemplateColumns: tpl, alignItems: 'center', borderBottom: '1px solid #F1F2F4', fontSize: 12, background: r.bg || '#fff', fontWeight: r.bold ? 600 : 400, color: r.color || S.ink, ...extraStyle }}>
      {r.cells.map((c, k) => <span key={k} className={cols[k].sticky ? 'ws-lbl' : ''} style={{ padding: '8px 6px', textAlign: cols[k].align || 'left', ...(lefts[k] != null ? stickyCol(lefts[k], r.bg || '#fff', k === cols.filter((x) => x.sticky).length - 1 ? { borderRight: `1px solid ${S.ln}` } : {}) : {}), ...(c && c.style) }}>{c && c.v != null ? c.v : c}</span>)}
    </div>
    return <div className="ws-scroll" style={scrollBox(minW)}><div style={{ width: cols.reduce((a, c) => a + c.w, 0) }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 3, boxShadow: `0 1px 0 ${S.ln}` }}>
        {R({ cells: head.map((h) => ({ v: h, style: { fontSize: 11, fontWeight: 600, color: S.i3 } })), bg: '#fff' }, 'h')}
        {totals.map((t, i) => R(t, 't' + i))}
      </div>
      {rows.length === 0 && <div style={{ padding: 24, color: S.i3, fontSize: 14 }}>Ничего не найдено.</div>}
      {rows.map((r, i) => R(r, i))}
    </div></div>
  }
  const moneyCell = (v) => v == null ? '' : '$' + fmt(v)
  const tableOpts = <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
    <span onClick={() => setDetails(!details)} style={toggleStyle()}><Box on={details} />Показать Status, Stage, Type, Baseline, Expected</span>
    <span onClick={() => setHideEmpty(!hideEmpty)} style={toggleStyle()}><Box on={hideEmpty} />Скрыть проекты без продаж</span>
  </div>
  const metaCols = (t) => details ? [{ v: t.status, style: { fontSize: 11, fontWeight: 600, color: t.status === 'In progress' ? '#8A3500' : t.status === 'Planned' ? '#1761CB' : S.i2 } }, { v: t.stage, style: { color: S.i2 } }, { v: t.type, style: { color: S.i2 } }, { v: t.prio, style: { color: S.i2 } }, { v: fmt(t.base) }, { v: fmt(t.exp), style: { color: '#3B6402', fontWeight: 600 } }] : []
  const metaDefs = details ? [{ w: 92 }, { w: 120 }, { w: 70 }, { w: 44, align: 'right' }, { w: 64, align: 'right' }, { w: 70, align: 'right' }] : []
  const metaHead = details ? ['Status', 'Stage', 'Type', 'Prio', 'Baseline', 'Expected'] : []
  const topRows = D.top.filter((t) => inStage(t.stage) && matchTop(t.id))

  const Monthly = () => {
    const off = Math.max(0, D.months.indexOf(year + '-01'))
    const cells = (arr, invert, money) => Array.from({ length: 12 }, (_, i) => { const gi = off + i; const v = arr?.[gi]; let bg = 'transparent'
      if (v != null && gi >= 3 && arr[gi - 1] != null && arr[gi - 2] != null && arr[gi - 3] != null && !(v === 0 && med3([arr[gi - 1], arr[gi - 2], arr[gi - 3]]) === 0)) bg = cellBg(v, med3([arr[gi - 1], arr[gi - 2], arr[gi - 3]]), invert)
      return { v: v == null ? '' : money ? moneyCell(v) : fmt(v), style: { background: bg, borderRadius: 5 } } })
    const rows = topRows.filter((t) => !hideEmpty || (t.months.slice(off, off + 12).some((v) => v))).map((t) => ({ cells: [{ v: t.id, style: { color: S.i2 } }, { v: t.name, style: { lineHeight: 1.3 } }, ...metaCols(t), { v: fmt(t.total), style: { fontWeight: 600 } }, ...cells(t.months)] }))
    const lbl = (l) => [{ v: '' }, { v: l }, ...metaCols({}).map(() => ''), '']
    return <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>{tableOpts}<div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: 12, color: S.i3 }}>Зелёный — лучше медианы 3 прошлых месяцев, красный — хуже</span>{['2026', '2027'].map((y) => <button key={y} onClick={() => setYear(y)} style={{ ...chipStyle(year === y), padding: '5px 11px', minHeight: 30, fontSize: 12 }}>{y}</button>)}</div></div>
      {Grid({ minW: 0,
        cols: [{ w: 60, sticky: true }, { w: 280, sticky: true }, ...metaDefs, { w: 62, align: 'right' }, ...Array.from({ length: 12 }, () => ({ w: 60, align: 'right' }))],
        head: ['ID', 'Проект', ...metaHead, 'Total', ...MN.map((m) => m + ' ' + year.slice(2))],
        totals: [
          { cells: [...lbl('TOTAL-SALES'), ...cells(D.special['TOTAL-SALES'])], bg: ACC.soft, bold: true },
          { cells: [...lbl('TOTAL-CPO'), ...cells(D.special['TOTAL-CPO'], true, true)], bg: ACC.soft, bold: true },
          { cells: [...lbl('PLAN SALES'), ...Array.from({ length: 12 }, (_, i) => fmt(D.special['PLAN SALES']?.[off + i]))], bg: '#F4F8FE', color: '#1761CB' },
          { cells: [...lbl('PLAN CPO'), ...Array.from({ length: 12 }, (_, i) => moneyCell(D.special['PLAN CPO']?.[off + i]))], bg: '#F4F8FE', color: '#1761CB' },
        ], rows })}
    </>
  }
  const Quarter = () => {
    const qs = []; for (let y = 0; y * 12 < D.months.length; y++) for (let k = 0; k < 4; k++) qs.push([D.months[y * 12]?.slice(0, 4) + '-Q' + (k + 1), y * 12 + k * 3])
    const sum = (a, s) => { const p = [a?.[s], a?.[s + 1], a?.[s + 2]].filter((v) => v != null); return p.length ? p.reduce((x, y) => x + y, 0) : null }
    const tS = D.special['TOTAL-SALES'] || []; const tC = D.special['TOTAL-CPO'] || []
    const wcpo = (s) => { let a = 0, w = 0; for (let i = s; i < s + 3; i++) if (tS[i] != null && tC[i] != null) { a += tS[i] * tC[i]; w += tS[i] } return w ? a / w : null }
    const lastQ = Math.floor(D.lastIdx / 3)
    const qc = (vals, invert, money) => vals.map((v, i) => ({ v: v == null ? '' : money ? moneyCell(v) : fmt(v), style: { borderRadius: 5, background: i > 0 && i < lastQ && v ? cellBg(v, vals[i - 1], invert) : 'transparent' } }))
    const rows = topRows.filter((t) => !hideEmpty || t.months.some((v) => v)).map((t) => ({ cells: [{ v: t.id, style: { color: S.i2 } }, { v: t.name, style: { lineHeight: 1.3 } }, ...metaCols(t), ...qc(qs.map(([, s]) => sum(t.months, s)))] }))
    const lbl = (l) => [{ v: '' }, { v: l }, ...metaCols({}).map(() => '')]
    return <>
      {tableOpts}
      {Grid({ minW: 0,
        cols: [{ w: 60, sticky: true }, { w: 280, sticky: true }, ...metaDefs, ...qs.map(() => ({ w: 76, align: 'right' }))],
        head: ['ID', 'Проект', ...metaHead, ...qs.map(([l]) => l)],
        totals: [{ cells: [...lbl('TOTAL-SALES'), ...qc(qs.map(([, s]) => sum(tS, s)))], bg: ACC.soft, bold: true }, { cells: [...lbl('TOTAL-CPO'), ...qc(qs.map(([, s]) => wcpo(s)), true, true)], bg: ACC.soft, bold: true }],
        rows })}
    </>
  }

  // ---------- Projects Plan ----------
  const Plan = () => {
    const tops = D.plan.filter((p) => !p.parent && inStage(p.stage) && matchTop(p.id)).sort((a, b) => (a.prio ?? 999) - (b.prio ?? 999))
    const tpl = '44px 64px minmax(280px,3fr) 140px 130px 70px 84px 56px 60px 56px'
    const allOpen = tops.length && tops.every((p) => popen[p.id])
    const Line = ({ p, sub }) => { const isO = !!popen[p.id] || (filtering && sub); const kids = D.subs[p.id] ? subsShown(p.id) : []; const showKids = (popen[p.id] || filtering) && kids.length
      return <div style={{ borderBottom: '1px solid #F1F2F4', background: sub ? '#FBFBFC' : '#fff' }}>
        <div className="ws-row" style={{ display: 'grid', gridTemplateColumns: tpl, gap: 8, padding: '9px 14px', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: S.i2 }}>{sub ? '' : p.prio}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.id}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingLeft: sub ? 16 : 0, borderLeft: sub ? `2px solid ${S.ln}` : 'none' }}>
            <button onClick={() => setPopen({ ...popen, [p.id]: !popen[p.id] })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: S.ink, fontSize: 13, fontWeight: 500, lineHeight: 1.35, fontFamily: 'inherit' }}>{popen[p.id] ? '▾' : '▸'} {p.name}{D.subs[p.id] ? <span style={{ color: S.i3, fontWeight: 400 }}> · {D.subs[p.id].length} подпр.</span> : ''}</button>
            {p.budget && <span style={{ fontSize: 11, color: '#8A3500', background: '#FFF6E8', borderRadius: 6, padding: '2px 7px', alignSelf: 'flex-start' }}>Доп. бюджет: {p.budget}</span>}
          </span>
          <span style={{ fontSize: 12, color: S.i2 }}>{p.owner}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.stage}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.type}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.outcome}</span>
          <span style={{ fontSize: 13, textAlign: 'right' }}>{fmt(p.base)}</span><span style={{ fontSize: 13, textAlign: 'right', color: '#3B6402', fontWeight: 600 }}>{fmt(p.expTotal ?? p.exp)}</span><span style={{ fontSize: 12, textAlign: 'right', color: S.i2 }} title="Сложность · Импакт · Срочность">{[p.c, p.i, p.u].filter((x) => x !== '' && x != null).join(' · ')}</span>
        </div>
        {popen[p.id] && <div style={{ padding: '0 14px 14px 124px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {p.brief && <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{p.brief}</span>}
          {p.desc && <span style={{ fontSize: 13, color: S.i2, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxWidth: 900 }}>{p.desc}</span>}
          {(D.steps[p.id] || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>{D.steps[p.id].map((s, i) => <span key={i} style={{ fontSize: 11, borderRadius: 999, padding: '4px 10px', background: st(s.status).bg, color: st(s.status).tx }}>{s.n}. {s.name} · {dm(s.start)}–{dm(s.end)}</span>)}</div>}
          {p.oldId && <span style={{ fontSize: 12, color: '#3B6402' }}>Old ID (2026): {p.oldId}</span>}
        </div>}
        {showKids ? kids.map((s) => <Fragment key={s.id}>{Line({ p: s, sub: true })}</Fragment>) : null}
      </div> }
    return <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}><button onClick={() => { const o = {}; tops.forEach((p) => { o[p.id] = !allOpen }); setPopen({ ...popen, ...o }) }} style={{ ...chipStyle(false), padding: '5px 11px', minHeight: 30, fontSize: 12 }}>{allOpen ? 'Свернуть все' : 'Раскрыть все'}</button><span style={{ fontSize: 12, color: S.i3, alignSelf: 'center' }}>{tops.length} проектов · клик по названию — описание, этапы и подпроекты</span></div>
      <div className="ws-scroll" style={scrollBox(0)}><div style={{ minWidth: 1100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 8, padding: '10px 14px', borderBottom: `1px solid ${S.ln}`, ...th, fontSize: 11, position: 'sticky', top: 0, background: '#fff', zIndex: 3 }}>{['Пр.', 'ID', 'Проект', 'Владелец', 'Направление', 'Тип', 'Результат', 'База', '+План', 'С·И·С'].map((h, i) => <span key={h} style={{ textAlign: i >= 7 ? 'right' : 'left' }}>{h}</span>)}</div>
        {tops.length === 0 && <div style={{ padding: 24, color: S.i3, fontSize: 14 }}>Ничего не найдено.</div>}
        {tops.map((p) => <Fragment key={p.id}>{Line({ p })}</Fragment>)}
      </div></div>
    </>
  }

  // ---------- Timeline ----------
  const Timeline = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const ids = Object.keys(D.steps).filter((id) => { const p = D.byId[id]; const stg = p?.stage || D.byId[p?.parent]?.stage || ''; return inStage(stg) && (selfMatch(id) || (p?.parent && selfMatch(p.parent))) })
    const groups = ids.map((id) => [id, D.steps[id].filter((s) => (tlStatus === 'all' || s.status === tlStatus) && (!hideDone || s.end >= today))]).filter(([, ss]) => ss.length)
      .sort((a, b) => Math.min(...a[1].map((s) => s.start)) - Math.min(...b[1].map((s) => s.start)))
    const tpl = '110px 32px minmax(260px,3fr) 84px 50px 84px minmax(160px,1.4fr)'
    const isNow = (s) => s.start <= today && s.end >= today
    return <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span onClick={() => setHideDone(!hideDone)} style={toggleStyle()}><Box on={hideDone} />Скрыть завершённые этапы</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{[['all', 'Все статусы'], ['In progress', 'In progress'], ['Planned', 'Planned'], ['Wait', 'Wait'], ['At risk', 'At risk'], ['', 'Без статуса']].map(([v, l]) => <button key={l} onClick={() => setTlStatus(v)} style={{ ...chipStyle(tlStatus === v), padding: '5px 11px', minHeight: 30, fontSize: 12 }}>{l}</button>)}</div>
        <span style={{ fontSize: 12, color: S.i3 }}>· жирным — этап, идущий сейчас</span>
      </div>
      <div className="ws-scroll" style={scrollBox(0)}><div style={{ minWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 10, padding: '10px 14px', borderBottom: `1px solid ${S.ln}`, ...th, fontSize: 11, position: 'sticky', top: 0, background: '#fff', zIndex: 4 }}>{['Статус', '#', 'Этап', 'Старт', 'Нед.', 'Конец', 'Заметка'].map((h) => <span key={h}>{h}</span>)}</div>
        {groups.length === 0 && <div style={{ padding: 24, color: S.i3, fontSize: 14 }}>Ничего не найдено.</div>}
        {groups.map(([id, ss]) => { const p = D.byId[id]
          return <div key={id}>
            <div style={{ padding: '9px 14px', background: ACC.soft, borderBottom: `1px solid ${S.ln}`, position: 'sticky', top: 37, zIndex: 3, fontSize: 13, fontWeight: 600, color: '#3B6402' }}>{id} · {p?.name || id}<span style={{ fontWeight: 400, color: S.i3 }}>{p?.parent ? ` · подпроект ${p.parent}` : ''}{p?.owner ? ` · ${p.owner}` : ''}</span></div>
            {ss.map((s, i) => <div key={i} className="ws-row" style={{ display: 'grid', gridTemplateColumns: tpl, gap: 10, padding: '8px 14px', alignItems: 'center', borderBottom: '1px solid #F1F2F4', fontWeight: isNow(s) ? 600 : 400 }}>
              <span><span style={{ fontSize: 11, fontWeight: 600, color: st(s.status).tx, background: st(s.status).bg, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{s.status || '—'}</span></span>
              <span style={{ fontSize: 12, color: S.i2 }}>{s.n}</span><span style={{ fontSize: 13 }}>{s.name}</span><span style={{ fontSize: 12 }}>{dmy(s.start)}</span><span style={{ fontSize: 12, color: S.i2 }}>{s.weeks}</span><span style={{ fontSize: 12 }}>{dmy(s.end)}</span>
              <span style={{ fontSize: 12, color: S.i2, fontWeight: 400 }}>{s.note || s.wk.filter(Boolean).slice(-1)[0] || ''}</span>
            </div>)}
          </div> })}
      </div></div>
    </>
  }

  return <>
    <style>{CSS}</style>
    {toolbar}
    {err && <div style={{ fontSize: 13, color: '#A71F00', margin: '8px 0' }}>{err}</div>}
    <div style={{ marginTop: 10 }}>
      {tab === 'dash' && Dash()}
      {tab === 'road' && Road()}
      {tab === 'monthly' && Monthly()}
      {tab === 'quarter' && Quarter()}
      {tab === 'plan' && Plan()}
      {tab === 'timeline' && Timeline()}
    </div>
    {Drawer()}
  </>
}
