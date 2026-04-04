import * as btc from '@scure/btc-signer';
import { hex as hexCodec } from '@scure/base';

const MEMPOOL_API = 'https://mempool.space/api';
const SATS_PER_BTC = 100_000_000;
const EPOCH_BLOCKS = 210_000;
const INITIAL_REWARD = 5_000_000_000;
const DUST_LIMIT = 546;

// ============================================================
// TYPES
// ============================================================
export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface SatRange {
  start: number;
  end: number;
}

export type SatType =
  | 'mythic' | 'legendary' | 'epic' | 'rare' | 'uncommon'
  | 'parasite' | 'nakamoto' | 'vintage' | 'alpha' | 'omega'
  | 'palindrome' | 'block9' | 'block78' | 'pizza' | 'firsttx';

export interface RareSatGroup {
  satStart: number;
  satEnd: number;
  offsetStart: number;
  offsetEnd: number;
  count: number;
  types: SatType[];
  blockHeight: number;
  label: string;
}

export interface AnalyzedUtxo extends Utxo {
  satRanges: SatRange[];
  rareSatGroups: RareSatGroup[];
  totalRareSats: number;
  inscriptions: string[];
  scriptPubKey: string;
  address: string;
  satRangesAvailable: boolean;
}

export interface SplitOutput {
  address: string;
  value: number;
  label: string;
  isRare: boolean;
}

export interface FeeRates {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
  minimum: number;
}

// ============================================================
// EPOCH COMPUTATION
// ============================================================
interface EpochInfo {
  startBlock: number;
  reward: number;
  startSat: number;
  endSat: number;
}

function computeEpochs(): EpochInfo[] {
  const epochs: EpochInfo[] = [];
  let startSat = 0;
  let reward = INITIAL_REWARD;
  let block = 0;
  for (let i = 0; i < 34; i++) {
    if (reward === 0) break;
    const epochSats = EPOCH_BLOCKS * reward;
    epochs.push({ startBlock: block, reward, startSat, endSat: startSat + epochSats });
    startSat += epochSats;
    block += EPOCH_BLOCKS;
    reward = Math.floor(reward / 2);
  }
  return epochs;
}

const EPOCHS = computeEpochs();

// ============================================================
// SAT MATH
// ============================================================
export function satToBlockHeight(sat: number): number {
  for (const epoch of EPOCHS) {
    if (sat < epoch.endSat) {
      return epoch.startBlock + Math.floor((sat - epoch.startSat) / epoch.reward);
    }
  }
  return -1;
}

export function blockToSatRange(blockHeight: number): [number, number] {
  for (const epoch of EPOCHS) {
    const epochEnd = epoch.startBlock + EPOCH_BLOCKS;
    if (blockHeight >= epoch.startBlock && blockHeight < epochEnd) {
      const pos = blockHeight - epoch.startBlock;
      const start = epoch.startSat + pos * epoch.reward;
      return [start, start + epoch.reward];
    }
  }
  return [0, 0];
}

function blockRewardAtHeight(blockHeight: number): number {
  for (const epoch of EPOCHS) {
    if (blockHeight >= epoch.startBlock && blockHeight < epoch.startBlock + EPOCH_BLOCKS) {
      return epoch.reward;
    }
  }
  return 0;
}

function isFirstSatOfBlock(sat: number): boolean {
  const block = satToBlockHeight(sat);
  if (block < 0) return false;
  const [blockStart] = blockToSatRange(block);
  return sat === blockStart;
}

// Parasite: block 938713
const PARASITE_BLOCK = 938_713;
const [PARASITE_SAT_START, PARASITE_SAT_END] = blockToSatRange(PARASITE_BLOCK);

export function isParasiteSat(sat: number): boolean {
  return sat >= PARASITE_SAT_START && sat < PARASITE_SAT_END;
}

// Difficulty adjustment every 2016 blocks
function isDifficultyAdjustmentBoundary(block: number): boolean {
  return block > 0 && block % 2016 === 0;
}

// Halving boundary
function isHalvingBoundary(block: number): boolean {
  return block > 0 && block % EPOCH_BLOCKS === 0;
}

// Cycle = lcm(2016, 210000) = 6 * 210000 = 1260000
function isCycleBoundary(block: number): boolean {
  return block > 0 && block % 1_260_000 === 0;
}

