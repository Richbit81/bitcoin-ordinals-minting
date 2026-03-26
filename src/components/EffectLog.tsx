import React, { useRef, useEffect } from 'react';
import { getCardImageUrl } from '../game/cardImageService';
import { getGameCardById } from '../game/gameCards';

export interface EffectLogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'play' | 'attack' | 'damage' | 'draw' | 'destroy' | 'status' | 'effect' | 'phase';
  cardId?: string;
}

interface EffectLogProps {
  entries: EffectLogEntry[];
  maxEntries?: number;
  language?: 'de' | 'en';
}

const translateLogMessage = (message: string, language: 'de' | 'en') => {
  if (language === 'de') return message;
  const msg = String(message || '');

  let translated = msg;
  translated = translated.replace(/^Spieler (\d+) spielt (.+)$/i, 'Player $1 plays $2');
  translated = translated.replace(/^Spieler (\d+) zieht eine Karte$/i, 'Player $1 draws a card');
  translated = translated.replace(/^Karte (.+) wird verworfen$/i, 'Card $1 is discarded');
  translated = translated.replace(/^Fox kopiert (.+)!$/i, 'Fox copies $1!');
  translated = translated.replace(/^Gegner zieht eine Karte$/i, 'Opponent draws a card');
  translated = translated.replace(/^Gegner spielt: (.+)$/i, 'Opponent plays: $1');
  translated = translated.replace(/\(Spieler (\d+)\)/gi, '(Player $1)');
  translated = translated.replace(/\(Gegner\)/gi, '(Opponent)');
  translated = translated.replace(/^Phase: /i, 'Phase: ');
  translated = translated.replace(/ wird zerstört/gi, ' is destroyed');
  translated = translated.replace(/ erhält /gi, ' gains ');
  translated = translated.replace(/ verliert /gi, ' loses ');
  translated = translated.replace(/ Schaden/gi, ' damage');
  translated = translated.replace(/ Leben/gi, ' life');
  return translated;
};

export const EffectLog: React.FC<EffectLogProps> = ({ entries, maxEntries = 12, language = 'de' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayEntries = entries.slice(-maxEntries);

  useEffect(() => {
    if (scrollRef.current) {
      // Keep newest entry visible in chronological mode (oldest -> newest).
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const getTypeColor = (type: EffectLogEntry['type']) => {
    switch (type) {
      case 'play': return 'text-blue-400 border-blue-600/40';
      case 'attack': return 'text-red-400 border-red-600/40';
      case 'damage': return 'text-orange-400 border-orange-600/40';
      case 'draw': return 'text-green-400 border-green-600/40';
      case 'destroy': return 'text-gray-400 border-gray-500/40';
      case 'status': return 'text-yellow-400 border-yellow-600/40';
      case 'effect': return 'text-purple-400 border-purple-600/40';
      case 'phase': return 'text-cyan-400 border-cyan-600/40';
      default: return 'text-gray-300 border-gray-700';
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
    <div className="bg-gray-900/80 backdrop-blur border-2 border-gray-700 rounded-xl p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-white">{language === 'en' ? 'Effect Log' : 'Effekt-Log'}</h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
          {entries.length}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 max-h-[38vh] xl:max-h-[72vh] scrollbar-hide">
        {displayEntries.length === 0 ? (
          <div className="text-xs text-gray-600 text-center py-6">
            {language === 'en' ? 'No effects yet' : 'Noch keine Effekte'}
          </div>
        ) : (
          displayEntries.map((entry, idx) => {
            const card = entry.cardId ? getGameCardById(entry.cardId) : null;
            const showCardImage = card && (entry.type === 'play' || entry.type === 'draw' || entry.type === 'attack' || entry.type === 'status');
            const colorClass = getTypeColor(entry.type);
            const isNew = idx === displayEntries.length - 1;

            return (
              <div
                key={entry.id}
                className={`text-xs p-2 bg-gray-800/80 rounded-lg border-l-3 transition-all duration-300 ${colorClass} ${
                  isNew ? 'animate-slide-in ring-1 ring-white/10' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {showCardImage && card ? (
                    <img
                      src={getCardImageUrl(card.inscriptionId)}
                      alt={card.name}
                      className="w-7 h-7 object-contain rounded border border-gray-600 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-sm flex-shrink-0 w-7 text-center">{getTypeIcon(entry.type)}</span>
                  )}
                  <span className={`flex-1 leading-relaxed ${colorClass.split(' ')[0]}`}>
                    {translateLogMessage(entry.message, language)}
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
