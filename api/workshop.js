// Vercel Serverless: Growth Workshop 2027 (Google Sheets) для раздела «Workshop 2027».
// GET  /api/workshop            → значения листов Projects Plan, Timeline, Monthly Report, Dashboard, Chart Data
// POST /api/workshop {id, step, week, text}  → пишет недельный комментарий в Timeline → «Week N» нужного этапа
// Доступ: таблица должна быть расшарена на e-mail сервисного аккаунта (GOOGLE_SERVICE_ACCOUNT → client_email).
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1MtyFbfbESIxm8SRlDe6tRvQSwJ62-4Yaw8RfTa-dR4k';
const TABS = ['Projects Plan', 'Timeline', 'Monthly Report', 'Dashboard', 'Chart Data'];
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
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
