import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { PINK_PUPPETS_HASHLIST } from '../data/pinkPuppetsHashlist';
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

type PuppetListing = {
  id: string;
  inscriptionId: string;
  seller: string;
  priceSats: number;
  listedAt: number;
  signedPsbtBase64?: string;
};
type ListingsMap = Record<string, PuppetListing>;
type ScoreBreakdown = {
  traitComponent: number;
  comboComponent: number;
  complexityComponent: number;
  eraComponent: number;
  total: number;
  percentile: number;
};
const PINK_PUPPETS_SLUG = 'pinkpuppets';
const ORD_SERVER_URL = String(import.meta.env.VITE_ORD_SERVER_URL || '').replace(/\/+$/, '');
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
const formatBtc = (sats: number) => {
  const btc = Math.max(0, Math.floor(sats || 0)) / SATS_PER_BTC;
  const str = btc.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 });
  return `${str} BTC`;
};
const shortAddress = (value: string) => (value.length > 14 ? `${value.slice(0, 7)}...${value.slice(-5)}` : value || '-');
const formatDateTime = (value?: number) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const normalizeAddress = (addr: string) => String(addr || '').trim().toLowerCase();
const toUnitRange = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return 0.5;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

const buildPinkPuppetScoreModel = () => {
  const totalItems = Math.max(1, PINK_PUPPETS_HASHLIST.length);
  const traitFreq = new Map<string, number>();
  const comboFreq = new Map<string, number>();
  const maxAttrCount = Math.max(1, ...PINK_PUPPETS_HASHLIST.map((item) => item.attributes.length || 0));

  for (const item of PINK_PUPPETS_HASHLIST) {
    for (const attr of item.attributes) {
      const key = `${attr.trait_type}::${attr.value}`;
      traitFreq.set(key, (traitFreq.get(key) || 0) + 1);
    }
    const comboKey = item.attributes
      .map((attr) => `${attr.trait_type}::${attr.value}`)
      .sort()
      .join('|');
    comboFreq.set(comboKey, (comboFreq.get(comboKey) || 0) + 1);
  }

  const rawById = new Map<string, { trait: number; combo: number; complexity: number; era: number }>();
  for (let i = 0; i < PINK_PUPPETS_HASHLIST.length; i += 1) {
    const item = PINK_PUPPETS_HASHLIST[i];
    let traitRaw = 0;
    for (const attr of item.attributes) {
      const key = `${attr.trait_type}::${attr.value}`;
      const f = Math.max(1, Number(traitFreq.get(key) || 1));
      const ratio = Math.max(1 / totalItems, Math.min(1, f / totalItems));
      traitRaw += -Math.log(ratio);
    }
    const comboKey = item.attributes
      .map((attr) => `${attr.trait_type}::${attr.value}`)
      .sort()
      .join('|');
    const comboCount = Math.max(1, Number(comboFreq.get(comboKey) || 1));
    const comboRatio = Math.max(1 / totalItems, Math.min(1, comboCount / totalItems));
    const comboRaw = -Math.log(comboRatio);
    const complexityRaw = (item.attributes.length || 0) / maxAttrCount;
    const eraRaw = PINK_PUPPETS_HASHLIST.length <= 1 ? 0.5 : 1 - i / (PINK_PUPPETS_HASHLIST.length - 1);
    rawById.set(item.inscriptionId, {
      trait: traitRaw,
      combo: comboRaw,
      complexity: complexityRaw,
      era: eraRaw,
    });
  }

  const traitVals = Array.from(rawById.values()).map((v) => v.trait);
  const comboVals = Array.from(rawById.values()).map((v) => v.combo);
  const complexityVals = Array.from(rawById.values()).map((v) => v.complexity);
  const traitMin = Math.min(...traitVals);
  const traitMax = Math.max(...traitVals);
  const comboMin = Math.min(...comboVals);
  const comboMax = Math.max(...comboVals);
  const complexityMin = Math.min(...complexityVals);
  const complexityMax = Math.max(...complexityVals);

  const techScoreById = new Map<string, number>();
  const percentileById = new Map<string, number>();
  const breakdownById = new Map<string, ScoreBreakdown>();

  for (const item of PINK_PUPPETS_HASHLIST) {
    const raw = rawById.get(item.inscriptionId) || { trait: 0, combo: 0, complexity: 0.5, era: 0.5 };
    const traitNorm = toUnitRange(raw.trait, traitMin, traitMax);
    const comboNorm = toUnitRange(raw.combo, comboMin, comboMax);
    const complexityNorm = toUnitRange(raw.complexity, complexityMin, complexityMax);
    const eraNorm = Math.max(0, Math.min(1, raw.era));

    // PinkPuppets: improved model without recursion dependency (collection-focused).
    const traitComponent = 55 * traitNorm;
    const comboComponent = 20 * comboNorm;
    const complexityComponent = 15 * complexityNorm;
    const eraComponent = 10 * eraNorm;
    const total = Number((traitComponent + comboComponent + complexityComponent + eraComponent).toFixed(2));
    techScoreById.set(item.inscriptionId, total);
    breakdownById.set(item.inscriptionId, {
      traitComponent: Number(traitComponent.toFixed(2)),
      comboComponent: Number(comboComponent.toFixed(2)),
      complexityComponent: Number(complexityComponent.toFixed(2)),
      eraComponent: Number(eraComponent.toFixed(2)),
      total,
      percentile: 0,
    });
  }

  const sorted = Array.from(techScoreById.entries()).sort((a, b) => b[1] - a[1]);
  const firstRankByScore = new Map<number, number>();
  sorted.forEach(([_, score], idx) => {
    if (!firstRankByScore.has(score)) firstRankByScore.set(score, idx);
  });
  for (const [id, score] of techScoreById.entries()) {
    const rank = Number(firstRankByScore.get(score) || 0);
    const percentile = sorted.length <= 1 ? 100 : Number(((1 - rank / (sorted.length - 1)) * 100).toFixed(2));
    percentileById.set(id, percentile);
    const breakdown = breakdownById.get(id);
    if (breakdown) {
      breakdown.percentile = percentile;
      breakdownById.set(id, breakdown);
    }
  }

  return { techScoreById, percentileById, breakdownById };
};

const FLOATING_PUPPETS = [
  'dj.png','pimp.png','pinkranger.png','boxlogo.png','billionaire.png',
  'checkmate.png','tigerstyle.png','runwaypup.png','pinkjourney.png',
  'puppetsindustries.png','mecha.png','kapital.png','kawsbunny.png',
  'jelly.png','holographic.png','ether.png','dog2.png','dog.png','genesis.png',
];

