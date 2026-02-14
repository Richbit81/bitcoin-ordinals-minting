/**
 * SLUMS Mint Service
 * 
 * Mintet 1 zufälliges SLUMS-Item als PNG-Inscription (mit 2x Pixel Upscale).
 * Die Layer (AVIF-Bilder) werden auf einem Canvas übereinander gerendert,
 * dann 2x hochskaliert (Nearest Neighbor) und als PNG inscribed.
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
 * Rendert alle Layer eines Items auf einem Canvas und gibt ein 2x upscaltes PNG zurück.
 */
async function renderItemAsPng(item: SlumsGeneratedItem): Promise<Blob> {
  const SIZE = 1000; // Original viewBox size
  const UPSCALED = SIZE * PIXEL_SCALE;

  // Phase 1: Render all layers at original size
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context nicht verfügbar');

  for (const layer of item.layers) {
    const imgUrl = `https://ordinals.com/content/${layer.trait.inscriptionId}`;
    const img = await loadImage(imgUrl);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  }

  // Phase 2: Upscale 2x with nearest-neighbor
  const upCanvas = document.createElement('canvas');
  upCanvas.width = UPSCALED;
  upCanvas.height = UPSCALED;
  const upCtx = upCanvas.getContext('2d');
  if (!upCtx) throw new Error('Upscale canvas context nicht verfügbar');

  upCtx.imageSmoothingEnabled = false;
  (upCtx as any).mozImageSmoothingEnabled = false;
  (upCtx as any).webkitImageSmoothingEnabled = false;
  (upCtx as any).msImageSmoothingEnabled = false;
  upCtx.drawImage(canvas, 0, 0, UPSCALED, UPSCALED);

  // Export as PNG
  return new Promise((resolve, reject) => {
    upCanvas.toBlob((blob) => {
      if (!blob) { reject(new Error('PNG Export fehlgeschlagen')); return; }
      resolve(blob);
    }, 'image/png');
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Bild laden fehlgeschlagen: ${url}`));
    img.src = url;
  });
}

/**
 * Mintet 1 zufälliges SLUMS-Item als PNG an die Taproot-Adresse des Käufers.
 */
export async function mintSlumsRandom(
  buyerAddress: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | null,
  currentMintCount: number
): Promise<{ inscriptionId: string; txid?: string; paymentTxid?: string; item: SlumsGeneratedItem }> {
  
  if (!isTaprootAddress(buyerAddress)) {
    throw new Error('Ordinals werden nur an Taproot-Adressen (bc1p...) gesendet.');
  }

  const collection = await loadSlumsCollection();
  if (!collection || collection.generated.length === 0) {
    throw new Error('SLUMS Collection konnte nicht geladen werden.');
  }

  // Zufälliges Item wählen
  const randomIndex = Math.floor(Math.random() * collection.generated.length);
  const item = collection.generated[randomIndex];

  console.log(`[SlumsMint] Zufällig gewählt: Item #${item.index} (${randomIndex + 1}/${collection.generated.length})`);
  console.log(`[SlumsMint] Rendere ${item.layers.length} Layer auf Canvas...`);

  // Layer auf Canvas rendern + 2x Upscale → PNG
  const pngBlob = await renderItemAsPng(item);
  console.log(`[SlumsMint] PNG erstellt: ${(pngBlob.size / 1024).toFixed(1)} KB (${PIXEL_SCALE}x upscaled)`);

  const pngFile = new File(
    [pngBlob],
    `slums-${item.index}.png`,
    { type: 'image/png' }
  );

  // Inscription erstellen
  const result = await createUnisatInscription({
    file: pngFile,
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
