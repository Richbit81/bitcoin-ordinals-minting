/**
 * Game Engine
 * Deterministic, turn-based card game engine
 * Strict phase system with automatic effect resolution
 */

import { GameCard, EffectDefinition, ALL_GAME_CARDS, getGameCardById, getGameCardByName, STATUS_CATEGORIES } from './gameCards';
import { resolvePendingEffects } from './effectResolver';
import { WalletCard } from '../services/gallery';

export type GamePhase = 'draw' | 'main' | 'attack' | 'end';
export type GameMode = 'pvp' | 'pve';

export interface BoardAnimal {
  id: string;
  cardId: string;
  card: GameCard;
  currentAtk: number;
  currentHp: number;
  maxHp: number;
  statuses: string[];
  canAttack: boolean;
  attacksThisTurn: number;
  maxAttacks: number;
  owner: number;
  playedThisTurn: boolean;
}

export interface PlayerState {
  index: number;
  life: number;
  deck: GameCard[];
  hand: GameCard[];
  board: BoardAnimal[];
  discard: GameCard[];
  statuses: string[];
  canDraw: boolean;
  animalsPlayedThisTurn: number;
}

export interface EffectLogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'play' | 'attack' | 'damage' | 'draw' | 'destroy' | 'status' | 'effect' | 'phase';
  cardId?: string;
}

export interface GameState {
  currentPlayer: number;
  phase: GamePhase;
  mode: GameMode;
  players: PlayerState[];
  turnNumber: number;
  pendingEffects: Array<{
    effect: EffectDefinition;
    source: string;
    target?: string;
    player: number;
  }>;
  effectLog: EffectLogEntry[];
  pendingAction?: {
    type: 'look_hand' | 'discard_card' | 'copy_effect';
    playerIndex: number;
    cardId?: string;
  };
  gameOver: boolean;
  winner: number | null;
}

const UNSUPPORTED_EFFECT_ACTIONS = new Set<string>([
  // copy_effect is now supported
]);

const PLAYER_TARGET_RE = /^player-(0|1)$/;

const hasUnsupportedEffect = (card: GameCard): boolean => {
  return card.effects.some(effect => UNSUPPORTED_EFFECT_ACTIONS.has(effect.action));
};

export const getCardPlayabilityReason = (
  state: GameState,
  playerIndex: number,
  card: GameCard
): string | null => {
  const player = state.players[playerIndex];

  if (playerIndex !== state.currentPlayer) {
    return 'Not your turn';
  }
  if (state.phase !== 'main') {
    return `Only in MAIN phase (now: ${state.phase.toUpperCase()})`;
  }
  if (hasUnsupportedEffect(card)) {
    return 'This card is temporarily disabled (rule set update)';
  }

  if (card.type === 'animal') {
    if (player.animalsPlayedThisTurn >= 1) {
      return 'Already played 1 animal this turn';
    }
    if (player.board.length >= 5) {
      return 'Board full (max. 5 animals)';
    }
  }

  return null;
};

export const createGameState = (
  player1Deck: GameCard[],
  player2Deck: GameCard[],
  mode: GameMode = 'pvp'
): GameState => {
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const shuffledDeck1 = shuffle(player1Deck);
  const shuffledDeck2 = shuffle(player2Deck);

  const hand1 = shuffledDeck1.splice(0, 5);
  const hand2 = shuffledDeck2.splice(0, 5);

  const startingPlayer = Math.random() < 0.5 ? 0 : 1;

  return {
    currentPlayer: startingPlayer,
    phase: 'draw',
    mode,
    players: [
      {
        index: 0,
        life: 20,
        deck: shuffledDeck1,
        hand: hand1,
        board: [],
        discard: [],
        statuses: [],
        canDraw: true,
        animalsPlayedThisTurn: 0,
      },
      {
        index: 1,
        life: 20,
        deck: shuffledDeck2,
        hand: hand2,
        board: [],
        discard: [],
        statuses: [],
        canDraw: true,
        animalsPlayedThisTurn: 0,
      },
    ],
    turnNumber: 1,
    pendingEffects: [],
    effectLog: [],
    gameOver: false,
    winner: null,
  };
};

