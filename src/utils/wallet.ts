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
  
  // Einfache Prüfung - wie vorher
  return typeof window.unisat !== 'undefined';
};

export const isXverseInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Einfache Prüfung - wie vorher (BitcoinProvider ist der Haupt-Provider)
  return typeof window.BitcoinProvider !== 'undefined';
};

/**
 * Warte auf UniSat Wallet mit Retry-Logik
 * Wichtig für localhost, wo Extensions verzögert laden können
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
 * Wichtig für localhost, wo Extensions verzögert laden können
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

// Helper-Funktion: Bestimme den Adresstyp
const getAddressType = (address: string): string => {
  if (address.startsWith('bc1p')) return 'Taproot';
  if (address.startsWith('bc1q')) return 'Native SegWit';
  if (address.startsWith('3')) return 'Nested SegWit';
  if (address.startsWith('1')) return 'Legacy';
  return 'Unbekannt';
};

export const connectUnisat = async (): Promise<WalletAccount[]> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet is not installed. Please install the UniSat browser extension.');
  }

  try {
    // Prüfe ob window.unisat wirklich verfügbar ist
    if (!window.unisat || typeof window.unisat.requestAccounts !== 'function') {
      throw new Error('UniSat Wallet is detected but the connection API is not available. This may be due to multiple wallet extensions interfering with each other. Try disabling other Bitcoin wallet extensions and reload the page.');
    }

    const accounts = await window.unisat.requestAccounts();
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned. Please unlock your UniSat Wallet and try again.');
    }

    // Schritt 1: Hole die aktuell verbundene Adresse (Payment-Adresse)
    const currentAddress = accounts[0];
    const currentAddressType = getAddressType(currentAddress);
    
    console.log(`[UniSat] ✅ Verbunden mit ${currentAddressType}-Adresse: ${currentAddress}`);

    const network = await window.unisat.getNetwork();
    
    if (network !== 'livenet') {
      throw new Error('Please switch to Bitcoin Mainnet in your UniSat Wallet.');
    }

    const walletAccounts: WalletAccount[] = [];
    
    // Schritt 2: Prüfe ob es Taproot ist
    if (currentAddress.startsWith('bc1p')) {
      // ✅ Bereits Taproot - perfekt!
      console.log(`[UniSat] ✅ Taproot-Adresse aktiv - optimal für Ordinals!`);
      walletAccounts.push({
        address: currentAddress,
        purpose: 'ordinals' // Taproot ist perfekt für beides
      });
    } else {
      // ⚠️ Nicht-Taproot (Legacy/SegWit) - brauchen BEIDE Adressen
      console.warn(`[UniSat] ⚠️ ${currentAddressType}-Adresse verbunden`);
      console.warn(`[UniSat] 💡 Für Inscriptions wird Taproot benötigt!`);
      
      // Füge aktuelle Adresse als Payment hinzu
      walletAccounts.push({
        address: currentAddress,
        purpose: 'payment' // Für Zahlungen
      });
      
      // Schritt 3: Frage nach Taproot-Adresse
      const shouldGetTaproot = confirm(
        `🔔 UniSat Wallet Setup - WICHTIG!\n\n` +
        `✅ Aktuell verbunden: ${currentAddressType}-Adresse\n` +
        `   ${currentAddress}\n\n` +
        `⚠️ Für Ordinals-Inscriptions wird eine Taproot-Adresse (bc1p...) benötigt.\n\n` +
        `📋 SETUP-ANLEITUNG:\n` +
        `1. Klicke "OK" um fortzufahren\n` +
        `2. Öffne UniSat Wallet → Settings → Address Type\n` +
        `3. Wähle "Taproot (P2TR)"\n` +
        `4. Akzeptiere die Verbindung erneut\n` +
        `5. Taproot-Adresse wird gespeichert ✅\n\n` +
        `💰 WICHTIG FÜR PAYMENTS:\n` +
        `Danach WECHSLE ZURÜCK zur ${currentAddressType}-Adresse!\n` +
        `→ Payment muss von der Adresse kommen, wo dein BTC ist\n` +
        `→ Inscription geht automatisch an Taproot ✅\n\n` +
        `Möchtest du jetzt die Taproot-Adresse hinzufügen?`
      );
      
      if (shouldGetTaproot) {
        try {
          console.log(`[UniSat] 🔄 Warte auf Taproot-Adresse...`);
          console.log(`[UniSat] 👉 Bitte wechsle jetzt im UniSat Wallet zu Taproot!`);
          
          // Warte auf neue Verbindung (User wechselt zu Taproot)
          const taprootAccounts = await window.unisat.requestAccounts();
          const taprootAddress = taprootAccounts[0];
          
          if (taprootAddress && taprootAddress.startsWith('bc1p')) {
            console.log(`[UniSat] ✅ Taproot-Adresse erhalten: ${taprootAddress}`);
            
            // Füge Taproot-Adresse hinzu
            walletAccounts.push({
              address: taprootAddress,
              purpose: 'ordinals' // Für Inscriptions
            });
            
            // Speichere in localStorage für zukünftige Sessions
            localStorage.setItem('unisat_taproot_address', taprootAddress);
            
            alert(
              `✅ Perfekt!\n\n` +
              `Taproot-Adresse gespeichert:\n${taprootAddress}\n\n` +
              `Du kannst jetzt im UniSat Wallet zurück zu ${currentAddressType} wechseln.\n\n` +
              `💰 Payments: ${currentAddressType}-Adresse\n` +
              `🎯 Inscriptions: Taproot-Adresse`
            );
          } else {
            console.warn(`[UniSat] ⚠️ Keine Taproot-Adresse erhalten: ${taprootAddress}`);
            
            // Versuche aus localStorage
            const savedTaproot = localStorage.getItem('unisat_taproot_address');
            if (savedTaproot && savedTaproot.startsWith('bc1p')) {
              console.log(`[UniSat] 💾 Verwende gespeicherte Taproot-Adresse: ${savedTaproot}`);
              walletAccounts.push({
                address: savedTaproot,
                purpose: 'ordinals'
              });
            } else {
              console.warn(`[UniSat] ⚠️ Keine Taproot-Adresse verfügbar - Inscriptions werden an ${currentAddressType} gesendet!`);
            }
          }
        } catch (taprootError: any) {
          console.error(`[UniSat] ❌ Fehler beim Abrufen der Taproot-Adresse:`, taprootError);
          
          // Fallback: Versuche gespeicherte Adresse
          const savedTaproot = localStorage.getItem('unisat_taproot_address');
          if (savedTaproot && savedTaproot.startsWith('bc1p')) {
            console.log(`[UniSat] 💾 Verwende gespeicherte Taproot-Adresse: ${savedTaproot}`);
            walletAccounts.push({
              address: savedTaproot,
              purpose: 'ordinals'
            });
          }
        }
      } else {
        // User hat abgelehnt - versuche gespeicherte Taproot
        const savedTaproot = localStorage.getItem('unisat_taproot_address');
        if (savedTaproot && savedTaproot.startsWith('bc1p')) {
          console.log(`[UniSat] 💾 Verwende zuvor gespeicherte Taproot-Adresse: ${savedTaproot}`);
          walletAccounts.push({
            address: savedTaproot,
            purpose: 'ordinals'
          });
        } else {
          console.warn(`[UniSat] ⚠️ Keine Taproot-Adresse - Inscriptions werden an ${currentAddressType} gesendet!`);
        }
      }
    }

    console.log(`[UniSat] ✅ Setup abgeschlossen mit ${walletAccounts.length} Adresse(n)`);
    walletAccounts.forEach(acc => {
      console.log(`   ${acc.purpose === 'ordinals' ? '🎯' : '💰'} ${acc.purpose || 'default'}: ${acc.address}`);
    });

    return walletAccounts;
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
    
    // wallet_connect kann mit null aufgerufen werden für alle Adresstypen
    const response = await satsConnect.request('wallet_connect', null);
    
    console.log('Xverse wallet_connect response:', response);

    if (response.status === 'success') {
      const addresses = response.result?.addresses || [];
      
      if (!addresses || addresses.length === 0) {
        throw new Error('No addresses returned from Xverse Wallet');
      }

      const accounts: WalletAccount[] = [];
      
      // Finde Ordinals-Adresse (bc1p... - Taproot)
      const ordinalsAddress = addresses.find(
        (addr: any) => addr.purpose === 'ordinals'
      );
      
      // Finde Payment-Adresse (für UTXOs/Zahlung)
      const paymentAddress = addresses.find(
        (addr: any) => addr.purpose === 'payment'
      );

      // ✅ WICHTIG: Füge BEIDE Adressen hinzu (Ordinals ZUERST für receiveAddress)
      if (ordinalsAddress && ordinalsAddress.address) {
        accounts.push({
          address: ordinalsAddress.address,
          publicKey: ordinalsAddress.publicKey,
          purpose: 'ordinals'
        });
        console.log('[Xverse] ✅ Ordinals-Adresse:', ordinalsAddress.address);
      }
      
      if (paymentAddress && paymentAddress.address) {
        accounts.push({
          address: paymentAddress.address,
          publicKey: paymentAddress.publicKey,
          purpose: 'payment'
        });
        console.log('[Xverse] ✅ Payment-Adresse:', paymentAddress.address);
      }

      if (accounts.length === 0) {
        throw new Error('No valid addresses found. Please ensure your Xverse Wallet has Ordinals addresses set up.');
      }

      // ✅ INFO: Gebe BEIDE Adressen zurück (nicht filtern!)
      console.log('[Xverse] ✅ Verbunden mit', accounts.length, 'Adresse(n)');
      console.log('[Xverse] 💰 Payment wird automatisch von Payment-Adresse gezogen');
      console.log('[Xverse] 🎯 Inscriptions gehen an Ordinals-Adresse (Taproot)');

      return accounts;
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
};

/**
 * Gibt die Taproot-Adresse (bc1p...) vom UniSat Wallet zurück.
 * Prüft zuerst die aktuell verbundene Adresse, dann gespeicherte Taproot-Adresse.
 */
