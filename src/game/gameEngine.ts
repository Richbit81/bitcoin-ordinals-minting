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
  statuses: string[]; // Status card IDs attached
  canAttack: boolean;
  attacksThisTurn: number;
  maxAttacks: number; // For cards like Cat
  owner: number; // Player index
  playedThisTurn: boolean;
}

export interface PlayerState {
  index: number;
  life: number;
  deck: GameCard[];
  hand: GameCard[];
  board: BoardAnimal[];
  discard: GameCard[];
  statuses: string[]; // Status cards attached to player
  canDraw: boolean;
  animalsPlayedThisTurn: number;
}

export interface EffectLogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'play' | 'attack' | 'damage' | 'draw' | 'destroy' | 'status' | 'effect' | 'phase';
}

export interface GameState {
  currentPlayer: number;
  phase: GamePhase;
  mode: GameMode;
  players: PlayerState[];
  turnNumber: number;
  pendingEffects: Array<{
    effect: EffectDefinition;
    source: string; // Card ID
    target?: string; // Target ID
    player: number;
  }>;
  effectLog: EffectLogEntry[];
  pendingAction?: {
    type: 'look_hand' | 'discard_card';
    playerIndex: number;
    cardId?: string;
  };
  gameOver: boolean;
  winner: number | null;
}

/**
 * Erstellt einen neuen Game State
 */
export const createGameState = (
  player1Deck: GameCard[],
  player2Deck: GameCard[],
  mode: GameMode = 'pvp'
): GameState => {
  // Mische Decks
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

  // Ziehe 5 Karten
  const hand1 = shuffledDeck1.splice(0, 5);
  const hand2 = shuffledDeck2.splice(0, 5);

  // Zufälliger Startspieler
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

/**
 * Fügt einen Eintrag zum Effect-Log hinzu
 */
export const addEffectLog = (
  state: GameState,
  message: string,
  type: EffectLogEntry['type']
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
      },
    ],
  };
};

/**
 * Zieht eine Karte für einen Spieler
 */
export const drawCard = (state: GameState, playerIndex: number, count: number = 1): GameState => {
  const player = state.players[playerIndex];
  let newState = { 
    ...state,
    players: state.players.map((p, idx) => idx === playerIndex ? {
      ...p,
      deck: [...p.deck],
      hand: [...p.hand],
      board: [...p.board],
      discard: [...p.discard],
    } : p)
  };
  const newPlayer = newState.players[playerIndex];
  
  // Prüfe ob Spieler ziehen kann (z.B. PARANOIA Status)
  if (!newPlayer.canDraw) {
    newState = addEffectLog(newState, `Spieler ${playerIndex + 1} kann keine Karte ziehen (PARANOIA)`, 'effect');
    return newState;
  }

  for (let i = 0; i < count; i++) {
    if (newPlayer.deck.length > 0) {
      const drawnCard = newPlayer.deck.shift()!;
      newPlayer.hand.push(drawnCard);
      newState = addEffectLog(newState, `Spieler ${playerIndex + 1} zieht ${drawnCard.name}`, 'draw');
    } else {
      // Deck leer: Verliere 1 Life
      newPlayer.life -= 1;
      newState = addEffectLog(newState, `Spieler ${playerIndex + 1} kann keine Karte ziehen → verliert 1 Life`, 'damage');
      if (newPlayer.life <= 0) {
        return {
          ...newState,
          gameOver: true,
          winner: 1 - playerIndex,
        };
      }
    }
  }

  return newState;
};

/**
 * Prüft ob eine Karte gespielt werden kann
 */
export const canPlayCard = (
  state: GameState,
  playerIndex: number,
  card: GameCard,
  target?: string
): boolean => {
  const player = state.players[playerIndex];

  // Nur aktiver Spieler kann spielen
  if (playerIndex !== state.currentPlayer || state.phase !== 'main') {
    return false;
  }

  // Prüfe Karten-Typ-spezifische Regeln
  if (card.type === 'animal') {
    // Max. 1 Tier pro Turn
    if (player.animalsPlayedThisTurn >= 1) {
      return false;
    }
    // Max. 5 Tiere auf dem Board
    if (player.board.length >= 5) {
      return false;
    }
  }

  // Prüfe ob Ziel gültig ist (falls benötigt)
  if (card.effects.some(e => e.target && e.target !== 'self')) {
    // TODO: Prüfe ob Ziel gültig ist
  }

  return true;
};

