import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getPointShopItems, mintPointShopItem, PointShopItem } from '../services/pointShopService';
import { getPoints } from '../services/pointsService';
import { FeeRateSelector } from '../components/FeeRateSelector';

export const PointShopPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [items, setItems] = useState<PointShopItem[]>([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      loadPoints();
    } else {
      setUserPoints(0);
    }
  }, [walletState.connected, walletState.accounts]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const shopItems = await getPointShopItems();
      setItems(shopItems);
    } catch (error) {
      console.error('Error loading point shop items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPoints = async () => {
    if (!walletState.accounts[0]) return;
    
    try {
      const pointsData = await getPoints(walletState.accounts[0].address);
      setUserPoints(pointsData?.points || 0);
    } catch (error) {
      console.error('Error loading points:', error);
      setUserPoints(0);
    }
  };

  const handleMint = async (item: PointShopItem) => {
    if (!walletState.connected || !walletState.accounts[0]) {
      alert('Please connect your wallet');
      return;
    }

    // Prüfe ob Serie ausverkauft ist
    if (item.itemType === 'series') {
      const remaining = item.totalCount && item.currentIndex !== undefined 
        ? item.totalCount - item.currentIndex 
        : 0;
      if (remaining <= 0) {
        alert('This series is sold out!');
        return;
      }
    }

    if (userPoints < item.pointsCost) {
      alert(`You don't have enough points! Required: ${item.pointsCost}, You have: ${userPoints}`);
      return;
    }

    const confirmMessage = item.itemType === 'series' && item.currentIndex !== undefined && item.totalCount
      ? `Do you want to mint "${item.title}" (#${(item.currentIndex || 0) + 1}/${item.totalCount}) for ${item.pointsCost} points? (Only inscription fees will be charged additionally)`
      : `Do you want to mint "${item.title}" for ${item.pointsCost} points? (Only inscription fees will be charged additionally)`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setMintingItemId(item.id);
    try {
      const result = await mintPointShopItem(
        walletState.accounts[0].address,
        item.id,
        walletState.walletType || 'unisat',
        inscriptionFeeRate
      );
      
      let successMessage = `Minting successful! Inscription ID: ${result.inscriptionId}`;
      if (result.seriesInfo) {
        successMessage += `\nSeries: #${result.seriesInfo.currentNumber}/${result.seriesInfo.totalCount} (${result.seriesInfo.remaining} remaining)`;
      }
      
      alert(successMessage);
      await loadItems(); // Reload items
      await loadPoints(); // Reload points
    } catch (error: any) {
      console.error('[PointShop] Minting error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setMintingItemId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="container mx-auto max-w-6xl">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/black-wild')}
            className="text-gray-400 hover:text-white flex items-center gap-2"
            title="Back to Mint Page"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-2 border-b-2 border-red-600 pb-4">
          Point Shop
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Mint exclusive Ordinals with your points
        </p>

        {walletState.connected ? (
          <>
            <div className="text-center mb-8">
              <p className="text-gray-400 text-sm">Your Points</p>
              <p className="text-3xl font-bold text-red-600">{userPoints}</p>
            </div>

            {/* Fee Rate Selector */}
            <div className="max-w-md mx-auto mb-8">
              <FeeRateSelector
                selectedFeeRate={inscriptionFeeRate}
                onFeeRateChange={setInscriptionFeeRate}
              />
            </div>
          </>
        ) : (
          <div className="text-center mb-8">
            <p className="text-gray-400">Please connect your wallet to use the Point Shop</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No items available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const canAfford = walletState.connected && userPoints >= item.pointsCost;
              // Prüfe ob Serie ausverkauft ist
              const isSeriesSoldOut = item.itemType === 'series' && item.currentIndex && item.totalCount && item.currentIndex >= item.totalCount;
              const remaining = item.itemType === 'series' && item.totalCount && item.currentIndex !== undefined 
                ? item.totalCount - item.currentIndex 
                : null;
              
              return (
                <div
                  key={item.id}
                  className={`bg-black border rounded-lg overflow-hidden hover:border-red-500 transition-all ${
                    isSeriesSoldOut ? 'border-gray-700 opacity-60' : 'border-red-600'
                  }`}
                >
                  <div className="aspect-square bg-gray-900 flex items-center justify-center p-4 relative">
                    {(() => {
                      let inscriptionId: string | undefined;
                      if (item.itemType === 'series') {
                        // Für Series: Zeige erste verfügbare Inskription (oder erste wenn alle verkauft)
                        inscriptionId = item.inscriptionIds && item.inscriptionIds.length > 0 
                          ? item.inscriptionIds[item.currentIndex || 0] || item.inscriptionIds[0]
                          : undefined;
                      } else {
                        inscriptionId = item.itemType === 'delegate' 
                          ? item.delegateInscriptionId 
                          : item.originalInscriptionId;
                      }
                      
                      // Direkt von ordinals.com laden - KEIN Backend-API-Call mehr!
                      return inscriptionId ? (
                        <img
                          src={`https://ordinals.com/content/${inscriptionId}`}
                          alt={item.title}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.warn(`[PointShop] Could not load image for ${inscriptionId}`);
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-2"><div class="text-4xl mb-2">🖼️</div><div class="text-xs text-gray-400 text-center">Image</div></div>';
                            }
                          }}
                        />
                      ) : null;
                    })()}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        item.itemType === 'series'
                          ? 'bg-purple-600 text-white'
                          : item.itemType === 'delegate' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-green-600 text-white'
                      }`}>
                        {item.itemType === 'series' ? 'Series' : item.itemType === 'delegate' ? 'Delegate' : 'Original'}
                      </span>
                      {item.itemType === 'series' && remaining !== null && (
                        <span className="text-xs px-2 py-1 rounded font-semibold bg-purple-800 text-white">
                          {remaining}/{item.totalCount} left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    {item.itemType === 'series' && item.seriesTitle && (
                      <p className="text-xs text-purple-400 mb-2 font-semibold">{item.seriesTitle}</p>
                    )}
                    <p className="text-gray-400 text-sm mb-4 min-h-[3rem]">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-red-600 font-bold text-lg">
                        {item.pointsCost} Points
                      </span>
                      <button
                        onClick={() => handleMint(item)}
                        disabled={
                          !walletState.connected ||
                          !canAfford ||
                          mintingItemId === item.id ||
                          isSeriesSoldOut
                        }
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-semibold transition-colors"
                      >
                        {mintingItemId === item.id 
                          ? 'Processing...' 
                          : isSeriesSoldOut
                            ? 'Sold Out'
                            : canAfford 
                              ? (item.itemType === 'series' ? 'Mint' : item.itemType === 'delegate' ? 'Mint' : 'Transfer') 
                              : 'Not enough points'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