const NAKAMOTO_MAX_BLOCK = 35_000;
const VINTAGE_MAX_BLOCK = 1_000;
const BLOCK_9_RANGE = blockToSatRange(9);
const BLOCK_78_RANGE = blockToSatRange(78);

function isPalindrome(sat: number): boolean {
  const s = String(sat);
  const len = s.length;
  for (let i = 0; i < len / 2; i++) {
    if (s[i] !== s[len - 1 - i]) return false;
  }
  return true;
}

// ============================================================
// SAT CLASSIFICATION
// ============================================================
export function classifySat(sat: number): SatType[] {
  const types: SatType[] = [];
  const block = satToBlockHeight(sat);
  if (block < 0) return types;

  if (sat === 0) types.push('mythic');
  if (isFirstSatOfBlock(sat)) {
    if (isCycleBoundary(block)) types.push('legendary');
    else if (isHalvingBoundary(block)) types.push('epic');
    else if (isDifficultyAdjustmentBoundary(block)) types.push('rare');
    else types.push('uncommon');
  }

  if (isParasiteSat(sat)) types.push('parasite');
  if (block <= NAKAMOTO_MAX_BLOCK) types.push('nakamoto');
  if (block <= VINTAGE_MAX_BLOCK) types.push('vintage');
  if (sat >= BLOCK_9_RANGE[0] && sat < BLOCK_9_RANGE[1]) types.push('block9');
  if (sat >= BLOCK_78_RANGE[0] && sat < BLOCK_78_RANGE[1]) types.push('block78');
  if (sat % SATS_PER_BTC === 0) types.push('alpha');
  if (sat % SATS_PER_BTC === SATS_PER_BTC - 1) types.push('omega');
  if (isPalindrome(sat)) types.push('palindrome');

  return types;
}

export const SAT_TYPE_META: Record<SatType, { label: string; color: string; symbol: string; priority: number }> = {
  mythic:     { label: 'Mythic',     color: '#ffd700', symbol: '★',  priority: 0 },
  legendary:  { label: 'Legendary',  color: '#a855f7', symbol: '◆',  priority: 1 },
  epic:       { label: 'Epic',       color: '#ec4899', symbol: '◈',  priority: 2 },
  rare:       { label: 'Rare',       color: '#3b82f6', symbol: '◉',  priority: 3 },
  uncommon:   { label: 'Uncommon',   color: '#22c55e', symbol: '○',  priority: 4 },
  parasite:   { label: 'Parasite',   color: '#ef4444', symbol: '🦠', priority: 5 },
  nakamoto:   { label: 'Nakamoto',   color: '#f97316', symbol: '₿',  priority: 6 },
  vintage:    { label: 'Vintage',    color: '#d97706', symbol: '⌛', priority: 7 },
  block9:     { label: 'Block 9',    color: '#8b5cf6', symbol: '⑨',  priority: 8 },
  block78:    { label: 'Block 78',   color: '#8b5cf6', symbol: '⑦⑧', priority: 9 },
  alpha:      { label: 'Alpha',      color: '#e2e8f0', symbol: 'α',  priority: 10 },
  omega:      { label: 'Omega',      color: '#e2e8f0', symbol: 'Ω',  priority: 11 },
  palindrome: { label: 'Palindrome', color: '#06b6d4', symbol: '↔',  priority: 12 },
  pizza:      { label: 'Pizza',      color: '#f59e0b', symbol: '🍕', priority: 13 },
  firsttx:    { label: 'First TX',   color: '#f59e0b', symbol: '📜', priority: 14 },
};