export const getUnisatTaprootAddress = async (): Promise<string | null> => {
  if (!isUnisatInstalled()) {
    return null;
  }

  try {
    // Schritt 1: Prüfe aktuell verbundene Adresse
    const accounts = await window.unisat!.getAccounts();
    const currentAddress = accounts[0];
    
    // Wenn aktuell Taproot verbunden ist - perfekt!
    if (currentAddress && currentAddress.startsWith('bc1p')) {
      console.log('[UniSat] ✅ Taproot-Adresse aktiv:', currentAddress);
      return currentAddress;
    }
    
    // Schritt 2: Versuche gespeicherte Taproot-Adresse
    const savedTaproot = localStorage.getItem('unisat_taproot_address');
    if (savedTaproot && savedTaproot.startsWith('bc1p')) {
      console.log('[UniSat] 💾 Verwende gespeicherte Taproot-Adresse:', savedTaproot);
      console.log('[UniSat] 💡 Inscription geht an Taproot, Payment von aktueller Adresse');
      return savedTaproot;
    }
    
    // Schritt 3: Keine Taproot verfügbar - zeige Warnung
    const addressType = getAddressType(currentAddress);
    console.warn('[UniSat] ⚠️ Keine Taproot-Adresse verfügbar!');
    console.warn(`[UniSat] ⚠️ Aktuell verbunden: ${addressType}-Adresse`);
    console.warn('[UniSat] ⚠️ Inscription wird an aktuelle Adresse gesendet (nicht optimal)');
    console.warn('[UniSat] 💡 Empfehlung: Verbinde dich erneut und füge Taproot-Adresse hinzu');
    
    // ❌ Gebe null zurück statt falsche Adresse zu verwenden!
    return null;
    
  } catch (error: any) {
    console.error('[UniSat] Fehler beim Abrufen der Adresse:', error);
    throw error;
  }
};

