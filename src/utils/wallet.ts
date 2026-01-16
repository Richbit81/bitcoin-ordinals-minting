import { WalletType, WalletAccount } from '../types/wallet';

declare global {
  interface Window {
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      switchNetwork: (network: 'livenet' | 'testnet') => Promise<void>;
      getNetwork: () => Promise<'livenet' | 'testnet'>;
      sendBitcoin: (to: string, amount: number) => Promise<string>;
      inscribeTransfer: (ticker: string, amount: string) => Promise<string>;
      signPsbt: (psbtHex: string, options?: { autoFinalized?: boolean }) => Promise<string>;
      signPsbts: (psbtHexs: string[], options?: { autoFinalized?: boolean }) => Promise<string[]>; // NEU
      pushPsbt: (psbtHex: string) => Promise<string>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
    BitcoinProvider?: {
      request: (method: string, params?: any) => Promise<any>;
    };
    xverse?: any;
  }
}

export const isUnisatInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Einfache PrÃ¼fung - wie vorher
  return typeof window.unisat !== 'undefined';
};

export const isXverseInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Einfache PrÃ¼fung - wie vorher (BitcoinProvider ist der Haupt-Provider)
  return typeof window.BitcoinProvider !== 'undefined';
};

/**
 * Warte auf UniSat Wallet mit Retry-Logik
 * Wichtig fÃ¼r localhost, wo Extensions verzÃ¶gert laden kÃ¶nnen
 */
export const waitForUnisat = (timeout = 3000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isUnisatInstalled()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isUnisatInstalled()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
};

/**
 * Warte auf Xverse Wallet mit Retry-Logik
 * Wichtig fÃ¼r localhost, wo Extensions verzÃ¶gert laden kÃ¶nnen
 */
export const waitForXverse = (timeout = 3000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isXverseInstalled()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isXverseInstalled()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
};

export const connectUnisat = async (): Promise<WalletAccount[]> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet is not installed. Please install the UniSat browser extension.');
  }

  try {
    // PrÃ¼fe ob window.unisat wirklich verfÃ¼gbar ist
    if (!window.unisat || typeof window.unisat.requestAccounts !== 'function') {
      throw new Error('UniSat Wallet is detected but the connection API is not available. This may be due to multiple wallet extensions interfering with each other. Try disabling other Bitcoin wallet extensions and reload the page.');
    }

    const accounts = await window.unisat.requestAccounts();
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned. Please unlock your UniSat Wallet and try again.');
    }

    const network = await window.unisat.getNetwork();
    
    if (network !== 'livenet') {
      throw new Error('Please switch to Bitcoin Mainnet in your UniSat Wallet.');
    }

    return accounts.map(addr => ({ address: addr }));
  } catch (error: any) {
    // Spezifische Fehlermeldungen
    if (error.message && error.message.includes('User rejected')) {
      throw new Error('Connection rejected. Please approve the connection request in your wallet.');
    }
    if (error.message && error.message.includes('intercept')) {
      throw new Error('Multiple wallet extensions detected. Please disable other Bitcoin wallet extensions (except UniSat) and reload the page.');
    }
    throw new Error(error.message || 'Error connecting to UniSat Wallet. Make sure the extension is unlocked and try again.');
  }
};

export const connectXverse = async (): Promise<WalletAccount[]> => {
  if (!isXverseInstalled()) {
    throw new Error('Xverse Wallet is not installed. Please install the Xverse browser extension.');
  }

  try {
    console.log('Attempting Xverse connection using sats-connect...');
    
    // Dynamischer Import von sats-connect zur Laufzeit
    let satsConnect: any;
    try {
      satsConnect = await import('sats-connect');
    } catch (importError: any) {
      const errorMsg = importError.message || String(importError);
      throw new Error(`Failed to load sats-connect: ${errorMsg}. Please ensure sats-connect is installed: npm install sats-connect`);
    }
    
    if (!satsConnect || !satsConnect.request) {
      throw new Error('sats-connect konnte nicht geladen werden. Bitte stellen Sie sicher, dass sats-connect installiert ist (npm install sats-connect).');
    }
    
    // wallet_connect kann mit null aufgerufen werden fÃ¼r alle Adresstypen
    const response = await satsConnect.request('wallet_connect', null);
    
    console.log('Xverse wallet_connect response:', response);

    if (response.status === 'success') {
      const addresses = response.result?.addresses || [];
      
      if (!addresses || addresses.length === 0) {
        throw new Error('No addresses returned from Xverse Wallet');
      }

      const accounts: WalletAccount[] = [];
      
      // Finde Ordinals-Adresse (bc1p...)
      const ordinalsAddress = addresses.find(
        (addr: any) => addr.purpose === 'ordinals'
      );
      
      // Finde Payment-Adresse (falls benÃ¶tigt)
      const paymentAddress = addresses.find(
        (addr: any) => addr.purpose === 'payment'
      );

      if (ordinalsAddress && ordinalsAddress.address) {
        accounts.push({
          address: ordinalsAddress.address,
          publicKey: ordinalsAddress.publicKey
        });
      }
      
      if (paymentAddress && paymentAddress.address && 
          paymentAddress.address !== ordinalsAddress?.address) {
        accounts.push({
          address: paymentAddress.address,
          publicKey: paymentAddress.publicKey
        });
      }

      if (accounts.length === 0) {
        throw new Error('No valid addresses found. Please ensure your Xverse Wallet has Ordinals addresses set up.');
      }

      // Filtere nur Taproot-Adressen (bc1p...)
      const taprootAccounts = accounts.filter(acc => acc.address && acc.address.startsWith('bc1p'));
      
      if (taprootAccounts.length === 0 && accounts.length > 0) {
        throw new Error('No Taproot addresses found. Please set up a Taproot address (bc1p...) in your Xverse Wallet.');
      }

      return taprootAccounts.length > 0 ? taprootAccounts : accounts;
    } else {
      // Fehlerbehandlung
      if (response.error?.code === 'USER_REJECTION') {
        throw new Error('Connection cancelled by user. Please approve the connection request in your wallet popup.');
      }
      throw new Error(response.error?.message || 'Failed to connect to Xverse Wallet');
    }
  } catch (error: any) {
    console.error('Xverse connection error:', error);
    
    // Spezifische Fehlermeldungen
    if (error.message && (error.message.includes('User rejected') || error.message.includes('rejected') || error.message.includes('USER_REJECTION'))) {
      throw new Error('Connection rejected. Please approve the connection request in your wallet popup.');
    }
    if (error.message && error.message.includes('intercept')) {
      throw new Error('Multiple wallet extensions detected. Please disable other Bitcoin wallet extensions (except Xverse) and reload the page.');
    }
    throw new Error(error.message || 'Error connecting to Xverse Wallet. Make sure the extension is unlocked and try again.');
  }
};

