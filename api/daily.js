// Vercel Serverless: reads Daily Tracking → structured channel data
// v10fix3: header-based column lookup + dedup dates
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { weekStart } = req.query;
  if (!weekStart) return res.status(400).json({ error: 'weekStart required' });

  const SHEET_ID = '1eDtGDROu-UbtiHJBlY9P3ZWmmku6LDYZwNos6F2BbLg';
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

  try {
    const resp = await fetch(CSV_URL);
    if (!resp.ok) throw new Error('Sheet not accessible');
    const csv = await resp.text();

    // Parse CSV
    const rows = []; let cur = '', inQ = false, row = [], i = 0;
    while (i < csv.length) {
      const ch = csv[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ''; }
      else if ((ch === '\n' || ch === '\r') && !inQ) { if (cur || row.length) { row.push(cur.trim()); rows.push(row); row = []; cur = ''; } if (ch === '\r' && csv[i+1] === '\n') i++; }
      else cur += ch;
      i++;
    }
    if (cur || row.length) { row.push(cur.trim()); rows.push(row); }

    // Find header row by looking for "All_MetaAds_Spent" or "All_MetaAds_Sales"
    let headerIdx = -1;
    let col = {};
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];
      const metaCol = r.findIndex(c => c.replace(/\\/g,'').includes('All_MetaAds_Spent'));
      if (metaCol >= 0) {
        headerIdx = ri;
        // Build column map from header names
        r.forEach((name, ci) => {
          const clean = name.replace(/\\/g, '').replace(/_/g, '_').trim();
          if (clean) col[clean] = ci;
        });
        break;
      }
    }
    if (headerIdx < 0) throw new Error('Header row not found in CSV');

    // Column lookup helper
    const C = (name) => col[name] ?? -1;
    const pn = (s) => { if (!s) return 0; return Number(s.replace(/[$,\s\u00a0]/g, '')) || 0; };
    const getCol = (r, name) => C(name) >= 0 ? pn(r[C(name)]) : 0;

    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const wsYear = ws.getFullYear();

    const channels = {
      Meta: { spent: 0, sales: 0 },
      Google: { spent: 0, sales: 0 },
      'Israel 365': { spent: 0, sales: 0 },
      Email: { spent: 0, sales: 0 },
      SMM: { spent: 0, sales: 0 },
      SEO: { spent: 0, sales: 0 },
      Direct: { spent: 0, sales: 0 },
      TikTok: { spent: 0, sales: 0 },
      Reddit: { spent: 0, sales: 0 },
      Pinterest: { spent: 0, sales: 0 },
      Rumble: { spent: 0, sales: 0 },
      Taboola: { spent: 0, sales: 0 },
    };
    const days = [];
    let totalSales = 0;
    const seenDates = new Set(); // dedup

    // Only process rows AFTER the header row
    for (let ri = headerIdx + 1; ri < rows.length; ri++) {
      const r = rows[ri];
      const dateCell = r[C('Date')] || r[0] || '';
      const dm = dateCell.match(/^(\d{2})\.(\d{2})\s*$/);
      if (!dm) continue;

      const dateKey = `${dm[1]}.${dm[2]}`;
      if (seenDates.has(dateKey)) continue; // skip duplicates
      seenDates.add(dateKey);

      const day = parseInt(dm[1]), month = parseInt(dm[2]);
      const rd = new Date(wsYear, month - 1, day, 12);
      if (rd < ws || rd > we) continue;

      // Meta Total
      const meta_sp = getCol(r, 'All_MetaAds_Spent');
      const meta_sa = getCol(r, 'All_MetaAds_Sales');
      // Google = PMAX + YTB + Brand + Search + DemandGen + Bing
      const g_sp = getCol(r,'Google_PMAX_Spent')+getCol(r,'YTB_Ads_Spent')+getCol(r,'Google_Brand_Spent')+getCol(r,'Search_Spent')+getCol(r,'Google_DemandGen_Spent')+getCol(r,'Bing_Brand_Spent');
      const g_sa = getCol(r,'Google_PMAX_Sales')+getCol(r,'YTB_Ads_Sales')+getCol(r,'Google_Brand_Sales')+getCol(r,'Search_Sales')+getCol(r,'Google_DemandGen_Sales')+getCol(r,'Bing_Brand_Sales');
      // Israel 365 = Awareness
      const i365_sp = getCol(r,'Google_Awareness_Spent');
      const i365_sa = getCol(r,'Google_Awareness_Sales');
      // Other channels
      const tt_sp=getCol(r,'TikTok_Spent'),tt_sa=getCol(r,'TikTok_Sales');
      const rd_sp=getCol(r,'Reddit_Spent'),rd_sa=getCol(r,'Reddit_Sales');
      const pin_sp=getCol(r,'Pinterest_Spent'),pin_sa=getCol(r,'Pinterest_Sales');
      const rum_sp=getCol(r,'Rumble_Spent'),rum_sa=getCol(r,'Rumble_Sales');
      const tab_sp=getCol(r,'Taboola_Spent'),tab_sa=getCol(r,'Taboola_Sales');
      // Email = Cold + React + Welcome + Abandoned
      const email_sa = getCol(r,'Cold_base')+getCol(r,'Reactivation_base')+getCol(r,'Welcome_flow')+getCol(r,'Abandoned_flow');
      // SMM, SEO, Direct
      const smm_sa = getCol(r,'Social_Sales');
      const seo_sa = getCol(r,'SEO_Sales');
      const dir_sp = getCol(r,'Direct_Spent'), dir_sa = getCol(r,'Direct_Sales');
      // Total
      const tot = getCol(r,'Admin_Sales');

      channels.Meta.spent+=meta_sp; channels.Meta.sales+=meta_sa;
      channels.Google.spent+=g_sp; channels.Google.sales+=g_sa;
      channels['Israel 365'].spent+=i365_sp; channels['Israel 365'].sales+=i365_sa;
      channels.TikTok.spent+=tt_sp; channels.TikTok.sales+=tt_sa;
      channels.Reddit.spent+=rd_sp; channels.Reddit.sales+=rd_sa;
      channels.Pinterest.spent+=pin_sp; channels.Pinterest.sales+=pin_sa;
      channels.Rumble.spent+=rum_sp; channels.Rumble.sales+=rum_sa;
      channels.Taboola.spent+=tab_sp; channels.Taboola.sales+=tab_sa;
      channels.Email.sales+=email_sa;
      channels.SMM.sales+=smm_sa;
      channels.SEO.sales+=seo_sa;
      channels.Direct.spent+=dir_sp; channels.Direct.sales+=dir_sa;
      totalSales += tot;

      const dn=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      days.push({ day:`${dn[rd.getDay()]} ${dm[1]}.${dm[2]}`, sales: tot, note:'' });
    }

    const chArr = Object.entries(channels).map(([name,v]) => ({
      name, sales: v.sales, spent: v.spent,
      cpo: v.sales > 0 && v.spent > 0 ? Math.round(v.spent / v.sales) : null
    }));

    res.json({
      days, channels: chArr, totalSales,
      defaultHidden: ['Reddit','Pinterest','Rumble','TikTok'],
      daysFound: days.length,
      debug: { headerRow: headerIdx, columnsFound: Object.keys(col).length, seenDates: [...seenDates] }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
