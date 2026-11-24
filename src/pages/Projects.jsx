import { useState, useRef, useLayoutEffect, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { weekEnd, S, PROJ_ST, Chip, Label, Linkify, Ed, EdDate, CItem, PROJ_CATS, catOf, chipStyle, pillSelect } from '../lib/ui'

// ═══ PROJECTS ═══
function Projects({projects,setProjects,comments,setComments,ce,reports,aIdx,profile,reload,rep:currentRep,upRep}){
  const[exp,setExp0]=useState(null)
  // при раскрытии/сворачивании карточка остаётся на том же месте экрана
  const anchor=useRef(null)
  const setExp=(id)=>{const key=id??exp;const el=key?document.querySelector(`[data-pid="${key}"]`):null;anchor.current=el?{id:key,top:el.getBoundingClientRect().top}:null;setExp0(id)}
  useLayoutEffect(()=>{const a=anchor.current;if(!a)return;anchor.current=null;const el=document.querySelector(`[data-pid="${a.id}"]`);if(el){const d=el.getBoundingClientRect().top-a.top;if(Math.abs(d)>1)window.scrollBy(0,d)}},[exp]);const ncRef=useRef('');const[sav,setSav]=useState(false)
  const[fPri,setFPri]=useState('all');const[fSt,setFSt]=useState('all')
  const[showNewP,setShowNewP]=useState(false);const[np,setNp]=useState({id:'',name:'',owner:'',priority:'current'})
  const[surveying,setSurveying]=useState(false)
  const[syncing,setSyncing]=useState(false);const[syncMsg,setSyncMsg]=useState('')
  const syncWorkshop=async(silent)=>{setSyncing(true);try{const{data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/workshop?action=refresh',{method:'POST',headers:{Authorization:'Bearer '+(session?.access_token||'')}});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'Ошибка');try{localStorage.setItem('lh_ws_sync',String(Date.now()))}catch(e){}const parts=[d.created?.length&&`новых проектов: ${d.created.length}`,d.linked?.length&&`связано с 2026: ${d.linked.length}`,d.toProgress?.length&&`переведено «в работе»: ${d.toProgress.length}`,`комментариев недель: ${d.comments}`].filter(Boolean);setSyncMsg('Workshop синхронизирован · '+parts.join(' · '));await reload()}catch(e){if(!silent)alert('Синхронизация не удалась: '+e.message);setSyncMsg('Синхронизация не удалась: '+e.message)}finally{setSyncing(false)}}
  const sendSurvey=async()=>{setSurveying(true);try{const ws=rep?.week_start||'';const wl=rep?.week_label||'';const r=await fetch(`/api/slack?action=send&weekStart=${ws}&weekLabel=${encodeURIComponent(wl)}`);const d=await r.json();if(d.ok){const sent=d.results?.filter(r=>r.sent).length||0;alert(`Опрос отправлен ${sent} сотрудникам за ${d.week}`)}else{alert('Ошибка: '+(d.error||'unknown'))}}catch(e){alert('Ошибка: '+e.message)}finally{setSurveying(false)}}
  const rep=reports[aIdx];const ws=rep?.week_start
  const SYNCED=['name','owner','category','last_update','date_start','date_done','expected_sales','status']
  const FLBL={name:'название',owner:'владелец',category:'категория',last_update:'описание',date_start:'дата начала',date_done:'дата завершения',expected_sales:'ожидаемые продажи',status:'статус'}
  const upProj=async(id,f,v)=>{const cur=projects.find(p=>p.id===id);const patch={[f]:v};if(cur?.workshop_id&&SYNCED.includes(f))patch.manual_fields=[...new Set([...(cur.manual_fields||[]),f])];setProjects(prev=>prev.map(p=>p.id===id?{...p,...patch}:p));const{error}=await supabase.from('projects').update(patch).eq('id',id);if(error)alert('Ошибка сохранения: '+error.message)}
  const resetManual=async(p)=>{if(!confirm('Вернуть значения из таблицы Workshop? Ручные правки этих полей будут перезаписаны.'))return;await supabase.from('projects').update({manual_fields:[]}).eq('id',p.id);await syncWorkshop(false)}
  const archiveProj=async(p)=>{if(!confirm(`Убрать «${p.name}» в архив? Проект и вся его история сохранятся, вернуть можно в разделе «Архив проектов».`))return;setProjects(prev=>prev.filter(x=>x.id!==p.id));const{error}=await supabase.from('projects').update({archived_at:new Date().toISOString(),archive_reason:'archived'}).eq('id',p.id);if(error)alert('Ошибка: '+error.message);reload()}
  const mergeInto=async(src,dst)=>{if(!confirm(`Подтянуть историю «${src.name}» (${src.id}) в «${dst.name}» (${dst.id})?\n\nВсе комментарии старого проекта появятся в карточке нового. Старый проект уйдёт в «Архив проектов → Объединённые», его можно разъединить обратно.`))return;setProjects(prev=>prev.filter(x=>x.id!==src.id));const{error}=await supabase.from('projects').update({merged_into:dst.id,archived_at:new Date().toISOString(),archive_reason:'merged'}).eq('id',src.id);if(error)alert('Ошибка: '+error.message);reload()}
  const delProj=async(id,name)=>{if(!confirm(`Удалить проект "${name}"?`))return;setProjects(prev=>prev.filter(p=>p.id!==id));supabase.from('project_comments').delete().eq('project_id',id);supabase.from('projects').delete().eq('id',id)}
  const addProj=async()=>{if(!np.id.trim()||!np.name.trim())return;const maxSort=Math.max(0,...projects.map(p=>p.sort_order||0))+1;const obj={id:np.id.trim(),name:np.name.trim(),owner:np.owner.trim()||'—',priority:np.priority,status:'wait',sort_order:maxSort};setProjects(prev=>[...prev,obj]);setNp({id:'',name:'',owner:'',priority:'current'});setShowNewP(false);const{error}=await supabase.from('projects').insert(obj);if(error)alert('Ошибка: '+error.message)}
  const addC=async pid=>{const nc=ncRef.current;if(!nc.trim())return;setSav(true);const sum=nc.length>150?nc.slice(0,120).replace(/\s\S*$/,'')+'…':nc;const obj={project_id:pid,author:profile.name||profile.email,full_text:nc,summary:sum,week_start:ws||new Date().toISOString().slice(0,10)};const{data,error}=await supabase.from('project_comments').insert(obj).select().single();if(error){alert('Ошибка сохранения: '+error.message);setSav(false);return}setComments(prev=>[data,...prev]);ncRef.current='';const el=document.getElementById('nc-'+pid);if(el)el.value='';setSav(false)}
  const delC=async(cid,fromSheet)=>{if(!confirm(fromSheet?'Скрыть комментарий из таблицы? Синхронизация его больше не вернёт.':'Удалить комментарий?'))return;const{error}=fromSheet?await supabase.from('project_comments').update({hidden:true,manual:true}).eq('id',cid):await supabase.from('project_comments').delete().eq('id',cid);if(error){alert('Ошибка удаления: '+error.message);return}setComments(prev=>prev.filter(c=>c.id!==cid))}
  const getWC=pid=>comments.filter(c=>c.project_id===pid&&c.week_start===ws)
  const getPrev=pid=>{const s=comments.filter(c=>c.project_id===pid&&c.week_start<ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return s[0]||null}
  const sortP=(arr)=>[...arr].sort((a,b)=>{if(a.status==='blocked'&&b.status!=='blocked')return -1;if(b.status==='blocked'&&a.status!=='blocked')return 1;return(a.sort_order||0)-(b.sort_order||0)})
  const setConstraints=async(pid,v)=>{setProjects(prev=>prev.map(p=>p.id===pid?{...p,constraints_text:v}:p));await supabase.from('projects').update({constraints_text:v}).eq('id',pid);const proj=projects.find(p=>p.id===pid);if(v&&v.trim()&&proj?.status!=='blocked'){if(confirm('Поставить статус "блокер"?')){upProj(pid,'status','blocked')}}else if((!v||!v.trim())&&proj?.status==='blocked'){if(confirm('Снять статус "блокер"?')){upProj(pid,'status','progress')}}}
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
    return<div data-pid={p.id} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'18px 20px',borderLeft:isBlocked?'3px solid #DD2A02':'3px solid transparent'}}>
      {/* 1. Название, мета-строка, статус */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,cursor:'pointer'}} onClick={()=>setExp(isO?null:p.id)}>
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:4}}>
          <span onClick={e=>{if(ce)e.stopPropagation()}}><Ed value={p.name} canEdit={ce} onSave={v=>upProj(p.id,'name',v)} style={{fontWeight:600,fontSize:16,lineHeight:1.35}}/></span>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',fontSize:13,color:S.i3}}>
            <span>{p.id}</span><span>·</span>
            <span onClick={e=>e.stopPropagation()}><Ed value={p.owner} canEdit={ce} onSave={v=>upProj(p.id,'owner',v)} style={{fontSize:13,color:S.i3}} ph="Владелец"/></span>
            {p.workshop_id&&p.workshop_id!==p.id&&<><span>·</span><span>{p.workshop_id}</span></>}{ds&&!isO&&<><span>·</span><span>{ds}</span></>}{p.expected_sales>0&&<><span>·</span><span style={{color:'#3B6402',fontWeight:500}}>+{p.expected_sales} продаж/мес</span></>}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}} onClick={e=>e.stopPropagation()}>
          {ce?<select value={p.status} onChange={e=>upProj(p.id,'status',e.target.value)} aria-label="Статус" style={pillSelect(ps.bg,ps.tx)}>{Object.entries(PROJ_ST).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select>:<Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip>}
          {ce?<select value={catOf(p)} onChange={e=>upProj(p.id,'category',e.target.value)} aria-label="Категория" style={pillSelect('#F1F2F4','#585E65')}>{PROJ_CATS.map(c2=><option key={c2.v} value={c2.v}>{c2.l}</option>)}</select>:<span style={{fontSize:13,color:S.i3}}>{(PROJ_CATS.find(c2=>c2.v===catOf(p))||{}).l}</span>}
          <button onClick={()=>setExp(isO?null:p.id)} aria-label={isO?'Свернуть':'Развернуть'} style={{width:30,height:30,borderRadius:8,border:`1px solid ${S.ln}`,background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#585E65" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:isO?'rotate(180deg)':'none',transition:'transform .15s'}}><path d="M6 9l6 6 6-6"/></svg></button>
        </div>
      </div>

      {/* 2. Описание задачи (always visible) */}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:10}}><div style={{fontSize:13,color:S.i3,marginBottom:4}}>Описание</div><Ed value={p.last_update||''} canEdit={ce} multi onSave={v=>upProj(p.id,'last_update',v)} ph="Что делаем и для чего..." style={{fontSize:14,color:S.i2,lineHeight:1.5}}/></div>}
      {!isO&&p.last_update&&<div style={{fontSize:14,color:S.i2,marginTop:8,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.last_update}</div>}

      {isO&&(p.workshop_subs||[]).length>0&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12}}><div style={{fontSize:13,color:S.i3,marginBottom:6}}>Подпроекты Workshop · {p.workshop_subs.length}</div><div style={{display:'flex',flexDirection:'column',gap:2}}>{p.workshop_subs.map(s=><div key={s.id} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,padding:'6px 10px',background:S.bg,borderRadius:8}}><span><span style={{color:S.i3}}>{s.id}</span> {s.name}<span style={{color:S.i3}}>{s.owner?' · '+s.owner:''}</span></span><span style={{color:'#3B6402',fontWeight:500,flexShrink:0}}>{s.exp?'+'+s.exp:''}</span></div>)}</div></div>}
      {isO&&p.workshop_id&&(p.manual_fields||[]).length>0&&<div onClick={e=>e.stopPropagation()} style={{marginTop:10,fontSize:12,color:S.i2,background:'#FFF6E8',borderRadius:8,padding:'7px 10px',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>Изменено в дашборде, таблица это не перезапишет: {p.manual_fields.map(f=>FLBL[f]||f).join(', ')}{ce&&<button onClick={()=>resetManual(p)} style={{fontSize:12,color:'#1761CB',background:'none',border:'none',cursor:'pointer',padding:0}}>вернуть из таблицы</button>}</div>}
      {/* 3. Ключевые даты (expanded) */}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12}}><div style={{fontSize:13,color:S.i3,marginBottom:6}}>Ключевые даты</div><div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>{[{l:'Начало',f:'date_start'},{l:'Тест',f:'date_test'},{l:'Результаты',f:'date_results'},{l:'Завершение',f:'date_done'}].map(d=><div key={d.f}><span style={{fontSize:12,color:S.i3,display:'block',marginBottom:2}}>{d.l}</span><EdDate value={p[d.f]} canEdit={ce} onSave={v=>upProj(p.id,d.f,v)}/></div>)}</div></div>}
      
      {/* 4. Последний комментарий (collapsed: 3 lines, expanded: full) */}
      {!isO&&lastC&&<div style={{background:wcs[0]?'#F7FBEA':S.bg,borderRadius:10,marginTop:10,padding:'10px 12px'}}>
        <div style={{fontSize:12,color:S.i3,marginBottom:3}}><b style={{fontWeight:600,color:S.i2}}>{lastC.author}</b> · {weekEnd(lastC.week_start)}{!wcs[0]&&' · прошлая неделя'}</div>
        <div style={{fontSize:14,color:S.ink,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden',whiteSpace:'pre-wrap'}}><Linkify>{lastC.full_text||lastC.summary}</Linkify></div>
      </div>}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12}}>
        <div style={{fontSize:13,color:S.i3,marginBottom:6}}>Комментарии</div>
        {wcs.map(c=><CItem key={c.id} c={c} ce={ce} reload={reload} onDel={()=>delC(c.id,c.source==='sheet')}/>)}
        {wcs.length===0&&prev&&<div style={{padding:'10px 12px',background:S.bg,borderRadius:10}}><div style={{fontSize:12,color:S.i3,marginBottom:3}}>Прошлая неделя · <b style={{fontWeight:600,color:S.i2}}>{prev.author}</b> · {weekEnd(prev.week_start)}</div><div style={{fontSize:14,color:S.i2,whiteSpace:'pre-wrap',lineHeight:1.5}}><Linkify>{prev.full_text||prev.summary}</Linkify></div></div>}
        {wcs.length===0&&!prev&&<div style={{fontSize:13,color:S.i3}}>Комментариев пока нет.</div>}
      </div>}

      {/* 5. Ограничения (expanded) */}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:10}}><div style={{fontSize:13,color:hasBlock?'#A71F00':S.i3,marginBottom:4}}>Ограничения {hasBlock?'✓':'—'}</div><Ed value={p.constraints_text||''} canEdit={ce} multi onSave={v=>setConstraints(p.id,v)} ph="Нет ограничений" style={{fontSize:14,color:hasBlock?'#A71F00':S.i3,background:hasBlock?'#FFEEEA':'transparent',padding:hasBlock?'6px 10px':0,borderRadius:8}}/></div>}
      {!isO&&hasBlock&&<div style={{fontSize:13,color:'#A71F00',marginTop:4}}>{p.constraints_text.slice(0,60)}{p.constraints_text.length>60?'…':''}</div>}

      {isO&&ce&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${S.ln}`,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'}}>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:S.i2}}>Подтянуть историю из старого проекта:
          <select value="" onChange={e=>{const src=projects.find(x=>x.id===e.target.value);if(src)mergeInto(src,p)}} style={{height:32,maxWidth:320,border:`1px solid ${S.ln}`,borderRadius:8,padding:'0 8px',fontSize:13,background:'#fff',fontFamily:'inherit'}}><option value="">выбрать проект…</option>{projects.filter(x=>x.id!==p.id).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(x=><option key={x.id} value={x.id}>{x.name} · {x.id}</option>)}</select>
        </label>
        <button onClick={()=>archiveProj(p)} style={{fontSize:13,color:S.i2,background:'#fff',border:`1px solid ${S.ln}`,borderRadius:999,padding:'6px 14px',cursor:'pointer'}}>В архив</button>
      </div>}
      {/* Показывать в обзоре */}
      {isO&&ce&&currentRep&&<label onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:6,marginTop:10,cursor:'pointer',fontSize:13,color:S.i3,paddingTop:8,borderTop:`1px solid ${S.ln}`}}><input type="checkbox" checked={(currentRep.visible_overview_projects||[]).includes(p.id)} onChange={()=>{const vis=currentRep.visible_overview_projects||[];const next=vis.includes(p.id)?vis.filter(id=>id!==p.id):[...vis,p.id];upRep({visible_overview_projects:next})}}/> показывать в обзоре</label>}
      {/* 6. Новый комментарий (expanded) */}
      {isO&&ce&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12,borderTop:`1px solid ${S.ln}`,paddingTop:10}}>
        <div style={{display:'flex',gap:8}}><textarea id={"nc-"+p.id} defaultValue="" onChange={e=>{ncRef.current=e.target.value}} placeholder={`Комментарий за ${rep?.week_label||''}...`} rows={2} style={{flex:1,padding:'10px 12px',borderRadius:10,border:`1px solid ${S.ln}`,fontSize:14,resize:'vertical',outline:'none',fontFamily:'inherit',color:'#121416',background:'#fff'}}/><button onClick={()=>addC(p.id)} disabled={sav} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'#DDF0B5',color:'#2F5200',fontSize:14,fontWeight:600,cursor:'pointer',alignSelf:'flex-end',minHeight:40}}>{sav?'…':'Добавить'}</button></div>
      </div>}
    </div>}

  return<>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap',marginBottom:14}}>
      <div style={{display:'flex',flexDirection:'column',gap:2}}>
        <span style={{fontSize:20,fontWeight:600}}>Проекты · неделя {rep?.week_label||'—'}</span>
        <span style={{fontSize:13,color:S.i3}}>Показано {filtered.length} из {active.length} активных{syncMsg?' · '+syncMsg:''}</span>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>syncWorkshop(false)} disabled={syncing} title="Подтянуть проекты и недельные комментарии из Growth Workshop 2027. Автоматически — каждую ночь в 00:00 по Израилю" style={{fontSize:14,color:'#2F5200',background:'#DDF0B5',border:'1px solid #B9DE73',borderRadius:10,padding:'8px 16px',cursor:'pointer',fontWeight:600,minHeight:40}}>{syncing?'Синхронизирую…':'Обновить из Workshop'}</button>
        {ce&&<button onClick={()=>setShowNewP(!showNewP)} style={{fontSize:14,color:'#497B02',background:'#fff',border:'1px solid #6E9B0E',borderRadius:10,padding:'8px 16px',cursor:'pointer',fontWeight:600,minHeight:40}}>{showNewP?'Закрыть':'+ Проект'}</button>}
      </div>
    </div>
    <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:12,color:S.i3,width:70}}>Приоритет</span>
      {[{k:'all',l:'Все'},{k:'key',l:'Ключевые'},{k:'current',l:'Текущие'}].map(f=><button key={f.k} onClick={()=>setFPri(f.k)} style={chipStyle(fPri===f.k)}>{f.l}</button>)}
    </div>
    <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:12,color:S.i3,width:70}}>Статус</span>
      {[{k:'all',l:'Все'},...Object.entries(PROJ_ST).filter(([k])=>k!=='done').map(([k,v])=>({k,l:v.l}))].map(f=><button key={f.k} onClick={()=>setFSt(f.k)} style={chipStyle(fSt===f.k)}>{f.l}</button>)}
    </div>
    {showNewP&&<div style={{background:S.sf,border:`1px solid ${S.gl}`,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:12}}>Новый проект</div>
      <div style={{display:'grid',gridTemplateColumns:'100px 1fr 120px 120px',gap:8,marginBottom:12}}>
        <input value={np.id} onChange={e=>setNp({...np,id:e.target.value})} placeholder="ID (ST01)" style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none'}}/>
        <input value={np.name} onChange={e=>setNp({...np,name:e.target.value})} placeholder="Название проекта" style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none'}}/>
        <input value={np.owner} onChange={e=>setNp({...np,owner:e.target.value})} placeholder="Владелец" style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none'}}/>
        <select value={np.priority} onChange={e=>setNp({...np,priority:e.target.value})} style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14}}><option value="key"> Ключевой</option><option value="current"> Текущий</option></select>
      </div>
      <button onClick={addProj} disabled={!np.id.trim()||!np.name.trim()} style={{padding:'10px 18px',borderRadius:8,border:'none',background:'#DDF0B5',color:'#2F5200',fontSize:14,fontWeight:500,cursor:'pointer'}}>Создать</button>
    </div>}
    {secs.map(s=><div key={s.t}><Label>{s.t.trim()} · {s.items.length}</Label><div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
      {s.items.map(p=><Fragment key={p.id}>{ProjCard({p})}</Fragment>)}</div></div>)}
    {archive.length>0&&<div style={{marginTop:24,borderTop:`2px solid ${S.ln}`,paddingTop:16,fontSize:13,color:S.i3}}>Завершённых проектов: {archive.length}. Они и проекты, убранные в архив, — в разделе меню «Архив проектов».</div>}
  </>
}

export default Projects
