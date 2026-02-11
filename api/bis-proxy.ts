import type { VercelRequest, VercelResponse } from '@vercel/node';

const BIS_BASE = 'https://api.bestinslot.xyz/v3/collection';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, slug, offset, count, sort_by, order } = req.query;
  const apiKey = process.env.VITE_BIS_API_KEY || process.env.BIS_API_KEY;

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing endpoint (collections|holders)' });
  }

  const path = endpoint === 'holders' ? 'holders' : 'collections';
  const params = new URLSearchParams();
  if (slug && typeof slug === 'string') params.set('slug', slug);
  if (offset && typeof offset === 'string') params.set('offset', offset);
  if (count && typeof count === 'string') params.set('count', count);
  if (sort_by && typeof sort_by === 'string') params.set('sort_by', sort_by);
  if (order && typeof order === 'string') params.set('order', order);

  const url = `${BIS_BASE}/${path}?${params.toString()}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    const r = await fetch(url, { headers });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Proxy error' });
  }
}
