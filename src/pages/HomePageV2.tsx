import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MempoolFeesBanner } from '../components/MempoolFeesBanner';
import { MempoolDetailsModal } from '../components/MempoolDetailsModal';

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

type NavItem = { label: string; route: string; img?: string; external?: boolean };

const NAV_MENUS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Launchpad',
    items: [
      { label: 'Bitcoin Mixtape', route: '/bitcoin-mixtape', img: '/images/btc-mixtape.png' },
      { label: 'Bad Cats', route: '/badcats', img: 'https://ordinals.com/content/35ccb1e128e691647258687c53f06a5f3f2078f15770eb0afedcd743524e63bdi0' },
      { label: 'Smile A Bit', route: '/smile-a-bit', img: '/images/smile-collection.png' },
      { label: 'SLUMS', route: '/slums' },
      { label: 'Dimension Break', route: '/dimension-break', img: '/images/dimension-break-preview.gif' },
      { label: 'Black & Wild', route: '/black-wild' },
      { label: 'Random Stuff', route: '/random-stuff' },
      { label: 'Free Stuff', route: '/free-stuff' },
      { label: '1984', route: '/1984' },
      { label: 'Void Sculptor', route: '/void-sculptor' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { label: 'RichArt Marketplace', route: '/marketplace', img: '/images/marketplace-symbol.png' },
    ],
  },
  {
    label: 'Friends',
    items: [
      { label: 'Eito Bitto', route: '/EitoBitto', img: '/eito-bitto-logo.png' },
      { label: 'Ordinal Oddities', route: '/ordinaloddities', img: '/images/ordinal-oddities-preview.webp' },
      { label: 'Pink Puppets', route: '/pinkpuppets', img: '/images/pinkpuppets-banner.png' },
    ],
  },
  {
    label: 'Tech & Games',
    items: [
      { label: 'All Items', route: '/tech-games' },
      { label: 'Games', route: '/tech-games?filter=game' },
      { label: 'Music', route: '/tech-games?filter=music' },
      { label: 'Tools', route: '/tech-games?filter=tool' },
    ],
  },
  {
    label: 'Books',
    items: [
      { label: 'Books Onchain', route: '/books-onchain', img: '/images/marketplace-symbol.png' },
    ],
  },
  {
    label: 'Point Shop',
    items: [
      { label: 'Point Shop', route: '/point-shop', img: '/pointshop.png' },
    ],
  },
];

const ALL_NEWS = [
  { name: 'SCANMODE', img: 'https://ordinals.com/content/fb6c2e54a61b392ad5699091e68a2d2bfac7af4fe5b2505a25011a7ae4b92be7i0', route: '/marketplace?collection=scanmode' },
  { name: 'Bitcoin Gazette', img: 'https://thebitcoingazette.com/fav.png', link: 'https://thebitcoingazette.com/' },
  { name: 'PinkPuppets', img: '/images/pinkpuppets-openpage.avif', link: 'https://openpage.fun/badges/9161ff5e-79a1-4376-b6b4-f7036b9903d6' },
  { name: 'SOSEvo', img: '/images/SOSEvo.jpg', route: '/marketplace?collection=sosevo' },
  { name: 'Tactical', img: '/images/Tactical.jpg', link: 'https://lunalauncher.io/#mint/richart-tactical-game' },
  { name: 'THE BOX', img: '/images/Box.png', route: '/marketplace?collection=thebox' },
  { name: 'KRYPDROIDZ', img: '/images/kr0.png', link: 'https://www.soltrix.io/mint/krypdroidz-2863/286315fc12' },
  { name: 'NO_FUNC', img: '/images/NO_FUNC_87.png', link: 'https://ord-dropz.xyz/marketplace/listing_1767570381027' },
  { name: "Santa's Revenge", img: '/images/SantasRevenge.png', link: 'https://www.trio.xyz/collections/santas-revenge' },
  { name: 'Consciousness', img: '/images/Simulator.png', link: 'https://www.ord-x.com/#Inside-the-Consciousness-Simulator' },
  { name: 'Ord Dropz', img: '/images/ord-dropz.webp', link: 'https://ord-dropz.xyz/' },
];

