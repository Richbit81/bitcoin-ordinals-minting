import React from 'react';
import { WalletCard } from '../../services/gallery';
import { CardReveal } from '../CardReveal';
import { Card } from '../../types/wallet';

interface CardSelectorProps {
  cards: WalletCard[];
  selectedCards: string[];
  onCardToggle: (inscriptionId: string) => void;
  title: string;
  maxCards?: number;
}

export const CardSelector: React.FC<CardSelectorProps> = ({
  cards,
  selectedCards,
  onCardToggle,
  title,
  maxCards,
}) => {
  const isSelected = (inscriptionId: string) => selectedCards.includes(inscriptionId);
  const canSelectMore = maxCards ? selectedCards.length < maxCards : true;

  return (
    <div className="flex-1">
      <h3 className="text-xl font-bold mb-4 border-b-2 border-red-600 pb-2">
        {title}
        {maxCards && (
          <span className="text-sm text-gray-400 ml-2">
            ({selectedCards.length}/{maxCards})
          </span>
        )}
      </h3>

      {cards.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No cards available</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
          {cards.map((walletCard) => {
            const card: Card = {
              id: walletCard.inscriptionId,
              name: walletCard.name,
              rarity: walletCard.rarity,
              inscriptionId: walletCard.inscriptionId, // Delegate-Inskription-ID
              originalInscriptionId: walletCard.originalInscriptionId, // Original-ID für Bild-Abruf
              cardType: walletCard.cardType,
              effect: walletCard.effect,
              svgIcon: walletCard.svgIcon,
              revealed: true,
            };

            const selected = isSelected(walletCard.inscriptionId);
            const disabled = !selected && !canSelectMore;

            return (
              <div
                key={walletCard.inscriptionId}
                onClick={() => {
                  if (!disabled) {
                    onCardToggle(walletCard.inscriptionId);
                  }
                }}
                className={`relative cursor-pointer transition-all ${
                  selected
                    ? 'ring-4 ring-red-600 scale-105'
                    : disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105'
                }`}
              >
                <CardReveal card={card} showRarity={true} autoReveal={true} />
                {selected && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};



