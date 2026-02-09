import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  fullWidth?: boolean; // Spezieller Banner, der den ganzen Platz einnimmt
  images?: string[]; // Array von Bildern für Full-Width Banner
  video?: string; // Video URL für Full-Width Banner mit Video
  iframeUrl?: string; // Live HTML Ordinal preview via iframe
  isInternal?: boolean; // Interner Link (React Router) statt externer Link
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'bitcoin-mixtape',
    title: 'Bitcoin Mix Tape',
    description: '17 Tracks fully on-chain - Mint Now!',
    image: '/mixtape.png',
    link: '/bitcoin-mixtape',
    fullWidth: true,
    video: '/videos/mixtape-intro.mp4',
    isInternal: true,
  },
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
    id: 'scanmode',
    title: 'SCANMODE',
    description: 'Check out on Magic Eden',
    image: 'https://ordinals.com/content/fb6c2e54a61b392ad5699091e68a2d2bfac7af4fe5b2505a25011a7ae4b92be7i0',
    link: 'https://magiceden.io/ordinals/marketplace/scanmode',
    fullWidth: true,
    images: [
      'https://ordinals.com/content/fb6c2e54a61b392ad5699091e68a2d2bfac7af4fe5b2505a25011a7ae4b92be7i0',
      'https://ordinals.com/content/1d70ccfb759800d81ddbc83b7ce1b83b340e76e3d1b99292ef5ea518f06c8b03i0',
      'https://ordinals.com/content/cf3082beecdfff7b004c65b4375be319dd13c2cf9b5ce33e36c615b52ac8c52ei0',
      'https://ordinals.com/content/7f3b75cd161cc196b8cc9b5acf8e84323582c1fc7b1b916ecaf210c0e6e9c788i0',
      'https://ordinals.com/content/877316e6bb31b76389bd33fe4c94f136c3770eb9a080b40a3cbc6cfc1311fa4ai0',
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
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-Rotation alle 5 Sekunden (nur wenn nicht gehovered)
  // Zeige immer 2 Items gleichzeitig, rotiere in 2er-Schritten
  // Bei Full-Width Items: springe um 1 weiter
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const currentItem = NEWS_ITEMS[prev];
        // Wenn aktuelles Item Full-Width ist, springe um 1 weiter
        if (currentItem?.fullWidth) {
          return (prev + 1) % NEWS_ITEMS.length;
        }
        // Sonst springe um 2 weiter, damit immer 2 Items sichtbar sind
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

  const handleClick = (link: string, isInternal?: boolean) => {
    if (isInternal) {
      navigate(link);
    } else {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
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
          onClick={() => handleClick(item1.link, item1.isInternal)}
          className="bg-black border-2 border-white rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative"
        >
          {/* Iframe Banner - Live HTML Ordinal Preview */}
          {item1.iframeUrl ? (
            <div className="relative min-h-[200px] md:min-h-[280px] flex items-stretch overflow-hidden">
              {/* Live iframe im Hintergrund */}
              <iframe
                src={item1.iframeUrl}
                className="absolute inset-0 w-full h-full border-0"
                title={item1.title}
                sandbox="allow-scripts allow-same-origin"
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{
                  pointerEvents: 'none',
                  transform: 'scale(1)',
                  transformOrigin: 'top left',
                }}
              />
              {/* Gradient Overlay für Lesbarkeit */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />
              {/* Content unten */}
              <div className="relative z-10 flex items-end justify-between w-full px-6 py-4 mt-auto">
                <div>
                  <h3 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
                    {item1.title}
                  </h3>
                  <p className="text-sm md:text-lg text-green-400 font-semibold mt-1">
                    {item1.description}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold text-white transition-colors flex-shrink-0">
                  <span>🎯 FREE MINT</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ) : item1.video ? (
            <div className="relative min-h-[120px] md:min-h-[160px] flex items-center">
              {/* Video im Hintergrund */}
              <video
                src={item1.video}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
              {/* Content */}
              <div className="relative z-10 flex items-center justify-between w-full px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 md:w-28 md:h-28 flex-shrink-0 rounded-lg overflow-hidden border-2 border-red-600 shadow-lg shadow-red-600/30">
                    <img
                      src={item1.image}
                      alt={item1.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
                      {item1.title}
                    </h3>
                    <p className="text-sm md:text-lg text-red-400 font-semibold mt-1">
                      {item1.description}
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-bold text-white transition-colors">
                  <span>🎵 MINT NOW</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            /* 4 Bilder nebeneinander - volle Banner-Höhe */
            <div className="flex gap-4 justify-center items-center p-4 min-h-[120px] md:min-h-[140px]">
              {item1.images?.map((img, index) => (
                <div key={index} className="flex-shrink-0 h-full flex items-center">
                  <img
                    src={img}
                    alt={`${item1.title} ${index + 1}`}
                    className="h-[100px] md:h-[120px] w-auto object-contain"
                    onError={(e) => {
                      console.warn(`[NewsBanner] Could not load image: ${img}`);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ))}
              {/* Text groß - über die Bilder, rechtsbündig */}
              <div className="absolute top-4 right-4 md:top-6 md:right-6">
                <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  {item1.title}
                </h3>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Normaler Banner mit 2 Items nebeneinander */
        <div className="bg-black border-2 border-white rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white">
          {/* Item 1 */}
          <div
            onClick={() => handleClick(item1.link, item1.isInternal)}
            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-900 transition-all group"
          >
            {/* Bild links */}
            <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden rounded bg-black">
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
            onClick={() => handleClick(item2.link, item2.isInternal)}
            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-900 transition-all group"
          >
            {/* Bild links */}
            <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden rounded bg-black">
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
