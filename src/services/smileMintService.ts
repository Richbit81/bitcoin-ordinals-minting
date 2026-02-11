/**
 * Smile A Bit Mint Service
 * 
 * Mintet 1 zufälliges Smiley aus der Collection als NEUE SVG-Inscription
 * an die Taproot-Adresse (bc1p...) des Käufers.
 * 
 * Format pro Item (aus dem Recursive Tool):
 * <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
 *   <image href="/content/INSCRIPTION_ID" />
 *   ...
 * </svg>
 * 
 * Keine Delegates – es werden echte neue Ordinals erstellt.
 * Preis: 8000 sats
 */

import { createUnisatInscription } from './unisatService';
import { sendBitcoinViaUnisat, sendBitcoinViaXverse, sendMultipleBitcoinPayments } from '../utils/wallet';

const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft';
const SMILE_PRICE_SATS = 10000;
const SMILE_PRICE_BTC = SMILE_PRICE_SATS / 100_000_000;

export interface SmileGeneratedItem {
  index: number;
  layers: Array<{
    layerName: string;
    traitType: string;
    trait: { inscriptionId: string; name: string; rarity: number; contentType: string };
  }>;
  svg: string;
}

export interface SmileCollection {
  totalCount: number;
  viewBox: string;
  generated: SmileGeneratedItem[];
}

export function isTaprootAddress(address: string): boolean {
  return typeof address === 'string' && address.startsWith('bc1p');
}

/**
 * Lädt die Smile A Bit Collection aus public/data/smile-collection.json
 */
export async function loadSmileCollection(): Promise<SmileCollection | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/smile-collection.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.generated || !Array.isArray(data.generated) || data.generated.length === 0) return null;
    console.log(`[SmileMint] Collection geladen: ${data.generated.length} Items`);
    return {
      totalCount: data.totalCount || data.generated.length,
      viewBox: data.viewBox || '0 0 1000 1000',
      generated: data.generated,
    };
  } catch (err) {
    console.error('[SmileMint] Fehler beim Laden der Collection:', err);
    return null;
  }
}

/**
 * Mintet 1 zufälliges Smiley als neue SVG-Inscription an die Taproot-Adresse des Käufers.
 * Käufer sieht NICHT welches er bekommt.
 */
export async function mintSmileRandom(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | null
): Promise<{ inscriptionId: string; txid?: string; paymentTxid?: string; item: SmileGeneratedItem }> {
  
  // Taproot-Check
  if (!isTaprootAddress(buyerAddress)) {
    throw new Error(
      'Ordinals werden nur an Taproot-Adressen (bc1p...) gesendet. Bitte verbinde eine Taproot-Wallet.'
    );
  }

  // Collection laden
  const collection = await loadSmileCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('Smile A Bit Collection konnte nicht geladen werden.');
  }

  // Zufälliges Item wählen – Käufer sieht nicht welches
  const randomIndex = Math.floor(Math.random() * collection.generated.length);
  const item = collection.generated[randomIndex];
  const svgContent = item.svg;

  if (!svgContent || !svgContent.includes('<svg')) {
    throw new Error('Ungültiges SVG in der Collection.');
  }

  console.log(`[SmileMint] Zufällig gewählt: Item #${item.index} (${randomIndex + 1}/${collection.generated.length})`);
  console.log(`[SmileMint] SVG Größe: ${svgContent.length} bytes`);

  // SVG als File erstellen für die Inscription
  const svgFile = new File(
    [svgContent],
    `smile-a-bit-${item.index}.svg`,
    { type: 'image/svg+xml' }
  );

  // Neue Inscription erstellen (KEIN Delegate!) an Käufer-Taproot-Adresse
  const result = await createUnisatInscription({
    file: svgFile,
    address: buyerAddress,
    feeRate,
    postage: 546,
  });

  console.log(`[SmileMint] Inscription erstellt: ${result.inscriptionId}`);

  if (!result.payAddress || !result.amount) {
    throw new Error('UniSat API hat keine Pay-Adresse oder Betrag zurückgegeben.');
  }

  // Zahlungen: 1) Item-Preis an Admin  2) Inscription-Fees an UniSat
  const payments: Array<{ address: string; amount: number }> = [];

  // Item-Preis (8000 sats)
  payments.push({
    address: ADMIN_PAYMENT_ADDRESS,
    amount: SMILE_PRICE_BTC,
  });
  console.log(`[SmileMint] Item-Preis: ${SMILE_PRICE_BTC.toFixed(8)} BTC (${SMILE_PRICE_SATS} sats) an ${ADMIN_PAYMENT_ADDRESS}`);

  // Inscription-Fees an UniSat
  payments.push({
    address: result.payAddress,
    amount: result.amount,
  });
  console.log(`[SmileMint] Inscription-Fees: ${result.amount.toFixed(8)} BTC an ${result.payAddress}`);

  // Alle Zahlungen in einer Transaktion
  let paymentTxid: string | undefined;

  if (!walletType) {
    throw new Error('Wallet-Typ nicht erkannt.');
  }

  console.log(`[SmileMint] Zahle ${payments.length} Empfänger in einer Transaktion...`);
  payments.forEach((p, i) => {
    console.log(`[SmileMint]   ${i + 1}. ${p.address}: ${p.amount.toFixed(8)} BTC (${(p.amount * 100000000).toFixed(0)} sats)`);
  });

  paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);

  if (!paymentTxid) {
    throw new Error('Zahlung fehlgeschlagen.');
  }

  console.log(`[SmileMint] ✅ Zahlung erfolgreich: ${paymentTxid}`);

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid,
    item,
  };
}
