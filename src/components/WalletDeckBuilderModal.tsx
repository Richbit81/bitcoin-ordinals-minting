import React, { useState, useMemo } from 'react';
import { GameCard } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';
import { walletCardToGameCard } from '../game/gameEngine';
import { WalletCard } from '../services/gallery';

interface WalletDeckBuilderModalProps {
  onClose: () => void;
  onDeckCreated: (deck: GameCard[]) => void;
  currentDeck: GameCard[];
  walletCards: WalletCard[];
  isAdmin: boolean;
}

export const WalletDeckBuilderModal: React.FC<WalletDeckBuilderModalProps> = ({ 
  onClose, 
  onDeckCreated, 
  currentDeck,
  walletCards,
  isAdmin
}) => {
  const [selectedCards, setSelectedCards] = useState<GameCard[]>(currentDeck);
  const [filterType, setFilterType] = useState<'all' | 'animal' | 'action' | 'status'>('all');

  // Konvertiere Wallet-Karten zu GameCards
  const availableGameCards = useMemo(() => {
    const gameCards: GameCard[] = [];
    for (const walletCard of walletCards) {
      const gameCard = walletCardToGameCard(walletCard);
      if (gameCard) {
        gameCards.push(gameCard);
      }
    }
    return gameCards;
  }, [walletCards]);

  // Gefilterte Karten
  const filteredCards = useMemo(() => {
    if (filterType === 'all') {
      return availableGameCards;
    }
    return availableGameCards.filter(c => c.type === filterType);
  }, [availableGameCards, filterType]);

  const getCardCount = (cardName: string): number => {
    return selectedCards.filter(c => c.name === cardName).length;
  };

  const getAvailableCardCount = (cardName: string): number => {
    return availableGameCards.filter(c => c.name === cardName).length;
  };

  const canAddCard = (card: GameCard): boolean => {
    const selectedCount = getCardCount(card.name);
    const availableCount = getAvailableCardCount(card.name);
    return selectedCount < availableCount && selectedCount < 2; // Max. 2 Kopien oder verfügbare Anzahl
  };

  const addCard = (card: GameCard) => {
    if (!canAddCard(card)) return;
    if (selectedCards.length >= 24) {
      alert('Deck is full! (Max. 24 cards)');
      return;
    }
    setSelectedCards([...selectedCards, card]);
  };

  const removeCard = (index: number) => {
    const newDeck = [...selectedCards];
    newDeck.splice(index, 1);
    setSelectedCards(newDeck);
  };

  const animalCount = selectedCards.filter(c => c.type === 'animal').length;
  const actionCount = selectedCards.filter(c => c.type === 'action').length;
  const statusCount = selectedCards.filter(c => c.type === 'status').length;

  const canCreateDeck = selectedCards.length === 24 && animalCount >= 10;

  const handleCreateDeck = () => {
    if (!canCreateDeck) {
      if (selectedCards.length !== 24) {
        alert(`Exactly 24 cards required! Current: ${selectedCards.length}`);
      } else if (animalCount < 10) {
        alert(`At least 10 Animal cards required! Current: ${animalCount}`);
      }
      return;
    }
    onDeckCreated(selectedCards);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto border-2 border-blue-600">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-blue-400">🎴 Build Deck from Wallet Cards</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Close
          </button>
        </div>

        {/* Deck Info */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{selectedCards.length}/24</div>
              <div className="text-sm text-gray-400">Cards</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{animalCount}</div>
              <div className="text-sm text-gray-400">Animals {animalCount >= 10 ? '✅' : '❌'}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{actionCount}</div>
              <div className="text-sm text-gray-400">Actions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{statusCount}</div>
              <div className="text-sm text-gray-400">Status</div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-4 flex gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-600"
          >
            <option value="all">All Types</option>
            <option value="animal">Animals</option>
            <option value="action">Actions</option>
            <option value="status">Status</option>
          </select>
          <div className="text-sm text-gray-400 flex items-center">
            {availableGameCards.length} cards available from wallet
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Verfügbare Karten */}
          <div>
            <h3 className="text-lg font-bold mb-2">Available Cards ({filteredCards.length})</h3>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {filteredCards.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No cards available
                </div>
              ) : (
                filteredCards.map((card, index) => {
                  const selectedCount = getCardCount(card.name);
                  const availableCount = getAvailableCardCount(card.name);
                  const canAdd = canAddCard(card);
                  const isFull = selectedCards.length >= 24;
                  
                  return (
                    <div
                      key={`${card.id}-${card.name}-${index}`}
                      className={`
                        bg-gray-800 rounded p-2 border-2 cursor-pointer transition-all
                        ${canAdd && !isFull 
                          ? 'border-blue-500 hover:border-blue-300 hover:scale-105' 
                          : 'border-gray-600 opacity-50 cursor-not-allowed'
                        }
                      `}
                      onClick={() => canAdd && !isFull && addCard(card)}
                    >
                      <div className="flex items-center gap-2">
                        {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                          <img
                            src={getCardImageUrl(card.inscriptionId)}
                            alt={card.name}
                            className="w-12 h-12 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-bold">{card.name}</div>
                          {card.type === 'animal' && (
                            <div className="text-xs text-gray-400">{card.atk}/{card.hp}</div>
                          )}
                          <div className="text-xs text-gray-500">{card.rarity}</div>
                        </div>
                        <div className="text-xs">
                          {selectedCount > 0 && <span className="text-yellow-400">{selectedCount}/{availableCount}</span>}
                          {!canAdd && <span className="text-red-400">MAX</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ausgewählte Karten (Deck) */}
          <div>
            <h3 className="text-lg font-bold mb-2">Deck ({selectedCards.length}/24)</h3>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {selectedCards.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No cards selected
                </div>
              ) : (
                selectedCards.map((card, index) => (
                  <div
                    key={`selected-${index}`}
                    className="bg-gray-800 rounded p-2 border-2 border-green-500 flex items-center gap-2"
                  >
                    {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                      <img
                        src={getCardImageUrl(card.inscriptionId)}
                        alt={card.name}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-bold">{card.name}</div>
                      {card.type === 'animal' && (
                        <div className="text-xs text-gray-400">{card.atk}/{card.hp}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeCard(index)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setSelectedCards([])}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Clear Deck
          </button>
          <button
            onClick={handleCreateDeck}
            disabled={!canCreateDeck}
            className={`
              px-6 py-2 rounded-lg font-semibold
              ${canCreateDeck 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 cursor-not-allowed opacity-50'
              }
            `}
          >
            Create Deck
          </button>
        </div>
      </div>
    </div>
  );
};
