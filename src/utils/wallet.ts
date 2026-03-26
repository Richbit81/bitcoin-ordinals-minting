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
    okxwallet?: {
      bitcoin: {
        connect: () => Promise<{ address: string; publicKey: string }>;
        requestAccounts: () => Promise<string[]>;
        getAccounts: () => Promise<string[]>;
        getNetwork: () => Promise<string>;
        sendBitcoin: (to: string, amount: number, options?: any) => Promise<string>;
        signPsbt: (psbtHex: string, options?: any) => Promise<string>;
        signPsbts: (psbtHexs: string[], options?: any) => Promise<string[]>;
        pushPsbt: (psbtHex: string) => Promise<string>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
      };
    };
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

/**
 * Gibt die Ordinals/Taproot-Adresse aus den Wallet-Accounts zurück.
 * Sucht nach purpose='ordinals' oder bc1p-Adresse, Fallback auf accounts[0].
 */
export const getOrdinalAddress = (accounts: WalletAccount[]): string => {
  if (!accounts || accounts.length === 0) return '';
  const ordinals = accounts.find(
    acc => acc.purpose === 'ordinals' || acc.address.startsWith('bc1p')
  );
  return ordinals?.address || accounts[0].address;
};

/**
 * Gibt die Payment-Adresse aus den Wallet-Accounts zurück.
 * Sucht nach purpose='payment', Fallback auf accounts[0].
 */
export const getPaymentAddress = (accounts: WalletAccount[]): string => {
  if (!accounts || accounts.length === 0) return '';
  const payment = accounts.find(acc => acc.purpose === 'payment');
  if (payment?.address) return payment.address;
  const nonTaproot = accounts.find((acc) => !String(acc?.address || '').startsWith('bc1p'));
  return nonTaproot?.address || accounts[0].address;
};

// Helper-Funktion: Bestimme den Adresstyp
const getAddressType = (address: string): string => {
  if (address.startsWith('bc1p')) return 'Taproot';
  if (address.startsWith('bc1q')) return 'Native SegWit';
  if (address.startsWith('3')) return 'Nested SegWit';
  if (address.startsWith('1')) return 'Legacy';
  return 'Unbekannt';
};

const normalizeWalletPublicKey = (entry: any): string | undefined => {
  if (!entry || typeof entry !== 'object') return undefined;
  const candidates = [
    entry.publicKey,
    entry.pubKey,
    entry.public_key,
    entry.paymentPublicKey,
    entry.ordinalsPublicKey,
    entry.addressPublicKey,
    entry.btcPublicKey,
    entry?.keys?.payment?.publicKey,
    entry?.keys?.ordinals?.publicKey,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return value;
  }
  return undefined;
};
const extractXverseAddresses = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.addresses)) return payload.addresses;
  if (Array.isArray(payload?.addressses)) return payload.addressses;
  if (Array.isArray(payload?.result?.addresses)) return payload.result.addresses;
  if (Array.isArray(payload?.result?.addressses)) return payload.result.addressses;
  if (Array.isArray(payload?.data?.addresses)) return payload.data.addresses;
  if (Array.isArray(payload?.data?.addressses)) return payload.data.addressses;
  return [];
};

