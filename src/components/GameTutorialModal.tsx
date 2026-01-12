import React from 'react';

interface GameTutorialModalProps {
  onClose: () => void;
}

export const GameTutorialModal: React.FC<GameTutorialModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border-2 border-red-600 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b-2 border-red-600 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">🖤 BLACK & WILD - Tutorial</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basics */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">📖 Basics</h3>
            <div className="space-y-2 text-gray-300">
              <p>• Each player starts with <span className="text-red-400 font-semibold">20 Life</span></p>
              <p>• Goal: Reduce your opponent's Life to 0</p>
              <p>• Each player has a deck with <span className="text-red-400 font-semibold">24 cards</span></p>
              <p>• At the start, you draw <span className="text-red-400 font-semibold">5 cards</span></p>
            </div>
          </section>

          {/* Phases */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">🔄 Turn Phases</h3>
            <div className="space-y-3">
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-blue-400 mb-1">1. DRAW Phase</h4>
                <p className="text-sm text-gray-300">Automatically draw 1 card. If your deck is empty, you lose 1 Life.</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-green-400 mb-1">2. MAIN Phase</h4>
                <p className="text-sm text-gray-300">You can play cards:</p>
                <ul className="text-sm text-gray-300 ml-4 mt-1 space-y-1">
                  <li>• <span className="text-yellow-400">1 Animal</span> per turn (max. 5 animals on the board)</li>
                  <li>• <span className="text-yellow-400">Unlimited</span> Action cards</li>
                  <li>• <span className="text-yellow-400">Unlimited</span> Status cards</li>
                </ul>
                <p className="text-sm text-gray-300 mt-2">Click "End Main Phase" when you're done.</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-red-400 mb-1">3. ATTACK Phase</h4>
                <p className="text-sm text-gray-300">All your animals attack automatically. Damage goes directly to the opponent.</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-purple-400 mb-1">4. END Phase</h4>
                <p className="text-sm text-gray-300">End-of-turn effects are triggered. Animals with HP ≤ 0 are destroyed.</p>
              </div>
            </div>
          </section>

          {/* Card Types */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">🎴 Card Types</h3>
            <div className="space-y-3">
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-yellow-400 mb-1">🐾 Animal</h4>
                <p className="text-sm text-gray-300">Stays on the board and attacks automatically in the ATTACK phase.</p>
                <p className="text-sm text-gray-300 mt-1">Shows ATK (Attack) and HP (Health Points).</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-blue-400 mb-1">⚡ Action</h4>
                <p className="text-sm text-gray-300">One-time effect, executed immediately and then discarded.</p>
                <p className="text-sm text-gray-300 mt-1">Some require a target (animal or player).</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-purple-400 mb-1">🏷️ Status</h4>
                <p className="text-sm text-gray-300">Attached to an animal or player and remains active.</p>
                <p className="text-sm text-gray-300 mt-1">Color coding: <span className="text-red-400">Red</span> = Negative, <span className="text-green-400">Green</span> = Positive, <span className="text-yellow-400">Yellow</span> = Neutral</p>
              </div>
            </div>
          </section>

          {/* Status Effects */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">🏷️ Important Status Effects</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">BLEEDING:</span> -1 HP per turn
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">STUCK:</span> Cannot attack
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">TINT:</span> -1 ATK, draw on death
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">TARGET:</span> Double damage
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">PARANOIA:</span> Cannot draw cards
              </div>
              <div className="bg-green-900/30 rounded p-2">
                <span className="font-semibold text-green-400">SHIELD:</span> Prevents next damage
              </div>
              <div className="bg-green-900/30 rounded p-2">
                <span className="font-semibold text-green-400">RAGE:</span> +2 ATK, must attack
              </div>
              <div className="bg-yellow-900/30 rounded p-2">
                <span className="font-semibold text-yellow-400">SWARM:</span> 1 damage per animal death
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">💡 Tips</h3>
            <div className="space-y-2 text-gray-300">
              <p>• <span className="text-yellow-400">Hover</span> over cards to see detailed effects</p>
              <p>• <span className="text-green-400">Green border</span> = Card can be played</p>
              <p>• <span className="text-gray-500">Gray border</span> = Card cannot be played</p>
              <p>The <span className="text-cyan-400">Effect Log</span> shows all actions</p>
              <p>• Status icons on animals show active effects</p>
            </div>
          </section>

          <div className="flex justify-center pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-lg"
            >
              Start Game!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
