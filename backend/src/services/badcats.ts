import fs from 'fs/promises';
import path from 'path';
import { BadCatsData, BadCatsLogEntry, BadCatsWhitelistEntry } from '../types/badcats';

const configuredDataPath = String(process.env.BADCATS_DATA_PATH || '').trim();
const postgresUrl = String(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL ||
  ''
).trim();
const postgresConfigured = postgresUrl.length > 0;
const persistentStorageConfigured = configuredDataPath.length > 0;

if (process.env.NODE_ENV === 'production' && !persistentStorageConfigured && !postgresConfigured) {
  console.warn(
    '[BadCats] No persistent storage configured in production. Set DATABASE_URL (preferred) or BADCATS_DATA_PATH.'
  );
}

if (!postgresConfigured && !persistentStorageConfigured && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[BadCats] BADCATS_DATA_PATH not set. Using local data folder (non-persistent on redeploy).'
  );
}

const DATA_DIR = persistentStorageConfigured
  ? path.resolve(configuredDataPath)
  : path.join(process.cwd(), 'data', 'badcats');

const dataFile = () => path.join(DATA_DIR, 'badcats-data.json');

let pgPool: any = null;
let schemaEnsured = false;

const getPgPool = () => {
  if (!postgresConfigured) return null;
  if (pgPool) return pgPool;
  const requireFn = eval('require');
  const { Pool } = requireFn('pg');
  pgPool = new Pool({
    connectionString: postgresUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });
  return pgPool;
};

