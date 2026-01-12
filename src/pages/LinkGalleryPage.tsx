import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LinkItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: 'game' | 'collection' | 'marketplace' | 'social' | 'other';
  image?: string; // Vorschaubild
}

const LINK_ITEMS: LinkItem[] = [
  // Games
  {
    id: 'tactical',
    title: 'Tactical The Game',
    description: 'Mint on LunaLauncher',
    url: 'https://lunalauncher.io/#mint/richart-tactical-game',
    category: 'game',
    image: '/images/Tactical.jpg',
  },
  {
    id: 'street-reign',
    title: 'Street Reign The Dealer Game',
    description: 'Mint on Lunalauncher',
    url: 'https://lunalauncher.io/#mint/richart-street-reign',
    category: 'game',
  },
  {
    id: 'blocktris',
    title: 'BLOCKTRIS',
    description: 'Tetris Clone in Bitmap/Memepool style - Mint on lunalauncher.io',
    url: 'https://magiceden.io/ordinals/marketplace/blocktris',
    category: 'game',
  },
  {
    id: 'sequencer',
    title: 'SEQUENCER',
    description: 'Make Music with this Ordinal - View on Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/sequencer',
    category: 'game',
  },
  
  // Collections
  {
    id: 'skull-goats',
    title: 'Skull Goats by RichArt',
    description: '25 different Skull Goat ordinals',
    url: 'https://magiceden.io/ordinals/marketplace/skullgoats',
    category: 'collection',
  },
  {
    id: 'ordheadz',
    title: 'ORDHEADZ',
    description: '1,111 Ordheadz with over 200 layers',
    url: 'https://magiceden.io/ordinals/marketplace/ohdz',
    category: 'collection',
  },
  {
    id: 'conspiracy-narrative',
    title: 'Conspiracy Narrative',
    description: 'View on Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/conspiracynarrative',
    category: 'collection',
  },
  {
    id: 'scanmode',
    title: 'scanmode by richart',
    description: 'Perceptions unfold across countless levels',
    url: 'https://magiceden.io/ordinals/marketplace/scanmode',
    category: 'collection',
  },
  {
    id: 'symmetry',
    title: 'Symmetry by Richart',
    description: 'Hand-drawn Series with striking symmetry',
    url: 'https://magiceden.io/ordinals/marketplace/symmetry',
    category: 'collection',
  },
  {
    id: 'symmetry-phoneutria',
    title: 'Symmetry by Richart - Phoneutria Fera',
    description: 'View on Gamma',
    url: 'https://gamma.io/ordinals/collections/symmetry-by-richart-phoneutria-fera',
    category: 'collection',
  },
  {
    id: 'sons-of-satoshi',
    title: 'Sons of Satoshi Evolution',
    description: 'Hidden among us... against the system',
    url: 'https://magiceden.io/ordinals/marketplace/sosevo',
    category: 'collection',
    image: '/images/SOSEvo.jpg',
  },
  {
    id: 'bone-cat',
    title: 'Bone Cat',
    description: 'Bitcoin vibes with cat skulls - Mintpass for Badcats',
    url: 'https://magiceden.io/ordinals/marketplace/bonecat',
    category: 'collection',
  },
  {
    id: 'event-fold',
    title: 'Event Fold by RichArt',
    description: 'Places not found on any map. Zones between space and time.',
    url: 'https://magiceden.io/ordinals/marketplace/eventfold',
    category: 'collection',
  },
  {
    id: 'combination-mix',
    title: 'Ordinals CombiNation Mix - Fusion 1000',
    description: 'Art made from art - 1000 pixel crossover ordinals',
    url: 'https://magiceden.io/ordinals/marketplace/combination-mix',
    category: 'collection',
  },
  {
    id: 'ganja-onchain',
    title: 'GANJA Onchain Collection',
    description: 'Magic Eden & OKX',
    url: 'https://magiceden.io/ordinals/marketplace/ganja',
    category: 'collection',
  },
  {
    id: 'qubiixx',
    title: 'QUBIIXX ORDINALS Collection',
    description: 'Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/qubiixx',
    category: 'collection',
  },
  {
    id: 'smile-a-bit',
    title: 'SMILE A BIT',
    description: 'Mint on Gamma & RUNES on Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/smile',
    category: 'collection',
  },
  
  // Social
  {
    id: 'foundation',
    title: 'Foundation',
    url: 'https://foundation.app/@richart',
    category: 'social',
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    url: 'https://www.tiktok.com/@richart',
    category: 'social',
  },
];

