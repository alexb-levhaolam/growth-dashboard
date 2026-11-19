import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { S, CC, EdNum, chipStyle } from '../lib/ui'

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
    {plans.map(p=><button key={p.id} onClick={()=>setSel(p.id)} style={chipStyle(sel===p.id)}>{p.month_label}</button>)}
  </div>

  <CC title={<span>{plan.month_label||sel} · <EdNum value={plan.days_in_month||daysInMonth} canEdit={ce} onSave={v=>upP('days_in_month',v)} style={{fontSize:16,fontWeight:600}}/> дней</span>}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
      {[{l:'Бюджет команда',k:'team_budget',pre:'$'},{l:'ADS бюджет',k:'ads_budget',pre:'$'},{l:'Бюджет сервисы',k:'services_budget',pre:'$'},{l:'Бюджет Awareness',k:'awareness_budget',pre:'$'},{l:'План продаж',k:'total_plan'}].map(x=>
        <div key={x.k} style={{background:S.bg,borderRadius:10,padding:'22px 16px'}}>
          <div style={{fontSize:14,color:S.i3}}>{x.l}</div>
          <div style={{fontSize:20,fontWeight:500,margin:'4px 0'}}>{x.pre||''}<EdNum value={plan[x.k]} canEdit={ce} onSave={v=>upP(x.k,v)} style={{fontSize:20,fontWeight:500}}/></div>
        </div>)}
    </div>
  </CC>

  <CC title="План по каналам" right={<span style={{fontSize:14,color:S.i3}}>Всего план: {totalPlanSales} · {daysInMonth} дн.</span>}>
    <div style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr 1fr',gap:4,padding:'8px 0',borderBottom:`1px solid ${S.ln}`,fontSize:14,color:S.i3,fontWeight:500}}>
      <span>Канал</span><span style={{textAlign:'right'}}>План продаж</span><span style={{textAlign:'right'}}>В день</span><span style={{textAlign:'right'}}>Плановый CPO</span>
    </div>
    {chDefs.map(c=>{const v=cp[c.k]||{};return<div key={c.k} style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr 1fr',gap:4,padding:'10px 0',borderBottom:`1px solid ${S.ln}`,alignItems:'center'}}>
      <div><div style={{fontWeight:500,fontSize:16}}>{c.l}</div><div style={{fontSize:14,color:S.i3}}>{c.desc}</div></div>
      <span style={{textAlign:'right'}}><EdNum value={v.planSales} canEdit={ce} onSave={val=>upCp(c.k,'planSales',val)} style={{fontSize:14,fontWeight:500}}/></span>
      <span style={{textAlign:'right'}}><EdNum value={v.salesPerDay} canEdit={ce} onSave={val=>upCp(c.k,'salesPerDay',val)} style={{fontSize:16,color:S.i2}}/><span style={{fontSize:14,color:S.i3}}> /день</span></span>
      <span style={{textAlign:'right'}}>$<EdNum value={v.planCpo} canEdit={ce} onSave={val=>upCp(c.k,'planCpo',val)} style={{fontSize:14,fontWeight:500}}/></span>
    </div>})}
  </CC>
  </>
}

export default Plan
