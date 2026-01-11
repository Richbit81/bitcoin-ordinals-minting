import React, { useState, useEffect } from 'react';
import { getRecentMints, RecentMint } from '../services/recentMints';
import { CardReveal } from './CardReveal';
import { Card } from '../types/wallet';
import { ALL_CARDS } from '../config/cards';
import { ALL_ACTION_STATUS_CARDS } from '../config/actionStatusCards';

export const RecentMints: React.FC = () => {
  const [recentMints, setRecentMints] = useState<RecentMint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecentMints = async () => {
      setLoading(true);
      try {
        const data = await getRecentMints(10);
        if (data && data.recentMints) {
          // Filtere zusätzlich Mock-Inskriptionen im Frontend (falls welche durchkommen)
          const validMints = data.recentMints.filter(mint => 
            mint.inscriptionId && 
            !mint.inscriptionId.startsWith('mock-') && 
            !mint.inscriptionId.startsWith('txid-')
          );
          setRecentMints(validMints);
        }
      } catch (error) {
        console.error('Failed to load recent mints:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecentMints();
    // Auto-Refresh alle 30 Sekunden
    const interval = setInterval(loadRecentMints, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && recentMints.length === 0) {
    return (
      <div className="mt-8 border-t-2 border-red-600 pt-6">
        <h2 className="text-xl font-bold text-white mb-4">Recently Minted</h2>
        <div className="text-center text-gray-400 py-8">Loading recent mints...</div>
      </div>
    );
  }

  if (recentMints.length === 0) {
    return null; // Zeige nichts wenn keine Mints vorhanden
  }

  return (
    <div className="mt-8 border-t-2 border-red-600 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Recently Minted</h2>
        <span className="text-sm text-gray-400">
          Last {recentMints.length} cards
        </span>
      </div>
      
      {/* Horizontaler Scroll-Balken */}
      <div className="overflow-x-auto overflow-y-hidden scrollbar-hide">
        <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
          {recentMints.map((mint, index) => {
            // Finde die vollständige Card-Definition aus der Konfiguration
            const allCards = [...ALL_CARDS, ...ALL_ACTION_STATUS_CARDS];
            const fullCard = allCards.find(c => c.id === mint.cardId);
            
            // Verwende originale inscriptionId wenn die aktuelle "pending-" ist
            let inscriptionId = mint.inscriptionId;
            if (inscriptionId.startsWith('pending-') && fullCard) {
              // Für pending-Inskriptionen: Verwende die originale inscriptionId für das Bild
              inscriptionId = fullCard.inscriptionId;
            }
            
            const card: Card = {
              id: mint.cardId,
              name: mint.cardName,
              rarity: mint.rarity as any,
              inscriptionId: inscriptionId, // Verwende originale ID wenn pending
              cardType: mint.cardType,
              // Füge svgIcon hinzu für Action/Status-Karten
              svgIcon: fullCard?.svgIcon,
              effect: fullCard?.effect,
            };

                return (
                  <div
                    key={`${mint.inscriptionId}-${index}`}
                    className="flex-shrink-0 w-32 md:w-40"
                  >
                    <div className="relative">
                      <CardReveal 
                        card={{
                          ...card,
                          revealed: true, // Immer aufgedeckt in Recent Mints
                        }} 
                        showRarity={true} 
                        autoReveal={true}
                      />
                      {/* Mini Info Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[8px] p-1 rounded-b">
                        <p className="font-bold truncate">{mint.cardName}</p>
                        <p className="text-gray-400 truncate">{mint.mintedBy}</p>
                      </div>
                    </div>
                  </div>
                );
          })}
        </div>
      </div>
      
      {/* Scroll-Hinweis */}
      <p className="text-xs text-gray-500 text-center mt-2">
        ← Scroll to see more →
      </p>
    </div>
  );
};

