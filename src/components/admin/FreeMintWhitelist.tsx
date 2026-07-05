import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reusable free-mint whitelist manager for the on-demand collections
 * (High Rollers, Spikes). Mirrors the Primal Club whitelist UX but talks to a
 * per-collection backend (basePath, e.g. "/api/high-rollers" or "/api/spikes").
 *
 * A whitelisted address gets the collection margin (priceSats) waived for up to
 * `count` mints — the buyer still pays postage + network fees. All mutating
 * calls carry `adminAddress` (backend enforces admin via requireAdmin).
 */

interface WhitelistEntry {
  address: string;
  count: number;
}

interface Props {
  apiBase: string;
  basePath: string; // e.g. '/api/high-rollers'
  adminAddress: string;
  accent?: 'yellow' | 'cyan';
  fileName?: string; // download filename, e.g. 'high-rollers-whitelist.json'
}

const ACCENTS: Record<string, { text: string; add: string }> = {
  yellow: { text: 'text-yellow-400', add: 'bg-green-600 hover:bg-green-700' },
  cyan: { text: 'text-cyan-400', add: 'bg-green-600 hover:bg-green-700' },
};

export const FreeMintWhitelist: React.FC<Props> = ({ apiBase, basePath, adminAddress, accent = 'yellow', fileName }) => {
  const acc = ACCENTS[accent] || ACCENTS.yellow;
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
    try {
      const res = await fetch(`${apiBase}${basePath}/whitelist-addresses`);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data.entries) ? data.entries : []);
      } else {
        setStatus('⚠️ Could not load whitelist');
      }
    } catch {
      setStatus('⚠️ Could not load whitelist');
    }
    setLoading(false);
  }, [apiBase, basePath]);

  useEffect(() => { loadWhitelist(); }, [loadWhitelist]);

  const post = (body: unknown) =>
    fetch(`${apiBase}${basePath}/whitelist-addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminAddress, ...(body as object) }),
    });

  const addAddress = async () => {
    const addr = newAddress.trim();
    if (!addr) return;
    setStatus(null);
    try {
      const res = await post({ address: addr, count: Math.max(1, newCount), setExact: true });
      if (res.ok) {
        setNewAddress('');
        setNewCount(1);
        setStatus(`✅ Added ${addr.slice(0, 10)}…`);
        await loadWhitelist();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus(`❌ ${err.error || 'Add failed'}`);
      }
    } catch { setStatus('❌ Add failed'); }
  };

  const setCount = async (address: string, count: number) => {
    if (count < 1) return removeAddress(address);
    try {
      await post({ address, count, setExact: true });
      await loadWhitelist();
    } catch { setStatus('❌ Update failed'); }
  };

  const removeAddress = async (address: string) => {
    try {
      await fetch(`${apiBase}${basePath}/whitelist-addresses`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, address }),
      });
      await loadWhitelist();
      setStatus(`🗑️ Removed ${address.slice(0, 10)}…`);
    } catch { setStatus('❌ Remove failed'); }
  };

  const downloadWhitelist = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}${basePath}/whitelist-addresses/download?adminAddress=${encodeURIComponent(adminAddress)}`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'whitelist.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('✅ Whitelist downloaded');
      } else setStatus('❌ Whitelist download failed (admin only)');
    } catch { setStatus('❌ Whitelist download failed'); }
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
    if (addresses.length === 0) { setStatus('⚠️ No addresses found to import'); return; }
    setStatus(`⏳ Importing ${addresses.length} addresses…`);
    try {
      const res = await fetch(`${apiBase}${basePath}/whitelist-addresses/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, addresses }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(`✅ Imported: ${data.added} added, ${data.skipped} skipped (total ${data.total})`);
        setImportText('');
        await loadWhitelist();
      } else setStatus(`❌ Import failed: ${data.error || ''}`);
    } catch { setStatus('❌ Import failed'); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runImport(parseAddresses(await file.text()));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border-t border-gray-700 pt-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-white">Free-Mint Whitelist</h4>
        <span className={`text-xs ${acc.text}`}>{entries.length} addresses · {totalFreeMints} free mints</span>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">Whitelisted addresses mint free of the collection margin — buyer still pays the network / inscription fee.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="bc1p… taproot address"
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
        <button onClick={addAddress} className={`px-4 py-2 ${acc.add} text-white rounded text-sm font-semibold`}>+ Add</button>
        <button onClick={downloadWhitelist} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold">📥 Whitelist</button>
      </div>

      <div className="mb-3">
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste addresses (one per line, comma-separated, or JSON array) to bulk-import…"
          rows={2}
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-xs font-mono"
        />
        <div className="flex gap-2 mt-2">
          <button onClick={() => runImport(parseAddresses(importText))} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold">Import from text</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-semibold">Import from file (.txt/.json)</button>
          <input ref={fileInputRef} type="file" accept=".txt,.json" onChange={handleFile} className="hidden" />
        </div>
      </div>

      {status && <p className={`text-xs mb-2 ${acc.text}`}>{status}</p>}

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
              <span className={`w-8 text-center text-xs font-bold ${acc.text}`}>{entry.count}</span>
              <button onClick={() => setCount(entry.address, entry.count + 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm leading-none">+</button>
              <button onClick={() => removeAddress(entry.address)} className="ml-1 w-6 h-6 bg-red-700 hover:bg-red-600 text-white rounded text-xs leading-none" title="Remove">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
