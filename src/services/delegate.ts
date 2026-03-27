import { Card } from '../types/wallet';
import { createUnisatInscription, createBatchUnisatInscriptions, UnisatInscriptionResponse } from './unisatService';
import { sendBitcoinViaUnisat, sendBitcoinViaXverse, sendMultipleBitcoinPayments } from '../utils/wallet';
// HINWEIS: fetchInscriptionImageAsFile wird nicht mehr benötigt, da wir nur JSON-Metadaten einschreiben

export interface DelegateContent {
  p: 'ord-20'; // Protocol identifier
  op: 'delegate'; // Operation type
  cardId: string;
  originalInscriptionId: string;
  name: string;
  rarity: string;
  collection: string; // Ihre Kollektion-ID
  timestamp?: number;
}

// API-Endpunkt für Inskriptionen
const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || '';

// Recipient Address für Pack-Verkauf
const RECIPIENT_ADDRESS = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft';

/**
 * Erstellt eine Delegate-Inskription über UniSat API
 * Diese referenziert nur die Original-Karte, nicht das Bild selbst
 */
export const createDelegateInscription = async (
  card: Card,
  recipientAddress: string,
  collectionId: string,
  feeRate: number = 1,
  walletType: 'unisat' | 'xverse' | 'okx' | null = null
): Promise<{ inscriptionId: string; txid: string; payAddress?: string; amount?: number }> => {
  console.log(`[Delegate] Creating delegate inscription for card: ${card.name} (${card.id})`);
  console.log(`[Delegate] Original inscription ID: ${card.inscriptionId}`);
  
  // WICHTIG: Delegate-Inskriptionen enthalten nur JSON-Metadaten, NICHT die kompletten Bilder!
  // Schritt 1: Erstelle JSON-Metadaten für Delegate-Inskription (ORD-20 Standard)
  const delegateContent: DelegateContent = {
    p: 'ord-20',
    op: 'delegate',
    cardId: card.id,
    originalInscriptionId: card.inscriptionId,
    name: card.name,
    rarity: card.rarity,
    collection: collectionId,
    timestamp: Date.now(),
  };

  // Schritt 2: Erstelle JSON-Datei (nicht SVG-Bild!)
  const jsonContent = JSON.stringify(delegateContent);
  const jsonFile = new File(
    [jsonContent], 
    `${card.id}.json`, 
    { type: 'application/json' }
  );
  
  console.log(`[Delegate] ✅ JSON-Metadaten erstellt: ${jsonFile.name} (${jsonFile.size} bytes)`);
  
  // Schritt 3: Erstelle Inskription über UniSat API (mit JSON-Metadaten, nicht Bild!)
  console.log(`[Delegate] Creating inscription with JSON metadata...`);
  const result = await createUnisatInscription({
    file: jsonFile, // JSON-Metadaten, nicht das Bild!
    address: recipientAddress,
    feeRate,
    postage: 330,
    delegateMetadata: JSON.stringify(delegateContent), // Metadaten für Backend-Registrierung
  });
  
  console.log(`[Delegate] ✅ Delegate inscription created: ${result.inscriptionId}`);
    
    return {
    inscriptionId: result.inscriptionId,
    txid: result.txid || result.orderId,
    payAddress: result.payAddress,
    amount: result.amount,
  };
};

/**
 * Erstellt mehrere Delegate-Inskriptionen für ein Pack über UniSat API
 * Führt Zahlungen für Pack-Preis und Inskriptions-Fees durch
 */
