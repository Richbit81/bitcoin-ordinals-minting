import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';

// NFT Item Configuration
const NFT_ITEM = {
  id: 'nft-delegate',
  name: 'NFT',
  inscriptionId: '1151d32019503a91b2495d2900f86c7b7d8922a6583c61b6dec657812091fc59i0',
  priceInSats: 5000,
  priceInBTC: 0.00005,
  description: 'only Ordinals are real NFTs',
  contentType: 'image' as const, // animated AVIF
};

const COLLECTION_NAME = 'NFT';

// API URL
const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const NftMintingPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

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
      setMintingStatus(prev => prev ? {
        ...prev,
        progress: 20,
        message: `Creating delegate for "${NFT_ITEM.name}"...`,
      } : null);

      const result = await createSingleDelegate(
        NFT_ITEM.inscriptionId,
        NFT_ITEM.name,
        userAddress,
        COLLECTION_NAME,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        'image',
        NFT_ITEM.priceInSats
      );

      setMintingStatus(prev => prev ? {
        ...prev,
        progress: 70,
        message: 'Saving mint record...',
      } : null);

      // Log mint to backend
      try {
        await fetch(`${API_URL}/api/nft/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            inscriptionId: result.inscriptionId,
            txid: result.txid,
            originalInscriptionId: NFT_ITEM.inscriptionId,
            itemName: NFT_ITEM.name,
            priceInSats: NFT_ITEM.priceInSats,
          }),
        });
      } catch (logError) {
        console.warn('[NFT] Could not save mint log:', logError);
      }

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted "${NFT_ITEM.name}"!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });

    } catch (error: any) {
      console.error('[NFT] Minting error:', error);
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error.message || 'Minting failed. Please try again.',
      });
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 via-black to-purple-950/20"></div>

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
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">NFT</span>
          </h1>
          <p className="text-xl text-purple-300 italic">
            "{NFT_ITEM.description}"
          </p>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-start max-w-lg mx-auto w-full">
          <div className="bg-black/80 border-2 border-purple-600/50 rounded-xl p-6 w-full backdrop-blur-md hover:border-purple-500 transition-colors duration-300">
            {/* Inscription Preview - animated AVIF */}
            <div className="relative mb-6 w-full rounded-lg overflow-hidden shadow-2xl shadow-purple-600/20 border border-purple-600/30 bg-gray-900">
              <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                <iframe
                  src={`https://ordinals.com/content/${NFT_ITEM.inscriptionId}`}
                  title={NFT_ITEM.name}
                  className="absolute inset-0 w-full h-full border-0 rounded-lg"
                  sandbox="allow-scripts allow-same-origin"
                  scrolling="no"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Item Info */}
            <h2 className="text-2xl font-black text-white mb-2">{NFT_ITEM.name}</h2>
            <p className="text-sm text-gray-400 mb-4">{NFT_ITEM.description}</p>

            {/* Price */}
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-purple-400">
                {NFT_ITEM.priceInSats.toLocaleString()} sats
              </p>
              <p className="text-sm text-gray-500">
                ({NFT_ITEM.priceInBTC} BTC) + inscription fees
              </p>
            </div>

            {/* Fee Rate Selector */}
            <div className="mb-4">
              <FeeRateSelector
                selectedFeeRate={inscriptionFeeRate}
                onFeeRateChange={setInscriptionFeeRate}
              />
            </div>

            {/* Minting Status */}
            {mintingStatus && (
              <div className="mb-4">
                <MintingProgress status={mintingStatus} />
              </div>
            )}

            {/* Mint Button */}
            {(!mintingStatus || mintingStatus.status === 'error') ? (
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-600/30"
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
                  `🟣 MINT "${NFT_ITEM.name}" for ${NFT_ITEM.priceInSats.toLocaleString()} sats`
                )}
              </button>
            ) : mintingStatus.status === 'success' ? (
              <div className="text-center">
                <p className="text-green-400 font-bold mb-4">✅ Mint Successful!</p>
                {mintingStatus.txid && (
                  <a
                    href={`https://mempool.space/tx/${mintingStatus.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 underline font-mono"
                  >
                    View on Mempool →
                  </a>
                )}
                <button
                  onClick={() => setMintingStatus(null)}
                  className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors block mx-auto"
                >
                  Mint Another
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Wallet Connection Info */}
        {!walletState.connected && (
          <div className="text-center mt-8">
            <p className="text-gray-400 text-sm mb-2">Connect your wallet to mint</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 text-xs">
            Delegate inscription • Animated AVIF on Bitcoin
          </p>
        </div>

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
