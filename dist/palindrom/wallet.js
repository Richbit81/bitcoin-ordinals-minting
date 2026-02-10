// Wallet Integration für Xverse und Unisat
// Echte Wallet-Verbindung mit Palindrom SAT Scanning

class WalletManager {
    constructor() {
        this.connectedWallet = null;
        this.walletType = null;
        this.taprootAddress = null;  // bc1p... (für Ordinals/SATs)
        this.paymentAddress = null;  // Für Gebühren
        this.selectedPalindroms = [];
        this.foundPalindroms = [];   // Alle gefundenen Palindrome
        this.maxSelections = 5;
        this.isConnected = false;
    }

    // ========================================
    // Wallet-Erkennung
    // ========================================

    /**
     * Prüft welche Wallets im Browser verfügbar sind
     */
    detectAvailableWallets() {
        const wallets = [];

        // Xverse - auch in parent/top prüfen (iframe-Support)
        let hasXverse = typeof window.BitcoinProvider !== 'undefined' || typeof window.XverseProviders !== 'undefined';
        if (!hasXverse) {
            try { hasXverse = typeof window.top?.BitcoinProvider !== 'undefined' || typeof window.top?.XverseProviders !== 'undefined'; } catch (e) {}
        }
        if (!hasXverse) {
            try { hasXverse = typeof window.parent?.BitcoinProvider !== 'undefined' || typeof window.parent?.XverseProviders !== 'undefined'; } catch (e) {}
        }
        if (hasXverse) wallets.push('xverse');

        // UniSat - auch in parent/top prüfen (iframe-Support)
        let hasUnisat = typeof window.unisat !== 'undefined';
        if (!hasUnisat) {
            try { hasUnisat = typeof window.top?.unisat !== 'undefined'; } catch (e) {}
        }
        if (!hasUnisat) {
            try { hasUnisat = typeof window.parent?.unisat !== 'undefined'; } catch (e) {}
        }
        if (hasUnisat) wallets.push('unisat');

        return wallets;
    }

    // ========================================
    // Wallet verbinden
    // ========================================

    async connectWallet(type) {
        try {
            this.walletType = type;

            if (type === 'xverse') {
                return await this.connectXverse();
            } else if (type === 'unisat') {
                return await this.connectUnisat();
            }

            throw new Error('Unknown wallet type');
        } catch (error) {
            console.error('Wallet-Verbindungsfehler:', error);
            throw error;
        }
    }

