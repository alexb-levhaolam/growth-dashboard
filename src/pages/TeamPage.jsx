import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, Avatar, btn, input, chip, Modal, label } from '../pm/pmlib'

// ═══ КОМАНДА: состав, Slack ID для напоминаний, язык, активность ═══
const slackOk = (v) => /^[UW][A-Z0-9]{8,10}$/.test(String(v || '').trim())
const authHeaders = async () => { const { data: { session } } = await supabase.auth.getSession(); return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') } }

function TeamPage({ allProfiles, ce, reload }) {
  const [members, setMembers] = useState([]); const [flt, setFlt] = useState('active'); const [add, setAdd] = useState(null); const [msg, setMsg] = useState(''); const [prev, setPrev] = useState(null); const [busy, setBusy] = useState('')
  const load = async () => { const { data } = await supabase.from('team_members').select('*').order('name'); if (data) setMembers(data) }
  useEffect(() => { load() }, [])
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2600) }
  const upd = async (m, patch) => { setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, ...patch } : x))); const { error } = await supabase.from('team_members').update(patch).eq('id', m.id); if (error) { alert('Не сохранилось: ' + error.message); load() } else { flash('Сохранено в базе'); reload && reload() } }
  const create = async () => { if (!add.name.trim()) { alert('Укажи имя'); return } const { error } = await supabase.from('team_members').insert({ name: add.name.trim(), title: add.title, email: add.email.trim(), slack_id: add.slack_id.trim().toUpperCase(), lang: add.lang, role: add.title, active: true }); if (error) { alert('Ошибка: ' + error.message); return } setAdd(null); load(); flash('Участник добавлен'); reload && reload() }
  const ping = async (m) => { if (!slackOk(m.slack_id)) { alert('Сначала укажи правильный Slack ID'); return } setBusy('ping' + m.id); const r = await fetch('/api/pm-remind?action=ping', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ slack_id: m.slack_id, name: m.name, lang: m.lang }) }); const d = await r.json().catch(() => ({})); setBusy(''); flash(d.ok ? 'Тестовое сообщение отправлено: ' + m.name : 'Не отправилось: ' + (d.error || r.status)) }
  const preview = async () => { setBusy('prev'); const r = await fetch('/api/pm-remind?action=preview', { headers: await authHeaders() }); const d = await r.json().catch(() => ({})); setBusy(''); if (d.error) alert(d.error); else setPrev(d) }
  const sendNow = async () => { if (!confirm(`Отправить напоминания в Slack сейчас (${prev?.messages?.length || 0} чел.)?`)) return; setBusy('send'); const r = await fetch('/api/pm-remind?action=send', { method: 'POST', headers: await authHeaders() }); const d = await r.json().catch(() => ({})); setBusy(''); if (d.error) alert(d.error); else { alert(`Отправлено: ${d.sent} из ${d.results.length}` + (d.results.some((x) => !x.ok) ? '\n\nНе ушло:\n' + d.results.filter((x) => !x.ok).map((x) => x.name + ' — ' + x.error).join('\n') : '')); setPrev(null) } }
  const list = members.filter((m) => flt === 'all' || (flt === 'active' ? m.active !== false : m.active === false))
  const cols = '190px 170px 1fr 190px 70px 60px 40px'
  const cell = { ...input, height: 34, fontSize: 13 }

  return <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
    {msg && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: '#16181B', color: '#fff', borderRadius: 12, padding: '12px 18px', fontSize: 14 }}>{msg}</div>}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 26, fontWeight: 700 }}>Команда</span><span style={{ fontSize: 14, color: C.ink3 }}>Кто в команде, Slack ID для напоминаний и язык сообщений. Изменения сохраняются сразу.</span></div>
      {ce && <div style={{ display: 'flex', gap: 8 }}><button onClick={preview} disabled={busy === 'prev'} style={btn(false)}>{busy === 'prev' ? 'Считаю…' : 'Напоминания за прошлую неделю'}</button><button onClick={() => setAdd({ name: '', title: '', email: '', slack_id: '', lang: 'ru' })} style={btn(true)}>+ Добавить участника</button></div>}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>{[['active', 'Активные'], ['inactive', 'Неактивные'], ['all', 'Все']].map(([v, l]) => <button key={v} onClick={() => setFlt(v)} style={chip(flt === v)}>{l} · {members.filter((m) => v === 'all' || (v === 'active' ? m.active !== false : m.active === false)).length}</button>)}</div>
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><div style={{ minWidth: 920 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '11px 18px', fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: `1px solid ${C.line}` }}><span>Имя</span><span>Должность</span><span>Email</span><span>Slack ID</span><span>Язык</span><span>Активен</span><span></span></div>
      {list.map((m) => { const st = !m.slack_id ? 'empty' : slackOk(m.slack_id) ? 'ok' : 'bad'; const on = m.active !== false
        return <div key={m.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 18px', alignItems: 'center', borderBottom: '1px solid #F3F4F6', background: on ? '#fff' : '#FAFAFB' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><Avatar name={m.name} size={30} /><input defaultValue={m.name} disabled={!ce} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== m.name && upd(m, { name: e.target.value.trim() })} aria-label="Имя" style={{ ...cell, fontWeight: 600, border: '1px solid transparent', background: 'transparent' }} /></span>
          <input defaultValue={m.title || m.role || ''} disabled={!ce} onBlur={(e) => e.target.value !== (m.title || m.role || '') && upd(m, { title: e.target.value })} placeholder="—" aria-label="Должность" style={cell} />
          <input defaultValue={m.email || ''} disabled={!ce} onBlur={(e) => e.target.value.trim() !== (m.email || '') && upd(m, { email: e.target.value.trim() })} placeholder="name@levhaolam.com" aria-label="Email" style={cell} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input defaultValue={m.slack_id || ''} disabled={!ce} onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (v !== (m.slack_id || '')) upd(m, { slack_id: v }) }} placeholder="U01ABC2DEF" aria-label="Slack ID" style={{ ...cell, fontFamily: 'ui-monospace, Consolas, monospace', borderColor: st === 'bad' ? '#F09A8A' : C.line2 }} />
            <span title={st === 'ok' ? 'Формат верный' : st === 'bad' ? 'Похоже на ошибку: ID начинается с U и содержит 9–11 символов' : 'Не указан — напоминания не придут'} style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: st === 'ok' ? '#DFF1D8' : st === 'bad' ? '#FDE3DE' : '#F1F3F5', color: st === 'ok' ? '#2C6B21' : st === 'bad' ? '#B42318' : C.ink4 }}>{st === 'ok' ? '✓' : st === 'bad' ? '!' : '—'}</span></span>
          <select value={m.lang || 'ru'} disabled={!ce} onChange={(e) => upd(m, { lang: e.target.value })} aria-label="Язык" style={{ ...cell, padding: '0 6px' }}><option value="ru">RU</option><option value="en">EN</option></select>
          <button role="switch" aria-checked={on} disabled={!ce} onClick={() => upd(m, { active: !on })} style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, cursor: ce ? 'pointer' : 'default', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? '#6DBB5A' : '#C9CED6' }}><span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} /></button>
          <button onClick={() => ping(m)} disabled={!ce || busy === 'ping' + m.id} title="Отправить тестовое сообщение в Slack" aria-label="Тест Slack" style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', fontSize: 15 }}>{busy === 'ping' + m.id ? '…' : '✉'}</button>
        </div> })}
    </div></div></div>
    <span style={{ fontSize: 12, color: C.ink4, lineHeight: 1.5 }}>Неактивные не получают напоминаний, но их проекты и отчёты остаются. Имя должно совпадать с именем владельца в проектах — по нему система понимает, чьи это проекты. Напоминания уходят по понедельникам в 12:00 по Израилю тем, у кого есть проекты без отчёта за прошлую неделю.</span>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink2, letterSpacing: '.06em', textTransform: 'uppercase' }}>Доступ к дашборду</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{allProfiles.map((p) => <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 999, padding: '4px 12px 4px 4px', fontSize: 13 }}><Avatar name={p.name || p.email} size={24} />{p.name || p.email}<span style={{ color: C.ink4 }}>· {p.role === 'admin' ? 'администратор' : p.role === 'editor' ? 'редактор' : 'просмотр'}</span></span>)}</div>
      <span style={{ fontSize: 12, color: C.ink4 }}>Роли доступа меняются в разделе «Администрирование».</span>
    </div>

    {add && <Modal title="Новый участник команды" width={560} onClose={() => setAdd(null)} footer={<><button onClick={() => setAdd(null)} style={btn(false)}>Отмена</button><button onClick={create} style={btn(true)}>Добавить</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={label}>Имя<input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Как в поле «владелец» проектов" style={input} autoFocus /></label>
        <label style={label}>Должность<input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} style={input} /></label>
        <label style={label}>Email<input value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} style={input} /></label>
        <label style={label}>Slack ID<input value={add.slack_id} onChange={(e) => setAdd({ ...add, slack_id: e.target.value.toUpperCase() })} placeholder="U01ABC2DEF" style={{ ...input, fontFamily: 'ui-monospace, Consolas, monospace' }} /></label>
        <label style={label}>Язык напоминаний<select value={add.lang} onChange={(e) => setAdd({ ...add, lang: e.target.value })} style={input}><option value="ru">Русский</option><option value="en">English</option></select></label>
      </div>
      <div style={{ background: '#F7F9FA', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>Как найти Slack ID: в Slack открой профиль человека → ⋮ (ещё) → «Copy member ID». Он начинается с U.</div>
    </Modal>}

    {prev && <Modal title={`Напоминания за неделю с ${prev.week}`} sub={prev.messages.length ? `Уйдёт ${prev.messages.length} чел.` : 'Все отчитались — напоминать некому'} width={640} onClose={() => setPrev(null)} footer={<><button onClick={() => setPrev(null)} style={btn(false)}>Закрыть</button>{prev.messages.length > 0 && <button onClick={sendNow} disabled={busy === 'send'} style={btn(true)}>{busy === 'send' ? 'Отправляю…' : 'Отправить сейчас'}</button>}</>}>
      {prev.stepsNote && <span style={{ fontSize: 12, color: '#B54708' }}>{prev.stepsNote}</span>}
      {prev.messages.map((m) => <div key={m.name} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}><Avatar name={m.name} size={22} />{m.name}{!m.slack_id && <span style={{ fontSize: 12, color: '#B42318', fontWeight: 500 }}>нет Slack ID — не дойдёт</span>}</span>
        <span style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: C.ink2, lineHeight: 1.5 }}>{m.text}</span>
      </div>)}
    </Modal>}
  </div>
}

export default TeamPage
