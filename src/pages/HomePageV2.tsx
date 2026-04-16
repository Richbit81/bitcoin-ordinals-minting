import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MempoolFeesBanner } from '../components/MempoolFeesBanner';
import { MempoolDetailsModal } from '../components/MempoolDetailsModal';
import { RUNNER_INSCRIPTION_ID } from '../constants/runnerInscription';

function SynthLifeV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = 18;
    const MOUSE_R = 120;
    const SIM_INTERVAL = 180;
    let COLS = 0, ROWS = 0, W = 0, H = 0;
    let grid: Float32Array, next: Float32Array, age: Float32Array;
    let lastSim = 0;
    const idx = (c: number, r: number) => r * COLS + c;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      COLS = Math.ceil(W / CELL); ROWS = Math.ceil(H / CELL);
      const total = COLS * ROWS;
      grid = new Float32Array(total);
      next = new Float32Array(total);
      age = new Float32Array(total);
      for (let i = 0; i < total; i++) grid[i] = Math.random() < 0.18 ? 1 : 0;
    };

    const draw = (time: number) => {
      if (time - lastSim > SIM_INTERVAL) {
        lastSim = time;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            let n = 0;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const nr = (r + dr + ROWS) % ROWS, nc = (c + dc + COLS) % COLS;
              if (grid[idx(nc, nr)] > 0.5) n++;
            }
            const alive = grid[idx(c, r)] > 0.5;
            next[idx(c, r)] = (alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0));
          }
        }
        const px = mouseRef.current.x, py = mouseRef.current.y;
        if (px > -1000) {
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const dx = c * CELL + CELL / 2 - px, dy = r * CELL + CELL / 2 - py;
            if (Math.sqrt(dx * dx + dy * dy) < MOUSE_R && Math.random() < 0.12)
              next[idx(c, r)] = 1;
          }
        }
        [grid, next] = [next, grid];
        for (let i = 0; i < grid.length; i++) age[i] = grid[i] > 0.5 ? Math.min(age[i] + 1, 60) : 0;
      }
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[idx(c, r)] < 0.5) continue;
        const a = age[idx(c, r)];
        const t = Math.min(a / 40, 1);
        const red = Math.round(200 + 55 * t);
        ctx.fillStyle = `rgba(${red},${Math.round(30 * (1 - t))},${Math.round(30 * (1 - t))},${0.15 + t * 0.25})`;
        ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    const handleMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const handleLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    resize();
    rafRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

type NavItem = { label: string; route: string; img?: string; external?: boolean; isHtml?: boolean };

