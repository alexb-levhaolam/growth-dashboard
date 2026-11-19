import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { S, Label, chipStyle, ACC } from '../lib/ui'

// ═══ WORKSHOP 2027 — зеркало таблицы Growth Workshop 2027 ═══
const STAGES = ['Brand Awareness', 'Acquisition', 'Win-Back', 'Retention', 'Strategy']
const ST = {
  'In progress': { bg: '#C9E58A', tx: '#3B6402', w: 3 },
  'Planned': { bg: '#CFE0F8', tx: '#1A56B8', w: 1 },
  'Wait': { bg: '#FFE0B0', tx: '#8A3500', w: 2 },
  'At risk': { bg: '#FFC6B8', tx: '#A71F00', w: 4 },
  'Done': { bg: '#E4E6E9', tx: '#3B6402', w: 0 },
  '': { bg: '#E4E6E9', tx: '#585E65', w: 0 },
}
const st = (s) => ST[s] || ST['']
const MN = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 86400000

const num = (v) => { if (v == null || v === '') return null; const s = String(v).replace(/[\s\u00a0$%]/g, '').replace(/,(?=\d{3}(\D|$))/g, ''); const n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : null }
const fmt = (v) => v == null ? '' : Math.round(v).toLocaleString('ru-RU')
const parseDate = (v) => {
  if (!v) return null; const s = String(v).trim(); let m
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3], 12)
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[1] - 1, +m[2], 12)
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1], 12)
  return null
}
const dm = (d) => d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') : ''
const dmy = (d) => d ? dm(d) + '.' + String(d.getFullYear()).slice(2) : ''
const objs = (values) => { const h = (values?.[0] || []).map((x) => String(x || '').trim()); return (values || []).slice(1).map((r) => { const o = {}; h.forEach((k, i) => { if (k) o[k] = r[i] ?? '' }); return o }).filter((o) => Object.values(o).some((v) => String(v).trim() !== '')) }
const pick = (o, prefix) => { const k = Object.keys(o).find((x) => x.startsWith(prefix)); return k ? o[k] : '' }
const stagesOf = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)

function parse(tabs) {
  // Projects Plan
  const plan = objs(tabs['Projects Plan']).filter((o) => o.ID).map((o) => ({
    id: String(o.ID).trim(), name: o.Project, brief: o.Brief, desc: o.Description, owner: o.Owner, stage: o.Stage, type: o.Type, outcome: o.Outcome,
    base: num(o.Baseline), exp: num(o['Expected Sales']), total: num(o['Total Sales']), expTotal: num(o['Expected Sales (total)']),
    prio: num(o.Priority), c: pick(o, 'Сложность'), i: pick(o, 'Импакт'), u: o.Urgency, parent: String(o['Parent ID'] || '').trim(), level: o.Level, budget: o['Additional Budget'], oldId: o['Old ID'],
  }))
  const byId = {}; plan.forEach((p) => { byId[p.id] = p })
  const subs = {}; plan.forEach((p) => { if (p.parent) (subs[p.parent] = subs[p.parent] || []).push(p) })
  // Monthly Report
  const mrVals = tabs['Monthly Report'] || []
  const mrHead = (mrVals[0] || []).map((x) => String(x || '').trim())
  const monthCols = mrHead.map((h, i) => [h, i]).filter(([h]) => /^\d{4}-\d{2}$/.test(h))
  const mrRows = mrVals.slice(1).map((r) => { const o = {}; mrHead.forEach((k, i) => { o[k] = r[i] ?? '' }); o.months = monthCols.map(([, i]) => num(r[i])); return o })
  const special = {}; const top = []
  mrRows.forEach((o) => { const name = String(o.Project || '').trim(); if (['TOTAL-SALES', 'TOTAL-CPO', 'PLAN SALES', 'PLAN CPO'].includes(name)) special[name] = o.months; else if (o.ID) top.push({ status: o.Status, id: String(o.ID).trim(), name, stage: o.Stage, type: o.Type, prio: num(o.Priority), base: num(o.Baseline), exp: num(o['Expected Sales']), total: num(o['Total Sales']), months: o.months }) })
  const months = monthCols.map(([h]) => h)
  const lastIdx = (special['TOTAL-SALES'] || []).reduce((a, v, i) => (v != null ? i : a), -1)
  // Timeline
  const steps = {}
  objs(tabs['Timeline']).forEach((o) => {
    const id = String(o.ID || '').trim(); const start = parseDate(o.Start); const end = parseDate(o.End)
    if (!id || !o.Step || !start || !end) return
    (steps[id] = steps[id] || []).push({ id, n: String(o['Step #'] || '').trim(), name: o.Step, status: String(o.Status || '').trim(), start, end, weeks: o.Weeks, note: o.Notes, wk: Array.from({ length: 10 }, (_, i) => o['Week ' + (i + 1)] || '') })
  })
  // Dashboard: блок PLAN VS ACTUAL
  const dv = tabs['Dashboard'] || []; let pva = [], pvaHead = [], planStart = '', planEnd = ''
  const hr = dv.findIndex((r) => (r || []).some((c) => String(c).trim() === 'Stage') && (r || []).some((c) => String(c).trim() === 'Baseline'))
  if (hr >= 0) {
    const c0 = dv[hr].findIndex((c) => String(c).trim() === 'Stage'); pvaHead = dv[hr].slice(c0, c0 + 7)
    for (let r = hr + 1; r < dv.length; r++) { const row = (dv[r] || []).slice(c0, c0 + 7); if (!row[0]) break; pva.push(row); if (/^Total/.test(row[0])) break }
  }
  dv.forEach((r) => { (r || []).forEach((c, i) => { if (String(c).trim() === 'Plan start') planStart = r[i + 1]; if (String(c).trim() === 'Plan end') planEnd = r[i + 1] }) })
  // Chart Data
  const chart = objs(tabs['Chart Data']).map((o) => ({ m: o.Month, fact: num(o['Actual sales']), plan: num(o.Plan) }))
  return { plan, byId, subs, top, months, special, lastIdx, steps, pva, pvaHead, planStart, planEnd, chart }
}

