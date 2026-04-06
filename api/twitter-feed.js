const cache = { ids: [], ts: 0 };
const CACHE_TTL = 5 * 60 * 1000;

const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

async function fetchFromGuestApi(screenName) {
  const guestRes = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${BEARER}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!guestRes.ok) throw new Error(`guest activate ${guestRes.status}`);
  const { guest_token } = await guestRes.json();

  const userRes = await fetch(
    `https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${encodeURIComponent(screenName)}&count=10&exclude_replies=true&include_rts=false`,
    {
      headers: {
        'Authorization': `Bearer ${BEARER}`,
        'x-guest-token': guest_token,
      },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!userRes.ok) throw new Error(`timeline ${userRes.status}`);
  const tweets = await userRes.json();
  if (!Array.isArray(tweets) || !tweets.length) throw new Error('no tweets');
  return tweets.map((t) => t.id_str);
}

async function fetchFromSyndication(screenName) {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(screenName)}?showReplies=false`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
    },
  });
  if (!r.ok) throw new Error(`syndication ${r.status}`);
  const html = await r.text();
  const ids = new Set();
  const re = /\/status\/(\d{10,})/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

async function fetchFromRSSHub(screenName) {
  const r = await fetch(`https://rsshub.app/twitter/user/${encodeURIComponent(screenName)}`, {
    headers: { 'Accept': 'application/rss+xml,application/xml,text/xml' },
  });
  if (!r.ok) throw new Error(`rsshub ${r.status}`);
  const xml = await r.text();
  const ids = new Set();
  const re = /\/status\/(\d{10,})/g;
  let m;
  while ((m = re.exec(xml)) !== null) ids.add(m[1]);
  return [...ids];
}

async function fetchFromNitter(screenName) {
  const instances = [
    `https://xcancel.com/${screenName}/rss`,
    `https://nitter.privacydev.net/${screenName}/rss`,
    `https://nitter.poast.org/${screenName}/rss`,
    `https://nitter.cz/${screenName}/rss`,
  ];
  for (const url of instances) {
    try {
      const r = await fetch(url, {
        headers: { 'Accept': 'application/rss+xml,text/xml,*/*' },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const ids = new Set();
      const re = /\/status\/(\d{10,})/g;
      let m;
      while ((m = re.exec(xml)) !== null) ids.add(m[1]);
      if (ids.size) return [...ids];
    } catch { /* try next */ }
  }
  throw new Error('nitter all failed');
}

async function fetchFromXcancelHtml(screenName) {
  const r = await fetch(`https://xcancel.com/${encodeURIComponent(screenName)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`xcancel html ${r.status}`);
  const html = await r.text();
  const ids = new Set();
  const re = /\/status\/(\d{10,})/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  if (!ids.size) throw new Error('xcancel html no ids');
  return [...ids];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const screenName = req.query.user || 'PinkPuppets_';
  const limit = Math.min(parseInt(req.query.limit) || 5, 10);

  if (cache.ids.length && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ids: cache.ids.slice(0, limit), source: 'cache' });
  }

  const sources = [fetchFromGuestApi, fetchFromNitter, fetchFromXcancelHtml, fetchFromSyndication, fetchFromRSSHub];
  const errors = [];

  for (const fetcher of sources) {
    try {
      const ids = await fetcher(screenName);
      if (ids.length) {
        cache.ids = ids;
        cache.ts = Date.now();
        return res.status(200).json({ ids: ids.slice(0, limit), source: fetcher.name });
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  return res.status(200).json({ ids: [], errors, source: 'none' });
}
