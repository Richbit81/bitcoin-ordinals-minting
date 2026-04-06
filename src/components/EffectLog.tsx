import React from 'react';
import { getCardImageUrl } from '../game/cardImageService';
import { getGameCardById } from '../game/gameCards';

export interface EffectLogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'play' | 'attack' | 'damage' | 'draw' | 'destroy' | 'status' | 'effect' | 'phase';
  cardId?: string; // Optional: ID der Karte für visuelle Darstellung
}

interface EffectLogProps {
  entries: EffectLogEntry[];
  maxEntries?: number;
}

export const EffectLog: React.FC<EffectLogProps> = ({ entries, maxEntries = 10 }) => {
  const displayEntries = entries.slice(-maxEntries).reverse();

  const getTypeColor = (type: EffectLogEntry['type']) => {
    switch (type) {
      case 'play': return 'text-blue-400';
      case 'attack': return 'text-red-400';
      case 'damage': return 'text-orange-400';
      case 'draw': return 'text-green-400';
      case 'destroy': return 'text-gray-400';
      case 'status': return 'text-yellow-400';
      case 'effect': return 'text-purple-400';
      case 'phase': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  };

  const getTypeIcon = (type: EffectLogEntry['type']) => {
    switch (type) {
      case 'play': return '🎴';
      case 'attack': return '⚔️';
      case 'damage': return '💥';
      case 'draw': return '📖';
      case 'destroy': return '💀';
      case 'status': return '🏷️';
      case 'effect': return '✨';
      case 'phase': return '🔄';
      default: return '•';
    }
  };

  return (
    <div className="bg-gray-900 border-2 border-gray-700 rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-white">Effekt-Log</h3>
        <span className="text-xs text-gray-400">{entries.length} Einträge</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {displayEntries.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            Noch keine Effekte
          </div>
        ) : (
          displayEntries.map(entry => {
            const card = entry.cardId ? getGameCardById(entry.cardId) : null;
            const showCardImage = card && (entry.type === 'play' || entry.type === 'draw' || entry.type === 'attack' || entry.type === 'status');
            
            return (
              <div
                key={entry.id}
                className="text-xs p-2 bg-gray-800 rounded border-l-2 border-gray-700 hover:border-red-600 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {showCardImage && card ? (
                    <img
                      src={getCardImageUrl(card.inscriptionId)}
                      alt={card.name}
                      className="w-8 h-8 object-contain rounded border border-gray-600 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-sm flex-shrink-0">{getTypeIcon(entry.type)}</span>
                  )}
                  <span className={`flex-1 ${getTypeColor(entry.type)}`}>
                    {entry.message}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
