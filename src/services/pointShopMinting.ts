/**
 * Point Shop Minting Service
 * Erstellt eine Delegate-Inskription für ein Point Shop Item
 * Der Benutzer hat bereits die Punkte bezahlt, muss nur noch die Inskriptions-Fees bezahlen
 */

import { createUnisatInscription, UnisatInscriptionResponse } from './unisatService';
import { sendBitcoinViaUnisat, sendBitcoinViaXverse } from '../utils/wallet';

const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

/**
 * Erstellt eine Delegate-Inskription für ein Point Shop Item
 * Das Item ist bereits ein Delegate, wir müssen nur eine neue Delegate-Inskription erstellen
 * die auf das Original-Delegate verweist
 */
export const mintPointShopItem = async (
  originalDelegateId: string,
  recipientAddress: string,
  feeRate: number = 1,
  walletType: 'unisat' | 'xverse' | null = null,
  walletState?: { walletType?: 'unisat' | 'xverse' | null }
): Promise<{ inscriptionId: string; txid: string; payAddress?: string; amount?: number; paymentTxid?: string }> => {
  console.log(`[PointShopMinting] Creating delegate inscription for Point Shop item: ${originalDelegateId}`);
  
  // Erstelle HTML-Datei die auf das Original-Delegate verweist
  // Dies ist ein "Delegate-of-Delegate" - die neue Inskription zeigt das Bild des Original-Delegates
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="application/json" id="delegate-metadata">
${JSON.stringify({
  p: 'ord-20',
  op: 'delegate',
  originalInscriptionId: originalDelegateId,
  source: 'point-shop',
  timestamp: Date.now(),
})}
</script>
<style>
body {
  margin: 0;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
</head>
<body>
<img src="/content/${originalDelegateId}" alt="Point Shop Item" />
</body>
</html>`;

  const htmlFile = new File(
    [htmlContent],
    `point-shop-${Date.now()}.html`,
    { type: 'text/html' }
  );

  console.log(`[PointShopMinting] ✅ HTML-Datei erstellt: ${htmlFile.name} (${htmlFile.size} bytes)`);

  // Erstelle Inskription über UniSat API
  console.log(`[PointShopMinting] Creating inscription via UniSat API...`);
  const result = await createUnisatInscription({
    file: htmlFile,
    address: recipientAddress,
    feeRate,
    postage: 330,
  });

  console.log(`[PointShopMinting] ✅ Inskription erstellt: ${result.inscriptionId}`);

  // Wenn payAddress vorhanden ist, muss der Benutzer die Fees bezahlen
  if (result.payAddress && result.amount) {
    console.log(`[PointShopMinting] Zahlung erforderlich: ${result.amount.toFixed(8)} BTC an ${result.payAddress}`);
    
    const payments = [{
      address: result.payAddress,
      amount: result.amount,
    }];

    let paymentTxid: string | undefined;

    if (walletType === 'unisat') {
      paymentTxid = await sendBitcoinViaUnisat(payments[0].address, payments[0].amount);
    } else if (walletType === 'xverse') {
      paymentTxid = await sendBitcoinViaXverse(payments[0].address, payments[0].amount);
    } else {
      throw new Error('Wallet type not supported');
    }

    console.log(`[PointShopMinting] ✅ Zahlung erfolgreich: ${paymentTxid}`);

    return {
      inscriptionId: result.inscriptionId,
      txid: result.txid || result.orderId,
      payAddress: result.payAddress,
      amount: result.amount,
      paymentTxid,
    };
  }

  return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    payAddress: result.payAddress,
    amount: result.amount,
  };
};