const ALL_NEW_STUFF = [
  { name: 'SLOW FIRE', thumb: 'https://ordinals.com/content/19beb0e2e969cb8f8d77edd1e2229ac783a20e3cc11b8e0e6d01b173a93e366fi0', route: '/tech-games', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
  { name: 'Eito Bitto', thumb: '/eito-bitto-logo.png', route: '/EitoBitto', tag: 'FRIENDS', tagColor: 'bg-cyan-500' },
  { name: 'Ordinal Oddities', thumb: '/images/ordinal-oddities-preview.webp', route: '/ordinaloddities', tag: 'FRIENDS', tagColor: 'bg-cyan-500' },
  { name: 'Dimension Break', thumb: '/images/dimension-break-preview.gif', route: '/dimension-break', tag: 'FREE MINT', tagColor: 'bg-green-500' },
  { name: 'RICHRACER', thumb: 'https://ordinals.com/content/0be50e7196f48c0cacf885bc9cd7b2d3269e7e934b16c59aa5418b83692fbcd6i0', route: '/tech-games', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
  { name: 'GAVS', thumb: 'https://ordinals.com/content/927bdb131b4487f730fa500759d9d5fe80762b8ca52b0d1709930df038fc9303i0', route: '/tech-games', isIframe: true },
  { name: 'Synthesizer', thumb: 'https://ordinals.com/content/bff1b21cd21931cc8075921e8a15d8cbb5c962fa0a4592970586a65c83ab4a36i0', route: '/tech-games', tag: 'NEW', tagColor: 'bg-red-600', isIframe: true },
];

function DropdownMenu({ menu, navigate }: { menu: typeof NAV_MENUS[number]; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors rounded-lg hover:bg-white/10"
      >
        {menu.label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {menu.items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.external) window.open(item.route, '_blank', 'noopener');
                else navigate(item.route);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
            >
              {item.img && (
                <img src={item.img} alt="" className="h-7 w-7 rounded object-cover shrink-0" loading="lazy" />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const HomePageV2: React.FC = () => {
  const navigate = useNavigate();
  const [showMempoolModal, setShowMempoolModal] = useState(false);

  return (
    <>
      <SynthLifeV2 />
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-black/70 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 flex items-center justify-between h-14">
            <button onClick={() => navigate('/')} className="text-lg font-black tracking-tight text-white hover:opacity-80 transition">
              richart<span className="text-red-500">.</span>app
            </button>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_MENUS.map((menu) => (
                <DropdownMenu key={menu.label} menu={menu} navigate={navigate} />
              ))}
            </nav>
            <a href="/" className="text-xs text-gray-500 hover:text-gray-300 transition">Classic View</a>
          </div>
        </header>

        {/* Mempool Banner */}
        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 mt-4">
          <MempoolFeesBanner onDetailsClick={() => setShowMempoolModal(true)} />
        </div>

        {/* Hero */}
        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 py-10 text-center">
          <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight">
            richart<span className="text-red-500">.</span>app
          </h1>
          <p className="mt-3 text-sm text-gray-400 max-w-md mx-auto">
            Bitcoin Ordinals — Collections, Marketplace, Games & Tools
          </p>
        </div>

        {/* New Stuff Section */}
        <section className="relative z-10 mx-auto max-w-7xl w-full px-4 mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">New & Featured</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {ALL_NEW_STUFF.map((item) => (
              <div
                key={item.name}
                onClick={() => navigate(item.route)}
                className="group cursor-pointer rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 overflow-hidden"
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
                      className="w-full h-full pointer-events-none"
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                      title={item.name}
                    />
                  ) : (
                    <img src={item.thumb} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
            {ALL_NEWS.map((item) => (
              <div
                key={item.name}
                onClick={() => item.route ? navigate(item.route) : window.open(item.link!, '_blank', 'noopener')}
                className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 overflow-hidden"
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

        {/* Mobile Navigation */}
        <section className="relative z-10 mx-auto max-w-7xl w-full px-4 mb-10 md:hidden">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">Navigation</h2>
          <div className="space-y-3">
            {NAV_MENUS.map((menu) => (
              <MobileAccordion key={menu.label} menu={menu} navigate={navigate} />
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

function MobileAccordion({ menu, navigate }: { menu: typeof NAV_MENUS[number]; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-200"
      >
        {menu.label}
        <span className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-white/5">
          {menu.items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.external) window.open(item.route, '_blank', 'noopener');
                else navigate(item.route);
              }}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-left"
            >
              {item.img && (
                <img src={item.img} alt="" className="h-6 w-6 rounded object-cover shrink-0" loading="lazy" />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HomePageV2;
