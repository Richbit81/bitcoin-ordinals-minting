import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { THE_BOX_HASHLIST } from '../data/theBoxHashlist';
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

const THE_BOX_SLUG = 'thebox';
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

const BOX_CSS = `
@keyframes boxGlow {
  0%, 100% { text-shadow: 0 0 10px #f805, 0 0 20px #f805, 0 0 40px #f802; }
  50% { text-shadow: 0 0 16px #f80, 0 0 32px #f807, 0 0 56px #f803, 0 0 80px #ff01; }
}
@keyframes boxTitleGlow {
  0% { text-shadow: 0 0 8px #f80, 0 0 20px #f806, 0 0 40px #f803; filter: brightness(1); }
  33% { text-shadow: 0 0 14px #f80, 0 0 30px #f80a, 0 0 60px #f805; filter: brightness(1.15); }
  66% { text-shadow: 0 0 10px #fa0, 0 0 24px #f808, 0 0 50px #f804; filter: brightness(1.05); }
  100% { text-shadow: 0 0 8px #f80, 0 0 20px #f806, 0 0 40px #f803; filter: brightness(1); }
}
@keyframes boxBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes boxPriceGlow {
  0%, 100% { text-shadow: 0 0 6px #0f0, 0 0 14px #0f05; }
  50% { text-shadow: 0 0 12px #0f0, 0 0 24px #0f07; }
}
@keyframes boxOwnedGlow {
  0%, 100% { box-shadow: 0 0 12px #ff03, 0 0 24px #ff02; border-color: #ff0a0; }
  50% { box-shadow: 0 0 24px #ff06, 0 0 48px #ff03, 0 0 64px #ff01; border-color: #ff0; }
}
@keyframes boxBorderPulse {
  0%, 100% { border-color: #f804; box-shadow: 0 0 8px #f801, inset 0 0 8px #f8005; }
  50% { border-color: #f808; box-shadow: 0 0 16px #f802, inset 0 0 16px #f800a, 0 0 32px #fa008; }
}
@keyframes boxStatFlash {
  0%, 100% { background: #f8008; }
  50% { background: #f8015; }
}
.box-card {
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  position: relative;
  overflow: hidden;
}
.box-card::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 0%, #f8005 50%, transparent 100%);
  transform: translateY(-100%);
  transition: transform 0.4s;
  pointer-events: none;
  z-index: 1;
}
.box-card:hover::before { transform: translateY(100%); }
.box-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 0 24px #f804, 0 0 48px #fa015, 0 8px 32px #0008;
  border-color: #f80 !important;
  z-index: 5;
}
`;

function BoxCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <div className="absolute pointer-events-none" style={{ [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 60, height: 60 }}>
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 60, height: 2, background: '#f80', boxShadow: '0 0 8px #f806' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 0, [isLeft ? 'left' : 'right']: 0, width: 2, height: 60, background: '#f80', boxShadow: '0 0 8px #f806' }} />
      <div style={{ position: 'absolute', [isTop ? 'top' : 'bottom']: 6, [isLeft ? 'left' : 'right']: 6, width: 4, height: 4, background: '#ff0', boxShadow: '0 0 6px #ff08' }} />
    </div>
  );
}

