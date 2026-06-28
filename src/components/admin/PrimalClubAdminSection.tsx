import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Self-contained admin section for the Primal Club collection.
 * - Download hashlist / mintlist (final mint list with metadata)
 * - Manage the free-mint whitelist (add / set count / remove / import / download)
 *
 * Kept isolated in its own component so it doesn't touch the rest of AdminPanel.
 */

const PRIMARY_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || '';
const FALLBACK_API_URL = 'https://bitcoin-ordinals-backend-production.up.railway.app';

interface WhitelistEntry {
  address: string;
  count: number;
}

export const PrimalClubAdminSection: React.FC<{ adminAddress: string }> = ({ adminAddress }) => {
  const [apiBase, setApiBase] = useState<string>(PRIMARY_API_URL || FALLBACK_API_URL);
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newCount, setNewCount] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalFreeMints = entries.reduce((sum, e) => sum + Math.max(1, Number(e.count || 1)), 0);

  const loadWhitelist = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    const tryBases = PRIMARY_API_URL ? [PRIMARY_API_URL, FALLBACK_API_URL] : [FALLBACK_API_URL];
    for (const base of tryBases) {
      try {
        const res = await fetch(`${base}/api/primal-club/whitelist-addresses`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.entries)) {
            setEntries(data.entries);
            setApiBase(base);
            setLoading(false);
            return;
          }
        }
      } catch { /* try next */ }
    }
    setLoading(false);
    setStatus('⚠️ Could not load whitelist');
  }, []);

  useEffect(() => {
    loadWhitelist();
  }, [loadWhitelist]);

  const addAddress = async () => {
    const addr = newAddress.trim();
    if (!addr) return;
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/primal-club/whitelist-addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, count: Math.max(1, newCount), setExact: true }),
      });
      if (res.ok) {
        setNewAddress('');
        setNewCount(1);
        setStatus(`✅ Added ${addr.slice(0, 10)}…`);
        await loadWhitelist();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus(`❌ ${err.error || 'Add failed'}`);
      }
    } catch {
      setStatus('❌ Add failed');
    }
  };

  const setCount = async (address: string, count: number) => {
    if (count < 1) return removeAddress(address);
    try {
      await fetch(`${apiBase}/api/primal-club/whitelist-addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, count, setExact: true }),
      });
      await loadWhitelist();
    } catch {
      setStatus('❌ Update failed');
    }
  };

  const removeAddress = async (address: string) => {
    try {
      await fetch(`${apiBase}/api/primal-club/whitelist-addresses`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      await loadWhitelist();
      setStatus(`🗑️ Removed ${address.slice(0, 10)}…`);
    } catch {
      setStatus('❌ Remove failed');
    }
  };

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadHashlist = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/primal-club/hashlist`);
      if (res.ok) {
        const data = await res.json();
        downloadJson(data, 'primal-club-hashlist.json');
        setStatus(`✅ Hashlist downloaded (${Array.isArray(data) ? data.length : 0} items)`);
      } else {
        setStatus('❌ Hashlist download failed');
      }
    } catch {
      setStatus('❌ Hashlist download failed');
    }
  };

  const downloadMintlist = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/primal-club/logs?adminAddress=${encodeURIComponent(adminAddress)}&sync=1`);
      if (res.ok) {
        const data = await res.json();
        downloadJson(data, 'primal-club-mintlist.json');
        setStatus(`✅ Mintlist downloaded (${(data.logs || []).length} mints)`);
      } else {
        setStatus('❌ Mintlist download failed (admin only)');
      }
    } catch {
      setStatus('❌ Mintlist download failed');
    }
  };

  const downloadWhitelist = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/primal-club/whitelist-addresses/download?adminAddress=${encodeURIComponent(adminAddress)}`);
      if (res.ok) {
        const data = await res.json();
        downloadJson(data, 'primal-club-whitelist.json');
        setStatus('✅ Whitelist downloaded');
      } else {
        setStatus('❌ Whitelist download failed (admin only)');
      }
    } catch {
      setStatus('❌ Whitelist download failed');
    }
  };

  const syncHashlist = async () => {
    setStatus('⏳ Syncing hashlist from logs…');
    try {
      const res = await fetch(`${apiBase}/api/primal-club/hashlist/sync`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(`✅ Hashlist synced (added ${data.added ?? 0}, cleaned ${data.cleanedPending ?? 0})`);
      } else {
        setStatus(`❌ Sync failed: ${data.error || ''}`);
      }
    } catch {
      setStatus('❌ Sync failed');
    }
  };

  const parseAddresses = (text: string): string[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((x) => (typeof x === 'string' ? x : x?.address)).filter(Boolean);
      if (Array.isArray(parsed?.addresses)) return parsed.addresses.filter(Boolean);
      if (Array.isArray(parsed?.entries)) return parsed.entries.map((e: any) => e.address).filter(Boolean);
    } catch { /* not JSON, treat as line-separated */ }
    return trimmed.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
  };

  const runImport = async (addresses: string[]) => {
    if (addresses.length === 0) {
      setStatus('⚠️ No addresses found to import');
      return;
    }
    setStatus(`⏳ Importing ${addresses.length} addresses…`);
    try {
      const res = await fetch(`${apiBase}/api/primal-club/whitelist-addresses/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, addresses }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(`✅ Imported: ${data.added} added, ${data.skipped} skipped (total ${data.total})`);
        setImportText('');
        await loadWhitelist();
      } else {
        setStatus(`❌ Import failed: ${data.error || ''}`);
      }
    } catch {
      setStatus('❌ Import failed');
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await runImport(parseAddresses(text));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mt-6 bg-gray-900 border-2 border-amber-600/60 rounded-lg p-4">
      <h3 className="text-lg font-bold text-amber-400 mb-1 flex items-center gap-2">
        🐒 Primal Club
      </h3>
      <p className="text-xs text-gray-400 mb-4">Hashlist / Mintlist & Free-Mint Whitelist</p>

      {/* Downloads */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={downloadHashlist} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-black rounded text-sm font-semibold">
          📥 Hashlist
        </button>
        <button onClick={downloadMintlist} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-black rounded text-sm font-semibold">
          📥 Mintlist
        </button>
        <button onClick={downloadWhitelist} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold">
          📥 Whitelist
        </button>
        <button onClick={syncHashlist} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold">
          🔄 Sync Hashlist
        </button>
      </div>

      {/* Whitelist management */}
      <div className="border-t border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-white">Free-Mint Whitelist</h4>
          <span className="text-xs text-amber-400">{entries.length} addresses · {totalFreeMints} free mints</span>
        </div>

        {/* Add */}
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="bc1p… / bc1q… address"
            className="flex-1 min-w-[200px] px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-sm font-mono"
          />
          <input
            type="number"
            min={1}
            value={newCount}
            onChange={(e) => setNewCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-20 px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-sm"
            title="Number of free mints"
          />
          <button onClick={addAddress} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold">
            + Add
          </button>
        </div>

        {/* Import */}
        <div className="mb-3">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste addresses (one per line, comma-separated, or JSON array) to bulk-import…"
            rows={2}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-xs font-mono"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => runImport(parseAddresses(importText))}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
            >
              Import from text
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-semibold"
            >
              Import from file (.txt/.json)
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.json" onChange={handleFile} className="hidden" />
          </div>
        </div>

        {status && <p className="text-xs text-amber-300 mb-2">{status}</p>}

        {/* List */}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-gray-500">No whitelisted addresses yet.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.address} className="flex items-center gap-2 bg-gray-800/60 rounded px-2 py-1.5">
                <span className="flex-1 text-xs font-mono text-gray-300 truncate" title={entry.address}>{entry.address}</span>
                <button onClick={() => setCount(entry.address, entry.count - 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm leading-none">−</button>
                <span className="w-8 text-center text-xs text-amber-400 font-bold">{entry.count}</span>
                <button onClick={() => setCount(entry.address, entry.count + 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm leading-none">+</button>
                <button onClick={() => removeAddress(entry.address)} className="ml-1 w-6 h-6 bg-red-700 hover:bg-red-600 text-white rounded text-xs leading-none" title="Remove">✕</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
