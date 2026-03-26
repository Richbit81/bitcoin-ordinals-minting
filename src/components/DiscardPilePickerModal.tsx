import React from 'react';
import { GameCard } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';

interface DiscardPilePickerModalProps {
  actionCards: GameCard[];
  onSelectCard: (card: GameCard) => void;
  onCancel: () => void;
}

export const DiscardPilePickerModal: React.FC<DiscardPilePickerModalProps> = ({
  actionCards,
  onSelectCard,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border-2 border-orange-500 rounded-xl max-w-2xl w-full p-6 shadow-2xl shadow-orange-500/20">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-orange-400">Fox - Copy Effect</h2>
            <p className="text-sm text-gray-400 mt-1">
              Wähle eine Action-Karte aus dem Ablagestapel, deren Effekt kopiert wird.
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {actionCards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-yellow-400 mb-4">Keine Action-Karten im Ablagestapel.</p>
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              Schliessen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {actionCards.map((card, idx) => (
              <button
                key={`${card.id}-${idx}`}
                onClick={() => onSelectCard(card)}
                className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-orange-400 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg hover:shadow-orange-400/20 text-left group"
              >
                {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                  <img
                    src={getCardImageUrl(card.inscriptionId)}
                    alt={card.name}
                    className="w-full h-24 object-contain mb-2 rounded opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="text-sm font-bold text-white">{card.name}</div>
                <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">{card.effectText}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {card.effects.filter(e => e.trigger === 'onPlay').map((eff, i) => (
                    <span key={i} className="text-[9px] bg-orange-900/50 text-orange-300 px-1.5 py-0.5 rounded">
                      {eff.action.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
