import React, { useState, useEffect } from 'react';
import { CardPack } from '../types/wallet';
import { CardPackComponent } from './CardPack';
import { checkAllPackAvailability, PackAvailability } from '../services/packSupply';

interface PackSelectorProps {
  packs: CardPack[];
  onMint: (packId: string) => void;
  mintingPackId: string | null;
  inscriptionFeeRate: number;
  onFeeRateChange: (feeRate: number) => void;
}

export const PackSelector: React.FC<PackSelectorProps> = ({
  packs,
  onMint,
  mintingPackId,
  inscriptionFeeRate,
  onFeeRateChange,
}) => {
  const [availability, setAvailability] = useState<Record<string, PackAvailability>>({});

  useEffect(() => {
    // Lade Verfügbarkeit vom Backend
    const fetchAvailability = async () => {
      const data = await checkAllPackAvailability();
      setAvailability(data);
    };
    fetchAvailability();
    
    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(fetchAvailability, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black border border-red-600 rounded shadow-lg p-4">
      <h2 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-1">
        Available Card Packs
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Packs Grid - 2 Spalten */}
        <div className="lg:col-span-2">
          {packs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">No packs available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-stretch">
          {packs.map((pack) => {
            const packAvailability = availability[pack.id];
            const remaining = packAvailability?.remaining ?? (pack.totalSupply ? pack.totalSupply - (pack.soldCount || 0) : null);
            const isSoldOut = packAvailability?.soldOut || (remaining !== null && remaining <= 0);
            
            return (
              <CardPackComponent
                key={pack.id}
                pack={pack}
                onMint={onMint}
                isMinting={mintingPackId === pack.id}
                availability={packAvailability}
                isSoldOut={isSoldOut}
                inscriptionFeeRate={inscriptionFeeRate}
                onFeeRateChange={onFeeRateChange}
              />
            );
          })}
            </div>
          )}
        </div>

        {/* Kollektions-Beschreibung - Rechts */}
        <div className="lg:col-span-1 border-l border-red-600 pl-6">
          <div className="space-y-4 text-white text-center pt-12">
            <div>
              <h3 className="text-lg font-bold mb-2">
                <span className="text-black" style={{ textShadow: '0 0 8px rgba(255,255,255,0.6)' }}>BLACK</span>
                {' '}
                <span className="text-red-600">&</span>
                {' '}
                <span className="text-white">WILD</span>
                {' '}
                <span className="text-white text-sm">— Card Pack</span>
              </h3>
            </div>
            
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="text-white font-bold">No heroes.</p>
              <p className="text-white font-bold">No magic.</p>
              <p className="text-white font-bold">Just animals with problems.</p>
              
              <p className="text-gray-300 mt-4">
                <span className="text-white font-bold">BLACK & WILD</span> is a minimalist animal card game built on instinct, chaos, and bad decisions.
                Each pack contains a mix of unique animal cards, actions, and status effects — designed to be played, collected, and misused.
              </p>
              
              <p className="text-gray-300">
                No lore to memorize.<br />
                No hand-holding.<br />
                Just sharp design, direct interaction, and fast, uncomfortable games.
              </p>
              
              <p className="text-white font-bold mt-4">
                Black ink.<br />
                White space.<br />
                Everything else is your problem.
              </p>
            </div>

            {/* Zusätzliche Features */}
            <div className="mt-6 pt-4 border-t border-gray-700 space-y-2 text-sm">
              <p className="text-white">Black & white vector artwork</p>
              <p className="text-white">Animal-based characters</p>
              <p className="text-white">Fast, aggressive gameplay</p>
              <p className="text-white">Chaos &gt; balance</p>
              <p className="text-white font-bold mt-3">Playable. Collectible. Uncomfortable.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

