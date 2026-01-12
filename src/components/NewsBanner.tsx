import React, { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'santas-revenge',
    title: "Santas Revenge",
    description: 'Mint on Trio',
    image: '/images/SantasRevenge.png',
    link: 'https://www.trio.xyz/collections/santas-revenge',
  },
  {
    id: 'simulator',
    title: 'Inside the Consciousness Simulator',
    description: 'Mint your Card Packs on ORDX',
    image: '/images/Simulator.png',
    link: 'https://www.ord-x.com/#Inside-the-Consciousness-Simulator',
  },
  {
    id: 'sosevo',
    title: 'Sons of Satoshi Evolution',
    description: 'Check out on Magic Eden',
    image: '/images/SOSEvo.jpg',
    link: 'https://magiceden.io/ordinals/marketplace/sosevo',
  },
  {
    id: 'tactical',
    title: 'Tactical',
    description: 'Live on Lunalauncher',
    image: '/images/Tactical.jpg',
    link: 'https://lunalauncher.io/#mint/richart-tactical-game',
  },
];

export const NewsBanner: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-Rotation alle 5 Sekunden (nur wenn nicht gehovered)
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % NEWS_ITEMS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovered]);

  const currentItem = NEWS_ITEMS[currentIndex];

  const handleClick = () => {
    window.open(currentItem.link, '_blank', 'noopener,noreferrer');
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div 
      className="w-full max-w-6xl mx-auto mb-8 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banner */}
      <div
        onClick={handleClick}
        className="relative bg-gray-900 border-2 border-red-600 rounded-lg overflow-hidden cursor-pointer hover:border-red-500 transition-all group"
      >
        {/* Bild */}
        <div className="relative w-full h-48 md:h-64 overflow-hidden">
          <img
            src={currentItem.image}
            alt={currentItem.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              console.warn(`[NewsBanner] Could not load image: ${currentItem.image}`);
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Overlay für bessere Text-Lesbarkeit */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Text-Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
              {currentItem.title}
            </h3>
            <p className="text-sm md:text-base text-gray-300">
              {currentItem.description}
            </p>
            <div className="mt-2 flex items-center text-red-400 text-sm font-semibold">
              <span>Mehr erfahren</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {NEWS_ITEMS.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(index);
            }}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'w-8 bg-red-600'
                : 'w-2 bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
