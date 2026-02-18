import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getPointShopItems, mintPointShopItem, PointShopItem } from '../services/pointShopService';
import { getPoints } from '../services/pointsService';
import { getOrdinalAddress } from '../utils/wallet';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { ProgressiveImage } from '../components/ProgressiveImage';

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
      const pointsData = await getPoints(getOrdinalAddress(walletState.accounts));
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
        getOrdinalAddress(walletState.accounts),
        item.id,
        walletState.walletType || 'unisat',
        inscriptionFeeRate,
        walletState // Übergebe walletState für PSBT-Signatur
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
    <div className="min-h-screen bg-black text-white p-4 md:p-8 pb-20 md:pb-8">
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

        <h1 className="text-4xl font-bold text-center mb-4 border-b-2 border-red-600 pb-4 flex items-center justify-center gap-3">
          <img
            src="/pointshop.png"
            alt="Point Shop"
            className="h-8 w-8 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          Point Shop
        </h1>
        
        {/* Statistics Banner */}
        {!loading && items.length > 0 && (
          <div className="bg-gray-900/80 backdrop-blur-sm border border-red-600/50 rounded-lg p-4 mb-6 max-w-3xl mx-auto shadow-lg shadow-red-600/10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-lg font-bold text-white mb-1">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'} Available
                </p>
                <p className="text-xs text-gray-400">
                  {items.filter(i => i.itemType === 'series').length} Series • {' '}
                  {items.filter(i => i.itemType === 'delegate').length} Delegates • {' '}
                  {items.filter(i => i.itemType === 'original').length} Originals
                </p>
              </div>
              {walletState.connected && (
                <div className="text-center md:text-right">
                  <p className="text-xs text-gray-400 mb-1">Your Balance</p>
                  <p className="text-2xl font-bold text-red-600">{userPoints.toLocaleString()} Points</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-gray-300 mb-8">
          Mint exclusive Ordinals with your points
        </p>

        {walletState.connected && (
          <div className="text-center mb-8">
            <p className="text-gray-400 text-sm">Your Points</p>
            <p className="text-3xl font-bold text-red-600">{userPoints}</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4 mb-8">
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
                  className={`bg-black/80 backdrop-blur-sm border rounded-lg overflow-hidden hover:border-red-500 transition-all duration-300 group relative ${
                    isSeriesSoldOut ? 'border-gray-700 opacity-60' : 'border-red-600/50 hover:bg-black/90'
                  } hover:shadow-lg hover:shadow-red-600/20 hover:scale-[1.02]`}
                >
                  {/* Glassmorphism Background Effect */}
                  {!isSeriesSoldOut && (
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
                  )}
                  <div className="aspect-square bg-gray-900 flex items-center justify-center p-2 relative group/preview">
                    {/* Loading State */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black animate-pulse opacity-0 group-hover/preview:opacity-0 transition-opacity duration-300" />
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
                        <ProgressiveImage
                          src={`https://ordinals.com/content/${inscriptionId}`}
                          alt={item.title}
                          className="w-full h-full transition-all duration-300 group-hover/preview:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            console.warn(`[PointShop] Could not load image for ${inscriptionId}`);
                          }}
                        />
                      ) : null;
                    })()}
                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-red-600/0 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
                    <div className="absolute top-1 right-1 flex flex-col gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        item.itemType === 'series'
                          ? 'bg-purple-600 text-white'
                          : item.itemType === 'delegate' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-green-600 text-white'
                      }`}>
                        {item.itemType === 'series' ? 'Series' : item.itemType === 'delegate' ? 'Delegate' : 'Original'}
                      </span>
                      {item.itemType === 'series' && remaining !== null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-purple-800 text-white">
                          {remaining}/{item.totalCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="text-sm font-bold mb-1 line-clamp-1">{item.title}</h3>
                    {item.itemType === 'series' && item.seriesTitle && (
                      <p className="text-[10px] text-purple-400 mb-1 font-semibold line-clamp-1">{item.seriesTitle}</p>
                    )}
                    <p className="text-gray-400 text-[11px] mb-2 min-h-[2.5rem] line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-red-600 font-bold text-sm">
                        {item.pointsCost} P
                      </span>
                      <button
                        onClick={() => handleMint(item)}
                        disabled={
                          !walletState.connected ||
                          !canAfford ||
                          mintingItemId === item.id ||
                          isSeriesSoldOut
                        }
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-red-600/30 hover:scale-105 disabled:hover:scale-100"
                      >
                        {mintingItemId === item.id 
                          ? '⏳ Minting...' 
                          : isSeriesSoldOut
                            ? '❌ Sold'
                            : canAfford 
                              ? (item.itemType === 'series' ? '🎯 Mint' : item.itemType === 'delegate' ? '🎯 Mint' : '🎯 Transfer') 
                              : '💰 Need Points'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fee Rate Selector - Jetzt unterhalb der Items */}
        {walletState.connected && (
          <div className="max-w-md mx-auto mt-8">
            <FeeRateSelector
              selectedFeeRate={inscriptionFeeRate}
              onFeeRateChange={setInscriptionFeeRate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