export const getUnisatAccounts = async (): Promise<WalletAccount[]> => {
  if (!isUnisatInstalled()) {
    return [];
  }

  try {
    const accounts = await window.unisat!.getAccounts();
    return accounts.map(addr => ({ address: addr }));
  } catch {
    return [];
  }



/**
 * Gibt die Taproot-Adresse (bc1p...) vom UniSat Wallet zurÃ¼ck.
 * Falls keine Taproot-Adresse gefunden wird, wird die erste verfÃ¼gbare Adresse zurÃ¼ckgegeben,
 * aber eine Warnung wird ausgegeben.
 */
export const getUnisatTaprootAddress = async (): Promise<string | null> => {
  if (!isUnisatInstalled()) {
    return null;
  }

  try {
    const accounts = await window.unisat!.getAccounts();
    
    // Suche nach Taproot-Adresse (bc1p...)
    const taprootAddress = accounts.find(addr => addr.startsWith('bc1p'));
    
    if (taprootAddress) {
      console.log('[UniSat] âœ… Taproot-Adresse gefunden:', taprootAddress);
      return taprootAddress;
    }
    
    // Falls keine Taproot-Adresse gefunden, prÃ¼fe alle Adressen
    console.warn('[UniSat] âš ï¸ Keine Taproot-Adresse (bc1p...) gefunden!');
    console.warn('[UniSat] âš ï¸ VerfÃ¼gbare Adressen:', accounts);
    console.warn('[UniSat] âš ï¸ FÃ¼r Inskriptionen sollte eine Taproot-Adresse verwendet werden!');
    console.warn('[UniSat] âš ï¸ Bitte wechseln Sie zur Taproot-Adresse im UniSat Wallet!');
    
    // Gib die erste Adresse zurÃ¼ck (falls vorhanden)
    if (accounts.length > 0) {
      console.warn([UniSat] âš ï¸ Verwende stattdessen: );
      return accounts[0];
    }
    
    return null;
  } catch (error: any) {
    console.error('[UniSat] Fehler beim Abrufen der Taproot-Adresse:', error);
    return null;
  }
};
 = async (): Promise<WalletAccount[]> => {
  if (!isXverseInstalled()) {
    return [];
  }

  try {
    // WICHTIG: Diese Funktion sollte KEINE Popups Ã¶ffnen!
    // Sie prÃ¼ft nur, ob bereits Accounts verbunden sind.
    // Verwenden Sie connectXverse() fÃ¼r aktive Verbindungen mit Popup.
    
    // Versuche wallet_getAccount (ohne Popup)
    try {
      // Dynamischer Import von sats-connect zur Laufzeit
      const satsConnect: any = await import('sats-connect');
      if (!satsConnect || !satsConnect.request) {
        return [];
      }
      const accountResponse = await satsConnect.request('wallet_getAccount', null);
      
      if (accountResponse.status === 'success' && accountResponse.result?.addresses) {
        const addresses = accountResponse.result.addresses || [];
        const accounts: WalletAccount[] = [];
        
        // Finde Ordinals-Adresse
        const ordinalsAddr = addresses.find((addr: any) => addr.purpose === 'ordinals');
        if (ordinalsAddr && ordinalsAddr.address) {
          accounts.push({
            address: ordinalsAddr.address,
            publicKey: ordinalsAddr.publicKey
          });
        }
        
        return accounts;
      }
    } catch (err: any) {
      // Ignoriere Fehler beim automatischen Laden - keine Popups!
      // Stille ignorieren - das ist normal wenn keine Verbindung besteht
      if (err && err !== 'cancel' && !err.message?.includes('cancel')) {
        // Nur nicht-cancel Fehler loggen (optional)
      }
    }
    
    return [];
  } catch {
    return [];
  }
};

export const sendBitcoinViaUnisat = async (
  to: string,
  amount: number
): Promise<string> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet nicht gefunden');
  }

  // PrÃ¼fe ob window.unisat und sendBitcoin verfÃ¼gbar sind
  if (!window.unisat) {
    throw new Error('UniSat Wallet ist nicht verfÃ¼gbar. Bitte stellen Sie sicher, dass die UniSat Extension installiert und aktiviert ist.');
  }

  // Debug: Logge verfÃ¼gbare UniSat-Methoden
  const availableMethods = Object.keys(window.unisat).filter(key => typeof (window.unisat as any)[key] === 'function');
  console.log('[UniSat] VerfÃ¼gbare Methoden:', availableMethods);
  console.log('[UniSat] sendBitcoin vorhanden:', typeof window.unisat.sendBitcoin);

  if (typeof window.unisat.sendBitcoin !== 'function') {
    console.error('[UniSat] âŒ sendBitcoin ist nicht verfÃ¼gbar! VerfÃ¼gbare Methoden:', availableMethods);
    throw new Error('UniSat sendBitcoin Funktion ist nicht verfÃ¼gbar. Bitte aktualisieren Sie Ihre UniSat Extension auf die neueste Version.');
  }

  try {
    const amountInSats = Math.round(amount * 100000000);
    console.log('[UniSat] Sending Bitcoin:', { to, amount, amountInSats });
    
    // PrÃ¼fe auf Dust-Limit (546 sats ist das Bitcoin Dust-Limit)
    if (amountInSats < 546) {
      throw new Error(`Amount too small. Minimum is 546 sats (Bitcoin dust limit). You tried to send ${amountInSats} sats.`);
    }
    
    // PrÃ¼fe ob Adresse gÃ¼ltig ist
    if (!to || typeof to !== 'string' || to.length < 26) {
      throw new Error(`Invalid address: ${to}`);
    }
    
    // Stelle sicher, dass satoshis eine positive ganze Zahl ist
    if (!Number.isInteger(amountInSats) || amountInSats <= 0 || isNaN(amountInSats)) {
      throw new Error(`Invalid satoshi amount: ${amountInSats}. Must be a positive integer. Original amount: ${amount} BTC`);
    }
    
    // WICHTIG: UniSat sendBitcoin erwartet den Betrag in SATOSHI, nicht BTC!
    // Laut UniSat-Dokumentation: sendBitcoin(toAddress: string, satoshis: number)
    console.log('[UniSat] Calling sendBitcoin with satoshis:', { to, satoshis: amountInSats, addressLength: to.length, addressValid: to.length >= 26 });
    
    const result = await window.unisat.sendBitcoin(to, amountInSats);
    
    // PrÃ¼fe ob result ein String (txid) oder ein Objekt ist
    let txid: string;
    if (typeof result === 'string') {
      txid = result;
    } else if (result && typeof result === 'object') {
      // MÃ¶glicherweise gibt UniSat ein Objekt zurÃ¼ck
      txid = result.txid || result.txId || result.transactionId || '';
      if (!txid) {
        console.error('[UniSat] Unexpected response format:', result);
        throw new Error('UniSat returned an unexpected response format. Please try again.');
      }
    } else {
      console.error('[UniSat] Unexpected response type:', typeof result, result);
      throw new Error('UniSat returned an unexpected response. Please try again.');
    }
    
    console.log('[UniSat] âœ… Transaction sent successfully, TXID:', txid);
    return txid;
  } catch (error: any) {
    console.error('[UniSat] âŒ Error sending Bitcoin:', error);
    console.error('[UniSat] Error details:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
      error: error ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : 'null/undefined'
    });
    
    // Verbesserte Fehlermeldung
    if (error?.message?.includes('User rejected') || error?.message?.includes('USER_REJECTION') || error?.code === 4001) {
      throw new Error('Payment was cancelled. Please approve the transaction in your UniSat wallet.');
    }
    
    if (error?.message?.includes('Insufficient balance') || error?.code === -32603) {
      throw new Error(`Insufficient balance. Your UniSat wallet does not have enough Bitcoin to complete this transaction. Required: ${amount} BTC + transaction fees.\n\nâš ï¸ WICHTIG: Wenn Ihr Guthaben auf einer SegWit-Adresse (bc1q...) liegt, aber UniSat eine Taproot-Adresse (bc1p...) anzeigt, mÃ¼ssen Sie mÃ¶glicherweise:\n1. Die SegWit-Adresse im UniSat Wallet auswÃ¤hlen\n2. Oder sicherstellen, dass genug Guthaben auf der aktuell ausgewÃ¤hlten Adresse vorhanden ist\n\nUniSat sollte automatisch das Gesamtguthaben aller Adressen verwenden, aber manchmal funktioniert das nicht korrekt.`);
    }

    // PrÃ¼fe auf "can not read properties" oder Ã¤hnliche Fehler
    if (error?.message?.includes('Cannot read properties') || error?.message?.includes('can not read properties')) {
      throw new Error('UniSat wallet error: Cannot access wallet properties. Please refresh the page and try again.');
    }
    
    throw new Error(error?.message || 'Fehler beim Senden von Bitcoin Ã¼ber UniSat');
  }
};

