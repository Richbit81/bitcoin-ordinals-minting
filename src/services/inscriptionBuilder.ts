/**
 * Gallery Inscription Builder
 * 
 * Erstellt Bitcoin Ordinals Inscriptions ohne externen Service.
 * Nutzt das Commit+Reveal Transaktionsmuster.
 * 
 * Inscription Envelope Tags:
 * - Tag 1  = Content-Type
 * - Tag 2  = Pointer (SAT offset in outputs, for batch)
 * - Tag 3  = Parent Inscription ID
 * - Tag 5  = Metadata (CBOR-encoded: title, traits)
 * - Tag 9  = Content-Encoding ("br" for brotli)
 * - Tag 11 = Delegate
 * - Tag 17 = Properties/Gallery (CBOR-encoded)
 */

import * as btc from '@scure/btc-signer';
import { hex as hexCodec } from '@scure/base';
import { schnorr } from '@noble/curves/secp256k1.js';

// ============================================================
// CONSTANTS
// ============================================================
const POSTAGE = 546n;
const MAX_CHUNK_SIZE = 520;
const MEMPOOL_API = 'https://mempool.space/api';

// ============================================================
// TYPES
// ============================================================
export interface GalleryItem {
  id: string;
  meta: {
    name: string;
    attributes: Array<{ trait_type: string; value: string }>;
  };
}

export interface InscriptionOptions {
  contentType: string;
  body: Uint8Array;
  galleryData?: Uint8Array | null;
  parentIds?: string[];
  metadata?: Uint8Array | null;      // CBOR-encoded metadata (title + traits)
  contentEncoding?: string | null;   // "br" for brotli
  pointer?: number | null;           // SAT offset for batch mode
  reinscribeId?: string | null;      // Inscription ID to reinscribe on
}

export interface InscriptionSession {
  privateKeyHex: string;
  publicKeyHex: string;
  commitAddress: string;
  commitScriptHex: string;
  inscriptionScriptHex: string; // The actual tapscript (needed for reveal)
  destinationAddress: string;
  requiredAmount: number;
  feeRate: number;
  status: 'created' | 'funded' | 'revealed' | 'error';
  commitTxid?: string;
  commitVout?: number;
  commitAmount?: number;  // Actual funded amount from UTXO
  revealTxid?: string;
  inscriptionId?: string;
  createdAt: number;
  imageContentType: string;
  galleryItemCount: number;
  totalScriptSize: number;
  batchCount: number;           // Number of inscriptions (1 for single)
  contentEncoding?: string;     // "br" if brotli used
}

export interface BatchFileEntry {
  fileName: string;
  data: Uint8Array;
  contentType: string;
  sizeKB: number;
}

// ============================================================
// MINIMAL CBOR ENCODER
// ============================================================
class CBOREncoder {
  private parts: Uint8Array[] = [];

