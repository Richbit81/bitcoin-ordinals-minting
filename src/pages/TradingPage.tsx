import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletCard, fetchWalletCards } from '../services/gallery';
import { TradeOfferList } from '../components/trading/TradeOfferList';
import { CreateOffer } from '../components/trading/CreateOffer';

export const TradingPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');
  const [myCards, setMyCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      loadMyCards();
    } else {
      setMyCards([]);
    }
  }, [walletState.connected, walletState.accounts]);

  const loadMyCards = async () => {
    if (!walletState.accounts[0]?.address) return;
    
    setLoading(true);
    try {
      const cards = await fetchWalletCards(walletState.accounts[0].address);
      setMyCards(cards);
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">BLACK & WILD Trading</h1>
          <p className="text-gray-300 mb-8">Please connect your wallet to start trading</p>
          <p className="text-sm text-gray-500">Use the menu in the top right to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => navigate('/black-wild')}
            className="text-gray-400 hover:text-white flex items-center gap-2"
            title="Zurück zur Mint-Seite"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
          <h1 className="text-4xl font-bold text-center mb-2 border-b-2 border-red-600 pb-4 flex-1">
            BLACK & WILD Trading
          </h1>
          <div className="w-20"></div> {/* Spacer für zentrierte Überschrift */}
        </div>
        <p className="text-center text-gray-300 mb-8">
          Trade your cards with other players
        </p>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b-2 border-gray-800">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'browse'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Browse Offers
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'create'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Offer
          </button>
        </div>

        {/* Content */}
        {activeTab === 'browse' ? (
          <TradeOfferList myCards={myCards} />
        ) : (
          <CreateOffer myCards={myCards} onOfferCreated={loadMyCards} />
        )}
      </div>
    </div>
  );
};



