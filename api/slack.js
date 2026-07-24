// Vercel Serverless: Slack bot — project-based team survey
// ENV: SLACK_BOT_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js'

const TEAM = {
  'Julia':   { slackId: 'U094ELTFZ9R', role: 'Google Ads' },
  'Nikita':  { slackId: 'U09C0BL6DNC', role: 'Meta Ads' },
  'Vlada':   { slackId: 'U046PBY6MMZ', role: 'Email/Retention' },
  'Dasha':   { slackId: 'U08GV7FTJKV', role: 'SMM/Content' },
  'Natiia':  { slackId: 'U05SLQ0FSN8', role: 'Influencers' },
  'Ivan':    { slackId: 'U02P4RGETFG', role: 'Operations' },
  'Olga':    { slackId: 'U0AHYP8NP9P', role: 'Management' },
  'Sasha B': { slackId: 'U09NTUJL4KT', role: 'Strategy' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const TOKEN = process.env.SLACK_BOT_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'SLACK_BOT_TOKEN not set' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  const { action } = req.query;

  const slackAPI = async (method, body) => {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  };

  // ═══ TEST ═══
  if (action === 'test') {
    const r = await slackAPI('auth.test', {});
    return res.json({ ok: r.ok, team: r.team, user: r.user, supabase: !!supabase, error: r.error });
  }

  // ═══ SEND SURVEY ═══
  if (action === 'send') {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    // Find previous completed week (latest week_start before this Monday)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevWeekStr = prevMonday.toISOString().slice(0, 10);

    // Get the report for previous week
    const { data: reports } = await supabase
      .from('weekly_reports').select('id, week_label, week_start')
      .order('week_start', { ascending: false }).limit(5);
    const prevReport = reports?.find(r => r.week_start <= prevWeekStr) || reports?.[0];

    // Get active projects (not done)
    const { data: projects } = await supabase
      .from('projects').select('id, name, owner, status, priority')
      .neq('status', 'done').order('sort_order');

    if (!projects?.length) return res.json({ ok: false, error: 'No active projects' });

    // Group projects by owner
    const byOwner = {};
    for (const p of projects) {
      const owner = p.owner?.trim();
      if (!owner) continue;
      if (!byOwner[owner]) byOwner[owner] = [];
      byOwner[owner].push(p);
    }

    const results = [];
    for (const [ownerName, ownerProjects] of Object.entries(byOwner)) {
      const member = TEAM[ownerName];
      if (!member) { results.push({ name: ownerName, error: 'Not in TEAM map' }); continue; }

      const projectList = ownerProjects
        .map(p => `• *${p.name}* (${p.id}) — ${p.status}`)
        .join('\n');

      const message = `📊 *Еженедельный опрос · ${prevReport?.week_label || 'прошлая неделя'}*\n\n`
        + `Привет! Ответь по каждому проекту — что изменилось за неделю:\n\n`
        + `${projectList}\n\n`
        + `Формат ответа:\n`
        + `*${ownerProjects[0]?.id}*: твой комментарий\n`
        + `*${ownerProjects[1]?.id || 'XX00'}*: твой комментарий\n\n`
        + `_Ответы попадут в Growth Dashboard за ${prevReport?.week_label || 'прошлую неделю'}._`;

      try {
        const dm = await slackAPI('conversations.open', { users: member.slackId });
        if (!dm.ok) { results.push({ name: ownerName, error: dm.error }); continue; }

        const msg = await slackAPI('chat.postMessage', { channel: dm.channel.id, text: message });
        results.push({ name: ownerName, projects: ownerProjects.length, sent: msg.ok, channel: dm.channel.id });
      } catch (e) {
        results.push({ name: ownerName, error: e.message });
      }
    }

    return res.json({ ok: true, week: prevReport?.week_label, ownersFound: Object.keys(byOwner).length, results });
  }

  // ═══ COLLECT RESPONSES ═══
  if (action === 'collect') {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    // Find previous week
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevWeekStr = prevMonday.toISOString().slice(0, 10);

    const { data: reports } = await supabase
      .from('weekly_reports').select('id, week_label, week_start')
      .order('week_start', { ascending: false }).limit(5);
    const prevReport = reports?.find(r => r.week_start <= prevWeekStr) || reports?.[0];
    const weekStart = prevReport?.week_start;

    const collected = [];

    for (const [ownerName, member] of Object.entries(TEAM)) {
      try {
        const dm = await slackAPI('conversations.open', { users: member.slackId });
        if (!dm.ok) continue;

        const hist = await slackAPI('conversations.history', { channel: dm.channel.id, limit: 10 });
        if (!hist.ok) continue;

        // Find messages FROM the user (not bot), recent (last 48h)
        const cutoff = Date.now() / 1000 - 48 * 3600;
        const userMsgs = hist.messages?.filter(m => m.user === member.slackId && parseFloat(m.ts) > cutoff) || [];

        for (const msg of userMsgs) {
          // Parse "PROJECT_ID: comment" format
          const lines = msg.text.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const match = line.match(/^\*?([A-Z]{1,4}\d{1,3})\*?[:\s]+(.+)/i);
            if (match) {
              const projectId = match[1].toUpperCase();
              const comment = match[2].trim();

              // Insert as project comment
              const { error } = await supabase.from('project_comments').insert({
                project_id: projectId,
                author: ownerName + ' (Slack)',
                full_text: comment,
                summary: comment.length > 120 ? comment.slice(0, 117) + '…' : comment,
                week_start: weekStart
              });

              collected.push({ owner: ownerName, project: projectId, comment: comment.slice(0, 80), saved: !error, error: error?.message });
            }
          }

          // If no project ID format, save as general comment for first project
          if (!lines.some(l => l.match(/^\*?[A-Z]{1,4}\d{1,3}\*?[:\s]/i))) {
            const { data: ownerProjects } = await supabase
              .from('projects').select('id').eq('owner', ownerName).neq('status', 'done').limit(1);
            if (ownerProjects?.[0]) {
              await supabase.from('project_comments').insert({
                project_id: ownerProjects[0].id,
                author: ownerName + ' (Slack)',
                full_text: msg.text,
                summary: msg.text.length > 120 ? msg.text.slice(0, 117) + '…' : msg.text,
                week_start: weekStart
              });
              collected.push({ owner: ownerName, project: ownerProjects[0].id, comment: msg.text.slice(0, 80), saved: true, general: true });
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    return res.json({ ok: true, week: prevReport?.week_label, collected });
  }

  return res.status(400).json({ error: 'action: test | send | collect' });
}
