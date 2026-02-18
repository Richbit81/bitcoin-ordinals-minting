/**
 * SLUMS Mint Service
 * 
 * Mintet 1 zufälliges SLUMS-Item als rekursives HTML-Ordinal.
 * Die AVIF-Layer werden per /content/INSCRIPTION_ID referenziert
 * und via CSS auf 2x vergrössert (image-rendering: pixelated).
 * 1 Pixel → 2×2 Pixel Block, verlustfrei.
 * 
 * Preis: Erste 100 Mints = gratis (nur Fees), danach 3000 sats
 */

import { createUnisatInscription } from './unisatService';
import { sendMultipleBitcoinPayments, sendBitcoinViaUnisat, sendBitcoinViaXverse } from '../utils/wallet';

const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft';
const SLUMS_PRICE_SATS = 3000;
const SLUMS_PRICE_BTC = SLUMS_PRICE_SATS / 100_000_000;
const SLUMS_FREE_MINTS = 100;
const PIXEL_SCALE = 2; // 1px → 2×2 block
const ORIGINAL_SIZE = 200; // AVIF-Layer sind 200x200 Pixel
const DISPLAY_SIZE = ORIGINAL_SIZE * PIXEL_SCALE; // 400

export interface SlumsGeneratedItem {
  index: number;
  layers: Array<{
    layerName: string;
    traitType: string;
    trait: { inscriptionId: string; name: string; rarity: number; contentType: string };
  }>;
  svg: string;
}

export interface SlumsCollection {
  totalCount: number;
  viewBox: string;
  generated: SlumsGeneratedItem[];
}

export function isTaprootAddress(address: string): boolean {
  return typeof address === 'string' && address.startsWith('bc1p');
}

/**
 * Lädt die SLUMS Collection aus public/data/slums-collection.json
 */
export async function loadSlumsCollection(): Promise<SlumsCollection | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/slums-collection.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.generated || !Array.isArray(data.generated) || data.generated.length === 0) return null;
    console.log(`[SlumsMint] Collection geladen: ${data.generated.length} Items`);
    return {
      totalCount: data.totalCount || data.generated.length,
      viewBox: data.viewBox || '0 0 1000 1000',
      generated: data.generated,
    };
  } catch (err) {
    console.error('[SlumsMint] Fehler beim Laden der Collection:', err);
    return null;
  }
}

/**
 * Baut ein rekursives HTML-Ordinal aus den Layer-Inscription-IDs.
 * Die AVIF-Bilder werden per /content/ referenziert und via CSS
 * auf 2x vergrössert mit image-rendering: pixelated (Nearest Neighbor).
 */
function buildRecursiveHtml(item: SlumsGeneratedItem): string {
  const imgTags = item.layers
    .map(layer => `<img src="/content/${layer.trait.inscriptionId}" style="position:absolute;top:0;left:0;width:100%;height:100%;image-rendering:pixelated">`)
    .join('\n');

  return `<html>
<head><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#000}body{display:flex;align-items:center;justify-content:center}.c{position:relative;width:100vmin;height:100vmin}</style></head>
<body>
<div class="c">
${imgTags}
</div>
</body>
</html>`;
}

/**
 * Mintet 1 zufälliges SLUMS-Item als rekursives HTML-Ordinal
 * an die Taproot-Adresse des Käufers.
 */
export async function mintSlumsRandom(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | null,
  currentMintCount: number,
  mintedIndices: number[] = []
): Promise<{ inscriptionId: string; txid?: string; paymentTxid?: string; item: SlumsGeneratedItem }> {
  
  const collection = await loadSlumsCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('SLUMS Collection konnte nicht geladen werden.');
  }

  // Bereits gemintete Items ausschliessen
  const mintedSet = new Set(mintedIndices);
  const available = collection.generated.filter(item => !mintedSet.has(item.index));

  if (available.length === 0) {
    throw new Error('Alle SLUMS Items sind bereits gemintet – SOLD OUT!');
  }

  console.log(`[SlumsMint] Verfügbar: ${available.length} von ${collection.generated.length} (${mintedSet.size} bereits gemintet)`);

  // Zufälliges Item aus den VERFÜGBAREN wählen
  const randomIndex = Math.floor(Math.random() * available.length);
  const item = available[randomIndex];

  console.log(`[SlumsMint] Zufällig gewählt: Item #${item.index} (aus ${available.length} verfügbaren)`);

  // Rekursives HTML bauen
  const htmlContent = buildRecursiveHtml(item);
  console.log(`[SlumsMint] HTML erstellt: ${htmlContent.length} Bytes (${item.layers.length} Layer, ${PIXEL_SCALE}x upscale)`);

  const htmlFile = new File(
    [htmlContent],
    `slums-${item.index}.html`,
    { type: 'text/html' }
  );

  // Inscription erstellen
  const result = await createUnisatInscription({
    file: htmlFile,
    address: buyerAddress,
    feeRate,
    postage: 330,
  });

  console.log(`[SlumsMint] Inscription erstellt: ${result.inscriptionId}`);

  if (!result.payAddress || !result.amount) {
    throw new Error('UniSat API hat keine Pay-Adresse oder Betrag zurückgegeben.');
  }

  // Preis bestimmen: erste 100 gratis, danach 3000 sats
  const isFree = currentMintCount < SLUMS_FREE_MINTS;
  const payments: Array<{ address: string; amount: number }> = [];

  if (!isFree) {
    payments.push({
      address: ADMIN_PAYMENT_ADDRESS,
      amount: SLUMS_PRICE_BTC,
    });
    console.log(`[SlumsMint] Item-Preis: ${SLUMS_PRICE_SATS} sats an ${ADMIN_PAYMENT_ADDRESS}`);
  } else {
    console.log(`[SlumsMint] GRATIS Mint (#${currentMintCount + 1} von ${SLUMS_FREE_MINTS} free mints)`);
  }

  // Inscription-Fees an UniSat
  payments.push({
    address: result.payAddress,
    amount: result.amount,
  });
  console.log(`[SlumsMint] Inscription-Fees: ${result.amount.toFixed(8)} BTC an ${result.payAddress}`);

  if (!walletType) throw new Error('Wallet-Typ nicht erkannt.');

  let paymentTxid: string | undefined;

  if (payments.length === 1) {
    // Nur Inscription-Fees (gratis mint)
    const p = payments[0];
    if (walletType === 'unisat') {
      paymentTxid = await sendBitcoinViaUnisat(p.address, p.amount);
    } else {
      paymentTxid = await sendBitcoinViaXverse(p.address, p.amount);
    }
  } else {
    paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);
  }

  if (!paymentTxid) throw new Error('Zahlung fehlgeschlagen.');

  console.log(`[SlumsMint] ✅ Zahlung erfolgreich: ${paymentTxid}`);

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid,
    item,
  };
}
