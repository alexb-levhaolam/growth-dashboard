import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { weekEnd, S, STATUS_CFG, Chip, Ed, cpoAdsOf, cpoTotalOf } from './lib/ui'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Tactical from './pages/Tactical'
import Projects from './pages/Projects'
import Dynamics from './pages/Dynamics'
import Trends from './pages/Trends'
import Plan from './pages/Plan'
import Admin from './pages/Admin'
import MonthlyReport from './pages/MonthlyReport'
import SEOReport from './pages/SEOReport'
import ExportPage from './pages/ExportPage'
import TeamPage from './pages/TeamPage'
import SlackBotPage from './pages/SlackBotPage'
import YoYReport from './pages/YoYReport'
import Workshop from './pages/Workshop'
import Home from './pages/Home'
import ProjectArchive from './pages/ProjectArchive'
import MyReport from './pm/MyReport'
import MyProjects, { NewProjectModal } from './pm/MyProjects'
import ProjectModal from './pm/ProjectModal'
import { MyPlan, TeamPlan } from './pm/Plans'
import { getLang, setLang, T } from './pm/i18n'
import WeekPicker from './pm/WeekPicker'

export default function App(){const[session,setSession]=useState(null);const[profile,setProfile]=useState(null);const[loading,setLoading]=useState(true);useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);useEffect(()=>{if(!session?.user)return setProfile(null);supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))},[session]);if(loading)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;if(!session)return<Login/>;if(!profile)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;return<Main profile={profile}/>}

