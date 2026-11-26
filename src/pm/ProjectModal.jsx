import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, PST, SST, HEALTH, DIR_COLORS, PROJ_CATS, catOf, dirLabel, iso, parse, addDays, weekLabel, dm, recentWeeks, Avatar, Pill, Dot, btn, input, label, Modal, HealthPick, PhotoAttach, Chips, saveReport } from './pmlib'

// ═══ КАРТОЧКА ПРОЕКТА: отчёты по неделям · план и этапы · детали ═══
export default function ProjectModal({ project: p, allProjects, steps, comments, profile, ce, people, onClose, onOpen, onNewSub, reload }) {
  const [tab, setTab] = useState('reports')
  const [se, setSe] = useState(null)
  const subs = allProjects.filter((x) => x.parent_id === p.id && !x.archived_at)
  const parent = p.parent_id ? allProjects.find((x) => x.id === p.parent_id) : null
  const mySteps = steps.filter((s) => s.project_id === p.id).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
  const fam = [p, ...subs]
  const famComments = comments.filter((c) => fam.some((x) => x.id === c.project_id)).sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
  const st = PST[p.status] || PST.wait

  // поля проекта; для проектов из Workshop отмечаем ручную правку, чтобы ночная синхронизация её не перезаписала
  const SYNCED = ['name', 'owner', 'category', 'last_update', 'expected_sales', 'status']
  const upProj = async (patch) => {
    const extra = p.workshop_id ? { manual_fields: Array.from(new Set([...(p.manual_fields || []), ...Object.keys(patch).filter((k) => SYNCED.includes(k))])) } : {}
    const { error } = await supabase.from('projects').update({ ...patch, ...extra }).eq('id', p.id)
    if (error) alert('Ошибка: ' + error.message); else reload()
  }

  const tabs = [['reports', 'Отчёты по неделям' + (famComments.length ? ' · ' + famComments.length : '')], ['plan', 'План и этапы' + (mySteps.length ? ' · ' + mySteps.length : '')], ['info', 'Детали']]
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.34)', zIndex: 1000 }} />
    <div role="dialog" aria-label={p.name} style={{ position: 'fixed', top: 28, bottom: 28, left: '50%', transform: 'translateX(-50%)', width: 'min(1120px, 96vw)', background: '#fff', borderRadius: 20, zIndex: 1001, boxShadow: '0 24px 64px rgba(16,24,40,.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: C.ink }}>
      <div style={{ padding: '22px 28px 0', display: 'flex', flexDirection: 'column', gap: 14, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.ink3 }}>
              <span style={{ fontWeight: 600, color: C.ink, background: '#F1F3F5', borderRadius: 6, padding: '2px 8px' }}>{p.id}</span>
              {parent && <button onClick={() => onOpen(parent.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>подпроект {parent.id} · {parent.name}</button>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color={DIR_COLORS[catOf(p)]} />{dirLabel(p)}</span>
              {p.workshop_id && <span style={{ fontSize: 11, color: C.ink4 }}>· из Workshop</span>}
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>{p.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <Pill cfg={st} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Avatar name={p.owner} size={24} />{p.owner}</span>
            <button onClick={onClose} aria-label="Закрыть" style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontSize: 15 }}>✕</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>{tabs.map(([v, l]) => <button key={v} onClick={() => setTab(v)} style={{ height: 42, border: 'none', background: 'none', padding: '0 14px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', borderBottom: `2px solid ${tab === v ? C.dark : 'transparent'}`, color: tab === v ? C.ink : C.ink3, fontWeight: tab === v ? 600 : 500 }}>{l}</button>)}</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px' }}>
        {tab === 'reports' && <Reports p={p} fam={fam} famComments={famComments} steps={steps} profile={profile} ce={ce} reload={reload} onOpen={onOpen} />}
        {tab === 'plan' && <Plan p={p} mySteps={mySteps} subs={subs} steps={steps} ce={ce} onEdit={setSe} onOpen={onOpen} onNewSub={onNewSub} reload={reload} />}
        {tab === 'info' && <Info p={p} subs={subs} ce={ce} isA={profile.role === 'admin'} people={people} upProj={upProj} onOpen={onOpen} allProjects={allProjects} comments={comments} onClose={onClose} reload={reload} />}
      </div>
    </div>
    {se && <StepEditor init={se} people={people} onClose={() => setSe(null)} reload={reload} />}
  </>
}

// ─── отчёты по неделям ───
function Reports({ p, fam, famComments, profile, ce, reload, onOpen }) {
  const weeks = recentWeeks(3)
  const mineFor = (ws) => famComments.find((c) => c.project_id === p.id && c.week_start === ws && c.author === profile.name && c.source !== 'sheet')
  const fromC = (c) => ({ text: c?.full_text || '', link: c?.link || '', clickup: c?.clickup_url || '', images: c?.images || [], health: c?.health || 'green' })
  const [wk, setWk] = useState(weeks[0]); const [f, setF] = useState(fromC(mineFor(weeks[0]))); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false)
  const pickWeek = (ws) => { setWk(ws); setF(fromC(mineFor(ws))) }
  const save = async () => { if (!f.text.trim()) { alert('Напиши, что сделано за неделю'); return } setBusy(true)
    const { error } = await saveReport({ existing: mineFor(wk), projectId: p.id, weekStart: wk, author: profile.name, f }); setBusy(false)
    if (error) alert('Отчёт не сохранён: ' + error.message); else { setOk(true); setTimeout(() => setOk(false), 3000); reload() } }
  const byWeek = {}; famComments.forEach((c) => { (byWeek[c.week_start] = byWeek[c.week_start] || []).push(c) })
  const wkKeys = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 840 }}>
    {ce && <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#FCFCFD' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Отчёт за неделю</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <HealthPick value={f.health} onChange={(h) => setF({ ...f, health: h })} />
          <select value={wk} onChange={(e) => pickWeek(e.target.value)} aria-label="Неделя" style={{ ...input, width: 'auto', height: 34 }}>{weeks.map((w, i) => <option key={w} value={w}>{weekLabel(w)}{i === 0 ? ' (прошлая неделя)' : ''}</option>)}</select>
        </div>
      </div>
      <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={3} placeholder="Только факт: что сделали, какие цифры, что мешает" style={{ ...input, height: 'auto', padding: 12, lineHeight: 1.5, resize: 'vertical' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="Ссылка (необязательно)" aria-label="Ссылка" style={{ ...input, height: 38, fontSize: 13 }} />
        <input value={f.clickup} onChange={(e) => setF({ ...f, clickup: e.target.value })} placeholder="Задача в ClickUp (необязательно)" aria-label="ClickUp" style={{ ...input, height: 38, fontSize: 13 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <PhotoAttach folder={`projects/${p.id}/${wk}`} images={f.images} onChange={(images) => setF({ ...f, images })} />
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{ok && <span style={{ fontSize: 13, color: '#2C6B21', fontWeight: 600 }}>✓ Сохранено</span>}<button onClick={save} disabled={busy} style={btn(true)}>{busy ? 'Сохраняю…' : mineFor(wk) ? 'Сохранить изменения' : 'Сохранить отчёт'}</button></span>
      </div>
    </div>}
    {!wkKeys.length && <span style={{ fontSize: 14, color: C.ink4 }}>Отчётов пока нет.</span>}
    {wkKeys.map((ws) => <div key={ws} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{weekLabel(ws)}</span><span style={{ flex: 1, height: 1, background: C.line }} /><span style={{ fontSize: 12, color: C.ink3 }}>{byWeek[ws].length} отч.</span></div>
      {byWeek[ws].map((c) => { const sub = c.project_id !== p.id ? fam.find((x) => x.id === c.project_id) : null
        return <div key={c.id} style={{ display: 'flex', gap: 12, paddingLeft: 4 }}>
          <Avatar name={c.author} size={32} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{c.author}</b>{c.health && <Pill cfg={HEALTH[c.health]} small />}{sub && <button onClick={() => onOpen(sub.id)} style={{ fontSize: 12, background: '#F1F3F5', color: C.ink2, border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>{sub.id} · {sub.name}</button>}{c.source === 'sheet' && <span style={{ fontSize: 11, color: C.ink4 }}>из Workshop</span>}</span>
            <span style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.full_text}</span>
            <Chips c={c} />
            {(c.images || []).length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{c.images.map((im, i) => <a key={i} href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt={im.name || ''} style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 10, border: `1px solid ${C.line}` }} /></a>)}</div>}
          </div>
        </div> })}
    </div>)}
  </div>
}

// ─── план и этапы ───
function Plan({ p, mySteps, subs, steps, ce, onEdit, onOpen, onNewSub, reload }) {
  const all = [...mySteps, ...subs.flatMap((s) => steps.filter((x) => x.project_id === s.id))]
  const a = all.length ? all.reduce((m, s) => (s.start_date < m ? s.start_date : m), all[0].start_date) : null
  const b = all.length ? all.reduce((m, s) => (s.end_date > m ? s.end_date : m), all[0].end_date) : null
  const span = a ? Math.max(1, (parse(b) - parse(a)) / 864e5 + 1) : 1
  const pos = (s) => ({ left: ((parse(s.start_date) - parse(a)) / 864e5 / span * 100) + '%', width: Math.max(1.5, ((parse(s.end_date) - parse(s.start_date)) / 864e5 + 1) / span * 100) + '%' })
  const today = new Date(); const todayPos = a && today >= parse(a) && today <= parse(b) ? ((today - parse(a)) / 864e5 / span * 100) + '%' : null
  const del = async (s) => { if (!confirm(`Удалить этап «${s.name}»? Он пропадёт из плана и отчётов. Отчёты проекта останутся.`)) return; const { error } = s.source === 'sheet' ? await supabase.from('project_steps').update({ hidden: true, manual: true }).eq('id', s.id) : await supabase.from('project_steps').delete().eq('id', s.id); if (error) alert('Ошибка: ' + error.message); else reload() }
  const lastEnd = mySteps.length ? mySteps[mySteps.length - 1].end_date : iso(new Date())
  const newStep = () => onEdit({ project_id: p.id, name: '', description: '', start_date: iso(addDays(parse(lastEnd), 1)), end_date: iso(addDays(parse(lastEnd), 14)), owner: p.owner, status: 'todo' })
  const Row = ({ s, editable }) => { const c = SST[s.status] || SST.todo
    return <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 70px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid #F3F4F6` }}>
      <button onClick={() => editable && onEdit(s)} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: editable ? 'pointer' : 'default', fontFamily: 'inherit', color: C.ink, minWidth: 0 }}>
        <Dot color={c[3]} /><span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span><span style={{ fontSize: 11, color: C.ink4 }}>{dm(s.start_date)} – {dm(s.end_date)} · {s.owner || '—'} · {c[0]}{s.source === 'sheet' ? (s.manual ? ' · изменён в дашборде' : ' · из Workshop') : ''}</span></span>
      </button>
      <div style={{ position: 'relative', height: 22, background: '#F7F8F9', borderRadius: 6 }}>
        {todayPos && <span style={{ position: 'absolute', top: -2, bottom: -2, left: todayPos, width: 2, background: '#E5484D', opacity: 0.5 }} />}
        <span title={s.description || s.name} style={{ position: 'absolute', top: 3, bottom: 3, ...pos(s), background: c[1], border: `1px solid ${c[3]}`, borderRadius: 5 }} />
      </div>
      <span style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>{editable && <><button onClick={() => onEdit(s)} aria-label="Редактировать этап" style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: C.ink3 }}>✎</button><button onClick={() => del(s)} aria-label="Удалить этап" style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: '#B42318' }}>🗑</button></>}</span>
    </div> }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: C.ink3 }}>{a ? `Сроки проекта: ${dm(a)} – ${dm(b)}. Клик по этапу — изменить название, описание, даты, исполнителя, статус.` : 'Этапов пока нет. Добавь первый.'}</span>
      {ce && <div style={{ display: 'flex', gap: 8 }}>{!p.parent_id && <button onClick={() => onNewSub(p.id)} style={btn(false)}>+ Подпроект</button>}<button onClick={newStep} style={btn(true)}>+ Этап</button></div>}
    </div>
    <div>{mySteps.map((s) => <Row key={s.id} s={s} editable={ce} />)}</div>
    {subs.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.ink4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Подпроекты</span>
      {subs.map((sp) => <div key={sp.id} style={{ background: '#FAFAFB', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px' }}>
        <button onClick={() => onOpen(sp.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: C.ink }}>{sp.id} · {sp.name} <span style={{ fontWeight: 400, color: C.ink4, fontSize: 12 }}>· {sp.owner}</span></button>
        {steps.filter((x) => x.project_id === sp.id).sort((x, y) => String(x.start_date).localeCompare(String(y.start_date))).map((s) => <Row key={s.id} s={s} editable={false} />)}
      </div>)}
    </div>}
    <span style={{ fontSize: 12, color: C.ink4 }}>Гант с перетаскиванием этапов появится на шаге 2.</span>
  </div>
}

// ─── детали ───
function Info({ p, subs, ce, isA, people, upProj, onOpen, allProjects, comments, onClose, reload }) {
  const hasHistory = comments.some((c) => c.project_id === p.id) || subs.length > 0 || !!p.workshop_id
  const archive = async () => { if (!confirm(`Убрать «${p.name}» в архив? Проект и вся его история сохранятся, вернуть можно в «Архиве проектов».`)) return
    const { error } = await supabase.from('projects').update({ archived_at: new Date().toISOString(), archive_reason: 'archived' }).eq('id', p.id); if (error) { alert('Ошибка: ' + error.message); return } onClose(); reload() }
  const remove = async () => { if (!confirm(`Удалить «${p.name}» (${p.id}) навсегда? Этапы проекта тоже удалятся. Это нельзя отменить.`)) return
    const { error } = await supabase.from('projects').delete().eq('id', p.id); if (error) { alert('Не удалось удалить: ' + error.message); return } onClose(); reload() }
  const mergeFrom = async (srcId) => { const src = allProjects.find((x) => x.id === srcId); if (!src) return
    if (!confirm(`Подтянуть историю «${src.name}» (${src.id}) в «${p.name}» (${p.id})?\n\nВсе отчёты старого проекта появятся здесь. Старый проект уйдёт в «Архив проектов → Объединённые», его можно разъединить обратно.`)) return
    const { error } = await supabase.from('projects').update({ merged_into: p.id, archived_at: new Date().toISOString(), archive_reason: 'merged' }).eq('id', src.id); if (error) alert('Ошибка: ' + error.message); else reload() }
  const mergeOpts = allProjects.filter((x) => x.id !== p.id && !x.archived_at && x.parent_id !== p.id).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const [d, setD] = useState({ name: p.name, description: p.description || '', owner: p.owner, category: p.category || 'other', expected_sales: p.expected_sales ?? '', baseline: p.baseline ?? '' })
  const dirty = d.name !== p.name || d.description !== (p.description || '') || d.owner !== p.owner || d.category !== (p.category || 'other') || String(d.expected_sales) !== String(p.expected_sales ?? '') || String(d.baseline) !== String(p.baseline ?? '')
  const save = () => upProj({ name: d.name.trim() || p.name, description: d.description, owner: d.owner, category: d.category, expected_sales: d.expected_sales === '' ? null : +d.expected_sales, baseline: d.baseline === '' ? null : +d.baseline })
  const ownerOpts = Array.from(new Set([...people, p.owner].filter(Boolean)))
  return <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 28, alignItems: 'start' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={label}>Название<input value={d.name} disabled={!ce} onChange={(e) => setD({ ...d, name: e.target.value })} style={input} /></label>
      <label style={label}>Описание<textarea value={d.description} disabled={!ce} onChange={(e) => setD({ ...d, description: e.target.value })} rows={6} placeholder="Зачем проект и какой результат ждём" style={{ ...input, height: 'auto', padding: 12, lineHeight: 1.6, resize: 'vertical', fontWeight: 400 }} /></label>
      {ce && <div style={{ display: 'flex', gap: 8 }}><button onClick={save} disabled={!dirty} style={{ ...btn(true), opacity: dirty ? 1 : 0.5 }}>Сохранить</button>{dirty && <button onClick={() => setD({ name: p.name, description: p.description || '', owner: p.owner, category: p.category || 'other', expected_sales: p.expected_sales ?? '', baseline: p.baseline ?? '' })} style={btn(false)}>Отменить</button>}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={label}>Владелец<select value={d.owner} disabled={!ce} onChange={(e) => setD({ ...d, owner: e.target.value })} style={input}>{ownerOpts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
      <label style={label}>Направление<select value={d.category} disabled={!ce} onChange={(e) => setD({ ...d, category: e.target.value })} style={input}>{PROJ_CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={label}>Было (до проекта)<input value={d.baseline} disabled={!ce} inputMode="numeric" onChange={(e) => setD({ ...d, baseline: e.target.value.replace(/\D/g, '') })} placeholder="—" style={input} /></label>
        <label style={label}>Доп. продажи в месяц<input value={d.expected_sales} disabled={!ce} inputMode="numeric" onChange={(e) => setD({ ...d, expected_sales: e.target.value.replace(/\D/g, '') })} placeholder="—" style={input} /></label>
      </div>
      {ce && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <label style={label}>Подтянуть историю из старого проекта<select value="" onChange={(e) => mergeFrom(e.target.value)} style={input}><option value="">выбрать проект…</option>{mergeOpts.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.id}</option>)}</select></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={archive} style={btn(false)}>В архив</button>
          {isA && <button onClick={remove} disabled={hasHistory} title={hasHistory ? 'У проекта есть история или подпроекты — его можно только убрать в архив' : ''} style={{ ...btn(false), color: '#B42318', borderColor: '#FBD3CC', opacity: hasHistory ? 0.45 : 1, cursor: hasHistory ? 'not-allowed' : 'pointer' }}>Удалить навсегда</button>}
        </div>
        <span style={{ fontSize: 12, color: C.ink4, lineHeight: 1.45 }}>Удалить навсегда можно только пустой проект (без отчётов, подпроектов и связи с Workshop) — например, созданный для теста. Всё остальное убирается в архив.</span>
      </div>}
      {subs.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Подпроекты</span>{subs.map((s) => <button key={s.id} onClick={() => onOpen(s.id)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, background: '#F9FAFB', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: 'inherit', color: C.ink }}><span>{s.id} · {s.name}</span><span style={{ color: C.ink4 }}>{s.owner}</span></button>)}</div>}
    </div>
  </div>
}

// ─── редактор этапа ───
export function StepEditor({ init, people, onClose, reload }) {
  const [s, setS] = useState({ ...init }); const [busy, setBusy] = useState(false)
  const days = s.start_date && s.end_date ? (parse(s.end_date) - parse(s.start_date)) / 864e5 + 1 : 0
  const save = async () => { if (!s.name.trim()) { alert('Назови этап'); return } if (days < 1) { alert('Окончание раньше начала'); return } setBusy(true)
    const row = { name: s.name.trim(), description: s.description || '', start_date: s.start_date, end_date: s.end_date, owner: s.owner || '', status: s.status, updated_at: new Date().toISOString() }
    const { error } = s.id ? await supabase.from('project_steps').update(s.source === 'sheet' ? { ...row, manual: true } : row).eq('id', s.id) : await supabase.from('project_steps').insert({ ...row, project_id: s.project_id })
    setBusy(false); if (error) alert('Ошибка: ' + error.message); else { onClose(); reload() } }
  const del = async () => { if (!confirm(`Удалить этап «${s.name}»?`)) return; const { error } = s.source === 'sheet' ? await supabase.from('project_steps').update({ hidden: true, manual: true }).eq('id', s.id) : await supabase.from('project_steps').delete().eq('id', s.id); if (error) alert('Ошибка: ' + error.message); else { onClose(); reload() } }
  const ownerOpts = Array.from(new Set([...people, s.owner].filter(Boolean)))
  return <Modal title={s.id ? 'Этап' : 'Новый этап'} width={540} onClose={onClose} footer={<>{s.id && <button onClick={del} style={{ ...btn(false), color: '#B42318', borderColor: '#FBD3CC', marginRight: 'auto' }}>Удалить этап</button>}<button onClick={onClose} style={btn(false)}>Отмена</button><button onClick={save} disabled={busy} style={btn(true)}>{busy ? 'Сохраняю…' : 'Сохранить'}</button></>}>
    <label style={label}>Название<input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Например: Запуск теста" style={input} autoFocus /></label>
    <label style={label}>Описание<textarea value={s.description || ''} onChange={(e) => setS({ ...s, description: e.target.value })} rows={3} placeholder="Что входит в этап, критерий готовности" style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical', fontWeight: 400 }} /></label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <label style={label}>Начало<input type="date" value={s.start_date} onChange={(e) => setS({ ...s, start_date: e.target.value })} style={input} /></label>
      <label style={label}>Окончание<input type="date" value={s.end_date} onChange={(e) => setS({ ...s, end_date: e.target.value })} style={input} /></label>
      <label style={label}>Исполнитель<select value={s.owner || ''} onChange={(e) => setS({ ...s, owner: e.target.value })} style={input}><option value="">—</option>{ownerOpts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
      <label style={label}>Статус<select value={s.status} onChange={(e) => setS({ ...s, status: e.target.value })} style={input}>{Object.entries(SST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></label>
    </div>
    <span style={{ fontSize: 12, color: C.ink3 }}>{days >= 1 ? `Длительность: ${days} дн. (${(days / 7).toFixed(1).replace('.0', '')} нед.)` : 'Окончание раньше начала'}</span>
  </Modal>
}