/**
 * Sendet mehrere Bitcoin-Zahlungen in einer Transaktion
 */
export const sendMultipleBitcoinPayments = async (
  recipients: Array<{ address: string; amount: number }>,
  walletType: 'unisat' | 'xverse'
): Promise<string> => {
  if (recipients.length === 0) {
    throw new Error('Keine EmpfÃ¤nger angegeben');
  }

  if (recipients.length === 1) {
    // Einzelzahlung - verwende normale Funktion
    if (walletType === 'unisat') {
      return await sendBitcoinViaUnisat(recipients[0].address, recipients[0].amount);
    } else {
      return await sendBitcoinViaXverse(recipients[0].address, recipients[0].amount);
    }
  }

  // Mehrere Zahlungen - kombiniere sie
  if (walletType === 'xverse') {
    // Xverse unterstÃ¼tzt mehrere recipients
    if (!isXverseInstalled()) {
      throw new Error('Xverse Wallet nicht gefunden');
    }

    try {
      const satsConnect = await import('sats-connect');
      
      if (satsConnect && satsConnect.request) {
        // Konvertiere alle BetrÃ¤ge zu Satoshi und runde prÃ¤zise
        const recipientsInSats = recipients.map(r => {
          const sats = Math.round(r.amount * 100000000);
          console.log(`[Xverse sats-connect] Zahlung: ${r.address} = ${r.amount} BTC = ${sats} sats`);
          return {
            address: r.address,
            amount: sats
          };
        });

        const totalSats = recipientsInSats.reduce((sum, r) => sum + r.amount, 0);
        console.log(`[Xverse sats-connect] Gesamt: ${totalSats} sats (${(totalSats / 100000000).toFixed(8)} BTC)`);

        const response = await satsConnect.request('sendTransfer', {
          recipients: recipientsInSats,
          network: {
            type: 'Mainnet'
          }
        });

        if (response.status === 'success') {
          const txid = response.result?.txid || response.result?.txId || response.txid;
          if (txid) {
            return txid;
          }
        }
      }

      // Fallback: Direkte Xverse API
      const provider = window.BitcoinProvider || window.xverse;
      if (!provider || !provider.request) {
        throw new Error('Xverse Provider API nicht verfÃ¼gbar');
      }

      // Konvertiere alle BetrÃ¤ge zu Satoshi und runde prÃ¤zise
      const recipientsInSats = recipients.map(r => {
        const sats = Math.round(r.amount * 100000000);
        console.log(`[Xverse] Zahlung: ${r.address} = ${r.amount} BTC = ${sats} sats`);
        return {
          address: r.address,
          amount: sats
        };
      });

      const totalSats = recipientsInSats.reduce((sum, r) => sum + r.amount, 0);
      console.log(`[Xverse] Gesamt: ${totalSats} sats (${(totalSats / 100000000).toFixed(8)} BTC)`);
      console.log(`[Xverse] Anzahl EmpfÃ¤nger: ${recipientsInSats.length}`);

      const response = await provider.request('sendTransfer', {
        recipients: recipientsInSats
      });

      if (response?.error) {
        const errorMessage = response.error.message || '';
        const errorCode = response.error.code;
        
        console.error('[Xverse] Fehler-Details:', {
          error: response.error,
          recipients: recipientsInSats,
          totalSats
        });
        
        if (errorMessage.includes('Insufficient balance') || errorCode === -32603) {
          throw new Error(`Insufficient balance. Your Xverse wallet does not have enough Bitcoin to complete this transaction. Required: ${(totalSats / 100000000).toFixed(8)} BTC + transaction fees. Please add more Bitcoin to your wallet and try again.`);
        }
        throw new Error(`Xverse wallet error: ${errorMessage || 'Unknown error'}`);
      }

      const txid = response?.txid || response?.result?.txid || response?.txId || response?.result?.txId;
      if (!txid) {
        throw new Error('Keine Transaction-ID in der Response erhalten');
      }

      return txid;
    } catch (error: any) {
      console.error('[Xverse] Catch-Block Fehler:', error);
      console.error('[Xverse] Error message:', error.message);
      console.error('[Xverse] Error object:', JSON.stringify(error, null, 2));
      
      if (error.message && (error.message.includes('User rejected') || error.message.includes('USER_REJECTION'))) {
        throw new Error('Payment was cancelled. Please approve the transaction in your Xverse wallet.');
      }
      
      // PrÃ¼fe ob die Fehlermeldung "Amount should not be less than" enthÃ¤lt
      if (error.message && error.message.includes('Amount should not be less than')) {
        console.error('[Xverse] âš ï¸ Fehler: Mindestbetrag-Anforderung erkannt');
        console.error('[Xverse] Recipients:', JSON.stringify(recipientsInSats, null, 2));
        // Werfe den ursprÃ¼nglichen Fehler weiter, damit der Benutzer die genaue Meldung sieht
      }
      
      throw error;
    }
  } else {
    // UniSat - verwende sendPsbt fÃ¼r mehrere Outputs
    if (!isUnisatInstalled()) {
      throw new Error('UniSat Wallet nicht gefunden');
    }

    try {
      // FÃ¼r UniSat mÃ¼ssen wir sendPsbt verwenden
      // Da das komplexer ist, machen wir die Zahlungen sequenziell, aber informieren den Benutzer
      // dass es mehrere Transaktionen sind
      console.log('[UniSat] Mehrere Zahlungen - UniSat unterstÃ¼tzt nur eine Zahlung pro Transaktion');
      console.log('[UniSat] FÃ¼hre Zahlungen sequenziell aus...');
      
      // Sortiere Zahlungen nach Betrag (grÃ¶ÃŸte zuerst), falls das hilft
      // Dies kann helfen, wenn das Guthaben auf einer bestimmten Adresse liegt
      const sortedRecipients = [...recipients].sort((a, b) => b.amount - a.amount);
      console.log(`[UniSat] Sortiere Zahlungen nach Betrag (grÃ¶ÃŸte zuerst):`, sortedRecipients.map(r => `${r.address}: ${r.amount} BTC`));
      
      let lastTxid = '';
      for (let i = 0; i < sortedRecipients.length; i++) {
        const recipient = sortedRecipients[i];
        console.log(`[UniSat] Zahlung ${i + 1}/${sortedRecipients.length}: ${recipient.address}, ${recipient.amount} BTC (${Math.round(recipient.amount * 100000000)} sats)`);
        
        try {
          lastTxid = await sendBitcoinViaUnisat(recipient.address, recipient.amount);
          console.log(`[UniSat] âœ… Zahlung ${i + 1}/${sortedRecipients.length} erfolgreich: ${lastTxid}`);
        } catch (error: any) {
          console.error(`[UniSat] âŒ Fehler bei Zahlung ${i + 1}/${sortedRecipients.length}:`, error);
          
          // Spezielle Fehlermeldung fÃ¼r Insufficient Balance
          if (error?.message?.includes('Insufficient balance') || error?.code === -32603) {
            throw new Error(`Insufficient balance bei Zahlung ${i + 1}/${sortedRecipients.length}.\n\nâš ï¸ WICHTIG: Wenn Ihr Guthaben auf einer SegWit-Adresse (bc1q...) liegt, aber UniSat eine Taproot-Adresse (bc1p...) anzeigt:\n1. Ã–ffnen Sie das UniSat Wallet\n2. Wechseln Sie zur SegWit-Adresse (falls verfÃ¼gbar)\n3. Oder stellen Sie sicher, dass genug Guthaben auf der aktuell ausgewÃ¤hlten Adresse vorhanden ist\n\nUniSat sollte automatisch das Gesamtguthaben verwenden, aber manchmal funktioniert das nicht korrekt.`);
          }
          
          throw error;
        }
        
        // LÃ¤ngere Pause zwischen Zahlungen (15 Sekunden), damit das Wallet Zeit hat, die erste Transaktion zu verarbeiten
        // Dies verhindert, dass die zweite Zahlung "kein Guthaben" anzeigt, da die erste Transaktion noch pending ist
        // WICHTIG: UniSat verwendet das Gesamtguthaben aller Adressen (SegWit + Taproot), daher keine Balance-PrÃ¼fung nÃ¶tig
        if (i < sortedRecipients.length - 1) {
          console.log(`[UniSat] â³ Warte 15 Sekunden vor nÃ¤chster Zahlung (${i + 2}/${sortedRecipients.length})...`);
          console.log(`[UniSat] âš ï¸ WICHTIG: Die erste Transaktion muss erst bestÃ¤tigt werden, bevor die zweite gesendet werden kann.`);
          console.log(`[UniSat] âš ï¸ Bitte warten Sie, bis die erste Zahlung in Ihrem Wallet bestÃ¤tigt wurde.`);
          console.log(`[UniSat] â„¹ï¸ Hinweis: UniSat verwendet automatisch das Guthaben von allen Adressen (SegWit + Taproot).`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }
      
      return lastTxid;
    } catch (error: any) {
      throw error;
    }
  }
};

export const sendBitcoinViaXverse = async (
  to: string,
  amount: number
): Promise<string> => {
  if (!isXverseInstalled()) {
    throw new Error('Xverse Wallet nicht gefunden');
  }

  try {
    console.log('Sending Bitcoin via Xverse...');
    console.log('To:', to, 'Amount:', amount, 'BTC');
    
    // Versuche zuerst sats-connect, dann direkte API
    let response: any;
    
    try {
      // Versuche sats-connect zu verwenden
      const satsConnect = await import('sats-connect');
      
      if (satsConnect && satsConnect.request) {
        // Konvertiere BTC zu Satoshi (1 BTC = 100,000,000 Satoshi)
        const satoshiAmount = Math.round(amount * 100000000);

        // Versuche sendTransfer Ã¼ber sats-connect
        // FÃ¼r sats-connect kÃ¶nnte es als String oder Number funktionieren, aber probieren wir Number zuerst
        response = await satsConnect.request('sendTransfer', {
          recipients: [
            {
              address: to,
              amount: satoshiAmount, // Als Number, nicht String
            }
          ],
          network: {
            type: 'Mainnet'
          }
        });
        
        console.log('Xverse sendTransfer (sats-connect) response:', response);
        
        if (response.status === 'success') {
          const txid = response.result?.txid || response.result?.txId || response.txid;
          if (txid) {
            return txid;
          }
        }
      }
    } catch (satsConnectError) {
      console.warn('sats-connect sendTransfer failed, trying direct API:', satsConnectError);
    }
    
    // Fallback: Direkte Xverse API
    const provider = window.BitcoinProvider || window.xverse;
    if (!provider || !provider.request) {
      throw new Error('Xverse Provider API nicht verfÃ¼gbar');
    }
    
    // Konvertiere BTC zu Satoshi
    const satoshiAmount = Math.round(amount * 100000000);
    
    // WICHTIG: amount muss als NUMBER gesendet werden, nicht als String!
    response = await provider.request('sendTransfer', {
      recipients: [
        {
          address: to,
          amount: satoshiAmount  // NUMBER, nicht .toString()!
        }
      ]
    });

    console.log('Xverse sendTransfer (direct API) response:', response);

    // PrÃ¼fe auf Fehler in der Response
    if (response?.error) {
      const errorCode = response.error.code;
      const errorMessage = response.error.message || '';
      
      if (errorCode === -32603 && errorMessage.includes('Insufficient balance')) {
        throw new Error('Insufficient balance. Your Xverse wallet does not have enough Bitcoin to complete this transaction. Please add more Bitcoin to your wallet and try again.');
      }
      
      throw new Error(`Xverse wallet error: ${errorMessage || 'Unknown error'}`);
    }
    
    // Extrahiere txid aus der Response
    const txid = response?.txid || response?.result?.txid || response?.txId || response?.result?.txId;
    
    if (!txid) {
      throw new Error('Keine Transaction-ID in der Response erhalten. Response: ' + JSON.stringify(response));
    }
    
    return txid;
  } catch (error: any) {
    console.error('Xverse sendBitcoin error:', error);
    
    // Spezifische Fehlermeldungen
    if (error.message && (error.message.includes('User rejected') || error.message.includes('USER_REJECTION') || error.message.includes('cancel'))) {
      throw new Error('Payment was cancelled. Please approve the transaction in your Xverse wallet.');
    }
    
    // Wenn bereits eine benutzerfreundliche Fehlermeldung vorhanden ist, diese verwenden
    if (error.message && error.message.includes('Insufficient balance')) {
      throw error; // Fehlermeldung wurde bereits oben gesetzt
    }
    
    throw new Error(error.message || 'Fehler beim Senden von Bitcoin via Xverse. Bitte Ã¼berprÃ¼fen Sie Ihr Wallet.');
  }
};

/**
 * Signiere eine PSBT mit UniSat Wallet
 * @param {string} psbtBase64 - PSBT als Base64-String
 * @param {boolean} autoFinalized - Ob die PSBT automatisch finalisiert werden soll
 * @returns {Promise<string>} - Signierte PSBT als Hex-String
 */
export const signPSBTViaUnisat = async (
  psbtBase64: string,
  autoFinalized: boolean = false
): Promise<string> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet nicht gefunden');
  }

  try {
    if (!window.unisat || typeof window.unisat.signPsbt !== 'function') {
      throw new Error('UniSat Wallet unterstÃ¼tzt keine PSBT-Signatur. Bitte aktualisieren Sie Ihre Wallet-Extension.');
    }

    // UniSat erwartet PSBT als Hex, nicht Base64
    // Konvertiere Base64 zu Hex (Browser-kompatibel)
    const binaryString = atob(psbtBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const psbtHex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const signedPsbtHex = await window.unisat.signPsbt(psbtHex, { autoFinalized });
    
    console.log('[signPSBTViaUnisat] âœ… Signed PSBT received (Hex), length:', signedPsbtHex.length);
    console.log('[signPSBTViaUnisat] Signed PSBT preview:', signedPsbtHex.substring(0, 50) + '...');
    
    // UniSat gibt Hex zurÃ¼ck, konvertiere zu Base64 fÃ¼r Konsistenz
    // Konvertiere Hex zu Base64
    const hexBytes = signedPsbtHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    const hexBinaryString = String.fromCharCode(...hexBytes);
    const signedPsbtBase64 = btoa(hexBinaryString);
    
    return signedPsbtBase64;
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message?.includes('rejected'))) {
      throw new Error('Signatur abgelehnt. Bitte bestÃ¤tigen Sie die Transaktion in Ihrem Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBT');
  }
};

