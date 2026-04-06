import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { ORDINAL_ODDITIES_HASHLIST } from '../data/ordinalOdditiesHashlist';
import {
  cancelMarketplaceListing,
  completeMarketplacePurchaseAdvanced,
  finalizeMarketplaceListingPsbt,
  getMarketplaceInscriptionDetail,
  getMarketplaceListings,
  prepareMarketplaceListingPsbt,
  prepareMarketplacePurchaseAdvanced,
} from '../services/marketplaceService';
import { getOrdinalAddress, getPaymentAddress, getWalletInscriptionIds, signPSBT } from '../utils/wallet';

type ItemListing = {
  id: string;
  inscriptionId: string;
  seller: string;
  priceSats: number;
  listedAt: number;
  signedPsbtBase64?: string;
};
type ListingsMap = Record<string, ItemListing>;

const COLLECTION_SLUG = 'ordinaloddities';
const SATS_PER_BTC = 100_000_000;
const NAKAMOTO_SAT_MAX = 95_000_000_000_000;
const VINTAGE_SAT_MAX = 5_000_000_000_000;
const BLOCK_REWARD_0 = 50 * SATS_PER_BTC;

function deriveSatRarity(sat: number): string {
  if (!Number.isFinite(sat) || sat < 0) return '-';
  const s = Math.trunc(sat);
  const d: string[] = [];
  if (s === 0) d.push('mythic');
  if (s < NAKAMOTO_SAT_MAX) d.push('nakamoto');
  if (s < VINTAGE_SAT_MAX) d.push('vintage');
  if (s % SATS_PER_BTC === 0) d.push('alpha');
  if (s % SATS_PER_BTC === SATS_PER_BTC - 1) d.push('omega');
  if (s % BLOCK_REWARD_0 === 0 && s > 0) d.push('uncommon');
  const t = String(s);
  if (t === t.split('').reverse().join('')) d.push('palindrome');
  const block = Math.floor(s / BLOCK_REWARD_0);
  if (block === 9) d.push('block 9');
  if (block === 78) d.push('block 78');
  if (block < 1000) d.push('early');
  return d.length ? Array.from(new Set(d)).join(', ') : '-';
}

const RARE_SAT_SYMBOLS: Record<string, string> = {
  mythic: '★', legendary: '◆', epic: '◈', rare: '◉', uncommon: '○',
  nakamoto: '₿', vintage: '⌛', alpha: 'α', omega: 'Ω', palindrome: '↔',
  'block 9': '⑨', 'block 78': '⑦⑧', early: '⚒', pizza: '🍕', hitman: '🎯',
};

const truncId = (a: string) => a ? `${a.slice(0, 10)}...` : '-';
const formatSats = (value: number) => new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(value)));
const shortAddress = (value: string) => (value.length > 14 ? `${value.slice(0, 7)}...${value.slice(-5)}` : value || '-');
const formatDateTime = (value?: number) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};
const normalizeAddress = (addr: string) => String(addr || '').trim().toLowerCase();

