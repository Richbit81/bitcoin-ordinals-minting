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
  payments.push({ address: ADMIN_PAYMENT_ADDRESS, amount: PRIMAL_CLUB_PRICE_BTC });
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
