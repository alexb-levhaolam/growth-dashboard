import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { T } from './i18n'
import { C, input } from './pmlib'

// ═══ Продажи проектов по месяцам (вносят администраторы) ═══
const MS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const monthsBack = (n) => { const d = new Date(); return Array.from({ length: n }, (_, i) => { const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') }) }
export const salesOf = (sales, pid, month) => { const r = sales.find((s) => s.project_id === pid && s.month === month); return r && r.sales != null ? r.sales : null }
export async function saveSale(pid, month, val) {
  const v = String(val).replace(/\D/g, '')
  const { error } = await supabase.from('project_sales').upsert({ project_id: pid, month, sales: v === '' ? null : +v, updated_at: new Date().toISOString() }, { onConflict: 'project_id,month' })
  if (error) alert(T('Не сохранилось: ') + error.message)
  return !error
}

// вкладка «Продажи» в карточке проекта
export function SalesTab({ p, sales, isA, reload }) {
  const months = monthsBack(12)
  const base = p.baseline ?? null, exp = p.expected_sales ?? null
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
      <span style={{ fontSize: 14, color: C.ink3 }}>{T('Было (до проекта)')}: <b style={{ color: C.ink }}>{base ?? '—'}</b> · {T('Доп. продажи в месяц')}: <b style={{ color: '#2C6B21' }}>{exp != null ? '+' + exp : '—'}</b> · {T('Цель')}: <b style={{ color: C.ink }}>{base != null && exp != null ? base + exp : '—'}</b></span>
      <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '4px 10px', background: isA ? '#DFF1D8' : '#F1F3F5', color: isA ? '#2C6B21' : C.ink3 }}>{isA ? T('Ты можешь вносить продажи') : T('Продажи вносят администраторы')}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
      {months.map((m) => { const v = salesOf(sales, p.id, m); const [y, mo] = m.split('-')
        return <label key={m} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F9FAFB', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px', fontSize: 12, color: C.ink3 }}>{T(MS[+mo - 1])} {y.slice(2)}
          <input key={m + String(v)} defaultValue={v ?? ''} disabled={!isA} inputMode="numeric" placeholder="—" aria-label={T(MS[+mo - 1]) + ' ' + y} onBlur={async (e) => { const nv = e.target.value.replace(/\D/g, ''); if (nv !== String(v ?? '')) { if (await saveSale(p.id, m, nv)) reload() } }}
            style={{ ...input, height: 38, fontSize: 18, fontWeight: 700, border: `1px solid ${isA ? C.line2 : 'transparent'}`, background: isA ? '#fff' : 'transparent', padding: '0 10px' }} />
        </label> })}
    </div>
    {base == null && isA && <span style={{ fontSize: 12, color: '#B54708' }}>{T('Заполни «Было (до проекта)» во вкладке «Детали», чтобы считались изменение и выполнение цели.')}</span>}
  </div>
}

// таблица «Продажи проектов за месяц» в месячном отчёте
export function MonthSalesTable({ projects, sales, month, isA, reload, onOpen }) {
  const [busy, setBusy] = useState('')
  const rows = projects.map((p) => { const v = salesOf(sales, p.id, month); const base = p.baseline ?? null, exp = p.expected_sales ?? null; const delta = v != null && base != null ? v - base : null; const goal = base != null && exp != null ? base + exp : null; const done = delta != null && exp ? Math.max(0, Math.min(100, Math.round(delta / exp * 100))) : null; return { p, v, base, exp, delta, goal, done } })
  const entered = rows.filter((r) => r.v != null)
  const sum = (k) => entered.reduce((a, r) => a + (r[k] ?? 0), 0)
  const cols = 'minmax(220px, 2fr) 90px 110px 100px 90px 170px'
  const th = { fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: 'uppercase', letterSpacing: '.04em' }
  return <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.line}`, overflow: 'hidden', marginBottom: 22 }}>
    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{T('Продажи проектов за месяц')}</span>
      <span style={{ fontSize: 13, color: C.ink3 }}>{T('внесено по')} {entered.length} {T('из')} {rows.length} · {T('продажи')} <b style={{ color: C.ink }}>{sum('v')}</b>{entered.length > 0 && <> · {T('к «было»')} <b style={{ color: sum('delta') >= 0 ? '#2C6B21' : '#B42318' }}>{sum('delta') > 0 ? '+' : ''}{sum('delta')}</b></>}</span>
    </div>
    <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 820 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 20px', borderBottom: `1px solid ${C.line}` }}><span style={th}>{T('Проект')}</span><span style={{ ...th, textAlign: 'right' }}>{T('Было')}</span><span style={{ ...th, textAlign: 'right' }}>{T('Продажи')}</span><span style={{ ...th, textAlign: 'right' }}>{T('Изменение')}</span><span style={{ ...th, textAlign: 'right' }}>{T('Цель')}</span><span style={th}>{T('Выполнение цели')}</span></div>
      {rows.map(({ p, v, base, delta, goal, done }) => <div key={p.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 20px', alignItems: 'center', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}>
        <button onClick={() => onOpen && onOpen(p.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, minWidth: 0 }}><span style={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span><span style={{ fontSize: 12, color: C.ink4 }}>{p.id} · {p.owner}</span></button>
        <span style={{ textAlign: 'right', color: C.ink3 }}>{base ?? '—'}</span>
        <span style={{ display: 'flex', justifyContent: 'flex-end' }}><input key={p.id + month + String(v)} defaultValue={v ?? ''} disabled={!isA || busy === p.id} inputMode="numeric" placeholder="—" aria-label={T('Продажи') + ' ' + p.name}
          onBlur={async (e) => { const nv = e.target.value.replace(/\D/g, ''); if (nv !== String(v ?? '')) { setBusy(p.id); if (await saveSale(p.id, month, nv)) await reload(); setBusy('') } }}
          style={{ width: 86, height: 32, textAlign: 'right', border: `1px solid ${isA ? C.line2 : 'transparent'}`, borderRadius: 8, padding: '0 10px', fontSize: 14, fontWeight: 700, background: isA ? '#fff' : 'transparent', fontFamily: 'inherit' }} /></span>
        <span style={{ textAlign: 'right', fontWeight: 600, color: delta == null ? C.ink4 : delta >= 0 ? '#2C6B21' : '#B42318' }}>{delta == null ? '—' : (delta > 0 ? '+' : '') + delta}</span>
        <span style={{ textAlign: 'right', color: C.ink3 }}>{goal ?? '—'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, height: 6, background: '#ECEEF1', borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: 6, width: (done || 0) + '%', background: '#6DBB5A', borderRadius: 4 }} /></span><span style={{ fontSize: 12, color: C.ink3, width: 36, textAlign: 'right' }}>{done == null ? '—' : done + '%'}</span></span>
      </div>)}
    </div></div>
    {!isA && <div style={{ padding: '10px 20px', fontSize: 12, color: C.ink4 }}>{T('Продажи вносят администраторы')}</div>}
  </div>
}