    async connectXverse() {
        // Xverse Wallet - Prüfe auf Provider
        // In iframes: Wallet-Extensions injizieren Provider nur ins Top-Level-Fenster
        // Deshalb auch window.top und window.parent prüfen (same-origin)
        let provider = window.BitcoinProvider || window.XverseProviders?.BitcoinProvider;
        
        if (!provider) {
            try {
                provider = window.top?.BitcoinProvider || window.top?.XverseProviders?.BitcoinProvider;
            } catch (e) { /* cross-origin, ignore */ }
        }
        if (!provider) {
            try {
                provider = window.parent?.BitcoinProvider || window.parent?.XverseProviders?.BitcoinProvider;
            } catch (e) { /* cross-origin, ignore */ }
        }

        if (!provider) {
            throw new Error(
                'Xverse Wallet not found! Please install the Xverse browser extension: https://www.xverse.app/'
            );
        }

        try {
            let addresses = null;

            // ============================================================
            // Methode 1: wallet_connect (Neueste Xverse API 2025+)
            // ============================================================
            try {
                console.log('[Wallet] Versuche wallet_connect...');
                const response = await provider.request('wallet_connect', null);
                console.log('[Wallet] wallet_connect Response:', JSON.stringify(response));

                if (response && response.result) {
                    // wallet_connect gibt addresses direkt im result
                    if (Array.isArray(response.result.addresses)) {
                        addresses = response.result.addresses;
                    } else if (Array.isArray(response.result)) {
                        addresses = response.result;
                    }
                }
            } catch (e) {
                console.log('[Wallet] wallet_connect nicht verfügbar:', e.message || e);
            }

            // ============================================================
            // Methode 2: getAccounts (Xverse sats-connect Stil)
            // ============================================================
            if (!addresses) {
                try {
                    console.log('[Wallet] Versuche getAccounts...');
                    const response = await provider.request('getAccounts', {
                        purposes: ['ordinals', 'payment'],
                        message: 'Palindrom Sound Box'
                    });
                    console.log('[Wallet] getAccounts Response:', JSON.stringify(response));

                    if (response && response.result) {
                        if (Array.isArray(response.result.addresses)) {
                            addresses = response.result.addresses;
                        } else if (Array.isArray(response.result)) {
                            addresses = response.result;
                        }
                    }
                } catch (e) {
                    console.log('[Wallet] getAccounts nicht verfügbar:', e.message || e);
                }
            }

            // ============================================================
            // Methode 3: requestAccounts (Ältere API)
            // ============================================================
            if (!addresses) {
                try {
                    console.log('[Wallet] Versuche requestAccounts...');
                    const accounts = await provider.requestAccounts();
                    console.log('[Wallet] requestAccounts Response:', JSON.stringify(accounts));

                    if (accounts && Array.isArray(accounts) && accounts.length > 0) {
                        addresses = accounts.map(addr => {
                            if (typeof addr === 'string') {
                                return {
                                    address: addr,
                                    purpose: addr.startsWith('bc1p') ? 'ordinals' : 'payment'
                                };
                            }
                            return addr;
                        });
                    }
                } catch (e) {
                    console.log('[Wallet] requestAccounts nicht verfügbar:', e.message || e);
                }
            }

            // ============================================================
            // Methode 4: connect() (Legacy)
            // ============================================================
            if (!addresses) {
                try {
                    console.log('[Wallet] Versuche connect()...');
                    const result = await provider.connect();
                    console.log('[Wallet] connect Response:', JSON.stringify(result));

                    if (result) {
                        if (Array.isArray(result.addresses)) {
                            addresses = result.addresses;
                        } else if (Array.isArray(result)) {
                            addresses = result.map(addr => {
                                if (typeof addr === 'string') {
                                    return { address: addr, purpose: addr.startsWith('bc1p') ? 'ordinals' : 'payment' };
                                }
                                return addr;
                            });
                        }
                    }
                } catch (e) {
                    console.log('[Wallet] connect() nicht verfügbar:', e.message || e);
                }
            }

            // ============================================================
            // Ergebnis verarbeiten
            // ============================================================
            if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
                throw new Error('No addresses received from Xverse. Please unlock Xverse and try again.');
            }

            console.log('[Wallet] Adressen erhalten:', JSON.stringify(addresses));

            // Taproot-Adresse (bc1p...) finden - für Ordinals/SATs
            let taprootAddr = null;
            let paymentAddr = null;

            for (const entry of addresses) {
                const addr = entry.address || entry;
                const purpose = entry.purpose || '';

                if (typeof addr === 'string') {
                    if (purpose === 'ordinals' || addr.startsWith('bc1p')) {
                        taprootAddr = addr;
                    } else if (purpose === 'payment' || addr.startsWith('3') || addr.startsWith('bc1q')) {
                        paymentAddr = addr;
                    }
                }
            }

            // Fallback: Erste Adresse nehmen
            if (!taprootAddr && addresses.length > 0) {
                const first = addresses[0];
                taprootAddr = typeof first === 'string' ? first : first.address;
            }

            this.taprootAddress = taprootAddr;
            this.paymentAddress = paymentAddr;
            this.connectedWallet = taprootAddr;
            this.isConnected = true;

            console.log('[Wallet] Xverse verbunden! Taproot:', this.taprootAddress, 'Payment:', this.paymentAddress);

            return {
                success: true,
                address: this.taprootAddress,
                paymentAddress: this.paymentAddress,
                walletType: 'xverse'
            };

        } catch (error) {
            const msg = error.message || String(error);
            if (msg.includes('User rejected') || msg.includes('cancelled') || msg.includes('denied')) {
                throw new Error('Connection rejected by user');
            }
            throw error;
        }
    }

    async connectUnisat() {
        // In iframes: auch window.top und window.parent prüfen
        let unisat = window.unisat;
        if (!unisat) {
            try { unisat = window.top?.unisat; } catch (e) { /* cross-origin */ }
        }
        if (!unisat) {
            try { unisat = window.parent?.unisat; } catch (e) { /* cross-origin */ }
        }
        if (!unisat) {
            throw new Error(
                'UniSat Wallet not found! Please install the UniSat browser extension: https://unisat.io/'
            );
        }

        try {
            const accounts = await unisat.requestAccounts();

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts received from UniSat');
            }

            this.taprootAddress = accounts[0];
            this.paymentAddress = accounts[0]; // UniSat nutzt gleiche Adresse
            this.connectedWallet = accounts[0];
            this.isConnected = true;

            console.log('[Wallet] UniSat verbunden:', this.taprootAddress);

            return {
                success: true,
                address: this.taprootAddress,
                paymentAddress: this.paymentAddress,
                walletType: 'unisat'
            };

        } catch (error) {
            if (error.message.includes('User rejected') || error.message.includes('cancelled')) {
                throw new Error('Connection rejected by user');
            }
            throw error;
        }
    }

    // ========================================
    // Palindrom SAT Scanning
    // ========================================

    /**
     * Scannt das verbundene Wallet nach Palindrom Rare SATs
     * Nutzt den PalindromScanner (palindrom-scanner.js)
     */
    async scanForPalindromSATs(onProgress) {
        if (!this.isConnected || !this.taprootAddress) {
            throw new Error('No wallet connected');
        }

        // Progress-Callback setzen
        if (onProgress) {
            palindromScanner.onProgress = onProgress;
        }

        // Scanne NUR die Taproot-Adresse (bc1p...) für Palindrome
        // Payment-Adresse enthält keine relevanten SATs für Ordinals
        const allPalindromes = [];
        const addressesToScan = [this.taprootAddress];

        for (const addr of addressesToScan) {
            console.log(`[Wallet] Starte Palindrom-Scan für ${addr}`);
            try {
                const palindromes = await palindromScanner.scanWalletForPalindromes(addr);
                console.log(`[Wallet] ${palindromes.length} Palindrom-SATs gefunden auf ${addr.substring(0, 12)}...`);
                allPalindromes.push(...palindromes);
            } catch (err) {
                console.warn(`[Wallet] Scan-Fehler für ${addr.substring(0, 12)}...: ${err.message}`);
            }
        }

        // Sortieren: Kürzere (seltenere) zuerst
        allPalindromes.sort((a, b) => {
            if (a.digits !== b.digits) return a.digits - b.digits;
            return a.sat - b.sat;
        });

        this.foundPalindroms = allPalindromes;
        console.log(`[Wallet] ${allPalindromes.length} Palindrom-SATs gefunden (gesamt)`);

        return allPalindromes;
    }

    // ========================================
    // Palindrom Auswahl (1-5)
    // ========================================

    selectPalindrom(palindrom) {
        const index = this.selectedPalindroms.findIndex(p => p.sat === palindrom.sat);

        if (index > -1) {
            // Deselektieren
            this.selectedPalindroms.splice(index, 1);
        } else {
            // Selektieren (max 5)
            if (this.selectedPalindroms.length >= this.maxSelections) {
                throw new Error(`Maximum of ${this.maxSelections} palindromes can be selected`);
            }
            this.selectedPalindroms.push(palindrom);
        }

        return this.selectedPalindroms;
    }

    deselectPalindrom(sat) {
        this.selectedPalindroms = this.selectedPalindroms.filter(p => p.sat !== sat);
        return this.selectedPalindroms;
    }

    clearSelection() {
        this.selectedPalindroms = [];
    }

    getSelectedSequences() {
        // Gibt die Sequenzen der ausgewählten Palindrome zurück
        return this.selectedPalindroms.map(p => p.sequence);
    }

    // ========================================
    // Disconnect
    // ========================================

    disconnect() {
        this.connectedWallet = null;
        this.walletType = null;
        this.taprootAddress = null;
        this.paymentAddress = null;
        this.selectedPalindroms = [];
        this.foundPalindroms = [];
        this.isConnected = false;
        console.log('[Wallet] Disconnected');
    }
}

// Globale Instanz
const walletManager = new WalletManager();
