/**
 * Effect Resolver
 * Resolves all card effects deterministically.
 * Consolidated damage pipeline: TARGET (2x) → damage_modifier (Turtle/Sheep) → SHIELD (prevent)
 */

import { GameState, BoardAnimal, PlayerState, addEffectLog } from './gameEngine';
import { EffectDefinition, GameCard, getGameCardById, getGameCardByName, STATUS_CATEGORIES } from './gameCards';

const canAnimalAttackNow = (animal: BoardAnimal): boolean => {
  if (animal.attacksThisTurn >= animal.maxAttacks) return false;

  const hasStuck = animal.statuses.some((sid) => getGameCardById(sid)?.name === 'STUCK');
  if (hasStuck) {
    const hasImmunity = animal.card.effects.some((e) =>
      e.action === 'status_immunity' &&
      (e.filter?.statusName === 'STUCK' || e.filter?.statusTag === 'negative')
    );
    if (!hasImmunity) return false;
  }

  if (animal.card.effects.some((e) => e.action === 'prevent_attack' && e.target === 'self')) {
    return false;
  }

  return true;
};

const randomFrom = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Consolidated damage pipeline for animals.
 * Order: TARGET (double) → damage_modifier (Turtle self, Sheep friendly) → SHIELD (prevent)
 */
const applyDamageToAnimal = (
  state: GameState,
  animal: BoardAnimal,
  baseDamage: number,
): number => {
  let damage = baseDamage;

  // TARGET status: double damage
  const hasTarget = animal.statuses.some(sid => getGameCardById(sid)?.name === 'TARGET');
  if (hasTarget) {
    damage *= 2;
  }

  // damage_modifier from own card (Turtle: -1 to self)
  const selfMod = animal.card.effects
    .filter(e => e.action === 'damage_modifier' && e.target === 'self')
    .reduce((sum, e) => sum + (e.value || 0), 0);
  damage += selfMod;

  // damage_modifier from friendly animals (Sheep: -1 to friendly_animals_except_self)
  const ownerBoard = state.players[animal.owner].board;
  for (const other of ownerBoard) {
    if (other.id === animal.id) continue;
    const friendlyMod = other.card.effects
      .filter(e => e.action === 'damage_modifier' && e.target === 'friendly_animals_except_self')
      .reduce((sum, e) => sum + (e.value || 0), 0);
    damage += friendlyMod;
  }

  damage = Math.max(0, damage);

  // SHIELD: prevent next damage, then discard
  if (damage > 0) {
    const shieldIndex = animal.statuses.findIndex(sid => getGameCardById(sid)?.name === 'SHIELD');
    if (shieldIndex !== -1) {
      const shieldId = animal.statuses[shieldIndex];
      animal.statuses.splice(shieldIndex, 1);
      const shieldCard = getGameCardById(shieldId);
      if (shieldCard) {
        state.players[animal.owner].discard.push(shieldCard);
      }
      state = addEffectLog(state, `SHIELD schützt ${animal.card.name}!`, 'effect');
      damage = 0;
    }
  }

  animal.currentHp -= damage;
  return damage;
};

/**
 * Checks if an animal has target_immunity against the source card type.
 */
