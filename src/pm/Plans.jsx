import { useState } from 'react'
import { C, DIR_COLORS, PROJ_CATS, catOf, mineOf, Avatar, Dot, seg } from './pmlib'
import Gantt, { Legend } from './Gantt'
import { StepEditor } from './ProjectModal'

// ═══ МОЙ ПЛАН РАБОТ: свои проекты, этапы двигаются и растягиваются ═══
export function MyPlan({ projects, steps, comments, profile, ce, people, onOpen, reload }) {
  const [se, setSe] = useState(null)
  const mine = mineOf(projects.filter((p) => !p.archived_at && p.status !== 'done'), steps, profile.name)
    .sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) || String(a.id).localeCompare(String(b.id)))
  const rows = mine.map((p) => ({ key: p.id, label: p.name, sub: p.id + ' · ' + p.owner + (p.parent_id ? ' · в ' + p.parent_id : ''), dot: <Dot color={DIR_COLORS[catOf(p)]} />, indent: p.parent_id ? 16 : 0, onLabel: () => onOpen(p.id),
    steps: steps.filter((s) => s.project_id === p.id).map((s) => ({ ...s, canEdit: ce })), comments: comments.filter((c) => c.project_id === p.id), onStep: (s) => setSe(s) }))
  return <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 26, fontWeight: 700 }}>Мой план работ</span><span style={{ fontSize: 14, color: C.ink3, lineHeight: 1.45 }}>Твои проекты и их этапы на календаре. Чтобы сдвинуть этап — перетащи его, изменить длительность — потяни за правый край, изменить название или даты — кликни.</span></div>
    {!rows.length ? <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, color: C.ink3 }}>У тебя пока нет проектов с этапами.</div>
      : <Gantt rows={rows} mode="bars" editable={ce} headLabel="Мои проекты" onStepClick={(s) => setSe(s)} onSaved={() => reload()} />}
    <Legend />
    {se && <StepEditor init={se} people={people} onClose={() => setSe(null)} reload={reload} />}
  </div>
}

// ═══ ПЛАН РАБОТ ОТДЕЛА: клетки-недели, цвет = как прошла неделя ═══
export function TeamPlan({ projects, steps, comments, people, onOpen, openTab }) {
  const [group, setGroup] = useState('person')
  const live = projects.filter((p) => !p.archived_at && p.status !== 'done')
  const famComments = (p) => comments.filter((c) => c.project_id === p.id)
  const item = (p, indent) => ({ key: p.id, label: p.name, sub: p.id + ' · ' + p.owner, dot: <Dot color={DIR_COLORS[catOf(p)]} />, indent, onLabel: () => onOpen(p.id),
    steps: steps.filter((s) => s.project_id === p.id), comments: famComments(p), onCell: (tab) => openTab(p.id, tab) })
  const rows = []
  if (group === 'person') {
    const owners = Array.from(new Set(live.map((p) => String(p.owner || '—').split(/[,;]/)[0].trim()))).sort()
    owners.forEach((o) => { const list = live.filter((p) => String(p.owner || '—').split(/[,;]/)[0].trim() === o); if (!list.length) return
      rows.push({ head: true, key: 'h' + o, label: o, icon: <Avatar name={o} size={24} />, count: list.length + ' пр.' }); list.forEach((p) => rows.push(item(p, p.parent_id ? 16 : 0))) })
  } else {
    PROJ_CATS.forEach((c) => { const tops = live.filter((p) => catOf(p) === c.v && !p.parent_id); if (!tops.length) return
      rows.push({ head: true, key: 'h' + c.v, label: c.l, icon: <Dot color={DIR_COLORS[c.v]} size={12} />, count: tops.length + ' пр.' })
      tops.forEach((p) => { rows.push(item(p, 0)); live.filter((x) => x.parent_id === p.id).forEach((x) => rows.push(item(x, 18))) }) })
  }
  return <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 720 }}><span style={{ fontSize: 26, fontWeight: 700 }}>План работ отдела</span><span style={{ fontSize: 14, color: C.ink3, lineHeight: 1.45 }}>Каждая клетка — одна неделя. Цвет показывает, как прошла неделя по отчёту владельца. Наведи на клетку, чтобы прочитать отчёт, кликни — чтобы открыть проект.</span></div>
      <div style={{ display: 'flex', background: '#E9EBEE', borderRadius: 10, padding: 3 }}>{[['person', 'По людям'], ['dir', 'По направлениям']].map(([v, l]) => <button key={v} onClick={() => setGroup(v)} style={seg(group === v)}>{l}</button>)}</div>
    </div>
    <Gantt rows={rows} mode="cells" headLabel={group === 'person' ? 'Люди и проекты' : 'Направления и проекты'} />
    <Legend cells />
  </div>
}
