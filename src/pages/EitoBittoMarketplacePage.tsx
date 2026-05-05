import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { EITO_BITTO_HASHLIST } from '../data/eitoBittoHashlist';
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

const EITO_BITTO_SLUG = 'eitobitto';
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

const PIXEL_CSS = `
@keyframes pxGlow {
  0%, 100% { text-shadow: 0 0 10px #0ff, 0 0 20px #0ff5, 0 0 40px #0ff2; }
  50% { text-shadow: 0 0 16px #0ff, 0 0 32px #0ff7, 0 0 56px #0ff3, 0 0 80px #f0f1; }
}
@keyframes pxTitleGlow {
  0% { text-shadow: 0 0 8px #0ff, 0 0 20px #0ff6, 0 0 40px #0ff3, 0 0 80px #f0f15; filter: brightness(1); }
  33% { text-shadow: 0 0 14px #0ff, 0 0 30px #0ffa, 0 0 60px #0ff5, 0 0 100px #f0f3; filter: brightness(1.15); }
  66% { text-shadow: 0 0 10px #0ef, 0 0 24px #0ff8, 0 0 50px #0ff4, 0 0 90px #f0f2; filter: brightness(1.05); }
  100% { text-shadow: 0 0 8px #0ff, 0 0 20px #0ff6, 0 0 40px #0ff3, 0 0 80px #f0f15; filter: brightness(1); }
}
@keyframes pxBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes pxPriceGlow {
  0%, 100% { text-shadow: 0 0 6px #0f0, 0 0 14px #0f05; }
  50% { text-shadow: 0 0 12px #0f0, 0 0 24px #0f07; }
}
@keyframes pxOwnedGlow {
  0%, 100% { box-shadow: 0 0 12px #ff03, 0 0 24px #ff02; border-color: #ff0a0; }
  50% { box-shadow: 0 0 24px #ff06, 0 0 48px #ff03, 0 0 64px #ff01; border-color: #ff0; }
}
@keyframes pxGlitch {
  0%, 90%, 100% { transform: translate(0); filter: none; }
  92% { transform: translate(-3px, 1px); filter: hue-rotate(90deg); }
  94% { transform: translate(2px, -1px); filter: hue-rotate(-90deg); }
  96% { transform: translate(-1px, 2px); filter: hue-rotate(180deg); }
  98% { transform: translate(3px, 0); filter: none; }
}
@keyframes pxBorderPulse {
  0%, 100% { border-color: #0ff4; box-shadow: 0 0 8px #0ff1, inset 0 0 8px #0ff05; }
  50% { border-color: #0ff8; box-shadow: 0 0 16px #0ff2, inset 0 0 16px #0ff0a, 0 0 32px #f0f08; }
}
@keyframes pxColorCycle {
  0% { color: #0ff; text-shadow: 0 0 10px #0ff5; }
  33% { color: #f0f; text-shadow: 0 0 10px #f0f5; }
  66% { color: #0f0; text-shadow: 0 0 10px #0f05; }
  100% { color: #0ff; text-shadow: 0 0 10px #0ff5; }
}
@keyframes pxStatFlash {
  0%, 100% { background: #0ff08; }
  50% { background: #0ff15; }
}
.px-card {
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  position: relative;
  overflow: hidden;
}
.px-card::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 0%, #0ff05 50%, transparent 100%);
  transform: translateY(-100%);
  transition: transform 0.4s;
  pointer-events: none;
  z-index: 1;
}
.px-card:hover::before { transform: translateY(100%); }
.px-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 0 24px #0ff4, 0 0 48px #f0f15, 0 8px 32px #0008;
  border-color: #0ff !important;
  z-index: 5;
}
`;