/**
 * Signiere eine PSBT mit Xverse Wallet
 * @param {string} psbtBase64 - PSBT als Base64-String
 * @param {string} walletAddress - Optional: Wallet-Adresse fÃ¼r signInputs
 * @returns {Promise<string>} - Signierte Transaktion als Hex-String
 */
export const signPSBTViaXverse = async (
  psbtBase64: string,
  walletAddress?: string
): Promise<string> => {
  if (!isXverseInstalled()) {
    throw new Error('Xverse Wallet nicht gefunden');
  }

  try {
    console.log('[signPSBTViaXverse] Starting PSBT signing...');
    console.log('[signPSBTViaXverse] PSBT Base64 length:', psbtBase64.length);
    console.log('[signPSBTViaXverse] PSBT Base64 preview:', psbtBase64.substring(0, 50) + '...');
    
    const satsConnect = await import('sats-connect');
    
    if (!satsConnect || !satsConnect.request) {
      throw new Error('Sats Connect nicht verfÃ¼gbar');
    }

    console.log('[signPSBTViaXverse] Calling sats-connect request signPsbt...');
    
    // WICHTIG: FÃ¼r Taproot-PSBTs mit Xverse gibt es zwei Optionen:
    // 1. Xverse signiert und finalisiert (autoFinalized: true) - dann bekommen wir eine fertige Transaction
    // 2. Xverse signiert nur (broadcast: false) - dann mÃ¼ssen wir im Backend finalisieren
    // 
    // Problem: Wenn die ownerAddress eine Admin-Adresse ist, die der Benutzer nicht kontrolliert,
    // kann Xverse die PSBT nicht signieren. In diesem Fall mÃ¼ssen wir einen anderen Flow verwenden.
    //
    // FÃ¼r jetzt: Versuchen wir, Xverse die PSBT finalisieren zu lassen (autoFinalized: true)
    // Das funktioniert nur, wenn Xverse die Input-Adresse kontrolliert
    
    const requestParams: any = {
      psbt: psbtBase64,
      network: {
        type: 'Mainnet'
      },
      broadcast: false, // Wir broadcasten selbst Ã¼ber Backend
      // Versuche autoFinalized - Xverse finalisiert dann die PSBT automatisch
      // Wenn das nicht funktioniert, mÃ¼ssen wir im Backend finalisieren
      autoFinalized: true
    };
    
    // NICHT signInputs verwenden - Xverse erkennt automatisch kontrollierte Inputs
    // Wenn die ownerAddress eine Admin-Adresse ist, wird Xverse die Signatur ablehnen
    console.log('[signPSBTViaXverse] Requesting PSBT signing with autoFinalized: true');
    console.log('[signPSBTViaXverse] Xverse will auto-detect controlled inputs and finalize if possible');
    
    console.log('[signPSBTViaXverse] Request params:', JSON.stringify({ ...requestParams, psbt: psbtBase64.substring(0, 50) + '...' }, null, 2));
    
    const response = await satsConnect.request('signPsbt', requestParams);
    
    console.log('[signPSBTViaXverse] Response received:', {
      status: response.status,
      hasResult: !!response.result,
      hasError: !!response.error,
      errorMessage: response.error?.message,
      resultKeys: response.result ? Object.keys(response.result) : []
    });
    
    // Debug: Logge die vollstÃ¤ndige Response
    console.log('[signPSBTViaXverse] Full response result:', JSON.stringify(response.result, null, 2));

    if (response.status === 'success') {
      // PrÃ¼fe ob Xverse eine finalisierte Transaction zurÃ¼ckgegeben hat (wenn autoFinalized: true)
      const finalTxHex = response.result?.tx || response.result?.txHex || response.result?.txid || response.tx || response.txHex;
      const signedPsbtBase64 = response.result?.psbt || response.psbt;
      
      // Wenn autoFinalized: true war und eine finalisierte Transaction zurÃ¼ckgegeben wurde
      if (finalTxHex && typeof finalTxHex === 'string' && finalTxHex.length > 500 && /^[0-9a-fA-F]+$/.test(finalTxHex)) {
        console.log('[signPSBTViaXverse] âœ… Finalized transaction received (Hex), length:', finalTxHex.length);
        console.log('[signPSBTViaXverse] Transaction preview:', finalTxHex.substring(0, 50) + '...');
        // Konvertiere Hex zu Base64 fÃ¼r Konsistenz
        const hexBytes = finalTxHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
        const binaryString = String.fromCharCode(...hexBytes);
        const finalTxBase64 = btoa(binaryString);
        return finalTxBase64;
      }
      
      if (!signedPsbtBase64) {
        throw new Error('Keine signierte PSBT oder finalisierte Transaction erhalten');
      }

      console.log('[signPSBTViaXverse] âœ… Signed PSBT received (Base64), length:', signedPsbtBase64.length);
      console.log('[signPSBTViaXverse] Signed PSBT preview:', signedPsbtBase64.substring(0, 50) + '...');
      console.log('[signPSBTViaXverse] âš ï¸ PSBT is not finalized - will be finalized in backend');
      
      // WICHTIG: Xverse gibt Base64 zurÃ¼ck, aber das Backend erwartet mÃ¶glicherweise Base64 oder Hex
      // Lass uns Base64 zurÃ¼ckgeben, da das Backend Base64 besser handhaben kann
      // Das Backend kann dann selbst entscheiden, ob es Base64 oder Hex ist
      return signedPsbtBase64;
    } else {
      throw new Error(response.error?.message || 'Fehler beim Signieren der PSBT');
    }
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message.includes('rejected') || error.message.includes('USER_REJECTION'))) {
      throw new Error('Signatur abgelehnt. Bitte bestÃ¤tigen Sie die Transaktion in Ihrem Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBT');
  }
};

