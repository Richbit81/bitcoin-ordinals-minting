import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LinkItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: 'game' | 'collection' | 'marketplace' | 'social' | 'other';
  image?: string; // Vorschaubild
  inscriptionId?: string; // Für Fullscreen-Preview (z.B. Synthesizer)
  specs?: string[]; // Für Specs (z.B. SEQUENCER)
  features?: string[]; // Für Features (z.B. TACTICAL)
  hasPreview?: boolean; // Ob Item ein Fullscreen-Modal haben soll
}

const LINK_ITEMS: LinkItem[] = [
  // Games
  {
    id: 'tactical',
    title: 'Tactical The Game',
    description: 'Tactical is a turn-based tactical strategy game. Command an elite squad and complete missions against alien enemies.',
    url: 'https://lunalauncher.io/#mint/richart-tactical-game',
    category: 'game',
    image: '/images/Tactical.jpg',
    hasPreview: true,
    features: [
      'Turn-based combat system with Action Points',
      'Fog of War mechanics that reveal the battlefield as you explore',
      'Multiple weapon modes: Snap Shot, Aimed Shot, Burst',
      'Special abilities: Psi attacks, Teleport, Shield, Overwatch, Grenades, Medkits',
      'Campaign mode with Command Center: manage your soldiers, equipment, and progression between missions',
      'Map Editor to create custom missions',
      'Arcade Mode with predefined missions',
      'Multiple difficulty Levels',
    ],
  },
  {
    id: 'street-reign',
    title: 'Street Reign The Dealer Game',
    description: 'Mint on Lunalauncher',
    url: 'https://lunalauncher.io/#mint/richart-street-reign',
    category: 'game',
    image: '/images/StreetReign.png',
  },
  {
    id: 'blocktris',
    title: 'BLOCKTRIS',
    description: 'Tetris Clone in Bitmap/Memepool style - Mint on lunalauncher.io',
    url: 'https://magiceden.io/ordinals/marketplace/blocktris',
    category: 'game',
    image: '/images/Blocktriss.png',
  },
  {
    id: 'sequencer',
    title: 'SEQUENCER',
    description: 'Welcome to the S3QU3NC3R. An audio system completely as a standalone ordinal. It consists of over 8,000 lines of code. Mint Live on Lunalauncher.io',
    url: 'https://magiceden.io/ordinals/marketplace/sequencer',
    category: 'game',
    image: '/images/Sequencer.png',
    hasPreview: true,
    specs: [
      '8 Banks with 16 Steps, 9 Instruments',
      '21 Effects, 2 FX per Instrument + EQ + Volume',
      'Polyphony Control',
      'Tone.js Framework + HTML Audio',
      'Design with 4 themes',
      '8 Audio Chains max (Auto-cleanup)',
      'Memory Management with Garbage Collection',
      'Import/Export Fiction via Text',
      'AI Composition & Generative Patterns',
      'Euclidean Rhythms & Pattern Evolution',
      'Polyrhythmic Support',
    ],
  },
  {
    id: 'synthesizer',
    title: 'RichArt Synthesizer',
    description: 'Beta version of the RichArt Synthesizer',
    url: 'https://ordinals.com/inscription/26f1282b9473c0aa38c7fad53cf3d147cec3c85769540009956b3924f002a9d7i0',
    category: 'game',
    image: 'https://ordinals.com/content/26f1282b9473c0aa38c7fad53cf3d147cec3c85769540009956b3924f002a9d7i0',
    inscriptionId: '26f1282b9473c0aa38c7fad53cf3d147cec3c85769540009956b3924f002a9d7i0',
    hasPreview: true,
  },
  {
    id: 'consciousness-simulator',
    title: 'Inside the Consciousness Simulator',
    description: 'Card Packs',
    url: 'https://www.ord-x.com/#Inside-the-Consciousness-Simulator',
    category: 'collection',
    image: '/images/Simulator.jpeg',
  },
  {
    id: 'critical-view',
    title: 'Critical View',
    description: 'View on Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/criticalview',
    category: 'collection',
    image: '/images/Cview.png',
  },
  
  // Collections
  {
    id: 'skull-goats',
    title: 'Skull Goats by RichArt',
    description: '25 different Skull Goat ordinals',
    url: 'https://magiceden.io/ordinals/marketplace/skullgoats',
    category: 'collection',
    image: '/images/SKG.jpg',
  },
  {
    id: 'ordheadz',
    title: 'ORDHEADZ',
    description: '1,111 Ordheadz with over 200 layers',
    url: 'https://magiceden.io/ordinals/marketplace/ohdz',
    category: 'collection',
    image: '/images/Ordheadz.png',
  },
  {
    id: 'conspiracy-narrative',
    title: 'Conspiracy Narrative',
    description: 'View on Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/conspiracynarrative',
    category: 'collection',
    image: '/images/ConspiracyNarrative.png',
  },
  {
    id: 'scanmode',
    title: 'scanmode by richart',
    description: 'Perceptions unfold across countless levels',
    url: 'https://magiceden.io/ordinals/marketplace/scanmode',
    category: 'collection',
    image: '/images/scanmode.avif',
  },
  {
    id: 'symmetry',
    title: 'Symmetry by Richart',
    description: 'Hand-drawn Series with striking symmetry',
    url: 'https://magiceden.io/ordinals/marketplace/symmetry',
    category: 'collection',
    image: '/images/symmetryy.png',
  },
  {
    id: 'symmetry-phoneutria',
    title: 'Symmetry by Richart - Phoneutria Fera',
    description: 'View on Gamma',
    url: 'https://gamma.io/ordinals/collections/symmetry-by-richart-phoneutria-fera',
    category: 'collection',
    image: '/images/symmetryy.png',
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
    image: '/images/bonecat.png',
  },
  {
    id: 'event-fold',
    title: 'Event Fold by RichArt',
    description: 'Places not found on any map. Zones between space and time.',
    url: 'https://magiceden.io/ordinals/marketplace/eventfold',
    category: 'collection',
    image: '/images/EventFold.jpg',
  },
  {
    id: 'combination-mix',
    title: 'Ordinals CombiNation Mix - Fusion 1000',
    description: 'Art made from art - 1000 pixel crossover ordinals',
    url: 'https://magiceden.io/ordinals/marketplace/combination-mix',
    category: 'collection',
    image: '/images/CombinationMix.png',
  },
  {
    id: 'ganja-onchain',
    title: 'GANJA Onchain Collection',
    description: 'Magic Eden & OKX',
    url: 'https://magiceden.io/ordinals/marketplace/ganja',
    category: 'collection',
    image: '/images/vyxvx.png',
  },
  {
    id: 'smile-a-bit',
    title: 'SMILE A BIT',
    description: 'Mint on Gamma & RUNES on Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/smile',
    category: 'collection',
    image: '/images/SmileaBittt.png',
  },
];

