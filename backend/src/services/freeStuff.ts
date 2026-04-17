import fs from 'fs/promises';
import path from 'path';
import { FreeStuffData, FreeStuffLogEntry } from '../types/freeStuff';

const configuredDataPath = String(process.env.FREE_STUFF_DATA_PATH || '').trim();
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
    '[FreeStuff] No persistent storage configured in production. Set DATABASE_URL (preferred) or FREE_STUFF_DATA_PATH.'
  );
}

const DATA_DIR = persistentStorageConfigured
  ? path.resolve(configuredDataPath)
  : path.join(process.cwd(), 'data', 'free-stuff');

const dataFile = () => path.join(DATA_DIR, 'free-stuff-data.json');

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
    CREATE TABLE IF NOT EXISTS free_stuff_state (
      id SMALLINT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `INSERT INTO free_stuff_state (id, payload)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify({ logs: [] })]
  );
  schemaEnsured = true;
};

const ensureDir = async () => {
  try { await fs.access(DATA_DIR); } catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
};

const readData = async (): Promise<FreeStuffData> => {
  if (postgresConfigured) {
    await ensurePostgresSchema();
    const pool = getPgPool();
    const result = await pool.query(`SELECT payload FROM free_stuff_state WHERE id = 1 LIMIT 1`);
    const parsed = (result.rows?.[0]?.payload || {}) as Partial<FreeStuffData>;
    return { logs: Array.isArray(parsed.logs) ? parsed.logs : [] };
  }

  await ensureDir();
  try {
    const raw = await fs.readFile(dataFile(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FreeStuffData>;
    return { logs: Array.isArray(parsed.logs) ? parsed.logs : [] };
  } catch {
    return { logs: [] };
  }
};

const writeData = async (data: FreeStuffData): Promise<void> => {
  if (postgresConfigured) {
    await ensurePostgresSchema();
    const pool = getPgPool();
    await pool.query(
      `UPDATE free_stuff_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1`,
      [JSON.stringify(data)]
    );
    return;
  }

  await ensureDir();
  await fs.writeFile(dataFile(), JSON.stringify(data, null, 2));
};

const normalizeEntry = (entry: any): FreeStuffLogEntry => ({
  id: String(entry?.id || `free-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  walletAddress: String(entry?.walletAddress || ''),
  itemName: String(entry?.itemName || ''),
  inscriptionId: String(entry?.inscriptionId || ''),
  originalInscriptionId: entry?.originalInscriptionId ? String(entry.originalInscriptionId) : undefined,
  txid: entry?.txid ? String(entry.txid) : undefined,
  priceInSats: typeof entry?.priceInSats === 'number' ? entry.priceInSats : Number(entry?.priceInSats || 0),
  timestamp: entry?.timestamp ?? new Date().toISOString(),
});

export const addFreeStuffLog = async (entry: FreeStuffLogEntry): Promise<void> => {
  const data = await readData();
  data.logs.push(normalizeEntry(entry));
  data.logs = data.logs.slice(-10000);
  await writeData(data);
};

export const getFreeStuffLogs = async (): Promise<FreeStuffLogEntry[]> => {
  return (await readData()).logs;
};

export const getRecentFreeStuffLogs = async (limit = 10): Promise<FreeStuffLogEntry[]> => {
  const logs = (await readData()).logs;
  return logs.slice(-limit).reverse();
};

export const getFreeStuffMintCount = async (): Promise<number> => {
  return (await readData()).logs.length;
};

export const getFreeStuffStorageInfo = () => ({
  mode: postgresConfigured ? 'postgres' : 'file',
  postgresConfigured,
  dataDir: DATA_DIR,
  dataFile: dataFile(),
  persistentStorageConfigured,
});
