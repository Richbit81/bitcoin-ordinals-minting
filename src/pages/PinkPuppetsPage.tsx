import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tweet } from 'react-tweet';
import { UnifiedChatPanel } from '../components/chat/UnifiedChatPanel';
import { AuthGateCard } from '../components/chat/AuthGateCard';
import { AdminRoomManager } from '../components/chat/AdminRoomManager';
import { usePinkChatAuth } from '../contexts/PinkChatAuthContext';
import { FloatingPuppetsLayer } from '../components/FloatingPuppetsLayer';

const FALLBACK_TWEETS = [
  '2039902984558043314',
  '2039676195684700171',
  '2039519039580676112',
  '2038477591343243423',
];

export const PinkPuppetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = usePinkChatAuth();
  const [promoIndex, setPromoIndex] = React.useState(0);
  const [tweetIds, setTweetIds] = React.useState<string[]>(FALLBACK_TWEETS);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/twitter-feed?user=PinkPuppets_&limit=5')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ids?.length) setTweetIds(data.ids);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const promoBanners = React.useMemo(
    () => [
      {
        href: 'https://openpage.fun/badges/9161ff5e-79a1-4376-b6b4-f7036b9903d6',
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
      <div className="relative z-10 w-full px-3 py-4 sm:px-4 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1440px]">

          {/* Banner */}
          <div className="mb-3 rounded-2xl border-2 border-pink-400/80 bg-gradient-to-r from-[#ff4fcf]/20 to-[#ff8de2]/10 p-2 shadow-[0_0_30px_rgba(255,79,207,0.15)] sm:p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                onClick={() => navigate('/')}
                className="shrink-0 rounded-lg border border-pink-400/60 bg-black/30 px-2.5 py-1 text-[11px] text-pink-200 hover:bg-pink-900/30"
              >
                ← Home
              </button>
              <button
                onClick={() => navigate('/pinkpuppets/marketplace')}
                className="shrink-0 rounded-lg border-2 border-black bg-[#ff4fcf] px-4 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0_#000] transition hover:translate-y-[-1px] hover:bg-[#ff61d6]"
              >
                PuppetMarket
              </button>
            </div>
            <img
              src="/images/pinkpuppets-banner.png"
              alt="PinkPuppets Banner"
              className="mx-auto max-h-[90px] w-full rounded-lg object-contain sm:max-h-[110px]"
            />
          </div>

          {/* Main layout: content left + sidebar right */}
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">

            {/* Left: Promo + Twitter (main focus) */}
            <main className="min-w-0 order-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
              <a
                href={promoBanners[promoIndex].href}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col overflow-hidden rounded-2xl border border-pink-300/70 bg-black/35 p-3 transition hover:border-pink-200"
              >
                <img
                  src={promoBanners[promoIndex].image}
                  alt={promoBanners[promoIndex].title}
                  className="w-full flex-1 rounded-lg object-contain"
                  loading="lazy"
                />
                <div className="mt-2 text-center">
                  <p className="text-sm font-bold text-pink-100 group-hover:text-white">{promoBanners[promoIndex].title}</p>
                  <p className="text-[11px] text-pink-200/75 mt-0.5">{promoBanners[promoIndex].subtitle}</p>
                </div>
                <div className="mt-2 flex justify-center gap-1.5">
                  {promoBanners.map((_, idx) => (
                    <span key={idx} className={`block h-1 rounded-full transition-all ${promoIndex === idx ? 'w-5 bg-pink-300' : 'w-1.5 bg-pink-400/40'}`} />
                  ))}
                </div>
              </a>

              <div className="rounded-2xl border border-pink-300/70 bg-black/35 p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-pink-100">Latest Posts</h2>
                  <a href="https://x.com/PinkPuppets_" target="_blank" rel="noreferrer" className="text-[11px] text-pink-200/90 hover:text-pink-100 shrink-0">View on X</a>
                </div>
                <div className="flex-1 max-h-[500px] overflow-y-auto rounded-lg border border-pink-300/40 bg-black/40 p-2" data-theme="dark">
                  {tweetIds.map((id) => (
                    <div key={id} className="mb-2 last:mb-0 [&_>div]:!my-0">
                      <Tweet id={id} />
                    </div>
                  ))}
                </div>
              </div>
            </main>

            {/* Right sidebar: Auth + Admin + Chat */}
            <aside className="min-w-0 order-2 flex flex-col gap-3">
              <AuthGateCard />
              {user?.role === 'admin' && token && (
                <AdminRoomManager token={token} onRoomCreated={() => {}} />
              )}
              <UnifiedChatPanel />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

