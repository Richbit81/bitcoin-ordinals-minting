import React from 'react';
import { GameState, BoardAnimal } from '../game/gameEngine';
import { ALL_GAME_CARDS, STATUS_CATEGORIES, getGameCardById } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';

interface GameBoardViewProps {
  gameState: GameState;
  isPlayerTurn: boolean;
  attackingAnimal: string | null;
  compactMode?: boolean;
  ultraCompact?: boolean;
  boardScale?: number;
  emphasis?: {
    player?: boolean;
    opponent?: boolean;
    center?: boolean;
    type?: 'attack' | 'damage' | 'status' | 'play' | 'draw' | 'effect';
  };
  onPlayerAnimalClick?: (animal: BoardAnimal) => void;
}

const STATUS_ICONS: Record<string, string> = {
  BLEEDING: '🩸',
  STUCK: '🕸️',
  TINT: '💧',
  TARGET: '🎯',
  SWARM: '🐝',
  SHIELD: '🛡️',
  RAGE: '🔥',
  PARANOIA: '👁️',
};

const getStatusAnimationClass = (statusName: string): string => {
  switch (statusName) {
    case 'BLEEDING': return 'animate-bleed-pulse';
    case 'STUCK': return 'animate-freeze-pulse';
    case 'RAGE': return 'animate-rage-flame';
    case 'SHIELD': return 'animate-shield-glow';
    default: return '';
  }
};