export const addEffectLog = (
  state: GameState,
  message: string,
  type: EffectLogEntry['type'],
  cardId?: string
): GameState => {
  return {
    ...state,
    effectLog: [
      ...state.effectLog,
      {
        id: `log-${Date.now()}-${Math.random()}`,
        message,
        timestamp: Date.now(),
        type,
        cardId,
      },
    ],
  };
};

export const drawCard = (state: GameState, playerIndex: number, count: number = 1): GameState => {
  const player = state.players[playerIndex];

  if (!player.canDraw) {
    return addEffectLog(state, `Spieler ${playerIndex + 1} kann keine Karte ziehen (PARANOIA)`, 'effect');
  }

  let currentDeck = [...player.deck];
  let currentHand = [...player.hand];
  let currentLife = player.life;
  let drawnCards: GameCard[] = [];

  for (let i = 0; i < count; i++) {
    if (currentDeck.length > 0) {
      const drawnCard = currentDeck[0];
      currentDeck = currentDeck.slice(1);
      currentHand = [...currentHand, drawnCard];
      drawnCards.push(drawnCard);
    } else {
      currentLife -= 1;
      if (currentLife <= 0) {
        const newState = {
          ...state,
          players: state.players.map((p, idx) => idx === playerIndex ? {
            ...p,
            deck: currentDeck,
            hand: currentHand,
            life: currentLife,
          } : p),
        };
        return {
          ...addEffectLog(newState, `Spieler ${playerIndex + 1} kann keine Karte ziehen → verliert 1 Life`, 'damage'),
          gameOver: true,
          winner: 1 - playerIndex,
        };
      }
    }
  }

  let newState = {
    ...state,
    players: state.players.map((p, idx) => idx === playerIndex ? {
      ...p,
      deck: currentDeck,
      hand: currentHand,
      life: currentLife,
    } : p),
  };

  for (const card of drawnCards) {
    newState = addEffectLog(newState, `Spieler ${playerIndex + 1} zieht ${card.name}`, 'draw', card.id);
  }
  if (drawnCards.length === 0 && count > 0) {
    newState = addEffectLog(newState, `Spieler ${playerIndex + 1} kann keine Karte ziehen → verliert 1 Life`, 'damage');
  }

  return newState;
};

export const canPlayCard = (
  state: GameState,
  playerIndex: number,
  card: GameCard,
  target?: string
): boolean => {
  const reason = getCardPlayabilityReason(state, playerIndex, card);
  if (reason) return false;

  if (target && target.startsWith('player-') && !PLAYER_TARGET_RE.test(target)) {
    return false;
  }

  return true;
};

export const playCard = (
  state: GameState,
  playerIndex: number,
  cardId: string,
  target?: string
): GameState => {
  const player = state.players[playerIndex];
  const card = getGameCardById(cardId);

  if (!card || !canPlayCard(state, playerIndex, card, target)) {
    return state;
  }

  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return state;

  const playedCard = player.hand.splice(cardIndex, 1)[0];

  if (card.type === 'animal') {
    let baseAtk = card.atk || 0;

    const boardAnimal: BoardAnimal = {
      id: `animal-${Date.now()}-${Math.random()}`,
      cardId: card.id,
      card: card,
      currentAtk: baseAtk,
      currentHp: card.hp || 0,
      maxHp: card.hp || 0,
      statuses: [],
      canAttack: true,
      attacksThisTurn: 0,
      maxAttacks: 1,
      owner: playerIndex,
      playedThisTurn: true,
    };

    if (card.id === 'card-19') {
      boardAnimal.maxAttacks = 2;
    }

    player.board.push(boardAnimal);
    player.animalsPlayedThisTurn++;

    applyStatusEffectsToAnimal(boardAnimal, player.board);

    state = addEffectLog(state, `Spieler ${playerIndex + 1} spielt ${card.name}`, 'play', card.id);

    const onPlayEffects = card.effects.filter(e => e.trigger === 'onPlay');
    for (const effect of onPlayEffects) {
      state.pendingEffects.push({
        effect,
        source: card.id,
        target: boardAnimal.id,
        player: playerIndex,
      });
    }

    state = resolvePendingEffects(state);
  } else if (card.type === 'action') {
    state = addEffectLog(state, `Spieler ${playerIndex + 1} spielt ${card.name}`, 'play', card.id);

    const onPlayEffects = card.effects.filter(e => e.trigger === 'onPlay');
    for (const effect of onPlayEffects) {
      state.pendingEffects.push({
        effect,
        source: card.id,
        target,
        player: playerIndex,
      });
    }

    state = resolvePendingEffects(state);

    player.discard.push(playedCard);
  } else if (card.type === 'status') {
    state = addEffectLog(state, `Spieler ${playerIndex + 1} spielt ${card.name}`, 'status', card.id);

    if (target) {
      const targetAnimal = player.board.find(a => a.id === target) ||
                           state.players[1 - playerIndex].board.find(a => a.id === target);

      if (targetAnimal) {
        targetAnimal.statuses.push(card.id);
        state = addEffectLog(state, `${card.name} wird an ${targetAnimal.card.name} angehängt`, 'status');
        applyStatusEffectsToAnimal(targetAnimal, state.players[targetAnimal.owner].board);
      } else {
        const targetPlayer = PLAYER_TARGET_RE.test(target)
          ? state.players[Number(target.split('-')[1])]
          : undefined;
        if (targetPlayer) {
          targetPlayer.statuses.push(card.id);
          state = addEffectLog(state, `${card.name} wird an Spieler ${targetPlayer.index + 1} angehängt`, 'status');
        }
      }
    }

    player.discard.push(playedCard);
  }

  return { ...state };
};

