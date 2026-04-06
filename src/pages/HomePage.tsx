import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getPointsForWalletAddresses, PointsData } from '../services/pointsService';
import { getAllCollections, Collection } from '../services/collectionService';
import { CollectionCard } from '../components/CollectionCard';
import { NewsBanner } from '../components/NewsBanner';
import { ProgressiveImage } from '../components/ProgressiveImage';
import { MempoolFeesBanner } from '../components/MempoolFeesBanner';
import { MempoolDetailsModal } from '../components/MempoolDetailsModal';

function SynthLife() {
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
    let grid: Float32Array;
    let next: Float32Array;
    let age: Float32Array;
    let lastSim = 0;

    const idx = (c: number, r: number) => r * COLS + c;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const oldCols = COLS, oldRows = ROWS;
      const oldGrid = grid;
      COLS = Math.ceil(W / CELL); ROWS = Math.ceil(H / CELL);
      const total = COLS * ROWS;
      grid = new Float32Array(total);
      next = new Float32Array(total);
      age = new Float32Array(total);
      if (oldGrid && oldCols > 0) {
        const minC = Math.min(oldCols, COLS), minR = Math.min(oldRows, ROWS);
        for (let r = 0; r < minR; r++)
          for (let c = 0; c < minC; c++)
            grid[idx(c, r)] = oldGrid[r * oldCols + c];
      } else {
        for (let i = 0; i < total; i++) grid[i] = Math.random() < 0.08 ? 1 : 0;
      }
    };

    const neighbors = (c: number, r: number): number => {
      let s = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = (c + dc + COLS) % COLS;
          const nr = (r + dr + ROWS) % ROWS;
          s += grid[idx(nc, nr)] > 0.5 ? 1 : 0;
        }
      }
      return s;
    };

    const step = () => {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = idx(c, r);
          const n = neighbors(c, r);
          const alive = grid[i] > 0.5;
          if (alive) {
            next[i] = (n === 2 || n === 3) ? 1 : 0;
          } else {
            next[i] = n === 3 ? 1 : 0;
          }
          if (next[i] > 0.5) {
            age[i] = alive ? Math.min(age[i] + 1, 200) : 1;
          } else {
            age[i] = Math.max(age[i] - 0.3, 0);
          }
        }
      }
      const tmp = grid; grid = next; next = tmp;
    };

    const draw = (now: number) => {
      if (now - lastSim > SIM_INTERVAL) { step(); lastSim = now; }

      ctx.clearRect(0, 0, W, H);
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = idx(c, r);
          const a = age[i];
          if (a < 0.05) continue;

          const px = c * CELL, py = r * CELL;
          const dxM = px + CELL / 2 - mx, dyM = py + CELL / 2 - my;
          const distM = Math.sqrt(dxM * dxM + dyM * dyM);
          const mouseProx = distM < MOUSE_R ? 1 - distM / MOUSE_R : 0;

          const alive = grid[i] > 0.5;
          const lifeT = Math.min(a / 60, 1);

          let red: number, green: number, blue: number, alpha: number;

          if (mouseProx > 0) {
            red = 160 + 50 * mouseProx;
            green = 15 + 40 * mouseProx * lifeT;
            blue = 60 + 120 * mouseProx;
            alpha = alive
              ? 0.08 + 0.30 * mouseProx
              : Math.max(a / 200, 0) * 0.06 * (1 + mouseProx * 2);
          } else {
            red = 100 + 50 * lifeT;
            green = 12 + 20 * lifeT;
            blue = 35 + 25 * lifeT;
            alpha = alive ? 0.05 + lifeT * 0.04 : Math.max(a / 200, 0) * 0.03;
          }

          const gap = 1;
          ctx.fillStyle = `rgba(${red|0},${green|0},${blue|0},${alpha})`;
          ctx.fillRect(px + gap, py + gap, CELL - gap * 2, CELL - gap * 2);

          if (mouseProx > 0.5 && alive) {
            ctx.shadowColor = `rgba(${red|0},${green|0},${blue|0},${mouseProx * 0.25})`;
            ctx.shadowBlur = 5 * mouseProx;
            ctx.fillRect(px + gap, py + gap, CELL - gap * 2, CELL - gap * 2);
            ctx.shadowBlur = 0;
          }
        }
      }

      if (mx > 0 && my > 0) {
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_R);
        grad.addColorStop(0, 'rgba(200, 40, 120, 0.02)');
        grad.addColorStop(0.5, 'rgba(120, 20, 80, 0.01)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(mx - MOUSE_R, my - MOUSE_R, MOUSE_R * 2, MOUSE_R * 2);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const handleMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const mc = Math.floor(e.clientX / CELL), mr = Math.floor(e.clientY / CELL);
      const R = 3;
      for (let dr = -R; dr <= R; dr++) {
        for (let dc = -R; dc <= R; dc++) {
          if (Math.random() > 0.3) continue;
          const nc = (mc + dc + COLS) % COLS;
          const nr = (mr + dr + ROWS) % ROWS;
          grid[idx(nc, nr)] = 1;
          age[idx(nc, nr)] = 1;
        }
      }
    };
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