  private push(bytes: Uint8Array | number[]) {
    this.parts.push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  private writeHeader(majorType: number, value: number) {
    const mt = majorType << 5;
    if (value < 24) {
      this.push([mt | value]);
    } else if (value < 256) {
      this.push([mt | 24, value]);
    } else if (value < 65536) {
      this.push([mt | 25, (value >> 8) & 0xff, value & 0xff]);
    } else {
      this.push([mt | 26, (value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
    }
  }

  encodeUint(value: number) {
    this.writeHeader(0, value);
  }

  encodeBytes(bytes: Uint8Array) {
    this.writeHeader(2, bytes.length);
    this.push(bytes);
  }

  encodeText(text: string) {
    const bytes = new TextEncoder().encode(text);
    this.writeHeader(3, bytes.length);
    this.push(bytes);
  }

  encodeArrayHeader(length: number) {
    this.writeHeader(4, length);
  }

  encodeMapHeader(length: number) {
    this.writeHeader(5, length);
  }

  getResult(): Uint8Array {
    const totalLen = this.parts.reduce((s, p) => s + p.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
}

// ============================================================
// HELPERS
// ============================================================

function hexToBytes(hex: string): Uint8Array {
  return hexCodec.decode(hex);
}

function bytesToHex(bytes: Uint8Array): string {
  return hexCodec.encode(bytes);
}

function parseInscriptionId(id: string): { txidBytes: Uint8Array; index: number } {
  const parts = id.split('i');
  const txidHex = parts[0];
  const index = parseInt(parts[1] || '0', 10);
  const txidBytes = hexToBytes(txidHex);
  return { txidBytes, index };
}

function encodeInscriptionIdBytes(id: string): Uint8Array {
  const { txidBytes, index } = parseInscriptionId(id);
  if (index > 0) {
    const result = new Uint8Array(txidBytes.length + 4);
    result.set(txidBytes);
    result[txidBytes.length] = index & 0xff;
    result[txidBytes.length + 1] = (index >> 8) & 0xff;
    result[txidBytes.length + 2] = (index >> 16) & 0xff;
    result[txidBytes.length + 3] = (index >> 24) & 0xff;
    return result;
  }
  return txidBytes;
}

function scriptPushData(data: Uint8Array): number[] {
  const result: number[] = [];
  if (data.length === 0) {
    result.push(0x00);
  } else if (data.length <= 75) {
    result.push(data.length);
    result.push(...data);
  } else if (data.length <= 255) {
    result.push(0x4c);
    result.push(data.length);
    result.push(...data);
  } else if (data.length <= 65535) {
    result.push(0x4d);
    result.push(data.length & 0xff);
    result.push((data.length >> 8) & 0xff);
    result.push(...data);
  } else {
    result.push(0x4e);
    result.push(data.length & 0xff);
    result.push((data.length >> 8) & 0xff);
    result.push((data.length >> 16) & 0xff);
    result.push((data.length >> 24) & 0xff);
    result.push(...data);
  }
  return result;
}

/** Push chunked data with a tag prefix per chunk */
function scriptPushTaggedChunks(script: number[], tagByte: number, data: Uint8Array) {
  for (let i = 0; i < data.length; i += MAX_CHUNK_SIZE) {
    const end = Math.min(i + MAX_CHUNK_SIZE, data.length);
    const chunk = data.slice(i, end);
    script.push(...scriptPushData(new Uint8Array([tagByte])));
    script.push(...scriptPushData(chunk));
  }
}

/** Push body data as chunks (no tag prefix) */
function scriptPushBodyChunks(script: number[], data: Uint8Array) {
  for (let i = 0; i < data.length; i += MAX_CHUNK_SIZE) {
    const end = Math.min(i + MAX_CHUNK_SIZE, data.length);
    script.push(...scriptPushData(data.slice(i, end)));
  }
}

/** Encode a pointer value as little-endian bytes (trimmed) */
function encodePointerBytes(pointer: number): Uint8Array {
  if (pointer === 0) return new Uint8Array([0]);
  const bytes: number[] = [];
  let val = pointer;
  while (val > 0) {
    bytes.push(val & 0xff);
    val = val >>> 8;
  }
  return new Uint8Array(bytes);
}

// ============================================================
// BROTLI COMPRESSION
// ============================================================

let _brotliModule: any = null;

/**
 * Initialize and cache the brotli-wasm module
 */
async function getBrotli(): Promise<any> {
  if (_brotliModule) return _brotliModule;
  try {
    const brotliPromise = (await import('brotli-wasm')).default;
    _brotliModule = await brotliPromise;
    return _brotliModule;
  } catch (e) {
    console.error('Failed to load brotli-wasm:', e);
    throw new Error('Brotli compression not available. Install brotli-wasm.');
  }
}

/**
 * Compress data with Brotli (quality 11 = max compression)
 */
export async function compressWithBrotli(data: Uint8Array): Promise<Uint8Array> {
  const brotli = await getBrotli();
  return brotli.compress(data, { quality: 11 });
}

/**
 * Check if Brotli is available
 */
export async function isBrotliAvailable(): Promise<boolean> {
  try {
    await getBrotli();
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// CBOR ENCODING
// ============================================================

/**
 * Encode gallery items as CBOR (Tag 17 / Properties)
 */
export function encodeGalleryAsCBOR(items: GalleryItem[]): Uint8Array {
  const encoder = new CBOREncoder();
  encoder.encodeMapHeader(1);
  encoder.encodeUint(0);
  encoder.encodeArrayHeader(items.length);

  for (const item of items) {
    const idBytes = encodeInscriptionIdBytes(item.id);
    encoder.encodeMapHeader(2);
    encoder.encodeUint(0);
    encoder.encodeBytes(idBytes);
    encoder.encodeUint(1);

    const attrs = item.meta.attributes;
    encoder.encodeMapHeader(2);
    encoder.encodeUint(0);
    encoder.encodeText(item.meta.name);
    encoder.encodeUint(1);
    encoder.encodeMapHeader(attrs.length);
    for (const attr of attrs) {
      encoder.encodeText(attr.trait_type);
      encoder.encodeText(attr.value);
    }
  }

  return encoder.getResult();
}

/**
 * Encode inscription metadata as CBOR (Tag 5)
 * 
 * Format: {
 *   "name": "Title",
 *   "attributes": [
 *     {"trait_type": "Key", "value": "Value"},
 *     ...
 *   ]
 * }
 */
export function encodeMetadataAsCBOR(
  title?: string,
  traits?: Array<{ key: string; value: string }>,
): Uint8Array | null {
  if (!title && (!traits || traits.length === 0)) return null;

  const encoder = new CBOREncoder();
  let mapSize = 0;
  if (title) mapSize++;
  if (traits && traits.length > 0) mapSize++;

  encoder.encodeMapHeader(mapSize);

  if (title) {
    encoder.encodeText('name');
    encoder.encodeText(title);
  }

  if (traits && traits.length > 0) {
    encoder.encodeText('attributes');
    encoder.encodeArrayHeader(traits.length);
    for (const trait of traits) {
      encoder.encodeMapHeader(2);
      encoder.encodeText('trait_type');
      encoder.encodeText(trait.key);
      encoder.encodeText('value');
      encoder.encodeText(trait.value);
    }
  }

  return encoder.getResult();
}

// ============================================================
// INSCRIPTION SCRIPT BUILDING
// ============================================================

/**
 * Build a single inscription envelope (OP_FALSE OP_IF ... OP_ENDIF)
 * Does NOT include the leading <pubkey> OP_CHECKSIG (added separately for batch)
 */
function buildInscriptionEnvelope(opts: InscriptionOptions): number[] {
  const script: number[] = [];

  // OP_FALSE OP_IF
  script.push(0x00); // OP_FALSE
  script.push(0x63); // OP_IF

  // "ord"
  script.push(...scriptPushData(new TextEncoder().encode('ord')));

  // Tag 1: content-type
  script.push(...scriptPushData(new Uint8Array([0x01])));
  script.push(...scriptPushData(new TextEncoder().encode(opts.contentType)));

  // Tag 2: pointer (for batch mode - SAT offset)
  if (opts.pointer != null && opts.pointer > 0) {
    script.push(...scriptPushData(new Uint8Array([0x02])));
    script.push(...scriptPushData(encodePointerBytes(opts.pointer)));
  }

  // Tag 3: parent inscription IDs
  if (opts.parentIds) {
    for (const parentId of opts.parentIds) {
      script.push(...scriptPushData(new Uint8Array([0x03])));
      script.push(...scriptPushData(encodeInscriptionIdBytes(parentId)));
    }
  }

  // Tag 5: metadata (title + traits as CBOR)
  if (opts.metadata && opts.metadata.length > 0) {
    scriptPushTaggedChunks(script, 0x05, opts.metadata);
  }

  // Tag 9: content-encoding ("br" for brotli)
  if (opts.contentEncoding) {
    script.push(...scriptPushData(new Uint8Array([0x09])));
    script.push(...scriptPushData(new TextEncoder().encode(opts.contentEncoding)));
  }

  // Tag 17: gallery/properties (CBOR, chunked)
  if (opts.galleryData && opts.galleryData.length > 0) {
    scriptPushTaggedChunks(script, 0x11, opts.galleryData);
  }

  // OP_0 (body separator)
  script.push(0x00);

  // Body data chunks
  scriptPushBodyChunks(script, opts.body);

  // OP_ENDIF
  script.push(0x68);

  return script;
}

/**
 * Build inscription script for a SINGLE inscription
 */
export function buildInscriptionScript(
  pubkey: Uint8Array,
  opts: InscriptionOptions,
): Uint8Array {
  const script: number[] = [];

  // <pubkey> OP_CHECKSIG
  script.push(...scriptPushData(pubkey));
  script.push(0xac);

  // Single envelope
  script.push(...buildInscriptionEnvelope(opts));

  return new Uint8Array(script);
}

/**
 * Build inscription script for BATCH inscriptions (multiple envelopes)
 * Each inscription gets its own OP_FALSE OP_IF...OP_ENDIF block
 * Use pointer tag to assign each to a different output
 */
export function buildBatchInscriptionScript(
  pubkey: Uint8Array,
  inscriptions: InscriptionOptions[],
): Uint8Array {
  const script: number[] = [];

  // <pubkey> OP_CHECKSIG (only once at the start)
  script.push(...scriptPushData(pubkey));
  script.push(0xac);

  // One envelope per inscription
  for (let i = 0; i < inscriptions.length; i++) {
    const opts = { ...inscriptions[i] };
    // Set pointer for inscriptions after the first
    if (i > 0) {
      opts.pointer = i * Number(POSTAGE); // SAT offset
    }
    script.push(...buildInscriptionEnvelope(opts));
  }

  return new Uint8Array(script);
}

// ============================================================
// COMMIT & REVEAL
// ============================================================

/**
 * Create inscription commit (single or batch)
 * 
 * IMPORTANT: Uses TAPROOT_UNSPENDABLE_KEY as internal key to ensure
 * script-path spend (not key-path). This is required for inscriptions
 * because the inscription data must appear in the witness.
 */
export function createInscriptionCommit(
  inscriptions: InscriptionOptions[],
  feeRate: number,
  destinationAddress: string,
): InscriptionSession {
  const privateKey = schnorr.utils.randomSecretKey();
  const publicKey = schnorr.getPublicKey(privateKey);

  const isBatch = inscriptions.length > 1;
  const inscriptionScript = isBatch
    ? buildBatchInscriptionScript(publicKey, inscriptions)
    : buildInscriptionScript(publicKey, inscriptions[0]);

  // Use UNSPENDABLE internal key to force script-path spend
  // The script itself contains OP_CHECKSIG with the real pubKey
  const internalKey = btc.TAPROOT_UNSPENDABLE_KEY;

  const commitPayment = btc.p2tr(
    internalKey,
    { script: inscriptionScript, leafVersion: 0xc0 },
    undefined,
    true,
  );

  if (!commitPayment.address) {
    throw new Error('Failed to generate commit address');
  }

  // Fee calculation: witness includes signature + full script + control block
  const controlBlockSize = 33; // 1 byte version + 32 bytes internal key
  const witnessSize = inscriptionScript.length + 64 + controlBlockSize + 10;
  const numOutputs = inscriptions.length;
  const nonWitnessSize = 10 + 41 + (numOutputs * 43); // version+locktime + 1 input + N outputs
  const weight = nonWitnessSize * 4 + witnessSize;
  const vsize = Math.ceil(weight / 4);
  const revealFee = BigInt(Math.ceil(vsize * feeRate));
  const totalPostage = POSTAGE * BigInt(numOutputs);
  const requiredAmount = Number(revealFee + totalPostage);

  console.log('[Commit] Script size:', inscriptionScript.length, 'bytes');
  console.log('[Commit] Witness size:', witnessSize, 'bytes');
  console.log('[Commit] vSize:', vsize, 'bytes');
  console.log('[Commit] Fee:', Number(revealFee), 'sats (at', feeRate, 'sat/vB)');
  console.log('[Commit] Required amount:', requiredAmount, 'sats');
  console.log('[Commit] Address:', commitPayment.address);

  return {
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey),
    commitAddress: commitPayment.address,
    commitScriptHex: bytesToHex(commitPayment.script),
    inscriptionScriptHex: bytesToHex(inscriptionScript),
    destinationAddress,
    requiredAmount,
    feeRate,
    status: 'created',
    createdAt: Date.now(),
    imageContentType: inscriptions[0].contentType,
    galleryItemCount: 0,
    totalScriptSize: inscriptionScript.length,
    batchCount: inscriptions.length,
    contentEncoding: inscriptions[0].contentEncoding || undefined,
  };
}

/**
 * Build and sign the reveal transaction (single or batch)
 * Uses the EXACT script stored in the session to avoid any mismatch
 */
export function buildRevealTransaction(
  session: InscriptionSession,
  commitTxid: string,
  commitVout: number,
  commitAmount: number,
): string {
  const privateKey = hexToBytes(session.privateKeyHex);
  const publicKey = hexToBytes(session.publicKeyHex);
  const internalKey = btc.TAPROOT_UNSPENDABLE_KEY;

  console.log('[Reveal] === Building Reveal Transaction ===');
  console.log('[Reveal] commitTxid:', commitTxid);
  console.log('[Reveal] commitVout:', commitVout);
  console.log('[Reveal] commitAmount:', commitAmount, 'sats');
  console.log('[Reveal] requiredAmount:', session.requiredAmount, 'sats');
  console.log('[Reveal] inscriptionScript length:', session.inscriptionScriptHex.length / 2, 'bytes');
  console.log('[Reveal] destination:', session.destinationAddress);
  console.log('[Reveal] batchCount:', session.batchCount);

  // Use the EXACT same script that was used to create the commit address
  const inscriptionScript = hexToBytes(session.inscriptionScriptHex);

  // Recreate the P2TR payment using UNSPENDABLE internal key (same as commit)
  const commitPayment = btc.p2tr(
    internalKey,
    { script: inscriptionScript, leafVersion: 0xc0 },
    undefined,
    true,
  );

  console.log('[Reveal] derived address:', commitPayment.address);
  console.log('[Reveal] expected address:', session.commitAddress);
  console.log('[Reveal] address match:', commitPayment.address === session.commitAddress);

  // Verify the address matches
  if (commitPayment.address !== session.commitAddress) {
    throw new Error(`Address mismatch! Expected ${session.commitAddress} but got ${commitPayment.address}. Session may be corrupted.`);
  }

  // CRITICAL: allowUnknownInputs forces script-path spend for custom scripts
  const tx = new btc.Transaction({ allowUnknownOutputs: true, allowUnknownInputs: true });

  tx.addInput({
    txid: commitTxid,
    index: commitVout,
    witnessUtxo: {
      script: commitPayment.script,
      amount: BigInt(commitAmount),
    },
    // NO tapInternalKey here - we don't want key-path spend
    tapLeafScript: commitPayment.tapLeafScript,
  });

  // One output per inscription (batch or single)
  const numOutputs = session.batchCount || 1;
  const totalPostage = POSTAGE * BigInt(numOutputs);
  const fee = BigInt(commitAmount) - totalPostage;
  console.log('[Reveal] outputs:', numOutputs, 'x', Number(POSTAGE), 'sats');
  console.log('[Reveal] total postage:', Number(totalPostage), 'sats');
  console.log('[Reveal] fee:', Number(fee), 'sats');

  for (let i = 0; i < numOutputs; i++) {
    tx.addOutputAddress(session.destinationAddress, POSTAGE);
  }

  tx.sign(privateKey);
  console.log('[Reveal] ✅ Signed (script-path)');

  tx.finalize();
  console.log('[Reveal] ✅ Finalized');

  const rawTx = tx.extract();
  console.log('[Reveal] Raw tx size:', rawTx.length, 'bytes');

  // Sanity check: script-path tx should be much larger than 200 bytes
  if (rawTx.length < 200) {
    throw new Error(`Transaction too small (${rawTx.length} bytes) - likely key-path instead of script-path spend!`);
  }

  return bytesToHex(rawTx);
}

/**
 * Check if the commit address has been funded
 */
export async function checkCommitFunding(commitAddress: string): Promise<{
  funded: boolean;
  txid?: string;
  vout?: number;
  amount?: number;
}> {
  try {
    const response = await fetch(`${MEMPOOL_API}/address/${commitAddress}/utxo`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const utxos = await response.json();
    if (utxos.length > 0) {
      const utxo = utxos[0];
      return { funded: true, txid: utxo.txid, vout: utxo.vout, amount: utxo.value };
    }
    return { funded: false };
  } catch (error) {
    console.error('Error checking commit funding:', error);
    return { funded: false };
  }
}

/**
 * Broadcast a raw transaction
 */
export async function broadcastTransaction(rawTxHex: string): Promise<string> {
  const response = await fetch(`${MEMPOOL_API}/tx`, {
    method: 'POST',
    body: rawTxHex,
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Broadcast failed: ${errorText}`);
  }
  return (await response.text()).trim();
}

/**
 * Get recommended fee rates
 */
export async function getRecommendedFees(): Promise<{
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
  minimum: number;
}> {
  const response = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  const data = await response.json();
  return {
    fastest: Math.ceil(data.fastestFee),
    halfHour: Math.ceil(data.halfHourFee),
    hour: Math.ceil(data.hourFee),
    economy: Math.ceil(data.economyFee),
    minimum: Math.ceil(data.minimumFee),
  };
}

// ============================================================
// ESTIMATION
// ============================================================

/**
 * Estimate inscription size and cost
 */
export function estimateInscription(
  bodySizes: number[],
  galleryDataSize: number,
  metadataSize: number,
  feeRate: number,
): {
  totalScriptSize: number;
  virtualSize: number;
  fee: number;
  commitAmount: number;
} {
  const numInscriptions = bodySizes.length;
  let totalBodySize = 0;
  let totalChunkOverhead = 0;

  for (const size of bodySizes) {
    totalBodySize += size;
    totalChunkOverhead += Math.ceil(size / MAX_CHUNK_SIZE) * 3;
  }

  const envelopeOverhead = numInscriptions * 15; // OP_FALSE OP_IF "ord" tag1 ct OP_0 OP_ENDIF per envelope
  const galleryChunkOverhead = galleryDataSize > 0 ? Math.ceil(galleryDataSize / MAX_CHUNK_SIZE) * 5 : 0;
  const metadataChunkOverhead = metadataSize > 0 ? Math.ceil(metadataSize / MAX_CHUNK_SIZE) * 5 : 0;
  const pubkeyOverhead = 34; // 32-byte pubkey + OP_CHECKSIG + push opcode

  const totalScriptSize = pubkeyOverhead + envelopeOverhead +
    galleryDataSize + galleryChunkOverhead +
    metadataSize + metadataChunkOverhead +
    totalBodySize + totalChunkOverhead;

  const nonWitnessSize = 10 + 41 + (numInscriptions * 43);
  const witnessSize = totalScriptSize + 64 + 33 + 10;
  const weight = nonWitnessSize * 4 + witnessSize;
  const virtualSize = Math.ceil(weight / 4);
  const fee = Math.ceil(virtualSize * feeRate);
  const commitAmount = fee + Number(POSTAGE) * numInscriptions;

  return { totalScriptSize, virtualSize, fee, commitAmount };
}

// ============================================================
// CONTENT TYPE DETECTION
// ============================================================

export function detectContentType(fileName: string, data: Uint8Array): string {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif';
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return 'image/webp';
  if (data.length > 8) {
    const ftypCheck = new TextDecoder().decode(data.slice(4, 8));
    if (ftypCheck === 'ftyp') return 'image/avif';
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'webp': 'image/webp', 'avif': 'image/avif',
    'svg': 'image/svg+xml', 'html': 'text/html;charset=utf-8',
    'json': 'application/json', 'txt': 'text/plain;charset=utf-8',
    'js': 'application/javascript', 'css': 'text/css',
  };
  return mimeMap[ext || ''] || 'application/octet-stream';
}

/** Check if content type is text-based (benefits from brotli) */
export function isTextBasedContent(contentType: string): boolean {
  return contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('javascript') ||
    contentType.includes('xml') ||
    contentType.includes('svg');
}

// ============================================================
// SESSION PERSISTENCE
// ============================================================
const SESSION_KEY = 'gallery_inscription_session';
const IMAGE_KEY = 'gallery_inscription_image';
const GALLERY_KEY = 'gallery_inscription_gallery';
const BATCH_KEY = 'gallery_inscription_batch';

export function saveSession(session: InscriptionSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { console.error('Save session error:', e); }
}
export function loadSession(): InscriptionSession | null {
  try { const d = localStorage.getItem(SESSION_KEY); return d ? JSON.parse(d) : null; } catch { return null; }
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
}

export function saveImageData(hex: string) {
  try { localStorage.setItem(IMAGE_KEY, hex); } catch (e) { console.error('Save image error:', e); }
}
export function loadImageData(): string | null {
  try { return localStorage.getItem(IMAGE_KEY); } catch { return null; }
}

export function saveGalleryDataHex(hex: string) {
  try { localStorage.setItem(GALLERY_KEY, hex); } catch (e) { console.error('Save gallery error:', e); }
}
export function loadGalleryDataHex(): string | null {
  try { return localStorage.getItem(GALLERY_KEY); } catch { return null; }
}

export function saveBatchDataHex(hex: string) {
  try { localStorage.setItem(BATCH_KEY, hex); } catch (e) { console.error('Save batch error:', e); }
}
export function loadBatchDataHex(): string | null {
  try { return localStorage.getItem(BATCH_KEY); } catch { return null; }
}

export function clearAllData() {
  clearSession();
  try {
    localStorage.removeItem(IMAGE_KEY);
    localStorage.removeItem(GALLERY_KEY);
    localStorage.removeItem(BATCH_KEY);
  } catch { /* */ }
}
