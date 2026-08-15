import React, { useCallback, useEffect, useState } from 'react';

type PrizeItem = {
  n: number;
  number: string;
  inscriptionId: string;
  imageUrl: string;
  contentUrl?: string;
  awarded: boolean;
};

type PoolPayload = {
  titans?: { awarded: number; total: number; remaining: number };
  lilcats?: { awarded: number; total: number; remaining: number };
  mainPrize?: { awarded: boolean };
  inscriptions?: { awarded: number; total: number; remaining: number };
  items?: PrizeItem[];
};

function slot2ApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) return p;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'www.richart.app' || h === 'richart.app' || h.endsWith('.richart.app')) return p;
  }
  return p;
}

function itemSrc(item: PrizeItem): string {
  if (item.imageUrl) return item.imageUrl;
  if (item.contentUrl) return item.contentUrl;
  if (item.inscriptionId) return `https://ordinals.com/content/${item.inscriptionId}`;
  return '';
}

function YellowX() {
  return (
    <svg viewBox="0 0 100 100" className="h-[88%] w-[88%] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" aria-hidden>
      <line x1="14" y1="14" x2="86" y2="86" stroke="#f5d000" strokeWidth="15" strokeLinecap="round" />
      <line x1="86" y1="14" x2="14" y2="86" stroke="#f5d000" strokeWidth="15" strokeLinecap="round" />
    </svg>
  );
}

function PrizeGrid({ items }: { items: PrizeItem[] }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
      {items.map((item) => {
        const src = itemSrc(item);
        return (
          <div
            key={item.n}
            className="relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black/50"
            title={item.awarded ? `#${item.number} · awarded` : `#${item.number}`}
          >
            {src ? (
              <img
                src={src}
                alt={`#${item.number}`}
                className={`h-full w-full object-cover ${item.awarded ? 'opacity-45 grayscale-[0.35]' : ''}`}
                loading="lazy"
                onError={(e) => {
                  const el = e.currentTarget;
                  const id = item.inscriptionId;
                  if (!id) return;
                  if (item.imageUrl && el.src.includes(item.imageUrl) && item.contentUrl) {
                    el.src = item.contentUrl;
                    return;
                  }
                  if (!el.src.includes('ordinals.com/content/')) {
                    el.src = `https://ordinals.com/content/${id}`;
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#1a0b18] font-mono text-[9px] text-pink-200/70">
                #{item.number}
              </div>
            )}
            {item.awarded && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <YellowX />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const PinkSlot2PrizePreview: React.FC = () => {
  const [pool, setPool] = useState<PoolPayload | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    let data: PoolPayload = {};
    try {
      const r = await fetch(slot2ApiUrl('/api/pinkpuppets/slot2/pool'), { cache: 'no-store' });
      if (r.ok) data = await r.json();
    } catch {
      /* pool endpoint optional — catalog still shows */
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      // Never paint the full catalog as un-awarded. That would look like a
      // fresh jackpot on production if this UI ships before the items[] API.
      if (import.meta.env.DEV) {
        try {
          const catRes = await fetch('/data/pink2-pool-catalog.json', { cache: 'no-store' });
          if (catRes.ok) {
            const cat = await catRes.json();
            if (Array.isArray(cat)) {
              data.items = cat.map((it: PrizeItem) => ({
                n: Number(it.n),
                number: String(it.number || ''),
                inscriptionId: String(it.inscriptionId || ''),
                imageUrl: String(it.imageUrl || ''),
                contentUrl: it.inscriptionId ? `/content/${it.inscriptionId}` : '',
                awarded: false,
              }));
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    setPool(data);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 20000);
    window.addEventListener('slot2-pool-updated', load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('slot2-pool-updated', load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = pool?.items || [];
  const remaining = pool?.inscriptions?.remaining ?? items.filter((it) => !it.awarded).length;
  const total = pool?.inscriptions?.total ?? items.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-pink-300/70 bg-black/35 p-3 text-left transition hover:border-pink-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80"
        aria-label="Open prize preview"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-pink-100">Prizes in the slot</p>
          <p className="text-[11px] text-pink-200/75">{remaining}/{total || '—'} left</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          <span className={`rounded-full border px-2 py-0.5 ${pool?.titans?.remaining ? 'border-amber-300/40 text-amber-100' : 'border-white/10 text-white/35 line-through'}`}>
            Titans {pool ? `${pool.titans?.awarded ?? 0}/${pool.titans?.total ?? 20}` : '—'}
          </span>
          <span className={`rounded-full border px-2 py-0.5 ${pool?.lilcats?.remaining ? 'border-cyan-300/40 text-cyan-100' : 'border-white/10 text-white/35 line-through'}`}>
            Lil Cats {pool ? `${pool.lilcats?.awarded ?? 0}/${pool.lilcats?.total ?? 20}` : '—'}
          </span>
          <span className={`rounded-full border px-2 py-0.5 ${pool?.mainPrize?.awarded ? 'border-white/10 text-white/35 line-through' : 'border-green-300/40 text-green-100'}`}>
            Grand prize
          </span>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5">
          {items.length ? (
            <PrizeGrid items={items} />
          ) : (
            <p className="text-xs text-pink-200/60">
              {pool?.inscriptions
                ? `${pool.inscriptions.remaining}/${pool.inscriptions.total} inscription prizes left — grid waits for live inventory.`
                : 'Loading prizes…'}
            </p>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-pink-200/75">Won prizes are crossed out · tap to enlarge</p>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Slot prize preview"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full border border-pink-300/50 bg-black/60 px-3 py-1.5 text-xs font-semibold text-pink-100 hover:bg-black/80 sm:right-5 sm:top-5"
            aria-label="Close prize preview"
          >
            Close ✕
          </button>
          <div
            className="max-h-[min(96vh,1400px)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-pink-300/40 bg-[#100818] p-4 shadow-2xl shadow-pink-950/40"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-sm font-bold text-pink-100">
              {remaining} of {total} inscription prizes left
            </p>
            <PrizeGrid items={items} />
          </div>
        </div>
      )}
    </>
  );
};
