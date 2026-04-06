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

const OO_CSS = `
@keyframes ooGlow {
  0%, 100% { text-shadow: 0 0 10px #d4a, 0 0 20px #d4a5, 0 0 40px #d4a2; }
  50% { text-shadow: 0 0 16px #d4a, 0 0 32px #d4a7, 0 0 56px #d4a3, 0 0 80px #fa01; }
}
@keyframes ooTitleGlow {
  0% { text-shadow: 0 0 8px #f90, 0 0 20px #f906, 0 0 40px #f903, 0 0 80px #d4a5; filter: brightness(1); }
  33% { text-shadow: 0 0 14px #f90, 0 0 30px #f90a, 0 0 60px #f905, 0 0 100px #d4a3; filter: brightness(1.15); }
  66% { text-shadow: 0 0 10px #fa0, 0 0 24px #f908, 0 0 50px #f904, 0 0 90px #d4a2; filter: brightness(1.05); }
  100% { text-shadow: 0 0 8px #f90, 0 0 20px #f906, 0 0 40px #f903, 0 0 80px #d4a5; filter: brightness(1); }
}
@keyframes ooBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes ooPriceGlow {
  0%, 100% { text-shadow: 0 0 6px #f90, 0 0 14px #f905; }
  50% { text-shadow: 0 0 12px #f90, 0 0 24px #f907; }
}
@keyframes ooOwnedGlow {
  0%, 100% { box-shadow: 0 0 12px #f903, 0 0 24px #f902; border-color: #f90a0; }
  50% { box-shadow: 0 0 24px #f906, 0 0 48px #f903, 0 0 64px #f901; border-color: #f90; }
}
@keyframes ooFloat {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(1deg); }
  75% { transform: translateY(4px) rotate(-0.5deg); }
}
@keyframes ooBorderPulse {
  0%, 100% { border-color: #d4a4; box-shadow: 0 0 8px #d4a1, inset 0 0 8px #d4a05; }
  50% { border-color: #d4a8; box-shadow: 0 0 16px #d4a2, inset 0 0 16px #d4a0a, 0 0 32px #f9008; }
}
@keyframes ooStatFlash {
  0%, 100% { background: #d4a08; }
  50% { background: #d4a15; }
}
@keyframes ooOrb {
  0% { transform: translate(0, 0) scale(1); opacity: 0.4; }
  50% { transform: translate(30px, -20px) scale(1.3); opacity: 0.6; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
}
.oo-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  position: relative;
  overflow: hidden;
}
.oo-card::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent 0%, #f9005 50%, transparent 100%);
  transform: translateX(-100%) translateY(-100%);
  transition: transform 0.6s ease;
  pointer-events: none;
  z-index: 1;
}
.oo-card:hover::before { transform: translateX(100%) translateY(100%); }
.oo-card:hover {
  transform: translateY(-6px) scale(1.03);
  box-shadow: 0 0 30px #d4a4, 0 0 60px #f9015, 0 12px 40px #0008;
  border-color: #f90 !important;
  z-index: 5;
}
`;

function MysticOrbs() {
  const orbs = React.useMemo(() => {
    const o: Array<{ x: number; y: number; size: number; delay: number; color: string; dur: number }> = [];
    const colors = ['#d4a', '#f90', '#a6f', '#f60', '#fc0', '#c4f'];
    for (let i = 0; i < 40; i++) {
      o.push({ x: Math.random() * 100, y: Math.random() * 100, size: 2 + Math.floor(Math.random() * 6), delay: Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)], dur: 4 + Math.random() * 8 });
    }
    return o;
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {orbs.map((o, i) => (
        <div key={i} className="absolute rounded-full" style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.size, height: o.size, backgroundColor: o.color, opacity: 0.15 + Math.random() * 0.25, animation: `ooOrb ${o.dur}s ${o.delay}s ease-in-out infinite`, boxShadow: `0 0 ${o.size * 3}px ${o.color}40`, filter: 'blur(1px)' }} />
      ))}
    </div>
  );
}

function OrnateCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <div className="absolute pointer-events-none" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 50, height: 50 }}>
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 50, height: 2, background: 'linear-gradient(90deg, #f90, #d4a)', boxShadow: '0 0 8px #f906' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 2, height: 50, background: 'linear-gradient(180deg, #f90, #d4a)', boxShadow: '0 0 8px #f906' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 5, [isLeft ? 'left' : 'right']: 5, width: 5, height: 5, borderRadius: '50%', background: '#f90', boxShadow: '0 0 8px #f908' }} />
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

  const ooBorder = (color: string) => `2px solid ${color}`;
  const ooShadow = (color: string) => `4px 4px 0px ${color}`;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0d0518 40%, #08020f 100%)', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{OO_CSS}</style>

      <MysticOrbs />

      <div className="absolute pointer-events-none" style={{ top: '10%', left: '5%', width: 400, height: 400, background: 'radial-gradient(circle, #d4a08 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ top: '50%', right: '5%', width: 350, height: 350, background: 'radial-gradient(circle, #f9006 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '30%', width: 300, height: 300, background: 'radial-gradient(circle, #a6f06 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }} />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-3 py-6">

        {/* HEADER */}
        <div className="mb-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#f902]" style={{ border: ooBorder('#f90'), color: '#f90', background: '#f9008', boxShadow: `${ooShadow('#4204')}, 0 0 12px #f901`, fontFamily: "'Courier New', monospace" }}>
            {'<'} BACK
          </button>
        </div>

        {/* TITLE */}
        <div className="mb-3 relative">
          <div className="relative py-6 px-6">
            <div className="text-center">
              <div style={{ animation: 'ooFloat 6s ease-in-out infinite' }} className="flex flex-col items-center">
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-[0.15em]" style={{ color: '#f90', animation: 'ooTitleGlow 4s ease-in-out infinite', fontFamily: "'Georgia', serif" }}>ORDINAL ODDITIES</h1>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="h-px flex-1 max-w-[100px]" style={{ background: 'linear-gradient(90deg, transparent, #d4a, transparent)' }} />
                <p className="text-xs md:text-sm uppercase tracking-[0.4em] font-bold" style={{ color: '#d4a', textShadow: '0 0 10px #d4a4', fontFamily: "'Courier New', monospace" }}>19 UNIQUE ODDITIES COLLECTION</p>
                <span className="h-px flex-1 max-w-[100px]" style={{ background: 'linear-gradient(90deg, transparent, #d4a, transparent)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* STATS BAR */}
        <div className="mb-6 flex flex-wrap justify-center gap-3 text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: "'Courier New', monospace" }}>
          {[
            { label: 'ITEMS', value: String(rows.length), color: '#f90', icon: '◈' },
            { label: 'LISTED', value: String(activeListingsCount), color: '#d4a', icon: '◆' },
            { label: 'FLOOR', value: floor > 0 ? `${formatSats(floor)} SAT` : '---', color: '#fc0', icon: '₿' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5 relative rounded-sm" style={{ border: ooBorder(s.color + '80'), background: `linear-gradient(180deg, ${s.color}10 0%, ${s.color}05 100%)`, color: s.color, boxShadow: `inset 0 0 20px ${s.color}10, 0 0 10px ${s.color}15, ${ooShadow('#0002')}`, animation: 'ooStatFlash 4s ease-in-out infinite', minWidth: 120, textAlign: 'center' }}>
              <span style={{ fontSize: 14, marginRight: 6 }}>{s.icon}</span>{s.label}: <span style={{ fontSize: 13 }}>{s.value}</span>
            </div>
          ))}
          <button onClick={() => setMyOnly((v) => !v)} className="px-4 py-2.5 font-bold uppercase transition-all rounded-sm" style={{ border: ooBorder(myOnly ? '#f90' : ownedIds.size > 0 ? '#f90a0' : '#f904'), background: myOnly ? 'linear-gradient(180deg, #f901a 0%, #f900a 100%)' : ownedIds.size > 0 ? 'linear-gradient(180deg, #f9010 0%, #f9008 100%)' : 'transparent', color: myOnly ? '#f90' : ownedIds.size > 0 ? '#f90' : '#f906', textShadow: myOnly ? '0 0 8px #f906' : ownedIds.size > 0 ? '0 0 6px #f904' : 'none', animation: ownedIds.size > 0 && !myOnly ? 'ooOwnedGlow 2s ease-in-out infinite' : 'none', boxShadow: myOnly ? `0 0 20px #f904, ${ooShadow('#f902')}` : 'none', fontFamily: "'Courier New', monospace" }}>
            ◈ MY ITEMS {walletState.connected ? `[${ownedIds.size}]` : ''}
          </button>
          {myOnly && (
            <button onClick={() => setMyOnly(false)} className="px-4 py-2.5 font-bold uppercase transition-all hover:bg-[#f902] rounded-sm" style={{ border: ooBorder('#f90'), color: '#f90', background: 'linear-gradient(180deg, #f9015 0%, #f9008 100%)', boxShadow: `0 0 16px #f903, ${ooShadow('#0002')}`, textShadow: '0 0 6px #f904', fontFamily: "'Courier New', monospace" }}>
              ◈ ALL ITEMS
            </button>
          )}
        </div>

        {/* FILTERS */}
        <div className="mb-5 p-3 grid gap-2 md:grid-cols-3 rounded-sm" style={{ border: ooBorder('#ffffff08'), background: '#ffffff04' }}>
          {[
            <select key="sort" value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
              <option value="number-asc">▲ NUM ASC</option><option value="number-desc">▼ NUM DESC</option>
              <option value="price-asc">▲ PRICE ASC</option><option value="price-desc">▼ PRICE DESC</option>
              <option value="listed-newest">★ NEWEST</option>
            </select>,
            <select key="filter" value={itemFilter} onChange={(e) => setItemFilter(e.target.value as typeof itemFilter)}>
              <option value="all">◈ ALL ITEMS</option><option value="listed">◆ LISTED</option>
              <option value="not-listed">○ NOT LISTED</option><option value="owned">◈ MY OWNED</option>
            </select>,
            <input key="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="▶ SEARCH..." />,
          ].map((el, i) => (
            <div key={i}>
              {React.cloneElement(el as React.ReactElement, {
                className: 'w-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider outline-none transition-all focus:border-[#f90] focus:shadow-[0_0_12px_#f903] rounded-sm',
                style: { ...(el as React.ReactElement).props.style, border: ooBorder('#f903'), background: '#10081880', color: '#f90', fontFamily: "'Courier New', monospace" },
              })}
            </div>
          ))}
        </div>

        {/* STATUS */}
        {walletState.connected && loadingOwned && (
          <p className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: '#f908', fontFamily: "'Courier New', monospace" }}><span style={{ animation: 'ooBlink 0.5s steps(1) infinite', marginRight: 4 }}>▶</span>SCANNING WALLET...</p>
        )}
        {walletState.connected && ownershipError && (
          <p className="mb-2 text-[10px] uppercase" style={{ color: '#f44', fontFamily: "'Courier New', monospace" }}>✖ ERR: {ownershipError}</p>
        )}
        {actionMessage && (
          <div className="mb-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm" style={{ border: ooBorder('#fc06'), color: '#fc0', background: '#fc008', animation: 'ooPriceGlow 1.5s ease-in-out infinite', fontFamily: "'Courier New', monospace" }}>✔ {actionMessage}</div>
        )}
        {actionError && (
          <div className="mb-3 px-4 py-2 text-[11px] font-bold uppercase rounded-sm" style={{ border: ooBorder('#f446'), color: '#f44', background: '#f4408', fontFamily: "'Courier New', monospace" }}>✖ {actionError}</div>
        )}

        {/* GRID */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {rows.map((row) => {
            const contentUrl = `https://ordinals.com/content/${encodeURIComponent(row.inscriptionId)}`;
            const ownerAddr = ownerByInscription[row.inscriptionId] || (row.isOwnedByConnectedWallet && currentAddress ? currentAddress : row.listing?.seller || '');
            const isListed = !!row.listing;
            const borderColor = isListed ? '#fc0' : row.isOwnedByConnectedWallet ? '#f90' : '#d4a2';
            const glowColor = isListed ? '#fc0' : row.isOwnedByConnectedWallet ? '#f90' : '#d4a';

            return (
              <article key={row.inscriptionId} className="oo-card rounded-lg" style={{ border: ooBorder(borderColor), background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0518 100%)', boxShadow: `0 0 12px ${glowColor}08, ${ooShadow('#0002')}` }}>
                {isListed && (
                  <div className="absolute top-0 right-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase rounded-bl-md" style={{ background: 'linear-gradient(135deg, #fc0, #f90)', color: '#000', boxShadow: '0 0 8px #fc04', fontFamily: "'Courier New', monospace" }}>FOR SALE</div>
                )}
                {row.isOwnedByConnectedWallet && !isListed && (
                  <div className="absolute top-0 left-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase rounded-br-md" style={{ background: 'linear-gradient(135deg, #f90, #d4a)', color: '#000', boxShadow: '0 0 8px #f904', fontFamily: "'Courier New', monospace" }}>OWNED</div>
                )}
                <button onClick={() => setSelectedId(row.inscriptionId)} className="aspect-square w-full overflow-hidden text-left relative rounded-t-lg" style={{ background: '#08020f' }}>
                  <img src={contentUrl} title={row.name} alt={row.name} className="h-full w-full object-contain relative z-[2]" loading="lazy" />
                  <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 30px #00000080' }} />
                </button>
                <div className="p-2" style={{ borderTop: ooBorder(borderColor) }}>
                  <h3 className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: '#f90', textShadow: '0 0 4px #f903', fontFamily: "'Courier New', monospace" }}>{row.name}</h3>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] font-bold" style={{ color: '#d4a8', fontFamily: "'Courier New', monospace" }}>#{row.inscriptionNumber}</span>
                    <span className="text-[7px]" style={{ color: '#fff3', fontFamily: "'Courier New', monospace" }}>{ownerAddr ? shortAddress(ownerAddr) : '---'}</span>
                  </div>
                  {isListed ? (
                    <div className="mt-2 px-2 py-1.5 text-center rounded-sm" style={{ border: ooBorder('#fc06'), background: 'linear-gradient(180deg, #fc00f 0%, #fc008 100%)' }}>
                      <span className="text-[10px] font-black" style={{ color: '#fc0', animation: 'ooPriceGlow 2s ease-in-out infinite', fontFamily: "'Courier New', monospace" }}>₿ {formatSats(row.listing!.priceSats)} SAT</span>
                    </div>
                  ) : (
                    <div className="mt-2 px-2 py-1.5 text-center text-[9px] font-bold uppercase rounded-sm" style={{ border: ooBorder('#fff08'), color: '#fff15', fontFamily: "'Courier New', monospace" }}>○ NOT LISTED</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* DETAIL MODAL */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'radial-gradient(circle at 50% 50%, #1a0a2e88 0%, #000d 100%)' }} onClick={() => setSelectedId(null)}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative rounded-lg" style={{ border: ooBorder('#f90'), background: 'linear-gradient(180deg, #1a0a2e 0%, #12081f 50%, #0d0518 100%)', boxShadow: '0 0 60px #f9015, 0 0 120px #d4a0a, 0 20px 60px #0008', animation: 'ooBorderPulse 4s ease-in-out infinite' }} onClick={(e) => e.stopPropagation()}>
              <OrnateCorner position="tl" /><OrnateCorner position="tr" /><OrnateCorner position="bl" /><OrnateCorner position="br" />
              <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: ooBorder('#f903'), background: 'linear-gradient(180deg, #f9008 0%, transparent 100%)' }}>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider" style={{ color: '#f90', textShadow: '0 0 12px #f904' }}>{selected.name}</h2>
                  <p className="text-[10px] font-bold mt-0.5" style={{ color: '#d4a', textShadow: '0 0 6px #d4a3', fontFamily: "'Courier New', monospace" }}>INSCRIPTION #{selected.inscriptionNumber}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#fff3', fontFamily: "'Courier New', monospace" }}>{selected.inscriptionId}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="px-3 py-1.5 text-[10px] font-black uppercase transition-all hover:bg-[#f442] rounded-sm" style={{ border: ooBorder('#f44'), color: '#f44', boxShadow: '0 0 8px #f4420', fontFamily: "'Courier New', monospace" }}>[X] CLOSE</button>
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                <div className="p-4">
                  <div className="aspect-square overflow-hidden cursor-pointer transition-all hover:shadow-[0_0_30px_#f903] relative rounded-lg" style={{ border: ooBorder('#f904'), background: '#08020f' }} onClick={() => setFullscreenImage({ url: `https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`, name: selected.name })}>
                    <img src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`} alt={selected.name} className="h-full w-full object-contain relative z-[2]" />
                    <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 30px #00000060' }} />
                  </div>
                  <p className="mt-2 text-center text-[9px] uppercase tracking-wider" style={{ color: '#fff3', fontFamily: "'Courier New', monospace" }}><span style={{ animation: 'ooBlink 2s steps(1) infinite' }}>▶</span> CLICK TO ENLARGE</p>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-sm" style={{ border: ooBorder('#f903'), background: '#f9005' }}>
                    <div className="px-3 py-2 rounded-t-sm" style={{ background: 'linear-gradient(90deg, #f9015 0%, #f9008 100%)', borderBottom: ooBorder('#f903') }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f90', textShadow: '0 0 6px #f904', fontFamily: "'Courier New', monospace" }}>◈ DETAILS</p>
                    </div>
                    <div className="px-3 py-2 space-y-1.5 text-[10px]" style={{ fontFamily: "'Courier New', monospace" }}>
                      {([
                        ['COLLECTION', 'ORDINAL ODDITIES'],
                        ['ITEM', `#${selected.displayIndex} OF 19`],
                        ['INSCRIPTION', `#${selected.inscriptionNumber}`],
                        ['STATUS', selected.listing ? '◆ LISTED' : '○ NOT LISTED'],
                        ['OWNER', selectedOwnerAddress ? shortAddress(selectedOwnerAddress) : '---'],
                        ['SELLER', selected.listing?.seller ? shortAddress(selected.listing.seller) : '---'],
                        ['PRICE', selected.listing ? `₿ ${formatSats(selected.listing.priceSats)} SAT` : '---'],
                        ['LISTED', selected.listing ? formatDateTime(selected.listing.listedAt) : '---'],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="flex justify-between font-bold py-0.5" style={{ borderBottom: '1px solid #ffffff08' }}>
                          <span style={{ color: '#fff4' }}>{label}</span>
                          <span style={{ color: label === 'PRICE' && selected.listing ? '#fc0' : label === 'STATUS' && selected.listing ? '#fc0' : '#fffc', textShadow: label === 'PRICE' && selected.listing ? '0 0 6px #fc04' : 'none' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {selectedDetailLoading && <p className="px-3 pb-2 text-[9px]" style={{ color: '#f906', fontFamily: "'Courier New', monospace" }}><span style={{ animation: 'ooBlink 0.5s steps(1) infinite' }}>▶</span> LOADING...</p>}
                    {selectedDetailError && <p className="px-3 pb-2 text-[9px]" style={{ color: '#f44', fontFamily: "'Courier New', monospace" }}>✖ {selectedDetailError}</p>}
                  </div>

                  <div className="rounded-sm" style={{ border: ooBorder('#d4a3'), background: '#d4a05' }}>
                    <div className="px-3 py-2 rounded-t-sm" style={{ background: 'linear-gradient(90deg, #d4a15 0%, #d4a08 100%)', borderBottom: ooBorder('#d4a3') }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#d4a', textShadow: '0 0 6px #d4a4', fontFamily: "'Courier New', monospace" }}>◈ CHAIN DATA</p>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-[10px]" style={{ fontFamily: "'Courier New', monospace" }}>
                      {(() => {
                        const ord = ordApiData || {} as any;
                        const satNum = ord?.sat != null ? Number(ord.sat) : NaN;
                        const rareSats = Number.isFinite(satNum) ? deriveSatRarity(satNum) : '-';
                        const rareSatTokens = rareSats !== '-' ? rareSats.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                        const gtx = selected.inscriptionId.replace(/i\d+$/, '');
                        const chainRows: [string, React.ReactNode][] = [
                          ['ID', <span key="id">{truncId(selected.inscriptionId)} <button onClick={() => navigator.clipboard.writeText(selected.inscriptionId)} className="transition-colors hover:text-[#f90]" style={{ color: '#f906' }}>COPY</button></span>],
                          ['CONTENT', <a key="c" className="hover:underline" style={{ color: '#f90', textShadow: '0 0 4px #f903' }} target="_blank" rel="noreferrer" href={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}>VIEW ↗</a>],
                          ['TOKEN', 'ORD'],
                          ['INSC #', ord?.number != null ? String(ord.number) : '---'],
                          ['SAT #', Number.isFinite(satNum) ? String(Math.trunc(satNum)) : '---'],
                          ['TYPE', ord?.content_type || '---'],
                          ['GENESIS', gtx ? <a key="g" className="hover:underline" style={{ color: '#f90', textShadow: '0 0 4px #f903' }} target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${gtx}`}>{truncId(gtx)} ↗</a> : '---'],
                        ];
                        if (ord?.value != null) chainRows.push(['VALUE', `${ord.value} SAT`]);
                        if (ord?.height != null) chainRows.push(['BLOCK', <a key="b" className="hover:underline" style={{ color: '#f90', textShadow: '0 0 4px #f903' }} target="_blank" rel="noreferrer" href={`https://mempool.space/block/${ord.height}`}>{String(ord.height)} ↗</a>]);
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
                                  <span key={`${t}-${i}`} className="px-2 py-0.5 text-[9px] font-black uppercase rounded-sm" style={{ border: ooBorder('#f908'), color: '#f90', background: '#f900a', boxShadow: '0 0 6px #f9002' }}>
                                    {RARE_SAT_SYMBOLS[t] || '◌'} {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {!ordApiData && <p className="text-[9px] mt-1" style={{ color: '#fff2' }}><span style={{ animation: 'ooBlink 0.5s steps(1) infinite' }}>▶</span> LOADING CHAIN DATA...</p>}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {!walletState.connected && (
                    <div className="p-4 text-[11px] font-bold uppercase text-center rounded-sm" style={{ border: ooBorder('#f904'), color: '#f90', background: 'linear-gradient(180deg, #f9008 0%, #f9004 100%)', boxShadow: '0 0 16px #f9008', fontFamily: "'Courier New', monospace" }}>⚡ CONNECT WALLET TO TRADE</div>
                  )}
                  {walletState.connected && (
                    <div className="rounded-sm" style={{ border: ooBorder('#fc04'), background: '#fc005' }}>
                      <div className="px-3 py-2 rounded-t-sm" style={{ background: 'linear-gradient(90deg, #fc015 0%, #fc008 100%)', borderBottom: ooBorder('#fc04') }}>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fc0', textShadow: '0 0 6px #fc04', fontFamily: "'Courier New', monospace" }}>₿ TRADE</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {selected.listing ? (
                          <>
                            <p className="text-sm font-black" style={{ color: '#fc0', animation: 'ooPriceGlow 2s ease-in-out infinite', fontFamily: "'Courier New', monospace" }}>₿ {formatSats(selected.listing.priceSats)} SAT</p>
                            <p className="text-[9px]" style={{ color: '#fff4', fontFamily: "'Courier New', monospace" }}>SELLER: {shortAddress(selected.listing.seller)}</p>
                            {normalizeAddress(selected.listing.seller) === walletAddrNorm ? (
                              <button disabled={busyListingId === selected.listing.id} onClick={handleDelist} className="w-full py-2.5 text-[11px] font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:bg-[#f442] rounded-sm" style={{ border: ooBorder('#f44'), color: '#f44', background: '#f4410', boxShadow: `0 0 12px #f4408, ${ooShadow('#f442')}`, fontFamily: "'Courier New', monospace" }}>✖ DELIST ITEM</button>
                            ) : (
                              <button disabled={busyListingId === selected.listing.id} onClick={handleBuy} className="w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#fc06] rounded-sm" style={{ border: ooBorder('#fc0'), color: '#000', background: 'linear-gradient(180deg, #fc0 0%, #f90 100%)', boxShadow: `0 0 24px #fc04, ${ooShadow('#0002')}`, fontFamily: "'Courier New', monospace" }}>⚡ BUY NOW</button>
                            )}
                          </>
                        ) : selected.isOwnedByConnectedWallet ? (
                          <>
                            <label className="text-[10px] font-bold uppercase" style={{ color: '#fff6', fontFamily: "'Courier New', monospace" }}>LIST PRICE (SATS)</label>
                            <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full px-3 py-2 text-xs font-bold outline-none transition-all focus:border-[#f90] focus:shadow-[0_0_10px_#f903] rounded-sm" style={{ border: ooBorder('#f904'), background: '#00000040', color: '#f90', fontFamily: "'Courier New', monospace" }} />
                            <button disabled={busyListingId === selected.inscriptionId} onClick={handleList} className="w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#d4a6] rounded-sm" style={{ border: ooBorder('#d4a'), color: '#000', background: 'linear-gradient(180deg, #d4a 0%, #a38 100%)', boxShadow: `0 0 24px #d4a4, ${ooShadow('#0002')}`, fontFamily: "'Courier New', monospace" }}>◆ LIST ITEM</button>
                          </>
                        ) : (
                          <p className="text-[10px] font-bold uppercase text-center py-3" style={{ color: '#f906', fontFamily: "'Courier New', monospace" }}>NOT OWNED BY YOUR WALLET</p>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'radial-gradient(circle, #1a0a2ecc 0%, #000f 100%)' }} onClick={() => setFullscreenImage(null)}>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <div className="relative rounded-lg" style={{ animation: 'ooBorderPulse 4s ease-in-out infinite' }}>
                <img src={fullscreenImage.url} alt={fullscreenImage.name} className="block rounded-lg" style={{ border: ooBorder('#f90'), width: 'min(85vmin, 700px)', height: 'min(85vmin, 700px)', objectFit: 'contain', background: '#08020f', boxShadow: '0 0 80px #f9015, 0 0 160px #d4a08' }} />
                <OrnateCorner position="tl" /><OrnateCorner position="tr" /><OrnateCorner position="bl" /><OrnateCorner position="br" />
              </div>
              <p className="text-center text-lg font-black uppercase tracking-[0.2em] mt-4" style={{ color: '#f90', animation: 'ooGlow 3s ease-in-out infinite' }}>{fullscreenImage.name}</p>
              <button onClick={() => setFullscreenImage(null)} className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center text-[11px] font-black transition-all hover:bg-[#f442] rounded-full" style={{ border: ooBorder('#f44'), background: '#0d0518', color: '#f44', boxShadow: '0 0 10px #f4420', fontFamily: "'Courier New', monospace" }}>X</button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-16 mb-6 text-center relative">
          <div className="h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #f903, #d4a3, #fc03, #d4a3, #f903, transparent)' }} />
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full" style={{ background: '#f90', boxShadow: '0 0 6px #f90', animation: 'ooBlink 3s steps(1) infinite' }} />
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#fff2', fontFamily: "'Courier New', monospace" }}>ORDINAL ODDITIES MARKETPLACE</p>
            <span className="text-[10px]" style={{ color: '#fff15' }}>·</span>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#f9015', fontFamily: "'Courier New', monospace" }}>POWERED BY RICHART.APP</p>
            <span className="w-2 h-2 rounded-full" style={{ background: '#d4a', boxShadow: '0 0 6px #d4a', animation: 'ooBlink 3s 1.5s steps(1) infinite' }} />
          </div>
          <div className="mt-3 h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #f903, #d4a3, #fc03, #d4a3, #f903, transparent)' }} />
        </div>
      </div>
    </div>
  );
};
