import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { logMinting } from '../services/mintingLog';
import { addMintPoints } from '../services/pointsService';
import {
  mintPrimalClubRandom,
  loadPrimalClubCollection,
  primalClubImageUrl,
} from '../services/primalClubMintService';
import { getOrdinalAddress } from '../utils/wallet';
import { useUnisatTaproot } from '../hooks/useUnisatTaproot';
import { getApiUrl } from '../utils/apiUrl';

const PRIMAL_CLUB_PRICE_SATS = 5000;
const PRIMAL_CLUB_TOTAL_SUPPLY = 480;
const API_URL = getApiUrl();
const HERO_IMAGE = primalClubImageUrl('0001.avif');

function imageForIndex(index: number): string {
  return primalClubImageUrl(`${String(index).padStart(4, '0')}.avif`);
}

export const PrimalClubPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collectionReady, setCollectionReady] = useState<boolean | null>(null);
  const [mintCount, setMintCount] = useState(0);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [mintedIndices, setMintedIndices] = useState<number[]>([]);
  const [freeMintEntitlement, setFreeMintEntitlement] = useState(0);
  const [freeMintUsed, setFreeMintUsed] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [recentMints, setRecentMints] = useState<Array<{
    itemIndex: number;
    itemName: string;
    timestamp: string;
    inscriptionId: string | null;
  }>>([]);
  const { taprootOverride, handleTaprootChange, resolveReceiveAddress } = useUnisatTaproot(walletState);

  const loadMintCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/primal-club/count`);
      if (res.ok) {
        const data = await res.json();
        setMintCount(data.totalMints || 0);
      }
    } catch {
      console.warn('[PrimalClub] Could not load mint count');
    }
  };

  const loadMintedIndices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/primal-club/minted-indices`);
      if (res.ok) {
        const data = await res.json();
        setMintedIndices(data.mintedIndices || []);
      }
    } catch {
      console.warn('[PrimalClub] Could not load minted indices');
    }
  };

  const loadRecentMints = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/primal-club/recent`);
      if (!res.ok) return;
      const data = await res.json();
      const list: any[] = data.recent || data.mints || [];
      const finalRe = /^[0-9a-f]{64}i\d+$/i;
      const mapped = list
        .map((m: any) => {
          const parsedFromName = String(m.itemName || '').match(/#(\d+)/)?.[1];
          const itemIndex = Number(m.itemIndex ?? parsedFromName ?? 0);
          return {
            itemIndex,
            itemName: String(m.itemName || (itemIndex > 0 ? `Primal Club #${itemIndex}` : 'Primal Club')),
            timestamp: String(m.timestamp || ''),
            inscriptionId: m.inscriptionId || null,
          };
        })
        // Nur echte, on-chain finalisierte Mints anzeigen
        .filter((m) => m.itemIndex > 0 && finalRe.test(String(m.inscriptionId || '')))
        .slice(0, 10);
      setRecentMints(mapped);
    } catch {
      console.warn('[PrimalClub] Could not load recent mints');
    }
  }, []);

  const checkFreeMintEligibility = useCallback(async (address: string) => {
    let entitlement = 0;
    let used = 0;
    try {
      const wlRes = await fetch(`${API_URL}/api/primal-club/whitelist-addresses`);
      if (wlRes.ok) {
        const wlData = await wlRes.json();
        const entries: Array<{ address: string; count?: number }> = wlData.entries || [];
        const found = entries.find((e) => String(e.address || '').toLowerCase() === address.toLowerCase());
        if (found) {
          entitlement = Math.max(1, Number(found.count || 1));
        } else if ((wlData.addresses || []).some((a: string) => a.toLowerCase() === address.toLowerCase())) {
          entitlement = 1;
        }
      }
    } catch {
      console.warn('[PrimalClub] whitelist check failed');
    }
    try {
      const amRes = await fetch(`${API_URL}/api/primal-club/address-mints?address=${encodeURIComponent(address)}`);
      if (amRes.ok) {
        const amData = await amRes.json();
        used = amData.freeMints || 0;
      }
    } catch { /* ignore */ }
    setFreeMintEntitlement(entitlement);
    setFreeMintUsed(used);
  }, []);

  useEffect(() => {
    loadPrimalClubCollection().then((col) => {
      setCollectionReady(!!(col && col.generated.length > 0));
    });
    loadMintCount();
    loadMintedIndices();
    loadRecentMints();
  }, [loadRecentMints]);

  useEffect(() => {
    const addr = walletState.connected ? walletState.accounts?.[0]?.address : null;
    if (addr) {
      checkFreeMintEligibility(addr);
    } else {
      setFreeMintEntitlement(0);
      setFreeMintUsed(0);
    }
  }, [walletState.connected, walletState.accounts, checkFreeMintEligibility]);

  const freeMintsRemaining = Math.max(0, freeMintEntitlement - freeMintUsed);
  const isFreeForUser = freeMintsRemaining > 0;

  const handleMint = async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const { address: userAddress, error: taprootError } = await resolveReceiveAddress(walletState);
    if (taprootError) {
      setMintingStatus({ packId: 'primal-club', status: 'failed', progress: 0, error: taprootError });
      return;
    }

    setIsMinting(true);
    setMintingStatus({ packId: 'primal-club', status: 'processing', progress: 20 });

    try {
      // Frische minted-indices direkt vor dem Mint laden (Race-Condition verhindern)
      let freshMintedIndices = mintedIndices;
      try {
        const idxRes = await fetch(`${API_URL}/api/primal-club/minted-indices`);
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          freshMintedIndices = idxData.mintedIndices || [];
          setMintedIndices(freshMintedIndices);
        }
      } catch { /* fallback auf cached */ }

      const useFree = isFreeForUser;
      const result = await mintPrimalClubRandom(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        useFree,
        freshMintedIndices
      );

      // 1) Mint-Log (mit pending->final Auflösung serverseitig)
      try {
        await fetch(`${API_URL}/api/primal-club/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            inscriptionId: result.inscriptionId,
            txid: result.txid || null,
            orderId: result.orderId || null,
            itemName: `Primal Club #${result.item.index}`,
            itemIndex: result.item.index,
            priceInSats: useFree ? 0 : PRIMAL_CLUB_PRICE_SATS,
            isFree: useFree,
            paymentTxid: result.paymentTxid || null,
            timestamp: Date.now(),
          }),
        });
      } catch (e) {
        console.warn('[PrimalClub] Log failed:', e);
      }

      // 2) Backup-Log (generisches Minting-Log)
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'primal-club',
          packName: 'Primal Club',
          cards: [{
            id: `primal-club-${result.item.index}`,
            name: `Primal Club #${result.item.index}`,
            inscriptionId: result.inscriptionId,
            rarity: 'common',
          }],
          inscriptionIds: [result.inscriptionId],
          inscriptionId: result.inscriptionId,
          txids: result.txid ? [result.txid] : [],
          paymentTxid: result.paymentTxid,
          orderId: result.orderId,
          originalPendingInscriptionId: String(result.inscriptionId || '').startsWith('pending-')
            ? result.inscriptionId
            : undefined,
        });
      } catch { /* backup log failed */ }

      // 3) Punkte
      try {
        await addMintPoints(userAddress, {
          collection: 'Primal Club',
          itemName: `Primal Club #${result.item.index}`,
          inscriptionId: result.inscriptionId,
          txid: result.txid || null,
          source: 'primal-club-mint',
        });
      } catch (pointsErr) {
        console.warn('[PrimalClub] Punkte konnten nicht hinzugefuegt werden:', pointsErr);
      }

      // 4) Hashlist mit Metadaten aktualisieren (finale Mintliste). Sehr wichtig:
      //    inscriptionId + Item + Attributes werden dauerhaft in der DB gespeichert.
      try {
        await fetch(`${API_URL}/api/primal-club/hashlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inscriptionId: result.inscriptionId,
            itemIndex: result.item.index,
            name: result.item.name || `Primal Club #${result.item.index}`,
            attributes: result.item.attributes || [],
          }),
        });
      } catch (hashErr) {
        console.warn('[PrimalClub] Hashlist update fehlgeschlagen:', hashErr);
      }

      // 5) Free-Mint-Verbrauch registrieren (Whitelist)
      if (useFree) {
        try {
          await fetch(`${API_URL}/api/primal-club/free-mint-used`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: userAddress }),
          });
        } catch { /* localStorage-frei: Backend-Tracking + Log-Rekonstruktion */ }
        setFreeMintUsed((prev) => prev + 1);
      }

      setMintingStatus({
        packId: 'primal-club',
        status: 'completed',
        progress: 100,
        inscriptionIds: [result.inscriptionId],
        paymentTxid: result.paymentTxid || undefined,
      });
      setMintCount((prev) => prev + 1);
      setMintedIndices((prev) => [...new Set([...prev, result.item.index])]);
      loadRecentMints();
    } catch (error: any) {
      console.error('[PrimalClub] Mint-Fehler:', error);
      setMintingStatus({
        packId: 'primal-club',
        status: 'failed',
        progress: 0,
        error: error.message || 'Minting failed',
      });
    } finally {
      setIsMinting(false);
    }
  };

  const isSoldOut = mintCount >= PRIMAL_CLUB_TOTAL_SUPPLY;
  const progressPercent = Math.min((mintCount / PRIMAL_CLUB_TOTAL_SUPPLY) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/30 via-black to-orange-950/10" />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Back */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-amber-400 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-black mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              PRIMAL CLUB
            </span>
          </h1>
          <p className="text-lg text-gray-300">
            {PRIMAL_CLUB_TOTAL_SUPPLY} Unique Ordinals on Bitcoin
          </p>
        </div>

        {collectionReady === null ? (
          <div className="text-center py-8 text-gray-300">Loading...</div>
        ) : collectionReady === false ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl md:text-6xl font-bold text-amber-500 mb-4">COMING SOON</p>
              <p className="text-gray-400 text-sm">Collection data not found.</p>
            </div>
          </div>
        ) : (
          <>
          <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-6 lg:gap-10">

            {/* Left: Mint Panel */}
            <div className="bg-black/80 border-2 border-amber-600/70 rounded-xl p-4 lg:p-5 max-w-md w-full backdrop-blur-md">
              <div className="flex flex-col items-center mb-4">
                <div className="relative mb-3 w-full max-w-[260px] aspect-square rounded-lg overflow-hidden shadow-2xl shadow-amber-600/20 border border-amber-600/30 bg-black">
                  <img
                    src={HERO_IMAGE}
                    alt="Primal Club Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>

                {/* Mint Counter */}
                <div className="w-full mb-3">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-400">Minted</span>
                    <span className="text-amber-400 font-bold">{mintCount} / {PRIMAL_CLUB_TOTAL_SUPPLY}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {PRIMAL_CLUB_TOTAL_SUPPLY - mintCount} remaining
                  </p>
                </div>

                {/* Price */}
                <div className="text-center">
                  {isFreeForUser ? (
                    <>
                      <p className="text-2xl font-black text-green-400 mb-0.5">FREE MINT</p>
                      <p className="text-xs text-gray-400">+ inscription fees only</p>
                      <p className="text-[10px] text-green-400/80 mt-1">
                        Whitelist: {freeMintsRemaining} free mint{freeMintsRemaining === 1 ? '' : 's'} left
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-amber-400 mb-0.5">
                        {PRIMAL_CLUB_PRICE_SATS.toLocaleString()} sats
                      </p>
                      <p className="text-xs text-gray-400">+ inscription fees</p>
                    </>
                  )}
                </div>
              </div>

              {walletState.connected && walletState.walletType === 'unisat' && !walletState.accounts?.[0]?.address?.startsWith('bc1p') && (
                <div className="mb-4 p-3 rounded-lg bg-gray-800/80 border border-orange-600/40">
                  <label className="block text-xs text-orange-300 mb-1 font-semibold">
                    Taproot address to receive inscription (bc1p…)
                  </label>
                  <input
                    type="text"
                    value={taprootOverride}
                    onChange={(e) => handleTaprootChange(e.target.value)}
                    placeholder="bc1p..."
                    className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-sm font-mono placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Copy your Taproot address from UniSat (Settings → Address Type → Taproot → copy address).
                  </p>
                </div>
              )}

              <div className="mb-4">
                <FeeRateSelector selectedFeeRate={inscriptionFeeRate} onFeeRateChange={setInscriptionFeeRate} />
              </div>

              {mintingStatus && (
                <div className="mb-4">
                  <MintingProgress status={mintingStatus} />
                </div>
              )}

              {!mintingStatus || mintingStatus.status === 'failed' ? (
                <button
                  onClick={handleMint}
                  disabled={isMinting || !walletState.connected || isSoldOut}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-600/30 text-black"
                >
                  {isSoldOut ? 'SOLD OUT' : isMinting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Minting...
                    </span>
                  ) : isFreeForUser ? '🎁 FREE MINT' : '🐒 MINT RANDOM'}
                </button>
              ) : mintingStatus.status === 'completed' ? (
                <div className="text-center">
                  <p className="text-green-400 font-bold mb-2">Mint Successful!</p>
                  {mintingStatus.paymentTxid && (
                    <a
                      href={`https://mempool.space/tx/${mintingStatus.paymentTxid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-blue-400 hover:text-blue-300 underline mb-3 break-all"
                    >
                      View transaction: {mintingStatus.paymentTxid.slice(0, 12)}...{mintingStatus.paymentTxid.slice(-8)}
                    </a>
                  )}
                  <br />
                  <button
                    onClick={() => setMintingStatus(null)}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                  >
                    Mint Another
                  </button>
                </div>
              ) : null}

              {!walletState.connected && (
                <p className="text-center text-gray-400 text-xs mt-3 cursor-pointer hover:text-amber-400" onClick={() => setShowWalletConnect(true)}>
                  Connect your wallet to mint
                </p>
              )}

              <p className="text-[10px] text-gray-500 text-center mt-3">
                {PRIMAL_CLUB_TOTAL_SUPPLY} unique items · Sent to your Taproot address (bc1p...)
              </p>
            </div>

            {/* Right: Description */}
            <div className="bg-black/80 border-2 border-amber-600/40 rounded-xl p-4 lg:p-6 max-w-xl w-full backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white mb-1">PRIMAL CLUB</h2>
              <p className="text-amber-400 font-semibold text-sm mb-3">Collection on Bitcoin</p>

              <p className="text-gray-300 text-xs leading-relaxed mb-4">
                <strong className="text-white">Primal Club</strong> is a collection of {PRIMAL_CLUB_TOTAL_SUPPLY} unique
                primates, each one inscribed directly on the Bitcoin blockchain. Every primate carries its own set of
                traits — backgrounds, fur, outfits, companions and more. Mint is random: you don&rsquo;t know which one
                you get until it&rsquo;s yours, forever on-chain.
              </p>

              <div className="bg-black/60 border-2 border-amber-900/60 rounded-md p-3 mb-4">
                <h3 className="text-sm text-amber-400 mb-2 font-bold">PRICING</h3>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300">Public Mint</span>
                  <span className="text-amber-400 font-bold">{PRIMAL_CLUB_PRICE_SATS.toLocaleString()} sats + fees</span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><span>🐒</span> How it works:</h3>
              <ul className="space-y-1 text-gray-300 text-xs mb-2">
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span><strong className="text-white">{PRIMAL_CLUB_TOTAL_SUPPLY} unique primates</strong> — each one different</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span><strong className="text-white">Random mint</strong> — you don&rsquo;t know which one you get</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span>Real image inscribed <strong className="text-white">directly on Bitcoin</strong></span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span><span>Sent to your <strong className="text-white">Taproot address (bc1p...)</strong></span></li>
              </ul>
            </div>
          </div>

          {/* Recent Mints */}
          {recentMints.length > 0 && (
            <div className="w-full mt-8 mb-4">
              <h3 className="text-center text-lg font-bold text-amber-400 mb-4">RECENT MINTS</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {recentMints.map((mint, i) => (
                  <div key={`${mint.inscriptionId || mint.itemIndex}-${i}`} className="flex flex-col items-center">
                    <div
                      className="w-24 h-24 bg-black border-2 border-amber-600/50 rounded-lg overflow-hidden shadow-lg shadow-amber-600/20 cursor-pointer transition-transform hover:scale-110"
                      onClick={() => setLightboxImage({ url: imageForIndex(mint.itemIndex), name: mint.itemName })}
                    >
                      <img
                        src={imageForIndex(mint.itemIndex)}
                        alt={mint.itemName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1 text-center font-bold">#{mint.itemIndex}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}

        {/* Lightbox */}
        {lightboxImage && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLightboxImage(null)} className="absolute -top-10 right-0 text-gray-400 hover:text-amber-400 text-sm font-bold">
                ✕ Close
              </button>
              <img src={lightboxImage.url} alt={lightboxImage.name} className="w-full h-auto rounded-lg border-2 border-amber-600 shadow-2xl shadow-amber-600/30" />
              <p className="text-center text-amber-400 font-bold mt-3">{lightboxImage.name}</p>
            </div>
          </div>
        )}

        {/* Wallet Connect */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-amber-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-amber-600">
                <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
                <button onClick={() => setShowWalletConnect(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <WalletConnect onConnected={() => setShowWalletConnect(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
