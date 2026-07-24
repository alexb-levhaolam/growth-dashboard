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
};
const SLACK_ID_TO_OWNER = Object.fromEntries(Object.entries(TEAM).map(([name,v])=>[v.slackId,name]));

export default async function handler(req, res) {
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  const slack = async (method, body) => {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }); return r.json();
  };

  // ═══ SLACK EVENTS API (POST) ═══
  if (req.method === 'POST' && req.body) {
    // URL verification challenge
    if (req.body.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // Message event — user replied in DM
    if (req.body.event?.type === 'message' && !req.body.event?.bot_id && req.body.event?.channel_type === 'im') {
      const userId = req.body.event.user;
      const owner = SLACK_ID_TO_OWNER[userId];
      if (!owner || !supabase || !TOKEN) return res.status(200).end();

      try {
        // Get owner's active projects
        const { data: projects } = await supabase.from('projects').select('id,name,owner,status,priority').neq('status','done').order('sort_order');
        const ownerProjects = projects?.filter(p => p.owner?.trim() === owner) || [];
        if (!ownerProjects.length) return res.status(200).end();

        // Read DM history to find where we are
        const dm = await slack('conversations.open', { users: userId });
        if (!dm.ok) return res.status(200).end();
        const hist = await slack('conversations.history', { channel: dm.channel.id, limit: 50 });
        const msgs = [...(hist.messages || [])].reverse(); // chronological

        // Find which projects have been asked AND answered
        const answered = new Set();
        const usedReplies = new Set();
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          if (!m.bot_id) continue;
          const proj = ownerProjects.find(p => m.text?.includes(p.name));
          if (!proj) continue;
          const reply = msgs.slice(i + 1).find(r => r.user === userId && !r.bot_id && !usedReplies.has(r.ts));
          if (reply) { usedReplies.add(reply.ts); answered.add(proj.id); }
        }

        // Find next unanswered project
        const nextProj = ownerProjects.find(p => !answered.has(p.id));

        // Save the current answer (last user message maps to last asked project)
        const userText = req.body.event.text?.trim();
        const lastBotMsg = [...(hist.messages || [])].find(m => m.bot_id);
        const lastAskedProj = ownerProjects.find(p => lastBotMsg?.text?.includes(p.name));

        if (lastAskedProj && userText) {
          // Find previous week
          const today = new Date();
          const monday = new Date(today);
          monday.setDate(monday.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
          const prevMonday = new Date(monday); prevMonday.setDate(prevMonday.getDate() - 7);
          const { data: reports } = await supabase.from('weekly_reports').select('week_start').order('week_start',{ascending:false}).limit(5);
          const weekStart = reports?.find(r => r.week_start <= prevMonday.toISOString().slice(0,10))?.week_start || reports?.[0]?.week_start;

          if (!userText.toLowerCase().startsWith('без изменен')) {
            await supabase.from('project_comments').insert({
              project_id: lastAskedProj.id, author: owner + ' (Slack)',
              full_text: userText, summary: userText.length > 120 ? userText.slice(0,117)+'…' : userText,
              week_start: weekStart
            });
          }
        }

        // Send next project or finish
        if (nextProj) {
          const emoji = nextProj.priority === 'key' ? '🔴' : '🔵';
          const statusMap = {progress:'в работе',wait:'ожидание',test:'тестируем',risk:'риск',blocked:'блокер'};
          const remaining = ownerProjects.filter(p => !answered.has(p.id) && p.id !== nextProj.id).length;
          await slack('chat.postMessage', { channel: dm.channel.id,
            text: `${emoji} *${nextProj.name}*\nСтатус: ${statusMap[nextProj.status]||nextProj.status}\n${remaining > 0 ? `Осталось ещё ${remaining}` : 'Последний проект!'}\n\nЧто изменилось?`
          });
        } else {
          await slack('chat.postMessage', { channel: dm.channel.id,
            text: `✅ Спасибо ${owner}! Все ${ownerProjects.length} проектов обновлены.\nОтветы сохранены в Growth Dashboard.`
          });
        }
      } catch (e) { console.error('Slack event error:', e); }

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

    const { data: reports } = await supabase.from('weekly_reports').select('id,week_label,week_start').order('week_start',{ascending:false}).limit(5);
    const today = new Date(); const monday = new Date(today);
    monday.setDate(monday.getDate() - (today.getDay()===0?6:today.getDay()-1));
    const prevMonday = new Date(monday); prevMonday.setDate(prevMonday.getDate()-7);
    const prevReport = reports?.find(r=>r.week_start<=prevMonday.toISOString().slice(0,10))||reports?.[0];

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
      if (!member) { results.push({name:owner,error:'Not in TEAM'}); continue; }
      try {
        const dm = await slack('conversations.open',{users:member.slackId});
        if (!dm.ok) { results.push({name:owner,error:dm.error}); continue; }

        // Intro
        await slack('chat.postMessage',{channel:dm.channel.id,
          text:`👋 Привет ${owner}! Провожу еженедельный опрос.\n\nУ тебя *${ops.length}* активных проектов за неделю *${prevReport?.week_label||''}*.\nЯ буду спрашивать по одному. Если изменений нет — пиши _«без изменений»_`
        });

        // First project only
        const first = ops[0];
        const emoji = first.priority==='key'?'🔴':'🔵';
        const statusMap = {progress:'в работе',wait:'ожидание',test:'тестируем',risk:'риск',blocked:'блокер'};
        await slack('chat.postMessage',{channel:dm.channel.id,
          text:`${emoji} *${first.name}*\nСтатус: ${statusMap[first.status]||first.status}\nОсталось ещё ${ops.length-1}\n\nЧто изменилось?`
        });

        results.push({name:owner,projects:ops.length,sent:true});
      } catch(e) { results.push({name:owner,error:e.message}); }
    }

    return res.json({ok:true,week:prevReport?.week_label,results});
  }

  return res.status(400).json({error:'action: test | send'});
}
