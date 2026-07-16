import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tweet } from 'react-tweet';
import { UnifiedChatPanel } from '../components/chat/UnifiedChatPanel';
import { AuthGateCard } from '../components/chat/AuthGateCard';
import { AdminRoomManager } from '../components/chat/AdminRoomManager';
import { usePinkChatAuth } from '../contexts/PinkChatAuthContext';
import { FloatingPuppetsLayer } from '../components/FloatingPuppetsLayer';
import { PinkPuppetsSlot2Section } from '../components/PinkPuppetsSlot2Section';

const PINKPUPPETS_MUSIC = '/audio/pinkpuppets.mp3';

/** Embedded via react-tweet — gewünschte Reihenfolge (3. Link zuerst) */
const FALLBACK_TWEETS = [
  '2050719758841262128', // https://x.com/PinkPuppets_/status/2050719758841262128
  '2053553147071934796', // https://x.com/PinkPuppets_/status/2053553147071934796
  '2053656947745026341', // https://x.com/PinkPuppets_/status/2053656947745026341
];

type SafeTweetProps = { id: string };

class SafeTweetBoundary extends React.Component<
  SafeTweetProps & { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('[PinkPuppets] Tweet embed failed:', this.props.id, err);
  }

  componentDidUpdate(prevProps: SafeTweetProps) {
    if (prevProps.id !== this.props.id && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <a
          href={`https://x.com/PinkPuppets_/status/${this.props.id}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-pink-400/30 bg-black/40 px-3 py-4 text-center text-xs text-pink-200/80 hover:border-pink-300/50"
        >
          Post on X ↗
        </a>
      );
    }
    return this.props.children;
  }
}

const SafeTweet: React.FC<SafeTweetProps> = ({ id }) => (
  <SafeTweetBoundary id={id}>
    <Tweet id={id} />
  </SafeTweetBoundary>
);

const SLOT_PRIZES_POSTER = '/images/pinkpuppets-slot-prizes-poster.png';

export const PinkPuppetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = usePinkChatAuth();
  const [posterOpen, setPosterOpen] = React.useState(false);
  const [tweetIds, setTweetIds] = React.useState<string[]>(FALLBACK_TWEETS);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/twitter-feed?user=PinkPuppets_&limit=10')
      .then((r) => r.json())
      .then((data: { ids?: unknown }) => {
        if (cancelled) return;
        const fromApi = Array.isArray(data.ids)
          ? data.ids.map((id) => String(id || '').trim()).filter((id) => /^\d{10,}$/.test(id))
          : [];
        if (!fromApi.length) return;
        const rest = fromApi.filter((id) => !FALLBACK_TWEETS.includes(id));
        setTweetIds([...FALLBACK_TWEETS, ...rest]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!posterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosterOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [posterOpen]);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = React.useState(false);

  const toggleMusic = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicOn) {
      audio.pause();
      setMusicOn(false);
    } else {
      audio.volume = 0.18; // dezent
      audio.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  }, [musicOn]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.18; // dezent
    audio.loop = true;
    // Sofort versuchen; falls vom Browser blockiert -> beim ersten User-Klick/Tipp starten
    audio.play().then(() => setMusicOn(true)).catch(() => { /* autoplay blocked */ });
    const startOnFirstGesture = () => {
      if (audio.paused) {
        audio.play().then(() => setMusicOn(true)).catch(() => {});
      }
      window.removeEventListener('pointerdown', startOnFirstGesture);
      window.removeEventListener('keydown', startOnFirstGesture);
      window.removeEventListener('touchstart', startOnFirstGesture);
    };
    window.addEventListener('pointerdown', startOnFirstGesture);
    window.addEventListener('keydown', startOnFirstGesture);
    window.addEventListener('touchstart', startOnFirstGesture);
    return () => {
      window.removeEventListener('pointerdown', startOnFirstGesture);
      window.removeEventListener('keydown', startOnFirstGesture);
      window.removeEventListener('touchstart', startOnFirstGesture);
      audio.pause();
    };
  }, []);

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/pinkpuppets-clouds-bg.avif')" }}
    >
      <div className="absolute inset-0 bg-[#130015]/40" />
      <FloatingPuppetsLayer />

      {/* Background music (dezent, per Button) */}
      <audio ref={audioRef} src={PINKPUPPETS_MUSIC} loop preload="none" />
      <button
        onClick={toggleMusic}
        aria-label={musicOn ? 'Mute music' : 'Play music'}
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md border-2 transition-all duration-300 text-xs font-bold tracking-wide ${
          musicOn
            ? 'bg-pink-500/25 border-pink-400/70 text-pink-100 shadow-lg shadow-pink-600/30'
            : 'bg-black/70 border-pink-500/50 text-pink-200 hover:border-pink-400 hover:bg-black/80 shadow-lg shadow-black/50 animate-pulse'
        }`}
      >
        {musicOn ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            <span className="hidden sm:inline">Music On</span>
            <span className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 bg-pink-300 animate-pulse" style={{ height: '60%' }} />
              <span className="w-0.5 bg-pink-300 animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
              <span className="w-0.5 bg-pink-300 animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
            </span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l11-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="hidden sm:inline">Play Music</span>
          </>
        )}
      </button>
      <div className="relative z-10 w-full px-3 py-4 sm:px-4 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1440px]">

          {/* Banner */}
          <div className="mb-3">
            <img
              src="/images/pinkpuppets-banner.png"
              alt="PinkPuppets Banner"
              className="mx-auto max-h-[180px] w-full object-contain sm:max-h-[220px]"
            />
            <div className="flex items-center justify-between gap-2 mt-2 px-2 sm:px-3">
              <button
                onClick={() => navigate('/')}
                className="shrink-0 rounded-lg border border-pink-400/60 bg-black/30 px-2.5 py-1 text-[11px] text-pink-200 hover:bg-pink-900/30"
              >
                ← Home
              </button>
              <div className="flex items-center gap-2">
                <a href="https://x.com/PinkPuppets_" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 text-pink-300/60 hover:text-pink-200 transition-colors" title="@PinkPuppets_ on X">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <button
                  onClick={() => navigate('/pinkpuppets/marketplace')}
                  className="shrink-0 rounded-lg border-2 border-black bg-[#ff4fcf] px-4 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0_#000] transition hover:translate-y-[-1px] hover:bg-[#ff61d6]"
                >
                  PuppetMarket
                </button>
              </div>
            </div>
          </div>

          <PinkPuppetsSlot2Section />

          <div
            className="mb-5 mt-2 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
            aria-hidden
          />

          {/* Main layout: 3 equal columns, fixed height so chat matches */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3 md:h-[calc(100vh-300px)]">

            {/* Col 1: Slot prizes poster (always visible) */}
            <div className="min-w-0 md:h-full md:overflow-hidden">
              <button
                type="button"
                onClick={() => setPosterOpen(true)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-pink-300/70 bg-black/35 p-3 text-left transition hover:border-pink-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80"
                aria-label="Open slot prizes poster fullscreen"
              >
                <img
                  src={SLOT_PRIZES_POSTER}
                  alt="New prizes added — Pink Puppets slot prize poster"
                  className="w-full flex-1 rounded-lg object-contain min-h-0 transition group-hover:opacity-95"
                  loading="eager"
                />
                <div className="mt-2 text-center">
                  <p className="text-sm font-bold text-pink-100 group-hover:text-white">New prizes added!</p>
                  <p className="text-[11px] text-pink-200/75 mt-0.5">Tap to enlarge · 39 ordinals in the slot</p>
                </div>
              </button>
            </div>

            {/* Col 2: Latest Posts */}
            <div className="min-w-0 md:h-full md:overflow-hidden">
              <div className="rounded-2xl border border-pink-300/70 bg-black/35 p-3 flex flex-col h-full">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-pink-100">Latest Posts</h2>
                  <a href="https://x.com/PinkPuppets_" target="_blank" rel="noreferrer" className="text-[11px] text-pink-200/90 hover:text-pink-100 shrink-0">View on X</a>
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-pink-300/40 bg-black/40 p-2" data-theme="dark">
                  {tweetIds.map((id) => (
                    <div key={id} className="mb-2 last:mb-0 [&_>div]:!my-0">
                      <SafeTweet id={id} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Col 3: Auth + Admin + Chat */}
            <div className="min-w-0 md:h-full md:overflow-hidden flex flex-col gap-3">
              <AuthGateCard />
              {user?.role === 'admin' && token && (
                <AdminRoomManager token={token} onRoomCreated={() => {}} />
              )}
              <div className="flex-1 flex flex-col min-h-0">
                <UnifiedChatPanel />
              </div>
            </div>
          </div>
        </div>
      </div>

      {posterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Slot prizes poster"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-3 sm:p-6"
          onClick={() => setPosterOpen(false)}
        >
          <button
            type="button"
            onClick={() => setPosterOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full border border-pink-300/50 bg-black/60 px-3 py-1.5 text-xs font-semibold text-pink-100 hover:bg-black/80 sm:right-5 sm:top-5"
            aria-label="Close poster"
          >
            Close ✕
          </button>
          <img
            src={SLOT_PRIZES_POSTER}
            alt="New prizes added — Pink Puppets slot prize poster (full size)"
            className="max-h-[min(96vh,1400px)] max-w-full object-contain shadow-2xl shadow-pink-950/40"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

