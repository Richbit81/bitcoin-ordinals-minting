/**
 * Verify user-provided PINK Pass inscription IDs against parent template.
 */
import fs from 'fs';

const PARENT =
  'e48573379be883ad592ad442633e58e1e8ff3ed3c4b6bbbc6e497f547e793cf0i0';
const PARENT_LC = PARENT.toLowerCase();
const ORD = 'https://ordinals.com/content';

const USER_IDS = `
3a2ea2ca840b2dde11390e30871bb30a30656032da68eceb472c74f85aae590ci0
fb3b24c37e12d00af11e72e9b1813be7412bfe639692809ce7e6fac9abfb1457i0
970dece7a43451e951a85b53dcefb37f272422e0a4ec282edce61eda66f65ff9i0
bdfc27ecbf202d16df21833f5c74677c35af965a36b7a5ab5ca4cc2745ff5712i0
5c9542e33cf01ed3463839abd2de649c197157220c520f34199535290bc4d64fi0
c239e63045d5c7491fdb97ab9ec27efae1d0c7379b494ce89cdfe1330614eca3i0
9cc92efbb9275fb5faa703321710203f2ae0dd1b64cab303a1ee5edb41bd4ddci0
e7dff262ab105943acff0f825f5809425be26fcddb8415679171612317d1b44bi0
9950975437c01cd6543f030e26479cb3e034e8336ed1b1f83d0e4df286cc5f88i0
1aaaa03616b5fee07e392ac480f8f79bc67406df3c65569c0a8e2722ed3abf20i0
b75e59accbd2f97b897b4c8d56a81a8c785da45ae8b9002de7932a51eb4554c2i0
f98318b00dceb1754d932df17cc544c5f3202bb3617f490cc1a00ebccfa4c948i0
d2911a3881b4bd78773d687feef36b8b8be462bf31dd3ce9c6e4d794475c5955i0
d86ab35204edfe3b624e5265b947ad0cbd9793d7a149ccc9b6e05c9a9721a946i0
`
  .trim()
  .split(/\s+/)
  .filter(Boolean);

async function verify(id) {
  const res = await fetch(`${ORD}/${id}`, {
    signal: AbortSignal.timeout(35000),
  });
  const html = res.ok ? await res.text() : '';
  const meta = html.match(/"originalInscriptionId":"([a-f0-9]{64}i\d)"/i);
  const metaParent = meta ? meta[1].toLowerCase() : null;
  const direct = html.toLowerCase().includes(PARENT_LC);
  const ok = direct && metaParent === PARENT_LC;
  const nameMatch = html.match(/"name":"([^"]+)"/);
  return {
    inscriptionId: id,
    verified: ok,
    displayName: nameMatch ? nameMatch[1] : null,
    metaParent,
    ordinalsUrl: `https://ordinals.com/inscription/${id}`,
  };
}

async function main() {
  const entries = [];
  const failed = [];

  for (const id of USER_IDS) {
    const row = await verify(id);
    if (row.verified) entries.push(row);
    else failed.push(row);
    process.stdout.write(row.verified ? '  ok ' : '  ?? ');
    process.stdout.write(`${id.slice(0, 18)}…\n`);
    await new Promise((r) => setTimeout(r, 70));
  }

  entries.sort((a, b) => a.inscriptionId.localeCompare(b.inscriptionId));

  const outPath = new URL('../public/data/pink-pass-minted-list.json', import.meta.url);
  const payload = {
    parentInscriptionId: PARENT,
    source: 'user-curated',
    verifiedAt: new Date().toISOString(),
    count: entries.length,
    cap: 15,
    remaining: Math.max(0, 15 - entries.length),
    inscriptionIds: entries.map((e) => e.inscriptionId),
    entries,
    failedVerification: failed,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log('\n---');
  console.log(`Input: ${USER_IDS.length} | Verified PINK Pass delegates: ${entries.length}`);
  if (failed.length) {
    console.log(`Failed verification: ${failed.length}`);
    for (const f of failed) console.log(' ', f.inscriptionId, f.metaParent);
  }
  console.log(`Written: ${outPath.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
