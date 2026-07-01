import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getOrdinalAddress, getPaymentAddress } from '../utils/wallet';
import { getBoundTaproot, bindTaproot } from '../utils/taprootStore';
import { getApiUrl } from '../utils/apiUrl';

/**
 * Pink Puppets — SLOT ROUND 2 (adaptive prize engine).
 * Talks to `/api/pinkpuppets/slot2/*` and reuses the shared 3D slot embed.
 * Prizes: Whitelist (Blockchain Titans / Lil Cats), one grand Pink Puppet
 * inscription, and bonus spins. Winners submit a Taproot receive address.
 */

function apiBase(path: string): string {
  const base = getApiUrl().replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

/** Slot routes must hit the same origin as the page (Vercel rewrites → Railway). */
function slot2ApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) return p;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'www.richart.app' || h === 'richart.app' || h.endsWith('.richart.app')) return p;
  }
  return apiBase(p);
}

function isSameSiteMessageOrigin(origin: string): boolean {
  if (origin === window.location.origin) return true;
  try {
    const a = new URL(origin);
    const b = new URL(window.location.href);
    const strip = (h: string) => h.replace(/^www\./i, '');
    return a.protocol === b.protocol && strip(a.hostname) === strip(b.hostname) && a.port === b.port;
  } catch {
    return false;
  }
}

type PrizeKey = 'main_prize' | 'wl_titans' | 'wl_lilcats' | 'bonus_spin' | 'no_win';

/** Presentation mapping → reuses the round-1 embed animations (reels are cosmetic). */
const EMBED_PRESENTATION: Record<PrizeKey, { embedPrize: string; targets: number[] }> = {
  main_prize: { embedPrize: 'pink_pass', targets: [0, 0, 0] }, // jackpot celebration
  wl_titans: { embedPrize: 'pink_block', targets: [1, 1, 1] },
  wl_lilcats: { embedPrize: 'smile', targets: [2, 2, 2] },
  bonus_spin: { embedPrize: 'no_win', targets: [3, 3, 3] },
  no_win: { embedPrize: 'no_win', targets: [2, 1, 2] },
};

const NO_WIN_MIXES = [[2, 1, 2], [2, 2, 1], [1, 2, 2], [2, 0, 1], [0, 2, 1]];

/** Winner-screen images per prize (local assets override the backend previewUrl). */
const PRIZE_IMAGE: Record<string, string> = {
  wl_titans: '/pink-slot2-titans.jpeg',
  // wl_lilcats: '/pink-slot2-lilcats.jpeg', // TODO: add when the Lil Cats image arrives
  // main_prize: '/pink-slot2-grandprize.avif',
};

function prizeImage(prize: string, previewUrl?: string): string {
  return PRIZE_IMAGE[prize] || (previewUrl || '');
}

function presentationFor(prize: string): { embedPrize: string; targets: number[] } {
  const p = (EMBED_PRESENTATION as Record<string, { embedPrize: string; targets: number[] }>)[prize];
  if (!p) return { embedPrize: 'no_win', targets: NO_WIN_MIXES[Math.floor(Math.random() * NO_WIN_MIXES.length)] };
  if (prize === 'no_win') return { embedPrize: 'no_win', targets: NO_WIN_MIXES[Math.floor(Math.random() * NO_WIN_MIXES.length)] };
  return p;
}

