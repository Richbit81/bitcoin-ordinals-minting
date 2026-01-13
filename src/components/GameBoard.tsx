import React from 'react';
import { GameState, BoardAnimal } from '../game/gameEngine';
import { GameCard, ALL_GAME_CARDS, STATUS_CATEGORIES } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';

interface GameBoardProps {
  gameState: GameState;
  playerIndex: number;
  isPlayerTurn: boolean;
  attackingAnimal: string | null;
  onAnimalClick?: (animal: BoardAnimal) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  playerIndex,
  isPlayerTurn,
  attackingAnimal,
  onAnimalClick,
}) => {
  const player = gameState.players[playerIndex];
  const isPlayer = playerIndex === 0;

  return (
    <div className={`relative ${isPlayer ? 'bg-gradient-to-b from-blue-900/30 to-blue-950/30' : 'bg-gradient-to-b from-red-900/30 to-red-950/30'} rounded-xl p-6 border-2 ${isPlayer ? 'border-blue-500' : 'border-red-500'} min-h-[300px]`}>
      {/* Player Info Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h3 className={`text-xl font-bold ${isPlayer ? 'text-blue-400' : 'text-red-400'}`}>
            {isPlayer ? 'You' : 'Opponent'}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              ❤️ <span className="font-bold text-lg">{player.life}</span>
            </span>
            <span className="text-sm">
              🎴 Deck: <span className="font-bold">{player.deck.length}</span>
            </span>
            <span className="text-sm">
              ✋ Hand: <span className="font-bold">{player.hand.length}</span>
            </span>
          </div>
        </div>
        {player.statuses.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {player.statuses.map((statusId, idx) => {
              const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
              if (!statusCard) return null;
              const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
              const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
              return (
                <span
                  key={idx}
                  className={`text-xs px-2 py-1 rounded border ${
                    isNegative ? 'bg-red-600/80 text-white border-red-400' :
                    isPositive ? 'bg-green-600/80 text-white border-green-400' :
                    'bg-yellow-600/80 text-black border-yellow-400'
                  }`}
                  title={statusCard.effectText}
                >
                  {statusCard.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Board Grid - Größer und prominenter */}
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, index) => {
          const animal = player.board[index];
          const isAttacking = attackingAnimal === animal?.id;
          
          return (
            <div
              key={index}
              className={`relative aspect-[3/4] rounded-lg border-2 transition-all duration-300 ${
                animal
                  ? isPlayer
                    ? isAttacking
                      ? 'border-yellow-400 bg-yellow-900/30 shadow-lg shadow-yellow-400/50 scale-105 animate-pulse'
                      : 'border-blue-400 bg-gray-800/80 hover:border-blue-300 hover:scale-105 cursor-pointer'
                    : 'border-red-400 bg-gray-800/80'
                  : isPlayer
                    ? 'border-gray-600 bg-gray-900/50 border-dashed'
                    : 'border-gray-700 bg-gray-900/30 border-dashed'
              }`}
              onClick={() => animal && onAnimalClick && onAnimalClick(animal)}
            >
              {animal ? (
                <>
                  {/* Card Image */}
                  {animal.card.inscriptionId && !animal.card.inscriptionId.includes('placeholder') && (
                    <img
                      src={getCardImageUrl(animal.card.inscriptionId)}
                      alt={animal.card.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  
                  {/* Card Overlay with Stats */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-lg flex flex-col justify-end p-2">
                    <div className="text-xs font-bold text-white mb-1">{animal.card.name}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-400 font-bold">⚔️ {animal.currentAtk}</span>
                      <span className="text-blue-400 font-bold">🛡️ {animal.currentHp}</span>
                    </div>
                    
                    {/* Status Icons */}
                    {animal.statuses.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {animal.statuses.map((statusId, idx) => {
                          const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                          if (!statusCard) return null;
                          const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                          const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                          return (
                            <span
                              key={idx}
                              className={`text-[8px] px-1 py-0.5 rounded ${
                                isNegative ? 'bg-red-600 text-white' :
                                isPositive ? 'bg-green-600 text-white' :
                                'bg-yellow-600 text-black'
                              }`}
                              title={statusCard.effectText}
                            >
                              {statusCard.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Attack Indicator */}
                  {isAttacking && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="text-4xl font-bold text-yellow-400 animate-pulse drop-shadow-lg">
                        ⚔️ ATTACK!
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                  Empty
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