const NAV_MENUS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Launchpad',
    items: [
      { label: 'Bitcoin Mixtape', route: '/bitcoin-mixtape', img: '/mixtape.png' },
      { label: 'Bad Cats', route: '/badcats', img: 'https://ordinals.com/content/35ccb1e128e691647258687c53f06a5f3f2078f15770eb0afedcd743524e63bdi0', isHtml: true },
      { label: 'Smile A Bit', route: '/smile-a-bit', img: '/images/smile-collection.png' },
      { label: 'SLUMS', route: '/slums', img: 'https://ordinals.com/content/8e26e5823d7fc3cd092b605feec7d1e7ce6e8908ca320d702a75f6160a552a89i0' },
      { label: 'Dimension Break', route: '/dimension-break', img: '/images/dimension-break-preview.gif' },
      { label: 'Black & Wild', route: '/black-wild', img: '/thumbnail_Unbenanntes_Projekt-2026-01-01T222604.577-ezgif.com-apng-to-avif-converter - Kopie.avif' },
      { label: 'Random Stuff', route: '/random-stuff', img: 'https://ordinals.com/content/c46de6b56a28fc5c9da4d22a8a15825e604418c1ad1e4eea6650afdebff0e670i0' },
      { label: 'Free Stuff', route: '/free-stuff', img: 'https://ordinals.com/content/4a019b00eaed13dce49df0ba18d1f82c95a276ca09a4b16c6990336ae7bc189bi0' },
      { label: '1984', route: '/1984', img: 'https://ordinals.com/content/5c50d2e25d833e1357de824184e9d7859945c62f3b6af54c0f2f2a03caf5fd74i0' },
      { label: 'Void Sculptor', route: '/void-sculptor', img: 'https://ordinals.com/content/663aece070e8500f10c3aea0d87b9da00981f16699abcf7c95eb044d95a46828i0', isHtml: true },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { label: 'RichArt Marketplace', route: '/marketplace', img: '/images/books-onchain.png' },
    ],
  },
  {
    label: 'Friends Marketplace',
    items: [
      { label: 'Eito Bitto', route: '/EitoBitto', img: '/eito-bitto-logo.png' },
      { label: 'Ordinal Oddities', route: '/ordinaloddities', img: '/images/ordinal-oddities-preview.webp' },
      { label: 'Pink Puppets', route: '/pinkpuppets/marketplace', img: '/images/pinkpuppets-banner.png' },
      { label: 'The Box', route: '/thebox', img: '/images/Box.png' },
    ],
  },
  {
    label: 'Tech & Games',
    items: [
      { label: 'All Items', route: '/tech-games', img: '/images/techgames-logo.gif' },
      { label: 'Games', route: '/tech-games?filter=game', img: '/images/techgames-logo.gif' },
      { label: 'Music', route: '/tech-games?filter=music', img: '/images/techgames-logo.gif' },
      { label: 'Tools', route: '/tech-games?filter=tool', img: '/images/techgames-logo.gif' },
    ],
  },
  {
    label: 'Books',
    items: [
      { label: 'Books Onchain', route: '/books-onchain', img: '/images/marketplace-symbol.png' },
      { label: 'Audiobooks', route: '/audiobooks', img: `https://ordinals.com/content/1eb4cf686bc4163bf2c5a4cba592bf70ca17e489a025c0ccf7be3c80b22333b0i0`, isHtml: true },
    ],
  },
  {
    label: 'Point Shop',
    items: [
      { label: 'Point Shop', route: '/point-shop', img: '/pointshop.png' },
    ],
  },
  {
    label: 'CATTACK',
    items: [
      { label: 'CATTACK', route: '/cattack', img: '/images/cattack-card.png' },
    ],
  },
];

const ALL_NEWS = [
  { name: 'SCANMODE', img: 'https://ordinals.com/content/fb6c2e54a61b392ad5699091e68a2d2bfac7af4fe5b2505a25011a7ae4b92be7i0', route: '/marketplace?collection=scanmode' },
  { name: 'Bitcoin Gazette', img: 'https://thebitcoingazette.com/fav.png', link: 'https://thebitcoingazette.com/' },
  { name: 'PinkPuppets', img: '/images/pinkpuppets-openpage.avif', link: 'https://openpage.fun/badges/9161ff5e-79a1-4376-b6b4-f7036b9903d6' },
  { name: 'SOSEvo', img: '/images/SOSEvo.jpg', route: '/marketplace?collection=sosevo' },
  { name: 'Tactical', img: '/images/Tactical.jpg', link: 'https://lunalauncher.io/#mint/richart-tactical-game' },
  { name: 'THE BOX', img: '/images/Box.png', route: '/thebox' },
  { name: 'KRYPDROIDZ', img: '/images/kr0.png', link: 'https://www.soltrix.io/mint/krypdroidz-2863/286315fc12' },
  { name: 'NO_FUNC', img: '/images/NO_FUNC_87.png', link: 'https://ord-dropz.xyz/marketplace/listing_1767570381027' },
  { name: "Santa's Revenge", img: '/images/SantasRevenge.png', link: 'https://www.trio.xyz/collections/santas-revenge' },
  { name: 'Consciousness', img: '/images/Simulator.png', link: 'https://www.ord-x.com/#Inside-the-Consciousness-Simulator' },
  { name: 'Ord Dropz', img: '/images/ord-dropz.webp', link: 'https://ord-dropz.xyz/' },
];