const card = { background: S.sf, borderRadius: 14, boxShadow: S.sh, padding: '18px 20px' }
const th = { fontSize: 12, fontWeight: 600, color: S.i3 }

export default function Workshop({ ce }) {
  const [raw, setRaw] = useState(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('road'); const [stage, setStage] = useState('all'); const [ptype, setPtype] = useState('all')
  const [open, setOpen] = useState({}); const [popen, setPopen] = useState({}); const [cell, setCell] = useState(null)
  const [detail, setDetail] = useState(''); const [year, setYear] = useState('2026'); const [tlStatus, setTlStatus] = useState('all')
  const [drafts, setDrafts] = useState({}); const [saving, setSaving] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try { const r = await fetch('/api/workshop'); const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'Ошибка загрузки'); setRaw(d) } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const D = useMemo(() => (raw ? parse(raw.tabs) : null), [raw])

  if (loading && !D) return <div style={{ ...card, color: S.i3 }}>Загружаю Growth Workshop 2027…</div>
  if (err && !D) return <div style={{ ...card, color: '#A71F00' }}>Не удалось загрузить таблицу: {err} <button onClick={load} style={{ ...chipStyle(false), marginLeft: 8 }}>Повторить</button></div>
  if (!D) return null

  const inStage = (s) => stage === 'all' || stagesOf(s).includes(stage)
  const weeks = (() => { const t = new Date(); t.setHours(12, 0, 0, 0); const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const start = new Date(mon); start.setDate(start.getDate() - 14); const end = new Date(2027, 11, 27, 12); const w = []; for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * DAY)) w.push([new Date(d), new Date(d.getTime() + 6 * DAY)]); return w })()
  const todayIdx = 2
  const stepsAt = (id, w) => (D.steps[id] || []).filter((s) => s.start <= w[1] && s.end >= w[0])
  const weekN = (s, w) => Math.max(1, Math.floor((w[0] - s.start) / (7 * DAY)) + 1)
  const noteOf = (s, w) => { const n = weekN(s, w); return n <= 10 ? s.wk[n - 1] : '' }

  const saveNote = async (s, w, text) => {
    const n = weekN(s, w); if (n > 10) { alert('В Timeline есть только колонки Week 1–10'); return }
    const key = s.id + '|' + s.n + '|' + n; setSaving(key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') }, body: JSON.stringify({ id: s.id, step: s.n, week: n, text }) })
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'Ошибка')
      s.wk[n - 1] = text; setDrafts((p) => { const x = { ...p }; delete x[key]; return x })
    } catch (e) { alert('Не сохранилось: ' + e.message) } finally { setSaving('') }
  }

  const tabs = [['dash', 'Дашборд'], ['road', 'Roadmap'], ['monthly', 'Monthly Report'], ['quarter', 'Quarterly Report'], ['plan', 'Projects Plan'], ['timeline', 'Timeline']]

  // ---------- общие куски ----------
  const header = <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 24, fontWeight: 600 }}>Growth Workshop 2027</span>
      <span style={{ fontSize: 13, color: S.i3 }}>Из таблицы Growth Workshop 2027{D.planStart ? ` · план ${D.planStart} – ${D.planEnd}` : ''} · обновлено {raw?.fetchedAt ? new Date(raw.fetchedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <a href="https://docs.google.com/spreadsheets/d/1MtyFbfbESIxm8SRlDe6tRvQSwJ62-4Yaw8RfTa-dR4k/edit" target="_blank" rel="noreferrer" style={{ ...chipStyle(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Открыть таблицу ↗</a>
      <button onClick={load} disabled={loading} style={{ fontSize: 14, color: ACC.tx, background: ACC.bg, border: `1px solid ${ACC.bd}`, borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, minHeight: 38 }}>{loading ? 'Обновляю…' : 'Обновить'}</button>
    </div>
  </div>
  const filters = <>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{tabs.map(([v, l]) => <button key={v} onClick={() => { setTab(v); setCell(null) }} style={{ fontSize: 14, border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', minHeight: 40, background: tab === v ? ACC.bg : '#fff', color: tab === v ? ACC.tx : S.ink, fontWeight: tab === v ? 600 : 500, boxShadow: S.sh }}>{l}</button>)}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}><span style={{ fontSize: 12, color: S.i3, width: 90 }}>Направление</span>{['all', ...STAGES].map((v) => <button key={v} onClick={() => setStage(v)} style={chipStyle(stage === v)}>{v === 'all' ? 'Все' : v}</button>)}</div>
  </>

  // ---------- Дашборд ----------
  const Dash = () => {
    const scope = D.plan.filter((p) => !p.parent && inStage(p.stage) && (ptype === 'all' || p.type === ptype))
    const topScope = D.top.filter((t) => inStage(t.stage) && (ptype === 'all' || t.type === ptype))
    const base = topScope.reduce((a, t) => a + (t.base || 0), 0); const now = topScope.reduce((a, t) => a + (t.months[D.lastIdx] || 0), 0)
    const tgt = scope.reduce((a, p) => a + ((p.expTotal ?? p.exp) || 0), 0); const gr = now - base
    const agg = (k, keys) => { const t = {}; scope.forEach((p) => { t[p[k]] = (t[p[k]] || 0) + ((p.expTotal ?? p.exp) || 0) }); return keys.map((x) => [x, t[x] || 0]) }
    const maxC = Math.max(1, ...D.chart.map((c) => Math.max(c.fact || 0, c.plan || 0)))
    const detP = D.byId[detail] || D.byId[D.top[0]?.id]
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}><div style={{ minWidth: 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(6,1fr)', gap: 10, padding: '14px 20px', borderBottom: `1px solid ${S.ln}`, ...th }}>{['Направление', 'Baseline', D.pvaHead[2] || 'Сейчас', 'Цель', 'Прирост', '% цели', 'Health'].map((h, i) => <span key={i} style={{ textAlign: i ? 'right' : 'left' }}>{h}</span>)}</div>
        {D.pva.filter((r) => stage === 'all' || r[0] === stage || /^Total/.test(r[0])).map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(6,1fr)', gap: 10, padding: '11px 20px', fontSize: 14, borderBottom: '1px solid #F1F2F4', background: /^Total/.test(r[0]) ? ACC.soft : '#fff', fontWeight: /^Total/.test(r[0]) ? 600 : 400 }}>
          <span>{r[0]}</span>{[1, 2, 3, 4, 5].map((k) => <span key={k} style={{ textAlign: 'right', fontWeight: k === 2 ? 600 : undefined }}>{r[k]}</span>)}<span style={{ textAlign: 'right' }}><span style={{ fontSize: 11, fontWeight: 600, color: S.i2, background: '#F1F2F4', borderRadius: 999, padding: '3px 9px' }}>{r[6]}</span></span>
        </div>)}
      </div></div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '2 1 520px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 16, fontWeight: 600 }}>Продажи компании: факт и план</span><span style={{ display: 'flex', gap: 14, fontSize: 12, color: S.i2 }}><span>■ <span style={{ color: '#8CC63F' }}>факт</span></span><span style={{ color: '#1761CB' }}>— план</span></span></div>
          <div style={{ overflowX: 'auto' }}><div style={{ display: 'grid', gridTemplateColumns: `repeat(${D.chart.length},minmax(26px,1fr))`, gap: 5, alignItems: 'end', height: 190, minWidth: D.chart.length * 31 }}>
            {D.chart.map((c, i) => <div key={i} title={`${c.m}: факт ${fmt(c.fact) || '—'}, план ${fmt(c.plan)}`} style={{ position: 'relative', height: 190, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              {c.plan != null && <span style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#1761CB', bottom: Math.round(c.plan / maxC * 160) }} />}
              <span style={{ fontSize: 9, color: S.i2, marginBottom: 3 }}>{fmt(c.fact)}</span>
              <span style={{ width: '100%', maxWidth: 26, height: c.fact ? Math.round(c.fact / maxC * 160) : 0, background: '#8CC63F', borderRadius: '5px 5px 2px 2px' }} />
            </div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${D.chart.length},minmax(26px,1fr))`, gap: 5, minWidth: D.chart.length * 31, marginTop: 6 }}>{D.chart.map((c, i) => <span key={i} style={{ fontSize: 10, color: S.i3, textAlign: 'center' }}>{String(c.m || '').split(' ')[0]}</span>)}</div></div>
        </div>
        <div style={{ ...card, flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Срез · {stage === 'all' ? 'все направления' : stage}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['all', 'Channel', 'Funnel', 'SMM', 'Offline'].map((v) => <button key={v} onClick={() => setPtype(v)} style={chipStyle(ptype === v)}>{v === 'all' ? 'Все типы' : v}</button>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            {[['Baseline (старт)', fmt(base)], [`Сейчас (${D.months[D.lastIdx] || '—'})`, fmt(now)], ['Цель: +продаж в мес', fmt(tgt)], ['Прирост · % плана', `${gr > 0 ? '+' : ''}${gr} · ${tgt ? (gr / tgt * 100).toFixed(1) : 0}%`]].map(([l, v], i) => <div key={i} style={{ background: S.bg, borderRadius: 12, padding: '12px 14px' }}><div style={{ fontSize: 12, color: S.i2 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 600, color: i === 3 ? (gr < 0 ? '#A71F00' : '#3B6402') : S.ink }}>{v}</div></div>)}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {[['Ожидаемые продажи по типу', agg('type', ['Channel', 'Funnel', 'SMM', 'Offline'])], ['По результату', agg('outcome', ['Sales', 'Lead', 'Affiliate', 'Retention', 'Reach/Awareness'])]].map(([t, rows]) => <div key={t} style={card}><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t}</div>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '7px 0', borderBottom: '1px solid #F1F2F4' }}><span>{l}</span><span style={{ fontWeight: 600 }}>{fmt(v)}</span></div>)}</div>)}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Детали проекта</span>
          <select value={detP?.id || ''} onChange={(e) => setDetail(e.target.value)} style={{ height: 40, border: `1px solid ${S.ln}`, borderRadius: 10, padding: '0 10px', fontSize: 14 }}>{D.top.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.name}</option>)}</select>
          {detP && <><span style={{ fontSize: 12, color: S.i3 }}>{detP.stage} · {detP.type} · {detP.outcome} · +{fmt(detP.expTotal ?? detP.exp)} в мес</span>
            <span style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>{detP.brief}</span>
            {(D.steps[detP.id] || []).map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: st(s.status).bg, flexShrink: 0 }} /><span style={{ flex: 1 }}>{s.name}</span><span style={{ color: S.i3, whiteSpace: 'nowrap' }}>{dm(s.start)} – {dm(s.end)}</span></div>)}</>}
        </div>
      </div>
    </div>
  }

  // ---------- Roadmap ----------
  const Road = () => {
    const cellsFor = (id, isParent) => weeks.map((w, wi) => {
      let text = '', status = null, hasNote = false
      const own = stepsAt(id, w)
      if (isParent) {
        const act = (D.subs[id] || []).filter((s) => stepsAt(s.id, w).length)
        const all = act.map((s) => stepsAt(s.id, w)[0]).concat(own)
        if (all.length) { status = all.sort((a, b) => st(b.status).w - st(a.status).w)[0].status; text = act.length ? '▸' + act.length : own[0].n }
        hasNote = all.some((s) => noteOf(s, w))
      } else if (own.length) { const s = own[own.length - 1]; status = s.status; text = s.n; hasNote = own.some((x) => noteOf(x, w)) }
      return { text, status, hasNote, wi }
    })
    const span = (id, isParent) => { const ids = isParent ? (D.subs[id] || []).map((s) => s.id).concat([id]) : [id]; const ds = []; ids.forEach((k) => (D.steps[k] || []).forEach((s) => { ds.push(s.start); ds.push(s.end) })); if (!ds.length) return ''; ds.sort((a, b) => a - b); return dmy(ds[0]) + ' – ' + dmy(ds[ds.length - 1]) }
    const first = (t) => { const ids = (D.subs[t.id] || []).map((s) => s.id).concat([t.id]); const ds = []; ids.forEach((k) => (D.steps[k] || []).forEach((s) => ds.push(s.start))); return ds.length ? Math.min(...ds) : Infinity }
    const Row = ({ id, label, sub, isParent }) => {
      const cs = cellsFor(id, isParent)
      return <div style={{ display: 'flex', borderBottom: '1px solid #F1F2F4', background: sub ? '#FBFBFC' : '#fff' }}>
        <div style={{ width: 330, flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', padding: sub ? '3px 12px 3px 42px' : '3px 12px', boxSizing: 'border-box', minWidth: 0, position: 'sticky', left: 0, background: sub ? '#FBFBFC' : '#fff', zIndex: 1 }}>
          {isParent && <button onClick={() => setOpen({ ...open, [id]: !open[id] })} aria-label={open[id] ? 'Свернуть' : 'Раскрыть'} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, border: `1px solid ${S.ln}`, background: '#fff', cursor: 'pointer', padding: 0, fontSize: 12, color: S.i2 }}>{open[id] ? '−' : '+'}</button>}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 12, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}><span style={{ color: S.i3 }}>{id}</span> {label}</span><span style={{ fontSize: 10, color: S.i3 }}>{span(id, isParent) || 'без дат'}</span></span>
        </div>
        <div style={{ display: 'flex' }}>{cs.map((c) => { const sel = cell && cell.id === id && cell.wi === c.wi; const s = c.status != null ? st(c.status) : null
          return <button key={c.wi} onClick={() => setCell(c.status != null || c.hasNote ? { id, wi: c.wi, isParent, label } : null)} title={c.status != null ? `${label} · ${dm(weeks[c.wi][0])} · ${c.status || 'без статуса'}` : ''} style={{ position: 'relative', width: 22, height: 26, margin: '3px 0', flexShrink: 0, border: 'none', borderLeft: '1px solid #fff', padding: 0, fontSize: 10, fontWeight: 600, cursor: c.status != null ? 'pointer' : 'default', background: s ? s.bg : (c.wi === todayIdx ? '#FFF1EE' : c.wi % 2 ? '#FAFAFB' : '#fff'), color: s ? s.tx : '#B7BCC2', outline: sel ? '2px solid #121416' : 'none', outlineOffset: -2, boxShadow: c.wi === todayIdx ? 'inset 0 0 0 1px #DD2A02' : 'none' }}>{c.text}{c.hasNote && <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: '#A71F00' }} />}</button> })}</div>
      </div>
    }
    const groups = ['Brand Awareness', 'Acquisition', 'Retention', 'Strategy'].map((g) => [g, D.top.filter((t) => stagesOf(t.stage)[0] === g && inStage(t.stage)).sort((a, b) => first(a) - first(b))]).filter(([, it]) => it.length)
    // панель выбранной ячейки
    let panel = null
    if (cell) {
      const w = weeks[cell.wi]
      const list = cell.isParent ? (D.subs[cell.id] || []).flatMap((s) => stepsAt(s.id, w).map((x) => ({ ...x, who: s.id + ' ' + s.name }))).concat(stepsAt(cell.id, w)) : stepsAt(cell.id, w)
      panel = <div style={{ ...card, border: `2px solid ${ACC.bd}`, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><div style={{ fontSize: 12, color: S.i3 }}>Неделя {dm(w[0])} – {dmy(w[1])}</div><div style={{ fontSize: 17, fontWeight: 600 }}>{cell.id} · {cell.label}</div></div><button onClick={() => setCell(null)} aria-label="Закрыть" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${S.ln}`, background: '#fff', cursor: 'pointer' }}>✕</button></div>
        {list.length === 0 && <span style={{ fontSize: 13, color: S.i3 }}>На этой неделе этапов нет.</span>}
        {list.map((s, i) => { const n = weekN(s, w); const key = s.id + '|' + s.n + '|' + n; const val = drafts[key] ?? (n <= 10 ? s.wk[n - 1] : ''); const changed = drafts[key] != null && drafts[key] !== (s.wk[n - 1] || '')
          return <div key={i} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', borderTop: i ? '1px solid #F1F2F4' : 'none', paddingTop: i ? 12 : 0 }}>
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {s.who && <span style={{ fontSize: 12, color: S.i3 }}>{s.who}</span>}
              <span style={{ fontSize: 14, fontWeight: 600 }}>Этап {s.n}: {s.name}</span>
              <span style={{ fontSize: 12, color: S.i2 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: st(s.status).bg, marginRight: 6 }} />{s.status || 'без статуса'} · {dmy(s.start)} – {dmy(s.end)} · неделя {n} этапа</span>
              {s.note && <span style={{ fontSize: 12, color: S.i2 }}>Заметка: {s.note}</span>}
            </div>
            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {n > 10 ? <span style={{ fontSize: 12, color: S.i3 }}>Комментарии хранятся в Week 1–10, эта неделя — {n}-я.</span> : ce ? <>
                <textarea value={val || ''} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} placeholder={`Комментарий к неделе ${n}: что сделано, что мешает`} rows={3} style={{ border: `1px solid ${S.ln}`, borderRadius: 10, padding: 10, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button disabled={!changed || saving === key} onClick={() => saveNote(s, w, val || '')} style={{ fontSize: 13, fontWeight: 600, border: `1px solid ${changed ? ACC.bd : S.ln}`, background: changed ? ACC.bg : '#F7F8F9', color: changed ? ACC.tx : S.i3, borderRadius: 9, padding: '7px 14px', cursor: changed ? 'pointer' : 'default' }}>{saving === key ? 'Сохраняю…' : 'Сохранить в таблицу'}</button><span style={{ fontSize: 11, color: S.i3 }}>→ Timeline, Week {n}</span></div>
              </> : <span style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{val || '—'}</span>}
            </div>
          </div> })}
      </div>
    }
    return <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: S.i2, marginBottom: 12 }}>{['In progress', 'Planned', 'Wait', 'At risk', ''].map((k) => <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 12, borderRadius: 3, background: st(k).bg }} />{k || 'без статуса'}</span>)}<span>· цифра — этап · ▸N — подпроектов в работе · точка — есть комментарий · красная — текущая неделя</span></div>
      {panel}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}><div style={{ minWidth: 330 + weeks.length * 22 }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${S.ln}` }}>
          <span style={{ width: 330, flexShrink: 0, padding: '8px 12px', ...th, position: 'sticky', left: 0, background: '#fff', zIndex: 2 }}>ПРОЕКТ · СТАРТ – КОНЕЦ</span>
          <div>
            <div style={{ display: 'flex' }}>{weeks.map((w, i) => { const f = i === 0 || w[0].getMonth() !== weeks[i - 1][0].getMonth(); return <span key={i} style={{ width: 22, flexShrink: 0, fontSize: 10, fontWeight: 600, color: S.i2, whiteSpace: 'nowrap', overflow: 'visible', paddingTop: 6, paddingLeft: 2, borderLeft: `1px solid ${f ? '#C9CDD2' : 'transparent'}`, boxSizing: 'border-box' }}>{f ? MS[w[0].getMonth()] + ' ' + String(w[0].getFullYear()).slice(2) : ''}</span> })}</div>
            <div style={{ display: 'flex' }}>{weeks.map((w, i) => <span key={i} style={{ width: 22, flexShrink: 0, fontSize: 9, textAlign: 'center', padding: '3px 0 6px', ...(i === todayIdx ? { background: '#DD2A02', color: '#fff', fontWeight: 600, borderRadius: '4px 4px 0 0' } : { color: S.i3 }) }}>{String(w[0].getDate()).padStart(2, '0')}</span>)}</div>
          </div>
        </div>
        {groups.map(([g, items]) => <div key={g}>
          <div style={{ padding: '10px 12px 6px', fontSize: 13, fontWeight: 600, color: '#3B6402', background: ACC.soft, borderBottom: `1px solid ${S.ln}` }}>{g}</div>
          {items.map((t) => { const isP = !!D.subs[t.id]; return <div key={t.id}>{Row({ id: t.id, label: t.name + (isP ? `  [${D.subs[t.id].length} подпр.]` : ''), isParent: isP })}{isP && open[t.id] && D.subs[t.id].map((s) => <Fragment key={s.id}>{Row({ id: s.id, label: s.name, sub: true })}</Fragment>)}</div> })}
        </div>)}
      </div></div>
    </>
  }

  // ---------- Monthly / Quarterly ----------
  const med3 = (a) => [...a].sort((x, y) => x - y)[1]
  const colorCells = (arr, off, invert, money) => Array.from({ length: 12 }, (_, i) => { const gi = off + i; const v = arr?.[gi]; let bg = ''
    if (v != null && gi >= 3 && arr[gi - 1] != null && arr[gi - 2] != null && arr[gi - 3] != null) { const m = med3([arr[gi - 1], arr[gi - 2], arr[gi - 3]]); if (v !== m && !(v === 0 && m === 0)) bg = (invert ? v < m : v > m) ? '#E4F2C8' : '#FFE1DA' }
    return <span key={i} style={{ textAlign: 'right', borderRadius: 5, padding: '2px 4px', background: bg || 'transparent' }}>{v == null ? '' : (money ? '$' : '') + fmt(v)}</span> })
  const Monthly = () => {
    const off = D.months.indexOf(year + '-01'); const o = off < 0 ? 0 : off
    const tpl = '92px 64px 300px 140px 74px 46px 64px 70px 64px repeat(12,58px)'
    const row = (extra) => ({ display: 'grid', gridTemplateColumns: tpl, gap: 6, padding: '9px 16px', fontSize: 12, alignItems: 'center', borderBottom: '1px solid #F1F2F4', ...extra })
    const blank9 = (label) => ['', '', label, '', '', '', '', '', ''].map((v, i) => <span key={'b' + i}>{v}</span>)
    return <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: 13, color: S.i3 }}>Зелёный — месяц лучше медианы трёх предыдущих, красный — хуже. Для CPO наоборот.</span><div style={{ display: 'flex', gap: 6 }}>{['2026', '2027'].map((y) => <button key={y} onClick={() => setYear(y)} style={chipStyle(year === y)}>{y}</button>)}</div></div>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}><div style={{ minWidth: 1450 }}>
        <div style={row({ ...th, fontSize: 11, borderBottom: `1px solid ${S.ln}` })}>{['Status', 'ID', 'Project', 'Stage', 'Type', 'Prio', 'Baseline', 'Expected', 'Total'].map((h) => <span key={h}>{h}</span>)}{MN.map((m) => <span key={m} style={{ textAlign: 'right' }}>{m} {year.slice(2)}</span>)}</div>
        <div style={row({ fontWeight: 600, background: ACC.soft })}>{blank9('TOTAL-SALES')}{colorCells(D.special['TOTAL-SALES'], o, false, false)}</div>
        <div style={row({ fontWeight: 600, background: ACC.soft })}>{blank9('TOTAL-CPO')}{colorCells(D.special['TOTAL-CPO'], o, true, true)}</div>
        <div style={row({ color: '#1761CB', background: '#F4F8FE' })}>{blank9('PLAN SALES')}{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ textAlign: 'right' }}>{fmt(D.special['PLAN SALES']?.[o + i])}</span>)}</div>
        <div style={row({ color: '#1761CB', background: '#F4F8FE' })}>{blank9('PLAN CPO')}{Array.from({ length: 12 }, (_, i) => { const v = D.special['PLAN CPO']?.[o + i]; return <span key={i} style={{ textAlign: 'right' }}>{v == null ? '' : '$' + fmt(v)}</span> })}</div>
        {D.top.filter((t) => inStage(t.stage)).map((t) => <div key={t.id} style={row()}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.status === 'In progress' ? '#8A3500' : t.status === 'Planned' ? '#1761CB' : S.i2 }}>{t.status}</span><span style={{ color: S.i2 }}>{t.id}</span><span style={{ lineHeight: 1.3 }}>{t.name}</span><span style={{ color: S.i2 }}>{t.stage}</span><span style={{ color: S.i2 }}>{t.type}</span>
          <span style={{ textAlign: 'right', color: S.i2 }}>{t.prio}</span><span style={{ textAlign: 'right' }}>{fmt(t.base)}</span><span style={{ textAlign: 'right', color: '#3B6402', fontWeight: 600 }}>{fmt(t.exp)}</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(t.total)}</span>
          {colorCells(t.months, o, false, false)}
        </div>)}
      </div></div>
    </>
  }
  const Quarter = () => {
    const qs = []; for (let y = 0; y * 12 < D.months.length; y++) for (let q = 0; q < 4; q++) qs.push([D.months[y * 12]?.slice(0, 4) + '-Q' + (q + 1), y * 12 + q * 3])
    const sum = (a, s) => { const p = [a?.[s], a?.[s + 1], a?.[s + 2]].filter((v) => v != null); return p.length ? p.reduce((x, y) => x + y, 0) : null }
    const tSales = D.special['TOTAL-SALES'] || []; const tCpo = D.special['TOTAL-CPO'] || []
    const wcpo = (s) => { let a = 0, w = 0; for (let i = s; i < s + 3; i++) if (tSales[i] != null && tCpo[i] != null) { a += tSales[i] * tCpo[i]; w += tSales[i] } return w ? a / w : null }
    const lastQ = Math.floor(D.lastIdx / 3)
    const cells = (vals, invert, money) => vals.map((v, i) => { let bg = ''; if (v != null && i > 0 && i < lastQ && vals[i - 1] != null && v !== vals[i - 1]) bg = (invert ? v < vals[i - 1] : v > vals[i - 1]) ? '#E4F2C8' : '#FFE1DA'; return <span key={i} style={{ textAlign: 'right', borderRadius: 5, padding: '2px 4px', background: bg || 'transparent' }}>{v == null ? '' : (money ? '$' : '') + fmt(v)}</span> })
    const tpl = `92px 64px 320px 150px 74px 46px repeat(${qs.length},72px)`
    const row = (extra) => ({ display: 'grid', gridTemplateColumns: tpl, gap: 6, padding: '9px 16px', fontSize: 12, alignItems: 'center', borderBottom: '1px solid #F1F2F4', ...extra })
    return <>
      <span style={{ fontSize: 13, color: S.i3, display: 'block', marginBottom: 10 }}>Считается из Monthly Report: продажи — сумма трёх месяцев, CPO — средневзвешенный по продажам. Цвет — сравнение с прошлым кварталом, только для закрытых кварталов.</span>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}><div style={{ minWidth: 800 + qs.length * 78 }}>
        <div style={row({ ...th, fontSize: 11, borderBottom: `1px solid ${S.ln}` })}>{['Status', 'ID', 'Project', 'Stage', 'Type', 'Prio'].map((h) => <span key={h}>{h}</span>)}{qs.map(([l]) => <span key={l} style={{ textAlign: 'right' }}>{l}</span>)}</div>
        <div style={row({ fontWeight: 600, background: ACC.soft })}>{['', '', 'TOTAL-SALES', '', '', ''].map((v, i) => <span key={i}>{v}</span>)}{cells(qs.map(([, s]) => sum(tSales, s)), false, false)}</div>
        <div style={row({ fontWeight: 600, background: ACC.soft })}>{['', '', 'TOTAL-CPO', '', '', ''].map((v, i) => <span key={i}>{v}</span>)}{cells(qs.map(([, s]) => wcpo(s)), true, true)}</div>
        {D.top.filter((t) => inStage(t.stage)).map((t) => <div key={t.id} style={row()}><span style={{ fontSize: 11, fontWeight: 600, color: S.i2 }}>{t.status}</span><span style={{ color: S.i2 }}>{t.id}</span><span style={{ lineHeight: 1.3 }}>{t.name}</span><span style={{ color: S.i2 }}>{t.stage}</span><span style={{ color: S.i2 }}>{t.type}</span><span style={{ textAlign: 'right', color: S.i2 }}>{t.prio}</span>{cells(qs.map(([, s]) => sum(t.months, s)), false, false)}</div>)}
      </div></div>
    </>
  }

  // ---------- Projects Plan ----------
  const Plan = () => {
    const tpl = '40px 64px minmax(260px,3fr) 150px 150px 80px 90px 60px 60px 60px 54px 54px 54px'
    const tops = D.plan.filter((p) => !p.parent && inStage(p.stage)).sort((a, b) => (a.prio ?? 999) - (b.prio ?? 999))
    const Line = ({ p, sub }) => { const isO = !!popen[p.id]; const isP = !!D.subs[p.id]
      return <div style={{ borderBottom: '1px solid #F1F2F4', background: sub ? '#FBFBFC' : '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 8, padding: '10px 16px', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: S.i2 }}>{sub ? '' : p.prio}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.id}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingLeft: sub ? 18 : 0, borderLeft: sub ? `2px solid ${S.ln}` : 'none' }}>
            <button onClick={() => setPopen({ ...popen, [p.id]: !isO })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: S.ink, fontSize: 13, fontWeight: 500, lineHeight: 1.35, fontFamily: 'inherit' }}>{isO ? '▾' : '▸'} {p.name}{isP ? `  [${D.subs[p.id].length} подпр.]` : ''}</button>
            {p.budget && <span style={{ fontSize: 11, color: '#8A3500', background: '#FFF6E8', borderRadius: 6, padding: '2px 7px', alignSelf: 'flex-start' }}>Доп. бюджет: {p.budget}</span>}
          </span>
          <span style={{ fontSize: 12, color: S.i2 }}>{p.owner}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.stage}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.type}</span><span style={{ fontSize: 12, color: S.i2 }}>{p.outcome}</span>
          <span style={{ fontSize: 13, textAlign: 'right' }}>{fmt(p.base)}</span><span style={{ fontSize: 13, textAlign: 'right', color: '#3B6402', fontWeight: 600 }}>{fmt(p.expTotal ?? p.exp)}</span><span style={{ fontSize: 13, textAlign: 'right' }}>{fmt(p.total)}</span>
          <span style={{ fontSize: 13, textAlign: 'right', color: S.i2 }}>{p.c}</span><span style={{ fontSize: 13, textAlign: 'right', color: S.i2 }}>{p.i}</span><span style={{ fontSize: 13, textAlign: 'right', color: S.i2 }}>{p.u}</span>
        </div>
        {isO && <div style={{ padding: '0 16px 14px 128px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {p.brief && <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{p.brief}</span>}
          {p.desc && <span style={{ fontSize: 13, color: S.i2, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: 900 }}>{p.desc}</span>}
          {p.oldId && <span style={{ fontSize: 12, color: '#3B6402' }}>Old ID (2026): {p.oldId}</span>}
        </div>}
        {isO && isP && D.subs[p.id].map((s) => <Fragment key={s.id}>{Line({ p: s, sub: true })}</Fragment>)}
      </div> }
    return <div style={{ ...card, padding: 0, overflowX: 'auto' }}><div style={{ minWidth: 1180 }}>
      <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 8, padding: '12px 16px', borderBottom: `1px solid ${S.ln}`, ...th, fontSize: 11 }}>{['Пр.', 'ID', 'Проект', 'Владелец', 'Направление', 'Тип', 'Результат', 'База', '+План', 'Итого', 'Слож.', 'Импакт', 'Срочн.'].map((h, i) => <span key={h} style={{ textAlign: i >= 7 ? 'right' : 'left' }}>{h}</span>)}</div>
      {tops.map((p) => <Fragment key={p.id}>{Line({ p })}</Fragment>)}
    </div></div>
  }

  // ---------- Timeline ----------
  const Timeline = () => {
    const nameOf = (id) => D.byId[id]?.name || id
    const rows = Object.values(D.steps).flat().filter((s) => (tlStatus === 'all' || s.status === tlStatus) && inStage(D.byId[s.id]?.stage || D.byId[D.byId[s.id]?.parent]?.stage || ''))
    const tpl = '70px minmax(220px,2fr) 110px 30px minmax(240px,3fr) 80px 50px 80px'
    return <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{[['all', 'Все статусы'], ['In progress', 'In progress'], ['Planned', 'Planned'], ['Wait', 'Wait'], ['At risk', 'At risk'], ['', 'Без статуса']].map(([v, l]) => <button key={l} onClick={() => setTlStatus(v)} style={chipStyle(tlStatus === v)}>{l}</button>)}</div>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}><div style={{ minWidth: 1000 }}>
        <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 10, padding: '12px 16px', borderBottom: `1px solid ${S.ln}`, ...th, fontSize: 11 }}>{['ID', 'Проект', 'Статус', '#', 'Этап', 'Старт', 'Нед.', 'Конец'].map((h) => <span key={h}>{h}</span>)}</div>
        {rows.map((s, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: tpl, gap: 10, padding: '9px 16px', alignItems: 'center', borderBottom: '1px solid #F1F2F4' }}>
          <span style={{ fontSize: 12, color: S.i2 }}>{s.id}</span><span style={{ fontSize: 12, color: S.i2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nameOf(s.id)}>{nameOf(s.id)}</span>
          <span><span style={{ fontSize: 11, fontWeight: 600, color: st(s.status).tx, background: st(s.status).bg, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{s.status || '—'}</span></span>
          <span style={{ fontSize: 12, color: S.i2 }}>{s.n}</span><span style={{ fontSize: 13 }}>{s.name}</span><span style={{ fontSize: 12 }}>{dmy(s.start)}</span><span style={{ fontSize: 12, color: S.i2 }}>{s.weeks}</span><span style={{ fontSize: 12 }}>{dmy(s.end)}</span>
        </div>)}
      </div></div>
    </>
  }

  return <>
    {header}
    {filters}
    {err && <div style={{ fontSize: 13, color: '#A71F00', marginBottom: 10 }}>{err}</div>}
    {tab === 'dash' && Dash()}
    {tab === 'road' && Road()}
    {tab === 'monthly' && Monthly()}
    {tab === 'quarter' && Quarter()}
    {tab === 'plan' && Plan()}
    {tab === 'timeline' && Timeline()}
  </>
}
