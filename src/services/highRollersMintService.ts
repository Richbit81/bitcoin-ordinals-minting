/**
 * High Rollers Mint Service (UniSat path)
 *
 * Same model as Primal Club / Bad Cats: create the inscription via UniSat OpenAPI
 * (through our backend proxy). No ord-companion / parent / local node required.
 *
 * Price: 5,000 sats + inscription fees. Progressive volume discount on margin.
 */

import { createUnisatInscription } from './unisatService';
import {
  sendMultipleBitcoinPayments,
  sendBitcoinViaUnisat,
  sendBitcoinViaXverse,
  sendBitcoinViaOKX,
} from '../utils/wallet';
import { highRollersImageUrl } from './highRollersService';

const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft';
export const HIGH_ROLLERS_PRICE_SATS = 5000;
const POSTAGE_SATS = 546;

export const HIGH_ROLLERS_VOL_DISCOUNT_STEP = 0.05;
export const HIGH_ROLLERS_MAX_PER_TX = 5;

export function highRollersVolumeMargin(qty: number): number {
  const n = Math.max(0, Math.floor(qty));
  if (n <= 0) return 0;
  const factor = Math.max(0, 1 - HIGH_ROLLERS_VOL_DISCOUNT_STEP * (n - 1));
  return Math.round(HIGH_ROLLERS_PRICE_SATS * n * factor);
}

export interface HighRollersItem {
  index: number;
  itemId: string; // "0001"
  name: string;
  image: string; // "0001.avif"
  attributes: Array<{ trait_type: string; value: string }>;
}

export interface HighRollersCollection {
  collectionName: string;
  totalCount: number;
  generated: HighRollersItem[];
}

export async function loadHighRollersCollection(): Promise<HighRollersCollection | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/high-rollers-collection.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.generated || !Array.isArray(data.generated) || data.generated.length === 0) return null;
    return {
      collectionName: data.collectionName || 'High Rollers',
      totalCount: data.totalCount || data.generated.length,
      generated: data.generated,
    };
  } catch (err) {
    console.error('[HighRollersMint] Collection load failed:', err);
    return null;
  }
}

function imageUrlFor(item: HighRollersItem): string {
  return highRollersImageUrl(item.itemId || String(item.index).padStart(4, '0'));
}

export interface HighRollersMintedItem {
  inscriptionId: string;
  orderId?: string;
  txid?: string;
  item: HighRollersItem;
}

async function prepareOne(
  item: HighRollersItem,
  buyerAddress: string,
  feeRate: number,
): Promise<{ payAddress: string; amount: number; inscriptionId: string; orderId?: string; txid?: string; item: HighRollersItem }> {
  const imgRes = await fetch(imageUrlFor(item), { cache: 'no-store' });
  if (!imgRes.ok) throw new Error(`Image could not be loaded: ${item.image} (${imgRes.status})`);
  const blob = await imgRes.blob();
  const imageFile = new File([blob], item.image || `${item.itemId}.avif`, { type: 'image/avif' });

  const result = await createUnisatInscription({
    file: imageFile,
    address: buyerAddress,
    feeRate,
    postage: POSTAGE_SATS,
    // deliberately NO parentInscriptionId — parent UTXO is unavailable
  });
  if (!result.payAddress || !result.amount) {
    throw new Error(`UniSat returned no pay address/amount for #${item.index}`);
  }
  return {
    payAddress: result.payAddress,
    amount: result.amount,
    inscriptionId: result.inscriptionId,
    orderId: result.orderId,
    txid: result.txid || result.orderId,
    item,
  };
}

/**
 * Mint `quantity` random High Rollers via UniSat in one combined wallet payment.
 * `mintedItemIds` = already-minted item ids (e.g. "0108").
 */
export async function mintHighRollersBatch(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  quantity: number,
  mintedItemIds: string[] = [],
): Promise<{ paymentTxid?: string; items: HighRollersMintedItem[] }> {
  if (!buyerAddress.startsWith('bc1p')) {
    throw new Error(
      'Inscriptions require a Taproot address (bc1p…).\n\n' +
        'In UniSat: Click your address → Settings → Address Type → Taproot (P2TR)\n' +
        'Then reconnect your wallet.',
    );
  }
  if (!walletType) throw new Error('Wallet type not detected.');

  const qty = Math.max(1, Math.min(HIGH_ROLLERS_MAX_PER_TX, Math.floor(quantity) || 1));
  const collection = await loadHighRollersCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('High Rollers collection could not be loaded.');
  }

  const excluded = new Set(mintedItemIds.map((x) => String(x).padStart(4, '0')));
  const pool = collection.generated.filter((it) => !excluded.has(String(it.itemId).padStart(4, '0')));
  if (pool.length < qty) {
    throw new Error(`Only ${pool.length} High Roller(s) left.`);
  }

  const picks: HighRollersItem[] = [];
  const bag = [...pool];
  for (let i = 0; i < qty; i++) {
    const idx = Math.floor(Math.random() * bag.length);
    picks.push(bag[idx]);
    bag.splice(idx, 1);
  }

  console.log(`[HighRollersMint] Picked: ${picks.map((p) => p.itemId).join(', ')}`);

  const prepared = [];
  for (const item of picks) {
    prepared.push(await prepareOne(item, buyerAddress, feeRate));
  }

  const marginSats = highRollersVolumeMargin(qty);
  const payments: Array<{ address: string; amount: number }> = [];
  if (marginSats > 0) {
    payments.push({ address: ADMIN_PAYMENT_ADDRESS, amount: marginSats / 100_000_000 });
  }
  for (const p of prepared) payments.push({ address: p.payAddress, amount: p.amount });

  let paymentTxid: string | undefined;
  if (payments.length === 1) {
    const p = payments[0];
    if (walletType === 'unisat') paymentTxid = await sendBitcoinViaUnisat(p.address, p.amount);
    else if (walletType === 'okx') paymentTxid = await sendBitcoinViaOKX(p.address, p.amount);
    else paymentTxid = await sendBitcoinViaXverse(p.address, p.amount);
  } else {
    paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);
  }
  if (!paymentTxid) throw new Error('Payment failed.');

  console.log(`[HighRollersMint] ✅ Payment OK: ${paymentTxid}`);

  return {
    paymentTxid,
    items: prepared.map((p) => ({
      inscriptionId: p.inscriptionId,
      orderId: p.orderId,
      txid: p.txid,
      item: p.item,
    })),
  };
}
