import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  acceptMarketplaceOffer,
  cancelMarketplaceListing,
  completeMarketplaceOfferSale,
  completeMarketplacePurchaseAdvanced,
  completeMarketplacePurchase,
  createMarketplaceOffer,
  createMarketplaceListing,
  declineMarketplaceOffer,
  getMarketplaceCollections,
  getMarketplaceInscriptionDetail,
  getMarketplaceListings,
  getMarketplaceRanking,
  MarketplaceCollection,
  MarketplaceCollectionRanking,
  MarketplaceInscriptionDetail,
  MarketplaceListing,
} from '../services/marketplaceService';
import { sendMultipleBitcoinPayments, signPSBT } from '../utils/wallet';
import { isAdminAddress } from '../config/admin';

const PreviewImage: React.FC<{
  inscriptionId: string;
  alt: string;
  className: string;
  imageClassName?: string;
}> = ({ inscriptionId, alt, className, imageClassName = '' }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = `https://ordinals.com/content/${encodeURIComponent(inscriptionId)}`;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-zinc-800" />}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-gray-500 text-xs">
          Preview unavailable
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(false);
        }}
        className={`h-full w-full object-cover ${imageClassName} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      />
    </div>
  );
};

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [ranking, setRanking] = useState<MarketplaceCollectionRanking[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [soldListings, setSoldListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'latest' | 'price-asc' | 'price-desc'>('latest');
  const [showTraitFilters, setShowTraitFilters] = useState(false);
  const [selectedTraitFilters, setSelectedTraitFilters] = useState<Record<string, string[]>>({});
  const [collectionsMeta, setCollectionsMeta] = useState<MarketplaceCollection[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInscriptionDetail, setSelectedInscriptionDetail] = useState<MarketplaceInscriptionDetail | null>(null);
  const [selectedDetailListing, setSelectedDetailListing] = useState<MarketplaceListing | null>(null);
  const [offerPriceSats, setOfferPriceSats] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerActionBusyId, setOfferActionBusyId] = useState<string | null>(null);
  const [offerTxids, setOfferTxids] = useState<Record<string, string>>({});
  const [offerCompleteBusyId, setOfferCompleteBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    inscriptionId: '',
    collectionSlug: '',
    priceSats: '10000',
  });
  const currentAddress = walletState.accounts?.[0]?.address || '';
  const isAdminUser = isAdminAddress(currentAddress);

  useEffect(() => {
    if (!isAdminUser) return;
    const loadRanking = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rankingData, collectionsData] = await Promise.all([
          getMarketplaceRanking(),
          getMarketplaceCollections({ includeInactive: true, adminAddress: currentAddress }),
        ]);
        setRanking(rankingData);
        setCollectionsMeta(collectionsData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load ranking');
      } finally {
        setLoading(false);
      }
    };
    loadRanking();
  }, [isAdminUser, currentAddress]);

  const loadListings = async () => {
    try {
      setListingsLoading(true);
      const [activeData, soldData] = await Promise.all([
        getMarketplaceListings({ status: 'active', limit: 100 }),
        getMarketplaceListings({ status: 'sold', limit: 20 }),
      ]);
      setListings(activeData);
      setSoldListings(soldData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load listings');
    } finally {
      setListingsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminUser) return;
    loadListings();
  }, [isAdminUser]);

  const handleCreateListing = async () => {
    if (!isAdminUser) {
      setError('Marketplace is currently admin-only');
      return;
    }
    if (!walletState.connected || !currentAddress) {
      setError('Please connect wallet first');
      return;
    }
    try {
      setError(null);
      setActionMessage(null);
      const priceSats = Number(form.priceSats);
      if (!form.inscriptionId.trim()) throw new Error('Inscription ID is required');
      if (!Number.isFinite(priceSats) || priceSats <= 0) throw new Error('Price must be > 0');

      await createMarketplaceListing({
        inscriptionId: form.inscriptionId.trim(),
        collectionSlug: form.collectionSlug.trim() || 'unknown',
        sellerAddress: currentAddress,
        buyerReceiveAddress: currentAddress,
        priceSats: Math.round(priceSats),
      });

      setActionMessage('Listing created successfully.');
      setForm((prev) => ({ ...prev, inscriptionId: '' }));
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to create listing');
    }
  };

  const handleCancelListing = async (listingId: string) => {
    try {
      if (!isAdminUser) throw new Error('Marketplace is currently admin-only');
      if (!currentAddress) throw new Error('Connect wallet first');
      setBusyListingId(listingId);
      setError(null);
      setActionMessage(null);
      await cancelMarketplaceListing(listingId, currentAddress);
      setActionMessage('Listing cancelled.');
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel listing');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleBuyListing = async (listing: MarketplaceListing) => {
    try {
      if (!isAdminUser) throw new Error('Marketplace is currently admin-only');
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      setBusyListingId(listing.id);
      setError(null);
      setActionMessage(null);

      // Step 1: Payment from buyer wallet to seller
      const txid = await sendMultipleBitcoinPayments(
        [{ address: listing.seller_address, amount: Number(listing.price_sats) / 100000000 }],
        walletState.walletType
      );

      // Step 2: Mark completed sale in backend
      await completeMarketplacePurchase({
        listingId: listing.id,
        buyerAddress: currentAddress,
        paymentTxid: txid,
      });

      setActionMessage(`Purchase completed. Payment txid: ${txid}`);
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to buy listing');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleAdvancedBuyListing = async (listing: MarketplaceListing) => {
    try {
      if (!isAdminUser) throw new Error('Marketplace is currently admin-only');
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      if (!listing.signed_psbt_base64) {
        throw new Error('Listing has no signed PSBT data');
      }

      setBusyListingId(listing.id);
      setError(null);
      setActionMessage(null);

      // Wallet signs the listing PSBT payload (advanced non-custodial mode).
      const signedPsbtData = await signPSBT(
        listing.signed_psbt_base64,
        walletState.walletType,
        false,
        currentAddress
      );

      const result = await completeMarketplacePurchaseAdvanced({
        listingId: listing.id,
        buyerAddress: currentAddress,
        signedPsbtBase64: signedPsbtData,
      });

      setActionMessage(`Advanced PSBT purchase completed. Txid: ${result.paymentTxid}`);
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed advanced PSBT buy');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleOpenDetail = async (listing: MarketplaceListing) => {
    try {
      setDetailLoading(true);
      setError(null);
      setDetailOpen(true);
      setSelectedDetailListing(listing);
      setOfferPriceSats(String(Math.max(1, Math.floor(Number(listing.price_sats || 0) * 0.95))));
      setOfferNote('');
      const detail = await getMarketplaceInscriptionDetail(listing.inscription_id);
      setSelectedInscriptionDetail(detail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ordinal details');
      setSelectedInscriptionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateOfferFromDetail = async () => {
    try {
      if (!selectedDetailListing) throw new Error('No listing selected');
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      const offerSats = Math.round(Number(offerPriceSats || 0));
      if (!Number.isFinite(offerSats) || offerSats <= 0) throw new Error('Offer price must be greater than 0');
      if (currentAddress.toLowerCase() === selectedDetailListing.seller_address.toLowerCase()) {
        throw new Error('Seller cannot create own offer');
      }

      setOfferSubmitting(true);
      setError(null);
      setActionMessage(null);
      await createMarketplaceOffer({
        listingId: selectedDetailListing.id,
        buyerAddress: currentAddress,
        offerPriceSats: offerSats,
        note: offerNote.trim(),
      });
      setActionMessage('Offer submitted successfully.');
      const refreshed = await getMarketplaceInscriptionDetail(selectedDetailListing.inscription_id);
      setSelectedInscriptionDetail(refreshed);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit offer');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleOfferDecision = async (offerId: string, decision: 'accept' | 'decline') => {
    try {
      if (!selectedDetailListing) throw new Error('No listing selected');
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      setOfferActionBusyId(offerId);
      setError(null);
      setActionMessage(null);

      if (decision === 'accept') {
        await acceptMarketplaceOffer({
          listingId: selectedDetailListing.id,
          offerId,
          walletAddress: currentAddress,
        });
        setActionMessage('Offer accepted.');
      } else {
        await declineMarketplaceOffer({
          listingId: selectedDetailListing.id,
          offerId,
          walletAddress: currentAddress,
        });
        setActionMessage('Offer declined.');
      }

      const refreshed = await getMarketplaceInscriptionDetail(selectedDetailListing.inscription_id);
      setSelectedInscriptionDetail(refreshed);
    } catch (err: any) {
      setError(err?.message || `Failed to ${decision} offer`);
    } finally {
      setOfferActionBusyId(null);
    }
  };

  const handleCompleteOfferSale = async (offerId: string) => {
    try {
      if (!selectedDetailListing) throw new Error('No listing selected');
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      const paymentTxid = String(offerTxids[offerId] || '').trim();
      setOfferCompleteBusyId(offerId);
      setError(null);
      setActionMessage(null);
      const result = await completeMarketplaceOfferSale({
        listingId: selectedDetailListing.id,
        offerId,
        walletAddress: currentAddress,
        paymentTxid: paymentTxid || undefined,
      });
      setActionMessage(
        `Offer sale completed${result.paymentTxid ? `. Txid: ${result.paymentTxid}` : ''}.`
      );
      const [refreshedDetail] = await Promise.all([
        getMarketplaceInscriptionDetail(selectedDetailListing.inscription_id),
        loadListings(),
        getMarketplaceRanking().then(setRanking),
      ]);
      setSelectedInscriptionDetail(refreshedDetail);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete offer sale');
    } finally {
      setOfferCompleteBusyId(null);
    }
  };

  if (!isAdminUser) {
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Ordinals Marketplace</h1>
          <p className="text-sm text-gray-400 mb-6">
            Marketplace is currently visible for admin wallet only.
          </p>
          <div className="border border-red-600/60 rounded-lg p-4 bg-zinc-900/60">
            <p className="text-sm text-red-300 font-semibold">Admin wallet required.</p>
            <p className="text-xs text-gray-400 mt-2">
              Connect with an authorized admin wallet address to access marketplace features.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalListed = listings.length;
  const floorPriceSats = listings.reduce((min, l) => {
    const price = Number(l.price_sats || 0);
    if (price <= 0) return min;
    if (min === 0) return price;
    return Math.min(min, price);
  }, 0);
  const volumeSoldSats = soldListings.reduce((sum, s) => sum + Number(s.price_sats || 0), 0);
  const sold24h = soldListings.filter((s) => {
    const ts = Date.parse(s.updated_at || s.created_at || '');
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= 24 * 60 * 60 * 1000;
  }).length;
  const avgPriceSats = totalListed
    ? Math.round(listings.reduce((sum, l) => sum + Number(l.price_sats || 0), 0) / totalListed)
    : 0;
  const sortedPrices = listings
    .map((l) => Number(l.price_sats || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const highValueThreshold =
    sortedPrices.length > 0 ? sortedPrices[Math.max(0, Math.floor(sortedPrices.length * 0.85) - 1)] : 0;
  const verifiedCollectionSet = useMemo(
    () =>
      new Set(
        collectionsMeta
          .filter((c) => !!c.verified)
          .map((c) => String(c.slug || '').trim())
          .filter(Boolean)
      ),
    [collectionsMeta]
  );

  const collectionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) {
      if (l.collection_slug) set.add(l.collection_slug);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const extractTraits = (l: MarketplaceListing): Array<{ trait_type: string; value: string }> => {
    const rows = Array.isArray(l.inscription_attributes) ? l.inscription_attributes : [];
    return rows
      .map((t) => ({
        trait_type: String(t?.trait_type || '').trim(),
        value: String(t?.value || '').trim(),
      }))
      .filter((t) => t.trait_type && t.value);
  };

  const extractRareSats = (l: MarketplaceListing): string => {
    const md = l.inscription_metadata || {};
    const raw =
      md?.rareSats ??
      md?.rare_sats ??
      md?.rareSat ??
      md?.rare_sat ??
      md?.satributes?.rarity;
    if (raw === undefined || raw === null || raw === '') return '-';
    if (typeof raw === 'number') return raw.toLocaleString();
    return String(raw);
  };

  const baseFilteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((l) => {
      const matchCollection =
        collectionFilter === 'all' || String(l.collection_slug || '') === collectionFilter;
      if (!matchCollection) return false;
      if (!q) return true;
      return (
        String(l.inscription_id || '').toLowerCase().includes(q) ||
        String(l.collection_slug || '').toLowerCase().includes(q) ||
        String(l.seller_address || '').toLowerCase().includes(q)
      );
    });
  }, [listings, searchQuery, collectionFilter]);

  const traitOptions = useMemo(() => {
    const traitMap = new Map<string, Map<string, number>>();
    for (const l of baseFilteredListings) {
      for (const t of extractTraits(l)) {
        if (!traitMap.has(t.trait_type)) traitMap.set(t.trait_type, new Map<string, number>());
        const inner = traitMap.get(t.trait_type)!;
        inner.set(t.value, (inner.get(t.value) || 0) + 1);
      }
    }
    return Array.from(traitMap.entries())
      .map(([traitType, valueMap]) => ({
        traitType,
        values: Array.from(valueMap.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => a.traitType.localeCompare(b.traitType));
  }, [baseFilteredListings]);

  const selectedTraitCount = useMemo(
    () => Object.values(selectedTraitFilters).reduce((sum, arr) => sum + (arr?.length || 0), 0),
    [selectedTraitFilters]
  );

  const filteredListings = useMemo(() => {
    let rows = baseFilteredListings.filter((l) => {
      const activeTraitTypes = Object.entries(selectedTraitFilters).filter(([, vals]) => vals && vals.length > 0);
      if (activeTraitTypes.length === 0) return true;
      const traits = extractTraits(l);
      return activeTraitTypes.every(([traitType, vals]) =>
        traits.some((t) => t.trait_type === traitType && vals.includes(t.value))
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === 'price-asc') return Number(a.price_sats || 0) - Number(b.price_sats || 0);
      if (sortMode === 'price-desc') return Number(b.price_sats || 0) - Number(a.price_sats || 0);
      return Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
    });
    return rows;
  }, [baseFilteredListings, selectedTraitFilters, sortMode]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 rounded-2xl border border-red-600/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Ordinals Marketplace</h1>
              <p className="text-sm text-gray-400 mt-1">
                Visual, non-custodial trading hub with rich previews and admin-safe execution.
              </p>
            </div>
            <div className="w-full md:w-auto flex flex-col gap-2 md:items-end">
              <div className="text-xs uppercase text-gray-400">Connected</div>
              <div className="text-xs font-mono bg-black/60 border border-white/15 rounded px-2 py-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {walletState.accounts?.[0]?.address || 'No wallet'}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Floor</div>
              <div className="mt-1 text-lg font-bold font-mono">{floorPriceSats ? floorPriceSats.toLocaleString() : '-'} sats</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Volume</div>
              <div className="mt-1 text-lg font-bold font-mono">{volumeSoldSats.toLocaleString()} sats</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Sales 24h</div>
              <div className="mt-1 text-lg font-bold">{sold24h}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Active Listings</div>
              <div className="mt-1 text-lg font-bold">{totalListed}</div>
            </div>
          </div>
        </div>

        {!walletState.connected ? (
          <div className="max-w-xl mb-8">
            <WalletConnect />
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/marketplace/profile')}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            >
              Open My Marketplace Profile
            </button>
            <button
              onClick={() => setShowAdminTools((v) => !v)}
              className="px-4 py-2 rounded-lg bg-zinc-800 border border-white/15 hover:bg-zinc-700 text-sm font-semibold"
            >
              {showAdminTools ? 'Hide Admin Listing Tools' : 'Show Admin Listing Tools'}
            </button>
          </div>
        )}

        {showAdminTools && walletState.connected && (
          <div className="mb-8 border border-white/20 rounded-xl p-4 bg-zinc-900/40">
            <h2 className="font-bold mb-3">Create Listing (Admin)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={form.inscriptionId}
                onChange={(e) => setForm((prev) => ({ ...prev, inscriptionId: e.target.value }))}
                placeholder="Inscription ID"
                className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
              />
              <input
                value={form.collectionSlug}
                onChange={(e) => setForm((prev) => ({ ...prev, collectionSlug: e.target.value }))}
                placeholder="Collection slug (e.g. badcats)"
                className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
              />
              <input
                value={form.priceSats}
                onChange={(e) => setForm((prev) => ({ ...prev, priceSats: e.target.value }))}
                placeholder="Price in sats"
                className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleCreateListing}
              className="mt-3 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            >
              Create Listing
            </button>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-white/15 bg-zinc-950/70 p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inscription / collection / seller"
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All collections</option>
              {collectionOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'latest' | 'price-asc' | 'price-desc')}
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"
            >
              <option value="latest">Sort: Latest</option>
              <option value="price-asc">Sort: Price Low -&gt; High</option>
              <option value="price-desc">Sort: Price High -&gt; Low</option>
            </select>
            <button
              type="button"
              onClick={() => setShowTraitFilters((v) => !v)}
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm text-left hover:bg-zinc-900"
            >
              Traits Filter {selectedTraitCount > 0 ? `(${selectedTraitCount})` : ''}
            </button>
          </div>
          {showTraitFilters && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-400">Select one or more trait values</div>
                <button
                  type="button"
                  onClick={() => setSelectedTraitFilters({})}
                  className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                >
                  Clear Traits
                </button>
              </div>
              {traitOptions.length === 0 ? (
                <div className="text-xs text-gray-500">No traits available for current filters.</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {traitOptions.map((group) => (
                    <div key={group.traitType} className="border border-white/10 rounded p-2">
                      <div className="text-xs font-semibold text-gray-300 mb-1">{group.traitType}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.values.slice(0, 40).map((entry) => {
                          const selected = (selectedTraitFilters[group.traitType] || []).includes(entry.value);
                          return (
                            <button
                              key={`${group.traitType}-${entry.value}`}
                              type="button"
                              onClick={() => {
                                setSelectedTraitFilters((prev) => {
                                  const current = prev[group.traitType] || [];
                                  const nextValues = current.includes(entry.value)
                                    ? current.filter((v) => v !== entry.value)
                                    : [...current, entry.value];
                                  const next = { ...prev, [group.traitType]: nextValues };
                                  if (nextValues.length === 0) delete next[group.traitType];
                                  return next;
                                });
                              }}
                              className={`px-2 py-1 rounded text-[11px] border ${
                                selected
                                  ? 'bg-red-600/30 border-red-500/70 text-red-100'
                                  : 'bg-zinc-800 border-zinc-600 text-gray-200 hover:bg-zinc-700'
                              }`}
                            >
                              {entry.value} ({entry.count})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-2 text-xs text-gray-400">
            Showing {filteredListings.length} listing(s) • Avg price {avgPriceSats.toLocaleString()} sats
          </div>
        </div>

        {actionMessage && (
          <div className="mb-6 p-3 rounded border border-green-600/60 text-green-300 bg-green-900/20 text-sm">
            {actionMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-3 rounded border border-red-600/60 text-red-300 bg-red-900/20 text-sm">
            {error}
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Active Listings</h2>
            <span className="text-xs text-gray-400">Preview-first cards</span>
          </div>
          {listingsLoading ? (
            <div className="rounded-xl border border-white/15 p-4 text-sm text-gray-400">Loading listings...</div>
          ) : filteredListings.length === 0 ? (
            <div className="rounded-xl border border-white/15 p-8 text-center bg-zinc-950/60">
              <div className="text-4xl mb-2">🧭</div>
              <div className="text-base font-semibold">No listings for current filters</div>
              <div className="text-sm text-gray-400 mt-1">Try another collection or search term.</div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCollectionFilter('all');
                }}
                className="mt-3 px-3 py-2 rounded border border-white/15 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filteredListings.map((l) => {
                const isOwn = currentAddress && l.seller_address.toLowerCase() === currentAddress.toLowerCase();
                const isBusy = busyListingId === l.id;
                const rarityLabel = String(
                  l.inscription_metadata?.derivedRarityTier ||
                  l.inscription_metadata?.rarity ||
                  ''
                ).trim();
                const traitsCount = extractTraits(l).length;
                const rareSatsLabel = extractRareSats(l);
                return (
                  <div
                    key={l.id}
                    className="group rounded-xl border border-white/15 bg-zinc-950/70 overflow-hidden hover:border-red-500/60 hover:shadow-[0_0_24px_rgba(239,68,68,0.25)] transition-all"
                  >
                    <div className="relative aspect-square bg-zinc-900">
                      <PreviewImage
                        inscriptionId={l.inscription_id}
                        alt={l.inscription_id}
                        className="h-full w-full"
                        imageClassName="group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 border border-white/20 text-xs font-mono">
                        {Number(l.price_sats || 0).toLocaleString()} sats
                      </div>
                      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute inset-x-2 bottom-2 rounded-lg border border-white/20 bg-black/80 backdrop-blur-sm p-2">
                          <div className="flex items-center justify-between gap-2 text-[10px] text-gray-200">
                            <span className="uppercase tracking-wide text-gray-400">Quick Details</span>
                            {rarityLabel ? (
                              <span className="uppercase tracking-wide text-violet-200 bg-violet-900/40 border border-violet-700/40 rounded px-1.5 py-0.5">
                                {rarityLabel}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-gray-300">
                            <div className="truncate">
                              <span className="text-gray-500">ID:</span> {l.inscription_id.slice(0, 8)}...{l.inscription_id.slice(-4)}
                            </div>
                            <div className="truncate">
                              <span className="text-gray-500">Traits:</span> {traitsCount}
                            </div>
                            <div className="truncate">
                              <span className="text-gray-500">Owner:</span> {l.seller_address.slice(0, 6)}...{l.seller_address.slice(-4)}
                            </div>
                            <div className="truncate">
                              <span className="text-gray-500">Price:</span> {Number(l.price_sats || 0).toLocaleString()} sats
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold truncate">{l.collection_slug}</div>
                        <div className="flex items-center gap-1">
                          {rarityLabel && (
                            <span className="text-[10px] uppercase tracking-wide text-violet-200 bg-violet-900/40 border border-violet-700/40 rounded px-1.5 py-0.5">
                              {rarityLabel}
                            </span>
                          )}
                          {verifiedCollectionSet.has(String(l.collection_slug || '')) && (
                            <span className="text-[10px] uppercase tracking-wide text-sky-200 bg-sky-900/40 border border-sky-700/40 rounded px-1.5 py-0.5">
                              Verified
                            </span>
                          )}
                          {Number(l.price_sats || 0) >= highValueThreshold && highValueThreshold > 0 && (
                            <span className="text-[10px] uppercase tracking-wide text-amber-200 bg-amber-900/40 border border-amber-700/40 rounded px-1.5 py-0.5">
                              Rare
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-900/30 border border-emerald-700/40 rounded px-1.5 py-0.5">
                            Active
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-mono text-gray-400">
                        {l.inscription_id.slice(0, 12)}...{l.inscription_id.slice(-6)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Seller: <span className="font-mono">{l.seller_address.slice(0, 8)}...{l.seller_address.slice(-6)}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Rare sats: <span className="font-mono">{rareSatsLabel}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {extractTraits(l)
                          .slice(0, 3)
                          .map((t, idx) => (
                            <span
                              key={`${l.id}-${t.trait_type}-${t.value}-${idx}`}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-black/30 text-gray-200"
                            >
                              {t.trait_type}: {t.value}
                            </span>
                          ))}
                      </div>
                      {isOwn ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(l)}
                            className="px-2 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold"
                          >
                            Details
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleCancelListing(l.id)}
                            className="px-2 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-xs font-semibold"
                          >
                            {isBusy ? 'Working...' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(l)}
                            className="px-2 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold"
                          >
                            Details
                          </button>
                          <button
                            disabled={!walletState.connected || isBusy}
                            onClick={() => handleBuyListing(l)}
                            className="px-2 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold"
                            title="Simple mode: direct payment + complete"
                          >
                            {isBusy ? 'Buying...' : 'Simple Buy'}
                          </button>
                          <button
                            disabled={!walletState.connected || isBusy}
                            onClick={() => handleAdvancedBuyListing(l)}
                            className="px-2 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-xs font-semibold"
                            title="Advanced mode: wallet PSBT signing and on-chain broadcast"
                          >
                            {isBusy ? 'PSBT...' : 'PSBT Buy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-8 rounded-xl border border-white/15 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold">Recently Sold</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-zinc-700 text-zinc-100">Simple</span>
              <span className="px-2 py-1 rounded bg-emerald-700/80 text-emerald-100">Advanced PSBT</span>
            </div>
          </div>
          {listingsLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading sold listings...</div>
          ) : soldListings.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 flex items-center gap-2">
              <span className="text-xl">🧾</span>
              <span>No sold listings yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {soldListings.slice(0, 12).map((s) => {
                const source = String(s.sale_metadata?.source || '');
                const advanced = source.includes('advanced-psbt');
                return (
                  <div key={s.id} className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 hover:border-red-500/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <PreviewImage
                        inscriptionId={s.inscription_id}
                        alt={s.inscription_id}
                        className="w-16 h-16 rounded border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.collection_slug}</div>
                        <div className="text-xs font-mono text-gray-400 truncate">
                          {s.inscription_id.slice(0, 14)}...{s.inscription_id.slice(-6)}
                        </div>
                        <div className="text-xs mt-1 font-mono">{Number(s.price_sats || 0).toLocaleString()} sats</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs rounded ${advanced ? 'bg-emerald-700/80 text-emerald-100' : 'bg-zinc-700 text-zinc-100'}`}>
                        {advanced ? 'Advanced PSBT' : 'Simple'}
                      </span>
                      {s.sale_txid ? (
                        <a
                          href={`https://mempool.space/tx/${s.sale_txid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-red-300 hover:text-red-200 underline"
                        >
                          TX
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">No TX</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/15 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10">
            <h2 className="font-bold">Collection Ranking</h2>
          </div>
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading ranking...</div>
          ) : ranking.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 flex items-center gap-2">
              <span className="text-xl">📊</span>
              <span>No ranking data yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {ranking.slice(0, 12).map((row) => (
                <div key={row.slug} className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 hover:border-red-500/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold truncate flex items-center gap-2">
                        <span>{row.name}</span>
                        {verifiedCollectionSet.has(String(row.slug || '')) && (
                          <span className="text-[10px] uppercase tracking-wide text-sky-200 bg-sky-900/40 border border-sky-700/40 rounded px-1.5 py-0.5">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{row.slug}</div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded border border-white/10 bg-black/40">
                      Listed: {row.listed_count || 0}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="rounded border border-white/10 p-2">
                      <div className="text-gray-500">Floor</div>
                      <div className="font-mono">{Number(row.floor_price_sats || 0).toLocaleString()}</div>
                    </div>
                    <div className="rounded border border-white/10 p-2">
                      <div className="text-gray-500">7d Sales</div>
                      <div>{row.sales_count_7d || 0}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 p-4 overflow-auto">
          <div className="max-w-5xl mx-auto bg-zinc-950 border border-white/15 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="font-bold text-lg">Ordinal Detail Preview</h3>
              <button
                onClick={() => {
                  setDetailOpen(false);
                  setSelectedInscriptionDetail(null);
                  setSelectedDetailListing(null);
                }}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <div className="p-4 text-sm text-gray-400">Loading details...</div>
            ) : !selectedInscriptionDetail ? (
              <div className="p-4 text-sm text-gray-400">No detail data available.</div>
            ) : (
              <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-1 space-y-3">
                  <PreviewImage
                    inscriptionId={selectedInscriptionDetail.inscriptionId}
                    alt={selectedInscriptionDetail.inscriptionId}
                    className="w-full aspect-square rounded border border-white/10"
                  />
                  <div className="text-xs font-mono text-gray-300 break-all">
                    {selectedInscriptionDetail.inscriptionId}
                  </div>
                  <a
                    href={selectedInscriptionDetail.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-red-300 hover:text-red-200 underline"
                  >
                    Open Content
                  </a>
                </div>

                <div className="xl:col-span-2 space-y-4">
                  {selectedDetailListing && (
                    <div className="rounded border border-white/10 p-3">
                      <div className="text-xs text-gray-400 mb-2">Offer / Buy</div>
                      {currentAddress &&
                      selectedDetailListing.seller_address.toLowerCase() === currentAddress.toLowerCase() ? (
                        <button
                          disabled={busyListingId === selectedDetailListing.id}
                          onClick={() => handleCancelListing(selectedDetailListing.id)}
                          className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-xs font-semibold"
                        >
                          {busyListingId === selectedDetailListing.id ? 'Working...' : 'Cancel Listing'}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              value={offerPriceSats}
                              onChange={(e) => setOfferPriceSats(e.target.value)}
                              placeholder="Offer price (sats)"
                              className="bg-black border border-white/15 rounded px-2 py-2 text-xs"
                            />
                            <input
                              value={offerNote}
                              onChange={(e) => setOfferNote(e.target.value)}
                              placeholder="Optional note"
                              className="bg-black border border-white/15 rounded px-2 py-2 text-xs"
                            />
                            <button
                              disabled={!walletState.connected || offerSubmitting}
                              onClick={handleCreateOfferFromDetail}
                              className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold"
                              title="Submit price offer"
                            >
                              {offerSubmitting ? 'Submitting...' : 'Offer Buy'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              disabled={!walletState.connected || busyListingId === selectedDetailListing.id}
                              onClick={() => handleBuyListing(selectedDetailListing)}
                              className="px-3 py-2 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-xs font-semibold"
                              title="Simple mode: direct payment + complete"
                            >
                              {busyListingId === selectedDetailListing.id ? 'Buying...' : 'Simple Buy'}
                            </button>
                            <button
                              disabled={!walletState.connected || busyListingId === selectedDetailListing.id}
                              onClick={() => handleAdvancedBuyListing(selectedDetailListing)}
                              className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-xs font-semibold"
                              title="Advanced mode: wallet PSBT signing and on-chain broadcast"
                            >
                              {busyListingId === selectedDetailListing.id ? 'PSBT...' : 'PSBT Buy'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded border border-white/10 p-3">
                    <div className="text-xs text-gray-400 mb-2">Details</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-500">ID:</span> <span className="font-mono">{selectedInscriptionDetail.inscriptionId}</span></div>
                      <div><span className="text-gray-500">Owner:</span> <span className="font-mono">{String(selectedInscriptionDetail.marketplaceInscription?.owner_address || selectedInscriptionDetail.chainInfo?.ownerAddress || selectedInscriptionDetail.chainInfo?.address || '-')}</span></div>
                      <div><span className="text-gray-500">Content:</span> <span className="font-mono break-all">{selectedInscriptionDetail.contentUrl}</span></div>
                      <div><span className="text-gray-500">Created:</span> {String(selectedInscriptionDetail.chainInfo?.timestamp || selectedInscriptionDetail.chainInfo?.created || selectedInscriptionDetail.marketplaceInscription?.created_at || '-')}</div>
                      <div><span className="text-gray-500">Block:</span> {String(selectedInscriptionDetail.chainInfo?.blockHeight || selectedInscriptionDetail.chainInfo?.block_height || selectedInscriptionDetail.chainInfo?.height || '-')}</div>
                      <div><span className="text-gray-500">Rare sats:</span> {String(selectedInscriptionDetail.chainInfo?.rareSats || selectedInscriptionDetail.chainInfo?.rare_sats || '-')}</div>
                      <div><span className="text-gray-500">Sat number:</span> {String(selectedInscriptionDetail.chainInfo?.satNumber || selectedInscriptionDetail.chainInfo?.sat_number || selectedInscriptionDetail.chainInfo?.sat || '-')}</div>
                      <div><span className="text-gray-500">Rarity:</span> {String(selectedInscriptionDetail.marketplaceInscription?.metadata?.derivedRarityTier || selectedInscriptionDetail.marketplaceInscription?.metadata?.rarity || '-')}</div>
                    </div>
                  </div>

                  <div className="rounded border border-white/10 p-3">
                    <div className="text-xs text-gray-400 mb-2">Traits</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(selectedInscriptionDetail.marketplaceInscription?.attributes) &&
                      selectedInscriptionDetail.marketplaceInscription!.attributes!.length > 0 ? (
                        selectedInscriptionDetail.marketplaceInscription!.attributes!.map((t, idx) => (
                          <span key={`${t?.trait_type}-${t?.value}-${idx}`} className="text-[11px] px-2 py-1 rounded bg-zinc-900 border border-white/10">
                            {String(t?.trait_type || '?')}: {String(t?.value || '?')}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No traits</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded border border-white/10 p-3 max-h-60 overflow-auto">
                      <div className="text-xs text-gray-400 mb-2">Price History</div>
                      {selectedInscriptionDetail.salesHistory.length === 0 ? (
                        <div className="text-xs text-gray-500">No sales yet.</div>
                      ) : (
                        selectedInscriptionDetail.salesHistory.map((s) => (
                          <div key={s.id} className="text-xs py-1 border-b border-white/5 last:border-b-0">
                            <div className="font-mono">{Number(s.price_sats || 0).toLocaleString()} sats</div>
                            <div className="text-gray-500">{String(s.sold_at || s.created_at || '')}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded border border-white/10 p-3 max-h-60 overflow-auto">
                      <div className="text-xs text-gray-400 mb-2">Activity</div>
                      {selectedInscriptionDetail.activity.length === 0 ? (
                        <div className="text-xs text-gray-500">No activity.</div>
                      ) : (
                        selectedInscriptionDetail.activity.map((a) => (
                          <div key={a.id} className="text-xs py-1 border-b border-white/5 last:border-b-0">
                            <div className="capitalize">{a.activity_type}</div>
                            <div className="text-gray-500">{String(a.created_at || '')}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="rounded border border-white/10 p-3 max-h-60 overflow-auto">
                      <div className="text-xs text-gray-400 mb-2">Offers</div>
                      {selectedInscriptionDetail.offersHistory?.length === 0 ? (
                        <div className="text-xs text-gray-500">No offers yet.</div>
                      ) : (
                        (selectedInscriptionDetail.offersHistory || []).map((o) => (
                          <div key={o.id} className="text-xs py-1 border-b border-white/5 last:border-b-0">
                            <div className="font-mono">{Number(o.offer_price_sats || 0).toLocaleString()} sats</div>
                            <div className="text-gray-500">
                              {String(o.buyer_address || '').slice(0, 8)}...{String(o.buyer_address || '').slice(-6)} • {o.status}
                            </div>
                            {selectedDetailListing &&
                              currentAddress &&
                              selectedDetailListing.seller_address.toLowerCase() === currentAddress.toLowerCase() &&
                              o.status === 'active' && (
                                <div className="mt-1 flex gap-1">
                                  <button
                                    type="button"
                                    disabled={offerActionBusyId === o.id}
                                    onClick={() => handleOfferDecision(o.id, 'accept')}
                                    className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-[10px] font-semibold"
                                  >
                                    {offerActionBusyId === o.id ? 'Working...' : 'Accept'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={offerActionBusyId === o.id}
                                    onClick={() => handleOfferDecision(o.id, 'decline')}
                                    className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-[10px] font-semibold"
                                  >
                                    {offerActionBusyId === o.id ? 'Working...' : 'Decline'}
                                  </button>
                                </div>
                              )}
                            {selectedDetailListing &&
                              currentAddress &&
                              o.status === 'accepted' &&
                              (selectedDetailListing.seller_address.toLowerCase() === currentAddress.toLowerCase() ||
                                String(o.buyer_address || '').toLowerCase() === currentAddress.toLowerCase() ||
                                isAdminUser) && (
                                <div className="mt-1.5 space-y-1">
                                  <input
                                    value={offerTxids[o.id] || ''}
                                    onChange={(e) =>
                                      setOfferTxids((prev) => ({ ...prev, [o.id]: e.target.value }))
                                    }
                                    placeholder="Payment txid (optional)"
                                    className="w-full bg-black border border-white/15 rounded px-2 py-1 text-[10px] font-mono"
                                  />
                                  <button
                                    type="button"
                                    disabled={offerCompleteBusyId === o.id}
                                    onClick={() => handleCompleteOfferSale(o.id)}
                                    className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-[10px] font-semibold"
                                  >
                                    {offerCompleteBusyId === o.id ? 'Completing...' : 'Finalize Sale'}
                                  </button>
                                </div>
                              )}
                            {o.status === 'completed' && (
                              <div className="text-[10px] text-emerald-300 mt-1">
                                Completed
                                {o.metadata?.paymentTxid ? (
                                  <>
                                    {' '}
                                    •{' '}
                                    <a
                                      href={`https://mempool.space/tx/${o.metadata.paymentTxid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline hover:text-emerald-200"
                                    >
                                      TX
                                    </a>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

