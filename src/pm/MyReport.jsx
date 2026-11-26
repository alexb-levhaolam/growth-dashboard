import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, PST, HEALTH, DIR_COLORS, catOf, dirLabel, weekLabel, dm, recentWeeks, overlapsWeek, mineOf, Pill, Dot, btn, input, HealthPick, PhotoAttach, Chips, saveReport } from './pmlib'

// ═══ МОЙ ОТЧЁТ ЗА НЕДЕЛЮ ═══
// Каждый понедельник — что сделано за прошедшую неделю по каждому своему проекту.
export default function MyReport({ projects, steps, comments, profile, ce, onOpen, reload }) {
  const weeks = recentWeeks(8)
  const [ws, setWs] = useState(weeks[0])
  const live = projects.filter((p) => !p.archived_at && p.status !== 'done')
  const mine = mineOf(live, steps, profile.name)
  const stepsOf = (id) => steps.filter((s) => s.project_id === id)
  const active = mine.filter((p) => { const st = stepsOf(p.id); return st.length ? st.some((s) => overlapsWeek(s, ws)) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status) })
  const myRep = (p) => comments.find((c) => c.project_id === p.id && c.week_start === ws && c.author === profile.name && c.source !== 'sheet')
  const done = active.filter(myRep).length
  const stat = (t, bg, col) => <span style={{ fontSize: 13, fontWeight: 600, background: bg, color: col, border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 12px' }}>{t}</span>
  const wkStat = (w) => { const a = mine.filter((p) => { const st = stepsOf(p.id); return st.length ? st.some((s) => overlapsWeek(s, w)) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status) }); const ok = a.filter((p) => comments.some((c) => c.project_id === p.id && c.week_start === w && c.author === profile.name && c.source !== 'sheet')).length; return a.length ? (ok === a.length ? ' ✓' : ` · нет ${a.length - ok}`) : '' }

  return <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 640 }}><span style={{ fontSize: 26, fontWeight: 700 }}>Мой отчёт за неделю</span><span style={{ fontSize: 14, color: C.ink3, lineHeight: 1.45 }}>Каждый понедельник напиши, что сделано за прошедшую неделю по каждому своему проекту. Отчёт сразу попадает в проект и в отчёты отдела.</span></div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: C.ink4 }}>Неделя
        <select value={ws} onChange={(e) => setWs(e.target.value)} style={{ ...input, width: 'auto', height: 40, fontWeight: 600 }}>{weeks.map((w, i) => <option key={w} value={w}>{weekLabel(w)}{i === 0 ? ' · прошлая' : ''}{wkStat(w)}</option>)}</select>
      </label>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {stat(active.length + ' ' + (active.length === 1 ? 'проект' : active.length < 5 && active.length > 0 ? 'проекта' : 'проектов') + ' в эту неделю', '#fff', C.ink2)}
      {stat((active.length - done) + ' ждут отчёта', active.length - done ? '#FEF0C7' : '#fff', active.length - done ? '#B54708' : C.ink2)}
      {stat(done + ' готово', '#DFF1D8', '#2C6B21')}
    </div>
    {!active.length && <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, color: C.ink3 }}>В эту неделю у тебя нет активных этапов. Если это не так — добавь этапы в свои проекты в разделе «Мои проекты».</div>}
    {active.map((p) => <ReportCard key={p.id + ws} p={p} ws={ws} step={stepsOf(p.id).find((s) => overlapsWeek(s, ws))} existing={myRep(p)} profile={profile} ce={ce} onOpen={onOpen} reload={reload} />)}
  </div>
}

