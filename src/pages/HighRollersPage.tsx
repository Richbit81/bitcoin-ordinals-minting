import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { UnisatTaprootModeWarning } from '../components/UnisatTaprootModeWarning';
import { MintFeeRateSelector } from '../components/MintFeeRateSelector';
import { useUnisatTaproot } from '../hooks/useUnisatTaproot';
import { logMinting } from '../services/mintingLog';
import { addMintPoints } from '../services/pointsService';
import {
  fetchHighRollersStatus,
  fetchHighRollersMinted,
  confirmHighRollersMint,
  highRollersImageUrl,
  type HighRollersStatus,
  type HighRollersMint,
} from '../services/highRollersService';
import {
  mintHighRollersBatch,
  highRollersVolumeMargin,
  HIGH_ROLLERS_PRICE_SATS,
  HIGH_ROLLERS_MAX_PER_TX,
  type HighRollersMintedItem,
} from '../services/highRollersMintService';

const HERO_ITEM = '0001';
const GOLD = '#e8b64b';
const BG_IMAGE = '/images/high-rollers/highrollers-bg.png';
const HR_MUSIC = '/audio/high-rollers-loop.wav';

type Phase = 'idle' | 'minting' | 'done' | 'error';

export const HighRollersPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const { resolveReceiveAddress } = useUnisatTaproot(walletState);

  const [status, setStatus] = useState<HighRollersStatus | null>(null);
  const [minted, setMinted] = useState<HighRollersMint[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [feeRate, setFeeRate] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [doneItems, setDoneItems] = useState<HighRollersMintedItem[]>([]);
  const [paymentTxid, setPaymentTxid] = useState<string | null>(null);

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
    audio.play().then(() => setMusicOn(true)).catch(() => {});
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
    fetchHighRollersStatus().then(setStatus).catch(() => {});
    fetchHighRollersMinted().then(setMinted).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 20000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  useEffect(() => {
    if (!status) return;
    const maxAllowed = Math.max(1, Math.min(status.maxPerTx ?? HIGH_ROLLERS_MAX_PER_TX, status.available ?? HIGH_ROLLERS_MAX_PER_TX));
    setQuantity((q) => Math.min(Math.max(1, q), maxAllowed));
  }, [status]);

  const reset = useCallback(() => {
    setError(null);
    setDoneItems([]);
    setPaymentTxid(null);
    setPhase('idle');
  }, []);

  const handleMint = useCallback(async () => {
    setError(null);
    if (!walletConnected) {
      setShowWalletConnect(true);
      return;
    }
    if (unisatTaprootMode) {
      setError('Switch UniSat to your payment address (Native SegWit), then reconnect.');
      return;
    }

    const { address: userAddress, error: taprootError } = await resolveReceiveAddress(walletState);
    if (taprootError || !userAddress) {
      setPhase('error');
      setError(taprootError || 'Could not resolve a taproot receive address (bc1p…).');
      return;
    }

    setPhase('minting');
    try {
      // Fresh minted list right before pick (avoid obvious collisions).
      let mintedIds = minted.map((m) => m.item_id);
      try {
        const fresh = await fetchHighRollersMinted();
        mintedIds = fresh.map((m) => m.item_id);
        setMinted(fresh);
      } catch { /* use cached */ }

      const effFee = feeRate > 0 ? feeRate : 2;
      const { paymentTxid: txid, items } = await mintHighRollersBatch(
        userAddress,
        effFee,
        walletState.walletType || 'unisat',
        quantity,
        mintedIds,
      );
      setPaymentTxid(txid || null);
      setDoneItems(items);

      for (const r of items) {
        try {
          await confirmHighRollersMint({
            itemId: r.item.itemId,
            inscriptionId: r.inscriptionId,
            ownerAddress: userAddress,
            name: r.item.name,
            orderId: r.orderId || null,
            paymentTxid: txid || null,
          });
        } catch (e) {
          console.warn('[HighRollers] confirm-mint failed:', e);
        }

        try {
          await logMinting({
            walletAddress: userAddress,
            packId: 'high-rollers',
            packName: 'High Rollers',
            cards: [{
              id: `high-rollers-${r.item.itemId}`,
              name: r.item.name,
              inscriptionId: r.inscriptionId,
              rarity: 'common',
            }],
            inscriptionIds: [r.inscriptionId],
            inscriptionId: r.inscriptionId,
            txids: r.txid ? [r.txid] : [],
            paymentTxid: txid,
            orderId: r.orderId,
            originalPendingInscriptionId: String(r.inscriptionId || '').startsWith('pending-')
              ? r.inscriptionId
              : undefined,
          });
        } catch { /* backup log */ }

        try {
          await addMintPoints(userAddress, {
            collection: 'High Rollers',
            itemName: r.item.name,
            inscriptionId: r.inscriptionId,
            txid: r.txid || null,
            source: 'high-rollers-mint',
          });
        } catch { /* points optional */ }
      }

      setPhase('done');
      refreshStatus();
    } catch (e: any) {
      setPhase('error');
      setError(e?.message || 'Mint failed.');
    }
  }, [
    walletConnected,
    unisatTaprootMode,
    resolveReceiveAddress,
    walletState,
    minted,
    feeRate,
    quantity,
    refreshStatus,
  ]);

  const maxAllowed = Math.max(1, Math.min(status?.maxPerTx ?? HIGH_ROLLERS_MAX_PER_TX, status?.available ?? HIGH_ROLLERS_MAX_PER_TX));
  const margin = highRollersVolumeMargin(quantity);
  const full = HIGH_ROLLERS_PRICE_SATS * quantity;
  const saved = full - margin;
  const effFee = feeRate > 0 ? feeRate : 2;
  const estNetworkFee = effFee * (150 + quantity * 3600);
  const estFeesAll = 546 * quantity + estNetworkFee + 1000;
  const estTotal = margin + estFeesAll;

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
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg border border-[#e8b64b]/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#e8b64b] transition hover:bg-[#e8b64b]/10"
        >
          ← Home
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e8b64b]/70">On Bitcoin</span>
      </div>

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
          A limited set of {status?.total ?? 225} high rollers, inscribed on-chain as Bitcoin ordinals.
          Pay in BTC, receive your High Roller straight to your taproot wallet.
        </p>

        <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-6 text-sm">
          <div className="rounded-xl border border-[#e8b64b]/25 bg-black/30 px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#e8b64b]/60">Minted</div>
            <div className="text-xl font-bold text-[#f7e3a8]">{status ? `${status.minted} / ${status.total}` : '—'}</div>
          </div>
          <div className="rounded-xl border border-[#e8b64b]/25 bg-black/30 px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#e8b64b]/60">Price</div>
            <div className="text-xl font-bold text-[#f7e3a8]">
              {(status?.priceSats ?? HIGH_ROLLERS_PRICE_SATS).toLocaleString()} sats
              <span className="text-xs text-[#f5e6c8]/50"> + fees</span>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-[11px] leading-relaxed text-[#f5e6c8]/45">
          {(status?.priceSats ?? HIGH_ROLLERS_PRICE_SATS).toLocaleString()} sats mint + on-chain inscription &amp; network fees.
          The exact amount is always confirmed in your wallet before you pay.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-[11px] leading-relaxed text-[#e8b64b]/70">
          Bulk deal: 2 = −5%, 3 = −10%, 4 = −15%, and
          <strong className="text-[#f7e3a8]"> mint 5 → one is free (−20%)</strong>. Inscription fees still apply per item.
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-20 sm:px-8">
        <section className="rounded-2xl border border-[#e8b64b]/25 bg-gradient-to-b from-[#151009] to-[#0d0a06] p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.9)] sm:p-8">
          {!active && (
            <div className="rounded-xl border border-[#e8b64b]/30 bg-[#e8b64b]/5 p-5 text-center">
              <div className="text-lg font-bold text-[#f7e3a8]">Coming soon</div>
              <p className="mt-1 text-sm text-[#f5e6c8]/60">The High Rollers mint is not live yet.</p>
            </div>
          )}

          {active && (phase === 'idle' || phase === 'error') && (
            <>
              <div className="mb-4"><UnisatTaprootModeWarning /></div>

              {maxAllowed > 1 && (
                <div className="mb-5">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#e8b64b]/70">
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
                            ? 'border-[#e8b64b] bg-[#e8b64b]/20 text-[#f7e3a8]'
                            : 'border-[#e8b64b]/25 bg-black/30 text-[#f5e6c8]/60 hover:border-[#e8b64b]/60'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <MintFeeRateSelector value={feeRate} onChange={setFeeRate} accent={GOLD} disabled={false} />

              <div className="mt-5 rounded-xl border border-[#e8b64b]/25 bg-black/30 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#f5e6c8]/70">Mint price{quantity > 1 ? ` (${quantity})` : ''}</span>
                  <span className="font-bold text-[#f7e3a8]">
                    {saved > 0 && <span className="mr-2 text-[#f5e6c8]/40 line-through">{full.toLocaleString()}</span>}
                    {margin.toLocaleString()} sats
                  </span>
                </div>
                {saved > 0 && (
                  <div className="text-right text-[11px] font-semibold text-green-400/90">You save {saved.toLocaleString()} sats</div>
                )}
                <div className="mt-1.5 flex items-center justify-between text-[13px] text-[#f5e6c8]/60">
                  <span>Est. inscription + network fees ({effFee} sat/vB)</span>
                  <span>≈ {estFeesAll.toLocaleString()} sats</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#e8b64b]/20 pt-2 text-base font-black text-[#f7e3a8]">
                  <span>≈ Total</span>
                  <span>{estTotal.toLocaleString()} sats</span>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-[#f5e6c8]/45">
                  Estimate based on the current fee rate — the exact amount is confirmed in your wallet before you pay.
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              <button
                onClick={handleMint}
                disabled={(status !== null && status.available <= 0) || unisatTaprootMode}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#f7e3a8] via-[#e8b64b] to-[#c9902f] py-3.5 text-base font-black uppercase tracking-widest text-[#1a1206] shadow-[0_10px_30px_-10px_rgba(232,182,75,0.6)] transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(status && status.available <= 0)
                  ? 'Sold out'
                  : unisatTaprootMode
                    ? 'Switch UniSat to payment address'
                    : walletConnected
                      ? (quantity > 1 ? `Mint ${quantity} High Rollers` : 'Mint a High Roller')
                      : 'Connect wallet to mint'}
              </button>
              {!walletConnected && (
                <p
                  className="mt-3 cursor-pointer text-center text-[11px] text-[#f5e6c8]/45 hover:text-[#e8b64b]"
                  onClick={() => setShowWalletConnect(true)}
                >
                  Connect your wallet to mint
                </p>
              )}
            </>
          )}

          {active && phase === 'minting' && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#e8b64b]/30 border-t-[#e8b64b]" />
              <div className="text-lg font-bold text-[#f7e3a8]">Preparing inscription…</div>
              <p className="mt-1 text-sm text-[#f5e6c8]/60">Confirm the payment in your wallet when prompted.</p>
            </div>
          )}

          {phase === 'done' && doneItems.length > 0 && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8b64b]/15 text-3xl">🎰</div>
              <div className="text-xl font-black text-[#f7e3a8]">You're in the club!</div>
              {doneItems.length > 1 ? (
                <>
                  <p className="mt-1 text-sm text-[#f5e6c8]/60">Your {doneItems.length} High Rollers were inscribed.</p>
                  <div className="mx-auto my-4 grid max-w-md grid-cols-3 gap-3 sm:grid-cols-5">
                    {doneItems.map((it) => (
                      <a
                        key={it.item.itemId}
                        href={it.inscriptionId ? `https://ordinals.com/inscription/${it.inscriptionId}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-xl border border-[#e8b64b]/30 bg-black/30 transition hover:border-[#e8b64b]/60"
                      >
                        <img src={highRollersImageUrl(it.item.itemId)} alt={it.item.name} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                        <div className="truncate px-1.5 py-1 text-[9px] text-[#f5e6c8]/60">{it.item.name}</div>
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-[#f5e6c8]/60">Your High Roller was inscribed and sent to your wallet.</p>
                  <img
                    src={highRollersImageUrl(doneItems[0].item.itemId)}
                    alt={doneItems[0].item.name}
                    className="mx-auto my-4 h-40 w-40 rounded-xl border border-[#e8b64b]/40 object-cover"
                  />
                  <a
                    href={`https://ordinals.com/inscription/${doneItems[0].inscriptionId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block break-all rounded-lg border border-[#e8b64b]/40 px-4 py-2 font-mono text-xs text-[#e8b64b] transition hover:bg-[#e8b64b]/10"
                  >
                    {doneItems[0].inscriptionId}
                  </a>
                </>
              )}
              {paymentTxid && (
                <a
                  href={`https://mempool.space/tx/${paymentTxid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block break-all text-[11px] text-[#e8b64b]/80 underline hover:text-[#e8b64b]"
                >
                  Payment tx: {paymentTxid.slice(0, 12)}…{paymentTxid.slice(-8)}
                </a>
              )}
              <div>
                <button
                  onClick={reset}
                  className="mt-5 rounded-xl bg-gradient-to-r from-[#f7e3a8] to-[#c9902f] px-6 py-2.5 text-sm font-black uppercase tracking-widest text-[#1a1206]"
                >
                  Mint another
                </button>
              </div>
            </div>
          )}
        </section>

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
