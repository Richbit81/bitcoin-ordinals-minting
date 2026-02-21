import fs from 'fs/promises';
import path from 'path';
import { BadCatsData, BadCatsLogEntry } from '../types/badcats';

const DATA_DIR = process.env.BADCATS_DATA_PATH
  ? path.resolve(process.env.BADCATS_DATA_PATH)
  : path.join(process.cwd(), 'data', 'badcats');

const dataFile = () => path.join(DATA_DIR, 'badcats-data.json');

const ensureDir = async () => {
  try { await fs.access(DATA_DIR); } catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
};

const readData = async (): Promise<BadCatsData> => {
  await ensureDir();
  try {
    const raw = await fs.readFile(dataFile(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { logs: [], hashlist: [], whitelistAddresses: [], freeMintUsed: {} };
  }
};

const writeData = async (data: BadCatsData): Promise<void> => {
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

export const getWhitelistAddresses = async (): Promise<string[]> => {
  return (await readData()).whitelistAddresses;
};

export const addWhitelistAddress = async (address: string): Promise<boolean> => {
  const data = await readData();
  const lower = address.toLowerCase();
  if (data.whitelistAddresses.some(a => a.toLowerCase() === lower)) return false;
  data.whitelistAddresses.push(address);
  await writeData(data);
  return true;
};

export const removeWhitelistAddress = async (address: string): Promise<boolean> => {
  const data = await readData();
  const lower = address.toLowerCase();
  const idx = data.whitelistAddresses.findIndex(a => a.toLowerCase() === lower);
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