/**
 * Signiere eine PSBT (automatische Wallet-Erkennung)
 * @param {string} psbtBase64 - PSBT als Base64-String
 * @param {WalletType} walletType - Wallet-Typ ('unisat' oder 'xverse')
 * @param {boolean} autoFinalized - Ob die PSBT automatisch finalisiert werden soll (nur UniSat)
 * @returns {Promise<string>} - Signierte Transaktion als Hex-String
 */
export const signPSBT = async (
  psbtBase64: string,
  walletType: 'unisat' | 'xverse',
  autoFinalized: boolean = false,
  walletAddress?: string
): Promise<string> => {
  if (walletType === 'unisat') {
    return await signPSBTViaUnisat(psbtBase64, autoFinalized);
  } else {
    // FÃ¼r Xverse: Ãœbergebe walletAddress fÃ¼r signInputs
    return await signPSBTViaXverse(psbtBase64, walletAddress);
  }
};

/**
 * Signiere mehrere PSBTs gleichzeitig mit UniSat Wallet
 * @param {string[]} psbtHexs - Array von PSBTs als Hex-Strings
 * @param {boolean} autoFinalized - Ob die PSBTs automatisch finalisiert werden sollen
 * @returns {Promise<string[]>} - Array von signierten PSBTs als Hex-Strings
 */
