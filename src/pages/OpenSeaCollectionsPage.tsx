import React from 'react';
import { useNavigate } from 'react-router-dom';

type OpenSeaCollection = {
  name: string;
  cover?: string;
  url: string;
  description: string;
  pixelated?: boolean;
  cta?: string;
  external?: boolean;
  fireCover?: boolean;
};

const OPENSEA_COLLECTIONS: OpenSeaCollection[] = [
  {
    name: 'Burn your Freakheadz!',
    url: '/freakheadzburn',
    fireCover: true,
    external: false,
    cta: 'Open Burn Studio',
    description: 'Burn one Twin → claim Apex. Instant reveal.',
  },
  {
    name: 'FreakHeadz',
    cover: '/images/opensea-freakheadz.png',
    url: 'https://opensea.io/collection/freakheadz',
    pixelated: true,
    description: '3,333 pixel heads on Robinhood Chain.',
  },
  {
    name: 'Slums in the Hood',
    cover: '/images/opensea-slums.png',
    url: 'https://opensea.io/collection/slums-in-the-hood',
    description: 'Street stories from the hood.',
  },
  {
    name: 'Surf Ace',
    cover: '/images/opensea-surf-ace.png',
    url: 'https://opensea.io/collection/surf-ace',
    description: 'Wave riders and board culture.',
  },
  {
    name: 'RobinPulse',
    cover: '/images/opensea-robinpulse.png',
    url: 'https://opensea.io/collection/robinpulse',
    description: 'Pulse of the Robinhood Chain scene.',
  },
  {
    name: 'SplitVerse Panda',
    cover: '/images/opensea-splitverse-panda.png',
    url: 'https://opensea.io/collection/splitverse-panda',
    description: 'SplitVerse pandas — dual vibes.',
  },
  {
    name: 'ShitHood',
    cover: '/images/opensea-shithood.png',
    url: 'https://opensea.io/collection/shithood',
    description: 'Unfiltered hood chaos.',
  },
];

function FireCover() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#120406]">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 110%, rgba(255,80,0,0.85), transparent 70%),' +
            'radial-gradient(ellipse 50% 40% at 35% 95%, rgba(255,200,0,0.75), transparent 60%),' +
            'radial-gradient(ellipse 45% 35% at 65% 100%, rgba(255,40,0,0.7), transparent 55%),' +
            'linear-gradient(180deg, #1a0508 0%, #3a0808 45%, #7a1400 100%)',
          animation: 'fhFirePulse 2.4s ease-in-out infinite',
        }}
      />
      <div
        className="absolute inset-x-[-10%] bottom-[-20%] h-[85%]"
        style={{
          background:
            'radial-gradient(ellipse 35% 70% at 30% 80%, rgba(255,220,80,0.9), transparent 70%),' +
            'radial-gradient(ellipse 40% 75% at 50% 85%, rgba(255,120,20,0.95), transparent 72%),' +
            'radial-gradient(ellipse 35% 70% at 70% 80%, rgba(255,60,0,0.9), transparent 70%)',
          filter: 'blur(2px)',
          animation: 'fhFireFlicker 1.1s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background: 'linear-gradient(0deg, rgba(255,40,0,0.35), transparent)',
          animation: 'fhFireRise 1.8s linear infinite',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
        <span className="font-black tracking-[0.28em] text-base md:text-lg text-orange-50 drop-shadow-[0_2px_10px_rgba(255,80,0,0.9)]">
          BURN
        </span>
      </div>
      <style>{`
        @keyframes fhFirePulse {
          0%, 100% { transform: scale(1); opacity: 0.88; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes fhFireFlicker {
          0% { transform: translateY(4%) scaleX(0.96); opacity: 0.85; }
          100% { transform: translateY(-2%) scaleX(1.04); opacity: 1; }
        }
        @keyframes fhFireRise {
          0% { transform: translateY(8%); opacity: 0.35; }
          100% { transform: translateY(-6%); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}

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

      <div className="relative z-10 container mx-auto px-4 py-5 min-h-screen flex flex-col">
        <div className="mb-4">
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

        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-1">
            <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(56,189,248,0.35)]">
              OPENSEA
            </span>
          </h1>
          <p className="text-sky-300/60 text-[10px] md:text-xs tracking-[0.3em] uppercase">
            My collections on OpenSea
          </p>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-w-6xl mx-auto w-full content-start">
          {OPENSEA_COLLECTIONS.map((c) => {
            const isExternal = c.external !== false;
            const isBurn = Boolean(c.fireCover);
            return (
              <div
                key={c.name}
                className={`group flex flex-col rounded-xl overflow-hidden border backdrop-blur-sm shadow-lg transition-all ${
                  isBurn
                    ? 'border-orange-400/50 bg-orange-500/10 shadow-orange-950/40 hover:border-orange-300/80'
                    : 'border-sky-500/20 bg-white/[0.03] shadow-sky-950/40 hover:border-sky-400/50'
                }`}
              >
                <div className="aspect-[1200/630] overflow-hidden bg-black/50">
                  {c.fireCover ? (
                    <FireCover />
                  ) : (
                    <img
                      src={c.cover}
                      alt={c.name}
                      loading="lazy"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      style={c.pixelated ? { imageRendering: 'pixelated' } : undefined}
                    />
                  )}
                </div>

                <div className="flex flex-col flex-1 p-2.5">
                  <h2 className="text-sm font-bold text-white leading-tight mb-1">{c.name}</h2>
                  <p className="text-[11px] text-sky-100/55 leading-snug flex-1 line-clamp-2">{c.description}</p>

                  <a
                    href={c.url}
                    {...(isExternal
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className={`mt-2 inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md font-semibold text-[11px] tracking-wide transition-all shadow ${
                      isBurn
                        ? 'bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 shadow-orange-900/30'
                        : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-sky-900/30'
                    }`}
                  >
                    {c.cta || 'View on OpenSea'}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
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
