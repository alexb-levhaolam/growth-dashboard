// Vercel Serverless: Monthly cumulative from Daily Tracking
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { month, untilDay } = req.query; // month=2026-07, untilDay=12 (optional: last day of reporting period)
  if (!month) return res.status(400).json({ error: 'month required' });

  const SHEET_ID = '1eDtGDROu-UbtiHJBlY9P3ZWmmku6LDYZwNos6F2BbLg';
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

  try {

    // Источник: export (точные значения ячеек, без вывода типов gviz, из-за которого
    // «текстовые» ячейки приходят пустыми). Если export не подходит — fallback на gviz.
    const looksValid = t => { if (!t || t.trim().startsWith('<')) return false; const lines = t.split('\n'); const dated = lines.filter(l => /^"?\d{2}\.\d{2}"?,/.test(l)).length; return dated >= 20 && (lines[Math.floor(lines.length/2)]||'').split(',').length >= 60; };
    let csv = null, source = null;
    for (const [src, url] of [['export', `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`], ['gviz', CSV_URL]]) {
      try { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) continue; const t = await r.text(); if (src === 'gviz' || looksValid(t)) { csv = t; source = src; break; } } catch (e) {}
    }
    if (!csv) throw new Error('Sheet not accessible');

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

    const pn = s => { if (!s) return 0; const n = Number(String(s).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }; // любые пробелы, $, запятые-разделители тысяч
    const [year, mo] = month.split('-').map(Number);
    const moStr = String(mo).padStart(2, '0');
    const maxDay = untilDay ? parseInt(untilDay) : 31;

    let totalSales = 0, adSpend = 0, paidSales = 0, daysWithData = 0;
    let discountsBL = 0, discountsBS = 0, totalSpentBM = 0; // BL(63)=Discount_Spent, BS(70)=Discount_Spent_Ivan
    const channels = {};
    const debug = req.query.debug === '1'; const debugRows = [];
    const seenDates = new Set();
    let firstMatchRow = -1;

    for (let ri = rows.length - 1; ri >= 0; ri--) {
      const r = rows[ri];
      if (!r || !r[0]) continue;
      const dm = r[0].match(/^(\d{2})\.(\d{2})\s*$/);
      if (!dm) continue;
      if (dm[2] !== moStr) continue;
      const dayNum = parseInt(dm[1]);
      if (dayNum > maxDay) continue;

      const dateKey = dm[1] + '.' + dm[2];
      if (seenDates.has(dateKey)) continue;
      seenDates.add(dateKey);

      if (firstMatchRow === -1) firstMatchRow = ri;
      else if (firstMatchRow - ri > 200) continue;

      const tot = pn(r[61]);
      if (tot === 0 && pn(r[14]) === 0) continue;

      daysWithData++;
      if (debug) debugRows.push({ date: dateKey, row: ri, metaSpent_N: r[13], metaSales_O: r[14], i365Spent_AF: r[31], totalSales_BJ: r[61], totalSpent_BM: r[64] });
      totalSales += tot;
      discountsBL += pn(r[63]);
      discountsBS += pn(r[70]);
      totalSpentBM += pn(r[64]);

      const chData = {
        Meta: { sp: pn(r[13]), sa: pn(r[14]) },
        Google: { sp: pn(r[16])+pn(r[19])+pn(r[22])+pn(r[25])+pn(r[28])+pn(r[34]), sa: pn(r[17])+pn(r[20])+pn(r[23])+pn(r[26])+pn(r[29])+pn(r[35]) },
        'Israel 365': { sp: pn(r[31]), sa: pn(r[32]) },
        TikTok: { sp: pn(r[37]), sa: pn(r[38]) },
        Reddit: { sp: pn(r[40]), sa: pn(r[41]) },
        Pinterest: { sp: pn(r[43]), sa: pn(r[44]) },
        Rumble: { sp: pn(r[46]), sa: pn(r[47]) },
        Taboola: { sp: pn(r[49]), sa: pn(r[50]) },
        Email: { sp: 0, sa: pn(r[52])+pn(r[53])+pn(r[54])+pn(r[55]) },
        SMM: { sp: 0, sa: pn(r[56])+pn(r[57]) },
        SEO: { sp: 0, sa: pn(r[58]) },
        Direct: { sp: 0, sa: pn(r[60]) },
      };
      for (const [name, v] of Object.entries(chData)) {
        if (!channels[name]) channels[name] = { sales: 0, spent: 0 };
        channels[name].sales += v.sa;
        channels[name].spent += v.sp;
        // CPO Ads: только платные каналы; Israel 365 (Brand Awareness) не участвует
        if (v.sp > 0 && name !== 'Israel 365') { adSpend += v.sp; paidSales += v.sa; }
      }
    }

    const chArr = Object.entries(channels).map(([name, v]) => ({
      name, sales: v.sales, spent: v.spent,
      cpo: v.sales > 0 && v.spent > 0 ? Math.round(v.spent / v.sales) : null
    }));

    res.json({ month, totalSales, adSpend, paidSales, daysWithData, discountsBL, discountsBS, totalSpentBM, channels: chArr, source, ...(debug ? { debug: debugRows } : {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