export const nextPhase = (state: GameState): GameState => {
  let newState = { ...state };

  switch (state.phase) {
    case 'draw': {
      // --- onTurnStart effects ---
      newState = resolveTurnStartEffects(newState);
      if (newState.gameOver) return newState;

      newState = drawCard(newState, state.currentPlayer);
      newState = { ...newState, phase: 'main' };
      newState = addEffectLog(newState, `Phase: MAIN (Spieler ${state.currentPlayer + 1})`, 'phase');
      break;
    }

    case 'main':
      newState.phase = 'attack';
      newState = addEffectLog(newState, `Phase: ATTACK (Spieler ${state.currentPlayer + 1})`, 'phase');
      break;

    case 'attack': {
      const currentPlayerState = newState.players[state.currentPlayer];
      const opponentState = newState.players[1 - state.currentPlayer];

      // Iterate animals; inner while allows Cat (maxAttacks=2) to attack twice
      const boardSnapshot = [...currentPlayerState.board];
      for (const animal of boardSnapshot) {
        while (!newState.gameOver) {
          if (!currentPlayerState.board.includes(animal)) break;
          if (!canAnimalAttack(newState, animal)) break;

          const damage = animal.currentAtk;
          opponentState.life -= damage;
          animal.attacksThisTurn++;

          newState = addEffectLog(newState, `${animal.card.name} greift an → ${damage} Schaden`, 'attack', animal.card.id);
          if (damage > 0) {
            newState = addEffectLog(newState, `Spieler ${(1 - state.currentPlayer) + 1} verliert ${damage} Life (${opponentState.life + damage} → ${opponentState.life})`, 'damage');
          }

          const onAttackEffects = animal.card.effects.filter(e => e.trigger === 'onAttack');
          for (const effect of onAttackEffects) {
            newState.pendingEffects.push({
              effect,
              source: animal.card.id,
              target: animal.id,
              player: state.currentPlayer,
            });
          }

          newState = resolvePendingEffects(newState);

          if (opponentState.life <= 0) {
            newState.gameOver = true;
            newState.winner = state.currentPlayer;
            return newState;
          }
        }
        if (newState.gameOver) return newState;
      }

      newState.phase = 'end';
      newState = addEffectLog(newState, `Phase: END (Spieler ${state.currentPlayer + 1})`, 'phase');
      break;
    }

    case 'end': {
      resolveEndPhase(newState);

      const player = newState.players[state.currentPlayer];
      player.animalsPlayedThisTurn = 0;
      player.board.forEach(animal => {
        animal.attacksThisTurn = 0;
        animal.playedThisTurn = false;
      });

      newState.currentPlayer = 1 - state.currentPlayer;
      newState.turnNumber++;
      newState.phase = 'draw';
      newState = addEffectLog(newState, `Turn ${newState.turnNumber} beginnt`, 'phase');
      break;
    }
  }

  return newState;
};

