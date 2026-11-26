import { useState, useEffect } from 'react'
import { S, PROJ_ST, Linkify, ACC } from '../lib/ui'
import { HEALTH, iso, lastWeekStart, weekLabel, overlapsWeek, mineOf, isMe } from '../pm/pmlib'

// ═══ ГЛАВНАЯ ═══
const fmt = (v) => v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('ru-RU')
const longDate = (d) => { if (!d) return ''; const x = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d); return isNaN(x) ? '' : x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s?г\.$/, '') }
// дата комментария = последний день недели (воскресенье), к которой он относится
const weekEndDate = (c) => { const base = c.week_start || c.created_at; if (!base) return ''; const d = new Date(String(base).slice(0, 10) + 'T12:00:00'); if (isNaN(d)) return ''; const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return longDate(sun.toISOString().slice(0, 10)) }
const card = { background: S.sf, borderRadius: 14, boxShadow: S.sh, padding: 18 }
const sec = { fontSize: 12, fontWeight: 600, color: S.i3, letterSpacing: '.07em', textTransform: 'uppercase', margin: '0 0 12px' }

// Группы статусов: от того, что требует внимания, к тому, что ждёт
const GROUPS = [
  { k: 'risk', l: 'Риск и блокеры', st: ['blocked', 'risk'], color: '#A71F00', bg: '#FFEEEA' },
  { k: 'progress', l: 'В работе', st: ['progress'], color: '#8A3500', bg: '#FFF6E8' },
  { k: 'test', l: 'Тест', st: ['test', 'test_prep'], color: '#1761CB', bg: '#EDF5FF' },
  { k: 'wait', l: 'Ожидание / пауза', st: ['wait'], color: '#585E65', bg: '#F1F2F4' },
]

