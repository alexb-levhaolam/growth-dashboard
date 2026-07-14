import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const S={bg:'#F7F6F1',sf:'#FFF',ink:'#2C2C2A',i2:'#5F5E5A',i3:'#898781',ln:'#E3E1D8',gd:'#0F6E56',gm:'#1D9E75',gl:'#5DCAA5',gs:'#9FE1CB',gp:'#E1F5EE',ol:'#7C7F2E',am:'#EF9F27',rm:'#E24B4A',bm:'#378ADD'}
const STATUS_CFG={green:{emoji:'🟢',label:'зелёный',bg:'#C0DD97',tx:'#27500A',desc:'Всё по плану, метрики в норме'},yellow:{emoji:'🟡',label:'жёлтый',bg:'#FAC775',tx:'#633806',desc:'Есть отклонения, нужно внимание'},red:{emoji:'🔴',label:'красный',bg:'#F7C1C1',tx:'#791F1F',desc:'Критичные проблемы, нужны решения'}}
const PROJ_ST={done:{l:'готово',bg:'#C0DD97',tx:'#27500A'},progress:{l:'в работе',bg:'#FAC775',tx:'#633806'},test:{l:'тест',bg:'#B5D4F4',tx:'#0C447C'},risk:{l:'риск',bg:'#F7C1C1',tx:'#791F1F'},wait:{l:'ожидание',bg:'#F1EFE8',tx:'#5F5E5A'},blocked:{l:'блокер',bg:'#F7C1C1',tx:'#791F1F'}}
const TEAM_MONTHLY=66300
function Chip({children,bg,tx}){return<span style={{fontSize:12,padding:'2px 11px',borderRadius:20,background:bg,color:tx,whiteSpace:'nowrap'}}>{children}</span>}
function pct(c,p){if(!p||p===0)return null;return Math.round(((c-p)/p)*100)}
function DChip({d}){if(d==null)return<span style={{color:S.i3,fontSize:12}}>—</span>;return<span style={{color:d===0?S.i3:d>0?'#1D7A3F':'#A32D2D',fontSize:12,fontWeight:600}}>{d>0?'+':''}{d}%</span>}
function PlanChip({fact,plan}){if(!plan)return null;const p=Math.round((fact||0)/plan*100);return<span style={{fontSize:11,color:p>=90?'#1D7A3F':p>=70?'#BA7517':'#A32D2D'}}>{p}%</span>}
function Label({children}){return<p style={{fontSize:13,color:S.i2,margin:'0 0 6px 2px',fontWeight:600}}>{children}</p>}
function Box({title,children}){return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:14,fontWeight:600,marginBottom:12}}>{title}</div>{children}</div>}
function CC({title,children}){return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:20,marginBottom:16}}><div style={{fontSize:14,fontWeight:600,marginBottom:16}}>{title}</div>{children}</div>}

