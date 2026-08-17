import { createClient } from '@supabase/supabase-js'

const TEAM = {
  'Julia':   { slackId: 'U094ELTFZ9R' },
  'Nikita':  { slackId: 'U09C0BL6DNC' },
  'Vlada':   { slackId: 'U046PBY6MMZ' },
  'Dasha':   { slackId: 'U08GV7FTJKV' },
  'Natiia':  { slackId: 'U05SLQ0FSN8' },
  'Ivan':    { slackId: 'U02P4RGETFG' },
  'Olga':    { slackId: 'U0AHYP8NP9P' },
  'Alex':    { slackId: 'U09NTUJL4KT' },
  'Rivki':   { slackId: 'U03DAH7HE73' },
};
const ALIASES = {'Alex':['Alex','Sasha B'],'Julia':['Julia'],'Nikita':['Nikita'],'Vlada':['Vlada'],'Dasha':['Dasha'],'Natiia':['Natiia'],'Ivan':['Ivan'],'Olga':['Olga'],'Rivki':['Rivki']};
const ID2OWNER = Object.fromEntries(
  Object.entries(TEAM).flatMap(([n,v])=>[[v.slackId,n]])
);
// Deduplicate: if multiple names share same slackId, keep first
const _seen = new Set();
for (const [k,v] of Object.entries(TEAM)) {
  if (_seen.has(v.slackId)) { delete ID2OWNER[v.slackId]; ID2OWNER[v.slackId] = k; }
  _seen.add(v.slackId);
}

