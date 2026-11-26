import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, SST, HEALTH, iso, parse, addDays, monday, dm, weekLabel } from './pmlib'

// ═══ ГАНТ: полосы (с перетаскиванием) или клетки-недели ═══
const MS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const DAY = 864e5
export const ganttStart = (weeksBack = 4) => addDays(monday(new Date()), -7 * weeksBack)

// раскладка этапов по «дорожкам», чтобы параллельные этапы не наезжали друг на друга
const lanesOf = (steps) => { const ends = [], map = {}; [...steps].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))).forEach((s) => { let l = ends.findIndex((e) => e < s.start_date); if (l < 0) { l = ends.length; ends.push(s.end_date) } else ends[l] = s.end_date; map[s.id] = l }); return { map, n: Math.max(1, ends.length) } }

export function useTip() {
  const [tip, setTip] = useState(null)
  const el = tip && <div style={{ position: 'fixed', zIndex: 2000, pointerEvents: 'none', maxWidth: 380, left: Math.min(tip.x + 14, window.innerWidth - 400), top: tip.y + 16, background: '#16181B', color: '#fff', borderRadius: 12, padding: '10px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
    <div style={{ fontSize: 12, color: '#A9B0B8', marginBottom: 4 }}>{tip.title}</div><div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{tip.text}</div></div>
  return [el, (e, title, text) => setTip({ x: e.clientX, y: e.clientY, title, text }), () => setTip(null)]
}

export default function Gantt({ rows, weeks = 26, start, colW = 44, labelW = 280, mode = 'bars', editable = false, onStepClick, onSaved, headLabel }) {
  const t0 = start || ganttStart()
  const [over, setOver] = useState({}) // локальные даты во время/после перетаскивания
  const drag = useRef(null)
  const [tipEl, showTip, hideTip] = useTip()
  const todayIdx = Math.floor((new Date() - t0) / DAY / 7)
  const px = colW / 7
  const X = (d) => ((parse(d) - t0) / DAY) * px
  const months = []; for (let i = 0; i < weeks; i++) { const d = addDays(t0, i * 7); const pv = i ? addDays(t0, i * 7 - 7) : null; if (!pv || pv.getMonth() !== d.getMonth()) months.push({ i, l: MS[d.getMonth()] + (d.getMonth() === 0 || i === 0 ? ' ' + d.getFullYear() : '') }) }
  const sv = (s) => ({ ...s, ...(over[s.id] || {}) })

  useEffect(() => {
    const mv = (e) => { const d = drag.current; if (!d) return; const dd = Math.round((e.clientX - d.x0) / px); if (Math.abs(e.clientX - d.x0) > 3) d.moved = true
      const s0 = parse(d.s.start_date), e0 = parse(d.s.end_date)
      const patch = d.mode === 'move' ? { start_date: iso(addDays(s0, dd)), end_date: iso(addDays(e0, dd)) } : { end_date: iso(addDays(e0, dd) < s0 ? s0 : addDays(e0, dd)) }
      setOver((o) => ({ ...o, [d.s.id]: patch })) }
    const up = async () => { const d = drag.current; drag.current = null; if (!d) return
      if (!d.moved) { setOver((o) => { const n = { ...o }; delete n[d.s.id]; return n }); onStepClick && onStepClick(d.s); return }
      const patch = await new Promise((r) => setOver((o) => { r(o[d.s.id]); return o }))
      if (!patch) return
      const { error } = await supabase.from('project_steps').update({ ...patch, updated_at: new Date().toISOString(), ...(d.s.source === 'sheet' ? { manual: true } : {}) }).eq('id', d.s.id)
      if (error) { alert('Не удалось сохранить даты: ' + error.message); setOver((o) => { const n = { ...o }; delete n[d.s.id]; return n }); return }
      if (onSaved) await onSaved(d.s, patch)
      setOver((o) => { const n = { ...o }; delete n[d.s.id]; return n }) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
  }, [px, onStepClick, onSaved])

  const startDrag = (e, s, m) => { if (!editable || !s.canEdit) return; e.preventDefault(); e.stopPropagation(); drag.current = { s, mode: m, x0: e.clientX, moved: false } }
  const grid = Array.from({ length: weeks }, (_, i) => <span key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: i * colW, width: 1, background: addDays(t0, i * 7).getDate() <= 7 ? '#E6E8EC' : '#F3F4F6' }} />)

  return <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden' }}>
    {tipEl}
    <div style={{ overflowX: 'auto' }}><div style={{ minWidth: labelW + weeks * colW }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ width: labelW, flexShrink: 0, boxSizing: 'border-box', padding: '12px 16px', fontSize: 12, color: C.ink4, position: 'sticky', left: 0, background: '#fff', zIndex: 4, borderRight: `1px solid ${C.line}`, display: 'flex', alignItems: 'flex-end' }}>{headLabel}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', height: 24 }}>{months.map((m, k) => <span key={k} style={{ width: ((months[k + 1] ? months[k + 1].i : weeks) - m.i) * colW, flexShrink: 0, fontSize: 12, fontWeight: 600, color: C.ink2, padding: '5px 8px', borderLeft: '1px solid #E6E8EC', whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box' }}>{m.l}</span>)}</div>
          <div style={{ display: 'flex', height: 22 }}>{Array.from({ length: weeks }, (_, i) => <span key={i} style={{ width: colW, flexShrink: 0, fontSize: 11, textAlign: 'center', lineHeight: '22px', color: i === todayIdx ? '#E5484D' : C.ink4, fontWeight: i === todayIdx ? 700 : 400 }}>{String(addDays(t0, i * 7).getDate()).padStart(2, '0')}</span>)}</div>
        </div>
      </div>
      {rows.map((r) => r.head
        ? <div key={r.key} style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, background: '#F9FAFB' }}><div style={{ width: labelW, flexShrink: 0, boxSizing: 'border-box', padding: '10px 16px', position: 'sticky', left: 0, background: '#F9FAFB', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, borderRight: `1px solid ${C.line}`, fontSize: 14, fontWeight: 600 }}>{r.icon}{r.label}<span style={{ fontSize: 12, color: C.ink4, fontWeight: 400 }}>{r.count}</span></div><div style={{ flex: 1 }} /></div>
        : <div key={r.key} style={{ display: 'flex', borderBottom: '1px solid #F1F2F4' }}>
          <button onClick={r.onLabel} style={{ width: labelW, flexShrink: 0, boxSizing: 'border-box', position: 'sticky', left: 0, background: '#fff', zIndex: 4, display: 'flex', gap: 10, alignItems: 'center', padding: `6px 16px 6px ${16 + (r.indent || 0)}px`, border: 'none', borderRight: `1px solid ${C.line}`, textAlign: 'left', cursor: r.onLabel ? 'pointer' : 'default', color: C.ink, minWidth: 0, fontFamily: 'inherit' }}>
            {r.dot}<span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}><span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span><span style={{ fontSize: 11, color: C.ink4 }}>{r.sub}</span></span>
          </button>
          {mode === 'cells' ? <Cells r={r} weeks={weeks} t0={t0} colW={colW} todayIdx={todayIdx} showTip={showTip} hideTip={hideTip} /> : <Bars r={r} sv={sv} X={X} px={px} grid={grid} todayX={(new Date() - t0) / DAY * px} editable={editable} startDrag={startDrag} showTip={showTip} hideTip={hideTip} />}
        </div>)}
    </div></div>
  </div>
}

