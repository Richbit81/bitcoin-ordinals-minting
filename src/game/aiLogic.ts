/**
 * AI Logic
 * Heuristic-based AI that uses the game engine for proper effect resolution.
 * All card plays go through playCard() so onPlay/onDeath/etc. effects fire correctly.
 */

import { GameState, BoardAnimal, playCard, canPlayCard } from './gameEngine';
import { GameCard, getGameCardById, STATUS_CATEGORIES } from './gameCards';
import { resolvePendingEffects } from './effectResolver';

const autoResolvePendingAction = (state: GameState): GameState => {
  if (!state.pendingAction) return state;

  if (state.pendingAction.type === 'look_hand') {
    const targetPlayer = state.players[state.pendingAction.playerIndex];
    if (targetPlayer.hand.length > 0) {
      const bestCard = targetPlayer.hand.reduce((best, c) => {
        const bestVal = (best.atk || 0) + (best.hp || 0) + best.effects.length * 2;
        const curVal = (c.atk || 0) + (c.hp || 0) + c.effects.length * 2;
        return curVal > bestVal ? c : best;
      });
      const idx = targetPlayer.hand.findIndex(c => c.id === bestCard.id);
      if (idx !== -1) {
        const discarded = targetPlayer.hand.splice(idx, 1)[0];
        targetPlayer.discard.push(discarded);
        state.effectLog.push({
          id: `log-${Date.now()}-${Math.random()}`,
          message: `AI verwirft ${discarded.name} aus Gegner-Hand`,
          timestamp: Date.now(),
          type: 'effect',
        });
      }
    }
    state.pendingAction = undefined;
  }

  if (state.pendingAction?.type === 'copy_effect') {
    const allDiscard = [...state.players[0].discard, ...state.players[1].discard];
    const actionCards = allDiscard.filter(c => c.type === 'action');
    if (actionCards.length > 0) {
      const damageAction = actionCards.find(c => c.effects.some(e => e.action === 'deal_damage'));
      const picked = damageAction || actionCards[0];
      const aiIndex = state.currentPlayer;
      for (const eff of picked.effects.filter(e => e.trigger === 'onPlay')) {
        const target = chooseTargetForEffect(state, eff);
        state.pendingEffects.push({
          effect: eff,
          source: picked.id,
          target,
          player: aiIndex,
        });
      }
      state.effectLog.push({
        id: `log-${Date.now()}-${Math.random()}`,
        message: `AI kopiert Effekt von ${picked.name}`,
        timestamp: Date.now(),
        type: 'effect',
      });
      state = resolvePendingEffects(state);
    }
    state.pendingAction = undefined;
  }

  return { ...state };
};

const chooseTargetForEffect = (state: GameState, effect: { action: string; target?: string; value?: number; filter?: any }): string | undefined => {
  const aiIndex = state.currentPlayer;
  const aiPlayer = state.players[aiIndex];
  const humanPlayer = state.players[1 - aiIndex];

  if (!effect.target) return undefined;

  switch (effect.target) {
    case 'any': {
      if (effect.action === 'deal_damage') {
        if (humanPlayer.board.length > 0) {
          const killable = humanPlayer.board.find(a => a.currentHp <= (effect.value || 0));
          if (killable) return killable.id;
        }
        return `player-${1 - aiIndex}`;
      }
      if (effect.action === 'destroy_target') {
        const valid = humanPlayer.board.filter(a => {
          if (effect.filter?.atkMax !== undefined) return a.currentAtk <= effect.filter.atkMax;
          return true;
        });
        if (valid.length > 0) {
          return valid.reduce((best, c) =>
            (c.currentAtk + c.currentHp) > (best.currentAtk + best.currentHp) ? c : best
          ).id;
        }
        return undefined;
      }
      if (effect.action === 'modify_attack' && (effect.value || 0) > 0) {
        if (aiPlayer.board.length > 0) {
          return aiPlayer.board.reduce((best, c) => c.currentAtk > best.currentAtk ? c : best).id;
        }
        return undefined;
      }
      if (effect.action === 'force_attack') {
        const attackable = aiPlayer.board.filter(a => a.currentAtk > 0);
        if (attackable.length > 0) {
          return attackable.reduce((best, c) => c.currentAtk > best.currentAtk ? c : best).id;
        }
        return undefined;
      }
      if (effect.action === 'trigger_ability') {
        const withAbility = aiPlayer.board.filter(a =>
          a.card.effects.some(e => e.trigger === 'onPlay' || e.trigger === 'onAttack')
        );
        if (withAbility.length > 0) return withAbility[0].id;
        return undefined;
      }
      if (effect.action === 'swap_control') {
        if (humanPlayer.board.length > 0 && aiPlayer.board.length > 0) {
          return humanPlayer.board.reduce((best, c) =>
            (c.currentAtk + c.currentHp) > (best.currentAtk + best.currentHp) ? c : best
          ).id;
        }
        return undefined;
      }
      if (effect.action === 'freeze_animal') {
        if (humanPlayer.board.length > 0) {
          return humanPlayer.board.reduce((best, c) => c.currentAtk > best.currentAtk ? c : best).id;
        }
        return undefined;
      }
      if (humanPlayer.board.length > 0) return humanPlayer.board[0].id;
      return `player-${1 - aiIndex}`;
    }
    case 'enemy_animal': {
      if (humanPlayer.board.length > 0) {
        return humanPlayer.board.reduce((best, c) => c.currentAtk > best.currentAtk ? c : best).id;
      }
      return undefined;
    }
    case 'friendly_animal':
    case 'friendly_animals_except_self': {
      if (aiPlayer.board.length > 0) {
        return aiPlayer.board.reduce((best, c) => c.currentAtk > best.currentAtk ? c : best).id;
      }
      return undefined;
    }
    default:
      return undefined;
  }
};

