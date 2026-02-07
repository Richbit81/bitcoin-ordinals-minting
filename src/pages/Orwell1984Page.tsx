import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';

// 1984 Collection Items
const ITEMS_1984 = [
  {
    id: 'war-is-peace',
    name: 'WAR IS PEACE',
    inscriptionId: '5c50d2e25d833e1357de824184e9d7859945c62f3b6af54c0f2f2a03caf5fd74i0',
    priceInSats: 6000,
    priceInBTC: 0.00006,
    description: 'WAR IS PEACE — an Ordinal inspired by George Orwell\'s 1984.',
  },
  {
    id: 'its-1984-oclock',
    name: "It's 1984 o'clock!",
    inscriptionId: '48bdab5d74516e534ad7bda60e527a1eb788e90745e54ff902947ebbd905c678i0',
    priceInSats: 10000,
    priceInBTC: 0.0001,
    description: "It's 1984 o'clock! — a tribute to Orwell's dystopian masterpiece, inscribed on Bitcoin.",
  },
];

const COLLECTION_NAME = '1984';

// API URL
const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const Orwell1984Page: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  // Minting State (per item)
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  const handleMint = async (item: typeof ITEMS_1984[0]) => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    setMintingItemId(item.id);
    setMintingStatus({
      progress: 0,
      status: 'processing',
      message: 'Initiating mint...',
    });

    try {
      setMintingStatus(prev => prev ? {
        ...prev,
        progress: 20,
        message: `Creating delegate for "${item.name}"...`,
      } : null);

      const result = await createSingleDelegate(
        item.inscriptionId,
        item.name,
        userAddress,
        COLLECTION_NAME,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        'image', // Content type
        item.priceInSats
      );

      setMintingStatus(prev => prev ? {
        ...prev,
        progress: 70,
        message: 'Saving mint record...',
      } : null);

      // Log mint
      try {
        await fetch(`${API_URL}/api/1984/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            inscriptionId: result.inscriptionId,
            txid: result.txid,
            originalInscriptionId: item.inscriptionId,
            itemName: item.name,
            priceInSats: item.priceInSats,
          }),
        });
      } catch (logError) {
        console.warn('[1984] Could not save mint log:', logError);
      }

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted "${item.name}"!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });

    } catch (error: any) {
      console.error('[1984] Minting error:', error);
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error.message || 'Minting failed. Please try again.',
      });
    } finally {
      setMintingItemId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background - dark dystopian feel */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-black to-gray-900"></div>
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
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
        <div className="text-center mb-10">
          <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter">
            <span className="text-red-600">1984</span>
          </h1>
          <p className="text-xl text-gray-400 italic">
            "Big Brother is watching you."
          </p>
          <p className="text-sm text-gray-600 mt-2">
            — George Orwell
          </p>
        </div>

        {/* Items Grid */}
        <div className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 max-w-5xl mx-auto w-full">
          {ITEMS_1984.map((item) => (
            <div key={item.id} className="bg-black/80 border-2 border-red-600/50 rounded-xl p-6 max-w-lg w-full backdrop-blur-md hover:border-red-600 transition-colors duration-300">
              {/* Inscription Preview - scaled iframe to prevent scrollbars */}
              <div className="relative mb-6 w-full rounded-lg overflow-hidden shadow-2xl shadow-red-600/20 border border-red-600/30 bg-gray-900"
                style={{ paddingBottom: '100%' }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '300%',
                    height: '300%',
                    transform: 'translate(-50%, -50%) scale(0.333)',
                    transformOrigin: 'center center',
                  }}
                >
                  <iframe
                    src={`https://ordinals.com/content/${item.inscriptionId}`}
                    title={item.name}
                    className="border-0"
                    sandbox="allow-scripts allow-same-origin"
                    scrolling="no"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '100%',
                      overflow: 'hidden',
                    }}
                  />
                </div>
              </div>

              {/* Item Info */}
              <h2 className="text-2xl font-black text-white mb-2">{item.name}</h2>
              <p className="text-sm text-gray-400 mb-4">{item.description}</p>

              {/* Price */}
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-red-600">
                  {item.priceInSats.toLocaleString()} sats
                </p>
                <p className="text-sm text-gray-500">
                  ({item.priceInBTC} BTC) + inscription fees
                </p>
              </div>

              {/* Fee Rate Selector */}
              <div className="mb-4">
                <FeeRateSelector
                  selectedFeeRate={inscriptionFeeRate}
                  onFeeRateChange={setInscriptionFeeRate}
                />
              </div>

              {/* Minting Status (nur für dieses Item) */}
              {mintingStatus && mintingItemId === item.id && (
                <div className="mb-4">
                  <MintingProgress status={mintingStatus} />
                </div>
              )}

              {/* Mint Button */}
              {(!mintingStatus || mintingStatus.status === 'error' || mintingItemId !== item.id) ? (
                <button
                  onClick={() => handleMint(item)}
                  disabled={mintingItemId !== null}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-red-600/30"
                >
                  {mintingItemId === item.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Minting...
                    </span>
                  ) : (
                    `🔴 MINT "${item.name}"`
                  )}
                </button>
              ) : mintingStatus.status === 'success' && mintingItemId === item.id ? (
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
            </div>
          ))}
        </div>

        {/* Wallet Connection Info */}
        {!walletState.connected && (
          <div className="text-center mt-8">
            <p className="text-gray-400 text-sm mb-2">Connect your wallet to mint</p>
          </div>
        )}

        {/* Footer Quote */}
        <div className="mt-12 text-center">
          <blockquote className="text-gray-600 italic text-sm max-w-xl mx-auto">
            "Freedom is the freedom to say that two plus two make four. If that is granted, all else follows."
          </blockquote>
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
