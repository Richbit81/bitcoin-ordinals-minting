/**
 * Gallery Inscription Builder
 * 
 * Erstellt Bitcoin Ordinals Gallery Inscriptions ohne externen Service.
 * Nutzt das Commit+Reveal Transaktionsmuster.
 * 
 * Technische Details:
 * - Inscription Envelope: OP_FALSE OP_IF "ord" [tags] OP_0 [body] OP_ENDIF
 * - Tag 1 = Content-Type
 * - Tag 3 = Parent Inscription ID
 * - Tag 17 = Gallery/Properties (CBOR-encoded)
 * - Body = Image data (split in 520-byte chunks)
 * - Commit: P2TR Adresse aus Internal Key + Inscription Script
 * - Reveal: Script-Path Spend der Commit UTXO
 */

import * as btc from '@scure/btc-signer';
import { hex as hexCodec } from '@scure/base';
import { schnorr } from '@noble/curves/secp256k1.js';

// ============================================================
// CONSTANTS
// ============================================================
const POSTAGE = 546n; // Minimum dust limit in sats
const MAX_CHUNK_SIZE = 520; // Max bytes per script push
const MEMPOOL_API = 'https://mempool.space/api';

// ============================================================
// TYPES
// ============================================================
export interface GalleryItem {
  id: string; // Full inscription ID (e.g., "abc123...i0")
  meta: {
    name: string;
    attributes: Array<{ trait_type: string; value: string }>;
  };
}

