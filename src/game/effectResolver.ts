/**
 * Effect Resolver
 * Löst alle Effekte deterministisch auf
 */

import { GameState, BoardAnimal, PlayerState } from './gameEngine';
import { EffectDefinition, getGameCardById, STATUS_CATEGORIES } from './gameCards';

/**
 * Löst einen Effekt aus
 */
export const resolveEffect = (
  state: GameState,
  effect: EffectDefinition,
  source: string,
  targetId?: string,
  playerIndex: number = 0
): GameState => {
  const newState = { ...state };
  const player = newState.players[playerIndex];
  const opponent = newState.players[1 - playerIndex];

  switch (effect.action) {
    case 'deal_damage':
      if (effect.value && effect.target) {
        if (effect.target === 'any' && targetId) {
          // Finde Ziel
          const targetAnimal = player.board.find(a => a.id === targetId) ||
                              opponent.board.find(a => a.id === targetId);
          if (targetAnimal) {
            targetAnimal.currentHp -= effect.value;
          } else if (targetId === `player-${playerIndex}`) {
            player.life -= effect.value;
          } else if (targetId === `player-${1 - playerIndex}`) {
            opponent.life -= effect.value;
          }
        } else if (effect.target === 'opponent') {
          opponent.life -= effect.value || 0;
        } else if (effect.target === 'self') {
          player.life -= effect.value || 0;
        } else if (effect.target === 'player') {
          // Both players
          player.life -= effect.value || 0;
          opponent.life -= effect.value || 0;
        } else if (effect.target === 'all_animals') {
          [...player.board, ...opponent.board].forEach(animal => {
            animal.currentHp -= effect.value || 0;
          });
        }
      }
      break;

    case 'draw_card':
      if (effect.value && player.canDraw) {
        for (let i = 0; i < effect.value; i++) {
          if (player.deck.length > 0) {
            const card = player.deck.shift()!;
            player.hand.push(card);
          } else {
            player.life -= 1;
          }
        }
      }
      break;

    case 'destroy_target':
      if (effect.target === 'random_animal' || effect.target === 'random_enemy_animal') {
        const targetAnimals = effect.target === 'random_enemy_animal' 
          ? opponent.board 
          : [...player.board, ...opponent.board];
        
        if (targetAnimals.length > 0) {
          const randomAnimal = targetAnimals[Math.floor(Math.random() * targetAnimals.length)];
          destroyAnimal(newState, randomAnimal, randomAnimal.owner);
        }
      } else if (targetId) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          // Prüfe Filter (z.B. ATK <= 2)
          if (effect.filter?.atkMax !== undefined) {
            if (targetAnimal.currentAtk <= effect.filter.atkMax) {
              destroyAnimal(newState, targetAnimal, targetAnimal.owner);
            }
          } else {
            destroyAnimal(newState, targetAnimal, targetAnimal.owner);
          }
        }
      }
      break;

    case 'modify_attack':
      if (targetId && effect.value) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          targetAnimal.currentAtk += effect.value;
          if (targetAnimal.currentAtk < 0) targetAnimal.currentAtk = 0;
        }
      } else if (effect.target === 'self' && effect.value) {
        // Finde alle Tiere des Spielers
        player.board.forEach(animal => {
          animal.currentAtk += effect.value || 0;
          if (animal.currentAtk < 0) animal.currentAtk = 0;
        });
      }
      break;

    case 'gain_life':
      if (effect.value) {
        player.life += effect.value;
      }
      break;

    case 'lose_life':
      if (effect.value) {
        if (effect.target === 'player') {
          // Both players
          player.life -= effect.value;
          opponent.life -= effect.value;
        } else {
          player.life -= effect.value;
        }
      }
      break;

    case 'attach_status':
      if (targetId && effect.filter?.statusName) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          // Prüfe Immunität
          const hasImmunity = targetAnimal.card.effects.some(e => 
            e.action === 'status_immunity' && 
            (e.filter?.statusName === effect.filter.statusName ||
             (e.filter?.statusTag && STATUS_CATEGORIES[e.filter.statusTag as keyof typeof STATUS_CATEGORIES]?.includes(effect.filter.statusName!)))
          );
          
          if (!hasImmunity) {
            targetAnimal.statuses.push(effect.filter.statusName);
          }
        }
      }
      break;

    case 'prevent_attack':
      // Wird in canAnimalAttack geprüft
      break;

    case 'prevent_draw':
      player.canDraw = false;
      break;

    case 'play_additional_animal':
      // Erlaubt zusätzliches Tier in diesem Turn
      player.animalsPlayedThisTurn = Math.max(0, player.animalsPlayedThisTurn - 1);
      break;

    case 'discard_hand':
      // Beide Spieler werfen Hand ab
      player.discard.push(...player.hand);
      player.hand = [];
      opponent.discard.push(...opponent.hand);
      opponent.hand = [];
      break;

    // Weitere Effekte...
  }

  // Prüfe ob Spieler verloren hat
  if (player.life <= 0) {
    newState.gameOver = true;
    newState.winner = 1 - playerIndex;
  } else if (opponent.life <= 0) {
    newState.gameOver = true;
    newState.winner = playerIndex;
  }

  return newState;
};

/**
 * Zerstört ein Tier
 */
const destroyAnimal = (state: GameState, animal: BoardAnimal, ownerIndex: number): void => {
  const owner = state.players[ownerIndex];
  
  // Trigger "onDeath" Effekte
  const onDeathEffects = animal.card.effects.filter(e => e.trigger === 'onDeath');
  for (const effect of onDeathEffects) {
    state.pendingEffects.push({
      effect,
      source: animal.card.id,
      target: animal.id,
      player: ownerIndex,
    });
  }

  // Entferne Status-Karten
  animal.statuses.forEach(statusId => {
    const statusCard = getGameCardById(statusId);
    if (statusCard) {
      owner.discard.push(statusCard);
    }
  });

  // Entferne Tier vom Board
  const index = owner.board.indexOf(animal);
  if (index !== -1) {
    owner.board.splice(index, 1);
    owner.discard.push(animal.card);
  }

  // Trigger "onAnimalDeath" Effekte für andere Tiere
  [...state.players[0].board, ...state.players[1].board].forEach(otherAnimal => {
    const onAnimalDeathEffects = otherAnimal.card.effects.filter(e => e.trigger === 'onAnimalDeath');
    for (const effect of onAnimalDeathEffects) {
      state.pendingEffects.push({
        effect,
        source: otherAnimal.card.id,
        target: otherAnimal.id,
        player: otherAnimal.owner,
      });
    }
  });
};

/**
 * Löst alle pending Effects auf
 */
export const resolvePendingEffects = (state: GameState): GameState => {
  let currentState = { ...state };
  
  while (currentState.pendingEffects.length > 0) {
    const effectData = currentState.pendingEffects.shift()!;
    currentState = resolveEffect(
      currentState,
      effectData.effect,
      effectData.source,
      effectData.target,
      effectData.player
    );
    
    if (currentState.gameOver) {
      break;
    }
  }
  
  return currentState;
};


