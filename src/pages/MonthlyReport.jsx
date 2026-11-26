import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { S, PROJ_ST, Chip, pct, Label, Ed, EdNum, EList, CItem, AddComment, cpoAdsOf, cpoTotalOf, PROJ_CATS, catOf, DECISIONS, ImageUpload, pillSelect, chipStyle } from '../lib/ui'
import TunePanel from '../pm/TunePanel'
import { HEALTH, DIR_COLORS, isMe, weekLabel } from '../pm/pmlib'

function MonthlyReport({reports,projects,comments,mPlans,setMPlans,ce,reload}){const[tune,setTune]=useState(false);const fdm=(d)=>{if(!d)return'';const p=String(d).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0].slice(2)}`:d};
  const[year,setYear]=useState(2026);const[month,setMonth]=useState(null);const[compare,setCompare]=useState(null)
  const[mData,setMData]=useState({});const[loading,setLoading]=useState(false);const[churnCmp,setChurnCmp]=useState(null);const[expandedWeekly,setExpandedWeekly]=useState({});const[metricsCmp,setMetricsCmp]=useState(null);const[localStatus,setLocalStatus]=useState(null);const[catFilter,setCatFilter]=useState(()=>{try{return localStorage.getItem('lh_monthly_cat')||'all'}catch(e){return'all'}})
  const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

  const loadMonth=async(y,m)=>{const key=`${y}-${String(m+1).padStart(2,'0')}`;if(mData[key])return mData[key];setLoading(true);try{const r=await fetch(`/api/monthly?month=${key}`);const d=await r.json();const weeks=reports.filter(r=>r.week_start?.startsWith(key)).sort((a,b)=>a.week_start.localeCompare(b.week_start));const result={...d,weeks,key};setMData(prev=>({...prev,[key]:result}));return result}catch(e){console.error(e)}finally{setLoading(false)}}
  const selectMonth=async(m)=>{setMonth(m);setLocalStatus(null);const key=`${year}-${String(m+1).padStart(2,'0')}`;if(!mData[key])await loadMonth(year,m)}
  const selectCompare=async(y,m)=>{await loadMonth(y,m);setCompare({year:y,month:m})}

  const sel=month!=null?mData[`${year}-${String(month+1).padStart(2,'0')}`]:null
  const plan=sel?mPlans.find(p=>p.id===sel.key):null

  const Spark=({data,color})=>{if(!data||data.length<2)return null;const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;const pts=data.map((v,i)=>`${4+i*(72/(data.length-1))},${22-((v-mn)/rng)*18}`).join(' ');return<svg width={80} height={26} viewBox="0 0 80 26" style={{verticalAlign:'middle'}}><polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>{data.map((v,i)=><circle key={i} cx={4+i*(72/(data.length-1))} cy={22-((v-mn)/rng)*18} r={2.5} fill="#fff" stroke={color} strokeWidth={1.5}/>)}</svg>}

  const savePlan=async(field,val)=>{if(!sel)return;const id=sel.key;const{data:ex}=await supabase.from('monthly_plans').select('id').eq('id',id).maybeSingle();if(!ex){const ml=months[parseInt(id.split('-')[1])-1]+' '+id.split('-')[0];const{error:ie}=await supabase.from('monthly_plans').insert({id,month_label:ml,days_in_month:new Date(parseInt(id.split('-')[0]),parseInt(id.split('-')[1]),0).getDate()});if(ie){alert('Ошибка создания: '+ie.message);return}};const{error}=await supabase.from('monthly_plans').update({[field]:val,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Ошибка сохранения: '+error.message);return};const{data:fresh}=await supabase.from('monthly_plans').select('*').order('id');if(fresh)setMPlans(fresh)}
  const saveText=async(field,val)=>{if(!sel)return;const id=sel.key;const{data:ex}=await supabase.from('monthly_plans').select('id').eq('id',id).maybeSingle();if(!ex){const ml=months[parseInt(id.split('-')[1])-1]+' '+id.split('-')[0];const{error:ie}=await supabase.from('monthly_plans').insert({id,month_label:ml,days_in_month:new Date(parseInt(id.split('-')[0]),parseInt(id.split('-')[1]),0).getDate()});if(ie){alert('Ошибка создания: '+ie.message);return}};const{error}=await supabase.from('monthly_plans').update({[field]:val,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Ошибка сохранения: '+error.message);return};const{data:fresh}=await supabase.from('monthly_plans').select('*').order('id');if(fresh)setMPlans(fresh)}
  const getSummaries=()=>plan?.project_summaries||{}
  const saveSummary=(pid,field,val)=>{const s={...getSummaries()};if(!s[pid])s[pid]={};s[pid][field]=val;saveText('project_summaries',s)}
  const pctD=(f,p)=>p&&f?Math.round((f-p)/p*100):null

  // ═══ MONTH PICKER ═══
  if(month==null)return<>
    <Label>Monthly Report</Label>
    <div style={{display:'flex',gap:8,marginBottom:22}}>{[2026,2027].map(y=><button key={y} onClick={()=>setYear(y)} style={chipStyle(year===y)}>{y}</button>)}</div>
    <div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}} className="lh-kpi">
      {months.map((m,i)=>{const now=new Date();const hasData=(year<now.getFullYear())||(year===now.getFullYear()&&i<=now.getMonth());return<button key={i} onClick={()=>hasData&&selectMonth(i)} style={{padding:'18px 16px',borderRadius:14,border:'none',cursor:hasData?'pointer':'default',background:hasData?'#fff':'#F7F8F9',boxShadow:hasData?S.sh:'none',fontSize:16,fontWeight:600,color:hasData?S.ink:'#C4C8CD',opacity:hasData?1:.5}}>{m}</button>})}
    </div>
  </>

  if(!sel)return<div style={{padding:40,textAlign:'center',color:S.i3}}>{loading?'Загрузка...':'Нет данных'}</div>

  // ═══ COMPUTED VALUES ═══
  const ws=sel.weeks||[];const wSales=ws.map(w=>w.metrics?.totalSales||0);const wCpoAds=ws.map(w=>w.metrics?.cpoAdsOverride??cpoAdsOf(w.channels)??0);const wCpoTotal=ws.map(w=>w.metrics?.cpoTotalOverride??cpoTotalOf(w.metrics)??0)
  const cpoAds=sel.paidSales>0?Math.round(sel.adSpend/sel.paidSales):null
  const cpoTotal=sel.totalSales>0?Math.round((sel.totalSpentBM||0)/sel.totalSales):null
  const monthComments=comments.filter(c=>c.week_start?.startsWith(sel.key))
  const keyProjects=projects.filter(p=>!p.parent_id&&!p.archived_at&&(p.status!=='done'||(plan?.extra_projects||[]).includes(p.id)))
  const famIdsOf=(p)=>[p.id,...projects.filter(x=>x.parent_id===p.id).map(x=>x.id)]
  const monthWeeks=(()=>{const [y,m]=sel.key.split('-').map(Number);const out=[];const d=new Date(y,m-1,1,12);d.setDate(d.getDate()-((d.getDay()+6)%7));while(true){const e=new Date(d);e.setDate(e.getDate()+6);if(e.getMonth()===m-1&&e.getFullYear()===y)out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));else if(out.length||e>new Date(y,m,1))break;d.setDate(d.getDate()+7);if(out.length>6)break}return out})()
  const monthCommentsAll=comments.filter(c=>monthWeeks.includes(String(c.week_start).slice(0,10))||c.week_start?.startsWith(sel.key))
  const moveProj=async(list,idx,dir)=>{const to=idx+dir;if(to<0||to>=list.length)return;const ids=list.map(p=>p.id);[ids[idx],ids[to]]=[ids[to],ids[idx]];const res=await Promise.all(ids.map((id,i)=>supabase.from('projects').update({sort_order:(i+1)*10}).eq('id',id)));const err=res.find(r=>r.error);if(err)alert('Ошибка сортировки: '+err.error.message);reload()}
  const setCat=v=>{setCatFilter(v);try{localStorage.setItem('lh_monthly_cat',v)}catch(e){}}
  const blockers=projects.filter(p=>p.status==='blocked'||p.status==='risk')
  const summaries=getSummaries()

  return<>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
      <button onClick={()=>setMonth(null)} style={{fontSize:14,color:S.gd,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>← Назад к месяцам</button>
      <div style={{display:'flex',gap:8}}>
        {!compare&&<button onClick={()=>selectCompare(year,month>0?month-1:11)} style={{fontSize:14,padding:'8px 14px',borderRadius:8,border:`1px solid ${S.ln}`,background:'#fff',cursor:'pointer',fontWeight:500,color:S.i2}}>Сравнить</button>}
        {compare&&<><select value={`${compare.year}-${compare.month}`} onChange={async e=>{const[cy,cm2]=e.target.value.split('-').map(Number);await selectCompare(cy,cm2)}} style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,fontWeight:500}}>{months.map((mn,mi)=><option key={mi} value={`${year}-${mi}`}>{mn} {year}</option>)}</select><button onClick={()=>setCompare(null)} style={{fontSize:14,padding:'8px 14px',borderRadius:8,border:'none',background:'#FFEEEA',cursor:'pointer',fontWeight:500,color:'#A71F00'}}>Убрать</button></>}
      </div>
    </div>

    {/* ═══ 1. STATUS ═══ */}
    <div className='lh-mplate' style={{background:(localStatus||plan?.status)==='red'?'linear-gradient(180deg,#DD2A02,#A71F00)':(localStatus||plan?.status)==='green'?'linear-gradient(180deg,#6E9B0E,#497B02)':'linear-gradient(180deg,#F18B0E,#B76400)',borderRadius:14,padding:32,color:'#fff',marginBottom:22}}>
      {ce?<select value={localStatus||plan?.status||'yellow'} onChange={e=>{setLocalStatus(e.target.value);savePlan('status',e.target.value)}} style={{fontSize:14,fontWeight:500,padding:'8px 16px',borderRadius:999,border:'none',cursor:'pointer',color:'#fff',background:(localStatus||plan?.status)==='green'?'#6E9B0E':(localStatus||plan?.status)==='red'?'#DD2A02':'#F18B0E'}}><option value='green'>зелёный</option><option value='yellow'>жёлтый</option><option value='red'>красный</option></select>:<Chip bg={(localStatus||plan?.status)==='green'?'#6E9B0E':(localStatus||plan?.status)==='red'?'#DD2A02':'#F18B0E'} tx='#fff'>{(localStatus||plan?.status)==='green'?'зелёный':(localStatus||plan?.status)==='red'?'красный':'жёлтый'}</Chip>}
      <h2 className='lh-title' style={{fontSize:28,fontWeight:700,margin:'12px 0 8px'}}>Growth report · {months[month]} {year}</h2>
      <Ed value={plan?.status_description||''} canEdit={ce} onSave={v=>saveText('status_description',v)} ph="Краткое описание статуса месяца..." style={{fontSize:14,color:'rgba(255,255,255,.8)'}}/>
    </div>

    {/* ═══ 2. METRICS CARDS + COMPARISON ═══ */}
    {(()=>{const mc=metricsCmp!=null?metricsCmp:null;const mcKey=mc!=null?`${year}-${String(mc+1).padStart(2,'0')}`:null;const mcData=mcKey?mData[mcKey]:null;const mcCpoAds=mcData&&mcData.paidSales>0?Math.round(mcData.adSpend/mcData.paidSales):null;const mcCpoTotal=mcData&&mcData.totalSales>0?Math.round((mcData.totalSpentBM||0)/mcData.totalSales):null
    return<div className='lh-mteal' style={{background:'linear-gradient(180deg,#0F6E5E,#0B5548)',borderRadius:14,padding:'28px 32px',color:'#fff',marginBottom:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,.5)',letterSpacing:'.06em',textTransform:'uppercase'}}>Метрики · факт vs план</span>{plan?.is_closed&&<span style={{fontSize:12,padding:'3px 10px',borderRadius:999,background:'rgba(255,255,255,.2)',color:'#fff'}}>закрыт</span>}<a href='https://docs.google.com/spreadsheets/d/1FkXG0k97T-7uxLYdSh3eHHqKBaOiPRGnUQKQTcziXAs/edit?gid=489474941#gid=489474941' target='_blank' rel='noopener' style={{fontSize:12,padding:'4px 12px',borderRadius:8,background:'rgba(255,255,255,.15)',color:'#fff',textDecoration:'none',border:'1px solid rgba(255,255,255,.25)',cursor:'pointer',fontWeight:500}}>Финансовый отчёт ↗</a></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>{ce&&!plan?.is_closed&&<button onClick={async()=>{if(!confirm('Закрыть месяц? Метрики будут зафиксированы.'))return;await savePlan('is_closed',true);await savePlan('closed_sales',sel.totalSales);await savePlan('closed_cpo_ads',cpoAds);await savePlan('closed_cpo_total',cpoTotal);await savePlan('closed_budget',sel.totalSpentBM)}} style={{fontSize:12,padding:'4px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.3)',background:'transparent',color:'#fff',cursor:'pointer'}}>Закрыть месяц</button>}{ce&&plan?.is_closed&&<button onClick={()=>savePlan('is_closed',false)} style={{fontSize:12,padding:'4px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.3)',background:'transparent',color:'#fff',cursor:'pointer'}}>Открыть</button>}
        <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>vs:</span><select value={mc!=null?mc:''} onChange={async e=>{const v=e.target.value;if(v===''){setMetricsCmp(null);return};const mi=Number(v);setMetricsCmp(mi);const k=`${year}-${String(mi+1).padStart(2,'0')}`;if(!mData[k])await loadMonth(year,mi)}} style={{font:'500 12px/1 Poppins,sans-serif',padding:'4px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.15)',cursor:'pointer'}}><option value=''>без сравнения</option>{months.map((mn,mi)=>mi!==month&&<option key={mi} value={mi}>{mn}</option>)}</select></div></div>
      </div>
      <div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24}}>
        {[{l:'Продажи',f:plan?.is_closed?plan.closed_sales:sel.totalSales,p:plan?.total_plan,pk:'total_plan',sp:wSales,inv:false,cf:mcData?.totalSales},{l:'CPO Ads',f:plan?.override_cpo_ads!=null?plan.override_cpo_ads:(plan?.is_closed?plan.closed_cpo_ads:cpoAds),p:plan?.plan_cpo_ads,pk:'plan_cpo_ads',ok:'override_cpo_ads',sp:wCpoAds,inv:true,pre:'$',cf:mcCpoAds},{l:'CPO Total',f:plan?.override_cpo_total!=null?plan.override_cpo_total:(plan?.is_closed?plan.closed_cpo_total:cpoTotal),p:plan?.plan_cpo_total,pk:'plan_cpo_total',ok:'override_cpo_total',sp:wCpoTotal,inv:true,pre:'$',cf:mcCpoTotal},{l:'Бюджет',f:plan?.override_budget!=null?plan.override_budget:(plan?.is_closed?plan.closed_budget:(sel.totalSpentBM||0)),p:plan?.ads_budget,pk:'ads_budget',ok:'override_budget',sp:ws.map(w=>w.metrics?.totalSpentBM||0),inv:true,pre:'$',cf:mcData?.totalSpentBM}].map((x,i)=>{const d=pctD(x.f,x.p);const isGood=x.inv?(d&&d<0):(d&&d>0);const cd=x.cf!=null&&x.f!=null&&x.cf!==0?Math.round((x.f-x.cf)/x.cf*100):null;const cGood=x.inv?(cd&&cd<0):(cd&&cd>0)
          return<div key={i}>
          <div style={{fontSize:14,color:'rgba(255,255,255,.6)',marginBottom:8}}>{x.l}</div>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}><span className='lh-num' style={{fontSize:36,fontWeight:600}}>{x.pre||''}<EdNum value={x.f} canEdit={ce} onSave={v=>savePlan(x.ok,v)} style={{fontSize:36,fontWeight:600,color:'#fff'}}/></span><Spark data={x.sp} color={d==null?'rgba(255,255,255,.4)':isGood?'#AAD34F':'#FF8A6F'}/></div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.45)',marginTop:6}}>план <EdNum value={x.p} canEdit={ce} onSave={v=>savePlan(x.pk,v)} style={{fontSize:13,color:'rgba(255,255,255,.45)'}}/>{d!=null&&<span style={{marginLeft:6,fontWeight:600,color:isGood?'#AAD34F':'#FF8A6F'}}>{d>0?'+':''}{d}%</span>}</div>
          {mc!=null&&<div style={{fontSize:12,color:'rgba(255,255,255,.35)',marginTop:4}}>{months[mc]?.slice(0,3)}: {x.pre||''}{x.cf?.toLocaleString()||'—'}{cd!=null&&<span style={{marginLeft:6,fontWeight:600,color:cGood?'#AAD34F':'#FF8A6F'}}>{cd>0?'+':''}{cd}%</span>}</div>}
        </div>})}
      </div>
    </div>})()}



    {/* ═══ 3. CHURN RATE ═══ */}
    {(()=>{const churnFields=[{k:'churn_base',l:'Активная база',isBs:true},{k:'churn_total',l:'Общий отток'},{k:'churn_0_12',l:'Отток в шт.',isBs:true},{k:'churn_0_3',l:'Отток 0–3 мес'},{k:'churn_4_6',l:'Отток 4–6 мес'},{k:'churn_7_12',l:'Отток 7–12 мес'},{k:'churn_13_24',l:'Отток 13–24 мес'},{k:'churn_25p',l:'Отток 25+ мес'}];const cc=churnCmp!=null?churnCmp:(month>0?month-1:11);const cmpKey=`${year}-${String(cc+1).padStart(2,'0')}`;const cmpPlan=mPlans.find(p=>p.id===cmpKey)
      return<div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22,marginBottom:22}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Churn rate · {months[month]} {year}</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:13,color:'#9AA0A6'}}>vs:</span><select value={cc} onChange={e=>setChurnCmp(Number(e.target.value))} style={{font:'500 13px/1 Poppins,sans-serif',padding:'6px 10px',borderRadius:8,border:`1px solid ${S.ln}`,cursor:'pointer'}}>{months.map((mn,mi)=>{const k=`${year}-${String(mi+1).padStart(2,'0')}`;const has=mPlans.some(p=>p.id===k);return<option key={mi} value={mi}>{mn} {year}{has?'':' (нет данных)'}</option>})}</select></div>
        </div>
        <div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}} className='lh-grid4'>
          {churnFields.map(f=>{const val=plan?.[f.k];const prev=cmpPlan?.[f.k];const d=val!=null&&prev!=null&&prev!==0?(f.isBs?((val-prev)/prev*100):(val-prev)):null;const dStr=d!=null?(f.isBs?(d>0?'+':'')+d.toFixed(1)+'%':(d>0?'+':'')+d.toFixed(1)+'pp'):null;const isGood=f.k==='churn_base'?(d&&d>0):(d&&d<0)
            return<div key={f.k} style={{background:'#F7F8F9',borderRadius:10,padding:'14px 12px'}}><div style={{fontSize:13,color:S.i3,marginBottom:4}}>{f.l}</div><div className='lh-num' style={{fontSize:22,fontWeight:600}}><EdNum value={val} canEdit={ce} onSave={v=>savePlan(f.k,v)} style={{fontSize:22,fontWeight:600}}/>{!f.isBs&&val!=null&&<span style={{fontSize:16,fontWeight:500}}>%</span>}</div><div style={{fontSize:12,color:'#9AA0A6',marginTop:4}}>{months[cc]?.slice(0,3)}: {prev!=null?(f.isBs?prev.toLocaleString():prev+'%'):'—'} {dStr&&<span style={{fontWeight:700,fontSize:14,color:isGood?'#1B8A00':'#DD2A02'}}>{dStr}</span>}</div></div>})}
        </div>
      </div>})()}

        {/* ═══ 4. CHANNELS — fully editable ═══ */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <span style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Каналы</span>
      {ce&&<select onChange={e=>{if(!e.target.value)return;const hc=plan?.hidden_channels||[];const next=hc.includes(e.target.value)?hc:([...hc,e.target.value]);saveText('hidden_channels',next);e.target.value=''}} style={{padding:'4px 8px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:12,cursor:'pointer'}}><option value="">скрыть канал...</option>{(sel.channels||[]).filter(ch2=>!(plan?.hidden_channels||[]).includes(ch2.name)).map(ch2=><option key={ch2.name} value={ch2.name}>{ch2.name}</option>)}</select>}
    </div>
    {(plan?.hidden_channels||[]).length>0&&ce&&<div style={{marginBottom:8,display:'flex',gap:4,flexWrap:'wrap'}}><span style={{fontSize:12,color:S.i3}}>Скрытые:</span>{(plan?.hidden_channels||[]).map(n=><button key={n} onClick={()=>saveText('hidden_channels',(plan?.hidden_channels||[]).filter(x=>x!==n))} style={{fontSize:12,padding:'2px 8px',borderRadius:6,border:`1px solid ${S.ln}`,background:'#F7F8F9',cursor:'pointer'}}>{n} ↩</button>)}</div>}
    <div style={{background:'#fff',borderRadius:14,boxShadow:S.sh,padding:'6px 12px',marginBottom:22}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}><thead><tr style={{borderBottom:`1px solid ${S.ln}`}}>{['Канал','Sales','План','%','CPO','CPO план','Spent'].map(h=><th key={h} style={{textAlign:h==='Канал'?'left':'right',fontSize:13,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',color:S.i3,padding:'10px 12px'}}>{h}</th>)}</tr></thead>
      <tbody>{(sel.channels||[]).filter(c=>(c.sales>0||c.spent>0)&&!(plan?.hidden_channels||[]).includes(c.name)).map((c,i)=>{const cp2=(plan?.channel_plans||{})[c.name?.toLowerCase?.()]||{};const ps=cp2.planSales||null;const pct=ps&&c.sales?Math.round(c.sales/ps*100):null;const cpo=c.spent&&c.sales?Math.round(c.spent/c.sales):null;return<tr key={i} style={{borderBottom:'1px solid #E4E6E9'}}>
        <td style={{padding:12,fontWeight:600}}>{c.name}</td>
        <td style={{padding:12,textAlign:'right'}}><EdNum value={c.sales} canEdit={ce} onSave={v=>{const chs=[...(sel.channels||[])];chs[i]={...chs[i],sales:v};saveText('channel_overrides',chs)}} style={{fontWeight:600}}/></td>
        <td style={{padding:12,textAlign:'right'}}><EdNum value={ps} canEdit={ce} onSave={v=>{const cp3={...(plan?.channel_plans||{})};const k=c.name?.toLowerCase?.();cp3[k]={...(cp3[k]||{}),planSales:v};savePlan('channel_plans',cp3)}} style={{color:S.i3}}/></td>
        <td style={{padding:12,textAlign:'right'}}>{pct?<span style={{fontWeight:600,color:pct>=90?'#497B02':pct>=60?'#F18B0E':'#A71F00'}}>{pct}%</span>:'—'}</td>
        <td style={{padding:12,textAlign:'right'}}><EdNum value={cpo} canEdit={ce} prefix="$" onSave={v=>{const chs=[...(sel.channels||[])];chs[i]={...chs[i],cpo:v};saveText('channel_overrides',chs)}} style={{color:S.i2}}/></td>
        <td style={{padding:12,textAlign:'right'}}><EdNum value={cp2.planCpo} canEdit={ce} prefix="$" onSave={v=>{const cp3={...(plan?.channel_plans||{})};const k=c.name?.toLowerCase?.();cp3[k]={...(cp3[k]||{}),planCpo:v};savePlan('channel_plans',cp3)}} style={{color:S.i3}}/></td>
        <td style={{padding:12,textAlign:'right'}}><EdNum value={c.spent} canEdit={ce} prefix="$" onSave={v=>{const chs=[...(sel.channels||[])];chs[i]={...chs[i],spent:v};saveText('channel_overrides',chs)}} style={{color:S.i3}}/></td>
      </tr>})}</tbody></table>
    </div>

    {/* ═══ 5. KEY PROJECTS — add/remove + structured ═══ */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}>
      <span style={{fontSize:12,fontWeight:600,color:S.i3,letterSpacing:'.07em',textTransform:'uppercase',whiteSpace:'nowrap'}}>Проекты · месячный итог</span>
      {ce&&<div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <select onChange={e=>{if(!e.target.value)return;const ex=plan?.extra_projects||[];saveText('extra_projects',[...ex,e.target.value]);e.target.value=''}} style={{padding:'0 12px',height:36,width:210,borderRadius:10,border:`1px solid ${S.ln}`,fontSize:13,cursor:'pointer',background:'#fff'}}><option value="">+ завершённый...</option>{projects.filter(p=>p.status==='done'&&!(plan?.extra_projects||[]).includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button onClick={()=>setTune(true)} style={{padding:'0 14px',height:36,borderRadius:10,border:`1px solid ${S.ln}`,fontSize:13,fontWeight:600,cursor:'pointer',background:'#fff'}}>⚙ Настроить отчёт{(plan?.hidden_key_projects||[]).length?` · скрыто ${(plan?.hidden_key_projects||[]).filter(id=>keyProjects.some(p=>p.id===id)).length}`:''}</button>
      </div>}
      {tune&&(()=>{const hid=plan?.hidden_key_projects||[];const setMany=(ids,hide)=>saveText('hidden_key_projects',hide?Array.from(new Set([...hid,...ids])):hid.filter(x=>!ids.includes(x)))
        return<TunePanel period={sel.label||sel.key} hint="Выключи проекты, которые не нужно показывать в итогах этого месяца. Изменения сохраняются сразу и видны всем." onClose={()=>setTune(false)} onToggle={id=>setMany([id],!hid.includes(id))} onSetMany={setMany}
          groups={PROJ_CATS.map(cat=>({key:cat.v,label:cat.l,color:DIR_COLORS[cat.v],items:keyProjects.filter(p=>catOf(p)===cat.v).map(p=>({id:p.id,name:p.name,meta:p.id+' · '+(p.owner||'—'),on:!hid.includes(p.id)}))}))}/>})()}
    </div>
    {(()=>{const hid=(plan?.hidden_key_projects||[]).filter(id=>projects.some(p=>p.id===id));const vis=keyProjects.filter(p=>!hid.includes(p.id));const chip=(v,l,n,dashed)=>{const on=catFilter===v;return<button key={v} onClick={()=>setCat(v)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:999,border:on?`1px solid #B9DE73`:`1px ${dashed?'dashed':'solid'} ${S.ln}`,background:on?'#DDF0B5':'#fff',color:on?'#2F5200':S.i2,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{l}<span style={{fontSize:12,fontWeight:500,opacity:on?.85:.6}}>{n}</span></button>};return<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:20}}>{chip('all','Все',vis.length)}{PROJ_CATS.map(cat=>{const n=vis.filter(p=>catOf(p)===cat.v).length;return n>0&&chip(cat.v,cat.l,n)})}{hid.length>0&&chip('hidden','Скрытые',hid.length,true)}</div>})()}
    {(()=>{if(catFilter==='hidden'){const hid=(plan?.hidden_key_projects||[]).map(id=>projects.find(p=>p.id===id)).filter(Boolean);return hid.length===0?<div style={{padding:16,color:S.i3}}>Скрытых проектов нет</div>:<div><div style={{fontSize:13,color:S.i3,marginBottom:10}}>Скрыты только в этом месяце</div>{hid.map(p=><div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,background:'#F7F8F9',borderRadius:12,padding:'12px 18px',marginBottom:8}}><span style={{fontSize:14,color:S.i2}}>{p.name}</span>{ce&&<button onClick={()=>saveText('hidden_key_projects',(plan?.hidden_key_projects||[]).filter(x=>x!==p.id))} style={{fontSize:13,padding:'5px 12px',borderRadius:8,border:`1px solid ${S.ln}`,background:'#fff',cursor:'pointer',fontWeight:500,color:S.i2}}>↩ вернуть</button>}</div>)}</div>}
    const visibleKey=keyProjects.filter(p=>!(plan?.hidden_key_projects||[]).includes(p.id)).sort((a,b)=>{const d=(a.sort_order||0)-(b.sort_order||0);if(d!==0)return d;if(a.priority==='key'&&b.priority!=='key')return -1;if(b.priority==='key'&&a.priority!=='key')return 1;return 0});const cf=PROJ_CATS.some(cat=>cat.v===catFilter)?catFilter:'all';const filteredKey=cf==='all'?visibleKey:visibleKey.filter(p=>catOf(p)===cf);const usedCats=PROJ_CATS.filter(cat=>filteredKey.some(p=>catOf(p)===cat.v));return usedCats.length===0?<div style={{padding:16,color:S.i3}}>Нет проектов в этой категории</div>:usedCats.map(cat=><div key={cat.v}><div style={{display:'flex',alignItems:'baseline',gap:10,borderBottom:`1px solid ${S.ln}`,paddingBottom:8,marginBottom:14,marginTop:24}}><span style={{fontSize:21,fontWeight:600,color:S.gd}}>{cat.l}</span><span style={{fontSize:14,color:S.i3}}>{filteredKey.filter(p=>catOf(p)===cat.v).length}</span></div>{filteredKey.filter(p=>catOf(p)===cat.v).map((p,pi,arr)=>{const fids=famIdsOf(p);const pc=monthCommentsAll.filter(c=>fids.includes(c.project_id));const ps=PROJ_ST[p.status]||PROJ_ST.wait;const sm=summaries[p.id]||{};const showW=expandedWeekly[p.id]||false
      return<div key={p.id} style={{background:'#fff',borderRadius:14,boxShadow:S.sh,padding:'22px 24px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:14}}>
          <div><div style={{fontSize:16,fontWeight:600,lineHeight:1.35}}>{p.name}</div><div style={{display:'flex',gap:4,marginTop:6,alignItems:'center'}} title="Как прошли недели месяца по отчётам владельца">{monthWeeks.map(w=>{const ups=pc.filter(c=>String(c.week_start).slice(0,10)===w);const hs=ups.map(c=>c.health||'green');const h=hs.includes('red')?'red':hs.includes('amber')?'amber':hs.length?'green':null;return<span key={w} title={weekLabel(w)+(h?' · '+HEALTH[h][0]:' · отчёта нет')} style={{width:22,height:8,borderRadius:4,background:h?HEALTH[h][3]:'#fff',boxShadow:h?'none':'inset 0 0 0 1.5px #E3E6EA'}}/>})}<span style={{fontSize:11,color:S.i3,marginLeft:4}}>недели месяца</span></div><div style={{fontSize:13,color:S.i3,marginTop:3}}>{p.owner}{p.date_start&&<span> · с {fdm(p.date_start)}</span>}{p.date_test&&<span> · тест {fdm(p.date_test)}</span>}{p.date_results&&<span> · результаты {fdm(p.date_results)}</span>}{p.date_done&&<span> · завершение {fdm(p.date_done)}</span>}</div></div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>{p.priority==='key'&&<Chip bg='#FFF3CD' tx='#856404'>ключ</Chip>}<Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip>{ce&&<><button onClick={e=>{e.stopPropagation();moveProj(arr,pi,-1)}} disabled={pi===0} title="Вверх" style={{fontSize:16,lineHeight:1,padding:'4px 6px',background:'none',border:'none',cursor:pi===0?'default':'pointer',color:pi===0?'#E4E6E9':S.i3}}>↑</button><button onClick={e=>{e.stopPropagation();moveProj(arr,pi,1)}} disabled={pi===arr.length-1} title="Вниз" style={{fontSize:16,lineHeight:1,padding:'4px 6px',background:'none',border:'none',cursor:pi===arr.length-1?'default':'pointer',color:pi===arr.length-1?'#E4E6E9':S.i3}}>↓</button><button onClick={async()=>{await supabase.from('projects').update({priority:'current'}).eq('id',p.id);reload()}} title="Убрать из ключевых" style={{fontSize:14,background:'none',border:'none',cursor:'pointer',color:'#C4C8CD'}}>✕</button></>}</div>
        </div>
        <div style={{borderLeft:`3px solid ${p.status==='risk'||p.status==='blocked'?'#DD2A02':p.status==='done'?'#8CC63F':'#F6B45C'}`,paddingLeft:16}}>
          <div style={{display:'grid',gridTemplateColumns:'96px 1fr',gap:12,padding:'8px 0',fontSize:14,borderBottom:'1px solid #F1F2F4'}}><span style={{color:S.i3,fontSize:12,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase',paddingTop:2}}>Обещали</span><Ed value={p.promised||''} canEdit={ce} onSave={async v=>{await supabase.from('projects').update({promised:v}).eq('id',p.id);reload()}} ph='Обещали...' style={{color:S.ink}}/></div>
          {[{k:'fact',l:'Факт'},{k:'conclusion',l:'Вывод'}].map(f=><div key={f.k} style={{display:'grid',gridTemplateColumns:'96px 1fr',gap:12,padding:'8px 0',fontSize:14,borderBottom:'1px solid #F1F2F4'}}><span style={{color:S.i3,fontSize:12,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase',paddingTop:2}}>{f.l}</span><div><Ed value={sm[f.k]||''} canEdit={ce} onSave={v=>saveSummary(p.id,f.k,v)} ph={`${f.l}...`} style={{color:S.ink}}/>{ce&&f.k==='fact'&&!sm.fact&&pc.length>0&&<button onClick={()=>{const own=pc.filter(c=>isMe(p.owner,c.author));const src=(own.length?own:pc).slice().sort((a,b)=>String(a.week_start).localeCompare(String(b.week_start)));saveSummary(p.id,'fact',src.map(c=>weekLabel(String(c.week_start).slice(0,10))+': '+String(c.full_text||'').replace(/\s+/g,' ').trim()).join('\n'))}} style={{marginTop:6,fontSize:12,color:'#1761CB',background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:500}}>↓ Подтянуть из недельных отчётов ({pc.length})</button>}</div></div>)}
          <div style={{display:'grid',gridTemplateColumns:'96px 1fr',gap:12,padding:'8px 0',fontSize:14,borderBottom:'1px solid #F1F2F4',alignItems:'center'}}><span style={{color:S.i3,fontSize:12,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase',paddingTop:2}}>Решение</span>{ce?<select value={sm.decision||''} onChange={e=>saveSummary(p.id,'decision',e.target.value)} style={{...pillSelect('#F1F2F4','#121416'),justifySelf:'start'}}><option value="">выбрать…</option>{DECISIONS.map(d=><option key={d.v} value={d.v}>{d.l}</option>)}</select>:<span style={{fontSize:14,fontWeight:500}}>{DECISIONS.find(d=>d.v===sm.decision)?.l||sm.decision||'—'}</span>}</div>
          <div style={{display:'grid',gridTemplateColumns:'96px 1fr',gap:12,padding:'8px 0',fontSize:14,borderBottom:'1px solid #F1F2F4'}}><span style={{color:S.i3,fontSize:12,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase',paddingTop:2}}>Дальше</span><Ed value={sm.next||''} canEdit={ce} onSave={v=>saveSummary(p.id,'next',v)} ph="Что дальше..." style={{color:S.ink}}/></div>
        </div>
        {pc.length>0&&<button onClick={()=>setExpandedWeekly(prev=>({...prev,[p.id]:!showW}))} style={{fontSize:13,color:'#1761CB',cursor:'pointer',border:'none',background:'none',fontWeight:500,marginTop:10,padding:0}}>{showW?'▾ Скрыть':'▸ Показать'} недельные ({pc.length})</button>}
        {showW&&<div style={{marginTop:8}}>{pc.map(c=><CItem key={c.id} c={c} ce={ce} reload={reload} onDel={async()=>{await supabase.from('project_comments').delete().eq('id',c.id);reload()}}/>)}</div>}
        {ce&&<div style={{marginTop:8}}><AddComment projectId={p.id} weekStart={sel.key+'-01'} author="Monthly Report" reload={reload}/></div>}
      </div>})}</div>)})()}

    {/* ═══ 6. OTHER PROJECTS — edit, hide/show, wait at bottom ═══ */}
    {(()=>{const hidden=plan?.hidden_projects||[];const others=projects.filter(p=>p.priority!=='key'&&p.status!=='done'&&!hidden.includes(p.id));const sorted=[...others].sort((a,b)=>a.status==='wait'?1:b.status==='wait'?-1:0);const hiddenList=projects.filter(p=>hidden.includes(p.id))
    return<>{sorted.length>0&&<><Label>Остальные проекты</Label>
    <div style={{background:'#fff',borderRadius:14,boxShadow:S.sh,padding:'12px 18px',marginBottom:16}}>
      {sorted.map((p,i)=>{const ps=PROJ_ST[p.status]||PROJ_ST.wait;const pc=monthComments.filter(c=>c.project_id===p.id);const lc=pc.slice(-1)[0];const showW=expandedWeekly['o_'+p.id]
        return<div key={p.id} style={{padding:'12px 0',borderBottom:i<sorted.length-1?'1px solid #E4E6E9':'none'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
            <div style={{flex:1}}><span style={{fontWeight:600}}>{p.name}</span><span style={{color:S.i3,marginLeft:8,fontSize:14}}>{p.owner}</span></div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}><Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip>{ce&&<button onClick={()=>saveText('hidden_projects',[...hidden,p.id])} title="Скрыть" style={{fontSize:14,background:'none',border:'none',cursor:'pointer',color:'#C4C8CD'}}>✕</button>}</div>
          </div>
          <div style={{marginTop:4}}><Ed value={summaries[p.id]?.monthly_note||lc?.full_text?.slice(0,120)||lc?.summary||''} canEdit={ce} onSave={v=>saveSummary(p.id,'monthly_note',v)} ph='Итог за месяц...' style={{fontSize:14,color:S.i3}}/></div>
          {ce&&<button onClick={()=>setExpandedWeekly(prev=>({...prev,['o_'+p.id]:!showW}))} style={{fontSize:12,color:'#1761CB',cursor:'pointer',border:'none',background:'none',fontWeight:500,marginTop:4,padding:0}}>{showW?'▾':'▸'} комменты ({pc.length})</button>}
          {showW&&<div style={{marginTop:6}}>{pc.map(c=><CItem key={c.id} c={c} ce={ce} reload={reload} onDel={async()=>{await supabase.from('project_comments').delete().eq('id',c.id);reload()}}/>)}<AddComment projectId={p.id} weekStart={sel.key+'-01'} author="Monthly Report" reload={reload}/></div>}
        </div>})}
    </div></>}
    {ce&&hiddenList.length>0&&<div style={{marginBottom:22}}><span style={{fontSize:13,color:S.i3}}>Скрытые ({hiddenList.length}): </span>{hiddenList.map(p=><button key={p.id} onClick={()=>saveText('hidden_projects',hidden.filter(id=>id!==p.id))} style={{fontSize:13,padding:'7px 10px',borderRadius:8,border:`1px solid ${S.ln}`,background:'#F7F8F9',cursor:'pointer',marginRight:4}}>{p.name} ↩</button>)}</div>}
    </>})()}

    {/* ═══ 8. BLOCKERS — add/remove/edit ═══ */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <span style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Блокеры</span>
      {ce&&<select onChange={e=>{if(!e.target.value)return;supabase.from('projects').update({status:'blocked'}).eq('id',e.target.value).then(()=>reload());e.target.value=''}} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,cursor:'pointer'}}><option value="">+ добавить блокер...</option>{projects.filter(p=>p.status!=='blocked'&&p.status!=='done').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
    </div>
    <div style={{marginBottom:22}}>
      {blockers.map(p=><div key={p.id} style={{background:'#fff',borderRadius:14,boxShadow:S.sh,padding:18,marginBottom:12,borderLeft:'3px solid #DD2A02'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
          <div><div style={{fontSize:16,fontWeight:600}}>{p.name}</div><span style={{fontSize:14,color:S.i3}}>{p.owner}</span></div>
          {ce&&<button onClick={async()=>{await supabase.from('projects').update({status:'progress'}).eq('id',p.id);reload()}} title="Убрать из блокеров" style={{fontSize:14,background:'none',border:'none',cursor:'pointer',color:'#C4C8CD'}}>✕</button>}
        </div>
        <div style={{marginTop:8}}><Ed value={p.constraints_text||''} canEdit={ce} multi onSave={async v=>{await supabase.from('projects').update({constraints_text:v}).eq('id',p.id);reload()}} ph="История блокера, переносы, импакт..." style={{fontSize:14,color:'#A71F00'}}/></div>
      </div>)}
      {blockers.length===0&&<div style={{background:'#F7FBEA',borderRadius:14,padding:18,color:'#497B02',fontSize:14}}>Нет активных блокеров</div>}
      {ce&&<div style={{marginTop:12}}><EList items={plan?.extra_blockers||[]} canEdit={ce} onSave={v=>saveText('extra_blockers',v)} color="#A71F00"/></div>}
    </div>

{/* ═══ 7. УЛУЧШИЛОСЬ / УХУДШИЛОСЬ — monthly summary ═══ */}
    <Label>Результаты месяца</Label>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:24}} className="lh-analysis">
      <div style={{background:'#F7FBEA',borderRadius:14,padding:22}}><div style={{fontSize:16,fontWeight:600,color:'#234003',marginBottom:14}}>Улучшилось</div><EList items={plan?.improved||[]} canEdit={ce} onSave={v=>saveText('improved',v)} color="#234003"/></div>
      <div style={{background:'#FFEEEA',borderRadius:14,padding:22}}><div style={{fontSize:16,fontWeight:600,color:'#A71F00',marginBottom:14}}>Ухудшилось</div><EList items={plan?.worsened||[]} canEdit={ce} onSave={v=>saveText('worsened',v)} color="#A71F00"/></div>
    </div>

    {/* ═══ 9. FOCUS NEXT MONTH ═══ */}
    <Label>Фокус на следующий месяц</Label>
    <div style={{background:'#EDF5FF',borderRadius:14,padding:22,marginBottom:22}}><div style={{fontSize:16,fontWeight:600,color:'#144CA5',marginBottom:14}}>План и приоритеты</div><EList items={plan?.next_focus||[]} canEdit={ce} onSave={v=>saveText('next_focus',v)} color="#144CA5"/></div>

    {/* ═══ 10. ASKS ═══ */}
    <Label>Что нужно от руководства</Label>
    <div style={{background:'linear-gradient(180deg,#234003,#131B0B)',borderRadius:14,padding:22,color:'#fff',marginBottom:22}}><EList items={plan?.asks||[]} canEdit={ce} onSave={v=>saveText('asks',v)} color="#AAD34F"/></div>

    {/* IMAGES */}
    <Label>Изображения</Label>
    <ImageUpload bucket="report-images" folder={`monthly/${sel?.key}`} images={plan?.images||[]} onSave={v=>saveText('images',v)} canEdit={ce}/>
  </>
}

export default MonthlyReport