const SURVEY_MARKER = 'weekly project update';
const WEEK_TAG_RE = /\[ws:([^\]]+)\]/;

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

  // Helper: find current survey context from DM history
  const getSurveyContext = (msgs, ownerProjects, userId) => {
    const introIdx = msgs.map((m,i)=>({m,i})).filter(x=>x.m.bot_id&&x.m.text?.includes(SURVEY_MARKER)).pop()?.i || 0;
    const introMsg = msgs[introIdx];
    const weekMatch = introMsg?.text?.match(WEEK_TAG_RE);
    const weekStart = weekMatch?.[1] || null;
    const surveyMsgs = msgs.slice(introIdx);

    const answered = new Set();
    const usedReplies = new Set();
    for (let i = 0; i < surveyMsgs.length; i++) {
      const m = surveyMsgs[i];
      if (!m.bot_id) continue;
      const proj = ownerProjects.find(p => m.text?.includes(p.name));
      if (!proj) continue;
      const reply = surveyMsgs.slice(i+1).find(r => r.user === userId && !r.bot_id && !usedReplies.has(r.ts));
      if (reply) { usedReplies.add(reply.ts); answered.add(proj.id); }
    }

    const lastBotMsg = [...surveyMsgs].reverse().find(m => m.bot_id);
    const lastProj = ownerProjects.find(p => lastBotMsg?.text?.includes(p.name));
    if (lastProj) answered.add(lastProj.id);

    return { weekStart, answered, lastProj, surveyMsgs };
  };

  // ═══ SLACK EVENTS (POST) ═══
  if (req.method === 'POST' && req.body) {
    if (req.body.type === 'url_verification') return res.json({ challenge: req.body.challenge });

    if (req.body.event?.type === 'message' && !req.body.event?.bot_id && req.body.event?.channel_type === 'im') {
      const userId = req.body.event.user;
      const owner = ID2OWNER[userId];
      if (!owner || !supabase || !TOKEN) return res.status(200).end();

      try {
        const { data: projects } = await supabase.from('projects').select('id,name,owner,status,priority').neq('status','done').neq('status','wait').order('sort_order');
        const ownerNames = ALIASES[owner] || [owner];
        const ops = projects?.filter(p => ownerNames.includes(p.owner?.trim())) || [];
        if (!ops.length) return res.status(200).end();

        const dm = await slack('conversations.open', { users: userId });
        if (!dm.ok) return res.status(200).end();
        const hist = await slack('conversations.history', { channel: dm.channel.id, limit: 50 });
        const msgs = [...(hist.messages || [])].reverse();

        const ctx = getSurveyContext(msgs, ops, userId);
        const userText = req.body.event.text?.trim();

        // Save answer for last asked project
        if (ctx.lastProj && userText && ctx.weekStart) {
          if (!userText.toLowerCase().startsWith('no change') && !userText.toLowerCase().startsWith('без изменен')) {
            await supabase.from('project_comments').insert({
              project_id: ctx.lastProj.id, author: owner + ' (Slack)',
              full_text: userText, summary: userText.length > 120 ? userText.slice(0,117)+'…' : userText,
              week_start: ctx.weekStart
            });
          }
        }

        // Send next unanswered project or finish
        const nextProj = ops.find(p => !ctx.answered.has(p.id));
        if (nextProj) {
          const emoji = nextProj.priority === 'key' ? '🔴' : '🔵';
          const stMap = {progress:'In progress',wait:'Waiting',test:'Testing',risk:'At risk',blocked:'Blocked'};
          const rem = ops.filter(p => !ctx.answered.has(p.id) && p.id !== nextProj.id).length;
          await slack('chat.postMessage', { channel: dm.channel.id,
            text: `${emoji} *${nextProj.name}*\nStatus: ${stMap[nextProj.status]||nextProj.status}\n${rem > 0 ? `${rem} more to go` : 'Last project!'}\n\nWhat changed this week?`
          });
        } else {
          await slack('chat.postMessage', { channel: dm.channel.id,
            text: `✅ Thank you ${owner}! All ${ops.length} projects updated.\nResponses saved to Growth Dashboard.`
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

  if (action === 'debug') {
    if (!supabase) return res.json({ error: 'no supabase' });
    const user = req.query.user;
    const member = user ? TEAM[user] : null;
    if (!member) return res.json({ error: 'user not found', available: Object.keys(TEAM) });

    const { data: projects } = await supabase.from('projects').select('id,name,owner,status').neq('status','done').neq('status','wait').order('sort_order');
    const ownerNames = ALIASES[user] || [user];
    const ops = projects?.filter(p => ownerNames.includes(p.owner?.trim())) || [];

    const dm = await slack('conversations.open', { users: member.slackId });
    if (!dm.ok) return res.json({ error: 'cant open DM', detail: dm.error });
    const hist = await slack('conversations.history', { channel: dm.channel.id, limit: 30 });
    const msgs = [...(hist.messages || [])].reverse();

    const ctx = getSurveyContext(msgs, ops, member.slackId);
    const nextProj = ops.find(p => !ctx.answered.has(p.id));

    return res.json({
      owner: user, weekStart: ctx.weekStart, projectCount: ops.length,
      projects: ops.map(p => ({ id: p.id, name: p.name, answered: ctx.answered.has(p.id) })),
      lastBotAbout: ctx.lastProj?.name, nextProject: nextProj?.name,
      surveyMsgCount: ctx.surveyMsgs?.length
    });
  }

  if (action === 'send') {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const filterUser = req.query.user || null;
    const weekStart = req.query.weekStart || null;
    const weekLabel = req.query.weekLabel ? decodeURIComponent(req.query.weekLabel) : '';

    // Determine week: from query param or find previous week
    let ws = weekStart;
    let wl = weekLabel;
    if (!ws) {
      const { data: reps } = await supabase.from('weekly_reports').select('id,week_label,week_start').order('week_start',{ascending:false}).limit(5);
      const today = new Date(); const mon = new Date(today);
      mon.setDate(mon.getDate()-(today.getDay()===0?6:today.getDay()-1));
      const prevMon = new Date(mon); prevMon.setDate(prevMon.getDate()-7);
      const rep = reps?.find(r=>r.week_start<=prevMon.toISOString().slice(0,10))||reps?.[0];
      ws = rep?.week_start; wl = rep?.week_label || '';
    }

    const { data: projects } = await supabase.from('projects').select('id,name,owner,status,priority').neq('status','done').neq('status','wait').order('sort_order');
    const byOwner = {};
    for (const p of projects||[]) {
      const o = p.owner?.trim();
      if (!o) continue;
      if (filterUser && !(ALIASES[filterUser]||[filterUser]).includes(o)) continue;
      const primaryName = Object.entries(ALIASES).find(([k,v])=>v.includes(o))?.[0] || o;
      if (!byOwner[primaryName]) byOwner[primaryName]=[];
      byOwner[primaryName].push(p);
    }

    const results = [];
    for (const [owner,ops] of Object.entries(byOwner)) {
      const member = TEAM[owner];
      if (!member) { results.push({name:owner,error:'Not in TEAM map'}); continue; }
      try {
        const dm = await slack('conversations.open',{users:member.slackId});
        if (!dm.ok) { results.push({name:owner,error:dm.error}); continue; }

        // Intro with week tag [ws:YYYY-MM-DD]
        await slack('chat.postMessage',{channel:dm.channel.id,
          text:`👋 Hi ${owner}! Time for the ${SURVEY_MARKER}.\n\nYou have *${ops.length}* active projects for week *${wl}*.\nI'll ask about each one, one at a time.\n\nIf nothing changed — just write _"no changes"_.\n_You can reply in English or Russian._\n[ws:${ws}]`
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

    return res.json({ok:true,week:wl,weekStart:ws,results});
  }

  return res.status(400).json({error:'action: test | send | debug'});
}
