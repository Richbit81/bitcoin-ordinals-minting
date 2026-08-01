import React from 'react';
import { useNavigate } from 'react-router-dom';

type OpenSeaCollection = {
  name: string;
  cover: string;
  url: string;
  description: string;
  pixelated?: boolean;
  cta?: string;
  external?: boolean;
};

const OPENSEA_COLLECTIONS: OpenSeaCollection[] = [
  {
    name: 'Burn your Freakheadz!',
    cover: '/images/opensea-freakheadz.png',
    url: '/freakheadzburn',
    pixelated: true,
    external: false,
    cta: 'Open Burn Studio',
    description:
      'Burn one Twin and claim your Apex — immediate reveal on Robinhood Chain.',
  },
  {
    name: 'FreakHeadz',
    cover: '/images/opensea-freakheadz.png',
    url: 'https://opensea.io/collection/freakheadz',
    pixelated: true,
    description:
      '3,333 pixel heads on Robinhood Chain. Twins, exclusives, and Apex burn-claim energy.',
  },
  {
    name: 'Slums in the Hood',
    cover: '/images/opensea-slums.png',
    url: 'https://opensea.io/collection/slums-in-the-hood',
    description: 'Street stories from the hood — raw characters, hard corners, on-chain.',
  },
  {
    name: 'Surf Ace',
    cover: '/images/opensea-surf-ace.png',
    url: 'https://opensea.io/collection/surf-ace',
    description: 'Wave riders and board culture — Surf Ace on OpenSea.',
  },
  {
    name: 'RobinPulse',
    cover: '/images/opensea-robinpulse.png',
    url: 'https://opensea.io/collection/robinpulse',
    description: 'Pulse of the Robinhood Chain scene — collectible signal on OpenSea.',
  },
  {
    name: 'SplitVerse Panda',
    cover: '/images/opensea-splitverse-panda.png',
    url: 'https://opensea.io/collection/splitverse-panda',
    description: 'SplitVerse pandas — dual vibes, one collection.',
  },
  {
    name: 'ShitHood',
    cover: '/images/opensea-shithood.png',
    url: 'https://opensea.io/collection/shithood',
    description: 'Unfiltered hood chaos — ShitHood on OpenSea.',
  },
];

export const OpenSeaCollectionsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 800px at 20% -10%, rgba(32,129,226,0.35), transparent 60%),' +
          'radial-gradient(1000px 700px at 90% 10%, rgba(15,70,140,0.45), transparent 55%),' +
          'linear-gradient(160deg, #0b1a2e 0%, #071018 40%, #04080d 100%)',
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background:
            'radial-gradient(600px 600px at 50% 120%, rgba(32,129,226,0.16), transparent 70%)',
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-sky-300/70 hover:text-sky-200 flex items-center gap-2 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            BACK
          </button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3">
            <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(56,189,248,0.35)]">
              OPENSEA
            </span>
          </h1>
          <p className="text-sky-300/60 text-xs md:text-sm tracking-[0.3em] uppercase">
            My collections on OpenSea
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
          {OPENSEA_COLLECTIONS.map((c) => {
            const isExternal = c.external !== false;
            const isBurn = c.url === '/freakheadzburn';
            return (
              <div
                key={c.name}
                className={`group flex flex-col rounded-2xl overflow-hidden border backdrop-blur-sm shadow-2xl transition-all ${
                  isBurn
                    ? 'border-fuchsia-400/40 bg-fuchsia-500/10 shadow-fuchsia-950/40 hover:border-fuchsia-300/70'
                    : 'border-sky-500/20 bg-white/[0.03] shadow-sky-950/40 hover:border-sky-400/50'
                }`}
              >
                <div className="aspect-square overflow-hidden bg-black/40">
                  <img
                    src={c.cover}
                    alt={c.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    style={c.pixelated ? { imageRendering: 'pixelated' } : undefined}
                  />
                </div>

                <div className="flex flex-col flex-1 p-5">
                  <h2 className="text-xl font-bold text-white mb-2">{c.name}</h2>
                  <p className="text-sm text-sky-100/60 leading-relaxed flex-1">{c.description}</p>

                  <a
                    href={c.url}
                    {...(isExternal
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className={`mt-5 inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-sm tracking-wide transition-all shadow-lg ${
                      isBurn
                        ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-500 hover:to-pink-400 shadow-fuchsia-900/30'
                        : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-sky-900/30'
                    }`}
                  >
                    {c.cta || 'View on OpenSea'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <a
            href="https://opensea.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300/50 hover:text-sky-200 text-xs tracking-widest uppercase transition-colors"
          >
            opensea.io &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};

export default OpenSeaCollectionsPage;
