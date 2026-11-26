import { useState } from 'react'
import { C, PST, HEALTH, DIR_COLORS, PROJ_CATS, catOf, iso, parse, addDays, weekLabel, overlapsWeek, isMe, Avatar, Pill, Dot, btn, chip, Chips } from './pmlib'

// ═══ ОТЧЁТ ЗА НЕДЕЛЮ: блок «Проекты» ═══
// По каждому активному проекту недели — последний отчёт владельца. Вкладки направлений сверху.
// Администратор может скрыть проекты из отчёта этой недели (сохраняется в weekly_reports.hidden_projects).
export default function WeekProjects({ rep, projects, steps, comments, ce, isA, up, onOpen }) {
  const ws = String(rep.week_start).slice(0, 10)
  const [tune, setTune] = useState(false)
  const hidden = rep.hidden_projects || []
  const live = projects.filter((p) => !p.archived_at && !p.parent_id)
  const fam = (p) => [p, ...projects.filter((x) => x.parent_id === p.id && !x.archived_at)]
  const famIds = (p) => fam(p).map((x) => x.id)
  const weekComments = (p) => comments.filter((c) => famIds(p).includes(c.project_id) && String(c.week_start).slice(0, 10) === ws)
  const isActive = (p) => { const st = steps.filter((s) => famIds(p).includes(s.project_id)); return weekComments(p).length > 0 || (st.length ? st.some((s) => overlapsWeek(s, ws)) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status)) }
  const all = live.filter(isActive)
  const shown = all.filter((p) => !hidden.includes(p.id))
  const ownerRep = (p) => weekComments(p).filter((c) => isMe(p.owner, c.author)).sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0]
  const healthOf = (p) => { const hs = weekComments(p).map((c) => c.health || 'green'); return hs.includes('red') ? 'red' : hs.includes('amber') ? 'amber' : hs.length ? 'green' : null }
  const curStep = (p) => steps.filter((s) => famIds(p).includes(s.project_id)).find((s) => overlapsWeek(s, ws))
  const dirs = PROJ_CATS.filter((c) => shown.some((p) => catOf(p) === c.v))
  const [dir, setDir] = useState(null); const curDir = dirs.some((d) => d.v === dir) ? dir : dirs[0]?.v
  const list = shown.filter((p) => catOf(p) === curDir)
  const withRep = shown.filter((p) => ownerRep(p)).length
  const risky = shown.filter((p) => ['amber', 'red'].includes(healthOf(p)) || ['risk', 'blocked'].includes(p.status))
  const attention = list.filter((p) => !ownerRep(p) || ['amber', 'red'].includes(healthOf(p)))
  const pillS = { fontSize: 12, color: C.ink2, background: '#F5F6F8', border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 10px' }
  const toggle = (id) => up({ hidden_projects: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] })
  const setMany = (ids, hide) => up({ hidden_projects: hide ? Array.from(new Set([...hidden, ...ids])) : hidden.filter((x) => !ids.includes(x)) })

  return <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32, color: C.ink }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18, fontWeight: 700 }}>Проекты · {weekLabel(ws)}</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={pillS}>Отчёты готовы: <b>{withRep} из {shown.length}</b></span>
        <span style={pillS}>Нет отчёта: <b>{shown.length - withRep}</b></span>
        <span style={pillS}>С риском: <b>{risky.length}</b></span>
        {isA && <button onClick={() => setTune(true)} style={{ ...btn(false), height: 32, fontSize: 13 }}>⚙ Настроить отчёт{hidden.length ? ` · скрыто ${all.filter((p) => hidden.includes(p.id)).length}` : ''}</button>}
      </div>
    </div>
    {!shown.length && <span style={{ fontSize: 14, color: C.ink4 }}>На этой неделе нет активных проектов.</span>}
    {dirs.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: `1px solid ${C.line}` }}>
      {dirs.map((d) => { const n = shown.filter((p) => catOf(p) === d.v); const miss = n.filter((p) => !ownerRep(p)).length; const on = d.v === curDir
        return <button key={d.v} onClick={() => setDir(d.v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, border: 'none', background: 'none', padding: '0 12px', fontSize: 14, cursor: 'pointer', marginBottom: -1, fontFamily: 'inherit', borderBottom: `2px solid ${on ? C.dark : 'transparent'}`, color: on ? C.ink : C.ink3, fontWeight: on ? 600 : 500 }}>
          <Dot color={DIR_COLORS[d.v]} />{d.l}<span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: miss ? '#FEF0C7' : '#F1F3F5', color: miss ? '#B54708' : C.ink3 }}>{n.length}</span></button> })}
    </div>}
    {attention.length > 0 && <div style={{ background: '#FFFBF2', border: '1px solid #FCE3B5', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#93370D' }}>Требует внимания</span>
      {attention.map((p) => { const h = healthOf(p); return <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><Avatar name={p.owner} size={24} /><button onClick={() => onOpen(p.id)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{p.name}</button><span style={{ color: C.ink3 }}>· {p.owner} · {!ownerRep(p) ? 'нет отчёта владельца' : HEALTH[h][0].toLowerCase()}</span></div> })}
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
      {list.map((p) => { const r = ownerRep(p); const h = healthOf(p); const step = curStep(p); const sub = r && r.project_id !== p.id ? fam(p).find((x) => x.id === r.project_id) : null
        return <div key={p.id} style={{ background: '#fff', border: `1px solid ${r ? C.line : '#FCE3B5'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}><button onClick={() => onOpen(p.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 15, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>{p.name}</button><span style={{ fontSize: 12, color: C.ink4 }}>{p.id} · {p.owner}{step ? ' · этап: ' + step.name : ''}</span></div>
            {h ? <Pill cfg={HEALTH[h]} /> : <Pill cfg={['Нужен отчёт', '#FEF0C7', '#B54708']} />}
          </div>
          {r ? <div style={{ display: 'flex', gap: 10 }}>
            <Avatar name={r.author} size={28} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: C.ink3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ color: C.ink }}>{r.author}</b>{r.health && <Pill cfg={HEALTH[r.health]} small />}{sub && <span>· {sub.id} · {sub.name}</span>}{r.source === 'sheet' && <span style={{ color: C.ink4 }}>· из Workshop</span>}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.full_text}</span>
              <Chips c={r} />
              {(r.images || []).length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{r.images.map((im, i) => <a key={i} href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt={im.name || ''} style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.line}` }} /></a>)}</div>}
            </div>
          </div> : <span style={{ fontSize: 13, color: '#B54708' }}>Владелец проекта ещё не написал отчёт за эту неделю</span>}
        </div> })}
    </div>

    {tune && <>
      <div onClick={() => setTune(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.2)', zIndex: 1050 }} />
      <aside role="dialog" aria-label="Настроить отчёт" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#fff', zIndex: 1051, boxShadow: '-12px 0 40px rgba(16,24,40,.16)', display: 'flex', flexDirection: 'column', color: C.ink }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 18, fontWeight: 700 }}>Настроить отчёт</span><button onClick={() => setTune(false)} aria-label="Закрыть" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer' }}>✕</button></div>
          <span style={{ fontSize: 13, color: C.ink3 }}>Неделя {weekLabel(ws)}</span>
          <span style={{ fontSize: 12, color: C.ink4, lineHeight: 1.45 }}>Выключи проекты, которые не нужно показывать в отчёте этой недели. Изменения сохраняются сразу и видны всем.</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 22px 20px' }}>
          {PROJ_CATS.map((c) => { const items = all.filter((p) => catOf(p) === c.v); if (!items.length) return null
            return <div key={c.v} style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.ink2 }}><Dot color={DIR_COLORS[c.v]} />{c.l}</span>
                <span style={{ display: 'flex', gap: 10 }}><button onClick={() => setMany(items.map((p) => p.id), false)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: C.blue, cursor: 'pointer', fontFamily: 'inherit' }}>показать все</button><button onClick={() => setMany(items.map((p) => p.id), true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: C.ink3, cursor: 'pointer', fontFamily: 'inherit' }}>скрыть все</button></span></div>
              {items.map((p) => { const on = !hidden.includes(p.id); const r = ownerRep(p)
                return <button key={p.id} role="switch" aria-checked={on} onClick={() => toggle(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', padding: '7px 0', cursor: 'pointer', textAlign: 'left', color: C.ink, fontFamily: 'inherit' }}>
                  <span style={{ width: 38, height: 22, borderRadius: 999, padding: 2, flexShrink: 0, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? '#6DBB5A' : '#C9CED6', boxSizing: 'border-box' }}><span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} /></span>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 500, color: on ? C.ink : C.ink4, textDecoration: on ? 'none' : 'line-through' }}>{p.name}</span><span style={{ fontSize: 11, color: C.ink4 }}>{p.id} · {p.owner} · {r ? (r.health ? HEALTH[r.health][0] : 'есть отчёт') : 'нет отчёта'}</span></span>
                </button> })}
            </div> })}
        </div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 13, color: C.ink3 }}>показано {shown.length} из {all.length}</span><button onClick={() => setTune(false)} style={btn(true)}>Готово</button></div>
      </aside>
    </>}
  </div>
}
