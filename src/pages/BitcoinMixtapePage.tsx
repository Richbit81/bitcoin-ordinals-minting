import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';

// Bitcoin Mixtape Konfiguration
const MIXTAPE_CONFIG = {
  name: 'Bitcoin Mix Tape',
  originalInscriptionId: 'a346945c962d4c9f25ca8a5bea7cfd4de3bc8665f0640d8991df6137878d2ee0i0',
  priceInSats: 20000, // 20,000 sats
  priceInBTC: 0.0002, // 0.0002 BTC
  collection: 'Bitcoin Mix Tape',
  thumbnail: '/mixtape.png',
};

// API URL für Inscription-Bilder
const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const BitcoinMixtapePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Video State
  const [showVideo, setShowVideo] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  
  // Minting State
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [isMinting, setIsMinting] = useState(false);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [mintCount, setMintCount] = useState<number>(0);

  // Lade Mint-Statistiken
  useEffect(() => {
    loadMintStats();
  }, []);

  const loadMintStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/mixtape/stats`);
      if (response.ok) {
        const data = await response.json();
        setMintCount(data.totalMints || 0);
      }
    } catch (error) {
      console.warn('[BitcoinMixtape] Could not load mint stats:', error);
    }
  };

  // Video Event Handler
  const handleVideoEnded = () => {
    setVideoEnded(true);
    // Kurze Verzögerung bevor wir das Video ausblenden
    setTimeout(() => {
      setShowVideo(false);
    }, 500);
  };

  const handleSkipVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setVideoEnded(true);
    setShowVideo(false);
  };

  // Minting Handler
  const handleMint = async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    setIsMinting(true);
    setMintingStatus({
      progress: 0,
      status: 'processing',
      message: 'Initiating mint...',
    });

    try {
      // Schritt 1: Vorbereitung
      setMintingStatus(prev => prev ? { 
        ...prev, 
        progress: 20, 
        message: 'Creating delegate inscription...' 
      } : null);

      // Schritt 2: Delegate erstellen
      const result = await createSingleDelegate(
        MIXTAPE_CONFIG.originalInscriptionId,
        MIXTAPE_CONFIG.name,
        userAddress,
        MIXTAPE_CONFIG.collection,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        'image', // Content Type für Mixtape (zeigt Original-Inscription als Bild)
        MIXTAPE_CONFIG.priceInSats
      );

      setMintingStatus(prev => prev ? { 
        ...prev, 
        progress: 70, 
        message: 'Saving mint record...' 
      } : null);

      // Schritt 3: Mint-Log speichern
      try {
        await fetch(`${API_URL}/api/mixtape/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            inscriptionId: result.inscriptionId,
            txid: result.txid,
            originalInscriptionId: MIXTAPE_CONFIG.originalInscriptionId,
            priceInSats: MIXTAPE_CONFIG.priceInSats,
          }),
        });
      } catch (logError) {
        console.warn('[BitcoinMixtape] Could not save mint log:', logError);
      }

      // Erfolg!
      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted ${MIXTAPE_CONFIG.name}!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });

      // Aktualisiere Mint-Count
      setMintCount(prev => prev + 1);

    } catch (error: any) {
      console.error('[BitcoinMixtape] Minting error:', error);
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error.message || 'Minting failed. Please try again.',
      });
    } finally {
      setIsMinting(false);
    }
  };

  // Video Intro Screen
  if (showVideo) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          onEnded={handleVideoEnded}
          className={`w-full h-full object-contain transition-opacity duration-500 ${
            videoEnded ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <source src="/videos/mixtape-intro.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Skip Button */}
        <button
          onClick={handleSkipVideo}
          className="absolute bottom-8 right-8 px-6 py-3 bg-black/60 hover:bg-black/80 border border-white/30 hover:border-red-600 rounded-lg text-white font-semibold transition-all duration-300 backdrop-blur-sm"
        >
          Skip →
        </button>

        {/* Progress Indicator */}
        <div className="absolute bottom-8 left-8 text-white/50 text-sm">
          Bitcoin Mix Tape
        </div>
      </div>
    );
  }

  // Minting Page
  return (
    <div 
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{
        backgroundImage: 'url(/mixtape.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

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
          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-white drop-shadow-2xl">
            Bitcoin Mix Tape
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Mint your exclusive Bitcoin Mix Tape delegate
          </p>
          <p className="text-sm text-gray-500">
            {mintCount > 0 ? `${mintCount} minted so far` : 'Be the first to mint!'}
          </p>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-black/80 border-2 border-red-600 rounded-xl p-8 max-w-lg w-full backdrop-blur-md">
            {/* Mixtape Preview */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-6">
                <img
                  src={MIXTAPE_CONFIG.thumbnail}
                  alt={MIXTAPE_CONFIG.name}
                  className="w-64 h-64 object-contain rounded-lg shadow-2xl shadow-red-600/30"
                />
                <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                  DELEGATE
                </div>
              </div>
              
              {/* Price Display */}
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600 mb-1">
                  {MIXTAPE_CONFIG.priceInSats.toLocaleString()} sats
                </p>
                <p className="text-sm text-gray-400">
                  ({MIXTAPE_CONFIG.priceInBTC} BTC) + inscription fees
                </p>
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
            {!mintingStatus || mintingStatus.status === 'error' ? (
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-red-600/30"
              >
                {isMinting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Minting...
                  </span>
                ) : (
                  '🎵 MINT NOW'
                )}
              </button>
            ) : mintingStatus.status === 'success' ? (
              <div className="text-center">
                <p className="text-green-400 font-bold mb-4">✅ Mint Successful!</p>
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
              <p className="text-center text-gray-400 text-sm mt-4">
                Connect your wallet to mint
              </p>
            )}
          </div>

          {/* Original Inscription Link */}
          <div className="mt-6 text-center">
            <a
              href={`https://ordinals.com/inscription/${MIXTAPE_CONFIG.originalInscriptionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-red-600 text-sm transition-colors"
            >
              View Original Inscription →
            </a>
          </div>
        </div>

        {/* Wallet Connect Modal */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-red-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-red-600">
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