/**
 * Resolves onTurnStart effects at the beginning of the current player's turn.
 * Handles: BLEEDING damage, Cow gain_life, Octopus prevent_attack, etc.
 */
const resolveTurnStartEffects = (state: GameState): GameState => {
  const player = state.players[state.currentPlayer];

  for (const animal of [...player.board]) {
    // Status card onTurnStart effects (e.g. BLEEDING)
    for (const statusId of [...animal.statuses]) {
      const statusCard = getGameCardById(statusId);
      if (!statusCard) continue;
      const turnStartEffects = statusCard.effects.filter(e => e.trigger === 'onTurnStart');
      for (const effect of turnStartEffects) {
        state.pendingEffects.push({
          effect,
          source: statusCard.id,
          target: animal.id,
          player: state.currentPlayer,
        });
      }
    }

    // Animal's own onTurnStart effects (e.g. Cow gain_life, Octopus prevent_attack)
    const cardTurnStartEffects = animal.card.effects.filter(e => e.trigger === 'onTurnStart');
    for (const effect of cardTurnStartEffects) {
      state.pendingEffects.push({
        effect,
        source: animal.card.id,
        target: animal.id,
        player: state.currentPlayer,
      });
    }
  }

  if (state.pendingEffects.length > 0) {
    state = resolvePendingEffects(state);

    // Remove dead animals after BLEEDING
    const currentPlayer = state.players[state.currentPlayer];
    const deadAnimals = currentPlayer.board.filter(a => a.currentHp <= 0);
    for (const dead of deadAnimals) {
      const onDeathEffects = dead.card.effects.filter(e => e.trigger === 'onDeath');
      for (const effect of onDeathEffects) {
        state.pendingEffects.push({
          effect,
          source: dead.card.id,
          target: dead.id,
          player: state.currentPlayer,
        });
      }

      // Trigger onAnimalDeath for all other board animals
      [...state.players[0].board, ...state.players[1].board].forEach(other => {
        if (other.id === dead.id) return;
        const deathTriggers = other.card.effects.filter(e => e.trigger === 'onAnimalDeath');
        for (const effect of deathTriggers) {
          state.pendingEffects.push({
            effect,
            source: other.card.id,
            target: other.id,
            player: other.owner,
          });
        }
      });

      dead.statuses.forEach(sid => {
        const sc = getGameCardById(sid);
        if (sc) currentPlayer.discard.push(sc);
      });
      const idx = currentPlayer.board.indexOf(dead);
      if (idx !== -1) {
        currentPlayer.board.splice(idx, 1);
        currentPlayer.discard.push(dead.card);
      }
      state = addEffectLog(state, `${dead.card.name} stirbt`, 'destroy', dead.card.id);
    }

    if (state.pendingEffects.length > 0) {
      state = resolvePendingEffects(state);
    }
  }

  return state;
};

/**
 * Applies ATK modifiers from statuses and static card effects.
 * Handles: RAGE (+2), TINT (-1), Ant (+1 if another Ant), etc.
 */
export const applyStatusEffectsToAnimal = (animal: BoardAnimal, ownerBoard?: BoardAnimal[]): void => {
  let atkModifier = 0;

  animal.statuses.forEach(statusId => {
    const statusCard = getGameCardById(statusId);
    if (statusCard) {
      if (statusCard.name === 'RAGE') atkModifier += 2;
      else if (statusCard.name === 'TINT') atkModifier -= 1;
    }
  });

  for (const effect of animal.card.effects) {
    if (effect.trigger !== 'static' || effect.action !== 'modify_attack' || effect.target !== 'self') continue;

    if (effect.condition === 'has_another_ant' && ownerBoard) {
      const hasAnotherAnt = ownerBoard.some(a => a.id !== animal.id && a.card.name === 'Ant');
      if (hasAnotherAnt) atkModifier += effect.value || 0;
    }
  }

  const baseAtk = animal.card.atk || 0;
  animal.currentAtk = Math.max(0, baseAtk + atkModifier);
};

