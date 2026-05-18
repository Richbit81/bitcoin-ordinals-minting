import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from './FeeRateSelector';
import { MintingProgress } from './MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { getOrdinalAddress } from '../utils/wallet';
import { getApiUrl } from '../utils/apiUrl';

function apiUrl(path: string): string {
  const base = getApiUrl().replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

/**
 * Slot-Endpunkte müssen auf **derselben Origin** wie die Seite laufen (Vercel `rewrites` → Railway).
 * Ein direkter Aufruf von `api.richart.app` umgeht diese Rewrites — dann greift oft ein anderes/älteres Backend
 * (keine Slot-Routen, falsche Gewinne, fehlende `prizePreviewUrl`).
 */
function pinkSlotApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) return p;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'www.richart.app' || h === 'richart.app' || h.endsWith('.richart.app')) {
      return p;
    }
  }
  return apiUrl(p);
}

/** Gleiche Logik wie `public/pinkpuppets-slot/index.html` → `inferPrizeKindFromTargets`: nur drei gleiche Stops zählen. */
function pinkSlotTierFromTargets(
  targets: unknown
): 'pink_pass' | 'pink_block' | 'smile' | 'no_win' {
  if (!Array.isArray(targets) || targets.length !== 3) return 'no_win';
  const [a, b, c] = targets.map((x) =>
    Math.min(3, Math.max(0, Math.floor(Number(x))))
  );
  if (a !== b || b !== c) return 'no_win';
  if (a === 0) return 'pink_pass';
  if (a === 1) return 'pink_block';
  if (a === 2) return 'smile';
  return 'no_win';
}

const PINK_SLOT_SMILE_MIX_FALLBACK: [number, number, number] = [2, 1, 2];

const PINK_SLOT_TEMPLATE_BY_PRIZE: Record<string, string> = {
  pink_pass: 'e48573379be883ad592ad442633e58e1e8ff3ed3c4b6bbbc6e497f547e793cf0i0',
  pink_block: 'f86f39ff37a31954db74fdea7c0310bd67c4e0f122911718ae4a3a8f2f1ba7d5i0',
  smile: '443b155804ee47845709a4743ad84184e3b96972120526e656f5fb2c5214cb82i0',
  rs_metatron: '0c6621f4bc9d3b4c839b7fa02e7d0d097ea613c49542c5c937c2e2c41c2ae603i0',
  rs_369: '3cfe3cf26f1f8e727b3c2ccd0dcc89f97e89445c5bfd22f93ce125e380e83027i0',
};

function isPinkSlotMintablePrize(prize: string): boolean {
  return (
    prize === 'pink_pass' ||
    prize === 'pink_block' ||
    prize === 'smile' ||
    prize === 'rs_metatron' ||
    prize === 'rs_369'
  );
}

function pinkSlotTemplateIdForPrize(prize: string, fromApi?: unknown): string {
  const raw = typeof fromApi === 'string' ? fromApi.trim() : '';
  if (raw) return raw;
  return PINK_SLOT_TEMPLATE_BY_PRIZE[prize] || PINK_SLOT_TEMPLATE_BY_PRIZE.smile;
}

function pinkSlotPreviewUrlForPrize(prize: string, fromApi?: unknown): string {
  const raw = typeof fromApi === 'string' ? fromApi.trim() : '';
  if (raw) return raw;
  const tid = pinkSlotTemplateIdForPrize(prize, fromApi);
  return `https://ordinals.com/content/${tid}`;
}

/**
 * Erzwingt Walzen-Stops passend zum Server-`prize` (verhindert Mismatch bei altem API-Stand / fehlerhaften `targets`).
 * Muss zur Slot-HTML und zu `pinkSlotPrizeToTargets` im Backend passen.
 */
function pinkSlotCanonicalTargetsForPrize(prize: string, rawTargets: unknown): number[] {
  const p = String(prize || '').trim();
  if (p === 'pink_pass') return [0, 0, 0];
  if (p === 'pink_block') return [1, 1, 1];
  if (p === 'smile') return [2, 2, 2];
  if (p === 'rs_metatron' || p === 'rs_369') return [3, 3, 3];
  if (!Array.isArray(rawTargets) || rawTargets.length !== 3) {
    return [...PINK_SLOT_SMILE_MIX_FALLBACK];
  }
  const t = rawTargets.map((x) =>
    Math.min(3, Math.max(0, Math.floor(Number(x))))
  );
  if (p === 'no_win') {
    const [a, b, c] = t;
    if (a !== b || b !== c) return t;
    return [...PINK_SLOT_SMILE_MIX_FALLBACK];
  }
  return [...PINK_SLOT_SMILE_MIX_FALLBACK];
}

