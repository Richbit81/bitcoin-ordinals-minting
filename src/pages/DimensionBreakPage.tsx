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
  mintDimensionBreak,
  loadDimensionBreakCollection,
  loadMintCount as apiLoadMintCount,
  loadMintedIndices as apiLoadMintedIndices,
  loadAddressMintCount as apiLoadAddressMintCount,
  logDimensionBreakMint,
  updateDimensionBreakHashlist,
  loadRecentMints as apiLoadRecentMints,
  DimensionBreakCollection,
} from '../services/dimensionBreakMintService';
import { getOrdinalAddress, getUnisatTaprootAddress } from '../utils/wallet';

const TOTAL_SUPPLY = 100;
const LIMIT_PER_ADDRESS = 1;

export const DimensionBreakPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collectionReady, setCollectionReady] = useState<boolean | null>(null);
  const [mintCount, setMintCount] = useState(0);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [addressMintCount, setAddressMintCount] = useState<number>(0);
  const [mintedIndices, setMintedIndices] = useState<number[]>([]);
  const [collectionData, setCollectionData] = useState<DimensionBreakCollection | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [recentMints, setRecentMints] = useState<Array<{
    itemIndex: number | null;
    itemName: string;
    timestamp: string;
    walletAddress: string | null;
    inscriptionId: string | null;
    imageUrl: string | null;
  }>>([]);

  useEffect(() => {
    loadDimensionBreakCollection().then((col) => {
      if (col && col.generated.length > 0) {
        setCollectionReady(true);
        setCollectionData(col);
      } else {
        setCollectionReady(false);
      }
    });
    refreshMintCount();
    refreshMintedIndices();
    refreshRecentMints();
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      refreshAddressMintCount(getOrdinalAddress(walletState.accounts));
    } else {
      setAddressMintCount(0);
    }
  }, [walletState.connected, walletState.accounts]);

  const refreshMintCount = async () => {
    const count = await apiLoadMintCount();
    setMintCount(count);
  };

  const refreshMintedIndices = async () => {
    const indices = await apiLoadMintedIndices();
    setMintedIndices(indices);
  };

  const refreshAddressMintCount = async (address: string) => {
    const count = await apiLoadAddressMintCount(address);
    setAddressMintCount(count);
  };

  const refreshRecentMints = async () => {
    try {
      const recent = await apiLoadRecentMints();
      setRecentMints(recent.map(m => ({ ...m, imageUrl: null })));
    } catch { /* ignore */ }
  };

  const renderItemImage = useCallback(async (layerIds: string[], targetSize = 256): Promise<string | null> => {
    try {
      const images = await Promise.all(
        layerIds.map(id => new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load ${id}`));
          img.src = `https://ordinals.com/content/${id}`;
        }))
      );
      const w = images[0]?.naturalWidth || 75;
      const h = images[0]?.naturalHeight || 75;
      const scale = Math.max(1, Math.ceil(targetSize / Math.max(w, h)));
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      for (const img of images) {
        ctx.drawImage(img, 0, 0, w * scale, h * scale);
      }
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!collectionData || recentMints.length === 0) return;
    if (recentMints.some(m => m.imageUrl !== null)) return;

    let cancelled = false;
    const renderAll = async () => {
      const updated = [...recentMints];
      for (let i = 0; i < updated.length; i++) {
        if (cancelled) return;
        const item = collectionData.generated.find((g) => g.index === updated[i].itemIndex);
        if (item && item.layers) {
          const layerIds = item.layers.map(l => l.trait.inscriptionId);
          const url = await renderItemImage(layerIds);
          updated[i] = { ...updated[i], imageUrl: url || 'placeholder' };
        } else if (updated[i].inscriptionId) {
          updated[i] = { ...updated[i], imageUrl: `https://ordinals.com/content/${updated[i].inscriptionId}` };
        } else {
          updated[i] = { ...updated[i], imageUrl: 'placeholder' };
        }
      }
      if (!cancelled) setRecentMints(updated);
    };
    renderAll();
    return () => { cancelled = true; };
  }, [collectionData, recentMints.length, renderItemImage]);

  const handleMint = useCallback(async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    let userAddress = getOrdinalAddress(walletState.accounts);
    if (walletState.walletType === 'unisat' && !userAddress.startsWith('bc1p')) {
      try {
        const tap = await getUnisatTaprootAddress();
        if (tap) userAddress = tap;
      } catch { /* keep current */ }
    }

    if (!userAddress.startsWith('bc1p')) {
      setMintingStatus({
        packId: 'dimension-break',
        status: 'failed',
        progress: 0,
        error: `Taproot address required (bc1p…).\nDetected: ${userAddress || 'none'}\n\nPlease switch to Taproot in UniSat and reconnect.`,
      });
      return;
    }

    if (addressMintCount >= LIMIT_PER_ADDRESS) {
      setMintingStatus({
        packId: 'dimension-break',
        status: 'failed',
        progress: 0,
        error: `You have already minted ${addressMintCount} of ${LIMIT_PER_ADDRESS} allowed.\nOnly 1 per wallet.`,
      });
      return;
    }

    setIsMinting(true);
    setMintingStatus({ packId: 'dimension-break', status: 'processing', progress: 10 });

    try {
      let freshMintedIndices = mintedIndices;
      try {
        freshMintedIndices = await apiLoadMintedIndices();
        setMintedIndices(freshMintedIndices);
      } catch { /* fallback to cached */ }

      setMintingStatus({ packId: 'dimension-break', status: 'processing', progress: 30 });

      const result = await mintDimensionBreak(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        freshMintedIndices
      );

      console.log(`[DimensionBreak] Mint successful: ${result.inscriptionId}`);

      // 1) Collection-specific log
      try {
        await logDimensionBreakMint({
          walletAddress: userAddress,
          inscriptionId: result.inscriptionId,
          txid: result.txid || null,
          orderId: result.orderId || null,
          itemName: `Dimension Break #${result.item.index}`,
          itemIndex: result.item.index,
          paymentTxid: result.paymentTxid || null,
        });
      } catch (err) {
        console.warn('[DimensionBreak] Direct log failed:', err);
      }

      // 2) Generic backup log
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'dimension-break',
          packName: 'Dimension Break',
          cards: [{
            id: `db-${result.item.index}`,
            name: `Dimension Break #${result.item.index}`,
            inscriptionId: result.inscriptionId,
            rarity: 'common',
          }],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: result.paymentTxid,
          orderId: result.orderId,
        });
      } catch (err) {
        console.warn('[DimensionBreak] Backup log failed:', err);
      }

      // 3) Points
      try {
        await addMintPoints(userAddress, {
          collection: 'Dimension Break',
          itemName: `Dimension Break #${result.item.index}`,
          inscriptionId: result.inscriptionId,
          txid: result.txid || null,
          source: 'dimension-break-mint',
        });
      } catch { /* ignore */ }

      // 4) Hashlist
      try {
        await updateDimensionBreakHashlist({
          inscriptionId: result.inscriptionId,
          itemIndex: result.item.index,
          name: `Dimension Break #${result.item.index}`,
          attributes: result.item.layers.map(l => ({ trait_type: l.traitType, value: l.trait.name })),
        });
      } catch { /* ignore */ }

      setMintingStatus({
        packId: 'dimension-break',
        status: 'completed',
        progress: 100,
        inscriptionIds: [result.inscriptionId],
        paymentTxid: result.paymentTxid || undefined,
      });
      setMintCount(prev => prev + 1);
      setAddressMintCount(prev => prev + 1);
      setMintedIndices(prev => [...prev, result.item.index]);
      refreshRecentMints();
    } catch (error: any) {
      console.error('[DimensionBreak] Mint error:', error);
      setMintingStatus({
        packId: 'dimension-break',
        status: 'failed',
        progress: 0,
        error: error.message || 'Minting failed',
      });
    } finally {
      setIsMinting(false);
    }
  }, [walletState, inscriptionFeeRate, addressMintCount, mintedIndices]);

  const progressPercent = Math.min((mintCount / TOTAL_SUPPLY) * 100, 100);
  const isSoldOut = mintCount >= TOTAL_SUPPLY;
  const canMint = walletState.connected && !isSoldOut && !isMinting && addressMintCount < LIMIT_PER_ADDRESS;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: '#050510' }}>
      {/* Blurred background image */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(/images/dimension-break-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(18px) brightness(0.35)',
        transform: 'scale(1.1)',
      }} />

      <div className="relative z-10 container mx-auto px-4 py-6 min-h-screen flex flex-col">
        {/* Back */}
        <div className="mb-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-purple-400 flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-black tracking-wider mb-3" style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.3))',
          }}>
            DIMENSION BREAK
          </h1>
          <p className="text-lg text-gray-400 italic">The dimensions are beginning to break.</p>
          <p className="text-sm text-gray-500 mt-1">{TOTAL_SUPPLY} Unique Recursive Pixel Ordinals on Bitcoin</p>
        </div>

        {collectionReady === null ? (
          <div className="text-center py-12 text-gray-400">Loading collection...</div>
        ) : collectionReady === false ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-4xl font-bold text-purple-400">COMING SOON</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 max-w-lg mx-auto w-full">
            {/* Preview Card */}
            <div className="w-full max-w-sm">
              <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500/30 bg-black/60 backdrop-blur" style={{
                boxShadow: '0 0 40px rgba(168,85,247,0.15), 0 0 80px rgba(99,102,241,0.08)',
              }}>
                <img
                  src="/images/dimension-break-preview.gif"
                  alt="Dimension Break Preview"
                  className="w-full aspect-square object-cover"
                  style={{ imageRendering: 'pixelated' }}
                />
                {!isSoldOut && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">FREE MINT</span>
                  </div>
                )}
                {isSoldOut && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-3xl font-black text-red-400">SOLD OUT</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mint Info */}
            <div className="w-full bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl p-5 space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Minted</span>
                  <span className="text-purple-300 font-bold">{mintCount} / {TOTAL_SUPPLY}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                  }} />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">{TOTAL_SUPPLY - mintCount} remaining</p>
              </div>

              {/* Price */}
              <div className="text-center py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-400">FREE</p>
                <p className="text-xs text-gray-400">Only inscription fees · 1 per wallet</p>
                {walletState.connected && (
                  <p className={`text-xs mt-1 font-bold ${addressMintCount >= LIMIT_PER_ADDRESS ? 'text-red-400' : 'text-green-400'}`}>
                    {addressMintCount} / {LIMIT_PER_ADDRESS} minted
                  </p>
                )}
              </div>

              {/* Fee Rate */}
              <div>
                <FeeRateSelector value={inscriptionFeeRate} onChange={setInscriptionFeeRate} />
              </div>

              {/* Mint Button */}
              {!walletState.connected ? (
                <button
                  onClick={() => setShowWalletConnect(true)}
                  className="w-full py-3 rounded-xl font-bold text-lg bg-purple-600 hover:bg-purple-500 transition-colors"
                >
                  Connect Wallet to Mint
                </button>
              ) : isSoldOut ? (
                <button disabled className="w-full py-3 rounded-xl font-bold text-lg bg-gray-700 text-gray-400 cursor-not-allowed">
                  SOLD OUT
                </button>
              ) : addressMintCount >= LIMIT_PER_ADDRESS ? (
                <button disabled className="w-full py-3 rounded-xl font-bold text-lg bg-gray-700 text-gray-400 cursor-not-allowed">
                  Already Minted (1 per wallet)
                </button>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={!canMint}
                  className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                    canMint
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isMinting ? 'Minting...' : 'Mint for Free'}
                </button>
              )}

              {/* Minting Progress */}
              {mintingStatus && (
                <MintingProgress
                  status={mintingStatus}
                  onClose={() => setMintingStatus(null)}
                />
              )}
            </div>
          </div>
        )}

        {/* Recent Mints Banner */}
        {recentMints.length > 0 && (
          <div className="w-full mt-10 mb-6 max-w-2xl mx-auto">
            <h3 className="text-center text-xl font-bold mb-4" style={{
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              RECENT MINTS
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {recentMints.map((mint, i) => (
                <div key={i} className="flex flex-col items-center group">
                  <div
                    className={`w-16 h-16 bg-black/60 border border-purple-500/30 rounded-lg overflow-hidden transition-transform group-hover:scale-110 ${
                      mint.imageUrl && mint.imageUrl !== 'placeholder' ? 'cursor-pointer' : ''
                    }`}
                    style={{ boxShadow: '0 0 12px rgba(168,85,247,0.15)' }}
                    onClick={async () => {
                      if (!mint.imageUrl || mint.imageUrl === 'placeholder') return;
                      setLightbox({ url: mint.imageUrl, name: mint.itemName });
                      if (!collectionData) return;
                      const item = collectionData.generated.find(g => g.index === mint.itemIndex);
                      if (item?.layers) {
                        const native = await renderItemImage(item.layers.map(l => l.trait.inscriptionId), 75);
                        if (native) setLightbox(prev => prev ? { ...prev, url: native } : null);
                      }
                    }}
                  >
                    {mint.imageUrl === 'placeholder' ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                        <span className="text-purple-400 font-bold text-xs">#{mint.itemIndex}</span>
                      </div>
                    ) : mint.imageUrl ? (
                      <img src={mint.imageUrl} alt={mint.itemName}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-500 mt-1 text-center">#{mint.itemIndex}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Wallet Connect Modal */}
      {showWalletConnect && (
        <WalletConnect onClose={() => setShowWalletConnect(false)} />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="rounded-xl border-2 border-purple-500/40 block"
              style={{
                imageRendering: 'pixelated',
                width: 'min(80vmin, 600px)',
                height: 'min(80vmin, 600px)',
              }}
            />
            <p className="text-center text-purple-300 font-bold mt-3 text-lg">{lightbox.name}</p>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
