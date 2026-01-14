import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getAllCollections, Collection, CollectionItem } from '../services/collectionService';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { createSingleDelegate } from '../services/collectionMinting';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { RecentMintsBanner } from '../components/RecentMintsBanner';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const SmilePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  useEffect(() => {
    const loadCollections = async () => {
      try {
        console.log('[SmilePage] Loading collections...');
        // Hole Collections mit page Filter direkt vom Backend (page='smile-a-bit')
        const response = await fetch(`${API_URL}/api/collections?page=smile-a-bit`);
        if (!response.ok) {
          throw new Error('Failed to fetch collections');
        }
        const data = await response.json();
        const smileCollections = data.collections || [];
        console.log('[SmilePage] Loaded collections:', smileCollections.length, smileCollections);
        setCollections(smileCollections);
        // Wenn nur eine Collection vorhanden ist, automatisch auswählen
        if (smileCollections.length === 1) {
          console.log('[SmilePage] Auto-selecting single collection:', smileCollections[0].name);
          setSelectedCollection(smileCollections[0]);
        }
      } catch (error) {
        console.error('[SmilePage] Error loading collections:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCollections();
  }, []);

  const handleMint = async (item?: CollectionItem) => {
    if (!walletState.connected || !walletState.accounts[0] || !selectedCollection) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    
    // Für Random Mint: Wähle zufälliges Item
    let itemToMint: CollectionItem;
    if (selectedCollection.mintType === 'random') {
      const randomIndex = Math.floor(Math.random() * selectedCollection.items.length);
      itemToMint = selectedCollection.items[randomIndex];
    } else {
      if (!item) {
        console.error('[SmilePage] No item provided for individual mint');
        return;
      }
      itemToMint = item;
    }

    setMintingItemId(itemToMint.inscriptionId);
    setMintingStatus({
      progress: 0,
      status: 'processing',
      message: `Minting ${itemToMint.name}...`,
    });

    try {
      if (itemToMint.type === 'delegate') {
        // Erstelle Delegate-Inskription
        setMintingStatus(prev => prev ? { ...prev, progress: 30, message: 'Creating delegate inscription...' } : null);
        
        // Konvertiere Collection-Preis von BTC zu sats
        const itemPriceSats = selectedCollection.price ? Math.round(selectedCollection.price * 100000000) : undefined;
        
        const result = await createSingleDelegate(
          itemToMint.inscriptionId,
          itemToMint.name,
          userAddress,
          selectedCollection.name,
          inscriptionFeeRate,
          walletState.walletType || 'unisat',
          undefined, // contentType wird auto-detected basierend auf collectionName
          itemPriceSats // Collection-Preis in sats (falls vorhanden)
        );

        setMintingStatus({
          progress: 100,
          status: 'success',
          message: `Successfully minted ${itemToMint.name}!${selectedCollection.mintType === 'random' ? ' (Random)' : ''}`,
          inscriptionIds: [result.inscriptionId],
          txid: result.txid,
        });
      } else {
        // Transferiere Original-Ordinal
        setMintingStatus(prev => prev ? { ...prev, progress: 30, message: 'Creating transfer PSBT...' } : null);
        
        // Schritt 1: PSBT erstellen
        const prepareResponse = await fetch(`${API_URL}/api/collections/mint-original`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            collectionId: selectedCollection.id,
            itemId: itemToMint.inscriptionId,
            feeRate: inscriptionFeeRate,
            walletType: walletState.walletType,
          }),
        });

        if (!prepareResponse.ok) {
          const errorData = await prepareResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to create transfer PSBT');
        }

        const prepareData = await prepareResponse.json();

        // Wenn Signing erforderlich ist
        if (prepareData.requiresSigning && prepareData.psbtBase64) {
          setMintingStatus(prev => prev ? { ...prev, progress: 50, message: 'Please sign the transaction in your wallet...' } : null);
          
          // Schritt 2: PSBT signieren
          const { signPSBT } = await import('../utils/wallet');
          const signedPsbt = await signPSBT(
            prepareData.psbtBase64,
            walletState.walletType || 'unisat',
            false
          );

          setMintingStatus(prev => prev ? { ...prev, progress: 70, message: 'Broadcasting transaction...' } : null);
          
          // Schritt 3: Signierte PSBT broadcasten
          const broadcastResponse = await fetch(`${API_URL}/api/collections/mint-original`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: userAddress,
              collectionId: selectedCollection.id,
              itemId: itemToMint.inscriptionId,
              feeRate: inscriptionFeeRate,
              walletType: walletState.walletType,
              signedPsbt: signedPsbt,
            }),
          });

          if (!broadcastResponse.ok) {
            const errorData = await broadcastResponse.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to broadcast transaction');
          }

          const broadcastData = await broadcastResponse.json();

          // Record recent mint
          try {
            await fetch(`${API_URL}/api/collections/${selectedCollection.id}/record-mint`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inscriptionId: itemToMint.inscriptionId, // Original inscription ID (not transferred, but minted)
                itemName: itemToMint.name,
                itemType: itemToMint.type,
                itemImageUrl: itemToMint.imageUrl,
              }),
            });
          } catch (recordError) {
            console.warn('[SmilePage] Failed to record mint:', recordError);
            // Nicht kritisch, weiter mit Success
          }

          setMintingStatus({
            progress: 100,
            status: 'success',
            message: `Successfully transferred ${itemToMint.name}!${selectedCollection.mintType === 'random' ? ' (Random)' : ''}`,
            inscriptionIds: [broadcastData.inscriptionId || itemToMint.inscriptionId],
            txid: broadcastData.txid,
          });
        } else {
          // Fallback: Direkter Transfer (wenn kein Signing erforderlich)
          setMintingStatus({
            progress: 100,
            status: 'success',
            message: `Successfully transferred ${itemToMint.name}!${selectedCollection.mintType === 'random' ? ' (Random)' : ''}`,
            inscriptionIds: [prepareData.inscriptionId],
            txid: prepareData.txid,
          });
        }
      }
    } catch (error: any) {
      console.error('[SmilePage] Error:', error);
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error.message || 'Minting failed',
      });
    } finally {
      setMintingItemId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black relative flex flex-col items-center justify-center overflow-hidden">
      {/* Hintergrundbild - groß über schwarzem Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/SmileaBittt.png"
          alt="SMILE A BIT Background"
          className="w-full h-full object-cover opacity-30"
          onError={(e) => {
            console.warn('[SmilePage] Could not load background image');
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Schwarzer Overlay für besseren Kontrast */}
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      {/* Content - z-index höher als Background */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-8 py-20">
        {/* Zurück-Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors z-20"
        >
          ← Back
        </button>

        {/* Titel */}
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 text-center drop-shadow-2xl">
          SMILE A BIT
        </h1>

        {loading ? (
          <div className="text-white text-center py-8">Loading collections...</div>
        ) : collections.length === 0 ? (
          <div className="mt-auto mb-16">
            <p className="text-4xl md:text-6xl font-bold text-red-600 text-center drop-shadow-2xl mb-4">
              COMING SOON
            </p>
            <p className="text-gray-400 text-center text-sm">
              No SMILE A BIT collections found. Please create a collection with category "smileabit" in the Admin Panel.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-6xl mt-8">
            {/* Collection Selection */}
            {collections.length > 1 && !selectedCollection && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    onClick={() => setSelectedCollection(collection)}
                    className="cursor-pointer hover:opacity-90 transition-opacity duration-300 flex flex-col items-center h-full bg-gray-900/50 border-2 border-red-600 rounded-lg p-6"
                  >
                    {collection.thumbnail && (
                      <img
                        src={collection.thumbnail}
                        alt={collection.name}
                        className="w-full max-w-md mx-auto mb-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <h2 className="text-2xl font-bold text-white mb-1">{collection.name}</h2>
                    <p className="text-sm text-gray-400">{collection.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{collection.items.length} items</p>
                  </div>
                ))}
              </div>
            )}

            {/* Minting Interface */}
            {selectedCollection && (
              <div className="w-full">
                {/* Recent Mints Banner - nur anzeigen wenn showBanner aktiviert */}
                {selectedCollection.showBanner && (
                  <RecentMintsBanner collectionId={selectedCollection.id} collection={selectedCollection} />
                )}
                
                {/* Collection Header */}
                <div className="text-center mb-8">
                  {selectedCollection.thumbnail && (
                    <img
                      src={selectedCollection.thumbnail}
                      alt={selectedCollection.name}
                      className="max-w-md mx-auto h-auto mb-4 rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <h2 className="text-4xl font-bold mb-2 border-b-2 border-red-600 pb-4 text-white">
                    {selectedCollection.name}
                  </h2>
                  <p className="text-gray-300 mb-4">{selectedCollection.description}</p>
                  <p className="text-red-600 font-bold text-lg">
                    {selectedCollection.price} BTC per item
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

                {/* Random Mint Button */}
                {selectedCollection.mintType === 'random' && (
                  <div className="max-w-md mx-auto mb-8">
                    <div className="bg-black/80 border-2 border-red-600 rounded-lg p-6 text-center backdrop-blur-sm">
                      <h3 className="text-2xl font-bold mb-4 text-white">🎲 Random Mint</h3>
                      <p className="text-gray-300 mb-6">
                        You'll receive a random item from this collection!
                      </p>
                      <p className="text-red-600 font-bold text-xl mb-6">
                        {selectedCollection.price} BTC
                      </p>
                      <button
                        onClick={() => handleMint()}
                        disabled={!!mintingItemId || !walletState.connected}
                        className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                      >
                        {mintingItemId ? 'Minting Random Item...' : '🎲 Mint Random Item'}
                      </button>
                      <p className="text-xs text-gray-500 mt-4">
                        {selectedCollection.items.length} items in collection
                      </p>
                    </div>
                  </div>
                )}

                {/* Collection Items Grid (only show for individual minting) */}
                {selectedCollection.mintType === 'individual' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {selectedCollection.items.map((item) => {
                      const isMinting = mintingItemId === item.inscriptionId;
                      const imageUrl = item.imageUrl || `${API_URL}/api/inscription/image/${item.inscriptionId}`;
                      
                      return (
                        <div
                          key={item.inscriptionId}
                          className="bg-black/80 border border-red-600 rounded-lg overflow-hidden hover:border-red-500 transition-all backdrop-blur-sm"
                        >
                          <div className="aspect-square bg-gray-900 flex items-center justify-center p-4 relative">
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                console.warn(`[SmilePage] Could not load image for ${item.inscriptionId}`);
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
                            <h3 className="text-lg font-bold mb-2 text-white">{item.name}</h3>
                            <div className="flex items-center justify-between">
                              <span className="text-red-600 font-bold">
                                {selectedCollection.price} BTC
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
                )}

                {/* Change Collection Button (if multiple collections) */}
                {collections.length > 1 && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => setSelectedCollection(null)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold text-white"
                    >
                      ← Back to Collections
                    </button>
                  </div>
                )}

                {/* Wallet Connect Prompt */}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};
