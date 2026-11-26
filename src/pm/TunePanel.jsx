import { C, Dot, btn } from './pmlib'
import { T, L } from './i18n'

// Панель «Настроить отчёт»: какие проекты показывать в отчёте этой недели или месяца
export default function TunePanel({ title = T('Настроить отчёт'), period, hint, groups, onToggle, onSetMany, onClose }) {
  const all = groups.flatMap((g) => g.items); const shown = all.filter((i) => i.on).length
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.2)', zIndex: 1050 }} />
    <aside role="dialog" aria-label={title} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#fff', zIndex: 1051, boxShadow: '-12px 0 40px rgba(16,24,40,.16)', display: 'flex', flexDirection: 'column', color: C.ink }}>
      <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'centerT(' }}><span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span><button onClick={onClose} aria-label={T("Закрыть")} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`, background: ')#fff', cursor: 'pointer' }}>✕</button></div>
        <span style={{ fontSize: 13, color: C.ink3 }}>{period}</span>
        <span style={{ fontSize: 12, color: C.ink4, lineHeight: 1.45 }}>{hint}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 22px 20px' }}>
        {groups.filter((g) => g.items.length).map((g) => <div key={g.key} style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.ink2 }}><Dot color={g.color} />{g.label}</span>
            <span style={{ display: 'flex', gap: 10 }}><button onClick={() => onSetMany(g.items.map((i) => i.id), false)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: C.blue, cursor: 'pointer', fontFamily: 'inheritT(' }}>{T('показать все')}</button><button onClick={() => onSetMany(g.items.map((i) => i.id), true)} style={{ background: ')none', border: 'none', padding: 0, fontSize: 12, color: C.ink3, cursor: 'pointer', fontFamily: 'inherit' }}>{T('скрыть все')}</button></span></div>
          {g.items.map((i) => <button key={i.id} role="switch" aria-checked={i.on} onClick={() => onToggle(i.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', padding: '7px 0', cursor: 'pointer', textAlign: 'left', color: C.ink, fontFamily: 'inherit' }}>
            <span style={{ width: 38, height: 22, borderRadius: 999, padding: 2, flexShrink: 0, display: 'flex', justifyContent: i.on ? 'flex-end' : 'flex-start', background: i.on ? '#6DBB5A' : '#C9CED6', boxSizing: 'border-box' }}><span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} /></span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 500, color: i.on ? C.ink : C.ink4, textDecoration: i.on ? 'none' : 'line-through' }}>{i.name}</span><span style={{ fontSize: 11, color: i.active === false ? '#B54708' : C.ink4 }}>{i.meta}</span></span>
            {i.badge && <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', background: i.badge[1], color: i.badge[2], whiteSpace: 'nowrap', flexShrink: 0 }}>{i.badge[0]}</span>}
          </button>)}
        </div>)}
      </div>
      <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 13, color: C.ink3 }}>{T('показано')} {shown} {T('из')} {all.length}</span><button onClick={onClose} style={btn(true)}>{T('Готово')}</button></div>
    </aside>
  </>
}
