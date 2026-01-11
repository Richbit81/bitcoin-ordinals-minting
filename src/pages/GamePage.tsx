import React, { useState, useEffect } from 'react';
import { GameState, createGameState, nextPhase, playCard, drawCard, GamePhase, createStandardDeck } from '../game/gameEngine';
import { GameCard, ALL_GAME_CARDS, GAME_ANIMAL_CARDS, GAME_ACTION_CARDS, GAME_STATUS_CARDS } from '../game/gameCards';
import { getCardImageUrl } from '../game/cardImageService';
import { makeAIMove } from '../game/aiLogic';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { DeckBuilderModal } from '../components/DeckBuilderModal';

export const GamePage: React.FC = () => {
  const { walletState } = useWallet();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'pvp' | 'pve'>('pvp');
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [adminDeck, setAdminDeck] = useState<GameCard[]>([]);
  
  // Prüfe ob Admin
  const isAdmin = walletState.connected && 
                  walletState.accounts.length > 0 &&
                  isAdminAddress(walletState.accounts[0].address);

  // Initialisiere Spiel
  const startGame = (customDeck1?: GameCard[], customDeck2?: GameCard[]) => {
    const deck1 = customDeck1 || createStandardDeck();
    const deck2 = customDeck2 || createStandardDeck();
    const newState = createGameState(deck1, deck2, gameMode);
    setGameState(newState);
  };
  

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
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">🖤 BLACK & WILD</h1>
          {isAdmin && (
            <div className="mb-6">
              <button
                onClick={() => setShowDeckBuilder(true)}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold text-lg transition-colors mb-4"
              >
                🎴 Admin: Deck Builder (Test-Modus)
              </button>
              <p className="text-sm text-gray-400 mb-4">
                Als Admin kannst du ein Test-Deck aus allen verfügbaren Karten erstellen
              </p>
            </div>
          )}
          <div className="space-y-4">
            <button
              onClick={() => {
                setGameMode('pvp');
                if (isAdmin && adminDeck.length === 24) {
                  startGame(adminDeck, createStandardDeck());
                } else {
                  startGame();
                }
              }}
              className="w-64 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-lg transition-colors"
            >
              Player vs Player
            </button>
            <button
              onClick={() => {
                setGameMode('pve');
                if (isAdmin && adminDeck.length === 24) {
                  startGame(adminDeck, createStandardDeck());
                } else {
                  startGame();
                }
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
      // TODO: Zeige Ziel-Auswahl
      setGameState(prev => prev ? playCard(prev, 0, card.id) : null);
      setSelectedCard(null);
    } else if (card.type === 'animal') {
      // Tier: Direkt spielen
      setGameState(prev => prev ? playCard(prev, 0, card.id) : null);
      setSelectedCard(null);
    }
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
            {gameState.winner === 0 ? '🎉 Du hast gewonnen!' : '💀 Du hast verloren!'}
          </h1>
          <button
            onClick={startGame}
            className="mt-8 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
          >
            Nochmal spielen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* Game Info */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🖤 BLACK & WILD</h1>
            <p className="text-sm text-gray-400">
              Turn {gameState.turnNumber} | Phase: {gameState.phase.toUpperCase()} | 
              {isPlayerTurn ? ' Dein Zug' : ' Gegner Zug'}
            </p>
          </div>
          <button
            onClick={() => setGameState(null)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Beenden
          </button>
        </div>
      </div>

      {/* Opponent Area */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-gray-900 rounded-lg p-4 border-2 border-red-600">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-bold">Gegner</span>
              <span className="ml-4">Life: {opponent.life}</span>
              <span className="ml-4">Deck: {opponent.deck.length}</span>
              <span className="ml-4">Hand: {opponent.hand.length}</span>
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
                  <div className="text-xs text-yellow-400 mt-1">
                    {animal.statuses.length} Status
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Player Area */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-gray-900 rounded-lg p-4 border-2 border-blue-600">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-bold">Du</span>
              <span className="ml-4">Life: {currentPlayer.life}</span>
              <span className="ml-4">Deck: {currentPlayer.deck.length}</span>
              <span className="ml-4">Hand: {currentPlayer.hand.length}</span>
            </div>
            {isPlayerTurn && gameState.phase === 'main' && (
              <button
                onClick={handleEndMainPhase}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                End Main Phase
              </button>
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
                  <div className="text-xs text-yellow-400 mt-1">
                    {animal.statuses.length} Status
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
                  const canPlay = gameState.phase === 'main' && 
                    (card.type !== 'animal' || (currentPlayer.animalsPlayedThisTurn < 1 && currentPlayer.board.length < 5));
                  
                  return (
                    <div
                      key={card.id}
                      onClick={() => canPlay && handleCardClick(card)}
                      className={`
                        bg-gray-800 rounded p-3 border-2 min-w-[120px] cursor-pointer transition-all relative overflow-hidden
                        ${canPlay 
                          ? 'border-blue-500 hover:border-blue-300 hover:scale-105' 
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase Indicator */}
      <div className="max-w-7xl mx-auto text-center">
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
    </div>
  );
};

