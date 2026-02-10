// Palindrom Scanner - Findet Palindrom Rare SATs in einem Wallet
// Nutzt den server-seitigen Scan-Endpoint für maximale Geschwindigkeit
// (Server macht parallele Requests + permanentes Caching der SAT-Ranges)

// API Base URL - Railway Backend
const PALINDROM_API_BASE = window.PALINDROM_API_URL || 'https://bitcoin-ordinals-backend-production.up.railway.app';

class PalindromScanner {
    constructor() {
        this.isScanning = false;
        this.scanProgress = { current: 0, total: 0, status: '' };
        this.onProgress = null;
    }

    // ========================================
    // Haupt-Scan-Funktion (server-seitig!)
    // ========================================

    async scanWalletForPalindromes(address) {
        if (this.isScanning) {
            throw new Error('Scan already in progress');
        }

        this.isScanning = true;
        this.scanProgress = { current: 0, total: 1, status: 'Scanning wallet for Palindrom SATs...' };
        this._updateProgress();

        try {
            // Ein einziger API-Call zum Server – der macht alles parallel + gecached!
            const response = await fetch(`${PALINDROM_API_BASE}/api/palindrom/scan-palindromes/${address}`);

            if (!response.ok) {
                let errMsg = `Server-Fehler (${response.status})`;
                try {
                    const err = await response.json();
                    errMsg = err.error || errMsg;
                } catch (e) { /* ignore */ }
                throw new Error(errMsg);
            }

            const data = await response.json();

            this.scanProgress = {
                current: 1,
                total: 1,
                status: `✓ ${data.palindromes.length} palindromes found! (${data.stats.utxos} UTXOs, ${data.stats.timeSeconds}s)`
            };
            this._updateProgress();

            console.log(`[Scanner] ${data.palindromes.length} Palindrome in ${data.stats.timeSeconds}s (${data.stats.cachedRanges} cached, ${data.stats.fetchedRanges} neu geladen)`);

            return data.palindromes;

        } catch (error) {
            this.scanProgress.status = `Error: ${error.message}`;
            this._updateProgress();
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    // ========================================
    // API Status Check
    // ========================================

    async checkApiStatus() {
        try {
            const response = await fetch(`${PALINDROM_API_BASE}/api/palindrom/status`);
            return await response.json();
        } catch (error) {
            return { mempool: 'offline', ordinals: 'offline', error: error.message };
        }
    }

    // ========================================
    // Progress-Update
    // ========================================

    _updateProgress() {
        if (this.onProgress) {
            this.onProgress({ ...this.scanProgress });
        }
        console.log(`[Scanner] ${this.scanProgress.status}`);
    }

    // ========================================
    // Hilfsfunktionen (für UI-Darstellung)
    // ========================================

    static formatSatNumber(sat) {
        return String(sat).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    static getRarity(palindrome) {
        const len = String(palindrome.sat).length;
        if (len <= 5) return { level: 'mythic', label: 'Mythic', color: '#ff00ff' };
        if (len <= 7) return { level: 'legendary', label: 'Legendary', color: '#ffaa00' };
        if (len <= 9) return { level: 'epic', label: 'Epic', color: '#aa00ff' };
        if (len <= 11) return { level: 'rare', label: 'Rare', color: '#0088ff' };
        if (len <= 13) return { level: 'uncommon', label: 'Uncommon', color: '#00cc44' };
        return { level: 'common', label: 'Common', color: '#888888' };
    }
}

// Globale Instanz
const palindromScanner = new PalindromScanner();