function Ed({value,onSave,canEdit,multi,ph,style={}}){
  const[editing,setEditing]=useState(false);const[val,setVal]=useState(value)
  useEffect(()=>setVal(value),[value])
  if(!canEdit)return<span style={style}>{value||''}</span>
  if(!editing)return<span style={{...style,cursor:'pointer',borderBottom:'1px dashed #E3E1D8'}} onClick={()=>setEditing(true)}>{value||ph||'(кликни)'}</span>
  const save=()=>{setEditing(false);if(val!==value)onSave(val)}
  if(multi)return<textarea value={val||''} onChange={e=>setVal(e.target.value)} onBlur={save} autoFocus rows={2} style={{width:'100%',padding:'6px 10px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:13,resize:'vertical',outline:'none',fontFamily:'inherit',...style}}/>
  return<input value={val||''} onChange={e=>setVal(e.target.value)} onBlur={save} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus style={{width:'100%',padding:'4px 8px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:'inherit',outline:'none',...style}}/>
}
function EdNum({value,onSave,canEdit,prefix,style={}}){
  const[editing,setEditing]=useState(false);const[val,setVal]=useState(String(value??''))
  useEffect(()=>setVal(String(value??'')),[value])
  if(!canEdit)return<span style={style}>{prefix||''}{value??'—'}</span>
  if(!editing)return<span style={{...style,cursor:'pointer',borderBottom:'1px dashed #E3E1D8'}} onClick={()=>setEditing(true)}>{prefix||''}{value??'—'}</span>
  const save=()=>{setEditing(false);const n=val===''?null:Number(val);onSave(n)}
  return<input value={val} onChange={e=>setVal(e.target.value)} onBlur={save} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus type="number" style={{width:80,padding:'2px 6px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:'inherit',outline:'none',...style}}/>
}
function EList({items,onSave,canEdit,ph,color}){
  const[ni,setNi]=useState('')
  const add=()=>{if(!ni.trim())return;onSave([...(items||[]),ni.trim()]);setNi('')}
  return<div><ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.75,color:color||'inherit'}}>
    {(items||[]).map((t,i)=><li key={i} style={{display:'flex',alignItems:'flex-start',gap:6}}>
      <Ed value={t} canEdit={canEdit} onSave={v=>{const n=[...(items||[])];n[i]=v;onSave(n)}} style={{flex:1,fontSize:13,color:'inherit'}}/>
      {canEdit&&<button onClick={()=>{const n=[...(items||[])];n.splice(i,1);onSave(n)}} style={{background:'none',border:'none',color:'#ccc',cursor:'pointer',fontSize:14,padding:0}}>×</button>}
    </li>)}</ul>
    {canEdit&&<div style={{display:'flex',gap:6,marginTop:6}}>
      <input value={ni} onChange={e=>setNi(e.target.value)} placeholder={ph||'Добавить...'} onKeyDown={e=>e.key==='Enter'&&add()} style={{flex:1,padding:'4px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/>
      <button onClick={add} style={{padding:'4px 12px',borderRadius:6,border:'none',background:S.gd,color:S.gp,fontSize:12,cursor:'pointer'}}>+</button>
    </div>}
  </div>
}

function Login(){const[e,setE]=useState('');const[p,setP]=useState('');const[err,setErr]=useState('');const[ld,setLd]=useState(false);const go=async()=>{setLd(true);setErr('');const{error}=await supabase.auth.signInWithPassword({email:e,password:p});if(error)setErr(error.message);setLd(false)};return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg}}><div style={{background:S.sf,borderRadius:16,padding:32,width:360,border:`0.5px solid ${S.ln}`}}><div style={{textAlign:'center',marginBottom:24}}><div style={{fontSize:24,fontWeight:600,color:S.gd}}>Growth Dashboard</div><div style={{fontSize:13,color:S.i3,marginTop:4}}>Lev Haolam</div></div><input value={e} onChange={ev=>setE(ev.target.value)} placeholder="Email" style={{width:'100%',padding:'10px 14px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,marginBottom:10,outline:'none'}}/><input value={p} onChange={ev=>setP(ev.target.value)} placeholder="Пароль" type="password" onKeyDown={ev=>ev.key==='Enter'&&go()} style={{width:'100%',padding:'10px 14px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,marginBottom:14,outline:'none'}}/>{err&&<div style={{color:S.rm,fontSize:13,marginBottom:10}}>{err}</div>}<button onClick={go} disabled={ld} style={{width:'100%',padding:'11px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:14,fontWeight:600,cursor:'pointer'}}>{ld?'...':'Войти'}</button></div></div>}

export default function App(){const[session,setSession]=useState(null);const[profile,setProfile]=useState(null);const[loading,setLoading]=useState(true);useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);useEffect(()=>{if(!session?.user)return setProfile(null);supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))},[session]);if(loading)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;if(!session)return<Login/>;if(!profile)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;return<Main profile={profile}/>}

function Main({profile}){
  const[view,setView]=useState('overview');const[reports,setReports]=useState([]);const[projects,setProjects]=useState([]);const[comments,setComments]=useState([]);const[aIdx,setAIdx]=useState(0);const[allProfiles,setAllProfiles]=useState([]);const[tTasks,setTTasks]=useState([]);const[tProgress,setTProgress]=useState([])
  const load=useCallback(async()=>{
    const[r,p,c,tt,tp]=await Promise.all([supabase.from('weekly_reports').select('*').order('week_start'),supabase.from('projects').select('*').order('sort_order'),supabase.from('project_comments').select('*').order('created_at',{ascending:false}),supabase.from('tactical_tasks').select('*').order('sort_order'),supabase.from('tactical_progress').select('*').order('week_start')])
    if(r.data){setReports(r.data);setAIdx(prev=>Math.min(prev,r.data.length-1)||r.data.length-1)}
    if(p.data)setProjects(p.data);if(c.data)setComments(c.data);if(tt.data)setTTasks(tt.data);if(tp.data)setTProgress(tp.data)
    if(profile.role==='admin'){const{data}=await supabase.from('profiles').select('*');if(data)setAllProfiles(data)}
  },[profile]);useEffect(()=>{load()},[load])

  const rep=reports[aIdx];const ce=profile.role==='admin'||profile.role==='editor';const isA=profile.role==='admin'
  const upRep=async u=>{if(!rep)return;await supabase.from('weekly_reports').update({...u,updated_at:new Date().toISOString()}).eq('id',rep.id);load()}
  const createWeek=async()=>{const last=reports[reports.length-1];const ls=last?new Date(last.week_start):new Date();const ns=new Date(ls);ns.setDate(ns.getDate()+7);const ne=new Date(ns);ne.setDate(ne.getDate()+6);const f=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;const label=`${f(ns)} – ${f(ne)}`;const id=`${ns.getFullYear()}-W${String(Math.ceil((ns-new Date(ns.getFullYear(),0,1))/604800000)).padStart(2,'0')}`;const days=[];const dn=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];for(let i=0;i<7;i++){const d=new Date(ns);d.setDate(d.getDate()+i);days.push({day:`${dn[i]} ${f(d)}`,sales:null,note:''})}const chs=(last?.channels||[]).map(c=>({...c,prevSales:c.sales,prevCpo:c.cpo,sales:null,cpo:null}));await supabase.from('weekly_reports').insert({id,week_label:label,week_start:ns.toISOString().slice(0,10),status:'yellow',status_note:'',metrics:{},channels:chs,improved:[],worsened:[],focus:[],asks:[],daily_data:days,pinned_projects:last?.pinned_projects||[]});load();setTimeout(()=>setAIdx(reports.length),500)}

  const tabs=[{id:'overview',l:'Обзор'},{id:'projects',l:'Проекты'},{id:'tactical',l:'Тактические'},{id:'dynamics',l:'Динамика'},{id:'trends',l:'Тренды'}];if(isA)tabs.push({id:'admin',l:'Настройки'})
  const printOverview=()=>{const el=document.getElementById('overview-print');if(!el)return;const w=window.open('','','width=900,height=700');w.document.write('<html><head><title>Growth Report '+rep?.week_label+'</title><style>body{font-family:-apple-system,sans-serif;padding:20px;color:#2C2C2A}table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;border:1px solid #E3E1D8;font-size:13px}</style></head><body>');w.document.write(el.innerHTML);w.document.write('</body></html>');w.document.close();w.print()}

  return<div style={{minHeight:'100vh',background:S.bg}}><div style={{maxWidth:920,margin:'0 auto',padding:'20px 16px'}}>
    <div style={{background:S.gd,borderRadius:14,padding:'18px 22px',marginBottom:16}} className="no-print">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:12,letterSpacing:'.09em',textTransform:'uppercase',color:S.gs,fontWeight:600}}>Growth · еженедельный отчёт</div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:12,color:S.gs}}>{profile.name}</span>
          <button onClick={()=>supabase.auth.signOut()} style={{fontSize:12,color:S.gs,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>Выйти</button>
        </div>
      </div>
      {rep&&<><h1 style={{margin:'4px 0 0',fontSize:24,color:S.gp,fontFamily:'Georgia,serif',fontWeight:400}}>Неделя {rep.week_label}</h1>
        <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {ce?<select value={rep.status} onChange={e=>upRep({status:e.target.value})} style={{fontSize:13,padding:'3px 11px',borderRadius:20,border:'none',background:STATUS_CFG[rep.status]?.bg,color:STATUS_CFG[rep.status]?.tx,cursor:'pointer',fontWeight:600}}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</select>:<Chip bg={STATUS_CFG[rep.status]?.bg} tx={STATUS_CFG[rep.status]?.tx}>{STATUS_CFG[rep.status]?.emoji} {STATUS_CFG[rep.status]?.label}</Chip>}
          <Ed value={rep.status_note} canEdit={ce} onSave={v=>upRep({status_note:v})} ph="Описание статуса..." style={{fontSize:13,color:S.gs}}/>
        </div>
        <div style={{marginTop:10,display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          {reports.map((r,i)=><button key={r.id} onClick={()=>setAIdx(i)} style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:i===aIdx?S.gp:'rgba(255,255,255,0.15)',color:i===aIdx?S.gd:S.gs}}>{r.week_label}</button>)}
          {ce&&<button onClick={createWeek} style={{padding:'4px 12px',borderRadius:14,border:'1px dashed rgba(255,255,255,0.4)',cursor:'pointer',fontSize:11,fontWeight:600,background:'transparent',color:S.gs}}>+ новая неделя</button>}
        </div>
      </>}
    </div>
    <div style={{display:'flex',gap:2,marginBottom:16,background:S.sf,borderRadius:10,padding:3,border:`0.5px solid ${S.ln}`}} className="no-print">
      {tabs.map(t=><button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,padding:'8px',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,background:view===t.id?S.gd:'transparent',color:view===t.id?S.gp:S.i2}}>{t.l}</button>)}
    </div>
    {view==='overview'&&rep&&<Overview rep={rep} projects={projects} comments={comments} ce={ce} up={upRep} tTasks={tTasks} tProgress={tProgress} print={printOverview}/>}
    {view==='projects'&&<Projects projects={projects} comments={comments} ce={ce} reports={reports} aIdx={aIdx} profile={profile} reload={load}/>}
    {view==='tactical'&&<Tactical tasks={tTasks} progress={tProgress} reports={reports} aIdx={aIdx} ce={ce} reload={load}/>}
    {view==='dynamics'&&<Dynamics projects={projects} comments={comments} reports={reports} ce={ce} reload={load}/>}
    {view==='trends'&&<Trends reports={reports}/>}
    {view==='admin'&&isA&&<Admin profiles={allProfiles} projects={projects} reports={reports} aIdx={aIdx} reload={load}/>}
  </div></div>
}

