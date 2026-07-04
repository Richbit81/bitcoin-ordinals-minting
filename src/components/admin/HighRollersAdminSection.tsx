import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Self-contained admin section for the High Rollers collection.
 * - Import the hashlist (225 items) into the backend DB (non-destructive)
 * - Download hashlist (with final inscription ids) / orders (mintlist)
 * - Sync into the marketplace (incl. live owners)
 *
 * Kept isolated so it never touches the rest of AdminPanel.
 */

const PRIMARY_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || '';
const FALLBACK_API_URL = 'https://bitcoin-ordinals-backend-production.up.railway.app';

export const HighRollersAdminSection: React.FC<{ adminAddress: string }> = ({ adminAddress }) => {
  const apiBase = PRIMARY_API_URL || FALLBACK_API_URL;
  const [status, setStatus] = useState<string | null>(null);
  const [supply, setSupply] = useState<{ active: boolean; total: number; minted: number; available: number } | null>(null);
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSupply = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/high-rollers/status`);
      if (res.ok) setSupply(await res.json());
    } catch { /* ignore */ }
  }, [apiBase]);

  useEffect(() => { loadSupply(); }, [loadSupply]);

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
      const res = await fetch(`${apiBase}/api/high-rollers/admin/hashlist?adminAddress=${encodeURIComponent(adminAddress)}`);
      if (res.ok) {
        const data = await res.json();
        downloadJson(data, 'high-rollers-hashlist.json');
        setStatus(`✅ Hashlist downloaded (${data.total ?? 0} items)`);
      } else setStatus('❌ Hashlist download failed (admin only)');
    } catch { setStatus('❌ Hashlist download failed'); }
  };

  const downloadOrders = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/high-rollers/admin/orders?adminAddress=${encodeURIComponent(adminAddress)}`);
      if (res.ok) {
        const data = await res.json();
        downloadJson(data, 'high-rollers-orders.json');
        setStatus(`✅ Orders downloaded (${data.total ?? 0})`);
      } else setStatus('❌ Orders download failed (admin only)');
    } catch { setStatus('❌ Orders download failed'); }
  };

  const syncMarketplace = async () => {
    setStatus('⏳ Syncing High Rollers into marketplace (incl. live owners)…');
    try {
      const res = await fetch(`${apiBase}/api/high-rollers/admin/sync-marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, refreshOwners: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(`✅ Marketplace synced (${data.upserted ?? 0} / ${data.total ?? 0} items)`);
      else setStatus(`❌ Marketplace sync failed: ${data.error || ''}`);
    } catch { setStatus('❌ Marketplace sync failed'); }
  };

  const runImport = async (raw: string) => {
    let items: unknown;
    try {
      const parsed = JSON.parse(raw.trim());
      items = Array.isArray(parsed) ? parsed : (parsed?.items ?? parsed?.generated);
    } catch {
      setStatus('❌ Import failed: not valid JSON');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setStatus('❌ Import failed: expected a JSON array of items');
      return;
    }
    setStatus(`⏳ Importing ${items.length} items…`);
    try {
      const res = await fetch(`${apiBase}/api/high-rollers/admin/import-hashlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(`✅ Imported / updated ${data.processed ?? 0} items`);
        setImportText('');
        await loadSupply();
      } else setStatus(`❌ Import failed: ${data.error || ''}`);
    } catch { setStatus('❌ Import failed'); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runImport(await file.text());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mt-6 bg-gray-900 border-2 border-yellow-500/60 rounded-lg p-4">
      <h3 className="text-lg font-bold text-yellow-400 mb-1 flex items-center gap-2">🎰 High Rollers</h3>
      <p className="text-xs text-gray-400 mb-3">
        Hashlist import · Mintlist download · Marketplace sync
        {supply && <span className="ml-2 text-yellow-300">· {supply.minted}/{supply.total} minted · {supply.active ? 'LIVE' : 'dormant'}</span>}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={downloadHashlist} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-black rounded text-sm font-semibold">📥 Hashlist</button>
        <button onClick={downloadOrders} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-black rounded text-sm font-semibold">📥 Orders / Mintlist</button>
        <button onClick={syncMarketplace} className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded text-sm font-semibold">🛒 Sync Marketplace</button>
        <button onClick={loadSupply} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold">🔄 Refresh</button>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <h4 className="text-sm font-bold text-white mb-2">Import hashlist</h4>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='Paste the hashlist JSON array: [{ "id": "0001", "meta": { "name": "...", "attributes": [...] } }, …]'
          rows={3}
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-xs font-mono"
        />
        <div className="flex gap-2 mt-2">
          <button onClick={() => runImport(importText)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold">Import from text</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-semibold">Import from file (.json)</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Import is non-destructive: already-minted items keep their status; only empty name/attributes are filled.</p>
      </div>

      {status && <p className="text-xs text-yellow-300 mt-3">{status}</p>}
    </div>
  );
};