const ALL_NEWS_ITEMS = [
  { name: 'SCANMODE', img: 'https://ordinals.com/content/fb6c2e54a61b392ad5699091e68a2d2bfac7af4fe5b2505a25011a7ae4b92be7i0', route: '/marketplace?collection=scanmode', internal: true },
  { name: 'Bitcoin Gazette', img: 'https://thebitcoingazette.com/fav.png', link: 'https://thebitcoingazette.com/' },
  { name: 'PinkPuppets', img: '/images/pinkpuppets-openpage.avif', link: 'https://openpage.fun/badges/9161ff5e-79a1-4376-b6b4-f7036b9903d6' },
  { name: 'SOSEvo', img: '/images/SOSEvo.jpg', route: '/marketplace?collection=sosevo', internal: true },
  { name: 'Tactical', img: '/images/Tactical.jpg', link: 'https://lunalauncher.io/#mint/richart-tactical-game' },
  { name: 'THE BOX', img: '/images/Box.png', route: '/marketplace?collection=thebox', internal: true },
  { name: 'KRYPDROIDZ', img: '/images/kr0.png', link: 'https://www.soltrix.io/mint/krypdroidz-2863/286315fc12' },
  { name: 'NO_FUNC', img: '/images/NO_FUNC_87.png', link: 'https://ord-dropz.xyz/marketplace/listing_1767570381027' },
  { name: "Santa's Revenge", img: '/images/SantasRevenge.png', link: 'https://www.trio.xyz/collections/santas-revenge' },
  { name: 'Consciousness', img: '/images/Simulator.png', link: 'https://www.ord-x.com/#Inside-the-Consciousness-Simulator' },
  { name: 'Ord Dropz', img: '/images/ord-dropz.webp', link: 'https://ord-dropz.xyz/' },
] as const;

