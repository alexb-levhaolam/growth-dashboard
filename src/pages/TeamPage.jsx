import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { S, Ed } from '../lib/ui'

// ═══ TEAM PAGE ═══
function TeamPage({allProfiles,ce,reload}){
  const[members,setMembers]=useState([]);const[adding,setAdding]=useState(false)
  const[newN,setNewN]=useState('');const[newR,setNewR]=useState('');const[newS,setNewS]=useState('')
  

  const loadMembers=async()=>{const{data}=await supabase.from('team_members').select('*').order('name');if(data)setMembers(data)}
  useEffect(()=>{loadMembers()},[])

  const addMember=async()=>{if(!newN.trim())return;await supabase.from('team_members').insert({name:newN.trim(),role:newR.trim(),slack_id:newS.trim()});setNewN('');setNewR('');setNewS('');setAdding(false);loadMembers()}
  const delMember=async(id)=>{if(!confirm('Удалить участника?'))return;await supabase.from('team_members').delete().eq('id',id);loadMembers()}
  const updMember=async(id,field,val)=>{await supabase.from('team_members').update({[field]:val}).eq('id',id);setMembers(prev=>prev.map(m=>m.id===id?{...m,[field]:val}:m))}

  return<>
    <h1 style={{fontSize:24,fontWeight:600,marginBottom:22}}>Команда</h1>

    <div style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:12}}>Доступ к дашборду</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:28}} className="lh-grid2">
      {allProfiles.map(p=><div key={p.id} style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16,display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:S.gm,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:500,color:'#fff'}}>{(p.name||p.email||'?')[0].toUpperCase()}</div>
        <div style={{flex:1}}><div style={{fontWeight:600}}>{p.name||p.email}</div><div style={{fontSize:13,color:S.i3}}>{p.role}</div></div>
        {ce&&<select value={p.role} onChange={e=>{supabase.from('profiles').update({role:e.target.value}).eq('id',p.id).then(()=>reload())}} style={{padding:'4px 8px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:13}}><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></select>}
      </div>)}
    </div>

    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <span style={{fontSize:14,fontWeight:600,color:S.i3,letterSpacing:'.06em',textTransform:'uppercase'}}>Команда маркетинга</span>
      {ce&&<button onClick={()=>setAdding(!adding)} style={{fontSize:13,padding:'6px 14px',borderRadius:8,border:'none',background:adding?'#FFEEEA':S.gm,color:adding?'#A71F00':'#fff',cursor:'pointer',fontWeight:500}}>{adding?'Отмена':'+ Добавить'}</button>}
    </div>

    {adding&&<div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:16,marginBottom:12,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
      <input value={newN} onChange={e=>setNewN(e.target.value)} placeholder="Имя" style={{flex:1,minWidth:120,padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14}}/>
      <input value={newR} onChange={e=>setNewR(e.target.value)} placeholder="Роль" style={{flex:1,minWidth:120,padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14}}/>
      <input value={newS} onChange={e=>setNewS(e.target.value)} placeholder="Slack ID" style={{width:130,padding:'8px 12px',borderRadius:8,border:`1px solid ${S.ln}`,fontSize:14,fontFamily:'monospace'}}/>
      <button onClick={addMember} style={{padding:'8px 16px',borderRadius:8,border:'none',background:S.gm,color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer'}}>Добавить</button>
    </div>}

    <div style={{background:S.sf,borderRadius:14,boxShadow:S.sh,padding:'6px 0',marginBottom:22}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
        <thead><tr style={{borderBottom:`1px solid ${S.ln}`}}>
          <th style={{textAlign:'left',padding:'8px 16px',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:S.i3}}>Имя</th>
          <th style={{textAlign:'left',padding:'8px 16px',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:S.i3}}>Роль</th>
          <th style={{textAlign:'left',padding:'8px 16px',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:S.i3}}>Slack ID</th>
          {ce&&<th style={{width:40}}></th>}
        </tr></thead>
        <tbody>
          {members.map(t=><tr key={t.id} style={{borderBottom:`1px solid ${S.ln}`}}>
            <td style={{padding:'10px 16px'}}><Ed value={t.name} canEdit={ce} onSave={v=>updMember(t.id,'name',v)} style={{fontWeight:500}}/></td>
            <td style={{padding:'10px 16px'}}><Ed value={t.role} canEdit={ce} onSave={v=>updMember(t.id,'role',v)} style={{color:S.i2}}/></td>
            <td style={{padding:'10px 16px'}}><Ed value={t.slack_id} canEdit={ce} onSave={v=>updMember(t.id,'slack_id',v)} style={{color:S.i3,fontFamily:'monospace',fontSize:12}}/></td>
            {ce&&<td style={{padding:'10px 8px'}}><button onClick={()=>delMember(t.id)} style={{fontSize:14,color:'#C4C8CD',background:'none',border:'none',cursor:'pointer'}}>✕</button></td>}
          </tr>)}
          {members.length===0&&<tr><td colSpan={4} style={{padding:'20px 16px',textAlign:'center',color:S.i3}}>Нет участников</td></tr>}
        </tbody>
      </table>
    </div>
  </>
}

export default TeamPage
