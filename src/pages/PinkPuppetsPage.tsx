import React from 'react';
import { useNavigate } from 'react-router-dom';

export const PinkPuppetsPage: React.FC = () => {
  const navigate = useNavigate();
  const twitterEmbedRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://platform.twitter.com/widgets.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      script.onload = () => {
        const twttr = (window as any).twttr;
        if (twttr?.widgets?.load && twitterEmbedRef.current) {
          twttr.widgets.load(twitterEmbedRef.current);
        }
      };
      document.body.appendChild(script);
    } else {
      const twttr = (window as any).twttr;
      if (twttr?.widgets?.load && twitterEmbedRef.current) {
        twttr.widgets.load(twitterEmbedRef.current);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#1a001a] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 10px 10px, #ff4fcf 2px, transparent 0), radial-gradient(circle at 30px 30px, #ff9de8 2px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-4 py-10">
        <button
          onClick={() => navigate('/')}
          className="mb-6 rounded-lg border border-pink-400/60 bg-black/30 px-3 py-2 text-sm text-pink-200 hover:bg-pink-900/30"
        >
          ← Back to Home
        </button>

        <section className="rounded-2xl border-2 border-pink-400 bg-gradient-to-br from-[#ff4fcf]/25 to-[#ff8de2]/20 p-6 shadow-[0_0_40px_rgba(255,79,207,0.25)]">
          <div className="mx-auto mb-6 w-full max-w-[980px] overflow-hidden rounded-xl border-2 border-pink-300/70 bg-black/40">
            <img
              src="/images/pinkpuppets-banner.png"
              alt="PinkPuppets Banner"
              className="mx-auto max-h-[220px] w-full object-contain"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/pinkpuppets/marketplace')}
              className="rounded-xl border-2 border-black bg-[#ff4fcf] px-5 py-3 text-sm font-bold text-black shadow-[4px_4px_0_#000] hover:translate-y-[-1px]"
            >
              Open PuppetMarket
            </button>
            <button
              onClick={() => navigate('/marketplace?collection=pinkpuppets')}
              className="rounded-xl border border-pink-300/70 bg-black/40 px-5 py-3 text-sm font-semibold text-pink-100 hover:bg-pink-900/30"
            >
              Open Global Marketplace View
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-pink-300/70 bg-black/35 p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-pink-100 md:text-xl">Latest Post</h2>
            <a
              href="https://x.com/PinkPuppets_"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-pink-200/90 hover:text-pink-100 md:text-sm"
            >
              View profile on X
            </a>
          </div>
          <div ref={twitterEmbedRef} className="overflow-hidden rounded-lg border border-pink-300/40 bg-black/40 p-2">
            <a
              className="twitter-timeline"
              data-theme="dark"
              data-tweet-limit="1"
              data-chrome="noheader nofooter noborders"
              href="https://x.com/PinkPuppets_"
            >
              Posts by @PinkPuppets_
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

