import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1-H5ogBGHhJsYorfYIZ_yIywoGHTXxk_yEepIq6etij8';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

async function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

function getLastWeek() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(mon.getDate() - mon.getDay() - 6);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const ws = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
  return { label: `${fmt(mon)}-${fmt(sun)}`, week_start: ws };
}

function colLetter(n) {
  let s = '';
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

export default async function handler(req, res) {
  try {
    const sb = getSupabase();
    const { week_start: overrideWs } = req.body || {};
    const { label, week_start } = overrideWs ? { label: overrideWs, week_start: overrideWs } : getLastWeek();

    const { data: tasks } = await sb.from('tactical_tasks').select('*').order('sort_order');
    const { data: progress } = await sb.from('tactical_progress').select('*').eq('week_start', week_start);

    if (!tasks?.length) return res.json({ message: 'No tactical tasks found' });

    const sheets = await getSheets();

    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'A1:ZZ2' });
    const row1 = headerRes.data.values?.[0] || [];

    const existingTasks = [];
    for (let i = 1; i < row1.length; i += 3) { if (row1[i]) existingTasks.push(row1[i]); }

    const newTasks = tasks.filter(t => !existingTasks.includes(t.name));
    if (newTasks.length > 0) {
      const newH1 = [], newH2 = [];
      for (const t of newTasks) { newH1.push(t.name, '', ''); newH2.push('Цифры / Статус', '%', 'Комментарий'); }
      const startCol = row1.length;
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${colLetter(startCol)}1:${colLetter(startCol + newH1.length - 1)}1`, valueInputOption: 'USER_ENTERED', requestBody: { values: [newH1] } });
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${colLetter(startCol)}2:${colLetter(startCol + newH2.length - 1)}2`, valueInputOption: 'USER_ENTERED', requestBody: { values: [newH2] } });
    }

    const finalH = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'A1:ZZ1' });
    const finalRow1 = finalH.data.values?.[0] || [];
    const taskOrder = [];
    for (let i = 1; i < finalRow1.length; i += 3) { if (finalRow1[i]) taskOrder.push(finalRow1[i]); }

    const row = [label];
    for (const taskName of taskOrder) {
      const task = tasks.find(t => t.name === taskName);
      const prog = task ? progress?.find(p => p.task_id === task.id) : null;
      const current = prog?.current ?? task?.current ?? '';
      const target = task?.target ?? '';
      const pct = target && current ? Math.round((current / target) * 100) + '%' : '';
      const comment = prog?.comment || '';
      row.push(`${current} / ${target}`, pct, comment);
    }

    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: 'A:A', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } });
    await sb.from('export_log').insert({ type: 'tactical', week_start, row_data: row, exported_at: new Date().toISOString() });

    return res.json({ message: `Выгружено: ${label}, ${tasks.length} задач` });
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: error.message });
  }
}
