import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const S={bg:'#F7F6F1',sf:'#FFF',ink:'#2C2C2A',i2:'#5F5E5A',i3:'#898781',ln:'#E3E1D8',gd:'#0F6E56',gm:'#1D9E75',gl:'#5DCAA5',gs:'#9FE1CB',gp:'#E1F5EE',ol:'#7C7F2E',am:'#EF9F27',rm:'#E24B4A',bm:'#378ADD'}
const STATUS_CFG={green:{emoji:'🟢',label:'зелёный',bg:'#C0DD97',tx:'#27500A',desc:'Всё по плану'},yellow:{emoji:'🟡',label:'жёлтый',bg:'#FAC775',tx:'#633806',desc:'Есть отклонения'},red:{emoji:'🔴',label:'красный',bg:'#F7C1C1',tx:'#791F1F',desc:'Критичные проблемы'}}
const PROJ_ST={done:{l:'готово',bg:'#C0DD97',tx:'#27500A'},progress:{l:'в работе',bg:'#FAC775',tx:'#633806'},test:{l:'тест',bg:'#B5D4F4',tx:'#0C447C'},risk:{l:'риск',bg:'#F7C1C1',tx:'#791F1F'},wait:{l:'ожидание',bg:'#F1EFE8',tx:'#5F5E5A'},blocked:{l:'блокер',bg:'#F7C1C1',tx:'#791F1F'}}
const TEAM_MONTHLY=66300
const CH_COLORS={Google:S.gm,Meta:S.am,Email:S.gl,Direct:S.gs,SEO:'#C0DD97',SMM:S.ol,Bing:'#9B59B6',TikTok:'#E91E63',Influencers:'#FF9800',Referral:'#795548'}
function Chip({children,bg,tx}){return<span style={{fontSize:12,padding:'2px 11px',borderRadius:20,background:bg,color:tx,whiteSpace:'nowrap'}}>{children}</span>}
function pct(c,p){if(!p||p===0)return null;return Math.round(((c-p)/p)*100)}
function DChip({d}){if(d==null)return<span style={{color:S.i3,fontSize:12}}>—</span>;return<span style={{color:d===0?S.i3:d>0?'#1D7A3F':'#A32D2D',fontSize:12,fontWeight:600}}>{d>0?'+':''}{d}%</span>}
function PlanChip({fact,plan}){if(!plan)return null;const p=Math.round((fact||0)/plan*100);return<span style={{fontSize:11,color:p>=90?'#1D7A3F':p>=70?'#BA7517':'#A32D2D'}}>{p}%</span>}
function CpoCompare({fact,plan}){if(!plan||!fact)return null;const d=fact-plan;const c=d<=0?'#1D7A3F':d<=30?'#BA7517':'#A32D2D';return<span style={{fontSize:11,color:c}}>{d>0?'+':''}{d}</span>}
function Label({children}){return<p style={{fontSize:13,color:S.i2,margin:'0 0 6px 2px',fontWeight:600}}>{children}</p>}
function Box({title,children}){return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:14,fontWeight:600,marginBottom:12}}>{title}</div>{children}</div>}
function CC({title,children,right}){return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:20,marginBottom:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:14,fontWeight:600}}>{title}</div>{right&&<div>{right}</div>}</div>{children}</div>}
function Linkify({children,style={}}){if(!children||typeof children!=='string')return<span style={style}>{children||''}</span>;const urlRe=/(https?:\/\/[^\s<]+)/g;const parts=children.split(urlRe);return<span style={style}>{parts.map((p,i)=>urlRe.test(p)?<a key={i} href={p} target="_blank" rel="noopener" style={{color:S.bm,textDecoration:'underline'}}>{p.length>60?p.slice(0,57)+'…':p}</a>:p)}</span>}
function Ed({value,onSave,canEdit,multi,ph,style={}}){const[editing,setEditing]=useState(false);const[val,setVal]=useState(value);useEffect(()=>setVal(value),[value]);if(!canEdit)return<Linkify style={style}>{value||''}</Linkify>;if(!editing)return<span style={{...style,cursor:'pointer',borderBottom:'1px dashed #E3E1D8'}} onClick={()=>setEditing(true)}>{value?<Linkify style={style}>{value}</Linkify>:<span style={style}>{ph||'(кликни)'}</span>}</span>;const save=()=>{setEditing(false);if(val!==value)onSave(val)};if(multi)return<textarea value={val||''} onChange={e=>setVal(e.target.value)} onBlur={save} autoFocus rows={2} style={{width:'100%',padding:'6px 10px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:13,resize:'vertical',outline:'none',fontFamily:'inherit',...style}}/>;return<input value={val||''} onChange={e=>setVal(e.target.value)} onBlur={save} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus style={{width:'100%',padding:'4px 8px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:'inherit',outline:'none',...style}}/>}
function EdNum({value,onSave,canEdit,prefix,style={}}){const[editing,setEditing]=useState(false);const[val,setVal]=useState(String(value??''));useEffect(()=>setVal(String(value??'')),[value]);if(!canEdit)return<span style={style}>{prefix||''}{value??'—'}</span>;if(!editing)return<span style={{...style,cursor:'pointer',borderBottom:'1px dashed #E3E1D8'}} onClick={()=>setEditing(true)}>{prefix||''}{value??'—'}</span>;const save=()=>{setEditing(false);const n=val===''?null:Number(val);onSave(n)};return<input value={val} onChange={e=>setVal(e.target.value)} onBlur={save} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus type="number" style={{width:80,padding:'2px 6px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:'inherit',outline:'none',...style}}/>}
function EdDate({value,onSave,canEdit,style={}}){const[val,setVal]=useState(value||'');useEffect(()=>setVal(value||''),[value]);if(!canEdit)return<span style={{fontSize:12,color:S.i2,...style}}>{value||'—'}</span>;return<input type="date" value={val} onChange={e=>setVal(e.target.value)} onBlur={()=>{if(val!==(value||''))onSave(val||null)}} style={{fontSize:12,padding:'2px 6px',borderRadius:6,border:`1px solid ${S.ln}`,outline:'none',color:S.i2,...style}}/>}
function EList({items,onSave,canEdit,ph,color}){const[ni,setNi]=useState('');const add=()=>{if(!ni.trim())return;onSave([...(items||[]),ni.trim()]);setNi('')};return<div><ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.75,color:color||'inherit'}}>{(items||[]).map((t,i)=><li key={i} style={{display:'flex',alignItems:'flex-start',gap:6}}><Ed value={t} canEdit={canEdit} onSave={v=>{const n=[...(items||[])];n[i]=v;onSave(n)}} style={{flex:1,fontSize:13,color:'inherit'}}/>{canEdit&&<button onClick={()=>{const n=[...(items||[])];n.splice(i,1);onSave(n)}} style={{background:'none',border:'none',color:'#ccc',cursor:'pointer',fontSize:14,padding:0}}>×</button>}</li>)}</ul>{canEdit&&<div style={{display:'flex',gap:6,marginTop:6}}><input value={ni} onChange={e=>setNi(e.target.value)} placeholder={ph||'Добавить...'} onKeyDown={e=>e.key==='Enter'&&add()} style={{flex:1,padding:'4px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/><button onClick={add} style={{padding:'4px 12px',borderRadius:6,border:'none',background:S.gd,color:S.gp,fontSize:12,cursor:'pointer'}}>+</button></div>}</div>}

function Login(){const[e,setE]=useState('');const[p,setP]=useState('');const[err,setErr]=useState('');const[ld,setLd]=useState(false);const go=async()=>{setLd(true);setErr('');const{error}=await supabase.auth.signInWithPassword({email:e,password:p});if(error)setErr(error.message);setLd(false)};return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg}}><div style={{background:S.sf,borderRadius:16,padding:32,width:360,border:`0.5px solid ${S.ln}`}}><div style={{textAlign:'center',marginBottom:24}}><div style={{fontSize:24,fontWeight:600,color:S.gd}}>Growth Dashboard</div><div style={{fontSize:13,color:S.i3,marginTop:4}}>Lev Haolam</div></div><input value={e} onChange={ev=>setE(ev.target.value)} placeholder="Email" style={{width:'100%',padding:'10px 14px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,marginBottom:10,outline:'none'}}/><input value={p} onChange={ev=>setP(ev.target.value)} placeholder="Пароль" type="password" onKeyDown={ev=>ev.key==='Enter'&&go()} style={{width:'100%',padding:'10px 14px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,marginBottom:14,outline:'none'}}/>{err&&<div style={{color:S.rm,fontSize:13,marginBottom:10}}>{err}</div>}<button onClick={go} disabled={ld} style={{width:'100%',padding:'11px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:14,fontWeight:600,cursor:'pointer'}}>{ld?'...':'Войти'}</button></div></div>}

export default function App(){const[session,setSession]=useState(null);const[profile,setProfile]=useState(null);const[loading,setLoading]=useState(true);useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);useEffect(()=>{if(!session?.user)return setProfile(null);supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))},[session]);if(loading)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;if(!session)return<Login/>;if(!profile)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;return<Main profile={profile}/>}

function Main({profile}){
  const[view,setView]=useState('overview');const[reports,setReports]=useState([]);const[projects,setProjects]=useState([]);const[comments,setComments]=useState([]);const[aIdx,setAIdx]=useState(0);const[allProfiles,setAllProfiles]=useState([]);const[tTasks,setTTasks]=useState([]);const[tProgress,setTProgress]=useState([]);const[mPlans,setMPlans]=useState([])
  const aIdxRef=useRef(0)
  const load=useCallback(async()=>{
    const[r,p,c,tt,tp]=await Promise.all([supabase.from('weekly_reports').select('*').order('week_start'),supabase.from('projects').select('*').order('sort_order'),supabase.from('project_comments').select('*').order('created_at',{ascending:false}),supabase.from('tactical_tasks').select('*').order('sort_order'),supabase.from('tactical_progress').select('*').order('week_start')])
    try{const{data:mpd}=await supabase.from('monthly_plans').select('*').order('id');if(mpd)setMPlans(mpd)}catch(e){console.warn('monthly_plans:',e)}
    if(r.data){setReports(r.data);const max=r.data.length-1;setAIdx(prev=>{const safe=prev<=max?prev:max;aIdxRef.current=safe;return safe})}
    if(p.data)setProjects(p.data);if(c.data)setComments(c.data);if(tt.data)setTTasks(tt.data);if(tp.data)setTProgress(tp.data)
    if(profile.role==='admin'){const{data}=await supabase.from('profiles').select('*');if(data)setAllProfiles(data)}
  },[profile]);useEffect(()=>{load()},[load])
  const reload=useCallback(async()=>{const y=window.scrollY;await load();requestAnimationFrame(()=>window.scrollTo(0,y))},[load])

  const rep=reports[aIdx];const ce=profile.role==='admin'||profile.role==='editor';const isA=profile.role==='admin'
  const upRep=async u=>{if(!rep)return;await supabase.from('weekly_reports').update({...u,updated_at:new Date().toISOString()}).eq('id',rep.id);reload()}
  const setWeek=(i)=>{setAIdx(i);aIdxRef.current=i}
  const loadFromDaily=async(weekId,weekStart)=>{try{const r=await fetch(`/api/daily?weekStart=${weekStart}`);if(!r.ok)throw new Error('API недоступен');const d=await r.json();if(d.error)throw new Error(d.error);const{data:cur}=await supabase.from('weekly_reports').select('metrics,channels').eq('id',weekId).single();const upd={};if(d.days?.length){const d7=d.days.slice(0,7);while(d7.length<7)d7.push({day:'',sales:null,note:''});upd.daily_data=d7}upd.metrics={...(cur?.metrics||{}),totalSales:d.totalSales};if(d.channels?.length){const ec=cur?.channels||[];upd.channels=d.channels.map(c=>{const ex=ec.find(e=>e.name===c.name);return{name:c.name,sales:c.sales,spent:c.spent||0,cpo:c.cpo,prevSales:ex?.prevSales||null,prevCpo:ex?.prevCpo||null,planSales:ex?.planSales||null,planCpo:ex?.planCpo||null}})}if(Object.keys(upd).length){await supabase.from('weekly_reports').update({...upd,updated_at:new Date().toISOString()}).eq('id',weekId)}return d.daysFound||0}catch(e){console.warn('Daily import:',e.message);return 0}}
  const createWeek=async()=>{try{const last=reports[reports.length-1];const lsStr=last?last.week_start:new Date().toISOString().slice(0,10);const[ly,lm,ld]=lsStr.split('-').map(Number);const ns=new Date(ly,lm-1,ld+7);while(ns.getDay()!==1)ns.setDate(ns.getDate()-1);const ne=new Date(ns.getFullYear(),ns.getMonth(),ns.getDate()+6);const f=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;const label=`${f(ns)} – ${f(ne)}`;const wsStr=`${ns.getFullYear()}-${String(ns.getMonth()+1).padStart(2,'0')}-${String(ns.getDate()).padStart(2,'0')}`;const maxNum=reports.reduce((mx,r)=>{const m=r.id.match(/LH-(\d+)/);return m?Math.max(mx,parseInt(m[1])):mx},0);const id=`LH-${String(maxNum+1).padStart(5,'0')}`;const days=[];const dnL=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];for(let i=0;i<7;i++){const d=new Date(ns.getFullYear(),ns.getMonth(),ns.getDate()+i);days.push({day:`${dnL[i]} ${f(d)}`,sales:null,note:''})}const chs=(last?.channels||[]).map(c=>({...c,prevSales:c.sales,prevCpo:c.cpo,sales:null,cpo:null}));const{error}=await supabase.from('weekly_reports').insert({id,week_label:label,week_start:wsStr,status:'yellow',status_note:'',metrics:{planSales:last?.metrics?.planSales||null,budgetPlan:last?.metrics?.budgetPlan||null,planCpoAds:last?.metrics?.planCpoAds||null,planCpoTotal:last?.metrics?.planCpoTotal||null},channels:chs,improved:[],worsened:[],focus:last?.focus||[],asks:last?.asks||[],daily_data:days,pinned_projects:last?.pinned_projects||[],project_snapshots:[]});if(error){alert('Ошибка создания: '+error.message);return}const{data:fresh}=await supabase.from('weekly_reports').select('*').order('week_start');if(fresh){setReports(fresh);setWeek(fresh.length-1)};loadFromDaily(id,wsStr).then(n=>{if(n>0){alert(`✅ Загружено ${n} дней из Daily`);load()}})}catch(e){alert('Ошибка: '+e.message)}}
  const refreshFromDaily=async()=>{if(!rep)return;const d=new Date(rep.week_start+'T12:00:00');while(d.getDay()!==1)d.setDate(d.getDate()-1);const monStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const n=await loadFromDaily(rep.id,monStr);if(n>0)alert(`✅ Обновлено: ${n} дней`);else alert('Данные не найдены.')}
  const deleteWeek=async()=>{if(!rep)return;if(!confirm(`Удалить отчёт "${rep.week_label}"? Это действие необратимо.`))return;await supabase.from('weekly_reports').delete().eq('id',rep.id);const{data:fresh}=await supabase.from('weekly_reports').select('*').order('week_start');if(fresh){setReports(fresh);setWeek(Math.max(0,fresh.length-1))}}

  const tabs=[{id:'overview',l:'Обзор'},{id:'projects',l:'Проекты'},{id:'tactical',l:'Тактические'},{id:'plan',l:'План'},{id:'dynamics',l:'История'},{id:'trends',l:'Тренды'}];if(isA)tabs.push({id:'admin',l:'Настройки'})
  const printOverview=()=>{const el=document.getElementById('overview-print');if(!el)return;const w=window.open('','','width=900,height=700');w.document.write('<html><head><title>Growth Report '+rep?.week_label+'</title><style>body{font-family:-apple-system,sans-serif;padding:20px;color:#2C2C2A}table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;border:1px solid #E3E1D8;font-size:13px}</style></head><body>');w.document.write(el.innerHTML);w.document.write('</body></html>');w.document.close();w.print()}

  return<div style={{minHeight:'100vh',background:S.bg}}>
    <div style={{background:S.ink,padding:'6px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:11,color:'#aaa'}}>Lev Haolam · Growth Dashboard</span>
      <span style={{fontSize:11,color:S.gl}}>🟢 {profile.name||profile.email} <span style={{color:'#888'}}>({profile.role})</span></span>
    </div>
    <div style={{maxWidth:960,margin:'0 auto',padding:'20px 16px'}}>
    <div style={{background:S.gd,borderRadius:14,padding:'18px 22px',marginBottom:16}} className="no-print">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:12,letterSpacing:'.09em',textTransform:'uppercase',color:S.gs,fontWeight:600}}>Growth · еженедельный отчёт</div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:12,color:S.gs}}>{profile.name}</span>
          <button onClick={()=>supabase.auth.signOut()} style={{fontSize:12,color:S.gs,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>Выйти</button>
        </div>
      </div>
      {rep&&<><h1 style={{margin:'4px 0 0',fontSize:24,color:S.gp,fontFamily:'Georgia,serif',fontWeight:400}}>Неделя <Ed value={rep.week_label} canEdit={ce} onSave={v=>upRep({week_label:v})} style={{fontSize:24,color:S.gp,fontFamily:'Georgia,serif',fontWeight:400}}/></h1>
        <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {ce?<select value={rep.status} onChange={e=>upRep({status:e.target.value})} style={{fontSize:13,padding:'3px 11px',borderRadius:20,border:'none',background:STATUS_CFG[rep.status]?.bg,color:STATUS_CFG[rep.status]?.tx,cursor:'pointer',fontWeight:600}}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</select>:<Chip bg={STATUS_CFG[rep.status]?.bg} tx={STATUS_CFG[rep.status]?.tx}>{STATUS_CFG[rep.status]?.emoji} {STATUS_CFG[rep.status]?.label}</Chip>}
          <Ed value={rep.status_note} canEdit={ce} onSave={v=>upRep({status_note:v})} ph="Описание статуса..." style={{fontSize:13,color:S.gs}}/>
        </div>
      </>}
        <div style={{marginTop:10,display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          {reports.map((r,i)=><button key={r.id} onClick={()=>setWeek(i)} style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:i===aIdx?S.gp:'rgba(255,255,255,0.15)',color:i===aIdx?S.gd:S.gs}}>{r.week_label}</button>)}
          {ce&&<button onClick={createWeek} style={{padding:'4px 12px',borderRadius:14,border:'1px dashed rgba(255,255,255,0.4)',cursor:'pointer',fontSize:11,fontWeight:600,background:'transparent',color:S.gs}}>+ новая неделя</button>}
          {isA&&rep&&<button onClick={deleteWeek} style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,background:'rgba(224,75,74,0.3)',color:'#FFC1C1'}} title="Удалить текущий отчёт">🗑</button>}
        </div>
    </div>
    <div style={{display:'flex',gap:2,marginBottom:16,background:S.sf,borderRadius:10,padding:3,border:`0.5px solid ${S.ln}`}} className="no-print">
      {tabs.map(t=><button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,padding:'8px',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,background:view===t.id?S.gd:'transparent',color:view===t.id?S.gp:S.i2}}>{t.l}</button>)}
    </div>
    {view==='overview'&&rep&&<Overview rep={rep} reports={reports} projects={projects} comments={comments} ce={ce} up={upRep} tTasks={tTasks} tProgress={tProgress} print={printOverview} refreshDaily={refreshFromDaily} mPlans={mPlans}/>}
    {view==='projects'&&<Projects projects={projects} setProjects={setProjects} comments={comments} setComments={setComments} ce={ce} reports={reports} aIdx={aIdx} profile={profile} reload={reload}/>}
    {view==='tactical'&&<Tactical tasks={tTasks} progress={tProgress} reports={reports} aIdx={aIdx} ce={ce} reload={reload} profile={profile}/>}
    {view==='plan'&&<Plan plans={mPlans} ce={ce} reload={reload}/>}
    {view==='dynamics'&&<Dynamics projects={projects} comments={comments} reports={reports} aIdx={aIdx} ce={ce} reload={reload}/>}
    {view==='trends'&&<Trends reports={reports} mPlans={mPlans}/>}
    {view==='admin'&&isA&&<Admin profiles={allProfiles} projects={projects} reports={reports} aIdx={aIdx} reload={reload} rep={rep} upRep={upRep}/>}
  </div></div>
}

