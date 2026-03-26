import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, createGameState, nextPhase, playCard, GamePhase, createStandardDeck, createDeckFromWalletCards, canPlayCard, getCardPlayabilityReason, createRandomDeck } from '../game/gameEngine';
import { GameCard, ALL_GAME_CARDS } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';
import { makeAIMove } from '../game/aiLogic';
import { resolvePendingEffects } from '../game/effectResolver';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { DeckBuilderModal } from '../components/DeckBuilderModal';
import { WalletDeckBuilderModal } from '../components/WalletDeckBuilderModal';
import { TargetSelectionModal } from '../components/TargetSelectionModal';
import { EffectLog } from '../components/EffectLog';
import { OpponentHandModal } from '../components/OpponentHandModal';
import { GameTutorialModal } from '../components/GameTutorialModal';
import { DiscardPilePickerModal } from '../components/DiscardPilePickerModal';
import { fetchWalletCards, WalletCard } from '../services/gallery';
import { GameBoardView } from '../components/GameBoardView';
import { ActionText } from '../components/ActionText';
import { CardBank } from '../components/CardBank';
import { getGameSoundVolumes, isGameSoundMuted, playGameCardSound, playGameUiSound, setGameSoundMuted, setGameSoundVolume } from '../services/gameSoundService';

type UiLanguage = 'de' | 'en';
type ActionLevel = 'low' | 'medium' | 'high';
type DensityMode = 'normal' | 'ultra';
type HelpTopic = 'lang' | 'action' | 'sound' | 'fit' | 'scale' | 'hand' | 'bank' | 'end';
const LANGUAGE_STORAGE_KEY = 'bw_ui_language_v1';
const ACTION_LEVEL_STORAGE_KEY = 'bw_action_level_v1';

const UI_TEXT: Record<UiLanguage, Record<string, string>> = {
  de: {
    title: 'BLACK & WILD',
    yourTurn: 'Dein Zug',
    enemyTurn: 'Gegner-Zug',
    cardBank: 'Card Bank',
    end: 'Beenden',
    compact: 'Kompakt',
    on: 'AN',
    off: 'AUS',
    nextStep: 'Nächster Schritt',
    opponentQueue: 'LETZTE 3 GEGNER-AKTIONEN',
    noOpponentQueue: 'Noch keine gegnerischen Aktionen erkannt.',
    mainEnd: 'Main Phase beenden',
    waitingPhase: 'Warte auf {phase} Phase...',
    waitingEnemy: 'Gegner-Zug...',
    yourHand: 'Deine Hand',
    openTutorial: 'Tutorial anzeigen',
    startPvp: 'Spieler vs Spieler',
    startPve: 'Spieler vs KI',
    buildDeck: 'Deck aus Wallet-Karten bauen',
    sound: 'Sound',
    opening: 'Start',
    openingHint: 'Wähle Modus und starte ein Match',
    actionLevel: 'Action',
    actionLow: 'Niedrig',
    actionMedium: 'Mittel',
    actionHigh: 'Hoch',
    ultra: 'Ultra Compact',
    noScroll: 'No-Scroll',
    cardType: 'Typ',
    cardEffect: 'Effekt',
    cardStats: 'ATK/HP',
    typeAnimal: 'Tier',
    typeAction: 'Aktion',
    typeStatus: 'Status',
    helpLang: 'Sprache wechseln (Deutsch/Englisch).',
    helpActionLevel: 'Steuert Intensität von Effekten und Action-Texten.',
    helpSound: 'Schaltet alle Spielsounds ein oder aus.',
    helpFit: 'Automatische Größenanpassung an deine Bildschirmhöhe.',
    helpUltra: 'Maximale Verdichtung für kleine Bildschirme.',
    helpCompact: 'Kompakte Darstellung für weniger Platzverbrauch.',
    helpScale: 'Manuelle Spielfeldgröße (nur wenn Fit AUS ist).',
    helpCardBank: 'Zeigt Deck, Hand und Ablagestapel.',
    helpEnd: 'Zurück zum Startbildschirm.',
    helpMainEnd: 'Beendet die Main-Phase und startet den nächsten Schritt.',
    helpHandCard: 'Kurz warten: hier siehst du eine Erklärung zur Karte.',
    helpSoundMaster: 'Gesamtlautstärke aller Sounds.',
    helpSoundAnimal: 'Lautstärke für Tier-Karten.',
    helpSoundAction: 'Lautstärke für Aktions-/Status-Sounds.',
    helpSoundUi: 'Lautstärke für UI-Klicks und Treffer.',
    playable: 'Spielbar',
    animalsShort: 'Tiere',
    boardShort: 'Board',
    helpBar: 'Hilfe',
    helpTopicLang: 'Sprache',
    helpTopicAction: 'Action',
    helpTopicSound: 'Sound',
    helpTopicFit: 'Fit',
    helpTopicScale: 'Scale',
    helpTopicHand: 'Hand',
    helpTopicBank: 'Card Bank',
    helpTopicEnd: 'Beenden',
  },
  en: {
    title: 'BLACK & WILD',
    yourTurn: 'Your turn',
    enemyTurn: 'Opponent turn',
    cardBank: 'Card Bank',
    end: 'Exit',
    compact: 'Compact',
    on: 'ON',
    off: 'OFF',
    nextStep: 'Next step',
    opponentQueue: 'LAST 3 OPPONENT ACTIONS',
    noOpponentQueue: 'No opponent actions detected yet.',
    mainEnd: 'End main phase',
    waitingPhase: 'Waiting for {phase} phase...',
    waitingEnemy: 'Opponent turn...',
    yourHand: 'Your hand',
    openTutorial: 'Show tutorial',
    startPvp: 'Player vs Player',
    startPve: 'Player vs AI',
    buildDeck: 'Build deck from wallet cards',
    sound: 'Sound',
    opening: 'Start',
    openingHint: 'Choose mode and start a match',
    actionLevel: 'Action',
    actionLow: 'Low',
    actionMedium: 'Medium',
    actionHigh: 'High',
    ultra: 'Ultra Compact',
    noScroll: 'No Scroll',
    cardType: 'Type',
    cardEffect: 'Effect',
    cardStats: 'ATK/HP',
    typeAnimal: 'Animal',
    typeAction: 'Action',
    typeStatus: 'Status',
    helpLang: 'Switch language (German/English).',
    helpActionLevel: 'Controls intensity of effects and action texts.',
    helpSound: 'Turns all game sounds on or off.',
    helpFit: 'Automatically adapts size to your screen height.',
    helpUltra: 'Maximum compact density for small screens.',
    helpCompact: 'Compact view for lower space usage.',
    helpScale: 'Manual board size (only when Fit is OFF).',
    helpCardBank: 'Shows deck, hand, and discard pile.',
    helpEnd: 'Return to the start screen.',
    helpMainEnd: 'Ends the main phase and starts the next step.',
    helpHandCard: 'Hover briefly to see a card explanation.',
    helpSoundMaster: 'Master volume for all sounds.',
    helpSoundAnimal: 'Volume for animal card sounds.',
    helpSoundAction: 'Volume for action/status sounds.',
    helpSoundUi: 'Volume for UI clicks and impact sounds.',
    playable: 'Playable',
    animalsShort: 'Animals',
    boardShort: 'Board',
    helpBar: 'Help',
    helpTopicLang: 'Language',
    helpTopicAction: 'Action',
    helpTopicSound: 'Sound',
    helpTopicFit: 'Fit',
    helpTopicScale: 'Scale',
    helpTopicHand: 'Hand',
    helpTopicBank: 'Card Bank',
    helpTopicEnd: 'Exit',
  },
};