/**
 * Spielt eine Karte
 */
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

  // Entferne Karte aus Hand
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return state;

  const playedCard = player.hand.splice(cardIndex, 1)[0];

  // Verarbeite je nach Karten-Typ
  if (card.type === 'animal') {
    // Erstelle Board Animal
    let baseAtk = card.atk || 0;
    
    // Wende Status-Effekte an (RAGE: +2 ATK, TINT: -1 ATK)
    // Diese werden später dynamisch angewendet, aber hier setzen wir die Basis
    
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

    // Prüfe auf doppelte Angriffe (z.B. Cat)
    if (card.id === 'card-19') { // Cat
      boardAnimal.maxAttacks = 2;
    }

    player.board.push(boardAnimal);
    player.animalsPlayedThisTurn++;
    
    // Wende Status-Effekte an (falls bereits vorhanden)
    applyStatusEffectsToAnimal(boardAnimal);

    // Log: Karte gespielt
    state = addEffectLog(state, `Spieler ${playerIndex + 1} spielt ${card.name}`, 'play');

    // Trigger "onPlay" Effekte
    const onPlayEffects = card.effects.filter(e => e.trigger === 'onPlay');
    for (const effect of onPlayEffects) {
      state.pendingEffects.push({
        effect,
        source: card.id,
        target: boardAnimal.id,
        player: playerIndex,
      });
    }
    
    // Löse pending Effects sofort auf
    state = resolvePendingEffects(state);
  } else if (card.type === 'action') {
    // Log: Action-Karte gespielt
    state = addEffectLog(state, `Spieler ${playerIndex + 1} spielt ${card.name}`, 'play');
    
    // Trigger "onPlay" Effekte
    const onPlayEffects = card.effects.filter(e => e.trigger === 'onPlay');
    for (const effect of onPlayEffects) {
      state.pendingEffects.push({
        effect,
        source: card.id,
        target,
        player: playerIndex,
      });
    }
    
    // Löse pending Effects sofort auf
    state = resolvePendingEffects(state);

    // Action-Karten gehen sofort in den Discard
    player.discard.push(playedCard);
  } else if (card.type === 'status') {
    // Log: Status-Karte gespielt
    state = addEffectLog(state, `Spieler ${playerIndex + 1} spielt ${card.name}`, 'status');
    
    // Status-Karten müssen an ein Ziel angehängt werden
    if (target) {
      // Finde Ziel (Animal oder Player)
      const targetAnimal = player.board.find(a => a.id === target) ||
                           state.players[1 - playerIndex].board.find(a => a.id === target);
      
      if (targetAnimal) {
        targetAnimal.statuses.push(card.id);
        state = addEffectLog(state, `${card.name} wird an ${targetAnimal.card.name} angehängt`, 'status');
      } else {
        // An Spieler angehängt
        const targetPlayer = state.players.find(p => p.index.toString() === target);
        if (targetPlayer) {
          targetPlayer.statuses.push(card.id);
          state = addEffectLog(state, `${card.name} wird an Spieler ${targetPlayer.index + 1} angehängt`, 'status');
        }
      }
    }

    // Status-Karten gehen in den Discard (aber bleiben als Attachment)
    player.discard.push(playedCard);
  }

  return { ...state };
};

/**
 * Wechselt zur nächsten Phase
 */