// ═══ OVERVIEW ═══
function Overview({rep,projects,comments,ce,up,tTasks,tProgress,print}){
  const m=rep.metrics||{};const ch=rep.channels||[];const daily=rep.daily_data||[];const maxS=Math.max(...ch.map(c=>c.sales||0),1)
  const pins=rep.pinned_projects||[];const shown=pins.length>0?projects.filter(p=>pins.includes(p.id)):projects.filter(p=>p.priority==='key').slice(0,8)
  const upM=(k,v)=>up({metrics:{...m,[k]:v===''?null:isNaN(Number(v))?v:Number(v)}})
  const upCh=(idx,f,v)=>{const nc=[...ch];nc[idx]={...nc[idx],[f]:f==='name'?v:(v===''?null:Number(v))};up({channels:nc})}
  const addCh=()=>up({channels:[...ch,{name:'Новый канал',sales:0,prevSales:null,cpo:null,prevCpo:null,planSales:null}]})
  const upDay=(idx,f,v)=>{const nd=[...daily];nd[idx]={...nd[idx],[f]:f==='note'||f==='day'?v:(v===''?null:Number(v))};up({daily_data:nd})}
  // CPO calcs
  const paidSales=ch.filter(c=>c.cpo&&c.cpo>0).reduce((s,c)=>s+(c.sales||0),0)
  const adSpend=ch.reduce((s,c)=>s+((c.sales||0)*(c.cpo||0)),0)
  const teamWeek=Math.round(TEAM_MONTHLY/30*7)
  const cpoAds=paidSales>0?Math.round(adSpend/paidSales):null
  const cpoTotal=(m.totalSales||0)>0?Math.round((adSpend+teamWeek)/(m.totalSales||1)):null
  // Tactical progress for current week
  const ws=rep.week_start
  const getTP=(taskId)=>{const all=tProgress.filter(p=>p.task_id===taskId&&p.week_start<=ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return all[0]||null}

  return<div id="overview-print"><>
    {/* STATUS LEGEND */}
    <div style={{display:'flex',gap:8,marginBottom:14,fontSize:11,color:S.i3,flexWrap:'wrap'}}>
      {Object.entries(STATUS_CFG).map(([k,v])=><span key={k} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:'50%',background:v.bg,border:`1px solid ${v.tx}`}}/>{v.emoji} {v.label} — {v.desc}</span>)}
      <span style={{marginLeft:'auto'}}><button onClick={print} style={{fontSize:11,color:S.gd,background:S.sf,border:`1px solid ${S.ln}`,borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>📄 Скачать PDF</button></span>
    </div>

    <Label>Ключевые метрики</Label>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
      {[
        {l:'Продажи',k:'totalSales',s:`план ${m.planSales||'—'}`},
        {l:'CPO Ads',v:cpoAds!=null?`$${cpoAds}`:'—',s:`рекл. расходы / платные прод.`},
        {l:'CPO Total',v:cpoTotal!=null?`$${cpoTotal}`:'—',s:`(рекл.+команда) / все прод.`},
        {l:'Бюджет Ads',k:'budgetSpent',pre:'$',s:`из $${((m.budgetPlan||0)/1000).toFixed(0)}K`},
      ].map((x,i)=><div key={i} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:12,color:S.i3}}>{x.l}</div>
        <div style={{fontSize:22,fontWeight:500,margin:'2px 0'}}>
          {x.k?<>{x.pre||''}<EdNum value={m[x.k]} canEdit={ce} onSave={v=>upM(x.k,v)} style={{fontSize:22,fontWeight:500}}/></>:x.v}
        </div><div style={{fontSize:12,color:S.i2}}>{x.s}</div>
      </div>)}
    </div>

    <Label>Брэкдаун по дням</Label>
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,marginBottom:16}}>
      {(daily.length>0?daily:Array(7).fill(null)).map((d,i)=><div key={i} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'8px 4px',textAlign:'center'}}>
        <Ed value={d?.day||''} canEdit={ce} onSave={v=>upDay(i,'day',v)} style={{fontSize:11,color:S.i3}}/>
        <div style={{margin:'4px 0'}}><EdNum value={d?.sales} canEdit={ce} onSave={v=>upDay(i,'sales',v)} style={{fontSize:18,fontWeight:500}}/></div>
        <Ed value={d?.note||(d?.sales==null?'нет данных':'продаж')} canEdit={ce} onSave={v=>upDay(i,'note',v)} style={{fontSize:10,color:d?.sales==null?'#BA7517':S.i2}}/>
      </div>)}
    </div>

    <Label>Каналы</Label>
    <div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,overflow:'hidden',marginBottom:16}}>
      <div style={{display:'grid',gridTemplateColumns:'120px 1fr 50px 50px 45px 45px 55px',gap:4,padding:'8px 12px',background:S.bg,fontSize:10,color:S.i3,fontWeight:600,textTransform:'uppercase'}}>
        <span>Канал</span><span></span><span style={{textAlign:'right'}}>Прод</span><span style={{textAlign:'right'}}>План</span><span style={{textAlign:'right'}}>%</span><span style={{textAlign:'right'}}>Δ нед</span><span style={{textAlign:'right'}}>CPO</span>
      </div>
      {ch.map((c,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'120px 1fr 50px 50px 45px 45px 55px',gap:4,padding:'6px 12px',borderBottom:`0.5px solid ${S.ln}`,alignItems:'center',fontSize:13}}>
        <Ed value={c.name} canEdit={ce} onSave={v=>upCh(i,'name',v)} style={{fontWeight:500,fontSize:12}}/>
        <div style={{height:7,background:S.bg,borderRadius:20,overflow:'hidden'}}><div style={{height:7,borderRadius:20,width:`${((c.sales||0)/maxS*100)}%`,background:(c.cpo||0)>380?S.am:!c.cpo?S.gl:S.gm}}/></div>
        <span style={{textAlign:'right'}}><EdNum value={c.sales} canEdit={ce} onSave={v=>upCh(i,'sales',v)} style={{fontWeight:500,fontSize:13}}/></span>
        <span style={{textAlign:'right'}}><EdNum value={c.planSales} canEdit={ce} onSave={v=>upCh(i,'planSales',v)} style={{fontSize:12,color:S.i3}}/></span>
        <span style={{textAlign:'right'}}><PlanChip fact={c.sales} plan={c.planSales}/></span>
        <span style={{textAlign:'right'}}><DChip d={pct(c.sales,c.prevSales)}/></span>
        <span style={{textAlign:'right'}}><EdNum value={c.cpo} canEdit={ce} prefix="$" onSave={v=>upCh(i,'cpo',v)} style={{fontSize:12,color:S.i2}}/></span>
      </div>)}
      {ce&&<div style={{padding:'8px 12px'}}><button onClick={addCh} style={{fontSize:12,color:S.gd,background:'none',border:`1px dashed ${S.ln}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',width:'100%'}}>+ Добавить канал</button></div>}
    </div>

    {/* TACTICAL TASKS CARDS */}
    <Label>Тактические задачи <span style={{fontWeight:400,color:S.i3}}>· до 01.01.2027</span></Label>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
      {tTasks.map(t=>{const tp=getTP(t.id);const ms=t.milestones||[]
        let pctVal=0,label=''
        if(t.target_type==='numeric'){pctVal=t.target_value?(Math.round(((tp?.current_value||0)/t.target_value)*100)):0;label=`${tp?.current_value||0} / ${t.target_value}`}
        else{const cur=tp?.milestone_status||0;pctVal=ms.length?Math.round(cur/ms.length*100):0;label=cur>0&&cur<=ms.length?ms[cur-1]?.name:'Не начато'}
        return<div key={t.id} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'10px 14px'}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{t.name}</div>
          <div style={{height:8,background:S.bg,borderRadius:20,overflow:'hidden',marginBottom:4}}><div style={{height:8,borderRadius:20,background:pctVal>=80?'#1D9E75':pctVal>=50?'#EF9F27':'#E24B4A',width:`${Math.min(pctVal,100)}%`}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:S.i2}}><span>{label}</span><span style={{fontWeight:600}}>{pctVal}%</span></div>
          {tp?.comment&&<div style={{fontSize:11,color:S.i3,marginTop:4,fontStyle:'italic'}}>💬 {tp.comment}</div>}
        </div>})}
    </div>

    <Label>Проекты на контроле</Label>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
      {shown.map(p=>{const ps=PROJ_ST[p.status]||PROJ_ST.wait;const lc=comments.find(c=>c.project_id===p.id)
        return<div key={p.id} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'10px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:4}}><span style={{fontSize:13,fontWeight:500}}>{p.name}</span><Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip></div>
          <div style={{fontSize:12,color:S.i2,lineHeight:1.5}}>{p.last_update}</div>
          {lc&&<div style={{fontSize:11,color:S.i3,marginTop:4,fontStyle:'italic'}}>💬 {lc.summary||lc.full_text?.slice(0,80)}</div>}
        </div>})}
    </div>

    {/* CLAUDE + MANUAL */}
    <div style={{display:'flex',gap:12,marginBottom:12}}>
      <div style={{flex:1,background:'#EAF3DE',borderRadius:12,padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:11,color:'#7C9F55',fontWeight:600}}>🤖 Анализ от Claude · Улучшилось</div>
          {ce&&<button onClick={()=>alert('Откройте Claude и попросите: "Обнови анализ за неделю '+rep.week_label+' на основе текущих данных дашборда"')} style={{fontSize:10,color:'#7C9F55',background:'none',border:`1px solid #7C9F55`,borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>🔄 обновить</button>}
        </div>
        <EList items={rep.improved} canEdit={ce} onSave={v=>up({improved:v})} color="#27500A"/>
      </div>
      <div style={{flex:1,background:'#FCEBEB',borderRadius:12,padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:11,color:'#C77',fontWeight:600}}>🤖 Анализ от Claude · Ухудшилось</div>
          {ce&&<button onClick={()=>alert('Откройте Claude и попросите обновить анализ')} style={{fontSize:10,color:'#C77',background:'none',border:'1px solid #C77',borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>🔄</button>}
        </div>
        <EList items={rep.worsened} canEdit={ce} onSave={v=>up({worsened:v})} color="#791F1F"/>
      </div>
    </div>
    <div style={{display:'flex',gap:12,marginBottom:16}}>
      <div style={{flex:1,background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:13,fontWeight:600,color:'#3B6D11',marginBottom:6}}>✏️ Дополнения команды</div><EList items={rep.manual_improved} canEdit={ce} onSave={v=>up({manual_improved:v})} color="#27500A"/></div>
      <div style={{flex:1,background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:13,fontWeight:600,color:'#A32D2D',marginBottom:6}}>✏️ Дополнения команды</div><EList items={rep.manual_worsened} canEdit={ce} onSave={v=>up({manual_worsened:v})} color="#791F1F"/></div>
    </div>
    <div style={{background:'#D6E8FA',borderRadius:12,padding:'14px 16px',marginBottom:12}}><div style={{fontSize:13,fontWeight:600,color:'#0C447C',marginBottom:6}}>Фокус на следующую неделю</div><EList items={rep.focus} canEdit={ce} onSave={v=>up({focus:v})} color="#0C447C"/></div>
    <div style={{background:S.gd,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:13,fontWeight:600,color:S.gs,marginBottom:6}}>Нужно от руководства</div><div style={{color:S.gp}}><EList items={rep.asks} canEdit={ce} onSave={v=>up({asks:v})}/></div></div>
  </></div>
}

// ═══ TACTICAL TASKS ═══
function Tactical({tasks,progress,reports,aIdx,ce,reload}){
  const rep=reports[aIdx];const ws=rep?.week_start
  const getTP=(tid)=>progress.filter(p=>p.task_id===tid&&p.week_start<=ws).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0]||null
  const getAllTP=(tid)=>progress.filter(p=>p.task_id===tid).sort((a,b)=>b.week_start.localeCompare(a.week_start))
  const upsertTP=async(tid,updates)=>{
    const existing=progress.find(p=>p.task_id===tid&&p.week_start===ws)
    if(existing){await supabase.from('tactical_progress').update(updates).eq('id',existing.id)}
    else{await supabase.from('tactical_progress').insert({task_id:tid,week_start:ws,...updates})}
    reload()
  }
  const daysLeft=Math.ceil((new Date('2027-01-01')-new Date())/(1000*60*60*24))

  return<>
    <div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:13,color:S.i2}}>📅 Данные за: <b>{rep?.week_label||'—'}</b></span>
      <span style={{fontSize:13,color:daysLeft<180?S.rm:S.i2,fontWeight:600}}>До дедлайна: {daysLeft} дней (01.01.2027)</span>
    </div>
    {tasks.map(t=>{const tp=getTP(t.id);const ms=t.milestones||[];const history=getAllTP(t.id)
      let pctVal=0
      if(t.target_type==='numeric'){pctVal=t.target_value?Math.round(((tp?.current_value||0)/t.target_value)*100):0}
      else{const cur=tp?.milestone_status||0;pctVal=ms.length?Math.round(cur/ms.length*100):0}
      return<div key={t.id} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:16,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:15,fontWeight:500}}>{t.name}</span>
          <span style={{fontSize:20,fontWeight:700,color:pctVal>=80?'#1D7A3F':pctVal>=50?'#BA7517':'#A32D2D'}}>{pctVal}%</span>
        </div>
        <div style={{height:10,background:S.bg,borderRadius:20,overflow:'hidden',marginBottom:8}}><div style={{height:10,borderRadius:20,background:pctVal>=80?S.gm:pctVal>=50?S.am:S.rm,width:`${Math.min(pctVal,100)}%`,transition:'width 0.3s'}}/></div>

        {t.target_type==='numeric'&&<div style={{display:'flex',gap:16,alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:13,color:S.i2}}>Цель: <EdNum value={t.target_value} canEdit={ce} onSave={async v=>{await supabase.from('tactical_tasks').update({target_value:v}).eq('id',t.id);reload()}} style={{fontWeight:600}}/></span>
          <span style={{fontSize:13,color:S.i2}}>Факт: <EdNum value={tp?.current_value} canEdit={ce} onSave={v=>upsertTP(t.id,{current_value:v})} style={{fontWeight:600}}/></span>
        </div>}

        {t.target_type==='milestone'&&<div style={{marginBottom:8}}>
          {ce?<div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {ms.map((m,mi)=><button key={mi} onClick={()=>upsertTP(t.id,{milestone_status:mi+1})} style={{padding:'4px 12px',borderRadius:8,border:`1px solid ${(tp?.milestone_status||0)>=mi+1?S.gd:S.ln}`,background:(tp?.milestone_status||0)>=mi+1?'#C0DD97':'transparent',color:(tp?.milestone_status||0)>=mi+1?'#27500A':S.i3,fontSize:12,cursor:'pointer',fontWeight:500}}>{m.name}</button>)}
          </div>
          :<div style={{fontSize:13,color:S.i2}}>Стадия: {(tp?.milestone_status||0)>0?ms[(tp?.milestone_status||1)-1]?.name:'Не начато'}</div>}
        </div>}

        {/* Comment for this week */}
        <div style={{marginTop:8}}>
          <Ed value={tp?.comment||''} canEdit={ce} multi onSave={v=>upsertTP(t.id,{comment:v})} ph="Комментарий за эту неделю..." style={{fontSize:13,color:S.i2,lineHeight:1.6}}/>
        </div>

        {/* History */}
        {history.length>1&&<details style={{marginTop:10}}><summary style={{fontSize:12,color:S.gm,cursor:'pointer'}}>История ({history.length} нед.)</summary>
          <div style={{marginTop:8,borderLeft:`3px solid ${S.gl}`,paddingLeft:12}}>
            {history.map((h,hi)=>{const wl=reports.find(r=>r.week_start===h.week_start)?.week_label||h.week_start
              return<div key={hi} style={{marginBottom:8,paddingBottom:8,borderBottom:`0.5px solid ${S.ln}`}}>
                <div style={{fontSize:12,fontWeight:600,color:S.gd}}>{wl}</div>
                <div style={{fontSize:12,color:S.i2}}>{t.target_type==='numeric'?`Факт: ${h.current_value||0}`:ms[(h.milestone_status||1)-1]?.name||'—'}</div>
                {h.comment&&<div style={{fontSize:12,color:S.i3,fontStyle:'italic'}}>{h.comment}</div>}
              </div>})}
          </div>
        </details>}
      </div>})}
  </>
}

