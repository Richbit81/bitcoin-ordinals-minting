import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getCollection, Collection, CollectionItem } from '../services/collectionService';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { createSingleDelegate } from '../services/collectionMinting';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const CollectionMintingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  useEffect(() => {
    if (id) {
      loadCollection();
    }
  }, [id]);

  const loadCollection = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await getCollection(id);
      setCollection(data);
    } catch (error) {
      console.error('Error loading collection:', error);
      alert('Collection not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async (item: CollectionItem) => {
    if (!walletState.connected || !walletState.accounts[0] || !collection) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    setMintingItemId(item.inscriptionId);
    setMintingStatus({
      progress: 0,
      status: 'processing',
      message: `Minting ${item.name}...`,
    });

    try {
      if (item.type === 'delegate') {
        // Erstelle Delegate-Inskription
        setMintingStatus(prev => prev ? { ...prev, progress: 30, message: 'Creating delegate inscription...' } : null);
        
        // Konvertiere Collection-Preis von BTC zu sats
        const itemPriceSats = collection.price ? Math.round(collection.price * 100000000) : undefined;
        
        const result = await createSingleDelegate(
          item.inscriptionId,
          item.name,
          userAddress,
          collection.name,
          inscriptionFeeRate,
          walletState.walletType || 'unisat',
          undefined, // contentType wird auto-detected basierend auf collectionName
          itemPriceSats // Collection-Preis in sats (falls vorhanden)
        );

        setMintingStatus({
          progress: 100,
          status: 'success',
          message: `Successfully minted ${item.name}!`,
          inscriptionIds: [result.inscriptionId],
          txid: result.txid,
        });
      } else {
        // Transferiere Original-Ordinal
        setMintingStatus(prev => prev ? { ...prev, progress: 30, message: 'Initiating transfer...' } : null);
        
        const response = await fetch(`${API_URL}/api/collections/mint-original`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            collectionId: collection.id,
            itemId: item.inscriptionId,
            feeRate: inscriptionFeeRate,
            walletType: walletState.walletType,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Transfer failed');
        }

        const data = await response.json();

        setMintingStatus({
          progress: 100,
          status: 'success',
          message: `Successfully transferred ${item.name}!`,
          inscriptionIds: [data.inscriptionId],
          txid: data.txid,
        });
      }
    } catch (error: any) {
      console.error('[CollectionMinting] Error:', error);
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error.message || 'Minting failed',
      });
    } finally {
      setMintingItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xl">Loading collection...</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xl">Collection not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Collection Header */}
        <div className="text-center mb-8">
          {collection.thumbnail && (
            <img
              src={collection.thumbnail}
              alt={collection.name}
              className="max-w-md mx-auto h-auto mb-4 rounded"
            />
          )}
          <h1 className="text-4xl font-bold mb-2 border-b-2 border-red-600 pb-4">
            {collection.name}
          </h1>
          <p className="text-gray-300 mb-4">{collection.description}</p>
          <p className="text-red-600 font-bold text-lg">
            {collection.price} BTC per item
          </p>
        </div>

        {/* Fee Rate Selector */}
        <div className="max-w-md mx-auto mb-8">
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

        {/* Collection Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {collection.items.map((item) => {
            const isMinting = mintingItemId === item.inscriptionId;
            const imageUrl = item.imageUrl || `${API_URL}/api/inscription/image/${item.inscriptionId}`;
            
            return (
              <div
                key={item.inscriptionId}
                className="bg-black border border-red-600 rounded-lg overflow-hidden hover:border-red-500 transition-all"
              >
                <div className="aspect-square bg-gray-900 flex items-center justify-center p-4 relative">
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.warn(`[CollectionMinting] Could not load image for ${item.inscriptionId}`);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      item.type === 'delegate' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-green-600 text-white'
                    }`}>
                      {item.type === 'delegate' ? 'Delegate' : 'Original'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold mb-2">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-red-600 font-bold">
                      {collection.price} BTC
                    </span>
                    <button
                      onClick={() => handleMint(item)}
                      disabled={isMinting || !walletState.connected}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-semibold transition-colors"
                    >
                      {isMinting ? 'Minting...' : 'Mint'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!walletState.connected && (
          <div className="text-center mt-8">
            <p className="text-gray-400 mb-4">Please connect your wallet to mint items</p>
            <button
              onClick={() => setShowWalletConnect(true)}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

