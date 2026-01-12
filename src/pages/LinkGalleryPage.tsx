import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LinkItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: 'game' | 'collection' | 'marketplace' | 'social' | 'other';
}

const LINK_ITEMS: LinkItem[] = [
  // Games
  {
    id: 'tactical',
    title: 'Tactical The Game',
    description: 'Mint on LunaLauncher',
    url: 'https://lunalauncher.io/#mint/richart-tactical-game',
    category: 'game',
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
    description: 'Make Music with this Ordinal - Mint Live on Lunalauncher.io',
    url: 'https://lunalauncher.io/#mint/richart-sequencer',
    category: 'game',
  },
  
  // Collections
  {
    id: 'skull-goats',
    title: 'Skull Goats by RichArt',
    description: '25 different Skull Goat ordinals - Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/skull-goats-richart',
    category: 'collection',
  },
  {
    id: 'ordheadz',
    title: 'ORDHEADZ',
    description: '1,111 Ordheadz with over 200 layers - Mint on ord-dropz.xyz',
    url: 'https://magiceden.io/ordinals/marketplace/ordheadz',
    category: 'collection',
  },
  {
    id: 'conspiracy-narrative',
    title: 'Conspiracy Narrative',
    description: 'View on Gamma',
    url: 'https://gamma.io/ordinals/collections/conspiracy-narrative',
    category: 'collection',
  },
  {
    id: 'scanmode',
    title: 'scanmode by richart',
    description: 'Perceptions unfold across countless levels - Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/scanmode-richart',
    category: 'collection',
  },
  {
    id: 'symmetry',
    title: 'Symmetry by Richart',
    description: 'Hand-drawn Series with striking symmetry - Magic Eden',
    url: 'https://magiceden.io/ordinals/marketplace/symmetry-richart',
    category: 'collection',
  },
  {
    id: 'symmetry-phoneutria',
    title: 'Symmetry by Richart - Phoneutria Fera',
    description: 'View on Gamma',
    url: 'https://gamma.io/ordinals/collections/symmetry-phoneutria',
    category: 'collection',
  },
  {
    id: 'sons-of-satoshi',
    title: 'Sons of Satoshi Evolution',
    description: 'Hidden among us... against the system',
    url: 'https://magiceden.io/ordinals/marketplace/sosevo',
    category: 'collection',
  },
  {
    id: 'bone-cat',
    title: 'Bone Cat',
    description: 'Bitcoin vibes with cat skulls - Also a Mintpass for Badcats Collection',
    url: 'https://magiceden.io/ordinals/marketplace/bone-cat',
    category: 'collection',
  },
  {
    id: 'event-fold',
    title: 'Event Fold by RichArt',
    description: 'Places not found on any map. Zones between space and time.',
    url: 'https://magiceden.io/ordinals/marketplace/event-fold',
    category: 'collection',
  },
  {
    id: 'combination-mix',
    title: 'Ordinals CombiNation Mix - Fusion 1000',
    description: 'Art made from art - 1000 pixel crossover ordinals collection',
    url: 'https://magiceden.io/ordinals/marketplace/combination-mix',
    category: 'collection',
  },
  {
    id: 'ganja-onchain',
    title: 'GANJA Onchain Collection',
    description: 'Magic Eden & OKX',
    url: 'https://magiceden.io/ordinals/marketplace/ganja-onchain',
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
    url: 'https://gamma.io/ordinals/collections/smile-a-bit',
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
          Alle Projekte, Collections und Links von RichArt auf einen Blick
        </p>
      </div>

      {/* Links grouped by category */}
      <div className="max-w-6xl mx-auto space-y-8">
        {Object.entries(groupedLinks).map(([category, items]) => (
          <div key={category}>
            <h2 className={`text-2xl font-bold mb-4 ${CATEGORY_COLORS[category as LinkItem['category']].split(' ')[0].replace('border-', 'text-')}`}>
              {CATEGORY_LABELS[category as LinkItem['category']]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-4 rounded-lg border-2 ${CATEGORY_COLORS[category as LinkItem['category']]} hover:scale-105 transition-all cursor-pointer`}
                >
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-300">{item.description}</p>
                  )}
                  <div className="mt-3 flex items-center text-xs text-gray-400">
                    <span>Öffnen</span>
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
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
