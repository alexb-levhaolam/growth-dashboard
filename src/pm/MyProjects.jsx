import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, PST, HEALTH, DIR_COLORS, PROJ_CATS, catOf, dirLabel, iso, parse, addDays, weekLabel, dm, lastWeekStart, overlapsWeek, mineOf, nextId, Avatar, Pill, Dot, btn, input, chip, seg, label, Modal } from './pmlib'

// ═══ МОИ ПРОЕКТЫ ═══
export default function MyProjects({ projects, allProjects, steps, comments, profile, ce, onOpen, onNew }) {
  const [scope, setScope] = useState('mine'); const [q, setQ] = useState(''); const [stf, setStf] = useState('all')
  const lw = iso(lastWeekStart())
  const live = projects.filter((p) => !p.archived_at)
  const base = scope === 'mine' ? mineOf(live, steps, profile.name) : live
  const stepsOf = (id) => steps.filter((s) => s.project_id === id)
  const activeIn = (p, ws) => { const st = stepsOf(p.id); return st.length ? st.some((s) => overlapsWeek(s, ws)) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status) }
  const hasReport = (p, ws) => comments.some((c) => c.project_id === p.id && c.week_start === ws)
  const needRep = (p) => activeIn(p, lw) && !hasReport(p, lw)
  const grp = { all: () => true, progress: (p) => ['progress', 'test', 'test_prep'].includes(p.status), risk: (p) => ['risk', 'blocked'].includes(p.status), wait: (p) => p.status === 'wait', done: (p) => p.status === 'done', need: needRep }
  const ql = q.trim().toLowerCase()
  const list = base.filter((p) => (!ql || (p.id + ' ' + p.name + ' ' + p.owner).toLowerCase().includes(ql)) && grp[stf](p))
  const groups = PROJ_CATS.map((c) => ({ c, items: list.filter((p) => catOf(p) === c.v) })).filter((g) => g.items.length)
  const chips = [['all', 'Все статусы'], ['progress', 'В работе'], ['risk', 'Риск'], ['wait', 'Ожидание'], ['done', 'Готово'], ['need', 'Нет отчёта']]

  return <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 26, fontWeight: 700 }}>Мои проекты</span><span style={{ fontSize: 14, color: C.ink3 }}>{scope === 'mine' ? 'Проекты, где ты владелец или отвечаешь за этап' : 'Все проекты отдела'} · {list.length}</span></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: '#E9EBEE', borderRadius: 10, padding: 3 }}>{[['mine', 'Только мои'], ['all', 'Все проекты отдела']].map(([v, l]) => <button key={v} onClick={() => setScope(v)} style={seg(scope === v)}>{l}</button>)}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: название, ID, владелец" aria-label="Поиск" style={{ ...input, width: 240, height: 38, fontSize: 13 }} />
        {ce && <button onClick={() => onNew('')} style={btn(true)}>+ Новый проект</button>}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chips.map(([v, l]) => <button key={v} onClick={() => setStf(v)} style={chip(stf === v)}>{l}</button>)}</div>
    {!groups.length && <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, color: C.ink3 }}>Ничего не найдено.</div>}
    {groups.map(({ c, items }) => <div key={c.v} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.ink2 }}><Dot color={DIR_COLORS[c.v]} />{c.l}<span style={{ fontWeight: 500, color: C.ink4 }}>· {items.length}</span></span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>{items.map((p) => <Card key={p.id} p={p} allProjects={allProjects} steps={stepsOf(p.id)} comments={comments} need={needRep(p)} onOpen={onOpen} />)}</div>
    </div>)}
  </div>
}