function formatCooldown(ms: number): string {
  if (ms <= 0) return '00:00';
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type PendingClaim = { prize: PrizeKey; displayName: string };

type Slot2Status = {
  spinsRemaining: number;
  baseRemaining: number;
  bonusBalance: number;
  maxBaseSpins: number;
  windowHours: number;
  nextSpinNotBefore: string | null;
  bonusWonToday: number;
  bonusDailyCap: number;
  wonTitans: boolean;
  wonLilcats: boolean;
  wonMain: boolean;
  pendingClaims: PendingClaim[];
};

type Slot2Pool = {
  active?: boolean;
  titans: { awarded: number; total: number; remaining: number };
  lilcats: { awarded: number; total: number; remaining: number };
  mainPrize: { awarded: boolean; gateSpins: number };
  globalSpins: number;
  gateProgress: number;
};

type SpinResult = {
  spinId: string;
  prize: PrizeKey;
  displayName: string;
  previewUrl: string;
  requiresClaim: boolean;
  claimKind: 'wl' | 'main' | null;
  spinsRemaining: number;
  bonusBalance: number;
};

const isClaimablePrize = (p: string): p is PrizeKey =>
  p === 'wl_titans' || p === 'wl_lilcats' || p === 'main_prize';

export const PinkPuppetsSlot2Section: React.FC = () => {
  const { walletState } = useWallet();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const spinBusyRef = useRef(false);
  const lastSpinRef = useRef<SpinResult | null>(null);
  const revealFallbackRef = useRef<number>(0);

  const [slotOpen, setSlotOpen] = useState(false);
  const [status, setStatus] = useState<Slot2Status | null>(null);
  const [pool, setPool] = useState<Slot2Pool | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [spinBusy, setSpinBusy] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [lastSpin, setLastSpin] = useState<SpinResult | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  const [connectHint, setConnectHint] = useState(false);

  // Claim modal
  const [claimPrize, setClaimPrize] = useState<PrizeKey | null>(null);
  const [claimTaproot, setClaimTaproot] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimDone, setClaimDone] = useState(false);

  const ordinalAddr = getOrdinalAddress(walletState.accounts || []);
  const connected = walletState.connected && !!ordinalAddr;

  const suggestedTaproot = useCallback((): string => {
    const payment = getPaymentAddress(walletState.accounts || []);
    const ord = getOrdinalAddress(walletState.accounts || []);
    if (ord.startsWith('bc1p')) return ord;
    const bound = getBoundTaproot(payment);
    if (bound && bound.startsWith('bc1p')) return bound;
    return '';
  }, [walletState.accounts]);

  const loadStatus = useCallback(async () => {
    if (!ordinalAddr) {
      setStatus(null);
      return;
    }
    setStatusLoading(true);
    try {
      const r = await fetch(slot2ApiUrl(`/api/pinkpuppets/slot2/status?address=${encodeURIComponent(ordinalAddr)}`), { cache: 'no-store' });
      if (r.ok) setStatus(await r.json());
    } catch {
      /* ignore */
    } finally {
      setStatusLoading(false);
    }
  }, [ordinalAddr]);

  const loadPool = useCallback(async () => {
    try {
      const r = await fetch(slot2ApiUrl('/api/pinkpuppets/slot2/pool'), { cache: 'no-store' });
      if (r.ok) setPool(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  useEffect(() => {
    if (!connected) setLastSpin(null);
  }, [connected]);

  lastSpinRef.current = lastSpin;

  // Reveal result only after reels stop (embed → PP_SLOT_ANIM_DONE), with fallback.
  useEffect(() => {
    window.clearTimeout(revealFallbackRef.current);
    if (!lastSpin) {
      setRevealReady(false);
      return;
    }
    setRevealReady(false);
    revealFallbackRef.current = window.setTimeout(() => setRevealReady(true), 8500);
    return () => window.clearTimeout(revealFallbackRef.current);
  }, [lastSpin?.spinId]);

  useEffect(() => {
    const onAnimDone = (ev: MessageEvent) => {
      if (!isSameSiteMessageOrigin(ev.origin)) return;
      if (ev.data?.type !== 'PP_SLOT_ANIM_DONE') return;
      const incoming = typeof ev.data.spinId === 'string' ? ev.data.spinId : '';
      const cur = lastSpinRef.current;
      if (!cur) return;
      if (incoming !== String(cur.spinId ?? '') && (incoming || cur.spinId)) return;
      window.clearTimeout(revealFallbackRef.current);
      setRevealReady(true);
    };
    window.addEventListener('message', onAnimDone);
    return () => window.removeEventListener('message', onAnimDone);
  }, []);

  const sendSpinToIframe = (targets: number[], winImageUrl: string, spinId: string, embedPrize: string) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'PP_SLOT_RUN', targets, winImageUrl, skipLeverAnim: true, spinId, prize: embedPrize }, '*');
  };

  const openModal = useCallback(() => {
    void loadStatus();
    void loadPool();
    setLastSpin(null);
    setSpinError(null);
    setSlotOpen(true);
  }, [loadStatus, loadPool]);

  const spinsLeft = status?.spinsRemaining ?? 0;
  // Master switch from backend — treat as inactive until we know it's live.
  const active = pool?.active === true;

  const performSpin = useCallback(async () => {
    if (spinBusyRef.current) return;
    spinBusyRef.current = true;
    setSpinError(null);
    setSpinBusy(true);
    setLastSpin(null);
    try {
      const r = await fetch(slot2ApiUrl('/api/pinkpuppets/slot2/spin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: ordinalAddr, taproot: suggestedTaproot() || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.message || data?.error || (r.status === 429 ? 'Spin limit reached.' : 'Spin failed'));
      }
      const prize = String(data.prize || 'no_win') as PrizeKey;
      const result: SpinResult = {
        spinId: String(data.spinId ?? ''),
        prize,
        displayName: String(data.displayName || ''),
        previewUrl: String(data.previewUrl || ''),
        requiresClaim: !!data.requiresClaim,
        claimKind: (data.claimKind as 'wl' | 'main' | null) ?? null,
        spinsRemaining: data.spinsRemaining ?? 0,
        bonusBalance: data.bonusBalance ?? 0,
      };
      setLastSpin(result);
      const pres = presentationFor(prize);
      requestAnimationFrame(() => sendSpinToIframe(pres.targets, prizeImage(prize, result.previewUrl), result.spinId, pres.embedPrize));
      await loadStatus();
      await loadPool();
    } catch (e: any) {
      setSpinError(e?.message || 'Spin failed');
    } finally {
      spinBusyRef.current = false;
      setSpinBusy(false);
    }
  }, [ordinalAddr, suggestedTaproot, loadStatus, loadPool]);

  // Alternative to pulling the lever (better on mobile) — same guard logic.
  const triggerSpin = useCallback(() => {
    if (spinBusyRef.current) return;
    if (!active) {
      setSpinError('Round 2 is not live yet — coming soon.');
      return;
    }
    if (!connected || !ordinalAddr || !walletState.walletType) {
      setConnectHint(true);
      return;
    }
    if (status !== null && spinsLeft <= 0) {
      setSpinError('No spins left right now.');
      return;
    }
    void performSpin();
  }, [active, connected, ordinalAddr, walletState.walletType, status, spinsLeft, performSpin]);

  // Lever pull from the embed
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!isSameSiteMessageOrigin(ev.origin)) return;
      if (ev.data?.type !== 'PP_SLOT_HEL_REQUEST') return;
      if (spinBusyRef.current) return;
      if (!slotOpen) openModal();
      if (!active) {
        setSpinError('Round 2 is not live yet — coming soon.');
        return;
      }
      if (!connected || !ordinalAddr || !walletState.walletType) {
        setConnectHint(true);
        return;
      }
      if (status !== null && spinsLeft <= 0) {
        setSpinError('No spins left right now.');
        return;
      }
      void performSpin();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [active, slotOpen, connected, ordinalAddr, walletState.walletType, spinsLeft, status, performSpin, openModal]);

  // Auto-open claim modal when a claimable win is revealed
  useEffect(() => {
    if (!revealReady || !lastSpin) return;
    if (lastSpin.requiresClaim && isClaimablePrize(lastSpin.prize)) {
      openClaim(lastSpin.prize);
    }
  }, [revealReady, lastSpin?.spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openClaim = (prize: PrizeKey) => {
    setClaimPrize(prize);
    setClaimTaproot(suggestedTaproot());
    setClaimError(null);
    setClaimDone(false);
  };

  const submitClaim = async () => {
    if (!claimPrize) return;
    const tp = claimTaproot.trim();
    if (!tp.startsWith('bc1p')) {
      setClaimError('Enter a valid Taproot address (bc1p…) — this is where your prize will be sent.');
      return;
    }
    setClaimBusy(true);
    setClaimError(null);
    try {
      const r = await fetch(slot2ApiUrl('/api/pinkpuppets/slot2/claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: ordinalAddr, prize: claimPrize, taproot: tp }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || 'Claim failed');
      // remember for future prefills
      const payment = getPaymentAddress(walletState.accounts || []);
      if (payment) bindTaproot(payment, tp);
      setClaimDone(true);
      await loadStatus();
    } catch (e: any) {
      setClaimError(e?.message || 'Claim failed');
    } finally {
      setClaimBusy(false);
    }
  };

  // Cooldown ticker
  const [tick, setTick] = useState(0);
  const showCooldown = connected && status != null && status.spinsRemaining <= 0 && !!status.nextSpinNotBefore;
  useEffect(() => {
    if (!showCooldown) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [showCooldown]);
  const cooldownMs = useMemo(() => {
    if (!status?.nextSpinNotBefore) return 0;
    return Math.max(0, new Date(status.nextSpinNotBefore).getTime() - Date.now());
  }, [status?.nextSpinNotBefore, tick]);

  useEffect(() => {
    if (!slotOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (claimPrize) { setClaimPrize(null); return; }
      if (connectHint) { setConnectHint(false); return; }
      setSlotOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [slotOpen, claimPrize, connectHint]);

  const pendingClaims = status?.pendingClaims ?? [];

  const prizeBadge = (prize: PrizeKey) => {
    switch (prize) {
      case 'main_prize':
        return { label: 'GRAND PRIZE', text: 'Pink Puppet inscription', cls: 'border-green-400/50 bg-green-950/40 text-green-100' };
      case 'wl_titans':
        return { label: 'WHITELIST', text: 'Blockchain Titans', cls: 'border-amber-400/50 bg-amber-950/40 text-amber-100' };
      case 'wl_lilcats':
        return { label: 'WHITELIST', text: 'Lil Cats', cls: 'border-cyan-400/50 bg-cyan-950/40 text-cyan-100' };
      default:
        return { label: '', text: '', cls: '' };
    }
  };

  const controls = (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/[0.08] bg-black/25 px-2 py-2 text-sm backdrop-blur-sm">
      <button
        type="button"
        disabled={!active || spinBusy || (status !== null && spinsLeft <= 0)}
        onClick={triggerSpin}
        className="w-full rounded-xl border-2 border-black bg-gradient-to-r from-pink-500 to-fuchsia-600 py-3.5 text-base font-extrabold uppercase tracking-[0.15em] text-white shadow-[3px_3px_0_#000] transition hover:brightness-110 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!active ? 'Coming soon' : spinBusy ? 'Spinning…' : status !== null && spinsLeft <= 0 ? 'No spins left' : 'SPIN'}
      </button>

      {connected && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-pink-400/25 bg-black/30 px-3 py-2.5">
            <div className="text-pink-300/70">Spins left</div>
            <div className="font-bold text-pink-100">
              {statusLoading || !status ? '…' : `${status.spinsRemaining}`}
              {status && status.bonusBalance > 0 ? <span className="ml-1 text-[10px] text-amber-300">(+{status.bonusBalance} bonus)</span> : null}
            </div>
            <div className="mt-0.5 text-[10px] text-pink-300/50">{status ? `${status.maxBaseSpins} per ${status.windowHours}h` : ''}</div>
          </div>
          <div className="rounded-xl border border-pink-400/25 bg-black/30 px-3 py-2.5">
            <div className="text-pink-300/70">Whitelist spots</div>
            <div className="font-mono text-pink-100">
              {pool ? `TITANS ${pool.titans.remaining}/${pool.titans.total}` : '—'}
            </div>
            <div className="font-mono text-[11px] text-pink-100/80">
              {pool ? `LIL CATS ${pool.lilcats.remaining}/${pool.lilcats.total}` : ''}
            </div>
          </div>
        </div>
      )}

      {spinError && <p className="text-xs text-red-300">{spinError}</p>}

      <p className="text-[11px] leading-relaxed text-pink-200/55">
        Pull the lever to spin. {status?.maxBaseSpins ?? 3} spins per {status?.windowHours ?? 2}h window. Win a spot on the
        <strong className="text-amber-200"> Blockchain Titans </strong>or<strong className="text-cyan-200"> Lil Cats </strong>
        whitelist, bonus spins, or the one-and-only <strong className="text-green-200">Pink Puppet grand prize</strong>. Winners enter a Taproot address to receive their prize.
      </p>

      {showCooldown && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/95">All spins used</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-100">{formatCooldown(cooldownMs)}</p>
        </div>
      )}

      {/* Revealed result banners */}
      {connected && revealReady && lastSpin && (
        <>
          {lastSpin.prize === 'bonus_spin' && (
            <div className="rounded-xl border border-amber-400/45 bg-amber-950/35 px-3 py-2.5 text-xs text-amber-50">
              <p className="font-bold text-amber-100">Bonus Spin — +1</p>
              <p className="mt-0.5 text-amber-100/80">Extra spin added to your balance. Pull again!</p>
            </div>
          )}
          {lastSpin.prize === 'no_win' && (
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-xs text-pink-100/80">
              <p className="font-semibold text-pink-100">No prize this spin.</p>
              <p className="mt-0.5 text-pink-200/60">Try again when your spins refresh.</p>
            </div>
          )}
          {isClaimablePrize(lastSpin.prize) && (
            <div className={`rounded-xl border px-3 py-3 ring-2 ring-pink-400/30 ${prizeBadge(lastSpin.prize).cls}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-90">{prizeBadge(lastSpin.prize).label} — you won!</p>
              <p className="mt-0.5 text-sm font-bold">{prizeBadge(lastSpin.prize).text}</p>
              {prizeImage(lastSpin.prize, lastSpin.previewUrl) && (
                <img
                  src={prizeImage(lastSpin.prize, lastSpin.previewUrl)}
                  alt={prizeBadge(lastSpin.prize).text}
                  className="mt-2 max-h-48 w-full rounded-lg border border-white/20 bg-black/40 object-contain"
                />
              )}
              <button
                type="button"
                onClick={() => openClaim(lastSpin.prize)}
                className="mt-2 w-full rounded-lg border-2 border-black bg-pink-400 py-2 text-xs font-bold text-black hover:bg-pink-300"
              >
                Enter Taproot address to claim
              </button>
            </div>
          )}
        </>
      )}

      {/* Earlier unclaimed wins */}
      {connected && pendingClaims.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">Unclaimed wins</p>
          {pendingClaims.map((pc) => (
            <div key={pc.prize} className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-black/40 px-3 py-2">
              <span className="text-xs font-semibold text-amber-100">{pc.displayName}</span>
              <button
                type="button"
                onClick={() => openClaim(pc.prize)}
                className="rounded-lg border border-amber-400/50 bg-amber-900/50 px-3 py-1.5 text-[11px] font-bold text-amber-50"
              >
                Claim
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className={slotOpen ? 'contents' : 'mb-10 w-full'}>
      <div
        role={slotOpen ? 'dialog' : undefined}
        aria-modal={slotOpen ? true : undefined}
        aria-label={slotOpen ? 'Pink Slot Round 2' : undefined}
        className={
          slotOpen
            ? 'fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto bg-[#0a0612]/90 px-3 py-6 backdrop-blur-md sm:px-6'
            : 'flex w-full flex-col items-stretch gap-6 rounded-2xl border border-pink-300/70 bg-black/35 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-10 sm:py-7'
        }
        onClick={slotOpen ? (e) => { if (e.target === e.currentTarget) setSlotOpen(false); } : undefined}
      >
        {!slotOpen && (
          <div className="order-1 flex max-w-3xl flex-1 flex-col justify-center gap-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
            <img
              src="/pink-slot2-prize.avif"
              alt=""
              aria-hidden
              className="pointer-events-none mx-auto h-auto w-auto max-h-[min(52vw,200px)] max-w-[min(92vw,200px)] shrink-0 object-contain sm:mx-0 sm:max-h-[220px] sm:max-w-[220px]"
            />
            <div className="min-w-0 flex-1 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-pink-200/75">
                {active ? 'Round 2 · Lucky Slot' : 'Round 2 · Coming soon'}
              </p>
              <h2 className="text-balance text-[clamp(1.8rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                Spin for{' '}
                <span className="bg-gradient-to-br from-amber-200 via-pink-100 to-[#e848c7] bg-clip-text font-bold text-transparent">whitelists & the grand prize</span>
              </h2>
              <p className="mx-auto max-w-[34rem] text-sm leading-relaxed text-pink-100/65 sm:mx-0 sm:text-base">
                Win a whitelist spot for <strong>Blockchain Titans</strong> or <strong>Lil Cats</strong>, bonus spins, or the single
                Pink Puppet grand prize. {pool ? `${pool.titans.remaining + pool.lilcats.remaining} whitelist spots left.` : ''}
              </p>
              <button
                type="button"
                onClick={openModal}
                className="rounded-xl border-2 border-black bg-[#ff4fcf] px-6 py-3 text-sm font-bold text-black shadow-[3px_3px_0_#000] transition hover:translate-y-[-1px] hover:bg-[#ff61d6]"
              >
                {active ? 'Open the Slot' : 'Preview · Coming soon'}
              </button>
            </div>
          </div>
        )}

        {slotOpen && (
          <button
            type="button"
            className="absolute right-4 top-4 z-[210] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg text-pink-100 backdrop-blur-md hover:bg-black/60"
            onClick={() => setSlotOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <div
          className={
            slotOpen
              ? 'relative z-[205] mt-10 flex w-full max-w-5xl flex-1 shrink-0 flex-col gap-4'
              : 'order-2 flex w-full max-w-[min(100%,440px)] shrink-0 flex-col gap-3 sm:max-w-[480px] lg:max-w-[520px]'
          }
        >
          <div
            className={
              slotOpen
                ? 'relative min-h-[min(52vh,560px)] w-full flex-1 touch-none [overscroll-behavior:contain]'
                : 'animate-slot-float relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[0_28px_70px_-18px_rgba(236,72,153,0.42)] ring-1 ring-white/15'
            }
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              ref={iframeRef}
              title="Pink Puppets slot round 2"
              src="/pinkpuppets-slot/index.html?embed=1"
              className="absolute inset-0 h-full w-full border-0 bg-transparent"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            />
            {slotOpen && connected && lastSpin && revealReady && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-1 px-4 text-center sm:top-5" role="status" aria-live="polite">
                {lastSpin.prize === 'main_prize' ? (
                  <p className="text-base font-bold leading-snug text-green-300 [text-shadow:0_2px_14px_rgba(0,0,0,0.95)] sm:text-lg">You won the GRAND PRIZE — Pink Puppet!</p>
                ) : lastSpin.prize === 'wl_titans' ? (
                  <p className="text-base font-bold leading-snug text-amber-200 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)] sm:text-lg">Whitelist — Blockchain Titans!</p>
                ) : lastSpin.prize === 'wl_lilcats' ? (
                  <p className="text-base font-bold leading-snug text-cyan-200 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)] sm:text-lg">Whitelist — Lil Cats!</p>
                ) : lastSpin.prize === 'bonus_spin' ? (
                  <p className="text-base font-bold leading-snug text-amber-100 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)] sm:text-lg">Bonus Spin — +1!</p>
                ) : (
                  <p className="text-base font-bold leading-snug text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.95)] sm:text-lg">Sorry — no win this spin.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {slotOpen && (
          <div className="relative z-[205] mt-4 flex w-full max-w-5xl shrink-0 flex-col items-center pb-10">{controls}</div>
        )}

        {/* Claim modal */}
        {slotOpen && claimPrize && (
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            onClick={() => setClaimPrize(null)}
          >
            <div className="w-full max-w-md rounded-2xl border border-pink-400/35 bg-[#100818]/95 px-6 py-7 shadow-[0_24px_80px_-20px_rgba(236,72,153,0.55)]" onClick={(e) => e.stopPropagation()}>
              {claimDone ? (
                <>
                  <p className="text-xl font-semibold text-white">Prize claimed ✓</p>
                  <p className="mt-2 text-sm leading-relaxed text-pink-100/75">
                    Your receive address is saved. {claimPrize === 'main_prize' ? 'The Pink Puppet inscription' : 'The whitelist spot'} is logged to{' '}
                    <span className="break-all font-mono text-pink-200">{claimTaproot}</span>.
                  </p>
                  <button type="button" onClick={() => setClaimPrize(null)} className="mt-6 w-full rounded-xl border border-white/15 bg-gradient-to-r from-pink-600 to-fuchsia-700 py-3 text-sm font-semibold text-white">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-pink-300/80">{prizeBadge(claimPrize).label}</p>
                  <p className="mt-1 text-xl font-semibold text-white">{prizeBadge(claimPrize).text}</p>
                  {prizeImage(claimPrize) && (
                    <img
                      src={prizeImage(claimPrize)}
                      alt={prizeBadge(claimPrize).text}
                      className="mt-3 max-h-44 w-full rounded-lg border border-white/20 bg-black/40 object-contain"
                    />
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-pink-100/75">
                    Enter the Taproot address (bc1p…) where you want to receive your prize. We prefilled your connected wallet — edit it if needed.
                  </p>
                  <label className="mt-4 block text-[10px] uppercase tracking-wide text-pink-300/70">Taproot receive address</label>
                  <input
                    value={claimTaproot}
                    onChange={(e) => setClaimTaproot(e.target.value.trim())}
                    placeholder="bc1p..."
                    className="mt-1 w-full rounded-lg border border-pink-400/30 bg-black/60 px-3 py-2 font-mono text-xs text-white"
                  />
                  {claimError && <p className="mt-2 text-xs text-red-300">{claimError}</p>}
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => setClaimPrize(null)} className="flex-1 rounded-xl border border-white/15 bg-black/40 py-3 text-sm font-semibold text-pink-100/80">
                      Later
                    </button>
                    <button type="button" disabled={claimBusy} onClick={() => void submitClaim()} className="flex-1 rounded-xl border-2 border-black bg-pink-400 py-3 text-sm font-bold text-black disabled:opacity-50">
                      {claimBusy ? 'Saving…' : 'Confirm & claim'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Connect-wallet hint */}
        {slotOpen && connectHint && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" role="alertdialog" aria-modal="true" onClick={() => setConnectHint(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-pink-400/35 bg-[#100818]/95 px-6 py-7 text-center" onClick={(e) => e.stopPropagation()}>
              <p className="text-xl font-semibold text-white">Connect wallet</p>
              <p className="mt-3 text-sm leading-relaxed text-pink-100/75">Connect your wallet (header) to spin — spins are tied to your address.</p>
              <button type="button" className="mt-6 w-full rounded-xl border border-white/15 bg-gradient-to-r from-pink-600 to-fuchsia-700 py-3 text-sm font-semibold text-white" onClick={() => setConnectHint(false)}>
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
