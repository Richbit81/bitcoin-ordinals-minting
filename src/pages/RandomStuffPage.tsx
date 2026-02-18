import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { getOrdinalAddress } from '../utils/wallet';

// Random Stuff Collection Items
const RANDOM_ITEMS = [
  {
    id: 'pink-block',
    name: 'Pink Block',
    inscriptionId: 'f86f39ff37a31954db74fdea7c0310bd67c4e0f122911718ae4a3a8f2f1ba7d5i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'metatron',
    name: 'Metatron',
    inscriptionId: '0c6621f4bc9d3b4c839b7fa02e7d0d097ea613c49542c5c937c2e2c41c2ae603i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: '369',
    name: '369',
    inscriptionId: '3cfe3cf26f1f8e727b3c2ccd0dcc89f97e89445c5bfd22f93ce125e380e83027i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'c3',
    name: 'C3',
    inscriptionId: 'b36e7c2ef126589776ca5e4ed6053a48c9df5fcb935ffcdece0111f8778097fci0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'escape',
    name: 'Escape',
    inscriptionId: 'c46de6b56a28fc5c9da4d22a8a15825e604418c1ad1e4eea6650afdebff0e670i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'smile',
    name: 'Smile',
    inscriptionId: '443b155804ee47845709a4743ad84184e3b96972120526e656f5fb2c5214cb82i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'nft-tv',
    name: 'NFT TV',
    inscriptionId: '1151d32019503a91b2495d2900f86c7b7d8922a6583c61b6dec657812091fc59i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'nft',
    name: 'NFT',
    inscriptionId: 'cfce0acba29652bf48f7f050c0a242de299df85532b2f0c0082fee343a8a0050i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
  },
  {
    id: 'al-yen',
    name: 'AL YEN',
    inscriptionId: 'bccedf4befa8aa377c2dbae11ceebab9d15b17e3dc57021e545863e69b60a6a4i0',
    priceInSats: 5000,
    priceInBTC: 0.00005,
    contentType: 'html' as const,
  },
];

const COLLECTION_NAME = 'Random Stuff';

// API URL
const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const RandomStuffPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  const handleMint = async (item: typeof RANDOM_ITEMS[0]) => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = getOrdinalAddress(walletState.accounts);
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
        'image',
        item.priceInSats
      );

      setMintingStatus(prev => prev ? {
        ...prev,
        progress: 70,
        message: 'Saving mint record...',
      } : null);

      // Log mint
      try {
        await fetch(`${API_URL}/api/random-stuff/log`, {
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
        console.warn('[RandomStuff] Could not save mint log:', logError);
      }

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted "${item.name}"!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });

    } catch (error: any) {
      console.error('[RandomStuff] Minting error:', error);
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
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-black to-cyan-950/10"></div>

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
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">Random Stuff</span>
          </h1>
          <p className="text-lg text-gray-400">
            Pick your favorite — all delegates, all <span className="text-cyan-400 font-bold">5,000 sats</span>
          </p>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          {RANDOM_ITEMS.map((item) => (
            <div key={item.id} className="bg-black/80 border-2 border-cyan-600/30 rounded-xl p-4 backdrop-blur-md hover:border-cyan-500 transition-all duration-300 group">
              {/* Preview */}
              <div className="relative mb-4 w-full rounded-lg overflow-hidden shadow-lg shadow-cyan-600/10 border border-cyan-600/20 bg-gray-900">
                {item.contentType === 'html' ? (
                  <div className="w-full aspect-square">
                    <iframe
                      src={`https://ordinals.com/content/${item.inscriptionId}`}
                      title={item.name}
                      className="w-full h-full border-0 rounded-lg"
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      scrolling="no"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                ) : (
                  <img
                    src={`https://ordinals.com/content/${item.inscriptionId}`}
                    alt={item.name}
                    className="w-full h-auto rounded-lg"
                    loading="lazy"
                  />
                )}
              </div>

              {/* Name & Price */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{item.name}</h2>
                <span className="text-cyan-400 font-bold text-sm">{item.priceInSats.toLocaleString()} sats</span>
              </div>

              {/* Fee Rate Selector */}
              <div className="mb-3">
                <FeeRateSelector
                  selectedFeeRate={inscriptionFeeRate}
                  onFeeRateChange={setInscriptionFeeRate}
                />
              </div>

              {/* Minting Status (only for this item) */}
              {mintingStatus && mintingItemId === item.id && (
                <div className="mb-3">
                  <MintingProgress status={mintingStatus} />
                </div>
              )}

              {/* Mint Button */}
              {(!mintingStatus || mintingStatus.status === 'error' || mintingItemId !== item.id) ? (
                <button
                  onClick={() => handleMint(item)}
                  disabled={mintingItemId !== null}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-600/20"
                >
                  {mintingItemId === item.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Minting...
                    </span>
                  ) : (
                    `MINT "${item.name}"`
                  )}
                </button>
              ) : mintingStatus.status === 'success' && mintingItemId === item.id ? (
                <div className="text-center">
                  <p className="text-green-400 font-bold mb-2 text-sm">✅ Mint Successful!</p>
                  {mintingStatus.txid && (
                    <a
                      href={`https://mempool.space/tx/${mintingStatus.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono"
                    >
                      View on Mempool →
                    </a>
                  )}
                  <button
                    onClick={() => setMintingStatus(null)}
                    className="mt-2 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors text-xs"
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

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 text-xs">
            Delegate inscriptions • All items 5,000 sats
          </p>
        </div>

        {/* Wallet Connect Modal */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-cyan-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-cyan-600">
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