const CATEGORY_LABELS: Record<LinkItem['category'], string> = {
  game: '🎮 Games',
  collection: '🎨 Collections',
  marketplace: '🛒 Marketplaces',
  social: '📱 Social',
  other: '🔗 Other',
};

const CATEGORY_COLORS: Record<LinkItem['category'], string> = {
  game: 'border-blue-500 bg-blue-900/20',
  collection: 'border-purple-500 bg-purple-900/20',
  marketplace: 'border-green-500 bg-green-900/20',
  social: 'border-pink-500 bg-pink-900/20',
  other: 'border-gray-500 bg-gray-900/20',
};

export const LinkGalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const [linkImages, setLinkImages] = useState<Record<string, string>>({});

  // Lade Bilder von Linktree für Items ohne lokale Bilder
  useEffect(() => {
    const loadLinktreeImages = async () => {
      try {
        // Linktree API Endpoint für richart81
        const response = await fetch('https://linktr.ee/api/profiles/richart81');
        if (response.ok) {
          const data = await response.json();
          // Linktree gibt Links mit Vorschaubildern zurück
          if (data.links) {
            const images: Record<string, string> = {};
            data.links.forEach((link: any) => {
              if (link.url && link.thumbnailUrl) {
                // Finde das entsprechende Item in LINK_ITEMS
                const item = LINK_ITEMS.find(i => i.url === link.url);
                if (item) {
                  images[item.id] = link.thumbnailUrl;
                }
              }
            });
            setLinkImages(images);
          }
        }
      } catch (error) {
        console.warn('[LinkGallery] Could not load images from Linktree:', error);
      }
    };

    loadLinktreeImages();
  }, []);

  const groupedLinks = LINK_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<LinkItem['category'], LinkItem[]>);

  return (
    <div className="min-h-screen bg-black text-white p-8 pt-20">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white flex items-center gap-2"
          title="Back to Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-semibold">Back</span>
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-12">
        <img
          src="/images/RichArt.png"
          alt="RichArt"
          className="h-24 mx-auto mb-4"
          onError={(e) => {
            console.warn('[LinkGallery] Could not load RichArt logo');
            e.currentTarget.style.display = 'none';
          }}
        />
        <h1 className="text-4xl font-bold mb-4">Link Gallery</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          All projects, collections and links from RichArt at a glance
        </p>
      </div>

      {/* Links grouped by category */}
      <div className="max-w-6xl mx-auto space-y-8">
        {Object.entries(groupedLinks).map(([category, items]) => (
          <div key={category}>
            <h2 className={`text-2xl font-bold mb-4 ${CATEGORY_COLORS[category as LinkItem['category']].split(' ')[0].replace('border-', 'text-')}`}>
              {CATEGORY_LABELS[category as LinkItem['category']]}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block rounded-lg border-2 ${CATEGORY_COLORS[category as LinkItem['category']]} hover:scale-105 transition-all cursor-pointer overflow-hidden`}
                >
                  {/* Vorschaubild */}
                  {(item.image || linkImages[item.id]) ? (
                    <div className="w-full aspect-square overflow-hidden bg-gray-900 relative">
                      <img
                        src={item.image || linkImages[item.id] || ''}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          console.warn(`[LinkGallery] Could not load image for ${item.id}, using fallback`);
                          // Zeige Platzhalter wenn Bild nicht geladen werden kann
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                <div class="text-center p-2">
                                  <div class="text-2xl mb-1">🎨</div>
                                  <p class="text-white text-xs font-semibold">${item.title}</p>
                                </div>
                              </div>
                            `;
                          }
                        }}
                      />
                    </div>
                  ) : (
                    // Fallback wenn kein Bild vorhanden
                    <div className="w-full aspect-square overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <div className="text-center p-2">
                        <div className="text-2xl mb-1">🎨</div>
                        <p className="text-white text-xs font-semibold">{item.title}</p>
                      </div>
                    </div>
                  )}
                  {/* Text-Content */}
                  <div className="p-2">
                    <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{item.title}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-300 mb-2 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center text-[10px] text-gray-400">
                      <span>Open</span>
                      <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-500 text-sm">
        <p>Oneironaut, Artist, Creator</p>
      </div>
    </div>
  );
};