/**
 * Checks if an animal can attack. Handles:
 * - maxAttacks (Cat = 2)
 * - STUCK status (blocks unless immune)
 * - Cow: prevent_attack for friendly_animals_except_self
 * - Chicken: self prevent_attack
 * Note: STUCK always blocks, even with RAGE. RAGE means "must attack if able", not "ignores STUCK".
 */
const canAnimalAttack = (state: GameState, animal: BoardAnimal): boolean => {
  if (animal.attacksThisTurn >= animal.maxAttacks) return false;

  // STUCK blocks unless immune
  const hasStuck = animal.statuses.some(sid => getGameCardById(sid)?.name === 'STUCK');
  if (hasStuck) {
    const hasImmunity = animal.card.effects.some(e =>
      e.action === 'status_immunity' &&
      (e.filter?.statusName === 'STUCK' || e.filter?.statusTag === 'negative')
    );
    if (!hasImmunity) return false;
  }

  // Cow: other friendly animals cannot attack
  const owner = state.players[animal.owner];
  for (const other of owner.board) {
    if (other.id === animal.id) continue;
    if (other.card.effects.some(e =>
      e.action === 'prevent_attack' && e.target === 'friendly_animals_except_self'
    )) {
      return false;
    }
  }

  // Chicken / self prevent_attack
  if (animal.card.effects.some(e => e.action === 'prevent_attack' && e.target === 'self')) {
    return false;
  }

  return true;
};

const resolveEndPhase = (state: GameState): void => {
  const player = state.players[state.currentPlayer];

  // onTurnEnd effects: destroy_self (Butterfly, OVERDOSE target), etc.
  // Collect animals that have onTurnEnd → destroy_self
  const toDestroy: BoardAnimal[] = [];
  for (const animal of [...player.board]) {
    const hasDestroySelf = animal.card.effects.some(
      e => e.trigger === 'onTurnEnd' && e.action === 'destroy_self'
    );
    if (hasDestroySelf) {
      toDestroy.push(animal);
    }
  }

  for (const animal of toDestroy) {
    if (!player.board.includes(animal)) continue;

    const onDeathEffects = animal.card.effects.filter(e => e.trigger === 'onDeath');
    for (const effect of onDeathEffects) {
      state.pendingEffects.push({
        effect,
        source: animal.card.id,
        target: animal.id,
        player: state.currentPlayer,
      });
    }

    // Trigger onAnimalDeath for others
    [...state.players[0].board, ...state.players[1].board].forEach(other => {
      if (other.id === animal.id) return;
      const deathTriggers = other.card.effects.filter(e => e.trigger === 'onAnimalDeath');
      for (const effect of deathTriggers) {
        state.pendingEffects.push({
          effect,
          source: other.card.id,
          target: other.id,
          player: other.owner,
        });
      }
    });

    animal.statuses.forEach(statusId => {
      const sc = getGameCardById(statusId);
      if (sc) player.discard.push(sc);
    });

    const index = player.board.indexOf(animal);
    if (index !== -1) {
      player.board.splice(index, 1);
      player.discard.push(animal.card);
    }

    state.effectLog.push({
      id: `log-${Date.now()}-${Math.random()}`,
      message: `${animal.card.name} zerstört sich selbst`,
      timestamp: Date.now(),
      type: 'destroy',
      cardId: animal.card.id,
    });
  }

  // Recalculate ATK for remaining animals
  player.board.forEach(animal => {
    applyStatusEffectsToAnimal(animal, player.board);
  });

  // Remove dead animals (HP <= 0)
  const deadAnimals = player.board.filter(animal => animal.currentHp <= 0);
  for (const animal of deadAnimals) {
    const onDeathEffects = animal.card.effects.filter(e => e.trigger === 'onDeath');
    for (const effect of onDeathEffects) {
      state.pendingEffects.push({
        effect,
        source: animal.card.id,
        target: animal.id,
        player: state.currentPlayer,
      });
    }

    [...state.players[0].board, ...state.players[1].board].forEach(other => {
      if (other.id === animal.id) return;
      const deathTriggers = other.card.effects.filter(e => e.trigger === 'onAnimalDeath');
      for (const effect of deathTriggers) {
        state.pendingEffects.push({
          effect,
          source: other.card.id,
          target: other.id,
          player: other.owner,
        });
      }
    });

    animal.statuses.forEach(statusId => {
      const statusCard = getGameCardById(statusId);
      if (statusCard) player.discard.push(statusCard);
    });

    const index = player.board.indexOf(animal);
    if (index !== -1) {
      player.board.splice(index, 1);
      player.discard.push(animal.card);
    }
  }

  const resolvedState = resolvePendingEffects(state);
  Object.assign(state, resolvedState);
};