export const nextPhase = (state: GameState): GameState => {
  let newState = { ...state };

  switch (state.phase) {
    case 'draw':
      // Draw Phase: Automatisch 1 Karte ziehen
      newState = addEffectLog(newState, `Phase: DRAW (Spieler ${state.currentPlayer + 1})`, 'phase');
      newState = drawCard(newState, state.currentPlayer);
      newState.phase = 'main';
      newState = addEffectLog(newState, `Phase: MAIN (Spieler ${state.currentPlayer + 1})`, 'phase');
      break;

    case 'main':
      // Main Phase: Wechsel zu Attack Phase
      newState.phase = 'attack';
      newState = addEffectLog(newState, `Phase: ATTACK (Spieler ${state.currentPlayer + 1})`, 'phase');
      break;

    case 'attack':
      // Attack Phase: Alle Tiere greifen automatisch an
      const currentPlayer = newState.players[state.currentPlayer];
      const opponent = newState.players[1 - state.currentPlayer];

      for (const animal of currentPlayer.board) {
        if (canAnimalAttack(newState, animal)) {
          // Tier greift an
          const damage = animal.currentAtk;
          opponent.life -= damage;
          animal.attacksThisTurn++;
          
          // Log: Angriff
          newState = addEffectLog(newState, `${animal.card.name} greift an → ${damage} Schaden`, 'attack');
          if (damage > 0) {
            newState = addEffectLog(newState, `Spieler ${(1 - state.currentPlayer) + 1} verliert ${damage} Life (${opponent.life + damage} → ${opponent.life})`, 'damage');
          }

          // Trigger "onAttack" Effekte
          const onAttackEffects = animal.card.effects.filter(e => e.trigger === 'onAttack');
          for (const effect of onAttackEffects) {
            newState.pendingEffects.push({
              effect,
              source: animal.card.id,
              target: animal.id,
              player: state.currentPlayer,
            });
          }
          
          // Löse pending Effects auf
          newState = resolvePendingEffects(newState);

          // Prüfe ob Spieler verloren hat
          if (opponent.life <= 0) {
            newState.gameOver = true;
            newState.winner = state.currentPlayer;
            return newState;
          }
        }
      }

      newState.phase = 'end';
      newState = addEffectLog(newState, `Phase: END (Spieler ${state.currentPlayer + 1})`, 'phase');
      break;

    case 'end':
      // End Phase: End-of-Turn-Effekte, Tod, Status entfernen
      resolveEndPhase(newState);
      
      // Reset für nächsten Turn
      const player = newState.players[state.currentPlayer];
      player.animalsPlayedThisTurn = 0;
      player.board.forEach(animal => {
        animal.attacksThisTurn = 0;
        animal.playedThisTurn = false;
      });

      // Wechsel Spieler
      newState.currentPlayer = 1 - state.currentPlayer;
      newState.turnNumber++;
      newState.phase = 'draw';
      newState = addEffectLog(newState, `Turn ${newState.turnNumber} beginnt`, 'phase');
      break;
  }

  return newState;
};

/**
 * Wendet Status-Effekte auf ein Tier an (ATK-Modifikationen)
 */
const applyStatusEffectsToAnimal = (animal: BoardAnimal): void => {
  let atkModifier = 0;
  
  animal.statuses.forEach(statusId => {
    const statusCard = getGameCardById(statusId);
    if (statusCard) {
      if (statusCard.name === 'RAGE') {
        atkModifier += 2; // +2 ATK
      } else if (statusCard.name === 'TINT') {
        atkModifier -= 1; // -1 ATK
      }
    }
  });
  
  // Wende Modifikationen an (basierend auf Basis-ATK der Karte)
  const baseAtk = animal.card.atk || 0;
  animal.currentAtk = Math.max(0, baseAtk + atkModifier);
};

/**
 * Prüft ob ein Tier angreifen kann
 */
const canAnimalAttack = (state: GameState, animal: BoardAnimal): boolean => {
  // Prüfe ob Tier bereits angegriffen hat (max. Attacks)
  if (animal.attacksThisTurn >= animal.maxAttacks) {
    return false;
  }

  // Prüfe Status-Effekte
  for (const statusId of animal.statuses) {
    const statusCard = getGameCardById(statusId);
    if (statusCard) {
      if (statusCard.name === 'STUCK') {
        // Prüfe ob Tier immun gegen STUCK ist
        const hasImmunity = animal.card.effects.some(e => 
          e.action === 'status_immunity' && 
          e.filter?.statusName === 'STUCK'
        );
        if (!hasImmunity) {
          return false;
        }
      }
      
      if (statusCard.name === 'RAGE') {
        // RAGE: Muss angreifen wenn möglich
        // Wenn Tier angreifen kann, muss es angreifen
        return true; // Erlaube Angriff
      }
    }
  }

  // Prüfe Tier-spezifische Regeln (z.B. Chicken)
  if (animal.card.effects.some(e => e.action === 'prevent_attack' && e.target === 'self')) {
    return false;
  }

  return true;
};

/**
 * Löst End-of-Turn-Effekte auf
 */