function isSameSiteMessageOrigin(origin: string): boolean {
  if (origin === window.location.origin) return true;
  try {
    const a = new URL(origin);
    const b = new URL(window.location.href);
    const strip = (h: string) => h.replace(/^www\./i, '');
    return (
      a.protocol === b.protocol &&
      strip(a.hostname) === strip(b.hostname) &&
      a.port === b.port
    );
  } catch {
    return false;
  }
}

/** Live countdown target → hh:mm:ss or mm:ss */
function formatSpinCooldown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function SpinCooldownBanner({ remainingMs }: { remainingMs: number }) {
  const formatted = formatSpinCooldown(remainingMs);
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/85 via-rose-950/70 to-black/50 px-4 py-4 text-center shadow-[0_16px_48px_-14px_rgba(251,191,36,0.4)] backdrop-blur-md ring-1 ring-amber-300/25 sm:px-6 sm:py-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/95">
        All spins used
      </p>
      <p className="mt-2 text-sm font-medium text-pink-50/95">Next spin available in</p>
      <p className="mt-2 font-mono text-[clamp(1.75rem,5vw,2.5rem)] font-bold tabular-nums leading-none tracking-tight text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
        {formatted}
      </p>
    </div>
  );
}

type PendingWin = {
  spinId: string;
  prize: string;
  targets: number[];
  templateId: string;
  prizePreviewUrl: string;
  displayName: string;
  at: string;
};

type SlotStatus = {
  spinsRemaining: number;
  maxSpinsPerWindow: number;
  windowHours: number;
  nextSpinNotBefore: string | null;
  pinkPassesMinted: number;
  pinkPassesCap: number;
  pendingWins?: PendingWin[];
  pendingWinsCount?: number;
  /** Backend soft-launch: all spins → smile, real odds off */
  winPauseActive?: boolean;
  winPauseUntil?: string | null;
};

function pendingWinToSpinResult(p: PendingWin, spinsRemaining: number): SpinResult {
  const prize = p.prize;
  return {
    spinId: p.spinId,
    prize,
    targets: pinkSlotCanonicalTargetsForPrize(prize, p.targets),
    templateId: pinkSlotTemplateIdForPrize(prize, p.templateId),
    prizePreviewUrl: p.prizePreviewUrl || pinkSlotPreviewUrlForPrize(prize, p.templateId),
    displayName: p.displayName,
    spinsRemaining,
  };
}

type SpinResult = {
  spinId: string;
  prize: string;
  targets: number[];
  templateId: string;
  prizePreviewUrl: string;
  displayName: string;
  spinsRemaining: number;
};

type PassPoolInfo = {
  pinkPassesMinted: number;
  pinkPassesCap: number;
  pinkPassesRemaining: number;
  winPauseActive?: boolean;
  winPauseUntil?: string | null;
};

