/**
 * SIGNAL Hashlist Service
 * -----------------------
 * Baut die SIGNAL-Hashlist deterministisch aus den persistenten richart
 * Mint-Logs zusammen — die Hashlist ist also nie "verloren", sie wird
 * jedes Mal aus den Quellen rekonstruiert.
 *
 * Quellen:
 *   1. /api/admin/logs/all  — alle Mint-Logs (Tech & Games enthält SIGNAL)
 *   2. /api/minting/resolved-ids  — auflösung pending → final inscriptionId
 *   3. https://ordinals.com/r/inscription/<id>  — number + sat (definitiv)
 *
 * Edition-Reihenfolge: nach inscription-number aufsteigend (= chain order
 * = definitive, gap-free 1..N). Diese Edition kann von der im Wrapper-Tag
 * stehenden "claim-Edition" abweichen, falls Mints out-of-order bestätigt
 * wurden — die Hashlist ist die kanonische Quelle für die Marketplace.
 *
 * Output-Schema entspricht 1:1 `signal-marketplace/hashlist-v1.json`,
 * das die SIGNAL-Marketplace-Inscription via /r/sat/<sat>/at/-1 lädt.
 */

import { getApiUrl } from '../utils/apiUrl';
import { SIGNAL_ENGINE_INSCRIPTION_ID, SIGNAL_EDITION_LIMIT } from '../constants/signalInscription';

export interface SignalHashlistEntry {
  id: string;
  edition: number;
  number: number;
  sat: string;
}

export interface SignalHashlist {
  version_number: number;
  collection: string;
  updated: string;
  total_supply: number;
  comment: string;
  items: SignalHashlistEntry[];
}

export interface SignalHashlistBuildReport {
  hashlist: SignalHashlist;
  totalLogsScanned: number;
  signalCandidates: number;
  resolvedFinalIds: number;
  unresolvedPending: number;
  forcedExtras: number;
  enrichmentFailures: string[];
}

export interface BuildSignalHashlistOptions {
  /**
   * Manuell vom Admin gepflegte Final-Inscription-IDs, die zusätzlich zu
   * den aus den Logs aufgelösten IDs in die Hashlist aufgenommen werden.
   *
   * Sinnvoll wenn das Backend-pending→final-Mapping noch nicht aktualisiert
   * ist (UniSat braucht manchmal lange für die Bestätigung), wir aber
   * bereits wissen welche Final-ID rauskam. Diese IDs durchlaufen dieselbe
   * Chain-Enrichment + Sort-Pipeline wie auto-aufgelöste IDs — die finale
   * Edition-Reihenfolge bleibt also durchgängig nach inscription-number.
   *
   * Ungültige Einträge (kein 64-hex + iN Pattern) werden stillschweigend
   * verworfen. Duplikate (case-insensitive) werden zusammengefasst.
   */
  extraFinalIds?: string[];
}

const ORDINAL_INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;
const PENDING_PREFIX = 'pending-';

const isFinalInscriptionId = (value: unknown): boolean =>
  ORDINAL_INSCRIPTION_ID_RE.test(String(value || '').trim());

const isPendingInscriptionId = (value: unknown): boolean =>
  String(value || '').trim().toLowerCase().startsWith(PENDING_PREFIX);

/**
 * Heuristik, ob ein Tech-&-Games-Log-Eintrag zu einem SIGNAL-Mint gehört.
 * Wir matchen drei Indikatoren (jeder einzeln ausreichend):
 *   - originalInscriptionId == SIGNAL_ENGINE_INSCRIPTION_ID
 *   - itemName === 'SIGNAL' (case-insensitive)
 *   - packId/packName enthält "signal"
 */
const isSignalLogEntry = (log: any): boolean => {
  const orig = String(log?.originalInscriptionId || log?.original_inscription_id || '').trim().toLowerCase();
  if (orig === SIGNAL_ENGINE_INSCRIPTION_ID.toLowerCase()) return true;

  const name = String(log?.itemName || log?.item_name || '').trim().toLowerCase();
  if (name === 'signal') return true;

  const haystack = [log?.packId, log?.packName, log?.collectionSlug, log?.collection_slug]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return /\bsignal\b/.test(haystack);
};

/**
 * Holt die /r/inscription/<id> Metadata von ordinals.com.
 * Wirft bei Netzwerk-Fehlern, gibt sonst { number, sat } zurück.
 */
