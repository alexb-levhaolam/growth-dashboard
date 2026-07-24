import { createClient } from '@supabase/supabase-js'

const TEAM = {
  'Julia':   { slackId: 'U094ELTFZ9R' },
  'Nikita':  { slackId: 'U09C0BL6DNC' },
  'Vlada':   { slackId: 'U046PBY6MMZ' },
  'Dasha':   { slackId: 'U08GV7FTJKV' },
  'Natiia':  { slackId: 'U05SLQ0FSN8' },
  'Ivan':    { slackId: 'U02P4RGETFG' },
  'Olga':    { slackId: 'U0AHYP8NP9P' },
  'Sasha B': { slackId: 'U09NTUJL4KT' },
  'Alex':    { slackId: 'U09NTUJL4KT' },
  'Rivki':   { slackId: 'U03DAH7HE73' },
};
const ID2OWNER = Object.fromEntries(Object.entries(TEAM).map(([n,v])=>[v.slackId,n]));

export default async function handler(req, res) {
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  const slack = async (method, body) => {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method:'POST', headers:{'Authorization':`Bearer ${TOKEN}`,'Content-Type':'application/json'},
      body: JSON.stringify(body)
    }); return r.json();
  };

  // ═══ SLACK EVENTS (POST) ═══
  if (req.method === 'POST' && req.body) {
    if (req.body.type === 'url_verification') return res.json({ challenge: req.body.challenge });

    if (req.body.event?.type === 'message' && !req.body.event?.bot_id && req.body.event?.channel_type === 'im') {
      const userId = req.body.event.user;
      const owner = ID2OWNER[userId];
      if (!owner || !supabase || !TOKEN) return res.status(200).end();

      try {
        const { data: projects } = await supabase.from('projects').select('id,name,owner,status,priority').neq('status','done').order('sort_order');
        const ops = projects?.filter(p => p.owner?.trim() === owner) || [];
        if (!ops.length) return res.status(200).end();

        const dm = await slack('conversations.open', { users: userId });
        if (!dm.ok) return res.status(200).end();
        const hist = await slack('conversations.history', { channel: dm.channel.id, limit: 50 });
        const msgs = [...(hist.messages || [])].reverse();

        // Find answered projects
        const answered = new Set();
        const usedReplies = new Set();
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          if (!m.bot_id) continue;
          const proj = ops.find(p => m.text?.includes(p.name));
          if (!proj) continue;
          const reply = msgs.slice(i+1).find(r => r.user === userId && !r.bot_id && !usedReplies.has(r.ts));
          if (reply) { usedReplies.add(reply.ts); answered.add(proj.id); }
        }

        // Save current answer
        const userText = req.body.event.text?.trim();
        const lastBotMsg = [...(hist.messages||[])].find(m => m.bot_id);
        const lastProj = ops.find(p => lastBotMsg?.text?.includes(p.name));

        if (lastProj && userText) {
          const today = new Date();
          const mon = new Date(today); mon.setDate(mon.getDate()-(today.getDay()===0?6:today.getDay()-1));
          const prevMon = new Date(mon); prevMon.setDate(prevMon.getDate()-7);
          const { data: reps } = await supabase.from('weekly_reports').select('week_start').order('week_start',{ascending:false}).limit(5);
          const ws = reps?.find(r=>r.week_start<=prevMon.toISOString().slice(0,10))?.week_start || reps?.[0]?.week_start;

          if (!userText.toLowerCase().startsWith('no change') && !userText.toLowerCase().startsWith('без изменен')) {
            await supabase.from('project_comments').insert({
              project_id: lastProj.id, author: owner+' (Slack)',
              full_text: userText, summary: userText.length>120?userText.slice(0,117)+'…':userText,
              week_start: ws
            });
          }
        }

        // Send next or finish
        const nextProj = ops.find(p => !answered.has(p.id));
        if (nextProj) {
          const emoji = nextProj.priority==='key'?'🔴':'🔵';
          const stMap = {progress:'In progress',wait:'Waiting',test:'Testing',risk:'At risk',blocked:'Blocked'};
          const rem = ops.filter(p=>!answered.has(p.id)&&p.id!==nextProj.id).length;
          await slack('chat.postMessage',{channel:dm.channel.id,
            text:`${emoji} *${nextProj.name}*\nStatus: ${stMap[nextProj.status]||nextProj.status}\n${rem>0?`${rem} more to go`:'Last project!'}\n\nWhat changed this week?`
          });
        } else {
          await slack('chat.postMessage',{channel:dm.channel.id,
            text:`✅ Thank you ${owner}! All ${ops.length} projects updated.\nResponses saved to Growth Dashboard.`
          });
        }
      } catch(e) { console.error('Slack event error:', e); }
      return res.status(200).end();
    }
    return res.status(200).end();
  }

  // ═══ GET ACTIONS ═══
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { action } = req.query;

  if (action === 'test') {
    const r = await slack('auth.test', {});
    return res.json({ ok: r.ok, team: r.team, user: r.user, supabase: !!supabase });
  }

  if (action === 'send') {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const filterUser = req.query.user || null;

    const { data: reps } = await supabase.from('weekly_reports').select('id,week_label,week_start').order('week_start',{ascending:false}).limit(5);
    const today = new Date(); const mon = new Date(today);
    mon.setDate(mon.getDate()-(today.getDay()===0?6:today.getDay()-1));
    const prevMon = new Date(mon); prevMon.setDate(prevMon.getDate()-7);
    const prevRep = reps?.find(r=>r.week_start<=prevMon.toISOString().slice(0,10))||reps?.[0];

    const { data: projects } = await supabase.from('projects').select('id,name,owner,status,priority').neq('status','done').order('sort_order');
    const byOwner = {};
    for (const p of projects||[]) {
      const o = p.owner?.trim();
      if (!o||(filterUser&&o!==filterUser)) continue;
      if (!byOwner[o]) byOwner[o]=[];
      byOwner[o].push(p);
    }

    const results = [];
    for (const [owner,ops] of Object.entries(byOwner)) {
      const member = TEAM[owner];
      if (!member) { results.push({name:owner,error:'Not in TEAM map'}); continue; }
      try {
        const dm = await slack('conversations.open',{users:member.slackId});
        if (!dm.ok) { results.push({name:owner,error:dm.error}); continue; }

        await slack('chat.postMessage',{channel:dm.channel.id,
          text:`👋 Hi ${owner}! Time for the weekly project update.\n\nYou have *${ops.length}* active projects for week *${prevRep?.week_label||''}*.\nI'll ask about each one, one at a time.\n\nIf nothing changed — just write _"no changes"_.\n\n_You can reply in English or Russian, whatever is more comfortable for you._`
        });

        const first = ops[0];
        const emoji = first.priority==='key'?'🔴':'🔵';
        const stMap = {progress:'In progress',wait:'Waiting',test:'Testing',risk:'At risk',blocked:'Blocked'};
        await slack('chat.postMessage',{channel:dm.channel.id,
          text:`${emoji} *${first.name}*\nStatus: ${stMap[first.status]||first.status}\n${ops.length>1?`${ops.length-1} more to go`:'Only project!'}\n\nWhat changed this week?`
        });

        results.push({name:owner,projects:ops.length,sent:true});
      } catch(e) { results.push({name:owner,error:e.message}); }
    }

    return res.json({ok:true,week:prevRep?.week_label,results});
  }

  return res.status(400).json({error:'action: test | send'});
}