type Puppet = {
  src: string; x: number; y: number; size: number; baseSize: number;
  vx: number; vy: number; rot: number; vr: number;
  depth: number; breathPhase: number; breathSpeed: number;
  scrollFactor: number;
};

function initPuppets(count: number, w: number, h: number): Puppet[] {
  const shuffled = [...FLOATING_PUPPETS].sort(() => Math.random() - 0.5);
  const puppets: Puppet[] = [];
  for (let i = 0; i < count; i++) {
    const depth = 0.3 + Math.random() * 0.7;
    const baseSize = (80 + Math.random() * 100) * (0.6 + depth * 0.6);
    let x: number, y: number, tries = 0, overlaps: boolean;
    do {
      x = Math.random() * (w - baseSize);
      y = Math.random() * (h - baseSize);
      overlaps = puppets.some(p => {
        const dx = (x + baseSize / 2) - (p.x + p.baseSize / 2);
        const dy = (y + baseSize / 2) - (p.y + p.baseSize / 2);
        const minDist = (baseSize + p.baseSize) / 2;
        return dx * dx + dy * dy < minDist * minDist;
      });
      tries++;
    } while (overlaps && tries < 80);
    const speed = (0.06 + Math.random() * 0.1) * (0.5 + depth * 0.7);
    const angle = Math.random() * Math.PI * 2;
    puppets.push({
      src: `/images/pinkpuppets/${shuffled[i % shuffled.length]}`,
      x, y, size: baseSize, baseSize, depth,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: 0,
      vr: (0.01 + Math.random() * 0.02) * (Math.random() < 0.5 ? 1 : -1),
      breathPhase: Math.random() * Math.PI * 2,
      breathSpeed: 0.001 + Math.random() * 0.001,
      scrollFactor: 0.15 + depth * 0.35,
    });
  }
  puppets.sort((a, b) => a.depth - b.depth);
  return puppets;
}

const MOUSE_RADIUS = 180;
const MOUSE_PUSH = 0.08;

