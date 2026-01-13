import React from 'react';
import { GameState, BoardAnimal } from '../game/gameEngine';
import { GameCard, ALL_GAME_CARDS, STATUS_CATEGORIES } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';

interface GameBoardViewProps {
  gameState: GameState;
  isPlayerTurn: boolean;
  attackingAnimal: string | null;
  onPlayerAnimalClick?: (animal: BoardAnimal) => void;
}

export const GameBoardView: React.FC<GameBoardViewProps> = ({
  gameState,
  isPlayerTurn,
  attackingAnimal,
  onPlayerAnimalClick,
}) => {
  const player = gameState.players[0];
  const opponent = gameState.players[1];

  const renderAnimalCard = (animal: BoardAnimal | undefined, index: number, isPlayer: boolean) => {
    const isAttacking = attackingAnimal === animal?.id;
    const isEmpty = !animal;

    return (
      <div
        key={index}
        className={`relative aspect-[3/4] rounded-lg border-2 transition-all duration-300 ${
          isEmpty
            ? 'border-gray-700/50 bg-gray-900/30 border-dashed'
            : isAttacking && isPlayer
              ? 'border-yellow-400 bg-yellow-900/30 shadow-lg shadow-yellow-400/50 scale-105 animate-pulse cursor-pointer'
              : isPlayer
                ? 'border-blue-400 bg-gray-800/90 hover:border-blue-300 hover:scale-105 cursor-pointer'
                : 'border-red-400 bg-gray-800/90'
        }`}
        onClick={() => animal && isPlayer && onPlayerAnimalClick && onPlayerAnimalClick(animal)}
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent rounded-lg flex flex-col justify-end p-2">
              <div className="text-xs font-bold text-white mb-1 truncate">{animal.card.name}</div>
              <div className="flex items-center justify-between text-xs mb-1">
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
            {isAttacking && isPlayer && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-3xl font-bold text-yellow-400 animate-pulse drop-shadow-lg">
                  ⚔️
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px]">
            Empty
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Main Game Board */}
      <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-4 border-gray-700 shadow-2xl p-6 relative overflow-hidden">
        {/* Board Pattern Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)
            `
          }}></div>
        </div>

        {/* Opponent Section */}
        <div className="relative z-10 mb-8">
          {/* Opponent Header */}
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-red-400">Opponent</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-red-500">❤️</span>
                  <span className="font-bold text-lg">{opponent.life}</span>
                </span>
                <span className="text-gray-400">
                  🎴 {opponent.deck.length} | ✋ {opponent.hand.length}
                </span>
              </div>
            </div>
            {opponent.statuses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {opponent.statuses.map((statusId, idx) => {
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

          {/* Opponent Board - 5 Slots */}
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, index) => 
              renderAnimalCard(opponent.board[index], index, false)
            )}
          </div>
        </div>

        {/* Battlefield Center Line */}
        <div className="relative z-10 my-4 flex items-center justify-center">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
          <div className="mx-4 text-gray-500 text-xs font-bold">⚔️ BATTLEFIELD ⚔️</div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>

        {/* Player Section */}
        <div className="relative z-10 mt-8">
          {/* Player Header */}
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-blue-400">You</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-red-500">❤️</span>
                  <span className="font-bold text-lg">{player.life}</span>
                </span>
                <span className="text-gray-400">
                  🎴 {player.deck.length} | ✋ {player.hand.length}
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

          {/* Player Board - 5 Slots */}
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, index) => 
              renderAnimalCard(player.board[index], index, true)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