const HELP_TOPIC_TEXT_KEY: Record<HelpTopic, string> = {
  lang: 'helpLang',
  action: 'helpActionLevel',
  sound: 'helpSound',
  fit: 'helpFit',
  scale: 'helpScale',
  hand: 'helpHandCard',
  bank: 'helpCardBank',
  end: 'helpEnd',
};

export const GamePage: React.FC = () => {
  const { walletState } = useWallet();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'pvp' | 'pve'>('pvp');
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [adminDeck, setAdminDeck] = useState<GameCard[]>([]);
  const [walletCards, setWalletCards] = useState<WalletCard[]>([]);
  const [loadingWalletCards, setLoadingWalletCards] = useState(false);
  const [userSelectedDeck, setUserSelectedDeck] = useState<GameCard[]>([]);
  const [pendingCard, setPendingCard] = useState<GameCard | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showOpponentHand, setShowOpponentHand] = useState(false);
  const [opponentHandAction, setOpponentHandAction] = useState<((cardId: string) => void) | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [attackingAnimal, setAttackingAnimal] = useState<string | null>(null);
  const [damageAnimations, setDamageAnimations] = useState<Array<{id: string; target: string; amount: number; type: 'life' | 'animal'}>>([]);
  const [cardPlayAnimations, setCardPlayAnimations] = useState<Set<string>>(new Set());
  const [actionTexts, setActionTexts] = useState<Array<{id: string; text: string; type: 'attack' | 'shield' | 'heal' | 'card' | 'effect'; position: {x: number; y: number}}>>([]);
  const [showCardBank, setShowCardBank] = useState(false);
  const [showDiscardPicker, setShowDiscardPicker] = useState(false);
  const [copyEffectTarget, setCopyEffectTarget] = useState<GameCard | null>(null);
  const [opponentLiveAction, setOpponentLiveAction] = useState<{
    id: string;
    text: string;
    cardId?: string;
  } | null>(null);
  const [opponentActionQueue, setOpponentActionQueue] = useState<Array<{ id: string; text: string; cardId?: string }>>([]);
  const [compactMode, setCompactMode] = useState(true);
  const [densityMode, setDensityMode] = useState<DensityMode>('normal');
  const [boardScale, setBoardScale] = useState(84);
  const [fitToScreen, setFitToScreen] = useState(true);
  const [viewportHeight, setViewportHeight] = useState<number>(typeof window === 'undefined' ? 900 : window.innerHeight);
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === 'undefined') return 'de';
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'de';
  });
  const [actionLevel, setActionLevel] = useState<ActionLevel>(() => {
    if (typeof window === 'undefined') return 'medium';
    const saved = window.localStorage.getItem(ACTION_LEVEL_STORAGE_KEY);
    return saved === 'low' || saved === 'high' ? saved : 'medium';
  });
  const [soundMuted, setSoundMuted] = useState(isGameSoundMuted());
  const [soundVolumes, setSoundVolumes] = useState(getGameSoundVolumes());
  const [battlefieldPulse, setBattlefieldPulse] = useState<{
    id: string;
    target: 'player' | 'opponent' | 'center';
    type: 'attack' | 'damage' | 'status' | 'play' | 'draw' | 'effect';
  } | null>(null);
  const [openHelpTopic, setOpenHelpTopic] = useState<HelpTopic | null>(null);
  const processedLogCountRef = useRef(0);
  const cardHoverTimerRef = useRef<number | null>(null);

  const cardNeedsManualTarget = (card: GameCard): boolean => {
    return card.effects.some((effect) =>
      effect.target === 'any' ||
      effect.target === 'enemy_animal' ||
      effect.target === 'friendly_animal' ||
      effect.target === 'friendly_animals_except_self'
    );
  };

  const classifyPulseTarget = useCallback((message: string): 'player' | 'opponent' | 'center' => {
    const msg = String(message || '');
    if (/Spieler 2/i.test(msg) || /Gegner/i.test(msg)) return 'opponent';
    if (/Spieler 1/i.test(msg) || /Du/i.test(msg) || /deine/i.test(msg)) return 'player';
    return 'center';
  }, []);

  const getActionConfig = useCallback(() => {
    if (actionLevel === 'low') {
      return {
        maxFreshEntries: 2,
        pulseMs: 520,
        showFor: new Set(['attack', 'damage', 'play']),
        playSounds: false,
      };
    }
    if (actionLevel === 'high') {
      return {
        maxFreshEntries: 6,
        pulseMs: 1200,
        showFor: new Set(['attack', 'damage', 'play', 'draw', 'status', 'effect']),
        playSounds: true,
      };
    }
    return {
      maxFreshEntries: 4,
      pulseMs: 800,
      showFor: new Set(['attack', 'damage', 'play', 'draw', 'status', 'effect']),
      playSounds: true,
    };
  }, [actionLevel]);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      let value = UI_TEXT[language][key] || UI_TEXT.de[key] || key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(`{${k}}`, v);
        }
      }
      return value;
    },
    [language]
  );

  const translateLogMessage = useCallback((message: string) => {
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
    return translated;
  }, [language]);

  const handleCardMouseEnter = useCallback((cardId: string) => {
    if (cardHoverTimerRef.current) {
      window.clearTimeout(cardHoverTimerRef.current);
    }
    cardHoverTimerRef.current = window.setTimeout(() => {
      setHoveredCard(cardId);
    }, 420);
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    if (cardHoverTimerRef.current) {
      window.clearTimeout(cardHoverTimerRef.current);
      cardHoverTimerRef.current = null;
    }
    setHoveredCard(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTION_LEVEL_STORAGE_KEY, actionLevel);
  }, [actionLevel]);

  useEffect(() => {
    return () => {
      if (cardHoverTimerRef.current) {
        window.clearTimeout(cardHoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const setAutoScale = () => {
      const h = window.innerHeight;
      setViewportHeight(h);
      if (!fitToScreen) return;
      const auto = h < 600 ? 54 : h < 660 ? 58 : h < 720 ? 64 : h < 780 ? 70 : h < 840 ? 76 : h < 920 ? 82 : h < 1000 ? 88 : 92;
      setBoardScale(auto);
    };
    setAutoScale();
    window.addEventListener('resize', setAutoScale);
    return () => window.removeEventListener('resize', setAutoScale);
  }, [fitToScreen]);

  const isAdmin = walletState.connected &&
                  walletState.accounts.length > 0 &&
                  isAdminAddress(walletState.accounts[0].address);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]?.address) {
      loadWalletCards();
    } else {
      setWalletCards([]);
    }
  }, [walletState.connected, walletState.accounts]);

  const loadWalletCards = async () => {
    if (!walletState.accounts[0]?.address) return;
    setLoadingWalletCards(true);
    try {
      const cards = await fetchWalletCards(walletState.accounts[0].address);
      setWalletCards(cards);
    } catch (error) {
      console.error('[GamePage] Fehler beim Laden der Wallet-Karten:', error);
      setWalletCards([]);
    } finally {
      setLoadingWalletCards(false);
    }
  };

  const startGame = (customDeck1?: GameCard[], customDeck2?: GameCard[]) => {
    let deck1: GameCard[];
    if (customDeck1) {
      deck1 = customDeck1;
    } else if (isAdmin && adminDeck.length === 24) {
      deck1 = adminDeck;
    } else if (userSelectedDeck.length === 24) {
      deck1 = userSelectedDeck;
    } else if (walletCards.length > 0) {
      deck1 = createDeckFromWalletCards(walletCards);
      if (deck1.length < 10) {
        deck1 = createStandardDeck();
      }
    } else {
      deck1 = createStandardDeck();
    }

    const deck2 = customDeck2 || createStandardDeck();
    const newState = createGameState(deck1, deck2, gameMode);
    processedLogCountRef.current = 0;
    setOpponentActionQueue([]);
    setOpponentLiveAction(null);
    setBattlefieldPulse(null);
    setGameState(newState);
  };

  // Handle pendingAction (look_hand, copy_effect)
  useEffect(() => {
    if (!gameState || !gameState.pendingAction) return;

    if (gameState.pendingAction.type === 'look_hand') {
      setShowOpponentHand(true);
      setOpponentHandAction(() => (cardId: string) => {
        const newState = { ...gameState };
        const targetPlayer = newState.players[gameState.pendingAction!.playerIndex];
        const cardIndex = targetPlayer.hand.findIndex(c => c.id === cardId);

        if (cardIndex !== -1) {
          const discardedCard = targetPlayer.hand.splice(cardIndex, 1)[0];
          targetPlayer.discard.push(discardedCard);
          newState.effectLog.push({
            id: `log-${Date.now()}-${Math.random()}`,
            message: `Karte ${discardedCard.name} wird verworfen`,
            timestamp: Date.now(),
            type: 'effect',
          });
        }

        newState.pendingAction = undefined;
        const resolved = resolvePendingEffects(newState);
        setGameState(resolved);
      });
    }

    if (gameState.pendingAction.type === 'copy_effect') {
      setShowDiscardPicker(true);
    }
  }, [gameState?.pendingAction]);

  // Automatic phase transitions and AI moves
  useEffect(() => {
    if (!gameState || gameState.gameOver) return;
    if (gameState.pendingAction) return;

    // AI turn in Main Phase
    if (gameState.mode === 'pve' && gameState.currentPlayer === 1 && gameState.phase === 'main') {
      const timer = setTimeout(() => {
        const aiMove = makeAIMove(gameState);
        if (aiMove) {
          setGameState(aiMove);
        } else {
          setGameState(prev => prev ? nextPhase(prev) : null);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Draw Phase: Automatic
    if (gameState.phase === 'draw') {
      const timer = setTimeout(() => {
        setGameState(prev => {
          if (!prev) return null;
          return nextPhase(prev);
        });
      }, 500);
      return () => clearTimeout(timer);
    }

    // Attack Phase: With animations
    if (gameState.phase === 'attack') {
      const currentPlayer = gameState.players[gameState.currentPlayer];
      const attackableAnimals = currentPlayer.board.filter(a =>
        a.attacksThisTurn < a.maxAttacks &&
        !a.card.effects.some(e => e.action === 'prevent_attack' && e.target === 'self')
      );

      if (attackableAnimals.length > 0) {
        const firstAnimal = attackableAnimals[0];
        setAttackingAnimal(firstAnimal.id);

        setTimeout(() => {
          const damage = firstAnimal.currentAtk;
          if (damage > 0) {
            setDamageAnimations(prev => [...prev, {
              id: `damage-${Date.now()}`,
              target: 'opponent-life',
              amount: damage,
              type: 'life'
            }]);
          }
        }, 500);

        const timer = setTimeout(() => {
          setAttackingAnimal(null);
          setGameState(prev => prev ? nextPhase(prev) : null);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setGameState(prev => prev ? nextPhase(prev) : null);
        }, 500);
        return () => clearTimeout(timer);
      }
    }

    // End Phase: Automatic
    if (gameState.phase === 'end') {
      const timer = setTimeout(() => {
        setGameState(prev => prev ? nextPhase(prev) : null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  // Add stronger battlefield action texts from freshly added effect log entries.
  useEffect(() => {
    if (!gameState) return;
    const cfg = getActionConfig();
    const currentCount = gameState.effectLog.length;
    const previousCount = processedLogCountRef.current;
    if (currentCount <= previousCount) {
      processedLogCountRef.current = currentCount;
      return;
    }

    const fresh = gameState.effectLog.slice(previousCount);
    processedLogCountRef.current = currentCount;

    for (const entry of fresh.slice(-cfg.maxFreshEntries)) {
      let text = '';
      let type: 'attack' | 'shield' | 'heal' | 'card' | 'effect' = 'effect';
      let pulseType: 'attack' | 'damage' | 'status' | 'play' | 'draw' | 'effect' = 'effect';

      if (entry.type === 'attack') {
        text = 'ATTACK!';
        type = 'attack';
        pulseType = 'attack';
      } else if (entry.type === 'damage') {
        text = 'HIT!';
        type = 'attack';
        pulseType = 'damage';
      } else if (entry.type === 'draw') {
        text = 'DRAW';
        type = 'card';
        pulseType = 'draw';
      } else if (entry.type === 'status') {
        text = 'STATUS!';
        type = 'effect';
        pulseType = 'status';
      } else if (entry.type === 'play') {
        text = 'PLAY!';
        type = 'card';
        pulseType = 'play';
      } else if (entry.type === 'effect') {
        text = 'EFFECT!';
        type = 'effect';
        pulseType = 'effect';
      }

      if (!text || !cfg.showFor.has(entry.type)) continue;
      setActionTexts(prev => [
        ...prev,
        {
          id: `logfx-${entry.id}-${Date.now()}`,
          text,
          type,
          position: { x: window.innerWidth / 2, y: Math.max(160, window.innerHeight * 0.32) },
        },
      ]);

      const pulseId = `pulse-${entry.id}-${Date.now()}`;
      setBattlefieldPulse({
        id: pulseId,
        target: classifyPulseTarget(entry.message),
        type: pulseType,
      });
      window.setTimeout(() => {
        setBattlefieldPulse((prev) => (prev?.id === pulseId ? null : prev));
      }, cfg.pulseMs);

      if (cfg.playSounds) {
        if (pulseType === 'damage' || pulseType === 'attack') {
          void playGameUiSound('impact');
        } else if (pulseType === 'play') {
          void playGameUiSound('play');
        }
      }
    }

    // Explicit opponent action banner so player can clearly see enemy moves.
    const latestOpponentEntry = [...fresh].reverse().find((entry) => {
      const msg = String(entry.message || '');
      if (/^Spieler 2 spielt /i.test(msg)) return true;
      if (/^Spieler 2 zieht /i.test(msg)) return true;
      if (/^Phase: (MAIN|ATTACK|END) \(Spieler 2\)/i.test(msg)) return true;
      return false;
    });

    if (latestOpponentEntry) {
      let text = latestOpponentEntry.message;
      const playMatch = /^Spieler 2 spielt (.+)$/i.exec(latestOpponentEntry.message);
      if (playMatch?.[1]) {
        text = language === 'en' ? `Opponent plays: ${playMatch[1]}` : `Gegner spielt: ${playMatch[1]}`;
      } else if (/^Spieler 2 zieht /i.test(latestOpponentEntry.message)) {
        text = language === 'en' ? 'Opponent draws a card' : 'Gegner zieht eine Karte';
      } else if (/^Phase: /i.test(latestOpponentEntry.message)) {
        text = language === 'en'
          ? latestOpponentEntry.message.replace(/\(Spieler 2\)/, '(Opponent)')
          : latestOpponentEntry.message.replace(/\(Spieler 2\)/, '(Gegner)');
      } else {
        text = translateLogMessage(latestOpponentEntry.message);
      }

      setOpponentLiveAction({
        id: latestOpponentEntry.id,
        text,
        cardId: latestOpponentEntry.cardId,
      });
      setOpponentActionQueue((prev) => {
        const next = [{ id: latestOpponentEntry.id, text, cardId: latestOpponentEntry.cardId }, ...prev.filter((p) => p.id !== latestOpponentEntry.id)];
        return next.slice(0, 3);
      });
      window.setTimeout(() => {
        setOpponentLiveAction((prev) => (prev?.id === latestOpponentEntry.id ? null : prev));
      }, 2600);
    }
  }, [gameState?.effectLog.length, classifyPulseTarget, getActionConfig, language, translateLogMessage]);

  const handleCopyEffectSelect = useCallback((card: GameCard) => {
    if (!gameState) return;
    setShowDiscardPicker(false);

    // If the copied action needs a manual target, show target selection
    const needsTarget = card.effects.some(e =>
      e.target === 'any' || e.target === 'enemy_animal' || e.target === 'friendly_animal'
    );

    if (needsTarget) {
      setCopyEffectTarget(card);
      setPendingCard(card);
    } else {
      // Execute directly
      const newState = { ...gameState };
      const pIdx = newState.pendingAction?.playerIndex ?? 0;
      for (const eff of card.effects.filter(e => e.trigger === 'onPlay')) {
        newState.pendingEffects.push({
          effect: eff,
          source: card.id,
          player: pIdx,
        });
      }
      newState.effectLog.push({
        id: `log-${Date.now()}-${Math.random()}`,
        message: `Fox kopiert ${card.name}!`,
        timestamp: Date.now(),
        type: 'effect',
        cardId: card.id,
      });
      newState.pendingAction = undefined;
      const resolved = resolvePendingEffects(newState);
      setGameState(resolved);
    }
  }, [gameState]);

  const handleCopyEffectCancel = useCallback(() => {
    if (!gameState) return;
    setShowDiscardPicker(false);
    const newState = { ...gameState };
    newState.pendingAction = undefined;
    setGameState(newState);
  }, [gameState]);

  const handleSoundSlider = (category: 'master' | 'animal' | 'action' | 'ui', value: number) => {
    setGameSoundVolume(category, value);
    setSoundVolumes(getGameSoundVolumes());
  };

  const toggleSoundMute = () => {
    const next = !soundMuted;
    setGameSoundMuted(next);
    setSoundMuted(next);
  };

  if (!gameState) {
    const startAnimalSvgs = [
      '/game-animals/Turtle.svg',
      '/game-animals/Penguin.svg',
      '/game-animals/Ape.svg',
      '/game-animals/Koala.svg',
      '/game-animals/Bird.svg',
      '/game-animals/Bee.svg',
      '/game-animals/Grasshopper.svg',
      '/game-animals/Duck.svg',
      '/game-animals/Zebra.svg',
      '/game-animals/Cow3.svg',
      '/game-animals/Butterfly.svg',
      '/game-animals/Ant.svg',
      '/game-animals/Rabbit.svg',
      '/game-animals/Chicken.svg',
    ];
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-8">
        {showTutorial && <GameTutorialModal onClose={() => setShowTutorial(false)} />}
        <div className="max-w-[1300px] mx-auto">
          <div className="mb-4 space-y-3">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide">{t('title')}</h1>
              <p className="text-sm text-zinc-300 mt-1">{t('openingHint')}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setLanguage((prev) => (prev === 'de' ? 'en' : 'de'))}
                className="px-3 py-2 text-xs rounded-lg border border-zinc-600 bg-zinc-900 hover:bg-zinc-800"
              >
                {language.toUpperCase()}
              </button>
              <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900/70 p-1">
                {([
                  ['low', t('actionLow')],
                  ['medium', t('actionMedium')],
                  ['high', t('actionHigh')],
                ] as const).map(([lvl, label]) => (
                  <button
                    key={lvl}
                    onClick={() => setActionLevel(lvl)}
                    className={`px-2 py-1 text-[11px] rounded ${actionLevel === lvl ? 'bg-fuchsia-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDensityMode((prev) => (prev === 'ultra' ? 'normal' : 'ultra'))}
                className={`px-3 py-2 text-xs rounded-lg border ${densityMode === 'ultra' ? 'border-orange-500 bg-orange-900/30 text-orange-100' : 'border-zinc-600 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
              >
                {t('ultra')}: {densityMode === 'ultra' ? t('on') : t('off')}
              </button>
              <button
                onClick={toggleSoundMute}
                className={`px-3 py-2 text-xs rounded-lg border ${soundMuted ? 'border-red-500 bg-red-900/30 text-red-100' : 'border-emerald-500 bg-emerald-900/30 text-emerald-100'}`}
              >
                {t('sound')}: {soundMuted ? t('off') : t('on')}
              </button>
            </div>
          </div>
          <div className="mb-6 rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-4 md:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {startAnimalSvgs.map((src) => (
                <div key={src} className="rounded-xl border border-zinc-700 bg-black/30 p-2 h-24 flex items-center justify-center">
                  <img
                    src={src}
                    alt={src}
                    className="max-h-full max-w-full object-contain opacity-90"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>
          </div>
        <div className="text-center">
          <button
            onClick={() => setShowTutorial(true)}
            className="mb-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-sm"
          >
            {t('openTutorial')}
          </button>
          {isAdmin && (
            <div className="mb-6 max-w-[780px] mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setShowDeckBuilder(true)}
                  className="w-full px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold text-lg transition-colors"
                >
                  Admin: Deck Builder (Test Mode)
                </button>
                <button
                  onClick={() => {
                    const randomDeck = createRandomDeck();
                    setAdminDeck(randomDeck);
                  }}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg transition-colors"
                >
                  Generate Random Deck
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                As admin, you can create a test deck from all available cards or generate a random deck
              </p>
              {adminDeck.length === 24 && (
                <p className="text-sm text-green-400 mb-2">
                  Admin Deck ready ({adminDeck.filter(c => c.type === 'animal').length} Animals, {adminDeck.filter(c => c.type === 'action').length} Actions, {adminDeck.filter(c => c.type === 'status').length} Status)
                </p>
              )}
            </div>
          )}
          <div className="space-y-4 max-w-[780px] mx-auto">
            {loadingWalletCards && (
              <div className="text-sm text-gray-400 mb-4">Loading wallet cards...</div>
            )}
            {walletCards.length > 0 && (
              <div className="text-sm text-green-400 mb-4">{walletCards.length} cards found in wallet</div>
            )}
            {walletState.connected && walletCards.length === 0 && !loadingWalletCards && (
              <div className="text-sm text-yellow-400 mb-4">No cards found in wallet - standard deck will be used</div>
            )}
            {!walletState.connected && (
              <div className="text-sm text-gray-400 mb-4">Connect your wallet to use your own cards</div>
            )}
            {walletState.connected && walletCards.length > 0 && !isAdmin && (
              <div className="mb-6">
                <button
                  onClick={() => setShowDeckBuilder(true)}
                  className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition-colors mb-2"
                >
                  {t('buildDeck')}
                </button>
                <p className="text-sm text-gray-400">
                  Select 24 cards from your wallet ({walletCards.length} available)
                </p>
                {userSelectedDeck.length === 24 && (
                  <p className="text-sm text-green-400 mt-2">
                    Deck ready ({userSelectedDeck.filter(c => c.type === 'animal').length} Animals, {userSelectedDeck.filter(c => c.type === 'action').length} Actions, {userSelectedDeck.filter(c => c.type === 'status').length} Status)
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { setGameMode('pvp'); startGame(); }}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-lg transition-colors"
              >
                {t('startPvp')}
              </button>
              <button
                onClick={() => { setGameMode('pve'); startGame(); }}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-lg transition-colors"
              >
                {t('startPve')}
              </button>
            </div>
          </div>
        </div>

        {showDeckBuilder && (
          <>
            {isAdmin ? (
              <DeckBuilderModal
                onClose={() => setShowDeckBuilder(false)}
                onDeckCreated={(deck) => { setAdminDeck(deck); setShowDeckBuilder(false); }}
                currentDeck={adminDeck}
              />
            ) : (
              <WalletDeckBuilderModal
                onClose={() => setShowDeckBuilder(false)}
                onDeckCreated={(deck) => { setUserSelectedDeck(deck); setShowDeckBuilder(false); }}
                currentDeck={userSelectedDeck}
                walletCards={walletCards}
                isAdmin={false}
              />
            )}
          </>
        )}
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayer];
  const opponent = gameState.players[1 - gameState.currentPlayer];
  const isPlayerTurn = gameState.currentPlayer === 0;
  const playableCardsCount = currentPlayer.hand.filter(c => canPlayCard(gameState, 0, c)).length;
  const isUltraCompact = densityMode === 'ultra' || (fitToScreen && viewportHeight < 840);
  const hardNoScroll = fitToScreen && viewportHeight < 930;

  const getNextStepHint = (): string => {
    if (!isPlayerTurn) return `${t('enemyTurn')} (${gameState.phase.toUpperCase()})`;
    if (gameState.phase === 'draw') return language === 'en' ? 'Drawing card...' : 'Karte wird gezogen...';
    if (gameState.phase === 'main') {
      if (playableCardsCount > 0) {
        return language === 'en'
          ? `Play cards (${playableCardsCount} playable) or end MAIN phase`
          : `Spiele Karten (${playableCardsCount} spielbar) oder beende MAIN`;
      }
      return language === 'en' ? 'No playable cards - end MAIN phase' : 'Keine spielbaren Karten - MAIN beenden';
    }
    if (gameState.phase === 'attack') return language === 'en' ? 'Attacks resolve automatically' : 'Angriffe lösen automatisch aus';
    return language === 'en' ? 'End phase effects are resolving' : 'End-Phase-Effekte werden aufgelöst';
  };

  const handleCardClick = (card: GameCard) => {
    if (!isPlayerTurn || gameState.phase !== 'main') return;

    setSelectedCard(card.id);
    void playGameCardSound(card.name, card.type);

    setCardPlayAnimations(prev => new Set(prev).add(card.id));
    setTimeout(() => {
      setCardPlayAnimations(prev => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    }, 1000);

    setActionTexts(prev => [...prev, {
      id: `card-${Date.now()}`,
      text: card.name.toUpperCase(),
      type: 'card',
      position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }]);

    if (card.type === 'action' || card.type === 'status') {
      if (cardNeedsManualTarget(card)) {
        setPendingCard(card);
      } else {
        setGameState(prev => prev ? playCard(prev, 0, card.id) : null);
        setSelectedCard(null);
      }
    } else if (card.type === 'animal') {
      setGameState(prev => prev ? playCard(prev, 0, card.id) : null);
      setSelectedCard(null);
    }
  };

  const handleTargetSelected = (target: string | null) => {
    if (!pendingCard) return;

    if (copyEffectTarget) {
      // This is a target for a copied action (Fox)
      const newState = { ...gameState };
      const pIdx = newState.pendingAction?.playerIndex ?? 0;
      for (const eff of copyEffectTarget.effects.filter(e => e.trigger === 'onPlay')) {
        newState.pendingEffects.push({
          effect: eff,
          source: copyEffectTarget.id,
          target: target || undefined,
          player: pIdx,
        });
      }
      newState.effectLog.push({
        id: `log-${Date.now()}-${Math.random()}`,
        message: `Fox kopiert ${copyEffectTarget.name}!`,
        timestamp: Date.now(),
        type: 'effect',
        cardId: copyEffectTarget.id,
      });
      newState.pendingAction = undefined;
      const resolved = resolvePendingEffects(newState);
      setGameState(resolved);
      setCopyEffectTarget(null);
      setPendingCard(null);
      setSelectedCard(null);
    } else {
      setGameState(prev => prev ? playCard(prev, 0, pendingCard.id, target ?? undefined) : null);
      setPendingCard(null);
      setSelectedCard(null);
    }
  };

  const handleTargetCancel = () => {
    if (copyEffectTarget) {
      setCopyEffectTarget(null);
      // Cancel copy effect, just clear pendingAction
      const newState = { ...gameState };
      newState.pendingAction = undefined;
      setGameState(newState);
    }
    setPendingCard(null);
    setSelectedCard(null);
  };

  const handleEndMainPhase = () => {
    if (isPlayerTurn && gameState.phase === 'main') {
      setGameState(prev => prev ? nextPhase(prev) : null);
    }
  };

  if (gameState.gameOver) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-6 animate-bounce-slow">
            {gameState.winner === 0 ? '🏆' : '💀'}
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 bg-clip-text text-transparent">
            {gameState.winner === 0 ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            {gameState.winner === 0 ? 'Du hast gewonnen!' : 'Der Gegner hat gewonnen.'}
          </p>
          <button
            onClick={() => startGame()}
            className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl font-bold text-xl transition-all hover:scale-105 shadow-lg shadow-red-600/30"
          >
            Nochmal spielen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-black text-white overflow-hidden flex flex-col ${hardNoScroll ? 'p-1.5' : isUltraCompact ? 'p-2' : 'p-3 md:p-4'}`}>
      {/* Game Info Bar */}
      <div className={`max-w-[1600px] w-full mx-auto shrink-0 ${hardNoScroll ? 'mb-1.5' : isUltraCompact ? 'mb-2' : 'mb-3'}`}>
        <div className={`flex flex-col ${hardNoScroll ? 'gap-1.5' : isUltraCompact ? 'gap-2' : 'gap-3'} lg:flex-row lg:items-center lg:justify-between`}>
          <div>
            <h1 className={`${hardNoScroll ? 'text-lg' : isUltraCompact ? 'text-xl' : 'text-2xl'} font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent`}>{t('title')}</h1>
            <p className={`${hardNoScroll ? 'text-[11px]' : isUltraCompact ? 'text-xs' : 'text-sm'} text-gray-400`}>
              Turn {gameState.turnNumber} | {isPlayerTurn ? t('yourTurn') : t('enemyTurn')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setLanguage((prev) => (prev === 'de' ? 'en' : 'de'))}
              title={t('helpLang')}
              className="px-3 py-2 rounded-lg border text-xs font-semibold border-zinc-600 bg-zinc-800 text-zinc-100"
            >
              {language.toUpperCase()}
            </button>
            <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900/70 p-1">
              <span className="px-2 text-[11px] text-zinc-300">{t('actionLevel')}</span>
              {([
                ['low', t('actionLow')],
                ['medium', t('actionMedium')],
                ['high', t('actionHigh')],
              ] as const).map(([lvl, label]) => (
                <button
                  key={lvl}
                  onClick={() => setActionLevel(lvl)}
                  title={t('helpActionLevel')}
                  className={`px-2 py-1 text-[11px] rounded ${actionLevel === lvl ? 'bg-fuchsia-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={toggleSoundMute}
              title={t('helpSound')}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold ${soundMuted ? 'border-red-500 bg-red-900/30 text-red-100' : 'border-emerald-500 bg-emerald-900/30 text-emerald-100'}`}
            >
              {t('sound')}: {soundMuted ? t('off') : t('on')}
            </button>
            <button
              onClick={() => setFitToScreen((prev) => !prev)}
              title={t('helpFit')}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${fitToScreen ? 'border-green-500 bg-green-900/30 text-green-100' : 'border-zinc-600 bg-zinc-800 text-zinc-300'}`}
            >
              Fit: {fitToScreen ? t('on') : t('off')}
            </button>
            <button
              onClick={() => setDensityMode((prev) => (prev === 'ultra' ? 'normal' : 'ultra'))}
              title={t('helpUltra')}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${densityMode === 'ultra' ? 'border-orange-500 bg-orange-900/30 text-orange-100' : 'border-zinc-600 bg-zinc-800 text-zinc-300'}`}
            >
              {t('ultra')}: {densityMode === 'ultra' ? t('on') : t('off')}
            </button>
            <button
              onClick={() => setCompactMode((prev) => !prev)}
              title={t('helpCompact')}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${compactMode ? 'border-cyan-500 bg-cyan-900/30 text-cyan-200' : 'border-zinc-600 bg-zinc-800 text-zinc-300'}`}
            >
              {t('compact')}: {compactMode ? t('on') : t('off')}
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5" title={t('helpScale')}>
              <span className="text-[11px] text-zinc-300">Scale</span>
              <input
                type="range"
                min={54}
                max={104}
                value={boardScale}
                onChange={(e) => setBoardScale(Number(e.target.value))}
                disabled={fitToScreen}
                className="w-20 accent-cyan-500"
              />
              <span className="text-[11px] text-zinc-400 w-8 text-right">{boardScale}%</span>
            </div>
            <button
              onClick={() => setShowCardBank(true)}
              title={t('helpCardBank')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              {t('cardBank')}
            </button>
            <button
              onClick={() => setGameState(null)}
              title={t('helpEnd')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {t('end')}
            </button>
          </div>
        </div>

        {/* Phase Indicator - Enhanced */}
        {!hardNoScroll && (
        <div className={`${isUltraCompact ? 'mt-2' : 'mt-3'} flex items-center gap-2`}>
          {(['draw', 'main', 'attack', 'end'] as GamePhase[]).map((phase, idx) => {
            const isActive = gameState.phase === phase;
            const isPast = ['draw', 'main', 'attack', 'end'].indexOf(gameState.phase) > idx;
            return (
              <React.Fragment key={phase}>
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 ${isPast ? 'bg-green-500' : isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`} />
                )}
                <div className={`${isUltraCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} rounded-lg font-bold transition-all duration-300 ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 scale-110'
                    : isPast
                      ? 'bg-green-900/50 text-green-400 border border-green-700'
                      : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}>
                  {phase.toUpperCase()}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        )}

        <div className={`${hardNoScroll ? 'mt-1.5 px-2 py-1 text-[11px]' : isUltraCompact ? 'mt-2 px-2 py-1 text-xs' : 'mt-3 px-3 py-2 text-sm'} rounded-lg border border-cyan-500/40 bg-cyan-900/20 text-cyan-200`}>
          <span className="font-semibold">{t('nextStep')}:</span> {getNextStepHint()}
        </div>
        <div className={`${hardNoScroll ? 'mt-1' : 'mt-2'} rounded-lg border border-amber-500/30 bg-amber-900/15 px-2 py-1.5`}>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-semibold text-amber-200 mr-1">{t('helpBar')}:</span>
            {([
              ['lang', t('helpTopicLang')],
              ['action', t('helpTopicAction')],
              ['sound', t('helpTopicSound')],
              ['fit', t('helpTopicFit')],
              ['scale', t('helpTopicScale')],
              ['hand', t('helpTopicHand')],
              ['bank', t('helpTopicBank')],
              ['end', t('helpTopicEnd')],
            ] as const).map(([topic, label]) => (
              <button
                key={topic}
                onClick={() => setOpenHelpTopic((prev) => (prev === topic ? null : topic))}
                className={`px-2 py-0.5 rounded border text-[10px] transition-colors ${
                  openHelpTopic === topic
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-zinc-600 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                ? {label}
              </button>
            ))}
          </div>
          {openHelpTopic && (
            <div className="mt-1 text-[11px] text-amber-100 leading-relaxed">
              {t(HELP_TOPIC_TEXT_KEY[openHelpTopic])}
            </div>
          )}
        </div>
        {!isUltraCompact && !hardNoScroll && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 p-2">
          {([
            ['master', 'Master', t('helpSoundMaster')],
            ['animal', language === 'en' ? 'Animal' : 'Tier', t('helpSoundAnimal')],
            ['action', language === 'en' ? 'Action' : 'Aktion', t('helpSoundAction')],
            ['ui', 'UI', t('helpSoundUi')],
          ] as const).map(([key, label, hint]) => (
            <label key={key} className="flex items-center gap-2 rounded bg-zinc-800/80 px-2 py-1" title={hint}>
              <span className="text-[11px] text-zinc-300 w-10">{label}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(soundVolumes[key] * 100)}
                onChange={(e) => handleSoundSlider(key, Number(e.target.value) / 100)}
                disabled={soundMuted}
                className="w-full accent-red-500"
              />
              <span className="text-[10px] text-zinc-400 w-7 text-right">{Math.round(soundVolumes[key] * 100)}</span>
            </label>
          ))}
        </div>
        )}
      </div>

      <div className={`max-w-[1700px] w-full mx-auto grid grid-cols-1 ${hardNoScroll ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : isUltraCompact ? 'xl:grid-cols-[minmax(0,1fr)_300px]' : 'xl:grid-cols-[minmax(0,1fr)_360px]'} ${hardNoScroll ? 'gap-2' : 'gap-3'} items-start flex-1 min-h-0`}>
        <div className={`flex flex-col ${isUltraCompact ? 'gap-2' : 'gap-3'} min-h-0 overflow-hidden`}>
          {/* Game Board */}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <GameBoardView
              gameState={gameState}
              isPlayerTurn={isPlayerTurn}
              attackingAnimal={attackingAnimal}
              compactMode={compactMode || isUltraCompact}
              ultraCompact={isUltraCompact}
              boardScale={boardScale}
              emphasis={{
                player: battlefieldPulse?.target === 'player',
                opponent: battlefieldPulse?.target === 'opponent',
                center: battlefieldPulse?.target === 'center',
                type: battlefieldPulse?.type,
              }}
              onPlayerAnimalClick={(animal) => {
                if (isPlayerTurn && gameState.phase === 'attack') {
                  setAttackingAnimal(animal.id);
                  setActionTexts(prev => [...prev, {
                    id: `attack-${Date.now()}`,
                    text: 'ATTACK!',
                    type: 'attack',
                    position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
                  }]);
                }
              }}
            />

            {opponentLiveAction && (
              <div className="absolute left-1/2 top-2 -translate-x-1/2 z-40 pointer-events-none">
                <div className="flex items-center gap-2 rounded-xl border border-red-400/70 bg-black/80 px-3 py-2 shadow-[0_0_24px_rgba(239,68,68,0.35)] animate-pulse">
                  {opponentLiveAction.cardId && (
                    <img
                      src={getCardImageUrl(ALL_GAME_CARDS.find((c) => c.id === opponentLiveAction.cardId)?.inscriptionId || '')}
                      alt="opponent-action-card"
                      className="h-10 w-10 rounded object-cover border border-red-400/50 bg-zinc-900"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="text-sm md:text-base font-bold text-red-200 tracking-wide">
                    {opponentLiveAction.text}
                  </div>
                </div>
              </div>
            )}

            {/* Damage Animations */}
            {damageAnimations.map(damage => (
              <div
                key={damage.id}
                className="absolute text-red-500 font-bold text-3xl pointer-events-none z-50 animate-damage-float"
                style={{
                  left: '50%',
                  top: damage.target === 'opponent-life' ? '25%' : '75%',
                  transform: 'translateX(-50%)',
                }}
                onAnimationEnd={() => {
                  setDamageAnimations(prev => prev.filter(d => d.id !== damage.id));
                }}
              >
                -{damage.amount}
              </div>
            ))}
          </div>

          {/* Player Hand Area */}
          <div className={`bg-gray-900 rounded-lg border-2 border-blue-600 ${(compactMode || isUltraCompact || hardNoScroll) ? 'p-2' : 'p-4'} shrink-0`}>
          <div className="flex justify-between items-center mb-2">
            <div className="relative w-full">
              {isPlayerTurn && gameState.phase === 'main' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-xs text-green-400 bg-green-900/30 px-3 py-1 rounded border border-green-600">
                    {t('playable')}: {currentPlayer.hand.filter(c => canPlayCard(gameState, 0, c)).length} / {currentPlayer.hand.length}
                  </div>
                  <div className="text-xs text-blue-400 bg-blue-900/30 px-3 py-1 rounded border border-blue-600">
                    {t('animalsShort')}: {currentPlayer.animalsPlayedThisTurn}/1 | {t('boardShort')}: {currentPlayer.board.length}/5
                  </div>
                  <button
                    onClick={handleEndMainPhase}
                    title={t('helpMainEnd')}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold ml-auto transition-colors"
                  >
                    {t('mainEnd')}
                  </button>
                </div>
              )}
              {isPlayerTurn && gameState.phase !== 'main' && (
                <div className="text-xs text-yellow-400 bg-yellow-900/30 px-3 py-1 rounded border border-yellow-600 inline-block">
                  {t('waitingPhase', { phase: gameState.phase.toUpperCase() })}
                </div>
              )}
              {!isPlayerTurn && (
                <div className="text-xs text-gray-400 bg-gray-800/50 px-3 py-1 rounded border border-gray-600 inline-block">
                  {t('waitingEnemy')}
                </div>
              )}
            </div>
          </div>

          {/* Player Hand */}
          <div className="mt-2">
            <div className="text-sm font-semibold mb-2">
              {t('yourHand')} {!isPlayerTurn && `(${t('enemyTurn')})`}:
            </div>
            <div className={`flex gap-2 overflow-x-auto ${hardNoScroll ? 'pb-1' : 'pb-2'}`}>
              {currentPlayer.hand.map(card => {
                const canPlay = canPlayCard(gameState, 0, card);
                const cannotPlayReason = getCardPlayabilityReason(gameState, 0, card);

                return (
                  <div
                    key={card.id}
                    onClick={() => canPlay && handleCardClick(card)}
                    onMouseEnter={() => handleCardMouseEnter(card.id)}
                    onMouseLeave={handleCardMouseLeave}
                    className={`
                      bg-gray-800 rounded-lg border-2 transition-all relative overflow-hidden
                      ${hardNoScroll ? 'p-1 min-w-[78px] max-w-[86px]' : isUltraCompact ? 'p-1.5 min-w-[84px] max-w-[92px]' : compactMode ? 'p-2 min-w-[102px] max-w-[112px]' : 'p-3 min-w-[118px] max-w-[132px]'}
                      ${canPlay
                        ? 'border-green-500 hover:border-green-300 hover:scale-105 cursor-pointer shadow-lg shadow-green-500/30'
                        : 'border-gray-600 opacity-50 cursor-not-allowed'
                      }
                      ${selectedCard === card.id ? 'ring-2 ring-yellow-400' : ''}
                      ${cardPlayAnimations.has(card.id) ? 'animate-card-play scale-110 border-yellow-400 shadow-xl shadow-yellow-400/70' : ''}
                    `}
                  >
                    {cardPlayAnimations.has(card.id) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="text-4xl animate-spin">✨</div>
                      </div>
                    )}
                    {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                      <img
                        src={getCardImageUrl(card.inscriptionId)}
                        alt={card.name}
                        className={`w-full object-contain mb-1 ${hardNoScroll ? 'h-12' : isUltraCompact ? 'h-16' : compactMode ? 'h-24' : 'h-28'}`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className={`${isUltraCompact ? 'text-[10px]' : 'text-xs'} font-bold truncate`}>{card.name}</div>
                    {card.type === 'animal' && (
                      <div className={`${isUltraCompact ? 'text-[10px]' : 'text-xs'} mt-1`}>{card.atk}/{card.hp}</div>
                    )}
                    {!isUltraCompact && <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">{card.effectText}</div>}
                    {!canPlay && cannotPlayReason && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded z-10">
                        <div className="text-[10px] text-red-400 text-center px-2 font-semibold">
                          {cannotPlayReason}
                        </div>
                      </div>
                    )}
                    {canPlay && isPlayerTurn && gameState.phase === 'main' && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold z-10">
                        ✓
                      </div>
                    )}
                    {hoveredCard === card.id && (
                      <div className="absolute inset-0 z-20 bg-black/92 border border-cyan-500/60 rounded-lg p-2 overflow-y-auto">
                        <div className="text-[11px] font-bold text-cyan-200 mb-1">{card.name}</div>
                        <div className="text-[10px] text-gray-200 mb-1">
                          <span className="font-semibold">{t('cardType')}:</span> {card.type === 'animal' ? t('typeAnimal') : card.type === 'action' ? t('typeAction') : t('typeStatus')}
                        </div>
                        {card.type === 'animal' && (
                          <div className="text-[10px] text-gray-200 mb-1">
                            <span className="font-semibold">{t('cardStats')}:</span> {card.atk}/{card.hp}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-200">
                          <span className="font-semibold">{t('cardEffect')}:</span> {card.effectText}
                        </div>
                        {card.effects.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-700">
                            <div className="text-[10px] text-gray-300">
                              {card.effects.map((effect, idx) => (
                                <div key={idx} className="mb-1">
                                  <span className="font-semibold text-orange-400">{effect.trigger}:</span> {effect.action.replace(/_/g, ' ')}
                                  {effect.target && ` → ${effect.target}`}
                                  {effect.value && ` (${effect.value})`}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>

        {/* Effect Log - desktop right side */}
        <div className={`xl:sticky ${isUltraCompact ? 'xl:top-1' : 'xl:top-2'} space-y-2 h-full min-h-0 ${hardNoScroll ? 'overflow-hidden' : 'overflow-auto'} pr-1`}>
          {!hardNoScroll && (
          <div className={`rounded-xl border border-red-500/40 bg-red-900/20 ${isUltraCompact ? 'p-2' : 'p-3'}`} title={t('opponentQueue')}>
            <div className="text-xs font-bold tracking-wide text-red-200 mb-2">{t('opponentQueue')}</div>
            <div className="space-y-2">
              {opponentActionQueue.length === 0 && (
                <div className="text-xs text-red-100/60">{t('noOpponentQueue')}</div>
              )}
              {opponentActionQueue.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-black/30 border border-red-500/30 px-2 py-1.5">
                  {item.cardId && (
                    <img
                      src={getCardImageUrl(ALL_GAME_CARDS.find((c) => c.id === item.cardId)?.inscriptionId || '')}
                      alt="enemy-card"
                      className="h-8 w-8 rounded object-cover border border-red-400/30 bg-zinc-900"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="text-[11px] leading-tight text-red-100">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
          )}
          <EffectLog entries={gameState.effectLog} maxEntries={hardNoScroll ? 12 : isUltraCompact ? 16 : 28} language={language} />
        </div>
      </div>

      {/* Target Selection Modal */}
      {pendingCard && gameState && (
        <TargetSelectionModal
          card={pendingCard}
          gameState={gameState}
          onSelectTarget={handleTargetSelected}
          onCancel={handleTargetCancel}
        />
      )}

      {/* Opponent Hand Modal */}
      {showOpponentHand && gameState && opponentHandAction && (
        <OpponentHandModal
          cards={gameState.players[1].hand}
          onSelectCard={(cardId) => {
            opponentHandAction(cardId);
            setShowOpponentHand(false);
            setOpponentHandAction(null);
          }}
          onCancel={() => {
            setShowOpponentHand(false);
            setOpponentHandAction(null);
          }}
        />
      )}

      {/* Discard Pile Picker (Fox copy_effect) */}
      {showDiscardPicker && gameState && (
        <DiscardPilePickerModal
          actionCards={[
            ...gameState.players[0].discard.filter(c => c.type === 'action'),
            ...gameState.players[1].discard.filter(c => c.type === 'action'),
          ]}
          onSelectCard={handleCopyEffectSelect}
          onCancel={handleCopyEffectCancel}
        />
      )}

      {/* Action Text Animations */}
      {actionTexts.map(action => (
        <ActionText
          key={action.id}
          id={action.id}
          text={action.text}
          type={action.type}
          position={action.position}
          onComplete={(id) => {
            setActionTexts(prev => prev.filter(a => a.id !== id));
          }}
        />
      ))}

      {/* Card Bank Modal */}
      {gameState && (
        <CardBank
          isOpen={showCardBank}
          onClose={() => setShowCardBank(false)}
          playerDeck={gameState.players[0].deck}
          playerHand={gameState.players[0].hand}
          playerDiscard={gameState.players[0].discard}
        />
      )}
    </div>
  );
};