function FloatingPuppetsLayer() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const puppetsRef = React.useRef<Puppet[]>([]);
  const [positions, setPositions] = React.useState<Puppet[]>([]);
  const rafRef = React.useRef<number>(0);
  const mouseRef = React.useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const scrollRef = React.useRef(0);

  React.useEffect(() => {
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const onLeave = () => { mouseRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w < 100 || h < 100) return;
    puppetsRef.current = initPuppets(30, w, h);
    setPositions([...puppetsRef.current]);

    let lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      const ps = puppetsRef.current;
      const bw = el.clientWidth;
      const bh = el.clientHeight;
      const mouse = mouseRef.current;

      for (let i = 0; i < ps.length; i++) {
        ps[i].x += ps[i].vx * dt;
        ps[i].y += ps[i].vy * dt;
        ps[i].rot += ps[i].vr * dt;
        if (ps[i].rot > 15) { ps[i].rot = 15; ps[i].vr = -Math.abs(ps[i].vr); }
        if (ps[i].rot < -15) { ps[i].rot = -15; ps[i].vr = Math.abs(ps[i].vr); }

        ps[i].breathPhase += ps[i].breathSpeed * dt;
        ps[i].size = ps[i].baseSize * (1 + Math.sin(ps[i].breathPhase) * 0.03);

        if (mouse.active) {
          const cx = ps[i].x + ps[i].size / 2;
          const cy = ps[i].y + ps[i].size / 2;
          const mdx = cx - mouse.x;
          const mdy = cy - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < MOUSE_RADIUS && mDist > 1) {
            const force = (1 - mDist / MOUSE_RADIUS) * MOUSE_PUSH;
            ps[i].vx += (mdx / mDist) * force;
            ps[i].vy += (mdy / mDist) * force;
          }
        }

        const r = ps[i].size / 2;
        if (ps[i].x < -r * 0.3) { ps[i].x = -r * 0.3; ps[i].vx = Math.abs(ps[i].vx); }
        if (ps[i].x + ps[i].size > bw + r * 0.3) { ps[i].x = bw + r * 0.3 - ps[i].size; ps[i].vx = -Math.abs(ps[i].vx); }
        if (ps[i].y < -r * 0.3) { ps[i].y = -r * 0.3; ps[i].vy = Math.abs(ps[i].vy); }
        if (ps[i].y + ps[i].size > bh + r * 0.3) { ps[i].y = bh + r * 0.3 - ps[i].size; ps[i].vy = -Math.abs(ps[i].vy); }

        const maxSpeed = 0.2;
        const spd = Math.sqrt(ps[i].vx * ps[i].vx + ps[i].vy * ps[i].vy);
        if (spd > maxSpeed) {
          ps[i].vx = (ps[i].vx / spd) * maxSpeed;
          ps[i].vy = (ps[i].vy / spd) * maxSpeed;
        }
      }

      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const ax = ps[i].x + ps[i].size / 2, ay = ps[i].y + ps[i].size / 2;
          const bx = ps[j].x + ps[j].size / 2, by = ps[j].y + ps[j].size / 2;
          const dx = bx - ax, dy = by - ay;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (ps[i].size + ps[j].size) / 2;
          if (dist < minDist && dist > 0.01) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = (minDist - dist) / 2;
            ps[i].x -= nx * overlap * 0.3;
            ps[i].y -= ny * overlap * 0.3;
            ps[j].x += nx * overlap * 0.3;
            ps[j].y += ny * overlap * 0.3;
            const push = 0.02;
            ps[i].vx -= nx * push;
            ps[i].vy -= ny * push;
            ps[j].vx += nx * push;
            ps[j].vy += ny * push;
          }
        }
      }

      setPositions(ps.map(p => ({ ...p })));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const scroll = scrollRef.current;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {positions.map((p, i) => {
          const opacity = 0.45 + p.depth * 0.4;
          const yOffset = -scroll * p.scrollFactor;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: p.x,
                top: p.y + yOffset,
                width: p.size,
                opacity,
                transform: `rotate(${p.rot.toFixed(1)}deg)`,
                filter: `drop-shadow(0 4px ${6 + p.depth * 10}px rgba(219,39,119,${0.15 + p.depth * 0.15}))`,
                willChange: 'transform',
              }}
            >
              <img
                src={p.src}
                alt=""
                className="w-full h-auto"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                }}
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PinkPuppetsMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [listings, setListings] = React.useState<ListingsMap>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [listPrice, setListPrice] = React.useState('10000');
  const [search, setSearch] = React.useState('');
  const [sortMode, setSortMode] = React.useState<'price-asc' | 'price-desc' | 'rarity-desc' | 'rarity-asc' | 'listed-newest'>('price-asc');
  const [rarityFilter, setRarityFilter] = React.useState<'all' | 'top10' | 'top25' | 'top50'>('all');
  const [itemFilter, setItemFilter] = React.useState<'all' | 'listed' | 'not-listed' | 'owned'>('all');
  const [traitFilter, setTraitFilter] = React.useState('');
  const [myOnly, setMyOnly] = React.useState(false);
  const [showRarityInfo, setShowRarityInfo] = React.useState(false);
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
  const scoreModel = React.useMemo(() => buildPinkPuppetScoreModel(), []);
  const itemIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    PINK_PUPPETS_HASHLIST.forEach((item, idx) => map.set(item.inscriptionId, idx + 1));
    return map;
  }, []);

  const currentAddress = getOrdinalAddress(walletState.accounts || []) || String(walletState.accounts?.[0]?.address || '').trim();
  const paymentAddress = getPaymentAddress(walletState.accounts || []) || currentAddress;
  const walletAddrNorm = normalizeAddress(currentAddress);

  // Public-Key fuer die Funding-/Payment-Adresse aus walletState extrahieren —
  // das ist fuer UniSat (P2WPKH bc1q) zwingend, damit das Backend den PSBT
  // mit korrekten witnessUtxo-Feldern bauen kann.
  const readPubKeyFromAccount = (entry: any): string => {
    if (!entry) return '';
    const candidates = [
      entry.publicKey,
      entry.public_key,
      entry.publicKeyHex,
      entry.publicKey?.hex,
      entry.pubkey,
      entry.pubKey,
      entry.paymentPublicKey,
      entry.paymentPublicKeyHex,
    ];
    for (const c of candidates) {
      const v = String(c || '').trim();
      if (v) return v;
    }
    return '';
  };
  const paymentPublicKey = React.useMemo(() => {
    const rows = walletState.accounts || [];
    const byPurpose = rows.find((acc: any) => String(acc?.purpose || '').toLowerCase() === 'payment');
    const fromPurpose = readPubKeyFromAccount(byPurpose);
    if (fromPurpose) return fromPurpose;
    const byAddress = rows.find((acc: any) => String(acc?.address || '').trim() === String(paymentAddress || '').trim());
    return readPubKeyFromAccount(byAddress);
  }, [walletState.accounts, paymentAddress]);

  const loadMarketplaceListings = React.useCallback(async () => {
    const rows = await getMarketplaceListings({
      status: 'active',
      collectionSlug: PINK_PUPPETS_SLUG,
      limit: 400,
    }).catch(() => []);
    const next: ListingsMap = {};
    const ownerSeed: Record<string, string> = {};
    for (const row of rows) {
      const inscriptionId = String(row?.inscription_id || '').trim();
      if (!inscriptionId) continue;
      const seller = String(row?.seller_address || '').trim();
      next[inscriptionId] = {
        id: String(row?.id || `${inscriptionId}-listing`),
        inscriptionId,
        seller,
        priceSats: Math.max(0, Number(row?.price_sats || 0)),
        listedAt: new Date(String(row?.created_at || '')).getTime() || Date.now(),
        signedPsbtBase64: String(row?.signed_psbt_base64 || '').trim() || undefined,
      };
      if (seller) ownerSeed[inscriptionId] = seller;
    }
    setListings(next);
    if (Object.keys(ownerSeed).length) {
      setOwnerByInscription((prev) => {
        let merged = prev;
        for (const [id, addr] of Object.entries(ownerSeed)) {
          if (merged[id]) continue;
          if (merged === prev) merged = { ...prev };
          merged[id] = addr;
        }
        return merged;
      });
    }
  }, []);

  React.useEffect(() => {
    void loadMarketplaceListings();
  }, [loadMarketplaceListings]);

  const resolveOwnerAddress = React.useCallback(async (inscriptionId: string): Promise<string> => {
    const cacheKey = `pp_owner:${inscriptionId}`;
    const TTL_MS = 10 * 60 * 1000;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { addr: string; t: number };
        if (parsed?.addr && Date.now() - Number(parsed.t || 0) < TTL_MS) {
          return parsed.addr;
        }
      }
    } catch {}
    const detail = await getMarketplaceInscriptionDetail(inscriptionId);
    const ownerFromMarketplace = String(detail?.marketplaceInscription?.owner_address || '').trim();
    const ownerFromChain = String(
      detail?.chainInfo?.ownerAddress || detail?.chainInfo?.owner_address || detail?.chainInfo?.address || ''
    ).trim();
    const owner = ownerFromMarketplace || ownerFromChain;
    if (owner) {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(cacheKey, JSON.stringify({ addr: owner, t: Date.now() }));
        }
      } catch {}
    }
    return owner;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!walletState.connected || !Array.isArray(walletState.accounts) || walletState.accounts.length === 0) {
        setOwnedIds(new Set());
        setLoadingOwned(false);
        setOwnershipError(null);
        return;
      }
      setLoadingOwned(true);
      setOwnershipError(null);
      try {
        const allWalletIds = await getWalletInscriptionIds(walletState.walletType);
        const hashlistIdSet = new Set(PINK_PUPPETS_HASHLIST.map((item) => item.inscriptionId));
        const nextOwned = new Set<string>();
        for (const id of allWalletIds) {
          if (hashlistIdSet.has(id)) nextOwned.add(id);
        }
        if (!cancelled) {
          setOwnedIds(nextOwned);
          if (currentAddress && nextOwned.size) {
            setOwnerByInscription((prev) => {
              let merged = prev;
              for (const id of nextOwned) {
                if (merged[id]) continue;
                if (merged === prev) merged = { ...prev };
                merged[id] = currentAddress;
              }
              return merged;
            });
          }
        }
      } catch (err: any) {
        if (!cancelled) setOwnershipError(err?.message || 'Could not load wallet puppets');
      } finally {
        if (!cancelled) setLoadingOwned(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [walletState.connected, walletState.accounts, walletState.walletType]);

  const ordApiCacheRef = React.useRef<Record<string, Record<string, any>>>({});
  React.useEffect(() => {
    if (!selectedId) { setOrdApiData(null); return; }
    let cancelled = false;

    const cachedOrd = ordApiCacheRef.current[selectedId];
    if (cachedOrd) setOrdApiData(cachedOrd);
    else setOrdApiData(null);

    const ownerAlready = ownerByInscription[selectedId];

    const run = async () => {
      if (!ownerAlready) {
        setSelectedDetailLoading(true);
        setSelectedDetailError(null);
        try {
          const resolvedOwner = await resolveOwnerAddress(selectedId);
          if (!cancelled && resolvedOwner) setOwnerByInscription((prev) => ({ ...prev, [selectedId]: resolvedOwner }));
        } catch (err: any) {
          if (!cancelled) setSelectedDetailError(err?.message || 'Could not load inscription owner');
        } finally {
          if (!cancelled) setSelectedDetailLoading(false);
        }
      } else {
        setSelectedDetailLoading(false);
        setSelectedDetailError(null);
      }

      if (!cachedOrd) {
        try {
          const res = await fetch(`https://ordinals.com/r/inscription/${encodeURIComponent(selectedId)}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data) {
              ordApiCacheRef.current[selectedId] = data;
              setOrdApiData(data);
            }
          }
        } catch { /* ignore */ }
      }
    };
    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const traitQ = traitFilter.trim().toLowerCase();
    let filtered = PINK_PUPPETS_HASHLIST.filter((item) => {
      if (myOnly && !ownedIds.has(item.inscriptionId)) return false;
      if (!q) return true;
      const nameHit = item.name.toLowerCase().includes(q) || item.inscriptionId.toLowerCase().includes(q);
      return nameHit;
    }).map((item, idx) => {
      const listing = listings[item.inscriptionId] || null;
      const isOwnedByConnectedWallet = ownedIds.has(item.inscriptionId);
      return {
        ...item,
        listing,
        displayIndex: itemIndexById.get(item.inscriptionId) || idx + 1,
        techScore: scoreModel.techScoreById.get(item.inscriptionId) || 0,
        rarityPercentile: scoreModel.percentileById.get(item.inscriptionId) || 0,
        scoreBreakdown: scoreModel.breakdownById.get(item.inscriptionId) || {
          traitComponent: 0,
          comboComponent: 0,
          complexityComponent: 0,
          eraComponent: 0,
          total: 0,
          percentile: 0,
        },
        isOwnedByConnectedWallet,
      };
    });
    if (traitQ) {
      filtered = filtered.filter((row) =>
        row.attributes.some((attr) =>
          `${attr.trait_type} ${attr.value}`.toLowerCase().includes(traitQ)
        )
      );
    }
    if (itemFilter === 'listed') filtered = filtered.filter((row) => !!row.listing);
    if (itemFilter === 'not-listed') filtered = filtered.filter((row) => !row.listing);
    if (itemFilter === 'owned') filtered = filtered.filter((row) => row.isOwnedByConnectedWallet);

    if (rarityFilter === 'top10') filtered = filtered.filter((row) => row.rarityPercentile >= 90);
    if (rarityFilter === 'top25') filtered = filtered.filter((row) => row.rarityPercentile >= 75);
    if (rarityFilter === 'top50') filtered = filtered.filter((row) => row.rarityPercentile >= 50);

    filtered.sort((a, b) => {
      const listedA = !!a.listing;
      const listedB = !!b.listing;
      const priceA = Number(a.listing?.priceSats || 0);
      const priceB = Number(b.listing?.priceSats || 0);

      if (sortMode === 'price-asc') {
        if (listedA !== listedB) return listedA ? -1 : 1;
        if (priceA !== priceB) return priceA - priceB;
      } else if (sortMode === 'price-desc') {
        if (listedA !== listedB) return listedA ? -1 : 1;
        if (priceA !== priceB) return priceB - priceA;
      } else if (sortMode === 'rarity-desc') {
        if (a.techScore !== b.techScore) return b.techScore - a.techScore;
      } else if (sortMode === 'rarity-asc') {
        if (a.techScore !== b.techScore) return a.techScore - b.techScore;
      } else if (sortMode === 'listed-newest') {
        const listedAtA = Number(a.listing?.listedAt || 0);
        const listedAtB = Number(b.listing?.listedAt || 0);
        if (listedA !== listedB) return listedA ? -1 : 1;
        if (listedAtA !== listedAtB) return listedAtB - listedAtA;
      }
      return a.displayIndex - b.displayIndex;
    });

    return filtered;
  }, [itemFilter, itemIndexById, listings, myOnly, ownedIds, rarityFilter, scoreModel, search, sortMode, traitFilter]);

  // Owner-Resolution läuft jetzt lazy: gelistete Items werden aus listings.seller
  // pre-seeded, eigene Items aus currentAddress, und alle restlichen erst beim
  // Klick in den Detail-Modal (siehe selectedId useEffect oben). Spart >95 % der
  // UniSat-Indexer-Calls.

  const activeListingsCount = rows.filter((row) => !!row.listing).length;
  const floor = rows.reduce((min, row) => {
    const p = Number(row.listing?.priceSats || 0);
    if (!p) return min;
    return min <= 0 ? p : Math.min(min, p);
  }, 0);

  const selected = rows.find((row) => row.inscriptionId === selectedId) || null;
  const selectedOwnerAddress = selected
    ? (ownerByInscription[selected.inscriptionId] || (selected.isOwnedByConnectedWallet && currentAddress ? currentAddress : selected.listing?.seller || ''))
    : '';

  const handleList = () => {
    void (async () => {
      try {
        if (!selected || !walletAddrNorm) throw new Error('Connect wallet first');
        if (!selected.isOwnedByConnectedWallet) throw new Error('Only owned puppets can be listed');
        if (!walletState.walletType) throw new Error('Wallet type missing');
        const price = Number(listPrice);
        if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be greater than 0');
        setActionError(null);
        setActionMessage(null);
        setBusyListingId(selected.inscriptionId);
        const prepared = await prepareMarketplaceListingPsbt({
          inscriptionId: selected.inscriptionId,
          collectionSlug: PINK_PUPPETS_SLUG,
          sellerAddress: currentAddress,
          sellerPaymentAddress: paymentAddress || currentAddress,
          buyerReceiveAddress: currentAddress,
          priceSats: Math.floor(price),
        });
        if (!prepared?.psbtBase64 || !prepared?.listingId) {
          throw new Error('Invalid listing PSBT payload');
        }
        const signed = await signPSBT(
          prepared.psbtBase64,
          walletState.walletType,
          false,
          prepared.ownerAddress || currentAddress,
          0x82
        );
        const signedIsHex = /^[0-9a-fA-F]+$/.test(String(signed || '').trim());
        await finalizeMarketplaceListingPsbt({
          listingId: prepared.listingId,
          walletAddress: currentAddress,
          signedPsbtHex: signedIsHex ? signed : undefined,
          signedPsbtBase64: signedIsHex ? undefined : signed,
        });
        setActionMessage('Listed via wallet signature.');
        await loadMarketplaceListings();
      } catch (err: any) {
        setActionError(err?.message || 'Listing failed');
      } finally {
        setBusyListingId(null);
      }
    })();
  };

  const handleDelist = () => {
    void (async () => {
      try {
        if (!selected?.listing || !walletAddrNorm) throw new Error('No listing selected');
        if (normalizeAddress(selected.listing.seller) !== walletAddrNorm) throw new Error('Only seller can delist');
        setActionError(null);
        setActionMessage(null);
        setBusyListingId(selected.listing.id);
        await cancelMarketplaceListing(selected.listing.id, currentAddress);
        setActionMessage('Listing cancelled.');
        await loadMarketplaceListings();
      } catch (err: any) {
        setActionError(err?.message || 'Delist failed');
      } finally {
        setBusyListingId(null);
      }
    })();
  };

  const handleBuy = (targetListing?: PuppetListing) => {
    void (async () => {
      // Wenn der Aufrufer keine Listing uebergibt, fallen wir auf die im
      // Detail-Modal ausgewaehlte zurueck. So kann derselbe Handler aus dem
      // Grid (mit explizitem Listing) und aus dem Detail (ohne Argument) genutzt
      // werden.
      const listing = targetListing || selected?.listing || null;
      try {
        console.log('[PinkPuppets][buy] click', {
          listingId: listing?.id,
          walletType: walletState.walletType,
          connected: walletState.connected,
          currentAddress,
          paymentAddress,
        });
        if (!walletState.connected || !walletState.walletType || !walletAddrNorm) {
          // Sichtbares Sofort-Feedback, falls Wallet nicht verbunden ist —
          // sonst meldet sich der UI-Banner unsichtbar oben am Listing-Header.
          if (typeof window !== 'undefined') {
            window.alert('Please connect your wallet first to buy.');
          }
          throw new Error('Connect wallet first');
        }
        if (!listing) throw new Error('No listing selected');
        if (normalizeAddress(listing.seller) === walletAddrNorm) throw new Error('Cannot buy your own listing');
        if (!listing.signedPsbtBase64) throw new Error('Legacy listing without PSBT data. Seller must relist.');
        setActionError(null);
        setActionMessage(null);
        setBusyListingId(listing.id);

        // Funding-Adresse: bc1q/bc1p bevorzugen vor 3... (gleiche Logik wie
        // Haupt-Marketplace). UniSat liefert oft eine separate bc1q payment-
        // Adresse — die muss zum Signieren der Buyer-Inputs benutzt werden,
        // nicht die Taproot-Ordinals-Adresse.
        const fundingCandidates = Array.from(
          new Set(
            [
              currentAddress,
              paymentAddress,
              ...(walletState.accounts || []).map((acc: any) => String(acc?.address || '').trim()),
            ]
              .map((a) => String(a || '').trim())
              .filter(Boolean)
          )
        );
        const preferredFunding =
          fundingCandidates.find((a) => /^bc1[qp]/i.test(a)) ||
          paymentAddress ||
          currentAddress;

        // Public-Key Kandidaten fuer alle bekannten Wallet-Accounts sammeln,
        // damit das Backend den passenden fuer die Funding-Adresse waehlen kann.
        const publicKeyCandidates = Array.from(
          new Set(
            [
              paymentPublicKey,
              ...(walletState.accounts || []).map((acc: any) => readPubKeyFromAccount(acc)),
            ]
              .map((k) => String(k || '').trim())
              .filter(Boolean)
          )
        );

        console.log('[PinkPuppets][buy] preparing', {
          preferredFunding,
          fundingCandidates,
          hasPaymentPublicKey: !!paymentPublicKey,
          publicKeyCandidatesCount: publicKeyCandidates.length,
        });

        const prepared = await prepareMarketplacePurchaseAdvanced({
          listingId: listing.id,
          buyerAddress: currentAddress,
          fundingAddress: preferredFunding,
          fundingAddressCandidates: fundingCandidates,
          fundingPublicKey: paymentPublicKey || publicKeyCandidates[0] || undefined,
          fundingPublicKeys: publicKeyCandidates,
        });

        // Signing-Adresse vom Backend bevorzugen — das ist die Adresse zu der
        // die Inputs gehoeren, die signiert werden muessen. Fallback auf die
        // bevorzugte Funding-Adresse.
        const backendSigningAddress = String(prepared?.funding?.signingAddress || '').trim();
        const signingAddress = backendSigningAddress || preferredFunding || currentAddress;
        const buyerSigningIndexes = Array.isArray(prepared?.funding?.buyerSigningIndexes)
          ? prepared.funding.buyerSigningIndexes
          : undefined;

        console.log('[PinkPuppets][buy] requesting wallet signature', {
          signingAddress,
          buyerSigningIndexes,
        });

        const signed = await signPSBT(
          prepared.fundedPsbtBase64,
          walletState.walletType,
          false,
          signingAddress,
          undefined,
          buyerSigningIndexes
        );

        console.log('[PinkPuppets][buy] signed, completing purchase');

        await completeMarketplacePurchaseAdvanced({
          listingId: listing.id,
          buyerAddress: currentAddress,
          signedPsbtBase64: signed,
        });
        setActionMessage('Purchase completed via wallet signature.');
        await loadMarketplaceListings();
      } catch (err: any) {
        console.error('[PinkPuppets][buy] failed', err);
        const msg = err?.message || 'Buy failed';
        setActionError(msg);
        // Zusaetzlicher Sichtbarkeits-Boost: aus dem Grid heraus sieht man die
        // Banner-Meldung weit oben evtl. nicht — kurzer Alert macht klar, dass
        // ueberhaupt etwas passiert ist.
        if (typeof window !== 'undefined' && targetListing) {
          window.alert(`Buy failed: ${msg}`);
        }
      } finally {
        setBusyListingId(null);
      }
    })();
  };

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/pinkpuppets-clouds-bg.avif')" }}
    >
      <FloatingPuppetsLayer />
      <div className="absolute inset-0 bg-[#130015]/40" />
      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-4 py-8">
        <div className="mb-3 flex items-center">
          <button onClick={() => navigate('/pinkpuppets')} className="rounded-lg border border-pink-300/70 bg-black/35 px-3 py-2 text-sm text-pink-100 hover:bg-pink-900/30">← Back to PinkPuppets</button>
          <a href="https://x.com/PinkPuppets_" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-pink-300/60 transition-all hover:text-pink-200" title="@PinkPuppets_ on X">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span className="hidden sm:inline">@PinkPuppets_</span>
          </a>
        </div>

        <div className="mb-3 w-full overflow-hidden rounded-lg border border-pink-300/60 bg-black/35">
          <img
            src="/images/ppcloud.jpeg"
            alt="PinkPuppets Marketplace Banner"
            className="h-auto w-full object-cover opacity-95"
          />
        </div>
        <div className="mb-6 flex flex-wrap gap-2 text-xs md:text-sm">
          <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Items: <b>{rows.length}</b></span>
          <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Listed: <b>{activeListingsCount}</b></span>
          <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Floor: <b>{floor > 0 ? formatBtc(floor) : '-'}</b></span>
          <button
            onClick={() => setMyOnly((v) => !v)}
            className={`rounded-full border px-3 py-1 font-semibold ${myOnly ? 'border-pink-200 bg-pink-500/30 text-pink-50' : 'border-pink-300/60 bg-black/35 text-pink-100'}`}
          >
            My Puppets {walletState.connected ? `(${ownedIds.size})` : ''}
          </button>
          <button
            onClick={() => setShowRarityInfo(true)}
            className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1 font-semibold text-pink-100 hover:bg-pink-500/20 hover:border-pink-200 transition-all"
          >
            Rarity ?
          </button>
        </div>

        {showRarityInfo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setShowRarityInfo(false)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-pink-300/50 bg-gradient-to-b from-[#2a1028] to-[#1a0a1a] p-6 shadow-2xl shadow-pink-900/40" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-pink-100">How Rarity Works</h3>
                <button onClick={() => setShowRarityInfo(false)} className="rounded-full border border-pink-300/40 px-3 py-1 text-xs font-bold text-pink-200 hover:bg-pink-500/20 transition-colors">CLOSE</button>
              </div>

              <p className="text-sm text-pink-100/80 mb-5">Each Pink Puppet gets a <b className="text-pink-100">Tech Score</b> from 0–100 based on how rare it is. The score is built from <b className="text-pink-100">4 components</b>:</p>

              <div className="space-y-3 mb-5">
                <div className="rounded-xl border border-pink-400/30 bg-black/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-pink-100">Trait Rarity</span>
                    <span className="text-xs font-bold text-pink-300 bg-pink-500/20 rounded-full px-2 py-0.5">55%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/50 mb-2"><div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-300" style={{ width: '55%' }} /></div>
                  <p className="text-xs text-pink-200/70">How rare are the individual traits? A trait shared by only 2 puppets scores much higher than one shared by 40.</p>
                </div>

                <div className="rounded-xl border border-pink-400/30 bg-black/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-pink-100">Trait Combo</span>
                    <span className="text-xs font-bold text-pink-300 bg-pink-500/20 rounded-full px-2 py-0.5">20%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/50 mb-2"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-fuchsia-300" style={{ width: '20%' }} /></div>
                  <p className="text-xs text-pink-200/70">Is the exact combination of all traits unique? A one-of-a-kind combo gets the maximum score.</p>
                </div>

                <div className="rounded-xl border border-pink-400/30 bg-black/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-pink-100">Complexity</span>
                    <span className="text-xs font-bold text-pink-300 bg-pink-500/20 rounded-full px-2 py-0.5">15%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/50 mb-2"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-300" style={{ width: '15%' }} /></div>
                  <p className="text-xs text-pink-200/70">How many attributes does the puppet have? More attributes = more detail = higher score.</p>
                </div>

                <div className="rounded-xl border border-pink-400/30 bg-black/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-pink-100">Edition</span>
                    <span className="text-xs font-bold text-pink-300 bg-pink-500/20 rounded-full px-2 py-0.5">10%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/50 mb-2"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-300" style={{ width: '10%' }} /></div>
                  <p className="text-xs text-pink-200/70">Earlier inscriptions in the collection get a small bonus — OG status matters.</p>
                </div>
              </div>

              <div className="rounded-xl border border-pink-400/30 bg-black/30 p-4 mb-4">
                <p className="text-sm font-bold text-pink-100 mb-2">Percentile Ranking</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-4 rounded-full bg-black/50 overflow-hidden flex">
                    <div className="h-full bg-pink-600/80 flex items-center justify-center text-[8px] font-bold text-white" style={{ width: '10%' }}>Top 10%</div>
                    <div className="h-full bg-pink-500/50 flex items-center justify-center text-[8px] font-bold text-white/80" style={{ width: '15%' }}>Top 25%</div>
                    <div className="h-full bg-pink-400/30 flex items-center justify-center text-[8px] font-bold text-white/60" style={{ width: '25%' }}>Top 50%</div>
                    <div className="h-full bg-pink-300/15" style={{ width: '50%' }} />
                  </div>
                </div>
                <p className="text-xs text-pink-200/70">All puppets are ranked by their total score. "Top 10%" means it's rarer than 90% of the collection.</p>
              </div>

              <p className="text-[11px] text-pink-200/50 text-center">Rarity is calculated on-chain from inscription metadata. It cannot be changed.</p>
            </div>
          </div>
        )}

        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="rounded-md border border-pink-300/40 bg-black/70 px-3 py-2 text-sm text-pink-100 outline-none"
          >
            <option value="price-asc">Sort: Price Low -&gt; High</option>
            <option value="price-desc">Sort: Price High -&gt; Low</option>
            <option value="rarity-desc">Sort: Rarity High -&gt; Low</option>
            <option value="rarity-asc">Sort: Rarity Low -&gt; High</option>
            <option value="listed-newest">Sort: Newest Listings</option>
          </select>
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as typeof rarityFilter)}
            className="rounded-md border border-pink-300/40 bg-black/70 px-3 py-2 text-sm text-pink-100 outline-none"
          >
            <option value="all">Rarity: All</option>
            <option value="top10">Rarity: Top 10%</option>
            <option value="top25">Rarity: Top 25%</option>
            <option value="top50">Rarity: Top 50%</option>
          </select>
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value as typeof itemFilter)}
            className="rounded-md border border-pink-300/40 bg-black/70 px-3 py-2 text-sm text-pink-100 outline-none"
          >
            <option value="all">Items: All</option>
            <option value="listed">Items: Listed</option>
            <option value="not-listed">Items: Not listed</option>
            <option value="owned">Items: Owned by me</option>
          </select>
          <input
            value={traitFilter}
            onChange={(e) => setTraitFilter(e.target.value)}
            placeholder="Traits Filter"
            className="rounded-md border border-pink-300/40 bg-black/70 px-3 py-2 text-sm text-pink-100 outline-none placeholder:text-pink-200/50"
          />
        </div>

        <div className="mt-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or inscription id..." className="w-full rounded-lg border border-pink-300/70 bg-black/45 px-3 py-2 text-sm outline-none placeholder:text-pink-200/50" />
        </div>
        {walletState.connected && loadingOwned && (
          <div className="mt-2 text-xs text-pink-100/80">Loading your wallet puppets...</div>
        )}
        {walletState.connected && ownershipError && (
          <div className="mt-2 text-xs text-red-200">Ownership check failed: {ownershipError}</div>
        )}
        {actionMessage && <div className="mt-2 text-xs text-green-200">{actionMessage}</div>}
        {actionError && <div className="mt-2 text-xs text-red-200">{actionError}</div>}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {rows.map((row) => {
            const contentUrl = `https://ordinals.com/content/${encodeURIComponent(row.inscriptionId)}`;
            const ownerAddress = ownerByInscription[row.inscriptionId] || (row.isOwnedByConnectedWallet && currentAddress ? currentAddress : row.listing?.seller || '');
            return (
              <article key={row.inscriptionId} className="rounded-xl border-2 border-pink-300/70 bg-black/40 p-2">
                <button onClick={() => setSelectedId(row.inscriptionId)} className="aspect-square w-full overflow-hidden rounded-lg border border-pink-300/60 bg-[#140014] text-left">
                  <img src={contentUrl} title={row.name} alt={row.name} className="h-full w-full object-contain p-0.5" loading="lazy" />
                </button>
                <h3 className="mt-2 line-clamp-2 text-[11px] font-semibold text-pink-100">{row.name}</h3>
                <p className="mt-1 text-[10px] text-pink-200/80">Tech Score: <b>{row.techScore.toFixed(2)}</b></p>
                <p className="mt-0.5 text-[10px] text-pink-200/70">Percentile: <b>{row.rarityPercentile.toFixed(2)}%</b></p>
                <p className="mt-1 text-[10px] text-pink-200/60">{row.inscriptionId.slice(0, 10)}...{row.inscriptionId.slice(-4)}</p>
                <p className="mt-1 text-[10px] text-pink-200/70">Owner: <b>{ownerAddress ? shortAddress(ownerAddress) : '-'}</b></p>
                <div className="mt-2 text-[10px]">
                  {row.listing ? (
                    <div className="rounded-md border border-pink-300/50 bg-pink-900/20 p-2">
                      <div className="flex justify-between"><span>Price</span><b>{formatBtc(row.listing.priceSats)}</b></div>
                      <div className="flex justify-between"><span>Seller</span><span>{shortAddress(row.listing.seller)}</span></div>
                      {(() => {
                        const isOwn = walletAddrNorm && normalizeAddress(row.listing.seller) === walletAddrNorm;
                        const busy = busyListingId === row.listing.id;
                        if (!walletState.connected) {
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.alert('Please connect your wallet first to buy.'); }}
                              className="mt-2 w-full rounded border-2 border-black bg-[#ff4fcf]/70 px-2 py-1.5 text-[10px] font-bold text-black"
                            >Connect to Buy</button>
                          );
                        }
                        if (isOwn) {
                          return (
                            <div className="mt-2 rounded border border-pink-300/40 bg-black/30 px-2 py-1 text-center text-[10px] text-pink-200/80">Your listing</div>
                          );
                        }
                        return (
                          <button
                            disabled={busy}
                            onClick={(e) => { e.stopPropagation(); handleBuy(row.listing!); }}
                            className="mt-2 w-full rounded border-2 border-black bg-[#ff4fcf] px-2 py-1.5 text-[10px] font-bold text-black hover:bg-[#ff7fdc] disabled:opacity-60"
                          >{busy ? 'Buying…' : 'Buy Now'}</button>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="rounded-md border border-pink-300/30 bg-black/30 p-2 text-pink-200/70">Not listed</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedId(null)}>
            <div className="w-full max-w-2xl rounded-xl border-2 border-pink-300 bg-[#2a002a] p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-pink-100">{selected.name}</h2>
                  <p className="text-xs text-pink-200/70">{selected.inscriptionId}</p>
                </div>
                <button className="rounded border border-pink-300/60 px-2 py-1 text-xs" onClick={() => setSelectedId(null)}>Close</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-3">
                  <div
                    className="aspect-square overflow-hidden rounded-lg border border-pink-300/60 bg-[#140014] cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => setFullscreenImage({
                      url: `https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`,
                      name: selected.name,
                    })}
                  >
                    <img
                      src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}
                      title={selected.name}
                      alt={selected.name}
                      className="h-full w-full object-contain p-1"
                    />
                  </div>

                  <div className="rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                    <div className="flex items-baseline justify-between">
                      <p className="text-pink-100 font-semibold">Tech Score: <b>{selected.techScore.toFixed(2)}</b></p>
                      <span className="text-xs text-pink-200/85">Top {selected.rarityPercentile.toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-pink-100/85">
                      <div className="rounded bg-black/40 px-2 py-1">Trait Rarity <b>{selected.scoreBreakdown.traitComponent.toFixed(1)}</b></div>
                      <div className="rounded bg-black/40 px-2 py-1">Trait Combo <b>{selected.scoreBreakdown.comboComponent.toFixed(1)}</b></div>
                      <div className="rounded bg-black/40 px-2 py-1">Complexity <b>{selected.scoreBreakdown.complexityComponent.toFixed(1)}</b></div>
                      <div className="rounded bg-black/40 px-2 py-1">Edition <b>{selected.scoreBreakdown.eraComponent.toFixed(1)}</b></div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selected.attributes.map((attr, i) => (
                        <span key={`${attr.trait_type}-${attr.value}-${i}`} className="inline-block rounded bg-pink-900/40 border border-pink-300/20 px-2 py-0.5 text-[10px] text-pink-100/90">
                          <span className="text-pink-200/60">{attr.trait_type}:</span> {attr.value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                    <p className="mb-2 text-pink-100 font-semibold">Details</p>
                    <div className="space-y-1 text-xs text-pink-100/90">
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Collection</span>
                        <span>PinkPuppets</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Item ID</span>
                        <span>{selected.displayIndex}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Status</span>
                        <span>{selected.listing ? 'Listed' : 'Not listed'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Owner</span>
                        <span>{selectedOwnerAddress ? shortAddress(selectedOwnerAddress) : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Seller</span>
                        <span>{selected.listing?.seller ? shortAddress(selected.listing.seller) : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Price</span>
                        <span>{selected.listing ? formatBtc(selected.listing.priceSats) : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Listed At</span>
                        <span>{selected.listing ? formatDateTime(selected.listing.listedAt) : '-'}</span>
                      </div>
                    </div>

                    {selectedDetailLoading && <p className="mt-2 text-[11px] text-pink-200/70">Loading details...</p>}
                    {selectedDetailError && <p className="mt-2 text-[11px] text-yellow-200">Owner fetch failed: {selectedDetailError}</p>}
                  </div>

                  {/* Chain Info from ordinals.com */}
                  <div className="rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                    <p className="mb-2 text-pink-100 font-semibold">Chain Info</p>
                    {(() => {
                      const ord = ordApiData || {} as any;
                      const infoRow = (label: string, value: React.ReactNode) => (
                        <div className="flex justify-between items-start py-1.5 border-b border-pink-300/10 last:border-b-0">
                          <span className="text-pink-200/70 text-xs shrink-0">{label}</span>
                          <span className="text-xs text-right ml-4 truncate max-w-[60%] font-mono text-pink-100">{value}</span>
                        </div>
                      );
                      const satNum = ord?.sat != null ? Number(ord.sat) : NaN;
                      const rareSats = Number.isFinite(satNum) ? deriveSatRarity(satNum) : '-';
                      const rareSatTokens = rareSats !== '-' ? rareSats.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                      const gtx = selected.inscriptionId.replace(/i\d+$/, '');
                      return (
                        <>
                          {infoRow('Inscription ID', <span title={selected.inscriptionId}>{truncId(selected.inscriptionId)} <button onClick={() => navigator.clipboard.writeText(selected.inscriptionId)} className="text-pink-300/50 hover:text-pink-200 ml-1">⎘</button></span>)}
                          {infoRow('Content', <a className="text-pink-400 hover:text-pink-300" target="_blank" rel="noreferrer" href={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}>View Content ↗</a>)}
                          {infoRow('Owner', selectedOwnerAddress ? shortAddress(selectedOwnerAddress) : '-')}
                          {infoRow('Token Standard', 'ORD')}
                          {infoRow('Inscription Number', ord?.number != null ? String(ord.number) : '-')}
                          {infoRow('Sat Number', Number.isFinite(satNum) ? String(Math.trunc(satNum)) : '-')}

                          {rareSatTokens.length > 0 && (
                            <div className="flex justify-between items-start py-1.5 border-b border-pink-300/10">
                              <span className="text-pink-200/70 text-xs shrink-0">Rare Sats</span>
                              <div className="flex flex-wrap gap-1 justify-end ml-4">
                                {rareSatTokens.map((token: string, i: number) => (
                                  <span
                                    key={`${token}-${i}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]"
                                  >
                                    {RARE_SAT_SYMBOLS[token] || '◌'} {token}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {infoRow('Content Type', ord?.content_type || '-')}
                          {infoRow('Location', ord?.satpoint || '-')}
                          {infoRow('Genesis Transaction', gtx ? <a className="text-pink-400 hover:text-pink-300" target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${gtx}`}>{truncId(gtx)} ↗</a> : '-')}
                          {ord?.value != null && infoRow('Output Value', `${ord.value} sats`)}
                          {ord?.content_length != null && infoRow('Content Length', `${ord.content_length.toLocaleString()} bytes`)}
                          {ord?.height != null && infoRow('Block Height', <a className="text-pink-400 hover:text-pink-300" target="_blank" rel="noreferrer" href={`https://mempool.space/block/${ord.height}`}>{String(ord.height)} ↗</a>)}
                          {ord?.fee != null && infoRow('Inscription Fee', `${ord.fee.toLocaleString()} sats`)}
                          {ord?.timestamp != null && infoRow('Timestamp', new Date(ord.timestamp * 1000).toLocaleString())}
                          {!ordApiData && <p className="text-[10px] text-pink-200/50 mt-1">Loading chain data...</p>}
                        </>
                      );
                    })()}
                  </div>

                  {!walletState.connected && (
                    <div className="rounded-lg border border-yellow-300/60 bg-yellow-900/20 p-3 text-xs text-yellow-100">
                      Connect wallet to list or buy.
                    </div>
                  )}

                  {walletState.connected && (
                    <div className="space-y-2 rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                      {selected.listing ? (
                        <>
                          <p>Listed at <b>{formatBtc(selected.listing.priceSats)}</b></p>
                          <p className="text-xs text-pink-200/70">Seller: {shortAddress(selected.listing.seller)}</p>
                          {normalizeAddress(selected.listing.seller) === walletAddrNorm ? (
                            <button disabled={busyListingId === selected.listing.id} onClick={handleDelist} className="w-full rounded border-2 border-black bg-pink-300 px-3 py-2 text-xs font-bold text-black disabled:opacity-60">Delist</button>
                          ) : (
                            <button disabled={busyListingId === selected.listing.id} onClick={() => handleBuy(selected.listing!)} className="w-full rounded border-2 border-black bg-[#ff4fcf] px-3 py-2 text-xs font-bold text-black disabled:opacity-60">Buy Now</button>
                          )}
                        </>
                      ) : (
                        selected.isOwnedByConnectedWallet ? (
                          <>
                            <label className="text-xs">List price (sats)</label>
                            <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full rounded border border-pink-300/50 bg-black/50 px-2 py-1 text-sm" />
                            <button disabled={busyListingId === selected.inscriptionId} onClick={handleList} className="w-full rounded border-2 border-black bg-[#ff4fcf] px-3 py-2 text-xs font-bold text-black disabled:opacity-60">List Item</button>
                          </>
                        ) : (
                          <div className="rounded border border-yellow-300/60 bg-yellow-900/20 px-2 py-2 text-xs text-yellow-100">
                            Listing only possible for puppets owned by your connected wallet.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Image Lightbox */}
        {fullscreenImage && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setFullscreenImage(null)}
          >
            <div className="relative" onClick={e => e.stopPropagation()}>
              <img
                src={fullscreenImage.url}
                alt={fullscreenImage.name}
                className="rounded-xl border-2 border-pink-400/50 block"
                style={{
                  imageRendering: 'pixelated',
                  width: 'min(85vmin, 700px)',
                  height: 'min(85vmin, 700px)',
                  objectFit: 'contain',
                  background: '#140014',
                }}
              />
              <p className="text-center text-pink-200 font-bold mt-3 text-lg">{fullscreenImage.name}</p>
              <button
                onClick={() => setFullscreenImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

