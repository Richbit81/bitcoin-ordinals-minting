import React from 'react';
import { GameState, BoardAnimal } from '../game/gameEngine';
import { GameCard } from '../game/gameCards';

interface TargetSelectionModalProps {
  card: GameCard;
  gameState: GameState;
  onSelectTarget: (target: string | null) => void;
  onCancel: () => void;
}

export const TargetSelectionModal: React.FC<TargetSelectionModalProps> = ({
  card,
  gameState,
  onSelectTarget,
  onCancel,
}) => {
  const currentPlayer = gameState.players[0];
  const opponent = gameState.players[1];

  // Bestimme gültige Ziele basierend auf Karten-Effekten
  const getValidTargets = (): Array<{ id: string; label: string; type: 'animal' | 'player' }> => {
    const targets: Array<{ id: string; label: string; type: 'animal' | 'player' }> = [];
    
    // Prüfe alle Effekte der Karte
    for (const effect of card.effects) {
      if (!effect.target || effect.target === 'self') continue;

      switch (effect.target) {
        case 'any':
        case 'enemy_animal':
          // Gegner-Tiere
          opponent.board.forEach(animal => {
            if (!targets.find(t => t.id === animal.id)) {
              targets.push({
                id: animal.id,
                label: `${animal.card.name} (${animal.currentAtk}/${animal.currentHp})`,
                type: 'animal',
              });
            }
          });
          break;
        
        case 'friendly_animal':
        case 'friendly_animals_except_self':
          // Eigene Tiere
          currentPlayer.board.forEach(animal => {
            if (!targets.find(t => t.id === animal.id)) {
              targets.push({
                id: animal.id,
                label: `${animal.card.name} (${animal.currentAtk}/${animal.currentHp})`,
                type: 'animal',
              });
            }
          });
          break;
        
        case 'all_animals':
          // Alle Tiere
          [...currentPlayer.board, ...opponent.board].forEach(animal => {
            if (!targets.find(t => t.id === animal.id)) {
              targets.push({
                id: animal.id,
                label: `${animal.card.name} (${animal.currentAtk}/${animal.currentHp})`,
                type: 'animal',
              });
            }
          });
          break;
        
        case 'opponent':
        case 'player':
          // Gegner-Spieler
          if (!targets.find(t => t.id === 'opponent')) {
            targets.push({
              id: 'opponent',
              label: `Gegner (Life: ${opponent.life})`,
              type: 'player',
            });
          }
          break;
      }
    }

    // Spezielle Fälle für bestimmte Karten
    if (card.name === 'SWITCH') {
      // SWITCH: Zwei Tiere auswählen
      [...currentPlayer.board, ...opponent.board].forEach(animal => {
        if (!targets.find(t => t.id === animal.id)) {
          targets.push({
            id: animal.id,
            label: `${animal.card.name} (${animal.currentAtk}/${animal.currentHp})`,
            type: 'animal',
          });
        }
      });
    }

    return targets;
  };

  const validTargets = getValidTargets();

  // Wenn keine Ziele benötigt werden oder keine gültigen Ziele vorhanden
  const needsTarget = card.effects.some(e => e.target && e.target !== 'self');
  const hasNoValidTargets = needsTarget && validTargets.length === 0;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border-2 border-red-600 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Ziel auswählen</h2>
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
          <div className="bg-gray-800 rounded p-3 mb-3">
            <div className="text-sm font-semibold text-white mb-1">{card.name}</div>
            <div className="text-xs text-gray-300">{card.effectText}</div>
          </div>
        </div>

        {hasNoValidTargets ? (
          <div className="text-center py-8">
            <p className="text-yellow-400 mb-4">⚠️ Keine gültigen Ziele verfügbar</p>
            <p className="text-sm text-gray-400 mb-4">
              Diese Karte kann trotzdem gespielt werden, hat aber keinen Effekt.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => onSelectTarget(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                Trotzdem spielen
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : validTargets.length === 0 ? (
          // Karte benötigt kein Ziel
          <div className="text-center py-8">
            <p className="text-gray-300 mb-4">Diese Karte benötigt kein Ziel.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => onSelectTarget(null)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
              >
                Karte spielen
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">Wähle ein Ziel:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {validTargets.map(target => (
                  <button
                    key={target.id}
                    onClick={() => onSelectTarget(target.id)}
                    className="w-full text-left bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-red-500 rounded-lg p-3 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold">{target.label}</span>
                      <span className="text-xs text-gray-400">
                        {target.type === 'animal' ? '🐾' : '👤'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