const fetchInscriptionMeta = async (
  inscriptionId: string
): Promise<{ number: number; sat: string }> => {
  const res = await fetch(
    `https://ordinals.com/r/inscription/${encodeURIComponent(inscriptionId)}`
  );
  if (!res.ok) throw new Error(`/r/inscription HTTP ${res.status} for ${inscriptionId}`);
  const data = await res.json();
  const number = Number(data?.number);
  const sat = data?.sat != null ? String(data.sat) : '';
  if (!Number.isFinite(number)) throw new Error(`/r/inscription returned no number for ${inscriptionId}`);
  return { number, sat };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ruft die ordinals.com Recursive-Endpoints sequentiell mit kleinem Delay
 * ab, um nicht in Rate-Limits zu laufen. Bei einzelnen Fehlern wird der
 * Eintrag übersprungen und im Report vermerkt.
 */
const enrichWithChainData = async (
  ids: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ enriched: Map<string, { number: number; sat: string }>; failures: string[] }> => {
  const enriched = new Map<string, { number: number; sat: string }>();
  const failures: string[] = [];
  let done = 0;
  for (const id of ids) {
    try {
      const meta = await fetchInscriptionMeta(id);
      enriched.set(id, meta);
    } catch (err: any) {
      failures.push(`${id}: ${err?.message || err}`);
    }
    done += 1;
    onProgress?.(done, ids.length);
    if (done < ids.length) await sleep(120);
  }
  return { enriched, failures };
};

/**
 * Parst eine freie Eingabe (Textarea, Komma, Whitespace, Newlines) in
 * eine Liste eindeutiger valider Inscription-IDs (lowercased).
 */
export const parseInscriptionIdList = (raw: string): string[] => {
  const set = new Set<string>();
  for (const token of String(raw || '').split(/[\s,]+/)) {
    const id = token.trim().toLowerCase();
    if (id && isFinalInscriptionId(id)) set.add(id);
  }
  return [...set];
};

/**
 * Hauptfunktion: baut die aktuelle SIGNAL-Hashlist.
 *
 * @param adminAddress  Wallet-Adresse mit Admin-Rechten — wird vom
 *                      Backend für `/api/admin/logs/all` gefordert.
 * @param onProgress    Optionaler Callback für UI-Spinner während der
 *                      sequentiellen ord-Recursive-Calls.
 * @param options       Optional: extraFinalIds zum manuellen Force-Include
 *                      (siehe BuildSignalHashlistOptions).
 */
export const buildSignalHashlist = async (
  adminAddress: string,
  onProgress?: (done: number, total: number) => void,
  options: BuildSignalHashlistOptions = {}
): Promise<SignalHashlistBuildReport> => {
  const API_URL = getApiUrl();

  const [logsRes, resolvedRes] = await Promise.all([
    fetch(`${API_URL}/api/admin/logs/all?adminAddress=${encodeURIComponent(adminAddress)}&sync=1`),
    fetch(`${API_URL}/api/minting/resolved-ids`),
  ]);

  if (!logsRes.ok) throw new Error(`/api/admin/logs/all HTTP ${logsRes.status}`);
  const logsData = await logsRes.json();

  const pendingToFinalMap: Record<string, string> =
    resolvedRes.ok ? (((await resolvedRes.json())?.pendingToFinalMap) || {}) : {};

  const techLogs: any[] = Array.isArray(logsData?.techAndGames?.logs)
    ? logsData.techAndGames.logs
    : Array.isArray(logsData?.techandgames?.logs)
      ? logsData.techandgames.logs
      : [];

  const candidates = techLogs.filter(isSignalLogEntry);

  // Pro Log-Entry primären Inscription-ID extrahieren + ggf. resolven.
  const finalIds = new Map<string, any>(); // finalIdLower -> origin info (just for debugging)
  let unresolvedPending = 0;

  for (const log of candidates) {
    const raw = String(log?.inscriptionId || log?.inscription_id || '').trim();
    let resolved = raw;
    if (isPendingInscriptionId(raw)) {
      const mapped = pendingToFinalMap[raw];
      if (mapped && isFinalInscriptionId(mapped)) {
        resolved = mapped;
      } else {
        unresolvedPending += 1;
        continue;
      }
    }
    if (!isFinalInscriptionId(resolved)) {
      unresolvedPending += 1;
      continue;
    }
    if (!finalIds.has(resolved.toLowerCase())) finalIds.set(resolved.toLowerCase(), { source: 'log' });
  }

  // Force-include: manuell vom Admin gepflegte IDs hinzufügen, die noch
  // nicht in den Logs aufgelöst sind. Wenn die ID bereits aus Logs kam,
  // zählt sie nicht als "extra".
  let forcedExtras = 0;
  for (const id of options.extraFinalIds || []) {
    const lower = id.trim().toLowerCase();
    if (!isFinalInscriptionId(lower)) continue;
    if (finalIds.has(lower)) continue;
    finalIds.set(lower, { source: 'manual' });
    forcedExtras += 1;
  }

  const idList = [...finalIds.keys()];
  const { enriched, failures } = await enrichWithChainData(idList, onProgress);

  // Sort by inscription number ascending → definitive chain order
  const items: SignalHashlistEntry[] = idList
    .filter((id) => enriched.has(id))
    .map((id) => {
      const meta = enriched.get(id)!;
      return { id, edition: 0, number: meta.number, sat: meta.sat };
    })
    .sort((a, b) => a.number - b.number)
    .map((entry, index) => ({ ...entry, edition: index + 1 }));

  const hashlist: SignalHashlist = {
    version_number: 1, // wird vom Admin manuell hochgezählt beim Re-Inscribe
    collection: 'SIGNAL',
    updated: new Date().toISOString(),
    total_supply: SIGNAL_EDITION_LIMIT,
    comment:
      'Hashlist of all minted SIGNAL ordinals. Re-inscribe a new version on the SAME sat to update the marketplace -- it picks the latest via /r/sat/<sat>/at/-1.',
    items,
  };

  return {
    hashlist,
    totalLogsScanned: techLogs.length,
    signalCandidates: candidates.length,
    resolvedFinalIds: items.length,
    unresolvedPending: Math.max(0, unresolvedPending - forcedExtras),
    forcedExtras,
    enrichmentFailures: failures,
  };
};

/**
 * Triggert einen Browser-Download der Hashlist als JSON-Datei.
 */
export const downloadSignalHashlist = (hashlist: SignalHashlist): void => {
  const text = JSON.stringify(hashlist, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `signal-hashlist-v${hashlist.version_number}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
