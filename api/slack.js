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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'SLACK_BOT_TOKEN not set' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  const { action } = req.query;
  const slack = async (method, body) => {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  };

  // ═══ TEST ═══
  if (action === 'test') {
    const r = await slack('auth.test', {});
    return res.json({ ok: r.ok, team: r.team, user: r.user, supabase: !!supabase, error: r.error });
  }

  // ═══ SEND — one message per project ═══
  if (action === 'send') {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const filterUser = req.query.user || null;

    // Previous week
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const prevMonday = new Date(monday); prevMonday.setDate(prevMonday.getDate() - 7);
    const { data: reports } = await supabase.from('weekly_reports').select('id,week_label,week_start').order('week_start',{ascending:false}).limit(5);
    const prevReport = reports?.find(r => r.week_start <= prevMonday.toISOString().slice(0,10)) || reports?.[0];

    // Active projects
    const { data: projects } = await supabase.from('projects').select('id,name,owner,status,priority').neq('status','done').order('sort_order');
    if (!projects?.length) return res.json({ error: 'No active projects' });

    // Group by owner
    const byOwner = {};
    for (const p of projects) {
      const o = p.owner?.trim();
      if (!o || (filterUser && o !== filterUser)) continue;
      if (!byOwner[o]) byOwner[o] = [];
      byOwner[o].push(p);
    }

    const results = [];
    for (const [owner, ops] of Object.entries(byOwner)) {
      const member = TEAM[owner];
      if (!member) { results.push({ name: owner, error: 'Not in TEAM map' }); continue; }

      try {
        const dm = await slack('conversations.open', { users: member.slackId });
        if (!dm.ok) { results.push({ name: owner, error: dm.error }); continue; }
        const ch = dm.channel.id;

        // 1. Intro
        await slack('chat.postMessage', { channel: ch,
          text: `👋 Привет ${owner}! Провожу еженедельный опрос по твоим проектам.\n\n`
            + `У тебя *${ops.length}* активных проектов. Я спрошу по каждому — что изменилось за неделю *${prevReport?.week_label||''}*.\n\n`
            + `Если изменений нет — так и пиши: _«без изменений»_`
        });

        // 2. One message per project
        for (const p of ops) {
          const emoji = p.priority === 'key' ? '🔴' : '🔵';
          const statusMap = { progress:'в работе', wait:'ожидание', test:'тестируем', risk:'риск', blocked:'блокер' };
          await slack('chat.postMessage', { channel: ch,
            text: `${emoji} *${p.name}*\nСтатус: ${statusMap[p.status]||p.status}\n\nЧто изменилось?`
          });
        }

        results.push({ name: owner, projects: ops.length, sent: true });
      } catch (e) {
        results.push({ name: owner, error: e.message });
      }
    }

    return res.json({ ok: true, week: prevReport?.week_label, results });
  }

  // ═══ COLLECT — match bot questions to user answers ═══
  if (action === 'collect') {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const { data: reports } = await supabase.from('weekly_reports').select('id,week_label,week_start').order('week_start',{ascending:false}).limit(5);
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const prevMonday = new Date(monday); prevMonday.setDate(prevMonday.getDate() - 7);
    const prevReport = reports?.find(r => r.week_start <= prevMonday.toISOString().slice(0,10)) || reports?.[0];
    const weekStart = prevReport?.week_start;

    const { data: projects } = await supabase.from('projects').select('id,name,owner').neq('status','done');

    const collected = [];
    for (const [owner, member] of Object.entries(TEAM)) {
      try {
        const dm = await slack('conversations.open', { users: member.slackId });
        if (!dm.ok) continue;

        const hist = await slack('conversations.history', { channel: dm.channel.id, limit: 50 });
        if (!hist.ok || !hist.messages) continue;

        // Messages are newest-first, reverse for chronological
        const msgs = [...hist.messages].reverse();

        // Find bot project questions and the user's next reply
        const ownerProjects = projects?.filter(p => p.owner?.trim() === owner) || [];
        let projectIdx = 0;

        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          // Is this a bot message about a project?
          if (m.bot_id && ownerProjects[projectIdx]) {
            const proj = ownerProjects.find(p => m.text?.includes(p.name));
            if (!proj) continue;

            // Find next user message after this bot message
            const reply = msgs.slice(i + 1).find(r => r.user === member.slackId && !r.bot_id);
            if (reply && reply.text?.trim()) {
              const comment = reply.text.trim();
              if (comment.toLowerCase() === 'без изменений' || comment.toLowerCase() === 'no changes') {
                collected.push({ owner, project: proj.name, comment: 'Без изменений', saved: true, skipped: true });
              } else {
                const { error } = await supabase.from('project_comments').insert({
                  project_id: proj.id,
                  author: owner + ' (Slack)',
                  full_text: comment,
                  summary: comment.length > 120 ? comment.slice(0, 117) + '…' : comment,
                  week_start: weekStart
                });
                collected.push({ owner, project: proj.name, comment: comment.slice(0, 80), saved: !error, error: error?.message });
              }
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    return res.json({ ok: true, week: prevReport?.week_label, collected });
  }

  return res.status(400).json({ error: 'action: test | send | collect' });
}
