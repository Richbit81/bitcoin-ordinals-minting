import React, { useState, useEffect, useRef } from 'react';

interface RecentMintItem {
  inscriptionId: string;
  name: string;
  imageUrl: string;
  type: 'delegate' | 'original';
  mintedAt: number;
}

interface RecentMintsBannerProps {
  collectionId: string;
}

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export const RecentMintsBanner: React.FC<RecentMintsBannerProps> = ({ collectionId }) => {
  const [items, setItems] = useState<RecentMintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadRecentMints = async () => {
      try {
        const response = await fetch(`${API_URL}/api/collections/${collectionId}/recent-mints?limit=10`);
        if (!response.ok) {
          throw new Error('Failed to fetch recent mints');
        }
        const data = await response.json();
        setItems(data.items || []);
      } catch (error) {
        console.error('[RecentMintsBanner] Error loading recent mints:', error);
      } finally {
        setLoading(false);
      }
    };

    if (collectionId) {
      loadRecentMints();
      // Refresh alle 30 Sekunden
      const interval = setInterval(loadRecentMints, 30000);
      return () => clearInterval(interval);
    }
  }, [collectionId]);

  // Auto-Scroll Logic
  useEffect(() => {
    if (!scrollContainerRef.current || items.length === 0) return;

    const container = scrollContainerRef.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    // Nur scrollen wenn Content breiter als Container ist
    if (scrollWidth <= clientWidth) return;

    let scrollPosition = 0;
    const scrollSpeed = 1; // Pixel pro Frame
    const pauseDuration = 2000; // 2 Sekunden Pause am Ende
    let isPaused = false;
    let pauseStartTime = 0;

    const scroll = () => {
      if (isPaused) {
        if (Date.now() - pauseStartTime >= pauseDuration) {
          isPaused = false;
          scrollPosition = 0; // Zurück zum Anfang
        }
        return;
      }

      scrollPosition += scrollSpeed;
      
      if (scrollPosition >= scrollWidth - clientWidth) {
        isPaused = true;
        pauseStartTime = Date.now();
      } else {
        container.scrollLeft = scrollPosition;
      }
    };

    scrollIntervalRef.current = setInterval(scroll, 16); // ~60fps

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [items]);

  if (loading) {
    return (
      <div className="w-full bg-black/50 border-t border-b border-red-600 py-4">
        <div className="text-center text-gray-400">Loading recent mints...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-black/50 border-t border-b border-red-600 py-4 overflow-hidden">
      <div className="flex items-center gap-4 px-4">
        <div className="flex-shrink-0 text-red-600 font-bold text-sm whitespace-nowrap">
          Recent Mints:
        </div>
        <div
          ref={scrollContainerRef}
          className="flex-1 flex gap-4 overflow-x-auto scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {items.map((item) => (
            <div
              key={item.inscriptionId}
              className="flex-shrink-0 flex flex-col items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                window.open(`https://ordinals.com/inscription/${item.inscriptionId}`, '_blank');
              }}
            >
              <div className="relative w-20 h-20 bg-gray-900 border border-red-600 rounded overflow-hidden">
                <img
                  src={item.imageUrl || `${API_URL}/api/inscription/image/${item.inscriptionId}`}
                  alt={item.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback zu Ordinals.com
                    e.currentTarget.src = `https://ordinals.com/content/${item.inscriptionId}`;
                  }}
                />
                <div className="absolute top-1 right-1">
                  <span className={`text-[8px] px-1 py-0.5 rounded font-semibold ${
                    item.type === 'delegate' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-green-600 text-white'
                  }`}>
                    {item.type === 'delegate' ? 'D' : 'O'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-300 text-center max-w-[80px] truncate" title={item.name}>
                {item.name}
              </div>
            </div>
          ))}
          {/* Dupliziere Items für nahtloses Scrollen */}
          {items.map((item) => (
            <div
              key={`duplicate-${item.inscriptionId}`}
              className="flex-shrink-0 flex flex-col items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                window.open(`https://ordinals.com/inscription/${item.inscriptionId}`, '_blank');
              }}
            >
              <div className="relative w-20 h-20 bg-gray-900 border border-red-600 rounded overflow-hidden">
                <img
                  src={item.imageUrl || `${API_URL}/api/inscription/image/${item.inscriptionId}`}
                  alt={item.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = `https://ordinals.com/content/${item.inscriptionId}`;
                  }}
                />
                <div className="absolute top-1 right-1">
                  <span className={`text-[8px] px-1 py-0.5 rounded font-semibold ${
                    item.type === 'delegate' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-green-600 text-white'
                  }`}>
                    {item.type === 'delegate' ? 'D' : 'O'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-300 text-center max-w-[80px] truncate" title={item.name}>
                {item.name}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
