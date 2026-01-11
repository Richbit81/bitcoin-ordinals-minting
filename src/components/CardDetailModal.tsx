import React, { useState, useEffect } from 'react';
import { Card, RARITY_COLORS, RARITY_LABELS } from '../types/wallet';
import { getCachedInscriptionImage } from '../services/inscriptionImage';

interface CardDetailModalProps {
  card: Card;
  onClose: () => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({ card, onClose }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(() => {
    if (card.inscriptionId && !card.inscriptionId.startsWith('pending-') && !card.inscriptionId.startsWith('mock-')) {
      return `https://ordinals.com/content/${card.inscriptionId}`;
    }
    return '';
  });

  useEffect(() => {
    const isValidInscriptionId = card.inscriptionId && 
                                 !card.inscriptionId.startsWith('pending-') &&
                                 !card.inscriptionId.startsWith('mock-') &&
                                 !card.inscriptionId.startsWith('txid-');
    
    if (isValidInscriptionId && !imageData && !loading) {
      loadImage();
    }
  }, [card.inscriptionId]);

  const loadImage = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const image = await getCachedInscriptionImage(card.inscriptionId);
      if (image) {
        setImageData(image);
      } else {
        setError('Image not found');
      }
    } catch (err) {
      console.error('Error loading card image:', err);
      setError('Failed to load image');
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    
    if (currentSrc.includes('ordinals.com/content')) {
      setCurrentImageSrc(`https://ordinals.com/preview/${card.inscriptionId}`);
    } else if (currentSrc.includes('ordinals.com/preview')) {
      setCurrentImageSrc(`https://ordiscan.com/content/${card.inscriptionId}`);
    } else {
      setError('All image sources failed');
    }
  };

  const isSvg = imageData && (imageData.trim().startsWith('<svg') || imageData.trim().startsWith('<?xml'));
  const hasInscriptionId = card.inscriptionId && 
    !card.inscriptionId.startsWith('pending-') && 
    !card.inscriptionId.startsWith('mock-');

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-black border-2 border-red-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-black border-b-2 border-red-600 p-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">{card.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-700 text-gray-200">
                {card.cardType?.toUpperCase() || 'CARD'}
              </span>
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: RARITY_COLORS[card.rarity] || '#9CA3AF',
                  color: 'white',
                }}
              >
                {RARITY_LABELS[card.rarity]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Card Image */}
          <div className="mb-6 flex items-center justify-center bg-white rounded-lg p-6 min-h-[300px]">
            {hasInscriptionId ? (
              loading ? (
                <div className="w-32 h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                </div>
              ) : error ? (
                <div className="text-center">
                  <p className="text-gray-500 mb-4">Image not available</p>
                  {card.svgIcon && (
                    <div
                      className="w-full max-w-md flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: card.svgIcon }}
                    />
                  )}
                </div>
              ) : imageData && isSvg ? (
                <div
                  className="w-full max-w-md flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: imageData }}
                  style={{
                    filter: 'none',
                    WebkitFilter: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              ) : imageData ? (
                <img
                  src={imageData}
                  alt={card.name}
                  className="w-full max-w-md h-auto"
                  style={{
                    filter: 'none',
                    WebkitFilter: 'none',
                    imageRendering: 'auto',
                  }}
                />
              ) : (
                <img
                  key={currentImageSrc}
                  src={currentImageSrc}
                  alt={card.name}
                  className="w-full max-w-md h-auto"
                  onError={handleImageError}
                  onLoad={() => {
                    console.log(`[CardDetailModal] ✅ Image loaded successfully for ${card.name}`);
                  }}
                />
              )
            ) : card.svgIcon ? (
              <div
                className="w-full max-w-md flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: card.svgIcon }}
              />
            ) : (
              <div className="text-gray-400">No preview available</div>
            )}
          </div>

          {/* Card Details */}
          <div className="space-y-4">
            {/* Effect */}
            {card.effect && (
              <div className="bg-gray-900 border border-red-600 rounded p-4">
                <h3 className="text-sm font-bold text-red-600 mb-2 uppercase">Effect</h3>
                <p className="text-white text-sm leading-relaxed">{card.effect}</p>
              </div>
            )}

            {/* Inscription ID */}
            {card.inscriptionId && !card.inscriptionId.startsWith('pending-') && !card.inscriptionId.startsWith('mock-') && (
              <div className="bg-gray-900 border border-gray-700 rounded p-4">
                <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase">Inscription ID</h3>
                <p className="text-xs font-mono text-gray-300 break-all">{card.inscriptionId}</p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`https://ordinals.com/inscription/${card.inscriptionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-red-600 hover:text-red-400 underline"
                  >
                    View on Ordinals.com
                  </a>
                  <a
                    href={`https://ordiscan.com/inscription/${card.inscriptionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-red-600 hover:text-red-400 underline"
                  >
                    View on Ordiscan.com
                  </a>
                </div>
              </div>
            )}

            {/* Card ID */}
            {card.id && (
              <div className="bg-gray-900 border border-gray-700 rounded p-4">
                <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase">Card ID</h3>
                <p className="text-xs font-mono text-gray-300">{card.id}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



