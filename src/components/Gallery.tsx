import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { Rarity, RARITY_COLORS, RARITY_LABELS, Card } from '../types/wallet';
import { fetchWalletCards, WalletCard } from '../services/gallery';
import { CardReveal } from './CardReveal';
import { CardDetailModal } from './CardDetailModal';

interface GalleryProps {
  onClose: () => void;
}

export const Gallery: React.FC<GalleryProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [filterRarity, setFilterRarity] = useState<Rarity | 'all'>('all');

  useEffect(() => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setLoading(false);
      return;
    }

    loadCards();
  }, [walletState.connected, walletState.accounts]);

  const loadCards = async () => {
    if (!walletState.accounts[0]?.address) {
      console.log('[Gallery] ⚠️ No wallet address available');
      return;
    }

    const walletAddress = walletState.accounts[0].address;
    console.log('[Gallery] 🔍 Loading cards for wallet:', walletAddress);

    setLoading(true);
    setError(null);

    try {
      console.log('[Gallery] 📞 Calling fetchWalletCards...');
      const cards = await fetchWalletCards(walletAddress);
      console.log('[Gallery] ✅ Received Black & Wild cards:', cards.length);
      console.log('[Gallery] 📋 Cards details:', cards.map(c => ({
        name: c.name,
        inscriptionId: c.inscriptionId,
        originalId: c.originalInscriptionId
      })));
      
      setCards(cards); // Filter ist jetzt in gallery.ts!
    } catch (err: any) {
      console.error('[Gallery] ❌ Error loading cards:', err);
      setError(err.message || 'Error loading cards');
    } finally {
      setLoading(false);
    }
  };

  if (!walletState.connected) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-black border-2 border-red-600 rounded-lg max-w-2xl w-full p-8 text-center">
          <p className="text-gray-300 mb-4">Please connect your wallet first</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-black border-2 border-red-600 rounded-lg hover:bg-red-600 hover:text-white font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Filtere Cards nach Rarität
  const filteredCards = filterRarity === 'all' 
    ? cards 
    : cards.filter(card => card.rarity === filterRarity);

  // Gruppiere nach Rarität
  const cardsByRarity = filteredCards.reduce((acc, card) => {
    if (!acc[card.rarity]) {
      acc[card.rarity] = [];
    }
    acc[card.rarity].push(card);
    return acc;
  }, {} as Record<Rarity, WalletCard[]>);

  const rarityOrder: Rarity[] = ['mystic-legendary', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  
  // Statistiken
  const stats = {
    total: cards.length,
    byRarity: rarityOrder.reduce((acc, rarity) => {
      acc[rarity] = cards.filter(c => c.rarity === rarity).length;
      return acc;
    }, {} as Record<Rarity, number>),
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/90 backdrop-blur-md border-2 border-red-600/50 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-red-600/20">
        <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b-2 border-red-600/50 p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => {
                onClose();
                navigate('/black-wild');
              }}
              className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors duration-300"
              title="Back to Mint Page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-semibold">Back</span>
            </button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white border-b-2 border-red-600 pb-2 inline-block">My Gallery</h2>
              {/* Statistics Banner */}
              {!loading && cards.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-red-600/20 border border-red-600/50 rounded-full text-red-400 font-semibold">
                    {stats.total} Total
                  </span>
                  {rarityOrder.map(rarity => stats.byRarity[rarity] > 0 && (
                    <span 
                      key={rarity}
                      className="px-2 py-1 rounded-full font-semibold text-xs"
                      style={{
                        backgroundColor: `${RARITY_COLORS[rarity]}20`,
                        border: `1px solid ${RARITY_COLORS[rarity]}50`,
                        color: RARITY_COLORS[rarity],
                      }}
                    >
                      {stats.byRarity[rarity]} {RARITY_LABELS[rarity]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors duration-300 p-2 hover:bg-gray-800 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter */}
        {!loading && cards.length > 0 && (
          <div className="sticky top-[73px] bg-black/80 backdrop-blur-sm border-b border-red-600/30 p-4 z-10">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-400 font-semibold">Filter:</span>
              <button
                onClick={() => setFilterRarity('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                  filterRarity === 'all'
                    ? 'bg-red-600 text-white border-2 border-red-500'
                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {rarityOrder.map(rarity => (
                <button
                  key={rarity}
                  onClick={() => setFilterRarity(rarity)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                    filterRarity === rarity
                      ? 'border-2 border-opacity-75'
                      : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                  }`}
                  style={{
                    backgroundColor: filterRarity === rarity ? `${RARITY_COLORS[rarity]}40` : undefined,
                    borderColor: filterRarity === rarity ? RARITY_COLORS[rarity] : undefined,
                    color: filterRarity === rarity ? RARITY_COLORS[rarity] : '#D1D5DB',
                  }}
                >
                  {RARITY_LABELS[rarity]} ({stats.byRarity[rarity]})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="mt-4 text-gray-300">Loading cards...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4 font-semibold">{error}</p>
              <button
                onClick={loadCards}
                className="px-4 py-2 bg-white text-black border-2 border-red-600 rounded-lg hover:bg-red-600 hover:text-white font-bold"
              >
                Try Again
              </button>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-300 mb-4">
                {filterRarity === 'all' 
                  ? 'No cards found in this wallet'
                  : `No ${RARITY_LABELS[filterRarity]} cards found`
                }
              </p>
              <p className="text-sm text-gray-400">
                {filterRarity === 'all' 
                  ? 'Mint packs to get cards!'
                  : 'Try selecting a different rarity filter'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {rarityOrder.map((rarity) => {
                const rarityCards = cardsByRarity[rarity];
                if (!rarityCards || rarityCards.length === 0) return null;

                return (
                  <div key={rarity}>
                    <div className="flex items-center gap-3 mb-4">
                      <h3
                        className="text-xl font-bold"
                        style={{ color: RARITY_COLORS[rarity] || '#9CA3AF' }}
                      >
                        {RARITY_LABELS[rarity]}
                      </h3>
                      <span className="text-sm text-gray-400">
                        ({rarityCards.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {rarityCards.map((walletCard, index) => {
                        // Konvertiere WalletCard zu Card für CardReveal
                        // WICHTIG: Verwende die Delegate-Inskription-ID (auch wenn "pending-"), nicht die Original-ID
                        // Die Delegate-Inskription enthält das Bild der Karte
                        const card: Card = {
                          id: walletCard.inscriptionId, // Delegate-Inskription-ID
                          name: walletCard.name,
                          rarity: walletCard.rarity,
                          inscriptionId: walletCard.inscriptionId, // Delegate-Inskription-ID
                          originalInscriptionId: walletCard.originalInscriptionId, // Original-ID für Bild-Abruf
                          cardType: walletCard.cardType,
                          effect: walletCard.effect,
                          svgIcon: walletCard.svgIcon,
                          revealed: true, // In Gallery immer aufgedeckt
                        };

                        return (
                          <div 
                            key={index} 
                            className="cursor-pointer group relative"
                            onClick={() => setSelectedCard(card)}
                          >
                            {/* Karte direkt anzeigen ohne extra Container */}
                            <div className="transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-red-600/40">
                              <CardReveal card={card} showRarity={true} autoReveal={true} />
                            </div>
                            {/* Hover Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal 
          card={selectedCard} 
          onClose={() => setSelectedCard(null)} 
        />
      )}
    </div>
  );
};