function ReportCard({ p, ws, step, existing, profile, ce, onOpen, reload }) {
  const [edit, setEdit] = useState(!existing)
  const [f, setF] = useState({ text: existing?.full_text || '', link: existing?.link || '', clickup: existing?.clickup_url || '', images: existing?.images || [], health: existing?.health || 'green', stepDone: false })
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(null)
  const shown = saved || existing
  const save = async () => {
    if (!f.text.trim()) { alert('Напиши, что сделано за неделю'); return }
    setBusy(true)
    const { error } = await saveReport({ existing, projectId: p.id, weekStart: ws, author: profile.name, f })
    if (!error && step && step.status !== 'done') { const st = f.stepDone ? 'done' : f.health === 'green' ? 'doing' : 'risk'; if (st !== step.status) await supabase.from('project_steps').update({ status: st, updated_at: new Date().toISOString() }).eq('id', step.id) }
    setBusy(false)
    if (error) { alert('Отчёт не сохранён: ' + error.message); return }
    setSaved({ ...(existing || {}), full_text: f.text.trim(), link: f.link, clickup_url: f.clickup, images: f.images, health: f.health }); setEdit(false); reload()
  }
  return <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: `inset 4px 0 0 ${shown ? '#6DBB5A' : '#F79009'}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink4 }}><Dot color={DIR_COLORS[catOf(p)]} />{p.id} · {dirLabel(p)}</span>
        <button onClick={() => onOpen(p.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 17, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>{p.name}</button>
        <span style={{ fontSize: 13, color: C.ink3 }}>{step ? `Этап в эти даты: ${step.name} (${dm(step.start_date)} – ${dm(step.end_date)})` : 'Этапы не заданы'}</span>
      </div>
      {shown ? <Pill cfg={['Отчёт готов', '#DFF1D8', '#2C6B21']} /> : <Pill cfg={['Нужен отчёт', '#FEF0C7', '#B54708']} />}
    </div>
    {!edit && shown && <div style={{ background: '#F7F9FA', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{shown.health && <Pill cfg={HEALTH[shown.health]} small />}{saved && <span style={{ fontSize: 12, color: '#2C6B21', fontWeight: 600 }}>✓ Сохранено</span>}</span>
      <span style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{shown.full_text}</span>
      <Chips c={shown} />
      {(shown.images || []).length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{shown.images.map((im, i) => <img key={i} src={im.url} alt={im.name || ''} style={{ width: 120, height: 84, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.line}` }} />)}</div>}
      {ce && <button onClick={() => setEdit(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: C.blue, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Изменить отчёт</button>}
    </div>}
    {edit && ce && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>Что сделано за неделю
        <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={3} placeholder="Только факт: что сделали, какие цифры, что мешает" style={{ ...input, height: 'auto', padding: 12, lineHeight: 1.5, resize: 'vertical', fontWeight: 400 }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}><span>Ссылка <span style={{ fontWeight: 400, color: C.ink4 }}>· необязательно</span></span><input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://" style={{ ...input, fontWeight: 400, fontSize: 13 }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}><span>Задача в ClickUp <span style={{ fontWeight: 400, color: C.ink4 }}>· необязательно</span></span><input value={f.clickup} onChange={(e) => setF({ ...f, clickup: e.target.value })} placeholder="https://app.clickup.com/t/…" style={{ ...input, fontWeight: 400, fontSize: 13 }} /></label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PhotoAttach folder={`projects/${p.id}/${ws}`} images={f.images} onChange={(images) => setF({ ...f, images })} />
          <HealthPick value={f.health} onChange={(h) => setF({ ...f, health: h })} />
          {step && step.status !== 'done' && <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.ink2, cursor: 'pointer' }}><input type="checkbox" checked={f.stepDone} onChange={(e) => setF({ ...f, stepDone: e.target.checked })} style={{ width: 16, height: 16 }} />Этап завершён</label>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {existing && <button onClick={() => setEdit(false)} style={btn(false)}>Отмена</button>}
          <button onClick={save} disabled={busy} style={btn(true)}>{busy ? 'Сохраняю…' : existing ? 'Сохранить изменения' : 'Сохранить отчёт'}</button>
        </div>
      </div>
    </div>}
  </div>
}
