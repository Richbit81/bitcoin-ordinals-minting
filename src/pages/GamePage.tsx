import React, { useState, useEffect } from 'react';
import { GameState, createGameState, nextPhase, playCard, drawCard, GamePhase, createStandardDeck, createDeckFromWalletCards, canPlayCard } from '../game/gameEngine';
import { GameCard, ALL_GAME_CARDS, GAME_ANIMAL_CARDS, GAME_ACTION_CARDS, GAME_STATUS_CARDS, STATUS_CATEGORIES } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';
import { makeAIMove } from '../game/aiLogic';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { DeckBuilderModal } from '../components/DeckBuilderModal';
import { TargetSelectionModal } from '../components/TargetSelectionModal';
import { EffectLog } from '../components/EffectLog';
import { OpponentHandModal } from '../components/OpponentHandModal';
import { GameTutorialModal } from '../components/GameTutorialModal';
import { fetchWalletCards, WalletCard } from '../services/gallery';

export const GamePage: React.FC = () => {
  const { walletState } = useWallet();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'pvp' | 'pve'>('pvp');
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [adminDeck, setAdminDeck] = useState<GameCard[]>([]);
  const [walletCards, setWalletCards] = useState<WalletCard[]>([]);
  const [loadingWalletCards, setLoadingWalletCards] = useState(false);
  const [pendingCard, setPendingCard] = useState<GameCard | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showOpponentHand, setShowOpponentHand] = useState(false);
  const [opponentHandAction, setOpponentHandAction] = useState<((cardId: string) => void) | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Prüfe ob Admin
  const isAdmin = walletState.connected && 
                  walletState.accounts.length > 0 &&
                  isAdminAddress(walletState.accounts[0].address);

  // Lade Wallet-Karten beim Verbinden
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
      console.log('[GamePage] 🔍 Lade Wallet-Karten...');
      const cards = await fetchWalletCards(walletState.accounts[0].address);
      console.log(`[GamePage] ✅ ${cards.length} Wallet-Karten geladen`);
      setWalletCards(cards);
    } catch (error) {
      console.error('[GamePage] ❌ Fehler beim Laden der Wallet-Karten:', error);
      setWalletCards([]);
    } finally {
      setLoadingWalletCards(false);
    }
  };

  // Initialisiere Spiel
  const startGame = (customDeck1?: GameCard[], customDeck2?: GameCard[]) => {
    let deck1: GameCard[];
    
    // Verwende Admin-Deck wenn vorhanden, sonst Wallet-Karten, sonst Standard-Deck
    if (customDeck1) {
      deck1 = customDeck1;
    } else if (isAdmin && adminDeck.length === 24) {
      deck1 = adminDeck;
    } else if (walletCards.length > 0) {
      console.log('[GamePage] 🎴 Erstelle Deck aus Wallet-Karten...');
      deck1 = createDeckFromWalletCards(walletCards);
      if (deck1.length < 10) {
        console.log('[GamePage] ⚠️ Zu wenige Wallet-Karten, verwende Standard-Deck');
        deck1 = createStandardDeck();
      }
    } else {
      deck1 = createStandardDeck();
    }
    
    const deck2 = customDeck2 || createStandardDeck();
    const newState = createGameState(deck1, deck2, gameMode);
    setGameState(newState);
  };
  

  // Prüfe pendingAction (z.B. look_hand)
  useEffect(() => {
    if (!gameState || !gameState.pendingAction) return;

    if (gameState.pendingAction.type === 'look_hand') {
      setShowOpponentHand(true);
      setOpponentHandAction((cardId: string) => {
        // Erstelle neuen State mit discard_card Effekt
        const newState = { ...gameState };
        const targetPlayer = newState.players[gameState.pendingAction!.playerIndex];
        const cardIndex = targetPlayer.hand.findIndex(c => c.id === cardId);
        
        if (cardIndex !== -1) {
          const discardedCard = targetPlayer.hand.splice(cardIndex, 1)[0];
          targetPlayer.discard.push(discardedCard);
          // Log
          newState.effectLog.push({
            id: `log-${Date.now()}-${Math.random()}`,
            message: `Karte ${discardedCard.name} wird verworfen`,
            timestamp: Date.now(),
            type: 'effect',
          });
        }
        
        // Entferne pendingAction
        newState.pendingAction = undefined;
        setGameState(newState);
      });
    }
  }, [gameState?.pendingAction]);

  // Automatische Phasen-Wechsel und AI-Züge
  useEffect(() => {
    if (!gameState || gameState.gameOver) return;

    // AI-Zug in Main Phase
    if (gameState.mode === 'pve' && gameState.currentPlayer === 1 && gameState.phase === 'main') {
      const timer = setTimeout(() => {
        const aiMove = makeAIMove(gameState);
        if (aiMove) {
          setGameState(aiMove);
        } else {
          // AI beendet Main Phase
          setGameState(prev => prev ? nextPhase(prev) : null);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Draw Phase: Automatisch
    if (gameState.phase === 'draw') {
      const timer = setTimeout(() => {
        setGameState(prev => prev ? nextPhase(prev) : null);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Attack Phase: Automatisch
    if (gameState.phase === 'attack') {
      const timer = setTimeout(() => {
        setGameState(prev => prev ? nextPhase(prev) : null);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // End Phase: Automatisch
    if (gameState.phase === 'end') {
      const timer = setTimeout(() => {
        setGameState(prev => prev ? nextPhase(prev) : null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, gameState?.currentPlayer, gameState?.mode]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        {showTutorial && <GameTutorialModal onClose={() => setShowTutorial(false)} />}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">🖤 BLACK & WILD</h1>
          <button
            onClick={() => setShowTutorial(true)}
            className="mb-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-sm"
          >
            📖 Tutorial anzeigen
          </button>
          {isAdmin && (
            <div className="mb-6">
              <button
                onClick={() => setShowDeckBuilder(true)}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold text-lg transition-colors mb-4"
              >
                🎴 Admin: Deck Builder (Test Mode)
              </button>
              <p className="text-sm text-gray-400 mb-4">
                As admin, you can create a test deck from all available cards
              </p>
            </div>
          )}
          <div className="space-y-4">
            {loadingWalletCards && (
              <div className="text-sm text-gray-400 mb-4">
                🔄 Loading wallet cards...
              </div>
            )}
            {walletCards.length > 0 && (
              <div className="text-sm text-green-400 mb-4">
                ✅ {walletCards.length} cards found in wallet - these will be used for your deck!
              </div>
            )}
            {walletState.connected && walletCards.length === 0 && !loadingWalletCards && (
              <div className="text-sm text-yellow-400 mb-4">
                ⚠️ No cards found in wallet - standard deck will be used
              </div>
            )}
            {!walletState.connected && (
              <div className="text-sm text-gray-400 mb-4">
                ℹ️ Connect your wallet to use your own cards
              </div>
            )}
            <button
              onClick={() => {
                setGameMode('pvp');
                startGame();
              }}
              className="w-64 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-lg transition-colors"
            >
              Player vs Player
            </button>
            <button
              onClick={() => {
                setGameMode('pve');
                startGame();
              }}
              className="w-64 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-lg transition-colors"
            >
              Player vs AI
            </button>
          </div>
        </div>
        
        {/* Admin Deck Builder Modal */}
        {isAdmin && showDeckBuilder && (
          <DeckBuilderModal
            onClose={() => setShowDeckBuilder(false)}
            onDeckCreated={(deck) => {
              setAdminDeck(deck);
              setShowDeckBuilder(false);
            }}
            currentDeck={adminDeck}
          />
        )}
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayer];
  const opponent = gameState.players[1 - gameState.currentPlayer];
  const isPlayerTurn = gameState.currentPlayer === 0;

  const handleCardClick = (card: GameCard) => {
    if (!isPlayerTurn || gameState.phase !== 'main') return;
    
    setSelectedCard(card.id);
    
    // Wenn Action oder Status: Frage nach Ziel
    if (card.type === 'action' || card.type === 'status') {
      // Prüfe ob Ziel benötigt wird
      const needsTarget = card.effects.some(e => e.target && e.target !== 'self');
      if (needsTarget) {
        setPendingCard(card);
      } else {
        // Kein Ziel benötigt, direkt spielen
        setGameState(prev => prev ? playCard(prev, 0, card.id) : null);
        setSelectedCard(null);
      }
    } else if (card.type === 'animal') {
      // Tier: Direkt spielen
      setGameState(prev => prev ? playCard(prev, 0, card.id) : null);
      setSelectedCard(null);
    }
  };

  const handleTargetSelected = (target: string | null) => {
    if (!pendingCard) return;
    
    setGameState(prev => prev ? playCard(prev, 0, pendingCard.id, target) : null);
    setPendingCard(null);
    setSelectedCard(null);
  };

  const handleTargetCancel = () => {
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
      <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            {gameState.winner === 0 ? '🎉 You won!' : '💀 You lost!'}
          </h1>
          <button
            onClick={startGame}
            className="mt-8 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* Game Info */}
      <div className="max-w-[1600px] mx-auto mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🖤 BLACK & WILD</h1>
            <p className="text-sm text-gray-400">
              Turn {gameState.turnNumber} | Phase: {gameState.phase.toUpperCase()} | 
              {isPlayerTurn ? ' Your Turn' : ' Opponent Turn'}
            </p>
          </div>
          <button
            onClick={() => setGameState(null)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            End Game
          </button>
        </div>
      </div>

      {/* Opponent Area */}
      <div className="max-w-[1600px] mx-auto mb-4">
        <div className="bg-gray-900 rounded-lg p-4 border-2 border-red-600">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-bold">Opponent</span>
              <span className="ml-4">Life: {opponent.life}</span>
              <span className="ml-4">Deck: {opponent.deck.length}</span>
              <span className="ml-4">Hand: {opponent.hand.length}</span>
              {opponent.statuses.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {opponent.statuses.map((statusId, idx) => {
                    const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                    if (!statusCard) return null;
                    const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                    const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                    return (
                      <span
                        key={idx}
                        className={`text-[10px] px-2 py-1 rounded ${
                          isNegative ? 'bg-red-600 text-white' :
                          isPositive ? 'bg-green-600 text-white' :
                          'bg-yellow-600 text-black'
                        }`}
                        title={statusCard.effectText}
                      >
                        {statusCard.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Opponent Board */}
          <div className="flex gap-2 mt-4">
            {opponent.board.map(animal => (
              <div
                key={animal.id}
                className="bg-gray-800 rounded p-2 border border-gray-600 min-w-[100px] relative overflow-hidden"
              >
                {animal.card.inscriptionId && !animal.card.inscriptionId.includes('placeholder') && (
                  <img
                    src={getCardImageUrl(animal.card.inscriptionId)}
                    alt={animal.card.name}
                    className="w-full h-20 object-contain mb-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="text-xs font-bold">{animal.card.name}</div>
                <div className="text-xs">
                  {animal.currentAtk}/{animal.currentHp}
                </div>
                {animal.statuses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {animal.statuses.map((statusId, idx) => {
                      const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                      if (!statusCard) return null;
                      const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                      const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                      return (
                        <span
                          key={idx}
                          className={`text-[8px] px-1 py-0.5 rounded ${
                            isNegative ? 'bg-red-600 text-white' :
                            isPositive ? 'bg-green-600 text-white' :
                            'bg-yellow-600 text-black'
                          }`}
                          title={statusCard.effectText}
                        >
                          {statusCard.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Player Area */}
      <div className="max-w-[1600px] mx-auto mb-4">
        <div className="bg-gray-900 rounded-lg p-4 border-2 border-blue-600">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-bold">You</span>
              <span className="ml-4">Life: {currentPlayer.life}</span>
              <span className="ml-4">Deck: {currentPlayer.deck.length}</span>
              <span className="ml-4">Hand: {currentPlayer.hand.length}</span>
              {currentPlayer.statuses.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentPlayer.statuses.map((statusId, idx) => {
                    const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                    if (!statusCard) return null;
                    const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                    const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                    return (
                      <span
                        key={idx}
                        className={`text-[10px] px-2 py-1 rounded ${
                          isNegative ? 'bg-red-600 text-white' :
                          isPositive ? 'bg-green-600 text-white' :
                          'bg-yellow-600 text-black'
                        }`}
                        title={statusCard.effectText}
                      >
                        {statusCard.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {isPlayerTurn && gameState.phase === 'main' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs text-green-400 bg-green-900/30 px-3 py-1 rounded border border-green-600">
                  ✅ Playable: {currentPlayer.hand.filter(c => canPlayCard(gameState, 0, c)).length} / {currentPlayer.hand.length} cards
                </div>
                <div className="text-xs text-blue-400 bg-blue-900/30 px-3 py-1 rounded border border-blue-600">
                  🐾 Animals: {currentPlayer.animalsPlayedThisTurn}/1 this turn | Board: {currentPlayer.board.length}/5
                </div>
                <div className="text-xs text-purple-400 bg-purple-900/30 px-3 py-1 rounded border border-purple-600">
                  ⚡ Action/Status: Unlimited
                </div>
                <button
                  onClick={handleEndMainPhase}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold ml-auto"
                >
                  End Main Phase
                </button>
              </div>
            )}
            {isPlayerTurn && gameState.phase !== 'main' && (
              <div className="text-xs text-yellow-400 bg-yellow-900/30 px-3 py-1 rounded border border-yellow-600 inline-block">
                ⏳ Wait for {gameState.phase.toUpperCase()} phase to finish...
              </div>
            )}
          </div>

          {/* Player Board */}
          <div className="flex gap-2 mt-4 mb-4">
            {currentPlayer.board.map(animal => (
              <div
                key={animal.id}
                className="bg-gray-800 rounded p-2 border border-blue-400 min-w-[100px] cursor-pointer hover:border-blue-300 relative overflow-hidden"
              >
                {animal.card.inscriptionId && !animal.card.inscriptionId.includes('placeholder') && (
                  <img
                    src={getCardImageUrl(animal.card.inscriptionId)}
                    alt={animal.card.name}
                    className="w-full h-20 object-contain mb-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="text-xs font-bold">{animal.card.name}</div>
                <div className="text-xs">
                  {animal.currentAtk}/{animal.currentHp}
                </div>
                {animal.statuses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {animal.statuses.map((statusId, idx) => {
                      const statusCard = ALL_GAME_CARDS.find(c => c.id === statusId);
                      if (!statusCard) return null;
                      const isNegative = STATUS_CATEGORIES.negative.includes(statusCard.name);
                      const isPositive = STATUS_CATEGORIES.positive.includes(statusCard.name);
                      return (
                        <span
                          key={idx}
                          className={`text-[8px] px-1 py-0.5 rounded ${
                            isNegative ? 'bg-red-600 text-white' :
                            isPositive ? 'bg-green-600 text-white' :
                            'bg-yellow-600 text-black'
                          }`}
                          title={statusCard.effectText}
                        >
                          {statusCard.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Player Hand */}
          {isPlayerTurn && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Hand:</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {currentPlayer.hand.map(card => {
                  // Verwende canPlayCard Funktion für konsistente Prüfung
                  const canPlay = canPlayCard(gameState, 0, card);
                  
                  // Detaillierte Gründe warum Karte nicht gespielt werden kann
                  let cannotPlayReason: string | null = null;
                  if (!canPlay) {
                    if (gameState.phase !== 'main') {
                      cannotPlayReason = `Can only play in MAIN phase (current: ${gameState.phase.toUpperCase()})`;
                    } else if (card.type === 'animal') {
                      if (currentPlayer.animalsPlayedThisTurn >= 1) {
                        cannotPlayReason = 'Already played 1 animal this turn';
                      } else if (currentPlayer.board.length >= 5) {
                        cannotPlayReason = 'Board full (max. 5 animals)';
                      }
                    } else if (card.type === 'action' || card.type === 'status') {
                      // Action/Status Karten können immer gespielt werden (außer in falscher Phase)
                      cannotPlayReason = null; // Sollte eigentlich spielbar sein
                    }
                  }

                  return (
                    <div
                      key={card.id}
                      onClick={() => canPlay && handleCardClick(card)}
                      onMouseEnter={() => setHoveredCard(card.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      className={`
                        bg-gray-800 rounded p-3 border-2 min-w-[120px] transition-all relative overflow-hidden
                        ${canPlay 
                          ? 'border-green-500 hover:border-green-300 hover:scale-105 cursor-pointer shadow-lg shadow-green-500/50' 
                          : 'border-gray-600 opacity-50 cursor-not-allowed'
                        }
                        ${selectedCard === card.id ? 'ring-2 ring-yellow-400' : ''}
                      `}
                    >
                      {/* Kartenbild */}
                      {card.inscriptionId && !card.inscriptionId.includes('placeholder') && (
                        <img
                          src={getCardImageUrl(card.inscriptionId)}
                          alt={card.name}
                          className="w-full h-32 object-contain mb-2"
                          onError={(e) => {
                            // Fallback auf Text-Anzeige
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="text-xs font-bold">{card.name}</div>
                      {card.type === 'animal' && (
                        <div className="text-xs mt-1">
                          {card.atk}/{card.hp}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">
                        {card.effectText}
                      </div>
                      {/* Warum kann Karte nicht gespielt werden? */}
                      {!canPlay && cannotPlayReason && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded z-10">
                          <div className="text-[10px] text-red-400 text-center px-2 font-semibold">
                            ⚠️ {cannotPlayReason}
                          </div>
                        </div>
                      )}
                      {/* Spielbar-Indikator */}
                      {canPlay && isPlayerTurn && gameState.phase === 'main' && (
                        <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold z-10">
                          ✓
                        </div>
                      )}
                      {/* Tooltip */}
                      {hoveredCard === card.id && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 border-2 border-red-600 rounded-lg p-3 z-50 shadow-xl">
                          <div className="text-sm font-bold text-white mb-2">{card.name}</div>
                          <div className="text-xs text-gray-300 mb-2">
                            <span className="font-semibold">Type:</span> {card.type === 'animal' ? 'Animal' : card.type === 'action' ? 'Action' : 'Status'}
                          </div>
                          {card.type === 'animal' && (
                            <div className="text-xs text-gray-300 mb-2">
                              <span className="font-semibold">ATK/HP:</span> {card.atk}/{card.hp}
                            </div>
                          )}
                          <div className="text-xs text-gray-300">
                            <span className="font-semibold">Effect:</span> {card.effectText}
                          </div>
                          {card.effects.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="text-[10px] text-gray-400">
                                {card.effects.map((effect, idx) => (
                                  <div key={idx} className="mb-1">
                                    <span className="font-semibold">{effect.trigger}:</span> {effect.action}
                                    {effect.target && ` → ${effect.target}`}
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
          )}
        </div>
      </div>

      {/* Phase Indicator */}
      <div className="max-w-[1600px] mx-auto text-center mb-4">
        <div className="inline-flex gap-2 bg-gray-900 rounded-lg p-2">
          {(['draw', 'main', 'attack', 'end'] as GamePhase[]).map(phase => (
            <div
              key={phase}
              className={`px-4 py-2 rounded ${
                gameState.phase === phase
                  ? 'bg-red-600 font-bold'
                  : 'bg-gray-700'
              }`}
            >
              {phase.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Effect Log - Jetzt unten */}
      <div className="max-w-[1600px] mx-auto">
        <EffectLog entries={gameState.effectLog} maxEntries={15} />
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
    </div>
  );
};

