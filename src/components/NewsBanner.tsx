import React, { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  fullWidth?: boolean; // Spezieller Banner, der den ganzen Platz einnimmt
  images?: string[]; // Array von Bildern für Full-Width Banner
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'no-func',
    title: 'NO_FUNC',
    description: '',
    image: '/images/NO_FUNC_87.png', // Fallback für normale Ansicht
    link: 'https://ord-dropz.xyz/marketplace/listing_1767570381027',
    fullWidth: true,
    images: [
      '/images/NO_FUNC_87.png',
      '/images/NO_FUNC_88.png',
      '/images/NO_FUNC_89.png',
      '/images/NO_FUNC_90.png',
    ],
  },
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
  {
    id: 'thebox',
    title: 'Check out THE BOX space. Every Day on X',
    description: 'Check out on Magic Eden',
    image: '/images/Box.png',
    link: 'https://magiceden.io/ordinals/marketplace/thebox',
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
    // Wenn item1 fullWidth ist, zeige nur item1
    if (item1.fullWidth) {
      return [item1, null];
    }
    const item2 = NEWS_ITEMS[(currentIndex + 1) % NEWS_ITEMS.length];
    // Wenn item2 fullWidth ist, überspringe es
    if (item2.fullWidth) {
      const item2Index = (currentIndex + 2) % NEWS_ITEMS.length;
      return [item1, NEWS_ITEMS[item2Index]];
    }
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

  // Prüfe ob aktuelles Item Full-Width ist
  const isFullWidth = item1?.fullWidth;

  return (
    <div 
      className="w-full max-w-4xl mx-auto mb-8 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Spezieller Full-Width Banner */}
      {isFullWidth && item1 ? (
        <div 
          onClick={() => handleClick(item1.link)}
          className="bg-black border-2 border-white rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="p-6">
            {/* 4 Bilder nebeneinander */}
            <div className="flex gap-4 justify-center items-center mb-4">
              {item1.images?.map((img, index) => (
                <div key={index} className="flex-shrink-0">
                  <img
                    src={img}
                    alt={`${item1.title} ${index + 1}`}
                    className="h-32 md:h-40 w-auto object-contain"
                    onError={(e) => {
                      console.warn(`[NewsBanner] Could not load image: ${img}`);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Text groß */}
            <div className="text-center">
              <h3 className="text-3xl md:text-4xl font-bold text-white">
                {item1.title}
              </h3>
            </div>
          </div>
        </div>
      ) : (
        /* Normaler Banner mit 2 Items nebeneinander */
        <div className="bg-gray-900 border-2 border-white rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white">
          {/* Item 1 */}
          <div
            onClick={() => handleClick(item1.link)}
            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800 transition-all group"
          >
            {/* Bild links */}
            <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden rounded bg-gray-800">
              <img
                src={item1.image}
                alt={item1.title}
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                onError={(e) => {
                  console.warn(`[NewsBanner] Could not load image: ${item1.image}`);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            
            {/* Text rechts */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-white mb-1 line-clamp-1">
                {item1.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-300 mb-2 line-clamp-1">
                {item1.description}
              </p>
              <div className="flex items-center text-white text-xs font-semibold">
                <span>LFG!</span>
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <div
            onClick={() => handleClick(item2.link)}
            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800 transition-all group"
          >
            {/* Bild links */}
            <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden rounded bg-gray-800">
              <img
                src={item2.image}
                alt={item2.title}
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                onError={(e) => {
                  console.warn(`[NewsBanner] Could not load image: ${item2.image}`);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            
            {/* Text rechts */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-white mb-1 line-clamp-1">
                {item2.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-300 mb-2 line-clamp-1">
                {item2.description}
              </p>
              <div className="flex items-center text-white text-xs font-semibold">
                <span>LFG!</span>
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Navigation Dots - für Slides (jeder Slide = 2 Items, außer Full-Width) */}
      {!isFullWidth && (
        <div className="flex justify-center gap-2 mt-3">
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
      )}
    </div>
  );
};
