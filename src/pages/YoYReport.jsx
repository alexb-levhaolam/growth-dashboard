import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Tooltip } from 'recharts'
import { S, pct, Ed, EdNum, LHLine, chipStyle } from '../lib/ui'

// ═══ YOY REPORT ═══
function YoYReport(){
  const[data,setData]=useState([]);const[mode,setMode]=useState('compare')
  const[loading,setLoading]=useState(true);const[expanded,setExpanded]=useState({})
    const ML=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
  const MF=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

  useEffect(()=>{(async()=>{setLoading(true);const{data:d}=await supabase.from('yearly_metrics').select('*').order('id');if(d)setData(d);setLoading(false)})()},[])

  const saveCell=async(id,field,val)=>{const[y,mo]=id.split('-').map(Number);const exists=data.find(d=>d.id===id);if(!exists){const{error}=await supabase.from('yearly_metrics').insert({id,year:y,month:mo,[field]:val});if(!error)setData(prev=>[...prev,{id,year:y,month:mo,[field]:val}])}else{await supabase.from('yearly_metrics').update({[field]:val,updated_at:new Date().toISOString()}).eq('id',id);setData(prev=>prev.map(r=>r.id===id?{...r,[field]:val}:r))}}

  const d25=data.filter(d=>d.year===2025);const d26=data.filter(d=>d.year===2026)
  const get=(yr,m,f)=>{const r=data.find(x=>x.year===yr&&x.month===m);return r?r[f]:null}
  const getId=(yr,m)=>`${yr}-${String(m).padStart(2,'0')}`
  const pct=(a,b)=>b&&a?Math.round((a-b)/b*100):null
  const fmt=v=>v!=null?v.toLocaleString():'—'

  // Interactive line chart with hover
  const Chart=({field,prefix,yr1,yr2,color1,color2,height})=>{
    const v1=Array.from({length:12},(_,i)=>get(yr1,i+1,field));const v2=yr2?Array.from({length:12},(_,i)=>get(yr2,i+1,field)):null
    const all=[...v1,...(v2||[])].filter(v=>v!=null);if(all.length<2)return<div style={{color:S.i3,fontSize:13,padding:12}}>Нет данных</div>
    const ann=(i)=>[yr1,yr2].filter(Boolean).map(y=>{const a=data.find(d2=>d2.year===y&&d2.month===i+1)?.annotation;return a?y+': '+a:''}).filter(Boolean).join(' · ')
    const series=yr2?[{name:String(yr1),color:'#9AA0A6',values:v1},{name:String(yr2),color:color1||'#6E9B0E',values:v2}]:[{name:String(yr1),color:color1||'#6E9B0E',values:v1}]
    return<LHLine labels={ML} series={series} prefix={prefix||''} height={(height||160)+60} notes={ann}/>}

  // Editable table row
  const Row=({label,field,yr,prefix,isMoney,isAvg,hideYtd,color})=>{const vals=data.filter(d=>d.year===yr&&d[field]!=null);const ytd=isAvg?(vals.length?Math.round(vals.reduce((s,d)=>s+(d[field]||0),0)/vals.length):null):vals.reduce((s,d)=>s+(d[field]||0),0);const isOpen=expanded['row_'+field];return<>
    <tr style={{borderBottom:`1px solid ${S.ln}`,background:isOpen?'#F7F8F9':'transparent'}}>
    <td style={{padding:'8px 10px',fontWeight:600,cursor:'pointer'}} onClick={()=>setExpanded(prev=>({...prev,['row_'+field]:!prev['row_'+field]}))}><span style={{marginRight:6,color:S.i3}}>{isOpen?'▾':'▸'}</span>{label}</td>
    {Array.from({length:12},(_,i)=>{const id=getId(yr,i+1);const v=get(yr,i+1,field);return<td key={i} style={{textAlign:'right',padding:'7px 6px'}}><EdNum value={v} canEdit={true} prefix={isMoney?'$':''} onSave={v2=>saveCell(id,field,v2)} style={{fontSize:13,textAlign:'right'}}/></td>})}
    {!hideYtd&&<td style={{textAlign:'right',padding:'8px 10px',fontWeight:600}}>{prefix||''}{ytd!=null?ytd.toLocaleString():'—'}</td>}
    {hideYtd&&<td></td>}
  </tr>
  {isOpen&&<tr><td colSpan={15} style={{padding:'8px 16px'}}><Chart field={field} yr1={yr} color1={color||'#6E9B0E'}/></td></tr>}
  </>}

  // Compare row
  const CmpRow=({label,field,prefix,isMoney,invertGood,isAvg,hideYtd,color1,color2})=>{
    const v25=d25.filter(d=>d[field]!=null);const v26=d26.filter(d=>d[field]!=null)
    const ytd1=isAvg?(v25.length?Math.round(v25.reduce((s,d)=>s+(d[field]||0),0)/v25.length):0):d25.reduce((s,d)=>s+(d[field]||0),0)
    const ytd2=isAvg?(v26.length?Math.round(v26.reduce((s,d)=>s+(d[field]||0),0)/v26.length):0):d26.reduce((s,d)=>s+(d[field]||0),0)
    const isOpen=expanded['cmp_'+field]
    return<><tr style={{borderBottom:`1px solid #E4E6E9`}}>
      <td style={{padding:'6px 10px',fontWeight:600,cursor:'pointer'}} rowSpan={3} onClick={()=>setExpanded(prev=>({...prev,['cmp_'+field]:!prev['cmp_'+field]}))}><span style={{marginRight:6,color:S.i3}}>{isOpen?'▾':'▸'}</span>{label}</td>
      <td style={{padding:'7px 10px',fontSize:12,color:'#6E9B0E',fontWeight:500}}>2025</td>
      {Array.from({length:12},(_,i)=><td key={i} style={{textAlign:'right',padding:'7px 6px',fontSize:13}}><EdNum value={get(2025,i+1,field)} canEdit={true} onSave={v=>saveCell(getId(2025,i+1),field,v)} style={{fontSize:13,textAlign:'right'}}/></td>)}
      {!hideYtd&&<td style={{textAlign:'right',padding:'7px 10px',fontWeight:500,fontSize:13}}>{prefix||''}{fmt(ytd1)}</td>}{hideYtd&&<td></td>}
    </tr>
    <tr style={{borderBottom:`1px solid #E4E6E9`}}>
      <td style={{padding:'7px 10px',fontSize:12,color:'#1761CB',fontWeight:500}}>2026</td>
      {Array.from({length:12},(_,i)=><td key={i} style={{textAlign:'right',padding:'7px 6px',fontSize:13}}><EdNum value={get(2026,i+1,field)} canEdit={true} onSave={v=>saveCell(getId(2026,i+1),field,v)} style={{fontSize:13,textAlign:'right'}}/></td>)}
      {!hideYtd&&<td style={{textAlign:'right',padding:'7px 10px',fontWeight:500,fontSize:13}}>{prefix||''}{fmt(ytd2)}</td>}{hideYtd&&<td></td>}
    </tr>
    <tr style={{borderBottom:`1px solid ${S.ln}`}}>
      <td style={{padding:'7px 10px',fontSize:12,color:S.i3,fontWeight:500}}>Δ%</td>
      {Array.from({length:12},(_,i)=>{const d=pct(get(2026,i+1,field),get(2025,i+1,field));const good=invertGood?(d&&d<0):(d&&d>0);return<td key={i} style={{textAlign:'right',padding:'7px 6px',fontSize:12,fontWeight:500,color:d!=null?(good?'#497B02':'#A71F00'):'#C4C8CD'}}>{d!=null?(d>=0?'+':'')+d+'%':'—'}</td>})}
      <td style={{textAlign:'right',padding:'7px 10px',fontSize:12,fontWeight:500,color:pct(ytd2,ytd1)!=null?(((invertGood?pct(ytd2,ytd1)<0:pct(ytd2,ytd1)>0))?'#497B02':'#A71F00'):'#C4C8CD'}}>{pct(ytd2,ytd1)!=null?(pct(ytd2,ytd1)>=0?'+':'')+pct(ytd2,ytd1)+'%':'—'}</td>
    </tr>{isOpen&&<tr><td colSpan={15} style={{padding:'8px 16px'}}><Chart field={field} yr1={2025} yr2={2026} color1={color1||'#6E9B0E'} color2={color2||'#1761CB'}/></td></tr>}</>}

  // Expandable channel row
  const ChRow=({label,field,yr1,yr2,color1,color2,hideYtd})=>{const isOpen=expanded[field];return<>
    <tr style={{borderBottom:`1px solid ${S.ln}`,background:isOpen?'#F7F8F9':'transparent'}}>
      <td style={{padding:'8px 10px',fontWeight:600,cursor:'pointer'}} onClick={()=>setExpanded(prev=>({...prev,[field]:!prev[field]}))}><span style={{marginRight:6,color:S.i3}}>{isOpen?'▾':'▸'}</span>{label}</td>
      {yr2?<><td style={{padding:'7px 10px',fontSize:12,color:'#6E9B0E'}}>2025</td>{Array.from({length:12},(_,i)=><td key={i} style={{textAlign:'right',padding:'7px 6px',fontSize:13}}><EdNum value={get(yr1,i+1,field)} canEdit={true} onSave={v=>saveCell(getId(yr1,i+1),field,v)} style={{fontSize:13,textAlign:'right'}}/></td>)}{!hideYtd?<td style={{textAlign:'right',padding:'7px 10px',fontWeight:500,fontSize:13}}>{fmt(data.filter(d=>d.year===yr1).reduce((s,d)=>s+(d[field]||0),0))}</td>:<td></td>}</>
      :<>{Array.from({length:12},(_,i)=><td key={i} style={{textAlign:'right',padding:'7px 6px',fontSize:13}}><EdNum value={get(yr1,i+1,field)} canEdit={true} onSave={v=>saveCell(getId(yr1,i+1),field,v)} style={{fontSize:13,textAlign:'right'}}/></td>)}{!hideYtd?<td style={{textAlign:'right',padding:'7px 10px',fontWeight:600}}>{fmt(data.filter(d=>d.year===yr1).reduce((s,d)=>s+(d[field]||0),0))}</td>:<td></td>}</>}
    </tr>
    {yr2&&isOpen&&<tr style={{borderBottom:`1px solid #E4E6E9`}}><td></td><td style={{padding:'7px 10px',fontSize:12,color:'#1761CB'}}>2026</td>{Array.from({length:12},(_,i)=><td key={i} style={{textAlign:'right',padding:'7px 6px',fontSize:13}}><EdNum value={get(yr2,i+1,field)} canEdit={true} onSave={v=>saveCell(getId(yr2,i+1),field,v)} style={{fontSize:13,textAlign:'right'}}/></td>)}{!hideYtd?<td style={{textAlign:'right',padding:'7px 10px',fontWeight:500,fontSize:13}}>{fmt(data.filter(d=>d.year===yr2).reduce((s,d)=>s+(d[field]||0),0))}</td>:<td></td>}</tr>}
    {isOpen&&<tr><td colSpan={15} style={{padding:'8px 16px'}}><Chart field={field} yr1={yr1} yr2={yr2} color1={color1||'#6E9B0E'} color2={color2||'#1761CB'}/></td></tr>}
  </>}

  const TH=()=><tr style={{borderBottom:`1px solid ${S.ln}`}}><th style={{textAlign:'left',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:S.i3,padding:'8px 10px'}}>Метрика</th>{mode==='compare'&&<th style={{fontSize:12,color:S.i3,padding:'8px 4px'}}>Год</th>}{ML.map(m=><th key={m} style={{textAlign:'right',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:S.i3,padding:'8px 4px'}}>{m}</th>)}<th style={{textAlign:'right',fontSize:12,fontWeight:500,color:S.i3,padding:'8px 10px'}}>YTD</th></tr>

  if(loading)return<div style={{padding:40,textAlign:'center',color:S.i3}}>Загрузка...</div>

  const yr=mode==='2025'?2025:2026

  return<>
    <h1 style={{fontSize:24,fontWeight:600,marginBottom:16}}>Годовой отчёт</h1>
    {/* Tooltip */}
    

    {/* Mode selector */}
    <div style={{display:'flex',gap:6,marginBottom:22}}>
      {[{id:'2025',l:'2025'},{id:'2026',l:'2026'},{id:'compare',l:'Сравнение'}].map(t=><button key={t.id} onClick={()=>{setMode(t.id);setExpanded({})}} style={chipStyle(mode===t.id)}>{t.l}</button>)}
    </div>

    {/* ═══ SINGLE YEAR MODE ═══ */}
    {mode!=='compare'&&<>
      {/* Sales */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Продажи · {yr}</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <Row label="Всего" field="sales" yr={yr}/>
        </tbody></table>
      </div>

      {/* Channels */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Каналы · {yr}</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          {[{l:'Meta',f:'ch_meta'},{l:'Google',f:'ch_google'},{l:'Email',f:'ch_email'},{l:'Direct',f:'ch_direct'},{l:'SEO',f:'ch_seo'},{l:'Social',f:'ch_social'},{l:'New Channels',f:'ch_new'},{l:'Other',f:'ch_other'}].map(ch=><ChRow key={ch.f} label={ch.l} field={ch.f} yr1={yr}/>)}
        </tbody></table>
      </div>

      {/* CPO + Spend */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>CPO и Spend · {yr}</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <ChRow label="CPO Meta" field="cpo_meta" yr1={yr} color1="#FF6C1C"/>
          <ChRow label="CPO Google" field="cpo_google" yr1={yr} color1="#1761CB"/>
          <ChRow label="Spend Meta" field="spend_meta" yr1={yr} color1="#FF6C1C"/>
          <ChRow label="Spend Google" field="spend_google" yr1={yr} color1="#1761CB"/>
        </tbody></table>
      </div>

      {/* Retention */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Retention · {yr}</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <ChRow label="База" field="subscriber_base" yr1={yr} hideYtd/>
          <ChRow label="Churn %" field="churn_rate" yr1={yr} color1="#DD2A02" hideYtd/>
          <ChRow label="Отток шт" field="churn_units" yr1={yr} color1="#DD2A02" hideYtd/>
          <ChRow label="Net Growth" field="net_growth" yr1={yr} color1="#497B02" hideYtd/>
        </tbody></table>
      </div>
    </>}

    {/* Annotations in single year */}
    {mode!=='compare'&&<div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22,marginBottom:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Аннотации · {yr}</div>
        <select onChange={async e=>{if(!e.target.value)return;const id=e.target.value;const exists=data.find(d2=>d2.id===id);if(!exists){await supabase.from('yearly_metrics').insert({id,year:yr,month:parseInt(id.split('-')[1]),annotation:'Новая аннотация'});setData(prev=>[...prev,{id,year:yr,month:parseInt(id.split('-')[1]),annotation:'Новая аннотация'}])}else{await saveCell(id,'annotation','Новая аннотация')};e.target.value=''}} style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:12,cursor:'pointer'}}><option value="">+ добавить...</option>{ML.map((m,i)=>{const id2=getId(yr,i+1);return!data.find(d2=>d2.id===id2&&d2.annotation)?<option key={id2} value={id2}>{m}</option>:null})}</select>
      </div>
      {data.filter(d=>d.year===yr&&d.annotation).sort((a,b)=>a.month-b.month).map(d=><div key={d.id} style={{display:'flex',gap:12,padding:'8px 0',borderBottom:'1px solid #E4E6E9',fontSize:14,alignItems:'center'}}>
        <span style={{fontWeight:600,color:'#6E9B0E',minWidth:60,flexShrink:0}}>{MF[d.month-1]}</span>
        <Ed value={d.annotation} canEdit={true} onSave={v=>saveCell(d.id,'annotation',v)} style={{color:S.i2,flex:1}}/>
        <button onClick={()=>saveCell(d.id,'annotation',null)} style={{fontSize:12,color:'#C4C8CD',background:'none',border:'none',cursor:'pointer',flexShrink:0}}>✕</button>
      </div>)}
      {data.filter(d=>d.year===yr&&d.annotation).length===0&&<div style={{fontSize:13,color:S.i3}}>Нет аннотаций</div>}
    </div>}

    {/* ═══ COMPARE MODE ═══ */}
    {mode==='compare'&&<>
      {/* Sales comparison */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Продажи · 2025 vs 2026</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <CmpRow label="Продажи" field="sales"/>
        </tbody></table>
      </div>

      {/* Channels comparison */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Каналы · 2025 vs 2026</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          {[{l:'Meta',f:'ch_meta',c1:'#6E9B0E',c2:'#AAD34F'},{l:'Google',f:'ch_google',c1:'#1761CB',c2:'#74ADF7'},{l:'Email',f:'ch_email',c1:'#FF6C1C',c2:'#FFAC47'},{l:'Direct',f:'ch_direct',c1:'#585E65',c2:'#9AA0A6'},{l:'SEO',f:'ch_seo'},{l:'Social',f:'ch_social'},{l:'New Channels',f:'ch_new'}].map(ch=><ChRow key={ch.f} label={ch.l} field={ch.f} yr1={2025} yr2={2026} color1={ch.c1} color2={ch.c2}/>)}
        </tbody></table>
      </div>

      {/* CPO comparison */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>CPO · 2025 vs 2026</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <ChRow label="CPO Meta" field="cpo_meta" yr1={2025} yr2={2026} color1="#FF6C1C" color2="#F6360B"/>
          <ChRow label="CPO Google" field="cpo_google" yr1={2025} yr2={2026}/>
        </tbody></table>
      </div>

      {/* Spend comparison */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Spend · 2025 vs 2026</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <ChRow label="Meta" field="spend_meta" yr1={2025} yr2={2026} color1="#FF6C1C" color2="#F6360B"/>
          <ChRow label="Google" field="spend_google" yr1={2025} yr2={2026}/>
        </tbody></table>
      </div>

      {/* Retention comparison */}
      <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:24,overflowX:'auto'}}>
        <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Retention · 2025 vs 2026</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14,minWidth:800}}><thead><TH/></thead><tbody>
          <ChRow label="База" field="subscriber_base" yr1={2025} yr2={2026} hideYtd/>
          <ChRow label="Churn %" field="churn_rate" yr1={2025} yr2={2026} color1="#DD2A02" color2="#F18B0E" hideYtd/>
          <ChRow label="Отток шт" field="churn_units" yr1={2025} yr2={2026} color1="#DD2A02" color2="#F18B0E" hideYtd/>
          <ChRow label="Net Growth" field="net_growth" yr1={2025} yr2={2026} color1="#497B02" color2="#DD2A02" hideYtd/>
        </tbody></table>
      </div>

      {/* Annotations */}
      {data.filter(d=>d.annotation).length>0&&<div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:22,marginBottom:22}}>
        <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:14}}>Аннотации</div>
        {data.filter(d=>d.annotation).sort((a,b)=>a.id.localeCompare(b.id)).map(d=><div key={d.id} style={{display:'flex',gap:12,padding:'8px 0',borderBottom:'1px solid #E4E6E9',fontSize:14}}>
          <span style={{fontWeight:600,color:d.year===2025?'#6E9B0E':'#1761CB',minWidth:80}}>{MF[d.month-1]} {d.year}</span>
          <Ed value={d.annotation} canEdit={true} onSave={v=>saveCell(d.id,'annotation',v)} style={{color:S.i2}}/>
        </div>)}
      </div>}
    </>}
  </>
}

export default YoYReport
