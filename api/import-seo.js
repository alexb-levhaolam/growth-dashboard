import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1XOkKEAvrM6RT48gkhM_Fnkml5aAHpn_ZhSMC3iwqci4';
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function getSheets() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  return google.sheets({ version: 'v4', auth });
}

function parseNum(v) {
  if (!v) return null;
  const s = String(v).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parsePct(v) {
  if (!v) return null;
  const s = String(v).replace(',', '.').replace('%', '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function weekToId(label) {
  // "03.08-09.08.2026" → "2026-08-03"
  const m = label.match(/(\d{2})\.(\d{2})[-–].*\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function monthToId(label) {
  // "Август 2026" or "Январь 2026" → "2026-08"
  const months = {'январь':'01','февраль':'02','март':'03','апрель':'04','май':'05','июнь':'06','июль':'07','август':'08','сентябрь':'09','октябрь':'10','ноябрь':'11','декабрь':'12'};
  const parts = label.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const mo = months[parts[0]];
  if (!mo) return null;
  return `${parts[1]}-${mo}`;
}

export default async function handler(req, res) {
  try {
    const { type } = req.body || {}; // 'weekly' or 'monthly'
    const sheets = await getSheets();

    if (type === 'weekly' || !type) {
      // Read weekly sheet (second sheet)
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'Недельный отчет'!A1:Z50" });
      const rows = r.data.values || [];
      // Row 0-2: headers, Row 3+: data
      // Col 0: date, 1: organic visits, 2: organic sales, 3: ai visits, 4: ai sales
      // 5: gsc impressions, 6: gsc clicks
      // 7: blog clicks, 8: blog impressions, 9: blog ctr, 10: blog position
      // 11: recipes clicks, 12: recipes impressions, 13: recipes ctr, 14: recipes position
      // 15: gift clicks, 16: gift impressions, 17: gift ctr, 18: gift position
      // 19: support clicks, 20: support impressions, 21: support ctr, 22: support position
      // 23: gen ai impressions, 24: ai citations, 25: ai pages
      
      let imported = 0;
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || !row[0].trim()) continue;
        const id = weekToId(row[0]);
        if (!id) continue;
        
        const sections = {};
        // Blog
        if (parseNum(row[7]) != null || parseNum(row[8]) != null) {
          sections['Blog'] = { clicks: parseNum(row[7]), impressions: parseNum(row[8]), ctr: parsePct(row[9]), position: parseNum(row[10]) };
        }
        // Recipes
        if (parseNum(row[11]) != null || parseNum(row[12]) != null) {
          sections['Recipes'] = { clicks: parseNum(row[11]), impressions: parseNum(row[12]), ctr: parsePct(row[13]), position: parseNum(row[14]) };
        }
        // Gift
        if (parseNum(row[15]) != null || parseNum(row[16]) != null) {
          sections['Gift'] = { clicks: parseNum(row[15]), impressions: parseNum(row[16]), ctr: parsePct(row[17]), position: parseNum(row[18]) };
        }
        // Support
        if (parseNum(row[19]) != null || parseNum(row[20]) != null) {
          sections['Support'] = { clicks: parseNum(row[19]), impressions: parseNum(row[20]), ctr: parsePct(row[21]), position: parseNum(row[22]) };
        }

        const data = {
          id, week_label: row[0].trim(),
          organic_visits: parseNum(row[1]), organic_sales: parseNum(row[2]),
          ai_visits: parseNum(row[3]), ai_sales: parseNum(row[4]),
          gsc_impressions: parseNum(row[5]), gsc_clicks: parseNum(row[6]),
          sections,
          gen_ai_impressions: parseNum(row[23]),
          ai_citations: parseNum(row[24]), ai_pages: parseNum(row[25]),
          updated_at: new Date().toISOString()
        };

        await sb.from('seo_weekly').upsert(data, { onConflict: 'id' });
        imported++;
      }
      
      if (type === 'weekly') return res.json({ message: `Недельный: импортировано ${imported} строк` });
    }

    if (type === 'monthly' || !type) {
      // Read monthly sheet (third sheet)
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'Месячный отчет'!A1:Z50" });
      const rows = r.data.values || [];
      
      let imported = 0;
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || !row[0].trim()) continue;
        const id = monthToId(row[0]);
        if (!id) continue;

        const sections = {};
        if (parseNum(row[7]) != null || parseNum(row[8]) != null) sections['Blog'] = { clicks: parseNum(row[7]), impressions: parseNum(row[8]), ctr: parsePct(row[9]), position: parseNum(row[10]) };
        if (parseNum(row[11]) != null || parseNum(row[12]) != null) sections['Recipes'] = { clicks: parseNum(row[11]), impressions: parseNum(row[12]), ctr: parsePct(row[13]), position: parseNum(row[14]) };
        if (parseNum(row[15]) != null || parseNum(row[16]) != null) sections['Gift'] = { clicks: parseNum(row[15]), impressions: parseNum(row[16]), ctr: parsePct(row[17]), position: parseNum(row[18]) };
        if (parseNum(row[19]) != null || parseNum(row[20]) != null) sections['Support'] = { clicks: parseNum(row[19]), impressions: parseNum(row[20]), ctr: parsePct(row[21]), position: parseNum(row[22]) };

        const data = {
          id, month_label: row[0].trim(),
          organic_visits: parseNum(row[1]), organic_sales: parseNum(row[2]),
          ai_visits: parseNum(row[3]), ai_sales: parseNum(row[4]),
          gsc_impressions: parseNum(row[5]), gsc_clicks: parseNum(row[6]),
          sections,
          gen_ai_impressions: parseNum(row[23]),
          ai_citations: parseNum(row[24]), ai_pages: parseNum(row[25]),
          updated_at: new Date().toISOString()
        };

        await sb.from('seo_monthly').upsert(data, { onConflict: 'id' });
        imported++;
      }

      if (type === 'monthly') return res.json({ message: `Месячный: импортировано ${imported} строк` });
    }

    return res.json({ message: 'Оба отчёта импортированы' });
  } catch (error) {
    console.error('SEO import error:', error);
    return res.status(500).json({ error: error.message });
  }
}
