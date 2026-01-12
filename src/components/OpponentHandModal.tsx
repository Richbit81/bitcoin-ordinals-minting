import React from 'react';
import { GameCard } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';

interface OpponentHandModalProps {
  cards: GameCard[];
  onSelectCard: (cardId: string) => void;
  onCancel: () => void;
  title?: string;
}

export const OpponentHandModal: React.FC<OpponentHandModalProps> = ({
  cards,
  onSelectCard,
  onCancel,
  title = "Gegner-Hand",
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border-2 border-red-600 rounded-lg max-w-4xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-300">
            Wähle eine Karte aus, die verworfen werden soll:
          </p>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => onSelectCard(card.id)}
              className="bg-gray-800 rounded p-2 border-2 border-gray-700 hover:border-red-500 transition-all cursor-pointer"
            >
              {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                <img
                  src={getCardImageUrl(card.inscriptionId)}
                  alt={card.name}
                  className="w-full h-24 object-contain mb-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="text-[10px] font-bold text-white truncate">{card.name}</div>
              {card.type === 'animal' && (
                <div className="text-[8px] text-gray-400">
                  {card.atk}/{card.hp}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};