const resolveEndPhase = (state: GameState): void => {
  const player = state.players[state.currentPlayer];

  // Status-Effekte: onTurnStart (wird am Anfang des Turns ausgelöst)
  // BLEEDING: 1 HP pro Turn
  player.board.forEach(animal => {
    animal.statuses.forEach(statusId => {
      const statusCard = getGameCardById(statusId);
      if (statusCard?.name === 'BLEEDING') {
        animal.currentHp -= 1;
        state.effectLog.push({
          id: `log-${Date.now()}-${Math.random()}`,
          message: `${animal.card.name} verliert 1 HP durch BLEEDING`,
          timestamp: Date.now(),
          type: 'status',
        });
      }
    });
  });

  // End-of-Turn-Effekte (z.B. Butterfly zerstört sich selbst)
  const endOfTurnEffects = player.board
    .flatMap(animal => animal.card.effects.filter(e => e.trigger === 'onTurnEnd'))
    .concat(player.statuses.map(statusId => {
      const statusCard = getGameCardById(statusId);
      return statusCard?.effects.filter(e => e.trigger === 'onTurnEnd') || [];
    }).flat());

  for (const effect of endOfTurnEffects) {
    if (effect.action === 'destroy_self') {
      // Finde Tier mit diesem Effekt
      const animal = player.board.find(a => 
        a.card.effects.some(e => e.trigger === 'onTurnEnd' && e.action === 'destroy_self')
      );
      if (animal) {
        // Zerstöre Tier
        const onDeathEffects = animal.card.effects.filter(e => e.trigger === 'onDeath');
        for (const effect of onDeathEffects) {
          state.pendingEffects.push({
            effect,
            source: animal.card.id,
            target: animal.id,
            player: state.currentPlayer,
          });
        }
        
        animal.statuses.forEach(statusId => {
          player.discard.push(getGameCardById(statusId)!);
        });
        
        const index = player.board.indexOf(animal);
        player.board.splice(index, 1);
        player.discard.push(animal.card);
      }
    }
  }

  // Wende Status-Effekte auf alle Tiere an (ATK-Modifikationen)
  player.board.forEach(animal => {
    applyStatusEffectsToAnimal(animal);
  });

  // Wende Status-Effekte auf alle Tiere an (ATK-Modifikationen)
  player.board.forEach(animal => {
    applyStatusEffectsToAnimal(animal);
  });

  // Zerstöre Tiere mit HP ≤ 0
  const deadAnimals = player.board.filter(animal => animal.currentHp <= 0);
  for (const animal of deadAnimals) {
    // Trigger "onDeath" Effekte
    const onDeathEffects = animal.card.effects.filter(e => e.trigger === 'onDeath');
    for (const effect of onDeathEffects) {
      state.pendingEffects.push({
        effect,
        source: animal.card.id,
        target: animal.id,
        player: state.currentPlayer,
      });
    }

    // Entferne Status-Karten
    animal.statuses.forEach(statusId => {
      const statusCard = getGameCardById(statusId);
      if (statusCard) {
        player.discard.push(statusCard);
      }
    });

    // Entferne Tier vom Board
    const index = player.board.indexOf(animal);
    if (index !== -1) {
      player.board.splice(index, 1);
      player.discard.push(animal.card);
    }
  }

  // Löse pending Effects auf
  const resolvedState = resolvePendingEffects(state);
  // Kopiere resolved state zurück
  Object.assign(state, resolvedState);

  // Entferne abgelaufene Status-Karten (z.B. SHIELD nach Verwendung)
  // TODO: Implementiere Status-Entfernung basierend auf Bedingungen
};

/**
 * Erstellt ein Standard-Deck (24 Karten, min. 10 Animals)
 */
export const createStandardDeck = (): GameCard[] => {
  // TODO: Implementiere Deck-Erstellung
  // Für jetzt: Verwende alle verfügbaren Karten
  const animals = ALL_GAME_CARDS.filter(c => c.type === 'animal').slice(0, 10);
  const actions = ALL_GAME_CARDS.filter(c => c.type === 'action').slice(0, 7);
  const statuses = ALL_GAME_CARDS.filter(c => c.type === 'status').slice(0, 7);
  
  return [...animals, ...actions, ...statuses];
};

/**
 * Erstellt ein zufälliges Deck für Tests
 * 24 Karten: mindestens 10 Animals, Rest Actions und Status
 */
export const createRandomDeck = (): GameCard[] => {
  const allAnimals = ALL_GAME_CARDS.filter(c => c.type === 'animal');
  const allActions = ALL_GAME_CARDS.filter(c => c.type === 'action');
  const allStatuses = ALL_GAME_CARDS.filter(c => c.type === 'status');
  
  // Zufällige Funktion
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  // Zufällige Auswahl: 10-15 Animals, Rest Actions und Status
  const animalCount = 10 + Math.floor(Math.random() * 6); // 10-15
  const remainingCount = 24 - animalCount; // 9-14
  const actionCount = Math.floor(Math.random() * (remainingCount + 1)); // 0-remainingCount
  const statusCount = remainingCount - actionCount;
  
  // Zufällige Karten auswählen (mit Wiederholungen möglich)
  const deck: GameCard[] = [];
  
  // Animals (10-15)
  const shuffledAnimals = shuffle(allAnimals);
  for (let i = 0; i < animalCount; i++) {
    deck.push(shuffledAnimals[i % shuffledAnimals.length]);
  }
  
  // Actions (0-remainingCount)
  const shuffledActions = shuffle(allActions);
  for (let i = 0; i < actionCount; i++) {
    deck.push(shuffledActions[i % shuffledActions.length]);
  }
  
  // Status (Rest)
  const shuffledStatuses = shuffle(allStatuses);
  for (let i = 0; i < statusCount; i++) {
    deck.push(shuffledStatuses[i % shuffledStatuses.length]);
  }
  
  // Deck zufällig mischen
  return shuffle(deck);
};

