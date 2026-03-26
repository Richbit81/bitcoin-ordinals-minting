import React, { useState, useEffect } from 'react';
import { Card, RARITY_COLORS, RARITY_LABELS } from '../types/wallet';
import { ActionStatusCard } from './ActionStatusCard';
import { sanitizeSvg } from '../utils/sanitize';

interface CardRevealProps {
  card: Card;
  showRarity?: boolean;
  autoReveal?: boolean; // Automatisch aufdecken nach kurzer Zeit
  onReveal?: () => void;
}

export const CardReveal: React.FC<CardRevealProps> = ({ 
  card, 
  showRarity = true,
  autoReveal = false,
  onReveal
}) => {
  const [revealed, setRevealed] = useState(card.revealed || false);
  const [imageError, setImageError] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(() => {
    // PRIORITÄT 1: Wenn originalInscriptionId verfügbar ist, verwende diese direkt (schnellste Methode)
    if (card.originalInscriptionId && 
        !card.originalInscriptionId.startsWith('mock-') && 
        !card.originalInscriptionId.startsWith('pending-')) {
      console.log(`[CardReveal] ✅ Using originalInscriptionId: ${card.originalInscriptionId}`);
      return `https://ordinals.com/content/${card.originalInscriptionId}`;
    }
    
    // PRIORITÄT 2: Für "pending-" IDs: Verwende Backend-Endpoint
    if (card.inscriptionId && card.inscriptionId.startsWith('pending-')) {
      const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
      console.log(`[CardReveal] ⏳ Using pending ID with backend: ${card.inscriptionId}`);
      return `${API_URL}/api/inscription/image/${card.inscriptionId}`;
    }
    
    // PRIORITÄT 3: Für finale Delegate-IDs: Verwende Backend-Endpoint, der das Bild aus HTML extrahiert
    if (card.inscriptionId && !card.inscriptionId.startsWith('mock-')) {
      const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
      console.log(`[CardReveal] 🔄 Using delegate ID with backend: ${card.inscriptionId}`);
      return `${API_URL}/api/inscription/image/${card.inscriptionId}`;
    }
    
    console.warn(`[CardReveal] ⚠️ No valid inscription ID found for card: ${card.name}`);
    return '';
  });

  // Auto-Reveal nach kurzer Verzögerung
  useEffect(() => {
    if (autoReveal && !revealed) {
      const timer = setTimeout(() => {
        handleReveal();
      }, 1000); // 1 Sekunde Verzögerung für Spannung
      return () => clearTimeout(timer);
    }
  }, [autoReveal, revealed]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    
    console.error(`[CardReveal] Image load error for ${card.name} from ${currentSrc}`);
    
    // Fallback-Kette: Backend -> ordinals.com/content -> preview -> ordiscan
    // WICHTIG: Verwende inscriptionId (Delegate-ID) für alle Fallbacks
    if (currentSrc.includes('/api/inscription/image/')) {
      // Backend-Endpoint fehlgeschlagen, versuche direkte URL (zeigt HTML, aber versuchen wir es)
      const directSrc = `https://ordinals.com/content/${card.inscriptionId}`;
      console.log(`[CardReveal] Backend failed, trying direct URL: ${directSrc}`);
      setCurrentImageSrc(directSrc);
    } else if (currentSrc.includes('ordinals.com/content')) {
      // Versuche preview
      const previewSrc = `https://ordinals.com/preview/${card.inscriptionId}`;
      console.log(`[CardReveal] Trying preview URL: ${previewSrc}`);
      setCurrentImageSrc(previewSrc);
    } else if (currentSrc.includes('ordinals.com/preview')) {
      // Versuche ordiscan
      const ordiscanSrc = `https://ordiscan.com/content/${card.inscriptionId}`;
      console.log(`[CardReveal] Trying ordiscan URL: ${ordiscanSrc}`);
      setCurrentImageSrc(ordiscanSrc);
    } else {
      // Alle Quellen fehlgeschlagen
      console.error(`[CardReveal] All image sources failed for ${card.name}`);
      setImageError(true);
    }
  };

  const handleReveal = () => {
    if (!revealed) {
      setRevealed(true);
      if (onReveal) {
        onReveal();
      }
    }
  };

  // Verdeckte Karte
  if (!revealed) {
    return (
      <div
        className="bg-gradient-to-br from-gray-900 to-black rounded-lg overflow-hidden border-2 cursor-pointer hover:scale-105 transition-transform duration-200"
        style={{
          borderColor: showRarity ? (RARITY_COLORS[card.rarity] || '#9CA3AF') : '#9CA3AF',
          minHeight: '120px', // ✨ Kleiner: 200px → 120px
          maxHeight: '160px', // ✨ Max-Höhe begrenzen
        }}
        onClick={handleReveal}
      >
        <div className="h-full flex flex-col items-center justify-center p-3 bg-gray-950">
          {/* Mystery Card Design */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Glowing Rarity Border */}
            <div
              className="absolute inset-0 rounded-lg opacity-20 blur-sm"
              style={{
                boxShadow: `0 0 20px ${RARITY_COLORS[card.rarity] || '#9CA3AF'}`,
              }}
            />
            
            {/* Question Mark */}
            <div className="relative z-10 text-center">
              <div className="text-5xl mb-2 opacity-50">?</div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                Click
              </p>
            </div>

            {/* Rarity Indicator (subtle) */}
            <div className="absolute bottom-1 left-1 right-1">
              <div
                className="text-[9px] font-bold px-1 py-0.5 rounded text-center opacity-50"
                style={{
                  backgroundColor: RARITY_COLORS[card.rarity] || '#9CA3AF',
                  color: 'white',
                }}
              >
                {RARITY_LABELS[card.rarity]}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Aufgedeckte Karte - Zeige Original-Kartendaten + Bild
  if (revealed) {
    return (
      <div
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border-2"
        style={{
          borderColor: showRarity ? (RARITY_COLORS[card.rarity] || '#9CA3AF') : '#9CA3AF',
          maxHeight: '280px', // ✨ Max-Höhe für aufgedeckte Karte
        }}
      >
        {/* Header mit Original-Kartendaten */}
        <div className="p-2 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
          <h3 className="text-sm font-bold text-white text-center mb-1">{card.name}</h3>
          {showRarity && (
            <div className="flex items-center justify-center gap-1">
              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-700 text-gray-200">
                {card.cardType?.toUpperCase() || 'CARD'}
              </span>
              <span
                className="text-[9px] font-semibold px-1 py-0.5 rounded"
                style={{
                  backgroundColor: RARITY_COLORS[card.rarity] || '#9CA3AF',
                  color: 'white',
                }}
              >
                {RARITY_LABELS[card.rarity]}
              </span>
            </div>
          )}
        </div>

        {/* Card Image - Für ALLE Kartentypen mit inscriptionId (wie im AdminPanel) */}
        <div className="p-3 flex items-center justify-center bg-white min-h-[100px] max-h-[150px]">
          {(() => {
            // Prüfe ob wir eine inscriptionId haben (für alle Kartentypen)
            // WICHTIG: Auch "pending-" IDs werden unterstützt - sie zeigen die Delegate-Inskription
            const hasInscriptionId = card.inscriptionId && 
              !card.inscriptionId.startsWith('mock-');
            
            if (hasInscriptionId) {
              if (imageError) {
                return (
                  <div className="text-red-500 text-xs text-center p-2">
                    <p>Error loading image</p>
                    <p className="text-gray-500 mt-1 text-[10px] break-all">{card.inscriptionId}</p>
                    {/* Fallback zu svgIcon wenn verfügbar */}
                    {card.svgIcon && (
                      <div 
                        className="w-full h-full flex items-center justify-center p-2 mt-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(card.svgIcon) }}
                      />
                    )}
                  </div>
                );
              } else {
                return (
                  <img 
                    key={currentImageSrc} // Key ändern, um Bild neu zu laden
                    src={currentImageSrc}
                    alt={card.name}
                    className="w-full h-full object-contain"
                    onError={handleImageError}
                    onLoad={() => {
                      console.log(`[CardReveal] ✅ Image loaded successfully for ${card.name} (${card.cardType}) from ${currentImageSrc}`);
                    }}
                  />
                );
              }
            } else if (card.svgIcon) {
              // Fallback: Nur svgIcon wenn keine inscriptionId vorhanden
              return (
                <div 
                  className="w-full h-full flex items-center justify-center p-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(card.svgIcon) }}
                />
              );
            } else {
              return (
                <div className="text-gray-500 text-xs">No preview</div>
              );
            }
          })()}
        </div>

        {/* Footer mit Inskription-ID */}
        {card.inscriptionId && !card.inscriptionId.startsWith('mock-') && (
          <div className="p-1 bg-gray-900 border-t border-gray-700">
            <p className="text-[8px] font-mono text-gray-400 text-center truncate" title={card.inscriptionId}>
              {card.inscriptionId}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Fallback: Wenn keine inscriptionId vorhanden, verwende ActionStatusCard
  return <ActionStatusCard card={card} showRarity={showRarity} />;
};

