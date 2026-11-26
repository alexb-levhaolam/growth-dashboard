import { useState } from 'react'
import { T } from './i18n'
import { parse, iso, addDays, monday, weekLabel } from './pmlib'

// Выбор недели отчёта: ‹ неделя › и календарь месяца по клику. Для цветной плашки (белый текст).
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DOT = { green: '#6DBB5A', yellow: '#F5A524', red: '#E5484D' }

export default function WeekPicker({ reports, aIdx, setWeek, onCreate, onDelete, light, hint }) {
  const cur = reports[aIdx]
  const [open, setOpen] = useState(false)
  const [m, setM] = useState(() => { const d = parse(cur?.week_start) || new Date(); return { y: d.getFullYear(), mo: d.getMonth() } })
  const byStart = {}; reports.forEach((r, i) => { byStart[String(r.week_start).slice(0, 10)] = i })
  const rows = []; const first = new Date(m.y, m.mo, 1, 12), last = new Date(m.y, m.mo + 1, 0, 12)
  for (let d = monday(first); d <= last && rows.length < 6; d = addDays(d, 7)) rows.push(new Date(d))
  const shift = (k) => { const x = new Date(m.y, m.mo + k, 1); setM({ y: x.getFullYear(), mo: x.getMonth() }) }
  const arrow = { width: 38, height: 38, borderRadius: 10, border: light ? '1px solid #DDE1E6' : 'none', background: light ? '#fff' : 'rgba(255,255,255,.18)', color: light ? '#16181B' : '#fff', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }
  const ghost = { height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.4)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
    <button onClick={() => aIdx > 0 && setWeek(aIdx - 1)} disabled={aIdx <= 0} aria-label={T('Предыдущая неделя')} style={{ ...arrow, opacity: aIdx <= 0 ? 0.4 : 1 }}>‹</button>
    <button onClick={() => setOpen(!open)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, borderRadius: 10, border: light ? '1px solid #DDE1E6' : 'none', background: '#fff', color: '#16181B', padding: '0 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      <span aria-hidden="true">📅</span>{cur ? weekLabel(String(cur.week_start).slice(0, 10)) : '—'}<span style={{ fontSize: 11, color: '#8A9099' }}>▾</span>
    </button>
    <button onClick={() => aIdx < reports.length - 1 && setWeek(aIdx + 1)} disabled={aIdx >= reports.length - 1} aria-label={T('Следующая неделя')} style={{ ...arrow, opacity: aIdx >= reports.length - 1 ? 0.4 : 1 }}>›</button>
    {onCreate && <button onClick={onCreate} style={ghost}>{T('+ новая неделя')}</button>}
    {onDelete && <button onClick={onDelete} style={{ ...ghost, borderColor: 'rgba(255,255,255,.25)', color: 'rgba(255,255,255,.8)' }}>{T('Удалить отчёт')}</button>}
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div role="dialog" aria-label={T('Выбор недели')} style={{ position: 'absolute', top: 46, left: light ? 'auto' : 46, right: light ? 0 : 'auto', zIndex: 41, width: 330, background: '#fff', borderRadius: 14, boxShadow: '0 16px 40px rgba(16,24,40,.22)', padding: 14, color: '#16181B' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={() => shift(-1)} aria-label={T('Предыдущий месяц')} style={{ width: 30, height: 30, border: 'none', background: 'none', fontSize: 16, cursor: 'pointer' }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{T(MONTHS[m.mo])} {m.y}</span>
          <button onClick={() => shift(1)} aria-label={T('Следующий месяц')} style={{ width: 30, height: 30, border: 'none', background: 'none', fontSize: 16, cursor: 'pointer' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 20px', fontSize: 11, color: '#8A9099', textAlign: 'center', padding: '0 4px 4px' }}>{DOW.map((x) => <span key={x}>{T(x)}</span>)}<span /></div>
        {rows.map((r) => { const key = iso(r); const idx = byStart[key]; const has = idx != null; const sel = idx === aIdx; const st = has ? reports[idx].status : null
          return <button key={key} disabled={!has} onClick={() => { setWeek(idx); setOpen(false) }} title={has ? weekLabel(key) : T('Отчёта за эту неделю нет')}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 20px', alignItems: 'center', width: '100%', border: 'none', borderRadius: 9, padding: '0 4px', marginBottom: 2, cursor: has ? 'pointer' : 'default', background: sel ? '#DDF0B5' : 'transparent', fontFamily: 'inherit' }}>
            {Array.from({ length: 7 }, (_, k) => { const x = addDays(r, k); return <span key={k} style={{ height: 30, lineHeight: '30px', fontSize: 13, fontWeight: sel ? 700 : 400, color: x.getMonth() !== m.mo ? '#C3C8CF' : has ? '#16181B' : '#B5BAC1' }}>{x.getDate()}</span> })}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: st ? DOT[st] || '#C9CED6' : 'transparent', justifySelf: 'center' }} />
          </button> })}
        <div style={{ fontSize: 11, color: '#8A9099', marginTop: 8, lineHeight: 1.4 }}>{hint || T('Точка — цвет недели. Серые недели — отчёта нет.')}</div>
      </div>
    </>}
  </div>
}
