import React from 'react';
import { Card, RARITY_COLORS, RARITY_LABELS } from '../types/wallet';

interface ActionStatusCardProps {
  card: Card;
  showRarity?: boolean;
}

export const ActionStatusCard: React.FC<ActionStatusCardProps> = ({ card, showRarity = true }) => {
  const isAction = card.cardType === 'action';
  const isStatus = card.cardType === 'status';
  const cardTypeLabel = isAction ? 'ACTION' : isStatus ? 'STATUS' : 'ANIMAL';

  return (
    <div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border-2"
      style={{
        borderColor: showRarity ? (RARITY_COLORS[card.rarity] || '#9CA3AF') : '#9CA3AF',
      }}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-lg font-bold text-white text-center mb-1">{card.name}</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-700 text-gray-200">
            {cardTypeLabel}
          </span>
          {showRarity && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: RARITY_COLORS[card.rarity] || '#9CA3AF',
                color: 'white',
              }}
            >
              {RARITY_LABELS[card.rarity]}
            </span>
          )}
        </div>
      </div>

      {/* SVG Icon */}
      {(isAction || isStatus) && card.svgIcon && (
        <div className="p-6 flex items-center justify-center bg-white min-h-[200px]">
          <div
            className="w-full max-w-xs flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: card.svgIcon }}
            style={{
              // Keine Filter, die Farben verfälschen könnten
              filter: 'none',
              WebkitFilter: 'none',
              // Stelle sicher, dass SVG korrekt skaliert wird
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>
      )}

      {/* Animal Placeholder wenn kein SVG */}
      {card.cardType === 'animal' && (
        <div className="p-6 flex items-center justify-center bg-gray-800">
          <div className="w-24 h-24 flex items-center justify-center text-6xl">
            🃏
          </div>
        </div>
      )}

      {/* Effect Text */}
      {card.effect && (
        <div className="p-3 bg-gray-900 border-t border-gray-700">
          <p className="text-xs text-gray-300 text-center leading-relaxed">
            {card.effect}
          </p>
        </div>
      )}
    </div>
  );
};