export const TheBoxMarketplacePage: React.FC = () => {
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
    THE_BOX_HASHLIST.forEach((item, idx) => map.set(item.inscriptionId, idx + 1));
    return map;
  }, []);

  const currentAddress = getOrdinalAddress(walletState.accounts || []) || String(walletState.accounts?.[0]?.address || '').trim();
  const paymentAddress = getPaymentAddress(walletState.accounts || []) || currentAddress;
  const walletAddrNorm = normalizeAddress(currentAddress);

  const loadMarketplaceListings = React.useCallback(async () => {
    const rows = await getMarketplaceListings({ status: 'active', collectionSlug: THE_BOX_SLUG, limit: 400 }).catch(() => []);
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
        const hashlistIdSet = new Set(THE_BOX_HASHLIST.map((item) => item.inscriptionId));
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
    let filtered = THE_BOX_HASHLIST.filter((item) => {
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
      if (sortMode === 'number-asc') return a.displayIndex - b.displayIndex;
      if (sortMode === 'number-desc') return b.displayIndex - a.displayIndex;
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
        const prepared = await prepareMarketplaceListingPsbt({ inscriptionId: selected.inscriptionId, collectionSlug: THE_BOX_SLUG, sellerAddress: currentAddress, sellerPaymentAddress: paymentAddress || currentAddress, buyerReceiveAddress: currentAddress, priceSats: Math.floor(price) });
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

  const pxBorder = (color: string) => `2px solid ${color}`;
  const pxShadow = (color: string) => `4px 4px 0px ${color}`;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0f05 0%, #100a02 40%, #080400 100%)', fontFamily: "'Courier New', Courier, monospace" }}>
      <style>{BOX_CSS}</style>

      <div className="absolute pointer-events-none" style={{ top: '10%', left: '5%', width: 400, height: 400, background: 'radial-gradient(circle, #f8008 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ top: '50%', right: '5%', width: 350, height: 350, background: 'radial-gradient(circle, #fa006 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-3 py-6">

        <div className="mb-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#f802]" style={{ border: pxBorder('#f80'), color: '#f80', background: '#f8008', boxShadow: `${pxShadow('#8440')}, 0 0 12px #f801` }}>
            {'<'} BACK
          </button>
        </div>

        <div className="mb-3 relative">
          <div className="relative py-4 px-6">
            <div className="text-center">
              <div className="flex flex-col items-center">
                <img
                  src="/images/Box.png"
                  alt="THE BOX"
                  style={{
                    width: 200,
                    imageRendering: 'auto',
                    filter: 'drop-shadow(0 0 12px #f80) drop-shadow(0 0 30px #f808) drop-shadow(0 0 60px #fa04)',
                    animation: 'boxGlow 3s ease-in-out infinite',
                  }}
                />
                <h2 className="mt-3 text-3xl md:text-4xl font-black uppercase" style={{ color: '#fff', letterSpacing: '0.35em', animation: 'boxTitleGlow 4s ease-in-out infinite' }}>THE BOX</h2>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="h-px flex-1 max-w-[100px]" style={{ background: 'linear-gradient(90deg, transparent, #f80, transparent)' }} />
                <p className="text-xs md:text-sm uppercase tracking-[0.4em] font-bold" style={{ color: '#f80', textShadow: '0 0 10px #f804' }}>69 PIECE COLLECTION</p>
                <span className="h-px flex-1 max-w-[100px]" style={{ background: 'linear-gradient(90deg, transparent, #f80, transparent)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-3 text-[11px] font-bold uppercase tracking-wider">
          {[
            { label: 'ITEMS', value: String(rows.length), color: '#f80', icon: '▣' },
            { label: 'LISTED', value: String(activeListingsCount), color: '#fa0', icon: '◆' },
            { label: 'FLOOR', value: floor > 0 ? `${formatSats(floor)} SAT` : '---', color: '#0f0', icon: '₿' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5 relative" style={{ border: pxBorder(s.color + '80'), background: `linear-gradient(180deg, ${s.color}10 0%, ${s.color}05 100%)`, color: s.color, boxShadow: `inset 0 0 20px ${s.color}10, 0 0 10px ${s.color}15, ${pxShadow('#0002')}`, animation: 'boxStatFlash 4s ease-in-out infinite', minWidth: 120, textAlign: 'center' }}>
              <span style={{ fontSize: 14, marginRight: 6 }}>{s.icon}</span>{s.label}: <span style={{ fontSize: 13 }}>{s.value}</span>
            </div>
          ))}
          <button onClick={() => setMyOnly((v) => !v)} className="px-4 py-2.5 font-bold uppercase transition-all" style={{ border: pxBorder(myOnly ? '#ff0' : ownedIds.size > 0 ? '#ff0a0' : '#ff04'), background: myOnly ? 'linear-gradient(180deg, #ff01a 0%, #ff00a 100%)' : ownedIds.size > 0 ? 'linear-gradient(180deg, #ff010 0%, #ff008 100%)' : 'transparent', color: myOnly ? '#ff0' : ownedIds.size > 0 ? '#ff0' : '#ff06', textShadow: myOnly ? '0 0 8px #ff06' : ownedIds.size > 0 ? '0 0 6px #ff04' : 'none', animation: ownedIds.size > 0 && !myOnly ? 'boxOwnedGlow 2s ease-in-out infinite' : 'none', boxShadow: myOnly ? `0 0 20px #ff04, ${pxShadow('#ff02')}` : 'none' }}>
            ◈ MY ITEMS {walletState.connected ? `[${ownedIds.size}]` : ''}
          </button>
          {myOnly && (
            <button onClick={() => setMyOnly(false)} className="px-4 py-2.5 font-bold uppercase transition-all hover:bg-[#f802]" style={{ border: pxBorder('#f80'), color: '#f80', background: 'linear-gradient(180deg, #f8015 0%, #f8008 100%)', boxShadow: `0 0 16px #f803, ${pxShadow('#0002')}`, textShadow: '0 0 6px #f804' }}>
              ▣ ALL ITEMS
            </button>
          )}
        </div>

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
                className: 'w-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider outline-none transition-all focus:border-[#f80] focus:shadow-[0_0_12px_#f803]',
                style: { ...(el as React.ReactElement).props.style, border: pxBorder('#f803'), background: '#08081080', color: '#f80', fontFamily: "'Courier New', Courier, monospace" },
              })}
            </div>
          ))}
        </div>

        {walletState.connected && loadingOwned && (
          <p className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: '#f808' }}><span style={{ animation: 'boxBlink 0.5s steps(1) infinite', marginRight: 4 }}>▶</span>SCANNING WALLET...</p>
        )}
        {walletState.connected && ownershipError && (
          <p className="mb-2 text-[10px] uppercase" style={{ color: '#f44' }}>✖ ERR: {ownershipError}</p>
        )}
        {actionMessage && (
          <div className="mb-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ border: pxBorder('#0f06'), color: '#0f0', background: '#0f008', animation: 'boxPriceGlow 1.5s ease-in-out infinite' }}>✔ {actionMessage}</div>
        )}
        {actionError && (
          <div className="mb-3 px-4 py-2 text-[11px] font-bold uppercase" style={{ border: pxBorder('#f446'), color: '#f44', background: '#f4408' }}>✖ {actionError}</div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {rows.map((row) => {
            const contentUrl = `https://ordinals.com/content/${encodeURIComponent(row.inscriptionId)}`;
            const ownerAddr = ownerByInscription[row.inscriptionId] || (row.isOwnedByConnectedWallet && currentAddress ? currentAddress : row.listing?.seller || '');
            const isListed = !!row.listing;
            const borderColor = isListed ? '#0f0' : row.isOwnedByConnectedWallet ? '#ff0' : '#f802';
            const glowColor = isListed ? '#0f0' : row.isOwnedByConnectedWallet ? '#ff0' : '#f80';

            return (
              <article key={row.inscriptionId} className="box-card" style={{ border: pxBorder(borderColor), background: 'linear-gradient(180deg, #1a1008 0%, #0f0a04 100%)', boxShadow: `0 0 12px ${glowColor}08, ${pxShadow('#0002')}` }}>
                {isListed && (
                  <div className="absolute top-0 right-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase" style={{ background: '#0f0', color: '#000', boxShadow: '0 0 8px #0f04' }}>FOR SALE</div>
                )}
                {row.isOwnedByConnectedWallet && !isListed && (
                  <div className="absolute top-0 left-0 z-10 px-2 py-0.5 text-[8px] font-black uppercase" style={{ background: '#ff0', color: '#000', boxShadow: '0 0 8px #ff04' }}>OWNED</div>
                )}
                <button onClick={() => setSelectedId(row.inscriptionId)} className="aspect-square w-full overflow-hidden text-left relative" style={{ background: '#000' }}>
                  <img src={contentUrl} title={row.name} alt={row.name} className="h-full w-full object-contain relative z-[2]" loading="lazy" />
                  <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 20px #00000080' }} />
                </button>
                <div className="p-2" style={{ borderTop: pxBorder(borderColor) }}>
                  <h3 className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: '#f80', textShadow: '0 0 4px #f803' }}>{row.name}</h3>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] font-bold" style={{ color: '#fa08' }}>#{row.displayIndex}</span>
                    <span className="text-[7px]" style={{ color: '#fff3' }}>{ownerAddr ? shortAddress(ownerAddr) : '---'}</span>
                  </div>
                  {isListed ? (
                    <div className="mt-2 px-2 py-1.5 text-center" style={{ border: pxBorder('#0f06'), background: 'linear-gradient(180deg, #0f00f 0%, #0f008 100%)' }}>
                      <span className="text-[10px] font-black" style={{ color: '#0f0', animation: 'boxPriceGlow 2s ease-in-out infinite' }}>₿ {formatSats(row.listing!.priceSats)} SAT</span>
                    </div>
                  ) : (
                    <div className="mt-2 px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ border: pxBorder('#fff08'), color: '#fff15' }}>○ NOT LISTED</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'radial-gradient(circle at 50% 50%, #0008 0%, #000d 100%)' }} onClick={() => setSelectedId(null)}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" style={{ border: pxBorder('#f80'), background: 'linear-gradient(180deg, #1a1008 0%, #0f0a04 50%, #0a0804 100%)', boxShadow: '0 0 60px #f8015, 0 0 120px #fa00a, 0 20px 60px #0008', animation: 'boxBorderPulse 4s ease-in-out infinite' }} onClick={(e) => e.stopPropagation()}>
              <BoxCorner position="tl" /><BoxCorner position="tr" /><BoxCorner position="bl" /><BoxCorner position="br" />
              <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: pxBorder('#f803'), background: 'linear-gradient(180deg, #f8008 0%, transparent 100%)' }}>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider" style={{ color: '#f80', textShadow: '0 0 12px #f804' }}>{selected.name}</h2>
                  <p className="text-[10px] font-bold mt-0.5" style={{ color: '#fa0', textShadow: '0 0 6px #fa03' }}>ITEM #{selected.displayIndex} OF 69</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#fff3' }}>{selected.inscriptionId}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="px-3 py-1.5 text-[10px] font-black uppercase transition-all hover:bg-[#f442]" style={{ border: pxBorder('#f44'), color: '#f44', boxShadow: '0 0 8px #f4420' }}>[X] CLOSE</button>
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                <div className="p-4">
                  <div className="aspect-square overflow-hidden cursor-pointer transition-all hover:shadow-[0_0_30px_#f803] relative" style={{ border: pxBorder('#f804'), background: '#000' }} onClick={() => setFullscreenImage({ url: `https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`, name: selected.name })}>
                    <img src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`} alt={selected.name} className="h-full w-full object-contain relative z-[2]" />
                    <div className="absolute inset-0 z-[3] pointer-events-none" style={{ boxShadow: 'inset 0 0 30px #00000060' }} />
                  </div>
                  <p className="mt-2 text-center text-[9px] uppercase tracking-wider" style={{ color: '#fff3' }}><span style={{ animation: 'boxBlink 2s steps(1) infinite' }}>▶</span> CLICK TO ENLARGE</p>
                </div>

                <div className="p-4 space-y-3">
                  <div style={{ border: pxBorder('#f803'), background: '#f8005' }}>
                    <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #f8015 0%, #f8008 100%)', borderBottom: pxBorder('#f803') }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f80', textShadow: '0 0 6px #f804' }}>▣ DETAILS</p>
                    </div>
                    <div className="px-3 py-2 space-y-1.5 text-[10px]">
                      {([
                        ['COLLECTION', 'THE BOX'],
                        ['ITEM', `#${selected.displayIndex} OF 69`],
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
                    {selectedDetailLoading && <p className="px-3 pb-2 text-[9px]" style={{ color: '#f806' }}><span style={{ animation: 'boxBlink 0.5s steps(1) infinite' }}>▶</span> LOADING...</p>}
                    {selectedDetailError && <p className="px-3 pb-2 text-[9px]" style={{ color: '#f44' }}>✖ {selectedDetailError}</p>}
                  </div>

                  <div style={{ border: pxBorder('#fa03'), background: '#fa005' }}>
                    <div className="px-3 py-2" style={{ background: 'linear-gradient(90deg, #fa015 0%, #fa008 100%)', borderBottom: pxBorder('#fa03') }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fa0', textShadow: '0 0 6px #fa04' }}>◈ CHAIN DATA</p>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-[10px]">
                      {(() => {
                        const ord = ordApiData || {} as any;
                        const satNum = ord?.sat != null ? Number(ord.sat) : NaN;
                        const rareSats = Number.isFinite(satNum) ? deriveSatRarity(satNum) : '-';
                        const rareSatTokens = rareSats !== '-' ? rareSats.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                        const gtx = selected.inscriptionId.replace(/i\d+$/, '');
                        const chainRows: [string, React.ReactNode][] = [
                          ['ID', <span key="id">{truncId(selected.inscriptionId)} <button onClick={() => navigator.clipboard.writeText(selected.inscriptionId)} className="transition-colors hover:text-[#f80]" style={{ color: '#f806' }}>COPY</button></span>],
                          ['CONTENT', <a key="c" className="hover:underline" style={{ color: '#f80', textShadow: '0 0 4px #f803' }} target="_blank" rel="noreferrer" href={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}>VIEW ↗</a>],
                          ['TOKEN', 'ORD'],
                          ['INSC #', ord?.number != null ? String(ord.number) : '---'],
                          ['SAT #', Number.isFinite(satNum) ? String(Math.trunc(satNum)) : '---'],
                          ['TYPE', ord?.content_type || '---'],
                          ['GENESIS', gtx ? <a key="g" className="hover:underline" style={{ color: '#f80', textShadow: '0 0 4px #f803' }} target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${gtx}`}>{truncId(gtx)} ↗</a> : '---'],
                        ];
                        if (ord?.value != null) chainRows.push(['VALUE', `${ord.value} SAT`]);
                        if (ord?.height != null) chainRows.push(['BLOCK', <a key="b" className="hover:underline" style={{ color: '#f80', textShadow: '0 0 4px #f803' }} target="_blank" rel="noreferrer" href={`https://mempool.space/block/${ord.height}`}>{String(ord.height)} ↗</a>]);
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
                            {!ordApiData && <p className="text-[9px] mt-1" style={{ color: '#fff2' }}><span style={{ animation: 'boxBlink 0.5s steps(1) infinite' }}>▶</span> LOADING CHAIN DATA...</p>}
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
                            <p className="text-sm font-black" style={{ color: '#0f0', animation: 'boxPriceGlow 2s ease-in-out infinite' }}>₿ {formatSats(selected.listing.priceSats)} SAT</p>
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
                            <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full px-3 py-2 text-xs font-bold outline-none transition-all focus:border-[#f80] focus:shadow-[0_0_10px_#f803]" style={{ border: pxBorder('#f804'), background: '#00000040', color: '#f80', fontFamily: "'Courier New', Courier, monospace" }} />
                            <button disabled={busyListingId === selected.inscriptionId} onClick={handleList} className="w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all hover:shadow-[0_0_30px_#fa06]" style={{ border: pxBorder('#fa0'), color: '#000', background: 'linear-gradient(180deg, #fa0 0%, #c80 100%)', boxShadow: `0 0 24px #fa04, ${pxShadow('#0002')}` }}>◆ LIST ITEM</button>
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

        {fullscreenImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'radial-gradient(circle, #000c 0%, #000f 100%)' }} onClick={() => setFullscreenImage(null)}>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <div className="relative" style={{ animation: 'boxBorderPulse 4s ease-in-out infinite' }}>
                <img src={fullscreenImage.url} alt={fullscreenImage.name} className="block" style={{ border: pxBorder('#f80'), width: 'min(85vmin, 700px)', height: 'min(85vmin, 700px)', objectFit: 'contain', background: '#000', boxShadow: '0 0 80px #f8015, 0 0 160px #fa008' }} />
                <BoxCorner position="tl" /><BoxCorner position="tr" /><BoxCorner position="bl" /><BoxCorner position="br" />
              </div>
              <p className="text-center text-lg font-black uppercase tracking-[0.2em] mt-4" style={{ color: '#f80', animation: 'boxGlow 3s ease-in-out infinite' }}>{fullscreenImage.name}</p>
              <button onClick={() => setFullscreenImage(null)} className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center text-[11px] font-black transition-all hover:bg-[#f442]" style={{ border: pxBorder('#f44'), background: '#0a0a14', color: '#f44', boxShadow: '0 0 10px #f4420' }}>X</button>
            </div>
          </div>
        )}

        <div className="mt-16 mb-6 text-center relative">
          <div className="h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #f803, #fa03, #0f03, #fa03, #f803, transparent)' }} />
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="w-2 h-2" style={{ background: '#f80', boxShadow: '0 0 4px #f80', animation: 'boxBlink 3s steps(1) infinite' }} />
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#fff2' }}>THE BOX MARKETPLACE</p>
            <span className="text-[10px]" style={{ color: '#fff15' }}>·</span>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: '#f8015' }}>POWERED BY RICHART.APP</p>
            <span className="w-2 h-2" style={{ background: '#fa0', boxShadow: '0 0 4px #fa0', animation: 'boxBlink 3s 1.5s steps(1) infinite' }} />
          </div>
          <div className="mt-3 h-px w-full max-w-lg mx-auto" style={{ background: 'linear-gradient(90deg, transparent, #f803, #fa03, #0f03, #fa03, #f803, transparent)' }} />
        </div>
      </div>
    </div>
  );
};
