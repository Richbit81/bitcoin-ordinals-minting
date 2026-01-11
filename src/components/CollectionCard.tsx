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
      className="w-full cursor-pointer hover:opacity-90 transition-opacity duration-300 flex flex-col items-center h-full"
    >
      {/* Bild-Container */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-start min-h-0">
        {collection.thumbnail ? (
          <img
            src={collection.thumbnail}
            alt={collection.name}
            className="w-full h-auto object-contain"
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
      
      {/* Text unter dem Bild */}
      <div className="mt-auto pt-6 text-center w-full">
        <h2 className="text-2xl font-bold text-white mb-1">{collection.name}</h2>
        <p className="text-sm text-gray-400">{collection.description}</p>
        <p className="text-xs text-gray-500 mt-1">{collection.items.length} items</p>
      </div>
    </div>
  );
};

