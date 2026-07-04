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
  fetchHighRollersStatus,
  fetchHighRollersMinted,
  requestHighRollersQuote,
  fetchHighRollersOrder,
  highRollersImageUrl,
  isTaprootAddress,
  type HighRollersStatus,
  type HighRollersQuote,
  type HighRollersOrder,
  type HighRollersMint,
} from '../services/highRollersService';

const HERO_ITEM = '0001';
const GOLD = '#e8b64b';
const BG_IMAGE = '/images/high-rollers/highrollers-bg.png';
const HR_MUSIC = '/audio/high-rollers-loop.wav';

function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

type Phase = 'idle' | 'quoting' | 'awaiting_payment' | 'minting' | 'done' | 'error';

export const HighRollersPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [status, setStatus] = useState<HighRollersStatus | null>(null);
  const [minted, setMinted] = useState<HighRollersMint[]>([]);
  const [taproot, setTaproot] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [quote, setQuote] = useState<HighRollersQuote | null>(null);
  const [order, setOrder] = useState<HighRollersOrder | null>(null);
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
      audio.volume = 0.16; // dezent
      audio.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  }, [musicOn]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.16; // dezent
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
  // UniSat connected in Taproot mode: paying from here can destroy inscriptions.
  // Block minting until the user switches to the payment (Native SegWit) address.
  const unisatTaprootMode =
    walletConnected &&
    walletState.walletType === 'unisat' &&
    (walletState.accounts?.[0]?.address || '').startsWith('bc1p');

  const refreshStatus = useCallback(() => {
    fetchHighRollersStatus().then(setStatus).catch(() => {});
    fetchHighRollersMinted().then(setMinted).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 20000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  // 1s tick for the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Prefill taproot from a connected wallet (convenience only — payment can come
  // from anywhere; this address is only where the inscription is delivered).
  useEffect(() => {
    if (taproot) return;
    const addr = getOrdinalAddress(walletState?.accounts || []);
    if (addr && addr.startsWith('bc1p')) setTaproot(addr);
  }, [walletState, taproot]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Build the payment QR whenever a quote arrives.
  useEffect(() => {
    if (!quote) { setQrDataUrl(''); return; }
    const uri = `bitcoin:${quote.paymentAddress}?amount=${satsToBtc(quote.amountSats)}`;
    QRCode.toDataURL(uri, { width: 240, margin: 1, color: { dark: '#0a0a0a', light: '#f5e6c8' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [quote]);

  const pollOrder = useCallback((orderId: string) => {
    stopPolling();
    const tick = async () => {
      try {
        const o = await fetchHighRollersOrder(orderId);
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

  // Opens the connected wallet to send the exact quote amount to the payment
  // address. The backend detects the payment in the mempool regardless — this
  // just triggers the familiar wallet popup instead of manual copy/paste.
  const payWithWallet = useCallback(async (q: HighRollersQuote) => {
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
    // If no wallet is connected, open the connect modal first (familiar flow).
    if (!walletConnected) {
      setShowWalletConnect(true);
      return;
    }
    const addr = taproot.trim();
    if (!isTaprootAddress(addr)) {
      setError('Please enter a valid taproot address (bc1p…) — this is where your High Roller will be delivered.');
      return;
    }
    setPhase('quoting');
    try {
      const q = await requestHighRollersQuote(addr);
      setQuote(q);
      setOrder(null);
      setPhase('awaiting_payment');
      pollOrder(q.orderId);
      // Immediately open the wallet popup to pay.
      void payWithWallet(q);
    } catch (e: any) {
      setPhase('error');
      setError(e?.message || 'Could not create an order.');
    }
  }, [taproot, pollOrder, walletConnected, payWithWallet]);

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
    <div
      className="relative min-h-screen text-[#f5e6c8]"
      style={{
        backgroundColor: '#0a0805',
        backgroundImage: `radial-gradient(1100px 560px at 50% -8%, rgba(232,182,75,0.18), transparent), linear-gradient(to bottom, rgba(10,8,5,0.20), rgba(10,8,5,0.45) 45%, rgba(10,8,5,0.92)), url(${BG_IMAGE})`,
        backgroundSize: 'cover, cover, cover',
        backgroundPosition: 'center top, center, center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed, fixed, fixed',
      }}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg border border-[#e8b64b]/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#e8b64b] transition hover:bg-[#e8b64b]/10"
        >
          ← Home
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e8b64b]/70">On Bitcoin</span>
      </div>

      {/* hero */}
      <header className="mx-auto max-w-5xl px-4 pb-6 pt-2 text-center sm:px-8">
        <img
          src={highRollersImageUrl(HERO_ITEM)}
          alt="High Rollers"
          className="mx-auto mb-6 h-40 w-40 rounded-2xl border border-[#e8b64b]/40 object-cover shadow-[0_18px_60px_-15px_rgba(232,182,75,0.5)] sm:h-52 sm:w-52"
        />
        <h1 className="bg-gradient-to-b from-[#f7e3a8] via-[#e8b64b] to-[#a9772a] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
          HIGH ROLLERS
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#f5e6c8]/70 sm:text-base">
          A limited set of {status?.total ?? 225} hand-crafted high rollers, inscribed on-chain and
          linked to a single parent inscription — verifiable, provenance-backed Bitcoin ordinals.
          Pay in BTC, receive your High Roller straight to your taproot wallet.
        </p>

        {/* supply + price */}
        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-6 text-sm">
          <div className="rounded-xl border border-[#e8b64b]/25 bg-black/30 px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#e8b64b]/60">Minted</div>
            <div className="text-xl font-bold text-[#f7e3a8]">{status ? `${status.minted} / ${status.total}` : '—'}</div>
          </div>
          <div className="rounded-xl border border-[#e8b64b]/25 bg-black/30 px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#e8b64b]/60">Price</div>
            <div className="text-xl font-bold text-[#f7e3a8]">{status?.priceSats ? `${status.priceSats.toLocaleString()} sats` : '5,000 sats'}<span className="text-xs text-[#f5e6c8]/50"> + fees</span></div>
          </div>
        </div>
      </header>

      {/* mint panel */}
      <main className="mx-auto max-w-2xl px-4 pb-20 sm:px-8">
        <section className="rounded-2xl border border-[#e8b64b]/25 bg-gradient-to-b from-[#151009] to-[#0d0a06] p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.9)] sm:p-8">
          {!active && (
            <div className="rounded-xl border border-[#e8b64b]/30 bg-[#e8b64b]/5 p-5 text-center">
              <div className="text-lg font-bold text-[#f7e3a8]">Coming soon</div>
              <p className="mt-1 text-sm text-[#f5e6c8]/60">The High Rollers mint is not live yet. Check back shortly.</p>
            </div>
          )}

          {active && (phase === 'idle' || phase === 'quoting' || phase === 'error') && (
            <>
              <div className="mb-4"><UnisatTaprootModeWarning /></div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#e8b64b]/70">
                Your taproot address (bc1p…)
              </label>
              <input
                value={taproot}
                onChange={(e) => setTaproot(e.target.value)}
                placeholder="bc1p…"
                spellCheck={false}
                className="w-full rounded-xl border border-[#e8b64b]/30 bg-black/40 px-4 py-3 font-mono text-sm text-[#f5e6c8] outline-none transition focus:border-[#e8b64b]"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-[#f5e6c8]/45">
                This is where your High Roller inscription is delivered. Connect your wallet to pay in one click —
                your <span className="text-[#e8b64b]/80">Taproot</span> address is filled in automatically.
              </p>
              {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
              <button
                onClick={handleGetQuote}
                disabled={phase === 'quoting' || (status !== null && status.available <= 0) || unisatTaprootMode}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#f7e3a8] via-[#e8b64b] to-[#c9902f] py-3.5 text-base font-black uppercase tracking-widest text-[#1a1206] shadow-[0_10px_30px_-10px_rgba(232,182,75,0.6)] transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === 'quoting'
                  ? 'Preparing…'
                  : (status && status.available <= 0)
                    ? 'Sold out'
                    : unisatTaprootMode
                      ? 'Switch UniSat to payment address'
                      : walletConnected
                        ? 'Mint a High Roller'
                        : 'Connect wallet to mint'}
              </button>
              {!walletConnected && (
                <p className="mt-3 cursor-pointer text-center text-[11px] text-[#f5e6c8]/45 hover:text-[#e8b64b]" onClick={() => setShowWalletConnect(true)}>
                  Connect your wallet to mint
                </p>
              )}
            </>
          )}

          {active && quote && (phase === 'awaiting_payment' || phase === 'minting') && (
            <div className="text-center">
              {phase === 'awaiting_payment' && (
                <>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#e8b64b]/70">Send exactly</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-black text-[#f7e3a8]">{quote.amountSats.toLocaleString()}</span>
                    <span className="text-sm text-[#f5e6c8]/60">sats</span>
                    <button onClick={() => copy(String(quote.amountSats), 'amount')} className="ml-1 rounded border border-[#e8b64b]/30 px-2 py-0.5 text-[10px] uppercase text-[#e8b64b]">{copied === 'amount' ? 'copied' : 'copy'}</button>
                  </div>
                  <div className="mt-1 text-[11px] text-[#f5e6c8]/45">≈ {satsToBtc(quote.amountSats)} BTC · expires in {mmss}</div>

                  {unisatTaprootMode && <div className="mt-4 text-left"><UnisatTaprootModeWarning /></div>}

                  {walletConnected && (
                    <button
                      onClick={() => payWithWallet(quote)}
                      disabled={paying || unisatTaprootMode}
                      className="mx-auto mt-4 flex w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-[#f7e3a8] via-[#e8b64b] to-[#c9902f] py-3 text-sm font-black uppercase tracking-widest text-[#1a1206] shadow-[0_10px_30px_-10px_rgba(232,182,75,0.6)] transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unisatTaprootMode ? 'Switch UniSat to payment address' : paying ? 'Opening wallet…' : payTxid ? 'Payment sent ✓' : 'Pay with wallet'}
                    </button>
                  )}
                  {payTxid && (
                    <a
                      href={`https://mempool.space/tx/${payTxid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block break-all text-[11px] text-[#e8b64b]/80 underline hover:text-[#e8b64b]"
                    >
                      View tx: {payTxid.slice(0, 12)}…{payTxid.slice(-8)}
                    </a>
                  )}
                  {payError && (
                    <div className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{payError}</div>
                  )}

                  <div className="my-4 text-[11px] uppercase tracking-widest text-[#f5e6c8]/35">— or scan / send manually —</div>

                  {qrDataUrl && <img src={qrDataUrl} alt="payment QR" className="mx-auto my-3 rounded-xl border border-[#e8b64b]/30" />}

                  <div className="mx-auto max-w-md rounded-xl border border-[#e8b64b]/25 bg-black/40 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-[#e8b64b]/60">Payment address</div>
                    <div className="mt-1 break-all font-mono text-xs text-[#f5e6c8]/90">{quote.paymentAddress}</div>
                    <button onClick={() => copy(quote.paymentAddress, 'addr')} className="mt-2 rounded border border-[#e8b64b]/30 px-3 py-1 text-[10px] uppercase text-[#e8b64b]">{copied === 'addr' ? 'copied' : 'copy address'}</button>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#f5e6c8]/60">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#e8b64b]" />
                    Waiting for your payment…
                  </div>
                  <p className="mt-2 text-[11px] text-[#f5e6c8]/40">
                    Reserved item: <span className="text-[#e8b64b]/80">{quote.name}</span>. As soon as your payment
                    hits the mempool, your High Roller is inscribed and sent automatically.
                  </p>
                </>
              )}

              {phase === 'minting' && (
                <div className="py-6">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#e8b64b]/30 border-t-[#e8b64b]" />
                  <div className="text-lg font-bold text-[#f7e3a8]">Payment received — inscribing…</div>
                  <p className="mt-1 text-sm text-[#f5e6c8]/60">Your High Roller is being minted and sent to your taproot address. This can take a moment.</p>
                </div>
              )}

              <button onClick={reset} className="mt-5 text-[11px] uppercase tracking-widest text-[#f5e6c8]/40 underline hover:text-[#f5e6c8]/70">Cancel</button>
            </div>
          )}

          {phase === 'done' && order?.inscriptionId && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8b64b]/15 text-3xl">🎰</div>
              <div className="text-xl font-black text-[#f7e3a8]">You're in the club!</div>
              <p className="mt-1 text-sm text-[#f5e6c8]/60">Your High Roller was inscribed and sent to your wallet.</p>
              <img src={highRollersImageUrl(order.itemId)} alt={order.itemId} className="mx-auto my-4 h-40 w-40 rounded-xl border border-[#e8b64b]/40 object-cover" />
              <a
                href={`https://ordinals.com/inscription/${order.inscriptionId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block break-all rounded-lg border border-[#e8b64b]/40 px-4 py-2 font-mono text-xs text-[#e8b64b] transition hover:bg-[#e8b64b]/10"
              >
                {order.inscriptionId}
              </a>
              <div>
                <button onClick={reset} className="mt-5 rounded-xl bg-gradient-to-r from-[#f7e3a8] to-[#c9902f] px-6 py-2.5 text-sm font-black uppercase tracking-widest text-[#1a1206]">Mint another</button>
              </div>
            </div>
          )}
        </section>

        {/* recent mints */}
        {minted.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#e8b64b]/70">Recent Mints</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {minted.slice(0, 15).map((m) => (
                <a
                  key={m.item_id}
                  href={m.inscription_id ? `https://ordinals.com/inscription/${m.inscription_id}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-[#e8b64b]/20 bg-black/30 transition hover:border-[#e8b64b]/50"
                >
                  <img src={highRollersImageUrl(m.item_id)} alt={m.name} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                  <div className="truncate px-2 py-1 text-[10px] text-[#f5e6c8]/60">{m.name}</div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      {showWalletConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowWalletConnect(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#e8b64b]/30 bg-[#0d0a06] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#e8b64b]">Connect Wallet</h3>
              <button onClick={() => setShowWalletConnect(false)} className="text-[#f5e6c8]/50 hover:text-[#f5e6c8]">✕</button>
            </div>
            <WalletConnect onConnected={() => setShowWalletConnect(false)} />
          </div>
        </div>
      )}

      {/* ambient music (dezent, per button) */}
      <audio ref={audioRef} src={HR_MUSIC} loop preload="none" />
      <button
        onClick={toggleMusic}
        aria-label={musicOn ? 'Mute music' : 'Play music'}
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-xs font-bold tracking-wide backdrop-blur-md transition-all duration-300 ${
          musicOn
            ? 'border-[#e8b64b]/70 bg-[#e8b64b]/25 text-[#f7e3a8] shadow-lg shadow-[#e8b64b]/30'
            : 'animate-pulse border-[#e8b64b]/50 bg-black/70 text-[#e8b64b] shadow-lg shadow-black/50 hover:border-[#e8b64b] hover:bg-black/80'
        }`}
      >
        {musicOn ? (
          <>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            <span className="hidden sm:inline">Music On</span>
            <span className="flex h-3 items-end gap-0.5">
              <span className="w-0.5 animate-pulse bg-[#f7e3a8]" style={{ height: '60%' }} />
              <span className="w-0.5 animate-pulse bg-[#f7e3a8]" style={{ height: '100%', animationDelay: '0.15s' }} />
              <span className="w-0.5 animate-pulse bg-[#f7e3a8]" style={{ height: '40%', animationDelay: '0.3s' }} />
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

export default HighRollersPage;
