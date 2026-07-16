// Vercel Serverless: Daily Tracking → channel data
// v10fix6: hardcoded column indices from exact sheet positions
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
    const rows = []; let cur = '', inQ = false, row = [];
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ''; }
      else if ((ch === '\n' || ch === '\r') && !inQ) {
        if (cur || row.length) { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
        if (ch === '\r' && csv[i+1] === '\n') i++;
      } else cur += ch;
    }
    if (cur || row.length) { row.push(cur.trim()); rows.push(row); }

    const pn = s => { if (!s) return 0; return Number(s.replace(/[$,\s\u00a0]/g, '')) || 0; };
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const wsYear = ws.getFullYear();

    // Exact column indices from sheet (0-based: A=0, B=1, ... Z=25, AA=26, etc.)
    // Col 0=Date(A), 13=Meta_Spent(N), 14=Meta_Sales(O)
    // Google Sales: 17(R)+20(U)+23(X)+26(AA)+29(AD)+35(AJ)
    // Google Spent: 16(Q)+19(T)+22(W)+25(Z)+28(AC)+34(AI)
    // Israel365: 31(AF)spent, 32(AG)sales
    // TikTok: 37(AL)spent, 38(AM)sales
    // Reddit: 40(AO)spent, 41(AP)sales
    // Pinterest: 43(AR)spent, 44(AS)sales
    // Rumble: 46(AU)spent, 47(AV)sales
    // Taboola: 49(AX)spent, 50(AY)sales
    // Email sales: 52(BA)+53(BB)+54(BC)+55(BD)
    // SMM sales: 56(BE)+57(BF)
    // Direct sales: 60(BI)
    // Total sales: 61(BJ)

    const channels = {
      Meta:{spent:0,sales:0}, Google:{spent:0,sales:0}, 'Israel 365':{spent:0,sales:0},
      Email:{spent:0,sales:0}, SMM:{spent:0,sales:0}, SEO:{spent:0,sales:0},
      Direct:{spent:0,sales:0}, TikTok:{spent:0,sales:0}, Reddit:{spent:0,sales:0},
      Pinterest:{spent:0,sales:0}, Rumble:{spent:0,sales:0}, Taboola:{spent:0,sales:0},
    };
    const days = [];
    let totalSales = 0;
    const debugRows = [];

    // Iterate BOTTOM-TO-TOP to prefer most recent year for duplicate dd.mm dates
    const seenDates = new Set();
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      const r = rows[ri];
      if (!r || !r[0]) continue;
      const dm = r[0].match(/^(\d{2})\.(\d{2})\s*$/);
      if (!dm) continue;

      const dateKey = `${dm[1]}.${dm[2]}`;
      if (seenDates.has(dateKey)) continue;
      seenDates.add(dateKey);

      const day = parseInt(dm[1]), month = parseInt(dm[2]);
      const rd = new Date(wsYear, month - 1, day, 12);
      if (rd < ws || rd > we) continue;

      // Skip rows with no actual data (future dates with 0)
      const tot = pn(r[61]);
      if (tot === 0 && pn(r[14]) === 0 && pn(r[17]) === 0) continue;

      const meta_sp=pn(r[13]), meta_sa=pn(r[14]);
      const g_sp=pn(r[16])+pn(r[19])+pn(r[22])+pn(r[25])+pn(r[28])+pn(r[34]);
      const g_sa=pn(r[17])+pn(r[20])+pn(r[23])+pn(r[26])+pn(r[29])+pn(r[35]);
      const i365_sp=pn(r[31]), i365_sa=pn(r[32]);
      const tt_sp=pn(r[37]), tt_sa=pn(r[38]);
      const rd_sp=pn(r[40]), rd_sa=pn(r[41]);
      const pin_sp=pn(r[43]), pin_sa=pn(r[44]);
      const rum_sp=pn(r[46]), rum_sa=pn(r[47]);
      const tab_sp=pn(r[49]), tab_sa=pn(r[50]);
      const email_sa=pn(r[52])+pn(r[53])+pn(r[54])+pn(r[55]);
      const smm_sa=pn(r[56])+pn(r[57]);
      const seo_sa=pn(r[58]);
      const dir_sa=pn(r[60]);

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
      channels.Direct.sales+=dir_sa;
      totalSales+=tot;

      const dn=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      days.push({ day:`${dn[rd.getDay()]} ${dm[1]}.${dm[2]}`, sales:tot, note:'' });
      debugRows.push({ date:dateKey, row:ri, meta:meta_sa, google:g_sa, email:email_sa, direct:dir_sa, total:tot });
    }

    // Sort days chronologically (since we iterated in reverse)
    days.sort((a,b) => {
      const da=a.day.split(' ')[1], db=b.day.split(' ')[1];
      return da.localeCompare(db);
    });

    const chArr = Object.entries(channels).map(([name,v]) => ({
      name, sales:v.sales, spent:v.spent,
      cpo: v.sales>0 && v.spent>0 ? Math.round(v.spent/v.sales) : null
    }));

    res.json({
      days, channels:chArr, totalSales,
      defaultHidden:['Reddit','Pinterest','Rumble','TikTok'],
      daysFound:days.length,
      debug:{ totalRows:rows.length, matchedRows:debugRows }
    });
  } catch(e) {
    res.status(500).json({ error:e.message });
  }
}
