// Vercel Serverless: Growth Workshop 2027 (Google Sheets) для раздела «Workshop 2027» и карточек «Проекты».
// GET  /api/workshop                       → данные из кэша (Supabase workshop_cache), Google не трогаем
// POST /api/workshop?action=refresh        → перечитать таблицу, обновить кэш и карточки проектов (кнопка «Обновить»)
// GET  /api/workshop?action=cron           → то же по расписанию (Vercel Cron, полночь по Израилю)
// POST /api/workshop {id, step, week, text} → недельный комментарий в Timeline → «Week N» этапа
// Доступ: таблица расшарена на e-mail сервисного аккаунта (GOOGLE_SERVICE_ACCOUNT → client_email), роль «Редактор».
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1MtyFbfbESIxm8SRlDe6tRvQSwJ62-4Yaw8RfTa-dR4k';
const TABS = ['Projects Plan', 'Timeline', 'Monthly Report', 'Dashboard'];
const q = (name) => `'${name.replace(/'/g, "''")}'`;

function creds() { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}'); }
function sheetsClient(write) {
  const auth = new google.auth.GoogleAuth({
    credentials: creds(),
    scopes: [write ? 'https://www.googleapis.com/auth/spreadsheets' : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}
function colLetter(i) { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

async function requireUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data?.user || null;
}


// ─── Синхронизация: проекты Workshop → карточки «Проекты», недельные комментарии Roadmap/Timeline → project_comments ───
const CAT = { 'Brand Awareness': 'brand', 'Acquisition': 'acquisition', 'Win-Back': 'reactivation', 'Retention': 'retention', 'Strategy': 'strategy' };
const DAY = 86400000;
const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[\s\u00a0$%]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
const parseDate = (v) => { if (!v) return null; const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null; };
const iso = (d) => d.toISOString().slice(0, 10);
const monday = (d) => new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
const objs = (values) => { const h = (values?.[0] || []).map((x) => String(x || '').trim()); return (values || []).slice(1).map((r) => { const o = {}; h.forEach((k, i) => { if (k) o[k] = r[i] ?? ''; }); return o; }); };

async function runSync(tabs, sb) {
  const pv = tabs['Projects Plan'] || [], tv = tabs['Timeline'] || [], mv = tabs['Monthly Report'] || [];
  const plan = objs(pv).filter((o) => String(o.ID || '').trim()).map((o) => ({
    id: String(o.ID).trim(), name: String(o.Project || '').trim(), brief: o.Brief, desc: o.Description, owner: String(o.Owner || '').trim(), stage: o.Stage,
    exp: num(o['Expected Sales']), expTotal: num(o['Expected Sales (total)']), base: num(o.Baseline),
    parent: String(o['Parent ID'] || '').trim(), oldIds: String(o['Old ID'] || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean),
  }));
  const byPid = {}; plan.forEach((p) => { byPid[p.id] = p; });
  const subsOf = (id) => plan.filter((p) => p.parent === id);
  const mrHead = (mv[0] || []).map((x) => String(x || '').trim()); const iId = mrHead.indexOf('ID'), iProj = mrHead.indexOf('Project');
  const topIds = mv.slice(1).map((r) => String(r[iId] || '').trim()).filter((id, i) => id && !/^(TOTAL|PLAN)/.test(String(mv[i + 1][iProj] || '')));
  const steps = {};
  objs(tv).forEach((o) => { const id = String(o.ID || '').trim(); const start = parseDate(o.Start), end = parseDate(o.End); if (!id || !o.Step || !start) return;
    (steps[id] = steps[id] || []).push({ id, n: String(o['Step #'] || '').trim(), name: String(o.Step).trim(), start, end: end || start, owner: String(o.Owner || '').trim(), status: String(o.Status || '').trim(), notes: String(o.Notes || '').trim(), wk: Array.from({ length: 10 }, (_, i) => String(o['Week ' + (i + 1)] || '').trim()) }); });

  const { data: projects, error: pe } = await sb.from('projects').select('*');
  if (pe) throw new Error('projects: ' + pe.message);
  const byId = {}, byWs = {}; (projects || []).forEach((p) => { byId[p.id] = p; if (p.workshop_id) byWs[p.workshop_id] = p; });
  let maxSort = Math.max(0, ...(projects || []).map((p) => p.sort_order || 0));
  const today = iso(new Date()); const now = new Date().toISOString();
  const res = { created: [], linked: [], updated: 0, comments: 0, removedComments: 0, toProgress: [], notInSheet: [], subsCreated: [], steps: 0, removedSteps: 0 };
  const STEP_ST = (s) => { const v = s.toLowerCase(); if (/cancel/.test(v)) return null; if (/done|готов/.test(v)) return 'done'; if (/risk|риск|block/.test(v)) return 'risk'; if (/progress|работ/.test(v)) return 'doing'; return 'todo'; };

  for (const T of topIds) {
    const p = byPid[T]; if (!p) continue;
    const subs = subsOf(T);
    const allSteps = [T, ...subs.map((s) => s.id)].flatMap((id) => steps[id] || []);
    const starts = allSteps.map((s) => s.start).sort((a, b) => a - b), ends = allSteps.map((s) => s.end).sort((a, b) => a - b);
    const fields = {
      workshop_id: T, name: p.name, owner: p.owner || '—', category: CAT[String(p.stage || '').split(',')[0].trim()] || 'other',
      last_update: String(p.brief || '').trim() || String(p.desc || '').trim().slice(0, 400),
      date_start: starts[0] ? iso(starts[0]) : null, date_done: ends.length ? iso(ends[ends.length - 1]) : null,
      expected_sales: p.expTotal ?? p.exp ?? 0,
      workshop_subs: subs.map((s) => ({ id: s.id, name: s.name, owner: s.owner, exp: s.exp ?? 0 })),
      workshop_synced_at: now,
    };
    let row = byWs[T] || byId[T] || p.oldIds.map((o) => byId[o]).find(Boolean);
    if (row) {
      // ручные правки в дашборде важнее таблицы: такие поля не перезаписываем
      const manual = new Set(Array.isArray(row.manual_fields) ? row.manual_fields : []);
      const upd = {}; Object.keys(fields).forEach((k) => { if (!manual.has(k)) upd[k] = fields[k]; });
      const { error } = await sb.from('projects').update(upd).eq('id', row.id); if (error) throw new Error(`${T}: ${error.message}`);
      if (!row.workshop_id) res.linked.push(`${row.id} → ${T}`); res.updated++;
      row = { ...row, ...upd };
    } else {
      row = { id: T, ...fields, status: 'wait', priority: 'current', sort_order: ++maxSort };
      const { error } = await sb.from('projects').insert(row); if (error) throw new Error(`${T}: ${error.message}`);
      res.created.push(T);
    }
    // недельные комментарии: ячейка Roadmap = неделя этапа = Timeline «Week N»
    const want = [];
    for (const id of [T, ...subs.map((s) => s.id)]) {
      const sp = byPid[id];
      for (const s of steps[id] || []) s.wk.forEach((txt, i) => { if (!txt) return;
        const ws = iso(monday(new Date(s.start.getTime() + i * 7 * DAY)));
        const head = (id !== T ? `${id} · ${sp?.name || ''}\n` : '') + `Этап ${s.n}: ${s.name}`;
        const full = `${head}\n${txt}`;
        want.push({ project_id: row.id, week_start: ws, author: s.owner || sp?.owner || p.owner || 'Workshop', full_text: full, summary: txt.length > 150 ? txt.slice(0, 120).replace(/\s\S*$/, '') + '…' : txt, source: 'sheet', ext_key: `ws|${id}|${s.n}|${i + 1}` });
      });
    }
    // комментарии, поправленные или скрытые в дашборде, не перезаписываем и не удаляем
    const { data: old } = await sb.from('project_comments').select('id,ext_key,manual').eq('project_id', row.id).eq('source', 'sheet');
    const manualKeys = new Set((old || []).filter((o) => o.manual).map((o) => o.ext_key));
    const toWrite = want.filter((w) => !manualKeys.has(w.ext_key));
    if (toWrite.length) { const { error } = await sb.from('project_comments').upsert(toWrite, { onConflict: 'ext_key' }); if (error) throw new Error(`comments ${T}: ${error.message}`); res.comments += toWrite.length; }
    const keep = new Set(want.map((w) => w.ext_key)); const stale = (old || []).filter((o) => !o.manual && !keep.has(o.ext_key)).map((o) => o.id);
    if (stale.length) { await sb.from('project_comments').delete().in('id', stale); res.removedComments += stale.length; }
    // подпроекты из таблицы → отдельные проекты с parent_id (ручные правки в дашборде не трогаем)
    const rowOf = { [T]: row };
<<<<<<< HEAD
=======
    try {
>>>>>>> main
    for (const s of subs) {
      const sSteps = steps[s.id] || []; const ss = sSteps.map((x) => x.start).sort((a, b) => a - b), se = sSteps.map((x) => x.end).sort((a, b) => a - b);
      const sf = { workshop_id: s.id, name: s.name || s.id, owner: s.owner || row.owner || '—', parent_id: row.id, category: CAT[String(s.stage || '').split(',')[0].trim()] || row.category || 'other',
        description: String(s.desc || s.brief || '').trim().slice(0, 2000), expected_sales: s.exp ?? null, date_start: ss[0] ? iso(ss[0]) : null, date_done: se.length ? iso(se[se.length - 1]) : null, workshop_synced_at: now };
      let sr = byWs[s.id] || byId[s.id] || s.oldIds.map((o) => byId[o]).find(Boolean);
      if (sr) { const man = new Set(Array.isArray(sr.manual_fields) ? sr.manual_fields : []); const upd = {}; Object.keys(sf).forEach((k) => { if (!man.has(k)) upd[k] = sf[k]; });
        const { error } = await sb.from('projects').update(upd).eq('id', sr.id); if (error) throw new Error(`${s.id}: ${error.message}`); sr = { ...sr, ...upd }; }
      else { sr = { id: s.id, ...sf, status: sSteps.some((x) => STEP_ST(x.status) === 'doing') ? 'progress' : 'wait', priority: 'current', sort_order: ++maxSort };
        const { error } = await sb.from('projects').insert(sr); if (error) throw new Error(`${s.id}: ${error.message}`); res.subsCreated.push(s.id); byId[s.id] = sr; byWs[s.id] = sr; }
      rowOf[s.id] = sr;
    }
    // этапы из Timeline → project_steps (этапы, изменённые или удалённые в дашборде, не трогаем)
    const wantSteps = [];
    for (const id of [T, ...subs.map((s) => s.id)]) for (const s of steps[id] || []) { const st = STEP_ST(s.status); if (!st) continue;
      wantSteps.push({ project_id: rowOf[id].id, name: s.name, description: s.notes || '', start_date: iso(s.start), end_date: iso(s.end < s.start ? s.start : s.end), owner: s.owner || byPid[id]?.owner || '', status: st, sort_order: parseInt(s.n, 10) || 0, source: 'sheet', ext_key: `st|${id}|${s.n}`, updated_at: now }); }
    const famIds = Object.values(rowOf).map((r) => r.id);
    const { data: oldSteps, error: ose } = await sb.from('project_steps').select('id,ext_key,manual,hidden').in('project_id', famIds).eq('source', 'sheet');
    if (ose) throw new Error('project_steps: ' + ose.message + ' — выполни SQL для шага 2');
    const lockedSteps = new Set((oldSteps || []).filter((o) => o.manual || o.hidden).map((o) => o.ext_key));
    const stepsToWrite = wantSteps.filter((w) => !lockedSteps.has(w.ext_key));
    if (stepsToWrite.length) { const { error } = await sb.from('project_steps').upsert(stepsToWrite, { onConflict: 'ext_key' }); if (error) throw new Error(`steps ${T}: ${error.message}`); res.steps += stepsToWrite.length; }
    const keepSteps = new Set(wantSteps.map((w) => w.ext_key)); const staleSteps = (oldSteps || []).filter((o) => !o.manual && !o.hidden && !keepSteps.has(o.ext_key)).map((o) => o.id);
    if (staleSteps.length) { await sb.from('project_steps').delete().in('id', staleSteps); res.removedSteps += staleSteps.length; }
<<<<<<< HEAD
=======
    } catch (e) { res.stepsError = res.stepsError || String(e.message || e); }
>>>>>>> main
    // автостатус: только «ожидание» → «в работе», при первом комментарии
    if ((row.status || 'wait') === 'wait' && !(row.manual_fields || []).includes('status') && want.some((w) => w.week_start <= today)) { await sb.from('projects').update({ status: 'progress' }).eq('id', row.id); res.toProgress.push(T); }
  }
  const sheetIds = new Set(topIds);
  plan.forEach((p) => { if (p.parent) sheetIds.add(p.id); });
  res.notInSheet = (projects || []).filter((p) => p.workshop_id && !sheetIds.has(p.workshop_id)).map((p) => p.workshop_id);
  return res;
}

const sbAdmin = () => createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
const sbAsUser = (req) => { if (process.env.SUPABASE_SERVICE_KEY) return sbAdmin(); const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }); };

// Читаем таблицу целиком и кладём в кэш (Supabase → workshop_cache). Дашборд дальше читает кэш, а не Google.
async function fetchSheet() {
  const sheets = sheetsClient(false);
  const { data } = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges: TABS.map(q), valueRenderOption: 'FORMATTED_VALUE' });
  const tabs = {}; (data.valueRanges || []).forEach((vr, i) => { tabs[TABS[i]] = vr.values || []; });
  return tabs;
}
async function refreshAll(sb) {
  const tabs = await fetchSheet(); const fetchedAt = new Date().toISOString();
  const { error } = await sb.from('workshop_cache').upsert({ id: 'main', data: tabs, fetched_at: fetchedAt });
  if (error) throw new Error('workshop_cache: ' + error.message);
  const sync = await runSync(tabs, sb);
  return { tabs, fetchedAt, sync };
}
const isCron = (req) => { const secret = process.env.CRON_SECRET; const auth = req.headers.authorization || ''; return secret ? auth === `Bearer ${secret}` : /vercel-cron/i.test(req.headers['user-agent'] || ''); };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const sb = sbAdmin();
    // Ежедневно в полночь по Израилю (Vercel Cron) и по кнопке «Обновить»: таблица → кэш + карточки проектов
    if (req.query.action === 'cron') {
      if (!isCron(req)) return res.status(401).json({ error: 'Unauthorized' });
      const r = await refreshAll(sb); return res.json({ ok: true, fetchedAt: r.fetchedAt, ...r.sync });
    }
    if (req.method === 'POST' && (req.query.action === 'refresh' || req.query.action === 'sync')) {
      const user = await requireUser(req);
      if (!user) return res.status(401).json({ error: 'Нужно войти в дашборд' });
      const r = await refreshAll(sbAsUser(req)); return res.json({ ok: true, tabs: r.tabs, fetchedAt: r.fetchedAt, ...r.sync });
    }
    if (req.method === 'POST') {
      const user = await requireUser(req);
      if (!user) return res.status(401).json({ error: 'Нужно войти в дашборд' });
      const { id, step, week, text } = req.body || {};
      const w = Number(week);
      if (!id || !step || !(w >= 1 && w <= 10)) return res.status(400).json({ error: 'Нужны id, step и week (1–10)' });
      const sheets = sheetsClient(true);
      const { data } = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: q('Timeline') });
      const rows = data.values || [];
      const head = (rows[0] || []).map((h) => String(h || '').trim());
      const iId = head.indexOf('ID'), iStep = head.indexOf('Step #'), iWeek = head.indexOf('Week ' + w);
      if (iId < 0 || iStep < 0 || iWeek < 0) return res.status(500).json({ error: 'В Timeline не найдены колонки ID / Step # / Week ' + w });
      const r = rows.findIndex((row, i) => i > 0 && String(row[iId] || '').trim() === String(id) && String(row[iStep] || '').trim() === String(step));
      if (r < 0) return res.status(404).json({ error: `Этап ${step} проекта ${id} не найден в Timeline` });
      const range = `${q('Timeline')}!${colLetter(iWeek)}${r + 1}`;
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range, valueInputOption: 'RAW', requestBody: { values: [[String(text || '').slice(0, 2000)]] } });
      return res.json({ ok: true, range });
    }
    // GET: отдаём кэш; если кэша ещё нет — читаем таблицу один раз
    const { data: cached } = await sb.from('workshop_cache').select('data,fetched_at').eq('id', 'main').maybeSingle();
    if (cached?.data) return res.json({ tabs: cached.data, fetchedAt: cached.fetched_at, cached: true });
    const r = await refreshAll(sb);
    return res.json({ tabs: r.tabs, fetchedAt: r.fetchedAt, cached: false });
  } catch (e) {
    const email = creds().client_email || 'сервисный аккаунт';
    const denied = /permission|403|not have access/i.test(e.message || '');
    return res.status(denied ? 403 : 500).json({ error: denied ? `Нет доступа к таблице. Откройте Growth Workshop 2027 для ${email} (редактор).` : e.message });
  }
}