const ensurePostgresSchema = async () => {
  if (!postgresConfigured || schemaEnsured) return;
  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS badcats_state (
      id SMALLINT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `INSERT INTO badcats_state (id, payload)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify({ logs: [], hashlist: [], whitelistAddresses: [], freeMintUsed: {} })]
  );
  schemaEnsured = true;
};

export const getBadCatsStorageInfo = () => ({
  mode: postgresConfigured ? 'postgres' : 'file',
  postgresConfigured,
  dataDir: DATA_DIR,
  dataFile: dataFile(),
  persistentStorageConfigured,
});

const ensureDir = async () => {
  try { await fs.access(DATA_DIR); } catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
};

const normalizeWhitelistEntries = (input: unknown): BadCatsWhitelistEntry[] => {
  const bucket = new Map<string, BadCatsWhitelistEntry>();
  const add = (addressRaw: string, countRaw: number) => {
    const address = String(addressRaw || '').trim();
    if (!address) return;
    const key = address.toLowerCase();
    const nextCount = Math.max(1, Math.floor(Number(countRaw) || 1));
    const prev = bucket.get(key);
    if (prev) {
      prev.count += nextCount;
      return;
    }
    bucket.set(key, { address, count: nextCount });
  };

  if (Array.isArray(input)) {
    for (const entry of input) {
      if (typeof entry === 'string') {
        add(entry, 1);
      } else if (entry && typeof entry === 'object') {
        const obj = entry as { address?: unknown; count?: unknown };
        add(String(obj.address || ''), Number(obj.count || 1));
      }
    }
  } else if (input && typeof input === 'object') {
    // Support legacy map format: { "<address>": <count> }
    for (const [address, count] of Object.entries(input as Record<string, unknown>)) {
      add(address, Number(count || 1));
    }
  }

  return [...bucket.values()];
};

const readData = async (): Promise<BadCatsData> => {
  if (postgresConfigured) {
    await ensurePostgresSchema();
    const pool = getPgPool();
    const result = await pool.query(`SELECT payload FROM badcats_state WHERE id = 1 LIMIT 1`);
    const parsed = (result.rows?.[0]?.payload || {}) as Partial<BadCatsData> & { whitelistAddresses?: unknown };
    return {
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      hashlist: Array.isArray(parsed.hashlist) ? parsed.hashlist : [],
      whitelistAddresses: normalizeWhitelistEntries(parsed.whitelistAddresses),
      freeMintUsed: parsed.freeMintUsed && typeof parsed.freeMintUsed === 'object' ? parsed.freeMintUsed : {},
    };
  }

  await ensureDir();
  try {
    const raw = await fs.readFile(dataFile(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BadCatsData> & { whitelistAddresses?: unknown };
    return {
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      hashlist: Array.isArray(parsed.hashlist) ? parsed.hashlist : [],
      whitelistAddresses: normalizeWhitelistEntries(parsed.whitelistAddresses),
      freeMintUsed: parsed.freeMintUsed && typeof parsed.freeMintUsed === 'object' ? parsed.freeMintUsed : {},
    };
  } catch {
    return { logs: [], hashlist: [], whitelistAddresses: [], freeMintUsed: {} };
  }
};

const writeData = async (data: BadCatsData): Promise<void> => {
  if (postgresConfigured) {
    await ensurePostgresSchema();
    const pool = getPgPool();
    await pool.query(
      `UPDATE badcats_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1`,
      [JSON.stringify(data)]
    );
    return;
  }

  await ensureDir();
  await fs.writeFile(dataFile(), JSON.stringify(data, null, 2));
};

// ── Logs ──

export const addLog = async (entry: BadCatsLogEntry): Promise<void> => {
  const data = await readData();
  data.logs.push(entry);
  data.logs = data.logs.slice(-10000);
  await writeData(data);
};

export const getLogs = async (): Promise<BadCatsLogEntry[]> => {
  return (await readData()).logs;
};

export const getRecentLogs = async (limit = 20): Promise<BadCatsLogEntry[]> => {
  const logs = (await readData()).logs;
  return logs.slice(-limit).reverse();
};

export const getLogsByAddress = async (address: string): Promise<BadCatsLogEntry[]> => {
  const logs = (await readData()).logs;
  return logs.filter(l => l.walletAddress.toLowerCase() === address.toLowerCase());
};

// ── Count & Minted Indices ──

export const getMintCount = async (): Promise<number> => {
  return (await readData()).logs.length;
};

export const getMintedIndices = async (): Promise<number[]> => {
  const logs = (await readData()).logs;
  return [...new Set(logs.map(l => l.itemIndex))];
};

// ── Hashlist ──

export const getHashlist = async (): Promise<string[]> => {
  return (await readData()).hashlist;
};

export const addToHashlist = async (inscriptionIds: string[]): Promise<void> => {
  const data = await readData();
  const existing = new Set(data.hashlist);
  for (const id of inscriptionIds) {
    if (!existing.has(id)) {
      data.hashlist.push(id);
      existing.add(id);
    }
  }
  await writeData(data);
};

export const syncHashlistFromLogs = async (): Promise<number> => {
  const data = await readData();
  const existing = new Set(data.hashlist);
  let added = 0;
  for (const log of data.logs) {
    if (log.inscriptionId && !existing.has(log.inscriptionId)) {
      data.hashlist.push(log.inscriptionId);
      existing.add(log.inscriptionId);
      added++;
    }
  }
  if (added > 0) await writeData(data);
  return added;
};

// ── Whitelist Addresses ──

export const getWhitelistEntries = async (): Promise<BadCatsWhitelistEntry[]> => {
  return (await readData()).whitelistAddresses;
};

export const getWhitelistAddresses = async (): Promise<string[]> => {
  const entries = await getWhitelistEntries();
  const expanded: string[] = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.count; i++) expanded.push(entry.address);
  }
  return expanded;
};

export const getWhitelistMintAllowance = async (address: string): Promise<number> => {
  const entries = await getWhitelistEntries();
  const found = entries.find(entry => entry.address.toLowerCase() === address.toLowerCase());
  return found?.count || 0;
};

export const addWhitelistAddress = async (address: string, count = 1): Promise<number> => {
  const data = await readData();
  const trimmed = String(address || '').trim();
  const lower = trimmed.toLowerCase();
  const addCount = Math.max(1, Math.floor(Number(count) || 1));
  const existing = data.whitelistAddresses.find(a => a.address.toLowerCase() === lower);
  if (existing) {
    existing.count += addCount;
    await writeData(data);
    return existing.count;
  }
  data.whitelistAddresses.push({ address: trimmed, count: addCount });
  await writeData(data);
  return addCount;
};

export const setWhitelistAddressCount = async (address: string, count: number): Promise<number> => {
  const data = await readData();
  const trimmed = String(address || '').trim();
  const lower = trimmed.toLowerCase();
  const nextCount = Math.max(1, Math.floor(Number(count) || 1));
  const existing = data.whitelistAddresses.find(a => a.address.toLowerCase() === lower);
  if (existing) {
    existing.count = nextCount;
  } else {
    data.whitelistAddresses.push({ address: trimmed, count: nextCount });
  }
  await writeData(data);
  return nextCount;
};

export const removeWhitelistAddress = async (address: string): Promise<boolean> => {
  const data = await readData();
  const lower = address.toLowerCase();
  const idx = data.whitelistAddresses.findIndex(a => a.address.toLowerCase() === lower);
  if (idx === -1) return false;
  data.whitelistAddresses.splice(idx, 1);
  await writeData(data);
  return true;
};

// ── Free Mint Tracking ──

export const getFreeMintUsed = async (address: string): Promise<number> => {
  const data = await readData();
  return data.freeMintUsed[address.toLowerCase()] || 0;
};

export const recordFreeMintUsed = async (address: string): Promise<number> => {
  const data = await readData();
  const key = address.toLowerCase();
  data.freeMintUsed[key] = (data.freeMintUsed[key] || 0) + 1;
  await writeData(data);
  return data.freeMintUsed[key];
};
