import React, { useCallback, useEffect, useState } from 'react';

/**
 * Self-contained admin section for the Pink Puppets SLOT ROUND 2 prize engine.
 * - Live pool status (whitelist spots left, grand prize, global spins)
 * - Download whitelist winners (with Taproot receive addresses)
 * - Download spin log
 *
 * Isolated in its own component so it never touches the rest of AdminPanel.
 */

const PRIMARY_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || '';
const FALLBACK_API_URL = 'https://bitcoin-ordinals-backend-production.up.railway.app';

type Pool = {
  titans: { awarded: number; total: number; remaining: number };
  lilcats: { awarded: number; total: number; remaining: number };
  mainPrize: { awarded: boolean; gateSpins: number };
  globalSpins: number;
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const PinkSlot2AdminSection: React.FC<{ adminAddress: string }> = ({ adminAddress }) => {
  const [apiBase, setApiBase] = useState<string>(PRIMARY_API_URL || FALLBACK_API_URL);
  const [pool, setPool] = useState<Pool | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPool = useCallback(async () => {
    const bases = PRIMARY_API_URL ? [PRIMARY_API_URL, FALLBACK_API_URL] : [FALLBACK_API_URL];
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

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const download = async (kind: 'winners' | 'spins') => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/pinkpuppets/slot2/admin/${kind}?adminAddress=${encodeURIComponent(adminAddress)}`, {
        headers: { 'x-admin-address': adminAddress },
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

  return (
    <div className="mt-6 rounded-xl border border-pink-400/30 bg-black/30 p-4">
      <h3 className="text-sm font-bold text-pink-200">🎰 Pink Puppets — Slot Round 2</h3>
      <p className="mt-1 text-[11px] text-pink-300/60">Adaptive prize engine · whitelist winners with Taproot addresses & spin log.</p>

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
        <button type="button" disabled={busy} onClick={() => void loadPool()} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-pink-100/80 disabled:opacity-50">
          ↻ Refresh
        </button>
      </div>

      {status && <p className="mt-2 text-[11px] text-pink-200/80">{status}</p>}
    </div>
  );
};
