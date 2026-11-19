import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { weekEnd, S, STATUS_CFG, Chip, Ed } from './lib/ui'
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

export default function App(){const[session,setSession]=useState(null);const[profile,setProfile]=useState(null);const[loading,setLoading]=useState(true);useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);useEffect(()=>{if(!session?.user)return setProfile(null);supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))},[session]);if(loading)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;if(!session)return<Login/>;if(!profile)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:S.bg,color:S.i3}}>Загрузка...</div>;return<Main profile={profile}/>}

function Main({profile}){
  const[view,setView]=useState('overview');const[reports,setReports]=useState([]);const[projects,setProjects]=useState([]);const[comments,setComments]=useState([]);const[aIdx,setAIdx]=useState(0);const[allProfiles,setAllProfiles]=useState([]);const[tTasks,setTTasks]=useState([]);const[tProgress,setTProgress]=useState([]);const[mPlans,setMPlans]=useState([])
  const aIdxRef=useRef(-1)
  const load=useCallback(async()=>{
    const[r,p,c,tt,tp]=await Promise.all([supabase.from('weekly_reports').select('*').order('week_start'),supabase.from('projects').select('*').order('sort_order'),supabase.from('project_comments').select('*').order('created_at',{ascending:false}),supabase.from('tactical_tasks').select('*').order('sort_order'),supabase.from('tactical_progress').select('*').order('week_start')])
    try{const{data:mpd}=await supabase.from('monthly_plans').select('*').order('id');if(mpd)setMPlans(mpd)}catch(e){console.warn('monthly_plans:',e)}
    if(r.data){setReports(r.data);const max=r.data.length-1;setAIdx(prev=>{const isFirst=aIdxRef.current===-1;const safe=isFirst?max:(prev<=max?prev:max);aIdxRef.current=safe;return safe})}
    if(p.data)setProjects(p.data);if(c.data)setComments(c.data);if(tt.data)setTTasks(tt.data);if(tp.data)setTProgress(tp.data)
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
  const weeklyTabs=[{id:'overview',l:'Обзор'},{id:'projects',l:'Проекты'},{id:'tactical',l:'Тактические'},{id:'plan',l:'План'},{id:'dynamics',l:'История'},{id:'trends',l:'Тренды'}]
  const printOverview=()=>{const el=document.getElementById('overview-print');if(!el)return;const w=window.open('','','width=900,height=700');w.document.write('<html><head><title>Growth Report '+rep?.week_label+'</title><style>body{font-family:-apple-system,sans-serif;padding:20px;color:#2C2C2A}table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;border:1px solid #E3E1D8;font-size:13px}</style></head><body>');w.document.write(el.innerHTML);w.document.write('</body></html>');w.document.close();w.print()}

  const NAV=[
    {sep:'Отчёты'},
    {id:'home',l:'Главная',ic:'home'},
    {id:'weekly',l:'Еженедельный',ic:'calendar'},
    ...(isA?[{id:'monthly',l:'Ежемесячный',ic:'chart-bar'}]:[]),
    {id:'yoy',l:'Годовой / YoY',ic:'trending-up'},{id:'seo',l:'SEO отчёт',ic:'target'},
    {sep:'Управление'},
    {id:'projects-all',l:'Проекты',ic:'layout-kanban'},
    {id:'tactical-all',l:'Тактические цели',ic:'target'},
    ...(isA?[{id:'team',l:'Команда',ic:'users'},{id:'export',l:'Выгрузка',ic:'target'}]:[]),
    {sep:'Настройки'},
    ...(isA?[{id:'channels',l:'Каналы и планы',ic:'adjustments'},{id:'integrations',l:'Интеграции',ic:'plug'},{id:'bot',l:'Slack бот',ic:'robot'},{id:'admin',l:'Администрирование',ic:'settings'}]:[]),
  ]

  const navTo=(p)=>{setPage(p);setMenuOpen(false)};return<div className='lh-app' style={{display:'grid',gridTemplateColumns:'220px 1fr',minHeight:'100vh',background:S.bg}}>
    {/* ═══ SIDEBAR ═══ */}
    <div className={'lh-sidebar'+(menuOpen?' open':'')} style={{background:S.sf,borderRight:`1px solid ${S.ln}`,padding:'20px 10px',display:'flex',flexDirection:'column',gap:1,position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
      <div style={{font:'700 20px/1 Poppins,sans-serif',color:S.gd,padding:'8px 14px 24px',display:'flex',alignItems:'center',gap:8}}>Growth</div>
      {NAV.map((n,i)=>n.sep?<div key={i} style={{font:'600 12px/1 Poppins,sans-serif',color:'#9AA0A6',letterSpacing:'.08em',textTransform:'uppercase',padding:'18px 14px 6px'}}>{n.sep}</div>:<button key={n.id} onClick={()=>navTo(n.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderRadius:8,font:'500 14px/1.3 Poppins,sans-serif',color:page===n.id?S.gm:S.i2,cursor:'pointer',border:'none',background:page===n.id?S.gp:'transparent',width:'100%',textAlign:'left',fontWeight:page===n.id?600:500}}><span style={{fontSize:18,width:20,textAlign:'center'}}>{n.ic==='home'?'⌂':n.ic==='calendar'?'☰':n.ic==='chart-bar'?'▣':n.ic==='trending-up'?'↗':n.ic==='layout-kanban'?'▤':n.ic==='target'?'◎':n.ic==='users'?'⊛':n.ic==='adjustments'?'⚙':n.ic==='plug'?'⚡':n.ic==='robot'?'⊞':n.ic==='settings'?'⋮':'·'}</span>{n.l}</button>)}
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
    {page==='home'&&<>
      <h1 style={{fontSize:24,fontWeight:600,marginBottom:22}}>Добро пожаловать{profile.name?', '+profile.name:''}</h1>
      <div style={{font:'600 12px/1 Poppins,sans-serif',color:'#9AA0A6',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:12}}>Быстрый доступ</div>
      <div className='lh-home-cards' style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:32}}>
        <div onClick={()=>navTo('weekly')} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:20,cursor:'pointer'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:14,fontWeight:500,color:S.i3}}>☰ Текущая неделя</div><div className='lh-num' style={{fontSize:28,fontWeight:600}}>{rep?.week_label||'—'}</div><div style={{fontSize:13,color:'#9AA0A6',marginTop:6}}>{rep?.metrics?.totalSales||0} продаж</div></div>
        {isA&&<div onClick={()=>navTo('monthly')} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:20,cursor:'pointer'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:14,fontWeight:500,color:S.i3}}>▣ Ежемесячный</div><div className='lh-num' style={{fontSize:28,fontWeight:600}}>{new Date(new Date().getFullYear(),new Date().getMonth()-1).toLocaleString('ru',{month:'long',year:'numeric'})}</div><div style={{fontSize:13,color:'#9AA0A6',marginTop:6}}>Отчёт за прошлый месяц</div></div>}
        <div onClick={()=>navTo('projects-all')} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:20,cursor:'pointer'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:14,fontWeight:500,color:S.i3}}>▤ Проекты</div><div className='lh-num' className='lh-num' style={{fontSize:28,fontWeight:600}}>{projects.filter(p=>p.status!=='done'&&p.status!=='wait').length} в работе</div><div style={{fontSize:13,color:'#9AA0A6',marginTop:6}}>{projects.filter(p=>p.status==='blocked'||p.status==='risk').length} блокер(ов)</div></div>
      </div>
      <div style={{font:'600 12px/1 Poppins,sans-serif',color:'#9AA0A6',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:12}}>Статус проектов</div>
      <div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:32}}>
        <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16}}><div style={{fontSize:13,color:S.i3}}>Всего активных</div><div className='lh-num' className='lh-num' style={{fontSize:28,fontWeight:600}}>{projects.filter(p=>p.status!=='done').length}</div></div>
        <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16}}><div style={{fontSize:13,color:S.i3}}>В работе</div><div className='lh-num' className='lh-num' style={{fontSize:28,fontWeight:600}}>{projects.filter(p=>p.status==='progress').length}</div></div>
        <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16,borderLeft:'3px solid #DD2A02',borderRadius:'0 14px 14px 0'}}><div style={{fontSize:13,color:'#DD2A02'}}>Блокеры</div><div className='lh-num' style={{fontSize:28,fontWeight:600,color:'#DD2A02'}}>{projects.filter(p=>p.status==='blocked'||p.status==='risk').length}</div></div>
        <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16}}><div style={{fontSize:13,color:S.i3}}>На тесте</div><div className='lh-num' className='lh-num' style={{fontSize:28,fontWeight:600}}>{projects.filter(p=>p.status==='test').length}</div></div>
      </div>
      <div style={{font:'600 12px/1 Poppins,sans-serif',color:'#9AA0A6',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:12}}>Последние комментарии</div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {[...comments].sort((a,b)=>(b.created_at||b.id||'').localeCompare(a.created_at||a.id||'')).slice(0,8).map(c=>{const proj=projects.find(p=>p.id===c.project_id);return<div key={c.id} style={{background:S.sf,borderRadius:10,boxShadow:S.sh,padding:'12px 18px',display:'flex',justifyContent:'space-between',alignItems:'start',gap:12}}><div><b style={{fontSize:14}}>{proj?.name||''}</b><span style={{fontSize:13,color:S.i3,marginLeft:4}}>({c.author})</span><div style={{fontSize:13,color:S.i2,marginTop:2}}>{(c.full_text||c.summary||'').slice(0,80)}</div></div><small style={{fontSize:12,color:'#9AA0A6',whiteSpace:'nowrap'}}>{weekEnd(c.week_start)}</small></div>})}
      </div>
    </>}

    {/* WEEKLY */}
    {page==='weekly'&&!rep&&<div style={{padding:40,textAlign:'center',color:S.i3}}>Нет отчётов. Создайте первый отчёт.</div>}
    {page==='weekly'&&rep&&<>
      <div className='lh-plate' style={{background:'linear-gradient(180deg,#6E9B0E,#497B02)',borderRadius:14,padding:'32px 32px 28px',marginBottom:22}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:14,letterSpacing:'.1em',textTransform:'uppercase',color:'#FAFAFA',fontWeight:600}}>Growth · еженедельный отчёт</div>
          <span style={{fontSize:14,color:'#fff'}}>{profile.name}</span>
        </div>
        {rep&&<><h1 className='lh-title' style={{margin:'4px 0 0',fontSize:32,color:'#fff',fontWeight:700}}>Неделя <Ed value={rep.week_label} canEdit={ce} onSave={v=>upRep({week_label:v})} style={{fontSize:32,color:'#fff',fontWeight:700}}/></h1>
          <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {ce?<select value={rep.status} onChange={e=>upRep({status:e.target.value})} style={{fontSize:14,fontWeight:500,padding:'8px 16px',borderRadius:999,border:'none',background:STATUS_CFG[rep.status]?.bg,color:STATUS_CFG[rep.status]?.tx,cursor:'pointer'}}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>:<Chip bg={STATUS_CFG[rep.status]?.bg} tx={STATUS_CFG[rep.status]?.tx}>{STATUS_CFG[rep.status]?.label}</Chip>}
            <Ed value={rep.status_note} canEdit={ce} onSave={v=>upRep({status_note:v})} ph="Описание статуса..." style={{fontSize:16,color:'rgba(255,255,255,.8)'}}/>
          </div>
        </>}
        <div style={{marginTop:10,display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          {reports.map((r,i)=><button key={r.id} onClick={()=>setWeek(i)} style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:i===aIdx?600:500,background:i===aIdx?'#fff':'rgba(255,255,255,.14)',color:i===aIdx?'#121416':'#FAFAFA'}}>{r.week_label}</button>)}
          {ce&&<button onClick={createWeek} style={{padding:'4px 12px',borderRadius:14,border:'1px dashed rgba(255,255,255,.5)',cursor:'pointer',fontSize:14,fontWeight:500,background:'rgba(255,255,255,.14)',color:'#FAFAFA'}}>+ новая неделя</button>}
          {isA&&rep&&<button onClick={deleteWeek} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:500,background:'rgba(255,99,63,.25)',color:'#FF8A6F',display:'flex',alignItems:'center',gap:6}}>✕ Удалить отчёт</button>}
        </div>
      </div>
      <div style={{display:'flex',gap:2,marginBottom:16,background:'#fff',borderRadius:12,padding:8,boxShadow:S.sh,overflowX:'auto'}} className="lh-tabs">
        {weeklyTabs.map(t=><button key={t.id} onClick={()=>setView(t.id)} style={{flex:'0 0 auto',padding:'8px 14px',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:500,background:view===t.id?'#6E9B0E':'transparent',color:view===t.id?'#fff':'#585E65',whiteSpace:'nowrap'}}>{t.l}</button>)}
      </div>
      {view==='overview'&&rep&&<Overview rep={rep} reports={reports} projects={projects} comments={comments} ce={ce} up={upRep} tTasks={tTasks} tProgress={tProgress} print={printOverview} refreshDaily={refreshFromDaily} recalcAll={recalcAll} mPlans={mPlans} reload={reload}/>}
      {view==='projects'&&<Projects projects={projects} setProjects={setProjects} comments={comments} setComments={setComments} ce={ce} reports={reports} aIdx={aIdx} profile={profile} reload={reload} rep={rep} upRep={upRep}/>}
      {view==='tactical'&&<Tactical tasks={tTasks} progress={tProgress} reports={reports} aIdx={aIdx} ce={ce} reload={reload} profile={profile} mPlans={mPlans}/>}
      {view==='plan'&&<Plan plans={mPlans} ce={ce} reload={reload}/>}
      {view==='dynamics'&&<Dynamics projects={projects} comments={comments} reports={reports} aIdx={aIdx} ce={ce} reload={reload}/>}
      {view==='trends'&&<Trends reports={reports} mPlans={mPlans}/>}
    </>}

    {/* MONTHLY */}
    {page==='monthly'&&isA&&<MonthlyReport reports={reports} projects={projects} comments={comments} mPlans={mPlans} setMPlans={setMPlans} ce={ce} reload={reload}/>}

    {/* YOY */}
    {page==='yoy'&&<YoYReport/>}

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
  </div>
}
