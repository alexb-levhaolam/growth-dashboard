import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { S, PROJ_CATS, catOf, chipStyle, Linkify, ACC } from '../lib/ui'

// ═══ АРХИВ ПРОЕКТОВ: завершённые, убранные в архив, объединённые. Ничего не удаляется. ═══
const fmtD = (d) => { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'); return isNaN(x) ? '' : x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s?г\.$/, '') }
const weekEndD = (ws) => { if (!ws) return ''; const d = new Date(String(ws).slice(0, 10) + 'T12:00:00'); const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); m.setDate(m.getDate() + 6); return fmtD(m.toISOString()) }

export default function ProjectArchive({ allProjects, comments, ce, reload }) {
  const [tab, setTab] = useState('done'); const [q, setQ] = useState(''); const [open, setOpen] = useState({}); const [busy, setBusy] = useState('')
  const byId = {}; allProjects.forEach((p) => { byId[p.id] = p })
  const groups = {
    done: allProjects.filter((p) => p.status === 'done' && p.archive_reason !== 'merged'),
    archived: allProjects.filter((p) => p.archived_at && p.archive_reason !== 'merged' && p.status !== 'done'),
    merged: allProjects.filter((p) => p.merged_into),
  }
  const tabs = [['done', 'Завершённые'], ['archived', 'В архиве'], ['merged', 'Объединённые']]
  const ql = q.trim().toLowerCase()
  const list = groups[tab].filter((p) => !ql || (p.id + ' ' + p.name + ' ' + (p.owner || '')).toLowerCase().includes(ql))
    .sort((a, b) => String(b.archived_at || b.date_done || '').localeCompare(String(a.archived_at || a.date_done || '')))
  const historyOf = (p) => comments.filter((c) => (c.orig_project_id || c.project_id) === p.id).sort((a, b) => String(b.week_start || '').localeCompare(String(a.week_start || '')))

  const act = async (p, patch, msg) => {
    if (msg && !confirm(msg)) return
    setBusy(p.id)
    const { error } = await supabase.from('projects').update(patch).eq('id', p.id)
    setBusy(''); if (error) { alert('Ошибка: ' + error.message); return }
    await reload()
  }
  const restore = (p) => act(p, { archived_at: null, archive_reason: null }, `Вернуть «${p.name}» в активные проекты?`)
  const unmerge = (p) => act(p, { archived_at: null, archive_reason: null, merged_into: null }, `Разъединить «${p.name}» и «${byId[p.merged_into]?.name || p.merged_into}»? История вернётся к старому проекту, он снова станет активным.`)
  const reopen = (p) => act(p, { status: 'progress', archived_at: null, archive_reason: null }, `Вернуть «${p.name}» в работу?`)

  const card = { background: S.sf, borderRadius: 14, boxShadow: S.sh }
  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 24, fontWeight: 600 }}>Архив проектов</span>
        <span style={{ fontSize: 13, color: S.i3 }}>Проекты здесь не удаляются: вся история комментариев сохраняется, любой проект можно вернуть.</span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: название, ID, владелец" aria-label="Поиск" style={{ height: 38, width: 260, border: `1px solid ${S.ln}`, borderRadius: 10, padding: '0 12px', fontSize: 13, fontFamily: 'inherit' }} />
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={chipStyle(tab === k)}>{l} · {groups[k].length}</button>)}
    </div>
    <div style={{ fontSize: 13, color: S.i3, marginBottom: 12 }}>
      {tab === 'done' && 'Проекты со статусом «готово». Чтобы вернуть проект в работу, нажми «Вернуть в работу».'}
      {tab === 'archived' && 'Проекты, убранные в архив вручную (кнопка «В архив» в карточке проекта).'}
      {tab === 'merged' && 'Старые проекты, чья история подтянута в новые. Их комментарии показываются в карточке нового проекта.'}
    </div>
    {list.length === 0 && <div style={{ ...card, padding: 24, color: S.i3, fontSize: 14 }}>Здесь пока пусто.</div>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((p) => { const h = historyOf(p); const isO = !!open[p.id]; const cat = (PROJ_CATS.find((c) => c.v === catOf(p)) || {}).l; const target = p.merged_into ? byId[p.merged_into] : null
        return <div key={p.id} style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button onClick={() => setOpen({ ...open, [p.id]: !isO })} style={{ flex: 1, minWidth: 260, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: S.ink, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{isO ? '▾' : '▸'} {p.name}</span>
              <span style={{ fontSize: 13, color: S.i3 }}>{p.id}{p.owner ? ' · ' + p.owner : ''}{cat ? ' · ' + cat : ''} · комментариев: {h.length}{p.archived_at ? ' · в архиве с ' + fmtD(p.archived_at) : ''}{tab === 'done' && p.date_done ? ' · завершён ' + fmtD(p.date_done) : ''}</span>
              {target && <span style={{ fontSize: 13, color: '#3B6402' }}>История подтянута в: {target.id} · {target.name}</span>}
            </button>
            {ce && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {tab === 'done' && <button disabled={busy === p.id} onClick={() => reopen(p)} style={{ ...chipStyle(false), fontSize: 13 }}>Вернуть в работу</button>}
              {tab === 'archived' && <button disabled={busy === p.id} onClick={() => restore(p)} style={{ fontSize: 13, fontWeight: 600, color: ACC.tx, background: ACC.bg, border: `1px solid ${ACC.bd}`, borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}>Восстановить</button>}
              {tab === 'merged' && <button disabled={busy === p.id} onClick={() => unmerge(p)} style={{ ...chipStyle(false), fontSize: 13 }}>Разъединить</button>}
            </div>}
          </div>
          {isO && <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.last_update && <div style={{ fontSize: 13, color: S.i2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.last_update}</div>}
            {h.length === 0 && <div style={{ fontSize: 13, color: S.i3 }}>Комментариев нет.</div>}
            {h.map((c) => <div key={c.id} style={{ background: S.bg, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: S.i3, marginBottom: 3 }}><b style={{ fontWeight: 600, color: S.i2 }}>{c.author}</b> · неделя до {weekEndD(c.week_start)}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><Linkify>{c.full_text || c.summary || ''}</Linkify></div>
            </div>)}
          </div>}
        </div> })}
    </div>
  </>
}
