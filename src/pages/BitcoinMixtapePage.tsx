import React from 'react';
import { useNavigate } from 'react-router-dom';

export const BitcoinMixtapePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{
        backgroundImage: 'url(/mixtape.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark Overlay für bessere Lesbarkeit */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Content - Zentriert */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="text-6xl md:text-8xl font-bold mb-8 text-white drop-shadow-2xl">
            Bitcoin Mix Tape
          </h1>
          
          <div className="bg-black/80 border-4 border-red-600 rounded-lg p-12 max-w-2xl backdrop-blur-md">
            <h2 className="text-5xl md:text-7xl font-black text-red-600 mb-6 animate-pulse drop-shadow-lg">
              COMING SOON
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-4">
              Get ready for something amazing!
            </p>
            <p className="text-lg text-gray-400">
              Stay tuned for updates...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
