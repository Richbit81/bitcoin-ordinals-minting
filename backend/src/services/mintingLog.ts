// Minting Log Service - Backend
// Speichert Minting-Logs in einer Datei oder Datenbank

import fs from 'fs/promises';
import path from 'path';
import { MintingLogEntry, MintingLogState, MintingResolutionAuditEntry } from '../types/mintingLog';

// MINTING_LOG_PATH env variable setzen für persistenten Speicher (z.B. /var/data/minting-logs.json)
// Ohne env variable: Standard-Pfad im Projekt-Ordner (wird bei Deploy gelöscht!)
const LOG_FILE_PATH = process.env.MINTING_LOG_PATH
  ? path.resolve(process.env.MINTING_LOG_PATH)
  : path.join(process.cwd(), 'data', 'minting-logs.json');

console.log(`[MintingLog] Log-Pfad: ${LOG_FILE_PATH} ${process.env.MINTING_LOG_PATH ? '(persistent via env)' : '(Standard - NICHT persistent!)'}`);

const ORDINAL_INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

const isPendingInscriptionId = (value: unknown): boolean => String(value || '').trim().startsWith('pending-');
const isFinalInscriptionId = (value: unknown): boolean => ORDINAL_INSCRIPTION_ID_RE.test(String(value || '').trim());
const normalizeInscriptionId = (value: unknown): string => String(value || '').trim();

const toState = (input: unknown): MintingLogState => {
  // Legacy compatibility: historical file format used a pure array.
  if (Array.isArray(input)) {
    return { logs: input as MintingLogEntry[], pendingToFinalMap: {}, resolutionAudit: [] };
  }
  if (!input || typeof input !== 'object') {
    return { logs: [], pendingToFinalMap: {}, resolutionAudit: [] };
  }
  const obj = input as Partial<MintingLogState>;
  return {
    logs: Array.isArray(obj.logs) ? obj.logs : [],
    pendingToFinalMap: obj.pendingToFinalMap && typeof obj.pendingToFinalMap === 'object' ? obj.pendingToFinalMap : {},
    resolutionAudit: Array.isArray(obj.resolutionAudit) ? obj.resolutionAudit : [],
  };
};

const readState = async (): Promise<MintingLogState> => {
  await ensureDataDirectory();
  try {
    const fileContent = await fs.readFile(LOG_FILE_PATH, 'utf-8');
    return toState(JSON.parse(fileContent));
  } catch {
    return { logs: [], pendingToFinalMap: {}, resolutionAudit: [] };
  }
};

const writeState = async (state: MintingLogState): Promise<void> => {
  await ensureDataDirectory();
  await fs.writeFile(LOG_FILE_PATH, JSON.stringify(state, null, 2));
};

const collectEntryMappings = (entry: MintingLogEntry): Record<string, string> => {
  const out: Record<string, string> = {};
  const add = (pendingRaw: unknown, finalRaw: unknown) => {
    const pending = normalizeInscriptionId(pendingRaw);
    const finalId = normalizeInscriptionId(finalRaw);
    if (!isPendingInscriptionId(pending) || !isFinalInscriptionId(finalId)) return;
    out[pending] = finalId;
  };

  // Explicit map from client/update jobs.
  if (entry.pendingResolvedMap && typeof entry.pendingResolvedMap === 'object') {
    for (const [pending, finalId] of Object.entries(entry.pendingResolvedMap)) add(pending, finalId);
  }

  // Final log entry with explicit original pending pointer.
  add(entry.originalPendingInscriptionId, entry.inscriptionId);
  add(entry.originalPendingInscriptionId, entry.originalInscriptionId);

  // Card-level inference.
  if (Array.isArray(entry.cards)) {
    for (const card of entry.cards as any[]) {
      add(card?.originalPendingInscriptionId, card?.inscriptionId);
      add(card?.originalInscriptionId, card?.inscriptionId);
    }
  }

  return out;
};

const patchLogWithMapping = (log: MintingLogEntry, pendingId: string, finalId: string, resolvedAtIso: string): MintingLogEntry => {
  let changed = false;
  const next: MintingLogEntry = { ...log };

  if (normalizeInscriptionId(next.inscriptionId) === pendingId) {
    next.originalPendingInscriptionId = next.originalPendingInscriptionId || pendingId;
    next.inscriptionId = finalId;
    next.resolvedAt = resolvedAtIso;
    changed = true;
  }

  if (Array.isArray(next.inscriptionIds) && next.inscriptionIds.length > 0) {
    const mapped = next.inscriptionIds.map((id) => {
      if (normalizeInscriptionId(id) === pendingId) {
        changed = true;
        return finalId;
      }
      return id;
    });
    next.inscriptionIds = mapped;
  }

  if (Array.isArray(next.cards) && next.cards.length > 0) {
    next.cards = (next.cards as any[]).map((card) => {
      const cardId = normalizeInscriptionId(card?.inscriptionId);
      if (cardId !== pendingId) return card;
      changed = true;
      return {
        ...card,
        inscriptionId: finalId,
        originalPendingInscriptionId: card?.originalPendingInscriptionId || pendingId,
      };
    });
  }

  if (changed && !next.resolvedAt) next.resolvedAt = resolvedAtIso;
  return next;
};