export const signPsbtsViaUnisat = async (
  psbtHexs: string[],
  autoFinalized: boolean = false
): Promise<string[]> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet nicht gefunden');
  }

  try {
    if (!window.unisat || typeof window.unisat.signPsbts !== 'function') {
      throw new Error('UniSat Wallet unterstÃ¼tzt keine Batch-PSBT-Signatur. Bitte aktualisieren Sie Ihre Wallet-Extension.');
    }

    // UniSat erwartet PSBTs als Hex-Array
    // Wenn psbtHexs Base64-Strings sind, konvertiere sie zu Hex
    const psbtHexsArray = psbtHexs.map(psbt => {
      // PrÃ¼fe ob Base64 oder Hex
      if (psbt.length > 100 && !/^[0-9a-fA-F]+$/.test(psbt)) {
        // Wahrscheinlich Base64 - konvertiere zu Hex
        const binaryString = atob(psbt);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
      return psbt; // Bereits Hex
    });
    
    const signedPsbtHexs = await window.unisat.signPsbts(psbtHexsArray, { autoFinalized });
    
    return signedPsbtHexs;
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message?.includes('rejected'))) {
      throw new Error('Signatur abgelehnt. Bitte bestÃ¤tigen Sie die Transaktionen in Ihrem Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBTs');
  }
};