// ============================================================
// FIND RARE SATS IN RANGES
// ============================================================
export function findRareSatsInRanges(satRanges: SatRange[]): RareSatGroup[] {
  const groups: RareSatGroup[] = [];
  let globalOffset = 0;

  for (const range of satRanges) {
    const rangeLen = range.end - range.start;

    // Check for parasite sats overlap
    if (range.start < PARASITE_SAT_END && range.end > PARASITE_SAT_START) {
      const pStart = Math.max(range.start, PARASITE_SAT_START);
      const pEnd = Math.min(range.end, PARASITE_SAT_END);
      const offsetStart = globalOffset + (pStart - range.start);
      const offsetEnd = globalOffset + (pEnd - range.start);
      const pBlock = satToBlockHeight(pStart);
      const types = classifySat(pStart);
      if (!types.includes('parasite')) types.push('parasite');
      groups.push({
        satStart: pStart, satEnd: pEnd,
        offsetStart, offsetEnd,
        count: pEnd - pStart,
        types, blockHeight: pBlock,
        label: `Parasite (Block ${PARASITE_BLOCK})`,
      });
    }

    // Check for block boundaries (uncommon+ sats)
    const startBlock = satToBlockHeight(range.start);
    const endBlock = satToBlockHeight(range.end - 1);
    for (let b = startBlock; b <= endBlock; b++) {
      const [blockFirstSat] = blockToSatRange(b);
      if (blockFirstSat >= range.start && blockFirstSat < range.end) {
        const types = classifySat(blockFirstSat);
        if (types.length > 0 && !types.every(t => t === 'parasite' || t === 'nakamoto' || t === 'vintage')) {
          const offsetInRange = globalOffset + (blockFirstSat - range.start);
          const existsAlready = groups.some(g => g.satStart === blockFirstSat);
          if (!existsAlready) {
            groups.push({
              satStart: blockFirstSat, satEnd: blockFirstSat + 1,
              offsetStart: offsetInRange, offsetEnd: offsetInRange + 1,
              count: 1, types, blockHeight: b,
              label: types.map(t => SAT_TYPE_META[t]?.label || t).join(' + '),
            });
          }
        }
      }
    }

    // Check for alpha/omega sats
    const firstAlpha = Math.ceil(range.start / SATS_PER_BTC) * SATS_PER_BTC;
    for (let alpha = firstAlpha; alpha < range.end; alpha += SATS_PER_BTC) {
      if (alpha >= range.start) {
        const types = classifySat(alpha);
        if (types.length > 0 && !groups.some(g => g.satStart === alpha)) {
          groups.push({
            satStart: alpha, satEnd: alpha + 1,
            offsetStart: globalOffset + (alpha - range.start),
            offsetEnd: globalOffset + (alpha - range.start) + 1,
            count: 1, types, blockHeight: satToBlockHeight(alpha),
            label: types.map(t => SAT_TYPE_META[t]?.label || t).join(' + '),
          });
        }
      }
      const omega = alpha - 1;
      if (omega >= range.start && omega < range.end) {
        const types = classifySat(omega);
        if (types.length > 0 && !groups.some(g => g.satStart === omega)) {
          groups.push({
            satStart: omega, satEnd: omega + 1,
            offsetStart: globalOffset + (omega - range.start),
            offsetEnd: globalOffset + (omega - range.start) + 1,
            count: 1, types, blockHeight: satToBlockHeight(omega),
            label: types.map(t => SAT_TYPE_META[t]?.label || t).join(' + '),
          });
        }
      }
    }

    // Check for nakamoto/vintage/block9/block78 range overlap
    for (const [specialStart, specialEnd, specialLabel] of [
      [BLOCK_9_RANGE[0], BLOCK_9_RANGE[1], 'Block 9'],
      [BLOCK_78_RANGE[0], BLOCK_78_RANGE[1], 'Block 78'],
    ] as [number, number, string][]) {
      if (range.start < specialEnd && range.end > specialStart) {
        const sStart = Math.max(range.start, specialStart);
        const sEnd = Math.min(range.end, specialEnd);
        if (!groups.some(g => g.satStart === sStart && g.satEnd === sEnd)) {
          const types = classifySat(sStart);
          groups.push({
            satStart: sStart, satEnd: sEnd,
            offsetStart: globalOffset + (sStart - range.start),
            offsetEnd: globalOffset + (sEnd - range.start),
            count: sEnd - sStart, types,
            blockHeight: satToBlockHeight(sStart),
            label: specialLabel,
          });
        }
      }
    }

    globalOffset += rangeLen;
  }

  groups.sort((a, b) => a.offsetStart - b.offsetStart);
  return groups;
}

// ============================================================
// API: FETCH UTXOs
// ============================================================
export async function fetchUtxos(address: string): Promise<Utxo[]> {
  const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
  if (!res.ok) throw new Error(`Failed to fetch UTXOs: ${res.status}`);
  return res.json();
}