// Stelle sicher, dass das data-Verzeichnis existiert
const ensureDataDirectory = async () => {
  const dataDir = path.dirname(LOG_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

/**
 * Speichert einen Minting-Log-Eintrag
 */
export const saveMintingLog = async (entry: MintingLogEntry): Promise<void> => {
  const state = await readState();
  const nowIso = new Date().toISOString();
  const normalizedEntry: MintingLogEntry = {
    ...entry,
    id: String(entry?.id || `mint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    timestamp: Number(entry?.timestamp || Date.now()),
    pendingResolvedMap: entry?.pendingResolvedMap || {},
  };

  // Merge/replace existing log with same id to avoid duplicates.
  const existingIndex = state.logs.findIndex((log) => String(log?.id || '') === normalizedEntry.id);
  if (existingIndex >= 0) state.logs[existingIndex] = { ...state.logs[existingIndex], ...normalizedEntry };
  else state.logs.push(normalizedEntry);

  // Derive and persist pending -> final mappings.
  const derivedMappings = collectEntryMappings(normalizedEntry);
  for (const [pendingId, finalId] of Object.entries(derivedMappings)) {
    const previous = state.pendingToFinalMap[pendingId];
    state.pendingToFinalMap[pendingId] = finalId;
    // Only append audit row when mapping changed/new.
    if (previous !== finalId) {
      const auditRow: MintingResolutionAuditEntry = {
        pendingInscriptionId: pendingId,
        finalInscriptionId: finalId,
        walletAddress: normalizedEntry.walletAddress,
        orderId: normalizedEntry.orderId,
        sourceLogId: normalizedEntry.id,
        resolvedAt: nowIso,
      };
      state.resolutionAudit.push(auditRow);
    }
    state.logs = state.logs.map((log) => patchLogWithMapping(log, pendingId, finalId, nowIso));
  }

  // Auto-map based on orderId pattern if final id is known.
  if (normalizedEntry.orderId && isFinalInscriptionId(normalizedEntry.inscriptionId)) {
    const derivedPending = `pending-${String(normalizedEntry.orderId).trim()}-0`;
    const finalId = normalizeInscriptionId(normalizedEntry.inscriptionId);
    const previous = state.pendingToFinalMap[derivedPending];
    state.pendingToFinalMap[derivedPending] = finalId;
    if (previous !== finalId) {
      state.resolutionAudit.push({
        pendingInscriptionId: derivedPending,
        finalInscriptionId: finalId,
        walletAddress: normalizedEntry.walletAddress,
        orderId: normalizedEntry.orderId,
        sourceLogId: normalizedEntry.id,
        resolvedAt: nowIso,
      });
    }
    state.logs = state.logs.map((log) => patchLogWithMapping(log, derivedPending, finalId, nowIso));
  }

  // Keep files compact but safe.
  state.logs = state.logs.slice(-10000);
  state.resolutionAudit = state.resolutionAudit.slice(-50000);
  await writeState(state);
};

/**
 * Lädt Logs für eine Wallet-Adresse
 */
export const getWalletLogs = async (walletAddress: string): Promise<MintingLogEntry[]> => {
  const state = await readState();
  return state.logs.filter(
    log => String(log.walletAddress || '').toLowerCase() === walletAddress.toLowerCase()
  );
};

/**
 * Lädt alle Logs (Admin-Funktion)
 */
export const getAllLogs = async (): Promise<MintingLogEntry[]> => {
  const state = await readState();
  return state.logs;
};

export const getPendingToFinalMap = async (): Promise<Record<string, string>> => {
  const state = await readState();
  return state.pendingToFinalMap;
};

export const getResolutionAudit = async (): Promise<MintingResolutionAuditEntry[]> => {
  const state = await readState();
  return state.resolutionAudit;
};

export const getOpenPendingIds = async (walletAddress?: string): Promise<string[]> => {
  const state = await readState();
  const logs = walletAddress
    ? state.logs.filter((log) => String(log.walletAddress || '').toLowerCase() === walletAddress.toLowerCase())
    : state.logs;
  const set = new Set<string>();
  for (const log of logs) {
    const id = normalizeInscriptionId(log.inscriptionId);
    if (isPendingInscriptionId(id) && !state.pendingToFinalMap[id]) set.add(id);
    for (const card of Array.isArray(log.cards) ? (log.cards as any[]) : []) {
      const cardId = normalizeInscriptionId(card?.inscriptionId);
      if (isPendingInscriptionId(cardId) && !state.pendingToFinalMap[cardId]) set.add(cardId);
    }
  }
  return [...set];
};








