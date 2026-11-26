import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PROJ_CATS, catOf } from '../lib/ui'

// ═══ Общие вещи новой системы управления проектами ═══

export const C = {
  bg: '#F5F6F8', card: '#FFFFFF', line: '#ECEEF1', line2: '#DDE1E6', ink: '#16181B', ink2: '#4A5058', ink3: '#6B717A', ink4: '#8A9099',
  dark: '#1F3D2B', soft: '#EEF5EA', blue: '#2F6FDB',
}

// Статусы проекта (как в текущем дашборде) и этапов
export const PST = {
  progress: ['В работе', '#DFF1D8', '#2C6B21'], test: ['Тест', '#E6EEFB', '#2F5DB0'], test_prep: ['Подготовка теста', '#E6EEFB', '#2F5DB0'],
  risk: ['Риск', '#FDE3DE', '#B42318'], blocked: ['Блокер', '#FDE3DE', '#B42318'], wait: ['Ожидание', '#F1F3F5', '#5B616A'], done: ['Готово', '#EEF0F2', '#5B616A'],
}
export const SST = { todo: ['Запланирован', '#E6EEFB', '#2F5DB0', '#BFD2F3'], doing: ['В работе', '#DFF1D8', '#2C6B21', '#9BD08A'], risk: ['Риск', '#FDE3DE', '#B42318', '#F3A79A'], done: ['Готово', '#EEF0F2', '#5B616A', '#D3D7DC'] }
export const HEALTH = { green: ['По плану', '#DFF1D8', '#2C6B21', '#8CC97A'], amber: ['Есть риск', '#FEF0C7', '#B54708', '#F5C77E'], red: ['Проблема', '#FDE3DE', '#B42318', '#F09A8A'] }
export const DIR_COLORS = { acquisition: '#2F6FDB', acquisition_additional: '#5B8DEF', conversion: '#0E7490', retention: '#0F9D8A', reactivation: '#EA7A2E', brand: '#8B5CF6', infra: '#6B717A', strategy: '#475467', other: '#9AA0A6' }
export const dirLabel = (p) => (PROJ_CATS.find((c) => c.v === catOf(p)) || {}).l || 'Другое'
export { PROJ_CATS, catOf }

