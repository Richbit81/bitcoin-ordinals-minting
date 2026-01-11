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

  useEffect(() => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setLoading(false);
      return;
    }

    loadCards();
  }, [walletState.connected, walletState.accounts]);

  const loadCards = async () => {
    if (!walletState.accounts[0]?.address) return;

    setLoading(true);
    setError(null);

    try {
      const walletCards = await fetchWalletCards(walletState.accounts[0].address);
      setCards(walletCards);
    } catch (err: any) {
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

  // Gruppiere nach Rarität
  const cardsByRarity = cards.reduce((acc, card) => {
    if (!acc[card.rarity]) {
      acc[card.rarity] = [];
    }
    acc[card.rarity].push(card);
    return acc;
  }, {} as Record<Rarity, WalletCard[]>);

  const rarityOrder: Rarity[] = ['mystic-legendary', 'legendary', 'epic', 'rare', 'uncommon', 'common'];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-black border-2 border-red-600 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-black border-b-2 border-red-600 p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                onClose();
                navigate('/black-wild');
              }}
              className="text-gray-400 hover:text-white flex items-center gap-2"
              title="Back to Mint Page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-semibold">Back</span>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white border-b-2 border-red-600 pb-2 inline-block">My Gallery</h2>
              <p className="text-sm text-gray-300 mt-2">
                {cards.length} card{cards.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
          ) : cards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-300 mb-4">No cards found in this wallet</p>
              <p className="text-sm text-gray-400">
                Mint packs to get cards!
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
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                            className="flex flex-col cursor-pointer hover:scale-105 transition-transform duration-200"
                            onClick={() => setSelectedCard(card)}
                          >
                            {/* Kleinere Kartenansicht */}
                            <div className="transform scale-75 origin-top-left w-[133%] h-[133%]">
                              <CardReveal card={card} showRarity={true} autoReveal={true} />
                            </div>
                            {/* Kartenname (klein) */}
                            <div className="mt-1 p-1 bg-gray-900 border border-gray-700 rounded text-xs">
                              <p className="font-bold text-white text-center text-[10px] truncate" title={walletCard.name}>
                                {walletCard.name}
                              </p>
                            </div>
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

