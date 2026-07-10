/**
 * Primal Club Mint Service
 *
 * Mintet 1 zufälliges Primal-Club-Item. Im Gegensatz zu den rekursiven
 * Kollektionen (BadCats/SLUMS) wird hier das ECHTE AVIF-Bild direkt on-chain
 * inskribiert (content-type image/avif).
 *
 * Preis: 5.000 sats + Inscription-Fees.
 *
 * Die Metadaten (Traits) werden NICHT in die Inscription eingebettet, sondern
 * nach dem Mint zusammen mit der (final aufgelösten) Inscription-ID in der
 * Backend-Hashlist (PostgreSQL) gespeichert — siehe PrimalClubPage.handleMint.
 */

import { createUnisatInscription } from './unisatService';
import {
  sendMultipleBitcoinPayments,
  sendBitcoinViaUnisat,
  sendBitcoinViaXverse,
  sendBitcoinViaOKX,
} from '../utils/wallet';

const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft';
const PRIMAL_CLUB_PRICE_SATS = 5000;
const PRIMAL_CLUB_PRICE_BTC = PRIMAL_CLUB_PRICE_SATS / 100_000_000;
const POSTAGE_SATS = 546;

// Progressive volume discount on the collection margin only (inscription fees
// stay per item). -5% per additional item → 5 paid items = one free (-20%).
export const PRIMAL_CLUB_VOL_DISCOUNT_STEP = 0.05;
export const PRIMAL_CLUB_MAX_PER_TX = 5;

/** Total margin (sats) for `qty` PAID items after the progressive discount. */
export function primalClubVolumeMargin(qty: number): number {
  const n = Math.max(0, Math.floor(qty));
  if (n <= 0) return 0;
  const factor = Math.max(0, 1 - PRIMAL_CLUB_VOL_DISCOUNT_STEP * (n - 1));
  return Math.round(PRIMAL_CLUB_PRICE_SATS * n * factor);
}

export interface PrimalClubTrait {
  trait_type: string;
  value: string;
}

export interface PrimalClubItem {
  index: number;
  name: string;
  image: string; // Dateiname, z.B. "0001.avif"
  attributes: PrimalClubTrait[];
}

export interface PrimalClubCollection {
  collectionName: string;
  totalCount: number;
  generated: PrimalClubItem[];
}

export function isTaprootAddress(address: string): boolean {
  return typeof address === 'string' && address.startsWith('bc1p');
}

function imageUrlFor(item: PrimalClubItem): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}images/primal-club/${item.image}`;
}

export function primalClubImageUrl(image: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}images/primal-club/${image}`;
}

export async function loadPrimalClubCollection(): Promise<PrimalClubCollection | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/primal-club-collection.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.generated || !Array.isArray(data.generated) || data.generated.length === 0) return null;
    console.log(`[PrimalClubMint] Collection geladen: ${data.generated.length} Items`);
    return {
      collectionName: data.collectionName || 'Primal Club',
      totalCount: data.totalCount || data.generated.length,
      generated: data.generated,
    };
  } catch (err) {
    console.error('[PrimalClubMint] Fehler beim Laden der Collection:', err);
    return null;
  }
}

export async function mintPrimalClubRandom(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  isFree: boolean = false,
  mintedIndices: number[] = [],
  forcedIndex?: number
): Promise<{ inscriptionId: string; txid?: string; orderId?: string; paymentTxid?: string; item: PrimalClubItem }> {

  if (!buyerAddress.startsWith('bc1p')) {
    throw new Error(
      'Inscriptions require a Taproot address (bc1p...).\n\n' +
      'In UniSat: Click your address → Settings → Address Type → Taproot (P2TR)\n' +
      'Then reconnect your wallet.'
    );
  }

  const collection = await loadPrimalClubCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('Primal Club Collection konnte nicht geladen werden.');
  }

  const mintedSet = new Set(mintedIndices);
  const available = collection.generated.filter((item) => !mintedSet.has(item.index));

  if (available.length === 0) {
    throw new Error('Alle Primal Club Items sind bereits gemintet – SOLD OUT!');
  }

  console.log(`[PrimalClubMint] Verfügbar: ${available.length} von ${collection.generated.length}`);

  let item: PrimalClubItem | undefined;
  if (forcedIndex != null && Number.isFinite(forcedIndex)) {
    item = collection.generated.find((g) => g.index === forcedIndex);
    if (!item) throw new Error(`Primal Club #${forcedIndex} is not in the collection.`);
    if (mintedSet.has(forcedIndex)) throw new Error(`Primal Club #${forcedIndex} is already minted.`);
  } else {
    item = available[Math.floor(Math.random() * available.length)];
  }

  console.log(`[PrimalClubMint] Gewählt: Item #${item.index}`);

  // Echtes AVIF-Bild laden und als Datei zum Inskribieren vorbereiten
  const imgRes = await fetch(imageUrlFor(item), { cache: 'no-store' });
  if (!imgRes.ok) {
    throw new Error(`Bilddatei konnte nicht geladen werden: ${item.image} (${imgRes.status})`);
  }
  const blob = await imgRes.blob();
  const imageFile = new File([blob], item.image, { type: 'image/avif' });
  console.log(`[PrimalClubMint] Bild geladen: ${item.image} (${imageFile.size} bytes)`);

  const result = await createUnisatInscription({
    file: imageFile,
    address: buyerAddress,
    feeRate,
    postage: POSTAGE_SATS,
  });

  console.log(`[PrimalClubMint] Inscription erstellt: ${result.inscriptionId}`);

  if (!result.payAddress || !result.amount) {
    throw new Error('UniSat API hat keine Pay-Adresse oder Betrag zurückgegeben.');
  }

  const payments: Array<{ address: string; amount: number }> = [];
  // Free Mint (Whitelist): Kollektionspreis entfällt, Inscription-Fees bleiben.
  if (!isFree) {
    payments.push({ address: ADMIN_PAYMENT_ADDRESS, amount: PRIMAL_CLUB_PRICE_BTC });
  } else {
    console.log('[PrimalClubMint] FREE MINT (whitelist) – kein Kollektionspreis');
  }
  payments.push({ address: result.payAddress, amount: result.amount });

  if (!walletType) throw new Error('Wallet-Typ nicht erkannt.');

  let paymentTxid: string | undefined;
  if (payments.length === 1) {
    const p = payments[0];
    if (walletType === 'unisat') paymentTxid = await sendBitcoinViaUnisat(p.address, p.amount);
    else if (walletType === 'okx') paymentTxid = await sendBitcoinViaOKX(p.address, p.amount);
    else paymentTxid = await sendBitcoinViaXverse(p.address, p.amount);
  } else {
    paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);
  }

  if (!paymentTxid) throw new Error('Zahlung fehlgeschlagen.');

  console.log(`[PrimalClubMint] ✅ Zahlung erfolgreich: ${paymentTxid}`);

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    orderId: result.orderId,
    paymentTxid,
    item,
  };
}