export const createBatchDelegates = async (
  cards: Card[],
  recipientAddress: string,
  collectionId: string,
  feeRate: number = 1,
  walletType: 'unisat' | 'xverse' | 'okx' | null = null,
  packPrice: number = 0
): Promise<Array<{ inscriptionId: string; txid: string; card: Card; payAddress?: string; amount?: number; paymentTxid?: string }>> => {
  console.log(`[Delegate] Creating batch delegates for ${cards.length} cards...`);
  
  // WICHTIG: Delegate-Inskriptionen enthalten HTML mit <img>-Tag, das das Originalbild referenziert!
  // Dies macht die Inskriptionen klein (~400-600 Bytes) und zeigt das Bild in Ordinals-Explorern an
  const files: File[] = [];
  const cardMetadata: Array<{ card: Card; metadata: DelegateContent }> = [];
  
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    console.log(`[Delegate] [${i + 1}/${cards.length}] Processing: ${card.name} (${card.id})`);
    
    try {
      // Erstelle JSON-Metadaten für Delegate-Registry (interne Verwendung)
      const delegateContent: DelegateContent = {
        p: 'ord-20',
        op: 'delegate',
        cardId: card.id,
        originalInscriptionId: card.inscriptionId,
        name: card.name,
        rarity: card.rarity,
        collection: collectionId,
        timestamp: Date.now(),
      };
      
      // Erstelle HTML-Datei für Delegate-Inskription (zeigt das Originalbild an)
      // WICHTIG: Verwende HTML mit <img>-Tag, damit Ordinals-Explorer das Bild anzeigen können!
      // MIME-Type: text/html;charset=utf-8 (wie bei funktionierenden Delegate-Inskriptionen)
      // WICHTIG: Relativer Pfad /content/... statt https://... da Ordinals-Inskriptionen nichts außerhalb der Chain abrufen können!
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="application/json" id="delegate-metadata">
${JSON.stringify(delegateContent)}
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
<img src="/content/${card.inscriptionId}" alt="${card.name}" />
</body>
</html>`;
      
      const htmlFile = new File(
        [htmlContent], 
        `${card.id}.html`, 
        { type: 'text/html' }
      );
      
      files.push(htmlFile);
      cardMetadata.push({ card, metadata: delegateContent });
      
      console.log(`[Delegate] ✅ HTML-Datei erstellt: ${htmlFile.name} (${htmlFile.size} bytes)`);
    } catch (error: any) {
      console.error(`[Delegate] ❌ Failed to create delegate metadata for ${card.name}:`, error);
      throw new Error(`Konnte Metadaten für ${card.name} nicht erstellen: ${error.message}`);
    }
  }
  
  console.log(`[Delegate] ✅ All ${files.length} delegate HTML files created`);
  
  // Schritt 2: Erstelle alle Inskriptionen über UniSat API ZUERST
  // (Wir brauchen die payAddresses, bevor wir zahlen können)
  // Verwende jetzt createBatchUnisatInscriptions mit Metadaten-Support
  console.log('[Delegate] Schritt 2: Erstelle Inskriptionen über UniSat API (Batch mit Metadaten)...');
  
  // Erstelle Metadaten-Array für Batch-Funktion
  const metadataArray = cardMetadata.map(m => JSON.stringify(m.metadata));
  
  const unisatResults = await createBatchUnisatInscriptions(
    files,
    recipientAddress,
    feeRate,
    546, // Postage (Bitcoin Dust-Limit: 546 sats, erhöht von 330 um "too low dust" Fehler zu vermeiden)
    metadataArray // Metadaten für jede Datei
  );
  
  console.log(`[Delegate] ✅ All ${unisatResults.length} inscriptions created`);
  
  // Schritt 2: Sammle alle Zahlungen (Pack-Preis + Inskriptions-Fees)
  const allPayments: Array<{ address: string; amount: number }> = [];
  
  console.log(`[Delegate] Zahlungs-Prüfung:`);
  console.log(`  - packPrice: ${packPrice} BTC`);
  console.log(`  - walletType: ${walletType}`);
  console.log(`  - unisatResults mit payAddress: ${unisatResults.filter(r => r.payAddress).length}`);
  
  // Pack-Preis hinzufügen
  if (packPrice > 0) {
    allPayments.push({
      address: RECIPIENT_ADDRESS,
      amount: packPrice
    });
    console.log(`[Delegate] ✅ Pack-Preis hinzugefügt: ${packPrice} BTC (${(packPrice * 100000000).toFixed(0)} sats) an ${RECIPIENT_ADDRESS}`);
  } else {
    console.warn(`[Delegate] ⚠️ Pack-Preis ist 0 oder nicht gesetzt!`);
  }
  
  // Inskriptions-Fees sammeln
  // WICHTIG: Bei Batch-Requests gibt UniSat nur EINE payAddress für alle Dateien zurück
  // Bei Batch-Requests verwenden wir die berechneten Fees (wie im Mint-Menü), nicht die amount-Werte von UniSat!
  console.log(`[Delegate] Sammle Inskriptions-Fees von ${unisatResults.length} Ergebnissen...`);
  console.log(`[Delegate] ⚠️ WICHTIG: Bei Batch-Requests kann UniSat nur EINE payAddress zurückgeben`);
  
  const payAddresses = new Map<string, number>(); // address -> total amount (in BTC)
  
  // Prüfe ob alle Ergebnisse die gleiche payAddress haben (Batch-Request)
  const uniquePayAddresses = new Set<string>();
  for (const result of unisatResults) {
    if (result.payAddress && typeof result.payAddress === 'string') {
      uniquePayAddresses.add(result.payAddress);
    }
  }
  
  const isBatchRequest = uniquePayAddresses.size === 1 && unisatResults.length > 1;
  
  if (isBatchRequest) {
    // Bei Batch-Request: Verwende tatsächlichen Betrag von UniSat API!
    // KRITISCH: Unsere Berechnung (320 sats × 5 = 1600 sats) ist zu niedrig!
    // UniSat benötigt ~31658 sats für 5 Inskriptionen (inkl. Miner-Fees)
    console.log(`[Delegate] ✅ Batch-Request erkannt (${unisatResults.length} Dateien, 1 payAddress)`);
    
    const payAddress = Array.from(uniquePayAddresses)[0];
    
    // WICHTIG: Prüfe ob UniSat einen amount zurückgegeben hat
    // Bei Batch-Requests gibt UniSat möglicherweise den Gesamtbetrag im ersten Ergebnis zurück
    let amountInBTC = unisatResults[0]?.amount || null;
    
    if (!amountInBTC || amountInBTC === 0) {
      // Fallback: Wenn kein amount, dann prüfe alle Ergebnisse
      console.log(`[Delegate] ⚠️ Kein amount im ersten Ergebnis, prüfe alle...`);
      for (const result of unisatResults) {
        if (result.amount && result.amount > 0) {
          amountInBTC = result.amount;
          console.log(`[Delegate] ✅ Amount gefunden in Ergebnis: ${amountInBTC.toFixed(8)} BTC`);
          break;
        }
      }
    }
    
    if (!amountInBTC || amountInBTC === 0) {
      // FALLBACK: Für HTML-Dateien (kleine Dateien ~400-600 Bytes) sind die Fees niedriger
      // Eine kleine HTML-Inskription kostet ~800-1200 sats (inkl. Postage + Miner-Fees)
      // Dies ist viel niedriger als die großen SVG-Bilder (5-30 KB), die ~6320 sats pro Inskription kosten würden
      const estimatedFeePerInscription = 1000; // sats für kleine HTML-Dateien (realistischer Wert)
      const totalFeeInSats = estimatedFeePerInscription * unisatResults.length * feeRate;
      amountInBTC = totalFeeInSats / 100000000;
      console.log(`[Delegate] ⚠️ KEIN amount von UniSat API! Verwende Fallback: ${amountInBTC.toFixed(8)} BTC (${totalFeeInSats} sats)`);
      console.log(`[Delegate] ⚠️ WICHTIG: Dies ist eine Schätzung für JSON-Metadaten! UniSat sollte den korrekten Betrag zurückgeben!`);
    } else {
      console.log(`[Delegate] ✅ Verwende tatsächlichen Betrag von UniSat API: ${amountInBTC.toFixed(8)} BTC`);
      
      // Warnung wenn Fees sehr hoch sind (mehr als ~1000 sats pro Inskription für kleine HTML-Dateien)
      const amountInSats = amountInBTC * 100000000;
      const feePerInscription = amountInSats / unisatResults.length;
      if (feePerInscription > 1000) {
        console.warn(`[Delegate] ⚠️ WARNUNG: Inskriptions-Fees sind sehr hoch: ${feePerInscription.toFixed(0)} sats pro Inskription`);
        console.warn(`[Delegate] ⚠️ Für kleine HTML-Dateien (~400-600 Bytes) sollten die Fees ~800-1000 sats pro Inskription sein`);
        console.warn(`[Delegate] ⚠️ Dies könnte an einem hohen feeRate liegen. Prüfen Sie den feeRate-Wert (aktuell: ${feeRate} sat/vB)`);
      }
    }
    
    payAddresses.set(payAddress, amountInBTC);
    
    console.log(`[Delegate] ✅ Inskriptions-Fees: ${amountInBTC.toFixed(8)} BTC (${(amountInBTC * 100000000).toFixed(0)} sats) an ${payAddress}`);
    console.log(`[Delegate] ℹ️ Das sind ~${((amountInBTC * 100000000) / unisatResults.length).toFixed(0)} sats pro Inskription (${unisatResults.length} Inskriptionen)`);
  } else {
    // Bei einzelnen Requests: Verwende tatsächliche Beträge von UniSat API
    console.log(`[Delegate] Einzel-Requests erkannt (${uniquePayAddresses.size} verschiedene Adressen)`);
    
    // WICHTIG: Sammle alle payAddresses und ihre Beträge
    for (let i = 0; i < unisatResults.length; i++) {
      const result = unisatResults[i];
      console.log(`[Delegate] ========== Ergebnis ${i + 1} ==========`);
      console.log(`[Delegate]   - orderId: ${result.orderId}`);
      console.log(`[Delegate]   - payAddress: ${result.payAddress || 'FEHLT'} (Type: ${typeof result.payAddress})`);
      console.log(`[Delegate]   - amount (von API): ${result.amount || 'FEHLT'} BTC`);
      console.log(`[Delegate]   - inscriptionId: ${result.inscriptionId}`);
      
      // Prüfe ob payAddress vorhanden ist
      const payAddressValue = result.payAddress;
      const hasPayAddress = payAddressValue !== null && 
                           payAddressValue !== undefined && 
                           payAddressValue !== '' && 
                           payAddressValue !== 'null' &&
                           typeof payAddressValue === 'string';
      
      if (hasPayAddress) {
        // Verwende den tatsächlichen Betrag von UniSat API
        let amountInBTC = result.amount;
        
        if (!amountInBTC || amountInBTC === 0) {
          // Fallback: Für HTML-Dateien (kleine Dateien ~400-600 Bytes)
          const baseFeePerInscription = 1000; // sats für kleine HTML-Dateien (inkl. Postage + Miner-Fees)
          const feePerInscription = baseFeePerInscription * feeRate;
          amountInBTC = feePerInscription / 100000000; // Konvertiere zu BTC
          console.log(`[Delegate] ⚠️ Kein amount von API, verwende Fallback: ${amountInBTC.toFixed(8)} BTC (${feePerInscription} sats)`);
        } else {
          console.log(`[Delegate] ✅ Verwende tatsächlichen Betrag von UniSat API: ${amountInBTC.toFixed(8)} BTC`);
        }
        
        const current = payAddresses.get(result.payAddress) || 0;
        payAddresses.set(result.payAddress, current + amountInBTC);
        console.log(`[Delegate] ✅ Inskriptions-Fee hinzugefügt: ${amountInBTC.toFixed(8)} BTC an ${result.payAddress} (Gesamt: ${(current + amountInBTC).toFixed(8)} BTC)`);
      } else {
        console.warn(`[Delegate] ⚠️ Ergebnis ${i + 1} hat keine payAddress!`);
        console.warn(`[Delegate]   - orderId: ${result.orderId}`);
        console.warn(`[Delegate]   - inscriptionId: ${result.inscriptionId}`);
      }
    }
  }
  
  console.log(`[Delegate] Gesammelte Inskriptions-Fees: ${payAddresses.size} verschiedene Adressen`);
  
  // FALLBACK: Wenn keine payAddress gefunden wurde, aber Inskriptionen erstellt wurden
  // Dann verwende eine Standard-Pay-Address (z.B. die erste Order-ID als Referenz)
  if (payAddresses.size === 0 && unisatResults.length > 0) {
    console.warn(`[Delegate] ⚠️ KEINE payAddress gefunden! Verwende Fallback-Logik...`);
    console.warn(`[Delegate]   - Anzahl Ergebnisse: ${unisatResults.length}`);
    console.warn(`[Delegate]   - Erste Order-ID: ${unisatResults[0]?.orderId}`);
    
    // Prüfe ob vielleicht die payAddress in einem anderen Feld ist
    unisatResults.forEach((result, index) => {
      console.log(`[Delegate]   - Ergebnis ${index + 1} vollständig:`, JSON.stringify(result, null, 2));
    });
    
    // FALLBACK: Wenn keine payAddress vorhanden, bedeutet das möglicherweise,
    // dass die UniSat API die Zahlung bereits verarbeitet hat oder keine Zahlung benötigt
    // In diesem Fall überspringen wir die Inskriptions-Fees
    console.warn(`[Delegate] ⚠️ WICHTIG: Keine payAddress gefunden - Inskriptions-Fees werden übersprungen!`);
    console.warn(`[Delegate] ⚠️ Mögliche Ursachen:`);
    console.warn(`[Delegate]   1. UniSat API gibt keine payAddress zurück (bereits bezahlt?)`);
    console.warn(`[Delegate]   2. Backend gibt payAddress nicht korrekt weiter`);
    console.warn(`[Delegate]   3. Response-Struktur ist anders als erwartet`);
  }
  
  // Inskriptions-Fees zu Zahlungen hinzufügen
  // WICHTIG: Für Xverse müssen kleine Beträge (< 1500 sats) zusammengefasst werden
  const MIN_XVERSE_AMOUNT_SATS = 1500;
  
  if (walletType === 'xverse') {
    // Für Xverse: Fasse kleine Beträge zusammen
    const smallPayments: Array<{ address: string; amount: number }> = [];
    const largePayments: Array<{ address: string; amount: number }> = [];
    
    for (const [address, amount] of payAddresses.entries()) {
      const amountSats = amount * 100000000;
      
      if (amountSats < MIN_XVERSE_AMOUNT_SATS) {
        smallPayments.push({ address, amount });
      } else {
        largePayments.push({ address, amount });
      }
    }
    
    // Große Beträge direkt hinzufügen
    for (const payment of largePayments) {
      allPayments.push(payment);
      console.log(`[Delegate] ✅ Inskriptions-Fee hinzugefügt: ${payment.amount} BTC (${(payment.amount * 100000000).toFixed(0)} sats) an ${payment.address}`);
    }
    
    // Kleine Beträge zusammenfassen
    if (smallPayments.length > 0) {
      // Verwende die erste Adresse als Konsolidierungs-Adresse
      const consolidatedAddress = smallPayments[0].address;
      const consolidatedAmount = smallPayments.reduce((sum, p) => sum + p.amount, 0);
      const consolidatedSats = consolidatedAmount * 100000000;
      
      console.log(`[Delegate] ⚠️ ${smallPayments.length} kleine Zahlungen (< ${MIN_XVERSE_AMOUNT_SATS} sats) werden konsolidiert`);
      console.log(`[Delegate]   Konsolidierter Betrag: ${consolidatedAmount.toFixed(8)} BTC (${consolidatedSats.toFixed(0)} sats)`);
      
      allPayments.push({
        address: consolidatedAddress,
        amount: consolidatedAmount
      });
      console.log(`[Delegate] ✅ Konsolidierte Inskriptions-Fees hinzugefügt: ${consolidatedAmount.toFixed(8)} BTC (${consolidatedSats.toFixed(0)} sats) an ${consolidatedAddress}`);
    }
  } else {
    // Für andere Wallets: Alle Beträge direkt hinzufügen
    for (const [address, amount] of payAddresses.entries()) {
      allPayments.push({
        address,
        amount
      });
      console.log(`[Delegate] ✅ Inskriptions-Fees hinzugefügt: ${amount} BTC (${(amount * 100000000).toFixed(0)} sats) an ${address}`);
    }
  }
  
  // Schritt 3: Alle Zahlungen in EINER Transaktion kombinieren
  console.log(`[Delegate] ========== ZAHLUNGS-PRÜFUNG ==========`);
  console.log(`[Delegate] Zahlungs-Bedingung prüfen:`);
  console.log(`  - allPayments.length: ${allPayments.length}`);
  console.log(`  - walletType: ${walletType}`);
  console.log(`  - Bedingung erfüllt: ${allPayments.length > 0 && walletType ? 'JA' : 'NEIN'}`);
  console.log(`[Delegate] Vollständige allPayments Liste:`, JSON.stringify(allPayments, null, 2));
  
  // WICHTIG: paymentTxid außerhalb des if-Blocks deklarieren, damit es überall verfügbar ist
  let paymentTxid: string | null = null;
  
  if (allPayments.length > 0 && walletType) {
    console.log(`[Delegate] Schritt 3: Zahle alle Beträge in einer Transaktion (${allPayments.length} Empfänger)...`);
    
    // Detailliertes Logging
    console.log('[Delegate] ========== ZAHLUNGS-DETAILS ==========');
    allPayments.forEach((payment, index) => {
      console.log(`[Delegate]   ${index + 1}. ${payment.address}: ${payment.amount} BTC (${(payment.amount * 100000000).toFixed(0)} sats)`);
    });
    
    try {
      const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalSats = totalAmount * 100000000;
      console.log(`[Delegate] Gesamtbetrag: ${totalAmount} BTC (${totalSats.toFixed(0)} sats)`);
      console.log(`[Delegate] ========== KOSTEN-AUFSTELLUNG ==========`);
      console.log(`[Delegate] 📦 Pack-Preis: ${packPrice.toFixed(8)} BTC (${(packPrice * 100000000).toFixed(0)} sats)`);
      const inscriptionFeesTotal = allPayments.filter(p => p.address !== RECIPIENT_ADDRESS).reduce((sum, p) => sum + p.amount, 0);
      console.log(`[Delegate] 📝 Inskriptions-Fees: ${inscriptionFeesTotal.toFixed(8)} BTC (${(inscriptionFeesTotal * 100000000).toFixed(0)} sats)`);
      console.log(`[Delegate] 💰 GESAMT (ohne Transaktions-Fees): ${totalAmount.toFixed(8)} BTC (${totalSats.toFixed(0)} sats)`);
      console.log(`[Delegate] ⚠️ HINWEIS: Zusätzlich fallen Transaktions-Fees an (vom Wallet automatisch berechnet)`);
      if (walletType === 'unisat') {
        console.log(`[Delegate] ⚠️ UNISAT: Bei ${allPayments.length} separaten Zahlungen = ${allPayments.length} × Transaktions-Fees`);
        console.log(`[Delegate] 💡 TIPP: Xverse kann mehrere Zahlungen in EINER Transaktion kombinieren (nur 1 × Transaktions-Fee)`);
      } else if (walletType === 'xverse') {
        console.log(`[Delegate] ✅ XVerse: Kann mehrere Zahlungen in EINER Transaktion kombinieren (nur 1 × Transaktions-Fee)`);
      }
      console.log(`[Delegate] =========================================`);
      
      // WICHTIG: Erfasse die Zahlungs-Transaktions-ID
      paymentTxid = await sendMultipleBitcoinPayments(allPayments, walletType);
      console.log('[Delegate] ✅ Alle Zahlungen erfolgreich abgeschlossen');
      console.log(`[Delegate] 💰 Zahlungs-Transaktions-ID: ${paymentTxid}`);
      
      // Schritt 3.5: Prüfe automatisch den Status der Orders nach der Zahlung
      console.log('[Delegate] 🔍 Prüfe Status der Inskriptionen nach Zahlung...');
      try {
        const checkResponse = await fetch(`${INSCRIPTION_API_URL}/api/unisat/check-pending-inscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: recipientAddress,
          }),
        });
        
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          console.log(`[Delegate] ✅ Status-Prüfung: ${checkData.updated || 0} Inskriptionen aktualisiert`);
          
          // Aktualisiere die Ergebnisse mit finalen IDs, falls verfügbar
          if (checkData.updated > 0) {
            // Hole aktualisierte Delegate-Daten
            try {
              const delegatesResponse = await fetch(`${INSCRIPTION_API_URL}/api/delegates/${recipientAddress}?checkPending=false`);
              if (delegatesResponse.ok) {
                const updatedDelegates = await delegatesResponse.json();
                
                // Erstelle Map: pendingId -> finalInscriptionId
                // WICHTIG: Bei Batch-Requests haben wir pending-{orderId}-{index} IDs
                const pendingIdToFinalId = new Map<string, string>();
                
                // WICHTIG: updatedDelegates könnte ein Array oder ein Objekt mit .delegates sein
                const delegatesArray = Array.isArray(updatedDelegates) ? updatedDelegates : (updatedDelegates.delegates || []);
                
                for (const delegate of delegatesArray) {
                  if (!delegate.delegateInscriptionId.startsWith('pending-')) {
                    // Finde die entsprechende Karte über originalInscriptionId und cardId
                    const cardIndex = cardMetadata.findIndex(m => 
                      m.card.inscriptionId === delegate.originalInscriptionId && 
                      m.card.id === delegate.cardId
                    );
                    
                    if (cardIndex >= 0 && cardIndex < unisatResults.length) {
                      // Die Reihenfolge sollte übereinstimmen: cardMetadata[i] -> unisatResults[i]
                      const pendingId = unisatResults[cardIndex].inscriptionId;
                      if (pendingId.startsWith('pending-')) {
                        pendingIdToFinalId.set(pendingId, delegate.delegateInscriptionId);
                        console.log(`[Delegate] ✅ Finale ID gefunden (Index ${cardIndex}): ${pendingId} -> ${delegate.delegateInscriptionId} (${delegate.name})`);
                      }
                    }
                  }
                }
                
                // Aktualisiere unisatResults mit finalen IDs
                for (let i = 0; i < unisatResults.length; i++) {
                  const result = unisatResults[i];
                  if (result.inscriptionId.startsWith('pending-')) {
                    const finalId = pendingIdToFinalId.get(result.inscriptionId);
                    if (finalId) {
                      unisatResults[i].inscriptionId = finalId;
                      console.log(`[Delegate] ✅ Aktualisiert: ${result.inscriptionId} -> ${finalId}`);
                    }
                  }
                }
              }
            } catch (delegateError) {
              console.warn('[Delegate] ⚠️ Konnte aktualisierte Delegates nicht abrufen:', delegateError);
            }
          }
        }
      } catch (checkError) {
        console.warn('[Delegate] ⚠️ Status-Prüfung fehlgeschlagen (nicht kritisch):', checkError);
      }
    } catch (error: any) {
      console.error('[Delegate] Fehler bei kombinierter Zahlung:', error);
      console.error('[Delegate] Zahlungs-Details:', JSON.stringify(allPayments, null, 2));
      
      // Verbesserte Fehlermeldung
      if (error.message?.includes('Insufficient balance')) {
        const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
        throw new Error(`Insufficient balance. Benötigt: ${totalAmount} BTC + Transaktions-Fees. Bitte stellen Sie sicher, dass Ihr Wallet genug Bitcoin hat (inkl. Fees für ${allPayments.length} Empfänger).`);
      }
      
      throw new Error(`Zahlung fehlgeschlagen: ${error.message}`);
    }
  } else {
    if (allPayments.length === 0) {
      console.warn(`[Delegate] ⚠️ Keine Zahlungen zu verarbeiten! (packPrice: ${packPrice}, Inskriptions-Fees: ${unisatResults.filter(r => r.payAddress).length})`);
    }
    if (!walletType) {
      console.warn(`[Delegate] ⚠️ Kein walletType gesetzt! Zahlung wird übersprungen.`);
    }
  }
  
  // Schritt 4: Kombiniere Ergebnisse
  const results: Array<{ inscriptionId: string; txid: string; card: Card; payAddress?: string; amount?: number; paymentTxid?: string | null }> = [];
  
  for (let i = 0; i < unisatResults.length && i < cardMetadata.length; i++) {
    const unisatResult = unisatResults[i];
    const { card } = cardMetadata[i];
    results.push({
      inscriptionId: unisatResult.inscriptionId,
      txid: unisatResult.txid || unisatResult.orderId,
      card: card,
      payAddress: unisatResult.payAddress,
      amount: unisatResult.amount,
      paymentTxid: paymentTxid || undefined, // Füge Zahlungs-Transaktions-ID hinzu
    });
  }
  
  if (results.length !== cards.length) {
    throw new Error(`Nicht alle Inskriptionen erfolgreich: ${results.length}/${cards.length}`);
  }
  
  return results;
};