/**
 * Signiere mehrere PSBTs gleichzeitig mit Xverse Wallet
 * @param {string[]} psbtBase64s - Array von PSBTs als Base64-Strings
 * @returns {Promise<string[]>} - Array von signierten PSBTs als Hex-Strings
 */
export const signPsbtsViaXverse = async (
  psbtBase64s: string[]
): Promise<string[]> => {
  if (!isXverseInstalled()) {
    throw new Error('Xverse Wallet nicht gefunden');
  }

  try {
    const satsConnect = await import('sats-connect');
    
    if (!satsConnect || !satsConnect.request) {
      throw new Error('Sats Connect nicht verfÃ¼gbar');
    }

    // Xverse signPsbt unterstÃ¼tzt nur einzelne PSBTs
    // Fallback: Signiere sequenziell, aber informiere den Benutzer
    console.warn('[Xverse] Batch-PSBT-Signatur nicht direkt unterstÃ¼tzt, signiere sequenziell...');
    
    const signedPsbts: string[] = [];
    for (const psbtBase64 of psbtBase64s) {
      const response = await satsConnect.request('signPsbt', {
        psbt: psbtBase64,
        network: {
          type: 'Mainnet'
        }
      });

      if (response.status === 'success') {
        const signedPsbtBase64 = response.result?.psbt || response.psbt;
        
        if (!signedPsbtBase64) {
          throw new Error('Keine signierte PSBT erhalten');
        }

        // Konvertiere Base64 zu Hex fÃ¼r RÃ¼ckgabe (Browser-kompatibel)
        const binaryString = atob(signedPsbtBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const signedPsbtHex = Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        signedPsbts.push(signedPsbtHex);
      } else {
        throw new Error(response.error?.message || 'Fehler beim Signieren der PSBT');
      }
    }
    
    return signedPsbts;
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message.includes('rejected') || error.message.includes('USER_REJECTION'))) {
      throw new Error('Signatur abgelehnt. Bitte bestÃ¤tigen Sie die Transaktionen in Ihrem Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBTs');
  }
};

