// Palindrom Scanner - Finds Palindrome Rare SATs in a wallet
// Primary: server-side scan (fast, parallel, cached)
// Fallback: client-side scan via ordinals.com (non-blocking)

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
            this.scanProgress.status = 'Server found nothing, starting browser scan...';
            this._updateProgress();

            return await this._clientScan(address);
        } catch (error) {
            // 3) Server failed entirely — try client-side
            console.warn('[Scanner] Server scan failed, falling back to client-side:', error.message);
            this.scanProgress.status = 'Server unreachable, starting browser scan...';
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

        this.scanProgress.status = 'Loading UTXOs...';
        this._updateProgress();
        const utxos = await this._fetchAllUtxos(address);
        if (utxos.length === 0) throw new Error('Could not load UTXOs');
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
                    status: `Browser scan: ${completed}/${total} UTXOs... (${allPalindromes.length} found)`
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

    async _fetchAllUtxos(address) {
        const sources = [];
        let directApiFailed = false;

        // Source 1: Our backend
        try {
            this.scanProgress.status = 'Loading UTXOs from server...';
            this._updateProgress();
            const res = await this._fetchWithFallback(`/api/palindrom/utxos/${address}`);
            if (res.ok) {
                const data = await res.json();
                if (data.utxos && data.utxos.length > 0) {
                    sources.push({ name: 'server', utxos: data.utxos });
                    console.log(`[Scanner] Server: ${data.utxos.length} UTXOs`);
                }
            }
        } catch (e) { console.log('[Scanner] Server UTXOs unavailable'); }

        // Source 2: mempool.space UTXO endpoint
        try {
            this.scanProgress.status = 'Loading UTXOs from mempool.space...';
            this._updateProgress();
            const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    sources.push({ name: 'mempool.space', utxos: data });
                    console.log(`[Scanner] mempool.space: ${data.length} UTXOs`);
                }
            } else if (res.status === 400) {
                directApiFailed = true;
                console.log('[Scanner] mempool.space UTXO endpoint returned 400 (address too large)');
            }
        } catch (e) { console.log('[Scanner] mempool.space unavailable'); }

        // Source 3: blockstream.info UTXO endpoint
        try {
            this.scanProgress.status = 'Loading UTXOs from blockstream.info...';
            this._updateProgress();
            const res = await fetch(`https://blockstream.info/api/address/${address}/utxo`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    sources.push({ name: 'blockstream.info', utxos: data });
                    console.log(`[Scanner] blockstream.info: ${data.length} UTXOs`);
                }
            } else if (res.status === 400) {
                directApiFailed = true;
            }
        } catch (e) { console.log('[Scanner] blockstream.info unavailable'); }

        // Source 4: If direct UTXO endpoints failed (400 = too many UTXOs),
        // reconstruct UTXO set from paginated transactions
        if (directApiFailed && sources.length <= 1) {
            try {
                const txUtxos = await this._buildUtxosFromTransactions(address);
                if (txUtxos.length > 0) {
                    sources.push({ name: 'tx-rebuild', utxos: txUtxos });
                    console.log(`[Scanner] tx-rebuild: ${txUtxos.length} UTXOs reconstructed from transactions`);
                }
            } catch (e) {
                console.log('[Scanner] Transaction-based UTXO rebuild failed:', e.message);
            }
        }

        if (sources.length === 0) return [];

        // Merge and deduplicate
        const seen = new Set();
        const merged = [];
        sources.sort((a, b) => b.utxos.length - a.utxos.length);
        for (const src of sources) {
            for (const utxo of src.utxos) {
                const key = `${utxo.txid}:${utxo.vout}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(utxo);
                }
            }
        }

        const srcNames = sources.map(s => `${s.name}(${s.utxos.length})`).join(', ');
        console.log(`[Scanner] Merged UTXOs: ${merged.length} from ${sources.length} sources [${srcNames}]`);
        this.scanProgress.status = `${merged.length} UTXOs loaded (${sources.length} sources)`;
        this._updateProgress();

        return merged;
    }

    async _buildUtxosFromTransactions(address) {
        this.scanProgress.status = 'Address too large for UTXO API — rebuilding from transactions...';
        this._updateProgress();

        const TX_APIS = [
            { name: 'mempool.space', base: MEMPOOL_API },
            { name: 'blockstream.info', base: 'https://blockstream.info/api' }
        ];

        let allTxs = [];
        let usedApi = null;

        for (const api of TX_APIS) {
            allTxs = [];
            let lastTxid = null;
            let page = 0;
            let consecutiveErrors = 0;
            usedApi = api.name;

            while (true) {
                const url = lastTxid
                    ? `${api.base}/address/${address}/txs/chain/${lastTxid}`
                    : `${api.base}/address/${address}/txs`;

                let success = false;
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const res = await fetch(url);
                        if (res.status === 429) {
                            console.log(`[Scanner] ${api.name} rate-limited, waiting...`);
                            await new Promise(r => setTimeout(r, 2000 + attempt * 2000));
                            continue;
                        }
                        if (!res.ok) { break; }
                        const txs = await res.json();
                        if (!txs || txs.length === 0) { success = true; break; }
                        allTxs.push(...txs);
                        lastTxid = txs[txs.length - 1].txid;
                        page++;
                        consecutiveErrors = 0;
                        success = true;
                        this.scanProgress.status = `Loading transactions via ${api.name}... (${allTxs.length} txs, page ${page})`;
                        this._updateProgress();
                        if (txs.length < 25) break;
                        break;
                    } catch (e) {
                        console.log(`[Scanner] ${api.name} TX page ${page} attempt ${attempt + 1} failed:`, e.message);
                        await new Promise(r => setTimeout(r, 1000 + attempt * 1500));
                    }
                }

                if (!success) {
                    consecutiveErrors++;
                    if (consecutiveErrors >= 3) {
                        console.log(`[Scanner] ${api.name} failed after ${consecutiveErrors} consecutive errors at page ${page}`);
                        break;
                    }
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }

                const lastBatch = allTxs.length > 0 ? allTxs.length - (allTxs.length > 25 ? 25 : allTxs.length) : 0;
                if (allTxs.length === lastBatch || (allTxs.length > lastBatch && allTxs.length - lastBatch < 25)) {
                    break;
                }

                const delay = page % 10 === 0 ? 600 : 300;
                await new Promise(r => setTimeout(r, delay));
            }

            if (allTxs.length > 100) {
                console.log(`[Scanner] ${api.name}: loaded ${allTxs.length} transactions successfully`);
                break;
            } else {
                console.log(`[Scanner] ${api.name}: only ${allTxs.length} txs, trying next API...`);
            }
        }

        if (allTxs.length === 0) return [];
        console.log(`[Scanner] Loaded ${allTxs.length} transactions via ${usedApi} for UTXO reconstruction`);

        this.scanProgress.status = `Reconstructing UTXOs from ${allTxs.length} transactions...`;
        this._updateProgress();

        const spent = new Set();
        for (const tx of allTxs) {
            if (!tx.vin) continue;
            for (const inp of tx.vin) {
                if (inp.prevout && inp.prevout.scriptpubkey_address === address) {
                    spent.add(`${inp.txid}:${inp.vout}`);
                }
            }
        }

        const utxos = [];
        const seen = new Set();
        for (const tx of allTxs) {
            if (!tx.vout) continue;
            for (let i = 0; i < tx.vout.length; i++) {
                const out = tx.vout[i];
                if (out.scriptpubkey_address !== address) continue;
                const key = `${tx.txid}:${i}`;
                if (spent.has(key) || seen.has(key)) continue;
                seen.add(key);
                utxos.push({
                    txid: tx.txid,
                    vout: i,
                    value: out.value,
                    status: { confirmed: !!tx.status?.confirmed }
                });
            }
        }

        this.scanProgress.status = `Rebuilt ${utxos.length} UTXOs from ${allTxs.length} txs (${usedApi})`;
        this._updateProgress();
        console.log(`[Scanner] UTXO rebuild: ${utxos.length} unspent from ${allTxs.length} txs, ${spent.size} spent outputs tracked`);
        return utxos;
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
    // Utility functions
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

// Global instance
const palindromScanner = new PalindromScanner();