function CyberGrid() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouseRef = React.useRef({ x: -1, y: -1 });
  const rafRef = React.useRef(0);
  const timeRef = React.useRef(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = 28;
    const RADIUS = 420;
    let smoothMx = -1;
    let smoothMy = -1;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: -1, y: -1 }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    const draw = (ts: number) => {
      timeRef.current = ts * 0.001;
      const t = timeRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const hasMouse = mx >= 0 && my >= 0;

      if (hasMouse) {
        smoothMx = smoothMx < 0 ? mx : smoothMx + (mx - smoothMx) * 0.08;
        smoothMy = smoothMy < 0 ? my : smoothMy + (my - smoothMy) * 0.08;
      } else { smoothMx = -1; smoothMy = -1; }

      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / CELL) + 1;
      const numRows = Math.ceil(h / CELL) + 1;
      const waveA = Math.sin(t * 0.4) * 6;
      const waveB = Math.cos(t * 0.3) * 5;

      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < cols; col++) {
          const baseX = col * CELL;
          const baseY = row * CELL;
          const offsetX = Math.sin(t * 0.7 + row * 0.2 + col * 0.05) * waveA + Math.sin(t * 0.4 + col * 0.15) * 2;
          const offsetY = Math.cos(t * 0.5 + col * 0.2 + row * 0.05) * waveB + Math.cos(t * 0.35 + row * 0.12) * 2;
          const x = baseX + offsetX;
          const y = baseY + offsetY;

          let proximity = 0;
          if (smoothMx >= 0) {
            const dx = x - smoothMx, dy = y - smoothMy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            proximity = Math.max(0, 1 - dist / RADIUS);
            proximity = proximity * proximity;
          }

          const wave1 = Math.sin(t * 0.6 + col * 0.12 + row * 0.08) * 0.5 + 0.5;
          const wave2 = Math.sin(t * 0.25 + (col - row) * 0.07) * 0.5 + 0.5;
          const wave3 = Math.sin(t * 0.15 + col * 0.04 + row * 0.04) * 0.5 + 0.5;
          const breathe = 0.03 + wave1 * 0.025 + wave2 * 0.02 + wave3 * 0.015;
          const crossAlpha = breathe + proximity * 0.65;
          if (crossAlpha < 0.015) continue;

          const baseHue = 200 + 30 * Math.sin(t * 0.15 + col * 0.03) + 20 * Math.sin(t * 0.1 + row * 0.04) + wave3 * 40;
          const hue = proximity > 0 ? baseHue + proximity * 120 + Math.sin(t * 1.5 + col * 0.2) * 30 : baseHue;
          const sat = 60 + wave2 * 20 + proximity * 30;
          const lum = 45 + wave1 * 15 + proximity * 35;

          ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${crossAlpha})`;
          ctx.lineWidth = 0.8 + proximity * 1.2;
          const arm = 2.5 + wave1 * 1.5 + proximity * 6;
          ctx.beginPath();
          ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
          ctx.stroke();

          if (proximity > 0.05) {
            const dotR = 0.8 + proximity * 3;
            ctx.fillStyle = `hsla(${hue}, 100%, ${65 + proximity * 20}%, ${proximity * 0.9})`;
            ctx.fillRect(x - dotR / 2, y - dotR / 2, dotR, dotR);
          }
          if (proximity > 0.4) {
            ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${(proximity - 0.4) * 0.8})`;
            ctx.shadowBlur = 6 + proximity * 10;
            ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${(proximity - 0.4) * 1.2})`;
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
            ctx.shadowBlur = 0;
          }
        }
      }

      if (hasMouse) {
        ctx.beginPath();
        for (let row = 0; row < numRows; row++) {
          for (let col = 0; col < cols; col++) {
            const bx = col * CELL + Math.sin(t * 0.7 + row * 0.2 + col * 0.05) * waveA;
            const by = row * CELL + Math.cos(t * 0.5 + col * 0.2 + row * 0.05) * waveB;
            const dx = bx - smoothMx, dy = by - smoothMy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < RADIUS * 0.6 && dist > RADIUS * 0.55) {
              const a = 0.06 * (1 - Math.abs(dist - RADIUS * 0.575) / (RADIUS * 0.025));
              ctx.fillStyle = `hsla(300, 100%, 70%, ${a})`;
              ctx.fillRect(bx - 1, by - 1, 2, 2);
            }
          }
        }
        const R = RADIUS * 0.9;
        const grad = ctx.createRadialGradient(smoothMx, smoothMy, 0, smoothMx, smoothMy, R);
        grad.addColorStop(0, 'hsla(300, 100%, 60%, 0.05)');
        grad.addColorStop(0.3, 'hsla(280, 100%, 50%, 0.03)');
        grad.addColorStop(0.6, 'hsla(220, 100%, 50%, 0.015)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(smoothMx - R, smoothMy - R, R * 2, R * 2);
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

function PixelStars() {
  const stars = React.useMemo(() => {
    const s: Array<{ x: number; y: number; size: number; delay: number; color: string }> = [];
    const colors = ['#0ff', '#f0f', '#0f0', '#ff0', '#fff', '#f80'];
    for (let i = 0; i < 80; i++) {
      s.push({ x: Math.random() * 100, y: Math.random() * 100, size: 1 + Math.floor(Math.random() * 4), delay: Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)] });
    }
    return s;
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {stars.map((s, i) => (
        <div key={i} className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, backgroundColor: s.color, opacity: 0.3 + Math.random() * 0.5, animation: `pxBlink ${1.5 + Math.random() * 4}s ${s.delay}s ease-in-out infinite`, boxShadow: s.size > 2 ? `0 0 ${s.size * 2}px ${s.color}40` : 'none' }} />
      ))}
    </div>
  );
}

function ArcadeCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <div className="absolute pointer-events-none" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 60, height: 60 }}>
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 60, height: 2, background: '#0ff', boxShadow: '0 0 8px #0ff6' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 2, height: 60, background: '#0ff', boxShadow: '0 0 8px #0ff6' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 6, [isLeft ? 'left' : 'right']: 6, width: 4, height: 4, background: '#f0f', boxShadow: '0 0 6px #f0f8' }} />
    </div>
  );
}

export const EitoBittoMarketplacePage: React.FC = () => {
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
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [logoW, setLogoW] = React.useState(0);

  React.useEffect(() => {
    const measure = () => { if (titleRef.current) setLogoW(titleRef.current.offsetWidth); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const itemIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    EITO_BITTO_HASHLIST.forEach((item, idx) => map.set(item.inscriptionId, idx + 1));
    return map;
  }, []);

  const currentAddress = getOrdinalAddress(walletState.accounts || []) || String(walletState.accounts?.[0]?.address || '').trim();
  const paymentAddress = getPaymentAddress(walletState.accounts || []) || currentAddress;
  const walletAddrNorm = normalizeAddress(currentAddress);

  // Public-Key Helper — siehe PinkPuppetsMarketplacePage. ordinalsPublicKey
  // ist KRITISCH fuer das Listing: ohne sellerPublicKey faellt das Backend
  // auf einen Fallback zurueck der den getweakten taproot_output_key als
  // tapInternalKey setzt; daraus resultierende Schnorr-Sig wird beim Buy
  // on-chain abgelehnt ("mempool-script-verify-flag-failed").
  const readPubKeyFromAccount = (entry: any): string => {
    if (!entry || typeof entry !== 'object') return '';
    const candidates = [entry.publicKey, entry.publicKeyHex, entry.pubKey, entry.pubkey, entry.public_key, entry.paymentPublicKey, entry.paymentPublicKeyHex, entry.paymentPubkey, entry.ordinalsPublicKey, entry.addressPublicKey, entry.btcPublicKey, entry?.keys?.payment?.publicKey, entry?.keys?.payment?.publicKeyHex, entry?.keys?.ordinals?.publicKey, entry?.account?.publicKey];
    for (const c of candidates) { const v = String(c || '').trim(); if (v) return v; }
    return '';
  };
  const ordinalsPublicKey = React.useMemo(() => {
    const accs = walletState.accounts || [];
    const byPurpose = accs.find((a: any) => String(a?.purpose || '').toLowerCase() === 'ordinals');
    const fromPurpose = readPubKeyFromAccount(byPurpose);
    if (fromPurpose) return fromPurpose;
    const byAddress = accs.find((a: any) => String(a?.address || '').trim() === String(currentAddress || '').trim());
    return readPubKeyFromAccount(byAddress);
  }, [walletState.accounts, currentAddress]);

  const loadMarketplaceListings = React.useCallback(async () => {
    const rows = await getMarketplaceListings({ status: 'active', collectionSlug: EITO_BITTO_SLUG, limit: 400 }).catch(() => []);
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
        const hashlistIdSet = new Set(EITO_BITTO_HASHLIST.map((item) => item.inscriptionId));
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
    let filtered = EITO_BITTO_HASHLIST.filter((item) => {
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
        const prepared = await prepareMarketplaceListingPsbt({ inscriptionId: selected.inscriptionId, collectionSlug: EITO_BITTO_SLUG, sellerAddress: currentAddress, sellerPaymentAddress: paymentAddress || currentAddress, sellerPublicKey: ordinalsPublicKey || undefined, buyerReceiveAddress: currentAddress, priceSats: Math.floor(price) });
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

  // targetListing optional: aus Grid wird die Listing direkt mitgegeben,
  // aus dem Detail-Modal faellt es auf selected?.listing zurueck.
  const handleBuy = (targetListing?: { id: string; seller: string }) => {
    void (async () => {
      const listing = targetListing || selected?.listing || null;
      try {
        if (!listing || !walletAddrNorm) throw new Error('No listing selected');
        if (!walletState.walletType) throw new Error('Connect wallet first');
        if (normalizeAddress(listing.seller) === walletAddrNorm) throw new Error('Cannot buy your own listing');
        setActionError(null); setActionMessage(null); setBusyListingId(listing.id);
        const prepared = await prepareMarketplacePurchaseAdvanced({ listingId: listing.id, buyerAddress: currentAddress, fundingAddress: paymentAddress || currentAddress, fundingAddressCandidates: Array.from(new Set([currentAddress, paymentAddress].filter(Boolean))) });
        const signed = await signPSBT(prepared.fundedPsbtBase64, walletState.walletType, false, currentAddress, undefined, Array.isArray(prepared.funding?.buyerSigningIndexes) ? prepared.funding.buyerSigningIndexes : undefined);
        const isHex = /^[0-9a-fA-F]+$/.test(String(signed || '').trim());
        await completeMarketplacePurchaseAdvanced({ listingId: listing.id, buyerAddress: currentAddress, signedPsbtHex: isHex ? signed : undefined, signedPsbtBase64: isHex ? undefined : signed });
        setActionMessage('PURCHASE COMPLETED'); await loadMarketplaceListings();
      } catch (err: any) {
        const msg = err?.message || 'Buy failed';
        setActionError(msg);
        if (typeof window !== 'undefined' && targetListing) window.alert(`Buy failed: ${msg}`);
      } finally { setBusyListingId(null); }
    })();
  };

  /* ═══════════════ PIXEL-ART UI ═══════════════ */

  const pxBorder = (color: string) => `2px solid ${color}`;
  const pxShadow = (color: string) => `4px 4px 0px ${color}`;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #050510 40%, #020208 100%)', fontFamily: "'Courier New', Courier, monospace" }}>
      <style>{PIXEL_CSS}</style>

      <CyberGrid />
      <PixelStars />

      <div className="absolute pointer-events-none" style={{ top: '10%', left: '5%', width: 400, height: 400, background: 'radial-gradient(circle, #0ff08 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ top: '50%', right: '5%', width: 350, height: 350, background: 'radial-gradient(circle, #f0f06 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '30%', width: 300, height: 300, background: 'radial-gradient(circle, #0f006 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-3 py-6">

        {/* ── HEADER ── */}
        <div className="mb-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#0ff2]" style={{ border: pxBorder('#0ff'), color: '#0ff', background: '#0ff08', boxShadow: `${pxShadow('#0884')}, 0 0 12px #0ff1` }}>
            {'<'} BACK
          </button>
          <a href="https://x.com/eitobittobtc" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs transition-all hover:opacity-80" style={{ color: '#0ff8' }} title="@eitobittobtc on X">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span className="hidden sm:inline">@eitobittobtc</span>
          </a>
        </div>

        {/* ── TITLE SECTION ── */}
        <div className="mb-3 relative">
          <div className="relative py-4 px-6">
            <div className="text-center">
              <div style={{ animation: 'pxGlitch 8s ease-in-out infinite' }} className="flex flex-col items-center">
                <img
                  src="/eito-bitto-logo.png"
                  alt="8ビット"
                  style={{
                    width: logoW > 0 ? logoW : 'auto',
                    imageRendering: 'pixelated',
                    filter: 'drop-shadow(0 0 12px #0ff) drop-shadow(0 0 30px #0ff8) drop-shadow(0 0 60px #f0f4)',
                    animation: 'pxGlow 3s ease-in-out infinite',
                  }}
                />
                <h2 ref={titleRef} className="mt-3 text-3xl md:text-4xl font-black uppercase" style={{ color: '#fff', letterSpacing: '0.35em', animation: 'pxTitleGlow 4s ease-in-out infinite' }}>EITO BITTO</h2>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="h-px flex-1 max-w-[100px]" style={{ background: 'linear-gradient(90deg, transparent, #f0f, transparent)' }} />
                <p className="text-xs md:text-sm uppercase tracking-[0.4em] font-bold" style={{ color: '#f0f', textShadow: '0 0 10px #f0f4' }}>51 PIXEL SUB 100K Collection</p>
                <span className="h-px flex-1 max-w-[100px]" style={{ background: 'linear-gradient(90deg, transparent, #f0f, transparent)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        <div className="mb-6 flex flex-wrap justify-center gap-3 text-[11px] font-bold uppercase tracking-wider">
          {[
            { label: 'ITEMS', value: String(rows.length), color: '#0ff', icon: '▣' },
            { label: 'LISTED', value: String(activeListingsCount), color: '#f0f', icon: '◆' },
            { label: 'FLOOR', value: floor > 0 ? `${formatSats(floor)} SAT` : '---', color: '#0f0', icon: '₿' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5 relative" style={{ border: pxBorder(s.color + '80'), background: `linear-gradient(180deg, ${s.color}10 0%, ${s.color}05 100%)`, color: s.color, boxShadow: `inset 0 0 20px ${s.color}10, 0 0 10px ${s.color}15, ${pxShadow('#0002')}`, animation: 'pxStatFlash 4s ease-in-out infinite', minWidth: 120, textAlign: 'center' }}>
              <span style={{ fontSize: 14, marginRight: 6 }}>{s.icon}</span>{s.label}: <span style={{ fontSize: 13 }}>{s.value}</span>
            </div>
          ))}
          <button onClick={() => setMyOnly((v) => !v)} className="px-4 py-2.5 font-bold uppercase transition-all" style={{ border: pxBorder(myOnly ? '#ff0' : ownedIds.size > 0 ? '#ff0a0' : '#ff04'), background: myOnly ? 'linear-gradient(180deg, #ff01a 0%, #ff00a 100%)' : ownedIds.size > 0 ? 'linear-gradient(180deg, #ff010 0%, #ff008 100%)' : 'transparent', color: myOnly ? '#ff0' : ownedIds.size > 0 ? '#ff0' : '#ff06', textShadow: myOnly ? '0 0 8px #ff06' : ownedIds.size > 0 ? '0 0 6px #ff04' : 'none', animation: ownedIds.size > 0 && !myOnly ? 'pxOwnedGlow 2s ease-in-out infinite' : 'none', boxShadow: myOnly ? `0 0 20px #ff04, ${pxShadow('#ff02')}` : 'none' }}>
            ◈ MY ITEMS {walletState.connected ? `[${ownedIds.size}]` : ''}
          </button>
          {myOnly && (
            <button onClick={() => setMyOnly(false)} className="px-4 py-2.5 font-bold uppercase transition-all hover:bg-[#0ff2]" style={{ border: pxBorder('#0ff'), color: '#0ff', background: 'linear-gradient(180deg, #0ff15 0%, #0ff08 100%)', boxShadow: `0 0 16px #0ff3, ${pxShadow('#0002')}`, textShadow: '0 0 6px #0ff4' }}>
              ▣ ALL ITEMS
            </button>
          )}
        </div>

        {/* ── FILTERS ── */}
        <div className="mb-5 p-3 grid gap-2 md:grid-cols-3" style={{ border: pxBorder('#ffffff08'), background: '#ffffff04' }}>
          {[
            <select key="sort" value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
              <option value="number-asc">▲ NUM ASC</option><option value="number-desc">▼ NUM DESC</option>
              <option value="price-asc">▲ PRICE ASC</option><option value="price-desc">▼ PRICE DESC</option>
              <option value="listed-newest">★ NEWEST</option>
            </select>,
            <select key="filter" value={itemFilter} onChange={(e) => setItemFilter(e.target.value as typeof itemFilter)}>
              <option value="all">▣ ALL ITEMS</option><option value="listed">◆ LISTED</option>
              <option value="not-listed">○ NOT LISTED</option><option value="owned">◈ MY OWNED</option>
            </select>,
            <input key="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="▶ SEARCH..." />,
          ].map((el, i) => (
            <div key={i}>
              {React.cloneElement(el as React.ReactElement, {
                className: 'w-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider outline-none transition-all focus:border-[#0ff] focus:shadow-[0_0_12px_#0ff3]',
                style: { ...(el as React.ReactElement).props.style, border: pxBorder('#0ff3'), background: '#08081080', color: '#0ff', fontFamily: "'Courier New', Courier, monospace" },
              })}
            </div>
          ))}
        </div>

        {/* ── STATUS ── */}
        {walletState.connected && loadingOwned && (
          <p className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: '#0ff8' }}><span style={{ animation: 'pxBlink 0.5s steps(1) infinite', marginRight: 4 }}>▶</span>SCANNING WALLET...</p>
        )}
        {walletState.connected && ownershipError && (
          <p className="mb-2 text-[10px] uppercase" style={{ color: '#f44' }}>✖ ERR: {ownershipError}</p>
        )}
        {actionMessage && (
          <div className="mb-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ border: pxBorder('#0f06'), color: '#0f0', background: '#0f008', animation: 'pxPriceGlow 1.5s ease-in-out infinite' }}>✔ {actionMessage}</div>
        )}
        {actionError && (
          <div className="mb-3 px-4 py-2 text-[11px] font-bold uppercase" style={{ border: pxBorder('#f446'), color: '#f44', background: '#f4408' }}>✖ {actionError}</div>
        )}

        {/* ── GRID ── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {rows.map((row) => {
            const contentUrl = `https://ordinals.com/content/${encodeURIComponent(row.inscriptionId)}`;
            const ownerAddr = ownerByInscription[row.inscriptionId] || (row.isOwnedByConnectedWallet && currentAddress ? currentAddress : row.listing?.seller || '');
            const isListed = !!row.listing;
            const borderColor = isListed ? '#0f0' : row.isOwnedByConnectedWallet ? '#ff0' : '#0ff2';
            const glowColor = isListed ? '#0f0' : row.isOwnedByConnectedWallet ? '#ff0' : '#0ff';

            return (
              <article key={row.inscriptionId} className="px-card" style={{ border: pxBorder(borderColor), background: 'linear-gradient(180deg, #10101c 0%, #0a0a14 100%)', boxShadow: `0 0 12px ${glowColor}08, ${pxShadow('#0002')}` }}>
                {isListed && (
                  <div className="absolute top-0 right-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase" style={{ background: '#0f0', color: '#000', boxShadow: '0 0 8px #0f04' }}>FOR SALE</div>
                )}
                {row.isOwnedByConnectedWallet && !isListed && (
                  <div className="absolute top-0 left-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase" style={{ background: '#ff0', color: '#000', boxShadow: '0 0 8px #ff04' }}>OWNED</div>
                )}
                <button onClick={() => setSelectedId(row.inscriptionId)} className="aspect-square w-full overflow-hidden text-left relative" style={{ background: '#000' }}>
                  <img src={contentUrl} title={row.name} alt={row.name} className="h-full w-full object-contain relative z-[2]" style={{ imageRendering: 'pixelated' }} loading="lazy" />
                  <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 20px #00000080' }} />
                </button>
                <div className="p-2" style={{ borderTop: pxBorder(borderColor) }}>
                  <h3 className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: '#0ff', textShadow: '0 0 4px #0ff3' }}>{row.name}</h3>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] font-bold" style={{ color: '#f0f8' }}>#{row.inscriptionNumber}</span>
                    <span className="text-[7px]" style={{ color: '#fff3' }}>{ownerAddr ? shortAddress(ownerAddr) : '---'}</span>
                  </div>
                  {isListed ? (
                    <>
                      <div className="mt-2 px-2 py-1.5 text-center" style={{ border: pxBorder('#0f06'), background: 'linear-gradient(180deg, #0f00f 0%, #0f008 100%)' }}>
                        <span className="text-[10px] font-black" style={{ color: '#0f0', animation: 'pxPriceGlow 2s ease-in-out infinite' }}>₿ {formatSats(row.listing!.priceSats)} SAT</span>
                      </div>
                      {walletState.connected && walletAddrNorm && normalizeAddress(row.listing!.seller) !== walletAddrNorm && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBuy(row.listing!); }}
                          disabled={busyListingId === row.listing!.id}
                          className="mt-1.5 w-full py-1.5 text-[10px] font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_18px_#0f06]"
                          style={{ border: pxBorder('#0f0'), color: '#000', background: 'linear-gradient(180deg, #0f0 0%, #0c0 100%)', boxShadow: '0 0 12px #0f04' }}
                        >
                          {busyListingId === row.listing!.id ? '…' : '⚡ BUY NOW'}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="mt-2 px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ border: pxBorder('#fff08'), color: '#fff15' }}>○ NOT LISTED</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* ════════════════ DETAIL MODAL ════════════════ */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'radial-gradient(circle at 50% 50%, #0008 0%, #000d 100%)' }} onClick={() => setSelectedId(null)}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" style={{ border: pxBorder('#0ff'), background: 'linear-gradient(180deg, #0c0c1c 0%, #08081a 50%, #0a0a14 100%)', boxShadow: '0 0 60px #0ff15, 0 0 120px #f0f0a, 0 20px 60px #0008', animation: 'pxBorderPulse 4s ease-in-out infinite' }} onClick={(e) => e.stopPropagation()}>
              <ArcadeCorner position="tl" /><ArcadeCorner position="tr" /><ArcadeCorner position="bl" /><ArcadeCorner position="br" />
              <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: pxBorder('#0ff3'), background: 'linear-gradient(180deg, #0ff08 0%, transparent 100%)' }}>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider" style={{ color: '#0ff', textShadow: '0 0 12px #0ff4' }}>{selected.name}</h2>
                  <p className="text-[10px] font-bold mt-0.5" style={{ color: '#f0f', textShadow: '0 0 6px #f0f3' }}>INSCRIPTION #{selected.inscriptionNumber}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#fff3' }}>{selected.inscriptionId}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="px-3 py-1.5 text-[10px] font-black uppercase transition-all hover:bg-[#f442]" style={{ border: pxBorder('#f44'), color: '#f44', boxShadow: '0 0 8px #f4420' }}>[X] CLOSE</button>
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                <div className="p-4">
                  <div className="aspect-square overflow-hidden cursor-pointer transition-all hover:shadow-[0_0_30px_#0ff3] relative" style={{ border: pxBorder('#0ff4'), background: '#000' }} onClick={() => setFullscreenImage({ url: `https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`, name: selected.name })}>
                    <img src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`} alt={selected.name} className="h-full w-full object-contain relative z-[2]" style={{ imageRendering: 'pixelated' }} />
                    <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 30px #00000060' }} />
                  </div>
                  <p className="mt-2 text-center text-[9px] uppercase tracking-wider" style={{ color: '#fff3' }}><span style={{ animation: 'pxBlink 2s steps(1) infinite' }}>▶</span> CLICK TO ENLARGE</p>
                </div>

                <div className="p-4 space-y-3">
                  <div style={{ border: pxBorder('#0ff3'), background: '#0ff05' }}>
                    <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #0ff15 0%, #0ff08 100%)', borderBottom: pxBorder('#0ff3') }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#0ff', textShadow: '0 0 6px #0ff4' }}>▣ DETAILS</p>
                    </div>
                    <div className="px-3 py-2 space-y-1.5 text-[10px]">
                      {([
                        ['COLLECTION', 'EITO BITTO'],
                        ['ITEM', `#${selected.displayIndex} OF 51`],
                        ['INSCRIPTION', `#${selected.inscriptionNumber}`],
                        ['STATUS', selected.listing ? '◆ LISTED' : '○ NOT LISTED'],
                        ['OWNER', selectedOwnerAddress ? shortAddress(selectedOwnerAddress) : '---'],
                        ['SELLER', selected.listing?.seller ? shortAddress(selected.listing.seller) : '---'],
                        ['PRICE', selected.listing ? `₿ ${formatSats(selected.listing.priceSats)} SAT` : '---'],
                        ['LISTED', selected.listing ? formatDateTime(selected.listing.listedAt) : '---'],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="flex justify-between font-bold py-0.5" style={{ borderBottom: '1px solid #ffffff08' }}>
                          <span style={{ color: '#fff4' }}>{label}</span>
                          <span style={{ color: label === 'PRICE' && selected.listing ? '#0f0' : label === 'STATUS' && selected.listing ? '#0f0' : '#fffc', textShadow: label === 'PRICE' && selected.listing ? '0 0 6px #0f04' : 'none' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {selectedDetailLoading && <p className="px-3 pb-2 text-[9px]" style={{ color: '#0ff6' }}><span style={{ animation: 'pxBlink 0.5s steps(1) infinite' }}>▶</span> LOADING...</p>}
                    {selectedDetailError && <p className="px-3 pb-2 text-[9px]" style={{ color: '#f44' }}>✖ {selectedDetailError}</p>}
                  </div>

                  <div style={{ border: pxBorder('#f0f3'), background: '#f0f05' }}>
                    <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #f0f15 0%, #f0f08 100%)', borderBottom: pxBorder('#f0f3') }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f0f', textShadow: '0 0 6px #f0f4' }}>◈ CHAIN DATA</p>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-[10px]">
                      {(() => {
                        const ord = ordApiData || {} as any;
                        const satNum = ord?.sat != null ? Number(ord.sat) : NaN;
                        const rareSats = Number.isFinite(satNum) ? deriveSatRarity(satNum) : '-';
                        const rareSatTokens = rareSats !== '-' ? rareSats.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                        const gtx = selected.inscriptionId.replace(/i\d+$/, '');
                        const chainRows: [string, React.ReactNode][] = [
                          ['ID', <span key="id">{truncId(selected.inscriptionId)} <button onClick={() => navigator.clipboard.writeText(selected.inscriptionId)} className="transition-colors hover:text-[#0ff]" style={{ color: '#0ff6' }}>COPY</button></span>],
                          ['CONTENT', <a key="c" className="hover:underline" style={{ color: '#0ff', textShadow: '0 0 4px #0ff3' }} target="_blank" rel="noreferrer" href={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}>VIEW ↗</a>],
                          ['TOKEN', 'ORD'],
                          ['INSC #', ord?.number != null ? String(ord.number) : '---'],
                          ['SAT #', Number.isFinite(satNum) ? String(Math.trunc(satNum)) : '---'],
                          ['TYPE', ord?.content_type || '---'],
                          ['GENESIS', gtx ? <a key="g" className="hover:underline" style={{ color: '#0ff', textShadow: '0 0 4px #0ff3' }} target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${gtx}`}>{truncId(gtx)} ↗</a> : '---'],
                        ];
                        if (ord?.value != null) chainRows.push(['VALUE', `${ord.value} SAT`]);
                        if (ord?.height != null) chainRows.push(['BLOCK', <a key="b" className="hover:underline" style={{ color: '#0ff', textShadow: '0 0 4px #0ff3' }} target="_blank" rel="noreferrer" href={`https://mempool.space/block/${ord.height}`}>{String(ord.height)} ↗</a>]);
                        if (ord?.fee != null) chainRows.push(['FEE', `${ord.fee.toLocaleString()} SAT`]);
                        if (ord?.timestamp != null) chainRows.push(['TIME', new Date(ord.timestamp * 1000).toLocaleString()]);
                        return (
                          <>
                            {chainRows.map(([label, value]) => (
                              <div key={label as string} className="flex justify-between font-bold py-0.5" style={{ borderBottom: '1px solid #ffffff08' }}>
                                <span style={{ color: '#fff3' }}>{label}</span>
                                <span className="text-right ml-4 truncate max-w-[60%]" style={{ color: '#fffa' }}>{value}</span>
                              </div>
                            ))}
                            {rareSatTokens.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {rareSatTokens.map((t: string, i: number) => (
                                  <span key={`${t}-${i}`} className="px-2 py-0.5 text-[9px] font-black uppercase" style={{ border: pxBorder('#ff08'), color: '#ff0', background: '#ff00a', boxShadow: '0 0 6px #ff002' }}>
                                    {RARE_SAT_SYMBOLS[t] || '◌'} {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {!ordApiData && <p className="text-[9px] mt-1" style={{ color: '#fff2' }}><span style={{ animation: 'pxBlink 0.5s steps(1) infinite' }}>▶</span> LOADING CHAIN DATA...</p>}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {!walletState.connected && (
                    <div className="p-4 text-[11px] font-bold uppercase text-center" style={{ border: pxBorder('#ff04'), color: '#ff0', background: 'linear-gradient(180deg, #ff008 0%, #ff004 100%)', boxShadow: '0 0 16px #ff008' }}>⚡ CONNECT WALLET TO TRADE</div>
                  )}
                  {walletState.connected && (
                    <div style={{ border: pxBorder('#0f04'), background: '#0f005' }}>
                      <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #0f015 0%, #0f008 100%)', borderBottom: pxBorder('#0f04') }}>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#0f0', textShadow: '0 0 6px #0f04' }}>₿ TRADE</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {selected.listing ? (
                          <>
                            <p className="text-sm font-black" style={{ color: '#0f0', animation: 'pxPriceGlow 2s ease-in-out infinite' }}>₿ {formatSats(selected.listing.priceSats)} SAT</p>
                            <p className="text-[9px]" style={{ color: '#fff4' }}>SELLER: {shortAddress(selected.listing.seller)}</p>
                            {normalizeAddress(selected.listing.seller) === walletAddrNorm ? (
                              <button disabled={busyListingId === selected.listing.id} onClick={handleDelist} className="w-full py-2.5 text-[11px] font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:bg-[#f442]" style={{ border: pxBorder('#f44'), color: '#f44', background: '#f4410', boxShadow: `0 0 12px #f4408, ${pxShadow('#f442')}` }}>✖ DELIST ITEM</button>
                            ) : (
                              <button disabled={busyListingId === selected.listing.id} onClick={handleBuy} className="w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#0f06]" style={{ border: pxBorder('#0f0'), color: '#000', background: 'linear-gradient(180deg, #0f0 0%, #0c0 100%)', boxShadow: `0 0 24px #0f04, ${pxShadow('#0002')}` }}>⚡ BUY NOW</button>
                            )}
                          </>
                        ) : selected.isOwnedByConnectedWallet ? (
                          <>
                            <label className="text-[10px] font-bold uppercase" style={{ color: '#fff6' }}>LIST PRICE (SATS)</label>
                            <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full px-3 py-2 text-xs font-bold outline-none transition-all focus:border-[#0ff] focus:shadow-[0_0_10px_#0ff3]" style={{ border: pxBorder('#0ff4'), background: '#00000040', color: '#0ff', fontFamily: "'Courier New', Courier, monospace" }} />
                            <button disabled={busyListingId === selected.inscriptionId} onClick={handleList} className="w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#f0f6]" style={{ border: pxBorder('#f0f'), color: '#000', background: 'linear-gradient(180deg, #f0f 0%, #c0c 100%)', boxShadow: `0 0 24px #f0f4, ${pxShadow('#0002')}` }}>◆ LIST ITEM</button>
                          </>
                        ) : (
                          <p className="text-[10px] font-bold uppercase text-center py-3" style={{ color: '#ff06' }}>NOT OWNED BY YOUR WALLET</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ FULLSCREEN ════════════════ */}
        {fullscreenImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'radial-gradient(circle, #000c 0%, #000f 100%)' }} onClick={() => setFullscreenImage(null)}>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <div className="relative" style={{ animation: 'pxBorderPulse 4s ease-in-out infinite' }}>
                <img src={fullscreenImage.url} alt={fullscreenImage.name} className="block" style={{ imageRendering: 'pixelated', border: pxBorder('#0ff'), width: 'min(85vmin, 700px)', height: 'min(85vmin, 700px)', objectFit: 'contain', background: '#000', boxShadow: '0 0 80px #0ff15, 0 0 160px #f0f08' }} />
                <ArcadeCorner position="tl" /><ArcadeCorner position="tr" /><ArcadeCorner position="bl" /><ArcadeCorner position="br" />
              </div>
              <p className="text-center text-lg font-black uppercase tracking-[0.2em] mt-4" style={{ color: '#0ff', animation: 'pxGlow 3s ease-in-out infinite' }}>{fullscreenImage.name}</p>
              <button onClick={() => setFullscreenImage(null)} className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center text-[11px] font-black transition-all hover:bg-[#f442]" style={{ border: pxBorder('#f44'), background: '#0a0a14', color: '#f44', boxShadow: '0 0 10px #f4420' }}>X</button>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="mt-16 mb-6 text-center relative">
          <div className="h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #0ff3, #f0f3, #0f03, #f0f3, #0ff3, transparent)' }} />
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="w-2 h-2" style={{ background: '#0ff', boxShadow: '0 0 4px #0ff', animation: 'pxBlink 3s steps(1) infinite' }} />
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#fff2' }}>EITO BITTO MARKETPLACE</p>
            <span className="text-[10px]" style={{ color: '#fff15' }}>·</span>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#0ff15' }}>POWERED BY RICHART.APP</p>
            <span className="w-2 h-2" style={{ background: '#f0f', boxShadow: '0 0 4px #f0f', animation: 'pxBlink 3s 1.5s steps(1) infinite' }} />
          </div>
          <div className="mt-3 h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #0ff3, #f0f3, #0f03, #f0f3, #0ff3, transparent)' }} />
        </div>
      </div>
    </div>
  );
};
