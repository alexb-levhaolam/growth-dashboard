import { useState, useEffect } from 'react'
import { S, PROJ_ST, Linkify, ACC } from '../lib/ui'

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

export default function Home({ profile, rep, projects, comments, mPlans, navTo, isA }) {
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

  const active = projects.filter((p) => p.status !== 'done')
  const doneCount = projects.length - active.length
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

    {/* Быстрый доступ */}
    <p style={sec}>Быстрый доступ</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 28 }}>
      {[
        { t: 'Текущая неделя', v: rep?.week_label || '—', s: `${fmt(rep?.metrics?.totalSales || 0)} продаж`, go: 'weekly' },
        isA && { t: 'Месячный отчёт', v: new Date(now.getFullYear(), now.getMonth() - 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s?г\.$/, ''), s: 'итоги прошлого месяца', go: 'monthly' },
        { t: 'Workshop 2027', v: 'План и Roadmap', s: 'проекты, недели, план продаж', go: 'workshop' },
      ].filter(Boolean).map((x) => <button key={x.t} onClick={() => navTo(x.go)} style={{ ...card, textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: S.i3 }}>{x.t}</span>
        <span style={{ fontSize: 20, fontWeight: 600, color: S.ink, textTransform: 'capitalize' }}>{x.v}</span>
        <span style={{ fontSize: 12, color: S.i3 }}>{x.s}</span>
      </button>)}
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
            {shown.map((p) => <button key={p.id} onClick={() => navTo('projects-all')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: S.ink, fontSize: 13, lineHeight: 1.35 }}>
              {p.priority === 'key' && <span title="Ключевой" style={{ width: 6, height: 6, borderRadius: '50%', background: '#F18B0E', flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: S.i3, flexShrink: 0 }}>{String(p.owner || '').split(',')[0]}</span>
            </button>)}
            {list.length > shown.length && <button onClick={() => navTo('projects-all')} style={{ fontSize: 12, color: '#1761CB', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 16px 8px', textAlign: 'left' }}>ещё {list.length - shown.length} →</button>}
          </div>
        </div> })}
    </div>

    {/* Последние комментарии */}
    <p style={sec}>Последние комментарии</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {recent.map((c) => { const proj = projects.find((p) => p.id === c.project_id); const ps = PROJ_ST[proj?.status] || PROJ_ST.wait
        return <div key={c.id} style={{ ...card, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{proj?.name || c.project_id}</span>
              {proj && <span style={{ fontSize: 11, fontWeight: 600, color: ps.tx, background: ps.bg, borderRadius: 999, padding: '2px 8px' }}>{ps.l}</span>}
              <span style={{ fontSize: 12, color: S.i3 }}>{c.author}</span>
            </div>
            <div style={{ fontSize: 13, color: S.i2, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}><Linkify>{c.full_text || c.summary || ''}</Linkify></div>
          </div>
          <span style={{ fontSize: 12, color: S.i3, whiteSpace: 'nowrap', flexShrink: 0 }}>{weekEndDate(c)}</span>
        </div> })}
    </div>
  </>
}
