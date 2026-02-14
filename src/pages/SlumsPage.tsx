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

// Comic font via Google Fonts
const COMIC_FONT_LINK = 'https://fonts.googleapis.com/css2?family=Bangers&display=swap';

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
  const [recentMints, setRecentMints] = useState<Array<{
    itemIndex: number;
    itemName: string;
    timestamp: string;
    walletAddress: string | null;
    imageUrl: string | null;
  }>>([]);
  const [collectionData, setCollectionData] = useState<any>(null);

  // Load comic font
  useEffect(() => {
    if (!document.querySelector(`link[href="${COMIC_FONT_LINK}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = COMIC_FONT_LINK;
      document.head.appendChild(link);
    }
  }, []);

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
        console.warn('[SlumsPage] Preview render failed');
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
        setCollectionData(col);
      } else {
        setCollectionReady(false);
      }
    });
    loadMintCount();
    loadRecentMints();
  }, []);

  // Render a single item's layers to a data URL
  const renderItemImage = useCallback(async (layerIds: string[]): Promise<string | null> => {
    try {
      const SIZE = 200;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      for (const id of layerIds) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('img load failed'));
          el.src = `https://ordinals.com/content/${id}`;
        });
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
      }
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  const loadRecentMints = async () => {
    try {
      const res = await fetch(`${API_URL}/api/slums/recent`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.recent && data.recent.length > 0) {
        setRecentMints(data.recent.map((m: any) => ({ ...m, imageUrl: null })));
      }
    } catch {
      console.warn('[SlumsPage] Could not load recent mints');
    }
  };

  // Render recent mint images when collection data + recent mints are available
  useEffect(() => {
    if (!collectionData || recentMints.length === 0) return;
    if (recentMints.some(m => m.imageUrl !== null)) return; // already rendered

    let cancelled = false;
    const renderAll = async () => {
      const updated = [...recentMints];
      for (let i = 0; i < updated.length; i++) {
        if (cancelled) return;
        const item = collectionData.generated.find((g: any) => g.index === updated[i].itemIndex);
        if (item && item.layers) {
          const layerIds = item.layers.map((l: any) => l.trait.inscriptionId);
          const url = await renderItemImage(layerIds);
          updated[i] = { ...updated[i], imageUrl: url };
        }
      }
      if (!cancelled) {
        setRecentMints(updated);
      }
    };
    renderAll();
    return () => { cancelled = true; };
  }, [collectionData, recentMints.length]);

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
    setMintingStatus({ packId: 'slums', status: 'processing', progress: 10 });

    try {
      setMintingStatus({ packId: 'slums', status: 'processing', progress: 30 });

      const result = await mintSlumsRandom(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        mintCount
      );

      console.log(`[SlumsPage] Mint erfolgreich: ${result.inscriptionId}`);

      // === DOPPELTE ABSICHERUNG: Beide Log-Wege gleichzeitig ===

      // 1) Direkter Call an /api/slums/log (primär, SLUMS-spezifisch)
      try {
        await fetch(`${API_URL}/api/slums/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            inscriptionId: result.inscriptionId,
            txid: result.txid || null,
            itemName: `SLUMS #${result.item.index}`,
            itemIndex: result.item.index,
            priceInSats: isFreePhase ? 0 : SLUMS_PRICE_SATS,
            paymentTxid: result.paymentTxid || null,
          }),
        });
        console.log('[SlumsPage] SLUMS-Log gespeichert (direkt)');
      } catch (directLogErr) {
        console.warn('[SlumsPage] Direktes SLUMS-Log fehlgeschlagen:', directLogErr);
      }

      // 2) Backup: Generisches logMinting (routet im Backend auch zu saveSlumsLog)
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
        console.log('[SlumsPage] Backup-Log gespeichert (generisch)');
      } catch (logErr) {
        console.warn('[SlumsPage] Backup-Log fehlgeschlagen:', logErr);
      }

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
      // Refresh recent mints list
      loadRecentMints();
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

  const comicFont = "'Bangers', cursive";

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: '#111' }}>

      {/* Halftone dots background */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}></div>

      {/* Action lines / speed lines from center */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        background: 'repeating-conic-gradient(#fff 0deg, transparent 1deg, transparent 5deg, #fff 6deg)',
      }}></div>

      <div className="relative z-10 container mx-auto px-4 py-6 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-yellow-400 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Comic Header */}
        <div className="text-center mb-6">
          <h1
            className="text-6xl md:text-8xl mb-2 tracking-wider"
            style={{
              fontFamily: comicFont,
              color: '#FFE03D',
              WebkitTextStroke: '3px #000',
              textShadow: '4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 6px 0 rgba(0,0,0,0.3)',
              transform: 'rotate(-2deg)',
              letterSpacing: '0.08em',
            }}
          >
            SLUMS
          </h1>
          <p className="text-lg text-gray-300 italic" style={{ fontFamily: comicFont, letterSpacing: '0.05em' }}>
            333 Unique Pixel Ordinals on Bitcoin
          </p>
        </div>

        {collectionReady === null ? (
          <div className="text-white text-center py-8" style={{ fontFamily: comicFont }}>Loading...</div>
        ) : collectionReady === false ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-4xl md:text-6xl font-bold text-yellow-400" style={{
              fontFamily: comicFont,
              WebkitTextStroke: '2px #000',
              textShadow: '3px 3px 0 #000',
            }}>
              COMING SOON
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-6 lg:gap-8">

            {/* ====== LEFT: MINT PANEL ====== */}
            <div
              className="max-w-md w-full"
              style={{ transform: 'rotate(-1deg)' }}
            >
              <div className="bg-[#1a1a2e] border-[3px] border-black rounded-xl p-3 lg:p-4"
                style={{ boxShadow: '5px 5px 0 #EAB308' }}>

                {/* Preview with comic frame */}
                <div className="flex flex-col items-center mb-3">
                  <div className="relative mb-2 w-full max-w-[180px] aspect-square bg-black border-[3px] border-black rounded-md overflow-hidden"
                    style={{ boxShadow: '4px 4px 0 #000' }}>
                    {previewDataUrl ? (
                      <img
                        src={previewDataUrl}
                        alt="SLUMS Preview"
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {/* "POW!" badge for FREE phase */}
                    {isFreePhase && (
                      <div className="absolute -top-1 -right-1 z-10">
                        <div className="bg-red-500 text-white font-bold text-[10px] px-2 py-1 border-2 border-black"
                          style={{
                            fontFamily: comicFont,
                            transform: 'rotate(12deg)',
                            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                        </div>
                        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-[10px]"
                          style={{ fontFamily: comicFont, transform: 'rotate(12deg)' }}>
                          FREE!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Mint Counter - comic style */}
                  <div className="w-full mb-2">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-400" style={{ fontFamily: comicFont }}>Minted</span>
                      <span className="text-yellow-400 font-bold" style={{ fontFamily: comicFont, fontSize: '13px' }}>
                        {mintCount} / {SLUMS_TOTAL_SUPPLY}
                      </span>
                    </div>
                    <div className="w-full bg-black rounded-sm h-3 overflow-hidden border-2 border-black"
                      style={{ boxShadow: '2px 2px 0 #000' }}>
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${progressPercent}%`,
                          background: 'repeating-linear-gradient(45deg, #FFE03D, #FFE03D 6px, #FFC107 6px, #FFC107 12px)',
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-center">
                      {SLUMS_TOTAL_SUPPLY - mintCount} remaining
                    </p>
                  </div>

                  {/* Price Display - speech bubble style */}
                  <div className="relative bg-white text-black rounded-lg px-3 py-1.5 text-center border-2 border-black"
                    style={{ boxShadow: '3px 3px 0 #000' }}>
                    {/* Speech bubble tail */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
                      style={{
                        borderLeft: '8px solid transparent',
                        borderRight: '8px solid transparent',
                        borderTop: '8px solid #000',
                      }}></div>
                    <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-0 h-0"
                      style={{
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '6px solid #fff',
                      }}></div>
                    {isFreePhase ? (
                      <>
                        <p className="text-xl font-bold text-green-600" style={{ fontFamily: comicFont }}>FREE!</p>
                        <p className="text-[10px] text-gray-600">
                          {SLUMS_FREE_MINTS - mintCount} free left · then {SLUMS_PRICE_SATS.toLocaleString()} sats
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-purple-700" style={{ fontFamily: comicFont }}>
                          {SLUMS_PRICE_SATS.toLocaleString()} sats
                        </p>
                        <p className="text-[10px] text-gray-600">+ inscription fees</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Fee Rate */}
                <div className="mb-3 mt-3">
                  <FeeRateSelector
                    selectedFeeRate={inscriptionFeeRate}
                    onFeeRateChange={setInscriptionFeeRate}
                  />
                </div>

                {/* Minting Status */}
                {mintingStatus && (
                  <div className="mb-3">
                    <MintingProgress status={mintingStatus} />
                  </div>
                )}

                {/* Mint Button - big comic action button */}
                {!mintingStatus || mintingStatus.status === 'failed' ? (
                  <button
                    onClick={handleMint}
                    disabled={isMinting || !walletState.connected || isSoldOut}
                    className="w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-lg transition-all duration-200 transform hover:scale-105 hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
                    style={{
                      fontFamily: comicFont,
                      background: isSoldOut ? '#555' : 'linear-gradient(180deg, #FFE03D 0%, #FFA500 100%)',
                      color: '#000',
                      border: '3px solid #000',
                      boxShadow: '4px 4px 0 #000',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {isSoldOut ? (
                      'SOLD OUT!'
                    ) : isMinting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        MINTING...
                      </span>
                    ) : (
                      `MINT RANDOM${isFreePhase ? ' (FREE!)' : '!'}`
                    )}
                  </button>
                ) : mintingStatus.status === 'completed' ? (
                  <div className="text-center">
                    <p className="text-green-400 font-bold mb-3 text-lg" style={{ fontFamily: comicFont }}>
                      BOOM! MINT SUCCESSFUL!
                    </p>
                    <button
                      onClick={() => setMintingStatus(null)}
                      className="px-5 py-2 rounded-md font-semibold text-sm transition-colors text-black"
                      style={{
                        fontFamily: comicFont,
                        background: '#FFE03D',
                        border: '2px solid #000',
                        boxShadow: '3px 3px 0 #000',
                      }}
                    >
                      MINT ANOTHER!
                    </button>
                  </div>
                ) : null}

                {/* Wallet Connection */}
                {!walletState.connected && (
                  <p className="text-center text-gray-400 text-xs mt-3 cursor-pointer hover:text-yellow-400"
                    onClick={() => setShowWalletConnect(true)} style={{ fontFamily: comicFont }}>
                    Connect your wallet to mint
                  </p>
                )}

                <p className="text-[10px] text-gray-500 text-center mt-2">
                  {SLUMS_TOTAL_SUPPLY} unique pixel characters · Taproot (bc1p...)
                </p>
              </div>
            </div>

            {/* ====== RIGHT: DESCRIPTION PANEL ====== */}
            <div
              className="max-w-xl w-full"
              style={{ transform: 'rotate(1deg)' }}
            >
              <div className="bg-[#1a1a2e] border-[3px] border-black rounded-xl p-4 lg:p-5"
                style={{ boxShadow: '5px 5px 0 #22D3EE' }}>

                <h2 className="text-2xl text-yellow-400 mb-1" style={{
                  fontFamily: comicFont,
                  WebkitTextStroke: '1px #000',
                  textShadow: '2px 2px 0 #000',
                }}>
                  SLUMS
                </h2>
                <p className="text-sm mb-2" style={{ fontFamily: comicFont, color: '#FF6B9D' }}>
                  Pixel Art Ordinals Collection
                </p>

                {/* Speech bubble quote */}
                <div className="relative bg-white text-black rounded-lg px-3 py-2 mb-4 border-2 border-black inline-block"
                  style={{ boxShadow: '3px 3px 0 #000', transform: 'rotate(-1deg)' }}>
                  <p className="text-xs italic" style={{ fontFamily: comicFont }}>
                    "Where the streets have no name — but every character tells a story."
                  </p>
                  <div className="absolute -bottom-2 left-6 w-0 h-0"
                    style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #000' }}></div>
                  <div className="absolute -bottom-[5px] left-[26px] w-0 h-0"
                    style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #fff' }}></div>
                </div>

                <p className="text-gray-300 text-xs leading-relaxed mb-4">
                  Welcome to <span className="text-yellow-400 font-bold" style={{ fontFamily: comicFont }}>SLUMS</span> — a collection of 333 unique pixel art characters inscribed directly on the Bitcoin blockchain. Each piece is composed of 6 hand-crafted layers — background, body, clothes, mouth, eyes, and top — creating thousands of possible trait combinations.
                </p>

                {/* Pricing Box - comic panel style */}
                <div className="bg-black border-[3px] border-black rounded-md p-3 mb-4 relative"
                  style={{ boxShadow: '3px 3px 0 rgba(255,224,61,0.3)' }}>
                  <h3 className="text-sm text-yellow-400 mb-2" style={{ fontFamily: comicFont }}>PRICING</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-green-400" style={{ fontFamily: comicFont }}>Mint #1 – #100</span>
                      <span className="bg-green-500 text-black px-2 py-0.5 rounded-sm text-[10px] font-bold border border-black"
                        style={{ fontFamily: comicFont }}>
                        FREE!
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400" style={{ fontFamily: comicFont }}>Mint #101 – #333</span>
                      <span className="text-yellow-400 font-bold" style={{ fontFamily: comicFont }}>3,000 sats</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-sm text-cyan-400 mb-2 flex items-center gap-2" style={{ fontFamily: comicFont }}>
                  HOW IT WORKS
                </h3>

                <ul className="space-y-1.5 text-gray-300 text-xs mb-4">
                  {[
                    ['333 unique characters', '— each one different'],
                    ['Random mint', '— you don\'t see which one you get'],
                    ['6 on-chain AVIF layers', '— composited recursively'],
                    ['Inscribed as HTML', '— recursive on Bitcoin'],
                    ['Taproot address', '— sent to your bc1p...'],
                  ].map(([bold, rest], i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-400 text-sm leading-none mt-0.5">&#9670;</span>
                      <span><strong className="text-white">{bold}</strong> {rest}</span>
                    </li>
                  ))}
                </ul>

                {/* Bottom quote - comic panel */}
                <div className="bg-yellow-400 text-black rounded-md px-3 py-2 border-2 border-black text-center"
                  style={{ boxShadow: '3px 3px 0 #000', transform: 'rotate(-0.5deg)' }}>
                  <p className="text-sm" style={{ fontFamily: comicFont }}>
                    Built different. Minted on Bitcoin.
                  </p>
                </div>

              </div>
            </div>

          </div>

          {/* ====== RECENT MINTS (below panels) ====== */}
          {recentMints.length > 0 && (
            <div className="w-full mt-8 mb-4">
              <h3 className="text-center text-xl text-yellow-400 mb-4"
                style={{ fontFamily: comicFont, WebkitTextStroke: '1px #000', textShadow: '2px 2px 0 #000' }}>
                RECENT MINTS
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {recentMints.map((mint, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-black border-2 border-black rounded-md overflow-hidden"
                      style={{ boxShadow: '3px 3px 0 #000' }}>
                      {mint.imageUrl ? (
                        <img src={mint.imageUrl} alt={mint.itemName}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1 text-center" style={{ fontFamily: comicFont }}>
                      #{mint.itemIndex}
                    </p>
                    {mint.walletAddress && (
                      <p className="text-[8px] text-gray-600 text-center">{mint.walletAddress}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        )}

        {/* Wallet Connect Modal */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a2e] border-[3px] border-black rounded-lg max-w-md w-full"
              style={{ boxShadow: '6px 6px 0 #000' }}>
              <div className="flex justify-between items-center p-4 border-b-[3px] border-black">
                <h2 className="text-xl text-yellow-400" style={{ fontFamily: comicFont }}>Connect Wallet</h2>
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
