// Vercel Serverless: Claude API analysis of weekly report
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel env vars' });

  try {
    const { week, metrics, channels, daily, prevMetrics, prevChannels } = req.body;

    const prompt = `Ты — Growth-аналитик Lev Haolam (израильские подарочные боксы по подписке, $119/мес, аудитория: про-израильские христиане и еврейские американцы 45-55+). 

Проанализируй данные за неделю ${week} и сгенерируй два списка.

ТЕКУЩАЯ НЕДЕЛЯ:
Продажи: ${metrics.totalSales || 0}, план: ${metrics.planSales || '—'}
CPO Ads: $${metrics.cpoAdsOverride || '—'}, CPO Total: $${metrics.cpoTotalOverride || '—'}

Каналы:
${(channels || []).map(c => `${c.name}: ${c.sales} продаж, потрачено $${c.spent || 0}, CPO $${c.cpo || '—'}, план ${c.planSales || '—'}`).join('\n')}

По дням:
${(daily || []).map(d => `${d.day}: ${d.sales ?? 0} продаж`).join(', ')}

${prevMetrics ? `ПРОШЛАЯ НЕДЕЛЯ:
Продажи: ${prevMetrics.totalSales || 0}
Каналы: ${(prevChannels || []).map(c => `${c.name}: ${c.sales}`).join(', ')}` : 'Данных за прошлую неделю нет.'}

ЗАДАНИЕ:
Верни JSON (без markdown, без backticks) в формате:
{"improved":["пункт 1","пункт 2","пункт 3"],"worsened":["пункт 1","пункт 2","пункт 3"],"insights":"2-3 предложения с ключевыми инсайтами"}

Правила:
- 3-5 пунктов в каждом списке
- Каждый пункт: конкретная метрика + цифра + изменение (напр. "Meta CPO снизился с $380 до $360 (-5%)")
- Фокус на unit economics и канальной эффективности
- Язык: русский
- Только JSON, никакого текста вокруг`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Parse JSON from response
    const clean = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
