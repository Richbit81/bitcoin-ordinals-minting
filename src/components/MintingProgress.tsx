import React, { useState } from 'react';
import { MintingStatus, Card } from '../types/wallet';
import { CardReveal } from './CardReveal';

interface MintingProgressProps {
  status: MintingStatus;
}

export const MintingProgress: React.FC<MintingProgressProps> = ({ status }) => {
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'bg-white text-black';
      case 'failed':
        return 'bg-red-600 text-white';
      case 'processing':
        return 'bg-white text-black border-2 border-red-600';
      default:
        return 'bg-gray-800 text-white border-2 border-red-600';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'pending':
        return 'Waiting...';
      case 'processing':
        return 'Minting...';
      case 'completed':
        return 'Completed!';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-black border border-red-600 rounded shadow-lg p-3">
      <div className="flex items-center justify-between mb-2 border-b border-red-600 pb-2">
        <h3 className="text-sm font-bold text-white">
          Minting-Status
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-300 mb-1">
          <span>Progress</span>
          <span className="font-bold text-white">{status.progress}%</span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-2 border border-gray-700">
          <div
            className="h-2 rounded-full transition-all bg-red-600"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {status.status === 'completed' && status.inscriptionIds && (
        <div className="mt-2 p-2 bg-gray-900 border border-white rounded">
          <p className="text-xs font-bold text-white mb-1">
            ✓ Minting successful!
          </p>
          
          {/* Gemintete Karten anzeigen mit Reveal-Funktion */}
          {status.cards && status.cards.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-gray-300 mb-2 uppercase">Your Cards:</p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {status.cards.map((card, index) => {
                  const isRevealed = revealedCards.has(index);
                  return (
                    <div key={index}>
                      <CardReveal
                        card={{
                          ...card,
                          revealed: isRevealed,
                        }}
                        showRarity={true}
                        autoReveal={false}
                        onReveal={() => {
                          setRevealedCards(prev => new Set(prev).add(index));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {revealedCards.size < status.cards.length && (
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  Click on cards to reveal them
                </p>
              )}
            </div>
          )}
          
          <p className="text-[10px] text-gray-400 mb-1 uppercase">Inscription IDs:</p>
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {status.inscriptionIds.map((id, index) => (
              <p key={index} className="text-[10px] font-mono text-white break-all bg-black p-0.5 rounded">
                {id}
              </p>
            ))}
          </div>
        </div>
      )}

      {status.status === 'failed' && status.error && (
        <div className="mt-2 p-2 bg-gray-900 border border-red-600 rounded">
          <p className="text-xs font-bold text-red-600 mb-1">
            ✗ Minting Error
          </p>
          <p className="text-[10px] text-gray-300">{status.error}</p>
        </div>
      )}

      {status.status === 'processing' && (
        <div className="mt-2 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
          <p className="text-xs text-gray-300 mt-1">
            Please wait...
          </p>
        </div>
      )}
    </div>
  );
};

