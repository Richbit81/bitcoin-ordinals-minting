/**
 * Collection Minting Service
 * Handles minting of collection items (both delegate and original)
 */

import { createUnisatInscription } from './unisatService';
import { sendBitcoinViaUnisat, sendBitcoinViaXverse, sendBitcoinViaOKX, sendMultipleBitcoinPayments } from '../utils/wallet';
import { addMintPoints } from './pointsService';
import { getApiUrl } from '../utils/apiUrl';
import {
  buildTesseractWrapper,
  TESSERACT_PARENT_INSCRIPTION_ID,
  TESSERACT_WRAPPER_BYTES,
  TESSERACT_EDITION_LIMIT,
} from '../constants/tesseractInscription';
import { buildSignalWrapper, SIGNAL_ENGINE_INSCRIPTION_ID, SIGNAL_WRAPPER_BYTES, SIGNAL_EDITION_LIMIT } from '../constants/signalInscription';

const API_URL = getApiUrl();

const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft'; // Admin Payment Wallet

/**
 * Bezahlt die UniSat-Inscription-Order ZUERST (kritisch — sichert die Inscription)
 * und den Item-Preis an die Admin-Adresse erst DANACH (best-effort).
 *
 * Hintergrund / Bugfix: UniSat & OKX können pro Transaktion nur einen Empfänger.
 * Früher wurden Item-Gebühr und Inscription-Gebühr als ZWEI getrennte, nach Betrag
 * sortierte Transaktionen gesendet. Schlug die zweite (Inscription-)Zahlung fehl
 * (z.B. unbestätigte UTXOs, abgelehnt), war das Geld weg, aber keine Inscription
 * wurde erzeugt. Jetzt wird die Inscription-Order IMMER zuerst bezahlt; geht danach
 * die Item-Preis-Zahlung daneben, verliert nur der Betreiber seine Gebühr — der
 * Käufer hat aber garantiert seine Inscription.
 *
 * Xverse unterstützt echte Multi-Output-Transaktionen (atomar: beide Outputs oder
 * gar keiner), daher bleibt dort der kombinierte Versand erhalten.
 */
async function payInscriptionFeeFirst(
  payAddress: string,
  payAmountBTC: number,
  itemPriceSats: number | undefined,
  walletType: 'unisat' | 'xverse' | 'okx' | null
): Promise<string> {
  if (!walletType) {
    throw new Error('Unsupported wallet type for payment.');
  }

  const itemPriceBTC = itemPriceSats && itemPriceSats > 0 ? itemPriceSats / 100000000 : 0;

  // Xverse: ein atomarer Multi-Output-Tx (beide Outputs oder keiner) → "Geld weg,
  // keine Inscription" ist hier strukturell unmöglich.
  if (walletType === 'xverse') {
    if (itemPriceBTC > 0) {
      // Inscription-Output zuerst auflisten (Reihenfolge irrelevant, da atomar).
      return await sendMultipleBitcoinPayments(
        [
          { address: payAddress, amount: payAmountBTC },
          { address: ADMIN_PAYMENT_ADDRESS, amount: itemPriceBTC },
        ],
        'xverse'
      );
    }
    return await sendBitcoinViaXverse(payAddress, payAmountBTC);
  }

  // UniSat / OKX: nur ein Output pro Transaktion möglich.
  const sendFn = walletType === 'okx' ? sendBitcoinViaOKX : sendBitcoinViaUnisat;

  // 1) ZUERST die Inscription-Order bezahlen — kritische Zahlung, Fehler bricht ab.
  console.log(
    `[CollectionMinting] 💸 Inscription-Order zuerst: ${payAmountBTC.toFixed(8)} BTC → ${payAddress}`
  );
  const inscriptionTxid = await sendFn(payAddress, payAmountBTC);
  console.log(`[CollectionMinting] ✅ Inscription-Order bezahlt, TXID: ${inscriptionTxid}`);

  // 2) DANACH den Item-Preis (best-effort — darf die Inscription nie gefährden).
  if (itemPriceBTC > 0) {
    try {
      console.log(
        `[CollectionMinting] 💸 Item-Preis (best-effort): ${itemPriceBTC.toFixed(8)} BTC → ${ADMIN_PAYMENT_ADDRESS}`
      );
      const feeTxid = await sendFn(ADMIN_PAYMENT_ADDRESS, itemPriceBTC);
      console.log(`[CollectionMinting] ✅ Item-Preis bezahlt, TXID: ${feeTxid}`);
    } catch (feeErr) {
      console.warn(
        '[CollectionMinting] ⚠️ Item-Preis-Zahlung fehlgeschlagen — Inscription ist bereits gesichert:',
        feeErr
      );
    }
  }

  return inscriptionTxid;
}

