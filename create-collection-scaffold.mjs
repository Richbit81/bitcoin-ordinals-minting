import fs from 'fs/promises';
import path from 'path';
import process from 'process';

const cwd = process.cwd();

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = value;
  }
  return out;
}

function toPascalCase(input) {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(input) {
  return input
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function toSnakeCase(input) {
  return toKebabCase(input).replace(/-/g, '_');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseMaxOrder(staticProjectsBlock) {
  const matches = [...staticProjectsBlock.matchAll(/order:\s*(\d+)/g)];
  if (matches.length === 0) return 10;
  return Math.max(...matches.map((m) => Number(m[1]) || 0));
}

async function updateAppTsx({ appPath, pageComponentName, pageFileName, routePath }) {
  let app = await readText(appPath);

  const importLine = `import { ${pageComponentName} } from './pages/${pageFileName}';`;
  if (!app.includes(importLine)) {
    const anchor = "import { AvifConverterPage } from './pages/AvifConverterPage';";
    if (!app.includes(anchor)) {
      throw new Error(`App.tsx anchor import not found: ${anchor}`);
    }
    app = app.replace(anchor, `${importLine}\n${anchor}`);
  }

  const routeLine = `        <Route path="${routePath}" element={<${pageComponentName} />} />`;
  if (!app.includes(routeLine)) {
    const wildcardAnchor = '        <Route path="*" element={<Navigate to="/" replace />} />';
    if (!app.includes(wildcardAnchor)) {
      throw new Error('Could not find wildcard route anchor in App.tsx');
    }
    app = app.replace(wildcardAnchor, `${routeLine}\n${wildcardAnchor}`);
  }

  await writeText(appPath, app);
}

async function updateHomePage({ homePath, id, name, thumbnail, description }) {
  let home = await readText(homePath);
  if (home.includes(`id: '${id}'`)) return;

  const staticStart = '  const staticProjects = [';
  const staticEnd = '  ];';
  const startIdx = home.indexOf(staticStart);
  if (startIdx === -1) throw new Error('Could not find staticProjects start in HomePage.tsx');
  const endIdx = home.indexOf(staticEnd, startIdx);
  if (endIdx === -1) throw new Error('Could not find staticProjects end in HomePage.tsx');

  const block = home.slice(startIdx, endIdx + staticEnd.length);
  const nextOrder = parseMaxOrder(block) + 1;
  const insertObject = `    {
      id: '${id}',
      name: '${name.replace(/'/g, "\\'")}',
      thumbnail: '${thumbnail.replace(/'/g, "\\'")}',
      description: '${description.replace(/'/g, "\\'")}',
      order: ${nextOrder},
    },
`;

  const updatedBlock = block.replace(staticEnd, `${insertObject}${staticEnd}`);
  home = home.replace(block, updatedBlock);
  await writeText(homePath, home);
}

function buildPageTemplate({ pageComponentName, serviceName, displayName, collectionId, routePath, priceSats }) {
  return `import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { mint${serviceName}Random } from '../services/${collectionId}MintService';

export const ${pageComponentName}: React.FC = () => {
  const { walletState } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleMint = async () => {
    if (!walletState.connected || !walletState.accounts?.[0]?.address) {
      setMessage('Connect wallet first.');
      return;
    }
    try {
      setIsMinting(true);
      setMessage('Minting...');
      const result = await mint${serviceName}Random(walletState.accounts[0].address, walletState.walletType || 'unisat');
      setMessage(\`Mint success: \${result.inscriptionId}\`);
    } catch (error: any) {
      setMessage(error?.message || 'Mint failed');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto border border-white/20 rounded-xl p-6 bg-zinc-900/60">
        <h1 className="text-2xl font-bold mb-2">${displayName}</h1>
        <p className="text-sm text-gray-300 mb-4">
          Scaffold page for \`${collectionId}\` at route \`${routePath}\`.
        </p>
        <p className="text-sm text-gray-400 mb-6">Price: ${priceSats} sats</p>
        <button
          onClick={handleMint}
          disabled={isMinting}
          className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold disabled:opacity-60"
        >
          {isMinting ? 'MINTING...' : 'MINT RANDOM'}
        </button>
        {message && <p className="mt-4 text-sm font-mono break-all">{message}</p>}
      </div>
    </div>
  );
};
`;
}

function buildServiceTemplate({ serviceName, collectionId, displayName }) {
  return `import { createUnisatInscription } from './unisatService';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
const COLLECTION_PATH = '${collectionId}';

export interface ${serviceName}GeneratedItem {
  index: number;
  svg: string;
  layers?: Array<{ traitType: string; trait: { name: string; inscriptionId: string } }>;
}

interface ${serviceName}Collection {
  generated: ${serviceName}GeneratedItem[];
}

async function load${serviceName}Collection(): Promise<${serviceName}Collection | null> {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(\`\${base}data/${collectionId}-collection.json?v=\${Date.now()}\`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function mint${serviceName}Random(
  userAddress: string,
  walletType: string
): Promise<{ inscriptionId: string; txid?: string; orderId?: string; paymentTxid?: string; item: ${serviceName}GeneratedItem }> {
  if (!userAddress) throw new Error('Missing user address');

  const [collection, mintedIndicesRes] = await Promise.all([
    load${serviceName}Collection(),
    fetch(\`\${API_URL}/api/\${COLLECTION_PATH}/minted-indices\`),
  ]);

  if (!collection?.generated?.length) throw new Error('${displayName} collection could not be loaded');
  const mintedIndices = mintedIndicesRes.ok ? ((await mintedIndicesRes.json()).mintedIndices || []) : [];
  const available = collection.generated.filter(item => !mintedIndices.includes(item.index));
  if (available.length === 0) throw new Error('${displayName} sold out');

  const item = available[Math.floor(Math.random() * available.length)];
  const file = new File([item.svg], \`\${COLLECTION_PATH}-\${item.index}.svg\`, { type: 'image/svg+xml' });

  const result = await createUnisatInscription({
    file,
    address: userAddress,
    feeRate: 15,
  });

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    orderId: result.orderId,
    paymentTxid: result.txid || undefined,
    item,
  };
}
`;
}

function buildCollectionJsonTemplate({ displayName }) {
  return `{
  "collectionName": "${displayName}",
  "viewBox": "0 0 1000 1000",
  "totalCount": 0,
  "generated": []
}
`;
}

function buildBackendSnippet({ id, displayName, priceSats }) {
  const upper = id.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `// ==================== ${displayName} (${id}) SCAFFOLD ====================
// 1) Add these constants near other collection constants:
// const ${upper}_LOG_FILE = path.join(__dirname, 'data', '${id}-logs.json');
//
// 2) Create load/save helpers like slums/smile/badcats and use:
// - loadLogsFromDB('${id}')
// - saveLogToDB('${id}', entry)
//
// 3) Register endpoints:
// POST /api/${id}/log
// GET  /api/${id}/logs
// POST /api/${id}/logs/sync-pending
// GET  /api/${id}/count
// GET  /api/${id}/minted-indices
// GET  /api/${id}/address-mints
// POST /api/${id}/hashlist
// GET  /api/${id}/hashlist
// POST /api/${id}/hashlist/sync
// GET  /api/${id}/recent
//
// 4) For pending->final sync call:
// syncSimplePendingLogs({ logType: '${id}', loadFn: load${toPascalCase(id)}Logs, jsonFilePath: ${upper}_LOG_FILE, limit: 100 })
//
// 5) In hashlist sync, include stale pending cleanup:
// - delete pending hashlist IDs not present in logs
//
// Price default for this collection: ${priceSats} sats
`;
}

function buildBackendAutoBlock({ id, displayName, priceSats }) {
  const pascal = toPascalCase(id);
  const snake = toSnakeCase(id);
  const upper = snake.toUpperCase();
  const tableName = `${snake}_hashlist`;

  return `  // AUTO-SCAFFOLD COLLECTION: ${id} (BEGIN)
  const ${upper}_LOG_FILE = path.join(__dirname, 'data', '${id}-logs.json');
  const ${upper}_PRICE_SATS = ${priceSats};

  function load${pascal}LogsJSON() {
    try {
      if (fs.existsSync(${upper}_LOG_FILE)) return JSON.parse(fs.readFileSync(${upper}_LOG_FILE, 'utf8'));
    } catch (error) {
      console.error('[${displayName}] Error loading logs:', error);
    }
    return { logs: [], totalMints: 0 };
  }

  async function load${pascal}Logs() {
    const dbData = await loadLogsFromDB('${id}');
    if (dbData) return dbData;
    return load${pascal}LogsJSON();
  }

  async function save${pascal}Log(logEntry) {
    await saveLogToDB('${id}', logEntry);
    try {
      const data = load${pascal}LogsJSON();
      data.logs = data.logs || [];
      data.logs.push(logEntry);
      data.totalMints = data.logs.length;
      fs.writeFileSync(${upper}_LOG_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[${displayName}] Error saving JSON log:', error);
    }
  }

  async function ensure${pascal}HashlistTable() {
    if (!isDatabaseAvailable()) return;
    const pool = getPool();
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        inscription_id VARCHAR(255) UNIQUE NOT NULL,
        item_index INTEGER,
        name VARCHAR(255),
        attributes JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    \`);
  }

  app.post('/api/${id}/log', async (req, res) => {
    try {
      const { walletAddress, inscriptionId, txid, itemName, itemIndex, priceInSats, paymentTxid, orderId, originalOrderId } = req.body || {};
      if (!walletAddress || !inscriptionId) return res.status(400).json({ error: 'walletAddress and inscriptionId required' });
      const logEntry = {
        id: '${id}-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11),
        walletAddress,
        inscriptionId,
        txid: txid || null,
        itemName: itemName || '${displayName} #' + (itemIndex || '?'),
        itemIndex: itemIndex || null,
        packId: '${id}',
        packName: '${displayName}',
        priceInSats: priceInSats || ${upper}_PRICE_SATS,
        paymentTxid: paymentTxid || null,
        orderId: orderId || null,
        originalOrderId: originalOrderId || null,
        timestamp: new Date().toISOString(),
      };
      await save${pascal}Log(logEntry);
      res.json({ success: true, mintId: logEntry.id });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  app.get('/api/${id}/logs', async (req, res) => {
    try {
      const { adminAddress } = req.query;
      if (!isAdmin(adminAddress)) return res.status(403).json({ error: 'Not authorized' });
      if (req.query.sync === '1' && typeof syncSimplePendingLogs === 'function') {
        syncSimplePendingLogs({
          logType: '${id}',
          loadFn: load${pascal}Logs,
          jsonFilePath: ${upper}_LOG_FILE,
          limit: 150,
        }).catch((err) => console.warn('[${id}] Background sync failed:', err.message));
      }
      const data = await load${pascal}Logs();
      res.json({ logs: data.logs || [], totalMints: data.totalMints || (data.logs || []).length });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  app.post('/api/${id}/logs/sync-pending', async (req, res) => {
    try {
      const { adminAddress } = req.body || {};
      if (!isAdmin(adminAddress)) return res.status(403).json({ error: 'Not authorized' });
      if (typeof syncSimplePendingLogs !== 'function') return res.status(503).json({ error: 'Pending sync not initialized yet' });
      const limit = Math.max(1, Math.min(500, Number(req.body?.limit || 100)));
      const result = await syncSimplePendingLogs({
        logType: '${id}',
        loadFn: load${pascal}Logs,
        jsonFilePath: ${upper}_LOG_FILE,
        limit,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Sync failed' });
    }
  });

  app.get('/api/${id}/count', async (req, res) => {
    try {
      const data = await load${pascal}Logs();
      res.json({ totalMints: (data.logs || []).length });
    } catch {
      res.json({ totalMints: 0 });
    }
  });

  app.get('/api/${id}/minted-indices', async (req, res) => {
    try {
      const data = await load${pascal}Logs();
      const mintedIndices = (data.logs || [])
        .map(l => l.itemIndex ?? (l.itemName ? parseInt((String(l.itemName).match(/#(\\d+)/) || [])[1], 10) : null))
        .filter(v => Number.isInteger(v));
      res.json({ mintedIndices: [...new Set(mintedIndices)] });
    } catch {
      res.json({ mintedIndices: [] });
    }
  });

  app.get('/api/${id}/address-mints', async (req, res) => {
    try {
      const { address } = req.query;
      if (!address) return res.status(400).json({ error: 'address required' });
      const data = await load${pascal}Logs();
      const count = (data.logs || []).filter(l => String(l.walletAddress || '').toLowerCase() === String(address).toLowerCase()).length;
      res.json({ count });
    } catch {
      res.json({ count: 0 });
    }
  });

  app.post('/api/${id}/hashlist', async (req, res) => {
    try {
      const { inscriptionId, inscriptionIds, itemIndex, name, attributes } = req.body || {};
      const ids = inscriptionIds || (inscriptionId ? [inscriptionId] : []);
      if (!ids.length) return res.status(400).json({ error: 'inscriptionId(s) required' });
      if (!isDatabaseAvailable()) return res.status(500).json({ error: 'Database not available' });
      await ensure${pascal}HashlistTable();
      const pool = getPool();
      for (const oneId of ids) {
        await pool.query(
          \`INSERT INTO ${tableName} (inscription_id, item_index, name, attributes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (inscription_id) DO NOTHING\`,
          [oneId, itemIndex || null, name || '${displayName} #' + (itemIndex || '?'), JSON.stringify(attributes || [])]
        );
      }
      res.json({ success: true, added: ids.length });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Hashlist update failed' });
    }
  });

  app.get('/api/${id}/hashlist', async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.json([]);
      await ensure${pascal}HashlistTable();
      const pool = getPool();
      const result = await pool.query(\`SELECT inscription_id, item_index, name, attributes FROM ${tableName} ORDER BY created_at ASC\`);
      const hashlist = result.rows.map(row => ({
        id: row.inscription_id,
        meta: { name: row.name, attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes },
      }));
      res.json(hashlist);
    } catch {
      res.json([]);
    }
  });

  app.post('/api/${id}/hashlist/sync', async (req, res) => {
    try {
      if (!isDatabaseAvailable()) return res.status(500).json({ error: 'Database not available' });
      await ensure${pascal}HashlistTable();
      const pool = getPool();
      const data = await load${pascal}Logs();
      const logs = data.logs || [];
      let added = 0;
      for (const log of logs) {
        if (!log.inscriptionId) continue;
        const exists = await pool.query(\`SELECT 1 FROM ${tableName} WHERE inscription_id = $1\`, [log.inscriptionId]);
        if (exists.rows.length === 0) {
          await pool.query(\`INSERT INTO ${tableName} (inscription_id, item_index, name, attributes) VALUES ($1, $2, $3, $4)\`, [
            log.inscriptionId,
            log.itemIndex || null,
            log.itemName || '${displayName} #' + (log.itemIndex || '?'),
            '[]',
          ]);
          added++;
        }
      }
      const pendingFromLogs = new Set(logs.map(l => l.inscriptionId).filter(idValue => typeof idValue === 'string' && idValue.startsWith('pending-')));
      const pendingHashRows = await pool.query(\`SELECT inscription_id FROM ${tableName} WHERE inscription_id LIKE 'pending-%'\`);
      let cleanedPending = 0;
      for (const row of pendingHashRows.rows) {
        if (!pendingFromLogs.has(row.inscription_id)) {
          await pool.query(\`DELETE FROM ${tableName} WHERE inscription_id = $1\`, [row.inscription_id]);
          cleanedPending++;
        }
      }
      res.json({ success: true, added, cleanedPending });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Hashlist sync failed' });
    }
  });

  app.get('/api/${id}/recent', async (req, res) => {
    try {
      const data = await load${pascal}Logs();
      const recent = (data.logs || [])
        .filter(l => l.itemIndex || l.itemName)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
        .map(l => ({
          itemIndex: l.itemIndex,
          itemName: l.itemName || '${displayName} #' + (l.itemIndex || '?'),
          timestamp: l.timestamp,
          walletAddress: l.walletAddress ? l.walletAddress.slice(0, 8) + '...' + l.walletAddress.slice(-4) : null,
          inscriptionId: l.inscriptionId || null,
        }));
      res.json({ recent });
    } catch {
      res.json({ recent: [] });
    }
  });
  // AUTO-SCAFFOLD COLLECTION: ${id} (END)
`;
}

async function integrateBackendServer({ backendDir, id, displayName, priceSats }) {
  const serverPath = path.join(backendDir, 'server.js');
  if (!(await fileExists(serverPath))) return { integrated: false, reason: 'server.js not found' };
  let server = await readText(serverPath);

  const beginMarker = `// AUTO-SCAFFOLD COLLECTION: ${id} (BEGIN)`;
  if (server.includes(beginMarker)) return { integrated: false, reason: 'already integrated' };

  const anchor = '// ═══════════════════ END BADCATS ENDPOINTS ═══════════════════════════════';
  if (!server.includes(anchor)) {
    throw new Error(`Backend anchor not found in server.js: ${anchor}`);
  }

  const block = buildBackendAutoBlock({ id, displayName, priceSats });
  server = server.replace(anchor, `${block}\n  ${anchor}`);
  await writeText(serverPath, server);
  return { integrated: true, serverPath };
}

async function main() {
  const args = parseArgs(process.argv);
  const id = toKebabCase(args.id || '');
  const displayName = (args.name || '').trim();
  if (!id || !displayName) {
    console.error('Usage: node create-collection-scaffold.mjs --id <kebab-id> --name "<Display Name>" [--route /my-route] [--price 10000] [--supply 500] [--thumbnail /path.png] [--description "text"] [--backendDir <path>] [--integrateBackend true|false]');
    process.exit(1);
  }

  const routePath = args.route ? String(args.route).trim() : `/${id}`;
  const priceSats = Number(args.price || 10000);
  const supply = Number(args.supply || 500);
  const thumbnail = args.thumbnail ? String(args.thumbnail) : '/images/RichArt.png';
  const description = args.description ? String(args.description) : `${supply} Recursive Ordinals`;

  const serviceName = toPascalCase(id);
  const pageComponentName = `${serviceName}Page`;
  const pageFileName = `${serviceName}Page`;

  const pagePath = path.join(cwd, 'src', 'pages', `${pageFileName}.tsx`);
  const servicePath = path.join(cwd, 'src', 'services', `${id}MintService.ts`);
  const jsonPath = path.join(cwd, 'public', 'data', `${id}-collection.json`);
  const appPath = path.join(cwd, 'src', 'App.tsx');
  const homePath = path.join(cwd, 'src', 'pages', 'HomePage.tsx');

  if (!(await fileExists(pagePath))) {
    await writeText(
      pagePath,
      buildPageTemplate({ pageComponentName, serviceName, displayName, collectionId: id, routePath, priceSats })
    );
  }

  if (!(await fileExists(servicePath))) {
    await writeText(
      servicePath,
      buildServiceTemplate({ serviceName, collectionId: id, displayName })
    );
  }

  if (!(await fileExists(jsonPath))) {
    await writeText(jsonPath, buildCollectionJsonTemplate({ displayName }));
  }

  await updateAppTsx({ appPath, pageComponentName, pageFileName, routePath });
  await updateHomePage({ homePath, id, name: displayName, thumbnail, description });

  const backendDir = args.backendDir
    ? path.resolve(String(args.backendDir))
    : path.resolve(cwd, '..', 'bitcoin-ordinals-backend');
  const backendSnippetPath = path.join(backendDir, 'scripts', `scaffold-${id}-backend-snippet.js`);
  await writeText(backendSnippetPath, buildBackendSnippet({ id, displayName, priceSats }));
  const integrateBackend = String(args.integrateBackend || 'true').toLowerCase() !== 'false';
  const backendIntegration = integrateBackend
    ? await integrateBackendServer({ backendDir, id, displayName, priceSats })
    : { integrated: false, reason: 'disabled by flag' };

  console.log('✅ Collection scaffold created');
  console.log(`- Page: ${pagePath}`);
  console.log(`- Service: ${servicePath}`);
  console.log(`- Collection JSON: ${jsonPath}`);
  console.log(`- Route integrated: ${routePath}`);
  console.log(`- Home card integrated: ${id}`);
  console.log(`- Backend snippet: ${backendSnippetPath}`);
  if (backendIntegration.integrated) {
    console.log(`- Backend server integrated: ${backendIntegration.serverPath}`);
  } else {
    console.log(`- Backend server integration skipped: ${backendIntegration.reason}`);
  }
}

main().catch((err) => {
  console.error('❌ Scaffold failed:', err.message);
  process.exit(1);
});

