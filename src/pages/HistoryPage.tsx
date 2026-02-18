import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { fetchWalletCards, WalletCard } from '../services/gallery';
import { getOrdinalAddress } from '../utils/wallet';
import { CardReveal } from '../components/CardReveal';
import { Card } from '../types/wallet';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const loadCards = async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const walletAddress = getOrdinalAddress(walletState.accounts);
      const fetchedCards = await fetchWalletCards(walletAddress);
      setCards(fetchedCards);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingStatus = async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      return;
    }

    setChecking(true);
    try {
      const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
      const walletAddress = getOrdinalAddress(walletState.accounts);
      
      console.log('[History] 🔍 Checking pending inscriptions...');
      const response = await fetch(`${API_URL}/api/unisat/check-pending-inscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[History] ✅ Status check result:', data);
        
        if (data.updated > 0) {
          // Lade Karten neu, wenn Updates gefunden wurden
          console.log(`[History] ✅ ${data.updated} inscriptions updated, reloading cards...`);
          await loadCards();
        } else {
          console.log('[History] ⏳ No updates found yet');
        }
      } else {
        console.error('[History] ❌ Status check failed:', response.status);
      }
    } catch (error) {
      console.error('[History] ❌ Failed to check pending status:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      loadCards();
      
      // Auto-Refresh alle 20 Minuten (reduziert UniSat API-Last)
      const interval = setInterval(() => {
        loadCards();
      }, 20 * 60 * 1000);

      return () => clearInterval(interval);
    } else {
      setCards([]);
      setLoading(false);
    }
  }, [walletState.connected, walletState.accounts[0]?.address]);

  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Minting History</h1>
          <p className="text-gray-400">Please connect your wallet to see your history.</p>
        </div>
      </div>
    );
  }

  const pendingCards = cards.filter(c => c.inscriptionId.startsWith('pending-'));
  const confirmedCards = cards.filter(c => !c.inscriptionId.startsWith('pending-'));

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
            <h1 className="text-3xl font-bold">Minting History</h1>
          </div>
          <div className="flex gap-4 items-center">
            {lastCheck && (
              <span className="text-sm text-gray-400">
                Last update: {lastCheck.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={checkPendingStatus}
              disabled={checking}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
            >
              {checking ? 'Checking...' : 'Check Status'}
            </button>
            <button
              onClick={loadCards}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading && cards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading history...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No inscriptions yet.</p>
            <p className="text-sm text-gray-500 mt-2">Mint your first pack on the main page!</p>
          </div>
        ) : (
          <>
            {pendingCards.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 text-yellow-500 flex items-center gap-2">
                  <span>⏳</span>
                  <span>Pending ({pendingCards.length})</span>
                </h2>
                <p className="text-sm text-gray-400 mb-4">
                  These inscriptions are waiting for confirmation. The final IDs will be automatically updated once the transactions are confirmed (approx. 10-20 minutes).
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {pendingCards.map((card, index) => {
                    const cardData: Card = {
                      id: card.name.toLowerCase().replace(/\s+/g, '-'),
                      name: card.name,
                      rarity: card.rarity,
                      inscriptionId: card.inscriptionId,
                      originalInscriptionId: card.originalInscriptionId, // Original-ID für Bild-Abruf
                      cardType: card.cardType,
                      effect: card.effect,
                      svgIcon: card.svgIcon,
                    };
                    return (
                      <div key={`pending-${index}`} className="relative">
                        <CardReveal card={{ ...cardData, revealed: true }} showRarity={true} />
                        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded font-bold">
                          Pending
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {confirmedCards.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-green-500 flex items-center gap-2">
                  <span>✅</span>
                  <span>Confirmed ({confirmedCards.length})</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {confirmedCards.map((card, index) => {
                    const cardData: Card = {
                      id: card.name.toLowerCase().replace(/\s+/g, '-'),
                      name: card.name,
                      rarity: card.rarity,
                      inscriptionId: card.inscriptionId,
                      originalInscriptionId: card.originalInscriptionId, // Original-ID für Bild-Abruf
                      cardType: card.cardType,
                      effect: card.effect,
                      svgIcon: card.svgIcon,
                    };
                    return (
                      <CardReveal
                        key={`confirmed-${index}`}
                        card={{ ...cardData, revealed: true }}
                        showRarity={true}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {pendingCards.length === 0 && confirmedCards.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">No cards found.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};


