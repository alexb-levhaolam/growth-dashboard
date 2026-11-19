import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { weekEnd, S, STATUS_CFG, PROJ_ST, Chip, pct, DChip, PlanChip, CpoCompare, Label, Linkify, Ed, EdNum, EList, cpoAdsOf, cpoTotalOf, ImageUpload } from '../lib/ui'
import Plan from './Plan'

// ═══ OVERVIEW ═══
function Overview({rep,reports,projects,comments,ce,up,tTasks,tProgress,print,refreshDaily,recalcAll,mPlans,reload}){
  if(!rep)return<div style={{padding:40,textAlign:'center',color:S.i3}}>Выберите отчёт</div>;const m=rep.metrics||{};const ch=rep.channels||[];const daily=rep.daily_data||[]
  const DEFAULT_HIDDEN=['Reddit','Pinterest','Rumble','TikTok']
  const visCh=rep.visible_channels||(ch.map(c=>c.name).filter(n=>!DEFAULT_HIDDEN.includes(n)))
  const[showPaste,setShowPaste]=useState(false);const[pasteText,setPasteText]=useState('');const[expandedComm,setExpandedComm]=useState({})
  // Get monthly plan for this week's month
  const weekMonth=rep.week_start?.slice(0,7);const mPlan=mPlans.find(p=>p.id===weekMonth)
  const mPlanCalc=(()=>{const cps=mPlan?.channel_plans||{};const ppS=(cps.meta?.planSales||0)+(cps.google?.planSales||0)+(cps.newChannels?.planSales||0);const cA=ppS>0?Math.round(((mPlan?.ads_budget||0)+(mPlan?.services_budget||0)+(mPlan?.awareness_budget||0))/ppS):null;const cT=(mPlan?.total_plan||0)>0?Math.round(((mPlan?.ads_budget||0)+(mPlan?.team_budget||0)+(mPlan?.services_budget||0)+(mPlan?.awareness_budget||0))/mPlan.total_plan):null;const cB=(mPlan?.ads_budget||0)+(mPlan?.team_budget||0)+(mPlan?.services_budget||0)+(mPlan?.awareness_budget||0);return{cpoAds:mPlan?.plan_cpo_ads!=null?mPlan.plan_cpo_ads:cA,cpoTotal:mPlan?.plan_cpo_total!=null?mPlan.plan_cpo_total:cT,budget:mPlan?.plan_budget!=null?mPlan.plan_budget:(cB||null)}})()
  const cp=mPlan?.channel_plans||{};const dim=weekMonth?new Date(parseInt(weekMonth.slice(0,4)),parseInt(weekMonth.slice(5,7)),0).getDate():30
  // Weekly plan: manual override > monthly auto-calc
  const weekPlanSales=m.planSales!=null?m.planSales:(mPlan?.total_plan?Math.round(mPlan.total_plan/dim*7):null)
  // Channel plan mapper: monthlyPlanKey → channel name
  const chPlanMap={'Meta':'meta','Google':'google','Taboola':'newChannels','TikTok':'newChannels','Reddit':'newChannels','Pinterest':'newChannels','Rumble':'newChannels'}
  const chGroupCount={'meta':1,'google':1,'newChannels':ch.filter(c=>['Taboola','TikTok','Reddit','Pinterest','Rumble'].includes(c.name)&&(c.sales||0)>0).length||1}
  const getChPlan=(name)=>{const pk=chPlanMap[name];if(!pk)return{};const mp=cp[pk];if(!mp)return{};const cnt=chGroupCount[pk]||1;return{planSales:Math.round((mp.planSales||0)/dim*7/cnt),planCpo:mp.planCpo||null}}
  const upM=(k,v)=>up({metrics:{...m,[k]:v==null?null:(v===''?null:Number(v))}})
  const upCh=(idx,f,v)=>{const nc=[...ch];nc[idx]={...nc[idx],[f]:f==='name'?v:(v===''?null:Number(v))};up({channels:nc})}
  const addCh=()=>{const name=prompt('Название канала:');if(!name||!name.trim())return;up({channels:[...ch,{name:name.trim(),sales:0,prevSales:null,cpo:null,prevCpo:null,planSales:null,planCpo:null}]})}
  const remCh=(idx)=>{if(!confirm(`Удалить "${ch[idx]?.name}"?`))return;const nc=[...ch];nc.splice(idx,1);up({channels:nc})}
  const upDay=(idx,f,v)=>{const nd=[...daily];nd[idx]={...nd[idx],[f]:f==='note'||f==='day'?v:(v===''||v==null?null:Number(v))};const u={daily_data:nd};if(f==='sales'){const sum=a=>a.reduce((s,d)=>s+(d?.sales||0),0);if(m.totalSales==null||m.totalSales===sum(daily))u.metrics={...m,totalSales:sum(nd)}}up(u)}
  // CPO formulas:
  // Бюджет Ads = SUM(BM) за период
  // CPO Total = Бюджет Ads / все продажи = BM / BJ
  // CPO Ads = (затраты платных каналов + скидки BL) / продажи платных каналов
  const totalSpentBM=m.totalSpentBM||0
  const calcCpoAds=cpoAdsOf(ch)
  const calcCpoTotal=cpoTotalOf(m)
  const cpoAds=m.cpoAdsOverride!=null?m.cpoAdsOverride:calcCpoAds
  const cpoTotal=m.cpoTotalOverride!=null?m.cpoTotalOverride:calcCpoTotal
  // Plan from monthly — manual override always wins
  const planCpoAds=m.planCpoAds!=null?m.planCpoAds:mPlanCalc.cpoAds
  const planCpoTotal=m.planCpoTotal!=null?m.planCpoTotal:mPlanCalc.cpoTotal
  const ws=rep.week_start
  const getTP=(taskId)=>{const all=tProgress.filter(p=>p.task_id===taskId&&p.week_start<=ws).sort((a,b)=>b.week_start.localeCompare(a.week_start));return all[0]||null}
  // Paste daily data handler
  const applyPaste=()=>{try{const lines=pasteText.trim().split('\n').filter(l=>l.trim());const nd=[...daily];lines.forEach((line,i)=>{if(i>=7)return;const parts=line.split('\t');const sales=Number(parts[1]);if(!isNaN(sales)){nd[i]={...nd[i],sales,note:parts[2]||nd[i]?.note||''};}});const total=nd.reduce((s,d)=>s+(d?.sales||0),0);up({daily_data:nd,metrics:{...m,totalSales:total}});setShowPaste(false);setPasteText('')}catch(e){alert('Ошибка: '+e.message)}}
  // Refresh totals from daily data
  const refreshTotals=()=>{const total=daily.reduce((s,d)=>s+(d?.sales||0),0);up({metrics:{...m,totalSales:total}})}

  const[analyzing,setAnalyzing]=useState(false)
  const[monthData,setMonthData]=useState(null);const[mTick,setMTick]=useState(0);const[recalcing,setRecalcing]=useState(false)
  useEffect(()=>{if(!rep?.week_start)return;const mo=rep.week_start.slice(0,7);const wsDate=new Date(rep.week_start+'T12:00:00');const weDate=new Date(wsDate);weDate.setDate(weDate.getDate()+6);const lastDay=weDate.getMonth()+1===parseInt(mo.slice(5,7))?weDate.getDate():new Date(parseInt(mo.slice(0,4)),parseInt(mo.slice(5,7)),0).getDate();fetch(`/api/monthly?month=${mo}&untilDay=${lastDay}`).then(r=>r.json()).then(d=>{if(!d.error)setMonthData(d)}).catch(()=>{})},[rep?.week_start,mTick])
  const Info=({text})=><span title={text} style={{fontSize:14,color:S.i3,cursor:'help',marginLeft:4,background:S.bg,borderRadius:'50%',width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:500}}>i</span>
  const runAnalysis=async()=>{setAnalyzing(true);try{const prevRep=reports.find(r=>r.week_start<rep.week_start&&r.week_start!==rep.week_start);const body={week:rep.week_label,metrics:m,channels:ch,daily,prevMetrics:prevRep?.metrics,prevChannels:prevRep?.channels};const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(d.error)throw new Error(d.error);const upd={};if(d.improved?.length)upd.improved=d.improved;if(d.worsened?.length)upd.worsened=d.worsened;if(d.insights)upd.metrics={...m,aiInsights:d.insights};if(Object.keys(upd).length)up(upd);alert('Анализ готов!')}catch(e){alert('Ошибка анализа: '+e.message)}finally{setAnalyzing(false)}}

  return<div id="overview-print"><>
    <div style={{display:'flex',gap:8,marginBottom:14,fontSize:14,color:S.i3,flexWrap:'wrap',alignItems:'center'}}>
      {Object.entries(STATUS_CFG).map(([k,v])=><span key={k} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:'50%',background:v.bg,border:`1px solid ${v.tx}`}}/>{v.emoji} {v.desc}</span>)}
      <span style={{marginLeft:'auto',display:'flex',gap:4}}>
        {ce&&<button onClick={()=>setShowPaste(true)} style={{display:'none'}}> Вставить вручную</button>}
        {ce&&recalcAll&&<button disabled={recalcing} onClick={async()=>{if(!confirm('Пересчитать весь месяц с нуля?\n\n• Подтянуть свежие данные из Daily для всех недель этого месяца\n• Сбросить ручные правки фактов в этих неделях: CPO Ads, CPO Total, Бюджет, CPO каналов\n• Сбросить ручные правки в «Итогах месяца»\n\nПланы не трогаются.'))return;setRecalcing(true);try{const n=await recalcAll();setMTick(t=>t+1);if(n)alert(n.days>0?`Пересчитано недель: ${n.weeks}, дней из Daily: ${n.days}`:'Ручные правки сброшены, но в Daily не нашлось данных за этот месяц')}finally{setRecalcing(false)}}} title="Подтянуть Daily для всех недель месяца, сбросить ручные правки фактов и пересчитать по формулам LH Daily" style={{fontSize:16,color:S.gd,background:'#fff',border:`1px solid ${S.gd}`,borderRadius:8,padding:'10px 18px',cursor:recalcing?'wait':'pointer',fontWeight:600,opacity:recalcing?.6:1}}>{recalcing?'Пересчитываю…':'Пересчитать всё ⟳'}</button>}
        {ce&&refreshDaily&&<button onClick={async()=>{await refreshDaily();setMTick(t=>t+1)}} title="Обновить данные на основе LH Daily" style={{fontSize:16,color:S.sf,background:S.gd,border:'none',borderRadius:8,padding:'10px 18px',cursor:'pointer',fontWeight:600}}>Обновить из Daily ⓘ</button>}
        {ce&&<button onClick={refreshTotals} style={{display:'none'}}>Обновить итоги</button>}
        <button onClick={print} style={{fontSize:16,color:S.i2,background:S.sf,borderRadius:8,boxShadow:S.sh,padding:'10px 18px',cursor:'pointer',fontWeight:600}}>Скачать в PDF</button>
      </span>
    </div>

    {showPaste&&<div style={{background:S.sf,border:`1px solid ${S.gl}`,borderRadius:14,padding:16,marginBottom:28}}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Вставь данные из Google Sheets</div>
      <div style={{fontSize:14,color:S.i3,marginBottom:12}}>Формат: каждая строка = день. Колонки через TAB: День | Продажи | Заметка</div>
      <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} rows={8} placeholder={"Пн 07.07\t45\tнорм\nВт 08.07\t52\tхороший день\n..."} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,outline:'none',fontFamily:'monospace'}}/>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button onClick={applyPaste} style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#497B02',color:'#fff',fontSize:16,fontWeight:600,cursor:'pointer'}}>Применить</button>
        <button onClick={()=>{setShowPaste(false);setPasteText('')}} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${S.ln}`,background:'transparent',fontSize:16,cursor:'pointer'}}>Отмена</button>
      </div>
    </div>}

    {monthData&&(()=>{const md=monthData;const calcSalesM=md.totalSales;const calcCpoAdsM=md.paidSales>0?Math.round(md.adSpend/md.paidSales):null;const calcCpoTotalM=md.totalSales>0?Math.round((md.totalSpentBM||0)/md.totalSales):null;const calcBudgetM=md.totalSpentBM||0;const cps=mPlan?.channel_plans||{};const ppSales=(cps.meta?.planSales||0)+(cps.google?.planSales||0)+(cps.newChannels?.planSales||0);const calcPCpoAds=ppSales>0?Math.round(((mPlan?.ads_budget||0)+(mPlan?.services_budget||0)+(mPlan?.awareness_budget||0))/ppSales):null;const calcPCpoTotal=(mPlan?.total_plan||0)>0?Math.round(((mPlan?.ads_budget||0)+(mPlan?.team_budget||0)+(mPlan?.services_budget||0)+(mPlan?.awareness_budget||0))/mPlan.total_plan):null;const calcPBudget=(mPlan?.ads_budget||0)+(mPlan?.team_budget||0)+(mPlan?.services_budget||0)+(mPlan?.awareness_budget||0)
    const mo=rep.week_start?.slice(0,7);const upMo=async(f,v)=>{if(!mo)return;await supabase.from('monthly_plans').update({[f]:v,updated_at:new Date().toISOString()}).eq('id',mo);reload()}
    const mS=mPlan?.actual_sales!=null?mPlan.actual_sales:calcSalesM;const mCA=mPlan?.actual_cpo_ads!=null?mPlan.actual_cpo_ads:calcCpoAdsM;const mCT=mPlan?.actual_cpo_total!=null?mPlan.actual_cpo_total:calcCpoTotalM;const mB=mPlan?.actual_budget!=null?mPlan.actual_budget:calcBudgetM
    const pS=mPlan?.total_plan;const pCA=mPlan?.plan_cpo_ads!=null?mPlan.plan_cpo_ads:calcPCpoAds;const pCT=mPlan?.plan_cpo_total!=null?mPlan.plan_cpo_total:calcPCpoTotal;const pB=mPlan?.plan_budget!=null?mPlan.plan_budget:calcPBudget
    const pd=(f,p)=>p&&f?Math.round((f-p)/p*100):null
    return<div className='lh-itogi' style={{background:'linear-gradient(180deg,#0F6E5E,#0B5548)',borderRadius:14,padding:'14px 20px',marginBottom:16,color:S.gp,overflow:'hidden'}}>
      <div style={{fontSize:14,fontWeight:600,letterSpacing:'.05em',textTransform:'uppercase',color:S.gs,marginBottom:12}}> Итоги месяца · {md.daysWithData} дней</div>
      {md.gaps&&Object.keys(md.gaps).length>0&&<div style={{background:'rgba(241,139,14,.18)',border:'1px solid rgba(241,139,14,.55)',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:14,color:'#FFE3B8'}}>⚠ В Daily нет трат при наличии продаж: {Object.entries(md.gaps).map(([n,ds])=>{const s=[...ds].sort((a,b)=>a.localeCompare(b));return`${n} — ${s.length>1?s[0]+'–'+s[s.length-1]:s[0]} (${s.length} дн.)`}).join('; ')}. CPO Ads занижен, пока траты не заполнены.</div>}
      <div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <div><div style={{fontSize:14,color:S.gs}}>Продажи<Info text={md.channels?md.channels.filter(c=>c.sales>0).map(c=>`${c.name}: ${c.sales}`).join('\n'):'Продажи за месяц (BJ)'}/></div><div style={{fontSize:24,fontWeight:600}}><EdNum value={mS} canEdit={ce} onSave={v=>upMo('actual_sales',v===calcSalesM?null:v)} style={{fontSize:24,fontWeight:600,color:S.gp}}/></div><div style={{fontSize:14,color:S.gs}}>план <EdNum value={pS} canEdit={ce} onSave={v=>upMo('total_plan',v)} style={{fontSize:14,color:S.gs}}/>{pS&&<span> · {Math.round((mS||0)/pS*100)}%</span>}</div></div>
        <div><div style={{fontSize:14,color:S.gs}}>CPO Ads<Info text="Как «All Paid» в LH Daily: траты Meta Direct Sales + Google (Demand Gen, Brand, Bing Brand, Search) + новые каналы / их продажи. Israel 365 и скидки не входят"/></div><div style={{fontSize:24,fontWeight:600}}>$<EdNum value={mCA} canEdit={ce} onSave={v=>upMo('actual_cpo_ads',v===calcCpoAdsM?null:v)} style={{fontSize:24,fontWeight:600,color:S.gp}}/></div><div style={{fontSize:14,color:S.gs}}>план $<EdNum value={pCA} canEdit={ce} onSave={v=>upMo('plan_cpo_ads',v===calcPCpoAds?null:v)} style={{fontSize:14,color:S.gs}}/>{pd(mCA,pCA)!=null&&<span style={{color:pd(mCA,pCA)<=0?'#9FE1CB':'#FFC1C1'}}> {pd(mCA,pCA)>0?'+':''}{pd(mCA,pCA)}%</span>}</div></div>
        <div><div style={{fontSize:14,color:S.gs}}>CPO Total<Info text="Total_Spent (BM) / все продажи (BJ), как Current CPO в LH Daily"/></div><div style={{fontSize:24,fontWeight:600}}>$<EdNum value={mCT} canEdit={ce} onSave={v=>upMo('actual_cpo_total',v===calcCpoTotalM?null:v)} style={{fontSize:24,fontWeight:600,color:S.gp}}/></div><div style={{fontSize:14,color:S.gs}}>план $<EdNum value={pCT} canEdit={ce} onSave={v=>upMo('plan_cpo_total',v===calcPCpoTotal?null:v)} style={{fontSize:14,color:S.gs}}/>{pd(mCT,pCT)!=null&&<span style={{color:pd(mCT,pCT)<=0?'#9FE1CB':'#FFC1C1'}}> {pd(mCT,pCT)>0?'+':''}{pd(mCT,pCT)}%</span>}</div></div>
        <div><div style={{fontSize:14,color:S.gs}}>Бюджет<Info text="Total_Spent (BM) за прошедшие дни, как Fact в LH Daily"/></div><div style={{fontSize:24,fontWeight:600}}>$<EdNum value={mB} canEdit={ce} onSave={v=>upMo('actual_budget',v===calcBudgetM?null:v)} style={{fontSize:24,fontWeight:600,color:S.gp}}/></div><div style={{fontSize:14,color:S.gs}}>план $<EdNum value={pB} canEdit={ce} onSave={v=>upMo('plan_budget',v===calcPBudget?null:v)} style={{fontSize:14,color:S.gs}}/>{pB>0&&<span> · {Math.round((mB||0)/pB*100)}%</span>}</div></div>
      </div>
    </div>})()}

    <Label>Ключевые метрики</Label>
    <div className='lh-grid4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
      {[
        {l:'Продажи',k:'totalSales',info:ch.filter(c=>(c.sales||0)>0).map(c=>`${c.name}: ${c.sales}`).join('\n')||'Продажи за неделю (BJ)'},
        {l:'CPO Ads',k2:'cpoAdsOverride',v2:cpoAds,calc:calcCpoAds,pre:'$',info:'Как «All Paid» в LH Daily: траты (Meta Direct Sales + Google: Demand Gen, Brand, Bing Brand, Search + новые каналы) / их продажи. Israel 365 и скидки не входят'},
        {l:'CPO Total',k2:'cpoTotalOverride',v2:cpoTotal,calc:calcCpoTotal,pre:'$',info:'Total_Spent (BM) / все продажи (BJ), как Current CPO в LH Daily'},
        {l:'Бюджет',k2:'budgetSpent',v2:m.budgetSpent!=null?m.budgetSpent:totalSpentBM,calc:totalSpentBM,pre:'$',info:'Total_Spent (BM) за неделю: реклама, скидки, сервисы, команда, Awareness — как Fact в LH Daily'},
      ].map((x,i)=><div key={i} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'18px 16px'}}>
        <div style={{fontSize:14,color:S.i3,display:'flex',alignItems:'center'}}>{x.l}<Info text={x.info}/></div>
        <div className='lh-num' style={{fontSize:28,fontWeight:600,margin:'4px 0'}}>
          {x.k?<>{x.pre||''}<EdNum value={m[x.k]} canEdit={ce} onSave={v=>upM(x.k,v)} style={{fontSize:28,fontWeight:600}}/></>
          :x.k2?<>{x.pre||''}<EdNum value={x.v2} canEdit={ce} onSave={v=>{if(v==null)upM(x.k2,null);else upM(x.k2,v)}} style={{fontSize:28,fontWeight:600}}/></>
          :x.v}
        </div>
        <div style={{fontSize:14,color:S.i2,display:'flex',alignItems:'center',gap:4}}>
          {i===0&&<><span>план <EdNum value={weekPlanSales||m.planSales} canEdit={ce} onSave={v=>upM('planSales',v)} style={{fontSize:14,color:S.i2}}/></span></>}
          {i===1&&<><span>план $<EdNum value={m.planCpoAds!=null?m.planCpoAds:planCpoAds} canEdit={ce} onSave={v=>upM('planCpoAds',v)} style={{fontSize:14,color:S.i2}}/></span></>}
          {i===2&&<><span>план $<EdNum value={m.planCpoTotal!=null?m.planCpoTotal:planCpoTotal} canEdit={ce} onSave={v=>upM('planCpoTotal',v)} style={{fontSize:14,color:S.i2}}/></span></>}
          {i===3&&<>план $<EdNum value={m.budgetPlan!=null?m.budgetPlan:(mPlanCalc.budget?Math.round(mPlanCalc.budget/dim*7):null)} canEdit={ce} onSave={v=>upM('budgetPlan',v)} style={{fontSize:14,color:S.i2}}/></>}
        </div>
      </div>)}
    </div>

    <Label>Брэкдаун по дням</Label>
    <div className='lh-grid7' style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8,marginBottom:16}}>
      {(daily.length>0?daily:Array(7).fill(null)).map((d,i)=>{const chTip=d?.ch?Object.entries(d.ch).filter(([,v])=>v>0).map(([k,v])=>`${k}: ${v}`).join('\n'):'';return<div key={i} title={chTip} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'12px 8px',textAlign:'center',cursor:chTip?'help':'default'}}>
        <Ed value={d?.day||''} canEdit={ce} onSave={v=>upDay(i,'day',v)} style={{fontSize:14,color:S.i3}}/>
        <div style={{margin:'4px 0'}}><EdNum value={d?.sales} canEdit={ce} onSave={v=>upDay(i,'sales',v)} style={{fontSize:18,fontWeight:500}}/></div>
        <Ed value={d?.note||(d?.sales==null?'—':'продаж')} canEdit={ce} onSave={v=>upDay(i,'note',v)} style={{fontSize:14,color:d?.sales==null?'#B76400':S.i2}}/>
      </div>})}
    </div>

    <Label>Каналы</Label>
    <div className='lh-ch-wrap' style={{background:S.sf,borderRadius:14,boxShadow:S.sh,marginBottom:40}}>
      <div className='lh-ch-row' style={{display:'grid',gridTemplateColumns:'100px 1fr 60px 55px 50px 55px 60px 70px 55px',gap:4,padding:'16px 20px',background:S.bg,fontSize:13,fontWeight:600,color:S.i3,textTransform:'uppercase',letterSpacing:'.08em'}}>
        <span>Канал</span><span>прогресс</span><span style={{textAlign:'right'}}>Sales</span><span style={{textAlign:'right'}}>План</span><span style={{textAlign:'right'}}>%</span><span style={{textAlign:'right'}}>Δ</span><span style={{textAlign:'right'}}>CPO</span><span style={{textAlign:'right'}}>CPO план</span><span style={{textAlign:'right'}}>Δ CPO</span>
      </div>
      {ch.filter(c=>!visCh||visCh.includes(c.name)).map((c,i)=>{const ci=ch.indexOf(c);const mp=getChPlan(c.name);const ps=c.planSales!=null?c.planSales:(mp.planSales||0);const barPct=ps?(Math.min((c.sales||0)/ps*100,100)):((c.sales||0)>0?100:0);const barColor=ps?((c.sales||0)>=ps?'#497B02':(c.sales||0)>=ps*0.7?'#F18B0E':'#DD2A02'):((c.sales||0)>0?S.gl:'#E4E6E9');const chCpoCalc=(c.spent&&c.sales)?Math.round(c.spent/c.sales):c.cpo;const chCpo=c.cpoOverride!=null?c.cpoOverride:chCpoCalc
        return<div key={i} className='lh-ch-row' style={{display:'grid',gridTemplateColumns:'100px 1fr 60px 55px 50px 55px 60px 70px 55px',gap:4,padding:'18px 20px',borderBottom:`1px solid ${S.ln}`,alignItems:'center',fontSize:16}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {ce&&<button onClick={()=>remCh(ci)} style={{background:'none',border:'none',color:S.ln,cursor:'pointer',fontSize:14,padding:0,lineHeight:1}}>✕</button>}
          <Ed value={c.name} canEdit={ce} onSave={v=>upCh(ci,'name',v)} style={{fontWeight:500,fontSize:16}}/>
        </div>
        <div style={{height:8,background:S.bg,borderRadius:999,overflow:'hidden'}}><div style={{height:8,borderRadius:999,width:`${barPct}%`,background:barColor}}/></div>
        <span style={{textAlign:'right'}}><EdNum value={c.sales} canEdit={ce} onSave={v=>upCh(ci,'sales',v)} style={{fontWeight:600,fontSize:16}}/></span>
        <span style={{textAlign:'right'}}><EdNum value={c.planSales!=null?c.planSales:mp.planSales} canEdit={ce} onSave={v=>upCh(ci,'planSales',v)} style={{fontSize:14,color:S.i3}}/></span>
        <span style={{textAlign:'right'}}><PlanChip fact={c.sales} plan={c.planSales!=null?c.planSales:mp.planSales}/></span>
        <span style={{textAlign:'right'}}><DChip d={pct(c.sales,c.prevSales)}/></span>
        <span style={{textAlign:'right'}}><EdNum value={chCpo} canEdit={ce} prefix="$" onSave={v=>upCh(ci,'cpoOverride',v==null||v===chCpoCalc?'':v)} style={{fontSize:16,color:S.i2}}/></span>
        <span style={{textAlign:'right'}}><EdNum value={c.planCpo!=null?c.planCpo:mp.planCpo} canEdit={ce} prefix="$" onSave={v=>upCh(ci,'planCpo',v)} style={{fontSize:14,color:S.i3}}/></span>
        <span style={{textAlign:'right'}}><CpoCompare fact={chCpo} plan={c.planCpo!=null?c.planCpo:mp.planCpo}/></span>
        
      </div>})}
      {ce&&<div style={{padding:'12px 16px'}}><button onClick={addCh} style={{fontSize:16,color:S.gd,background:'none',border:`1px dashed ${S.ln}`,borderRadius:8,padding:'10px 18px',cursor:'pointer',width:'100%',fontWeight:600}}>+ Добавить канал</button></div>}
    </div>

    <Label>Тактические задачи <span style={{fontWeight:400,color:S.i3}}>· до 01.01.2027</span></Label>
    <div className='lh-tasks lh-grid3' style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24,marginBottom:40}}>
      {tTasks.filter(t=>!t.hidden).map(t=>{const tp=getTP(t.id);const ms=t.milestones||[];let pctVal=0,label='';if(t.target_type==='numeric'){pctVal=t.target_value?(Math.round(((tp?.current_value||0)/t.target_value)*100)):0;label=`${tp?.current_value||0} / ${t.target_value}`}else{const cur=tp?.milestone_status||0;pctVal=ms.length?Math.round(cur/ms.length*100):0;label=cur>0&&cur<=ms.length?ms[cur-1]?.name:'Не начато'}
        return<div key={t.id} style={{background:S.sf,border:`1px solid ${S.ln}`,borderRadius:10,padding:'10px 14px'}}>
          <div style={{fontSize:16,fontWeight:500,marginBottom:4}}>{t.name}</div>
          <div style={{height:8,background:S.bg,borderRadius:20,overflow:'hidden',marginBottom:4}}><div style={{height:8,borderRadius:20,background:pctVal>=80?'#497B02':pctVal>=50?'#F18B0E':'#DD2A02',width:`${Math.min(pctVal,100)}%`}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:S.i2}}><span>{label}</span><span style={{fontWeight:600}}>{pctVal}%</span></div>
          {tp?.comments?.length>0&&<div style={{fontSize:14,color:S.i3,marginTop:4,fontStyle:'italic'}}> {tp.comments[tp.comments.length-1]?.text?.slice(0,60)}</div>}
          {!tp?.comments?.length&&tp?.comment&&<div style={{fontSize:14,color:S.i3,marginTop:4,fontStyle:'italic'}}> {tp.comment}</div>}
        </div>})}
    </div>

        {(()=>{const visIds=rep.visible_overview_projects||[];const visibleProjects=projects.filter(p=>p.status!=='done'&&visIds.includes(p.id))
    return visibleProjects.length>0&&<>
    <Label>Приоритетные проекты</Label>
    <div className='lh-tasks lh-grid3' style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:32}}>
      {visibleProjects.map(p=>{const ps=PROJ_ST[p.status]||PROJ_ST.wait;const lc=comments.find(c=>c.project_id===p.id&&c.week_start===rep.week_start);const txt=lc?(lc.full_text||lc.summary||''):'';const isLong=txt.length>150;const isFull=expandedComm[p.id]
        return<div key={p.id} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'16px 18px',borderLeft:p.status==='risk'||p.status==='blocked'?'3px solid #DD2A02':'none',borderRadius:p.status==='risk'||p.status==='blocked'?'0 14px 14px 0':14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:6}}><span style={{fontSize:16,fontWeight:600,lineHeight:1.35}}>{p.name}</span><span style={{flexShrink:0}}><Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip></span></div>
          {p.last_update&&<div style={{fontSize:14,color:S.i2,marginBottom:8,lineHeight:1.4}}>{p.last_update.slice(0,100)}{p.last_update.length>100?'…':''}</div>}
          {lc&&<div style={{borderTop:`1px solid ${S.ln}`,paddingTop:8,marginTop:4}}>
            <div style={{fontSize:12,color:S.i3,marginBottom:4}}>{lc.author} · {weekEnd(lc.week_start)}</div>
            <div style={{fontSize:14,color:S.i2,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{isFull||!isLong?<Linkify>{txt}</Linkify>:<><Linkify>{txt.slice(0,150).replace(/\*([^*]*)$/,'$1')}</Linkify>… <button onClick={()=>setExpandedComm(prev=>({...prev,[p.id]:true}))} style={{fontSize:12,color:'#1761CB',background:'none',border:'none',cursor:'pointer',fontWeight:500}}>ещё</button></>}</div>
          </div>}
        </div>})}
    </div>
    </>})()}

    <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap'}}>
      <div style={{flex:1,background:'var(--g-25,#F7FBEA)',borderRadius:14,padding:'22px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:14,color:'#497B02',fontWeight:500}}> Улучшилось</div>
          {false&&ce&&<button onClick={runAnalysis} disabled={analyzing} style={{display:'none'}}>{analyzing?'Анализ...':'Запустить анализ'}</button>}
        </div>
        <EList items={rep.improved} canEdit={ce} onSave={v=>up({improved:v})} color="#27500A"/>
      </div>
      <div style={{flex:1,background:'var(--r-25,#FFEEEA)',borderRadius:14,padding:'22px 16px'}}>
        <div style={{fontSize:14,color:'#A71F00',fontWeight:500,marginBottom:6}}> Ухудшилось</div>
        <EList items={rep.worsened} canEdit={ce} onSave={v=>up({worsened:v})} color="#791F1F"/>
      </div>
    </div>
    {m.aiInsights&&<div style={{background:'var(--b-25,#EDF5FF)',borderRadius:14,padding:'22px 16px',marginBottom:12}}><div style={{fontSize:14,color:'#144CA5',fontWeight:500,marginBottom:4}}> Инсайты</div><Linkify style={{fontSize:16,color:'#4A3372',lineHeight:1.6}}>{m.aiInsights}</Linkify></div>}
    <div className='lh-analysis' style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
      <div style={{flex:1,background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'22px 16px'}}><div style={{fontSize:16,fontWeight:600,color:'#3B6D11',marginBottom:6}}> Инсайты и наблюдения</div><EList items={rep.manual_improved} canEdit={ce} onSave={v=>up({manual_improved:v})} color="#27500A"/></div>
      <div style={{flex:1,background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'22px 16px'}}><div style={{fontSize:16,fontWeight:600,color:'#A71F00',marginBottom:6}}> Инсайты и наблюдения</div><EList items={rep.manual_worsened} canEdit={ce} onSave={v=>up({manual_worsened:v})} color="#791F1F"/></div>
    </div>
    <div style={{background:'#D6E8FA',borderRadius:14,padding:'22px 16px',marginBottom:12}}><div style={{fontSize:16,fontWeight:600,color:'#0C447C',marginBottom:6}}>Фокус на следующую неделю</div><EList items={rep.focus} canEdit={ce} onSave={v=>up({focus:v})} color="#0C447C"/></div>
    <div style={{background:'linear-gradient(180deg,#234003,#131B0B)',borderRadius:14,padding:'22px 16px',marginBottom:22}}><div style={{fontSize:16,fontWeight:600,color:'#FAFAFA',marginBottom:6}}>Нужно от руководства</div><div style={{color:'#FAFAFA'}}><EList items={rep.asks} canEdit={ce} onSave={v=>up({asks:v})}/></div></div>

    {/* IMAGES */}
    <Label>Изображения</Label>
    <ImageUpload bucket="report-images" folder={`weekly/${rep.week_start}`} images={rep.images||[]} onSave={v=>up({images:v})} canEdit={ce}/>
  </></div>
}

export default Overview