// ── даты и недели (неделя = Пн–Вс) ──
export const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
export const parse = (s) => (s ? new Date(String(s).slice(0, 10) + 'T12:00:00') : null)
export const monday = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const lastWeekStart = () => addDays(monday(new Date()), -7)
const MG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const weekLabel = (ws) => { const a = parse(ws), b = addDays(a, 6); return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + MG[b.getMonth()] : a.getDate() + ' ' + MG[a.getMonth()] + ' – ' + b.getDate() + ' ' + MG[b.getMonth()] }
export const dm = (s) => { const d = parse(s); return d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') : '' }
export const overlapsWeek = (step, ws) => { const a = parse(ws), b = addDays(a, 6); return parse(step.start_date) <= b && parse(step.end_date) >= a }
export const recentWeeks = (n) => Array.from({ length: n }, (_, i) => iso(addDays(lastWeekStart(), -7 * i)))

// ── люди ──
const norm = (s) => String(s || '').toLowerCase().trim()
export const isMe = (owner, me) => { const o = norm(owner), m = norm(me).split(' ')[0]; return !!m && o.split(/[,;/&]| и /).some((x) => x.trim().split(' ')[0] === m) }
export const mineOf = (projects, steps, me) => projects.filter((p) => isMe(p.owner, me) || steps.some((s) => s.project_id === p.id && isMe(s.owner, me)))

// ── ID: следующий свободный P-номер ──
export const nextId = (allProjects) => { const nums = allProjects.map((p) => (/^P-(\d+)$/.exec(p.id) || [])[1]).filter(Boolean).map(Number); return 'P-' + String(Math.max(0, ...nums) + 1).padStart(3, '0') }

// ── мелкие элементы интерфейса ──
const PAL = ['#2F6FDB', '#C2410C', '#7C3AED', '#0E7490', '#BE185D', '#4D7C0F', '#B45309', '#475467']
export function Avatar({ name, size = 26 }) {
  const c = PAL[String(name || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % PAL.length]
  return <span style={{ width: size, height: size, borderRadius: '50%', background: c, color: '#fff', fontSize: Math.round(size * 0.42), fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{String(name || '?').slice(0, 1).toUpperCase()}</span>
}
export function Pill({ cfg, children, small }) {
  const [label, bg, tx] = cfg || ['—', '#F1F3F5', '#5B616A']
  return <span style={{ fontSize: small ? 11 : 12, fontWeight: 600, color: tx, background: bg, borderRadius: 999, padding: small ? '2px 8px' : '4px 10px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{children || label}</span>
}
export const Dot = ({ color, size = 8 }) => <span style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
export const btn = (primary) => ({ height: 38, border: primary ? 'none' : `1px solid ${C.line2}`, background: primary ? C.dark : '#fff', color: primary ? '#fff' : C.ink, borderRadius: 10, padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })
export const input = { height: 40, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#fff', width: '100%', boxSizing: 'border-box' }
export const chip = (on) => ({ height: 32, borderRadius: 999, padding: '0 12px', fontSize: 13, cursor: 'pointer', border: `1px solid ${on ? C.dark : C.line2}`, background: on ? C.soft : '#fff', color: C.ink, fontWeight: on ? 600 : 500, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 })
export const seg = (on) => ({ height: 32, border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#fff' : 'transparent', color: on ? C.ink : C.ink3, fontWeight: on ? 600 : 500, boxShadow: on ? '0 1px 2px rgba(16,24,40,.08)' : 'none' })
export const label = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }

export function Modal({ title, sub, onClose, width = 620, children, footer }) {
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.36)', zIndex: 1100 }} />
    <div role="dialog" aria-label={title} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: `min(${width}px, 94vw)`, maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 20, zIndex: 1101, boxShadow: '0 24px 64px rgba(16,24,40,.25)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 20, fontWeight: 700 }}>{title}</span>{sub && <span style={{ fontSize: 13, color: C.ink3 }}>{sub}</span>}</div>
        <button onClick={onClose} aria-label="Закрыть" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
      {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>{footer}</div>}
    </div>
  </>
}

// Выбор статуса недели: По плану / Есть риск / Проблема
export function HealthPick({ value, onChange }) {
  return <div role="radiogroup" aria-label="Как прошла неделя" style={{ display: 'flex', gap: 4, background: '#F1F3F5', borderRadius: 10, padding: 3 }}>
    {Object.entries(HEALTH).map(([k, h]) => <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: value === k ? '#fff' : 'transparent', color: value === k ? h[2] : C.ink3, fontWeight: value === k ? 700 : 500, boxShadow: value === k ? '0 1px 2px rgba(16,24,40,.1)' : 'none' }}><Dot color={h[3]} />{h[0]}</button>)}
  </div>
}

// Фото к отчёту: загрузка в тот же bucket, что и в недельном отчёте
export function PhotoAttach({ folder, images, onChange }) {
  const [busy, setBusy] = useState(false)
  const up = async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; setBusy(true)
    const path = `${folder}/${Date.now()}.${f.name.split('.').pop()}`; const { error } = await supabase.storage.from('report-images').upload(path, f)
    if (error) { alert('Не удалось загрузить фото: ' + error.message); setBusy(false); return }
    const { data } = supabase.storage.from('report-images').getPublicUrl(path); onChange([...(images || []), { url: data.publicUrl, name: f.name, path }]); setBusy(false) }
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    {(images || []).map((im, i) => <span key={i} style={{ position: 'relative' }}><img src={im.url} alt={im.name || ''} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.line}` }} /><button type="button" aria-label="Убрать фото" onClick={() => onChange(images.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button></span>)}
    <label style={{ ...btn(false), height: 36, fontWeight: 500, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{busy ? 'Загрузка…' : '🖼 Прикрепить фото'}<input type="file" accept="image/*" onChange={up} style={{ display: 'none' }} /></label>
  </div>
}

export function Chips({ c }) {
  if (!c.link && !c.clickup_url) return null
  const host = (u) => String(u).replace(/^https?:\/\//, '').split('/')[0]
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {c.link && <a href={c.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, background: '#EEF4FF', color: C.blue, borderRadius: 8, padding: '5px 10px', textDecoration: 'none' }}>🔗 {host(c.link)}</a>}
    {c.clickup_url && <a href={c.clickup_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, background: '#F3EEFF', color: '#6E3FD1', borderRadius: 8, padding: '5px 10px', textDecoration: 'none', fontWeight: 600 }}>✓ ClickUp</a>}
  </div>
}

// Сохранение недельного отчёта: одна запись на проект, неделю и автора
export async function saveReport({ existing, projectId, weekStart, author, f }) {
  const text = f.text.trim()
  const row = { full_text: text, summary: text.length > 120 ? text.slice(0, 117) + '…' : text, health: f.health || 'green', link: (f.link || '').trim(), clickup_url: (f.clickup || '').trim(), images: f.images || [], updated_at: new Date().toISOString() }
  const res = existing
    ? await supabase.from('project_comments').update(row).eq('id', existing.id).select('id')
    : await supabase.from('project_comments').insert({ ...row, project_id: projectId, author, week_start: weekStart }).select('id')
  if (res.error) return { error: res.error }
  if (!res.data || !res.data.length) return { error: { message: 'запись не сохранилась — у твоей роли нет прав на запись в project_comments (RLS). Напиши Alex.' } }
  return { error: null, id: res.data[0].id }
}
