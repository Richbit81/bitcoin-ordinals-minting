import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { logMinting } from '../services/mintingLog';

const RICHREADER_CONFIG = {
  name: 'RichReader',
  inscriptionId: '1eb4cf686bc4163bf2c5a4cba592bf70ca17e489a025c0ccf7be3c80b22333b0i0',
  priceInSats: 20000,
  priceInBTC: 0.0002,
  collection: 'Audiobooks',
  description:
    'RichReader is an ordinal app that lets you read and listen to books inscribed on Bitcoin Ordinals. ' +
    'It features a 3D book model viewer, chapter-by-chapter text extraction, and a built-in Text-to-Speech engine ' +
    'with real-time word highlighting. Books are loaded directly from on-chain inscriptions.',
};

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ΣΩΔΨΘΛΞΠαβγδ₿⚡';
    const fontSize = 14;
    let columns: number;
    let drops: number[];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        const brightness = Math.random();
        if (brightness > 0.95) {
          ctx.fillStyle = '#ffffff';
        } else if (brightness > 0.8) {
          ctx.fillStyle = '#00ff88';
        } else {
          ctx.fillStyle = `rgba(0, 255, 100, ${0.15 + Math.random() * 0.25})`;
        }

        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5 + Math.random() * 0.5;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, opacity: 0.35 }} />;
}