function Main({profile}){
  const[view,setView]=useState('overview');const[reports,setReports]=useState([]);const[projects,setProjects]=useState([]);const[allProjects,setAllProjects]=useState([]);const[comments,setComments]=useState([]);const[aIdx,setAIdx]=useState(0);const[allProfiles,setAllProfiles]=useState([]);const[tTasks,setTTasks]=useState([]);const[tProgress,setTProgress]=useState([]);const[mPlans,setMPlans]=useState([]);const[steps,setSteps]=useState([]);const[team,setTeam]=useState([]);const[pmOpen,setPmOpen]=useState(null);const[pmNew,setPmNew]=useState(null);const[pmTab,setPmTab]=useState(null);const[projSales,setProjSales]=useState([])
  const aIdxRef=useRef(-1)
  const load=useCallback(async()=>{
    const[r,p,c,tt,tp]=await Promise.all([supabase.from('weekly_reports').select('*').order('week_start'),supabase.from('projects').select('*').order('sort_order'),supabase.from('project_comments').select('*').order('created_at',{ascending:false}),supabase.from('tactical_tasks').select('*').order('sort_order'),supabase.from('tactical_progress').select('*').order('week_start')])
    try{const{data:mpd}=await supabase.from('monthly_plans').select('*').order('id');if(mpd)setMPlans(mpd)}catch(e){console.warn('monthly_plans:',e)}
    // новая система: этапы проектов и команда (если миграция ещё не выполнена — просто пусто)
    try{const{data:sd,error:se}=await supabase.from('project_steps').select('*').order('start_date');if(!se&&sd)setSteps(sd.filter(x=>!x.hidden))}catch(e){console.warn('project_steps:',e)}
    try{const{data:tm}=await supabase.from('team_members').select('*').order('name');if(tm)setTeam(tm)}catch(e){console.warn('team_members:',e)}
    try{const{data:ps,error:pe}=await supabase.from('project_sales').select('*');if(!pe&&ps)setProjSales(ps)}catch(e){console.warn('project_sales:',e)}
    if(r.data){setReports(r.data);const max=r.data.length-1;setAIdx(prev=>{const isFirst=aIdxRef.current===-1;const safe=isFirst?max:(prev<=max?prev:max);aIdxRef.current=safe;return safe})}
    if(p.data){setAllProjects(p.data);setProjects(p.data.filter(x=>!x.archived_at))};const mg={};(p.data||[]).forEach(x=>{if(x.merged_into)mg[x.id]=x.merged_into});const res=(id)=>{let k=id,n=0;while(mg[k]&&n<10){k=mg[k];n++}return k};if(c.data){const vis=c.data.filter(x=>!x.hidden).map(x=>mg[x.project_id]?{...x,orig_project_id:x.project_id,project_id:res(x.project_id)}:x);const sk=new Set(vis.filter(x=>x.source==='sheet').map(x=>x.project_id+'|'+x.week_start));setComments(vis.filter(x=>x.source==='sheet'||x.health||!sk.has(x.project_id+'|'+x.week_start)))};if(tt.data)setTTasks(tt.data);if(tp.data)setTProgress(tp.data)
    if(profile.role==='admin'){const{data}=await supabase.from('profiles').select('*');if(data)setAllProfiles(data)}
  },[profile]);useEffect(()=>{load()},[load])
  const reload=useCallback(async()=>{const y=window.scrollY;await load();requestAnimationFrame(()=>window.scrollTo(0,y))},[load])

  const rep=reports[aIdx];const ce=profile.role==='admin'||profile.role==='editor';const isA=profile.role==='admin'
  const upRep=async u=>{if(!rep)return;const id=rep.id;setReports(prev=>prev.map(r=>r.id===id?{...r,...u}:r));const{data,error}=await supabase.from('weekly_reports').update({...u,updated_at:new Date().toISOString()}).eq('id',id).select('id');if(error)alert('Ошибка сохранения: '+error.message);else if(!data?.length)alert('Изменение не сохранилось: нет прав на запись в weekly_reports (RLS) или отчёт не найден');reload()}
  const setWeek=(i)=>{setAIdx(i);aIdxRef.current=i}
  const loadFromDaily=async(weekId,weekStart)=>{try{const r=await fetch(`/api/daily?weekStart=${weekStart}`);if(!r.ok)throw new Error('API недоступен');const d=await r.json();if(d.error)throw new Error(d.error);const{data:cur}=await supabase.from('weekly_reports').select('metrics,channels').eq('id',weekId).single();const upd={};if(d.days?.length){const d7=d.days.slice(0,7);while(d7.length<7)d7.push({day:'',sales:null,note:''});upd.daily_data=d7}upd.metrics={...(cur?.metrics||{}),totalSales:d.totalSales,discBL:d.totalDiscBL||0,discBS:d.totalDiscBS||0,totalSpentBM:d.totalSpentBM||0};if(d.channels?.length){const ec=cur?.channels||[];upd.channels=d.channels.map(c=>{const ex=ec.find(e=>e.name===c.name);return{name:c.name,sales:c.sales,spent:c.spent||0,cpo:c.cpo,prevSales:ex?.prevSales||null,prevCpo:ex?.prevCpo||null,planSales:ex?.planSales||null,planCpo:ex?.planCpo||null,cpoOverride:ex?.cpoOverride??null}})}if(Object.keys(upd).length){await supabase.from('weekly_reports').update({...upd,updated_at:new Date().toISOString()}).eq('id',weekId)}return d.daysFound||0}catch(e){console.warn('Daily import:',e.message);return 0}}
  const createWeek=async()=>{try{const last=reports[reports.length-1];const lsStr=last?last.week_start:new Date().toISOString().slice(0,10);const[ly,lm,ld]=lsStr.split('-').map(Number);const ns=new Date(ly,lm-1,ld+7);while(ns.getDay()!==1)ns.setDate(ns.getDate()-1);const ne=new Date(ns.getFullYear(),ns.getMonth(),ns.getDate()+6);const f=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;const label=`${f(ns)} – ${f(ne)}`;const wsStr=`${ns.getFullYear()}-${String(ns.getMonth()+1).padStart(2,'0')}-${String(ns.getDate()).padStart(2,'0')}`;const maxNum=reports.reduce((mx,r)=>{const m=r.id.match(/LH-(\d+)/);return m?Math.max(mx,parseInt(m[1])):mx},0);const id=`LH-${String(maxNum+1).padStart(5,'0')}`;const days=[];const dnL=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];for(let i=0;i<7;i++){const d=new Date(ns.getFullYear(),ns.getMonth(),ns.getDate()+i);days.push({day:`${dnL[i]} ${f(d)}`,sales:null,note:''})}const chs=(last?.channels||[]).map(c=>({...c,prevSales:c.sales,prevCpo:c.cpo,sales:null,cpo:null}));const{error}=await supabase.from('weekly_reports').insert({id,week_label:label,week_start:wsStr,status:'yellow',status_note:'',metrics:{planSales:last?.metrics?.planSales||null,budgetPlan:last?.metrics?.budgetPlan||null,planCpoAds:last?.metrics?.planCpoAds||null,planCpoTotal:last?.metrics?.planCpoTotal||null},channels:chs,improved:[],worsened:[],focus:last?.focus||[],asks:last?.asks||[],daily_data:days,pinned_projects:last?.pinned_projects||[],project_snapshots:[]});if(error){alert('Ошибка создания: '+error.message);return}const{data:fresh}=await supabase.from('weekly_reports').select('*').order('week_start');if(fresh){setReports(fresh);setWeek(fresh.length-1)};loadFromDaily(id,wsStr).then(n=>{if(n>0){alert(` Загружено ${n} дней из Daily`);load()}})}catch(e){alert('Ошибка: '+e.message)}}
  const recalcAll=async()=>{if(!rep)return null;const mo=rep.week_start.slice(0,7);const weeks=reports.filter(r=>r.week_start&&(r.week_start.slice(0,7)===mo||r.id===rep.id));let days=0;for(const w of weeks){const d=new Date(w.week_start+'T12:00:00');while(d.getDay()!==1)d.setDate(d.getDate()-1);const monStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const n=await loadFromDaily(w.id,monStr);days+=n||0;const{data:cur,error:e1}=await supabase.from('weekly_reports').select('metrics,channels').eq('id',w.id).single();if(e1){alert(`Ошибка чтения недели ${w.week_label||w.id}: `+e1.message);continue}const metrics={...(cur?.metrics||{}),cpoAdsOverride:null,cpoTotalOverride:null,budgetSpent:null};const channels=(cur?.channels||[]).map(c=>({...c,cpoOverride:null}));const{error:e2}=await supabase.from('weekly_reports').update({metrics,channels,updated_at:new Date().toISOString()}).eq('id',w.id);if(e2)alert(`Ошибка сохранения недели ${w.week_label||w.id}: `+e2.message)}const{error:e3}=await supabase.from('monthly_plans').update({actual_sales:null,actual_cpo_ads:null,actual_cpo_total:null,actual_budget:null,updated_at:new Date().toISOString()}).eq('id',mo);if(e3)alert('Недели пересчитаны, но итоги месяца не сброшены: '+e3.message);await reload();return{weeks:weeks.length,days}}
  const refreshFromDaily=async()=>{if(!rep)return;const d=new Date(rep.week_start+'T12:00:00');while(d.getDay()!==1)d.setDate(d.getDate()-1);const monStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const n=await loadFromDaily(rep.id,monStr);if(n>0){await load();alert(`Обновлено: ${n} дней`)}else alert('Данные не найдены.')}
  const deleteWeek=async()=>{if(!rep)return;if(!confirm(`Удалить отчёт "${rep.week_label}"? Это действие необратимо.`))return;await supabase.from('weekly_reports').delete().eq('id',rep.id);const{data:fresh}=await supabase.from('weekly_reports').select('*').order('week_start');if(fresh){setReports(fresh);setWeek(Math.max(0,fresh.length-1))}}

  const[page,setPage]=useState('home');const[menuOpen,setMenuOpen]=useState(false)
  const weeklyTabs=[{id:'overview',l:'Обзор'},{id:'projects',l:'Проекты'},{id:'tactical',l:'Тактические'},{id:'plan',l:'План'},{id:'trends',l:'Тренды'}]
  const printOverview=()=>{const el=document.getElementById('overview-print');if(!el)return;const w=window.open('','','width=900,height=700');w.document.write('<html><head><title>Growth Report '+rep?.week_label+'</title><style>body{font-family:-apple-system,sans-serif;padding:20px;color:#2C2C2A}table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;border:1px solid #E3E1D8;font-size:13px}</style></head><body>');w.document.write(el.innerHTML);w.document.write('</body></html>');w.document.close();w.print()}

  const people=Array.from(new Set([...team.filter(m=>m.active!==false).map(m=>m.name),...allProfiles.map(p=>p.name)].filter(Boolean))).sort()
  const NAV=[
    ...(ce?[{sep:T('Моя работа')+' · beta'},{id:'pm-report',l:T('Мой отчёт'),ic:'pen'},{id:'pm-plan',l:T('Мой план работ'),ic:'bars'},{id:'pm-projects',l:T('Мои проекты'),ic:'cards'},{id:'pm-team',l:T('План работ отдела'),ic:'cells'}]:[]),
    {sep:'Отчёты'},
    {id:'home',l:'Главная',ic:'home'},
    {id:'weekly',l:'Еженедельный',ic:'calendar'},
    ...(ce?[{id:'monthly',l:'Ежемесячный',ic:'chart-bar'}]:[]),
    {id:'yoy',l:'Годовой / YoY',ic:'trending-up'},{id:'workshop',l:'Workshop 2027',ic:'map'},{id:'seo',l:'SEO отчёт',ic:'target'},
    {sep:'Управление'},
    {id:'projects-all',l:'Проекты',ic:'layout-kanban'},{id:'archive',l:'Архив проектов',ic:'archive'},
    {id:'tactical-all',l:'Тактические цели',ic:'target'},
    ...(isA?[{id:'team',l:'Команда',ic:'users'},{id:'export',l:'Выгрузка',ic:'target'}]:[]),
    {sep:'Настройки'},
    ...(isA?[{id:'channels',l:'Каналы и планы',ic:'adjustments'},{id:'integrations',l:'Интеграции',ic:'plug'},{id:'bot',l:'Slack бот',ic:'robot'},{id:'admin',l:'Администрирование',ic:'settings'}]:[]),
  ]

  const navTo=(p)=>{setPage(p);setMenuOpen(false)};return<div className='lh-app' style={{display:'grid',gridTemplateColumns:'220px 1fr',minHeight:'100vh',background:S.bg}}>
    {/* ═══ SIDEBAR ═══ */}
    <div className={'lh-sidebar'+(menuOpen?' open':'')} style={{background:S.sf,borderRight:`1px solid ${S.ln}`,padding:'20px 10px',display:'flex',flexDirection:'column',gap:1,position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
      <div style={{padding:'8px 14px 24px',display:'flex',flexDirection:'column',gap:2,lineHeight:1.1}}><span style={{font:'500 12px/1.2 Poppins,sans-serif',color:S.i3,letterSpacing:'.04em'}}>Lev Haolam</span><span style={{font:'700 20px/1.1 Poppins,sans-serif',color:S.gd}}>Growth</span></div>
      {NAV.map((n,i)=>n.sep?<div key={i} style={{font:'600 12px/1 Poppins,sans-serif',color:'#9AA0A6',letterSpacing:'.08em',textTransform:'uppercase',padding:'18px 14px 6px'}}>{n.sep}</div>:<button key={n.id} onClick={()=>navTo(n.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderRadius:8,font:'500 14px/1.3 Poppins,sans-serif',color:page===n.id?S.gm:S.i2,cursor:'pointer',border:'none',background:page===n.id?S.gp:'transparent',width:'100%',textAlign:'left',fontWeight:page===n.id?600:500}}><span style={{fontSize:18,width:20,textAlign:'center'}}>{n.ic==='pen'?'✎':n.ic==='cards'?'▦':n.ic==='bars'?'▤':n.ic==='cells'?'▥':n.ic==='home'?'⌂':n.ic==='map'?'▦':n.ic==='archive'?'⊟':n.ic==='calendar'?'☰':n.ic==='chart-bar'?'▣':n.ic==='trending-up'?'↗':n.ic==='layout-kanban'?'▤':n.ic==='target'?'◎':n.ic==='users'?'⊛':n.ic==='adjustments'?'⚙':n.ic==='plug'?'⚡':n.ic==='robot'?'⊞':n.ic==='settings'?'⋮':'·'}</span>{n.l}</button>)}
      <div style={{marginTop:'auto',padding:'14px 10px',borderTop:`1px solid ${S.ln}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,borderRadius:'50%',background:S.gm,display:'flex',alignItems:'center',justifyContent:'center',font:'600 13px/1 Poppins',color:'#fff'}}>{(profile.name||'?')[0]?.toUpperCase()}</div>
          <div><div style={{font:'600 13px/1 Poppins,sans-serif'}}>{profile.name||profile.email}</div><div style={{font:'500 11px/1 Poppins,sans-serif',color:'#9AA0A6'}}>{profile.role}</div></div>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{marginTop:10,width:'100%',padding:'8px',borderRadius:8,border:`1px solid ${S.ln}`,background:'transparent',cursor:'pointer',fontSize:13,color:S.i3,fontWeight:500}}>Выйти</button>
      </div>
    </div>

    {/* ═══ MAIN CONTENT ═══ */}
    <div className='lh-main' style={{padding:'32px',maxWidth:1120,width:'100%',overflowX:'hidden'}}>
    <button className='lh-burger' onClick={()=>setMenuOpen(!menuOpen)} style={{display:'none',position:'fixed',top:12,left:12,zIndex:1001,width:40,height:40,borderRadius:8,border:'none',background:S.gd,color:'#fff',fontSize:20,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)'}}>☰</button>

    {/* HOME */}
    {page==='home'&&<Home profile={profile} rep={rep} projects={projects} comments={comments} mPlans={mPlans} navTo={navTo} isA={ce} ce={ce} steps={steps} onOpen={(id)=>{setPmTab(null);setPmOpen(id)}}/>}

    {/* НОВАЯ СИСТЕМА · beta */}
    {page==='pm-report'&&ce&&<MyReport projects={projects} steps={steps} comments={comments} profile={profile} ce={ce} onOpen={setPmOpen} reload={reload}/>}
    {page==='pm-plan'&&ce&&<MyPlan projects={projects} steps={steps} comments={comments} profile={profile} ce={ce} people={people} onOpen={(id)=>{setPmTab('plan');setPmOpen(id)}} reload={reload}/>}
    {page==='pm-team'&&ce&&<TeamPlan projects={projects} steps={steps} comments={comments} people={people} onOpen={(id)=>{setPmTab(null);setPmOpen(id)}} openTab={(id,tab)=>{setPmTab(tab);setPmOpen(id)}}/>}
    {page==='pm-projects'&&ce&&<MyProjects projects={projects} allProjects={allProjects} steps={steps} comments={comments} profile={profile} ce={ce} onOpen={setPmOpen} onNew={(pid)=>setPmNew(pid||'')}/>}

    {/* WEEKLY */}
    {page==='weekly'&&!rep&&<div style={{padding:40,textAlign:'center',color:S.i3}}>Нет отчётов. Создайте первый отчёт.</div>}
    {page==='weekly'&&rep&&<>
      <div className='lh-plate' style={{background:({green:'linear-gradient(180deg,#5C8A14,#3F6B08)',yellow:'linear-gradient(180deg,#C77A06,#A35F00)',red:'linear-gradient(180deg,#C8321D,#A3220F)'})[rep.status]||'linear-gradient(180deg,#5C8A14,#3F6B08)',borderRadius:14,padding:'32px 32px 28px',marginBottom:22,transition:'background .25s'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:14,letterSpacing:'.1em',textTransform:'uppercase',color:'#FAFAFA',fontWeight:600}}>Growth · еженедельный отчёт</div>
        </div>
        {rep&&<><h1 className='lh-title' style={{margin:'4px 0 0',fontSize:32,color:'#fff',fontWeight:700}}>Неделя <Ed value={rep.week_label} canEdit={ce} onSave={v=>upRep({week_label:v})} style={{fontSize:32,color:'#fff',fontWeight:700}}/></h1>
          <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {ce?<select value={rep.status} onChange={e=>upRep({status:e.target.value})} style={{fontSize:14,fontWeight:600,padding:'8px 16px',borderRadius:999,border:'none',background:'#fff',color:({green:'#3F6B08',yellow:'#A35F00',red:'#A3220F'})[rep.status]||'#16181B',cursor:'pointer'}}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>:<Chip bg={STATUS_CFG[rep.status]?.bg} tx={STATUS_CFG[rep.status]?.tx}>{STATUS_CFG[rep.status]?.label}</Chip>}
            <Ed value={rep.status_note} canEdit={ce} onSave={v=>upRep({status_note:v})} ph="Описание статуса..." style={{fontSize:16,color:'rgba(255,255,255,.8)'}}/>
          </div>
        </>}
        {(()=>{const m=rep.metrics||{};const ch=rep.channels||[];const wm=String(rep.week_start||'').slice(0,7);const mp=(mPlans||[]).find(p=>p.id===wm);const dim=wm?new Date(+wm.slice(0,4),+wm.slice(5,7),0).getDate():30
          const pS=mp?.total_plan?Math.round(mp.total_plan/dim*7):m.planSales;const cA=m.cpoAdsOverride!=null?m.cpoAdsOverride:cpoAdsOf(ch);const cT=m.cpoTotalOverride!=null?m.cpoTotalOverride:cpoTotalOf(m);const bud=m.totalSpentBM;const pB=mp?.plan_budget?Math.round(mp.plan_budget/dim*7):null
          const tiles=[['Продажи',m.totalSales,pS,false,v=>Math.round(v).toLocaleString('ru-RU')],['CPO рекламы',cA||null,mp?.plan_cpo_ads,true,v=>'$'+Math.round(v)],['CPO общий',cT||null,mp?.plan_cpo_total,true,v=>'$'+Math.round(v)],['Бюджет',bud||null,pB,true,v=>'$'+Math.round(v).toLocaleString('ru-RU')]]
          return<div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginTop:16}} className="lh-grid3">{tiles.map(([l,v,p,lower,f])=>{const d=v!=null&&p?Math.round((v-p)/p*100):null;const w=v!=null&&p?Math.min(100,v/p/1.25*100):0
            return<div key={l} style={{background:'rgba(255,255,255,.14)',borderRadius:12,padding:'12px 14px',display:'flex',flexDirection:'column',gap:4}}><span style={{fontSize:13,color:'rgba(255,255,255,.85)'}}>{l}</span><span style={{display:'flex',alignItems:'baseline',gap:8}}><span style={{fontSize:24,fontWeight:700,color:'#fff'}}>{v!=null?f(v):'—'}</span>{d!=null&&<span style={{fontSize:12,fontWeight:700,color:'#fff',background:'rgba(255,255,255,.2)',borderRadius:999,padding:'1px 7px'}}>{d>0?'+':''}{d}%</span>}</span>{p?<span style={{position:'relative',height:6,background:'rgba(255,255,255,.22)',borderRadius:999,marginTop:2}}><span style={{position:'absolute',left:0,top:0,bottom:0,width:w+'%',borderRadius:999,background:(lower?v<=p:v>=p)?'#fff':'#FFD2C7'}}/><span style={{position:'absolute',top:-3,bottom:-3,left:'80%',width:2,background:'#fff',borderRadius:1}}/></span>:null}<span style={{fontSize:12,color:'rgba(255,255,255,.75)'}}>{p?'план '+f(p):'план не задан'}</span></div>})}</div>})()}
        <div style={{marginTop:14}}><WeekPicker reports={reports} aIdx={aIdx} setWeek={setWeek} onCreate={ce?createWeek:null} onDelete={isA&&rep?deleteWeek:null}/></div>
      </div>
      <div style={{display:'flex',gap:2,marginBottom:16,background:'#fff',borderRadius:12,padding:8,boxShadow:S.sh,overflowX:'auto'}} className="lh-tabs">
        {weeklyTabs.map(t=><button key={t.id} onClick={()=>setView(t.id)} style={{flex:'0 0 auto',padding:'8px 14px',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:500,background:view===t.id?'#DDF0B5':'transparent',color:view===t.id?'#2F5200':'#585E65',whiteSpace:'nowrap'}}>{t.l}</button>)}
      </div>
      {view==='overview'&&rep&&<Overview rep={rep} reports={reports} projects={projects} comments={comments} ce={ce} up={upRep} tTasks={tTasks} tProgress={tProgress} print={printOverview} refreshDaily={refreshFromDaily} recalcAll={recalcAll} mPlans={mPlans} reload={reload} steps={steps} isA={isA} onOpen={(id)=>{setPmTab(null);setPmOpen(id)}}/>}
      {view==='projects'&&<Projects projects={projects} setProjects={setProjects} comments={comments} setComments={setComments} ce={ce} reports={reports} aIdx={aIdx} profile={profile} reload={reload} rep={rep} upRep={upRep}/>}
      {view==='tactical'&&<Tactical tasks={tTasks} progress={tProgress} reports={reports} aIdx={aIdx} ce={ce} reload={reload} profile={profile} mPlans={mPlans}/>}
      {view==='plan'&&<Plan plans={mPlans} ce={ce} reload={reload}/>}
      {view==='dynamics'&&<Dynamics projects={projects} comments={comments} reports={reports} aIdx={aIdx} ce={ce} reload={reload}/>}
      {view==='trends'&&<Trends reports={reports} mPlans={mPlans}/>}
    </>}

    {/* MONTHLY */}
    {page==='monthly'&&ce&&<MonthlyReport reports={reports} projects={projects} comments={comments} mPlans={mPlans} setMPlans={setMPlans} ce={ce} reload={reload} projSales={projSales} isA={isA} onOpen={(id)=>{setPmTab('sales');setPmOpen(id)}}/>}

    {/* YOY */}
    {page==='yoy'&&<YoYReport/>}
      {page==='workshop'&&<Workshop ce={ce}/>}
      {page==='archive'&&<ProjectArchive allProjects={allProjects} comments={comments} ce={ce} reload={reload}/>}

    {/* PROJECTS STANDALONE */}
    {page==='projects-all'&&<Projects projects={projects} setProjects={setProjects} comments={comments} setComments={setComments} ce={ce} reports={reports} aIdx={aIdx} profile={profile} reload={reload} rep={rep} upRep={upRep}/>}

    {/* TACTICAL STANDALONE */}
    {page==='tactical-all'&&<Tactical tasks={tTasks} progress={tProgress} reports={reports} aIdx={aIdx} ce={ce} reload={reload} profile={profile} mPlans={mPlans}/>}

    {/* TEAM */}
    {page==='seo'&&<SEOReport/>}

    {page==='export'&&isA&&<ExportPage weekStart={rep?.week_start}/>}

    {page==='team'&&isA&&<TeamPage allProfiles={allProfiles} ce={ce} reload={reload}/>}

    {page==='channels'&&isA&&<Plan plans={mPlans} ce={ce} reload={reload}/>}

    {/* INTEGRATIONS */}
    {page==='integrations'&&isA&&<>
      <h1 style={{fontSize:24,fontWeight:600,marginBottom:22}}>Интеграции</h1>
      {[{name:'Slack',desc:'MarketingBot · опрос команды',ok:true},{name:'Google Sheets',desc:'LH Daily Tracking',ok:true},{name:'Supabase',desc:'PostgreSQL + Auth',ok:true},{name:'Meta Ads API',desc:'Автоимпорт метрик',ok:false},{name:'Google Ads API',desc:'Автоимпорт метрик',ok:false},{name:'Claude API',desc:'Анализ и инсайты',ok:false}].map((x,i)=><div key={i} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'18px 22px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div><div style={{fontWeight:600}}>{x.name}</div><div style={{fontSize:13,color:S.i3}}>{x.desc}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:500}}><span style={{width:8,height:8,borderRadius:'50%',background:x.ok?S.gd:'#C4C8CD',display:'inline-block'}}></span><span style={{color:x.ok?S.gd:'#9AA0A6'}}>{x.ok?'подключено':'не настроено'}</span></div>
      </div>)}
    </>}

    {/* SLACK BOT */}
    {page==='bot'&&isA&&<>
      <h1 style={{fontSize:24,fontWeight:600,marginBottom:22}}>Slack бот</h1>
      <SlackBotPage weekStart={rep?.week_start}/>
    </>}

    {/* ADMIN */}
    {page==='admin'&&isA&&<Admin profiles={allProfiles} projects={projects} reports={reports} aIdx={aIdx} reload={reload} rep={rep} upRep={upRep}/>}

    </div>
    {/* переключатель языка — справа сверху */}
    <div style={{position:'fixed',top:12,right:16,zIndex:900,display:'flex',gap:10,alignItems:'center'}}>
      <span title={T('Кто смотрит отчёт')} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #E4E6E9',borderRadius:999,padding:'3px 12px 3px 3px',fontSize:13,color:'#16181B',boxShadow:'0 1px 3px rgba(16,24,40,.06)'}}><span style={{width:24,height:24,borderRadius:'50%',background:'#DDF0B5',color:'#2F5200',fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{String(profile.name||'?').slice(0,1).toUpperCase()}</span>{profile.name}<span style={{color:'#8A9099'}}>· {T(isA?'администратор':ce?'редактор':'просмотр')}</span></span>
      <div role="group" aria-label="Language" style={{display:'flex',gap:2,background:'#fff',border:'1px solid #E4E6E9',borderRadius:9,padding:3,boxShadow:'0 1px 3px rgba(16,24,40,.06)'}}>{['ru','en'].map(l=><button key={l} onClick={()=>getLang()!==l&&setLang(l)} aria-pressed={getLang()===l} style={{height:26,minWidth:34,border:getLang()===l?'1px solid #B9DE73':'1px solid transparent',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',background:getLang()===l?'#DDF0B5':'transparent',color:getLang()===l?'#2F5200':'#6B717A'}}>{l.toUpperCase()}</button>)}</div>
    </div>
    {/* карточка проекта и создание проекта (новая система) */}
    {pmOpen&&allProjects.find(x=>x.id===pmOpen)&&<ProjectModal key={pmOpen} sales={projSales} initialTab={pmTab} project={allProjects.find(x=>x.id===pmOpen)} allProjects={allProjects} steps={steps} comments={comments} profile={profile} ce={ce} people={people} onClose={()=>{setPmOpen(null);setPmTab(null)}} onOpen={(id)=>{setPmTab(null);setPmOpen(id)}} onNewSub={(pid)=>setPmNew(pid)} reload={reload}/>}
    {pmNew!==null&&<NewProjectModal parentId={pmNew} allProjects={allProjects} people={people} profile={profile} onClose={()=>setPmNew(null)} onCreated={(id)=>{setPmNew(null);setPmOpen(id)}} reload={reload}/>}
  </div>
}
