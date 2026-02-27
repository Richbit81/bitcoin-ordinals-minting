import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  cancelMarketplaceListing,
  completeMarketplacePurchaseAdvanced,
  completeMarketplacePurchase,
  createMarketplaceListing,
  getMarketplaceCollections,
  getMarketplaceListings,
  getMarketplaceRanking,
  MarketplaceCollection,
  MarketplaceCollectionRanking,
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
  const [collectionsMeta, setCollectionsMeta] = useState<MarketplaceCollection[]>([]);
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

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = listings.filter((l) => {
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
    rows = [...rows].sort((a, b) => {
      if (sortMode === 'price-asc') return Number(a.price_sats || 0) - Number(b.price_sats || 0);
      if (sortMode === 'price-desc') return Number(b.price_sats || 0) - Number(a.price_sats || 0);
      return Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
    });
    return rows;
  }, [listings, searchQuery, collectionFilter, sortMode]);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          </div>
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
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold truncate">{l.collection_slug}</div>
                        <div className="flex items-center gap-1">
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
                      {isOwn ? (
                        <button
                          disabled={isBusy}
                          onClick={() => handleCancelListing(l.id)}
                          className="w-full px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-sm font-semibold"
                        >
                          {isBusy ? 'Working...' : 'Cancel Listing'}
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
};

