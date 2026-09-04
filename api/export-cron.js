export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const baseUrl = `https://${process.env.VERCEL_URL}`;
  const r = await fetch(`${baseUrl}/api/export-tactical`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const data = await r.json();
  return res.json(data);
}