export interface PrimalClubMintedItem {
  inscriptionId: string;
  orderId?: string;
  txid?: string;
  item: PrimalClubItem;
}

/**
 * Bulk-mint `quantity` random Primal Club items in a SINGLE wallet transaction.
 *
 * All N UniSat inscription orders are prepared first (no funds moved yet). Only
 * once every order is ready do we send ONE combined payment covering the (single,
 * volume-discounted) collection margin plus each inscription's own fee address.
 * If any preparation step fails, we throw before any payment → no funds lost.
 *
 * `freeCount` items skip the margin (whitelist). The discount applies to the
 * PAID quantity, matching the High Rollers / Spikes backend.
 */
export async function mintPrimalClubBatch(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  quantity: number,
  freeCount: number = 0,
  mintedIndices: number[] = []
): Promise<{ paymentTxid?: string; items: PrimalClubMintedItem[] }> {
  if (!buyerAddress.startsWith('bc1p')) {
    throw new Error(
      'Inscriptions require a Taproot address (bc1p...).\n\n' +
      'In UniSat: Click your address → Settings → Address Type → Taproot (P2TR)\n' +
      'Then reconnect your wallet.'
    );
  }
  if (!walletType) throw new Error('Wallet-Typ nicht erkannt.');

  const qty = Math.max(1, Math.min(PRIMAL_CLUB_MAX_PER_TX, Math.floor(quantity) || 1));
  if (qty === 1) {
    const single = await mintPrimalClubRandom(buyerAddress, feeRate, walletType, freeCount >= 1, mintedIndices);
    return { paymentTxid: single.paymentTxid, items: [single] };
  }

  const collection = await loadPrimalClubCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('Primal Club Collection konnte nicht geladen werden.');
  }

  const excluded = new Set(mintedIndices);
  const pool = collection.generated.filter((it) => !excluded.has(it.index));
  if (pool.length < qty) {
    throw new Error(`Nur noch ${pool.length} Primal Club Item(s) verfügbar.`);
  }

  // Pick `qty` distinct random items.
  const picks: PrimalClubItem[] = [];
  const bag = [...pool];
  for (let i = 0; i < qty; i++) {
    const idx = Math.floor(Math.random() * bag.length);
    picks.push(bag[idx]);
    bag.splice(idx, 1);
  }

  // Prepare every inscription order first (no funds moved yet).
  const prepared: Array<{ payAddress: string; amount: number; inscriptionId: string; orderId?: string; txid?: string; item: PrimalClubItem }> = [];
  for (const item of picks) {
    const imgRes = await fetch(imageUrlFor(item), { cache: 'no-store' });
    if (!imgRes.ok) throw new Error(`Bilddatei konnte nicht geladen werden: ${item.image} (${imgRes.status})`);
    const blob = await imgRes.blob();
    const imageFile = new File([blob], item.image, { type: 'image/avif' });

    const result = await createUnisatInscription({
      file: imageFile,
      address: buyerAddress,
      feeRate,
      postage: POSTAGE_SATS,
    });
    if (!result.payAddress || !result.amount) {
      throw new Error(`UniSat API hat keine Pay-Adresse/Betrag für #${item.index} zurückgegeben.`);
    }
    prepared.push({
      payAddress: result.payAddress,
      amount: result.amount,
      inscriptionId: result.inscriptionId,
      orderId: result.orderId,
      txid: result.txid || result.orderId,
      item,
    });
  }

  // Build the single combined payment: one discounted margin + each fee address.
  const paidQty = Math.max(0, qty - Math.max(0, Math.floor(freeCount)));
  const marginSats = primalClubVolumeMargin(paidQty);
  const payments: Array<{ address: string; amount: number }> = [];
  if (marginSats > 0) {
    payments.push({ address: ADMIN_PAYMENT_ADDRESS, amount: marginSats / 100_000_000 });
  }
  for (const p of prepared) payments.push({ address: p.payAddress, amount: p.amount });

  const paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);
  if (!paymentTxid) throw new Error('Zahlung fehlgeschlagen.');

  return {
    paymentTxid,
    items: prepared.map((p) => ({ inscriptionId: p.inscriptionId, orderId: p.orderId, txid: p.txid, item: p.item })),
  };
}
