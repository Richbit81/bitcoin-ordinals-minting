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
  // Zeige immer 2 Items gleichzeitig, rotiere in 2er-Schritten
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        // Springe um 2 weiter, damit immer 2 Items sichtbar sind
        const next = prev + 2;
        // Wenn wir am Ende sind, starte von vorne
        return next >= NEWS_ITEMS.length ? 0 : next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovered]);

  // Berechne die beiden aktuellen Items
  const getCurrentItems = () => {
    const item1 = NEWS_ITEMS[currentIndex];
    const item2 = NEWS_ITEMS[(currentIndex + 1) % NEWS_ITEMS.length];
    return [item1, item2];
  };

  const [item1, item2] = getCurrentItems();

  const handleClick = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Berechne die Anzahl der "Slides" (jeder Slide zeigt 2 Items)
  const slideCount = Math.ceil(NEWS_ITEMS.length / 2);

  return (
    <div 
      className="w-full max-w-6xl mx-auto mb-8 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banner mit 2 Items nebeneinander */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Item 1 */}
        <div
          onClick={() => handleClick(item1.link)}
          className="relative bg-gray-900 border-2 border-red-600 rounded-lg overflow-hidden cursor-pointer hover:border-red-500 transition-all group"
        >
          {/* Bild - quadratisch/hochformat optimiert */}
          <div className="relative w-full aspect-square overflow-hidden">
            <img
              src={item1.image}
              alt={item1.title}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                console.warn(`[NewsBanner] Could not load image: ${item1.image}`);
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Overlay für bessere Text-Lesbarkeit */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            
            {/* Text-Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                {item1.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-300 mb-2">
                {item1.description}
              </p>
              <div className="flex items-center text-red-400 text-xs font-semibold">
                <span>Mehr erfahren</span>
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Item 2 */}
        <div
          onClick={() => handleClick(item2.link)}
          className="relative bg-gray-900 border-2 border-red-600 rounded-lg overflow-hidden cursor-pointer hover:border-red-500 transition-all group"
        >
          {/* Bild - quadratisch/hochformat optimiert */}
          <div className="relative w-full aspect-square overflow-hidden">
            <img
              src={item2.image}
              alt={item2.title}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                console.warn(`[NewsBanner] Could not load image: ${item2.image}`);
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Overlay für bessere Text-Lesbarkeit */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            
            {/* Text-Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                {item2.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-300 mb-2">
                {item2.description}
              </p>
              <div className="flex items-center text-red-400 text-xs font-semibold">
                <span>Mehr erfahren</span>
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Dots - für Slides (jeder Slide = 2 Items) */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: slideCount }).map((_, slideIndex) => {
          const slideStartIndex = slideIndex * 2;
          const isActive = currentIndex === slideStartIndex || 
                          (currentIndex + 1) % NEWS_ITEMS.length === slideStartIndex ||
                          (currentIndex === NEWS_ITEMS.length - 1 && slideIndex === slideCount - 1);
          
          return (
            <button
              key={slideIndex}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(slideStartIndex);
              }}
              className={`h-2 rounded-full transition-all ${
                isActive
                  ? 'w-8 bg-red-600'
                  : 'w-2 bg-gray-600 hover:bg-gray-500'
              }`}
              aria-label={`Go to slide ${slideIndex + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
};