export const getXverseAccounts = async (): Promise<WalletAccount[]> => {
  if (!isXverseInstalled()) {
    return [];
  }

  try {
    // WICHTIG: Diese Funktion sollte KEINE Popups öffnen!
    // Sie prüft nur, ob bereits Accounts verbunden sind.
    // Verwenden Sie connectXverse() für aktive Verbindungen mit Popup.
    
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

  // Prüfe ob window.unisat und sendBitcoin verfügbar sind
  if (!window.unisat) {
    throw new Error('UniSat Wallet ist nicht verfügbar. Bitte stellen Sie sicher, dass die UniSat Extension installiert und aktiviert ist.');
  }

  // Debug: Logge verfügbare UniSat-Methoden
  const availableMethods = Object.keys(window.unisat).filter(key => typeof (window.unisat as any)[key] === 'function');
  console.log('[UniSat] Verfügbare Methoden:', availableMethods);
  console.log('[UniSat] sendBitcoin vorhanden:', typeof window.unisat.sendBitcoin);

  if (typeof window.unisat.sendBitcoin !== 'function') {
    console.error('[UniSat] ❌ sendBitcoin ist nicht verfügbar! Verfügbare Methoden:', availableMethods);
    throw new Error('UniSat sendBitcoin Funktion ist nicht verfügbar. Bitte aktualisieren Sie Ihre UniSat Extension auf die neueste Version.');
  }

  try {
    const amountInSats = Math.round(amount * 100000000);
    console.log('[UniSat] Sending Bitcoin:', { to, amount, amountInSats });
    
    // Prüfe auf Dust-Limit (546 sats ist das Bitcoin Dust-Limit)
    if (amountInSats < 546) {
      throw new Error(`Amount too small. Minimum is 546 sats (Bitcoin dust limit). You tried to send ${amountInSats} sats.`);
    }
    
    // Prüfe ob Adresse gültig ist
    if (!to || typeof to !== 'string' || to.length < 26) {
      throw new Error(`Invalid address: ${to}`);
    }
    
    // Stelle sicher, dass satoshis eine positive ganze Zahl ist
    if (!Number.isInteger(amountInSats) || amountInSats <= 0 || isNaN(amountInSats)) {
      throw new Error(`Invalid satoshi amount: ${amountInSats}. Must be a positive integer. Original amount: ${amount} BTC`);
    }
    
    // WICHTIG: Prüfe ALLE UTXOs über alle Adressen für bessere Fehlermeldungen
    // ⚠️ Dies ist nur informativ - UniSat kann automatisch von allen Adressen ziehen!
    try {
      const allUtxos = await window.unisat!.getBitcoinUtxos();
      
      if (!Array.isArray(allUtxos)) {
        console.warn('[UniSat] ⚠️ getBitcoinUtxos() returned unexpected format:', typeof allUtxos);
      } else {
        // Berechne Gesamt-Balance (ohne Inscriptions)
        const totalBalance = allUtxos
          .filter((utxo: any) => !utxo.inscriptions || utxo.inscriptions.length === 0)
          .reduce((sum: number, utxo: any) => {
            const utxoValue = utxo.satoshi || utxo.satoshis || utxo.value || 0;
            return sum + (typeof utxoValue === 'number' ? utxoValue : 0);
          }, 0);
        
        if (!isNaN(totalBalance) && totalBalance > 0) {
          console.log(`[UniSat] 💰 Total balance across all addresses: ${totalBalance} sats (${(totalBalance / 100000000).toFixed(8)} BTC)`);
          console.log(`[UniSat] 💸 Required: ${amountInSats} sats (${amount.toFixed(8)} BTC)`);
          console.log(`[UniSat] ℹ️ UniSat kann automatisch von ALLEN Adressen im Wallet ziehen (Legacy, SegWit, Taproot)`);
        } else {
          console.warn('[UniSat] ⚠️ Could not calculate total balance (NaN or 0)');
          console.warn('[UniSat] ℹ️ UniSat sendBitcoin() wird trotzdem versuchen, von verfügbaren Adressen zu ziehen');
        }
      }
    } catch (utxoError) {
      console.warn('[UniSat] ⚠️ Could not fetch UTXOs for balance check:', utxoError);
      console.warn('[UniSat] ℹ️ UniSat sendBitcoin() wird trotzdem versuchen, von verfügbaren Adressen zu ziehen');
    }
    
    // WICHTIG: UniSat sendBitcoin erwartet den Betrag in SATOSHI, nicht BTC!
    // Laut UniSat-Dokumentation: sendBitcoin(toAddress: string, satoshis: number)
    console.log('[UniSat] Calling sendBitcoin with satoshis:', { to, satoshis: amountInSats, addressLength: to.length, addressValid: to.length >= 26 });
    
    const result = await window.unisat.sendBitcoin(to, amountInSats);
    
    // Prüfe ob result ein String (txid) oder ein Objekt ist
    let txid: string;
    if (typeof result === 'string') {
      txid = result;
    } else if (result && typeof result === 'object') {
      // Möglicherweise gibt UniSat ein Objekt zurück
      txid = result.txid || result.txId || result.transactionId || '';
      if (!txid) {
        console.error('[UniSat] Unexpected response format:', result);
        throw new Error('UniSat returned an unexpected response format. Please try again.');
      }
    } else {
      console.error('[UniSat] Unexpected response type:', typeof result, result);
      throw new Error('UniSat returned an unexpected response. Please try again.');
    }
    
    console.log('[UniSat] ✅ Transaction sent successfully, TXID:', txid);
    return txid;
  } catch (error: any) {
    console.error('[UniSat] ❌ Error sending Bitcoin:', error);
    console.error('[UniSat] Error details:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
      error: error ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : 'null/undefined'
    });
    
    // Verbesserte Fehlermeldung für "User rejected"
    // WICHTIG: Code 4001 kann auch bedeuten, dass UniSat "Insufficient balance" anzeigt!
    if (error?.message?.includes('User rejected') || error?.message?.includes('USER_REJECTION') || error?.code === 4001) {
      // Prüfe welche Adresse aktuell verbunden ist
      let detailedError: Error | null = null;
      try {
        const currentAccounts = await window.unisat!.getAccounts();
        const currentAddress = currentAccounts[0];
        const addressType = getAddressType(currentAddress);
        
        // Wenn Taproot verbunden ist, könnte das Problem sein, dass Geld auf Legacy ist
        if (addressType !== 'Legacy') {
          detailedError = new Error(
            `❌ Payment abgelehnt oder Insufficient Balance!\n\n` +
            `🔍 Aktuell verbunden: ${addressType}-Adresse\n` +
            `   ${currentAddress}\n\n` +
            `💡 LÖSUNG:\n` +
            `Wenn dein BTC auf einer anderen Adresse ist (z.B. Legacy),\n` +
            `musst du MIT DIESER ADRESSE verbinden für das Payment!\n\n` +
            `📋 SO GEHT'S:\n` +
            `1. Öffne UniSat Wallet → Settings → Address Type\n` +
            `2. Wechsle zur Adresse WO DEIN BTC IST (Legacy/SegWit)\n` +
            `3. Akzeptiere die neue Verbindung\n` +
            `4. Versuche das Payment erneut\n\n` +
            `✅ Die Inscription geht trotzdem an deine Taproot-Adresse!`
          );
        }
      } catch (checkError) {
        // Fallback zur generischen Meldung unten
      }
      
      // Werfe detaillierte Meldung falls vorhanden, sonst generisch
      if (detailedError) {
        throw detailedError;
      }
      
      throw new Error('Payment was cancelled. Please approve the transaction in your UniSat wallet.');
    }
    
    // ERWEITERTE INSUFFICIENT BALANCE FEHLERMELDUNG
    if (error?.message?.includes('Insufficient balance') || error?.code === -32603) {
      try {
        // Hole alle UTXOs für detaillierte Analyse
        const allUtxos = await window.unisat!.getBitcoinUtxos();
        const utxosByAddress: Record<string, { sats: number; count: number; hasInscriptions: boolean }> = {};
        
        allUtxos.forEach((utxo: any) => {
          const addr = utxo.address;
          if (!utxosByAddress[addr]) {
            utxosByAddress[addr] = { sats: 0, count: 0, hasInscriptions: false };
          }
          // Nur UTXOs ohne Inscriptions zählen
          if (!utxo.inscriptions || utxo.inscriptions.length === 0) {
            utxosByAddress[addr].sats += utxo.satoshi;
          } else {
            utxosByAddress[addr].hasInscriptions = true;
          }
          utxosByAddress[addr].count++;
        });
        
        let errorMsg = `❌ Insufficient balance on connected address.\n\n`;
        errorMsg += `📊 Your wallet has Bitcoin on multiple addresses:\n\n`;
        
        Object.entries(utxosByAddress).forEach(([addr, info]) => {
          const addrType = getAddressType(addr);
          const btcAmount = (info.sats / 100000000).toFixed(8);
          const inscriptionNote = info.hasInscriptions ? ' (⚠️ has inscriptions)' : '';
          errorMsg += `  ${addrType}: ${btcAmount} BTC${inscriptionNote}\n`;
          errorMsg += `    ${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}\n\n`;
        });
        
        errorMsg += `⚠️ UniSat kann nur von der aktuell verbundenen Adresse senden.\n\n`;
        errorMsg += `💡 LÖSUNG (2 Möglichkeiten):\n\n`;
        errorMsg += `Option 1 (Empfohlen):\n`;
        errorMsg += `1. Öffnen Sie das UniSat Wallet\n`;
        errorMsg += `2. Wechseln Sie zur Adresse mit Guthaben (z.B. Legacy/SegWit)\n`;
        errorMsg += `3. Führen Sie die Zahlung durch\n`;
        errorMsg += `4. Wechseln Sie zurück zur Taproot-Adresse\n`;
        errorMsg += `5. Die Inscription wird trotzdem an Taproot gesendet! ✅\n\n`;
        errorMsg += `Option 2:\n`;
        errorMsg += `1. Senden Sie Bitcoin von Ihrer anderen Adresse zur Taproot-Adresse\n`;
        errorMsg += `2. Versuchen Sie es erneut\n`;
        
        throw new Error(errorMsg);
      } catch (detailError: any) {
        // Falls getBitcoinUtxos fehlschlägt, normale Fehlermeldung
        if (detailError.message && detailError.message.includes('Insufficient balance')) {
          throw detailError; // Werfe die detaillierte Fehlermeldung von oben
        }
        
        throw new Error(
          `❌ Insufficient balance.\n\n` +
          `⚠️ Ihr Guthaben liegt möglicherweise auf einer anderen Adresse.\n\n` +
          `💡 LÖSUNG:\n` +
          `1. Öffnen Sie das UniSat Wallet\n` +
          `2. Wechseln Sie zur Adresse mit Guthaben (z.B. Legacy/SegWit)\n` +
          `3. Führen Sie die Zahlung durch\n` +
          `4. Wechseln Sie zurück zur Taproot-Adresse\n` +
          `5. Die Inscription wird trotzdem an Taproot gesendet! ✅`
        );
      }
    }

    // Prüfe auf "can not read properties" oder ähnliche Fehler
    if (error?.message?.includes('Cannot read properties') || error?.message?.includes('can not read properties')) {
      throw new Error('UniSat wallet error: Cannot access wallet properties. Please refresh the page and try again.');
    }
    
    throw new Error(error?.message || 'Fehler beim Senden von Bitcoin über UniSat');
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
    throw new Error('Keine Empfänger angegeben');
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
    // Xverse unterstützt mehrere recipients
    if (!isXverseInstalled()) {
      throw new Error('Xverse Wallet nicht gefunden');
    }

    try {
      const satsConnect = await import('sats-connect');
      
      if (satsConnect && satsConnect.request) {
        // Konvertiere alle Beträge zu Satoshi und runde präzise
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
        throw new Error('Xverse Provider API nicht verfügbar');
      }

      // Konvertiere alle Beträge zu Satoshi und runde präzise
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
      console.log(`[Xverse] Anzahl Empfänger: ${recipientsInSats.length}`);

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
      
      // Prüfe ob die Fehlermeldung "Amount should not be less than" enthält
      if (error.message && error.message.includes('Amount should not be less than')) {
        console.error('[Xverse] ⚠️ Fehler: Mindestbetrag-Anforderung erkannt');
        console.error('[Xverse] Recipients:', JSON.stringify(recipientsInSats, null, 2));
        // Werfe den ursprünglichen Fehler weiter, damit der Benutzer die genaue Meldung sieht
      }
      
      throw error;
    }
  } else {
    // UniSat - verwende sendPsbt für mehrere Outputs
    if (!isUnisatInstalled()) {
      throw new Error('UniSat Wallet nicht gefunden');
    }

    try {
      // Für UniSat müssen wir sendPsbt verwenden
      // Da das komplexer ist, machen wir die Zahlungen sequenziell, aber informieren den Benutzer
      // dass es mehrere Transaktionen sind
      console.log('[UniSat] Mehrere Zahlungen - UniSat unterstützt nur eine Zahlung pro Transaktion');
      console.log('[UniSat] Führe Zahlungen sequenziell aus...');
      
      // Sortiere Zahlungen nach Betrag (größte zuerst), falls das hilft
      // Dies kann helfen, wenn das Guthaben auf einer bestimmten Adresse liegt
      const sortedRecipients = [...recipients].sort((a, b) => b.amount - a.amount);
      console.log(`[UniSat] Sortiere Zahlungen nach Betrag (größte zuerst):`, sortedRecipients.map(r => `${r.address}: ${r.amount} BTC`));
      
      let lastTxid = '';
      for (let i = 0; i < sortedRecipients.length; i++) {
        const recipient = sortedRecipients[i];
        console.log(`[UniSat] Zahlung ${i + 1}/${sortedRecipients.length}: ${recipient.address}, ${recipient.amount} BTC (${Math.round(recipient.amount * 100000000)} sats)`);
        
        try {
          lastTxid = await sendBitcoinViaUnisat(recipient.address, recipient.amount);
          console.log(`[UniSat] ✅ Zahlung ${i + 1}/${sortedRecipients.length} erfolgreich: ${lastTxid}`);
        } catch (error: any) {
          console.error(`[UniSat] ❌ Fehler bei Zahlung ${i + 1}/${sortedRecipients.length}:`, error);
          
          // Spezielle Fehlermeldung für Insufficient Balance
          if (error?.message?.includes('Insufficient balance') || error?.code === -32603) {
            throw new Error(`Insufficient balance bei Zahlung ${i + 1}/${sortedRecipients.length}.\n\n⚠️ WICHTIG: Wenn Ihr Guthaben auf einer SegWit-Adresse (bc1q...) liegt, aber UniSat eine Taproot-Adresse (bc1p...) anzeigt:\n1. Öffnen Sie das UniSat Wallet\n2. Wechseln Sie zur SegWit-Adresse (falls verfügbar)\n3. Oder stellen Sie sicher, dass genug Guthaben auf der aktuell ausgewählten Adresse vorhanden ist\n\nUniSat sollte automatisch das Gesamtguthaben verwenden, aber manchmal funktioniert das nicht korrekt.`);
          }
          
          throw error;
        }
        
        // Längere Pause zwischen Zahlungen (15 Sekunden), damit das Wallet Zeit hat, die erste Transaktion zu verarbeiten
        // Dies verhindert, dass die zweite Zahlung "kein Guthaben" anzeigt, da die erste Transaktion noch pending ist
        // WICHTIG: UniSat verwendet das Gesamtguthaben aller Adressen (SegWit + Taproot), daher keine Balance-Prüfung nötig
        if (i < sortedRecipients.length - 1) {
          console.log(`[UniSat] ⏳ Warte 15 Sekunden vor nächster Zahlung (${i + 2}/${sortedRecipients.length})...`);
          console.log(`[UniSat] ⚠️ WICHTIG: Die erste Transaktion muss erst bestätigt werden, bevor die zweite gesendet werden kann.`);
          console.log(`[UniSat] ⚠️ Bitte warten Sie, bis die erste Zahlung in Ihrem Wallet bestätigt wurde.`);
          console.log(`[UniSat] ℹ️ Hinweis: UniSat verwendet automatisch das Guthaben von allen Adressen (SegWit + Taproot).`);
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
    // Konvertiere BTC zu Satoshi
    const satoshiAmount = Math.round(amount * 100000000);
    
    console.log('🌐 Sending Bitcoin via Xverse...');
    console.log('   To:', to);
    console.log('   Amount:', amount, 'BTC (', satoshiAmount, 'sats)');
    
    // Versuche zuerst sats-connect, dann direkte API
    let response: any;
    
    try {
      // Versuche sats-connect zu verwenden
      const satsConnect = await import('sats-connect');
      
      if (satsConnect && satsConnect.request) {
        console.log('   🔧 Verwende sats-connect API');
        
        // Versuche sendTransfer über sats-connect
        // Für sats-connect könnte es als String oder Number funktionieren, aber probieren wir Number zuerst
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
        
        console.log('   ✅ Xverse sendTransfer (sats-connect) response:', response);
        
        if (response.status === 'success') {
          const txid = response.result?.txid || response.result?.txId || response.txid;
          if (txid) {
            console.log('   🎉 Transaction broadcast! TX ID:', txid);
            return txid;
          }
        }
      }
    } catch (satsConnectError) {
      console.warn('   ⚠️ sats-connect sendTransfer failed, trying direct API:', satsConnectError);
    }
    
    // Fallback: Direkte Xverse API
    console.log('   🔧 Verwende direkte Xverse Provider API');
    const provider = window.BitcoinProvider || window.xverse;
    if (!provider || !provider.request) {
      throw new Error('Xverse Provider API nicht verfügbar');
    }
    
    // WICHTIG: amount muss als NUMBER gesendet werden, nicht als String!
    response = await provider.request('sendTransfer', {
      recipients: [
        {
          address: to,
          amount: satoshiAmount  // NUMBER, nicht .toString()!
        }
      ]
    });

    console.log('   ✅ Xverse sendTransfer (direct API) response:', response);

    // Prüfe auf Fehler in der Response
    if (response?.error) {
      const errorCode = response.error.code;
      const errorMessage = response.error.message || '';
      
      if (errorCode === -32603 && errorMessage.includes('Insufficient balance')) {
        console.error('   ❌ Insufficient balance!');
        console.error('   💰 Hinweis: Xverse verwendet die Payment-Adresse für Zahlungen');
        console.error('   💡 Stellen Sie sicher, dass Ihre Payment-Adresse genug BTC hat');
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
    
    throw new Error(error.message || 'Fehler beim Senden von Bitcoin via Xverse. Bitte überprüfen Sie Ihr Wallet.');
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
      throw new Error('UniSat Wallet unterstützt keine PSBT-Signatur. Bitte aktualisieren Sie Ihre Wallet-Extension.');
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
    
    console.log('[signPSBTViaUnisat] ✅ Signed PSBT received (Hex), length:', signedPsbtHex.length);
    console.log('[signPSBTViaUnisat] Signed PSBT preview:', signedPsbtHex.substring(0, 50) + '...');
    
    // UniSat gibt Hex zurück, konvertiere zu Base64 für Konsistenz
    // Konvertiere Hex zu Base64
    const hexBytes = signedPsbtHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    const hexBinaryString = String.fromCharCode(...hexBytes);
    const signedPsbtBase64 = btoa(hexBinaryString);
    
    return signedPsbtBase64;
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message?.includes('rejected'))) {
      throw new Error('Signatur abgelehnt. Bitte bestätigen Sie die Transaktion in Ihrem Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBT');
  }
};

/**
 * Signiere eine PSBT mit Xverse Wallet
 * @param {string} psbtBase64 - PSBT als Base64-String
 * @param {string} walletAddress - Optional: Wallet-Adresse für signInputs
 * @returns {Promise<string>} - Signierte Transaktion als Hex-String
 */
export const signPSBTViaXverse = async (
  psbtBase64: string,
  walletAddress?: string,
  sighashType?: number  // Optional: z.B. 0x83 für SIGHASH_SINGLE | ANYONECANPAY
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
      throw new Error('Sats Connect nicht verfügbar');
    }

    // ✅ NEUE IMPLEMENTIERUNG: Verwende signMultipleTransactions für custom SIGHASH
    if (walletAddress && sighashType !== undefined) {
      console.log('[signPSBTViaXverse] 🎯 Using signMultipleTransactions for custom SIGHASH');
      console.log('[signPSBTViaXverse] Address:', walletAddress);
      console.log('[signPSBTViaXverse] SigHash:', `0x${sighashType.toString(16)} (${sighashType})`);
      
      // Wrap in Promise für async/await Kompatibilität
      return new Promise((resolve, reject) => {
        satsConnect.request('signMultipleTransactions', {
          payload: {
            network: { type: 'Mainnet' },
            message: 'Pre-Signing für Collection Item (SIGHASH_SINGLE | ANYONECANPAY)',
            psbts: [{
              psbtBase64: psbtBase64,
              inputsToSign: [{
                address: walletAddress,
                signingIndexes: [0],  // Input 0 signieren
                sigHash: sighashType  // 0x83 für SIGHASH_SINGLE | ANYONECANPAY
              }]
            }]
          },
          onFinish: (response: any) => {
            console.log('[signPSBTViaXverse] ✅ signMultipleTransactions finished:', response);
            
            // Response Format: { psbts: [signedPsbtBase64, ...] }
            if (response && response.psbts && response.psbts.length > 0) {
              const signedPsbtBase64 = response.psbts[0];
              console.log('[signPSBTViaXverse] ✅ Signed PSBT received (Base64), length:', signedPsbtBase64.length);
              console.log('[signPSBTViaXverse] Signed PSBT preview:', signedPsbtBase64.substring(0, 50) + '...');
              resolve(signedPsbtBase64);
            } else {
              reject(new Error('Keine signierte PSBT in Response erhalten'));
            }
          },
          onCancel: () => {
            console.log('[signPSBTViaXverse] ❌ User cancelled signing');
            reject(new Error('User rejected request to sign a psbt'));
          }
        });
      });
    }
    
    // ❌ ALTE IMPLEMENTIERUNG: Fallback für normale Signierung ohne custom SIGHASH
    console.log('[signPSBTViaXverse] Using standard signPsbt (no custom SIGHASH)');
    
    const requestParams: any = {
      psbt: psbtBase64,
      network: {
        type: 'Mainnet'
      },
      broadcast: false,
      autoFinalized: true
    };
    
    console.log('[signPSBTViaXverse] Request params:', JSON.stringify({ ...requestParams, psbt: psbtBase64.substring(0, 50) + '...' }, null, 2));
    
    const response = await satsConnect.request('signPsbt', requestParams);
    
    console.log('[signPSBTViaXverse] Response received:', {
      status: response.status,
      hasResult: !!response.result,
      hasError: !!response.error,
      errorMessage: response.error?.message,
      resultKeys: response.result ? Object.keys(response.result) : []
    });
    
    console.log('[signPSBTViaXverse] Full response result:', JSON.stringify(response.result, null, 2));

    if (response.status === 'success') {
      const finalTxHex = response.result?.tx || response.result?.txHex || response.result?.txid || response.tx || response.txHex;
      const signedPsbtBase64 = response.result?.psbt || response.psbt;
      
      if (finalTxHex && typeof finalTxHex === 'string' && finalTxHex.length > 500 && /^[0-9a-fA-F]+$/.test(finalTxHex)) {
        console.log('[signPSBTViaXverse] ✅ Finalized transaction received (Hex), length:', finalTxHex.length);
        console.log('[signPSBTViaXverse] Transaction preview:', finalTxHex.substring(0, 50) + '...');
        const hexBytes = finalTxHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
        const binaryString = String.fromCharCode(...hexBytes);
        const finalTxBase64 = btoa(binaryString);
        return finalTxBase64;
      }
      
      if (!signedPsbtBase64) {
        throw new Error('Keine signierte PSBT oder finalisierte Transaction erhalten');
      }

      console.log('[signPSBTViaXverse] ✅ Signed PSBT received (Base64), length:', signedPsbtBase64.length);
      console.log('[signPSBTViaXverse] Signed PSBT preview:', signedPsbtBase64.substring(0, 50) + '...');
      console.log('[signPSBTViaXverse] ⚠️ PSBT is not finalized - will be finalized in backend');
      
      return signedPsbtBase64;
    } else {
      throw new Error(response.error?.message || 'Fehler beim Signieren der PSBT');
    }
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message.includes('rejected') || error.message.includes('USER_REJECTION'))) {
      throw new Error('Signatur abgelehnt. Bitte bestätigen Sie die Transaktion in Ihrem Wallet.');
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
  walletAddress?: string,
  sighashType?: number  // Optional: SIGHASH_SINGLE | ANYONECANPAY = 0x83
): Promise<string> => {
  if (walletType === 'unisat') {
    return await signPSBTViaUnisat(psbtBase64, autoFinalized);
  } else {
    // Für Xverse: Übergebe walletAddress und sighashType
    return await signPSBTViaXverse(psbtBase64, walletAddress, sighashType);
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
      throw new Error('UniSat Wallet unterstützt keine Batch-PSBT-Signatur. Bitte aktualisieren Sie Ihre Wallet-Extension.');
    }

    // UniSat erwartet PSBTs als Hex-Array
    // Wenn psbtHexs Base64-Strings sind, konvertiere sie zu Hex
    const psbtHexsArray = psbtHexs.map(psbt => {
      // Prüfe ob Base64 oder Hex
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
      throw new Error('Signatur abgelehnt. Bitte bestätigen Sie die Transaktionen in Ihrem Wallet.');
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
      throw new Error('Sats Connect nicht verfügbar');
    }

    // Xverse signPsbt unterstützt nur einzelne PSBTs
    // Fallback: Signiere sequenziell, aber informiere den Benutzer
    console.warn('[Xverse] Batch-PSBT-Signatur nicht direkt unterstützt, signiere sequenziell...');
    
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

        // Konvertiere Base64 zu Hex für Rückgabe (Browser-kompatibel)
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
      throw new Error('Signatur abgelehnt. Bitte bestätigen Sie die Transaktionen in Ihrem Wallet.');
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
    // Für UniSat: Konvertiere Base64 zu Hex
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
      throw new Error('UniSat Wallet unterstützt keine PSBT-Push-Funktion. Bitte aktualisieren Sie Ihre Wallet-Extension.');
    }

    const txid = await window.unisat.pushPsbt(psbtHex);
    return txid;
  } catch (error: any) {
    if (error.message && (error.message.includes('User rejected') || error.message?.includes('rejected'))) {
      throw new Error('Push abgelehnt. Bitte bestätigen Sie die Transaktion in Ihrem Wallet.');
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
    // Xverse unterstützt pushPsbt nicht direkt
    // Fallback: Verwende Broadcast über Backend
    throw new Error('Xverse unterstützt pushPsbt nicht direkt. Bitte verwenden Sie das Backend-Broadcast.');
  }
};

