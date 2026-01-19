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

  const handleMint = async (item?: CollectionItem) => {
    if (!walletState.connected || !walletState.accounts[0] || !collection) {
      setShowWalletConnect(true);
      return;
    }

    // Prüfe ob Collection Items vorhanden sind
    if (!collection.items || collection.items.length === 0) {
      alert('Collection has no items available for minting.');
      return;
    }

    // WICHTIG: Für UniSat Wallet immer Taproot-Adresse (bc1p...) verwenden!


    // Für Inskriptionen sollte immer eine Taproot-Adresse verwendet werden, nicht Legacy (1... oder 3...)


    // WICHTIG: Inscription muss immer an die richtige Adresse gehen
    // Beide Wallets: Suche nach Ordinals-Adresse (Taproot), fallback zur ersten Adresse
    let userAddress = walletState.accounts[0].address;

    // Suche nach Ordinals-Adresse (für beide Wallet-Typen)
    const ordinalsAccount = walletState.accounts.find(acc => 
      acc.purpose === 'ordinals' || acc.address.startsWith('bc1p')
    );
    
    if (ordinalsAccount) {
      userAddress = ordinalsAccount.address;
      console.log(`[CollectionMintingPage] ✅ ${walletState.walletType?.toUpperCase()} - Verwende Ordinals-Adresse (Taproot) für Inscription:`, userAddress);
    } else {
      const addressType = userAddress.startsWith('bc1p') ? 'Taproot' :
                          userAddress.startsWith('bc1q') ? 'SegWit' :
                          userAddress.startsWith('3') ? 'Nested SegWit' : 'Legacy';
      console.warn(`[CollectionMintingPage] ⚠️ ${walletState.walletType?.toUpperCase()} - Keine Taproot-Adresse! Verwende ${addressType}:`, userAddress);
    }
    
    // Zeige Payment-Adresse (falls vorhanden)
    const paymentAccount = walletState.accounts.find(acc => acc.purpose === 'payment');
    if (paymentAccount) {
      console.log(`[CollectionMintingPage] 💰 ${walletState.walletType?.toUpperCase()} - Payment kommt von:`, paymentAccount.address);
    }
    
    // Für Random Mint: Wähle zufälliges Item
    let itemToMint: CollectionItem | undefined;
    if (collection.mintType === 'random') {
      const randomIndex = Math.floor(Math.random() * collection.items.length);
      itemToMint = collection.items[randomIndex];
    } else {
      if (!item) {
        console.error('[CollectionMinting] No item provided for individual mint');
        alert('Please select an item to mint.');
        return;
      }
      itemToMint = item;
    }

    // Validierung: Prüfe ob itemToMint definiert ist
    if (!itemToMint || !itemToMint.inscriptionId) {
      console.error('[CollectionMinting] Invalid item to mint:', itemToMint);
      alert('Error: Invalid item selected. Please try again.');
      return;
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
        const itemPriceSats = collection.price ? Math.round(collection.price * 100000000) : undefined;
        
        const result = await createSingleDelegate(
          itemToMint.inscriptionId,
          itemToMint.name,
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
          message: `Successfully minted ${itemToMint.name}!${collection.mintType === 'random' ? ' (Random)' : ''}`,
          inscriptionIds: [result.inscriptionId],
          txid: result.txid,
        });
      } else {
        // Transferiere Original-Ordinal
        // Schritt 0: Preis bezahlen (falls vorhanden)
        if (collection.price && collection.price > 0) {
          setMintingStatus(prev => prev ? { ...prev, progress: 10, message: `Paying ${collection.price} BTC...` } : null);
          
          const { sendBitcoinViaUnisat, sendBitcoinViaXverse } = await import('../utils/wallet');
          const adminAddress = '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft'; // Admin-Adresse für Preis-Zahlung (Legacy)
          
          try {
            if (walletState.walletType === 'unisat') {
              await sendBitcoinViaUnisat(adminAddress, collection.price);
            } else {
              await sendBitcoinViaXverse(adminAddress, collection.price);
            }
            console.log(`[CollectionMinting] ✅ Price paid: ${collection.price} BTC to ${adminAddress}`);
          } catch (priceError: any) {
            console.error('[CollectionMinting] Price payment error:', priceError);
            throw new Error(`Failed to pay collection price: ${priceError.message || 'Unknown error'}`);
          }
        }
        
        setMintingStatus(prev => prev ? { ...prev, progress: 30, message: 'Creating transfer PSBT...' } : null);
        
        // Schritt 1: PSBT erstellen
        // WICHTIG: walletAddress ist die Empfänger-Adresse (userAddress)
        // Die Input-Adresse (die das Ordinal besitzt) wird vom Backend aus der Inscription ermittelt
        const prepareResponse = await fetch(`${API_URL}/api/collections/mint-original`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress, // Empfänger-Adresse
            collectionId: collection.id,
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
          // WICHTIG: ownerAddress ist die Adresse, die das Ordinal besitzt (Input-Adresse)
          // Diese Adresse muss die PSBT signieren können
          const ownerAddress = prepareData.ownerAddress;
          console.log(`[CollectionMinting] Owner address (input): ${ownerAddress}`);
          console.log(`[CollectionMinting] User address (recipient): ${userAddress}`);
          
          // Prüfe ob ownerAddress mit userAddress übereinstimmt (dann kann der Benutzer signieren)
          if (ownerAddress && ownerAddress !== userAddress) {
            console.warn(`[CollectionMinting] ⚠️ Owner address (${ownerAddress}) differs from user address (${userAddress})`);
            console.warn(`[CollectionMinting] ⚠️ The user's wallet may not be able to sign this PSBT if it doesn't control ${ownerAddress}`);
            
            // Zeige Warnung an den Benutzer
            if (prepareData.warning) {
              alert(`⚠️ Warnung: ${prepareData.warning}\n\nDie PSBT kann möglicherweise nicht von Ihrem Wallet signiert werden, da sie eine Admin-Adresse erfordert.`);
            }
          }
          
          setMintingStatus(prev => prev ? { ...prev, progress: 50, message: 'Please sign the transaction in your wallet...' } : null);
          
          // Schritt 2: PSBT signieren
          const { signPSBT } = await import('../utils/wallet');
          // WICHTIG: Wenn ownerAddress eine Admin-Adresse ist (nicht userAddress),
          // kann der Benutzer die PSBT nicht signieren, weil sein Wallet die Admin-Adresse nicht kontrolliert
          // In diesem Fall lassen wir Xverse automatisch erkennen, welche Inputs signiert werden können
          // (Xverse signiert nur Inputs, die vom verbundenen Wallet kontrolliert werden)
          const autoFinalized = walletState.walletType === 'xverse';
          // NICHT ownerAddress übergeben - Xverse erkennt automatisch kontrollierte Inputs
          const signedPsbt = await signPSBT(
            prepareData.psbtBase64,
            walletState.walletType || 'unisat',
            autoFinalized,
            undefined // Keine signInputs - Xverse erkennt automatisch
          );

          setMintingStatus(prev => prev ? { ...prev, progress: 70, message: 'Broadcasting transaction...' } : null);
          
          // Schritt 3: Signierte PSBT broadcasten
          const broadcastResponse = await fetch(`${API_URL}/api/collections/mint-original`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: userAddress,
              collectionId: collection.id,
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

          const data = await broadcastResponse.json();
          
          // Record recent mint
          try {
            await fetch(`${API_URL}/api/collections/${collection.id}/record-mint`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inscriptionId: itemToMint.inscriptionId,
                itemName: itemToMint.name,
                itemType: itemToMint.type,
                itemImageUrl: itemToMint.imageUrl,
              }),
            });
          } catch (recordError) {
            console.warn('[CollectionMinting] Failed to record mint:', recordError);
            // Nicht kritisch, weiter mit Success
          }
          
          setMintingStatus({
            progress: 100,
            status: 'success',
            message: `Successfully transferred ${itemToMint.name}!${collection.mintType === 'random' ? ' (Random)' : ''}`,
            inscriptionIds: [data.inscriptionId || itemToMint.inscriptionId],
            txid: data.txid,
          });
        } else {
          // Fallback: Direkter Transfer (wenn kein Signing erforderlich)
          const data = prepareData;
          
          // Record recent mint
          try {
            await fetch(`${API_URL}/api/collections/${collection.id}/record-mint`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inscriptionId: itemToMint.inscriptionId,
                itemName: itemToMint.name,
                itemType: itemToMint.type,
                itemImageUrl: itemToMint.imageUrl,
              }),
            });
          } catch (recordError) {
            console.warn('[CollectionMinting] Failed to record mint:', recordError);
            // Nicht kritisch, weiter mit Success
          }
          
          setMintingStatus({
            progress: 100,
            status: 'success',
            message: `Successfully transferred ${itemToMint.name}!${collection.mintType === 'random' ? ' (Random)' : ''}`,
            inscriptionIds: [data.inscriptionId],
            txid: data.txid,
          });
        }
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
          {/* Bild wird bei Random Mint rechts neben dem Panel angezeigt */}
          {collection.mintType !== 'random' && collection.thumbnail && (
            <img
              src={collection.thumbnail}
              alt={collection.name}
              className="max-w-md mx-auto h-auto mb-4 rounded shadow-lg"
            />
          )}
          <h1 className="text-4xl font-bold mb-2 border-b-2 border-red-600 pb-4">
            {collection.name}
          </h1>
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              📋 WICHTIG: Beschreibung wird NUR auf Mint-Seite angezeigt!
              - Hauptseite: Nur Titel
              - Mint-Seite: Vollständige Beschreibung + alle Details
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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

        {/* Random Mint Button mit Bild rechts */}
        {collection.mintType === 'random' && (
          <div className="max-w-5xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Mint Panel (links) */}
              <div className="w-full md:w-1/2">
                <div className="bg-black border-2 border-red-600 rounded-lg p-6 text-center">
                  <h2 className="text-2xl font-bold mb-4">🎲 Random Mint</h2>
                  <p className="text-gray-300 mb-6">
                    You'll receive a random item from this collection!
                  </p>
                  <p className="text-red-600 font-bold text-xl mb-6">
                    {collection.price} BTC
                  </p>
                  <button
                    onClick={() => handleMint()}
                    disabled={!!mintingItemId || !walletState.connected}
                    className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
                  >
                    {mintingItemId ? 'Minting Random Item...' : '🎲 Mint Random Item'}
                  </button>
                  <p className="text-xs text-gray-500 mt-4">
                    {collection.items.length} items in collection
                  </p>
                </div>
              </div>
              
              {/* Bild (rechts) */}
              {collection.thumbnail && (
                <div className="w-full md:w-1/2 flex items-start justify-center">
                  <img
                    src={collection.thumbnail}
                    alt={collection.name}
                    className="w-full max-w-md h-auto rounded shadow-lg"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collection Items Grid (only show for individual minting) */}
        {collection.mintType === 'individual' && (
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
        )}

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

