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
    const nc = `_nc=${Date.now()}`; // без кэша Google: всегда свежие значения
    for (const [src, url] of [['export', `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&${nc}`], ['gviz', `${CSV_URL}&${nc}`]]) {
      try { const r = await fetch(url, { redirect: 'follow', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }); if (!r.ok) continue; const t = await r.text(); if (src === 'gviz' || looksValid(t)) { csv = t; source = src; break; } } catch (e) {}
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

    // Meta: приоритет у блока «Meta Total» — N (траты) и O (продажи).
    // Если N/O пустые или 0 → сумма блоков с Meta: траты B + K (Direct Sales + FEBR-1), продажи C + L.
    // Если N/O заполнены, но не равны сумме блоков → используем N/O и сообщаем о расхождении.
    // Разовые исключения по датам (поломка в N): 'max' — брать большее из N и B + K.
    const META_EXCEPTIONS = { '2026-10-14': 'max' };
    const metaRow = (r, iso) => {
      const nSp = pn(r[13]), oSa = pn(r[14]), oRaw = String(r[14] || '').trim();
      const bkSp = pn(r[1]) + pn(r[10]), clSa = pn(r[2]) + pn(r[11]);
      const ex = META_EXCEPTIONS[iso];
      let sp, spFrom;
      if (ex === 'max') { sp = Math.max(nSp, bkSp); spFrom = sp === nSp ? 'N' : 'B+K (исключение)'; }
      else if (nSp > 0) { sp = nSp; spFrom = 'N'; }
      else { sp = bkSp; spFrom = 'B+K'; }
      const useO = oRaw !== '' && (oSa > 0 || clSa === 0);
      const sa = useO ? oSa : clSa, saFrom = useO ? 'O' : 'C+L';
      const mism = [];
      if (!ex && nSp > 0 && nSp !== bkSp) mism.push({ what: 'траты', total: nSp, sum: bkSp });
      if (useO && oSa !== clSa) mism.push({ what: 'продажи', total: oSa, sum: clSa });
      return { sp, sa, spFrom, saFrom, mism };
    };
    const metaCheck = { fallbackSpent: [], fallbackSales: [], mismatches: [] };
    const noteMeta = (dateKey, m) => { if (m.spFrom !== 'N') metaCheck.fallbackSpent.push(dateKey); if (m.saFrom !== 'O') metaCheck.fallbackSales.push(dateKey); m.mism.forEach(x => metaCheck.mismatches.push({ date: dateKey, ...x })); };
    const [year, mo] = month.split('-').map(Number);
    const moStr = String(mo).padStart(2, '0');
    const maxDay = untilDay ? parseInt(untilDay) : 31;

    let totalSales = 0, adSpend = 0, paidSales = 0, daysWithData = 0;
    let discountsBL = 0, discountsBS = 0, totalSpentBM = 0; // BL(63)=Discount_Spent, BS(70)=Discount_Spent_Ivan
    const channels = {};
    const debug = req.query.debug === '1'; const debugRows = [];
    // Платные каналы — как «All Paid» в LH Daily: Meta + Google + новые. Israel 365 (Awareness) не входит.
    const PAID = new Set(['Meta', 'Google', 'TikTok', 'Reddit', 'Pinterest', 'Rumble', 'Taboola']);
    const gaps = {}; // платный канал: есть продажи, но нет трат в Daily
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
      const meta = metaRow(r, `${year}-${dm[2]}-${dm[1]}`);
      if (tot === 0 && meta.sa === 0) continue;
      noteMeta(dateKey, meta);

      daysWithData++;
      if (debug) debugRows.push({ date: dateKey, row: ri, N: r[13], O: r[14], B: r[1], K: r[10], C: r[2], L: r[11], metaSpentUsed: meta.sp + ' (' + meta.spFrom + ')', metaSalesUsed: meta.sa + ' (' + meta.saFrom + ')', i365Spent_AF: r[31], totalSales_BJ: r[61], totalSpent_BM: r[64] });
      totalSales += tot;
      discountsBL += pn(r[63]);
      discountsBS += pn(r[70]);
      totalSpentBM += pn(r[64]);

      const chData = {
        Meta: { sp: meta.sp, sa: meta.sa },
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
        if (PAID.has(name)) {
          adSpend += v.sp; paidSales += v.sa;
          if (v.sp === 0 && v.sa > 0) (gaps[name] = gaps[name] || []).push(dateKey);
        }
      }
    }

    const chArr = Object.entries(channels).map(([name, v]) => ({
      name, sales: v.sales, spent: v.spent,
      cpo: v.sales > 0 && v.spent > 0 ? Math.round(v.spent / v.sales) : null
    }));

    res.json({ month, totalSales, adSpend, paidSales, daysWithData, discountsBL, discountsBS, totalSpentBM, channels: chArr, gaps, metaCheck, source, ...(debug ? { debug: debugRows } : {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
