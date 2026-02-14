import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { logMinting } from '../services/mintingLog';
import {
  mintSlumsRandom,
  loadSlumsCollection,
  isTaprootAddress,
} from '../services/slumsMintService';
import { getApiUrl } from '../utils/apiUrl';

const SLUMS_PRICE_SATS = 3000;
const SLUMS_FREE_MINTS = 100;
const SLUMS_TOTAL_SUPPLY = 333;
const API_URL = getApiUrl();

// Preview item #124 layer inscription IDs
const PREVIEW_LAYERS = [
  '8f5fc247bf80511bd5b175b1f527cef1098d5e908c34acf81e986bfb99dcfa80i0',
  'b1776bc34762f7a6ef0122276e7cbd2922dfe6d5301a57bf7eb105bac167a364i0',
  '3c6549906170fe529005d201f77fa5a4f0cab7bfa283ed2c3e4c44d57887921fi0',
  '64abdaab518f553ef692fb59fb1244dd7c4833c2ae085b40fe71a14c253b9600i0',
  '397e179ca9c6b62c7982fd3426c569fcc52ff0e3f7c97a68b5dd9c89ea0bbb5di0',
  '8e26e5823d7fc3cd092b605feec7d1e7ce6e8908ca320d702a75f6160a552a89i0',
];

