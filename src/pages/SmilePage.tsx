import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SmilePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black relative flex flex-col items-center justify-center overflow-hidden">
      {/* Hintergrundbild - groß über schwarzem Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/SmileaBittt.png"
          alt="SMILE A BIT Background"
          className="w-full h-full object-cover opacity-30"
          onError={(e) => {
            console.warn('[SmilePage] Could not load background image');
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Schwarzer Overlay für besseren Kontrast */}
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      {/* Content - z-index höher als Background */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-8">
        {/* Titel */}
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 text-center drop-shadow-2xl">
          SMILE A BIT
        </h1>

        {/* Coming Soon - unten groß */}
        <div className="mt-auto mb-16">
          <p className="text-4xl md:text-6xl font-bold text-red-600 text-center drop-shadow-2xl">
            COMING SOON
          </p>
        </div>

        {/* Zurück-Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors z-20"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};