export default function Home({ profile, rep, projects, comments, mPlans, navTo, isA, steps = [], onOpen = () => {}, ce }) {
  const now = new Date()
  const mo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [md, setMd] = useState(null); const [mdErr, setMdErr] = useState(false)
  useEffect(() => {
    fetch(`/api/monthly?month=${mo}&untilDay=${now.getDate()}`).then((r) => r.json()).then((d) => { if (d && !d.error) setMd(d); else setMdErr(true) }).catch(() => setMdErr(true))
  }, [mo])

  // текущий месяц: продажи и CPO как в «Итогах месяца» (LH Daily)
  const mp = (mPlans || []).find((p) => p.id === mo)
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const days = md?.daysWithData || 0
  const sales = md?.totalSales
  const cpoAds = md?.paidSales > 0 ? md.adSpend / md.paidSales : null
  const cpoTotal = md?.totalSales > 0 ? (md.totalSpentBM || 0) / md.totalSales : null
  const cps = mp?.channel_plans || {}
  const ppS = (cps.meta?.planSales || 0) + (cps.google?.planSales || 0) + (cps.newChannels?.planSales || 0)
  const planCpoAds = mp?.plan_cpo_ads ?? (ppS > 0 ? ((mp?.ads_budget || 0) + (mp?.services_budget || 0) + (mp?.awareness_budget || 0)) / ppS : null)
  const planCpoTotal = mp?.plan_cpo_total ?? (mp?.total_plan > 0 ? ((mp?.ads_budget || 0) + (mp?.team_budget || 0) + (mp?.services_budget || 0) + (mp?.awareness_budget || 0)) / mp.total_plan : null)
  const planSales = mp?.total_plan || null
  const planToDate = planSales && days ? planSales / dim * days : null
  const monthName = now.toLocaleString('ru-RU', { month: 'long' })
  const delta = (fact, plan, lowerBetter) => { if (fact == null || !plan) return null; const d = Math.round((fact - plan) / plan * 100); const good = lowerBetter ? d <= 0 : d >= 0; return <span style={{ fontSize: 12, fontWeight: 600, color: good ? '#3B6402' : '#A71F00' }}>{d > 0 ? '+' : ''}{d}%</span> }
  const Kpi = ({ l, v, sub, d }) => <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 13, color: S.i3 }}>{l}</span>
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15 }}>{v}</span>{d}</span>
    <span style={{ fontSize: 12, color: S.i3 }}>{sub}</span>
  </div>

  const tops = projects.filter((p) => !p.parent_id && !p.archived_at)
  const active = tops.filter((p) => p.status !== 'done')
  const doneCount = tops.length - active.length
  // прошлая неделя: у кого нет отчёта, у кого риск или проблема
  const lw = iso(lastWeekStart())
  const famIds = (p) => [p.id, ...projects.filter((x) => x.parent_id === p.id).map((x) => x.id)]
  const activeIn = (p) => { const st = steps.filter((s) => famIds(p).includes(s.project_id)); return st.length ? st.some((s) => overlapsWeek(s, lw)) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status) }
  const wkReps = (p) => comments.filter((c) => famIds(p).includes(c.project_id) && String(c.week_start).slice(0, 10) === lw)
  const healthOf = (p) => { const hs = wkReps(p).map((c) => c.health || 'green'); return hs.includes('red') ? 'red' : hs.includes('amber') ? 'amber' : hs.length ? 'green' : null }
  const attention = active.filter(activeIn).map((p) => ({ p, h: healthOf(p), own: wkReps(p).some((c) => isMe(p.owner, c.author)) })).filter((x) => !x.own || x.h === 'red' || x.h === 'amber')
    .sort((a, b) => ({ red: 0, amber: 1 }[a.h] ?? 2) - ({ red: 0, amber: 1 }[b.h] ?? 2))
  const myLive = mineOf(projects.filter((p) => !p.archived_at && p.status !== 'done'), steps, profile.name).filter((p) => { const st = steps.filter((s) => s.project_id === p.id); return st.length ? st.some((s) => overlapsWeek(s, lw)) : ['progress', 'test', 'test_prep', 'risk', 'blocked'].includes(p.status) })
  const myMissing = myLive.filter((p) => !comments.some((c) => c.project_id === p.id && String(c.week_start).slice(0, 10) === lw && c.author === profile.name && c.source !== 'sheet'))
  const recent = [...comments].sort((a, b) => String(b.week_start || '').localeCompare(String(a.week_start || '')) || String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 8)

  return <>
    <h1 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 22px' }}>Добро пожаловать{profile?.name ? ', ' + profile.name : ''}</h1>

    {/* Текущий месяц */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <p style={sec}>Текущий месяц · {monthName} {now.getFullYear()}{days ? ` · ${days} из ${dim} дней` : ''}</p>
      {isA && <button onClick={() => navTo('monthly')} style={{ fontSize: 13, color: '#1761CB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12 }}>Открыть месячный отчёт →</button>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
      {Kpi({ l: 'Продажи', v: fmt(sales), d: delta(sales, planToDate), sub: planSales ? `план на сегодня ${fmt(planToDate)} · на месяц ${fmt(planSales)}` : 'план месяца не задан' })}
      {Kpi({ l: 'CPO Ads', v: cpoAds != null ? '$' + fmt(cpoAds) : '—', d: delta(cpoAds, planCpoAds, true), sub: planCpoAds ? `план $${fmt(planCpoAds)}` : 'план не задан' })}
      {Kpi({ l: 'CPO Total', v: cpoTotal != null ? '$' + fmt(cpoTotal) : '—', d: delta(cpoTotal, planCpoTotal, true), sub: planCpoTotal ? `план $${fmt(planCpoTotal)}` : 'план не задан' })}
      {Kpi({ l: 'Бюджет', v: md ? '$' + fmt(md.totalSpentBM) : '—', d: null, sub: mp?.plan_budget ? `план на месяц $${fmt(mp.plan_budget)}` : 'Total_Spent из LH Daily' })}
    </div>
    {mdErr && <div style={{ fontSize: 12, color: S.i3, margin: '-18px 0 22px' }}>Не удалось получить данные месяца из LH Daily.</div>}

    {/* Мои отчёты и «Требует внимания» */}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) 2fr', gap: 14, marginBottom: 28 }}>
      {ce ? <button onClick={() => navTo('pm-report')} style={{ ...card, textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6, background: myMissing.length ? '#FFFBF2' : '#F4FAF1', boxShadow: `inset 0 0 0 1px ${myMissing.length ? '#FCE3B5' : '#CFE6C4'}` }}>
        <span style={{ fontSize: 13, color: S.i3 }}>Мой отчёт · {weekLabel(lw)}</span>
        <span style={{ fontSize: 26, fontWeight: 700, color: myMissing.length ? '#B54708' : '#2C6B21' }}>{myMissing.length ? `${myMissing.length} без отчёта` : myLive.length ? '✓ всё готово' : 'нет активных этапов'}</span>
        <span style={{ fontSize: 12, color: S.i3 }}>{myMissing.length ? myMissing.slice(0, 3).map((p) => p.name).join(', ') + (myMissing.length > 3 ? '…' : '') : 'отчёты пишутся по понедельникам за прошлую неделю'}</span>
        {myMissing.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#2F5200', marginTop: 4 }}>Написать отчёт →</span>}
      </button> : <div />}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 15, fontWeight: 600 }}>Требует внимания · {weekLabel(lw)}</span><span style={{ fontSize: 12, color: S.i3 }}>{attention.length ? attention.length + ' пр.' : ''}</span></div>
        {!attention.length && <span style={{ fontSize: 13, color: '#2C6B21' }}>Все отчитались, рисков нет.</span>}
        {attention.slice(0, 6).map(({ p, h, own }) => <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: S.ink, fontSize: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: h ? HEALTH[h][3] : '#F5A524' }} />
          <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <span style={{ fontSize: 12, color: S.i3, flexShrink: 0 }}>{String(p.owner || '').split(',')[0]} · {!own ? 'нет отчёта' : HEALTH[h][0].toLowerCase()}</span>
        </button>)}
        {attention.length > 6 && <button onClick={() => navTo('weekly')} style={{ alignSelf: 'flex-start', fontSize: 12, color: '#1761CB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>ещё {attention.length - 6} → в недельном отчёте</button>}
      </div>
    </div>

    {/* Проекты по статусам */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <p style={sec}>Проекты · {active.length} активных{doneCount ? ` · ${doneCount} готово` : ''}</p>
      <button onClick={() => navTo('projects-all')} style={{ fontSize: 13, color: '#1761CB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12 }}>Все проекты →</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, marginBottom: 28 }}>
      {GROUPS.map((g) => { const list = active.filter((p) => g.st.includes(p.status)).sort((a, b) => (a.priority === 'key' ? 0 : 1) - (b.priority === 'key' ? 0 : 1) || (a.sort_order || 0) - (b.sort_order || 0)); const shown = list.slice(0, 7)
        return <div key={g.k} style={{ ...card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: g.bg }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: g.color }}>{g.l}</span>
            <span style={{ fontSize: 22, fontWeight: 600, color: g.color }}>{list.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
            {list.length === 0 && <span style={{ fontSize: 13, color: S.i3, padding: '8px 16px' }}>Нет проектов</span>}
            {shown.map((p) => <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: S.ink, fontSize: 13, lineHeight: 1.35 }}>
              {p.priority === 'key' && <span title="Ключевой" style={{ width: 6, height: 6, borderRadius: '50%', background: '#F18B0E', flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: S.i3, flexShrink: 0 }}>{String(p.owner || '').split(',')[0]}</span>
            </button>)}
            {list.length > shown.length && <button onClick={() => navTo('projects-all')} style={{ fontSize: 12, color: '#1761CB', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 16px 8px', textAlign: 'left' }}>ещё {list.length - shown.length} →</button>}
          </div>
        </div> })}
    </div>

    {/* Последние комментарии */}
    <p style={sec}>Последние отчёты</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {recent.map((c) => { const proj = projects.find((p) => p.id === c.project_id); const ps = PROJ_ST[proj?.status] || PROJ_ST.wait
        return <div key={c.id} onClick={() => proj && onOpen(proj.id)} style={{ ...card, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'flex-start', cursor: proj ? 'pointer' : 'default' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{proj?.name || c.project_id}</span>
              {proj && <span style={{ fontSize: 11, fontWeight: 600, color: ps.tx, background: ps.bg, borderRadius: 999, padding: '2px 8px' }}>{ps.l}</span>}
              {c.health && <span style={{ fontSize: 11, fontWeight: 600, color: HEALTH[c.health][2], background: HEALTH[c.health][1], borderRadius: 999, padding: '2px 8px' }}>{HEALTH[c.health][0]}</span>}
              <span style={{ fontSize: 12, color: S.i3 }}>{c.author}</span>
            </div>
            <div style={{ fontSize: 13, color: S.i2, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}><Linkify>{c.full_text || c.summary || ''}</Linkify></div>
          </div>
          <span style={{ fontSize: 12, color: S.i3, whiteSpace: 'nowrap', flexShrink: 0 }}>{weekEndDate(c)}</span>
        </div> })}
    </div>
  </>
}
