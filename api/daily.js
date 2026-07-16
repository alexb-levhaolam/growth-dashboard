// Vercel Serverless: reads Daily Tracking → returns structured channel data
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

    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const wsYear = ws.getFullYear();

    const pn = s => { if (!s) return 0; return Number(s.replace(/[$,\s\u00a0]/g, '')) || 0; };

    // Channel accumulators
    const ch = {
      Meta:      {spent:0,sales:0},
      Google:    {spent:0,sales:0},
      'Israel 365':{spent:0,sales:0},
      Email:     {spent:0,sales:0},
      SMM:       {spent:0,sales:0},
      SEO:       {spent:0,sales:0},
      Direct:    {spent:0,sales:0},
      TikTok:    {spent:0,sales:0},
      Reddit:    {spent:0,sales:0},
      Pinterest: {spent:0,sales:0},
      Rumble:    {spent:0,sales:0},
      Taboola:   {spent:0,sales:0},
    };
    const days = [];
    let totalSales = 0;

    for (const r of rows) {
      if (!r[0]) continue;
      const dm = r[0].match(/^(\d{2})\.(\d{2})\s*$/);
      if (!dm) continue;
      const day = parseInt(dm[1]), month = parseInt(dm[2]);
      const rd = new Date(wsYear, month - 1, day, 12);
      if (rd < ws || rd > we) continue;

      // Column indices (0-based from header):
      // 13=All_MetaAds_Spent, 14=All_MetaAds_Sales
      // 16=PMAX_Spent,17=Sales 19=YTB_Spent,20=Sales 22=Brand_Spent,23=Sales
      // 25=Search_Spent,26=Sales 28=DG_Spent,29=Sales 34=Bing_Spent,35=Sales
      // 31=Awareness_Spent, 32=Awareness_Sales
      // 37=TikTok_Spent,38=Sales 40=Reddit_Spent,41=Sales
      // 43=Pinterest_Spent,44=Sales 46=Rumble_Spent,47=Sales 49=Taboola_Spent,50=Sales
      // 52=Cold 53=React 54=Welcome 55=Abandoned
      // 57=Social_Sales 58=SEO_Sales 59=Direct_Spent 60=Direct_Sales
      // 61=Admin_Sales(TOTAL)

      const meta_sp = pn(r[13]), meta_sa = pn(r[14]);
      const g_sp = pn(r[16])+pn(r[19])+pn(r[22])+pn(r[25])+pn(r[28])+pn(r[34]);
      const g_sa = pn(r[17])+pn(r[20])+pn(r[23])+pn(r[26])+pn(r[29])+pn(r[35]);
      const i365_sp = pn(r[31]), i365_sa = pn(r[32]);
      const tt_sp=pn(r[37]),tt_sa=pn(r[38]);
      const rd_sp=pn(r[40]),rd_sa=pn(r[41]);
      const pin_sp=pn(r[43]),pin_sa=pn(r[44]);
      const rum_sp=pn(r[46]),rum_sa=pn(r[47]);
      const tab_sp=pn(r[49]),tab_sa=pn(r[50]);
      const email_sa = pn(r[52])+pn(r[53])+pn(r[54])+pn(r[55]);
      const smm_sa = pn(r[57]);
      const seo_sa = pn(r[58]);
      const dir_sp = pn(r[59]), dir_sa = pn(r[60]);
      const tot = pn(r[61]);

      ch.Meta.spent+=meta_sp; ch.Meta.sales+=meta_sa;
      ch.Google.spent+=g_sp; ch.Google.sales+=g_sa;
      ch['Israel 365'].spent+=i365_sp; ch['Israel 365'].sales+=i365_sa;
      ch.TikTok.spent+=tt_sp; ch.TikTok.sales+=tt_sa;
      ch.Reddit.spent+=rd_sp; ch.Reddit.sales+=rd_sa;
      ch.Pinterest.spent+=pin_sp; ch.Pinterest.sales+=pin_sa;
      ch.Rumble.spent+=rum_sp; ch.Rumble.sales+=rum_sa;
      ch.Taboola.spent+=tab_sp; ch.Taboola.sales+=tab_sa;
      ch.Email.sales+=email_sa;
      ch.SMM.sales+=smm_sa;
      ch.SEO.sales+=seo_sa;
      ch.Direct.spent+=dir_sp; ch.Direct.sales+=dir_sa;
      totalSales += tot;

      const dn=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      days.push({ day:`${dn[rd.getDay()]} ${dm[1]}.${dm[2]}`, sales: tot, note:'' });
    }

    const channels = Object.entries(ch).map(([name,v]) => ({
      name, sales: v.sales, spent: v.spent,
      cpo: v.sales > 0 && v.spent > 0 ? Math.round(v.spent / v.sales) : null
    }));

    // Default hidden channels
    const defaultHidden = ['Reddit','Pinterest','Rumble'];

    res.json({ days, channels, totalSales, defaultHidden, daysFound: days.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
