import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletCard } from '../../services/gallery';
import { getTradeOffers, TradeOffer } from '../../services/tradingService';
import { TradeOfferCard } from './TradeOfferCard';

interface TradeOfferListProps {
  myCards: WalletCard[];
}

export const TradeOfferList: React.FC<TradeOfferListProps> = ({ myCards }) => {
  const { walletState } = useWallet();
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'my' | 'available'>('all');

  useEffect(() => {
    loadOffers();
    // Auto-refresh alle 30 Sekunden
    const interval = setInterval(loadOffers, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const allOffers = await getTradeOffers();
      setOffers(allOffers);
    } catch (error) {
      console.error('Error loading offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = offers.filter((offer) => {
    if (filter === 'my') {
      // Filter by current wallet address
      if (!walletState.accounts[0]?.address) return false;
      return offer.maker.toLowerCase() === walletState.accounts[0].address.toLowerCase();
    }
    if (filter === 'available') {
      return offer.status === 'active';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${
            filter === 'all'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          All Offers
        </button>
        <button
          onClick={() => setFilter('available')}
          className={`px-4 py-2 rounded ${
            filter === 'available'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Available
        </button>
        <button
          onClick={() => setFilter('my')}
          className={`px-4 py-2 rounded ${
            filter === 'my'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          My Offers
        </button>
      </div>

      {/* Offers List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <p className="mt-4 text-gray-300">Loading offers...</p>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No trade offers found</p>
          <p className="text-sm mt-2">Be the first to create an offer!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer) => (
            <TradeOfferCard
              key={offer.offerId}
              offer={offer}
              myCards={myCards}
              onOfferAccepted={loadOffers}
            />
          ))}
        </div>
      )}
    </div>
  );
};