export const SlumsPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collectionReady, setCollectionReady] = useState<boolean | null>(null);
  const [totalItems, setTotalItems] = useState(333);
  const [mintCount, setMintCount] = useState(0);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Render preview from item #124 layers
  useEffect(() => {
    let cancelled = false;
    const renderPreview = async () => {
      try {
        const SIZE = 400;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        for (const id of PREVIEW_LAYERS) {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('img load failed'));
            el.src = `https://ordinals.com/content/${id}`;
          });
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
        }
        if (!cancelled) {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
        }
      } catch {
        console.warn('[SlumsPage] Preview render failed, using SVG fallback');
      }
    };
    renderPreview();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadSlumsCollection().then((col) => {
      if (col && col.generated.length > 0) {
        setCollectionReady(true);
        setTotalItems(col.generated.length);
      } else {
        setCollectionReady(false);
      }
    });
    loadMintCount();
  }, []);

  const loadMintCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/slums/count`);
      if (res.ok) {
        const data = await res.json();
        setMintCount(data.totalMints || 0);
      }
    } catch {
      console.warn('[SlumsPage] Could not load mint count');
    }
  };

  const handleMint = async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    let userAddress = walletState.accounts[0].address;
    const ordinalsAccount = walletState.accounts.find(
      (acc) => acc.purpose === 'ordinals' || acc.address.startsWith('bc1p')
    );
    if (ordinalsAccount) {
      userAddress = ordinalsAccount.address;
    }

    if (!isTaprootAddress(userAddress)) {
      alert('Ordinals werden nur an Taproot-Adressen (bc1p...) gesendet. Bitte verbinde eine Taproot-Wallet.');
      return;
    }

    setIsMinting(true);
    setMintingStatus({
      packId: 'slums',
      status: 'processing',
      progress: 10,
    });

    try {
      // Progress: rendering layers
      setMintingStatus({
        packId: 'slums',
        status: 'processing',
        progress: 30,
      });

      const result = await mintSlumsRandom(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        mintCount
      );

      console.log(`[SlumsPage] ✅ Mint erfolgreich: ${result.inscriptionId}`);

      // Minting-Log
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'slums',
          packName: 'SLUMS',
          cards: [{
            id: `slums-${result.item.index}`,
            name: `SLUMS #${result.item.index}`,
            inscriptionId: result.inscriptionId,
            rarity: 'common',
          }],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: result.paymentTxid,
        });
      } catch (logErr) {
        console.warn('[SlumsPage] Log speichern fehlgeschlagen:', logErr);
      }

      // Hashlist update
      try {
        const attributes = result.item.layers.map(layer => ({
          trait_type: layer.traitType,
          value: layer.trait.name,
        }));
        await fetch(`${API_URL}/api/slums/hashlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inscriptionId: result.inscriptionId,
            itemIndex: result.item.index,
            name: `SLUMS #${result.item.index}`,
            attributes,
          }),
        });
      } catch (hashErr) {
        console.warn('[SlumsPage] Hashlist update fehlgeschlagen:', hashErr);
      }

      setMintingStatus({
        packId: 'slums',
        status: 'completed',
        progress: 100,
        inscriptionIds: [result.inscriptionId],
      });
      setMintCount(prev => prev + 1);
    } catch (error: any) {
      console.error('[SlumsPage] Mint-Fehler:', error);
      setMintingStatus({
        packId: 'slums',
        status: 'failed',
        progress: 0,
        error: error.message || 'Minting failed',
      });
    } finally {
      setIsMinting(false);
    }
  };

  const isFreePhase = mintCount < SLUMS_FREE_MINTS;
  const progressPercent = Math.min((mintCount / SLUMS_TOTAL_SUPPLY) * 100, 100);
  const isSoldOut = mintCount >= SLUMS_TOTAL_SUPPLY;

  return (
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 30%, #0d0d0d 60%, #1a0a2e 100%)',
      }}
    >
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(rgba(139,92,246,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}></div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-white drop-shadow-2xl"
            style={{ textShadow: '0 0 30px rgba(139,92,246,0.5)' }}>
            SLUMS
          </h1>
          <p className="text-xl text-gray-300">
            333 Unique Pixel Ordinals on Bitcoin
          </p>
        </div>

        {collectionReady === null ? (
          <div className="text-white text-center py-8">Loading...</div>
        ) : collectionReady === false ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl md:text-6xl font-bold text-purple-500 drop-shadow-2xl mb-4">
                COMING SOON
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-12">

            {/* Left Side: Mint Panel */}
            <div className="bg-black/80 border-2 border-purple-600 rounded-xl p-8 max-w-lg w-full backdrop-blur-md">
              {/* Preview */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative mb-6 w-full max-w-sm aspect-square rounded-lg overflow-hidden shadow-2xl shadow-purple-600/30 border border-purple-600/30 bg-black flex items-center justify-center">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="SLUMS Preview"
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="text-gray-500 text-sm animate-pulse">Loading preview...</div>
                  )}
                </div>

                {/* Mint Counter */}
                <div className="w-full mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Minted</span>
                    <span className="text-white font-bold">{mintCount} / {SLUMS_TOTAL_SUPPLY}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {SLUMS_TOTAL_SUPPLY - mintCount} remaining
                  </p>
                </div>

                {/* Price Display */}
                <div className="text-center">
                  {isFreePhase ? (
                    <>
                      <p className="text-3xl font-bold text-green-400 mb-1">FREE</p>
                      <p className="text-sm text-gray-400">
                        {SLUMS_FREE_MINTS - mintCount} free mints left · then {SLUMS_PRICE_SATS.toLocaleString()} sats
                      </p>
                      <p className="text-xs text-gray-500 mt-1">+ network fees</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-purple-400 mb-1">
                        {SLUMS_PRICE_SATS.toLocaleString()} sats
                      </p>
                      <p className="text-sm text-gray-400">+ inscription fees</p>
                    </>
                  )}
                </div>
              </div>

              {/* Fee Rate Selector */}
              <div className="mb-6">
                <FeeRateSelector
                  selectedFeeRate={inscriptionFeeRate}
                  onFeeRateChange={setInscriptionFeeRate}
                />
              </div>

              {/* Minting Status */}
              {mintingStatus && (
                <div className="mb-6">
                  <MintingProgress status={mintingStatus} />
                </div>
              )}

              {/* Mint Button */}
              {!mintingStatus || mintingStatus.status === 'failed' ? (
                <button
                  onClick={handleMint}
                  disabled={isMinting || !walletState.connected || isSoldOut}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-600/30"
                >
                  {isSoldOut ? (
                    'SOLD OUT'
                  ) : isMinting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Rendering & Minting...
                    </span>
                  ) : (
                    `🎲 MINT RANDOM${isFreePhase ? ' (FREE)' : ''}`
                  )}
                </button>
              ) : mintingStatus.status === 'completed' ? (
                <div className="text-center">
                  <p className="text-green-400 font-bold mb-4">Mint Successful!</p>
                  <button
                    onClick={() => setMintingStatus(null)}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                  >
                    Mint Another
                  </button>
                </div>
              ) : null}

              {/* Wallet Connection Info */}
              {!walletState.connected && (
                <p className="text-center text-gray-400 text-sm mt-4 cursor-pointer hover:text-white" onClick={() => setShowWalletConnect(true)}>
                  Connect your wallet to mint
                </p>
              )}

              <p className="text-xs text-gray-500 text-center mt-4">
                {SLUMS_TOTAL_SUPPLY} unique pixel characters · Sent to your Taproot address (bc1p...)
              </p>
            </div>

            {/* Right Side: Description */}
            <div className="bg-black/80 border-2 border-purple-600/50 rounded-xl p-4 lg:p-6 max-w-xl w-full backdrop-blur-md">
              <div className="prose prose-invert prose-sm max-w-none">
                <h2 className="text-lg font-bold text-white mb-1">SLUMS</h2>
                <p className="text-purple-400 font-semibold text-sm mb-2">
                  Pixel Art Ordinals Collection
                </p>
                <p className="text-gray-300 text-sm italic mb-4">
                  Where the streets have no name — but every character tells a story.
                </p>

                <p className="text-gray-300 text-xs leading-relaxed mb-4">
                  Welcome to <span className="text-purple-400 font-semibold">SLUMS</span> — a collection of 333 unique pixel art characters inscribed directly on the Bitcoin blockchain. Each piece is composed of 6 hand-crafted layers — background, body, clothes, mouth, eyes, and top — creating thousands of possible trait combinations.
                </p>

                <p className="text-gray-300 text-xs leading-relaxed mb-4">
                  Every character is rendered on-chain from its individual AVIF layers, upscaled 2x using pixel-perfect nearest-neighbor scaling, and inscribed as a crisp PNG. No shortcuts, no off-chain dependencies — just pure pixel art living forever on Bitcoin.
                </p>

                {/* Pricing Box */}
                <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-3 mb-4">
                  <h3 className="text-sm font-bold text-white mb-2">💰 Pricing</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-400 font-semibold">Mint #1 – #100</span>
                      <span className="text-green-400 font-bold">FREE (only network fees)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Mint #101 – #333</span>
                      <span className="text-purple-400 font-bold">3,000 sats + fees</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <span>🎲</span> How it works
                </h3>

                <ul className="space-y-1 text-gray-300 text-xs mb-4">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><strong className="text-white">333 unique characters</strong> — each one different</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><strong className="text-white">Random mint</strong> — you don't see which one you get</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span>Composited from <strong className="text-white">6 on-chain AVIF layers</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><strong className="text-white">2x pixel upscale</strong> — crisp, no blur</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span>Inscribed as <strong className="text-white">PNG on Bitcoin</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span>Sent to your <strong className="text-white">Taproot address (bc1p...)</strong></span>
                  </li>
                </ul>

                <div className="border-l-4 border-purple-600 pl-3 py-1 mb-4 bg-purple-600/10 rounded-r">
                  <p className="text-white font-bold text-sm">
                    Built different. Minted on Bitcoin. 🏚️
                  </p>
                </div>

                <h3 className="text-sm font-bold text-white mb-2">🔧 Technical Details</h3>
                <ul className="space-y-1 text-gray-400 text-xs mb-4">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">›</span>
                    <span>Original: 1000×1000 → Inscribed: 2000×2000 (2x upscale)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">›</span>
                    <span>6 trait layers: Background, Body, Clothes, Mouth, Eyes, Top</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">›</span>
                    <span>Nearest-neighbor scaling — pixel-perfect, no anti-aliasing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">›</span>
                    <span>Postage: 330 sats</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Connect Modal */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-purple-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-purple-600">
                <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
                <button
                  onClick={() => setShowWalletConnect(false)}
                  className="text-gray-400 hover:text-white"
                >
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