const chooseTarget = (state: GameState, card: GameCard): string | undefined => {
  for (const effect of card.effects) {
    const t = chooseTargetForEffect(state, effect);
    if (t) return t;
  }
  return undefined;
};

/**
 * AI decision for Main Phase.
 * Uses playCard() so all onPlay/onDeath effects fire properly.
 */
export const makeAIMove = (state: GameState): GameState | null => {
  if (state.mode !== 'pve' || state.currentPlayer !== 1 || state.phase !== 'main') {
    return null;
  }

  const aiPlayer = state.players[1];
  const humanPlayer = state.players[0];

  // 1. Play an animal (highest combined ATK+HP)
  if (aiPlayer.animalsPlayedThisTurn < 1 && aiPlayer.board.length < 5) {
    const animals = aiPlayer.hand.filter(c => c.type === 'animal' && canPlayCard(state, 1, c));
    if (animals.length > 0) {
      const bestAnimal = animals.reduce((best, current) => {
        const bestValue = (best.atk || 0) + (best.hp || 0);
        const currentValue = (current.atk || 0) + (current.hp || 0);
        return currentValue > bestValue ? current : best;
      });
      const result = playCard(state, 1, bestAnimal.id);
      if (result !== state) return autoResolvePendingAction(result);
    }
  }

  // 2. Play action cards (damage-dealing first)
  const actions = aiPlayer.hand.filter(c => c.type === 'action' && canPlayCard(state, 1, c));
  const sortedActions = [...actions].sort((a, b) => {
    const aScore = a.effects.some(e => e.action === 'deal_damage') ? 2
      : a.effects.some(e => e.action === 'destroy_target') ? 1 : 0;
    const bScore = b.effects.some(e => e.action === 'deal_damage') ? 2
      : b.effects.some(e => e.action === 'destroy_target') ? 1 : 0;
    return bScore - aScore;
  });

  for (const action of sortedActions) {
    const target = chooseTarget(state, action);
    const result = playCard(state, 1, action.id, target);
    if (result !== state) return autoResolvePendingAction(result);
  }

  // 3. Play status cards on appropriate targets
  const statuses = aiPlayer.hand.filter(c => c.type === 'status' && canPlayCard(state, 1, c));
  for (const status of statuses) {
    const isNegative = STATUS_CATEGORIES.negative.includes(status.name);
    const isPositive = STATUS_CATEGORIES.positive.includes(status.name);

    let target: string | undefined;
    if (isNegative && humanPlayer.board.length > 0) {
      target = humanPlayer.board.reduce((best, c) =>
        c.currentAtk > best.currentAtk ? c : best
      ).id;
    } else if (isPositive && aiPlayer.board.length > 0) {
      target = aiPlayer.board.reduce((best, c) =>
        c.currentAtk > best.currentAtk ? c : best
      ).id;
    } else if (!isNegative && !isPositive && humanPlayer.board.length > 0) {
      target = humanPlayer.board[0].id;
    }

    if (target) {
      const result = playCard(state, 1, status.id, target);
      if (result !== state) return autoResolvePendingAction(result);
    }
  }

  return null;
};
