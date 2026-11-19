import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { S, pct, EdNum, LHLine } from '../lib/ui'

// ═══ SEO REPORT ═══
function SEOReport(){
  const[tab,setTab]=useState('weekly')
  const[wData,setWData]=useState([]);const[mData,setMData]=useState([])
  const[loading,setLoading]=useState(true);const[importing,setImporting]=useState(false)
  const[expanded,setExpanded]=useState({})

  const load=async()=>{setLoading(true);const[w,m]=await Promise.all([supabase.from('seo_weekly').select('*').order('id',{ascending:false}),supabase.from('seo_monthly').select('*').order('id',{ascending:false})]);if(w.data)setWData(w.data);if(m.data)setMData(m.data);setLoading(false)}
  useEffect(()=>{load()},[])

  const importData=async(type)=>{setImporting(true);try{const r=await fetch('/api/import-seo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})});const d=await r.json();if(d.error)alert('Ошибка: '+d.error);else{alert(d.message);load()}}catch(e){alert('Ошибка: '+e.message)}finally{setImporting(false)}}

  const saveW=async(id,field,val)=>{await supabase.from('seo_weekly').update({[field]:val}).eq('id',id);setWData(prev=>prev.map(r=>r.id===id?{...r,[field]:val}:r))}
  const saveM=async(id,field,val)=>{await supabase.from('seo_monthly').update({[field]:val}).eq('id',id);setMData(prev=>prev.map(r=>r.id===id?{...r,[field]:val}:r))}
  const saveSec=async(id,table,secName,field,val)=>{const row=(table==='seo_weekly'?wData:mData).find(r=>r.id===id);if(!row)return;const secs={...(row.sections||{})};if(!secs[secName])secs[secName]={};secs[secName][field]=val;if(table==='seo_weekly'){await supabase.from('seo_weekly').update({sections:secs}).eq('id',id);setWData(prev=>prev.map(r=>r.id===id?{...r,sections:secs}:r))}else{await supabase.from('seo_monthly').update({sections:secs}).eq('id',id);setMData(prev=>prev.map(r=>r.id===id?{...r,sections:secs}:r))}}

  const pct=(cur,prev)=>{if(cur==null||prev==null||prev===0)return null;return Math.round((cur-prev)/prev*100)}
  const GrowthBadge=({cur,prev,invert})=>{const d=pct(cur,prev);if(d==null)return<span style={{color:'#9AA0A6'}}>—</span>;const good=invert?(d<0):(d>0);return<span style={{fontWeight:600,color:good?'#1B8A00':'#DD2A02'}}>{d>0?'+':''}{d}%</span>}

  const data=tab==='weekly'?wData:mData
  const save=tab==='weekly'?saveW:saveM
  const table=tab==='weekly'?'seo_weekly':'seo_monthly'
  const labelField=tab==='weekly'?'week_label':'month_label'
  const allSections=[...new Set(data.flatMap(d=>Object.keys(d.sections||{})))]

  // Chart component
    const SEOChart=({data:vals,labels,color,height,title})=>{if(vals.filter(v=>v!=null).length<2)return null;return<div style={{marginBottom:8}}><LHLine labels={labels||vals.map((_,i)=>i+1)} series={[{name:title||'',color:color||'#6E9B0E',values:vals}]} title={title} height={(height||160)+40}/></div>}

  if(loading)return<div style={{padding:40,textAlign:'center',color:S.i3}}>Загрузка...</div>

  const sorted=[...data].sort((a,b)=>a.id.localeCompare(b.id));const labels=sorted.map(r=>String(r[labelField]||r.id).replace(/\.\d{4}$/,''))

  return<>
    <h1 style={{fontSize:24,fontWeight:600,marginBottom:16}}>SEO отчёт</h1>
    

    <div style={{display:'flex',gap:6,marginBottom:16}}>
      {[{id:'weekly',l:'Недельный'},{id:'monthly',l:'Месячный'}].map(t=><button key={t.id} onClick={()=>{setTab(t.id);setExpanded({})}} style={{padding:'10px 20px',borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:500,background:tab===t.id?S.gd:'#fff',color:tab===t.id?'#fff':S.i2,boxShadow:S.sh}}>{t.l}</button>)}
      <button onClick={()=>importData(tab)} disabled={importing} style={{marginLeft:'auto',padding:'10px 18px',borderRadius:8,border:'none',background:S.gm,color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',opacity:importing?.5:1}}>{importing?'Импорт...':'Импорт из Google Sheet'}</button>
    </div>

    {/* ORGANIC + AI TRAFFIC */}
    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:22,overflowX:'auto'}}>
      <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Трафик</div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
        <thead><tr style={{borderBottom:`1px solid ${S.ln}`}}>
          <th style={{textAlign:'left',padding:'8px 12px',fontSize:12,fontWeight:600,textTransform:'uppercase',color:S.i3}}>Период</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Орг.визиты</th><th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Орг.продажи</th><th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>ИИ визиты</th><th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>ИИ продажи</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>GSC показы</th><th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>GSC клики</th><th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Δ</th>
        </tr></thead>
        <tbody>{sorted.map((r,i)=>{const prev=i>0?sorted[i-1]:null;return<tr key={r.id} style={{borderBottom:`1px solid ${S.ln}`}}>
          <td style={{padding:'8px 12px',fontWeight:600,whiteSpace:'nowrap'}}>{r[labelField]||r.id}</td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.organic_visits} canEdit={true} onSave={v=>save(r.id,'organic_visits',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.organic_visits} prev={prev?.organic_visits}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.organic_sales} canEdit={true} onSave={v=>save(r.id,'organic_sales',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.organic_sales} prev={prev?.organic_sales}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.ai_visits} canEdit={true} onSave={v=>save(r.id,'ai_visits',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.ai_visits} prev={prev?.ai_visits}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.ai_sales} canEdit={true} onSave={v=>save(r.id,'ai_sales',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.gsc_impressions} canEdit={true} onSave={v=>save(r.id,'gsc_impressions',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.gsc_impressions} prev={prev?.gsc_impressions}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.gsc_clicks} canEdit={true} onSave={v=>save(r.id,'gsc_clicks',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.gsc_clicks} prev={prev?.gsc_clicks}/></td>
        </tr>})}</tbody>
      </table>
      {sorted.length>1&&<div style={{padding:'8px 16px'}}><SEOChart data={sorted.map(r=>r.organic_visits)} labels={labels} color="#6E9B0E" title="Органические визиты"/></div>}
    </div>

    {/* SECTIONS — expandable */}
    {allSections.map(sec=>{const isOpen=expanded[sec];return<div key={sec} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:16,overflowX:'auto'}}>
      <div onClick={()=>setExpanded(p=>({...p,[sec]:!p[sec]}))} style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase',cursor:'pointer'}}><span style={{marginRight:8,color:S.i3}}>{isOpen?'▾':'▸'}</span>{sec}</div>
      {isOpen&&<><table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
        <thead><tr style={{borderBottom:`1px solid ${S.ln}`}}>
          <th style={{textAlign:'left',padding:'8px 12px',fontSize:12,color:S.i3}}>Период</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Клики</th><th style={{textAlign:'right',padding:'8px 4px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Показы</th><th style={{textAlign:'right',padding:'8px 4px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>CTR</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Позиция</th>
        </tr></thead>
        <tbody>{sorted.map((r,i)=>{const s=(r.sections||{})[sec]||{};const prev=i>0?(sorted[i-1].sections||{})[sec]||{}:null;return<tr key={r.id} style={{borderBottom:`1px solid ${S.ln}`}}>
          <td style={{padding:'8px 12px',fontWeight:600,whiteSpace:'nowrap'}}>{r[labelField]||r.id}</td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={s.clicks} canEdit={true} onSave={v=>saveSec(r.id,table,sec,'clicks',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={s.clicks} prev={prev?.clicks}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={s.impressions} canEdit={true} onSave={v=>saveSec(r.id,table,sec,'impressions',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={s.impressions} prev={prev?.impressions}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={s.ctr} canEdit={true} onSave={v=>saveSec(r.id,table,sec,'ctr',v)} style={{fontSize:13,textAlign:'right'}}/>{s.ctr!=null&&'%'}</td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={s.position} canEdit={true} onSave={v=>saveSec(r.id,table,sec,'position',v)} style={{fontSize:13,textAlign:'right'}}/></td>
        </tr>})}</tbody>
      </table>
      <div style={{padding:'8px 16px'}}><SEOChart data={sorted.map(r=>(r.sections||{})[sec]?.clicks)} labels={labels} color="#1761CB" title={'Клики · '+sec}/><SEOChart data={sorted.map(r=>(r.sections||{})[sec]?.impressions)} labels={labels} color="#F18B0E" title={'Показы · '+sec} height={120}/></div>
      </>}
    </div>})}

    {/* GEN AI + AI PERFORMANCE */}
    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'8px 0',marginBottom:22,overflowX:'auto'}}>
      <div style={{padding:'10px 16px',fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>ИИ показатели</div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:500}}>
        <thead><tr style={{borderBottom:`1px solid ${S.ln}`}}>
          <th style={{textAlign:'left',padding:'8px 12px',fontSize:12,color:S.i3}}>Период</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Gen AI показы</th><th style={{textAlign:'right',padding:'8px 4px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Цитирования</th><th style={{textAlign:'right',padding:'8px 4px',fontSize:12,color:S.i3}}>Δ</th>
          <th style={{textAlign:'right',padding:'8px 8px',fontSize:12,color:S.i3}}>Страниц</th>
        </tr></thead>
        <tbody>{sorted.map((r,i)=>{const prev=i>0?sorted[i-1]:null;return<tr key={r.id} style={{borderBottom:`1px solid ${S.ln}`}}>
          <td style={{padding:'8px 12px',fontWeight:600,whiteSpace:'nowrap'}}>{r[labelField]||r.id}</td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.gen_ai_impressions} canEdit={true} onSave={v=>save(r.id,'gen_ai_impressions',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.gen_ai_impressions} prev={prev?.gen_ai_impressions}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.ai_citations} canEdit={true} onSave={v=>save(r.id,'ai_citations',v)} style={{fontSize:13,textAlign:'right'}}/></td>
          <td style={{textAlign:'right',padding:'8px 4px'}}><GrowthBadge cur={r.ai_citations} prev={prev?.ai_citations}/></td>
          <td style={{textAlign:'right',padding:'8px 8px'}}><EdNum value={r.ai_pages} canEdit={true} onSave={v=>save(r.id,'ai_pages',v)} style={{fontSize:13,textAlign:'right'}}/></td>
        </tr>})}</tbody>
      </table>
    </div>
  </>
}

export default SEOReport