// ============================================================
// API: FETCH SAT RANGES FROM ORD SERVER
// ============================================================
export async function fetchSatRanges(
  txid: string, vout: number, ordServerUrl: string
): Promise<{ satRanges: SatRange[]; inscriptions: string[] }> {
  const url = `${ordServerUrl}/output/${txid}:${vout}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Ord server returned ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    const text = await res.text();
    const rangeMatches = [...text.matchAll(/(\d+)[–-](\d+)/g)];
    const satRanges: SatRange[] = rangeMatches.map(m => ({
      start: Number(m[1]), end: Number(m[2]),
    }));
    return { satRanges, inscriptions: [] };
  }

  const data = await res.json();
  let satRanges: SatRange[] = [];
  if (Array.isArray(data.sat_ranges)) {
    satRanges = data.sat_ranges.map((r: number[]) => ({ start: Number(r[0]), end: Number(r[1]) }));
  } else if (Array.isArray(data.ranges)) {
    satRanges = data.ranges.map((r: number[]) => ({ start: Number(r[0]), end: Number(r[1]) }));
  }
  const inscriptions: string[] = Array.isArray(data.inscriptions) ? data.inscriptions : [];
  return { satRanges, inscriptions };
}

// ============================================================
// API: FETCH TX DATA (for script extraction)
// ============================================================
export async function fetchTxData(txid: string): Promise<{
  vout: Array<{ scriptpubkey: string; scriptpubkey_address?: string; value: number }>;
}> {
  const res = await fetch(`${MEMPOOL_API}/tx/${txid}`);
  if (!res.ok) throw new Error(`Failed to fetch tx: ${res.status}`);
  return res.json();
}

// ============================================================
// API: FETCH FEE RATES
// ============================================================
export async function fetchFeeRates(): Promise<FeeRates> {
  const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  if (!res.ok) throw new Error('Failed to fetch fees');
  const data = await res.json();
  return {
    fastest: data.fastestFee || 1,
    halfHour: data.halfHourFee || 1,
    hour: data.hourFee || 1,
    economy: data.economyFee || 1,
    minimum: data.minimumFee || 1,
  };
}

// ============================================================
// ANALYZE UTXO
// ============================================================
export async function analyzeUtxo(
  utxo: Utxo, ordServerUrl: string
): Promise<AnalyzedUtxo> {
  let satRanges: SatRange[] = [];
  let inscriptions: string[] = [];
  let satRangesAvailable = false;

  try {
    const result = await fetchSatRanges(utxo.txid, utxo.vout, ordServerUrl);
    satRanges = result.satRanges;
    inscriptions = result.inscriptions;
    satRangesAvailable = satRanges.length > 0;
  } catch (e) {
    console.warn(`[RareSat] Could not fetch sat ranges for ${utxo.txid}:${utxo.vout}`, e);
  }

  let scriptPubKey = '';
  let address = '';
  try {
    const txData = await fetchTxData(utxo.txid);
    const output = txData.vout[utxo.vout];
    if (output) {
      scriptPubKey = output.scriptpubkey;
      address = output.scriptpubkey_address || '';
    }
  } catch (e) {
    console.warn(`[RareSat] Could not fetch tx data for ${utxo.txid}`, e);
  }

  const rareSatGroups = satRangesAvailable ? findRareSatsInRanges(satRanges) : [];
  const totalRareSats = rareSatGroups.reduce((sum, g) => sum + g.count, 0);

  return {
    ...utxo,
    satRanges,
    rareSatGroups,
    totalRareSats,
    inscriptions,
    scriptPubKey,
    address,
    satRangesAvailable,
  };
}

// ============================================================
// BUILD SPLIT OUTPUTS
// ============================================================
export function computeSplitOutputs(
  analyzedUtxo: AnalyzedUtxo,
  destinationAddress: string,
  assetsPerUtxo: number,
  feeRate: number,
): { outputs: SplitOutput[]; fee: number; changeValue: number; error?: string } {
  const groups = analyzedUtxo.rareSatGroups;
  if (groups.length === 0) {
    return { outputs: [], fee: 0, changeValue: analyzedUtxo.value, error: 'No rare sats found' };
  }

  const rareOutputs: SplitOutput[] = [];
  for (let i = 0; i < groups.length; i += assetsPerUtxo) {
    const batch = groups.slice(i, i + assetsPerUtxo);
    const firstOffset = batch[0].offsetStart;
    const lastOffset = batch[batch.length - 1].offsetEnd;
    const satCount = lastOffset - firstOffset;
    const value = Math.max(DUST_LIMIT, satCount);
    rareOutputs.push({
      address: destinationAddress,
      value,
      label: batch.map(g => g.label).join(', '),
      isRare: true,
    });
  }

  const numOutputs = rareOutputs.length + 1;
  const estVSize = Math.ceil(10.5 + 57.5 + numOutputs * 43);
  const fee = Math.ceil(estVSize * feeRate);

  let totalRareValue = 0;
  for (const o of rareOutputs) totalRareValue += o.value;

  const changeValue = analyzedUtxo.value - totalRareValue - fee;

  if (changeValue < 0) {
    return { outputs: rareOutputs, fee, changeValue: 0, error: 'UTXO too small to cover split + fee' };
  }

  const outputs: SplitOutput[] = [];
  let currentOffset = 0;

  for (let i = 0; i < groups.length; i += assetsPerUtxo) {
    const batch = groups.slice(i, i + assetsPerUtxo);
    const groupStart = batch[0].offsetStart;
    const groupEnd = batch[batch.length - 1].offsetEnd;

    if (groupStart > currentOffset) {
      const paddingValue = groupStart - currentOffset;
      if (paddingValue >= DUST_LIMIT) {
        outputs.push({
          address: destinationAddress,
          value: paddingValue,
          label: 'Padding (common sats)',
          isRare: false,
        });
      }
    }

    const satCount = groupEnd - groupStart;
    outputs.push({
      address: destinationAddress,
      value: Math.max(DUST_LIMIT, satCount),
      label: batch.map(g => g.label).join(', '),
      isRare: true,
    });
    currentOffset = groupEnd;
  }

  const remaining = analyzedUtxo.value - currentOffset;
  if (remaining > 0) {
    const changeFinal = remaining - fee;
    if (changeFinal >= DUST_LIMIT) {
      outputs.push({
        address: destinationAddress,
        value: changeFinal,
        label: 'Change',
        isRare: false,
      });
    }
  }

  const recalcFee = Math.ceil((10.5 + 57.5 + outputs.length * 43) * feeRate);

  return { outputs, fee: recalcFee, changeValue: Math.max(0, changeValue) };
}

// ============================================================
// BUILD SPLIT PSBT
// ============================================================
export function buildSplitPsbt(params: {
  utxo: { txid: string; vout: number; value: number; scriptPubKey: string };
  outputs: SplitOutput[];
  feeRate: number;
}): Uint8Array {
  const tx = new btc.Transaction({ allowUnknownOutputs: true, allowUnknownInputs: true });
  const script = hexCodec.decode(params.utxo.scriptPubKey);

  tx.addInput({
    txid: params.utxo.txid,
    index: params.utxo.vout,
    witnessUtxo: { script, amount: BigInt(params.utxo.value) },
    ...(script[0] === 0x51 ? { tapInternalKey: script.slice(2, 34) } : {}),
  });

  let totalOutputs = 0;
  for (const out of params.outputs) {
    tx.addOutputAddress(out.address, BigInt(out.value));
    totalOutputs += out.value;
  }

  const inputTotal = params.utxo.value;
  const impliedFee = inputTotal - totalOutputs;
  if (impliedFee < 0) throw new Error('Outputs exceed input value');

  return tx.toPSBT();
}

// ============================================================
// BROADCAST
// ============================================================
export async function broadcastTx(txHex: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_API}/tx`, {
    method: 'POST',
    body: txHex,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Broadcast failed: ${errText}`);
  }
  return res.text();
}

// ============================================================
// UTILITY
// ============================================================
export function formatSatNumber(sat: number): string {
  return sat.toLocaleString('en-US');
}

export function satsToBtc(sats: number): string {
  return (sats / SATS_PER_BTC).toFixed(8);
}

export { DUST_LIMIT, PARASITE_BLOCK, PARASITE_SAT_START, PARASITE_SAT_END };
