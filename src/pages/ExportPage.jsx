import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { S } from '../lib/ui'

// ═══ EXPORT PAGE ═══
function ExportPage({weekStart}){
  const[log,setLog]=useState([]);const[loading,setLoading]=useState(false)
  const[day,setDay]=useState(2);const[time,setTime]=useState('17:00')
  const days=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']

  useEffect(()=>{(async()=>{const{data}=await supabase.from('export_log').select('*').eq('type','tactical').order('exported_at',{ascending:false}).limit(10);if(data)setLog(data)})()},[])

  const doExport=async()=>{setLoading(true);try{const r=await fetch('/api/export-tactical',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week_start:weekStart})});const d=await r.json();if(d.error)alert('Ошибка: '+d.error);else{alert(d.message);const{data}=await supabase.from('export_log').select('*').eq('type','tactical').order('exported_at',{ascending:false}).limit(10);if(data)setLog(data)}}catch(e){alert('Ошибка: '+e.message)}finally{setLoading(false)}}

  return<>
    <h1 style={{fontSize:24,fontWeight:600,marginBottom:22}}>Выгрузка тактических задач</h1>

    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22,marginBottom:22}}>
      <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:14}}>Ручная выгрузка</div>
      <div style={{fontSize:14,color:S.i2,marginBottom:14}}>Выгружает тактические задачи за текущую неделю ({weekStart}) в <a href="https://docs.google.com/spreadsheets/d/1-H5ogBGHhJsYorfYIZ_yIywoGHTXxk_yEepIq6etij8" target="_blank" style={{color:S.gd}}>Google Sheet</a></div>
      <button onClick={doExport} disabled={loading} style={{padding:'10px 22px',borderRadius:8,border:'none',background:S.gm,color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',opacity:loading?.5:1}}>{loading?'Выгрузка...':'Выгрузить сейчас'}</button>
    </div>

    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22,marginBottom:22}}>
      <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:14}}>Автоматическая выгрузка</div>
      <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:12,fontSize:14,alignItems:'center'}}>
        <span style={{color:S.i3,fontWeight:600}}>День недели:</span>
        <select value={day} onChange={e=>setDay(Number(e.target.value))} style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,width:200}}>
          {days.map((d,i)=><option key={i} value={i}>{d}</option>)}
        </select>
        <span style={{color:S.i3,fontWeight:600}}>Время:</span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14}}/>
          <span style={{fontSize:13,color:S.i3}}>по Израилю (Asia/Jerusalem)</span>
        </div>
      </div>
      <div style={{marginTop:12,padding:'10px 14px',background:'#F7F8F9',borderRadius:8,fontSize:13,color:S.i3}}>По умолчанию: вторник, 17:00 по Израилю. Выгружает данные за прошлую неделю.</div>
    </div>

    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22}}>
      <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:14}}>История выгрузок</div>
      {log.length===0&&<div style={{fontSize:14,color:S.i3}}>Нет выгрузок</div>}
      {log.map(l=><div key={l.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #E4E6E9',fontSize:14}}>
        <span><b>{l.week_start}</b></span>
        <span style={{color:S.i3}}>{new Date(l.exported_at).toLocaleString('ru')}</span>
      </div>)}
    </div>
  </>
}

export default ExportPage
