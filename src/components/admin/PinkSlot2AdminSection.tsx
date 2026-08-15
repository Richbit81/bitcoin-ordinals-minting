import React, { useCallback, useEffect, useState } from 'react';

/**
 * Self-contained admin section for the Pink Puppets SLOT ROUND 2 prize engine.
 * Isolated so it never touches the rest of AdminPanel.
 */

const PRIMARY_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || '';
const FALLBACK_API_URL = 'https://bitcoin-ordinals-backend-production.up.railway.app';

type Pool = {
  titans: { awarded: number; total: number; remaining: number };
  lilcats: { awarded: number; total: number; remaining: number };
  mainPrize: { awarded: boolean; gateSpins: number };
  globalSpins: number;
};

type SpinCode = {
  code: string;
  spins: number;
  maxRedemptions: number | null;
  note: string | null;
  createdAt: string;
  redeemed: number;
};

function adminApiBase(): string {
  if (import.meta.env.DEV) return '';
  return PRIMARY_API_URL || FALLBACK_API_URL;
}

function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
}

export const PinkSlot2AdminSection: React.FC<{ adminAddress: string }> = ({ adminAddress }) => {
  const [apiBase, setApiBase] = useState<string>(adminApiBase());
  const [pool, setPool] = useState<Pool | null>(null);
  const [codes, setCodes] = useState<SpinCode[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genNote, setGenNote] = useState('');

  const adminHeaders = useCallback(
    () => ({ 'x-admin-address': adminAddress, 'Content-Type': 'application/json' }),
    [adminAddress]
  );

  const loadPool = useCallback(async () => {
    const bases = import.meta.env.DEV
      ? ['']
      : PRIMARY_API_URL
        ? [PRIMARY_API_URL, FALLBACK_API_URL]
        : [FALLBACK_API_URL];
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/api/pinkpuppets/slot2/pool`, { cache: 'no-store' });
        if (res.ok) {
          setPool(await res.json());
          setApiBase(base);
          return;
        }
      } catch { /* try next */ }
    }
    setStatus('⚠️ Could not load slot2 pool');
  }, []);

  const loadCodes = useCallback(async (base = apiBase) => {
    try {
      const res = await fetch(`${base}/api/pinkpuppets/slot2/admin/codes?adminAddress=${encodeURIComponent(adminAddress)}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setCodes(Array.isArray(data.codes) ? data.codes : []);
    } catch { /* ignore */ }
  }, [adminAddress, adminHeaders, apiBase]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  const download = async (kind: 'winners' | 'spins') => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/pinkpuppets/slot2/admin/${kind}?adminAddress=${encodeURIComponent(adminAddress)}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(`❌ ${err.error || `Download ${kind} failed (${res.status})`}`);
        return;
      }
      const data = await res.json();
      downloadJson(`pink-slot2-${kind}-${new Date().toISOString().slice(0, 10)}.json`, data);
      setStatus(`✅ Downloaded ${kind}`);
    } catch (e: any) {
      setStatus(`❌ ${e?.message || 'Download failed'}`);
    } finally {
      setBusy(false);
    }
  };

  const generateCodes = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/pinkpuppets/slot2/admin/codes?adminAddress=${encodeURIComponent(adminAddress)}`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          count: genCount,
          spins: 3,
          maxRedemptions: null,
          note: genNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(`❌ ${data.message || data.error || 'Generate failed'}`);
        return;
      }
      const created: SpinCode[] = Array.isArray(data.codes) ? data.codes : [];
      setStatus(`✅ Generated ${created.length} codes (+3 spins, once per wallet)`);
      await loadCodes();
      if (created.length) {
        const lines = created.map((c) => c.code).join('\n');
        downloadText(`pink-slot2-codes-${new Date().toISOString().slice(0, 10)}.txt`, lines);
      }
    } catch (e: any) {
      setStatus(`❌ ${e?.message || 'Generate failed'}`);
    } finally {
      setBusy(false);
    }
  };

  const exportCodes = () => {
    if (!codes.length) {
      setStatus('⚠️ No codes to export');
      return;
    }
    const lines = ['code\tspins\tredeemed\max\tnote', ...codes.map((c) =>
      `${c.code}\t${c.spins}\t${c.redeemed}\t${c.maxRedemptions ?? '∞'}\t${c.note || ''}`
    )];
    downloadText(`pink-slot2-codes-${new Date().toISOString().slice(0, 10)}.txt`, lines.join('\n'));
    setStatus(`✅ Exported ${codes.length} codes`);
  };

  return (
    <div className="mt-6 rounded-xl border border-pink-400/30 bg-black/30 p-4">
      <h3 className="text-sm font-bold text-pink-200">🎰 Pink Puppets — Slot Round 2</h3>
      <p className="mt-1 text-[11px] text-pink-300/60">Adaptive prize engine · whitelist winners with Taproot addresses, inscription prizes &amp; spin log.</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
          <div className="text-pink-300/60">Titans WL</div>
          <div className="font-mono text-pink-100">{pool ? `${pool.titans.awarded}/${pool.titans.total}` : '—'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
          <div className="text-pink-300/60">Lil Cats WL</div>
          <div className="font-mono text-pink-100">{pool ? `${pool.lilcats.awarded}/${pool.lilcats.total}` : '—'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
          <div className="text-pink-300/60">Grand prize</div>
          <div className="font-mono text-pink-100">{pool ? (pool.mainPrize.awarded ? 'awarded' : `gate ${pool.mainPrize.gateSpins}`) : '—'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
          <div className="text-pink-300/60">Global spins</div>
          <div className="font-mono text-pink-100">{pool ? pool.globalSpins : '—'}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void download('winners')} className="rounded-lg border border-pink-400/50 bg-pink-900/40 px-3 py-2 text-xs font-bold text-pink-50 disabled:opacity-50">
          ⬇️ Winners (with Taproot)
        </button>
        <button type="button" disabled={busy} onClick={() => void download('spins')} className="rounded-lg border border-pink-400/50 bg-pink-900/40 px-3 py-2 text-xs font-bold text-pink-50 disabled:opacity-50">
          ⬇️ Spin log
        </button>
        <button type="button" disabled={busy} onClick={() => { void loadPool(); void loadCodes(); }} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-pink-100/80 disabled:opacity-50">
          ↻ Refresh
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3">
        <p className="text-xs font-bold text-pink-100">Bonus-spin codes</p>
        <p className="mt-1 text-[11px] text-pink-300/60">Each code adds +3 spins. Same wallet can redeem a code only once; other wallets can still use it.</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-pink-200/80">
            Count
            <input
              type="number"
              min={1}
              max={200}
              value={genCount}
              onChange={(e) => setGenCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="mt-1 block w-20 rounded border border-white/15 bg-black/60 px-2 py-1 font-mono text-xs text-white"
            />
          </label>
          <label className="min-w-[12rem] flex-1 text-[11px] text-pink-200/80">
            Note (optional)
            <input
              value={genNote}
              onChange={(e) => setGenNote(e.target.value)}
              placeholder="discord drop 16.08"
              className="mt-1 block w-full rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white"
            />
          </label>
          <button type="button" disabled={busy} onClick={() => void generateCodes()} className="rounded-lg border-2 border-black bg-pink-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50">
            Generate &amp; download
          </button>
          <button type="button" disabled={busy || !codes.length} onClick={exportCodes} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-pink-100/80 disabled:opacity-50">
            Export list
          </button>
        </div>
        {codes.length > 0 && (
          <div className="mt-3 max-h-48 overflow-auto rounded border border-white/10">
            <table className="w-full text-left text-[11px] text-pink-100">
              <thead className="sticky top-0 bg-black/80 text-pink-300/70">
                <tr>
                  <th className="px-2 py-1 font-normal">Code</th>
                  <th className="px-2 py-1 font-normal">Spins</th>
                  <th className="px-2 py-1 font-normal">Used</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code} className="border-t border-white/5 font-mono">
                    <td className="px-2 py-1">{c.code}</td>
                    <td className="px-2 py-1">{c.spins}</td>
                    <td className="px-2 py-1">{c.redeemed}/{c.maxRedemptions ?? '∞'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {status && <p className="mt-2 text-[11px] text-pink-200/80">{status}</p>}
    </div>
  );
};