export const createStandardDeck = (): GameCard[] => {
  const animals = ALL_GAME_CARDS.filter(c => c.type === 'animal').slice(0, 10);
  const actions = ALL_GAME_CARDS.filter(c => c.type === 'action').slice(0, 7);
  const statuses = ALL_GAME_CARDS.filter(c => c.type === 'status').slice(0, 7);
  return [...animals, ...actions, ...statuses];
};

export const createRandomDeck = (): GameCard[] => {
  const allAnimals = ALL_GAME_CARDS.filter(c => c.type === 'animal');
  const allActions = ALL_GAME_CARDS.filter(c => c.type === 'action');
  const allStatuses = ALL_GAME_CARDS.filter(c => c.type === 'status');

  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const animalCount = 10 + Math.floor(Math.random() * 6);
  const remainingCount = 24 - animalCount;
  const actionCount = Math.floor(Math.random() * (remainingCount + 1));
  const statusCount = remainingCount - actionCount;

  const deck: GameCard[] = [];

  const shuffledAnimals = shuffle(allAnimals);
  for (let i = 0; i < animalCount; i++) {
    deck.push(shuffledAnimals[i % shuffledAnimals.length]);
  }

  const shuffledActions = shuffle(allActions);
  for (let i = 0; i < actionCount; i++) {
    deck.push(shuffledActions[i % shuffledActions.length]);
  }

  const shuffledStatuses = shuffle(allStatuses);
  for (let i = 0; i < statusCount; i++) {
    deck.push(shuffledStatuses[i % shuffledStatuses.length]);
  }

  return shuffle(deck);
};

export const walletCardToGameCard = (walletCard: WalletCard): GameCard | null => {
  if (walletCard.originalInscriptionId) {
    const gameCard = ALL_GAME_CARDS.find(card => card.inscriptionId === walletCard.originalInscriptionId);
    if (gameCard) {
      return { ...gameCard, inscriptionId: walletCard.inscriptionId };
    }
  }

  const gameCard = getGameCardByName(walletCard.name);
  if (gameCard) {
    return { ...gameCard, inscriptionId: walletCard.inscriptionId };
  }

  console.warn(`[GameEngine] Konnte keine GameCard für WalletCard finden: ${walletCard.name} (${walletCard.inscriptionId})`);
  return null;
};

export const createDeckFromWalletCards = (walletCards: WalletCard[]): GameCard[] => {
  const gameCards: GameCard[] = [];
  for (const walletCard of walletCards) {
    const gameCard = walletCardToGameCard(walletCard);
    if (gameCard) gameCards.push(gameCard);
  }

  const animals = gameCards.filter(c => c.type === 'animal');
  const actions = gameCards.filter(c => c.type === 'action');
  const statuses = gameCards.filter(c => c.type === 'status');

  const deck: GameCard[] = [];

  const animalCount = Math.min(animals.length, 15);
  deck.push(...animals.slice(0, animalCount));

  const actionCount = Math.min(actions.length, 7);
  deck.push(...actions.slice(0, actionCount));

  const statusCount = Math.min(statuses.length, 7);
  deck.push(...statuses.slice(0, statusCount));

  if (deck.filter(c => c.type === 'animal').length < 10) {
    const standardDeck = createStandardDeck();
    const standardAnimals = standardDeck.filter(c => c.type === 'animal');
    const neededAnimals = 10 - deck.filter(c => c.type === 'animal').length;
    deck.push(...standardAnimals.slice(0, neededAnimals));
  }

  const finalDeck = deck.slice(0, 24);
  return finalDeck;
};