/**
 * Erstellt eine einzelne Delegate-Inskription für ein Collection-Item
 * @param contentType - 'html' für HTML-Inskriptionen (iframe), 'image' für Bilder (img). Muss zum Original-Inhalt passen — HTML/Runner mit 'image' minten bricht interaktive Delegates. Auto-detect nur wenn nicht angegeben.
 * @param itemPrice - Preis des Items in sats (z.B. 2000 für TimeBIT, 10000 für TACTICAL). Wird an Admin-Adresse bezahlt.
 */
export const createSingleDelegate = async (
  originalInscriptionId: string,
  itemName: string,
  recipientAddress: string,
  collectionName: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  contentType?: 'html' | 'image',
  itemPrice?: number // Preis in sats (z.B. 2000 für TimeBIT, 10000 für TACTICAL)
): Promise<{ inscriptionId: string; txid: string; paymentTxid?: string }> => {
  console.log(`[CollectionMinting] Creating delegate for ${itemName} (Original: ${originalInscriptionId})`);

  // Auto-detect Content-Type basierend auf Collection-Name
  if (!contentType) {
    contentType = collectionName === 'Tech & Games' ? 'html' : 'image';
    console.log(`[CollectionMinting] Auto-detected contentType: ${contentType} (collection: ${collectionName})`);
  }

  // Erstelle HTML-Datei für Delegate-Inskription
  const delegateContent = {
    p: 'ord-20',
    op: 'delegate',
    originalInscriptionId: originalInscriptionId,
    name: itemName,
    collection: collectionName,
    contentType: contentType,
    timestamp: Date.now(),
  };

  // HTML-Template für HTML-Inskriptionen (iframe) oder Bilder (img)
  const htmlContent = contentType === 'html' 
    ? `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="application/json" id="delegate-metadata">
${JSON.stringify(delegateContent)}
</script>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}
iframe {
  width: 100%;
  height: 100vh;
  border: 0;
  display: block;
}
</style>
</head>
<body>
<iframe src="/content/${originalInscriptionId}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-fullscreen" allowfullscreen></iframe>
</body>
</html>`
    : `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="application/json" id="delegate-metadata">
${JSON.stringify(delegateContent)}
</script>
<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}
img {
  max-width: 100%;
  max-height: 100vh;
  object-fit: contain;
  display: block;
}
</style>
</head>
<body>
<img src="/content/${originalInscriptionId}" alt="${itemName}" />
</body>
</html>`;

  const htmlFile = new File(
    [htmlContent],
    `${itemName.replace(/\s/g, '-')}-${Date.now()}.html`,
    { type: 'text/html' }
  );

  console.log(`[CollectionMinting] ✅ HTML file created: ${htmlFile.name} (${htmlFile.size} bytes)`);

  console.log(`[CollectionMinting] 📡 Step 1/3: Calling backend API createUnisatInscription...`);
  let result;
  try {
    result = await createUnisatInscription({
      file: htmlFile,
      address: recipientAddress,
      feeRate,
      postage: 330,
      delegateMetadata: JSON.stringify(delegateContent),
    });
    console.log(`[CollectionMinting] ✅ Step 1/3 done. orderId=${result.orderId}, payAddress=${result.payAddress}, amount=${result.amount}`);
  } catch (apiErr: any) {
    console.error(`[CollectionMinting] ❌ Step 1/3 FAILED (createUnisatInscription):`, apiErr);
    throw new Error(`Inscription API failed: ${apiErr?.message || apiErr}`);
  }

  if (!result.payAddress || !result.amount) {
    console.error(`[CollectionMinting] ❌ Missing payAddress or amount in API response:`, result);
    throw new Error('UniSat API did not return a pay address or amount for inscription fees.');
  }

  // Zahlung: Inscription-Order ZUERST (kritisch), Item-Preis DANACH (best-effort).
  console.log(`[CollectionMinting] 💸 Step 2/3: Paying via ${walletType} (inscription first)...`);
  let paymentTxid: string;
  try {
    paymentTxid = await payInscriptionFeeFirst(result.payAddress, result.amount, itemPrice, walletType);
    console.log(`[CollectionMinting] ✅ Step 2/3 done. paymentTxid=${paymentTxid}`);
  } catch (payErr: any) {
    console.error(`[CollectionMinting] ❌ Step 2/3 FAILED (payment):`, payErr);
    throw payErr;
  }

  if (!paymentTxid) {
    throw new Error('Payment transaction failed or returned no TXID.');
  }

  console.log(`[CollectionMinting] ✅ Payment successful, TXID: ${paymentTxid}`);

  try {
    await addMintPoints(recipientAddress, {
      collection: collectionName,
      itemName,
      inscriptionId: result.inscriptionId,
      txid: result.txid || result.orderId,
      source: 'createSingleDelegate',
    });
  } catch (pointsError) {
    // Points errors must never break a successful mint.
    console.warn('[CollectionMinting] Failed to add mint points:', pointsError);
  }

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid: paymentTxid,
  };
};

