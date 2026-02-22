/**
 * BadCats Mint Service
 * 
 * Mintet 1 zufälliges BadCats-Item als rekursives SVG-Ordinal.
 * Die Layer werden per /content/INSCRIPTION_ID referenziert.
 * 
 * Preis: 10.000 sats (Free Mints über Inscription-Whitelist / Adress-Whitelist)
 */

import { createUnisatInscription } from './unisatService';
import { sendMultipleBitcoinPayments, sendBitcoinViaUnisat, sendBitcoinViaXverse, sendBitcoinViaOKX } from '../utils/wallet';

const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft';
const BADCATS_PRICE_SATS = 10000;
const BADCATS_PRICE_BTC = BADCATS_PRICE_SATS / 100_000_000;

export interface BadCatsGeneratedItem {
  index: number;
  layers: Array<{
    layerName: string;
    traitType: string;
    trait: { inscriptionId: string; name: string; rarity: number };
    offsetX?: number;
    offsetY?: number;
    scale?: number;
  }>;
  svg: string;
}

export interface BadCatsCollection {
  totalCount: number;
  viewBox: string;
  generated: BadCatsGeneratedItem[];
}

function loadFromLocalStorage(): BadCatsCollection | null {
  try {
    const raw = localStorage.getItem('recursive_collection_projects');
    if (!raw) return null;
    const projects = JSON.parse(raw);
    const badcats = projects.find((p: any) =>
      (p.collectionName || p.name || '').toLowerCase().includes('badcats') ||
      (p.collectionName || p.name || '').toLowerCase().includes('bad cats')
    );
    if (!badcats || !badcats.generated || badcats.generated.length === 0) return null;
    console.log(`[BadCatsMint] Collection aus localStorage geladen: ${badcats.generated.length} Items`);
    return {
      totalCount: badcats.totalCount || badcats.generated.length,
      viewBox: badcats.viewBox || '0 0 1000 1000',
      generated: badcats.generated,
    };
  } catch (err) {
    console.error('[BadCatsMint] localStorage Fallback fehlgeschlagen:', err);
    return null;
  }
}

export async function loadBadCatsCollection(): Promise<BadCatsCollection | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/badcats-collection.json`);
    if (res.ok) {
      const data = await res.json();
      if (data.generated && Array.isArray(data.generated) && data.generated.length > 0) {
        console.log(`[BadCatsMint] Collection aus JSON geladen: ${data.generated.length} Items`);
        return {
          totalCount: data.totalCount || data.generated.length,
          viewBox: data.viewBox || '0 0 1000 1000',
          generated: data.generated,
        };
      }
    }
  } catch (err) {
    console.warn('[BadCatsMint] JSON-Datei nicht verfügbar, versuche localStorage...', err);
  }
  return loadFromLocalStorage();
}

export async function mintBadCatsRandom(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  isFree: boolean,
  mintedIndices: number[] = []
): Promise<{ inscriptionId: string; txid?: string; paymentTxid?: string; item: BadCatsGeneratedItem }> {

  if (!buyerAddress.startsWith('bc1p')) {
    throw new Error(
      'Inscriptions require a Taproot address (bc1p...).\n\n' +
      'In UniSat: Click your address → Settings → Address Type → Taproot (P2TR)\n' +
      'Then reconnect your wallet.'
    );
  }

  const collection = await loadBadCatsCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('BadCats Collection konnte nicht geladen werden.');
  }

  const mintedSet = new Set(mintedIndices);
  const available = collection.generated.filter(item => !mintedSet.has(item.index));

  if (available.length === 0) {
    throw new Error('Alle BadCats sind bereits gemintet – SOLD OUT!');
  }

  console.log(`[BadCatsMint] Verfügbar: ${available.length} von ${collection.generated.length}`);

  const PRIORITY_INDICES = [88];
  const priorityItem = available.find(a => PRIORITY_INDICES.includes(a.index));
  const item = priorityItem || available[Math.floor(Math.random() * available.length)];

  console.log(`[BadCatsMint] Gewählt: Item #${item.index}${priorityItem ? ' (Priority)' : ' (Random)'}`);

  const svgFile = new File(
    [item.svg],
    `badcats-${item.index}.svg`,
    { type: 'image/svg+xml' }
  );

  const result = await createUnisatInscription({
    file: svgFile,
    address: buyerAddress,
    feeRate,
    postage: 330,
  });

  console.log(`[BadCatsMint] Inscription erstellt: ${result.inscriptionId}`);

  if (!result.payAddress || !result.amount) {
    throw new Error('UniSat API hat keine Pay-Adresse oder Betrag zurückgegeben.');
  }

  const payments: Array<{ address: string; amount: number }> = [];

  if (!isFree) {
    payments.push({
      address: ADMIN_PAYMENT_ADDRESS,
      amount: BADCATS_PRICE_BTC,
    });
    console.log(`[BadCatsMint] Preis: ${BADCATS_PRICE_SATS} sats an ${ADMIN_PAYMENT_ADDRESS}`);
  } else {
    console.log(`[BadCatsMint] FREE MINT!`);
  }

  payments.push({
    address: result.payAddress,
    amount: result.amount,
  });

  if (!walletType) throw new Error('Wallet-Typ nicht erkannt.');

  let paymentTxid: string | undefined;

  if (payments.length === 1) {
    const p = payments[0];
    if (walletType === 'unisat') {
      paymentTxid = await sendBitcoinViaUnisat(p.address, p.amount);
    } else if (walletType === 'okx') {
      paymentTxid = await sendBitcoinViaOKX(p.address, p.amount);
    } else {
      paymentTxid = await sendBitcoinViaXverse(p.address, p.amount);
    }
  } else {
    paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);
  }

  if (!paymentTxid) throw new Error('Zahlung fehlgeschlagen.');

  console.log(`[BadCatsMint] ✅ Zahlung erfolgreich: ${paymentTxid}`);

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid,
    item,
  };
}