const hasTargetImmunity = (animal: BoardAnimal, sourceCardId: string): boolean => {
  const sourceCard = getGameCardById(sourceCardId);
  if (!sourceCard) return false;

  return animal.card.effects.some(e =>
    e.action === 'target_immunity' &&
    e.filter?.cardType === sourceCard.type
  );
};

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

  // Check target_immunity (e.g. Koala immune to action cards)
  if (targetId) {
    const targetAnimal = player.board.find(a => a.id === targetId) ||
                         opponent.board.find(a => a.id === targetId);
    if (targetAnimal && hasTargetImmunity(targetAnimal, source)) {
      newState.effectLog.push({
        id: `log-${Date.now()}-${Math.random()}`,
        message: `${targetAnimal.card.name} ist immun gegen diesen Effekt!`,
        timestamp: Date.now(),
        type: 'effect',
      });
      return newState;
    }
  }

  switch (effect.action) {
    case 'deal_damage': {
      if (!effect.value) break;
      const dmgVal = effect.value;

      if (effect.target === 'any' && targetId) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          const dealt = applyDamageToAnimal(newState, targetAnimal, dmgVal);
          if (dealt > 0) {
            newState.effectLog.push({
              id: `log-${Date.now()}-${Math.random()}`,
              message: `${targetAnimal.card.name} nimmt ${dealt} Schaden`,
              timestamp: Date.now(),
              type: 'damage',
            });
          }
        } else if (targetId === `player-${playerIndex}` || targetId === 'self') {
          player.life -= dmgVal;
        } else if (targetId === `player-${1 - playerIndex}` || targetId === 'opponent') {
          opponent.life -= dmgVal;
        }
      } else if (effect.target === 'self') {
        // 'self' with targetId pointing to animal → damage the animal (e.g. BLEEDING, Bird self-damage)
        if (targetId) {
          const selfAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
          if (selfAnimal) {
            const dealt = applyDamageToAnimal(newState, selfAnimal, dmgVal);
            if (dealt > 0) {
              newState.effectLog.push({
                id: `log-${Date.now()}-${Math.random()}`,
                message: `${selfAnimal.card.name} nimmt ${dealt} Schaden`,
                timestamp: Date.now(),
                type: 'damage',
              });
            }
          } else {
            player.life -= dmgVal;
          }
        } else {
          player.life -= dmgVal;
        }
      } else if (effect.target === 'opponent') {
        opponent.life -= dmgVal;
      } else if (effect.target === 'player') {
        player.life -= dmgVal;
        opponent.life -= dmgVal;
      } else if (effect.target === 'all_animals') {
        [...player.board, ...opponent.board].forEach(animal => {
          const dealt = applyDamageToAnimal(newState, animal, dmgVal);
          if (dealt > 0) {
            newState.effectLog.push({
              id: `log-${Date.now()}-${Math.random()}`,
              message: `${animal.card.name} nimmt ${dealt} Schaden`,
              timestamp: Date.now(),
              type: 'damage',
            });
          }
        });
      }
      break;
    }

    case 'draw_card': {
      if (!effect.value) break;
      if (effect.target === 'player') {
        // Both players draw
        for (let i = 0; i < effect.value; i++) {
          if (player.canDraw && player.deck.length > 0) {
            player.hand.push(player.deck.shift()!);
          } else if (player.canDraw) {
            player.life -= 1;
          }
          if (opponent.canDraw && opponent.deck.length > 0) {
            opponent.hand.push(opponent.deck.shift()!);
          } else if (opponent.canDraw) {
            opponent.life -= 1;
          }
        }
      } else {
        if (player.canDraw) {
          for (let i = 0; i < effect.value; i++) {
            if (player.deck.length > 0) {
              player.hand.push(player.deck.shift()!);
            } else {
              player.life -= 1;
            }
          }
        }
      }
      break;
    }

    case 'destroy_target': {
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
    }

    case 'modify_attack': {
      if (targetId && effect.value) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          targetAnimal.currentAtk += effect.value;
          if (targetAnimal.currentAtk < 0) targetAnimal.currentAtk = 0;
        }
      } else if (effect.target === 'self' && effect.value) {
        player.board.forEach(animal => {
          animal.currentAtk += effect.value || 0;
          if (animal.currentAtk < 0) animal.currentAtk = 0;
        });
      }
      break;
    }

    case 'modify_hp': {
      if (targetId && effect.value) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          targetAnimal.currentHp += effect.value;
          targetAnimal.maxHp += effect.value;
          if (targetAnimal.currentHp < 0) targetAnimal.currentHp = 0;
          if (targetAnimal.maxHp < 1) targetAnimal.maxHp = 1;
        }
      }
      break;
    }

    case 'gain_life': {
      if (effect.value) {
        player.life += effect.value;
        newState.effectLog.push({
          id: `log-${Date.now()}-${Math.random()}`,
          message: `Spieler ${playerIndex + 1} heilt ${effect.value} Life`,
          timestamp: Date.now(),
          type: 'effect',
        });
      }
      break;
    }

    case 'lose_life': {
      if (effect.value) {
        if (effect.target === 'player') {
          player.life -= effect.value;
          opponent.life -= effect.value;
        } else {
          player.life -= effect.value;
        }
      }
      break;
    }

    case 'attach_status': {
      if (targetId && effect.filter?.statusName) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal) {
          const hasImmunity = targetAnimal.card.effects.some(e =>
            e.action === 'status_immunity' &&
            (e.filter?.statusName === effect.filter!.statusName ||
             (e.filter?.statusTag && STATUS_CATEGORIES[e.filter.statusTag as keyof typeof STATUS_CATEGORIES]?.includes(effect.filter!.statusName!)))
          );

          if (!hasImmunity) {
            const statusCard = getGameCardByName(effect.filter.statusName);
            if (statusCard) {
              targetAnimal.statuses.push(statusCard.id);
            }
          }
        }
      } else if (effect.target === 'enemy_animal' && effect.filter?.statusName) {
        // Auto-target: random enemy animal (for onPlay effects without explicit targetId)
        if (opponent.board.length > 0) {
          const target = randomFrom(opponent.board);
          if (target) {
            const hasImmunity = target.card.effects.some(e =>
              e.action === 'status_immunity' &&
              (e.filter?.statusName === effect.filter!.statusName ||
               (e.filter?.statusTag && STATUS_CATEGORIES[e.filter.statusTag as keyof typeof STATUS_CATEGORIES]?.includes(effect.filter!.statusName!)))
            );
            if (!hasImmunity) {
              const statusCard = getGameCardByName(effect.filter.statusName);
              if (statusCard) {
                target.statuses.push(statusCard.id);
                newState.effectLog.push({
                  id: `log-${Date.now()}-${Math.random()}`,
                  message: `${effect.filter.statusName} an ${target.card.name} angehängt`,
                  timestamp: Date.now(),
                  type: 'status',
                });
              }
            }
          }
        }
      }
      break;
    }

    case 'prevent_attack':
      // Handled in canAnimalAttack checks
      break;

    case 'prevent_draw':
      player.canDraw = false;
      break;

    case 'play_additional_animal':
      player.animalsPlayedThisTurn = Math.max(0, player.animalsPlayedThisTurn - 1);
      break;

    case 'discard_hand': {
      player.discard.push(...player.hand);
      player.hand = [];
      opponent.discard.push(...opponent.hand);
      opponent.hand = [];
      break;
    }

    case 'look_hand':
      newState.pendingAction = {
        type: 'look_hand',
        playerIndex: 1 - playerIndex,
      };
      break;

    case 'discard_card': {
      if (targetId) {
        const targetPlayer = effect.target === 'opponent_hand' ? opponent : player;
        const cardIndex = targetPlayer.hand.findIndex(c => c.id === targetId);
        if (cardIndex !== -1) {
          const discardedCard = targetPlayer.hand.splice(cardIndex, 1)[0];
          targetPlayer.discard.push(discardedCard);
        }
      }
      break;
    }

    case 'cancel_action': {
      const opponentActionCards = opponent.hand.filter((c) => c.type === 'action');
      const actionToDiscard = randomFrom(opponentActionCards);
      if (actionToDiscard) {
        opponent.hand = opponent.hand.filter((c) => c.id !== actionToDiscard.id);
        opponent.discard.push(actionToDiscard);
      }
      break;
    }

    case 'swap_control': {
      if (!targetId) break;
      const selectedAnimal = player.board.find(a => a.id === targetId) || opponent.board.find(a => a.id === targetId);
      if (!selectedAnimal) break;

      const selectedOwner = selectedAnimal.owner;
      const otherOwner = 1 - selectedOwner;
      const selectedOwnerState = newState.players[selectedOwner];
      const otherOwnerState = newState.players[otherOwner];
      const counterpart = randomFrom(otherOwnerState.board);
      if (!counterpart) break;

      selectedOwnerState.board = selectedOwnerState.board.filter(a => a.id !== selectedAnimal.id);
      otherOwnerState.board = otherOwnerState.board.filter(a => a.id !== counterpart.id);

      selectedAnimal.owner = otherOwner;
      counterpart.owner = selectedOwner;

      otherOwnerState.board.push(selectedAnimal);
      selectedOwnerState.board.push(counterpart);
      break;
    }

    case 'trigger_ability': {
      if (!targetId) break;
      const targetAnimal = player.board.find(a => a.id === targetId) || opponent.board.find(a => a.id === targetId);
      if (!targetAnimal) break;

      const repeatable = targetAnimal.card.effects.find((e) =>
        e.trigger === 'onPlay' || e.trigger === 'onAttack' || e.trigger === 'onTurnStart' || e.trigger === 'onAnimalDeath'
      );
      if (repeatable) {
        newState.pendingEffects.push({
          effect: repeatable,
          source: targetAnimal.card.id,
          target: targetAnimal.id,
          player: targetAnimal.owner,
        });
      }
      break;
    }

    case 'force_attack': {
      if (!targetId) break;
      const targetAnimal = player.board.find(a => a.id === targetId) || opponent.board.find(a => a.id === targetId);
      if (!targetAnimal) break;
      if (!canAnimalAttackNow(targetAnimal)) break;

      const defendingPlayer = newState.players[1 - targetAnimal.owner];
      defendingPlayer.life -= targetAnimal.currentAtk;
      targetAnimal.attacksThisTurn += 1;

      const onAttackEffects = targetAnimal.card.effects.filter((e) => e.trigger === 'onAttack');
      for (const attackEffect of onAttackEffects) {
        newState.pendingEffects.push({
          effect: attackEffect,
          source: targetAnimal.card.id,
          target: targetAnimal.id,
          player: targetAnimal.owner,
        });
      }
      break;
    }

    case 'freeze_animal': {
      let targetAnimal = targetId
        ? player.board.find(a => a.id === targetId) || opponent.board.find(a => a.id === targetId)
        : undefined;

      if (!targetAnimal && opponent.board.length > 0) {
        targetAnimal = opponent.board[Math.floor(Math.random() * opponent.board.length)];
      }

      if (targetAnimal) {
        const stuckCard = getGameCardByName('STUCK');
        if (stuckCard && !targetAnimal.statuses.includes(stuckCard.id)) {
          targetAnimal.statuses.push(stuckCard.id);
          newState.effectLog.push({
            id: `log-${Date.now()}-${Math.random()}`,
            message: `${targetAnimal.card.name} wird eingefroren (STUCK)`,
            timestamp: Date.now(),
            type: 'status',
          });
        }
      }
      break;
    }

    case 'return_status': {
      let targetAnimal = targetId
        ? player.board.find(a => a.id === targetId) || opponent.board.find(a => a.id === targetId)
        : undefined;

      if (!targetAnimal) {
        const animalsWithStatus = [...player.board, ...opponent.board].filter(a => a.statuses.length > 0);
        if (animalsWithStatus.length > 0) {
          targetAnimal = animalsWithStatus[Math.floor(Math.random() * animalsWithStatus.length)];
        }
      }

      if (targetAnimal && targetAnimal.statuses.length > 0) {
        const randomIdx = Math.floor(Math.random() * targetAnimal.statuses.length);
        const statusId = targetAnimal.statuses[randomIdx];
        targetAnimal.statuses.splice(randomIdx, 1);
        const statusCard = getGameCardById(statusId);
        if (statusCard) {
          const owner = newState.players[targetAnimal.owner];
          owner.discard.push(statusCard);
          newState.effectLog.push({
            id: `log-${Date.now()}-${Math.random()}`,
            message: `${statusCard.name} wird von ${targetAnimal.card.name} entfernt`,
            timestamp: Date.now(),
            type: 'status',
          });
        }
      }
      break;
    }

    case 'copy_effect': {
      // Fox: copy an action card effect from any discard pile
      newState.pendingAction = {
        type: 'copy_effect',
        playerIndex: playerIndex,
      };
      break;
    }

    case 'destroy_self': {
      // Find the animal owned by playerIndex that has this effect
      const selfAnimal = targetId
        ? player.board.find(a => a.id === targetId)
        : undefined;
      if (selfAnimal) {
        destroyAnimal(newState, selfAnimal, playerIndex);
      }
      break;
    }

    case 'remove_status': {
      if (targetId) {
        const targetAnimal = player.board.find(a => a.id === targetId) ||
                            opponent.board.find(a => a.id === targetId);
        if (targetAnimal && targetAnimal.statuses.length > 0) {
          if (effect.filter?.statusName) {
            const statusCard = getGameCardByName(effect.filter.statusName);
            if (statusCard) {
              const idx = targetAnimal.statuses.indexOf(statusCard.id);
              if (idx !== -1) {
                targetAnimal.statuses.splice(idx, 1);
                newState.players[targetAnimal.owner].discard.push(statusCard);
              }
            }
          } else {
            const removedId = targetAnimal.statuses.pop()!;
            const sc = getGameCardById(removedId);
            if (sc) newState.players[targetAnimal.owner].discard.push(sc);
          }
        }
      }
      break;
    }

    // Static effects handled elsewhere (damage_modifier, double_damage, status_immunity, target_immunity)
    case 'damage_modifier':
    case 'double_damage':
    case 'status_immunity':
    case 'target_immunity':
      break;
  }

  // Check win/lose conditions
  if (player.life <= 0) {
    newState.gameOver = true;
    newState.winner = 1 - playerIndex;
  } else if (opponent.life <= 0) {
    newState.gameOver = true;
    newState.winner = playerIndex;
  }

  return newState;
};

const destroyAnimal = (state: GameState, animal: BoardAnimal, ownerIndex: number): void => {
  const owner = state.players[ownerIndex];

  const onDeathEffects = animal.card.effects.filter(e => e.trigger === 'onDeath');
  for (const effect of onDeathEffects) {
    state.pendingEffects.push({
      effect,
      source: animal.card.id,
      target: animal.id,
      player: ownerIndex,
    });
  }

  animal.statuses.forEach(statusId => {
    const statusCard = getGameCardById(statusId);
    if (statusCard) owner.discard.push(statusCard);
  });

  const index = owner.board.indexOf(animal);
  if (index !== -1) {
    owner.board.splice(index, 1);
    owner.discard.push(animal.card);
  }

  // Trigger onAnimalDeath for all remaining board animals
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

  state.effectLog.push({
    id: `log-${Date.now()}-${Math.random()}`,
    message: `${animal.card.name} wird zerstört`,
    timestamp: Date.now(),
    type: 'destroy',
    cardId: animal.card.id,
  });
};

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

    if (currentState.gameOver) break;
    if (currentState.pendingAction) break;
  }

  return currentState;
};