/**
 * Runner-spezifischer Mint: schreibt bei jedem Mint dieselbe Wrapper-HTML-Datei ein.
 * Kein Delegate — die Wrapper-Datei lädt zur Anzeige eine Basis-HTML-Inscription
 * und nutzt die eigene Inscription-ID als Seed (`#inscription=…`).
 */
export const createRunnerWrapperInscription = async (
  itemName: string,
  recipientAddress: string,
  collectionName: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  itemPrice?: number
): Promise<{ inscriptionId: string; txid: string; paymentTxid?: string }> => {
  console.log(`[CollectionMinting] Creating Runner wrapper inscription for ${itemName}`);

  // Identische Wrapper-Datei bei jedem Mint — Seed wird zur Laufzeit aus eigener Inscription-ID gebildet.
  const WRAPPER_HTML =
    `<!doctype html><meta charset=utf-8><title>NR</title>` +
    `<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}` +
    `iframe{display:block;border:0;width:100%;height:100%}</style>` +
    `<script>var b="13a0c3183a983b88c6f40a1d1845ac5817104fc45eca4a4f28bd05c9c38e765bi0",` +
    `p=location.pathname.split("/").pop()||"",` +
    `s=/^[0-9a-f]{64}i\\d+$/i.test(p)?p:("f-"+(Date.now()&0xffffff).toString(36));` +
    `document.write('<iframe src="/content/'+b+'#inscription='+s+'\" allow=\"autoplay\"></iframe>')` +
    `</script>\n`;

  const htmlFile = new File(
    [WRAPPER_HTML],
    `${itemName.replace(/\s/g, '-')}-${Date.now()}.html`,
    { type: 'text/html' }
  );

  console.log(`[CollectionMinting] ✅ Wrapper file created: ${htmlFile.name} (${htmlFile.size} bytes)`);

  console.log(`[CollectionMinting] 📡 Step 1/3: Calling backend API createUnisatInscription...`);
  let result;
  try {
    result = await createUnisatInscription({
      file: htmlFile,
      address: recipientAddress,
      feeRate,
      postage: 330,
    });
    console.log(`[CollectionMinting] ✅ Step 1/3 done. orderId=${result.orderId}, payAddress=${result.payAddress}, amount=${result.amount}`);
  } catch (apiErr: any) {
    console.error(`[CollectionMinting] ❌ Step 1/3 FAILED (createUnisatInscription):`, apiErr);
    throw new Error(`Inscription API failed: ${apiErr?.message || apiErr}`);
  }

  if (!result.payAddress || !result.amount) {
    console.error(`[CollectionMinting] ❌ Missing payAddress or amount in API response:`, result);
    throw new Error('UniSat API did not return a pay address or amount for inscription fees.');
  }

  // Zahlung: Inscription-Order ZUERST (kritisch), Item-Preis DANACH (best-effort).
  console.log(`[CollectionMinting] 💸 Step 2/3: Paying via ${walletType} (inscription first)...`);
  let paymentTxid: string;
  try {
    paymentTxid = await payInscriptionFeeFirst(result.payAddress, result.amount, itemPrice, walletType);
    console.log(`[CollectionMinting] ✅ Step 2/3 done. paymentTxid=${paymentTxid}`);
  } catch (payErr: any) {
    console.error(`[CollectionMinting] ❌ Step 2/3 FAILED (payment):`, payErr);
    throw payErr;
  }

  if (!paymentTxid) throw new Error('Payment transaction failed or returned no TXID.');

  try {
    await addMintPoints(recipientAddress, {
      collection: collectionName,
      itemName,
      inscriptionId: result.inscriptionId,
      txid: result.txid || result.orderId,
      source: 'createRunnerWrapperInscription',
    });
  } catch (pointsError) {
    console.warn('[CollectionMinting] Failed to add mint points:', pointsError);
  }

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid,
  };
};

