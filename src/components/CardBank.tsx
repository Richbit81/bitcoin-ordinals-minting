import React from 'react';
import { GameCard, ALL_GAME_CARDS } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';

interface CardBankProps {
  isOpen: boolean;
  onClose: () => void;
  playerDeck: GameCard[];
  playerHand: GameCard[];
  playerDiscard: GameCard[];
}

export const CardBank: React.FC<CardBankProps> = ({
  isOpen,
  onClose,
  playerDeck,
  playerHand,
  playerDiscard,
}) => {
  if (!isOpen) return null;

  const allCards = ALL_GAME_CARDS;
  const animals = allCards.filter(c => c.type === 'animal');
  const actions = allCards.filter(c => c.type === 'action');
  const statuses = allCards.filter(c => c.type === 'status');

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border-2 border-red-600 max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold">📚 Card Bank - All Available Cards</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
          >
            ✕ Close
          </button>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-400">Your Deck:</span> <span className="font-bold text-blue-400">{playerDeck.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Your Hand:</span> <span className="font-bold text-green-400">{playerHand.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Discard:</span> <span className="font-bold text-yellow-400">{playerDiscard.length}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Animals */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 text-blue-400">🐾 Animals ({animals.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {animals.map(card => (
                <div
                  key={card.id}
                  className="bg-gray-800 rounded-lg p-2 border border-gray-600 hover:border-blue-400 transition-all"
                >
                  {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                    <img
                      src={getCardImageUrl(card.inscriptionId)}
                      alt={card.name}
                      className="w-full h-32 object-contain mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="text-xs font-bold">{card.name}</div>
                  <div className="text-xs text-gray-400">
                    {card.atk}/{card.hp}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                    {card.effectText}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 text-red-400">⚡ Actions ({actions.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {actions.map(card => (
                <div
                  key={card.id}
                  className="bg-gray-800 rounded-lg p-2 border border-gray-600 hover:border-red-400 transition-all"
                >
                  {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                    <img
                      src={getCardImageUrl(card.inscriptionId)}
                      alt={card.name}
                      className="w-full h-32 object-contain mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="text-xs font-bold">{card.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1 line-clamp-3">
                    {card.effectText}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statuses */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-yellow-400">🏷️ Status ({statuses.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {statuses.map(card => (
                <div
                  key={card.id}
                  className="bg-gray-800 rounded-lg p-2 border border-gray-600 hover:border-yellow-400 transition-all"
                >
                  {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                    <img
                      src={getCardImageUrl(card.inscriptionId)}
                      alt={card.name}
                      className="w-full h-32 object-contain mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="text-xs font-bold">{card.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1 line-clamp-3">
                    {card.effectText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