function NewsSidebar({ navigate }: { navigate: (path: string) => void }) {
  const VISIBLE = 4;
  const INTERVAL = 5000;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setOffset((prev) => (prev + 1) % ALL_NEWS_ITEMS.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const visible: typeof ALL_NEWS_ITEMS[number][] = [];
  for (let i = 0; i < VISIBLE; i++) {
    visible.push(ALL_NEWS_ITEMS[(offset + i) % ALL_NEWS_ITEMS.length]);
  }

  return (
    <div className="fixed left-3 top-[160px] z-30 hidden xl:flex flex-col gap-2.5 w-[120px]">
      <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-center text-gray-500 mb-1">News & Links</div>
      {visible.map((item) => (
        <div
          key={item.name}
          onClick={() => item.internal ? navigate(item.route!) : window.open(item.link!, '_blank', 'noopener')}
          className="cursor-pointer group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-white/10"
          style={{ background: '#111' }}
        >
          <div className="aspect-square overflow-hidden relative bg-black">
            <img src={item.img} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
          </div>
          <div className="px-1.5 py-1 text-center">
            <span className="text-[9px] font-bold text-gray-300 group-hover:text-white transition-colors">{item.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const ALL_NEW_STUFF_ITEMS = [
  { name: 'Eito Bitto', thumb: '/eito-bitto-logo.png', route: '/EitoBitto', tag: 'FRIENDS', tagColor: 'bg-cyan-500', isImg: true, contain: true },
  { name: 'Dimension Break', thumb: '/images/dimension-break-preview.gif', route: '/dimension-break', tag: 'FREE MINT', tagColor: 'bg-green-500', isImg: true },
  { name: 'RICHRACER', thumb: 'https://ordinals.com/content/0be50e7196f48c0cacf885bc9cd7b2d3269e7e934b16c59aa5418b83692fbcd6i0', route: '/tech-games', tag: 'NEW', tagColor: 'bg-red-600', isImg: false },
  { name: 'GAVS', thumb: 'https://ordinals.com/content/927bdb131b4487f730fa500759d9d5fe80762b8ca52b0d1709930df038fc9303i0', route: '/tech-games', isImg: false },
  { name: 'Synthesizer', thumb: 'https://ordinals.com/content/bff1b21cd21931cc8075921e8a15d8cbb5c962fa0a4592970586a65c83ab4a36i0', route: '/tech-games', tag: 'NEW', tagColor: 'bg-red-600', isImg: false },
] as const;

function NewStuffSidebar({ navigate }: { navigate: (path: string) => void }) {
  const VISIBLE = 4;
  const INTERVAL = 6000;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setOffset((prev) => (prev + 1) % ALL_NEW_STUFF_ITEMS.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const visible: typeof ALL_NEW_STUFF_ITEMS[number][] = [];
  for (let i = 0; i < VISIBLE; i++) {
    visible.push(ALL_NEW_STUFF_ITEMS[(offset + i) % ALL_NEW_STUFF_ITEMS.length]);
  }

  return (
    <div className="fixed right-3 top-[160px] z-30 hidden xl:flex flex-col gap-2.5 w-[120px]">
      <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-center text-gray-500 mb-1">New Stuff</div>
      {visible.map((item) => (
        <div
          key={item.name}
          onClick={() => navigate(item.route)}
          className="cursor-pointer group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-600/30"
          style={{ background: '#111' }}
        >
          {item.tag && (
            <div className={`absolute right-1 top-1 z-10 ${item.tagColor} px-1.5 py-0.5 text-[7px] font-extrabold tracking-wider text-white rounded-full shadow`}>
              {item.tag}
            </div>
          )}
          <div className="aspect-square overflow-hidden relative bg-black">
            {item.isImg ? (
              <img src={item.thumb} alt={item.name} className={`w-full h-full transition-transform duration-300 group-hover:scale-110 ${'contain' in item && item.contain ? 'object-contain p-3' : 'object-cover'}`} style={'contain' in item && item.contain ? { imageRendering: 'pixelated' } : undefined} loading="lazy" />
            ) : (
              <iframe src={item.thumb} title={item.name} className="w-full h-full border-0 pointer-events-none" sandbox="allow-scripts allow-same-origin" loading="lazy" style={{ transform: 'scale(1)', transformOrigin: 'top left' }} />
            )}
          </div>
          <div className="px-1.5 py-1 text-center">
            <span className="text-[9px] font-bold text-gray-300 group-hover:text-white transition-colors">{item.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// SLUMS preview layers (item #124)
const SLUMS_PREVIEW_LAYERS = [
  '8f5fc247bf80511bd5b175b1f527cef1098d5e908c34acf81e986bfb99dcfa80i0',
  'b1776bc34762f7a6ef0122276e7cbd2922dfe6d5301a57bf7eb105bac167a364i0',
  '3c6549906170fe529005d201f77fa5a4f0cab7bfa283ed2c3e4c44d57887921fi0',
  '64abdaab518f553ef692fb59fb1244dd7c4833c2ae085b40fe71a14c253b9600i0',
  '397e179ca9c6b62c7982fd3426c569fcc52ff0e3f7c97a68b5dd9c89ea0bbb5di0',
  '8e26e5823d7fc3cd092b605feec7d1e7ce6e8908ca320d702a75f6160a552a89i0',
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [slumsPreview, setSlumsPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [isMempoolModalOpen, setIsMempoolModalOpen] = useState(false);
  const TEMP_HIDDEN_PROJECT_IDS = new Set<string>();

  // Statische Projekte (immer vorhanden)
  const staticProjects = [
    {
      id: 'bitcoin-mixtape',
      name: 'Bitcoin Mix Tape',
      thumbnail: '/mixtape.png',
      description: 'On-Chain Music Experience',
      order: 1, // Position 1 - ganz vorne!
    },
    {
      id: 'smile-a-bit',
      name: 'SMILE A ₿IT',
      thumbnail: '/images/smile-collection.png',
      description: '222 Unique Bitcoin Smiley Ordinals',
      order: 3,
    },
    {
      id: 'slums',
      name: 'SLUMS',
      thumbnail: slumsPreview || '',
      description: '333 Unique Pixel Ordinals',
      order: 4,
    },
    {
      id: 'eito-bitto',
      name: 'Eito Bitto',
      thumbnail: '/eito-bitto-logo.png',
      description: '51 Pixel Sub 100K Collection',
      order: 2,
    },
    {
      id: 'dimension-break',
      name: 'Dimension Break',
      thumbnail: '/images/dimension-break-preview.gif',
      description: '100 Recursive Pixel Ordinals · Free Mint',
      order: 6,
    },
    {
      id: 'badcats',
      name: 'BAD CATS',
      thumbnail: 'https://ordinals.com/content/35ccb1e128e691647258687c53f06a5f3f2078f15770eb0afedcd743524e63bdi0',
      description: '500 Recursive Ordinals',
      order: 3,
    },
    {
      id: 'black-wild',
      name: 'Black & Wild',
      thumbnail: '/thumbnail_Unbenanntes_Projekt-2026-01-01T222604.577-ezgif.com-apng-to-avif-converter - Kopie.avif',
      description: 'Bitcoin Ordinals Card Game',
      order: 5,
    },
    {
      id: 'tech-games',
      name: 'TECH & GAMES',
      thumbnail: '/techgame.png',
      description: 'Interactive games and tech tools',
      order: 6,
    },
    {
      id: 'cattack',
      name: 'CATTACK',
      thumbnail: '/images/cattack-card.png',
      description: 'Holder-gated game for Bad Cats owners',
      order: 10,
    },
    {
      id: 'marketplace',
      name: 'Marketplace',
      thumbnail: '/images/books-onchain.png',
      description: 'Trade Ordinals on RichArt',
      order: 999,
    },
    {
      id: 'point-shop',
      name: 'Point Shop',
      thumbnail: '/pointshop.png',
      description: 'Mint exclusive Ordinals with your points',
      order: 8,
    },
    {
      id: '1984',
      name: '1984',
      thumbnail: `https://ordinals.com/content/5c50d2e25d833e1357de824184e9d7859945c62f3b6af54c0f2f2a03caf5fd74i0`,
      description: 'Orwell on Bitcoin',
      order: 8,
    },
    {
      id: 'free-stuff',
      name: 'Free Stuff',
      thumbnail: `https://ordinals.com/content/4a019b00eaed13dce49df0ba18d1f82c95a276ca09a4b16c6990336ae7bc189bi0`,
      description: 'Free Ordinals Mints',
      order: 9,
    },
    {
      id: 'books-onchain',
      name: 'Books Onchain',
      thumbnail: '/images/marketplace-symbol.png',
      description: 'Books that live forever on Bitcoin',
      order: 10,
    },
    {
      id: 'void-sculptor',
      name: 'Void Sculptor',
      thumbnail: 'https://ordinals.com/content/663aece070e8500f10c3aea0d87b9da00981f16699abcf7c95eb044d95a46828i0',

      description: '3D Particle Editor & Ordinals Inscription Tool',
      order: 998,
    },
    {
      id: 'random-stuff',
      name: 'Random Stuff',
      thumbnail: `https://ordinals.com/content/c46de6b56a28fc5c9da4d22a8a15825e604418c1ad1e4eea6650afdebff0e670i0`,
      description: 'Random Ordinals Collection',
      order: 7,
    },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📋 REGEL FÜR ALLE ZUKÜNFTIGEN COLLECTIONS (Admin Panel):
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ HAUPTSEITE: Nur Titel anzeigen (KEINE Beschreibung)
  // ✅ MINT-SEITE: Vollständige Beschreibung + Details anzeigen
  // 
  // Technische Umsetzung:
  // - Dynamische Collections haben ein `collectionId` Feld
  // - Beschreibung wird nur angezeigt wenn `!project.collectionId`
  // - Statische Projekte (Black & Wild, Tech & Games) zeigen Beschreibung
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Dynamische Projekte aus Collections
  // NUR Collections OHNE page Feld (z.B. Sons of Satoshi Evolution)
  // Collections MIT page Feld sind bereits in staticProjects definiert
  const dynamicProjects = collections
    .filter(collection => !collection.page || collection.page === '')
    .map(collection => {
      const projectId = collection.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      
      // Sons of Satoshi Evolution bekommt Position 2 (nach Black & Wild, vor Tech Games)
      const order = collection.name.toLowerCase().includes('sons of satoshi') ? 2 : 5; // Standard: 5 (nach Point Shop)
      
      return {
        id: projectId,
        name: collection.name,
        thumbnail: collection.thumbnail || '/images/RichArt.png',
        description: collection.description || 'Collection',
        order: order,
        collectionId: collection.id, // Für Navigation
      };
    });

  // Kombiniere statische und dynamische Projekte, entferne Duplikate
  const allProjectIds = new Set([...staticProjects.map(p => p.id), ...dynamicProjects.map(p => p.id)]);
  const projects = [
    ...staticProjects,
    ...dynamicProjects.filter(p => !staticProjects.some(sp => sp.id === p.id)),
  ].sort((a, b) => (a.order || 999) - (b.order || 999));
  const visibleProjects = projects.filter((project) => !TEMP_HIDDEN_PROJECT_IDS.has(project.id));

  useEffect(() => {
    loadCollections();
  }, []);

  // Render SLUMS preview from on-chain AVIF layers
  useEffect(() => {
    let cancelled = false;
    const renderSlumsPreview = async () => {
      try {
        const SIZE = 400;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        for (const id of SLUMS_PREVIEW_LAYERS) {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('load failed'));
            el.src = `https://ordinals.com/content/${id}`;
          });
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
        }
        if (!cancelled) setSlumsPreview(canvas.toDataURL('image/png'));
      } catch {
        console.warn('[HomePage] SLUMS preview render failed');
      }
    };
    renderSlumsPreview();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      loadPoints();
    } else {
      setPointsData(null);
    }
  }, [walletState.connected, walletState.accounts]);

  const loadPoints = async () => {
    if (!walletState.accounts[0]) return;
    
    setLoading(true);
    try {
      const addresses = walletState.accounts.map((acc) => acc.address).filter(Boolean);
      const data = await getPointsForWalletAddresses(addresses);
      setPointsData(data);
    } catch (error) {
      console.error('Error loading points:', error);
      setPointsData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    setLoadingCollections(true);
    try {
      const data = await getAllCollections();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
      setCollections([]);
    } finally {
      setLoadingCollections(false);
    }
  };

  return (
    <>
      {/* Mempool Fees Banner - ganz oben */}
      <MempoolFeesBanner onDetailsClick={() => setIsMempoolModalOpen(true)} />
      
      {/* Mempool Details Modal */}
      <MempoolDetailsModal 
        isOpen={isMempoolModalOpen} 
        onClose={() => setIsMempoolModalOpen(false)} 
      />

      <div className="fixed inset-0 bg-black" style={{ zIndex: -1 }} />
      <SynthLife />
      <div className="min-h-screen flex flex-col items-center p-4 md:p-8 xl:px-[140px] pt-16 md:pt-20 pb-24 md:pb-8 relative z-10">
        {/* Oben links: Link Gallery + Punkte-Anzeige */}
      <div className="fixed top-2 md:top-4 left-2 md:left-4 z-40 flex items-center gap-2 md:gap-4">
        {/* Link Gallery */}
        <a
          href="/link-gallery"
          onClick={(e) => {
            e.preventDefault();
            navigate('/link-gallery');
          }}
          className="inline-block hover:opacity-80 transition-opacity"
          title="Link Gallery"
        >
          <img
            src="/images/RichArt.png"
            alt="RichArt - Link Gallery"
            className="h-10 cursor-pointer"
            onError={(e) => {
              console.warn('[HomePage] Could not load RichArt logo');
              e.currentTarget.style.display = 'none';
            }}
          />
        </a>
        
        {/* Punkte-Anzeige */}
        {walletState.connected && (
          <div>
            <p className="text-gray-400 text-sm">Your Points</p>
            {loading ? (
              <p className="text-2xl font-bold text-white">Loading...</p>
            ) : (
              <p className="text-2xl font-bold text-white">{pointsData?.points || 0}</p>
            )}
          </div>
        )}
      </div>

      {/* Logo - links ausgerichtet, verkleinert */}
      <div className="mb-3 w-full max-w-4xl">
        <img
          src="/richartlogo.png"
          alt="Atelier RichART"
          className="max-w-[180px] md:max-w-[220px] h-auto"
          onError={(e) => {
            console.warn('[HomePage] Could not load logo, falling back to text');
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Projekte und Kollektionen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 max-w-4xl w-full items-stretch">
        {visibleProjects.map((project, index) => {
          // Bestimme die Route basierend auf project.id oder collectionId
          const route = (project as any).collectionId 
            ? `/collection/${(project as any).collectionId}`
            : project.id === 'eito-bitto' ? '/EitoBitto'
            : `/${project.id}`;
          
          return (
            <div
              key={project.id}
              onClick={() => navigate(route)}
            className={`w-full cursor-pointer transition-all duration-300 flex flex-col items-center h-full group relative touch-manipulation ${
              project.id === 'bitcoin-mixtape' ? 'order-1' :
              project.id === 'eito-bitto' ? 'order-2' :
              project.id === 'badcats' ? 'order-3' :
              project.id === 'smile-a-bit' ? 'order-4' :
              project.id === 'slums' ? 'order-5' :
              project.id === 'dimension-break' ? 'order-6' :
              project.id === 'marketplace' ? 'order-7' :
              project.id === 'tech-games' ? 'order-8' :
              project.id === 'books-onchain' ? 'order-9' :
              project.id === 'point-shop' ? 'order-10' :
              project.id === 'black-wild' ? 'order-11' :
              project.id === 'random-stuff' ? 'order-12' :
              project.id === 'free-stuff' ? 'order-[13]' :
              project.id === '1984' ? 'order-[14]' :
              project.id === 'void-sculptor' ? 'order-[998]' :
              project.id === 'cattack' ? 'order-last' :
              (project as any).collectionId ? 'order-[14]' :
              project.order >= 8 ? 'order-[15]' :
              'order-[16]'
            } active:scale-95 md:hover:scale-105 hover:shadow-lg hover:shadow-red-600/20`}
          >
            {/* Glassmorphism Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
            {/* Einheitliche Media-Box fuer konsistente Groesse/Position */}
            <div className="w-full mx-auto max-w-36 md:max-w-40 relative z-10">
              {project.id === 'marketplace' && (
                <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 bg-red-600 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-white rounded-full shadow-lg">
                  NEW
                </div>
              )}
              {project.id === 'eito-bitto' && (
                <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 bg-cyan-500 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-white rounded-full shadow-lg">
                  FRIENDS
                </div>
              )}
              {project.id === 'dimension-break' && (
                <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 bg-green-500 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-white rounded-full shadow-lg">
                  FREE MINT
                </div>
              )}
              {/* Bild ohne Rahmen - klickbar, maximale Größe */}
              {project.id === 'slums' ? (
                <div className="overflow-hidden rounded-xl relative aspect-square bg-transparent flex items-center justify-center">
                  {slumsPreview ? (
                    <img
                      src={slumsPreview}
                      alt="SLUMS"
                      className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-900 rounded flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              ) : project.id === 'badcats' || project.id === 'void-sculptor' ? (
                <div className="overflow-hidden rounded-xl relative" style={{ aspectRatio: '1/1' }}>
                  <iframe
                    src={project.thumbnail}
                    title={project.name}
                    className="w-full h-full border-0 pointer-events-none transition-all duration-300 group-hover:scale-110"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    scrolling="no"
                  />
                </div>
              ) : project.thumbnail ? (
                <div className="overflow-hidden rounded-xl aspect-square bg-transparent flex items-center justify-center">
                  <ProgressiveImage
                    src={project.thumbnail}
                    alt={project.name}
                    className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-900 border border-red-600 rounded flex items-center justify-center">
                  <div className="text-center p-4">
                    <div className="text-4xl mb-2">🛒</div>
                    <p className="text-white text-sm font-bold">{project.name}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Einheitlicher Textbereich unter der Media-Box */}
            <div className="mt-2 text-center w-full relative z-10 transition-all duration-300 group-hover:translate-y-[-3px] min-h-[68px] flex flex-col justify-start">
              {project.id === 'black-wild' ? (
                <h2 className="text-sm font-bold mb-0.5 transition-colors duration-300 group-hover:text-red-600">
                  <span 
                    className="text-black transition-all duration-300"
                    style={{
                      textShadow: '-1px -1px 1px rgba(255, 255, 255, 0.5), 1px -1px 1px rgba(255, 255, 255, 0.5), -1px 1px 1px rgba(255, 255, 255, 0.5), 1px 1px 1px rgba(255, 255, 255, 0.5), 0 0 2px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    BLACK
                  </span>
                  <span className="text-red-600 mx-1">&</span>
                  <span className="text-white">WILD</span>
                </h2>
              ) : (
                <h2 className="text-sm font-bold text-white mb-0.5 transition-colors duration-300 group-hover:text-red-400">{project.name}</h2>
              )}
              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  📋 WICHTIG: Beschreibung NUR für statische Projekte!
                  - Statische Projekte: Black & Wild, Tech & Games, Point Shop
                  - Dynamische Collections (Admin Panel): NUR Titel
                  - Beschreibung wird auf Mint-Seite angezeigt
                  - ABER: Unsichtbarer Platzhalter für gleiche Höhe der Titel
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              {!project.collectionId ? (
                <p className="text-[10px] text-gray-400 transition-colors duration-300 group-hover:text-gray-300 min-h-[2rem] leading-tight">
                  {project.description}
                </p>
              ) : (
                <p className="text-[10px] text-gray-400 opacity-0 pointer-events-none min-h-[2rem]">Placeholder</p>
              )}
            </div>
            </div>
          );
        })}
      </div>

      {/* Palindrom Sound Box - NUR sichtbar für bestimmte Wallets */}
      {walletState.connected && walletState.accounts?.some(acc =>
        ['bc1p8mex3g66tsrqlura04ts6xgxlfwhf23adrxpc5g6c0zmqdgqtq3syq0elu',
         'bc1p9j4g6r27yqhmp4c403vn33mz7uug439sthqngkkrylu7d7uq7d6qvz39jj'
        ].includes(acc.address)
      ) && (
        <div className="mt-8 flex justify-center">
          <div
            onClick={() => navigate('/palindrom-sound-box')}
            className="cursor-pointer transition-all duration-300 hover:scale-105 hover:drop-shadow-lg hover:drop-shadow-purple-500/50"
          >
            <img
              src="/images/palindrom-link.png"
              alt="Palindrom Sound Box"
              className="max-w-xs h-auto rounded-lg"
              loading="lazy"
            />
          </div>
        </div>
      )}

    </div>

    {/* News Sidebar - left side, large screens only, rotating */}
    <NewsSidebar navigate={navigate} />

    {/* New Stuff Sidebar - right side, large screens only, rotating */}
    <NewStuffSidebar navigate={navigate} />
    </>
  );
};