/**
 * Tesseract-spezifischer Mint: schreibt bei jedem Mint einen marketplace-aware
 * Wrapper ein, der die Edition-Nummer als HTML-Metadata trägt und ein on-tap
 * einblendbares Marketplace-Panel enthält. Kein Delegate — der Wrapper lädt
 * die Tesseract-Engine aus der Parent-Inscription und nutzt die eigene
 * (vom Protokoll vergebene) Inscription-ID als deterministischen Seed (FNV-1a).
 *
 * `editionNumber` wird auf 4-stellig zero-padded in den `<meta name="edition">`
 * Tag gesetzt — Byte-Länge bleibt deshalb über alle Editionen identisch.
 */
export const createTesseractWrapperInscription = async (
  itemName: string,
  recipientAddress: string,
  collectionName: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  itemPrice?: number,
  editionNumber: number = 0
): Promise<{ inscriptionId: string; txid: string; paymentTxid?: string }> => {
  console.log(`[CollectionMinting] Creating Tesseract wrapper inscription for ${itemName} (edition #${editionNumber})`);

  if (!Number.isInteger(editionNumber) || editionNumber < 0 || editionNumber > TESSERACT_EDITION_LIMIT) {
    throw new Error(
      `[CollectionMinting] Invalid Tesseract editionNumber=${editionNumber} (must be 0..${TESSERACT_EDITION_LIMIT})`
    );
  }

  const wrapperHtml = buildTesseractWrapper(editionNumber);

  // ASCII-only Wrapper: byteLength === string length. Byte-genauer Guard
  // gegen versehentliche Modifikationen (z. B. CRLF, Smart-Quotes etc.).
  if (wrapperHtml.length !== TESSERACT_WRAPPER_BYTES) {
    console.error(
      `[CollectionMinting] ❌ Tesseract wrapper byte length mismatch: ${wrapperHtml.length} (expected ${TESSERACT_WRAPPER_BYTES})`
    );
    throw new Error('Tesseract wrapper HTML byte length mismatch — refusing to mint corrupted asset.');
  }

  const htmlFile = new File(
    [wrapperHtml],
    `tesseract-child.min.html`,
    { type: 'text/html;charset=utf-8' }
  );

  console.log(`[CollectionMinting] ✅ Tesseract wrapper file: ${htmlFile.name} (${htmlFile.size} bytes)`);

  console.log(`[CollectionMinting] 📡 Step 1/3: Calling backend API createUnisatInscription with parent=${TESSERACT_PARENT_INSCRIPTION_ID}…`);
  let result;
  try {
    result = await createUnisatInscription({
      file: htmlFile,
      address: recipientAddress,
      feeRate,
      postage: 330,
      // Parent-Provenance: das Backend hat einen Graceful-Fallback und
      // wiederholt den Call ohne Parent, falls UniSat den Same-Author-
      // Constraint enforced. Damit blockiert keine Provenance-Politik den Mint.
      parentInscriptionId: TESSERACT_PARENT_INSCRIPTION_ID,
    });
    console.log(`[CollectionMinting] ✅ Step 1/3 done. orderId=${result.orderId}, payAddress=${result.payAddress}, amount=${result.amount}`);
  } catch (apiErr: any) {
    console.error(`[CollectionMinting] ❌ Step 1/3 FAILED (createUnisatInscription):`, apiErr);
    throw new Error(`Inscription API failed: ${apiErr?.message || apiErr}`);
  }

  if (!result.payAddress || !result.amount) {
    console.error(`[CollectionMinting] ❌ Missing payAddress or amount in API response:`, result);
    throw new Error('UniSat API did not return a pay address or amount for inscription fees.');
  }

  // Zahlung: Inscription-Order ZUERST (kritisch), Item-Preis DANACH (best-effort).
  console.log(`[CollectionMinting] 💸 Step 2/3: Paying via ${walletType} (inscription first)...`);
  let paymentTxid: string;
  try {
    paymentTxid = await payInscriptionFeeFirst(result.payAddress, result.amount, itemPrice, walletType);
    console.log(`[CollectionMinting] ✅ Step 2/3 done. paymentTxid=${paymentTxid}`);
  } catch (payErr: any) {
    console.error(`[CollectionMinting] ❌ Step 2/3 FAILED (payment):`, payErr);
    throw payErr;
  }

  if (!paymentTxid) throw new Error('Payment transaction failed or returned no TXID.');

  try {
    await addMintPoints(recipientAddress, {
      collection: collectionName,
      itemName,
      inscriptionId: result.inscriptionId,
      txid: result.txid || result.orderId,
      source: 'createTesseractWrapperInscription',
    });
  } catch (pointsError) {
    console.warn('[CollectionMinting] Failed to add mint points:', pointsError);
  }

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid,
  };
};