/**
 * Signiere mehrere PSBTs gleichzeitig (automatische Wallet-Erkennung)
 * @param {string[]} psbtBase64s - Array von PSBTs als Base64-Strings
 * @param {WalletType} walletType - Wallet-Typ ('unisat' oder 'xverse')
 * @param {boolean} autoFinalized - Ob die PSBTs automatisch finalisiert werden sollen (nur UniSat)
 * @returns {Promise<string[]>} - Array von signierten PSBTs als Hex-Strings
 */
export const signPsbts = async (
  psbtBase64s: string[],
  walletType: 'unisat' | 'xverse',
  autoFinalized: boolean = false
): Promise<string[]> => {
  if (walletType === 'unisat') {
    // FÃ¼r UniSat: Konvertiere Base64 zu Hex
    const psbtHexs = psbtBase64s.map(psbtBase64 => {
      const binaryString = atob(psbtBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    });
    return await signPsbtsViaUnisat(psbtHexs, autoFinalized);
  } else {
    return await signPsbtsViaXverse(psbtBase64s);
  }
};

/**
 * Pushe eine signierte PSBT mit UniSat Wallet
 * @param {string} psbtHex - Signierte PSBT als Hex-String
 * @returns {Promise<string>} - Transaction ID (txid)
 */
export const pushPsbtViaUnisat = async (
  psbtHex: string
): Promise<string> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet nicht gefunden');
  }

  try {
    if (!window.unisat || typeof window.unisat.pushPsbt !== 'function') {
      throw new Error('UniSat Wallet unterstÃ¼tzt keine PSBT-Push-Funktion. Bitte aktualisieren Sie Ihre Wallet-Extension.');
    }

    const txid = await window.unisat.pushPsbt(psbtHex);
    return txid;
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message?.includes('rejected'))) {
      throw new Error('Push abgelehnt. Bitte bestÃ¤tigen Sie die Transaktion in Ihrem Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Pushen der PSBT');
  }
};

/**
 * Pushe eine signierte PSBT (automatische Wallet-Erkennung)
 * @param {string} psbtHex - Signierte PSBT als Hex-String
 * @param {WalletType} walletType - Wallet-Typ ('unisat' oder 'xverse')
 * @returns {Promise<string>} - Transaction ID (txid)
 */
export const pushPsbt = async (
  psbtHex: string,
  walletType: 'unisat' | 'xverse'
): Promise<string> => {
  if (walletType === 'unisat') {
    return await pushPsbtViaUnisat(psbtHex);
  } else {
    // Xverse unterstÃ¼tzt pushPsbt nicht direkt
    // Fallback: Verwende Broadcast Ã¼ber Backend
    throw new Error('Xverse unterstÃ¼tzt pushPsbt nicht direkt. Bitte verwenden Sie das Backend-Broadcast.');
  }
};

