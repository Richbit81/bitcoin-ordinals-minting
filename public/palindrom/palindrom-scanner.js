// Palindrom Scanner - Findet Palindrom Rare SATs in einem Wallet
// Primary: server-seitiger Scan (schnell, parallel, gecached)
// Fallback: client-seitiger Scan direkt via ordinals.com (Browser nicht blockiert)

const PALINDROM_API_BASE = window.PALINDROM_API_URL || '';
const PALINDROM_API_FALLBACK = 'https://bitcoin-ordinals-backend-production.up.railway.app';
const ORDINALS_DIRECT_URL = 'https://ordinals.com';
const MEMPOOL_API = 'https://mempool.space/api';
const CLIENT_SCAN_CONCURRENCY = 6;

class PalindromScanner {
    constructor() {
        this.isScanning = false;
        this.scanProgress = { current: 0, total: 0, status: '' };
        this.onProgress = null;
        this.activeApiBase = PALINDROM_API_BASE;
    }

    async _fetchWithFallback(path) {
        const primaryUrl = `${PALINDROM_API_BASE}${path}`;
        const fallbackUrl = `${PALINDROM_API_FALLBACK}${path}`;
        try {
            const primaryRes = await fetch(primaryUrl);
            if (primaryRes.ok) { this.activeApiBase = PALINDROM_API_BASE; return primaryRes; }
            if ([404, 405, 501, 502, 503, 504].includes(primaryRes.status)) {
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) { this.activeApiBase = PALINDROM_API_FALLBACK; return fallbackRes; }
                return fallbackRes;
            }
            return primaryRes;
        } catch (primaryError) {
            try {
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) { this.activeApiBase = PALINDROM_API_FALLBACK; return fallbackRes; }
            } catch (e) { /* both failed */ }
            throw primaryError;
        }
    }

    // ========================================
    // Main scan: server-first, client-fallback
    // ========================================

    async scanWalletForPalindromes(address) {
        if (this.isScanning) throw new Error('Scan already in progress');
        this.isScanning = true;
        this.scanProgress = { current: 0, total: 1, status: 'Scanning wallet for Palindrom SATs...' };
        this._updateProgress();

        try {
            // 1) Try server-side scan
            const palindromes = await this._serverScan(address);
            if (palindromes && palindromes.length > 0) return palindromes;

            // 2) Server returned 0 — check if ordinals was reachable
            console.log('[Scanner] Server found 0 palindromes, trying client-side scan...');
            this.scanProgress.status = 'Server-Scan fand nichts, starte Browser-Scan...';
            this._updateProgress();

            return await this._clientScan(address);
        } catch (error) {
            // 3) Server failed entirely — try client-side
            console.warn('[Scanner] Server scan failed, falling back to client-side:', error.message);
            this.scanProgress.status = 'Server nicht erreichbar, starte Browser-Scan...';
            this._updateProgress();
            try {
                return await this._clientScan(address);
            } catch (clientError) {
                this.scanProgress.status = `Error: ${clientError.message}`;
                this._updateProgress();
                throw clientError;
            }
        } finally {
            this.isScanning = false;
        }
    }

    // ========================================
    // Server-side scan (fast path)
    // ========================================

    async _serverScan(address) {
        const response = await this._fetchWithFallback(`/api/palindrom/scan-palindromes/${address}`);
        if (!response.ok) {
            let errMsg = `Server error (${response.status})`;
            try { const err = await response.json(); errMsg = err.error || errMsg; } catch (e) {}
            throw new Error(errMsg);
        }
        const data = await response.json();
        this.scanProgress = {
            current: 1, total: 1,
            status: `✓ ${data.palindromes.length} palindromes found! (${data.stats.utxos} UTXOs, ${data.stats.timeSeconds}s)`
        };
        this._updateProgress();
        console.log(`[Scanner] Server: ${data.palindromes.length} Palindrome in ${data.stats.timeSeconds}s via ${this.activeApiBase}`);
        return data.palindromes;
    }

    // ========================================
    // Client-side scan (fallback — browser fetches ordinals.com directly)
    // ========================================

    async _clientScan(address) {
        const startTime = Date.now();

        // Step 1: Get UTXOs from server (handles >500 UTXO wallets)
        this.scanProgress.status = 'Lade UTXOs vom Server...';
        this._updateProgress();
        let utxos;
        try {
            const utxoRes = await this._fetchWithFallback(`/api/palindrom/utxos/${address}`);
            if (utxoRes.ok) {
                const data = await utxoRes.json();
                utxos = data.utxos;
            }
        } catch (e) { /* fall through to mempool.space */ }
        if (!utxos || utxos.length === 0) {
            const utxoRes = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
            if (utxoRes.ok) utxos = await utxoRes.json();
        }
        if (!utxos || utxos.length === 0) throw new Error('Konnte UTXOs nicht laden');
        console.log(`[Scanner] Client: ${utxos.length} UTXOs loaded`);

        // Step 2: Fetch sat ranges from ordinals.com (browser is not blocked!)
        const allPalindromes = [];
        let completed = 0;
        const total = utxos.length;

        const processUtxo = async (utxo) => {
            const key = `${utxo.txid}:${utxo.vout}`;
            try {
                const ranges = await this._fetchSatRangesFromHtml(key);
                for (const [start, end] of ranges) {
                    const found = this._findPalindromesInRange(start, end);
                    for (const pal of found) {
                        allPalindromes.push({
                            ...pal,
                            utxo: key,
                            utxoValue: utxo.value,
                            confirmed: utxo.status?.confirmed ?? true
                        });
                    }
                }
            } catch (e) { /* skip this UTXO */ }
            completed++;
            if (completed % 5 === 0 || completed === total) {
                this.scanProgress = {
                    current: completed, total,
                    status: `Browser-Scan: ${completed}/${total} UTXOs... (${allPalindromes.length} gefunden)`
                };
                this._updateProgress();
            }
        };

        // Concurrency-limited parallel processing
        const queue = [...utxos];
        const workers = [];
        for (let i = 0; i < CLIENT_SCAN_CONCURRENCY; i++) {
            workers.push((async () => {
                while (queue.length > 0) {
                    const utxo = queue.shift();
                    if (utxo) await processUtxo(utxo);
                }
            })());
        }
        await Promise.all(workers);

        allPalindromes.sort((a, b) => {
            if (a.digits !== b.digits) return a.digits - b.digits;
            return a.sat - b.sat;
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.scanProgress = {
            current: total, total,
            status: `✓ ${allPalindromes.length} palindromes found! (${total} UTXOs, ${elapsed}s, browser-scan)`
        };
        this._updateProgress();
        console.log(`[Scanner] Client: ${allPalindromes.length} Palindrome in ${elapsed}s (${total} UTXOs)`);
        return allPalindromes;
    }

    async _fetchSatRangesFromHtml(utxoKey) {
        const res = await fetch(`${ORDINALS_DIRECT_URL}/output/${utxoKey}`);
        if (!res.ok) return [];
        const html = await res.text();
        const ranges = [];
        const re = /href=\/sat\/(\d+)[^>]*>[^<]*<\/a>\s*[-\u2013]\s*<a[^>]*href=\/sat\/(\d+)/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            ranges.push([Number(m[1]), Number(m[2])]);
        }
        return ranges;
    }

    _isPalindrome(n) {
        const s = String(n);
        if (s.length < 3) return false;
        const len = s.length;
        for (let i = 0; i < len >> 1; i++) {
            if (s[i] !== s[len - 1 - i]) return false;
        }
        return true;
    }

    _findPalindromesInRange(start, end) {
        const results = [];
        for (let sat = start; sat < end; sat++) {
            if (this._isPalindrome(sat)) {
                const s = String(sat);
                results.push({ sat, sequence: s, digits: s.length, coreSequence: s.substring(0, Math.ceil(s.length / 2)) });
            }
        }
        return results;
    }

    // ========================================
    // API Status Check
    // ========================================

    async checkApiStatus() {
        try {
            const response = await this._fetchWithFallback('/api/palindrom/status');
            const data = await response.json();
            data.apiBase = this.activeApiBase;
            return data;
        } catch (error) {
            return { mempool: 'offline', ordinals: 'offline', error: error.message, apiBase: null };
        }
    }

    // ========================================
    // Progress-Update
    // ========================================

    _updateProgress() {
        if (this.onProgress) this.onProgress({ ...this.scanProgress });
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
