import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { S, PROJ_ST, Chip, Label, Linkify, chipStyle } from '../lib/ui'

// ═══ DYNAMICS ═══
function Dynamics({projects,comments,reports,aIdx,ce,reload}){const[expanded,setExpanded]=useState(null);const[fSt,setFSt]=useState('all');const rep=reports[aIdx]
  const getSnap=(pid,ws)=>{const r=reports.find(r=>r.week_start===ws);return(r?.project_snapshots||[]).find(s=>s.id===pid)||null}
  const saveSnapshots=async()=>{if(!rep)return;const snaps=projects.map(p=>({id:p.id,name:p.name,status:p.status,owner:p.owner,priority:p.priority,date_start:p.date_start,date_test:p.date_test,date_results:p.date_results,date_done:p.date_done,constraints:p.constraints_text,last_update:p.last_update}));await supabase.from('weekly_reports').update({project_snapshots:snaps}).eq('id',rep.id);reload()}
  const fmtD=d=>{if(!d)return null;const p=d.split('-');return`${p[2]}.${p[1]}`}
  // Sort: risk→blocked→test→progress→wait→done
  const stOrder={risk:0,blocked:1,test:2,progress:3,wait:4,done:5}
  const sorted=[...projects].sort((a,b)=>(stOrder[a.status]??9)-(stOrder[b.status]??9)||(a.sort_order||0)-(b.sort_order||0))
  const filtered=fSt==='all'?sorted:sorted.filter(p=>p.status===fSt)

  const TL=({proj})=>{const isOpen=expanded===proj.id;const ps=PROJ_ST[proj.status]||PROJ_ST.wait;const pC=comments.filter(c=>c.project_id===proj.id);const weeks=[...reports].reverse().map(r=>{const snap=getSnap(proj.id,r.week_start);const snapSt=snap?PROJ_ST[snap.status]:null;return{...r,wc:pC.filter(c=>c.week_start===r.week_start),snap,snapSt}})
    const hasBlock=proj.constraints_text&&proj.constraints_text.trim()
    const dates=[proj.date_start&&`начало ${fmtD(proj.date_start)}`,proj.date_test&&`тест ${fmtD(proj.date_test)}`,proj.date_results&&`результаты ${fmtD(proj.date_results)}`,proj.date_done&&`завершён ${fmtD(proj.date_done)}`].filter(Boolean).join(' · ')
    return<div style={{background:hasBlock?'#FFF0F0':S.sf,border:`1px solid ${hasBlock?'#E8AAAA':S.ln}`,borderRadius:14,marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'12px 16px',cursor:'pointer'}} onClick={()=>setExpanded(isOpen?null:proj.id)}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>{hasBlock&&<span style={{fontSize:16}}></span>}<span style={{fontWeight:500}}>{proj.name}</span><span style={{fontSize:14,color:S.i3}}>{proj.owner}</span></div>
          {dates&&<div style={{fontSize:14,color:S.i3,marginTop:2}}> {dates}</div>}
          {hasBlock&&<div style={{fontSize:14,color:'#791F1F',marginTop:2}}> {proj.constraints_text}</div>}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}><Chip bg={ps.bg} tx={ps.tx}>{ps.l}</Chip><span style={{color:S.i3}}>{isOpen?'▲':'▼'}</span></div>
      </div>
      {isOpen&&<div style={{padding:'0 16px 16px',borderLeft:`3px solid ${S.gl}`,marginLeft:16}}>{weeks.map(w=><div key={w.id} style={{marginTop:12,paddingBottom:12,borderBottom:`1px solid ${S.ln}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:14,fontWeight:500,color:S.gd}}> {w.week_label}</div>{w.snapSt&&<Chip bg={w.snapSt.bg} tx={w.snapSt.tx}>{w.snapSt.l}</Chip>}</div>
        {w.snap&&<div style={{fontSize:14,color:S.i3,marginTop:2}}>{w.snap.constraints&&<span style={{color:'#791F1F'}}> {w.snap.constraints} · </span>}{[w.snap.date_start&&`начало: ${w.snap.date_start}`,w.snap.date_done&&`завершён: ${w.snap.date_done}`].filter(Boolean).join(' · ')}</div>}
        {w.wc.length>0?w.wc.map(c=><div key={c.id} style={{marginTop:4}}><span style={{fontSize:14,color:S.i3}}>{c.author}:</span><div style={{fontSize:16,color:S.ink,whiteSpace:'pre-wrap',lineHeight:1.5}}><Linkify>{c.full_text||c.summary}</Linkify></div></div>):<div style={{fontSize:14,color:S.i3,fontStyle:'italic',marginTop:4}}>Нет обновлений</div>}
      </div>)}</div>}
    </div>}

  return<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
    <Label>История проектов ({filtered.length})</Label>
    {ce&&<button onClick={saveSnapshots} style={{fontSize:14,color:S.gd,background:S.gp,border:'none',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:500}}>Снимок · {rep?.week_label}</button>}
  </div>
  <div style={{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap'}}>
    {[{k:'all',l:'Все'},...Object.entries(PROJ_ST).map(([k,v])=>({k,l:v.l}))].map(f=><button key={f.k} onClick={()=>setFSt(f.k)} style={chipStyle(fSt===f.k)}>{f.l}</button>)}
  </div>
  {filtered.map(p=><TL key={p.id} proj={p}/>)}
  </>}

export default Dynamics
