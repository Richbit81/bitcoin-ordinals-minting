import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicChatPanel } from '../components/chat/PublicChatPanel';
import { LevelSpacePanel } from '../components/chat/LevelSpacePanel';
import { FloatingPuppetsLayer } from '../components/FloatingPuppetsLayer';

export const PinkPuppetsPage: React.FC = () => {
  const navigate = useNavigate();
  const twitterEmbedRef = React.useRef<HTMLDivElement | null>(null);
  const [twitterEmbedFailed, setTwitterEmbedFailed] = React.useState(false);
  const [twitterLoading, setTwitterLoading] = React.useState(true);
  const [promoIndex, setPromoIndex] = React.useState(0);

  const promoBanners = React.useMemo(
    () => [
      {
        href: 'https://op.xyz/communities/pink-puppets',
        image: '/images/pinkpuppets-openpage.avif',
        title: 'PinkPuppets on Openpage!',
        subtitle: 'Open the PinkPuppets community on op.xyz',
      },
      {
        href: 'https://www.ord-x.com/item/Pink-Puppets',
        image: '/images/pinkpuppets-genesis.avif',
        title: 'Mint Phase 2 is coming on Ord-x.com!',
        subtitle: 'Prepare for the next PinkPuppets mint phase',
      },
    ],
    []
  );

  const loadTwitterTimeline = React.useCallback(async () => {
    const container = twitterEmbedRef.current;
    const twttr = (window as any).twttr;
    if (!container || !twttr?.widgets?.createTimeline) return false;
    try {
      setTwitterLoading(true);
      setTwitterEmbedFailed(false);
      container.innerHTML = '';
      await twttr.widgets.createTimeline(
        { sourceType: 'profile', screenName: 'PinkPuppets_' },
        container,
        {
          theme: 'dark',
          tweetLimit: 1,
          width: 320,
          height: 180,
          chrome: 'noheader nofooter noborders transparent',
        }
      );
      const hasIframe = !!container.querySelector('iframe');
      if (!hasIframe) {
        setTwitterEmbedFailed(true);
        setTwitterLoading(false);
        return false;
      }
      setTwitterLoading(false);
      return true;
    } catch {
      setTwitterEmbedFailed(true);
      setTwitterLoading(false);
      return false;
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;
    const tryInit = async () => {
      if (cancelled) return;
      const ok = await loadTwitterTimeline();
      if (ok && intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://platform.twitter.com/widgets.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      script.onload = () => void tryInit();
      document.body.appendChild(script);
    } else {
      void tryInit();
    }
    intervalId = window.setInterval(() => {
      void tryInit();
    }, 1200);
    const timeout = window.setTimeout(() => {
      const hasIframe = !!twitterEmbedRef.current?.querySelector('iframe');
      if (!hasIframe) {
        setTwitterEmbedFailed(true);
        setTwitterLoading(false);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }, 4500);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.clearTimeout(timeout);
    };
  }, [loadTwitterTimeline]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % promoBanners.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [promoBanners.length]);

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/pinkpuppets-clouds-bg.avif')" }}
    >
      <div className="absolute inset-0 bg-[#130015]/40" />
      <FloatingPuppetsLayer />
      <div className="relative z-10 w-full px-3 py-10 xl:px-6">
        <div className="mx-auto w-full max-w-[1200px]">
          <button
            onClick={() => navigate('/')}
            className="mb-6 rounded-lg border border-pink-400/60 bg-black/30 px-3 py-2 text-sm text-pink-200 hover:bg-pink-900/30"
          >
            ← Back to Home
          </button>

          <section className="mx-auto w-full rounded-2xl border-2 border-pink-400/80 bg-gradient-to-br from-[#ff4fcf]/20 to-[#ff8de2]/15 p-4 shadow-[0_0_40px_rgba(255,79,207,0.20)] md:p-7">
            <div className="mx-auto mb-5 w-full max-w-[920px] overflow-hidden rounded-xl border border-pink-300/60 bg-black/35 p-2 md:p-3">
              <img
                src="/images/pinkpuppets-banner.png"
                alt="PinkPuppets Banner"
                className="mx-auto max-h-[170px] w-full rounded-lg object-contain md:max-h-[210px]"
              />
            </div>
            <div className="mx-auto mt-1 w-full max-w-[920px]">
              <button
                onClick={() => navigate('/pinkpuppets/marketplace')}
                className="rounded-xl border-2 border-black bg-[#ff4fcf] px-5 py-3 text-sm font-bold text-black shadow-[3px_3px_0_#000] transition hover:translate-y-[-1px] hover:bg-[#ff61d6]"
              >
                Open PuppetMarket
              </button>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_380px] 2xl:grid-cols-[360px_minmax(0,1fr)_420px]">
          <aside className="order-2 xl:order-1 xl:sticky xl:top-20 h-fit">
            <PublicChatPanel />
          </aside>

          <main className="order-1 xl:order-2 mx-auto w-full max-w-[1200px]">
            <div className="mx-auto grid w-full items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="w-full lg:h-[250px]">
            <a
              href={promoBanners[promoIndex].href}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full w-full items-center overflow-hidden rounded-2xl border border-pink-300/70 bg-black/35 p-3 transition hover:border-pink-200 md:p-4"
            >
              <div className="flex w-full flex-col items-center gap-3 md:flex-row md:gap-5">
                <img
                  src={promoBanners[promoIndex].image}
                  alt={promoBanners[promoIndex].title}
                  className="h-auto w-full max-w-[320px] rounded-lg object-contain"
                  loading="lazy"
                />
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-bold text-pink-100 group-hover:text-pink-50">{promoBanners[promoIndex].title}</h3>
                  <p className="mt-1 text-sm text-pink-200/85">{promoBanners[promoIndex].subtitle}</p>
                </div>
              </div>
            </a>
            <div className="mt-2 flex justify-center gap-2">
              {promoBanners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromoIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${promoIndex === idx ? 'w-6 bg-pink-200' : 'w-2 bg-pink-300/50 hover:bg-pink-200/80'}`}
                  aria-label={`Show promo ${idx + 1}`}
                />
              ))}
            </div>
              </section>

              <section className="w-full rounded-2xl border border-pink-300/70 bg-black/35 p-3 lg:h-[250px]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-pink-100">Latest Post</h2>
              <a
                href="https://x.com/PinkPuppets_"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-pink-200/90 hover:text-pink-100"
              >
                View on X
              </a>
            </div>
            <div ref={twitterEmbedRef} className="h-[180px] overflow-hidden rounded-lg border border-pink-300/40 bg-black/40 p-1.5" />
            {twitterEmbedFailed && (
              <div className="mt-2 rounded-lg border border-yellow-300/50 bg-yellow-900/20 px-2 py-1.5 text-[11px] text-yellow-100">
                X embed blocked. Open{' '}
                <a className="underline" href="https://x.com/PinkPuppets_" target="_blank" rel="noreferrer">
                  @PinkPuppets_
                </a>
                .
              </div>
            )}
            {!twitterEmbedFailed && twitterLoading && (
              <p className="mt-2 text-[11px] text-pink-200/70">Loading latest post...</p>
            )}
              </section>
            </div>
          </main>

          <aside className="order-3 xl:sticky xl:top-20 h-fit">
            <LevelSpacePanel />
          </aside>
        </div>
      </div>
    </div>
  );
};