// ═══ PROJECTS ═══
function Projects({projects,comments,ce,reports,aIdx,profile,reload}){
  const[exp,setExp]=useState(null);const[nc,setNc]=useState('');const[sav,setSav]=useState(false)
  const rep=reports[aIdx];const ws=rep?.week_start
  const upProj=async(id,f,v)=>{await supabase.from('projects').update({[f]:v}).eq('id',id);reload()}
  const addC=async pid=>{if(!nc.trim())return;setSav(true);const sum=nc.length>150?nc.slice(0,120).replace(/\s\S*$/,'')+'…':nc;await supabase.from('project_comments').insert({project_id:pid,author:profile.name||profile.email,full_text:nc,summary:sum,week_start:ws||new Date().toISOString().slice(0,10)});setNc('');setSav(false);reload()}
  const getWC=pid=>comments.filter(c=>c.project_id===pid&&c.week_start===ws)
  const getPrev=pid=>{const s=comments.filter(c=>c.project_id===pid&&c.week_start<ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return s[0]||null}
  const secs=[{t:'🔴 Ключевые',items:projects.filter(p=>p.priority==='key')},{t:'🔵 Текущие',items:projects.filter(p=>p.priority==='current')}]
  return<><div style={{fontSize:12,color:S.i3,marginBottom:12,padding:'8px 12px',background:S.sf,borderRadius:8,border:`0.5px solid ${S.ln}`}}>📅 <b>{rep?.week_label||'—'}</b> — комментарии привязаны к этой неделе</div>
    {secs.map(s=><div key={s.t}><Label>{s.t} ({s.items.length})</Label><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
      {s.items.map(p=>{const ps=PROJ_ST[p.status]||PROJ_ST.wait;const wcs=getWC(p.id);const prev=getPrev(p.id);const isO=exp===p.id
        return<div key={p.id} style={{background:S.sf,border:`0.5px solid ${isO?S.gl:S.ln}`,borderRadius:12,padding:'12px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,cursor:'pointer'}} onClick={()=>setExp(isO?null:p.id)}>
            <div style={{flex:1}}><span style={{fontWeight:500}}>{p.name}</span><span style={{fontSize:12,color:S.i3,marginLeft:8}}>{p.id} · {p.owner}</span></div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>{ce?<select value={p.status} onClick={e=>e.stopPropagation()} onChange={e=>upProj(p.id,'status',e.target.value)} style={{fontSize:12,padding:'2px 6px',borderRadius:6,border:`1px solid ${S.ln}`,background:ps.bg,color:ps.tx,cursor:'pointer'}}>{Object.entries(PROJ_ST).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select>:<Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip>}<span style={{color:S.i3}}>{isO?'▲':'▼'}</span></div>
          </div>
          {wcs.map(c=><CItem key={c.id} c={c} ce={ce} reload={reload}/>)}
          {wcs.length===0&&prev&&<div style={{marginTop:6,padding:'8px 12px',background:'#FFF9E6',borderRadius:8,border:'1px dashed #EAD89B'}}><div style={{fontSize:10,color:'#BA7517'}}>⏮ {prev.week_start} ({prev.author})</div><div style={{fontSize:13,color:S.i3,fontStyle:'italic'}}>{prev.summary||prev.full_text?.slice(0,120)}</div></div>}
          {isO&&<div style={{marginTop:12,borderTop:`0.5px solid ${S.ln}`,paddingTop:12}}>
            <Ed value={p.last_update} canEdit={ce} multi onSave={v=>upProj(p.id,'last_update',v)} ph="Общее описание..." style={{color:S.i2,fontSize:13,display:'block',marginBottom:12}}/>
            {ce&&<div style={{display:'flex',gap:8}}><textarea value={nc} onChange={e=>setNc(e.target.value)} placeholder={`Комментарий за ${rep?.week_label||''}...`} rows={2} style={{flex:1,padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:13,resize:'vertical',outline:'none',fontFamily:'inherit'}}/><button onClick={()=>addC(p.id)} disabled={sav} style={{padding:'8px 16px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:13,fontWeight:600,cursor:'pointer',alignSelf:'flex-end'}}>{sav?'...':'→'}</button></div>}
          </div>}
        </div>})}</div></div>)}</>
}
function CItem({c,ce,reload}){const[es,setEs]=useState(false);const[sv,setSv]=useState(c.summary);const isL=c.full_text?.length>150;const saveS=async()=>{setEs(false);await supabase.from('project_comments').update({summary:sv}).eq('id',c.id);reload()};return<div style={{marginTop:6,padding:'8px 12px',background:S.bg,borderRadius:8}}><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:S.i3,marginBottom:2}}><span><b>{c.author}</b> · {c.week_start}</span>{ce&&<button onClick={()=>setEs(!es)} style={{fontSize:11,color:S.bm,background:'none',border:'none',cursor:'pointer'}}>✏️</button>}</div>{es?<div><textarea value={sv} onChange={e=>setSv(e.target.value)} rows={2} style={{width:'100%',padding:'6px 10px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:13,outline:'none',fontFamily:'inherit'}}/><button onClick={saveS} style={{fontSize:12,color:S.gd,background:'none',border:'none',cursor:'pointer'}}>💾</button></div>:<div style={{fontSize:13,color:S.i2}}>{c.summary||c.full_text?.slice(0,120)}</div>}{isL&&!es&&<details style={{marginTop:4}}><summary style={{fontSize:11,color:S.gm,cursor:'pointer'}}>Полная версия</summary><div style={{fontSize:12,color:S.ink,marginTop:4,whiteSpace:'pre-wrap'}}>{c.full_text}</div></details>}</div>}

// ═══ DYNAMICS ═══
function Dynamics({projects,comments,reports,ce,reload}){const[ek,setEk]=useState(null);const[ec,setEc]=useState(null);const kP=projects.filter(p=>p.priority==='key');const cP=projects.filter(p=>p.priority==='current')
  const TL=({proj,isOpen,toggle})=>{const ps=PROJ_ST[proj.status]||PROJ_ST.wait;const pC=comments.filter(c=>c.project_id===proj.id);const weeks=[...reports].reverse().map(r=>({...r,wc:pC.filter(c=>c.week_start===r.week_start)}))
    return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',cursor:'pointer'}} onClick={toggle}><div><span style={{fontWeight:500}}>{proj.name}</span><span style={{fontSize:12,color:S.i3,marginLeft:8}}>{proj.owner}</span></div><div style={{display:'flex',gap:8,alignItems:'center'}}><Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip><span style={{color:S.i3}}>{isOpen?'▲':'▼'}</span></div></div>
      {isOpen&&<div style={{padding:'0 16px 16px',borderLeft:`3px solid ${S.gl}`,marginLeft:16}}>{weeks.map(w=><div key={w.id} style={{marginTop:12,paddingBottom:12,borderBottom:`0.5px solid ${S.ln}`}}><div style={{fontSize:12,fontWeight:600,color:S.gd}}>📅 {w.week_label}</div>{w.wc.length>0?w.wc.map(c=><div key={c.id} style={{marginTop:4}}><span style={{fontSize:11,color:S.i3}}>{c.author}:</span><Ed value={c.summary||c.full_text} canEdit={ce} multi onSave={async v=>{await supabase.from('project_comments').update({summary:v}).eq('id',c.id);reload()}} style={{fontSize:13,color:S.ink}}/>{c.full_text?.length>150&&<details><summary style={{fontSize:11,color:S.gm,cursor:'pointer'}}>Полностью</summary><div style={{fontSize:12,whiteSpace:'pre-wrap'}}>{c.full_text}</div></details>}</div>):<div style={{fontSize:12,color:S.i3,fontStyle:'italic',marginTop:4}}>Нет обновлений</div>}</div>)}</div>}</div>}
  return<><Label>🔴 Ключевые ({kP.length})</Label>{kP.map(p=><TL key={p.id} proj={p} isOpen={ek===p.id} toggle={()=>setEk(ek===p.id?null:p.id)}/>)}<div style={{marginTop:20}}><Label>🔵 Текущие ({cP.length})</Label></div>{cP.map(p=><TL key={p.id} proj={p} isOpen={ec===p.id} toggle={()=>setEc(ec===p.id?null:p.id)}/>)}</>}

// ═══ TRENDS ═══
function Trends({reports}){const data=reports.map(r=>{const m=r.metrics||{};const o={week:r.week_label,sales:m.totalSales,cpo:m.cpoAds};(r.channels||[]).forEach(c=>{o[c.name?.split(' (')[0]||c.name]=c.sales});return o});return<><CC title="Продажи"><ResponsiveContainer width="100%" height={220}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={S.ln}/><XAxis dataKey="week" tick={{fontSize:11,fill:S.i3}}/><YAxis tick={{fontSize:12,fill:S.i3}}/><Tooltip contentStyle={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:8,fontSize:12}}/><Bar dataKey="sales" fill={S.gm} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CC><CC title="CPO"><ResponsiveContainer width="100%" height={220}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={S.ln}/><XAxis dataKey="week" tick={{fontSize:11,fill:S.i3}}/><YAxis tick={{fontSize:12,fill:S.i3}} domain={[0,500]}/><Tooltip contentStyle={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:8,fontSize:12}}/><Line type="monotone" dataKey="cpo" stroke={S.am} strokeWidth={2} dot={{r:5,fill:S.am}}/></LineChart></ResponsiveContainer></CC><CC title="Каналы"><ResponsiveContainer width="100%" height={250}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={S.ln}/><XAxis dataKey="week" tick={{fontSize:11,fill:S.i3}}/><YAxis tick={{fontSize:12,fill:S.i3}}/><Tooltip contentStyle={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:8,fontSize:12}}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="Google" stackId="a" fill={S.gm}/><Bar dataKey="Meta" stackId="a" fill={S.am}/><Bar dataKey="Email" stackId="a" fill={S.gl}/><Bar dataKey="Direct" stackId="a" fill={S.gs}/><Bar dataKey="SEO" stackId="a" fill="#C0DD97"/><Bar dataKey="SMM" stackId="a" fill={S.ol}/></BarChart></ResponsiveContainer></CC></>}

// ═══ ADMIN ═══
function Admin({profiles,projects,reports,aIdx,reload}){const rep=reports[aIdx];const[pins,setPins]=useState(rep?.pinned_projects||[]);useEffect(()=>setPins(rep?.pinned_projects||[]),[rep]);const upRole=async(id,r)=>{await supabase.from('profiles').update({role:r}).eq('id',id);reload()};const upPP=async(id,p)=>{await supabase.from('projects').update({priority:p}).eq('id',id);reload()};const togPin=async pid=>{const n=pins.includes(pid)?pins.filter(x=>x!==pid):[...pins,pid];setPins(n);if(rep)await supabase.from('weekly_reports').update({pinned_projects:n}).eq('id',rep.id);reload()}
  const INTEG=[{name:'Google Sheets — Daily Tracking',url:'https://docs.google.com/spreadsheets/d/1qkd5LZ-5ZHVElfrSg1GXp-s_Tiw_CgitK_N1bBxRlcw',st:'manual',desc:'Ежедневные продажи/бюджеты/CPO по каналам. Забираем: суммы за неделю → каналы + брэкдаун. Вносят: Julia/Nikita ежедневно.'},{name:'Google Sheets — KPI Weekly',url:'https://docs.google.com/spreadsheets/d/1qT8V2qlUWW3wROYrIILbjPGaGuX6b2TnWb6Omus8QVk',st:'manual',desc:'KPI по подразделениям (Natiia/Nikita/Julia/Vlada/Darya). Забираем: план/факт метрик → каналы + CR. Заполняют руководители по понедельникам.'},{name:'Стратегический дашборд',url:'https://docs.google.com/spreadsheets/d/1FQ8r5QYwENNWUSLScfRdDYKc16J8lnKG5XzPt_kgaFU',st:'connected',desc:'Мастер-список проектов. Импортировано 22 проекта при создании.'},{name:'Supabase',url:'https://lkkhwumnuzepxyvvwubd.supabase.co',st:'connected',desc:'Хранилище: отчёты, проекты, комменты, тактические задачи, пользователи.'},{name:'Roistat',st:'planned',desc:'Планируется: авто-импорт конверсий (Visit→ATC→Lead→Purchase).'},{name:'Slack бот',st:'planned',desc:'Планируется: опрос команды пн 18:30, сбор ответов → суммаризация → комменты.'},{name:'Claude API',st:'planned',desc:'Суммаризация ответов + генерация Улучшилось/Ухудшилось.'},{name:'Meta Ads MCP',st:'planned',desc:'Прямой импорт Meta данных без ручного ввода.'},{name:'Klaviyo MCP',st:'planned',desc:'Импорт email CR (flows, cold, reactivation).'}]
  const stC={connected:{bg:'#C0DD97',tx:'#27500A',l:'подключено'},manual:{bg:'#FAC775',tx:'#633806',l:'вручную'},planned:{bg:'#F1EFE8',tx:'#5F5E5A',l:'планируется'}}
  return<><Box title="Пользователи">{profiles.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`0.5px solid ${S.ln}`}}><div><span style={{fontWeight:500}}>{p.name||p.email}</span><span style={{fontSize:12,color:S.i3,marginLeft:8}}>{p.email}</span></div><select value={p.role} onChange={e=>upRole(p.id,e.target.value)} style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:13}}><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></select></div>)}</Box>
    <Box title={`Проекты на главной · ${rep?.week_label||''}`}><div style={{fontSize:12,color:S.i3,marginBottom:8}}>На каждой неделе свой набор.</div>{projects.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 0',borderBottom:`0.5px solid ${S.ln}`,fontSize:13}}><input type="checkbox" checked={pins.includes(p.id)} onChange={()=>togPin(p.id)} style={{cursor:'pointer'}}/><span style={{flex:1}}>{p.name}</span><Chip bg={p.priority==='key'?'#F7C1C1':'#B5D4F4'} tx={p.priority==='key'?'#791F1F':'#0C447C'}>{p.priority==='key'?'🔴':'🔵'}</Chip></div>)}</Box>
    <Box title="Приоритет проектов">{projects.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`0.5px solid ${S.ln}`,fontSize:13}}><span>{p.id} — {p.name}</span><div style={{display:'flex',gap:6}}><button onClick={()=>upPP(p.id,'key')} style={{padding:'3px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:12,background:p.priority==='key'?'#F7C1C1':'#F1EFE8',color:p.priority==='key'?'#791F1F':'#5F5E5A',fontWeight:600}}>🔴</button><button onClick={()=>upPP(p.id,'current')} style={{padding:'3px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:12,background:p.priority==='current'?'#B5D4F4':'#F1EFE8',color:p.priority==='current'?'#0C447C':'#5F5E5A',fontWeight:600}}>🔵</button></div></div>)}</Box>
    <div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:16}}><div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Подключения и интеграции</div>{INTEG.map((ig,i)=>{const sc=stC[ig.st]||stC.planned;return<div key={i} style={{padding:'10px 0',borderBottom:`0.5px solid ${S.ln}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}><div style={{flex:1}}>{ig.url?<a href={ig.url} target="_blank" rel="noopener" style={{color:S.gd,fontWeight:500,fontSize:13}}>{ig.name}</a>:<span style={{fontWeight:500,fontSize:13}}>{ig.name}</span>}<div style={{fontSize:12,color:S.i2,marginTop:2,lineHeight:1.5}}>{ig.desc}</div></div><Chip bg={sc.bg} tx={sc.tx}>{sc.l}</Chip></div></div>})}</div></>}
