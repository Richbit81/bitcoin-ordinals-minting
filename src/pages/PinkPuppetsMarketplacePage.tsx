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
  getMarketplaceWalletInscriptionsViaUnisat,
  prepareMarketplaceListingPsbt,
  prepareMarketplacePurchaseAdvanced,
} from '../services/marketplaceService';
import { getOrdinalAddress, getPaymentAddress, signPSBT } from '../utils/wallet';

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
const ORD_SERVER_URL = String(import.meta.env.VITE_ORD_SERVER_URL || 'https://api.richart.app').replace(/\/+$/, '');

const formatSats = (value: number) => new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(value)));
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
  const [ownedIds, setOwnedIds] = React.useState<Set<string>>(new Set());
  const [loadingOwned, setLoadingOwned] = React.useState(false);
  const [ownershipError, setOwnershipError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [busyListingId, setBusyListingId] = React.useState<string | null>(null);
  const [ownerByInscription, setOwnerByInscription] = React.useState<Record<string, string>>({});
  const [selectedDetailLoading, setSelectedDetailLoading] = React.useState(false);
  const [selectedDetailError, setSelectedDetailError] = React.useState<string | null>(null);
  const resolvingOwnerIdsRef = React.useRef<Set<string>>(new Set());
  const scoreModel = React.useMemo(() => buildPinkPuppetScoreModel(), []);
  const itemIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    PINK_PUPPETS_HASHLIST.forEach((item, idx) => map.set(item.inscriptionId, idx + 1));
    return map;
  }, []);

  const currentAddress = getOrdinalAddress(walletState.accounts || []) || String(walletState.accounts?.[0]?.address || '').trim();
  const paymentAddress = getPaymentAddress(walletState.accounts || []) || currentAddress;
  const walletAddrNorm = normalizeAddress(currentAddress);

  const loadMarketplaceListings = React.useCallback(async () => {
    const rows = await getMarketplaceListings({
      status: 'active',
      collectionSlug: PINK_PUPPETS_SLUG,
      limit: 400,
    }).catch(() => []);
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

  React.useEffect(() => {
    void loadMarketplaceListings();
  }, [loadMarketplaceListings]);

  const resolveOwnerAddress = React.useCallback(async (inscriptionId: string): Promise<string> => {
    const detail = await getMarketplaceInscriptionDetail(inscriptionId);
    const ownerFromMarketplace = String(detail?.marketplaceInscription?.owner_address || '').trim();
    const ownerFromChain = String(
      detail?.chainInfo?.ownerAddress || detail?.chainInfo?.owner_address || detail?.chainInfo?.address || ''
    ).trim();
    return ownerFromMarketplace || ownerFromChain;
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
        const addresses = walletState.accounts
          .map((acc) => String(acc?.address || '').trim())
          .filter(Boolean);
        const uniqAddresses = Array.from(new Set(addresses));
        const allWalletIds = new Set<string>();
        for (const address of uniqAddresses) {
          const rows = await getMarketplaceWalletInscriptionsViaUnisat(address).catch(() => []);
          for (const row of rows) {
            const inscriptionId = String(row?.inscription_id || '').trim();
            if (inscriptionId) allWalletIds.add(inscriptionId);
          }
        }
        const hashlistIdSet = new Set(PINK_PUPPETS_HASHLIST.map((item) => item.inscriptionId));
        const nextOwned = new Set<string>();
        for (const id of allWalletIds) {
          if (hashlistIdSet.has(id)) nextOwned.add(id);
        }
        if (!cancelled) setOwnedIds(nextOwned);
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
  }, [walletState.connected, walletState.accounts]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedId) return;
      if (ownerByInscription[selectedId]) {
        setSelectedDetailLoading(false);
        setSelectedDetailError(null);
        return;
      }
      setSelectedDetailLoading(true);
      setSelectedDetailError(null);
      try {
        const resolvedOwner = await resolveOwnerAddress(selectedId);
        if (!cancelled && resolvedOwner) {
          setOwnerByInscription((prev) => ({ ...prev, [selectedId]: resolvedOwner }));
        }
      } catch (err: any) {
        if (!cancelled) setSelectedDetailError(err?.message || 'Could not load inscription owner');
      } finally {
        if (!cancelled) setSelectedDetailLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [ownerByInscription, resolveOwnerAddress, selectedId]);

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

  React.useEffect(() => {
    let cancelled = false;
    const missingIds = rows
      .map((row) => row.inscriptionId)
      .filter((id) => !ownerByInscription[id] && !resolvingOwnerIdsRef.current.has(id));
    if (missingIds.length === 0) return;

    const run = async () => {
      const batchSize = 4;
      for (let i = 0; i < missingIds.length && !cancelled; i += batchSize) {
        const batch = missingIds.slice(i, i + batchSize);
        batch.forEach((id) => resolvingOwnerIdsRef.current.add(id));
        const results = await Promise.all(
          batch.map(async (id) => {
            try {
              const owner = await resolveOwnerAddress(id);
              return { id, owner };
            } catch {
              return { id, owner: '' };
            } finally {
              resolvingOwnerIdsRef.current.delete(id);
            }
          })
        );
        if (cancelled) return;
        setOwnerByInscription((prev) => {
          let next = prev;
          for (const row of results) {
            if (!row.owner || next[row.id]) continue;
            if (next === prev) next = { ...prev };
            next[row.id] = row.owner;
          }
          return next;
        });
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [ownerByInscription, resolveOwnerAddress, rows]);

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

  const handleBuy = () => {
    void (async () => {
      try {
        if (!selected?.listing || !walletAddrNorm) throw new Error('No listing selected');
        if (!walletState.walletType) throw new Error('Connect wallet first');
        if (normalizeAddress(selected.listing.seller) === walletAddrNorm) throw new Error('Cannot buy your own listing');
        setActionError(null);
        setActionMessage(null);
        setBusyListingId(selected.listing.id);
        const prepared = await prepareMarketplacePurchaseAdvanced({
          listingId: selected.listing.id,
          buyerAddress: currentAddress,
          fundingAddress: paymentAddress || currentAddress,
          fundingAddressCandidates: Array.from(new Set([currentAddress, paymentAddress].filter(Boolean))),
        });
        const signed = await signPSBT(
          prepared.fundedPsbtBase64,
          walletState.walletType,
          false,
          currentAddress,
          undefined,
          Array.isArray(prepared.funding?.buyerSigningIndexes) ? prepared.funding.buyerSigningIndexes : undefined
        );
        const signedIsHex = /^[0-9a-fA-F]+$/.test(String(signed || '').trim());
        await completeMarketplacePurchaseAdvanced({
          listingId: selected.listing.id,
          buyerAddress: currentAddress,
          signedPsbtHex: signedIsHex ? signed : undefined,
          signedPsbtBase64: signedIsHex ? undefined : signed,
        });
        setActionMessage('Purchase completed via wallet signature.');
        await loadMarketplaceListings();
      } catch (err: any) {
        setActionError(err?.message || 'Buy failed');
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
      <div className="absolute inset-0 bg-[#130015]/40" />
      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-4 py-8">
        <div className="mb-3 flex items-center">
          <button onClick={() => navigate('/pinkpuppets')} className="rounded-lg border border-pink-300/70 bg-black/35 px-3 py-2 text-sm text-pink-100 hover:bg-pink-900/30">← Back to PinkPuppets</button>
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
          <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Floor: <b>{floor > 0 ? `${formatSats(floor)} sats` : '-'}</b></span>
          <button
            onClick={() => setMyOnly((v) => !v)}
            className={`rounded-full border px-3 py-1 font-semibold ${myOnly ? 'border-pink-200 bg-pink-500/30 text-pink-50' : 'border-pink-300/60 bg-black/35 text-pink-100'}`}
          >
            My Puppets {walletState.connected ? `(${ownedIds.size})` : ''}
          </button>
        </div>

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
                      <div className="flex justify-between"><span>Price</span><b>{formatSats(row.listing.priceSats)} sats</b></div>
                      <div className="flex justify-between"><span>Seller</span><span>{shortAddress(row.listing.seller)}</span></div>
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
                <div className="aspect-square overflow-hidden rounded-lg border border-pink-300/60 bg-[#140014]">
                  <img
                    src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}
                    title={selected.name}
                    alt={selected.name}
                    className="h-full w-full object-contain p-1"
                  />
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
                        <span>{selected.listing ? `${formatSats(selected.listing.priceSats)} sats` : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Listed At</span>
                        <span>{selected.listing ? formatDateTime(selected.listing.listedAt) : '-'}</span>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-pink-300/30 bg-black/40 p-2">
                      <p className="text-[10px] text-pink-200/70">Inscription ID</p>
                      <p className="mt-1 break-all text-[11px] text-pink-100">{selected.inscriptionId}</p>
                    </div>
                    <div className="mt-2 rounded border border-pink-300/30 bg-black/40 p-2">
                      <p className="text-[10px] text-pink-200/70">Owner Address</p>
                      <p className="mt-1 break-all text-[11px] text-pink-100">{selectedOwnerAddress || '-'}</p>
                    </div>
                    {selectedDetailLoading && <p className="mt-2 text-[11px] text-pink-200/70">Loading owner wallet...</p>}
                    {selectedDetailError && <p className="mt-2 text-[11px] text-yellow-200">Owner fetch failed: {selectedDetailError}</p>}
                  </div>

                  <div className="rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                    <p>Tech Score: <b>{selected.techScore.toFixed(2)}</b></p>
                    <p className="mt-1 text-xs text-pink-200/85">Percentile: <b>{selected.rarityPercentile.toFixed(2)}%</b></p>
                    <p className="mt-1 text-xs text-pink-200/75">Breakdown (PinkPuppets v2):</p>
                    <ul className="mt-1 space-y-1 text-xs text-pink-100/85">
                      <li>Trait Rarity (55%): <b>{selected.scoreBreakdown.traitComponent.toFixed(2)}</b></li>
                      <li>Trait Combo (20%): <b>{selected.scoreBreakdown.comboComponent.toFixed(2)}</b></li>
                      <li>Attribute Complexity (15%): <b>{selected.scoreBreakdown.complexityComponent.toFixed(2)}</b></li>
                      <li>Edition Context (10%): <b>{selected.scoreBreakdown.eraComponent.toFixed(2)}</b></li>
                    </ul>
                    <p className="mt-1">Traits:</p>
                    <ul className="mt-1 space-y-1 text-xs text-pink-100/85">
                      {selected.attributes.map((attr, i) => (
                        <li key={`${attr.trait_type}-${attr.value}-${i}`}>{attr.trait_type}: <b>{attr.value}</b></li>
                      ))}
                    </ul>
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
                          <p>Listed at <b>{formatSats(selected.listing.priceSats)} sats</b></p>
                          <p className="text-xs text-pink-200/70">Seller: {shortAddress(selected.listing.seller)}</p>
                          {normalizeAddress(selected.listing.seller) === walletAddrNorm ? (
                            <button disabled={busyListingId === selected.listing.id} onClick={handleDelist} className="w-full rounded border-2 border-black bg-pink-300 px-3 py-2 text-xs font-bold text-black disabled:opacity-60">Delist</button>
                          ) : (
                            <button disabled={busyListingId === selected.listing.id} onClick={handleBuy} className="w-full rounded border-2 border-black bg-[#ff4fcf] px-3 py-2 text-xs font-bold text-black disabled:opacity-60">Buy Now</button>
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
      </div>
    </div>
  );
};

