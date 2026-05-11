import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from './WalletConnect';
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

type SlotStatus = {
  spinsRemaining: number;
  maxSpinsPerWindow: number;
  windowHours: number;
  nextSpinNotBefore: string | null;
  pinkPassesMinted: number;
  pinkPassesCap: number;
};

type SpinResult = {
  spinId: string;
  prize: string;
  targets: number[];
  templateId: string;
  prizePreviewUrl: string;
  displayName: string;
  spinsRemaining: number;
};

export const PinkPuppetsSlotSection: React.FC = () => {
  const { walletState } = useWallet();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [feeRate, setFeeRate] = useState(2);
  const [slotStatus, setSlotStatus] = useState<SlotStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [spinBusy, setSpinBusy] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [lastSpin, setLastSpin] = useState<SpinResult | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<MintingStatus | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [taprootOverride, setTaprootOverride] = useState(
    () => typeof window !== 'undefined' ? localStorage.getItem('unisat_taproot_address') || '' : ''
  );

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
        apiUrl(`/api/pinkpuppets/slot/status?address=${encodeURIComponent(ordinalAddr)}`)
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

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const sendSpinToIframe = (targets: number[], winImageUrl: string) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { type: 'PP_SLOT_RUN', targets, winImageUrl },
      window.location.origin
    );
  };

  const handleSpin = async () => {
    if (!walletState.walletType || !ordinalAddr) {
      setShowWallet(true);
      return;
    }
    setSpinError(null);
    setSpinBusy(true);
    setLastSpin(null);
    try {
      const r = await fetch(apiUrl('/api/pinkpuppets/slot/spin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: ordinalAddr }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (r.status === 429 ? 'Spin-Limit erreicht (3 Spins / 8h).' : 'Spin fehlgeschlagen');
        throw new Error(msg);
      }
      const result: SpinResult = {
        spinId: data.spinId,
        prize: data.prize,
        targets: data.targets,
        templateId: data.templateId,
        prizePreviewUrl: data.prizePreviewUrl,
        displayName: data.displayName,
        spinsRemaining: data.spinsRemaining ?? 0,
      };
      setLastSpin(result);
      sendSpinToIframe(result.targets, result.prizePreviewUrl);
      await loadStatus();
    } catch (e: any) {
      setSpinError(e?.message || 'Spin fehlgeschlagen');
    } finally {
      setSpinBusy(false);
    }
  };

  const resolveReceive = (): string => {
    let addr = getOrdinalAddress(walletState.accounts || []);
    if (walletState.walletType === 'unisat' && !addr.startsWith('bc1p')) {
      const saved = taprootOverride || localStorage.getItem('unisat_taproot_address') || '';
      if (saved.startsWith('bc1p')) addr = saved;
    }
    return addr;
  };

  const handleMintPrize = async () => {
    if (!lastSpin || !walletState.walletType) {
      setShowWallet(true);
      return;
    }
    const receive = resolveReceive();
    if (!receive.startsWith('bc1p')) {
      setMintStatus({
        progress: 0,
        status: 'error',
        message:
          'Taproot-Adresse (bc1p…) erforderlich für den Delegate-Empfang. UniSat: Native SegWit zum Zahlen, Taproot hier eintragen.',
      });
      return;
    }

    setMinting(true);
    setMintStatus({ progress: 10, status: 'processing', message: 'Delegate wird erstellt…' });
    try {
      const result = await createSingleDelegate(
        lastSpin.templateId,
        lastSpin.displayName,
        receive,
        'Pink Puppets',
        feeRate,
        walletState.walletType,
        'image',
        0
      );
      setMintStatus({ progress: 80, status: 'processing', message: 'Mint wird protokolliert…' });
      try {
        await fetch(apiUrl('/api/pinkpuppets/slot/log-mint'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: receive,
            inscriptionId: result.inscriptionId,
            txid: result.txid,
            templateId: lastSpin.templateId,
            prize: lastSpin.prize,
            spinId: lastSpin.spinId,
          }),
        });
      } catch {
        /* Log optional */
      }
      setMintStatus({
        progress: 100,
        status: 'success',
        message: `Gemintet: ${result.inscriptionId}`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });
      await loadStatus();
    } catch (e: any) {
      setMintStatus({
        progress: 0,
        status: 'error',
        message: e?.message || 'Mint fehlgeschlagen',
      });
    } finally {
      setMinting(false);
    }
  };

  const spinsLeft = slotStatus?.spinsRemaining ?? 0;
  const canSpin = connected && spinsLeft > 0 && !spinBusy;

  return (
    <section className="mb-4 rounded-2xl border-2 border-pink-400/50 bg-black/50 overflow-hidden shadow-[4px_4px_0_#000]">
      <div className="border-b border-pink-500/40 bg-gradient-to-r from-pink-900/40 to-violet-900/30 px-4 py-3">
        <h2 className="text-lg font-black text-pink-100 tracking-tight">
          Pink Slot — Win a <span className="text-[#ff4fcf]">PINK Pass</span> (Phase 3)
        </h2>
        <p className="text-[11px] text-pink-200/80 mt-1">
          Connect wallet to play. Up to <strong>3 spins every 8 hours</strong>. All prizes are free delegate mints (you pay inscription fees only). PINK Pass supply capped at 15;
          one PINK Pass win per wallet.
        </p>
      </div>

      <div className="p-4 grid gap-4 lg:grid-cols-[1fr_minmax(280px,420px)]">
        <div className="min-h-[320px] rounded-xl border border-pink-300/40 bg-[#0a0512] overflow-hidden relative">
          <iframe
            ref={iframeRef}
            title="Pink Puppets slot"
            src="/pinkpuppets-slot/index.html?embed=1"
            className="absolute inset-0 w-full h-full min-h-[320px] border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        <div className="flex flex-col gap-3 text-sm">
          {!connected ? (
            <>
              <p className="text-pink-200/90 text-xs">Connect your Ordinals wallet to spin.</p>
              <WalletConnect onConnected={() => setShowWallet(false)} />
            </>
          ) : (
            <>
              {walletState.walletType === 'unisat' && !ordinalAddr.startsWith('bc1p') && (
                <div className="rounded-lg border border-orange-500/40 bg-black/40 p-2">
                  <label className="block text-[10px] text-orange-200 mb-1">Taproot receive (bc1p…) for inscription</label>
                  <input
                    value={taprootOverride}
                    onChange={(e) => {
                      setTaprootOverride(e.target.value);
                      localStorage.setItem('unisat_taproot_address', e.target.value);
                    }}
                    placeholder="bc1p..."
                    className="w-full rounded bg-black/60 border border-orange-500/30 px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
              )}

              <div className="rounded-lg border border-pink-400/30 bg-black/35 px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-pink-300/70">Spins left (8h)</span>
                  <span className="font-bold text-pink-100">
                    {statusLoading ? '…' : `${spinsLeft} / ${slotStatus?.maxSpinsPerWindow ?? 3}`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-pink-300/70">PINK Pass minted</span>
                  <span className="font-mono text-pink-100">
                    {slotStatus ? `${slotStatus.pinkPassesMinted} / ${slotStatus.pinkPassesCap}` : '—'}
                  </span>
                </div>
                {slotStatus?.nextSpinNotBefore && spinsLeft === 0 && (
                  <p className="text-[10px] text-amber-200/90 pt-1">
                    Next spin window after{' '}
                    {new Date(slotStatus.nextSpinNotBefore).toLocaleString()}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={!canSpin}
                onClick={() => void handleSpin()}
                className="w-full rounded-xl border-2 border-black bg-[#ff4fcf] py-3 text-sm font-black text-black shadow-[3px_3px_0_#000] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ff6fd6]"
              >
                {spinBusy ? 'Spinning…' : canSpin ? 'SPIN' : 'No spins left'}
              </button>

              {spinError && (
                <p className="text-xs text-red-300">{spinError}</p>
              )}

              {lastSpin && (
                <div className="rounded-xl border border-green-400/40 bg-green-950/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-green-100">Result: {lastSpin.displayName}</p>
                  <img
                    src={lastSpin.prizePreviewUrl}
                    alt={lastSpin.displayName}
                    className="w-full rounded-lg border border-pink-300/30 max-h-40 object-contain bg-black/50"
                  />
                  <FeeRateSelector selectedFeeRate={feeRate} onFeeRateChange={setFeeRate} />
                  <button
                    type="button"
                    disabled={minting}
                    onClick={() => void handleMintPrize()}
                    className="w-full rounded-lg border-2 border-black bg-green-500 py-2 text-xs font-bold text-black disabled:opacity-50"
                  >
                    {minting ? 'Minting…' : 'Mint prize (free delegate)'}
                  </button>
                  {mintStatus && (
                    <MintingProgress status={mintStatus} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showWallet && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#1a001a] border-2 border-pink-400 rounded-xl max-w-md w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-pink-100">Connect wallet</span>
              <button type="button" className="text-pink-300" onClick={() => setShowWallet(false)}>
                ✕
              </button>
            </div>
            <WalletConnect onConnected={() => setShowWallet(false)} />
          </div>
        </div>
      )}
    </section>
  );
};