export const connectUnisat = async (): Promise<WalletAccount[]> => {
  if (!isUnisatInstalled()) {
    throw new Error('UniSat Wallet is not installed. Please install the UniSat browser extension.');
  }

  try {
    if (!window.unisat || typeof window.unisat.requestAccounts !== 'function') {
      throw new Error('UniSat Wallet is detected but the connection API is not available. This may be due to multiple wallet extensions interfering with each other. Try disabling other Bitcoin wallet extensions and reload the page.');
    }

    const accounts = await window.unisat.requestAccounts();
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned. Please unlock your UniSat Wallet and try again.');
    }

    const currentAddress = accounts[0];
    const currentAddressType = getAddressType(currentAddress);
    
    console.log(`[UniSat] Connected with ${currentAddressType} address: ${currentAddress}`);

    const network = await window.unisat.getNetwork();
    if (network !== 'livenet') {
      throw new Error('Please switch to Bitcoin Mainnet in your UniSat Wallet.');
    }

    const walletAccounts: WalletAccount[] = [];
    
    if (currentAddress.startsWith('bc1p')) {
      localStorage.setItem('unisat_taproot_address', currentAddress);
      walletAccounts.push({ address: currentAddress, purpose: 'ordinals' });
    } else {
      walletAccounts.push({ address: currentAddress, purpose: 'payment' });
      
      const savedTaproot = localStorage.getItem('unisat_taproot_address');
      if (savedTaproot && savedTaproot.startsWith('bc1p')) {
        console.log(`[UniSat] Using saved Taproot address for ordinals: ${savedTaproot}`);
        walletAccounts.push({ address: savedTaproot, purpose: 'ordinals' });
      } else {
        console.log(`[UniSat] No saved Taproot address, using ${currentAddressType} for everything`);
      }
    }

    console.log(`[UniSat] Setup complete with ${walletAccounts.length} address(es)`);
    walletAccounts.forEach(acc => {
      console.log(`   ${acc.purpose === 'ordinals' ? 'Ordinals' : 'Payment'}: ${acc.address}`);
    });

    return walletAccounts;
  } catch (error: any) {
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
    
    // Request both payment + ordinals explicitly to ensure payment publicKey is present.
    const response = await satsConnect.request('wallet_connect', {
      addresses: ['payment', 'ordinals'],
      message: 'Connect wallet for marketplace purchase',
    });
    
    console.log('Xverse wallet_connect response:', response);

    if (response.status === 'success') {
      const addresses = extractXverseAddresses(response);
      
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
          publicKey: normalizeWalletPublicKey(ordinalsAddress),
          purpose: 'ordinals'
        });
        console.log('[Xverse] ✅ Ordinals-Adresse:', ordinalsAddress.address);
      }
      
      if (paymentAddress && paymentAddress.address) {
        accounts.push({
          address: paymentAddress.address,
          publicKey: normalizeWalletPublicKey(paymentAddress),
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
    if (!accounts || accounts.length === 0) return [];

    const currentAddress = accounts[0];
    const walletAccounts: WalletAccount[] = [];

    if (currentAddress.startsWith('bc1p')) {
      // Persist the last known taproot address for auto-reconnect flows.
      localStorage.setItem('unisat_taproot_address', currentAddress);
      walletAccounts.push({ address: currentAddress, purpose: 'ordinals' });
    } else {
      walletAccounts.push({ address: currentAddress, purpose: 'payment' });

      const savedTaproot = localStorage.getItem('unisat_taproot_address');
      if (savedTaproot && savedTaproot.startsWith('bc1p')) {
        walletAccounts.push({ address: savedTaproot, purpose: 'ordinals' });
      }
    }

    return walletAccounts;
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
      // Newer Xverse API: getAddresses often returns the most complete publicKey data.
      try {
        const addressesResponse = await satsConnect.request('getAddresses', {
          purposes: ['payment', 'ordinals'],
          message: 'Resolve wallet addresses for purchase',
        });
        if (addressesResponse?.status === 'success') {
          const addresses = extractXverseAddresses(addressesResponse);
          const accounts: WalletAccount[] = [];
          const ordinalsAddr = addresses.find((addr: any) => String(addr?.purpose || '').toLowerCase() === 'ordinals');
          const paymentAddr =
            addresses.find((addr: any) => String(addr?.purpose || '').toLowerCase() === 'payment') ||
            addresses.find((addr: any) => String(addr?.addressType || '').toLowerCase() === 'p2sh') ||
            addresses.find((addr: any) => String(addr?.address || '').startsWith('3')) ||
            addresses.find((addr: any) => String(addr?.address || '').startsWith('bc1q'));
          if (ordinalsAddr?.address) {
            accounts.push({
              address: String(ordinalsAddr.address).trim(),
              publicKey: normalizeWalletPublicKey(ordinalsAddr),
              purpose: 'ordinals'
            });
          }
          if (paymentAddr?.address) {
            const normalizedAddress = String(paymentAddr.address).trim();
            const exists = accounts.some((acc) => String(acc.address || '').trim() === normalizedAddress);
            if (!exists) {
              accounts.push({
                address: normalizedAddress,
                publicKey: normalizeWalletPublicKey(paymentAddr),
                purpose: 'payment'
              });
            }
          }
          if (accounts.length > 0) return accounts;
        }
      } catch {
        // ignore and fall through to wallet_getAccount
      }
      const accountResponse = await satsConnect.request('wallet_getAccount', null);
      
      if (accountResponse.status === 'success') {
        const addresses = extractXverseAddresses(accountResponse);
        const accounts: WalletAccount[] = [];

        // Finde Ordinals-Adresse
        const ordinalsAddr = addresses.find((addr: any) => addr.purpose === 'ordinals');
        if (ordinalsAddr && ordinalsAddr.address) {
          accounts.push({
            address: ordinalsAddr.address,
            publicKey: normalizeWalletPublicKey(ordinalsAddr),
            purpose: 'ordinals'
          });
        }

        // Finde Payment-Adresse (wichtig fuer Marketplace-Funding)
        const paymentAddr =
          addresses.find((addr: any) => addr.purpose === 'payment') ||
          addresses.find((addr: any) => String(addr?.address || '').startsWith('3')) ||
          addresses.find((addr: any) => String(addr?.address || '').startsWith('bc1q'));
        if (paymentAddr && paymentAddr.address) {
          const alreadyIncluded = accounts.some(
            (acc) => String(acc.address || '').trim() === String(paymentAddr.address || '').trim()
          );
          if (!alreadyIncluded) {
            accounts.push({
              address: paymentAddr.address,
              publicKey: normalizeWalletPublicKey(paymentAddr),
              purpose: 'payment'
            });
          } else {
            // Falls dieselbe Adresse fuer beide Zwecke geliefert wird, Purpose trotzdem markieren.
            const idx = accounts.findIndex(
              (acc) => String(acc.address || '').trim() === String(paymentAddr.address || '').trim()
            );
            if (idx >= 0 && !accounts[idx].purpose) {
              accounts[idx] = { ...accounts[idx], purpose: 'payment' };
            }
          }
        }

        // Fallback: falls kein Purpose vom Provider kommt, ueber Bech32/P2SH ableiten.
        if (accounts.length === 0 && addresses.length > 0) {
          const normalized = addresses
            .map((entry: any) => ({
              address: String(entry?.address || '').trim(),
              publicKey: String(normalizeWalletPublicKey(entry) || '').trim(),
            }))
            .filter((entry: any) => !!entry.address);
          for (const entry of normalized) {
            accounts.push({
              address: entry.address,
              publicKey: entry.publicKey || undefined,
              purpose: entry.address.startsWith('bc1p') ? 'ordinals' : 'payment'
            });
          }
        } else if (accounts.length === 1 && accounts[0].purpose === 'ordinals') {
          // Letzter Sicherheits-Fallback: nutze eine nicht-bc1p Adresse als Payment, falls vorhanden.
          const altPayment = addresses.find((addr: any) => !String(addr?.address || '').startsWith('bc1p'));
          if (altPayment?.address) {
            const exists = accounts.some((acc) => String(acc.address || '') === String(altPayment.address || ''));
            if (!exists) {
              accounts.push({
                address: String(altPayment.address),
                publicKey: String(normalizeWalletPublicKey(altPayment) || '').trim() || undefined,
                purpose: 'payment'
              });
            }
          }
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

// ===================== OKX WALLET =====================

export const isOKXInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.okxwallet?.bitcoin !== 'undefined';
};

export const waitForOKX = (timeout = 3000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isOKXInstalled()) {
      resolve(true);
      return;
    }
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isOKXInstalled()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
};

export const connectOKX = async (): Promise<WalletAccount[]> => {
  if (!isOKXInstalled()) {
    throw new Error('OKX Wallet is not installed. Please install the OKX browser extension.');
  }

  try {
    const result = await window.okxwallet!.bitcoin.connect();
    
    if (!result || !result.address) {
      throw new Error('No account returned from OKX Wallet.');
    }

    const address = result.address;
    const addressType = getAddressType(address);
    console.log(`[OKX] Connected with ${addressType} address: ${address}`);

    const walletAccounts: WalletAccount[] = [];

    if (address.startsWith('bc1p')) {
      // Taproot: save for ordinals, check for saved Legacy/SegWit for payments
      localStorage.setItem('okx_taproot_address', address);
      walletAccounts.push({ address, publicKey: result.publicKey, purpose: 'ordinals' });

      const savedPayment = localStorage.getItem('okx_payment_address');
      if (savedPayment && !savedPayment.startsWith('bc1p')) {
        console.log(`[OKX] Using saved payment address: ${savedPayment}`);
        walletAccounts.push({ address: savedPayment, purpose: 'payment' });
      } else {
        console.warn(`[OKX] No saved payment address. Switch to Legacy/SegWit in OKX for payments, then reconnect.`);
      }
    } else {
      // Legacy/SegWit: use for payments, check for saved Taproot for ordinals
      localStorage.setItem('okx_payment_address', address);
      walletAccounts.push({ address, publicKey: result.publicKey, purpose: 'payment' });

      const savedTaproot = localStorage.getItem('okx_taproot_address');
      if (savedTaproot && savedTaproot.startsWith('bc1p')) {
        console.log(`[OKX] Using saved Taproot address for ordinals: ${savedTaproot}`);
        walletAccounts.push({ address: savedTaproot, purpose: 'ordinals' });
      } else {
        console.log(`[OKX] No saved Taproot address, using ${addressType} for everything`);
      }
    }

    console.log(`[OKX] Setup complete with ${walletAccounts.length} address(es)`);
    walletAccounts.forEach(acc => {
      console.log(`   ${acc.purpose === 'ordinals' ? 'Ordinals' : 'Payment'}: ${acc.address}`);
    });

    return walletAccounts;
  } catch (error: any) {
    if (error.message?.includes('User rejected') || error.code === 4001) {
      throw new Error('Connection rejected. Please approve the connection request in your OKX wallet.');
    }
    throw new Error(error.message || 'Error connecting to OKX Wallet.');
  }
};

export const getOKXAccounts = async (): Promise<WalletAccount[]> => {
  if (!isOKXInstalled()) return [];
  try {
    const accounts = await window.okxwallet!.bitcoin.getAccounts();
    return accounts.map(addr => ({ address: addr }));
  } catch {
    return [];
  }
};

export const sendBitcoinViaOKX = async (
  to: string,
  amount: number
): Promise<string> => {
  if (!isOKXInstalled()) {
    throw new Error('OKX Wallet nicht gefunden');
  }

  try {
    const amountInSats = Math.round(amount * 100000000);
    console.log('[OKX] Sending Bitcoin:', { to, amount, amountInSats });

    if (amountInSats < 546) {
      throw new Error(`Amount too small. Minimum is 546 sats. You tried to send ${amountInSats} sats.`);
    }

    // Check current connected address
    const accounts = await window.okxwallet!.bitcoin.getAccounts();
    const currentAddress = accounts?.[0];
    if (currentAddress) {
      const addrType = getAddressType(currentAddress);
      console.log(`[OKX] Sending from ${addrType} address: ${currentAddress}`);
    }

    const txid = await window.okxwallet!.bitcoin.sendBitcoin(to, amountInSats);
    console.log('[OKX] ✅ Transaction sent:', txid);
    return txid;
  } catch (error: any) {
    if (error.message?.includes('User rejected') || error.code === 4001) {
      throw new Error('Payment was cancelled. Please approve the transaction in your OKX wallet.');
    }
    if (error.message?.includes('Insufficient') || error.message?.includes('insufficient') || error.message?.includes('not enough')) {
      // Check if the user is connected with Taproot but has BTC on Legacy
      try {
        const accounts = await window.okxwallet!.bitcoin.getAccounts();
        const currentAddress = accounts?.[0];
        if (currentAddress?.startsWith('bc1p')) {
          throw new Error(
            'Insufficient balance on your Taproot address.\n\n' +
            'Your BTC is likely on your Legacy/SegWit address.\n\n' +
            'Fix: In OKX Wallet, switch to your Legacy address, then reconnect.\n' +
            'Your ordinals will still go to your Taproot address.'
          );
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes('Insufficient balance on your Taproot')) throw checkErr;
      }
      throw new Error('Insufficient balance in OKX Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Senden von Bitcoin über OKX');
  }
};

export const signPSBTViaOKX = async (
  psbtBase64: string,
  autoFinalized: boolean = false
): Promise<string> => {
  if (!isOKXInstalled()) {
    throw new Error('OKX Wallet nicht gefunden');
  }

  try {
    // OKX erwartet PSBT als Hex (wie UniSat)
    const binaryString = atob(psbtBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const psbtHex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const signedPsbtHex = await window.okxwallet!.bitcoin.signPsbt(psbtHex, { autoFinalized });
    console.log('[OKX] ✅ PSBT signed, length:', signedPsbtHex.length);

    // Konvertiere Hex zu Base64 für Konsistenz
    const hexBytes = signedPsbtHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    const hexBinaryString = String.fromCharCode(...hexBytes);
    return btoa(hexBinaryString);
  } catch (error: any) {
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      throw new Error('Signatur abgelehnt. Bitte bestätigen Sie die Transaktion in Ihrem OKX Wallet.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBT über OKX');
  }
};

export const signPsbtsViaOKX = async (
  psbtHexs: string[],
  autoFinalized: boolean = false
): Promise<string[]> => {
  if (!isOKXInstalled()) {
    throw new Error('OKX Wallet nicht gefunden');
  }

  try {
    // Konvertiere Base64 zu Hex falls nötig
    const psbtHexsArray = psbtHexs.map(psbt => {
      if (psbt.length > 100 && !/^[0-9a-fA-F]+$/.test(psbt)) {
        const binaryString = atob(psbt);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return psbt;
    });

    const signedPsbtHexs = await window.okxwallet!.bitcoin.signPsbts(psbtHexsArray, { autoFinalized });
    return signedPsbtHexs;
  } catch (error: any) {
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      throw new Error('Signatur abgelehnt.');
    }
    throw new Error(error.message || 'Fehler beim Signieren der PSBTs über OKX');
  }
};

export const pushPsbtViaOKX = async (psbtHex: string): Promise<string> => {
  if (!isOKXInstalled()) {
    throw new Error('OKX Wallet nicht gefunden');
  }
  try {
    const txid = await window.okxwallet!.bitcoin.pushPsbt(psbtHex);
    return txid;
  } catch (error: any) {
    throw new Error(error.message || 'Fehler beim Pushen der PSBT über OKX');
  }
};

// ===================== END OKX WALLET =====================

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
  walletType: 'unisat' | 'xverse' | 'okx'
): Promise<string> => {
  if (recipients.length === 0) {
    throw new Error('Keine Empfänger angegeben');
  }

  if (recipients.length === 1) {
    if (walletType === 'unisat') {
      return await sendBitcoinViaUnisat(recipients[0].address, recipients[0].amount);
    } else if (walletType === 'okx') {
      return await sendBitcoinViaOKX(recipients[0].address, recipients[0].amount);
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
    // UniSat oder OKX - sequenzielle Zahlungen
    const walletLabel = walletType === 'okx' ? 'OKX' : 'UniSat';
    const sendFn = walletType === 'okx' ? sendBitcoinViaOKX : sendBitcoinViaUnisat;

    if (walletType === 'okx' && !isOKXInstalled()) {
      throw new Error('OKX Wallet nicht gefunden');
    }
    if (walletType === 'unisat' && !isUnisatInstalled()) {
      throw new Error('UniSat Wallet nicht gefunden');
    }

    try {
      console.log(`[${walletLabel}] Mehrere Zahlungen - sequenziell`);
      
      const sortedRecipients = [...recipients].sort((a, b) => b.amount - a.amount);
      console.log(`[${walletLabel}] Sortiere Zahlungen nach Betrag (größte zuerst):`, sortedRecipients.map(r => `${r.address}: ${r.amount} BTC`));
      
      let lastTxid = '';
      for (let i = 0; i < sortedRecipients.length; i++) {
        const recipient = sortedRecipients[i];
        console.log(`[${walletLabel}] Zahlung ${i + 1}/${sortedRecipients.length}: ${recipient.address}, ${recipient.amount} BTC (${Math.round(recipient.amount * 100000000)} sats)`);
        
        try {
          lastTxid = await sendFn(recipient.address, recipient.amount);
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
  sighashType?: number,  // Optional: z.B. 0x83 für SIGHASH_SINGLE | ANYONECANPAY
  signingIndexes?: number[]
): Promise<string> => {
  if (!isXverseInstalled()) {
    throw new Error('Xverse Wallet nicht gefunden');
  }

  try {
    const satsConnect = await import('sats-connect');
    
    if (!satsConnect || !satsConnect.request) {
      throw new Error('Sats Connect nicht verfügbar');
    }

    // Prefer signMultipleTransactions whenever we need constrained input-signing.
    if (walletAddress && (sighashType !== undefined || (Array.isArray(signingIndexes) && signingIndexes.length > 0))) {
      // WICHTIG: signMultipleTransactions ist KEINE request() Methode!
      // Es muss direkt aufgerufen werden
      const { signMultipleTransactions } = satsConnect;
      
      if (!signMultipleTransactions || typeof signMultipleTransactions !== 'function') {
        throw new Error('signMultipleTransactions ist nicht verfügbar. Bitte aktualisieren Sie sats-connect.');
      }
      
      // Wrap in Promise für async/await Kompatibilität
      try {
        return await new Promise((resolve, reject) => {
          signMultipleTransactions({
            payload: {
              network: { type: 'Mainnet' },
              message: 'Sign Bitcoin transaction',
              psbts: [{
                psbtBase64: psbtBase64,
                inputsToSign: [
                  {
                    address: walletAddress,
                    signingIndexes:
                      Array.isArray(signingIndexes) && signingIndexes.length > 0
                        ? signingIndexes
                        : [0],
                    ...(sighashType !== undefined ? { sigHash: sighashType } : {}),
                  },
                ],
              }]
            },
            onFinish: (response: any) => {
              // ✅ FIX: Response kann entweder { psbts: [...] } ODER direkt ein Array sein!
              let psbts: any[] | undefined;
              
              if (Array.isArray(response)) {
                // Response ist direkt ein Array: [{ psbtBase64: "..." }]
                psbts = response;
              } else if (response && response.psbts && Array.isArray(response.psbts)) {
                // Response ist Object mit psbts property: { psbts: [{ psbtBase64: "..." }] }
                psbts = response.psbts;
              }
              
              if (psbts && psbts.length > 0) {
                // PSBT kann entweder direkt ein String sein ODER ein Object mit psbtBase64
                const firstPsbt = psbts[0];
                let signedPsbtBase64: string;
                
                if (typeof firstPsbt === 'string') {
                  signedPsbtBase64 = firstPsbt;
                } else if (firstPsbt && firstPsbt.psbtBase64) {
                  signedPsbtBase64 = firstPsbt.psbtBase64;
                } else {
                  reject(new Error('Unerwartetes PSBT-Format in Response'));
                  return;
                }
                
                resolve(signedPsbtBase64);
              } else {
                reject(new Error('Keine signierte PSBT in Response erhalten'));
              }
            },
            onCancel: () => {
              reject(new Error('User rejected request to sign a psbt'));
            }
          });
        });
      } catch (constrainedErr: any) {
        const constrainedMsg = String(constrainedErr?.message || constrainedErr || '');
        const looksLikePubKeyScriptMismatch =
          constrainedMsg.toLowerCase().includes("doesn't have pubkey") ||
          constrainedMsg.toLowerCase().includes('does not have pubkey') ||
          constrainedMsg.toLowerCase().includes('input script');
        if (!looksLikePubKeyScriptMismatch) {
          throw constrainedErr;
        }
        console.warn('[Xverse] signMultipleTransactions failed with script/pubkey mismatch, falling back to signPsbt auto-detection:', constrainedMsg);
      }
    }
    
    // Fallback for generic signPsbt calls.
    const requestParams: any = {
      psbt: psbtBase64,
      network: {
        type: 'Mainnet'
      },
      broadcast: false,
      autoFinalized: false
    };

    const response = await satsConnect.request('signPsbt', requestParams);

    if (response.status === 'success') {
      const finalTxHex = response.result?.tx || response.result?.txHex || response.result?.txid || response.tx || response.txHex;
      const signedPsbtBase64 = response.result?.psbt || response.psbt;
      
      if (finalTxHex && typeof finalTxHex === 'string' && finalTxHex.length > 500 && /^[0-9a-fA-F]+$/.test(finalTxHex)) {
        const hexBytes = finalTxHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
        const binaryString = String.fromCharCode(...hexBytes);
        const finalTxBase64 = btoa(binaryString);
        return finalTxBase64;
      }
      
      if (!signedPsbtBase64) {
        throw new Error('Keine signierte PSBT oder finalisierte Transaction erhalten');
      }
      
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
  walletType: 'unisat' | 'xverse' | 'okx',
  autoFinalized: boolean = false,
  walletAddress?: string,
  sighashType?: number,
  signingIndexes?: number[]
): Promise<string> => {
  if (walletType === 'unisat') {
    return await signPSBTViaUnisat(psbtBase64, autoFinalized);
  } else if (walletType === 'okx') {
    return await signPSBTViaOKX(psbtBase64, autoFinalized);
  } else {
    return await signPSBTViaXverse(psbtBase64, walletAddress, sighashType, signingIndexes);
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
  walletType: 'unisat' | 'xverse' | 'okx',
  autoFinalized: boolean = false
): Promise<string[]> => {
  if (walletType === 'okx') {
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
    return await signPsbtsViaOKX(psbtHexs, autoFinalized);
  } else if (walletType === 'unisat') {
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
  walletType: 'unisat' | 'xverse' | 'okx'
): Promise<string> => {
  if (walletType === 'unisat') {
    return await pushPsbtViaUnisat(psbtHex);
  } else if (walletType === 'okx') {
    return await pushPsbtViaOKX(psbtHex);
  } else {
    throw new Error('Xverse unterstützt pushPsbt nicht direkt. Bitte verwenden Sie das Backend-Broadcast.');
  }
};

