import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { useWallet } from '../contexts/WalletContext';
import {
  getOrdinalAddress,
  sendBitcoinViaUnisat,
  sendBitcoinViaXverse,
  sendBitcoinViaOKX,
} from '../utils/wallet';
import { WalletConnect } from '../components/WalletConnect';
import { UnisatTaprootModeWarning } from '../components/UnisatTaprootModeWarning';
import {
  fetchSpikesStatus,
  fetchSpikesMinted,
  requestSpikesQuote,
  fetchSpikesOrder,
  spikesImageUrl,
  isTaprootAddress,
  type SpikesStatus,
  type SpikesQuote,
  type SpikesOrder,
  type SpikesMint,
} from '../services/spikesService';

const HERO_ITEM = '0001';
const SPIKES_MUSIC = '/audio/spikes.mp3';

function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

type Phase = 'idle' | 'quoting' | 'awaiting_payment' | 'minting' | 'done' | 'error';

/* ─────────────────────────────────────────────────────────────
   Animated cyberpunk background: a receding synthwave neon grid
   (cyan horizon + magenta floor), drifting "data-bit" particles
   and a slow neon horizon glow. Pure canvas, pointer-events-none.
   ───────────────────────────────────────────────────────────── */
const NeonGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const bits: Array<{ x: number; y: number; s: number; v: number; c: string; a: number }> = [];
    const COLORS = ['#22e3ff', '#ff2bd6', '#7b5cff', '#8affff'];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bits.length = 0;
      const n = Math.min(90, Math.floor((w * h) / 22000));
      for (let i = 0; i < n; i++) {
        bits.push({
          x: Math.random() * w,
          y: Math.random() * h,
          s: 1 + Math.random() * 2.5,
          v: 0.15 + Math.random() * 0.7,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          a: 0.2 + Math.random() * 0.6,
        });
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (ts: number) => {
      const t = ts * 0.001;
      ctx.clearRect(0, 0, w, h);

      // horizon line where the two planes meet
      const horizon = h * 0.52;

      // ── upper neon horizon glow ──
      const glow = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, Math.max(w, h) * 0.7);
      glow.addColorStop(0, 'rgba(255,43,214,0.16)');
      glow.addColorStop(0.25, 'rgba(123,92,255,0.10)');
      glow.addColorStop(0.6, 'rgba(34,227,255,0.04)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // ── receding floor grid (synthwave) ──
      ctx.save();
      ctx.lineWidth = 1;
      const vanishX = w / 2;

      // vertical lines converging to the vanishing point
      const cols = 24;
      for (let i = 0; i <= cols; i++) {
        const f = (i / cols) * 2 - 1; // -1 .. 1
        const bx = vanishX + f * w * 1.6;
        const hue = i % 2 === 0 ? 'rgba(34,227,255,0.35)' : 'rgba(255,43,214,0.28)';
        ctx.strokeStyle = hue;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }

      // horizontal lines scrolling toward the viewer
      const speed = (t * 0.35) % 1;
      const rows = 16;
      for (let i = 0; i < rows; i++) {
        const p = (i + speed) / rows; // 0..1
        const y = horizon + Math.pow(p, 2.2) * (h - horizon);
        const alpha = 0.10 + p * 0.4;
        ctx.strokeStyle = `rgba(34,227,255,${alpha})`;
        ctx.lineWidth = 0.5 + p * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // ── drifting data-bit particles (upper half) ──
      for (const b of bits) {
        b.y -= b.v;
        if (b.y < -4) { b.y = h + 4; b.x = Math.random() * w; }
        ctx.globalAlpha = b.a * (0.5 + 0.5 * Math.sin(t * 2 + b.x));
        ctx.fillStyle = b.c;
        ctx.shadowColor = b.c;
        ctx.shadowBlur = 8;
        ctx.fillRect(b.x, b.y, b.s, b.s);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} />;
};

export const SpikesPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [status, setStatus] = useState<SpikesStatus | null>(null);
  const [minted, setMinted] = useState<SpikesMint[]>([]);
  const [taproot, setTaproot] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [quote, setQuote] = useState<SpikesQuote | null>(null);
  const [order, setOrder] = useState<SpikesOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<'addr' | 'amount' | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payTxid, setPayTxid] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicOn) {
      audio.pause();
      setMusicOn(false);
    } else {
      audio.volume = 0.16;
      audio.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  }, [musicOn]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.16;
    audio.loop = true;
    audio.play().then(() => setMusicOn(true)).catch(() => { /* autoplay blocked */ });
    const startOnFirstGesture = () => {
      if (audio.paused) {
        audio.play().then(() => setMusicOn(true)).catch(() => {});
      }
      window.removeEventListener('pointerdown', startOnFirstGesture);
      window.removeEventListener('keydown', startOnFirstGesture);
      window.removeEventListener('touchstart', startOnFirstGesture);
    };
    window.addEventListener('pointerdown', startOnFirstGesture);
    window.addEventListener('keydown', startOnFirstGesture);
    window.addEventListener('touchstart', startOnFirstGesture);
    return () => {
      window.removeEventListener('pointerdown', startOnFirstGesture);
      window.removeEventListener('keydown', startOnFirstGesture);
      window.removeEventListener('touchstart', startOnFirstGesture);
      audio.pause();
    };
  }, []);

  const active = status?.active === true;
  const walletConnected = walletState?.connected === true;
  const unisatTaprootMode =
    walletConnected &&
    walletState.walletType === 'unisat' &&
    (walletState.accounts?.[0]?.address || '').startsWith('bc1p');

  const refreshStatus = useCallback(() => {
    fetchSpikesStatus().then(setStatus).catch(() => {});
    fetchSpikesMinted().then(setMinted).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 20000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!status) return;
    const maxAllowed = Math.max(1, Math.min(status.maxPerTx ?? 5, status.available ?? 5));
    setQuantity((q) => Math.min(Math.max(1, q), maxAllowed));
  }, [status]);

  useEffect(() => {
    if (taproot) return;
    const addr = getOrdinalAddress(walletState?.accounts || []);
    if (addr && addr.startsWith('bc1p')) setTaproot(addr);
  }, [walletState, taproot]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (!quote) { setQrDataUrl(''); return; }
    const uri = `bitcoin:${quote.paymentAddress}?amount=${satsToBtc(quote.amountSats)}`;
    QRCode.toDataURL(uri, { width: 240, margin: 1, color: { dark: '#05010a', light: '#8affff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [quote]);

  const pollOrder = useCallback((orderId: string) => {
    stopPolling();
    const tick = async () => {
      try {
        const o = await fetchSpikesOrder(orderId);
        setOrder(o);
        if (o.status === 'paid' || o.status === 'minting') setPhase('minting');
        if (o.status === 'minted') {
          setPhase('done');
          stopPolling();
          refreshStatus();
        }
        if (o.status === 'expired' || o.status === 'failed') {
          setPhase('error');
          setError(o.error || (o.status === 'expired' ? 'Order expired — please start again.' : 'Mint failed — please try again.'));
          stopPolling();
        }
      } catch { /* keep polling */ }
    };
    tick();
    pollRef.current = setInterval(tick, 7000);
  }, [refreshStatus, stopPolling]);

  const payWithWallet = useCallback(async (q: SpikesQuote) => {
    setPayError(null);
    setPayTxid(null);
    const wt = walletState?.walletType;
    if (!wt) {
      setPayError('No wallet connected — you can still pay manually to the address below.');
      return;
    }
    const amountBtc = q.amountSats / 100_000_000;
    setPaying(true);
    try {
      let txid: string | undefined;
      if (wt === 'unisat') txid = await sendBitcoinViaUnisat(q.paymentAddress, amountBtc);
      else if (wt === 'okx') txid = await sendBitcoinViaOKX(q.paymentAddress, amountBtc);
      else txid = await sendBitcoinViaXverse(q.paymentAddress, amountBtc);
      if (txid) setPayTxid(txid);
    } catch (e: any) {
      setPayError(e?.message || 'Payment was cancelled or failed. You can still pay manually to the address below.');
    } finally {
      setPaying(false);
    }
  }, [walletState]);

  const handleGetQuote = useCallback(async () => {
    setError(null);
    if (!walletConnected) {
      setShowWalletConnect(true);
      return;
    }
    const addr = taproot.trim();
    if (!isTaprootAddress(addr)) {
      setError('Please enter a valid taproot address (bc1p…) — this is where your Spikes inscription will be delivered.');
      return;
    }
    setPhase('quoting');
    try {
      const q = await requestSpikesQuote(addr, quantity);
      setQuote(q);
      setOrder(null);
      setPhase('awaiting_payment');
      pollOrder(q.orderId);
      void payWithWallet(q);
    } catch (e: any) {
      setPhase('error');
      setError(e?.message || 'Could not create an order.');
    }
  }, [taproot, quantity, pollOrder, walletConnected, payWithWallet]);

  const reset = useCallback(() => {
    stopPolling();
    setQuote(null);
    setOrder(null);
    setError(null);
    setPayError(null);
    setPayTxid(null);
    setPaying(false);
    setPhase('idle');
  }, [stopPolling]);

  const copy = useCallback((text: string, which: 'addr' | 'amount') => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }, []);

  const secondsLeft = quote?.expiresAt ? Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - now) / 1000)) : 0;
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="relative min-h-screen overflow-hidden text-[#d8faff]" style={{ backgroundColor: '#05010a', fontFamily: "'Courier New', Courier, monospace" }}>
      <style>{`
        @keyframes spkTitleGlow {
          0%,100% { text-shadow: 0 0 10px #22e3ff, 0 0 28px #22e3ffaa, 0 0 60px #ff2bd655; }
          50% { text-shadow: 0 0 16px #8affff, 0 0 42px #22e3ff, 0 0 80px #ff2bd6aa; }
        }
        @keyframes spkGlitch {
          0%,92%,100% { transform: translate(0,0); }
          93% { transform: translate(-2px,1px); }
          95% { transform: translate(2px,-1px); }
          97% { transform: translate(-1px,1px); }
        }
        @keyframes spkScan {
          0% { background-position: 0 0; }
          100% { background-position: 0 100vh; }
        }
        .spk-scanlines::after {
          content: '';
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,255,255,0.025) 3px, rgba(0,0,0,0) 4px);
          animation: spkScan 8s linear infinite;
        }
        .spk-border { border: 1px solid rgba(34,227,255,0.35); box-shadow: 0 0 18px rgba(34,227,255,0.10), inset 0 0 18px rgba(255,43,214,0.05); }
      `}</style>

      <NeonGrid />
      <div className="spk-scanlines" />

      {/* radial neon vignette */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0, background: 'radial-gradient(1200px 600px at 50% -5%, rgba(34,227,255,0.12), transparent), radial-gradient(900px 500px at 50% 105%, rgba(255,43,214,0.12), transparent)' }} />

      <div className="relative" style={{ zIndex: 2 }}>
        {/* top bar */}
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-[#22e3ff]/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#22e3ff] transition hover:bg-[#22e3ff]/10"
          >
            ← Home
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#ff2bd6]/80">On Bitcoin</span>
        </div>

        {/* hero */}
        <header className="mx-auto max-w-5xl px-4 pb-6 pt-2 text-center sm:px-8">
          <img
            src={spikesImageUrl(HERO_ITEM)}
            alt="Spikes"
            className="mx-auto mb-6 h-40 w-40 rounded-2xl border border-[#22e3ff]/50 object-cover shadow-[0_18px_60px_-12px_rgba(34,227,255,0.55)] sm:h-52 sm:w-52"
          />
          <h1
            className="bg-gradient-to-b from-[#8affff] via-[#22e3ff] to-[#ff2bd6] bg-clip-text text-5xl font-black tracking-[0.15em] text-transparent sm:text-7xl"
            style={{ animation: 'spkTitleGlow 4s ease-in-out infinite, spkGlitch 7s steps(1) infinite' }}
          >
            SPIKES
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#d8faff]/70 sm:text-base">
            A limited set of {status?.total ?? 64} techwear renegades, inscribed on-chain and linked to a single
            parent inscription — verifiable, provenance-backed Bitcoin ordinals. Pay in BTC, receive your Spike
            straight to your taproot wallet.
          </p>

          {/* supply + price */}
          <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-6 text-sm">
            <div className="spk-border rounded-xl bg-black/40 px-5 py-3">
              <div className="text-[10px] uppercase tracking-widest text-[#22e3ff]/70">Minted</div>
              <div className="text-xl font-bold text-[#8affff]">{status ? `${status.minted} / ${status.total}` : '—'}</div>
            </div>
            <div className="spk-border rounded-xl bg-black/40 px-5 py-3">
              <div className="text-[10px] uppercase tracking-widest text-[#22e3ff]/70">Price</div>
              <div className="text-xl font-bold text-[#8affff]">{status?.priceSats ? `${status.priceSats.toLocaleString()} sats` : '10,000 sats'}<span className="text-xs text-[#d8faff]/50"> + fees</span></div>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-[11px] leading-relaxed text-[#d8faff]/45">
            {(status?.priceSats ?? 10000).toLocaleString()} sats mint + on-chain inscription &amp; network fees
            (typically ≈ <span className="text-[#22e3ff]/90">5,000–10,000 sats</span>, varies with the current mempool).
            The exact amount is always shown before you pay — no hidden costs.
          </p>
        </header>

        {/* mint panel */}
        <main className="mx-auto max-w-2xl px-4 pb-24 sm:px-8">
          <section className="spk-border rounded-2xl bg-gradient-to-b from-[#0b0616]/90 to-[#07030f]/90 p-6 backdrop-blur-sm sm:p-8">
            {!active && (
              <div className="rounded-xl border border-[#22e3ff]/30 bg-[#22e3ff]/5 p-5 text-center">
                <div className="text-lg font-bold text-[#8affff]">Coming soon</div>
                <p className="mt-1 text-sm text-[#d8faff]/60">The Spikes mint is not live yet. Check back shortly.</p>
              </div>
            )}

            {active && (phase === 'idle' || phase === 'quoting' || phase === 'error') && (
              <>
                <div className="mb-4"><UnisatTaprootModeWarning /></div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#22e3ff]/80">
                  Your taproot address (bc1p…)
                </label>
                <input
                  value={taproot}
                  onChange={(e) => setTaproot(e.target.value)}
                  placeholder="bc1p…"
                  spellCheck={false}
                  className="w-full rounded-xl border border-[#22e3ff]/30 bg-black/50 px-4 py-3 font-mono text-sm text-[#8affff] outline-none transition focus:border-[#22e3ff] focus:shadow-[0_0_16px_rgba(34,227,255,0.3)]"
                />
                <p className="mt-2 text-[11px] leading-relaxed text-[#d8faff]/45">
                  This is where your Spike inscription is delivered. Connect your wallet to pay in one click —
                  your <span className="text-[#22e3ff]/90">Taproot</span> address is filled in automatically.
                </p>

                {(() => {
                  const maxAllowed = Math.max(1, Math.min(status?.maxPerTx ?? 5, status?.available ?? 5));
                  if (maxAllowed <= 1) return null;
                  return (
                    <div className="mt-5">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#22e3ff]/80">
                        Quantity
                      </label>
                      <div className="flex gap-2">
                        {Array.from({ length: maxAllowed }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setQuantity(n)}
                            className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${
                              quantity === n
                                ? 'border-[#22e3ff] bg-[#22e3ff]/20 text-[#8affff] shadow-[0_0_16px_rgba(34,227,255,0.3)]'
                                : 'border-[#22e3ff]/25 bg-black/40 text-[#d8faff]/60 hover:border-[#22e3ff]/60'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-[#d8faff]/45">
                        Mint up to {maxAllowed} at once — all inscribed in one transaction (cheaper on fees) and sent to your Taproot address.
                      </p>
                    </div>
                  );
                })()}

                {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
                <button
                  onClick={handleGetQuote}
                  disabled={phase === 'quoting' || (status !== null && status.available <= 0) || unisatTaprootMode}
                  className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#22e3ff] via-[#7b5cff] to-[#ff2bd6] py-3.5 text-base font-black uppercase tracking-widest text-[#05010a] shadow-[0_10px_30px_-8px_rgba(34,227,255,0.6)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === 'quoting'
                    ? 'Preparing…'
                    : (status && status.available <= 0)
                      ? 'Sold out'
                      : unisatTaprootMode
                        ? 'Switch UniSat to payment address'
                        : walletConnected
                          ? (quantity > 1 ? `Mint ${quantity} Spikes` : 'Mint a Spike')
                          : 'Connect wallet to mint'}
                </button>
                {!walletConnected && (
                  <p className="mt-3 cursor-pointer text-center text-[11px] text-[#d8faff]/45 hover:text-[#22e3ff]" onClick={() => setShowWalletConnect(true)}>
                    Connect your wallet to mint
                  </p>
                )}
              </>
            )}

            {active && quote && (phase === 'awaiting_payment' || phase === 'minting') && (
              <div className="text-center">
                {phase === 'awaiting_payment' && (
                  <>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#22e3ff]/80">Send exactly</div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-3xl font-black text-[#8affff]">{quote.amountSats.toLocaleString()}</span>
                      <span className="text-sm text-[#d8faff]/60">sats</span>
                      <button onClick={() => copy(String(quote.amountSats), 'amount')} className="ml-1 rounded border border-[#22e3ff]/30 px-2 py-0.5 text-[10px] uppercase text-[#22e3ff]">{copied === 'amount' ? 'copied' : 'copy'}</button>
                    </div>
                    <div className="mt-1 text-[11px] text-[#d8faff]/45">≈ {satsToBtc(quote.amountSats)} BTC · expires in {mmss}</div>

                    {quote.breakdown && (
                      <div className="mx-auto mt-4 max-w-xs rounded-lg border border-[#22e3ff]/20 bg-black/40 px-4 py-3 text-left text-[11px] text-[#d8faff]/60">
                        <div className="mb-1 text-[10px] uppercase tracking-widest text-[#22e3ff]/70">Breakdown</div>
                        <div className="flex justify-between"><span>Mint</span><span>{quote.breakdown.priceSats.toLocaleString()} sats</span></div>
                        <div className="flex justify-between"><span>Inscription fee{quote.feeRate ? ` (${quote.feeRate} sat/vB)` : ''}</span><span>{quote.breakdown.feeSats.toLocaleString()} sats</span></div>
                        <div className="flex justify-between"><span>Postage</span><span>{quote.breakdown.postageSats.toLocaleString()} sats</span></div>
                        <div className="flex justify-between"><span>Fee buffer</span><span>{quote.breakdown.bufferSats.toLocaleString()} sats</span></div>
                        <div className="mt-1 flex justify-between border-t border-[#22e3ff]/15 pt-1 font-bold text-[#8affff]"><span>Total</span><span>{quote.amountSats.toLocaleString()} sats</span></div>
                      </div>
                    )}

                    {unisatTaprootMode && <div className="mt-4 text-left"><UnisatTaprootModeWarning /></div>}

                    {walletConnected && (
                      <button
                        onClick={() => payWithWallet(quote)}
                        disabled={paying || unisatTaprootMode}
                        className="mx-auto mt-4 flex w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-[#22e3ff] via-[#7b5cff] to-[#ff2bd6] py-3 text-sm font-black uppercase tracking-widest text-[#05010a] shadow-[0_10px_30px_-8px_rgba(34,227,255,0.6)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {unisatTaprootMode ? 'Switch UniSat to payment address' : paying ? 'Opening wallet…' : payTxid ? 'Payment sent ✓' : 'Pay with wallet'}
                      </button>
                    )}
                    {payTxid && (
                      <a
                        href={`https://mempool.space/tx/${payTxid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block break-all text-[11px] text-[#22e3ff]/80 underline hover:text-[#22e3ff]"
                      >
                        View tx: {payTxid.slice(0, 12)}…{payTxid.slice(-8)}
                      </a>
                    )}
                    {payError && (
                      <div className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{payError}</div>
                    )}

                    <div className="my-4 text-[11px] uppercase tracking-widest text-[#d8faff]/35">— or scan / send manually —</div>

                    {qrDataUrl && <img src={qrDataUrl} alt="payment QR" className="mx-auto my-3 rounded-xl border border-[#22e3ff]/30" />}

                    <div className="mx-auto max-w-md rounded-xl border border-[#22e3ff]/25 bg-black/50 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-[#22e3ff]/70">Payment address</div>
                      <div className="mt-1 break-all font-mono text-xs text-[#d8faff]/90">{quote.paymentAddress}</div>
                      <button onClick={() => copy(quote.paymentAddress, 'addr')} className="mt-2 rounded border border-[#22e3ff]/30 px-3 py-1 text-[10px] uppercase text-[#22e3ff]">{copied === 'addr' ? 'copied' : 'copy address'}</button>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#d8faff]/60">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#22e3ff]" />
                      Waiting for your payment…
                    </div>
                    <p className="mt-2 text-[11px] text-[#d8faff]/40">
                      {quote.quantity && quote.quantity > 1
                        ? <>Reserved: <span className="text-[#22e3ff]/90">{quote.quantity} items</span>. As soon as your payment hits the mempool, all are inscribed in one batch and sent automatically.</>
                        : <>Reserved item: <span className="text-[#22e3ff]/90">{quote.name}</span>. As soon as your payment hits the mempool, your Spike is inscribed and sent automatically.</>}
                    </p>
                  </>
                )}

                {phase === 'minting' && (
                  <div className="py-6">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#22e3ff]/30 border-t-[#22e3ff]" />
                    <div className="text-lg font-bold text-[#8affff]">Payment received — inscribing…</div>
                    <p className="mt-1 text-sm text-[#d8faff]/60">Your Spike is being minted and sent to your taproot address. This can take a moment.</p>
                  </div>
                )}

                <button onClick={reset} className="mt-5 text-[11px] uppercase tracking-widest text-[#d8faff]/40 underline hover:text-[#d8faff]/70">Cancel</button>
              </div>
            )}

            {phase === 'done' && order?.inscriptionId && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#22e3ff]/15 text-3xl">⚡</div>
                <div className="text-xl font-black text-[#8affff]">Jacked in!</div>
                {order.items && order.items.length > 1 ? (
                  <>
                    <p className="mt-1 text-sm text-[#d8faff]/60">Your {order.items.length} Spikes were inscribed and sent to your wallet.</p>
                    <div className="mx-auto my-4 grid max-w-md grid-cols-3 gap-3 sm:grid-cols-5">
                      {order.items.map((it) => (
                        <a
                          key={it.itemId}
                          href={it.inscriptionId ? `https://ordinals.com/inscription/${it.inscriptionId}` : undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-xl border border-[#22e3ff]/30 bg-black/40 transition hover:border-[#22e3ff]/60"
                        >
                          <img src={spikesImageUrl(it.itemId)} alt={it.name || it.itemId} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                          <div className="truncate px-1.5 py-1 text-[9px] text-[#d8faff]/60">{it.name || it.itemId}</div>
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-[#d8faff]/60">Your Spike was inscribed and sent to your wallet.</p>
                    <img src={spikesImageUrl(order.itemId)} alt={order.itemId} className="mx-auto my-4 h-40 w-40 rounded-xl border border-[#22e3ff]/40 object-cover" />
                    <a
                      href={`https://ordinals.com/inscription/${order.inscriptionId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block break-all rounded-lg border border-[#22e3ff]/40 px-4 py-2 font-mono text-xs text-[#22e3ff] transition hover:bg-[#22e3ff]/10"
                    >
                      {order.inscriptionId}
                    </a>
                  </>
                )}
                <div>
                  <button onClick={reset} className="mt-5 rounded-xl bg-gradient-to-r from-[#22e3ff] to-[#ff2bd6] px-6 py-2.5 text-sm font-black uppercase tracking-widest text-[#05010a]">Mint another</button>
                </div>
              </div>
            )}
          </section>

          {/* recent mints */}
          {minted.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.35em] text-[#22e3ff]/80">Recent Mints</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {minted.slice(0, 15).map((m) => (
                  <a
                    key={m.item_id}
                    href={m.inscription_id ? `https://ordinals.com/inscription/${m.inscription_id}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-xl border border-[#22e3ff]/20 bg-black/40 transition hover:border-[#22e3ff]/50"
                  >
                    <img src={spikesImageUrl(m.item_id)} alt={m.name} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                    <div className="truncate px-2 py-1 text-[10px] text-[#d8faff]/60">{m.name}</div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {showWalletConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowWalletConnect(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#22e3ff]/30 bg-[#07030f] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#22e3ff]">Connect Wallet</h3>
              <button onClick={() => setShowWalletConnect(false)} className="text-[#d8faff]/50 hover:text-[#d8faff]">✕</button>
            </div>
            <WalletConnect onConnected={() => setShowWalletConnect(false)} />
          </div>
        </div>
      )}

      {/* ambient music (dezent, per button) */}
      <audio ref={audioRef} src={SPIKES_MUSIC} loop preload="none" />
      <button
        onClick={toggleMusic}
        aria-label={musicOn ? 'Mute music' : 'Play music'}
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-xs font-bold tracking-wide backdrop-blur-md transition-all duration-300 ${
          musicOn
            ? 'border-[#22e3ff]/70 bg-[#22e3ff]/20 text-[#8affff] shadow-lg shadow-[#22e3ff]/30'
            : 'animate-pulse border-[#22e3ff]/50 bg-black/70 text-[#22e3ff] shadow-lg shadow-black/50 hover:border-[#22e3ff] hover:bg-black/80'
        }`}
      >
        {musicOn ? (
          <>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            <span className="hidden sm:inline">Music On</span>
            <span className="flex h-3 items-end gap-0.5">
              <span className="w-0.5 animate-pulse bg-[#8affff]" style={{ height: '60%' }} />
              <span className="w-0.5 animate-pulse bg-[#8affff]" style={{ height: '100%', animationDelay: '0.15s' }} />
              <span className="w-0.5 animate-pulse bg-[#8affff]" style={{ height: '40%', animationDelay: '0.3s' }} />
            </span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l11-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="hidden sm:inline">Play Music</span>
          </>
        )}
      </button>
    </div>
  );
};

export default SpikesPage;