function Card({ p, allProjects, steps, comments, need, onOpen }) {
  const st = PST[p.status] || PST.wait
  const subs = allProjects.filter((x) => x.parent_id === p.id && !x.archived_at)
  const fam = [p.id, ...subs.map((s) => s.id)]
  const last = comments.filter((c) => fam.includes(c.project_id)).sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))[0]
  const a = steps.length ? steps.reduce((m, s) => (s.start_date < m ? s.start_date : m), steps[0].start_date) : p.date_start
  const b = steps.length ? steps.reduce((m, s) => (s.end_date > m ? s.end_date : m), steps[0].end_date) : p.date_done
  const span = a && b ? Math.max(1, (parse(b) - parse(a)) / 864e5 + 1) : 0
  const today = new Date(); const cur = steps.find((s) => parse(s.start_date) <= today && parse(s.end_date) >= today) || steps.find((s) => s.status !== 'done')
  const tags = []; if (p.expected_sales) tags.push('+' + p.expected_sales + '/мес'); if (subs.length) tags.push(subs.length + ' подпр.')
  const SC = { todo: '#BFD2F3', doing: '#9BD08A', risk: '#F3A79A', done: '#D3D7DC' }
  return <button onClick={() => onOpen(p.id)} style={{ background: '#fff', border: `1px solid ${['risk', 'blocked'].includes(p.status) ? '#F3A79A' : C.line}`, borderRadius: 16, padding: '16px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, color: C.ink, fontFamily: 'inherit', height: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: C.ink4 }}>{p.id}{p.parent_id ? ' · подпроект ' + p.parent_id : ''}</span>
      <span style={{ display: 'flex', gap: 6 }}>{need && <span style={{ fontSize: 11, fontWeight: 600, color: '#B54708', background: '#FEF0C7', borderRadius: 999, padding: '3px 8px' }}>нет отчёта</span>}<Pill cfg={st} /></span>
    </div>
    <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, minHeight: 44 }}>{p.name}</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ position: 'relative', height: 8, background: '#F1F3F5', borderRadius: 4, overflow: 'hidden' }}>
        {span > 0 && steps.map((s) => <span key={s.id} style={{ position: 'absolute', top: 0, bottom: 0, left: ((parse(s.start_date) - parse(a)) / 864e5 / span * 100) + '%', width: `calc(${((parse(s.end_date) - parse(s.start_date)) / 864e5 + 1) / span * 100}% - 2px)`, background: SC[s.status] || SC.todo }} />)}
        {span > 0 && today >= parse(a) && today <= parse(b) && <span style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#E5484D', left: ((today - parse(a)) / 864e5 / span * 100) + '%' }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.ink3 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{steps.length ? (cur ? 'Сейчас: ' + cur.name + ' · до ' + dm(cur.end_date) : 'Все этапы завершены') : 'Этапов пока нет'}</span><span style={{ whiteSpace: 'nowrap' }}>{a && b ? dm(a) + ' – ' + dm(b) : ''}</span></div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: last ? '#F7F9F6' : '#FAFAFB', borderRadius: 10, padding: '10px 12px', minHeight: 64 }}>
      <span style={{ fontSize: 11, color: C.ink4, display: 'flex', gap: 6, alignItems: 'center' }}>{last ? 'Последний отчёт · ' + weekLabel(last.week_start) : 'Отчётов пока нет'}{last?.health && <Pill cfg={HEALTH[last.health]} small />}</span>
      <span style={{ fontSize: 13, lineHeight: 1.45, color: '#2A2E33', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{last ? last.full_text : 'Первый отчёт появится после понедельника.'}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><Avatar name={p.owner} size={24} />{p.owner}</span>
      <span style={{ display: 'flex', gap: 6 }}>{tags.map((t) => <span key={t} style={{ fontSize: 12, color: C.ink2, background: '#F1F3F5', borderRadius: 6, padding: '3px 8px' }}>{t}</span>)}</span>
    </div>
  </button>
}

// ═══ НОВЫЙ ПРОЕКТ / ПОДПРОЕКТ ═══
export function NewProjectModal({ parentId, allProjects, people, profile, onClose, onCreated, reload }) {
  const parent = parentId ? allProjects.find((p) => p.id === parentId) : null
  const start0 = iso(addDays(new Date(), 7 - ((new Date().getDay() + 6) % 7)))
  const [n, setN] = useState({ name: '', description: '', category: parent?.category || 'acquisition', owner: profile.name, parent_id: parentId || '', expected_sales: '', steps: [{ name: '', start: start0, end: iso(addDays(parse(start0), 13)) }] })
  const [busy, setBusy] = useState(false)
  const id = nextId(allProjects)
  const tops = allProjects.filter((p) => !p.parent_id && !p.archived_at)
  const ownerOpts = Array.from(new Set([...people, profile.name].filter(Boolean)))
  const upStep = (i, k, v) => setN({ ...n, steps: n.steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)) })
  const addStep = () => { const last = n.steps[n.steps.length - 1]; const st = last ? iso(addDays(parse(last.end), 1)) : start0; setN({ ...n, steps: [...n.steps, { name: '', start: st, end: iso(addDays(parse(st), 13)) }] }) }
  const create = async () => {
    if (!n.name.trim()) { alert('Укажи название'); return }
    setBusy(true)
    const { error } = await supabase.from('projects').insert({ id, name: n.name.trim(), description: n.description, owner: n.owner, category: n.category, parent_id: n.parent_id || null, expected_sales: n.expected_sales === '' ? null : +n.expected_sales, status: 'wait', priority: 'current', last_update: '' })
    if (error) { setBusy(false); alert('Не удалось создать: ' + error.message); return }
    const rows = n.steps.filter((s) => s.name.trim() && s.start && s.end).map((s, i) => ({ project_id: id, name: s.name.trim(), start_date: s.start, end_date: s.end < s.start ? s.start : s.end, owner: n.owner, status: 'todo', sort_order: i }))
    if (rows.length) { const r = await supabase.from('project_steps').insert(rows); if (r.error) alert('Проект создан, но этапы не сохранились: ' + r.error.message) }
    setBusy(false); await reload(); onCreated(id)
  }
  return <Modal title={n.parent_id ? 'Новый подпроект' : 'Новый проект'} sub={<>ID присвоится автоматически: <b style={{ color: C.ink }}>{id}</b>{n.parent_id ? ' · подпроект ' + n.parent_id : ''}</>} width={680} onClose={onClose}
    footer={<><button onClick={onClose} style={btn(false)}>Отмена</button><button onClick={create} disabled={busy} style={btn(true)}>{busy ? 'Создаю…' : 'Создать ' + id}</button></>}>
    <label style={label}>Название<input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="Например: Подарочная подписка" style={{ ...input, height: 44, fontSize: 15 }} autoFocus /></label>
    <label style={label}>Описание<textarea value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} rows={2} placeholder="Зачем проект и какой результат ждём" style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical', fontWeight: 400 }} /></label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Направление</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{PROJ_CATS.filter((c) => c.v !== 'other').map((c) => <button key={c.v} type="button" onClick={() => setN({ ...n, category: c.v })} style={chip(n.category === c.v)}><Dot color={DIR_COLORS[c.v]} />{c.l}</button>)}</div></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <label style={label}>Владелец<select value={n.owner} onChange={(e) => setN({ ...n, owner: e.target.value })} style={input}>{ownerOpts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
      <label style={label}>Входит в проект<select value={n.parent_id} onChange={(e) => setN({ ...n, parent_id: e.target.value })} style={input}><option value="">— самостоятельный —</option>{tops.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select></label>
      <label style={label}>Доп. продажи в месяц<input value={n.expected_sales} inputMode="numeric" onChange={(e) => setN({ ...n, expected_sales: e.target.value.replace(/\D/g, '') })} placeholder="0" style={input} /></label>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Этапы <span style={{ fontWeight: 400, color: C.ink4 }}>· любая длительность, потом можно менять</span></span>
      {n.steps.map((s, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 150px 150px 30px', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.ink4, textAlign: 'right' }}>{i + 1}</span>
        <input value={s.name} onChange={(e) => upStep(i, 'name', e.target.value)} placeholder="Название этапа" style={input} />
        <input type="date" value={s.start} onChange={(e) => upStep(i, 'start', e.target.value)} aria-label="Начало" style={{ ...input, fontSize: 13 }} />
        <input type="date" value={s.end} onChange={(e) => upStep(i, 'end', e.target.value)} aria-label="Окончание" style={{ ...input, fontSize: 13 }} />
        <button type="button" onClick={() => setN({ ...n, steps: n.steps.filter((_, j) => j !== i) })} aria-label="Убрать этап" style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', color: C.ink4 }}>✕</button>
      </div>)}
      <button type="button" onClick={addStep} style={{ ...btn(false), alignSelf: 'flex-start', height: 34, borderStyle: 'dashed', fontWeight: 500, fontSize: 13 }}>+ ещё этап</button>
    </div>
  </Modal>
}
