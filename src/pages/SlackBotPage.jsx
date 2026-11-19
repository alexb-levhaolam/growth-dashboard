import { useState } from 'react'
import { S, Label } from '../lib/ui'

// ═══ SLACK BOT PAGE ═══
function SlackBotPage({weekStart}){
  const[preMsg,setPreMsg]=useState('Ребята, через 5 минут вам напишет бот с просьбой обновить статусы по проектам. Пожалуйста, ответьте ему.')
  const[sending,setSending]=useState(false)
  const sendWithDelay=async()=>{if(!confirm('Отправить предупреждение в чат, потом через 5 мин запустить бот?'))return;setSending(true);try{await fetch('/api/slack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'pre_message',text:preMsg})});setTimeout(async()=>{const r=await fetch('/api/slack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'manual_trigger',week_start:weekStart})});const d=await r.json();alert(d.message||'Бот запущен!');setSending(false)},5*60*1000);alert('Предупреждение отправлено. Бот запустится через 5 минут.')}catch(e){alert('Ошибка: '+e.message);setSending(false)}}
  return<>
    <div style={{display:'flex',gap:10,marginBottom:22,flexWrap:'wrap'}}>
      <button onClick={sendWithDelay} disabled={sending} style={{padding:'10px 18px',borderRadius:8,border:'none',background:S.gm,color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',opacity:sending?.5:1}}>{sending?'Ожидание...':'Предупредить + Запустить (5 мин)'}</button>
      <button onClick={async()=>{const r=await fetch('/api/slack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'manual_trigger',week_start:weekStart})});const d=await r.json();alert(d.message||'Отправлено')}} style={{padding:'10px 18px',borderRadius:8,border:`1px solid ${S.ln}`,background:S.sf,color:S.ink,fontSize:14,fontWeight:500,cursor:'pointer'}}>Запустить сразу</button>
    </div>
    <Label>Предупреждение команде</Label>
    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16,marginBottom:22}}>
      <textarea value={preMsg} onChange={e=>setPreMsg(e.target.value)} rows={3} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,resize:'vertical',fontFamily:'inherit',color:'#121416'}}/>
      <div style={{fontSize:12,color:S.i3,marginTop:6}}>Это сообщение отправится в канал маркетинга перед запуском бота</div>
    </div>
    <Label>Настройки</Label>
    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22}}>
      <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:10,fontSize:14}}>
        <span style={{color:S.i3,fontWeight:600}}>Пропуск статусов:</span><span>готово, ожидание</span>
        <span style={{color:S.i3,fontWeight:600}}>Язык бота:</span><span>English</span>
        <span style={{color:S.i3,fontWeight:600}}>Ответы команды:</span><span>любой язык</span>
        <span style={{color:S.i3,fontWeight:600}}>Задержка:</span><span>5 минут после предупреждения</span>
      </div>
    </div>
  </>
}

export default SlackBotPage