/**
 * SIGNAL-spezifischer Mint: baut pro Mint einen byte-stabilen
 * `signal-child.min.html` Wrapper mit eingebetteten <meta>-Tags
 * (collection / edition / provenance) und schreibt ihn ein. Kein Delegate
 * — der Wrapper lädt die SIGNAL-Engine via <script src="/content/<engineId>">
 * und nutzt die eigene (vom Protokoll vergebene) Inscription-ID als
 * deterministischen FNV-1a-Seed (siehe extractInscriptionId in der Engine).
 *
 * Edition-Nummer wird vom Frontend basierend auf dem aktuellen
 * `count-by-original`-Stand vergeben (`signalMintCount + 1`). Bei
 * gleichzeitigen Mints kann es zu Kollisionen kommen — für eine echte
 * Reservierung müsste der Backend-Endpoint atomic increment liefern.
 *
 * Bewusst KEIN parentInscriptionId: SIGNAL ist über recursive endpoints
 * verkettet, nicht über ord-protocol-Provenance.
 */
export const createSignalWrapperInscription = async (
  itemName: string,
  recipientAddress: string,
  collectionName: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | 'okx' | null,
  itemPrice: number | undefined,
  editionNumber: number
): Promise<{ inscriptionId: string; txid: string; paymentTxid?: string }> => {
  console.log(`[CollectionMinting] Creating SIGNAL wrapper inscription for ${itemName} (edition #${editionNumber})`);

  if (!Number.isInteger(editionNumber) || editionNumber < 1 || editionNumber > SIGNAL_EDITION_LIMIT) {
    throw new Error(
      `SIGNAL editionNumber out of range: ${editionNumber} (expected 1..${SIGNAL_EDITION_LIMIT})`
    );
  }

  const wrapperHtml = buildSignalWrapper(editionNumber);

  if (wrapperHtml.length !== SIGNAL_WRAPPER_BYTES) {
    console.error(
      `[CollectionMinting] ❌ SIGNAL wrapper byte length mismatch: ${wrapperHtml.length} (expected ${SIGNAL_WRAPPER_BYTES})`
    );
    throw new Error('SIGNAL wrapper HTML byte length mismatch — refusing to mint corrupted asset.');
  }

  const htmlFile = new File(
    [wrapperHtml],
    `signal-child.min.html`,
    { type: 'text/html;charset=utf-8' }
  );

  console.log(`[CollectionMinting] ✅ SIGNAL wrapper file: ${htmlFile.name} (${htmlFile.size} bytes, edition #${editionNumber})`);
  console.log(`[CollectionMinting] 📡 Step 1/3: Calling backend API createUnisatInscription (engine=${SIGNAL_ENGINE_INSCRIPTION_ID})…`);

  let result;
  try {
    result = await createUnisatInscription({
      file: htmlFile,
      address: recipientAddress,
      feeRate,
      postage: 330,
    });
    console.log(`[CollectionMinting] ✅ Step 1/3 done. orderId=${result.orderId}, payAddress=${result.payAddress}, amount=${result.amount}`);
  } catch (apiErr: any) {
    console.error(`[CollectionMinting] ❌ Step 1/3 FAILED (createUnisatInscription):`, apiErr);
    throw new Error(`Inscription API failed: ${apiErr?.message || apiErr}`);
  }

  if (!result.payAddress || !result.amount) {
    console.error(`[CollectionMinting] ❌ Missing payAddress or amount in API response:`, result);
    throw new Error('UniSat API did not return a pay address or amount for inscription fees.');
  }

  // Zahlung: Inscription-Order ZUERST (kritisch), Item-Preis DANACH (best-effort).
  console.log(`[CollectionMinting] 💸 Step 2/3: Paying via ${walletType} (inscription first)...`);
  let paymentTxid: string;
  try {
    paymentTxid = await payInscriptionFeeFirst(result.payAddress, result.amount, itemPrice, walletType);
    console.log(`[CollectionMinting] ✅ Step 2/3 done. paymentTxid=${paymentTxid}`);
  } catch (payErr: any) {
    console.error(`[CollectionMinting] ❌ Step 2/3 FAILED (payment):`, payErr);
    throw payErr;
  }

  if (!paymentTxid) throw new Error('Payment transaction failed or returned no TXID.');

  try {
    await addMintPoints(recipientAddress, {
      collection: collectionName,
      itemName,
      inscriptionId: result.inscriptionId,
      txid: result.txid || result.orderId,
      source: 'createSignalWrapperInscription',
    });
  } catch (pointsError) {
    console.warn('[CollectionMinting] Failed to add mint points:', pointsError);
  }

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid,
  };
};

