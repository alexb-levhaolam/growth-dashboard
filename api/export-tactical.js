import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SHEET_ID = '1-H5ogBGHhJsYorfYIZ_yIywoGHTXxk_yEepIq6etij8';

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getLastWeek() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(mon.getDate() - mon.getDay() - 6); // Last Monday
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const ws = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
  return { label: `${fmt(mon)}-${fmt(sun)}`, week_start: ws };
}

export default async function handler(req, res) {
  try {
    const { week_start: overrideWs } = req.body || {};
    const { label, week_start } = overrideWs ? 
      { label: overrideWs, week_start: overrideWs } : getLastWeek();

    // 1. Get tactical tasks
    const { data: tasks } = await supabase
      .from('tactical_tasks')
      .select('*')
      .order('sort_order');

    // 2. Get progress for this week
    const { data: progress } = await supabase
      .from('tactical_progress')
      .select('*')
      .eq('week_start', week_start);

    if (!tasks?.length) return res.json({ message: 'No tactical tasks found' });

    const sheets = await getSheets();

    // 3. Read current headers to check if new columns needed
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A1:ZZ2',
    });
    const headers = headerRes.data.values || [];
    const row1 = headers[0] || [];

    // Count existing task columns (every 3 columns after "Дата")
    const existingTasks = [];
    for (let i = 1; i < row1.length; i += 3) {
      if (row1[i]) existingTasks.push(row1[i]);
    }

    // 4. Check if we need to add new columns
    const newTasks = tasks.filter(t => !existingTasks.includes(t.name));
    if (newTasks.length > 0) {
      const newHeaders1 = [];
      const newHeaders2 = [];
      for (const t of newTasks) {
        newHeaders1.push(t.name, '', '');
        newHeaders2.push('Цифры / Статус', '%', 'Комментарий');
      }
      const startCol = row1.length;
      // Append new header columns
      const colLetter = n => {
        let s = '';
        while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
        return s;
      };
      const range1 = `${colLetter(startCol)}1:${colLetter(startCol + newHeaders1.length - 1)}1`;
      const range2 = `${colLetter(startCol)}2:${colLetter(startCol + newHeaders2.length - 1)}2`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: range1,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newHeaders1] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: range2,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newHeaders2] },
      });
    }

    // 5. Re-read headers after potential update
    const finalHeaders = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A1:ZZ1',
    });
    const finalRow1 = finalHeaders.data.values?.[0] || [];

    // Build task order from headers
    const taskOrder = [];
    for (let i = 1; i < finalRow1.length; i += 3) {
      if (finalRow1[i]) taskOrder.push(finalRow1[i]);
    }

    // 6. Build data row
    const row = [label];
    for (const taskName of taskOrder) {
      const task = tasks.find(t => t.name === taskName);
      const prog = task ? progress?.find(p => p.task_id === task.id) : null;

      if (task && prog) {
        const current = prog.current ?? task.current ?? '';
        const target = task.target ?? '';
        const pct = target && current ? Math.round((current / target) * 100) + '%' : '';
        const comment = prog.comment || '';
        row.push(`${current} / ${target}`, pct, comment);
      } else if (task) {
        const current = task.current ?? '';
        const target = task.target ?? '';
        const pct = target && current ? Math.round((current / target) * 100) + '%' : '';
        row.push(`${current} / ${target}`, pct, '');
      } else {
        row.push('', '', '');
      }
    }

    // 7. Append row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'A:A',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    // 8. Log export
    await supabase.from('export_log').insert({
      type: 'tactical',
      week_start,
      row_data: row,
      exported_at: new Date().toISOString(),
    });

    return res.json({ 
      message: `Выгружено: ${label}, ${tasks.length} задач, ${taskOrder.length} колонок`,
      row 
    });

  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: error.message });
  }
}