/**
 * Konvertiert eine WalletCard zu einer GameCard
 * Findet die passende GameCard basierend auf originalInscriptionId oder name
 */
export const walletCardToGameCard = (walletCard: WalletCard): GameCard | null => {
  // Versuche zuerst nach originalInscriptionId zu finden
  if (walletCard.originalInscriptionId) {
    const gameCard = ALL_GAME_CARDS.find(card => card.inscriptionId === walletCard.originalInscriptionId);
    if (gameCard) {
      // Erstelle eine Kopie mit der Delegate-Inskription-ID für Bild-Abruf
      return {
        ...gameCard,
        inscriptionId: walletCard.inscriptionId, // Verwende Delegate-ID für Bild-Abruf
      };
    }
  }
  
  // Fallback: Suche nach Name
  const gameCard = getGameCardByName(walletCard.name);
  if (gameCard) {
    // Erstelle eine Kopie mit der Delegate-Inskription-ID für Bild-Abruf
    return {
      ...gameCard,
      inscriptionId: walletCard.inscriptionId, // Verwende Delegate-ID für Bild-Abruf
    };
  }
  
  console.warn(`[GameEngine] ⚠️ Konnte keine GameCard für WalletCard finden: ${walletCard.name} (${walletCard.inscriptionId})`);
  return null;
};

/**
 * Erstellt ein Deck aus Wallet-Karten
 * Filtert nach Typ (animal/action/status) und erstellt ein ausgewogenes Deck
 */
export const createDeckFromWalletCards = (walletCards: WalletCard[]): GameCard[] => {
  console.log(`[GameEngine] 🔍 Erstelle Deck aus ${walletCards.length} Wallet-Karten...`);
  
  // Konvertiere alle Wallet-Karten zu GameCards
  const gameCards: GameCard[] = [];
  for (const walletCard of walletCards) {
    const gameCard = walletCardToGameCard(walletCard);
    if (gameCard) {
      gameCards.push(gameCard);
    }
  }
  
  console.log(`[GameEngine] ✅ ${gameCards.length} Karten erfolgreich konvertiert`);
  
  // Gruppiere nach Typ
  const animals = gameCards.filter(c => c.type === 'animal');
  const actions = gameCards.filter(c => c.type === 'action');
  const statuses = gameCards.filter(c => c.type === 'status');
  
  console.log(`[GameEngine] 📊 Karten-Verteilung: ${animals.length} Animals, ${actions.length} Actions, ${statuses.length} Status`);
  
  // Erstelle ausgewogenes Deck (min. 10 Animals, max. 24 Karten)
  const deck: GameCard[] = [];
  
  // Füge Animals hinzu (min. 10, max. 15)
  const animalCount = Math.min(animals.length, 15);
  deck.push(...animals.slice(0, animalCount));
  
  // Füge Actions hinzu (max. 7)
  const actionCount = Math.min(actions.length, 7);
  deck.push(...actions.slice(0, actionCount));
  
  // Füge Status hinzu (max. 7)
  const statusCount = Math.min(statuses.length, 7);
  deck.push(...statuses.slice(0, statusCount));
  
  // Wenn weniger als 10 Animals, fülle mit Standard-Deck auf
  if (deck.filter(c => c.type === 'animal').length < 10) {
    console.log(`[GameEngine] ⚠️ Zu wenige Animals (${deck.filter(c => c.type === 'animal').length}), fülle mit Standard-Deck auf...`);
    const standardDeck = createStandardDeck();
    const standardAnimals = standardDeck.filter(c => c.type === 'animal');
    const neededAnimals = 10 - deck.filter(c => c.type === 'animal').length;
    deck.push(...standardAnimals.slice(0, neededAnimals));
  }
  
  // Begrenze auf 24 Karten
  const finalDeck = deck.slice(0, 24);
  
  console.log(`[GameEngine] ✅ Finales Deck: ${finalDeck.length} Karten (${finalDeck.filter(c => c.type === 'animal').length} Animals, ${finalDeck.filter(c => c.type === 'action').length} Actions, ${finalDeck.filter(c => c.type === 'status').length} Status)`);
  
  return finalDeck;
};

