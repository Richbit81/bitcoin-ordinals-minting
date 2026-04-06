import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { addMintPoints } from '../services/pointsService';

// Free Stuff Collection Items
const FREE_ITEMS = [
  {
    id: 'shadowfire',
    name: 'Shadowfire',
    inscriptionId: '4a019b00eaed13dce49df0ba18d1f82c95a276ca09a4b16c6990336ae7bc189bi0',
    priceInSats: 0,
    priceInBTC: 0,
  },
  {
    id: '369',
    name: '369',
    inscriptionId: '5c5b7974b1774f773ccf79f486546d523e82ef162e3a08e771fe9bf39c047ef7i0',
    priceInSats: 0,
    priceInBTC: 0,
  },
  {
    id: 'galaxy-sling',
    name: 'Galaxy Sling',
    inscriptionId: '6afbf8c41394eb03455914d984f986ea3237634fb78d4cc1b7429a8374d6fe46i0',
    priceInSats: 0,
    priceInBTC: 0,
    description: 'A physics-based puzzle game where you sling a probe through space using gravitational fields. Aim for the target, but don\'t fly straight — curve your path around planets to score! Dodge red nebulae, collect pickups, use boosts for a burst of speed, and clear levels of increasing difficulty. Simple controls: drag to launch, click or tap mid-flight to boost. How far can you go?',
    isHtml: true,
  },
  {
    id: 'interference',
    name: 'Interference',
    inscriptionId: '22069842ee74a7983b2f0b13b7a2faabb3cd0bc2f07ab8ea922dbf1a7d1dac84i0',
    priceInSats: 0,
    priceInBTC: 0,
    description: 'Interference whispers that reality shifts the moment you touch it—as if waves know when they are being seen. And when you look, the world decides again: not what is, but what is allowed to be.',
    isHtml: true,
  },
];

const COLLECTION_NAME = 'Free Stuff';

// API URL
const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || '';

export const FreeStuffPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [previewItem, setPreviewItem] = useState<typeof FREE_ITEMS[0] | null>(null);

  const handleMint = async (item: typeof FREE_ITEMS[0]) => {
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
        await fetch(`${API_URL}/api/free-stuff/log`, {
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
        console.warn('[FreeStuff] Could not save mint log:', logError);
      }

      try {
        await addMintPoints(userAddress, {
          collection: 'Free Stuff',
          itemName: item.name,
          inscriptionId: result.inscriptionId,
          mintLogSource: 'free-stuff',
        });
      } catch (pointsError) {
        console.warn('[FreeStuff] Could not add mint points:', pointsError);
      }

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted "${item.name}"!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });

    } catch (error: any) {
      console.error('[FreeStuff] Minting error:', error);
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
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-black to-emerald-950/10"></div>

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
            <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-lime-400 bg-clip-text text-transparent">Free Stuff</span>
          </h1>
          <p className="text-lg text-gray-400">
            Free mints — just pay the <span className="text-emerald-400 font-bold">network fee</span>
          </p>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto w-full">
          {FREE_ITEMS.map((item) => (
            <div key={item.id} className="bg-black/80 border-2 border-emerald-600/30 rounded-xl p-3 backdrop-blur-md hover:border-emerald-500 transition-all duration-300 group flex flex-col">
              {/* Preview */}
              <div className="relative mb-3 w-full rounded-lg overflow-hidden shadow-lg shadow-emerald-600/10 border border-emerald-600/20 bg-gray-900" style={{ aspectRatio: '1 / 1' }}>
                {(item as any).isHtml ? (
                  <iframe
                    src={`https://ordinals.com/content/${item.inscriptionId}`}
                    title={item.name}
                    className="w-full h-full rounded-lg pointer-events-none"
                    style={{ border: 'none', background: '#000' }}
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                  />
                ) : (
                  <img
                    src={`https://ordinals.com/content/${item.inscriptionId}`}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                  />
                )}
              </div>

              {/* Name & Price */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{item.name}</h2>
                  <span className="text-[10px] text-gray-500 italic">Delegate</span>
                </div>
                <span className="text-emerald-400 font-bold text-xs">FREE</span>
              </div>

              {/* Description (if present) */}
              {(item as any).description && (
                <p className="text-[10px] text-gray-400 mb-2 leading-relaxed line-clamp-3">{(item as any).description}</p>
              )}

              {/* Try First (HTML ordinals) */}
              {(item as any).isHtml && (
                <button
                  onClick={() => setPreviewItem(item)}
                  className="block w-full py-2 mb-2 text-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg font-bold text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-600/20"
                >
                  🚀 Try First
                </button>
              )}

              {/* Fee Rate Selector */}
              <div className="mt-auto mb-2">
                <FeeRateSelector
                  selectedFeeRate={inscriptionFeeRate}
                  onFeeRateChange={setInscriptionFeeRate}
                />
              </div>

              {/* Minting Status (only for this item) */}
              {mintingStatus && mintingItemId === item.id && (
                <div className="mb-2">
                  <MintingProgress status={mintingStatus} />
                </div>
              )}

              {/* Mint Button */}
              {(!mintingStatus || mintingStatus.status === 'error' || mintingItemId !== item.id) ? (
                <button
                  onClick={() => handleMint(item)}
                  disabled={mintingItemId !== null}
                  className="w-full py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/20"
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
                    `MINT "${item.name}" — FREE`
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
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline font-mono"
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
            Free delegate inscriptions • Only network fees apply
          </p>
        </div>

        {/* Try First Preview Modal */}
        {previewItem && (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setPreviewItem(null)}>
            <div
              className="relative bg-black border-2 border-purple-600 rounded-xl overflow-hidden"
              style={{ width: '50vw', height: '50vh', minWidth: 320, minHeight: 240 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-purple-600/50 bg-black/90">
                <h3 className="text-sm font-bold text-white">{previewItem.name}</h3>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe
                src={`https://ordinals.com/content/${previewItem.inscriptionId}`}
                title={previewItem.name}
                className="w-full"
                style={{ height: 'calc(100% - 40px)', border: 'none', background: '#000' }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* Wallet Connect Modal */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-emerald-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-emerald-600">
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
