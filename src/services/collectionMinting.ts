/**
 * Collection Minting Service
 * Handles minting of collection items (both delegate and original)
 */

import { createUnisatInscription } from './unisatService';
import { sendBitcoinViaUnisat, sendBitcoinViaXverse, sendMultipleBitcoinPayments } from '../utils/wallet';
import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl();

/**
 * Erstellt eine einzelne Delegate-Inskription für ein Collection-Item
 * @param contentType - 'html' für HTML-Inskriptionen (iframe), 'image' für Bilder (img). Auto-detect wenn nicht angegeben.
 * @param itemPrice - Preis des Items in sats (z.B. 2000 für TimeBIT, 10000 für TACTICAL). Wird an Admin-Adresse bezahlt.
 */
export const createSingleDelegate = async (
  originalInscriptionId: string,
  itemName: string,
  recipientAddress: string,
  collectionName: string,
  feeRate: number,
  walletType: 'unisat' | 'xverse' | null,
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

  // Erstelle Inskription über UniSat API
  const result = await createUnisatInscription({
    file: htmlFile,
    address: recipientAddress,
    feeRate,
    postage: 546, // Bitcoin Dust-Limit (erhöht von 330)
    delegateMetadata: JSON.stringify(delegateContent),
  });

  if (!result.payAddress || !result.amount) {
    throw new Error('UniSat API did not return a pay address or amount for inscription fees.');
  }

  // Zahlungen sammeln: Item-Preis (an Admin) + Inskriptions-Fees (an UniSat)
  const ADMIN_PAYMENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft'; // Admin Payment Wallet
  const payments: Array<{ address: string; amount: number }> = [];

  // 1. Item-Preis an Admin-Adresse (falls Preis vorhanden)
  if (itemPrice && itemPrice > 0) {
    const itemPriceBTC = itemPrice / 100000000; // Konvertiere sats zu BTC
    payments.push({
      address: ADMIN_PAYMENT_ADDRESS,
      amount: itemPriceBTC
    });
    console.log(`[CollectionMinting] Item price: ${itemPriceBTC.toFixed(8)} BTC (${itemPrice} sats) to ${ADMIN_PAYMENT_ADDRESS}`);
  }

  // 2. Inskriptions-Fees an UniSat
  payments.push({
    address: result.payAddress,
    amount: result.amount
  });
  console.log(`[CollectionMinting] Inscription fees: ${result.amount.toFixed(8)} BTC to ${result.payAddress}`);

  // Führe alle Zahlungen in einer Transaktion durch
  let paymentTxid: string | undefined;

  if (payments.length === 1) {
    // Einzelzahlung - verwende normale Funktion
    if (walletType === 'unisat') {
      paymentTxid = await sendBitcoinViaUnisat(payments[0].address, payments[0].amount);
    } else if (walletType === 'xverse') {
      paymentTxid = await sendBitcoinViaXverse(payments[0].address, payments[0].amount);
    } else {
      throw new Error('Unsupported wallet type for payment.');
    }
  } else {
    // Mehrere Zahlungen - verwende sendMultipleBitcoinPayments
    console.log(`[CollectionMinting] Paying ${payments.length} recipients in one transaction:`);
    payments.forEach((p, i) => {
      console.log(`[CollectionMinting]   ${i + 1}. ${p.address}: ${p.amount.toFixed(8)} BTC (${(p.amount * 100000000).toFixed(0)} sats)`);
    });
    
    if (!walletType) {
      throw new Error('Unsupported wallet type for payment.');
    }
    paymentTxid = await sendMultipleBitcoinPayments(payments, walletType);
  }

  if (!paymentTxid) {
    throw new Error('Payment transaction failed or returned no TXID.');
  }

  console.log(`[CollectionMinting] ✅ Payment successful, TXID: ${paymentTxid}`);

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    paymentTxid: paymentTxid,
  };
};

