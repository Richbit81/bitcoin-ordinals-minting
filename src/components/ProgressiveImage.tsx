import React, { useState } from 'react';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  loading?: 'lazy' | 'eager';
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  placeholder,
  onError,
  loading = 'lazy',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setImageLoaded(true);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  // Erstelle einen kleinen Blur-Placeholder
  const blurPlaceholder = placeholder || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzE3MTcxNyIvPjwvc3ZnPg==';

  if (hasError) {
    return (
      <div className={`${className} bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center`}>
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">🖼️</div>
          <p className="text-xs">Image</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur Placeholder */}
      {!imageLoaded && (
        <img
          src={blurPlaceholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          aria-hidden="true"
        />
      )}
      
      {/* Actual Image */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-500 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
      />
      
      {/* Loading Spinner */}
      {!imageLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};
