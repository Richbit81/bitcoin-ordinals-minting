import React, { useEffect, useState } from 'react';
import { CardPack } from '../types/wallet';
import { PackAvailability } from '../services/packSupply';
import { calculateInscriptionFees, formatBTC, getCurrentFeeRates } from '../services/bitcoinFees';
import { FeeRateSelector } from './FeeRateSelector';

interface CardPackProps {
  pack: CardPack;
  onMint: (packId: string) => void;
  isMinting: boolean;
  availability?: PackAvailability | null;
  isSoldOut?: boolean;
  inscriptionFeeRate: number;
  onFeeRateChange: (feeRate: number) => void;
}

export const CardPackComponent: React.FC<CardPackProps> = ({
  pack,
  onMint,
  isMinting,
  availability,
  isSoldOut = false,
  inscriptionFeeRate,
  onFeeRateChange,
}) => {
  const remaining = availability?.remaining ?? (pack.totalSupply ? pack.totalSupply - (pack.soldCount || 0) : null);
  
  // Berechne Fees basierend auf Anzahl Inskriptionen und gewählter Fee Rate
  const inscriptionFees = calculateInscriptionFees(pack.cardCount, inscriptionFeeRate);
  const totalCost = pack.price + inscriptionFees;

  // Premium Pack ist vorübergehend deaktiviert
  const isComingSoon = pack.isPremium === true;

  return (
    <div className="relative bg-black border border-red-600 rounded overflow-hidden hover:border-red-500 transition-all shadow-lg w-full flex flex-col h-full">
      {/* Coming Soon Overlay für Premium Pack */}
      {isComingSoon && (
        <div className="absolute inset-0 bg-black/90 rounded flex flex-col items-center justify-center z-20 border border-red-600">
          <span className="text-red-600 text-2xl font-bold tracking-wider mb-2">COMING SOON</span>
          <span className="text-gray-400 text-sm">Premium Pack</span>
        </div>
      )}

      {/* Sold Out Overlay */}
      {isSoldOut && !isComingSoon && (
        <div className="absolute inset-0 bg-black/90 rounded flex items-center justify-center z-20 border border-red-600">
          <span className="text-white text-xl font-bold tracking-wider">SOLD OUT</span>
        </div>
      )}

      {/* Premium Badge */}
      {pack.isPremium && (
        <div className="absolute top-1.5 left-1.5 bg-red-600 text-white px-1.5 py-0.5 rounded border border-white text-[10px] font-bold z-10">
          ⭐ PREMIUM
        </div>
      )}

      {/* Verfügbarkeits-Badge */}
      {remaining !== null && !isSoldOut && (
        <div className="absolute top-1.5 right-1.5 bg-white text-black px-1.5 py-0.5 rounded border border-red-600 text-[10px] font-bold z-10">
          {remaining}/{pack.totalSupply}
        </div>
      )}

      {/* Pack Bild - Vertikales Format (2:3) */}
      <div className="aspect-[2/3] bg-black flex items-center justify-center p-2 border-b border-red-600 relative min-h-[200px]">
        <img
          src={pack.imageUrl || '/images/pack-thumbnail.png'}
          alt={pack.name}
          className="max-w-full max-h-full object-contain"
          style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
          loading="eager"
          onError={(e) => {
            console.error('❌ Bild-Fehler - URL:', e.currentTarget.src);
            console.error('Vollständige URL:', new URL(e.currentTarget.src, window.location.origin).href);
            const currentSrc = e.currentTarget.src;
            if (!currentSrc.includes('data:image')) {
              console.log('⚠️ Verwende Fallback-Bild (SVG)');
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect fill="%23000" width="200" height="300"/%3E%3Ctext fill="%23fff" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EKartenpack%3C/text%3E%3C/svg%3E';
            }
          }}
          onLoad={(e) => {
            console.log('✅ Bild erfolgreich geladen:', e.currentTarget.src);
            console.log('Bild-Größe:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
          }}
        />
      </div>
      
      {/* Content Bereich */}
      <div className="p-2.5 bg-black text-white flex-1 flex flex-col">
        <h3 className="text-sm font-bold mb-1 text-white border-b border-red-600 pb-1 line-clamp-1">{pack.name}</h3>
        <p className="text-gray-300 mb-2 text-[10px] leading-tight line-clamp-2 flex-1">{pack.description}</p>
        
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
          <div>
            <p className="text-[9px] text-gray-400 uppercase">Cards</p>
            <p className="text-xs font-bold text-white">
              {pack.cardCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-gray-400 uppercase">Price</p>
            <p className="text-sm font-bold text-red-600 font-mono">
              {pack.price.toFixed(8)} BTC
            </p>
            <p className="text-[8px] text-gray-500 uppercase mt-0.5">+ Inscription Fees</p>
            <p className="text-[10px] text-gray-400 font-mono">
              ~{formatBTC(inscriptionFees)}
            </p>
            <p className="text-[7px] text-gray-500 mt-0.5 leading-tight">
              (Estimated: ~{Math.round(inscriptionFees * 100000000 / pack.cardCount)} sats per inscription)
            </p>
            <p className="text-[6px] text-gray-600 mt-0.5 leading-tight italic">
              UniSat calculates the actual fees
            </p>
            <p className="text-[8px] text-red-500 uppercase mt-1 border-t border-gray-700 pt-0.5">Total</p>
            <p className="text-xs font-bold text-red-600 font-mono">
              {formatBTC(totalCost)}
            </p>
          </div>
        </div>

        {/* Raritäten-Hinweis für Premium Pack - OBERHALB des Fee Rate Selectors */}
        {pack.isPremium && pack.guaranteedRarities && (
          <div className="mb-2 p-1.5 bg-gray-900 border border-red-600 rounded">
            <p className="text-[9px] font-semibold text-red-600 mb-1 uppercase">Guaranteed:</p>
            <div className="flex flex-wrap gap-1">
              {pack.guaranteedRarities.map((rarity) => (
                <span
                  key={rarity}
                  className="px-1 py-0.5 bg-black text-white border border-red-600 rounded text-[9px] font-semibold"
                >
                  {rarity === 'mystic-legendary' ? 'Mystic' : rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fee Rate Selector - In jedem Pack */}
        <div className="mb-2">
          <FeeRateSelector
            selectedFeeRate={inscriptionFeeRate}
            onFeeRateChange={onFeeRateChange}
          />
        </div>

        <button
          onClick={() => onMint(pack.id)}
          disabled={isMinting || isSoldOut || isComingSoon}
          className="w-full py-1.5 text-xs bg-white text-black border border-red-600 rounded font-bold hover:bg-red-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMinting ? 'Minting...' : isComingSoon ? 'Coming Soon' : isSoldOut ? 'Sold Out' : 'Mint Pack'}
        </button>
      </div>
    </div>
  );
};