const HORROR_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');
@keyframes hFlicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
  20%, 24%, 55% { opacity: 0.4; }
}
@keyframes hBloodGlow {
  0%, 100% { text-shadow: 0 0 10px #f008, 0 0 20px #a005, 0 0 40px #8002; }
  50% { text-shadow: 0 0 20px #f00a, 0 0 40px #a008, 0 0 80px #8004, 0 2px 10px #f003; }
}
@keyframes hTitlePulse {
  0%, 100% { text-shadow: 0 0 20px #f00, 0 0 40px #a008, 0 0 80px #60004; filter: brightness(1); transform: scale(1); }
  25% { text-shadow: 0 0 30px #f00, 0 0 60px #a00a, 0 0 120px #60006; filter: brightness(1.2); transform: scale(1.01); }
  50% { text-shadow: 0 0 15px #f008, 0 0 30px #a006, 0 0 60px #60003; filter: brightness(0.9); transform: scale(0.99); }
  75% { text-shadow: 0 0 25px #f00c, 0 0 50px #a009, 0 0 100px #60005; filter: brightness(1.1); transform: scale(1.005); }
}
@keyframes hBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes hPriceGlow {
  0%, 100% { text-shadow: 0 0 6px #f44, 0 0 14px #f445; }
  50% { text-shadow: 0 0 12px #f44, 0 0 24px #f447, 0 0 40px #a002; }
}
@keyframes hOwnedGlow {
  0%, 100% { box-shadow: 0 0 12px #a003, 0 0 24px #a002; border-color: #a00a; }
  50% { box-shadow: 0 0 24px #a006, 0 0 48px #a003; border-color: #f00; }
}
@keyframes hBorderPulse {
  0%, 100% { border-color: #80000080; box-shadow: 0 0 8px #80000040, inset 0 0 8px #80000020; }
  50% { border-color: #cc0000cc; box-shadow: 0 0 20px #cc000060, inset 0 0 20px #cc000030, 0 0 40px #ff000020; }
}
@keyframes hStatFlash {
  0%, 100% { background: #80000015; }
  50% { background: #80000030; }
}
@keyframes hDrip {
  0% { transform: translateY(-10px); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(40px); opacity: 0; }
}
@keyframes hGlitch {
  0%, 92%, 100% { transform: translate(0); filter: none; }
  93% { transform: translate(-2px, 1px); filter: hue-rotate(90deg) saturate(3); }
  95% { transform: translate(3px, -1px); filter: hue-rotate(-60deg) saturate(2); }
  97% { transform: translate(-1px, -2px); filter: hue-rotate(180deg); }
}
.h-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  position: relative;
  overflow: hidden;
}
.h-card::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 0%, #f0001a 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: 1;
}
.h-card:hover::before { opacity: 1; }
.h-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 0 30px #80000060, 0 0 60px #ff000020, 0 8px 30px #000a;
  border-color: #cc0000 !important;
  z-index: 5;
}
.h-card:hover img { filter: saturate(1.3) contrast(1.1); }
.h-font { font-family: 'Creepster', 'Georgia', cursive; }
.h-mono { font-family: 'Courier New', Courier, monospace; }
`;

function HorrorCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouseRef = React.useRef({ x: -1, y: -1 });
  const rafRef = React.useRef(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PARTICLE_COUNT = 220;
    const RADIUS = 500;
    let smoothMx = -1, smoothMy = -1;

    type Particle = { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; type: 'ember' | 'fog' | 'eye' | 'vein'; blinkPhase: number; angle: number };
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const type = i < 14 ? 'eye' : i < 60 ? 'fog' : i < 80 ? 'vein' : 'ember';
      particles.push({
        x: Math.random() * 2000, y: Math.random() * 2000,
        vx: (Math.random() - 0.5) * (type === 'fog' ? 0.4 : type === 'vein' ? 0.15 : 0.9),
        vy: type === 'ember' ? -Math.random() * 0.8 - 0.3 : type === 'vein' ? (Math.random() - 0.5) * 0.1 : (Math.random() - 0.5) * 0.4,
        size: type === 'eye' ? 8 + Math.random() * 8 : type === 'fog' ? 50 + Math.random() * 100 : type === 'vein' ? 40 + Math.random() * 80 : 1.5 + Math.random() * 4,
        life: Math.random() * 300, maxLife: 250 + Math.random() * 500, type, blinkPhase: Math.random() * Math.PI * 2, angle: Math.random() * Math.PI * 2,
      });
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: -1, y: -1 }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    const draw = (ts: number) => {
      const t = ts * 0.001;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const hasMouse = mx >= 0 && my >= 0;

      if (hasMouse) {
        smoothMx = smoothMx < 0 ? mx : smoothMx + (mx - smoothMx) * 0.06;
        smoothMy = smoothMy < 0 ? my : smoothMy + (my - smoothMy) * 0.06;
      } else { smoothMx = -1; smoothMy = -1; }

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.life++;
        if (p.life > p.maxLife) {
          p.x = Math.random() * w; p.y = p.type === 'ember' ? h + 10 : Math.random() * h;
          p.life = 0; p.maxLife = 200 + Math.random() * 400;
        }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -50) p.x = w + 50; if (p.x > w + 50) p.x = -50;
        if (p.y < -50) p.y = h + 50; if (p.y > h + 50) p.y = -50;

        let proximity = 0;
        if (smoothMx >= 0) {
          const dx = p.x - smoothMx, dy = p.y - smoothMy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          proximity = Math.max(0, 1 - dist / RADIUS);
        }

        const fadeIn = Math.min(1, p.life / 30);
        const fadeOut = Math.min(1, (p.maxLife - p.life) / 30);
        const alpha = fadeIn * fadeOut;

        if (p.type === 'fog') {
          const fogAlpha = alpha * (0.08 + proximity * 0.18);
          const fogSize = p.size + proximity * 80;
          const pulse = Math.sin(t * 0.3 + p.blinkPhase) * 0.3 + 0.7;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, fogSize);
          grad.addColorStop(0, `rgba(${100 + proximity * 100}, ${proximity * 10}, 0, ${fogAlpha * pulse})`);
          grad.addColorStop(0.4, `rgba(60, 0, 0, ${fogAlpha * 0.5 * pulse})`);
          grad.addColorStop(0.7, `rgba(30, 0, 5, ${fogAlpha * 0.2})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(p.x - fogSize, p.y - fogSize, fogSize * 2, fogSize * 2);
        } else if (p.type === 'vein') {
          const veinAlpha = alpha * (0.04 + proximity * 0.15);
          const len = p.size * (1 + proximity * 1.5);
          const wave = Math.sin(t * 0.5 + p.blinkPhase + p.x * 0.005) * 8;
          ctx.save();
          ctx.globalAlpha = veinAlpha;
          ctx.strokeStyle = `rgba(${140 + proximity * 80}, 0, ${10 + proximity * 20}, 1)`;
          ctx.lineWidth = 1 + proximity * 2;
          ctx.shadowColor = `rgba(200, 0, 0, ${veinAlpha})`;
          ctx.shadowBlur = 6 + proximity * 15;
          ctx.beginPath();
          ctx.moveTo(p.x - len / 2, p.y + wave);
          ctx.quadraticCurveTo(p.x - len / 4, p.y - wave * 1.5, p.x, p.y + wave * 0.5);
          ctx.quadraticCurveTo(p.x + len / 4, p.y - wave, p.x + len / 2, p.y + wave * 0.8);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        } else if (p.type === 'eye') {
          const eyeAlpha = alpha * (0.35 + proximity * 0.65);
          const blink = Math.sin(t * 0.8 + p.blinkPhase);
          if (blink > -0.3) {
            const s = p.size * (1 + proximity * 0.8);
            let angle = 0;
            if (smoothMx >= 0) {
              angle = Math.atan2(smoothMy - p.y, smoothMx - p.x);
            }
            const pupilDist = s * 0.25 * (smoothMx >= 0 ? Math.min(1, proximity * 3 + 0.4) : 0.15);
            ctx.save();
            ctx.globalAlpha = eyeAlpha;
            ctx.shadowColor = `rgba(255, 0, 0, ${eyeAlpha * 0.6})`;
            ctx.shadowBlur = 15 + proximity * 25;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, s, s * (0.45 + blink * 0.15), 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${180 + proximity * 75}, ${30 + proximity * 30}, 0, 1)`;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            const irisSize = s * 0.55;
            const px = p.x + Math.cos(angle) * pupilDist;
            const py = p.y + Math.sin(angle) * pupilDist;
            const irisGrad = ctx.createRadialGradient(px, py, 0, px, py, irisSize);
            irisGrad.addColorStop(0, '#000');
            irisGrad.addColorStop(0.5, `rgba(${40 + proximity * 60}, 0, 0, 1)`);
            irisGrad.addColorStop(0.8, `rgba(${100 + proximity * 80}, ${proximity * 15}, 0, 1)`);
            irisGrad.addColorStop(1, `rgba(${160 + proximity * 60}, ${20 + proximity * 20}, 0, 0.5)`);
            ctx.arc(px, py, irisSize, 0, Math.PI * 2);
            ctx.fillStyle = irisGrad;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, s * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px - s * 0.08, py - s * 0.08, s * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, ${150 + proximity * 105}, ${80 + proximity * 80}, 0.9)`;
            ctx.fill();
            ctx.restore();
          }
        } else {
          const emberAlpha = alpha * (0.5 + proximity * 0.5);
          const sz = p.size * (1 + proximity * 3);
          ctx.fillStyle = `rgba(${200 + Math.random() * 55}, ${Math.random() * 50}, 0, ${emberAlpha})`;
          ctx.shadowColor = `rgba(255, 0, 0, ${emberAlpha * 0.7})`;
          ctx.shadowBlur = 6 + proximity * 20;
          ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
          ctx.shadowBlur = 0;
        }

        if (proximity > 0.2 && (p.type === 'ember' || p.type === 'vein')) {
          const push = (proximity - 0.2) * 2.5;
          const dx = p.x - smoothMx, dy = p.y - smoothMy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          p.vx += (dx / dist) * push * 0.4;
          p.vy += (dy / dist) * push * 0.4;
          p.vx *= 0.95; p.vy *= 0.95;
        }
      }

      // ambient red fog always visible
      const ambientPulse = Math.sin(t * 0.15) * 0.3 + 0.7;
      const ambGrad1 = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, w * 0.5);
      ambGrad1.addColorStop(0, `rgba(80, 0, 0, ${0.04 * ambientPulse})`);
      ambGrad1.addColorStop(1, 'transparent');
      ctx.fillStyle = ambGrad1;
      ctx.fillRect(0, 0, w, h);
      const ambGrad2 = ctx.createRadialGradient(w * 0.8, h * 0.7, 0, w * 0.8, h * 0.7, w * 0.4);
      ambGrad2.addColorStop(0, `rgba(60, 0, 10, ${0.035 * ambientPulse})`);
      ambGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = ambGrad2;
      ctx.fillRect(0, 0, w, h);

      if (hasMouse) {
        const grad = ctx.createRadialGradient(smoothMx, smoothMy, 0, smoothMx, smoothMy, RADIUS);
        grad.addColorStop(0, 'rgba(160, 0, 0, 0.15)');
        grad.addColorStop(0.3, 'rgba(100, 0, 0, 0.08)');
        grad.addColorStop(0.6, 'rgba(50, 0, 10, 0.04)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(smoothMx - RADIUS, smoothMy - RADIUS, RADIUS * 2, RADIUS * 2);

        const ringPulse = Math.sin(t * 2) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(150, 0, 0, ${0.06 * ringPulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(smoothMx, smoothMy, RADIUS * 0.6 + Math.sin(t * 1.5) * 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

function BloodCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <div className="absolute pointer-events-none" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 40, height: 40 }}>
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 40, height: 2, background: 'linear-gradient(90deg, #a00, #600)', boxShadow: '0 0 8px #a006' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 2, height: 40, background: 'linear-gradient(180deg, #a00, #600)', boxShadow: '0 0 8px #a006' }} />
      {isTop && <div style={{ position: 'absolute', top: 2, [isLeft ? 'left' : 'right']: 8, width: 2, height: 12, background: '#a00', borderRadius: '0 0 2px 2px', animation: 'hDrip 3s ease-in infinite', animationDelay: isLeft ? '0s' : '1.5s', boxShadow: '0 0 4px #a008' }} />}
    </div>
  );
}

export const OrdinalOdditiesMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [listings, setListings] = React.useState<ListingsMap>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [listPrice, setListPrice] = React.useState('10000');
  const [search, setSearch] = React.useState('');
  const [sortMode, setSortMode] = React.useState<'number-asc' | 'number-desc' | 'price-asc' | 'price-desc' | 'listed-newest'>('number-asc');
  const [itemFilter, setItemFilter] = React.useState<'all' | 'listed' | 'not-listed' | 'owned'>('all');
  const [myOnly, setMyOnly] = React.useState(false);
  const [ownedIds, setOwnedIds] = React.useState<Set<string>>(new Set());
  const [loadingOwned, setLoadingOwned] = React.useState(false);
  const [ownershipError, setOwnershipError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [busyListingId, setBusyListingId] = React.useState<string | null>(null);
  const [ownerByInscription, setOwnerByInscription] = React.useState<Record<string, string>>({});
  const [selectedDetailLoading, setSelectedDetailLoading] = React.useState(false);
  const [selectedDetailError, setSelectedDetailError] = React.useState<string | null>(null);
  const [ordApiData, setOrdApiData] = React.useState<Record<string, any> | null>(null);
  const [fullscreenImage, setFullscreenImage] = React.useState<{ url: string; name: string } | null>(null);
  const resolvingOwnerIdsRef = React.useRef<Set<string>>(new Set());
  const ordApiCacheRef = React.useRef<Record<string, Record<string, any>>>({});

  const itemIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    ORDINAL_ODDITIES_HASHLIST.forEach((item, idx) => map.set(item.inscriptionId, idx + 1));
    return map;
  }, []);

  const currentAddress = getOrdinalAddress(walletState.accounts || []) || String(walletState.accounts?.[0]?.address || '').trim();
  const paymentAddress = getPaymentAddress(walletState.accounts || []) || currentAddress;
  const walletAddrNorm = normalizeAddress(currentAddress);

  const loadMarketplaceListings = React.useCallback(async () => {
    const rows = await getMarketplaceListings({ status: 'active', collectionSlug: COLLECTION_SLUG, limit: 400 }).catch(() => []);
    const next: ListingsMap = {};
    for (const row of rows) {
      const inscriptionId = String(row?.inscription_id || '').trim();
      if (!inscriptionId) continue;
      next[inscriptionId] = {
        id: String(row?.id || `${inscriptionId}-listing`),
        inscriptionId,
        seller: String(row?.seller_address || '').trim(),
        priceSats: Math.max(0, Number(row?.price_sats || 0)),
        listedAt: new Date(String(row?.created_at || '')).getTime() || Date.now(),
        signedPsbtBase64: String(row?.signed_psbt_base64 || '').trim() || undefined,
      };
    }
    setListings(next);
  }, []);

  React.useEffect(() => { void loadMarketplaceListings(); }, [loadMarketplaceListings]);

  const resolveOwnerAddress = React.useCallback(async (inscriptionId: string): Promise<string> => {
    const detail = await getMarketplaceInscriptionDetail(inscriptionId);
    const ownerFromMarketplace = String(detail?.marketplaceInscription?.owner_address || '').trim();
    const ownerFromChain = String(detail?.chainInfo?.ownerAddress || detail?.chainInfo?.owner_address || detail?.chainInfo?.address || '').trim();
    return ownerFromMarketplace || ownerFromChain;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!walletState.connected || !Array.isArray(walletState.accounts) || walletState.accounts.length === 0) {
        setOwnedIds(new Set()); setLoadingOwned(false); setOwnershipError(null); return;
      }
      setLoadingOwned(true); setOwnershipError(null);
      try {
        const allWalletIds = await getWalletInscriptionIds(walletState.walletType);
        const hashlistIdSet = new Set(ORDINAL_ODDITIES_HASHLIST.map((item) => item.inscriptionId));
        const nextOwned = new Set<string>();
        for (const id of allWalletIds) { if (hashlistIdSet.has(id)) nextOwned.add(id); }
        if (!cancelled) setOwnedIds(nextOwned);
      } catch (err: any) {
        if (!cancelled) setOwnershipError(err?.message || 'Could not load wallet items');
      } finally {
        if (!cancelled) setLoadingOwned(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [walletState.connected, walletState.accounts, walletState.walletType]);

  React.useEffect(() => {
    if (!selectedId) { setOrdApiData(null); return; }
    let cancelled = false;
    const cachedOrd = ordApiCacheRef.current[selectedId];
    if (cachedOrd) setOrdApiData(cachedOrd); else setOrdApiData(null);
    const ownerAlready = ownerByInscription[selectedId];
    const run = async () => {
      if (!ownerAlready) {
        setSelectedDetailLoading(true); setSelectedDetailError(null);
        try {
          const resolvedOwner = await resolveOwnerAddress(selectedId);
          if (!cancelled && resolvedOwner) setOwnerByInscription((prev) => ({ ...prev, [selectedId]: resolvedOwner }));
        } catch (err: any) {
          if (!cancelled) setSelectedDetailError(err?.message || 'Could not load inscription owner');
        } finally { if (!cancelled) setSelectedDetailLoading(false); }
      } else { setSelectedDetailLoading(false); setSelectedDetailError(null); }
      if (!cachedOrd) {
        try {
          const res = await fetch(`https://ordinals.com/r/inscription/${encodeURIComponent(selectedId)}`);
          if (res.ok) { const data = await res.json(); if (!cancelled && data) { ordApiCacheRef.current[selectedId] = data; setOrdApiData(data); } }
        } catch { /* ignore */ }
      }
    };
    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = ORDINAL_ODDITIES_HASHLIST.filter((item) => {
      if (myOnly && !ownedIds.has(item.inscriptionId)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.inscriptionId.toLowerCase().includes(q);
    }).map((item, idx) => {
      const listing = listings[item.inscriptionId] || null;
      const isOwnedByConnectedWallet = ownedIds.has(item.inscriptionId);
      return { ...item, listing, displayIndex: itemIndexById.get(item.inscriptionId) || idx + 1, isOwnedByConnectedWallet };
    });
    if (itemFilter === 'listed') filtered = filtered.filter((r) => !!r.listing);
    if (itemFilter === 'not-listed') filtered = filtered.filter((r) => !r.listing);
    if (itemFilter === 'owned') filtered = filtered.filter((r) => r.isOwnedByConnectedWallet);

    filtered.sort((a, b) => {
      const listedA = !!a.listing, listedB = !!b.listing;
      const priceA = Number(a.listing?.priceSats || 0), priceB = Number(b.listing?.priceSats || 0);
      if (sortMode === 'number-asc') return a.inscriptionNumber - b.inscriptionNumber;
      if (sortMode === 'number-desc') return b.inscriptionNumber - a.inscriptionNumber;
      if (sortMode === 'price-asc') { if (listedA !== listedB) return listedA ? -1 : 1; if (priceA !== priceB) return priceA - priceB; }
      if (sortMode === 'price-desc') { if (listedA !== listedB) return listedA ? -1 : 1; if (priceA !== priceB) return priceB - priceA; }
      if (sortMode === 'listed-newest') { if (listedA !== listedB) return listedA ? -1 : 1; return Number(b.listing?.listedAt || 0) - Number(a.listing?.listedAt || 0); }
      return a.displayIndex - b.displayIndex;
    });
    return filtered;
  }, [itemFilter, itemIndexById, listings, myOnly, ownedIds, search, sortMode]);

  React.useEffect(() => {
    let cancelled = false;
    const missingIds = rows.map((r) => r.inscriptionId).filter((id) => !ownerByInscription[id] && !resolvingOwnerIdsRef.current.has(id));
    if (missingIds.length === 0) return;
    const run = async () => {
      const batchSize = 4;
      for (let i = 0; i < missingIds.length && !cancelled; i += batchSize) {
        const batch = missingIds.slice(i, i + batchSize);
        batch.forEach((id) => resolvingOwnerIdsRef.current.add(id));
        const results = await Promise.all(batch.map(async (id) => { try { const owner = await resolveOwnerAddress(id); return { id, owner }; } catch { return { id, owner: '' }; } finally { resolvingOwnerIdsRef.current.delete(id); } }));
        if (cancelled) return;
        setOwnerByInscription((prev) => { let next = prev; for (const r of results) { if (!r.owner || next[r.id]) continue; if (next === prev) next = { ...prev }; next[r.id] = r.owner; } return next; });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [ownerByInscription, resolveOwnerAddress, rows]);

  const activeListingsCount = rows.filter((r) => !!r.listing).length;
  const floor = rows.reduce((min, r) => { const p = Number(r.listing?.priceSats || 0); return !p ? min : min <= 0 ? p : Math.min(min, p); }, 0);
  const selected = rows.find((r) => r.inscriptionId === selectedId) || null;
  const selectedOwnerAddress = selected ? (ownerByInscription[selected.inscriptionId] || (selected.isOwnedByConnectedWallet && currentAddress ? currentAddress : selected.listing?.seller || '')) : '';

  const handleList = () => {
    void (async () => {
      try {
        if (!selected || !walletAddrNorm) throw new Error('Connect wallet first');
        if (!selected.isOwnedByConnectedWallet) throw new Error('Only owned items can be listed');
        if (!walletState.walletType) throw new Error('Wallet type missing');
        const price = Number(listPrice);
        if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be > 0');
        setActionError(null); setActionMessage(null); setBusyListingId(selected.inscriptionId);
        const prepared = await prepareMarketplaceListingPsbt({ inscriptionId: selected.inscriptionId, collectionSlug: COLLECTION_SLUG, sellerAddress: currentAddress, sellerPaymentAddress: paymentAddress || currentAddress, buyerReceiveAddress: currentAddress, priceSats: Math.floor(price) });
        if (!prepared?.psbtBase64 || !prepared?.listingId) throw new Error('Invalid PSBT payload');
        const signed = await signPSBT(prepared.psbtBase64, walletState.walletType, false, prepared.ownerAddress || currentAddress, 0x82);
        const isHex = /^[0-9a-fA-F]+$/.test(String(signed || '').trim());
        await finalizeMarketplaceListingPsbt({ listingId: prepared.listingId, walletAddress: currentAddress, signedPsbtHex: isHex ? signed : undefined, signedPsbtBase64: isHex ? undefined : signed });
        setActionMessage('LISTED SUCCESSFULLY'); await loadMarketplaceListings();
      } catch (err: any) { setActionError(err?.message || 'Listing failed'); } finally { setBusyListingId(null); }
    })();
  };

  const handleDelist = () => {
    void (async () => {
      try {
        if (!selected?.listing || !walletAddrNorm) throw new Error('No listing');
        if (normalizeAddress(selected.listing.seller) !== walletAddrNorm) throw new Error('Only seller can delist');
        setActionError(null); setActionMessage(null); setBusyListingId(selected.listing.id);
        await cancelMarketplaceListing(selected.listing.id, currentAddress);
        setActionMessage('LISTING CANCELLED'); await loadMarketplaceListings();
      } catch (err: any) { setActionError(err?.message || 'Delist failed'); } finally { setBusyListingId(null); }
    })();
  };

  const handleBuy = () => {
    void (async () => {
      try {
        if (!selected?.listing || !walletAddrNorm) throw new Error('No listing selected');
        if (!walletState.walletType) throw new Error('Connect wallet first');
        if (normalizeAddress(selected.listing.seller) === walletAddrNorm) throw new Error('Cannot buy your own listing');
        setActionError(null); setActionMessage(null); setBusyListingId(selected.listing.id);
        const prepared = await prepareMarketplacePurchaseAdvanced({ listingId: selected.listing.id, buyerAddress: currentAddress, fundingAddress: paymentAddress || currentAddress, fundingAddressCandidates: Array.from(new Set([currentAddress, paymentAddress].filter(Boolean))) });
        const signed = await signPSBT(prepared.fundedPsbtBase64, walletState.walletType, false, currentAddress, undefined, Array.isArray(prepared.funding?.buyerSigningIndexes) ? prepared.funding.buyerSigningIndexes : undefined);
        const isHex = /^[0-9a-fA-F]+$/.test(String(signed || '').trim());
        await completeMarketplacePurchaseAdvanced({ listingId: selected.listing.id, buyerAddress: currentAddress, signedPsbtHex: isHex ? signed : undefined, signedPsbtBase64: isHex ? undefined : signed });
        setActionMessage('PURCHASE COMPLETED'); await loadMarketplaceListings();
      } catch (err: any) { setActionError(err?.message || 'Buy failed'); } finally { setBusyListingId(null); }
    })();
  };

  const hBorder = (color: string) => `2px solid ${color}`;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0508 0%, #0a0204 40%, #050102 100%)' }}>
      <style>{HORROR_CSS}</style>

      <HorrorCanvas />

      <div className="absolute pointer-events-none" style={{ top: '5%', left: '3%', width: 600, height: 600, background: 'radial-gradient(circle, #60000030 0%, #40000015 40%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ top: '50%', right: '5%', width: 500, height: 500, background: 'radial-gradient(circle, #50000025 0%, #30000010 40%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '40%', width: 700, height: 400, background: 'radial-gradient(ellipse, #40000020 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-3 py-6">

        {/* HEADER */}
        <div className="mb-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="h-mono px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#a002]" style={{ border: hBorder('#80000080'), color: '#c44', background: '#80000015', boxShadow: '0 0 12px #80000020' }}>
            {'<'} BACK
          </button>
        </div>

        {/* TITLE */}
        <div className="mb-6 relative py-8">
          <div className="text-center" style={{ animation: 'hGlitch 12s ease-in-out infinite' }}>
            <h1 className="h-font text-5xl md:text-8xl uppercase tracking-[0.08em]" style={{ color: '#cc0000', animation: 'hTitlePulse 4s ease-in-out infinite', letterSpacing: '0.1em' }}>
              Ordinal Oddities
            </h1>
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(90deg, transparent, #80000080, transparent)' }} />
              <p className="h-mono text-[11px] md:text-xs uppercase tracking-[0.5em] font-bold" style={{ color: '#800000', textShadow: '0 0 10px #80000060', animation: 'hFlicker 4s ease-in-out infinite' }}>
                19 SPECIMENS · HANDLE WITH FEAR
              </p>
              <span className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(90deg, transparent, #80000080, transparent)' }} />
            </div>
          </div>
        </div>

        {/* STATS BAR */}
        <div className="mb-6 flex flex-wrap justify-center gap-3 text-[11px] font-bold uppercase tracking-wider h-mono">
          {[
            { label: 'SPECIMENS', value: String(rows.length), color: '#c44', icon: '☠' },
            { label: 'LISTED', value: String(activeListingsCount), color: '#a33', icon: '⚰' },
            { label: 'FLOOR', value: floor > 0 ? `${formatSats(floor)} SAT` : '---', color: '#f44', icon: '₿' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5 relative" style={{ border: hBorder('#80000060'), background: `linear-gradient(180deg, #80000018 0%, #80000008 100%)`, color: s.color, boxShadow: `inset 0 0 20px #80000010, 0 0 10px #80000015`, animation: 'hStatFlash 5s ease-in-out infinite', minWidth: 120, textAlign: 'center' }}>
              <span style={{ fontSize: 14, marginRight: 6 }}>{s.icon}</span>{s.label}: <span style={{ fontSize: 13 }}>{s.value}</span>
            </div>
          ))}
          <button onClick={() => setMyOnly((v) => !v)} className="px-4 py-2.5 font-bold uppercase transition-all" style={{ border: hBorder(myOnly ? '#a00' : ownedIds.size > 0 ? '#a00080' : '#80000040'), background: myOnly ? '#a0001a' : ownedIds.size > 0 ? '#a00010' : 'transparent', color: myOnly ? '#f44' : ownedIds.size > 0 ? '#c44' : '#80000080', textShadow: myOnly ? '0 0 8px #a006' : 'none', animation: ownedIds.size > 0 && !myOnly ? 'hOwnedGlow 2.5s ease-in-out infinite' : 'none', boxShadow: myOnly ? '0 0 20px #a00040' : 'none' }}>
            ☠ MY ITEMS {walletState.connected ? `[${ownedIds.size}]` : ''}
          </button>
          {myOnly && (
            <button onClick={() => setMyOnly(false)} className="px-4 py-2.5 font-bold uppercase transition-all hover:bg-[#a002]" style={{ border: hBorder('#a00060'), color: '#c44', background: '#a00015' }}>
              ☠ ALL ITEMS
            </button>
          )}
        </div>

        {/* FILTERS */}
        <div className="mb-5 p-3 grid gap-2 md:grid-cols-3" style={{ border: hBorder('#80000025'), background: '#80000008' }}>
          {[
            <select key="sort" value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
              <option value="number-asc">▲ NUM ASC</option><option value="number-desc">▼ NUM DESC</option>
              <option value="price-asc">▲ PRICE ASC</option><option value="price-desc">▼ PRICE DESC</option>
              <option value="listed-newest">★ NEWEST</option>
            </select>,
            <select key="filter" value={itemFilter} onChange={(e) => setItemFilter(e.target.value as typeof itemFilter)}>
              <option value="all">☠ ALL ITEMS</option><option value="listed">⚰ LISTED</option>
              <option value="not-listed">○ NOT LISTED</option><option value="owned">☠ MY OWNED</option>
            </select>,
            <input key="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SEARCH THE DARKNESS..." />,
          ].map((el, i) => (
            <div key={i}>
              {React.cloneElement(el as React.ReactElement, {
                className: 'h-mono w-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider outline-none transition-all focus:border-[#a00] focus:shadow-[0_0_12px_#a003]',
                style: { ...(el as React.ReactElement).props.style, border: hBorder('#80000040'), background: '#0a020480', color: '#c44', fontFamily: "'Courier New', monospace" },
              })}
            </div>
          ))}
        </div>

        {/* STATUS */}
        {walletState.connected && loadingOwned && (
          <p className="h-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: '#a008' }}><span style={{ animation: 'hBlink 0.5s steps(1) infinite', marginRight: 4 }}>▶</span>SCANNING THE ABYSS...</p>
        )}
        {walletState.connected && ownershipError && (
          <p className="h-mono mb-2 text-[10px] uppercase" style={{ color: '#f44' }}>✖ {ownershipError}</p>
        )}
        {actionMessage && (
          <div className="h-mono mb-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ border: hBorder('#a0006'), color: '#f44', background: '#a00010', animation: 'hPriceGlow 1.5s ease-in-out infinite' }}>✔ {actionMessage}</div>
        )}
        {actionError && (
          <div className="h-mono mb-3 px-4 py-2 text-[11px] font-bold uppercase" style={{ border: hBorder('#f446'), color: '#f44', background: '#f4408' }}>✖ {actionError}</div>
        )}

        {/* GRID */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {rows.map((row) => {
            const contentUrl = `https://ordinals.com/content/${encodeURIComponent(row.inscriptionId)}`;
            const ownerAddr = ownerByInscription[row.inscriptionId] || (row.isOwnedByConnectedWallet && currentAddress ? currentAddress : row.listing?.seller || '');
            const isListed = !!row.listing;
            const borderColor = isListed ? '#a00060' : row.isOwnedByConnectedWallet ? '#80000080' : '#80000030';

            return (
              <article key={row.inscriptionId} className="h-card" style={{ border: hBorder(borderColor), background: 'linear-gradient(180deg, #120408 0%, #080204 100%)', boxShadow: `0 0 12px #80000015` }}>
                {isListed && (
                  <div className="h-mono absolute top-0 right-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase" style={{ background: '#a00', color: '#fff', boxShadow: '0 0 8px #a004', animation: 'hFlicker 3s ease-in-out infinite' }}>FOR SALE</div>
                )}
                {row.isOwnedByConnectedWallet && !isListed && (
                  <div className="h-mono absolute top-0 left-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase" style={{ background: '#600', color: '#faa', boxShadow: '0 0 8px #60004' }}>OWNED</div>
                )}
                <button onClick={() => setSelectedId(row.inscriptionId)} className="aspect-square w-full overflow-hidden text-left relative" style={{ background: '#050102' }}>
                  <img src={contentUrl} title={row.name} alt={row.name} className="h-full w-full object-contain relative z-[2] transition-all duration-300" loading="lazy" />
                  <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 40px #000000cc, inset 0 0 80px #80000020' }} />
                </button>
                <div className="p-2" style={{ borderTop: hBorder(borderColor) }}>
                  <h3 className="h-mono text-[10px] font-black uppercase tracking-wider truncate" style={{ color: '#c44', textShadow: '0 0 4px #a003' }}>{row.name}</h3>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="h-mono text-[9px] font-bold" style={{ color: '#800000' }}>#{row.inscriptionNumber}</span>
                    <span className="h-mono text-[7px]" style={{ color: '#fff2' }}>{ownerAddr ? shortAddress(ownerAddr) : '---'}</span>
                  </div>
                  {isListed ? (
                    <div className="mt-2 px-2 py-1.5 text-center" style={{ border: hBorder('#a00040'), background: '#a00010' }}>
                      <span className="h-mono text-[10px] font-black" style={{ color: '#f44', animation: 'hPriceGlow 2s ease-in-out infinite' }}>₿ {formatSats(row.listing!.priceSats)} SAT</span>
                    </div>
                  ) : (
                    <div className="h-mono mt-2 px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ border: hBorder('#ffffff08'), color: '#fff15' }}>○ NOT LISTED</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* DETAIL MODAL */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'radial-gradient(circle at 50% 50%, #1a050888 0%, #000e 100%)' }} onClick={() => setSelectedId(null)}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" style={{ border: hBorder('#80000080'), background: 'linear-gradient(180deg, #120408 0%, #0a0204 50%, #080103 100%)', boxShadow: '0 0 60px #80000030, 0 0 120px #ff000010, 0 20px 60px #000a', animation: 'hBorderPulse 4s ease-in-out infinite' }} onClick={(e) => e.stopPropagation()}>
              <BloodCorner position="tl" /><BloodCorner position="tr" /><BloodCorner position="bl" /><BloodCorner position="br" />
              <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: hBorder('#80000040'), background: 'linear-gradient(180deg, #80000015 0%, transparent 100%)' }}>
                <div>
                  <h2 className="h-font text-2xl uppercase tracking-wider" style={{ color: '#cc0000', textShadow: '0 0 12px #a004' }}>{selected.name}</h2>
                  <p className="h-mono text-[10px] font-bold mt-0.5" style={{ color: '#a00', textShadow: '0 0 6px #a003' }}>INSCRIPTION #{selected.inscriptionNumber}</p>
                  <p className="h-mono text-[9px] mt-0.5" style={{ color: '#fff2' }}>{selected.inscriptionId}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="h-mono px-3 py-1.5 text-[10px] font-black uppercase transition-all hover:bg-[#a002]" style={{ border: hBorder('#a00060'), color: '#f44', boxShadow: '0 0 8px #a0002' }}>[X] CLOSE</button>
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                <div className="p-4">
                  <div className="aspect-square overflow-hidden cursor-pointer transition-all hover:shadow-[0_0_30px_#a003] relative" style={{ border: hBorder('#80000050'), background: '#050102' }} onClick={() => setFullscreenImage({ url: `https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`, name: selected.name })}>
                    <img src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`} alt={selected.name} className="h-full w-full object-contain relative z-[2]" />
                    <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 40px #00000080, inset 0 0 80px #80000020' }} />
                  </div>
                  <p className="h-mono mt-2 text-center text-[9px] uppercase tracking-wider" style={{ color: '#fff2' }}><span style={{ animation: 'hBlink 2s steps(1) infinite' }}>▶</span> CLICK TO ENLARGE</p>
                </div>

                <div className="p-4 space-y-3">
                  <div style={{ border: hBorder('#80000040'), background: '#80000008' }}>
                    <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #80000020 0%, #80000008 100%)', borderBottom: hBorder('#80000040') }}>
                      <p className="h-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#c44', textShadow: '0 0 6px #a004' }}>☠ DETAILS</p>
                    </div>
                    <div className="h-mono px-3 py-2 space-y-1.5 text-[10px]">
                      {([
                        ['COLLECTION', 'ORDINAL ODDITIES'],
                        ['ITEM', `#${selected.displayIndex} OF 19`],
                        ['INSCRIPTION', `#${selected.inscriptionNumber}`],
                        ['STATUS', selected.listing ? '⚰ LISTED' : '○ NOT LISTED'],
                        ['OWNER', selectedOwnerAddress ? shortAddress(selectedOwnerAddress) : '---'],
                        ['SELLER', selected.listing?.seller ? shortAddress(selected.listing.seller) : '---'],
                        ['PRICE', selected.listing ? `₿ ${formatSats(selected.listing.priceSats)} SAT` : '---'],
                        ['LISTED', selected.listing ? formatDateTime(selected.listing.listedAt) : '---'],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="flex justify-between font-bold py-0.5" style={{ borderBottom: '1px solid #80000015' }}>
                          <span style={{ color: '#fff3' }}>{label}</span>
                          <span style={{ color: label === 'PRICE' && selected.listing ? '#f44' : label === 'STATUS' && selected.listing ? '#f44' : '#fffc', textShadow: label === 'PRICE' && selected.listing ? '0 0 6px #a004' : 'none' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {selectedDetailLoading && <p className="h-mono px-3 pb-2 text-[9px]" style={{ color: '#a006' }}><span style={{ animation: 'hBlink 0.5s steps(1) infinite' }}>▶</span> LOADING...</p>}
                    {selectedDetailError && <p className="h-mono px-3 pb-2 text-[9px]" style={{ color: '#f44' }}>✖ {selectedDetailError}</p>}
                  </div>

                  <div style={{ border: hBorder('#80000040'), background: '#80000008' }}>
                    <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #80000020 0%, #80000008 100%)', borderBottom: hBorder('#80000040') }}>
                      <p className="h-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#a66', textShadow: '0 0 6px #80000060' }}>⛓ CHAIN DATA</p>
                    </div>
                    <div className="h-mono px-3 py-2 space-y-1 text-[10px]">
                      {(() => {
                        const ord = ordApiData || {} as any;
                        const satNum = ord?.sat != null ? Number(ord.sat) : NaN;
                        const rareSats = Number.isFinite(satNum) ? deriveSatRarity(satNum) : '-';
                        const rareSatTokens = rareSats !== '-' ? rareSats.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                        const gtx = selected.inscriptionId.replace(/i\d+$/, '');
                        const chainRows: [string, React.ReactNode][] = [
                          ['ID', <span key="id">{truncId(selected.inscriptionId)} <button onClick={() => navigator.clipboard.writeText(selected.inscriptionId)} className="transition-colors hover:text-[#f44]" style={{ color: '#a006' }}>COPY</button></span>],
                          ['CONTENT', <a key="c" className="hover:underline" style={{ color: '#c44', textShadow: '0 0 4px #a003' }} target="_blank" rel="noreferrer" href={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}>VIEW ↗</a>],
                          ['TOKEN', 'ORD'],
                          ['INSC #', ord?.number != null ? String(ord.number) : '---'],
                          ['SAT #', Number.isFinite(satNum) ? String(Math.trunc(satNum)) : '---'],
                          ['TYPE', ord?.content_type || '---'],
                          ['GENESIS', gtx ? <a key="g" className="hover:underline" style={{ color: '#c44', textShadow: '0 0 4px #a003' }} target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${gtx}`}>{truncId(gtx)} ↗</a> : '---'],
                        ];
                        if (ord?.value != null) chainRows.push(['VALUE', `${ord.value} SAT`]);
                        if (ord?.height != null) chainRows.push(['BLOCK', <a key="b" className="hover:underline" style={{ color: '#c44' }} target="_blank" rel="noreferrer" href={`https://mempool.space/block/${ord.height}`}>{String(ord.height)} ↗</a>]);
                        if (ord?.fee != null) chainRows.push(['FEE', `${ord.fee.toLocaleString()} SAT`]);
                        if (ord?.timestamp != null) chainRows.push(['TIME', new Date(ord.timestamp * 1000).toLocaleString()]);
                        return (
                          <>
                            {chainRows.map(([label, value]) => (
                              <div key={label as string} className="flex justify-between font-bold py-0.5" style={{ borderBottom: '1px solid #80000015' }}>
                                <span style={{ color: '#fff2' }}>{label}</span>
                                <span className="text-right ml-4 truncate max-w-[60%]" style={{ color: '#fffa' }}>{value}</span>
                              </div>
                            ))}
                            {rareSatTokens.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {rareSatTokens.map((t: string, i: number) => (
                                  <span key={`${t}-${i}`} className="px-2 py-0.5 text-[9px] font-black uppercase" style={{ border: hBorder('#a00060'), color: '#f44', background: '#a00010', boxShadow: '0 0 6px #a00020' }}>
                                    {RARE_SAT_SYMBOLS[t] || '◌'} {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {!ordApiData && <p className="text-[9px] mt-1" style={{ color: '#fff2' }}><span style={{ animation: 'hBlink 0.5s steps(1) infinite' }}>▶</span> LOADING...</p>}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {!walletState.connected && (
                    <div className="h-mono p-4 text-[11px] font-bold uppercase text-center" style={{ border: hBorder('#a00040'), color: '#f44', background: '#a00010', boxShadow: '0 0 16px #a00020' }}>⚡ CONNECT WALLET TO TRADE</div>
                  )}
                  {walletState.connected && (
                    <div style={{ border: hBorder('#80000040'), background: '#80000008' }}>
                      <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #80000020 0%, #80000008 100%)', borderBottom: hBorder('#80000040') }}>
                        <p className="h-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#f44', textShadow: '0 0 6px #a004' }}>₿ TRADE</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {selected.listing ? (
                          <>
                            <p className="h-mono text-sm font-black" style={{ color: '#f44', animation: 'hPriceGlow 2s ease-in-out infinite' }}>₿ {formatSats(selected.listing.priceSats)} SAT</p>
                            <p className="h-mono text-[9px]" style={{ color: '#fff3' }}>SELLER: {shortAddress(selected.listing.seller)}</p>
                            {normalizeAddress(selected.listing.seller) === walletAddrNorm ? (
                              <button disabled={busyListingId === selected.listing.id} onClick={handleDelist} className="h-mono w-full py-2.5 text-[11px] font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:bg-[#a002]" style={{ border: hBorder('#a00060'), color: '#f44', background: '#a00015' }}>✖ DELIST ITEM</button>
                            ) : (
                              <button disabled={busyListingId === selected.listing.id} onClick={handleBuy} className="h-mono w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#a006]" style={{ border: hBorder('#a00'), color: '#fff', background: 'linear-gradient(180deg, #a00 0%, #700 100%)', boxShadow: '0 0 24px #a00040' }}>⚡ BUY NOW</button>
                            )}
                          </>
                        ) : selected.isOwnedByConnectedWallet ? (
                          <>
                            <label className="h-mono text-[10px] font-bold uppercase" style={{ color: '#fff4' }}>LIST PRICE (SATS)</label>
                            <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="h-mono w-full px-3 py-2 text-xs font-bold outline-none transition-all focus:border-[#a00] focus:shadow-[0_0_10px_#a003]" style={{ border: hBorder('#80000050'), background: '#00000040', color: '#f44' }} />
                            <button disabled={busyListingId === selected.inscriptionId} onClick={handleList} className="h-mono w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#80000060]" style={{ border: hBorder('#800000'), color: '#fff', background: 'linear-gradient(180deg, #800000 0%, #500000 100%)', boxShadow: '0 0 24px #80000040' }}>⚰ LIST ITEM</button>
                          </>
                        ) : (
                          <p className="h-mono text-[10px] font-bold uppercase text-center py-3" style={{ color: '#80000080' }}>NOT OWNED BY YOUR WALLET</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FULLSCREEN */}
        {fullscreenImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'radial-gradient(circle, #1a0508cc 0%, #000f 100%)' }} onClick={() => setFullscreenImage(null)}>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <div className="relative" style={{ animation: 'hBorderPulse 4s ease-in-out infinite' }}>
                <img src={fullscreenImage.url} alt={fullscreenImage.name} className="block" style={{ border: hBorder('#80000080'), width: 'min(85vmin, 700px)', height: 'min(85vmin, 700px)', objectFit: 'contain', background: '#050102', boxShadow: '0 0 80px #80000030, 0 0 160px #ff000010' }} />
                <BloodCorner position="tl" /><BloodCorner position="tr" /><BloodCorner position="bl" /><BloodCorner position="br" />
              </div>
              <p className="h-font text-center text-xl uppercase tracking-[0.15em] mt-4" style={{ color: '#cc0000', animation: 'hBloodGlow 3s ease-in-out infinite' }}>{fullscreenImage.name}</p>
              <button onClick={() => setFullscreenImage(null)} className="h-mono absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center text-[11px] font-black transition-all hover:bg-[#a002]" style={{ border: hBorder('#a00060'), background: '#0a0204', color: '#f44', boxShadow: '0 0 10px #a0002' }}>X</button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-16 mb-6 text-center relative">
          <div className="h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #80000040, #a0000040, #80000040, transparent)' }} />
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="w-2 h-2" style={{ background: '#a00', boxShadow: '0 0 6px #a00', animation: 'hBlink 3s steps(1) infinite' }} />
            <p className="h-mono text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#80000060' }}>ORDINAL ODDITIES MARKETPLACE</p>
            <span className="text-[10px]" style={{ color: '#fff10' }}>·</span>
            <p className="h-mono text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#a0003a' }}>POWERED BY RICHART.APP</p>
            <span className="w-2 h-2" style={{ background: '#600', boxShadow: '0 0 6px #600', animation: 'hBlink 3s 1.5s steps(1) infinite' }} />
          </div>
          <div className="mt-3 h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #80000040, #a0000040, #80000040, transparent)' }} />
        </div>
      </div>
    </div>
  );
};
