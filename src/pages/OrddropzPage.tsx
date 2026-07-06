import React from 'react';
import { useNavigate } from 'react-router-dom';

type OrddropzCollection = {
  name: string;
  cover: string;
  url: string;
  description: string;
  pixelated?: boolean;
};

const ORDDROPZ_COLLECTIONS: OrddropzCollection[] = [
  {
    name: 'Negative Type',
    cover: '/images/orddropz-negativetype.webp',
    url: 'https://ord-dropz.xyz/marketplace/listing_1782593496197',
    description:
      'Not every day is a good day. And honestly? That’s fine. This collection is for the versions of us ' +
      'that wake up already annoyed. The ones who are over it, done pretending, and not in the mood to smile ' +
      'through bullshit. Different characters, same energy: properly pissed off. No toxic positivity. No ' +
      '“just be grateful.” Just raw, unfiltered frustration — captured exactly how it feels. Because sometimes ' +
      'being angry is the most honest thing you can be. For when you’re not okay with being okay.',
  },
  {
    name: 'NO_FUNC',
    cover: '/images/orddropz-nofunc.png',
    url: 'https://ord-dropz.xyz/marketplace/listing_1767570381027',
    description: 'No Function Is The Point!',
  },
  {
    name: 'Ordheadz',
    cover: '/images/orddropz-ordheadz.png',
    url: 'https://ord-dropz.xyz/marketplace/listing_1763141209067',
    pixelated: true,
    description:
      'Who let them out? The Ordheadz. Funny little pixel rascals who only cause mischief. Here are 333 of ' +
      'them at a ridiculously low price. We\u2019re using this site\u2019s cool option to access multiple wallets.',
  },
];

export const OrddropzPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 800px at 20% -10%, rgba(139,92,246,0.35), transparent 60%),' +
          'radial-gradient(1000px 700px at 90% 10%, rgba(88,28,135,0.45), transparent 55%),' +
          'linear-gradient(160deg, #1a0b2e 0%, #120522 40%, #07040d 100%)',
      }}
    >
      {/* Soft glow blobs */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background:
            'radial-gradient(600px 600px at 50% 120%, rgba(168,85,247,0.18), transparent 70%)',
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-purple-300/70 hover:text-purple-200 flex items-center gap-2 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            BACK
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3">
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-violet-500 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(168,85,247,0.35)]">
              ORDDROPZ
            </span>
          </h1>
          <p className="text-purple-300/60 text-xs md:text-sm tracking-[0.3em] uppercase">
            My collections on Ord Dropz
          </p>
        </div>

        {/* Collections Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
          {ORDDROPZ_COLLECTIONS.map((c) => (
            <div
              key={c.name}
              className="group flex flex-col rounded-2xl overflow-hidden border border-purple-500/20 bg-white/[0.03] backdrop-blur-sm shadow-2xl shadow-purple-950/40 hover:border-purple-400/50 transition-all"
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
                <p className="text-sm text-purple-100/60 leading-relaxed flex-1">{c.description}</p>

                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-sm tracking-wide bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-purple-900/30"
                >
                  View on Ord Dropz
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href="https://ord-dropz.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300/50 hover:text-purple-200 text-xs tracking-widest uppercase transition-colors"
          >
            ord-dropz.xyz &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};

export default OrddropzPage;