export const AudiobooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [isMinting, setIsMinting] = useState(false);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [tryMode, setTryMode] = useState(false);

  const handleMint = async () => {
    if (isMinting) return;

    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    setIsMinting(true);
    setMintingStatus({ progress: 0, status: 'processing', message: 'Initiating mint...' });

    try {
      setMintingStatus((prev) => (prev ? { ...prev, progress: 20, message: 'Creating delegate inscription...' } : null));

      const result = await createSingleDelegate(
        RICHREADER_CONFIG.inscriptionId,
        RICHREADER_CONFIG.name,
        userAddress,
        RICHREADER_CONFIG.collection,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        'html',
        RICHREADER_CONFIG.priceInSats
      );

      setMintingStatus((prev) => (prev ? { ...prev, progress: 70, message: 'Saving mint record...' } : null));

      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'audiobooks',
          packName: RICHREADER_CONFIG.collection,
          cards: [
            {
              id: 'richreader',
              name: RICHREADER_CONFIG.name,
              inscriptionId: result.inscriptionId,
              rarity: 'common',
            },
          ],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: (result as any).paymentTxid || undefined,
        });
      } catch {
        // Keep UX successful even when logging fails.
      }

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted ${RICHREADER_CONFIG.name}!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });
    } catch (error: any) {
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error?.message || 'Minting failed. Please try again.',
      });
    } finally {
      setIsMinting(false);
    }
  };

  if (tryMode) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-emerald-500/30 backdrop-blur-sm">
          <span className="text-emerald-400 font-mono text-sm tracking-widest uppercase">
            RichReader // Preview Mode
          </span>
          <button
            onClick={() => setTryMode(false)}
            className="px-4 py-1.5 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 rounded font-mono text-sm transition-colors"
          >
            EXIT
          </button>
        </div>
        <iframe
          src={`https://ordinals.com/content/${RICHREADER_CONFIG.inscriptionId}`}
          title="RichReader Preview"
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <MatrixRain />

      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.015) 2px, rgba(0,255,100,0.015) 4px)',
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-emerald-400 flex items-center gap-2 transition-colors font-mono text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            BACK
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2">
            <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500 bg-clip-text text-transparent drop-shadow-lg">
              RICHREADER
            </span>
          </h1>
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.3em] uppercase">
            Ordinal Inscription Library &middot; TTS Engine &middot; v1.0
          </p>
          <p className="text-gray-500 font-mono text-[10px] mt-1 tracking-widest">
            // DYSTOPIAN PROTOCOL
          </p>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 max-w-7xl mx-auto w-full">

          {/* Left: Preview + Try */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-gray-950 shadow-2xl shadow-emerald-900/20 aspect-[4/3]">
              <iframe
                src={`https://ordinals.com/content/${RICHREADER_CONFIG.inscriptionId}`}
                title={RICHREADER_CONFIG.name}
                className="w-full h-full border-0 pointer-events-none"
                sandbox="allow-scripts allow-same-origin"
                loading="eager"
              />
            </div>

            <button
              onClick={() => setTryMode(true)}
              className="w-full py-3 rounded-lg font-mono text-sm tracking-wider border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 transition-all"
            >
              ▶ TRY RICHREADER
            </button>

            {/* Description */}
            <div className="bg-gray-950/80 border border-emerald-500/10 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-emerald-400 font-mono text-sm tracking-wider mb-3 uppercase">
                About RichReader
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                {RICHREADER_CONFIG.description}
              </p>

              <div className="space-y-2">
                {[
                  { label: '3D Book Viewer', desc: 'Interactive Three.js book model' },
                  { label: 'TTS Engine', desc: 'Text-to-Speech with real-time word highlighting' },
                  { label: 'Chapter Navigation', desc: 'Browse books chapter by chapter' },
                  { label: 'Fully On-Chain', desc: 'Books loaded directly from Bitcoin inscriptions' },
                  { label: 'Multiple Voices', desc: 'Choose language and playback speed' },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-2">
                    <span className="text-emerald-500 text-xs mt-0.5">▸</span>
                    <span className="text-sm">
                      <span className="text-emerald-300 font-semibold">{f.label}</span>
                      <span className="text-gray-500"> — {f.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Mint Panel */}
          <div className="w-full lg:w-5/12">
            <div className="bg-gray-950/90 border border-emerald-500/20 rounded-xl p-6 backdrop-blur-sm shadow-2xl shadow-emerald-900/10 sticky top-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black tracking-tight text-white mb-1">
                  Mint RichReader
                </h2>
                <p className="text-emerald-500/60 font-mono text-[10px] tracking-widest uppercase">
                  Delegate Inscription
                </p>
              </div>

              {/* Price */}
              <div className="text-center mb-6 py-4 border-y border-emerald-500/10">
                <p className="text-3xl font-black text-emerald-400">
                  {RICHREADER_CONFIG.priceInSats.toLocaleString()} sats
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  ({RICHREADER_CONFIG.priceInBTC} BTC) + inscription fees
                </p>
              </div>

              {/* Fee Rate */}
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
              {!mintingStatus || mintingStatus.status === 'error' ? (
                <button
                  onClick={handleMint}
                  disabled={isMinting}
                  className="w-full py-4 rounded-lg font-bold text-lg transition-all bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30 tracking-wide"
                >
                  {isMinting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      MINTING...
                    </span>
                  ) : (
                    'MINT NOW'
                  )}
                </button>
              ) : mintingStatus.status === 'success' ? (
                <div className="text-center">
                  <p className="text-emerald-400 font-bold mb-4">Mint Successful!</p>
                  <button
                    onClick={() => setMintingStatus(null)}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors border border-emerald-500/20"
                  >
                    Mint Another
                  </button>
                </div>
              ) : null}

              {!walletState.connected && (
                <p className="text-center text-gray-500 text-xs mt-4 font-mono">
                  Connect wallet to mint
                </p>
              )}

              {/* Info Box */}
              <div className="mt-6 p-4 rounded-lg border border-emerald-500/10 bg-black/40">
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                  Your RichReader delegate will be inscribed on Bitcoin and sent to your wallet.
                  It functions as a fully on-chain audiobook reader — loading books directly from the blockchain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connect Modal */}
      {showWalletConnect && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-black border border-emerald-500/40 rounded-xl max-w-md w-full shadow-2xl shadow-emerald-900/20">
            <div className="flex justify-between items-center p-4 border-b border-emerald-500/20">
              <h2 className="text-lg font-bold text-emerald-400 font-mono">Connect Wallet</h2>
              <button onClick={() => setShowWalletConnect(false)} className="text-gray-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
};
