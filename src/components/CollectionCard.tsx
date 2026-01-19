import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Collection } from '../services/collectionService';

interface CollectionCardProps {
  collection: Collection;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/collection/${collection.id}`)}
      className="w-full cursor-pointer transition-all duration-300 flex flex-col items-center h-full group relative touch-manipulation active:scale-95 md:hover:scale-105 hover:shadow-lg hover:shadow-red-600/20"
    >
      {/* Glassmorphism Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
      
      {/* Bild-Container - REDUZIERT: max-w-48 statt max-w-md */}
      <div className="w-full max-w-48 mx-auto flex-1 flex flex-col justify-start min-h-0 relative z-10 md:mt-8">
        {collection.thumbnail ? (
          <img
            src={collection.thumbnail}
            alt={collection.name}
            className="w-full h-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50"
            onError={(e) => {
              console.warn(`[CollectionCard] Could not load thumbnail: ${collection.thumbnail}`);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-900 border border-red-600 rounded flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-6xl mb-4">🖼️</div>
              <p className="text-white text-lg font-bold">{collection.name}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Text unter dem Bild - NUR TITEL (Beschreibung ist auf Mint-Seite) */}
      <div className="mt-auto pt-1 text-center w-full relative z-10 transition-all duration-300 group-hover:translate-y-[-4px]">
        <h2 className="text-xl font-bold text-white mb-1 transition-colors duration-300 group-hover:text-red-400">{collection.name}</h2>
      </div>
    </div>
  );
};

