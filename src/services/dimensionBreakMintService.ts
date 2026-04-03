/**
 * Dimension Break Mint Service
 *
 * Free mint – 100 recursive HTML-Ordinals (pixel art, 75×75).
 * Uses the Ordlify <recursive-images> library for on-chain rendering.
 * Limit: 1 per wallet address.
 */

import { createUnisatInscription } from './unisatService';
import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl();
const ORDLIFY_SCRIPT_ID = '10548d936eb4116ac5b4d31cc49e68b6a664246dd97c0fceb61f63a9f4863995i0';

export interface DimensionBreakItem {
  index: number;
  layers: Array<{
    layerName: string;
    traitType: string;
    trait: { inscriptionId: string; name: string; rarity: number; contentType: string };
  }>;
  svg?: string;
}

export interface DimensionBreakCollection {
  totalCount: number;
  viewBox: string;
  generated: DimensionBreakItem[];
}

export async function loadDimensionBreakCollection(): Promise<DimensionBreakCollection | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/dimension-break-collection.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.generated || !Array.isArray(data.generated) || data.generated.length === 0) return null;
    console.log(`[DimensionBreak] Collection loaded: ${data.generated.length} items`);
    return {
      totalCount: data.totalCount || data.generated.length,
      viewBox: data.viewBox || '0 0 75 75',
      generated: data.generated,
    };
  } catch (err) {
    console.error('[DimensionBreak] Failed to load collection:', err);
    return null;
  }
}

function buildInscriptionHtml(item: DimensionBreakItem, viewBox: string): string {
  const vb = viewBox.trim().split(/\s+/).map(Number);
  const w = Number.isFinite(vb[2]) ? vb[2] : 75;
  const h = Number.isFinite(vb[3]) ? vb[3] : 75;
  const ids = item.layers.map(l => l.trait.inscriptionId).join(', ');
  return `<html>\n<head>\n  <script src="/content/${ORDLIFY_SCRIPT_ID}"></script>\n</head>\n<body style="margin:0;aspect-ratio:1/1">\n  <recursive-images type="pixel" inscriptions="${ids}" width="${w}" height="${h}" />\n</body>\n</html>`;
}

export async function loadMintCount(): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/api/dimension-break/count`);
    if (res.ok) {
      const data = await res.json();
      return data.totalMints || 0;
    }
  } catch { /* ignore */ }
  return 0;
}

export async function loadMintedIndices(): Promise<number[]> {
  try {
    const res = await fetch(`${API_URL}/api/dimension-break/minted-indices`);
    if (res.ok) {
      const data = await res.json();
      return data.mintedIndices || [];
    }
  } catch { /* ignore */ }
  return [];
}

export async function loadAddressMintCount(address: string): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/api/dimension-break/address-mints?address=${encodeURIComponent(address)}`);
    if (res.ok) {
      const data = await res.json();
      return data.count || 0;
    }
  } catch { /* ignore */ }
  return 0;
}

export async function logDimensionBreakMint(payload: {
  walletAddress: string;
  inscriptionId: string;
  txid: string | null;
  orderId: string | null;
  itemName: string;
  itemIndex: number;
  paymentTxid: string | null;
}): Promise<void> {
  try {
    await fetch(`${API_URL}/api/dimension-break/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[DimensionBreak] Log failed:', err);
  }
}

export async function updateDimensionBreakHashlist(payload: {
  inscriptionId: string;
  itemIndex: number;
  name: string;
  attributes: Array<{ trait_type: string; value: string }>;
}): Promise<void> {
  try {
    await fetch(`${API_URL}/api/dimension-break/hashlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[DimensionBreak] Hashlist update failed:', err);
  }
}

export async function mintDimensionBreak(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  mintedIndices: number[] = []
): Promise<{ inscriptionId: string; txid?: string; orderId?: string; paymentTxid?: string; item: DimensionBreakItem }> {
  if (!buyerAddress.startsWith('bc1p')) {
    throw new Error(
      'Inscriptions require a Taproot address (bc1p…).\n\n' +
      'In UniSat: Click your address → Settings → Address Type → Taproot (P2TR)\n' +
      'Then reconnect your wallet.'
    );
  }

  const collection = await loadDimensionBreakCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('Dimension Break collection could not be loaded.');
  }

  const mintedSet = new Set(mintedIndices);
  const available = collection.generated.filter(item => !mintedSet.has(item.index));

  if (available.length === 0) {
    throw new Error('All Dimension Break items have been minted – SOLD OUT!');
  }

  const randomIdx = Math.floor(Math.random() * available.length);
  const item = available[randomIdx];
  console.log(`[DimensionBreak] Selected item #${item.index} (${available.length} available)`);

  const htmlContent = buildInscriptionHtml(item, collection.viewBox);
  const htmlFile = new File([htmlContent], `dimension-break-${item.index}.html`, { type: 'text/html' });

  const result = await createUnisatInscription({
    file: htmlFile,
    address: buyerAddress,
    feeRate,
    postage: 330,
  });

  console.log(`[DimensionBreak] Inscription created: ${result.inscriptionId}`);

  if (!result.payAddress || !result.amount) {
    throw new Error('UniSat API did not return a pay address or amount.');
  }

  // Free mint – only inscription fees
  const { sendBitcoinViaUnisat, sendBitcoinViaXverse, sendBitcoinViaOKX } = await import('../utils/wallet');

  let paymentTxid: string | undefined;
  if (walletType === 'unisat') {
    paymentTxid = await sendBitcoinViaUnisat(result.payAddress, result.amount);
  } else if (walletType === 'okx') {
    paymentTxid = await sendBitcoinViaOKX(result.payAddress, result.amount);
  } else {
    paymentTxid = await sendBitcoinViaXverse(result.payAddress, result.amount);
  }

  if (!paymentTxid) throw new Error('Payment failed.');
  console.log(`[DimensionBreak] ✅ Payment successful: ${paymentTxid}`);

  return { inscriptionId: result.inscriptionId, txid: result.txid || result.orderId, orderId: result.orderId, paymentTxid, item };
}
