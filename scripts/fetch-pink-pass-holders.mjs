import fs from 'fs';

const ids = JSON.parse(
  fs.readFileSync(
    new URL('../public/data/pink-pass-minted-list.json', import.meta.url),
    'utf8'
  )
).inscriptionIds;

async function holder(id) {
  const res = await fetch(`https://ordinals.com/inscription/${id}`, {
    signal: AbortSignal.timeout(30000),
  });
  const html = await res.text();
  const m = html.match(/href=\/address\/(bc1p[a-z0-9]+)/i);
  return m ? m[1] : null;
}

const rows = [];
for (const id of ids) {
  const w = await holder(id);
  rows.push({ id, wallet: w });
  console.log(id.slice(0, 16), w || '???');
  await new Promise((r) => setTimeout(r, 100));
}
const wallets = [...new Set(rows.map((r) => r.wallet).filter(Boolean))];
console.log('\nunique wallets', wallets.length);
console.log(JSON.stringify(wallets, null, 2));
