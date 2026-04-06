/**
 * AI Logic
 * Einfache Heuristik-basierte AI für Player vs AI Modus
 */

import { GameState, PlayerState, BoardAnimal } from './gameEngine';
import { GameCard, getGameCardById } from './gameCards';

/**
 * AI-Entscheidung für Main Phase
 */
export const makeAIMove = (state: GameState): GameState | null => {
  if (state.mode !== 'pve' || state.currentPlayer !== 1 || state.phase !== 'main') {
    return null;
  }

  const aiPlayer = state.players[1];
  const humanPlayer = state.players[0];
  
  // 1. Spiele ein Tier, wenn möglich
  if (aiPlayer.animalsPlayedThisTurn < 1 && aiPlayer.board.length < 5) {
    const animalCards = aiPlayer.hand.filter(c => c.type === 'animal');
    if (animalCards.length > 0) {
      // Wähle bestes Tier (höchste ATK+HP)
      const bestAnimal = animalCards.reduce((best, current) => {
        const bestValue = (best.atk || 0) + (best.hp || 0);
        const currentValue = (current.atk || 0) + (current.hp || 0);
        return currentValue > bestValue ? current : best;
      });
      
      return {
        ...state,
        players: state.players.map((p, idx) => {
          if (idx === 1) {
            // Spielt Karte
            const cardIndex = p.hand.findIndex(c => c.id === bestAnimal.id);
            if (cardIndex !== -1) {
              const playedCard = p.hand.splice(cardIndex, 1)[0];
              
              if (playedCard.type === 'animal') {
                const boardAnimal: BoardAnimal = {
                  id: `animal-${Date.now()}-${Math.random()}`,
                  cardId: playedCard.id,
                  card: playedCard,
                  currentAtk: playedCard.atk || 0,
                  currentHp: playedCard.hp || 0,
                  maxHp: playedCard.hp || 0,
                  statuses: [],
                  canAttack: true,
                  attacksThisTurn: 0,
                  maxAttacks: playedCard.id === 'card-19' ? 2 : 1,
                  owner: 1,
                  playedThisTurn: true,
                };
                p.board.push(boardAnimal);
                p.animalsPlayedThisTurn++;
              }
            }
            return p;
          }
          return p;
        }),
      };
    }
  }
  
  // 2. Spiele schadende Action-Karten
  const actionCards = aiPlayer.hand.filter(c => c.type === 'action');
  const damageActions = actionCards.filter(c => 
    c.effects.some(e => e.action === 'deal_damage')
  );
  
  if (damageActions.length > 0) {
    const bestAction = damageActions[0]; // Einfach erste nehmen
    return {
      ...state,
      players: state.players.map((p, idx) => {
        if (idx === 1) {
          const cardIndex = p.hand.findIndex(c => c.id === bestAction.id);
          if (cardIndex !== -1) {
            const playedCard = p.hand.splice(cardIndex, 1)[0];
            p.discard.push(playedCard);
          }
          return p;
        }
        return p;
      }),
    };
  }
  
  // 3. Spiele Status-Karten auf bestes Ziel
  const statusCards = aiPlayer.hand.filter(c => c.type === 'status');
  if (statusCards.length > 0) {
    const bestStatus = statusCards[0];
    // Finde bestes Ziel (Gegner-Tier mit höchstem ATK)
    const bestTarget = humanPlayer.board.length > 0
      ? humanPlayer.board.reduce((best, current) => 
          current.currentAtk > best.currentAtk ? current : best
        )
      : null;
    
    if (bestTarget) {
      return {
        ...state,
        players: state.players.map((p, idx) => {
          if (idx === 1) {
            const cardIndex = p.hand.findIndex(c => c.id === bestStatus.id);
            if (cardIndex !== -1) {
              const playedCard = p.hand.splice(cardIndex, 1)[0];
              p.discard.push(playedCard);
              
              // Füge Status zu Ziel hinzu
              const targetAnimal = state.players[0].board.find(a => a.id === bestTarget.id);
              if (targetAnimal) {
                targetAnimal.statuses.push(bestStatus.id);
              }
            }
            return p;
          }
          return p;
        }),
      };
    }
  }
  
  // 4. Beende Main Phase (keine weiteren Züge)
  return null; // Signalisiert: End Main Phase
};