export interface InscriptionSession {
  privateKeyHex: string;
  publicKeyHex: string;
  commitAddress: string;
  commitScriptHex: string;
  destinationAddress: string;
  requiredAmount: number;
  feeRate: number;
  status: 'created' | 'funded' | 'revealed' | 'error';
  commitTxid?: string;
  commitVout?: number;
  revealTxid?: string;
  inscriptionId?: string;
  createdAt: number;
  imageContentType: string;
  galleryItemCount: number;
  totalScriptSize: number;
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
// HELPER FUNCTIONS
// ============================================================

/** Hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  return hexCodec.decode(hex);
}

/** Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return hexCodec.encode(bytes);
}

/** Parse inscription ID into txid bytes + index */
function parseInscriptionId(id: string): { txidBytes: Uint8Array; index: number } {
  const parts = id.split('i');
  const txidHex = parts[0];
  const index = parseInt(parts[1] || '0', 10);
  // Store txid in display order (as shown in the inscription ID)
  const txidBytes = hexToBytes(txidHex);
  return { txidBytes, index };
}

/** Push data onto a Bitcoin script with proper opcodes */
function scriptPushData(data: Uint8Array): number[] {
  const result: number[] = [];
  if (data.length === 0) {
    result.push(0x00); // OP_0
  } else if (data.length <= 75) {
    result.push(data.length); // OP_PUSHBYTES_N
    result.push(...data);
  } else if (data.length <= 255) {
    result.push(0x4c); // OP_PUSHDATA1
    result.push(data.length);
    result.push(...data);
  } else if (data.length <= 65535) {
    result.push(0x4d); // OP_PUSHDATA2
    result.push(data.length & 0xff);
    result.push((data.length >> 8) & 0xff);
    result.push(...data);
  } else {
    result.push(0x4e); // OP_PUSHDATA4
    result.push(data.length & 0xff);
    result.push((data.length >> 8) & 0xff);
    result.push((data.length >> 16) & 0xff);
    result.push((data.length >> 24) & 0xff);
    result.push(...data);
  }
  return result;
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Encode gallery items as CBOR
 * 
 * Format (based on analysis of existing gallery inscriptions):
 * {
 *   0: [
 *     {
 *       0: <inscription_id_bytes>,     // 32 bytes (txid) or 36 bytes (txid + index)
 *       1: {
 *         0: "Item Name",
 *         1: { "TraitType": "TraitValue", ... }
 *       }
 *     },
 *     ...
 *   ]
 * }
 */
export function encodeGalleryAsCBOR(items: GalleryItem[]): Uint8Array {
  const encoder = new CBOREncoder();

  // Outer map with 1 entry
  encoder.encodeMapHeader(1);
  encoder.encodeUint(0); // key 0

  // Array of gallery items
  encoder.encodeArrayHeader(items.length);

  for (const item of items) {
    const { txidBytes, index } = parseInscriptionId(item.id);

    // Item map: {0: id_bytes, 1: metadata}
    encoder.encodeMapHeader(2);

    // Key 0: inscription ID bytes
    encoder.encodeUint(0);
    if (index > 0) {
      // Append 4-byte LE index
      const idBytes = new Uint8Array(txidBytes.length + 4);
      idBytes.set(txidBytes);
      idBytes[txidBytes.length] = index & 0xff;
      idBytes[txidBytes.length + 1] = (index >> 8) & 0xff;
      idBytes[txidBytes.length + 2] = (index >> 16) & 0xff;
      idBytes[txidBytes.length + 3] = (index >> 24) & 0xff;
      encoder.encodeBytes(idBytes);
    } else {
      encoder.encodeBytes(txidBytes);
    }

    // Key 1: metadata
    encoder.encodeUint(1);
    const attrs = item.meta.attributes;
    encoder.encodeMapHeader(2);

    // Metadata key 0: name
    encoder.encodeUint(0);
    encoder.encodeText(item.meta.name);

    // Metadata key 1: attributes as flat map {trait_type: value}
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
 * Build the inscription script (Tapscript leaf)
 * 
 * Format:
 * <pubkey> OP_CHECKSIG
 * OP_FALSE OP_IF
 *   OP_PUSH "ord"
 *   OP_PUSH <tag1_byte> OP_PUSH <content-type>
 *   [OP_PUSH <tag3_byte> OP_PUSH <parent_id>]...
 *   [OP_PUSH <tag17_byte> OP_PUSH <gallery_chunk>]...
 *   OP_0
 *   OP_PUSH <body_chunk_1>
 *   OP_PUSH <body_chunk_2>
 *   ...
 * OP_ENDIF
 */
export function buildInscriptionScript(
  pubkey: Uint8Array,
  contentType: string,
  body: Uint8Array,
  galleryData: Uint8Array | null = null,
  parentIds: string[] = [],
): Uint8Array {
  const script: number[] = [];

  // <pubkey> OP_CHECKSIG
  script.push(...scriptPushData(pubkey));
  script.push(0xac); // OP_CHECKSIG

  // OP_FALSE OP_IF
  script.push(0x00); // OP_FALSE
  script.push(0x63); // OP_IF

  // Push "ord"
  script.push(...scriptPushData(new TextEncoder().encode('ord')));

  // Tag 1: content-type
  script.push(...scriptPushData(new Uint8Array([0x01])));
  script.push(...scriptPushData(new TextEncoder().encode(contentType)));

  // Tag 3: parent inscription IDs (optional)
  for (const parentId of parentIds) {
    const { txidBytes, index } = parseInscriptionId(parentId);
    script.push(...scriptPushData(new Uint8Array([0x03])));
    if (index > 0) {
      const idBytes = new Uint8Array(txidBytes.length + 4);
      idBytes.set(txidBytes);
      idBytes[txidBytes.length] = index & 0xff;
      idBytes[txidBytes.length + 1] = (index >> 8) & 0xff;
      idBytes[txidBytes.length + 2] = (index >> 16) & 0xff;
      idBytes[txidBytes.length + 3] = (index >> 24) & 0xff;
      script.push(...scriptPushData(idBytes));
    } else {
      script.push(...scriptPushData(txidBytes));
    }
  }

  // Tag 17: gallery/properties data (split into MAX_CHUNK_SIZE chunks)
  if (galleryData && galleryData.length > 0) {
    for (let i = 0; i < galleryData.length; i += MAX_CHUNK_SIZE) {
      const end = Math.min(i + MAX_CHUNK_SIZE, galleryData.length);
      const chunk = galleryData.slice(i, end);
      script.push(...scriptPushData(new Uint8Array([0x11]))); // tag 17
      script.push(...scriptPushData(chunk));
    }
  }

  // OP_0 (body separator)
  script.push(0x00);

  // Body data chunks
  for (let i = 0; i < body.length; i += MAX_CHUNK_SIZE) {
    const end = Math.min(i + MAX_CHUNK_SIZE, body.length);
    const chunk = body.slice(i, end);
    script.push(...scriptPushData(chunk));
  }

  // OP_ENDIF
  script.push(0x68);

  return new Uint8Array(script);
}

/**
 * Generate a new inscription keypair and derive the commit address
 */
export function createInscriptionCommit(
  contentType: string,
  imageData: Uint8Array,
  galleryData: Uint8Array | null,
  feeRate: number,
  destinationAddress: string,
  parentIds: string[] = [],
): InscriptionSession {
  // Generate random keypair
  const privateKey = schnorr.utils.randomPrivateKey();
  const publicKey = schnorr.getPublicKey(privateKey);

  // Build inscription script
  const inscriptionScript = buildInscriptionScript(
    publicKey,
    contentType,
    imageData,
    galleryData,
    parentIds,
  );

  // Create P2TR commit address
  const commitPayment = btc.p2tr(
    publicKey,
    { script: inscriptionScript, leafVersion: 0xc0 },
    undefined, // mainnet
    true, // allowUnknownOutputs
  );

  if (!commitPayment.address) {
    throw new Error('Failed to generate commit address');
  }

  // Calculate required amount
  // Reveal tx: non-witness ~94 bytes, witness = script + signature + control block
  const witnessSize = inscriptionScript.length + 64 + 33 + 10; // script + sig + control + overhead
  const nonWitnessSize = 94;
  const weight = nonWitnessSize * 4 + witnessSize;
  const vsize = Math.ceil(weight / 4);
  const revealFee = BigInt(Math.ceil(vsize * feeRate));
  const requiredAmount = Number(revealFee + POSTAGE);

  const session: InscriptionSession = {
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey),
    commitAddress: commitPayment.address,
    commitScriptHex: bytesToHex(commitPayment.script),
    destinationAddress,
    requiredAmount,
    feeRate,
    status: 'created',
    createdAt: Date.now(),
    imageContentType: contentType,
    galleryItemCount: 0,
    totalScriptSize: inscriptionScript.length,
  };

  return session;
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
      // Use the first (and hopefully only) UTXO
      const utxo = utxos[0];
      return {
        funded: true,
        txid: utxo.txid,
        vout: utxo.vout,
        amount: utxo.value,
      };
    }

    return { funded: false };
  } catch (error) {
    console.error('Error checking commit funding:', error);
    return { funded: false };
  }
}

/**
 * Build and sign the reveal transaction
 */
export function buildRevealTransaction(
  session: InscriptionSession,
  commitTxid: string,
  commitVout: number,
  commitAmount: number,
  imageData: Uint8Array,
  galleryData: Uint8Array | null,
  parentIds: string[] = [],
): string {
  const privateKey = hexToBytes(session.privateKeyHex);
  const publicKey = hexToBytes(session.publicKeyHex);

  // Rebuild the inscription script
  const inscriptionScript = buildInscriptionScript(
    publicKey,
    session.imageContentType,
    imageData,
    galleryData,
    parentIds,
  );

  // Recreate the commit payment to get the output script
  const commitPayment = btc.p2tr(
    publicKey,
    { script: inscriptionScript, leafVersion: 0xc0 },
    undefined,
    true,
  );

  // Build the reveal transaction
  const tx = new btc.Transaction({ allowUnknownOutputs: true });

  tx.addInput({
    txid: commitTxid,
    index: commitVout,
    witnessUtxo: {
      script: commitPayment.script,
      amount: BigInt(commitAmount),
    },
    tapInternalKey: publicKey,
    tapLeafScript: [{
      version: 0xc0,
      script: inscriptionScript,
    }],
  });

  // Output to destination address with postage
  tx.addOutputAddress(session.destinationAddress, POSTAGE);

  // Sign with the inscription private key
  tx.sign(privateKey);
  tx.finalize();

  return bytesToHex(tx.extract());
}

/**
 * Broadcast a raw transaction via mempool.space API
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

  const txid = await response.text();
  return txid.trim();
}

/**
 * Get current recommended fee rates from mempool.space
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
// SESSION PERSISTENCE (localStorage)
// ============================================================
const SESSION_KEY = 'gallery_inscription_session';

export function saveSession(session: InscriptionSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

export function loadSession(): InscriptionSession | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load session:', e);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to clear session:', e);
  }
}

// ============================================================
// IMAGE DATA PERSISTENCE (localStorage for recovery)
// ============================================================
const IMAGE_KEY = 'gallery_inscription_image';
const GALLERY_KEY = 'gallery_inscription_gallery';

export function saveImageData(imageDataHex: string) {
  try {
    localStorage.setItem(IMAGE_KEY, imageDataHex);
  } catch (e) {
    console.error('Failed to save image data (too large for localStorage?):', e);
  }
}

export function loadImageData(): string | null {
  try {
    return localStorage.getItem(IMAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function saveGalleryDataHex(galleryDataHex: string) {
  try {
    localStorage.setItem(GALLERY_KEY, galleryDataHex);
  } catch (e) {
    console.error('Failed to save gallery data:', e);
  }
}

export function loadGalleryDataHex(): string | null {
  try {
    return localStorage.getItem(GALLERY_KEY);
  } catch (e) {
    return null;
  }
}

export function clearAllData() {
  clearSession();
  try {
    localStorage.removeItem(IMAGE_KEY);
    localStorage.removeItem(GALLERY_KEY);
  } catch (e) {
    // ignore
  }
}

/**
 * Estimate the total size and cost of an inscription
 */
export function estimateInscription(
  imageSize: number,
  galleryDataSize: number,
  feeRate: number,
): {
  totalScriptSize: number;
  virtualSize: number;
  fee: number;
  commitAmount: number;
} {
  // Rough script overhead per chunk: tag (2 bytes) + push opcode (3 bytes) = 5 bytes
  const galleryChunks = Math.ceil(galleryDataSize / MAX_CHUNK_SIZE);
  const bodyChunks = Math.ceil(imageSize / MAX_CHUNK_SIZE);
  const overhead = 32 + 1 + 1 + 1 + 4 + 3 + 30 + 1 + 1; // pubkey + opcodes + "ord" + tag1 + content-type
  const tagOverhead = galleryChunks * 5; // per-chunk tag + push overhead
  const bodyOverhead = bodyChunks * 3; // per-chunk push overhead

  const totalScriptSize = overhead + tagOverhead + galleryDataSize + bodyOverhead + imageSize;

  // Weight: non-witness * 4 + witness * 1
  const nonWitnessSize = 94;
  const witnessSize = totalScriptSize + 64 + 33 + 10; // script + sig + control + varints
  const weight = nonWitnessSize * 4 + witnessSize;
  const virtualSize = Math.ceil(weight / 4);
  const fee = Math.ceil(virtualSize * feeRate);
  const commitAmount = fee + Number(POSTAGE);

  return { totalScriptSize, virtualSize, fee, commitAmount };
}

/**
 * Detect MIME type from file extension or magic bytes
 */
export function detectContentType(fileName: string, data: Uint8Array): string {
  // Check magic bytes first
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png';
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return 'image/gif';
  }
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    return 'image/webp';
  }
  // Check AVIF
  if (data.length > 8) {
    const ftypCheck = new TextDecoder().decode(data.slice(4, 8));
    if (ftypCheck === 'ftyp') return 'image/avif';
  }

  // Fallback to file extension
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
    'html': 'text/html;charset=utf-8',
    'json': 'application/json',
    'txt': 'text/plain;charset=utf-8',
  };

  return mimeMap[ext || ''] || 'application/octet-stream';
}