export const GameBoardView: React.FC<GameBoardViewProps> = ({
  gameState,
  isPlayerTurn,
  attackingAnimal,
  compactMode = true,
  ultraCompact = false,
  boardScale = 92,
  emphasis,
  onPlayerAnimalClick,
}) => {
  const player = gameState.players[0];
  const opponent = gameState.players[1];

  const renderAnimalCard = (animal: BoardAnimal | undefined, index: number, isPlayer: boolean) => {
    const isAttacking = attackingAnimal === animal?.id;
    const isEmpty = !animal;

    const hasStuck = animal?.statuses.some(sid => getGameCardById(sid)?.name === 'STUCK');
    const hasRage = animal?.statuses.some(sid => getGameCardById(sid)?.name === 'RAGE');
    const hasShield = animal?.statuses.some(sid => getGameCardById(sid)?.name === 'SHIELD');
    const hasBleeding = animal?.statuses.some(sid => getGameCardById(sid)?.name === 'BLEEDING');

    let borderClass = 'border-gray-700/50 bg-gray-900/30 border-dashed';
    if (!isEmpty) {
      if (isAttacking && isPlayer) {
        borderClass = 'border-yellow-400 bg-yellow-900/30 shadow-lg shadow-yellow-400/50 scale-105';
      } else if (hasShield) {
        borderClass = isPlayer
          ? 'border-cyan-400 bg-gray-800/90 animate-shield-glow'
          : 'border-cyan-400 bg-gray-800/90 animate-shield-glow';
      } else if (hasStuck) {
        borderClass = 'border-blue-300 bg-blue-950/50 animate-freeze-pulse';
      } else if (hasRage) {
        borderClass = isPlayer
          ? 'border-orange-500 bg-orange-950/40 shadow-md shadow-orange-500/30'
          : 'border-orange-500 bg-orange-950/40 shadow-md shadow-orange-500/30';
      } else if (isPlayer) {
        borderClass = 'border-blue-400 bg-gray-800/90 hover:border-blue-300 hover:scale-105 cursor-pointer';
      } else {
        borderClass = 'border-red-400 bg-gray-800/90';
      }
    }

    return (
      <div
        key={index}
        className={`relative ${ultraCompact ? 'aspect-square' : 'aspect-[4/5]'} rounded-lg border-2 transition-all duration-300 ${borderClass}`}
        onClick={() => animal && isPlayer && onPlayerAnimalClick && onPlayerAnimalClick(animal)}
      >
        {animal ? (
          <>
            {animal.card.inscriptionId && !animal.card.inscriptionId.includes('placeholder') && (
              <img
                src={getCardImageUrl(animal.card.inscriptionId)}
                alt={animal.card.name}
                className={`w-full h-full object-cover rounded-lg ${
                  hasStuck ? 'opacity-60 saturate-50' : ''
                } ${hasBleeding ? 'brightness-90' : ''}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}

            <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-lg flex flex-col justify-end ${ultraCompact ? 'p-1.5' : 'p-2'}`}>
              <div className={`${ultraCompact ? 'text-[10px]' : 'text-xs'} font-bold text-white mb-1 truncate`}>{animal.card.name}</div>

              {/* ATK / HP */}
              <div className={`flex items-center justify-between ${ultraCompact ? 'text-[10px]' : 'text-xs'} mb-1`}>
                <span className={`font-bold ${hasRage ? 'text-orange-400' : 'text-red-400'}`}>
                  {hasRage ? '🔥' : '⚔️'} {animal.currentAtk}
                </span>
                <span className={`font-bold ${hasBleeding ? 'text-red-300' : 'text-blue-400'}`}>
                  {hasBleeding ? '🩸' : '🛡️'} {animal.currentHp}/{animal.maxHp}
                </span>
              </div>

              {/* Status Icons */}
              {!ultraCompact && animal.statuses.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {animal.statuses.map((statusId, idx) => {
                    const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                    if (!statusCard) return null;
                    const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                    const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                    const icon = STATUS_ICONS[statusCard.name] || '•';
                    const animClass = getStatusAnimationClass(statusCard.name);

                    return (
                      <span
                        key={idx}
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 ${animClass} ${
                          isNegative ? 'bg-red-800/90 text-red-200 border border-red-600/50' :
                          isPositive ? 'bg-green-800/90 text-green-200 border border-green-600/50' :
                          'bg-yellow-800/90 text-yellow-200 border border-yellow-600/50'
                        }`}
                        title={statusCard.effectText}
                      >
                        <span>{icon}</span>
                        <span className="hidden sm:inline">{statusCard.name}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Special ability indicator */}
              {!ultraCompact && animal.maxAttacks > 1 && (
                <div className="text-[9px] text-yellow-400 mt-0.5 font-bold">
                  x{animal.maxAttacks} ATK
                </div>
              )}
            </div>

            {/* Attack Animation Overlay */}
            {isAttacking && isPlayer && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-4xl animate-attack-flash drop-shadow-lg">
                  ⚔️
                </div>
              </div>
            )}

            {/* STUCK ice overlay */}
            {hasStuck && (
              <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-blue-400/10 to-blue-600/20 pointer-events-none" />
            )}

            {/* Bleeding drip effect */}
            {hasBleeding && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent rounded-t-lg animate-bleed-pulse" />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-[10px]">
            Leer
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto" style={{ zoom: Math.max(62, Math.min(110, boardScale)) / 100 }}>
      <div className={`bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-4 border-gray-700 shadow-2xl ${ultraCompact ? 'p-2' : compactMode ? 'p-3' : 'p-5'} relative overflow-hidden`}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)
            `
          }} />
        </div>

        {/* Opponent Section */}
        <div className={`relative z-10 ${ultraCompact ? 'mb-3' : 'mb-5'} rounded-xl transition-all duration-200 ${emphasis?.opponent ? 'ring-2 ring-red-400/80 shadow-[0_0_22px_rgba(239,68,68,0.45)]' : ''}`}>
          <div className={`flex justify-between items-center ${ultraCompact ? 'mb-2 px-1.5' : 'mb-3 px-2'}`}>
            <div className={`flex items-center ${ultraCompact ? 'gap-2' : 'gap-4'}`}>
              <h3 className={`${ultraCompact ? 'text-sm' : compactMode ? 'text-base' : 'text-lg'} font-bold text-red-400`}>Gegner</h3>
              <div className={`flex items-center ${ultraCompact ? 'gap-2 text-xs' : 'gap-4 text-sm'}`}>
                <span className="flex items-center gap-1">
                  <span className="text-red-500 text-lg">❤️</span>
                  <span className={`font-bold text-lg ${opponent.life <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {opponent.life}
                  </span>
                </span>
                <span className="text-gray-400 text-xs">
                  Deck: {opponent.deck.length} | Hand: {opponent.hand.length}
                </span>
              </div>
            </div>
            {!ultraCompact && opponent.statuses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {opponent.statuses.map((statusId, idx) => {
                  const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                  if (!statusCard) return null;
                  const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                  const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                  const icon = STATUS_ICONS[statusCard.name] || '•';
                  return (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded-lg border font-bold ${
                        isNegative ? 'bg-red-600/80 text-white border-red-400' :
                        isPositive ? 'bg-green-600/80 text-white border-green-400' :
                        'bg-yellow-600/80 text-black border-yellow-400'
                      }`}
                      title={statusCard.effectText}
                    >
                      {icon} {statusCard.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`grid grid-cols-5 ${ultraCompact ? 'gap-1' : compactMode ? 'gap-1.5' : 'gap-2.5'}`}>
            {Array.from({ length: 5 }).map((_, index) =>
              renderAnimalCard(opponent.board[index], index, false)
            )}
          </div>
        </div>

        {/* Center divider */}
        <div className={`relative z-10 ${ultraCompact ? 'my-2' : 'my-4'} flex items-center justify-center transition-all duration-200 ${emphasis?.center ? 'scale-[1.02]' : ''}`}>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
          <div className={`mx-4 text-gray-400 font-bold tracking-wider ${compactMode ? 'text-[10px]' : 'text-xs'} ${emphasis?.center ? 'text-yellow-300' : ''}`}>BATTLEFIELD</div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-600/50 to-transparent" />
        </div>

        {/* Player Section */}
        <div className={`relative z-10 ${ultraCompact ? 'mt-3' : 'mt-5'} rounded-xl transition-all duration-200 ${emphasis?.player ? 'ring-2 ring-blue-400/80 shadow-[0_0_20px_rgba(59,130,246,0.45)]' : ''}`}>
          <div className={`flex justify-between items-center ${ultraCompact ? 'mb-2 px-1.5' : 'mb-3 px-2'}`}>
            <div className={`flex items-center ${ultraCompact ? 'gap-2' : 'gap-4'}`}>
              <h3 className={`${ultraCompact ? 'text-sm' : compactMode ? 'text-base' : 'text-lg'} font-bold text-blue-400`}>Du</h3>
              <div className={`flex items-center ${ultraCompact ? 'gap-2 text-xs' : 'gap-4 text-sm'}`}>
                <span className="flex items-center gap-1">
                  <span className="text-red-500 text-lg">❤️</span>
                  <span className={`font-bold text-lg ${player.life <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {player.life}
                  </span>
                </span>
                <span className="text-gray-400 text-xs">
                  Deck: {player.deck.length} | Hand: {player.hand.length}
                </span>
              </div>
            </div>
            {!ultraCompact && player.statuses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {player.statuses.map((statusId, idx) => {
                  const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                  if (!statusCard) return null;
                  const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                  const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                  const icon = STATUS_ICONS[statusCard.name] || '•';
                  return (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded-lg border font-bold ${
                        isNegative ? 'bg-red-600/80 text-white border-red-400' :
                        isPositive ? 'bg-green-600/80 text-white border-green-400' :
                        'bg-yellow-600/80 text-black border-yellow-400'
                      }`}
                      title={statusCard.effectText}
                    >
                      {icon} {statusCard.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`grid grid-cols-5 ${ultraCompact ? 'gap-1' : compactMode ? 'gap-1.5' : 'gap-2.5'}`}>
            {Array.from({ length: 5 }).map((_, index) =>
              renderAnimalCard(player.board[index], index, true)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