function Bars({ r, sv, X, px, grid, todayX, editable, startDrag, showTip, hideTip }) {
  const steps = r.steps.map(sv); const L = lanesOf(steps); const h = 16 + L.n * 32
  const byWeek = {}; (r.comments || []).forEach((c) => { (byWeek[c.week_start] = byWeek[c.week_start] || []).push(c) })
  return <div style={{ position: 'relative', flex: 1, height: h }}>
    {grid}
    <span style={{ position: 'absolute', top: 0, bottom: 0, left: todayX, width: 2, background: '#E5484D', opacity: 0.5, zIndex: 1, pointerEvents: 'none' }} />
    {Object.entries(byWeek).map(([ws, list]) => { const x = X(ws); if (x < 0) return null; return <span key={ws} onMouseEnter={(e) => showTip(e, 'Неделя ' + weekLabel(ws), list.map((c) => (c.health ? HEALTH[c.health][0] + ' · ' : '') + c.author + ': ' + c.full_text).join('\n\n'))} onMouseLeave={hideTip}
      style={{ position: 'absolute', left: x, width: px * 7, top: h - 10, height: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'help', zIndex: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: C.dark, boxShadow: '0 0 0 2px #fff' }} /></span> })}
    {steps.map((s) => { const c = SST[s.status] || SST.todo; const left = X(s.start_date); const w = Math.max(8, ((parse(s.end_date) - parse(s.start_date)) / DAY + 1) * px - 3); const can = editable && s.canEdit
      return <div key={s.id} title={`${s.name} · ${dm(s.start_date)} – ${dm(s.end_date)} · ${c[0]}${s.owner ? ' · ' + s.owner : ''}`} onPointerDown={(e) => (can ? startDrag(e, s, 'move') : null)} onClick={() => (!can && r.onStep ? r.onStep(s) : null)}
        style={{ position: 'absolute', top: 8 + L.map[s.id] * 32, height: 26, left, width: w, background: c[1], border: `1px solid ${c[3]}`, color: c[2], borderRadius: 7, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', padding: '0 9px', touchAction: 'none', userSelect: 'none', zIndex: 2, cursor: can ? 'grab' : 'pointer', boxSizing: 'border-box' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{w > 56 ? s.name : ''}</span>
        {can && <span onPointerDown={(e) => startDrag(e, s, 'resize')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 9, cursor: 'ew-resize', borderRadius: '0 7px 7px 0', background: 'rgba(0,0,0,.06)' }} />}
      </div> })}
  </div>
}

// клетки-недели: цвет = как прошла неделя по отчёту владельца
const HCELL = { green: '#8CC97A', amber: '#F5C77E', red: '#F09A8A' }
function Cells({ r, weeks, t0, colW, todayIdx, showTip, hideTip }) {
  const curWs = iso(monday(new Date()))
  return <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '4px 0' }}>
    {Array.from({ length: weeks }, (_, i) => { const ws = iso(addDays(t0, i * 7)), we = iso(addDays(t0, i * 7 + 6))
      const own = r.steps.map((s, k) => ({ s, k })).filter(({ s }) => s.start_date <= we && s.end_date >= ws)
      const prevIds = i ? r.steps.filter((s) => s.start_date <= iso(addDays(t0, i * 7 - 1)) && s.end_date >= iso(addDays(t0, i * 7 - 7))).map((s) => s.id).join() : ''
      const newStep = own.length && prevIds && own.map((o) => o.s.id).join() !== prevIds
      const ends = own.some(({ s }) => s.end_date >= ws && s.end_date <= we)
      const ups = (r.comments || []).filter((c) => c.week_start === ws)
      const past = ws < curWs; const hs = ups.map((c) => c.health || 'green'); const h = hs.includes('red') ? 'red' : hs.includes('amber') ? 'amber' : hs.length ? 'green' : null
      const missing = own.length && past && !ups.length
      let bg = i % 2 ? '#FAFAFB' : '#fff', sh = 'none', col = '#C9CED6'
      if (h) { bg = HCELL[h]; col = '#fff' } else if (missing) { bg = '#F1F3F5'; sh = 'inset 0 0 0 1.5px #F5A524'; col = C.ink4 } else if (own.length) { bg = '#E9EEF5'; sh = 'inset 0 0 0 1px #D3DCE8'; col = '#6B7A90' }
      if (i === todayIdx) sh = (sh === 'none' ? '' : sh + ', ') + '0 0 0 2px #E5484D'
      const active = own.length || ups.length
      const text = own.map(({ s, k }) => `Этап ${k + 1}: ${s.name} (${dm(s.start_date)} – ${dm(s.end_date)})`).join('\n') + (ups.length ? '\n\n' + ups.map((c) => (c.health ? '● ' + HEALTH[c.health][0] + ' · ' : '') + c.author + ': ' + c.full_text).join('\n\n') : missing ? '\n\nОтчёта за неделю нет' : own.length && !past ? '\n\nзапланировано' : '')
      return <button key={i} aria-label={r.label + ' · ' + weekLabel(ws)} onMouseEnter={active ? (e) => showTip(e, r.label + ' · ' + weekLabel(ws), text.trim()) : undefined} onMouseLeave={hideTip} onClick={active && r.onCell ? () => { hideTip(); r.onCell(ups.length ? 'reports' : 'plan') } : undefined}
        style={{ position: 'relative', width: colW - (newStep ? 6 : 2), height: 28, margin: `0 1px 0 ${newStep ? 5 : 1}px`, flexShrink: 0, borderRadius: 5, border: 'none', padding: 0, fontSize: 10, lineHeight: '28px', cursor: active ? 'pointer' : 'default', background: bg, color: col, boxShadow: sh }}>
        {ends ? '◆' : ''}{ups.length > 0 && <span style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: '50%', background: C.dark, boxShadow: '0 0 0 1.5px #fff' }} />}
      </button> })}
  </div>
}

export function Legend({ cells }) {
  const sw = (bg, sh) => <span style={{ width: 18, height: 12, borderRadius: 3, background: bg, boxShadow: sh || 'none', display: 'inline-block' }} />
  const it = (el, l) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{el}{l}</span>
  return <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: C.ink3, alignItems: 'center' }}>
    {cells ? [it(sw(HCELL.green), 'По плану'), it(sw(HCELL.amber), 'Есть риск'), it(sw(HCELL.red), 'Проблема'), it(sw('#F1F3F5', 'inset 0 0 0 1.5px #F5A524'), 'отчёта нет'), it(sw('#E9EEF5', 'inset 0 0 0 1px #D3DCE8'), 'запланировано'), it(<span>◆</span>, 'конец этапа')]
      : Object.values(SST).map((c) => it(sw(c[1], `inset 0 0 0 1px ${c[3]}`), c[0]))}
    {it(<span style={{ width: 8, height: 8, borderRadius: '50%', background: C.dark, display: 'inline-block' }} />, 'есть отчёт — наведи, чтобы прочитать')}
  </div>
}
