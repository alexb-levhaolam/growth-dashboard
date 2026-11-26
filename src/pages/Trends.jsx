import { useState, useEffect } from 'react'
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { S, CH_COLORS, cpoAdsOf, cpoTotalOf } from '../lib/ui'

// ═══ ТРЕНДЫ: продажи, CPO и каналы по неделям ═══
const card = { background: '#fff', borderRadius: 16, border: '1px solid #ECEEF1', padding: '20px 22px', marginBottom: 18 }
const seg = (on) => ({ height: 32, border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#fff' : 'transparent', color: on ? '#16181B' : '#6B717A', fontWeight: on ? 600 : 500, boxShadow: on ? '0 1px 2px rgba(16,24,40,.08)' : 'none' })
const short = (r) => { const d = r.week_start ? new Date(String(r.week_start).slice(0, 10) + 'T12:00:00') : null; return d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') : r.week_label }
const fmt = (v, money) => (v == null ? '—' : (money ? '$' : '') + Math.round(v).toLocaleString('ru-RU'))
const pct = (a, b) => (a != null && b ? Math.round((a - b) / b * 100) : null)

function Tip({ active, payload, label, money }) {
  if (!active || !payload || !payload.length) return null
  return <div style={{ background: '#16181B', color: '#fff', borderRadius: 10, padding: '10px 12px', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>
    <div style={{ color: '#A9B0B8', fontSize: 12, marginBottom: 6 }}>{payload[0]?.payload?.label || label}</div>
    {payload.filter((p) => p.value != null).map((p) => <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', lineHeight: 1.6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.stroke || p.fill }} />{p.name}: <b>{fmt(p.value, money)}</b></div>)}
  </div>
}
const Leg = ({ items }) => <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#6B717A' }}>{items.map(([l, c, dashed]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: dashed ? 0 : 10, borderRadius: 2, background: dashed ? 'none' : c, borderTop: dashed ? `2px dashed ${c}` : 'none' }} />{l}</span>)}</div>

function Trends({ reports, mPlans }) {
  const [range, setRange] = useState(13); const [mode, setMode] = useState('weekly')
  const allCh = new Set(); reports.forEach((r) => (r.channels || []).forEach((c) => { const n = c.name?.split(' (')[0] || c.name; if (n) allCh.add(n) })); const chNames = [...allCh]
  const [selCh, setSelCh] = useState({}); useEffect(() => { if (!Object.keys(selCh).length && chNames.length) { const o = {}; chNames.forEach((n) => { o[n] = true }); setSelCh(o) } }, [chNames.length])
  const rows = reports.map((r) => { const m = r.metrics || {}; const ch = r.channels || []; const wm = r.week_start?.slice(0, 7); const mp = (mPlans || []).find((p) => p.id === wm); const dim = wm ? new Date(+wm.slice(0, 4), +wm.slice(5, 7), 0).getDate() : 30
    const o = { x: short(r), label: 'Неделя ' + r.week_label, sales: m.totalSales ?? null, plan: mp?.total_plan ? Math.round(mp.total_plan / dim * 7) : m.planSales ?? null, cpoAds: (m.cpoAdsOverride != null ? m.cpoAdsOverride : cpoAdsOf(ch)) || null, cpoTotal: (m.cpoTotalOverride != null ? m.cpoTotalOverride : cpoTotalOf(m)) || null, planAds: mp?.plan_cpo_ads || mp?.channel_plans?.meta?.planCpo || null, planTotal: mp?.plan_cpo_total || null }
    ch.forEach((c) => { o[c.name?.split(' (')[0] || c.name] = c.sales }); return o })
  const data = range ? rows.slice(-range) : rows
  const last = rows[rows.length - 1] || {}; const prev4 = rows.slice(-5, -1)
  const avg = (k) => { const v = prev4.map((r) => r[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const tiles = [['Продажи за неделю', 'sales', false, false], ['CPO рекламы', 'cpoAds', true, true], ['CPO общий', 'cpoTotal', true, true]].map(([l, k, money, lowerBetter]) => { const d = pct(last[k], avg(k)); const good = d == null ? null : lowerBetter ? d <= 0 : d >= 0; return { l, v: fmt(last[k], money), d, good } })
  const daily = []; reports.slice(-(range || reports.length)).forEach((r) => (r.daily_data || []).forEach((d) => { if (d?.sales != null) daily.push({ x: d.day, label: d.day, sales: d.sales }) }))
  const axis = { tick: { fontSize: 12, fill: '#8A9099' }, tickLine: false, axisLine: false }
  const grid = <CartesianGrid stroke="#F1F2F4" vertical={false} />

  return <div style={{ color: '#16181B' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={{ display: 'flex', background: '#E9EBEE', borderRadius: 10, padding: 3 }}>{[['weekly', 'По неделям'], ['daily', 'По дням']].map(([v, l]) => <button key={v} onClick={() => setMode(v)} style={seg(mode === v)}>{l}</button>)}</div>
      <div style={{ display: 'flex', background: '#E9EBEE', borderRadius: 10, padding: 3 }}>{[[8, '8 недель'], [13, 'Квартал'], [26, 'Полгода'], [0, 'Всё']].map(([v, l]) => <button key={v} onClick={() => setRange(v)} style={seg(range === v)}>{l}</button>)}</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
      {tiles.map((t) => <div key={t.l} style={{ ...card, marginBottom: 0, padding: '16px 18px' }}><div style={{ fontSize: 13, color: '#6B717A' }}>{t.l}</div><div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}><span style={{ fontSize: 28, fontWeight: 700 }}>{t.v}</span>{t.d != null && <span style={{ fontSize: 13, fontWeight: 700, color: t.good ? '#2C6B21' : '#B42318' }}>{t.d > 0 ? '+' : ''}{t.d}%</span>}</div><div style={{ fontSize: 12, color: '#8A9099', marginTop: 2 }}>последняя неделя к среднему за 4 недели до неё</div></div>)}
    </div>

    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}><span style={{ fontSize: 16, fontWeight: 600 }}>Продажи {mode === 'weekly' ? 'по неделям' : 'по дням'}</span>{mode === 'weekly' && <Leg items={[['Факт', '#8CC63F'], ['План', '#16181B', true]]} />}</div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={mode === 'weekly' ? data : daily} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>{grid}<XAxis dataKey="x" {...axis} interval="preserveStartEnd" minTickGap={14} /><YAxis {...axis} width={48} /><Tooltip content={<Tip />} cursor={{ fill: '#F5F6F8' }} />
          <Bar dataKey="sales" name="Факт" fill="#8CC63F" radius={[5, 5, 0, 0]} maxBarSize={34} />
          {mode === 'weekly' && <Line dataKey="plan" name="План" stroke="#16181B" strokeWidth={2} strokeDasharray="6 4" dot={false} type="stepAfter" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>

    {mode === 'weekly' && <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}><span style={{ fontSize: 16, fontWeight: 600 }}>CPO по неделям</span><Leg items={[['CPO рекламы', '#2F6FDB'], ['CPO общий', '#E5484D'], ['план', '#8A9099', true]]} /></div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>{grid}<XAxis dataKey="x" {...axis} interval="preserveStartEnd" minTickGap={14} /><YAxis {...axis} width={52} tickFormatter={(v) => '$' + v} domain={['auto', 'auto']} /><Tooltip content={<Tip money />} />
          <Line dataKey="cpoAds" name="CPO рекламы" stroke="#2F6FDB" strokeWidth={2.5} dot={{ r: 3, fill: '#2F6FDB', strokeWidth: 0 }} type="monotone" connectNulls />
          <Line dataKey="cpoTotal" name="CPO общий" stroke="#E5484D" strokeWidth={2.5} dot={{ r: 3, fill: '#E5484D', strokeWidth: 0 }} type="monotone" connectNulls />
          <Line dataKey="planAds" name="План CPO рекламы" stroke="#2F6FDB" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="6 4" dot={false} type="stepAfter" />
          <Line dataKey="planTotal" name="План CPO общий" stroke="#E5484D" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="6 4" dot={false} type="stepAfter" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>}

    {mode === 'weekly' && chNames.length > 0 && <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Продажи по каналам</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chNames.map((n) => { const on = !!selCh[n]; return <button key={n} onClick={() => setSelCh((p) => ({ ...p, [n]: !p[n] }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, borderRadius: 999, padding: '0 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? '#C9CED6' : '#ECEEF1'}`, background: on ? '#fff' : '#F7F8F9', color: on ? '#16181B' : '#A9B0B8', fontWeight: on ? 600 : 500 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: on ? CH_COLORS[n] || S.i3 : '#D3D7DC' }} />{n}</button> })}</div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>{grid}<XAxis dataKey="x" {...axis} interval="preserveStartEnd" minTickGap={14} /><YAxis {...axis} width={48} /><Tooltip content={<Tip />} cursor={{ fill: '#F5F6F8' }} />
          {chNames.filter((n) => selCh[n]).map((n, i, arr) => <Bar key={n} dataKey={n} name={n} stackId="a" fill={CH_COLORS[n] || S.i3} maxBarSize={34} radius={i === arr.length - 1 ? [5, 5, 0, 0] : 0} />)}
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 12, color: '#8A9099', marginTop: 6 }}>Нажми на канал сверху, чтобы скрыть или показать его.</div>
    </div>}
  </div>
}

export default Trends