const CATEGORY_LABELS: Record<LinkItem['category'], string> = {
  game: '🎮 Games & Tech',
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
  const [selectedItem, setSelectedItem] = useState<LinkItem | null>(null);
  const [expandedSpecs, setExpandedSpecs] = useState<string | null>(null); // id of expanded item

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
                <div
                  key={item.id}
                  className={`block rounded-lg border-2 ${CATEGORY_COLORS[category as LinkItem['category']]} hover:scale-105 transition-all cursor-pointer overflow-hidden`}
                  onClick={() => {
                    if (item.hasPreview) {
                      setSelectedItem(item);
                    } else {
                      window.open(item.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {/* Vorschaubild */}
                  {(item.image || linkImages[item.id]) ? (
                    <div className="w-full aspect-square overflow-hidden bg-gray-900 relative">
                      {item.id === 'synthesizer' && item.image?.includes('ordinals.com/content') ? (
                        // Für Synthesizer: Verwende iframe wie in Tech & Games
                        <iframe
                          src={item.image}
                          className="w-full h-full border-0"
                          title={item.title}
                          sandbox="allow-scripts allow-same-origin"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{
                            transform: 'translateZ(0)',
                            willChange: 'auto',
                          }}
                        />
                      ) : (
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
                      )}
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-500 text-sm">
        <p>Oneironaut, Artist, Creator</p>
      </div>

      {/* Fullscreen Preview Modal */}
      {selectedItem && selectedItem.hasPreview && (
        <div
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={() => {
            setSelectedItem(null);
            setExpandedSpecs(null);
          }}
        >
          {/* Header with Close Button */}
          <div className="flex justify-between items-center p-4 border-b-2 border-red-600 bg-gray-900">
            <h2 className="text-2xl font-bold text-white">{selectedItem.title}</h2>
            <div className="flex items-center gap-4">
              <a
                href={selectedItem.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-semibold"
              >
                Open Link
              </a>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setExpandedSpecs(null);
                }}
                className="text-gray-400 hover:text-white p-2"
                title="Close (ESC)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            {/* Preview: iframe für Synthesizer, Bild für andere */}
            {selectedItem.inscriptionId ? (
              <div 
                className="flex-1 w-full h-full bg-black overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe
                  src={`https://ordinals.com/content/${selectedItem.inscriptionId}`}
                  className="w-full h-full border-0 absolute inset-0"
                  title={selectedItem.title}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-fullscreen"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; webgl; xr-spatial-tracking"
                  allowFullScreen
                />
              </div>
            ) : selectedItem.image ? (
              <div 
                className="flex-1 w-full h-full bg-black overflow-hidden relative flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedItem.image}
                  alt={selectedItem.title}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : null}
          </div>

          {/* Footer with Info */}
          <div 
            className="p-4 border-t-2 border-red-600 bg-gray-900 text-white max-h-[40vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-7xl mx-auto">
              {/* Description */}
              {selectedItem.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-300">{selectedItem.description}</p>
                </div>
              )}
              
              {/* Specs/Features - Aufklappbar */}
              {(selectedItem.specs || selectedItem.features) && (
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedSpecs(expandedSpecs === selectedItem.id ? null : selectedItem.id)}
                    className="w-full text-left text-sm text-red-400 hover:text-red-300 font-semibold flex items-center justify-between transition-colors duration-300 mb-2"
                  >
                    <span>{selectedItem.specs ? 'Specs' : 'Main Features'}</span>
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 ${expandedSpecs === selectedItem.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSpecs === selectedItem.id && (
                    <div className="space-y-2 bg-gray-800/50 rounded p-3 max-h-64 overflow-y-auto">
                      {(selectedItem.specs || selectedItem.features)?.map((itemText, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="text-red-600 mt-0.5">•</span>
                          <span>{itemText}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
