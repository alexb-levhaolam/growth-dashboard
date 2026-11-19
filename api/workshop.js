// Vercel Serverless: Growth Workshop 2027 (Google Sheets) для раздела «Workshop 2027».
// GET  /api/workshop            → значения листов Projects Plan, Timeline, Monthly Report, Dashboard, Chart Data
// POST /api/workshop {id, step, week, text}  → пишет недельный комментарий в Timeline → «Week N» нужного этапа
// POST /api/workshop?action=sync           → проекты Workshop → карточки «Проекты», комментарии недель → project_comments
// Доступ: таблица должна быть расшарена на e-mail сервисного аккаунта (GOOGLE_SERVICE_ACCOUNT → client_email).
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

async function runSync(sheets, sb) {
  const { data } = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges: ['Projects Plan', 'Timeline', 'Monthly Report'].map(q), valueRenderOption: 'FORMATTED_VALUE' });
  const [pv, tv, mv] = (data.valueRanges || []).map((x) => x.values || []);
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
    (steps[id] = steps[id] || []).push({ id, n: String(o['Step #'] || '').trim(), name: String(o.Step).trim(), start, end: end || start, owner: String(o.Owner || '').trim(), wk: Array.from({ length: 10 }, (_, i) => String(o['Week ' + (i + 1)] || '').trim()) }); });

  const { data: projects, error: pe } = await sb.from('projects').select('*');
  if (pe) throw new Error('projects: ' + pe.message);
  const byId = {}, byWs = {}; (projects || []).forEach((p) => { byId[p.id] = p; if (p.workshop_id) byWs[p.workshop_id] = p; });
  let maxSort = Math.max(0, ...(projects || []).map((p) => p.sort_order || 0));
  const today = iso(new Date()); const now = new Date().toISOString();
  const res = { created: [], linked: [], updated: 0, comments: 0, removedComments: 0, toProgress: [], notInSheet: [] };

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
    // автостатус: только «ожидание» → «в работе», при первом комментарии
    if ((row.status || 'wait') === 'wait' && !(row.manual_fields || []).includes('status') && want.some((w) => w.week_start <= today)) { await sb.from('projects').update({ status: 'progress' }).eq('id', row.id); res.toProgress.push(T); }
  }
  const sheetIds = new Set(topIds);
  res.notInSheet = (projects || []).filter((p) => p.workshop_id && !sheetIds.has(p.workshop_id)).map((p) => p.workshop_id);
  return res;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (req.method === 'POST' && req.query.action === 'sync') {
      const user = await requireUser(req);
      if (!user) return res.status(401).json({ error: 'Нужно войти в дашборд' });
      const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
      const result = await runSync(sheetsClient(false), sb);
      return res.json({ ok: true, ...result });
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

    const sheets = sheetsClient(false);
    const { data } = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SHEET_ID, ranges: TABS.map(q), valueRenderOption: 'FORMATTED_VALUE' });
    const tabs = {};
    (data.valueRanges || []).forEach((vr, i) => { tabs[TABS[i]] = vr.values || []; });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.json({ tabs, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const email = creds().client_email || 'сервисный аккаунт';
    const denied = /permission|403|not have access/i.test(e.message || '');
    return res.status(denied ? 403 : 500).json({ error: denied ? `Нет доступа к таблице. Откройте Growth Workshop 2027 для ${email} (${req.method === 'POST' ? 'редактор' : 'читатель'}).` : e.message });
  }
}