export const PinkPuppetsSlotSection: React.FC = () => {
  const { walletState } = useWallet();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** Synchronous guard — React spinBusy can lag one frame and block duplicate HEL requests incorrectly */
  const spinBusyRef = useRef(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [feeRate, setFeeRate] = useState(2);
  const [slotStatus, setSlotStatus] = useState<SlotStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [spinBusy, setSpinBusy] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [lastSpin, setLastSpin] = useState<SpinResult | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<MintingStatus | null>(null);
  const [connectWalletHint, setConnectWalletHint] = useState(false);
  const [taprootOverride, setTaprootOverride] = useState(
    () => typeof window !== 'undefined' ? localStorage.getItem('unisat_taproot_address') || '' : ''
  );
  const [passPool, setPassPool] = useState<PassPoolInfo | null>(null);
  /** Ergebnis-Text erst nach Ende der Walzen-Animation (iframe → PP_SLOT_ANIM_DONE) */
  const [spinUiRevealReady, setSpinUiRevealReady] = useState(false);
  const lastSpinRef = useRef<SpinResult | null>(null);
  const spinRevealFallbackRef = useRef<number>(0);
  const mintPanelRef = useRef<HTMLDivElement>(null);

  const spinTier = useMemo(
    () => (lastSpin ? pinkSlotTierFromTargets(lastSpin.targets) : null),
    [lastSpin]
  );

  const pendingWins = useMemo(
    () => (Array.isArray(slotStatus?.pendingWins) ? slotStatus!.pendingWins! : []),
    [slotStatus?.pendingWins]
  );

  const activeMintSpin = useMemo((): SpinResult | null => {
    if (lastSpin && isPinkSlotMintablePrize(lastSpin.prize) && spinUiRevealReady) {
      return lastSpin;
    }
    if (pendingWins.length > 0) {
      return pendingWinToSpinResult(
        pendingWins[0],
        slotStatus?.spinsRemaining ?? 0
      );
    }
    return null;
  }, [lastSpin, spinUiRevealReady, pendingWins, slotStatus?.spinsRemaining]);

  /** Server-`prize` für Embed (u. a. rs_metatron / rs_369 teilen Walzenzeile 3 mit Smile). */
  const uiSpinKind = useMemo(() => {
    const spin = activeMintSpin ?? lastSpin;
    if (!spin) return null;
    const p = spin.prize;
    if (
      p === 'pink_pass' ||
      p === 'pink_block' ||
      p === 'rs_metatron' ||
      p === 'rs_369' ||
      p === 'smile' ||
      p === 'no_win'
    ) {
      return p;
    }
    return spinTier;
  }, [activeMintSpin, lastSpin, spinTier]);

  const ordinalAddr = getOrdinalAddress(walletState.accounts || []);
  const connected = walletState.connected && !!ordinalAddr;

  const loadStatus = useCallback(async () => {
    if (!ordinalAddr) {
      setSlotStatus(null);
      return;
    }
    setStatusLoading(true);
    try {
      const r = await fetch(
        pinkSlotApiUrl(`/api/pinkpuppets/slot/status?address=${encodeURIComponent(ordinalAddr)}`),
        { cache: 'no-store' }
      );
      if (r.ok) {
        const d = await r.json();
        setSlotStatus(d);
      }
    } catch {
      setSlotStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [ordinalAddr]);

  const loadPassPool = useCallback(async () => {
    try {
      const r = await fetch(pinkSlotApiUrl('/api/pinkpuppets/slot/pool'), {
        cache: 'no-store',
      });
      if (!r.ok) return;
      const d = await r.json();
      setPassPool({
        pinkPassesMinted: typeof d.pinkPassesMinted === 'number' ? d.pinkPassesMinted : 0,
        pinkPassesCap: typeof d.pinkPassesCap === 'number' ? d.pinkPassesCap : 15,
        pinkPassesRemaining:
          typeof d.pinkPassesRemaining === 'number'
            ? d.pinkPassesRemaining
            : Math.max(
                0,
                (typeof d.pinkPassesCap === 'number' ? d.pinkPassesCap : 15) -
                  (typeof d.pinkPassesMinted === 'number' ? d.pinkPassesMinted : 0)
              ),
        winPauseActive: d.winPauseActive === true,
        winPauseUntil: typeof d.winPauseUntil === 'string' ? d.winPauseUntil : null,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  /** Global PINK Pass pool — loads without wallet (discrete preview line) */
  useEffect(() => {
    void loadPassPool();
  }, [loadPassPool]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadPassPool();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadPassPool]);

  const openSlotModal = useCallback(() => {
    void loadPassPool();
    void loadStatus();
    setLastSpin(null);
    setSpinError(null);
    setSlotOpen(true);
  }, [loadPassPool, loadStatus]);

  useEffect(() => {
    if (slotStatus != null && slotStatus.spinsRemaining > 0) {
      setSpinError((msg) =>
        msg === 'No spins left in this window.' ? null : msg
      );
    }
  }, [slotStatus?.spinsRemaining]);

  useEffect(() => {
    if (!connected) {
      setLastSpin(null);
    }
  }, [connected]);

  lastSpinRef.current = lastSpin;

  /** Nach neuem Spin: Overlay erst wenn Walzen fertig; Fallback falls postMessage ausbleibt */
  useEffect(() => {
    window.clearTimeout(spinRevealFallbackRef.current);
    if (!lastSpin) {
      setSpinUiRevealReady(false);
      return;
    }
    setSpinUiRevealReady(false);
    spinRevealFallbackRef.current = window.setTimeout(() => {
      setSpinUiRevealReady(true);
    }, 8500);
    return () => window.clearTimeout(spinRevealFallbackRef.current);
  }, [lastSpin?.spinId]);

  useEffect(() => {
    const onAnimDone = (ev: MessageEvent) => {
      if (!isSameSiteMessageOrigin(ev.origin)) return;
      if (ev.data?.type !== 'PP_SLOT_ANIM_DONE') return;
      const incoming = typeof ev.data.spinId === 'string' ? ev.data.spinId : '';
      const cur = lastSpinRef.current;
      if (!cur) return;
      const expected = String(cur.spinId ?? '');
      if (incoming !== expected && (incoming || expected)) return;
      window.clearTimeout(spinRevealFallbackRef.current);
      setSpinUiRevealReady(true);
    };
    window.addEventListener('message', onAnimDone);
    return () => window.removeEventListener('message', onAnimDone);
  }, []);

  useEffect(() => {
    if (connected && ordinalAddr && walletState.walletType) {
      setConnectWalletHint(false);
    }
  }, [connected, ordinalAddr, walletState.walletType]);

  useEffect(() => {
    if (!slotOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (connectWalletHint) {
        setConnectWalletHint(false);
        return;
      }
      setSlotOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [slotOpen, connectWalletHint]);

  const sendSpinToIframe = (
    targets: number[],
    winImageUrl: string,
    skipLeverAnim: boolean,
    spinId: string,
    prize: string
  ) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'PP_SLOT_RUN',
        targets,
        winImageUrl,
        skipLeverAnim,
        spinId,
        prize,
      },
      '*'
    );
  };

  const performSpin = useCallback(async () => {
    if (spinBusyRef.current) return;
    spinBusyRef.current = true;
    setSpinError(null);
    setSpinBusy(true);
    setLastSpin(null);
    try {
      const r = await fetch(pinkSlotApiUrl('/api/pinkpuppets/slot/spin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: ordinalAddr }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (r.status === 429
            ? 'Spin limit reached (3 spins per 8h window).'
            : 'Spin failed');
        throw new Error(msg);
      }
      const prize = typeof data.prize === 'string' ? data.prize : '';
      const rawPreview =
        typeof data.prizePreviewUrl === 'string' ? data.prizePreviewUrl.trim() : '';
      const fallbackPreview = isPinkSlotMintablePrize(prize)
        ? pinkSlotPreviewUrlForPrize(prize, data.prizePreviewUrl)
        : '';
      const dn =
        typeof data.displayName === 'string' && data.displayName.trim()
          ? String(data.displayName).trim()
          : prize === 'pink_pass'
            ? 'PINK Pass'
            : prize === 'pink_block'
              ? 'Pink Block'
              : prize === 'rs_metatron'
                ? 'Metatron'
                : prize === 'rs_369'
                  ? '369'
                  : prize === 'smile'
                    ? 'Smile — consolation'
                    : 'No prize — try again';
      const targets = pinkSlotCanonicalTargetsForPrize(prize, data.targets);
      const templateId = pinkSlotTemplateIdForPrize(prize, data.templateId);
      const result: SpinResult = {
        spinId: String(data.spinId ?? ''),
        prize,
        targets,
        templateId,
        prizePreviewUrl: rawPreview || fallbackPreview,
        displayName: dn,
        spinsRemaining: data.spinsRemaining ?? 0,
      };
      setLastSpin(result);
      requestAnimationFrame(() => {
        sendSpinToIframe(
          result.targets,
          result.prizePreviewUrl,
          true,
          result.spinId || '',
          result.prize || ''
        );
      });
      await loadStatus();
      await loadPassPool();
    } catch (e: any) {
      setSpinError(e?.message || 'Spin failed');
    } finally {
      spinBusyRef.current = false;
      setSpinBusy(false);
    }
  }, [ordinalAddr, loadStatus, loadPassPool]);

  const resolveReceive = (): string => {
    let addr = getOrdinalAddress(walletState.accounts || []);
    if (walletState.walletType === 'unisat' && !addr.startsWith('bc1p')) {
      const saved = taprootOverride || localStorage.getItem('unisat_taproot_address') || '';
      if (saved.startsWith('bc1p')) addr = saved;
    }
    return addr;
  };

  const handleMintPrize = async (claimSpin?: SpinResult) => {
    const claim = claimSpin ?? activeMintSpin;
    if (!claim || !walletState.walletType || !connected) {
      setConnectWalletHint(true);
      return;
    }
    if (!isPinkSlotMintablePrize(claim.prize)) return;
    if (!ordinalAddr) {
      setConnectWalletHint(true);
      return;
    }
    const receive = resolveReceive();
    if (!receive.startsWith('bc1p')) {
      setMintStatus({
        progress: 0,
        status: 'error',
        message:
          'Taproot address (bc1p…) required to receive the inscription. UniSat: pay from Native SegWit; enter Taproot receive above.',
      });
      return;
    }

    setMinting(true);
    setMintStatus({ progress: 10, status: 'processing', message: 'Creating delegate…' });
    try {
      const collectionName =
        claim.prize === 'pink_pass' ||
        claim.prize === 'pink_block' ||
        claim.prize === 'smile'
          ? 'Pink Puppets'
          : 'Random Stuff';
      const templateId = pinkSlotTemplateIdForPrize(claim.prize, claim.templateId);
      if (!templateId) {
        throw new Error('Missing inscription template for this prize — refresh and try again.');
      }
      const result = await createSingleDelegate(
        templateId,
        claim.displayName,
        receive,
        collectionName,
        feeRate,
        walletState.walletType,
        'image',
        0
      );
      setMintStatus({ progress: 80, status: 'processing', message: 'Mint wird protokolliert…' });
      const logRes = await fetch(pinkSlotApiUrl('/api/pinkpuppets/slot/log-mint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: ordinalAddr,
          inscriptionId: result.inscriptionId,
          txid: result.txid,
          templateId,
          prize: claim.prize,
          spinId: claim.spinId,
        }),
      });
      if (!logRes.ok) {
        const logErr = await logRes.json().catch(() => ({}));
        throw new Error(
          logErr?.error ||
            'Mint on-chain succeeded but server could not record it — contact support with your txid.'
        );
      }
      setMintStatus({
        progress: 100,
        status: 'success',
        message: `Minted: ${result.inscriptionId}`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });
      await loadStatus();
      await loadPassPool();
    } catch (e: any) {
      setMintStatus({
        progress: 0,
        status: 'error',
        message: e?.message || 'Mint failed',
      });
    } finally {
      setMinting(false);
    }
  };

  const spinsLeft = slotStatus?.spinsRemaining ?? 0;

  const showSpinCooldown =
    connected &&
    slotStatus != null &&
    slotStatus.spinsRemaining <= 0 &&
    !!slotStatus.nextSpinNotBefore;

  const [cooldownTick, setCooldownTick] = useState(0);
  useEffect(() => {
    if (!showSpinCooldown) return;
    const id = window.setInterval(() => setCooldownTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [showSpinCooldown]);

  const cooldownRemainingMs = useMemo(() => {
    if (!slotStatus?.nextSpinNotBefore) return 0;
    const target = new Date(slotStatus.nextSpinNotBefore).getTime();
    return Math.max(0, target - Date.now());
  }, [slotStatus?.nextSpinNotBefore, cooldownTick]);

  const showReelWinPanel =
    connected &&
    activeMintSpin != null &&
    uiSpinKind != null &&
    isPinkSlotMintablePrize(uiSpinKind) &&
    (spinUiRevealReady || pendingWins.length > 0);

  useEffect(() => {
    if (!showReelWinPanel || !slotOpen) return;
    const t = window.setTimeout(() => {
      mintPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [showReelWinPanel, slotOpen, lastSpin?.spinId]);

  const cooldownEndedRefreshRef = useRef(false);
  useEffect(() => {
    if (!showSpinCooldown) {
      cooldownEndedRefreshRef.current = false;
      return;
    }
    if (cooldownRemainingMs > 0) {
      cooldownEndedRefreshRef.current = false;
      return;
    }
    if (cooldownEndedRefreshRef.current) return;
    cooldownEndedRefreshRef.current = true;
    void loadStatus();
  }, [showSpinCooldown, cooldownRemainingMs, loadStatus]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!isSameSiteMessageOrigin(ev.origin)) return;
      if (ev.data?.type !== 'PP_SLOT_HEL_REQUEST') return;
      if (spinBusyRef.current) return;
      if (!slotOpen) {
        openSlotModal();
      }
      if (!connected || !ordinalAddr || !walletState.walletType) {
        setConnectWalletHint(true);
        return;
      }
      /**
       * Before the first /status response, spinsLeft is 0 — do not treat as "no spins".
       * Only enforce client-side when we already know the quota from the server.
       */
      if (slotStatus !== null && spinsLeft <= 0) {
        setSpinError('No spins left in this window.');
        return;
      }
      void performSpin();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [slotOpen, connected, ordinalAddr, walletState.walletType, spinsLeft, slotStatus, performSpin, openSlotModal]);

  const controlsPanel = (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/[0.08] bg-black/25 px-1 py-1 text-sm backdrop-blur-sm sm:px-2">
      {connected && walletState.walletType === 'unisat' && !ordinalAddr.startsWith('bc1p') && (
        <div className="rounded-xl border border-orange-500/35 bg-black/35 p-3">
          <label className="mb-1 block text-[10px] text-orange-200">Taproot receive (bc1p…) for inscription</label>
          <input
            value={taprootOverride}
            onChange={(e) => {
              setTaprootOverride(e.target.value);
              localStorage.setItem('unisat_taproot_address', e.target.value);
            }}
            placeholder="bc1p..."
            className="w-full rounded bg-black/60 border border-orange-500/30 px-2 py-1 font-mono text-xs text-white"
          />
        </div>
      )}

      {connected && (
        <div className="space-y-1 rounded-xl border border-pink-400/25 bg-black/30 px-3 py-2.5 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-pink-300/70">Spins left (8h)</span>
            <span className="font-bold text-pink-100">
              {statusLoading || !slotStatus ? '…' : `${spinsLeft} / ${slotStatus.maxSpinsPerWindow ?? 3}`}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-pink-300/70">PINK Pass pool</span>
            <span className="font-mono text-pink-100">
              {slotStatus ? `${slotStatus.pinkPassesMinted} / ${slotStatus.pinkPassesCap}` : '—'}
            </span>
          </div>
        </div>
      )}

      {spinError && <p className="text-xs text-red-300">{spinError}</p>}

      <p className="text-[11px] leading-relaxed text-pink-200/55">
        Pull the lever to spin. Three spins per rolling 8h window. Most spins are no prize (mixed symbols). Mintable wins: PINK Pass, Pink Block, Smile (triple smile row), Metatron, 369 — server prize decides. Global cap: 15 PINK Passes · one pass per wallet. You pay network fees for mints.
      </p>

      {connected && pendingWins.length > 0 && (
        <div className="rounded-xl border border-amber-400/45 bg-amber-950/35 px-3 py-2.5 text-xs text-amber-50/95">
          <p className="font-semibold text-amber-100">
            {pendingWins.length === 1
              ? '1 prize waiting — mint required'
              : `${pendingWins.length} prizes waiting — mint each below`}
          </p>
          <p className="mt-1 leading-snug text-amber-100/80">
            A line in the spin log means you <strong>may</strong> mint that prize. Nothing is sent automatically — use the Mint button (miner fees only).
          </p>
        </div>
      )}

      {showReelWinPanel && activeMintSpin && (
        <div
            ref={mintPanelRef}
            className={`space-y-2 rounded-xl border p-3 ring-2 ring-pink-400/40 ${
            uiSpinKind === 'pink_pass'
              ? 'border-green-400/40 bg-green-950/30'
              : uiSpinKind === 'pink_block' || uiSpinKind === 'smile'
                ? 'border-pink-400/35 bg-black/35'
                : 'border-cyan-400/30 bg-cyan-950/20'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/95">
            Real win — scroll here to mint (miner fees only)
          </p>
          <p
            className={`text-xs font-bold ${
              uiSpinKind === 'pink_pass'
                ? 'text-green-100'
                : uiSpinKind === 'pink_block' || uiSpinKind === 'smile'
                  ? 'text-pink-100/90'
                  : 'text-cyan-100/90'
            }`}
          >
            Result: {activeMintSpin.displayName}
          </p>
          <p className="text-[10px] leading-snug text-pink-200/55">
            {uiSpinKind === 'pink_pass'
              ? 'Three matching pass symbols (row 0) — main prize.'
              : uiSpinKind === 'pink_block'
                ? 'Three matching block symbols (row 1) — Pink Puppets side prize.'
                : uiSpinKind === 'smile'
                  ? 'Three matching smile symbols — Pink Puppets consolation (mintable).'
                  : uiSpinKind === 'rs_metatron'
                    ? 'Metatron — Random Stuff delegate (slot consolation).'
                    : '369 — Random Stuff delegate (slot consolation).'}
          </p>
          <img
            src={activeMintSpin.prizePreviewUrl}
            alt={activeMintSpin.displayName}
            className="max-h-40 w-full rounded-lg border border-pink-300/30 bg-black/50 object-contain"
          />
          {uiSpinKind === 'pink_pass' ? (
            <>
              <FeeRateSelector selectedFeeRate={feeRate} onFeeRateChange={setFeeRate} />
              <button
                type="button"
                disabled={minting}
                onClick={() => void handleMintPrize(activeMintSpin)}
                className="w-full rounded-lg border-2 border-black bg-green-500 py-2 text-xs font-bold text-black disabled:opacity-50"
              >
                {minting ? 'Minting…' : 'Mint PINK Pass (free delegate)'}
              </button>
            </>
          ) : uiSpinKind === 'pink_block' ? (
            <>
              <FeeRateSelector selectedFeeRate={feeRate} onFeeRateChange={setFeeRate} />
              <button
                type="button"
                disabled={minting}
                onClick={() => void handleMintPrize(activeMintSpin)}
                className="w-full rounded-lg border-2 border-pink-400/60 bg-gradient-to-r from-pink-600 to-fuchsia-700 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {minting ? 'Minting…' : 'Mint Pink Block (free delegate)'}
              </button>
              <p className="text-[10px] text-pink-200/60">
                Same delegate flow as the Pass — you only pay miner fees. Does not count toward the 15 Pass cap.
              </p>
            </>
          ) : uiSpinKind === 'smile' ? (
            <>
              <FeeRateSelector selectedFeeRate={feeRate} onFeeRateChange={setFeeRate} />
              <button
                type="button"
                disabled={minting}
                onClick={() => void handleMintPrize(activeMintSpin)}
                className="w-full rounded-lg border-2 border-pink-400/60 bg-gradient-to-r from-pink-600 to-fuchsia-700 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {minting ? 'Minting…' : 'Mint Smile (free delegate)'}
              </button>
              <p className="text-[10px] text-pink-200/60">
                Pink Puppets consolation — you only pay miner fees.
              </p>
            </>
          ) : uiSpinKind === 'rs_metatron' || uiSpinKind === 'rs_369' ? (
            <>
              <FeeRateSelector selectedFeeRate={feeRate} onFeeRateChange={setFeeRate} />
              <button
                type="button"
                disabled={minting}
                onClick={() => void handleMintPrize(activeMintSpin)}
                className="w-full rounded-lg border-2 border-cyan-400/50 bg-gradient-to-r from-cyan-800 to-slate-900 py-2 text-xs font-bold text-cyan-50 disabled:opacity-50"
              >
                {minting ? 'Minting…' : `Mint ${activeMintSpin.displayName} (Random Stuff delegate)`}
              </button>
              <p className="text-[10px] text-pink-200/60">
                Same collection as /random-stuff — you only pay miner fees (no item sats in the slot).
              </p>
            </>
          ) : null}
          {mintStatus &&
            (uiSpinKind === 'pink_pass' ||
              uiSpinKind === 'pink_block' ||
              uiSpinKind === 'smile' ||
              uiSpinKind === 'rs_metatron' ||
              uiSpinKind === 'rs_369') && (
              <MintingProgress status={mintStatus} />
            )}
        </div>
      )}

      {connected &&
        pendingWins.slice(1).map((pw) => {
          const spin = pendingWinToSpinResult(pw, slotStatus?.spinsRemaining ?? 0);
          return (
            <div
              key={pw.spinId}
              className="space-y-2 rounded-xl border border-amber-400/30 bg-black/40 p-3"
            >
              <p className="text-xs font-bold text-amber-100">{spin.displayName}</p>
              <p className="text-[10px] text-pink-200/55">Earlier win — tap Mint to claim.</p>
              <button
                type="button"
                disabled={minting}
                onClick={() => void handleMintPrize(spin)}
                className="w-full rounded-lg border border-amber-400/50 bg-amber-900/50 py-2 text-xs font-bold text-amber-50 disabled:opacity-50"
              >
                {minting ? 'Minting…' : `Mint ${spin.displayName}`}
              </button>
            </div>
          );
        })}
    </div>
  );

  return (
    <section className={slotOpen ? 'contents' : 'mb-10 w-full'}>
      <div
        role={slotOpen ? 'dialog' : undefined}
        aria-modal={slotOpen ? true : undefined}
        aria-label={slotOpen ? 'Pink Slot' : undefined}
        className={
          slotOpen
            ? 'fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto bg-[#0a0612]/88 px-3 py-6 backdrop-blur-md sm:px-6'
            : 'flex w-full flex-col items-stretch gap-6 rounded-2xl border border-pink-300/70 bg-black/35 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-10 sm:py-7 lg:gap-10'
        }
        onClick={
          slotOpen
            ? (e) => {
                if (e.target === e.currentTarget) setSlotOpen(false);
              }
            : undefined
        }
      >
        {!slotOpen && (
          <div className="order-1 flex max-w-3xl flex-1 flex-col justify-center gap-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:px-2 sm:text-left lg:gap-10">
            {/* Pink Pass PNG — ganzes Bild, object-contain (Transparenz vom PNG erhalten) */}
            <img
              src="/pinkpasshires.png"
              alt=""
              width={560}
              height={560}
              decoding="async"
              aria-hidden
              className="pointer-events-none mx-auto h-auto w-auto max-h-[min(52vw,220px)] max-w-[min(92vw,220px)] shrink-0 object-contain object-center sm:mx-0 sm:max-h-[240px] sm:max-w-[240px] lg:max-h-[260px] lg:max-w-[260px]"
            />
            <div className="min-w-0 flex-1 space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-pink-200/75 sm:text-xs">
                  Phase 3 · Slot access
                </p>
                <p className="text-[10px] tracking-wide text-pink-200/70">
                  <span className="tabular-nums font-medium text-pink-100/85">
                    {passPool !== null ? passPool.pinkPassesRemaining : '–'}
                  </span>{' '}
                  of{' '}
                  <span className="tabular-nums font-medium text-pink-100/85">
                    {passPool?.pinkPassesCap ?? 15}
                  </span>{' '}
                  PINK Passes left
                </p>
              </div>
              <h2 className="text-balance text-[clamp(2rem,4.5vw,3.35rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
                <span className="font-normal text-pink-50/95">Spin and win a</span>{' '}
                <span className="bg-gradient-to-br from-white via-pink-100 to-[#e848c7] bg-clip-text font-bold text-transparent">
                  PINK PASS
                </span>
                <span className="font-normal text-pink-50/95">!</span>
              </h2>
              <p className="mx-auto max-w-[34rem] text-base leading-relaxed text-pink-100/65 sm:mx-0 sm:text-lg sm:leading-relaxed">
                Connect your wallet, open the machine, pull the lever — up to three complimentary spins every eight hours. You only cover network fees.
              </p>
            </div>
          </div>
        )}

        {slotOpen && (
          <button
            type="button"
            className="absolute right-4 top-4 z-[210] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg text-pink-100 backdrop-blur-md transition-colors hover:bg-black/60"
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
              : 'order-2 flex w-full max-w-[min(100%,440px)] shrink-0 flex-col gap-3 sm:max-w-[480px] lg:max-w-[540px] sm:translate-x-1 lg:translate-x-5'
          }
        >
          {showSpinCooldown && <SpinCooldownBanner remainingMs={cooldownRemainingMs} />}
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
              title="Pink Puppets slot"
              src="/pinkpuppets-slot/index.html?embed=1"
              className={
                slotOpen
                  ? 'absolute inset-0 h-full w-full border-0 bg-transparent'
                  : 'absolute inset-0 h-full w-full border-0 bg-transparent pointer-events-none'
              }
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            />
            {slotOpen && connected && lastSpin && spinUiRevealReady && (
              <div
                className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-1 px-4 text-center sm:top-5"
                role="status"
                aria-live="polite"
              >
                {uiSpinKind === 'no_win' ? (
                  <>
                    <p className="max-w-[min(100%,22rem)] text-base font-bold leading-snug text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.9)] sm:text-lg">
                      Sorry — you didn&apos;t win.
                    </p>
                    <p className="max-w-[min(100%,20rem)] text-[11px] leading-snug text-pink-100/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)] sm:text-xs">
                      No prize this spin. Try again when your spins refresh.
                    </p>
                  </>
                ) : uiSpinKind === 'smile' ? (
                  <>
                    <p className="max-w-[min(100%,22rem)] text-base font-bold leading-snug text-pink-100 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)] sm:text-lg">
                      Smile — consolation prize!
                    </p>
                    <p className="max-w-[min(100%,20rem)] text-[11px] leading-snug text-pink-100/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)] sm:text-xs">
                      Three matching smile symbols — scroll down for Mint button.
                    </p>
                  </>
                ) : uiSpinKind === 'pink_pass' ? (
                  <p className="max-w-[min(100%,22rem)] text-base font-bold leading-snug text-green-300 [text-shadow:0_2px_14px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.85)] sm:text-lg">
                    You won — PINK Pass!
                  </p>
                ) : uiSpinKind === 'pink_block' ? (
                  <>
                    <p className="max-w-[min(100%,22rem)] text-sm font-semibold leading-snug text-pink-100 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)]">
                      Pink Block — side prize
                    </p>
                    <p className="max-w-[min(100%,22rem)] text-[10px] leading-snug text-pink-100/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                      Three matching block symbols — mint the delegate below.
                    </p>
                  </>
                ) : uiSpinKind === 'rs_metatron' ? (
                  <>
                    <p className="max-w-[min(100%,22rem)] text-sm font-semibold leading-snug text-cyan-200 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)]">
                      Metatron — Random Stuff
                    </p>
                    <p className="max-w-[min(100%,22rem)] text-[10px] leading-snug text-cyan-100/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                      Slot consolation — mint below (same as /random-stuff).
                    </p>
                  </>
                ) : uiSpinKind === 'rs_369' ? (
                  <>
                    <p className="max-w-[min(100%,22rem)] text-sm font-semibold leading-snug text-cyan-200 [text-shadow:0_2px_12px_rgba(0,0,0,0.95)]">
                      369 — Random Stuff
                    </p>
                    <p className="max-w-[min(100%,22rem)] text-[10px] leading-snug text-cyan-100/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                      Slot consolation — mint below (same as /random-stuff).
                    </p>
                  </>
                ) : null}
              </div>
            )}
            {!slotOpen && (
              <button
                type="button"
                className="absolute inset-0 z-10 cursor-pointer rounded-lg bg-transparent"
                onClick={openSlotModal}
                aria-label="Slot öffnen"
              />
            )}
          </div>
          {!slotOpen && (
            <p className="pointer-events-none text-center text-sm leading-snug text-pink-200/60">
              Tap the machine to open
            </p>
          )}
        </div>

        {slotOpen && (
          <div className="relative z-[205] mt-4 flex w-full max-w-5xl shrink-0 flex-col items-center pb-10">
            {controlsPanel}
          </div>
        )}

        {slotOpen && connectWalletHint && (
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pink-slot-connect-wallet-title"
            onClick={() => setConnectWalletHint(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-pink-400/35 bg-[#100818]/95 px-6 py-7 text-center shadow-[0_24px_80px_-20px_rgba(236,72,153,0.55)] ring-1 ring-pink-500/25"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="pink-slot-connect-wallet-title"
                className="text-xl font-semibold tracking-tight text-white"
              >
                Connect wallet
              </p>
              <p className="mt-3 text-sm leading-relaxed text-pink-100/75">
                Connect your wallet (header) to spin — complimentary spins need your address on-chain.
              </p>
              <button
                type="button"
                className="mt-6 w-full rounded-xl border border-white/15 bg-gradient-to-r from-pink-600 to-fuchsia-700 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                onClick={() => setConnectWalletHint(false)}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