// ═══ OVERVIEW ═══
function Overview({rep,reports,projects,comments,ce,up,tTasks,tProgress,print,refreshDaily,mPlans}){
  const m=rep.metrics||{};const ch=rep.channels||[];const daily=rep.daily_data||[];const maxS=Math.max(...ch.map(c=>c.sales||0),1)
  const pins=rep.pinned_projects||[];const shown=pins.length>0?projects.filter(p=>pins.includes(p.id)):projects.filter(p=>p.priority==='key').slice(0,8)
  const DEFAULT_HIDDEN=['Reddit','Pinterest','Rumble','TikTok']
  const visCh=rep.visible_channels||(ch.map(c=>c.name).filter(n=>!DEFAULT_HIDDEN.includes(n)))
  const[showPaste,setShowPaste]=useState(false);const[pasteText,setPasteText]=useState('')
  // Get monthly plan for this week's month
  const weekMonth=rep.week_start?.slice(0,7);const mPlan=mPlans.find(p=>p.id===weekMonth)
  const cp=mPlan?.channel_plans||{};const dim=weekMonth?new Date(parseInt(weekMonth.slice(0,4)),parseInt(weekMonth.slice(5,7)),0).getDate():30
  // Weekly plan: manual override > monthly auto-calc
  const weekPlanSales=m.planSales!=null?m.planSales:(mPlan?.total_plan?Math.round(mPlan.total_plan/dim*7):null)
  // Channel plan mapper: monthlyPlanKey → channel name
  const chPlanMap={'Meta':'meta','Google':'google','Taboola':'newChannels','TikTok':'newChannels','Reddit':'newChannels','Pinterest':'newChannels','Rumble':'newChannels'}
  const chGroupCount={'meta':1,'google':1,'newChannels':ch.filter(c=>['Taboola','TikTok','Reddit','Pinterest','Rumble'].includes(c.name)&&(c.sales||0)>0).length||1}
  const getChPlan=(name)=>{const pk=chPlanMap[name];if(!pk)return{};const mp=cp[pk];if(!mp)return{};const cnt=chGroupCount[pk]||1;return{planSales:Math.round((mp.planSales||0)/dim*7/cnt),planCpo:mp.planCpo||null}}
  const upM=(k,v)=>up({metrics:{...m,[k]:v===''?null:isNaN(Number(v))?v:Number(v)}})
  const upCh=(idx,f,v)=>{const nc=[...ch];nc[idx]={...nc[idx],[f]:f==='name'?v:(v===''?null:Number(v))};up({channels:nc})}
  const addCh=()=>{const name=prompt('Название канала:');if(!name||!name.trim())return;up({channels:[...ch,{name:name.trim(),sales:0,prevSales:null,cpo:null,prevCpo:null,planSales:null,planCpo:null}]})}
  const remCh=(idx)=>{if(!confirm(`Удалить "${ch[idx]?.name}"?`))return;const nc=[...ch];nc.splice(idx,1);up({channels:nc})}
  const upDay=(idx,f,v)=>{const nd=[...daily];nd[idx]={...nd[idx],[f]:f==='note'||f==='day'?v:(v===''?null:Number(v))};up({daily_data:nd})}
  // CPO calcs — use spent from channels (imported from Daily)
  const adSpend=ch.reduce((s,c)=>s+(c.spent||0),0)
  const paidSales=ch.filter(c=>(c.spent||0)>0).reduce((s,c)=>s+(c.sales||0),0)
  const teamWeek=Math.round((mPlan?.team_budget||TEAM_MONTHLY)/dim*7)
  const calcCpoAds=paidSales>0?Math.round(adSpend/paidSales):null
  const calcCpoTotal=(m.totalSales||0)>0?Math.round((adSpend+teamWeek)/(m.totalSales||1)):null
  const cpoAds=m.cpoAdsOverride!=null?m.cpoAdsOverride:calcCpoAds
  const cpoTotal=m.cpoTotalOverride!=null?m.cpoTotalOverride:calcCpoTotal
  // Plan from monthly — manual override always wins
  const planCpoAds=m.planCpoAds!=null?m.planCpoAds:null
  const planCpoTotal=m.planCpoTotal!=null?m.planCpoTotal:null
  const ws=rep.week_start
  const getTP=(taskId)=>{const all=tProgress.filter(p=>p.task_id===taskId&&p.week_start<=ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return all[0]||null}
  // Paste daily data handler
  const applyPaste=()=>{try{const lines=pasteText.trim().split('\n').filter(l=>l.trim());const nd=[...daily];lines.forEach((line,i)=>{if(i>=7)return;const parts=line.split('\t');const sales=Number(parts[1]);if(!isNaN(sales)){nd[i]={...nd[i],sales,note:parts[2]||nd[i]?.note||''};}});const total=nd.reduce((s,d)=>s+(d?.sales||0),0);up({daily_data:nd,metrics:{...m,totalSales:total}});setShowPaste(false);setPasteText('')}catch(e){alert('Ошибка: '+e.message)}}
  // Refresh totals from daily data
  const refreshTotals=()=>{const total=daily.reduce((s,d)=>s+(d?.sales||0),0);up({metrics:{...m,totalSales:total}})}

  const[analyzing,setAnalyzing]=useState(false)
  const runAnalysis=async()=>{setAnalyzing(true);try{const prevRep=reports.find(r=>r.week_start<rep.week_start&&r.week_start!==rep.week_start);const body={week:rep.week_label,metrics:m,channels:ch,daily,prevMetrics:prevRep?.metrics,prevChannels:prevRep?.channels};const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(d.error)throw new Error(d.error);const upd={};if(d.improved?.length)upd.improved=d.improved;if(d.worsened?.length)upd.worsened=d.worsened;if(d.insights)upd.metrics={...m,aiInsights:d.insights};if(Object.keys(upd).length)up(upd);alert('✅ Анализ готов!')}catch(e){alert('Ошибка анализа: '+e.message)}finally{setAnalyzing(false)}}

  return<div id="overview-print"><>
    <div style={{display:'flex',gap:8,marginBottom:14,fontSize:11,color:S.i3,flexWrap:'wrap',alignItems:'center'}}>
      {Object.entries(STATUS_CFG).map(([k,v])=><span key={k} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:'50%',background:v.bg,border:`1px solid ${v.tx}`}}/>{v.emoji} {v.desc}</span>)}
      <span style={{marginLeft:'auto',display:'flex',gap:4}}>
        {ce&&<button onClick={()=>setShowPaste(true)} style={{fontSize:11,color:S.gd,background:S.gp,border:`1px solid ${S.ln}`,borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>📊 Вставить вручную</button>}
        {ce&&refreshDaily&&<button onClick={refreshDaily} style={{fontSize:11,color:S.sf,background:S.bm,border:'none',borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>📥 Из Daily Sheet</button>}
        {ce&&<button onClick={refreshTotals} style={{fontSize:11,color:S.bm,background:S.sf,border:`1px solid ${S.ln}`,borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>🔄 Обновить итоги</button>}
        <button onClick={print} style={{fontSize:11,color:S.gd,background:S.sf,border:`1px solid ${S.ln}`,borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>📄 PDF</button>
      </span>
    </div>

    {showPaste&&<div style={{background:S.sf,border:`1px solid ${S.gl}`,borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>Вставь данные из Google Sheets</div>
      <div style={{fontSize:11,color:S.i3,marginBottom:8}}>Формат: каждая строка = день. Колонки через TAB: День | Продажи | Заметка</div>
      <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} rows={8} placeholder={"Пн 07.07\t45\tнорм\nВт 08.07\t52\tхороший день\n..."} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:12,outline:'none',fontFamily:'monospace'}}/>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button onClick={applyPaste} style={{padding:'8px 20px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:13,fontWeight:600,cursor:'pointer'}}>Применить</button>
        <button onClick={()=>{setShowPaste(false);setPasteText('')}} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${S.ln}`,background:'transparent',fontSize:13,cursor:'pointer'}}>Отмена</button>
      </div>
    </div>}

    <Label>Ключевые метрики</Label>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
      {[
        {l:'Продажи',k:'totalSales'},
        {l:'CPO Ads',k2:'cpoAdsOverride',v2:cpoAds,calc:calcCpoAds,pre:'$'},
        {l:'CPO Total',k2:'cpoTotalOverride',v2:cpoTotal,calc:calcCpoTotal,pre:'$'},
        {l:'Бюджет Ads',k2:'budgetSpent',v2:m.budgetSpent!=null?m.budgetSpent:adSpend,calc:adSpend,pre:'$'},
      ].map((x,i)=><div key={i} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:12,color:S.i3}}>{x.l}</div>
        <div style={{fontSize:22,fontWeight:500,margin:'2px 0'}}>
          {x.k?<>{x.pre||''}<EdNum value={m[x.k]} canEdit={ce} onSave={v=>upM(x.k,v)} style={{fontSize:22,fontWeight:500}}/></>
          :x.k2?<>{x.pre||''}<EdNum value={x.v2} canEdit={ce} onSave={v=>upM(x.k2,v===x.calc?null:v)} style={{fontSize:22,fontWeight:500}}/></>
          :x.v}
        </div>
        <div style={{fontSize:12,color:S.i2,display:'flex',alignItems:'center',gap:4}}>
          {i===0&&<>план <EdNum value={weekPlanSales||m.planSales} canEdit={ce} onSave={v=>upM('planSales',v)} style={{fontSize:12,color:S.i2}}/></>}
          {i===1&&<>план $<EdNum value={m.planCpoAds!=null?m.planCpoAds:planCpoAds} canEdit={ce} onSave={v=>upM('planCpoAds',v)} style={{fontSize:12,color:S.i2}}/></>}
          {i===2&&<>план $<EdNum value={m.planCpoTotal!=null?m.planCpoTotal:planCpoTotal} canEdit={ce} onSave={v=>upM('planCpoTotal',v)} style={{fontSize:12,color:S.i2}}/></>}
          {i===3&&<>из $<EdNum value={m.budgetPlan!=null?m.budgetPlan:(mPlan?.ads_budget?Math.round(mPlan.ads_budget/dim*7):null)} canEdit={ce} onSave={v=>upM('budgetPlan',v)} style={{fontSize:12,color:S.i2}}/>K</>}
        </div>
      </div>)}
    </div>

    <Label>Брэкдаун по дням</Label>
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,marginBottom:16}}>
      {(daily.length>0?daily:Array(7).fill(null)).map((d,i)=><div key={i} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'8px 4px',textAlign:'center'}}>
        <Ed value={d?.day||''} canEdit={ce} onSave={v=>upDay(i,'day',v)} style={{fontSize:11,color:S.i3}}/>
        <div style={{margin:'4px 0'}}><EdNum value={d?.sales} canEdit={ce} onSave={v=>upDay(i,'sales',v)} style={{fontSize:18,fontWeight:500}}/></div>
        <Ed value={d?.note||(d?.sales==null?'—':'продаж')} canEdit={ce} onSave={v=>upDay(i,'note',v)} style={{fontSize:10,color:d?.sales==null?'#BA7517':S.i2}}/>
      </div>)}
    </div>

    <Label>Каналы</Label>
    <div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,overflow:'hidden',marginBottom:16}}>
      <div style={{display:'grid',gridTemplateColumns:'110px 1fr 46px 46px 38px 38px 52px 52px 38px',gap:3,padding:'8px 12px',background:S.bg,fontSize:10,color:S.i3,fontWeight:600,textTransform:'uppercase'}}>
        <span>Канал</span><span>прогресс</span><span style={{textAlign:'right'}}>Прод</span><span style={{textAlign:'right'}}>План</span><span style={{textAlign:'right'}}>%</span><span style={{textAlign:'right'}}>Δ</span><span style={{textAlign:'right'}}>CPO</span><span style={{textAlign:'right'}}>CPO пл</span><span style={{textAlign:'right'}}>Δ cpo</span>
      </div>
      {ch.filter(c=>!visCh||visCh.includes(c.name)).map((c,i)=>{const ci=ch.indexOf(c);const mp=getChPlan(c.name);const ps=c.planSales!=null?c.planSales:(mp.planSales||0);const barPct=ps?(Math.min((c.sales||0)/ps*100,100)):((c.sales||0)>0?100:0);const barColor=ps?((c.sales||0)>=ps?'#1D9E75':(c.sales||0)>=ps*0.7?'#EF9F27':'#E24B4A'):((c.sales||0)>0?S.gl:'#E3E1D8');const chCpo=(c.spent&&c.sales)?Math.round(c.spent/c.sales):c.cpo
        return<div key={i} style={{display:'grid',gridTemplateColumns:'110px 1fr 46px 46px 38px 38px 52px 52px 38px',gap:3,padding:'5px 12px',borderBottom:`0.5px solid ${S.ln}`,alignItems:'center',fontSize:13}}>
        <div style={{display:'flex',alignItems:'center',gap:3}}>
          {ce&&<button onClick={()=>remCh(ci)} style={{background:'none',border:'none',color:'#ccc',cursor:'pointer',fontSize:11,padding:0,lineHeight:1}}>×</button>}
          <Ed value={c.name} canEdit={ce} onSave={v=>upCh(ci,'name',v)} style={{fontWeight:500,fontSize:12}}/>
        </div>
        <div style={{height:7,background:S.bg,borderRadius:20,overflow:'hidden'}}><div style={{height:7,borderRadius:20,width:`${barPct}%`,background:barColor}}/></div>
        <span style={{textAlign:'right'}}><EdNum value={c.sales} canEdit={ce} onSave={v=>upCh(ci,'sales',v)} style={{fontWeight:500,fontSize:13}}/></span>
        <span style={{textAlign:'right'}}><EdNum value={c.planSales!=null?c.planSales:mp.planSales} canEdit={ce} onSave={v=>upCh(ci,'planSales',v)} style={{fontSize:12,color:S.i3}}/></span>
        <span style={{textAlign:'right'}}><PlanChip fact={c.sales} plan={c.planSales!=null?c.planSales:mp.planSales}/></span>
        <span style={{textAlign:'right'}}><DChip d={pct(c.sales,c.prevSales)}/></span>
        <span style={{textAlign:'right'}}><EdNum value={chCpo} canEdit={ce} prefix="$" onSave={v=>upCh(ci,'cpo',v)} style={{fontSize:12,color:S.i2}}/></span>
        <span style={{textAlign:'right'}}><EdNum value={c.planCpo!=null?c.planCpo:mp.planCpo} canEdit={ce} prefix="$" onSave={v=>upCh(ci,'planCpo',v)} style={{fontSize:12,color:S.i3}}/></span>
        <span style={{textAlign:'right'}}><CpoCompare fact={chCpo} plan={c.planCpo!=null?c.planCpo:mp.planCpo}/></span>
      </div>})}
      {ce&&<div style={{padding:'8px 12px'}}><button onClick={addCh} style={{fontSize:12,color:S.gd,background:'none',border:`1px dashed ${S.ln}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',width:'100%'}}>+ Добавить канал</button></div>}
    </div>

    <Label>Тактические задачи <span style={{fontWeight:400,color:S.i3}}>· до 01.01.2027</span></Label>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
      {tTasks.filter(t=>!t.hidden).map(t=>{const tp=getTP(t.id);const ms=t.milestones||[];let pctVal=0,label='';if(t.target_type==='numeric'){pctVal=t.target_value?(Math.round(((tp?.current_value||0)/t.target_value)*100)):0;label=`${tp?.current_value||0} / ${t.target_value}`}else{const cur=tp?.milestone_status||0;pctVal=ms.length?Math.round(cur/ms.length*100):0;label=cur>0&&cur<=ms.length?ms[cur-1]?.name:'Не начато'}
        return<div key={t.id} style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:10,padding:'10px 14px'}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{t.name}</div>
          <div style={{height:8,background:S.bg,borderRadius:20,overflow:'hidden',marginBottom:4}}><div style={{height:8,borderRadius:20,background:pctVal>=80?'#1D9E75':pctVal>=50?'#EF9F27':'#E24B4A',width:`${Math.min(pctVal,100)}%`}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:S.i2}}><span>{label}</span><span style={{fontWeight:600}}>{pctVal}%</span></div>
          {tp?.comments?.length>0&&<div style={{fontSize:11,color:S.i3,marginTop:4,fontStyle:'italic'}}>💬 {tp.comments[tp.comments.length-1]?.text?.slice(0,60)}</div>}
          {!tp?.comments?.length&&tp?.comment&&<div style={{fontSize:11,color:S.i3,marginTop:4,fontStyle:'italic'}}>💬 {tp.comment}</div>}
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

    <div style={{display:'flex',gap:12,marginBottom:12}}>
      <div style={{flex:1,background:'#EAF3DE',borderRadius:12,padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:11,color:'#7C9F55',fontWeight:600}}>🤖 Анализ · Улучшилось</div>
          {ce&&<button onClick={runAnalysis} disabled={analyzing} style={{fontSize:10,color:'#fff',background:'#7C9F55',border:'none',borderRadius:4,padding:'3px 10px',cursor:'pointer',fontWeight:600}}>{analyzing?'⏳ анализ...':'🤖 Запустить анализ'}</button>}
        </div>
        <EList items={rep.improved} canEdit={ce} onSave={v=>up({improved:v})} color="#27500A"/>
      </div>
      <div style={{flex:1,background:'#FCEBEB',borderRadius:12,padding:'14px 16px'}}>
        <div style={{fontSize:11,color:'#C77',fontWeight:600,marginBottom:6}}>🤖 Анализ · Ухудшилось</div>
        <EList items={rep.worsened} canEdit={ce} onSave={v=>up({worsened:v})} color="#791F1F"/>
      </div>
    </div>
    {m.aiInsights&&<div style={{background:'#F0EAFC',borderRadius:12,padding:'14px 16px',marginBottom:12}}><div style={{fontSize:11,color:'#7B5EA7',fontWeight:600,marginBottom:4}}>💡 Инсайты от Claude</div><Linkify style={{fontSize:13,color:'#4A3372',lineHeight:1.6}}>{m.aiInsights}</Linkify></div>}
    <div style={{display:'flex',gap:12,marginBottom:16}}>
      <div style={{flex:1,background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:13,fontWeight:600,color:'#3B6D11',marginBottom:6}}>✏️ Дополнения</div><EList items={rep.manual_improved} canEdit={ce} onSave={v=>up({manual_improved:v})} color="#27500A"/></div>
      <div style={{flex:1,background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:13,fontWeight:600,color:'#A32D2D',marginBottom:6}}>✏️ Дополнения</div><EList items={rep.manual_worsened} canEdit={ce} onSave={v=>up({manual_worsened:v})} color="#791F1F"/></div>
    </div>
    <div style={{background:'#D6E8FA',borderRadius:12,padding:'14px 16px',marginBottom:12}}><div style={{fontSize:13,fontWeight:600,color:'#0C447C',marginBottom:6}}>Фокус на следующую неделю</div><EList items={rep.focus} canEdit={ce} onSave={v=>up({focus:v})} color="#0C447C"/></div>
    <div style={{background:S.gd,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:13,fontWeight:600,color:S.gs,marginBottom:6}}>Нужно от руководства</div><div style={{color:S.gp}}><EList items={rep.asks} canEdit={ce} onSave={v=>up({asks:v})}/></div></div>
  </></div>
}

// ═══ TACTICAL TASKS ═══
function Tactical({tasks,progress,reports,aIdx,ce,reload,profile}){
  const rep=reports[aIdx];const ws=rep?.week_start;const[showAdd,setShowAdd]=useState(false);const[newName,setNewName]=useState('');const[newType,setNewType]=useState('numeric');const[newTarget,setNewTarget]=useState('');const[newMs,setNewMs]=useState([{name:''}]);const[showHidden,setShowHidden]=useState(false);const tcRef=useRef('')
  const getTP=(tid)=>progress.filter(p=>p.task_id===tid&&p.week_start<=ws).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0]||null
  const getAllTP=(tid)=>progress.filter(p=>p.task_id===tid).sort((a,b)=>b.week_start.localeCompare(a.week_start))
  const upsertTP=async(tid,updates)=>{const existing=progress.find(p=>p.task_id===tid&&p.week_start===ws);if(existing){await supabase.from('tactical_progress').update(updates).eq('id',existing.id)}else{await supabase.from('tactical_progress').insert({task_id:tid,week_start:ws,...updates})};reload()}
  const daysLeft=Math.ceil((new Date('2027-01-01')-new Date())/(1000*60*60*24))
  const toggleHide=async(t)=>{await supabase.from('tactical_tasks').update({hidden:!t.hidden}).eq('id',t.id);reload()}
  const addTask=async()=>{if(!newName.trim())return;const maxSort=Math.max(0,...tasks.map(t=>t.sort_order||0))+1;const obj={id:newName.trim().toLowerCase().replace(/[^a-zа-яё0-9]/gi,'_').slice(0,30)+'_'+Date.now()%1000,name:newName.trim(),target_type:newType,sort_order:maxSort,hidden:false};if(newType==='numeric'){obj.target_value=Number(newTarget)||0}else{obj.milestones=newMs.filter(m=>m.name.trim()).map(m=>({name:m.name.trim()}))};await supabase.from('tactical_tasks').insert(obj);setNewName('');setNewTarget('');setNewMs([{name:''}]);setShowAdd(false);reload()}
  const updateMilestone=async(task,mIdx,name)=>{const ms=[...(task.milestones||[])];ms[mIdx]={...ms[mIdx],name};await supabase.from('tactical_tasks').update({milestones:ms}).eq('id',task.id);reload()}
  const addMilestone=async(task)=>{const name=prompt('Название нового этапа:');if(!name?.trim())return;const ms=[...(task.milestones||[]),{name:name.trim()}];await supabase.from('tactical_tasks').update({milestones:ms}).eq('id',task.id);reload()}
  const removeMilestone=async(task,mIdx)=>{if(!confirm('Удалить этап?'))return;const ms=[...(task.milestones||[])];ms.splice(mIdx,1);await supabase.from('tactical_tasks').update({milestones:ms}).eq('id',task.id);reload()}
  const visible=tasks.filter(t=>!t.hidden);const hidden=tasks.filter(t=>t.hidden)
  const TaskCard=({t})=>{const tp=getTP(t.id);const ms=t.milestones||[];const history=getAllTP(t.id);let pctVal=0;if(t.target_type==='numeric'){pctVal=t.target_value?Math.round(((tp?.current_value||0)/t.target_value)*100):0}else{const cur=tp?.milestone_status||0;pctVal=ms.length?Math.round(cur/ms.length*100):0}
    return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:16,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={{fontSize:15,fontWeight:500}}>{t.name}</span><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:20,fontWeight:700,color:pctVal>=80?'#1D7A3F':pctVal>=50?'#BA7517':'#A32D2D'}}>{pctVal}%</span>{ce&&<button onClick={()=>toggleHide(t)} title={t.hidden?'Показать':'Скрыть'} style={{fontSize:14,background:'none',border:'none',cursor:'pointer',color:S.i3}}>{t.hidden?'👁':'🙈'}</button>}</div></div>
      <div style={{height:10,background:S.bg,borderRadius:20,overflow:'hidden',marginBottom:8}}><div style={{height:10,borderRadius:20,background:pctVal>=80?S.gm:pctVal>=50?S.am:S.rm,width:`${Math.min(pctVal,100)}%`,transition:'width 0.3s'}}/></div>
      {t.target_type==='numeric'&&<div style={{display:'flex',gap:16,alignItems:'center',marginBottom:8}}><span style={{fontSize:13,color:S.i2}}>Цель: <EdNum value={t.target_value} canEdit={ce} onSave={async v=>{await supabase.from('tactical_tasks').update({target_value:v}).eq('id',t.id);reload()}} style={{fontWeight:600}}/></span><span style={{fontSize:13,color:S.i2}}>Факт: <EdNum value={tp?.current_value} canEdit={ce} onSave={v=>upsertTP(t.id,{current_value:v})} style={{fontWeight:600}}/></span></div>}
      {t.target_type==='milestone'&&<div style={{marginBottom:8}}>{ce?<div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>{ms.map((m,mi)=><div key={mi} style={{display:'flex',alignItems:'center',gap:2}}><button onClick={()=>upsertTP(t.id,{milestone_status:mi+1})} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${(tp?.milestone_status||0)>=mi+1?S.gd:S.ln}`,background:(tp?.milestone_status||0)>=mi+1?'#C0DD97':'transparent',color:(tp?.milestone_status||0)>=mi+1?'#27500A':S.i3,fontSize:12,cursor:'pointer',fontWeight:500}}><Ed value={m.name} canEdit={ce} onSave={v=>updateMilestone(t,mi,v)} style={{fontSize:12}}/></button>{ce&&<button onClick={()=>removeMilestone(t,mi)} style={{background:'none',border:'none',color:'#ccc',cursor:'pointer',fontSize:10,padding:0}}>×</button>}</div>)}<button onClick={()=>addMilestone(t)} style={{padding:'4px 8px',borderRadius:8,border:`1px dashed ${S.ln}`,background:'transparent',color:S.i3,fontSize:11,cursor:'pointer'}}>+</button></div>:<div style={{fontSize:13,color:S.i2}}>Стадия: {(tp?.milestone_status||0)>0?ms[(tp?.milestone_status||1)-1]?.name:'Не начато'}</div>}</div>}
      {/* Description */}
      {(t.description||ce)&&<div style={{marginTop:6,marginBottom:6}}><Ed value={t.description||''} canEdit={ce} multi onSave={async v=>{await supabase.from('tactical_tasks').update({description:v}).eq('id',t.id);reload()}} ph="Описание задачи..." style={{fontSize:12,color:S.i3,lineHeight:1.5}}/></div>}
      {/* Weekly comments */}
      <div style={{marginTop:8}}>
        {(tp?.comments||[]).map((c,ci)=><div key={c.id||ci} style={{marginTop:4,padding:'6px 10px',background:S.bg,borderRadius:6}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:S.i3}}><span><b>{c.author}</b> · {c.at?.slice(0,10)||ws}</span>
            {ce&&<div style={{display:'flex',gap:4}}><button onClick={()=>{const v=prompt('Редактировать:',c.text);if(v!=null){const cs=[...(tp.comments||[])];cs[ci]={...cs[ci],text:v};upsertTP(t.id,{comments:cs})}}} style={{fontSize:10,background:'none',border:'none',cursor:'pointer',color:S.bm}}>✏️</button><button onClick={()=>{if(!confirm('Удалить?'))return;const cs=(tp.comments||[]).filter((_,i)=>i!==ci);upsertTP(t.id,{comments:cs})}} style={{fontSize:10,background:'none',border:'none',cursor:'pointer',color:'#ccc'}}>🗑</button></div>}
          </div>
          <Linkify style={{fontSize:13,color:S.ink}}>{c.text}</Linkify>
        </div>)}
        {ce&&<div style={{display:'flex',gap:6,marginTop:6}}><input id={'tc-'+t.id} defaultValue="" onChange={e=>tcRef.current=e.target.value} placeholder="Комментарий..." onKeyDown={e=>{if(e.key==='Enter'){const v=tcRef.current;if(!v.trim())return;const cs=[...(tp?.comments||[]),{id:'tc'+Date.now(),text:v.trim(),author:profile?.name||'',at:new Date().toISOString()}];upsertTP(t.id,{comments:cs});tcRef.current='';e.target.value=''}}} style={{flex:1,padding:'6px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/><button onClick={()=>{const v=tcRef.current;if(!v.trim())return;const cs=[...(tp?.comments||[]),{id:'tc'+Date.now(),text:v.trim(),author:profile?.name||'',at:new Date().toISOString()}];upsertTP(t.id,{comments:cs});tcRef.current='';const el=document.getElementById('tc-'+t.id);if(el)el.value=''}} style={{padding:'6px 12px',borderRadius:6,border:'none',background:S.gd,color:S.gp,fontSize:12,cursor:'pointer'}}>→</button></div>}
      </div>
      {history.length>1&&<details style={{marginTop:10}}><summary style={{fontSize:12,color:S.gm,cursor:'pointer'}}>История ({history.length} нед.)</summary><div style={{marginTop:8,borderLeft:`3px solid ${S.gl}`,paddingLeft:12}}>{history.map((h,hi)=>{const wl=reports.find(r=>r.week_start===h.week_start)?.week_label||h.week_start;return<div key={hi} style={{marginBottom:8,paddingBottom:8,borderBottom:`0.5px solid ${S.ln}`}}><div style={{fontSize:12,fontWeight:600,color:S.gd}}>{wl}</div><div style={{fontSize:12,color:S.i2}}>{t.target_type==='numeric'?`Факт: ${h.current_value||0}`:ms[(h.milestone_status||1)-1]?.name||'—'}</div>{h.comment&&<div style={{fontSize:12,color:S.i3,fontStyle:'italic'}}>{h.comment}</div>}{(h.comments||[]).map((c,ci)=><div key={ci} style={{fontSize:12,color:S.i3,marginTop:2}}><b>{c.author}</b>: <Linkify style={{color:S.ink}}>{c.text}</Linkify></div>)}</div>})}</div></details>}
    </div>}
  return<><div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:13,color:S.i2}}>📅 <b>{rep?.week_label||'—'}</b></span><div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:13,color:daysLeft<180?S.rm:S.i2,fontWeight:600}}>До дедлайна: {daysLeft} дней</span>{ce&&<button onClick={()=>setShowAdd(!showAdd)} style={{fontSize:12,color:S.gd,background:S.gp,border:'none',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontWeight:600}}>{showAdd?'✕':'+ задача'}</button>}</div></div>
    {showAdd&&<div style={{background:S.sf,border:`0.5px solid ${S.gl}`,borderRadius:12,padding:16,marginBottom:16}}><div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Новая задача</div><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Название" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:13,outline:'none',marginBottom:8}}/><div style={{display:'flex',gap:8,marginBottom:8}}><button onClick={()=>setNewType('numeric')} style={{flex:1,padding:'8px',borderRadius:8,border:`1px solid ${newType==='numeric'?S.gd:S.ln}`,background:newType==='numeric'?S.gp:'transparent',color:newType==='numeric'?S.gd:S.i2,fontSize:12,cursor:'pointer',fontWeight:600}}>🔢 Цифровая</button><button onClick={()=>setNewType('milestone')} style={{flex:1,padding:'8px',borderRadius:8,border:`1px solid ${newType==='milestone'?S.gd:S.ln}`,background:newType==='milestone'?S.gp:'transparent',color:newType==='milestone'?S.gd:S.i2,fontSize:12,cursor:'pointer',fontWeight:600}}>🏁 Этапы</button></div>{newType==='numeric'&&<input value={newTarget} onChange={e=>setNewTarget(e.target.value)} placeholder="Целевое значение" type="number" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:13,outline:'none',marginBottom:8}}/>}{newType==='milestone'&&<div style={{marginBottom:8}}>{newMs.map((m,i)=><div key={i} style={{display:'flex',gap:6,marginBottom:4}}><input value={m.name} onChange={e=>{const u=[...newMs];u[i]={name:e.target.value};setNewMs(u)}} placeholder={`Этап ${i+1}`} style={{flex:1,padding:'6px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/>{newMs.length>1&&<button onClick={()=>setNewMs(newMs.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'#ccc',cursor:'pointer'}}>×</button>}</div>)}<button onClick={()=>setNewMs([...newMs,{name:''}])} style={{fontSize:12,color:S.gd,background:'none',border:`1px dashed ${S.ln}`,borderRadius:6,padding:'4px 12px',cursor:'pointer',width:'100%'}}>+ этап</button></div>}<button onClick={addTask} disabled={!newName.trim()} style={{padding:'8px 20px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:13,fontWeight:600,cursor:'pointer'}}>Создать</button></div>}
    {visible.map(t=><TaskCard key={t.id} t={t}/>)}
    {hidden.length>0&&<div style={{marginTop:12}}><button onClick={()=>setShowHidden(!showHidden)} style={{fontSize:12,color:S.i3,background:'none',border:'none',cursor:'pointer',padding:0}}>{showHidden?'▲':'▼'} Скрытые ({hidden.length})</button>{showHidden&&<div style={{marginTop:8,opacity:0.6}}>{hidden.map(t=><TaskCard key={t.id} t={t}/>)}</div>}</div>}
  </>
}

// ═══ PROJECTS ═══
function Projects({projects,setProjects,comments,setComments,ce,reports,aIdx,profile,reload}){
  const[exp,setExp]=useState(null);const ncRef=useRef('');const[sav,setSav]=useState(false)
  const[fPri,setFPri]=useState('all');const[fSt,setFSt]=useState('all')
  const[showNewP,setShowNewP]=useState(false);const[np,setNp]=useState({id:'',name:'',owner:'',priority:'current'})
  const rep=reports[aIdx];const ws=rep?.week_start
  const upProj=async(id,f,v)=>{setProjects(prev=>prev.map(p=>p.id===id?{...p,[f]:v}:p));supabase.from('projects').update({[f]:v}).eq('id',id)}
  const delProj=async(id,name)=>{if(!confirm(`Удалить проект "${name}"?`))return;setProjects(prev=>prev.filter(p=>p.id!==id));supabase.from('project_comments').delete().eq('project_id',id);supabase.from('projects').delete().eq('id',id)}
  const addProj=async()=>{if(!np.id.trim()||!np.name.trim())return;const maxSort=Math.max(0,...projects.map(p=>p.sort_order||0))+1;const obj={id:np.id.trim(),name:np.name.trim(),owner:np.owner.trim()||'—',priority:np.priority,status:'wait',sort_order:maxSort};setProjects(prev=>[...prev,obj]);setNp({id:'',name:'',owner:'',priority:'current'});setShowNewP(false);const{error}=await supabase.from('projects').insert(obj);if(error)alert('Ошибка: '+error.message)}
  const addC=async pid=>{const nc=ncRef.current;if(!nc.trim())return;setSav(true);const sum=nc.length>150?nc.slice(0,120).replace(/\s\S*$/,'')+'…':nc;const obj={id:crypto.randomUUID?crypto.randomUUID():'c'+Date.now(),project_id:pid,author:profile.name||profile.email,full_text:nc,summary:sum,week_start:ws||new Date().toISOString().slice(0,10),created_at:new Date().toISOString()};setComments(prev=>[obj,...prev]);ncRef.current='';const el=document.getElementById('nc-'+pid);if(el)el.value='';setSav(false);supabase.from('project_comments').insert({project_id:pid,author:obj.author,full_text:obj.full_text,summary:obj.summary,week_start:obj.week_start})}
  const delC=async(cid)=>{if(!confirm('Удалить комментарий?'))return;setComments(prev=>prev.filter(c=>c.id!==cid));supabase.from('project_comments').delete().eq('id',cid)}
  const getWC=pid=>comments.filter(c=>c.project_id===pid&&c.week_start===ws)
  const getPrev=pid=>{const s=comments.filter(c=>c.project_id===pid&&c.week_start<ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return s[0]||null}
  const sortP=(arr)=>[...arr].sort((a,b)=>{if(a.status==='blocked'&&b.status!=='blocked')return -1;if(b.status==='blocked'&&a.status!=='blocked')return 1;return(a.sort_order||0)-(b.sort_order||0)})
  const setConstraints=async(pid,v)=>{setProjects(prev=>prev.map(p=>p.id===pid?{...p,constraints_text:v}:p));await supabase.from('projects').update({constraints_text:v}).eq('id',pid);const proj=projects.find(p=>p.id===pid);if(v&&v.trim()&&proj?.status!=='blocked'){if(confirm('Поставить статус "блокер"?')){setProjects(prev=>prev.map(p=>p.id===pid?{...p,status:'blocked'}:p));supabase.from('projects').update({status:'blocked'}).eq('id',pid)}}else if((!v||!v.trim())&&proj?.status==='blocked'){if(confirm('Снять статус "блокер"?')){setProjects(prev=>prev.map(p=>p.id===pid?{...p,status:'progress'}:p));supabase.from('projects').update({status:'progress'}).eq('id',pid)}}}
  const fmtDate=(d)=>{if(!d)return null;const p=d.split('-');return`${p[2]}.${p[1]}`}
  const dates=(p)=>[p.date_start&&`с ${fmtDate(p.date_start)}`,p.date_test&&`тест ${fmtDate(p.date_test)}`,p.date_done&&`✓ ${fmtDate(p.date_done)}`].filter(Boolean).join(' · ')
  // Separate active vs archive (done)
  const active=projects.filter(p=>p.status!=='done')
  const archive=projects.filter(p=>p.status==='done')
  let filtered=active
  if(fPri==='key')filtered=filtered.filter(p=>p.priority==='key')
  if(fPri==='current')filtered=filtered.filter(p=>p.priority==='current')
  if(fSt!=='all')filtered=filtered.filter(p=>p.status===fSt)
  const keyP=sortP(filtered.filter(p=>p.priority==='key'));const curP=sortP(filtered.filter(p=>p.priority==='current'))
  const secs=fPri==='all'?[{t:'🔴 Ключевые',items:keyP},{t:'🔵 Текущие',items:curP}]:fPri==='key'?[{t:'🔴 Ключевые',items:keyP}]:[{t:'🔵 Текущие',items:curP}]

  const ProjCard=({p})=>{const ps=PROJ_ST[p.status]||PROJ_ST.wait;const wcs=getWC(p.id);const prev=getPrev(p.id);const isO=exp===p.id;const isBlocked=p.status==='blocked';const hasBlock=p.constraints_text&&p.constraints_text.trim();const ds=dates(p)
    return<div style={{background:isBlocked?'#FFF0F0':S.sf,border:`0.5px solid ${isO?S.gl:isBlocked?'#E8AAAA':S.ln}`,borderRadius:12,padding:'12px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,cursor:'pointer'}} onClick={()=>setExp(isO?null:p.id)}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>{isBlocked&&<span style={{fontSize:16}} title="Блокер">🛑</span>}<Ed value={p.name} canEdit={ce} onSave={v=>upProj(p.id,'name',v)} style={{fontWeight:500}}/><span style={{fontSize:12,color:S.i3}}>{p.id} · {p.owner}</span></div>
          {ds&&<div style={{fontSize:11,color:S.i3,marginTop:2}}>📅 {ds}</div>}
          {hasBlock&&!isO&&<div style={{fontSize:11,color:'#791F1F',marginTop:2}}>⚠️ {p.constraints_text.slice(0,60)}{p.constraints_text.length>60?'…':''}</div>}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>{ce?<select value={p.status} onClick={e=>e.stopPropagation()} onChange={e=>upProj(p.id,'status',e.target.value)} style={{fontSize:12,padding:'2px 6px',borderRadius:6,border:`1px solid ${S.ln}`,background:ps.bg,color:ps.tx,cursor:'pointer'}}>{Object.entries(PROJ_ST).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select>:<Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip>}{ce&&<button onClick={e=>{e.stopPropagation();delProj(p.id,p.name)}} style={{fontSize:12,background:'none',border:'none',cursor:'pointer',color:'#ccc'}} title="Удалить">🗑</button>}<span style={{color:S.i3}}>{isO?'▲':'▼'}</span></div>
      </div>
      {wcs.map(c=><CItem key={c.id} c={c} ce={ce} reload={reload} onDel={()=>delC(c.id)}/>)}
      {wcs.length===0&&prev&&<div style={{marginTop:6,padding:'8px 12px',background:'#FFF9E6',borderRadius:8,border:'1px dashed #EAD89B'}}><div style={{fontSize:10,color:'#BA7517'}}>⏮ {prev.week_start} ({prev.author})</div><div style={{fontSize:13,color:S.i3,fontStyle:'italic'}}>{prev.summary||prev.full_text?.slice(0,120)}</div></div>}
      {isO&&<div onClick={e=>e.stopPropagation()} style={{marginTop:12,borderTop:`0.5px solid ${S.ln}`,paddingTop:12}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>{[{l:'Начало',f:'date_start'},{l:'Тест',f:'date_test'},{l:'Результаты',f:'date_results'},{l:'Завершение',f:'date_done'}].map(d=><div key={d.f} style={{fontSize:11}}><span style={{color:S.i3,display:'block',marginBottom:2}}>{d.l}</span><EdDate value={p[d.f]} canEdit={ce} onSave={v=>upProj(p.id,d.f,v)}/></div>)}</div>
        <div style={{marginBottom:10}}><span style={{fontSize:11,color:S.i3,display:'block',marginBottom:2}}>Ограничения</span><Ed value={p.constraints_text||''} canEdit={ce} multi onSave={v=>setConstraints(p.id,v)} ph="Блокеры / ограничения..." style={{fontSize:12,color:hasBlock?'#791F1F':S.i2,display:'block',background:hasBlock?'#FFF5F5':'transparent',padding:hasBlock?'4px 8px':0,borderRadius:6}}/></div>
        <Ed value={p.last_update} canEdit={ce} multi onSave={v=>upProj(p.id,'last_update',v)} ph="Общее описание..." style={{color:S.i2,fontSize:13,display:'block',marginBottom:12}}/>
        {ce&&<div style={{display:'flex',gap:8}}><textarea id={"nc-"+p.id} defaultValue="" onChange={e=>{ncRef.current=e.target.value}} placeholder={`Комментарий за ${rep?.week_label||''}...`} rows={2} style={{flex:1,padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:13,resize:'vertical',outline:'none',fontFamily:'inherit'}}/><button onClick={()=>addC(p.id)} disabled={sav} style={{padding:'8px 16px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:13,fontWeight:600,cursor:'pointer',alignSelf:'flex-end'}}>{sav?'...':'→'}</button></div>}
      </div>}
    </div>}

  return<>
    <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
      <div style={{fontSize:12,color:S.i3,marginRight:4}}>Фильтр:</div>
      {[{k:'all',l:'Все'},{k:'key',l:'🔴 Ключевые'},{k:'current',l:'🔵 Текущие'}].map(f=><button key={f.k} onClick={()=>setFPri(f.k)} style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:fPri===f.k?S.gd:'#F1EFE8',color:fPri===f.k?S.gp:S.i2}}>{f.l}</button>)}
      <span style={{color:S.ln}}>|</span>
      {[{k:'all',l:'Все статусы'},...Object.entries(PROJ_ST).filter(([k])=>k!=='done').map(([k,v])=>({k,l:v.l}))].map(f=><button key={f.k} onClick={()=>setFSt(f.k)} style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:fSt===f.k?S.gd:'#F1EFE8',color:fSt===f.k?S.gp:S.i2}}>{f.l}</button>)}
      <span style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}><span style={{fontSize:12,color:S.i3}}>{filtered.length} из {active.length}</span>{ce&&<button onClick={()=>setShowNewP(!showNewP)} style={{fontSize:12,color:S.gd,background:S.gp,border:'none',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontWeight:600}}>{showNewP?'✕':'+ проект'}</button>}</span>
    </div>
    {showNewP&&<div style={{background:S.sf,border:`1px solid ${S.gl}`,borderRadius:12,padding:16,marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Новый проект</div>
      <div style={{display:'grid',gridTemplateColumns:'100px 1fr 120px 120px',gap:8,marginBottom:8}}>
        <input value={np.id} onChange={e=>setNp({...np,id:e.target.value})} placeholder="ID (ST01)" style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/>
        <input value={np.name} onChange={e=>setNp({...np,name:e.target.value})} placeholder="Название проекта" style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/>
        <input value={np.owner} onChange={e=>setNp({...np,owner:e.target.value})} placeholder="Владелец" style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12,outline:'none'}}/>
        <select value={np.priority} onChange={e=>setNp({...np,priority:e.target.value})} style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:12}}><option value="key">🔴 Ключевой</option><option value="current">🔵 Текущий</option></select>
      </div>
      <button onClick={addProj} disabled={!np.id.trim()||!np.name.trim()} style={{padding:'6px 16px',borderRadius:8,border:'none',background:S.gd,color:S.gp,fontSize:12,fontWeight:600,cursor:'pointer'}}>Создать</button>
    </div>}
    <div style={{fontSize:12,color:S.i3,marginBottom:12,padding:'8px 12px',background:S.sf,borderRadius:8,border:`0.5px solid ${S.ln}`}}>📅 <b>{rep?.week_label||'—'}</b></div>
    {secs.map(s=><div key={s.t}><Label>{s.t} ({s.items.length})</Label><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
      {s.items.map(p=><ProjCard key={p.id} p={p}/>)}</div></div>)}
    {archive.length>0&&<><div style={{marginTop:24,borderTop:`2px solid ${S.ln}`,paddingTop:16}}><Label>📦 Архив · готово ({archive.length})</Label></div><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20,opacity:0.75}}>
      {archive.map(p=><ProjCard key={p.id} p={p}/>)}</div></>}
  </>
}
function CItem({c,ce,reload,onDel}){const[es,setEs]=useState(false);const[sv,setSv]=useState(c.summary);const isL=c.full_text?.length>150;const saveS=async()=>{setEs(false);await supabase.from('project_comments').update({summary:sv}).eq('id',c.id);reload()};return<div style={{marginTop:6,padding:'8px 12px',background:S.bg,borderRadius:8}}><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:S.i3,marginBottom:2}}><span><b>{c.author}</b> · {c.week_start}</span><div style={{display:'flex',gap:6}}>{ce&&<button onClick={()=>setEs(!es)} style={{fontSize:11,color:S.bm,background:'none',border:'none',cursor:'pointer'}}>✏️</button>}{ce&&onDel&&<button onClick={onDel} style={{fontSize:11,color:'#ccc',background:'none',border:'none',cursor:'pointer'}}>🗑</button>}</div></div>{es?<div><textarea value={sv} onChange={e=>setSv(e.target.value)} rows={2} style={{width:'100%',padding:'6px 10px',borderRadius:6,border:`1px solid ${S.gl}`,fontSize:13,outline:'none',fontFamily:'inherit'}}/><button onClick={saveS} style={{fontSize:12,color:S.gd,background:'none',border:'none',cursor:'pointer'}}>💾</button></div>:<div style={{fontSize:13,color:S.i2}}>{c.summary||c.full_text?.slice(0,120)}</div>}{isL&&!es&&<details style={{marginTop:4}}><summary style={{fontSize:11,color:S.gm,cursor:'pointer'}}>Полная версия</summary><div style={{fontSize:12,color:S.ink,marginTop:4,whiteSpace:'pre-wrap'}}>{c.full_text}</div></details>}</div>}

// ═══ DYNAMICS ═══
function Dynamics({projects,comments,reports,aIdx,ce,reload}){const[ek,setEk]=useState(null);const[ec,setEc]=useState(null);const rep=reports[aIdx];const kP=projects.filter(p=>p.priority==='key');const cP=projects.filter(p=>p.priority==='current')
  const getSnap=(pid,ws)=>{const r=reports.find(r=>r.week_start===ws);return(r?.project_snapshots||[]).find(s=>s.id===pid)||null}
  const saveSnapshots=async()=>{if(!rep)return;const snaps=projects.map(p=>({id:p.id,name:p.name,status:p.status,owner:p.owner,priority:p.priority,date_start:p.date_start,date_test:p.date_test,date_results:p.date_results,date_done:p.date_done,constraints:p.constraints_text,last_update:p.last_update}));await supabase.from('weekly_reports').update({project_snapshots:snaps}).eq('id',rep.id);reload()}
  const TL=({proj,isOpen,toggle})=>{const ps=PROJ_ST[proj.status]||PROJ_ST.wait;const pC=comments.filter(c=>c.project_id===proj.id);const weeks=[...reports].reverse().map(r=>{const snap=getSnap(proj.id,r.week_start);const snapSt=snap?PROJ_ST[snap.status]:null;return{...r,wc:pC.filter(c=>c.week_start===r.week_start),snap,snapSt}})
    return<div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',cursor:'pointer'}} onClick={toggle}><div><span style={{fontWeight:500}}>{proj.name}</span><span style={{fontSize:12,color:S.i3,marginLeft:8}}>{proj.owner}</span></div><div style={{display:'flex',gap:8,alignItems:'center'}}><Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip><span style={{color:S.i3}}>{isOpen?'▲':'▼'}</span></div></div>
      {isOpen&&<div style={{padding:'0 16px 16px',borderLeft:`3px solid ${S.gl}`,marginLeft:16}}>{weeks.map(w=><div key={w.id} style={{marginTop:12,paddingBottom:12,borderBottom:`0.5px solid ${S.ln}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:12,fontWeight:600,color:S.gd}}>📅 {w.week_label}</div>{w.snapSt&&<Chip bg={w.snapSt.bg} tx={w.snapSt.tx}>{w.snapSt.l}</Chip>}</div>{w.snap&&<div style={{fontSize:11,color:S.i3,marginTop:2}}>{w.snap.constraints&&<span style={{color:'#791F1F'}}>⚠️ {w.snap.constraints} · </span>}{[w.snap.date_start&&`начало: ${w.snap.date_start}`,w.snap.date_done&&`завершён: ${w.snap.date_done}`].filter(Boolean).join(' · ')}</div>}{w.wc.length>0?w.wc.map(c=><div key={c.id} style={{marginTop:4}}><span style={{fontSize:11,color:S.i3}}>{c.author}:</span><Ed value={c.summary||c.full_text} canEdit={ce} multi onSave={async v=>{await supabase.from('project_comments').update({summary:v}).eq('id',c.id);reload()}} style={{fontSize:13,color:S.ink}}/></div>):<div style={{fontSize:12,color:S.i3,fontStyle:'italic',marginTop:4}}>Нет обновлений</div>}</div>)}</div>}</div>}
  return<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><Label>История проектов</Label>{ce&&<button onClick={saveSnapshots} style={{fontSize:12,color:S.gd,background:S.gp,border:'none',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:600}}>📸 Снимок · {rep?.week_label}</button>}</div><Label>🔴 Ключевые ({kP.length})</Label>{kP.map(p=><TL key={p.id} proj={p} isOpen={ek===p.id} toggle={()=>setEk(ek===p.id?null:p.id)}/>)}<div style={{marginTop:20}}><Label>🔵 Текущие ({cP.length})</Label></div>{cP.map(p=><TL key={p.id} proj={p} isOpen={ec===p.id} toggle={()=>setEc(ec===p.id?null:p.id)}/>)}</>}

// ═══ TRENDS ═══
function Trends({reports,mPlans}){const[mode,setMode]=useState('weekly');const[selCh,setSelCh]=useState({});const[cpoMode,setCpoMode]=useState('both');const allCh=new Set();reports.forEach(r=>(r.channels||[]).forEach(c=>{const n=c.name?.split(' (')[0]||c.name;if(n)allCh.add(n)}));const chNames=[...allCh];useEffect(()=>{if(Object.keys(selCh).length===0){const init={};chNames.forEach(n=>init[n]=true);setSelCh(init)}},[chNames.length]);const togCh=(n)=>setSelCh(p=>({...p,[n]:!p[n]}));const toggleAll=()=>{const anyOff=chNames.some(n=>!selCh[n]);const nv={};chNames.forEach(n=>nv[n]=anyOff);setSelCh(nv)}
  const weeklyData=reports.map(r=>{const m=r.metrics||{};const ch=r.channels||[];const adSpend=ch.reduce((s,c)=>s+(c.spent||0),0);const paidSales=ch.filter(c=>(c.spent||0)>0).reduce((s,c)=>s+(c.sales||0),0);const teamWeek=Math.round(TEAM_MONTHLY/30*7);const wm=r.week_start?.slice(0,7);const mp=(mPlans||[]).find(p=>p.id===wm);const dim=wm?new Date(parseInt(wm.slice(0,4)),parseInt(wm.slice(5,7)),0).getDate():30;const weekPlan=mp?.total_plan?Math.round(mp.total_plan/dim*7):m.planSales;const o={week:r.week_label,sales:m.totalSales,planSales:weekPlan,cpoAds:m.cpoAdsOverride!=null?m.cpoAdsOverride:(paidSales>0?Math.round(adSpend/paidSales):null),cpoTotal:m.cpoTotalOverride!=null?m.cpoTotalOverride:((m.totalSales||0)>0?Math.round((adSpend+teamWeek)/(m.totalSales||1)):null)};ch.forEach(c=>{o[c.name?.split(' (')[0]||c.name]=c.sales});return o})
  const dailyData=[];reports.forEach(r=>{(r.daily_data||[]).forEach(d=>{if(d?.sales!=null)dailyData.push({day:d.day,sales:d.sales})})});const data=mode==='weekly'?weeklyData:dailyData;const xKey=mode==='weekly'?'week':'day'
  return<><div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}><div style={{display:'flex',gap:2,background:S.sf,borderRadius:8,padding:2,border:`0.5px solid ${S.ln}`}}><button onClick={()=>setMode('weekly')} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:mode==='weekly'?S.gd:'transparent',color:mode==='weekly'?S.gp:S.i2}}>По неделям</button><button onClick={()=>setMode('daily')} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:mode==='daily'?S.gd:'transparent',color:mode==='daily'?S.gp:S.i2}}>По дням</button></div>{mode==='weekly'&&<div style={{display:'flex',gap:2,background:S.sf,borderRadius:8,padding:2,border:`0.5px solid ${S.ln}`}}>{[{k:'both',l:'CPO оба'},{k:'ads',l:'CPO Ads'},{k:'total',l:'CPO Total'}].map(o=><button key={o.k} onClick={()=>setCpoMode(o.k)} style={{padding:'6px 10px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:cpoMode===o.k?S.am:'transparent',color:cpoMode===o.k?'#fff':S.i2}}>{o.l}</button>)}</div>}</div>
    <CC title="Продажи (факт vs план)"><ResponsiveContainer width="100%" height={220}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={S.ln}/><XAxis dataKey={xKey} tick={{fontSize:10,fill:S.i3}} interval={mode==='daily'?2:0}/><YAxis tick={{fontSize:12,fill:S.i3}}/><Tooltip contentStyle={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:8,fontSize:12}}/><Bar dataKey="sales" fill={S.gm} radius={[4,4,0,0]} name="Факт"/>{mode==='weekly'&&<Bar dataKey="planSales" fill={S.gs} radius={[4,4,0,0]} name="План"/>}</BarChart></ResponsiveContainer></CC>
    {mode==='weekly'&&<CC title="CPO" right={<span style={{fontSize:11,color:S.i3}}>Пунктир = план</span>}><ResponsiveContainer width="100%" height={220}><LineChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" stroke={S.ln}/><XAxis dataKey="week" tick={{fontSize:10,fill:S.i3}}/><YAxis tick={{fontSize:12,fill:S.i3}} domain={[0,'auto']}/><Tooltip contentStyle={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:8,fontSize:12}}/>{(cpoMode==='both'||cpoMode==='ads')&&<Line type="monotone" dataKey="cpoAds" stroke={S.am} strokeWidth={2} dot={{r:4,fill:S.am}} name="CPO Ads"/>}{(cpoMode==='both'||cpoMode==='total')&&<Line type="monotone" dataKey="cpoTotal" stroke={S.rm} strokeWidth={2} dot={{r:4,fill:S.rm}} name="CPO Total"/>}{(cpoMode==='both'||cpoMode==='ads')&&<Line type="monotone" dataKey="planCpoAds" stroke={S.am} strokeWidth={1} strokeDasharray="5 5" dot={false} name="План Ads"/>}{(cpoMode==='both'||cpoMode==='total')&&<Line type="monotone" dataKey="planCpoTotal" stroke={S.rm} strokeWidth={1} strokeDasharray="5 5" dot={false} name="План Total"/>}<Legend wrapperStyle={{fontSize:11}}/></LineChart></ResponsiveContainer></CC>}
    {mode==='weekly'&&<><div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}><button onClick={toggleAll} style={{fontSize:11,color:S.gd,background:'none',border:`1px solid ${S.ln}`,borderRadius:6,padding:'3px 8px',cursor:'pointer'}}>все/ничего</button>{chNames.map(n=><label key={n} style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:S.i2,cursor:'pointer'}}><input type="checkbox" checked={!!selCh[n]} onChange={()=>togCh(n)} style={{cursor:'pointer'}}/><span style={{width:8,height:8,borderRadius:2,background:CH_COLORS[n]||S.i3,display:'inline-block'}}/>{n}</label>)}</div><CC title="Каналы"><ResponsiveContainer width="100%" height={250}><BarChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" stroke={S.ln}/><XAxis dataKey="week" tick={{fontSize:10,fill:S.i3}}/><YAxis tick={{fontSize:12,fill:S.i3}}/><Tooltip contentStyle={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:8,fontSize:12}}/><Legend wrapperStyle={{fontSize:11}}/>{chNames.filter(n=>selCh[n]).map(n=><Bar key={n} dataKey={n} stackId="a" fill={CH_COLORS[n]||S.i3}/>)}</BarChart></ResponsiveContainer></CC></>}
  </>}

// ═══ PLAN ═══
function Plan({plans,ce,reload}){
  const[sel,setSel]=useState(plans[0]?.id||'2026-07')
  const plan=plans.find(p=>p.id===sel)||{}
  const cp=plan.channel_plans||{}
  const daysInMonth=sel?new Date(parseInt(sel.slice(0,4)),parseInt(sel.slice(5,7)),0).getDate():30
  const upP=async(f,v)=>{await supabase.from('monthly_plans').update({[f]:v,updated_at:new Date().toISOString()}).eq('id',sel);reload()}
  const upCp=async(channel,f,v)=>{const ncp={...cp};ncp[channel]={...(ncp[channel]||{}),planSales:ncp[channel]?.planSales||0,salesPerDay:ncp[channel]?.salesPerDay||0,planCpo:ncp[channel]?.planCpo||0};ncp[channel][f]=v;if(f==='planSales')ncp[channel].salesPerDay=Math.round(v/daysInMonth*10)/10;if(f==='salesPerDay')ncp[channel].planSales=Math.round(v*daysInMonth);await supabase.from('monthly_plans').update({channel_plans:ncp,updated_at:new Date().toISOString()}).eq('id',sel);reload()}
  const chDefs=[{k:'meta',l:'Meta',desc:'Meta Direct + FEBR + AL'},{k:'google',l:'GAds + Bing',desc:'PMax, YouTube, Brand, Search, DG, Bing'},{k:'newChannels',l:'New Channels',desc:'TikTok, Taboola, Reddit, Pinterest, Rumble'}]
  const totalPlanSales=chDefs.reduce((s,c)=>s+(cp[c.k]?.planSales||0),0)

  return<><div style={{display:'flex',gap:4,marginBottom:16,flexWrap:'wrap'}}>
    {plans.map(p=><button key={p.id} onClick={()=>setSel(p.id)} style={{padding:'6px 14px',borderRadius:14,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:sel===p.id?S.gd:'#F1EFE8',color:sel===p.id?S.gp:S.i2}}>{p.month_label}</button>)}
  </div>

  <CC title={`Бюджет · ${plan.month_label||sel}`}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
      {[{l:'Бюджет на команду',k:'team_budget',pre:'$'},{l:'ADS бюджет',k:'ads_budget',pre:'$'},{l:'Общий план продаж',k:'total_plan'}].map(x=>
        <div key={x.k} style={{background:S.bg,borderRadius:10,padding:'12px 14px'}}>
          <div style={{fontSize:12,color:S.i3}}>{x.l}</div>
          <div style={{fontSize:22,fontWeight:500,margin:'4px 0'}}>{x.pre||''}<EdNum value={plan[x.k]} canEdit={ce} onSave={v=>upP(x.k,v)} style={{fontSize:22,fontWeight:500}}/></div>
        </div>)}
    </div>
  </CC>

  <CC title="План по каналам" right={<span style={{fontSize:12,color:S.i3}}>Всего план: {totalPlanSales} · {daysInMonth} дн.</span>}>
    <div style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr 1fr',gap:4,padding:'8px 0',borderBottom:`1px solid ${S.ln}`,fontSize:11,color:S.i3,fontWeight:600}}>
      <span>Канал</span><span style={{textAlign:'right'}}>План продаж</span><span style={{textAlign:'right'}}>В день</span><span style={{textAlign:'right'}}>Плановый CPO</span>
    </div>
    {chDefs.map(c=>{const v=cp[c.k]||{};return<div key={c.k} style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr 1fr',gap:4,padding:'10px 0',borderBottom:`0.5px solid ${S.ln}`,alignItems:'center'}}>
      <div><div style={{fontWeight:500,fontSize:13}}>{c.l}</div><div style={{fontSize:10,color:S.i3}}>{c.desc}</div></div>
      <span style={{textAlign:'right'}}><EdNum value={v.planSales} canEdit={ce} onSave={val=>upCp(c.k,'planSales',val)} style={{fontSize:15,fontWeight:500}}/></span>
      <span style={{textAlign:'right'}}><EdNum value={v.salesPerDay} canEdit={ce} onSave={val=>upCp(c.k,'salesPerDay',val)} style={{fontSize:13,color:S.i2}}/><span style={{fontSize:10,color:S.i3}}> /день</span></span>
      <span style={{textAlign:'right'}}>$<EdNum value={v.planCpo} canEdit={ce} onSave={val=>upCp(c.k,'planCpo',val)} style={{fontSize:15,fontWeight:500}}/></span>
    </div>})}
  </CC>
  </>
}

// ═══ ADMIN ═══
function Admin({profiles,projects,reports,aIdx,reload,rep,upRep}){const[pins,setPins]=useState(rep?.pinned_projects||[]);useEffect(()=>setPins(rep?.pinned_projects||[]),[rep]);const upRole=async(id,r)=>{await supabase.from('profiles').update({role:r}).eq('id',id);reload()};const upPP=async(id,p)=>{await supabase.from('projects').update({priority:p}).eq('id',id);reload()};const togPin=async pid=>{const n=pins.includes(pid)?pins.filter(x=>x!==pid):[...pins,pid];setPins(n);if(rep)await supabase.from('weekly_reports').update({pinned_projects:n}).eq('id',rep.id);reload()}
  // Channel visibility — optimistic local state
  const allChNames=(rep?.channels||[]).map(c=>c.name)
  const[visCh,setVisCh]=useState(rep?.visible_channels||allChNames)
  useEffect(()=>setVisCh(rep?.visible_channels||allChNames),[rep?.id])
  const togCh=(name)=>{const nv=visCh.includes(name)?visCh.filter(n=>n!==name):[...visCh,name];setVisCh(nv);upRep({visible_channels:nv})}
  const INTEG=[{name:'Daily Tracking (Roistat → GSheets)',url:'https://docs.google.com/spreadsheets/d/1eDtGDROu-UbtiHJBlY9P3ZWmmku6LDYZwNos6F2BbLg',st:'connected',desc:'Ежедневные продажи/траты/CPO по всем каналам. Данные из Roistat. Импорт через кнопку «Из Daily Sheet» в Обзоре. Строка 402 = 01.06.2026.'},{name:'Стратегический дашборд',url:'https://docs.google.com/spreadsheets/d/1FQ8r5QYwENNWUSLScfRdDYKc16J8lnKG5XzPt_kgaFU',st:'connected',desc:'Мастер-список проектов. Импорт при деплое.'},{name:'Supabase',url:'https://lkkhwumnuzepxyvvwubd.supabase.co',st:'connected',desc:'Хранилище: отчёты, проекты, планы, тактические задачи.'},{name:'Claude API',st:'planned',desc:'Автоанализ недели. Нужен ANTHROPIC_API_KEY.'},{name:'Slack бот',st:'planned',desc:'Опрос команды пн 18:30.'},{name:'Meta Ads MCP',st:'planned',desc:'Прямой импорт из Meta.'},{name:'Klaviyo MCP',st:'planned',desc:'Импорт email CR.'}]
  const stC={connected:{bg:'#C0DD97',tx:'#27500A',l:'подключено'},manual:{bg:'#FAC775',tx:'#633806',l:'вручную'},planned:{bg:'#F1EFE8',tx:'#5F5E5A',l:'планируется'}}
  return<><Box title={`Каналы в Обзоре · ${rep?.week_label||''}`}><div style={{fontSize:12,color:S.i3,marginBottom:8}}>Включи/выключи каналы для отображения на этой неделе.</div>{allChNames.map(name=>{const ch=(rep?.channels||[]).find(c=>c.name===name);const on=visCh.includes(name);return<div key={name} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`0.5px solid ${S.ln}`,fontSize:13}}><input type="checkbox" checked={on} onChange={()=>togCh(name)} style={{cursor:'pointer'}}/><span style={{flex:1,fontWeight:500,opacity:on?1:0.4}}>{name}</span><span style={{fontSize:12,color:S.i3}}>{ch?.sales||0} продаж</span>{ch?.cpo&&<span style={{fontSize:12,color:S.i2}}>CPO ${ch.cpo}</span>}</div>})}</Box>
    <Box title="Пользователи">{profiles.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`0.5px solid ${S.ln}`}}><div><span style={{fontWeight:500}}>{p.name||p.email}</span><span style={{fontSize:12,color:S.i3,marginLeft:8}}>{p.email}</span></div><select value={p.role} onChange={e=>upRole(p.id,e.target.value)} style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${S.ln}`,fontSize:13}}><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></select></div>)}</Box>
    <Box title={`Проекты на главной · ${rep?.week_label||''}`}><div style={{fontSize:12,color:S.i3,marginBottom:8}}>На каждой неделе свой набор.</div>{projects.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 0',borderBottom:`0.5px solid ${S.ln}`,fontSize:13}}><input type="checkbox" checked={pins.includes(p.id)} onChange={()=>togPin(p.id)} style={{cursor:'pointer'}}/><span style={{flex:1}}>{p.name}</span><Chip bg={p.priority==='key'?'#F7C1C1':'#B5D4F4'} tx={p.priority==='key'?'#791F1F':'#0C447C'}>{p.priority==='key'?'🔴':'🔵'}</Chip></div>)}</Box>
    <Box title="Приоритет проектов">{projects.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`0.5px solid ${S.ln}`,fontSize:13}}><span>{p.id} — {p.name}</span><div style={{display:'flex',gap:6}}><button onClick={()=>upPP(p.id,'key')} style={{padding:'3px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:12,background:p.priority==='key'?'#F7C1C1':'#F1EFE8',color:p.priority==='key'?'#791F1F':'#5F5E5A',fontWeight:600}}>🔴</button><button onClick={()=>upPP(p.id,'current')} style={{padding:'3px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:12,background:p.priority==='current'?'#B5D4F4':'#F1EFE8',color:p.priority==='current'?'#0C447C':'#5F5E5A',fontWeight:600}}>🔵</button></div></div>)}</Box>
    <div style={{background:S.sf,border:`0.5px solid ${S.ln}`,borderRadius:12,padding:16}}><div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Подключения и интеграции</div>{INTEG.map((ig,i)=>{const sc=stC[ig.st]||stC.planned;return<div key={i} style={{padding:'10px 0',borderBottom:`0.5px solid ${S.ln}`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}><div style={{flex:1}}>{ig.url?<a href={ig.url} target="_blank" rel="noopener" style={{color:S.gd,fontWeight:500,fontSize:13}}>{ig.name}</a>:<span style={{fontWeight:500,fontSize:13}}>{ig.name}</span>}<div style={{fontSize:12,color:S.i2,marginTop:2,lineHeight:1.5}}>{ig.desc}</div></div><Chip bg={sc.bg} tx={sc.tx}>{sc.l}</Chip></div></div>})}</div></>}