const ALL_NEW_STUFF = [
  { name: 'SLOW FIRE', thumb: 'https://ordinals.com/content/e052b3516fbada925ba9816ded5ea04854545e911e893c9fb081ab07fac9c15fi0', route: '/tech-games?try=e052b3516fbada925ba9816ded5ea04854545e911e893c9fb081ab07fac9c15fi0', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
  { name: 'Eito Bitto', thumb: '/eito-bitto-logo.png', route: '/EitoBitto', tag: 'FRIENDS', tagColor: 'bg-cyan-500' },
  { name: 'Ordinal Oddities', thumb: '/images/ordinal-oddities-preview.webp', route: '/ordinaloddities', tag: 'FRIENDS', tagColor: 'bg-cyan-500' },
  { name: 'Dimension Break', thumb: '/images/dimension-break-preview.gif', route: '/dimension-break', tag: 'FREE MINT', tagColor: 'bg-green-500' },
  { name: 'RICHRACER', thumb: 'https://ordinals.com/content/71d03605227c3452772a99658c0b70662706d1308c58bcead73aeb0a1d5280fai0', route: '/tech-games?try=71d03605227c3452772a99658c0b70662706d1308c58bcead73aeb0a1d5280fai0', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
  { name: 'Pink Puppets', thumb: '/images/pinkpuppets-openpage.avif', route: '/pinkpuppets', tag: 'FEATURED', tagColor: 'bg-pink-500' },
  { name: 'GAVS', thumb: 'https://ordinals.com/content/927bdb131b4487f730fa500759d9d5fe80762b8ca52b0d1709930df038fc9303i0', route: '/tech-games?try=927bdb131b4487f730fa500759d9d5fe80762b8ca52b0d1709930df038fc9303i0', isIframe: true },
  { name: 'Synthesizer', thumb: 'https://ordinals.com/content/bff1b21cd21931cc8075921e8a15d8cbb5c962fa0a4592970586a65c83ab4a36i0', route: '/tech-games?try=bff1b21cd21931cc8075921e8a15d8cbb5c962fa0a4592970586a65c83ab4a36i0', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
  { name: 'Ninja', thumb: 'https://ordinals.com/content/51f03a730c7e943f5cdfa13a9e3ecf13452b4dc12b57acc96a2835b67440a307i0', route: '/tech-games?try=51f03a730c7e943f5cdfa13a9e3ecf13452b4dc12b57acc96a2835b67440a307i0', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
  {
    name: 'Runner',
    thumb: `https://ordinals.com/content/${RUNNER_INSCRIPTION_ID}`,
    route: '/free-stuff',
    tag: 'NEW',
    tagColor: 'bg-red-600',
    isIframe: true,
  },
];

function NavThumb({ item, size = 'h-10 w-10' }: { item: NavItem; size?: string }) {
  if (!item.img) return null;
  if (item.isHtml) {
    return (
      <div className={`${size} rounded-lg overflow-hidden shrink-0 border border-white/10`}>
        <iframe src={item.img} className="w-full h-full pointer-events-none scale-[0.5] origin-top-left" style={{ width: '200%', height: '200%' }} sandbox="allow-scripts allow-same-origin" loading="lazy" title={item.label} />
      </div>
    );
  }
  return <img src={item.img} alt="" className={`${size} rounded-lg object-cover shrink-0 border border-white/10`} loading="lazy" />;
}

function DropdownMenu({ menu, navigate }: { menu: typeof NAV_MENUS[number]; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const hasImages = menu.items.some(i => i.img);
  const isGrid = hasImages && menu.items.length > 4;

  return (
    <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-4 py-2 text-sm font-semibold transition-colors rounded-lg ${open ? 'text-white bg-white/10' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}
      >
        {menu.label}
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-1 z-50">
          <div className={`rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden ${isGrid ? 'w-[480px] p-3' : 'w-72'}`}>
            {isGrid ? (
              <div className="grid grid-cols-2 gap-1.5">
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.external) window.open(item.route, '_blank', 'noopener');
                      else navigate(item.route);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
                  >
                    <NavThumb item={item} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              menu.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.external) window.open(item.route, '_blank', 'noopener');
                    else navigate(item.route);
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
                >
                  <NavThumb item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium block">{item.label}</span>
                    {item.description ? (
                      <span className="text-[10px] text-gray-500 leading-snug line-clamp-4 mt-0.5 block">{item.description}</span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const HomePageV2: React.FC = () => {
  const navigate = useNavigate();
  const [showMempoolModal, setShowMempoolModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayedNewStuff = useMemo(() => {
    const shuffled = [...ALL_NEW_STUFF].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 7);
  }, []);

  return (
    <>
      <SynthLifeV2 />
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-black/70 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="hover:opacity-80 transition group">
                <span className="text-xs sm:text-base font-bold text-white group-hover:text-red-400 transition-colors" style={{ fontFamily: "'Press Start 2P', cursive", textShadow: '0 0 10px rgba(220,38,38,0.6), 0 0 20px rgba(220,38,38,0.3)' }}>
                  richart<span className="text-red-500">.</span>app
                </span>
              </button>
              <a href="https://x.com/richbi11" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" title="@richbi11 on X">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_MENUS.map((menu) => (
                <DropdownMenu key={menu.label} menu={menu} navigate={navigate} />
              ))}
            </nav>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col gap-1 p-2"
              aria-label="Menu"
            >
              <span className={`block w-5 h-0.5 bg-gray-300 transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-[3px]' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-300 transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-300 transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-[3px]' : ''}`} />
            </button>
          </div>
        </header>

        {/* Mobile Slide Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-[280px] bg-black/95 border-l border-white/10 overflow-y-auto">
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="py-2">
                {NAV_MENUS.map((menu) => (
                  <MobileMenuSection key={menu.label} menu={menu} navigate={(path) => { navigate(path); setMobileMenuOpen(false); }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mempool Banner */}
        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 mt-4">
          <MempoolFeesBanner onDetailsClick={() => setShowMempoolModal(true)} />
        </div>

        {/* Hero */}
        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 py-10 text-center flex flex-col items-center">
          <h1
            className="text-3xl sm:text-5xl md:text-6xl text-white tracking-tight"
            style={{
              fontFamily: "'Press Start 2P', cursive",
              textShadow: '0 0 20px rgba(220,38,38,0.7), 0 0 40px rgba(220,38,38,0.4), 0 0 80px rgba(220,38,38,0.2)',
            }}
          >
            richart<span className="text-red-500">.</span>app
          </h1>
          <p className="mt-4 text-sm text-gray-400 max-w-md mx-auto">
            Bitcoin Ordinals — Collections, Marketplace, Games & Tools
          </p>
        </div>

        {/* Spotlight Section */}
        <section className="relative z-10 mx-auto max-w-7xl w-full px-4 mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">Spotlight</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible scrollbar-hide">
            {[
              {
                name: 'Bad Cats',
                desc: '500 Recursive Ordinals on Bitcoin. Each cat is uniquely generated on-chain.',
                src: 'https://ordinals.com/content/35ccb1e128e691647258687c53f06a5f3f2078f15770eb0afedcd743524e63bdi0',
                route: '/badcats',
                isHtml: true,
                tag: 'COLLECTION',
                tagColor: 'bg-purple-600',
                mintLive: true,
              },
              {
                name: 'Bitcoin Mixtape',
                desc: 'A fully on-chain music experience. Listen, collect and inscribe beats on Bitcoin.',
                src: '/mixtape.png',
                route: '/bitcoin-mixtape',
                isHtml: false,
                tag: 'MUSIC',
                tagColor: 'bg-amber-600',
                mintLive: true,
              },
              {
                name: 'SLOW FIRE',
                desc: 'Time only moves when you move. A browser-based FPS inspired by SUPERHOT — fully on-chain.',
                src: 'https://ordinals.com/content/e052b3516fbada925ba9816ded5ea04854545e911e893c9fb081ab07fac9c15fi0',
                route: '/tech-games?try=e052b3516fbada925ba9816ded5ea04854545e911e893c9fb081ab07fac9c15fi0',
                isHtml: true,
                tag: 'GAME',
                tagColor: 'bg-red-600',
                mintLive: false,
              },
            ].map((item) => (
              <div
                key={item.name}
                onClick={() => navigate(item.route)}
                className="group cursor-pointer rounded-2xl border border-white/10 bg-black hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300 overflow-hidden flex flex-col min-w-[75vw] sm:min-w-0"
              >
                <div className="aspect-square relative overflow-hidden bg-black p-3">
                  <span className={`absolute top-2.5 right-2.5 z-20 ${item.tagColor} px-2 py-0.5 text-[9px] font-extrabold text-white rounded-full shadow-lg`}>
                    {item.tag}
                  </span>
                  <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/10">
                    {item.isHtml ? (
                      <iframe
                        src={item.src}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        sandbox="allow-scripts allow-same-origin"
                        loading="lazy"
                        title={item.name}
                      />
                    ) : (
                      <img src={item.src} alt={item.name} className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
                </div>
                <div className="px-4 py-3 flex-1 flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">{item.name}</h3>
                    {item.mintLive && (
                      <span
                        className="px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-green-300 bg-green-500/20 border border-green-400/40 rounded-full animate-pulse"
                        style={{ boxShadow: '0 0 8px rgba(74,222,128,0.4), 0 0 16px rgba(74,222,128,0.2)' }}
                      >
                        Mint Live
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New Stuff Section */}
        <section className="relative z-10 mx-auto max-w-7xl w-full px-4 mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">New & Featured</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 sm:overflow-visible scrollbar-hide">
            {displayedNewStuff.map((item) => (
              <div
                key={item.name}
                onClick={() => navigate(item.route)}
                className="group cursor-pointer rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 overflow-hidden min-w-[140px] sm:min-w-0"
              >
                <div className="aspect-square relative overflow-hidden bg-black">
                  {item.tag && (
                    <span className={`absolute top-1.5 right-1.5 z-10 ${item.tagColor} px-1.5 py-0.5 text-[8px] font-extrabold text-white rounded-full shadow`}>
                      {item.tag}
                    </span>
                  )}
                  {item.isIframe ? (
                    <iframe
                      src={item.thumb}
                      className="pointer-events-none scale-[0.25] origin-top-left"
                      style={{ width: '400%', height: '400%' }}
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                      title={item.name}
                    />
                  ) : (
                    <img src={item.thumb} alt={item.name} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                  )}
                </div>
                <div className="px-2 py-2 text-center">
                  <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors">{item.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* News & Links Section */}
        <section className="relative z-10 mx-auto max-w-7xl w-full px-4 mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">News & Links</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 sm:overflow-visible scrollbar-hide">
            {ALL_NEWS.map((item) => (
              <div
                key={item.name}
                onClick={() => item.route ? navigate(item.route) : window.open(item.link!, '_blank', 'noopener')}
                className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 overflow-hidden min-w-[100px] sm:min-w-0"
              >
                <div className="aspect-square overflow-hidden bg-black">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                </div>
                <div className="px-1 py-1.5 text-center">
                  <span className="text-[9px] font-bold text-gray-400 group-hover:text-white transition-colors">{item.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 mt-auto border-t border-white/5 py-6 text-center text-xs text-gray-600">
          richart.app — Bitcoin Ordinals Platform
        </footer>
      </div>

      {showMempoolModal && <MempoolDetailsModal onClose={() => setShowMempoolModal(false)} />}
    </>
  );
};

function MobileMenuSection({ menu, navigate }: { menu: typeof NAV_MENUS[number]; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-white/5 transition-colors"
      >
        {menu.label}
        <span className={`text-gray-500 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="bg-white/[0.02]">
          {menu.items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.external) window.open(item.route, '_blank', 'noopener');
                else navigate(item.route);
              }}
              className="w-full flex items-start gap-3 px-6 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-left"
            >
              <NavThumb item={item} size="h-7 w-7" />
              <span className="min-w-0 flex-1 text-left">
                <span className="text-gray-200 block">{item.label}</span>
                {item.description ? (
                  <span className="text-[10px] text-gray-500 leading-snug line-clamp-3 mt-0.5 block">{item.description}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HomePageV2;
