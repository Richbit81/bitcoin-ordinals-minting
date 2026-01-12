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
          {/* Grundlagen */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">📖 Grundlagen</h3>
            <div className="space-y-2 text-gray-300">
              <p>• Jeder Spieler startet mit <span className="text-red-400 font-semibold">20 Life</span></p>
              <p>• Ziel: Reduziere den Life-Punktestand deines Gegners auf 0</p>
              <p>• Jeder Spieler hat ein Deck mit <span className="text-red-400 font-semibold">24 Karten</span></p>
              <p>• Zu Beginn ziehst du <span className="text-red-400 font-semibold">5 Karten</span></p>
            </div>
          </section>

          {/* Phasen */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">🔄 Turn-Phasen</h3>
            <div className="space-y-3">
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-blue-400 mb-1">1. DRAW Phase</h4>
                <p className="text-sm text-gray-300">Ziehe automatisch 1 Karte. Wenn dein Deck leer ist, verlierst du 1 Life.</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-green-400 mb-1">2. MAIN Phase</h4>
                <p className="text-sm text-gray-300">Du kannst Karten spielen:</p>
                <ul className="text-sm text-gray-300 ml-4 mt-1 space-y-1">
                  <li>• <span className="text-yellow-400">1 Tier</span> pro Turn (max. 5 Tiere auf dem Board)</li>
                  <li>• <span className="text-yellow-400">Unbegrenzt</span> Action-Karten</li>
                  <li>• <span className="text-yellow-400">Unbegrenzt</span> Status-Karten</li>
                </ul>
                <p className="text-sm text-gray-300 mt-2">Klicke auf "End Main Phase" wenn du fertig bist.</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-red-400 mb-1">3. ATTACK Phase</h4>
                <p className="text-sm text-gray-300">Alle deine Tiere greifen automatisch an. Schaden geht direkt an den Gegner.</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-purple-400 mb-1">4. END Phase</h4>
                <p className="text-sm text-gray-300">End-of-Turn-Effekte werden ausgelöst. Tiere mit HP ≤ 0 werden zerstört.</p>
              </div>
            </div>
          </section>

          {/* Karten-Typen */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">🎴 Karten-Typen</h3>
            <div className="space-y-3">
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-yellow-400 mb-1">🐾 Animal (Tier)</h4>
                <p className="text-sm text-gray-300">Bleibt auf dem Board und greift automatisch in der ATTACK Phase an.</p>
                <p className="text-sm text-gray-300 mt-1">Zeigt ATK (Angriff) und HP (Lebenspunkte).</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-blue-400 mb-1">⚡ Action (Aktion)</h4>
                <p className="text-sm text-gray-300">Einmaliger Effekt, wird sofort ausgeführt und dann verworfen.</p>
                <p className="text-sm text-gray-300 mt-1">Manche benötigen ein Ziel (Tier oder Spieler).</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <h4 className="font-semibold text-purple-400 mb-1">🏷️ Status</h4>
                <p className="text-sm text-gray-300">Wird an ein Tier oder einen Spieler angehängt und bleibt aktiv.</p>
                <p className="text-sm text-gray-300 mt-1">Farbcodierung: <span className="text-red-400">Rot</span> = Negativ, <span className="text-green-400">Grün</span> = Positiv, <span className="text-yellow-400">Gelb</span> = Neutral</p>
              </div>
            </div>
          </section>

          {/* Status-Effekte */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">🏷️ Wichtige Status-Effekte</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">BLEEDING:</span> -1 HP pro Turn
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">STUCK:</span> Kann nicht angreifen
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">TINT:</span> -1 ATK, draw on death
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">TARGET:</span> Doppelter Schaden
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <span className="font-semibold text-red-400">PARANOIA:</span> Keine Karten ziehen
              </div>
              <div className="bg-green-900/30 rounded p-2">
                <span className="font-semibold text-green-400">SHIELD:</span> Verhindert nächsten Schaden
              </div>
              <div className="bg-green-900/30 rounded p-2">
                <span className="font-semibold text-green-400">RAGE:</span> +2 ATK, muss angreifen
              </div>
              <div className="bg-yellow-900/30 rounded p-2">
                <span className="font-semibold text-yellow-400">SWARM:</span> 1 Schaden pro Tier-Tod
              </div>
            </div>
          </section>

          {/* Tipps */}
          <section>
            <h3 className="text-xl font-bold text-white mb-3">💡 Tipps</h3>
            <div className="space-y-2 text-gray-300">
              <p>• <span className="text-yellow-400">Hover</span> über Karten zeigt detaillierte Effekte</p>
              <p>• <span className="text-green-400">Grüne Border</span> = Karte kann gespielt werden</p>
              <p>• <span className="text-gray-500">Graue Border</span> = Karte kann nicht gespielt werden</p>
              <p>• Der <span className="text-cyan-400">Effekt-Log</span> zeigt alle Aktionen</p>
              <p>• Status-Icons auf Tieren zeigen aktive Effekte</p>
            </div>
          </section>

          <div className="flex justify-center pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-lg"
            >
              Spiel starten!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
