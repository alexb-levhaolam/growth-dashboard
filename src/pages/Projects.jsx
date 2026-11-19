import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { weekEnd, S, PROJ_ST, Chip, Label, Linkify, Ed, EdDate, CItem, PROJ_CATS, catOf } from '../lib/ui'

// ═══ PROJECTS ═══
function Projects({projects,setProjects,comments,setComments,ce,reports,aIdx,profile,reload,rep:currentRep,upRep}){
  const[exp,setExp]=useState(null);const ncRef=useRef('');const[sav,setSav]=useState(false)
  const[fPri,setFPri]=useState('all');const[fSt,setFSt]=useState('all')
  const[showNewP,setShowNewP]=useState(false);const[np,setNp]=useState({id:'',name:'',owner:'',priority:'current'})
  const[surveying,setSurveying]=useState(false)
  const sendSurvey=async()=>{setSurveying(true);try{const ws=rep?.week_start||'';const wl=rep?.week_label||'';const r=await fetch(`/api/slack?action=send&weekStart=${ws}&weekLabel=${encodeURIComponent(wl)}`);const d=await r.json();if(d.ok){const sent=d.results?.filter(r=>r.sent).length||0;alert(`Опрос отправлен ${sent} сотрудникам за ${d.week}`)}else{alert('Ошибка: '+(d.error||'unknown'))}}catch(e){alert('Ошибка: '+e.message)}finally{setSurveying(false)}}
  const rep=reports[aIdx];const ws=rep?.week_start
  const upProj=async(id,f,v)=>{setProjects(prev=>prev.map(p=>p.id===id?{...p,[f]:v}:p));const{error}=await supabase.from('projects').update({[f]:v}).eq('id',id);if(error)alert('Ошибка сохранения: '+error.message)}
  const delProj=async(id,name)=>{if(!confirm(`Удалить проект "${name}"?`))return;setProjects(prev=>prev.filter(p=>p.id!==id));supabase.from('project_comments').delete().eq('project_id',id);supabase.from('projects').delete().eq('id',id)}
  const addProj=async()=>{if(!np.id.trim()||!np.name.trim())return;const maxSort=Math.max(0,...projects.map(p=>p.sort_order||0))+1;const obj={id:np.id.trim(),name:np.name.trim(),owner:np.owner.trim()||'—',priority:np.priority,status:'wait',sort_order:maxSort};setProjects(prev=>[...prev,obj]);setNp({id:'',name:'',owner:'',priority:'current'});setShowNewP(false);const{error}=await supabase.from('projects').insert(obj);if(error)alert('Ошибка: '+error.message)}
  const addC=async pid=>{const nc=ncRef.current;if(!nc.trim())return;setSav(true);const sum=nc.length>150?nc.slice(0,120).replace(/\s\S*$/,'')+'…':nc;const obj={project_id:pid,author:profile.name||profile.email,full_text:nc,summary:sum,week_start:ws||new Date().toISOString().slice(0,10)};const{data,error}=await supabase.from('project_comments').insert(obj).select().single();if(error){alert('Ошибка сохранения: '+error.message);setSav(false);return}setComments(prev=>[data,...prev]);ncRef.current='';const el=document.getElementById('nc-'+pid);if(el)el.value='';setSav(false)}
  const delC=async(cid)=>{if(!confirm('Удалить комментарий?'))return;const{error}=await supabase.from('project_comments').delete().eq('id',cid);if(error){alert('Ошибка удаления: '+error.message);return}setComments(prev=>prev.filter(c=>c.id!==cid))}
  const getWC=pid=>comments.filter(c=>c.project_id===pid&&c.week_start===ws)
  const getPrev=pid=>{const s=comments.filter(c=>c.project_id===pid&&c.week_start<ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return s[0]||null}
  const sortP=(arr)=>[...arr].sort((a,b)=>{if(a.status==='blocked'&&b.status!=='blocked')return -1;if(b.status==='blocked'&&a.status!=='blocked')return 1;return(a.sort_order||0)-(b.sort_order||0)})
  const setConstraints=async(pid,v)=>{setProjects(prev=>prev.map(p=>p.id===pid?{...p,constraints_text:v}:p));await supabase.from('projects').update({constraints_text:v}).eq('id',pid);const proj=projects.find(p=>p.id===pid);if(v&&v.trim()&&proj?.status!=='blocked'){if(confirm('Поставить статус "блокер"?')){setProjects(prev=>prev.map(p=>p.id===pid?{...p,status:'blocked'}:p));supabase.from('projects').update({status:'blocked'}).eq('id',pid)}}else if((!v||!v.trim())&&proj?.status==='blocked'){if(confirm('Снять статус "блокер"?')){setProjects(prev=>prev.map(p=>p.id===pid?{...p,status:'progress'}:p));supabase.from('projects').update({status:'progress'}).eq('id',pid)}}}
  const fmtDate=(d)=>{if(!d)return null;const p=d.split('-');return`${p[2]}.${p[1]}`}
  const dates=(p)=>[p.date_start&&`с ${fmtDate(p.date_start)}`,p.date_test&&`тест ${fmtDate(p.date_test)}`,p.date_done&&` ${fmtDate(p.date_done)}`].filter(Boolean).join(' · ')
  // Separate active vs archive (done)
  const active=projects.filter(p=>p.status!=='done')
  const archive=projects.filter(p=>p.status==='done')
  let filtered=active
  if(fPri==='key')filtered=filtered.filter(p=>p.priority==='key')
  if(fPri==='current')filtered=filtered.filter(p=>p.priority==='current')
  if(fSt!=='all')filtered=filtered.filter(p=>p.status===fSt)
  const keyP=sortP(filtered.filter(p=>p.priority==='key'));const curP=sortP(filtered.filter(p=>p.priority==='current'))
  const secs=fPri==='all'?[{t:' Ключевые',items:keyP},{t:' Текущие',items:curP}]:fPri==='key'?[{t:' Ключевые',items:keyP}]:[{t:' Текущие',items:curP}]

  const ProjCard=({p})=>{const ps=PROJ_ST[p.status]||PROJ_ST.wait;const wcs=getWC(p.id);const prev=getPrev(p.id);const isO=exp===p.id;const isBlocked=p.status==='blocked';const hasBlock=p.constraints_text&&p.constraints_text.trim();const ds=dates(p);const lastC=wcs[0]||prev
    return<div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'16px 20px',marginBottom:12,borderLeft:isBlocked?'3px solid #DD2A02':'none',borderRadius:isBlocked?'0 14px 14px 0':14}}>
      {/* 1. Название / код / исполнитель / статус */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,cursor:'pointer'}} onClick={()=>setExp(isO?null:p.id)}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}><Ed value={p.name} canEdit={ce} onSave={v=>upProj(p.id,'name',v)} style={{fontWeight:600,fontSize:16}}/><span style={{fontSize:13,color:S.i3}}>{p.id}</span><span style={{fontSize:13,color:S.i3}}>·</span><span onClick={e=>e.stopPropagation()}><Ed value={p.owner} canEdit={ce} onSave={v=>upProj(p.id,'owner',v)} style={{fontSize:13,color:S.i3}} ph="Владелец"/></span></div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>{ce?<><select value={p.status} onClick={e=>e.stopPropagation()} onChange={e=>upProj(p.id,'status',e.target.value)} style={{fontSize:13,padding:'4px 8px',borderRadius:8,border:`1px solid ${S.ln}`,background:ps.bg,color:ps.tx,cursor:'pointer'}}>{Object.entries(PROJ_ST).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select><select value={catOf(p)} onClick={e=>e.stopPropagation()} onChange={e=>upProj(p.id,'category',e.target.value)} style={{fontSize:12,padding:'3px 6px',borderRadius:6,border:`1px solid ${S.ln}`,cursor:'pointer'}}>{PROJ_CATS.map(c2=><option key={c2.v} value={c2.v}>{c2.l}</option>)}</select></>:<Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip>}{ce&&<button onClick={e=>{e.stopPropagation();delProj(p.id,p.name)}} style={{fontSize:14,background:'none',border:'none',cursor:'pointer',color:'#C4C8CD'}}>✕</button>}<span style={{color:S.i3,fontSize:12}}>{isO?'▲':'▼'}</span></div>
      {/* Checkbox moved inside expanded */}
      </div>

      {/* 2. Описание задачи (always visible) */}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:10}}><div style={{fontSize:13,color:S.i3,marginBottom:4}}>Описание</div><Ed value={p.last_update||''} canEdit={ce} multi onSave={v=>upProj(p.id,'last_update',v)} ph="Что делаем и для чего..." style={{fontSize:14,color:S.i2,lineHeight:1.5}}/></div>}
      {!isO&&p.last_update&&<div style={{fontSize:14,color:S.i2,marginTop:6}}>{p.last_update.slice(0,80)}{p.last_update.length>80?'…':''}</div>}

      {/* 3. Ключевые даты (expanded) */}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12}}><div style={{fontSize:13,color:S.i3,marginBottom:6}}>Ключевые даты</div><div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>{[{l:'Начало',f:'date_start'},{l:'Тест',f:'date_test'},{l:'Результаты',f:'date_results'},{l:'Завершение',f:'date_done'}].map(d=><div key={d.f}><span style={{fontSize:12,color:S.i3,display:'block',marginBottom:2}}>{d.l}</span><EdDate value={p[d.f]} canEdit={ce} onSave={v=>upProj(p.id,d.f,v)}/></div>)}</div></div>}
      {!isO&&ds&&<div style={{fontSize:13,color:S.i3,marginTop:4}}>{ds}</div>}

      {/* 4. Последний комментарий (collapsed: 3 lines, expanded: full) */}
      {!isO&&lastC&&<div style={{borderTop:`1px solid ${S.ln}`,marginTop:8,paddingTop:8}}>
        <div style={{fontSize:12,color:S.i3,marginBottom:2}}>{lastC.author} · {weekEnd(lastC.week_start)}</div>
        <div style={{fontSize:14,color:S.i2,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{lastC.full_text||lastC.summary}</div>
      </div>}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12}}>
        <div style={{fontSize:13,color:S.i3,marginBottom:6}}>Комментарии</div>
        {wcs.map(c=><CItem key={c.id} c={c} ce={ce} reload={reload} onDel={()=>delC(c.id)}/>)}
        {wcs.length===0&&prev&&<div style={{padding:'8px 12px',background:'#FFF9E6',borderRadius:8,border:'1px dashed #EAD89B'}}><div style={{fontSize:13,color:'#B76400'}}>{prev.week_start} ({prev.author})</div><div style={{fontSize:14,color:S.i3,whiteSpace:'pre-wrap'}}><Linkify>{prev.full_text||prev.summary}</Linkify></div></div>}
      </div>}

      {/* 5. Ограничения (expanded) */}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:10}}><div style={{fontSize:13,color:hasBlock?'#A71F00':S.i3,marginBottom:4}}>Ограничения {hasBlock?'✓':'—'}</div><Ed value={p.constraints_text||''} canEdit={ce} multi onSave={v=>setConstraints(p.id,v)} ph="Нет ограничений" style={{fontSize:14,color:hasBlock?'#A71F00':S.i3,background:hasBlock?'#FFEEEA':'transparent',padding:hasBlock?'6px 10px':0,borderRadius:8}}/></div>}
      {!isO&&hasBlock&&<div style={{fontSize:13,color:'#A71F00',marginTop:4}}>{p.constraints_text.slice(0,60)}{p.constraints_text.length>60?'…':''}</div>}

      {/* Показывать в обзоре */}
      {isO&&ce&&currentRep&&<label onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:6,marginTop:10,cursor:'pointer',fontSize:13,color:S.i3,paddingTop:8,borderTop:`1px solid ${S.ln}`}}><input type="checkbox" checked={(currentRep.visible_overview_projects||[]).includes(p.id)} onChange={()=>{const vis=currentRep.visible_overview_projects||[];const next=vis.includes(p.id)?vis.filter(id=>id!==p.id):[...vis,p.id];upRep({visible_overview_projects:next})}}/> показывать в обзоре</label>}
      {/* 6. Новый комментарий (expanded) */}
      {isO&&ce&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12,borderTop:`1px solid ${S.ln}`,paddingTop:10}}>
        <div style={{display:'flex',gap:8}}><textarea id={"nc-"+p.id} defaultValue="" onChange={e=>{ncRef.current=e.target.value}} placeholder={`Комментарий за ${rep?.week_label||''}...`} rows={2} style={{flex:1,padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,resize:'vertical',outline:'none',fontFamily:'inherit',color:'#121416',background:'#fff'}}/><button onClick={()=>addC(p.id)} disabled={sav} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#497B02',color:'#fff',fontSize:16,fontWeight:600,cursor:'pointer',alignSelf:'flex-end'}}>{sav?'...':'→'}</button></div>
      </div>}
    </div>}

  return<>
    <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
      <div style={{fontSize:14,color:S.i3,marginRight:4}}>Фильтр:</div>
      {[{k:'all',l:'Все'},{k:'key',l:'Ключевые'},{k:'current',l:'Текущие'}].map(f=><button key={f.k} onClick={()=>setFPri(f.k)} style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:500,background:fPri===f.k?S.gd:'#F1EFE8',color:fPri===f.k?S.gp:S.i2}}>{f.l}</button>)}
      <span style={{color:S.ln}}>|</span>
      {[{k:'all',l:'Все статусы'},...Object.entries(PROJ_ST).filter(([k])=>k!=='done').map(([k,v])=>({k,l:v.l}))].map(f=><button key={f.k} onClick={()=>setFSt(f.k)} style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:500,background:fSt===f.k?S.gd:'#F1EFE8',color:fSt===f.k?S.gp:S.i2}}>{f.l}</button>)}
      <span style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}><span style={{fontSize:14,color:S.i3}}>{filtered.length} из {active.length}</span>{ce&&<button onClick={sendSurvey} disabled={surveying} style={{fontSize:14,color:'#fff',background:'#6E9B0E',border:'none',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontWeight:500}} title="Запустить бота для сбора апдейтов">{surveying?'...':'Опросить команду'} ⓘ</button>}{ce&&<button onClick={()=>setShowNewP(!showNewP)} style={{fontSize:14,color:S.gd,background:S.gp,border:'none',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontWeight:500}}>{showNewP?'Закрыть':'+ проект'}</button>}</span>
    </div>
    {showNewP&&<div style={{background:S.sf,border:`1px solid ${S.gl}`,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:12}}>Новый проект</div>
      <div style={{display:'grid',gridTemplateColumns:'100px 1fr 120px 120px',gap:8,marginBottom:12}}>
        <input value={np.id} onChange={e=>setNp({...np,id:e.target.value})} placeholder="ID (ST01)" style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none'}}/>
        <input value={np.name} onChange={e=>setNp({...np,name:e.target.value})} placeholder="Название проекта" style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none'}}/>
        <input value={np.owner} onChange={e=>setNp({...np,owner:e.target.value})} placeholder="Владелец" style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none'}}/>
        <select value={np.priority} onChange={e=>setNp({...np,priority:e.target.value})} style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14}}><option value="key"> Ключевой</option><option value="current"> Текущий</option></select>
      </div>
      <button onClick={addProj} disabled={!np.id.trim()||!np.name.trim()} style={{padding:'10px 18px',borderRadius:8,border:'none',background:'#497B02',color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer'}}>Создать</button>
    </div>}
    <div style={{fontSize:14,color:S.i3,marginBottom:12,padding:'8px 12px',background:S.sf,borderRadius:8,border:`1px solid ${S.ln}`}}> <b>{rep?.week_label||'—'}</b></div>
    {secs.map(s=><div key={s.t}><Label>{s.t} ({s.items.length})</Label><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
      {s.items.map(p=><ProjCard key={p.id} p={p}/>)}</div></div>)}
    {archive.length>0&&<><div style={{marginTop:24,borderTop:`2px solid ${S.ln}`,paddingTop:16}}><Label> Архив · готово ({archive.length})</Label></div><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20,opacity:0.75}}>
      {archive.map(p=><ProjCard key={p.id} p={p}/>)}</div></>}
  </>
}

export default Projects
