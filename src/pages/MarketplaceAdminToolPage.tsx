import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import {
  archiveMarketplaceCollection,
  cancelMarketplaceListing,
  createMarketplaceCollection,
  createMarketplaceListing,
  getMarketplaceActivity,
  getMarketplaceCollections,
  getMarketplaceHealth,
  getMarketplaceListings,
  getMarketplaceRanking,
  getMarketplaceTraitsSummary,
  importMarketplaceHashlist,
  integrateMarketplaceCollectionByName,
  MarketplaceActivity,
  MarketplaceCollection,
  MarketplaceCollectionRanking,
  MarketplaceListing,
  MarketplaceRaritySummaryRow,
  MarketplaceTraitSummaryRow,
  updateMarketplaceListingPrice,
} from '../services/marketplaceService';

const MarketplaceAdminToolPage: React.FC = () => {
  const { walletState } = useWallet();
  const connectedAddress = walletState.accounts?.[0]?.address || '';
  const isAdmin = walletState.connected && isAdminAddress(connectedAddress);

  const [health, setHealth] = useState<{ ok: boolean; db: boolean; mode: string; timestamp: string } | null>(null);
  const [collections, setCollections] = useState<MarketplaceCollection[]>([]);
  const [ranking, setRanking] = useState<MarketplaceCollectionRanking[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [activity, setActivity] = useState<MarketplaceActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listingStatusFilter, setListingStatusFilter] = useState<'active' | 'sold' | 'cancelled' | 'all'>('all');
  const [traitsCollectionSlug, setTraitsCollectionSlug] = useState('');
  const [traitsSummary, setTraitsSummary] = useState<MarketplaceTraitSummaryRow[]>([]);
  const [raritySummary, setRaritySummary] = useState<MarketplaceRaritySummaryRow[]>([]);
  const [traitsTotal, setTraitsTotal] = useState(0);
  const [hashlistImporting, setHashlistImporting] = useState(false);
  const [integrationForm, setIntegrationForm] = useState({
    query: '',
    maxInscriptionIds: '5000',
  });
  const [hashlistForm, setHashlistForm] = useState({
    collectionSlug: '',
    maxPreview: '5',
  });
  const [hashlistEntriesPreview, setHashlistEntriesPreview] = useState<Array<Record<string, any>>>([]);
  const [hashlistEntries, setHashlistEntries] = useState<Array<Record<string, any>>>([]);
  const [listingPriceDrafts, setListingPriceDrafts] = useState<Record<string, string>>({});

  const [collectionForm, setCollectionForm] = useState({
    slug: '',
    name: '',
    symbol: '',
    description: '',
    coverImage: '',
    verified: false,
    metadataJson: '{}',
  });

  const [listingForm, setListingForm] = useState({
    inscriptionId: '',
    collectionSlug: '',
    sellerAddress: '',
    buyerReceiveAddress: '',
    priceSats: '10000',
  });

  const defaultSellerAddress = useMemo(
    () => listingForm.sellerAddress || connectedAddress,
    [listingForm.sellerAddress, connectedAddress]
  );
  const defaultBuyerReceiveAddress = useMemo(
    () => listingForm.buyerReceiveAddress || connectedAddress,
    [listingForm.buyerReceiveAddress, connectedAddress]
  );

  const loadAll = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      setError(null);
      const [healthData, collectionsData, rankingData, listingsData, activityData] = await Promise.all([
        getMarketplaceHealth(),
        getMarketplaceCollections({ includeInactive: true, adminAddress: connectedAddress }),
        getMarketplaceRanking(),
        getMarketplaceListings({ status: listingStatusFilter, limit: 100 }),
        getMarketplaceActivity({ limit: 100 }),
      ]);
      setHealth(healthData);
      setCollections(collectionsData);
      setRanking(rankingData);
      setListings(listingsData);
      setActivity(activityData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load marketplace admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [isAdmin, listingStatusFilter]);

  const handleSaveCollection = async () => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const metadata = JSON.parse(collectionForm.metadataJson || '{}');
      await createMarketplaceCollection({
        adminAddress: connectedAddress,
        slug: collectionForm.slug.trim(),
        name: collectionForm.name.trim(),
        symbol: collectionForm.symbol.trim() || undefined,
        description: collectionForm.description.trim() || undefined,
        coverImage: collectionForm.coverImage.trim() || undefined,
        verified: collectionForm.verified,
        metadata,
      });
      setMessage(`Collection saved: ${collectionForm.slug}`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to save collection');
    }
  };

  const handleIntegrateByName = async () => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const query = integrationForm.query.trim();
      if (!query) throw new Error('Collection name/slug is required');
      const maxInscriptionIds = Number(integrationForm.maxInscriptionIds || '5000');
      if (!Number.isFinite(maxInscriptionIds) || maxInscriptionIds < 100) {
        throw new Error('maxInscriptionIds must be at least 100');
      }

      setError(null);
      setMessage('Integrating collection... this can take a moment.');
      const result = await integrateMarketplaceCollectionByName({
        adminAddress: connectedAddress,
        query,
        maxInscriptionIds: Math.round(maxInscriptionIds),
      });
      setMessage(
        `Integrated ${result.collection.name} (${result.collection.slug}) with ${result.stats.inscriptionsImported} inscriptions.`
      );
      setCollectionForm((prev) => ({
        ...prev,
        slug: result.collection.slug,
        name: result.collection.name,
      }));
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to integrate collection by name');
    }
  };

  const handleCreateListing = async () => {
    try {
      if (!isAdmin) throw new Error('Admin wallet required');
      const priceSats = Number(listingForm.priceSats);
      if (!listingForm.inscriptionId.trim()) throw new Error('Inscription ID required');
      if (!listingForm.collectionSlug.trim()) throw new Error('Collection slug required');
      if (!Number.isFinite(priceSats) || priceSats <= 0) throw new Error('Price sats must be > 0');

      await createMarketplaceListing({
        inscriptionId: listingForm.inscriptionId.trim(),
        collectionSlug: listingForm.collectionSlug.trim(),
        sellerAddress: defaultSellerAddress,
        buyerReceiveAddress: defaultBuyerReceiveAddress,
        priceSats: Math.round(priceSats),
      });
      setMessage(`Listing created for ${listingForm.inscriptionId}`);
      setListingForm((prev) => ({ ...prev, inscriptionId: '' }));
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to create listing');
    }
  };

  const normalizeHashlistEntries = (raw: any): Array<Record<string, any>> => {
    let rows: any[] = [];
    if (Array.isArray(raw)) {
      rows = raw;
    } else if (raw && Array.isArray(raw.items)) {
      rows = raw.items;
    } else if (raw && Array.isArray(raw.hashlist)) {
      rows = raw.hashlist;
    } else if (raw && Array.isArray(raw.inscriptions)) {
      rows = raw.inscriptions;
    } else {
      throw new Error('Unsupported hashlist format. Expected array or {items/hashlist/inscriptions}.');
    }

    return rows
      .map((row: any, index: number) => {
        const inscriptionId = String(row?.inscriptionId || row?.inscription_id || row?.id || '').trim();
        if (!inscriptionId) return null;
        const attributes = Array.isArray(row?.attributes)
          ? row.attributes
          : Array.isArray(row?.traits)
            ? row.traits
            : [];
        return {
          inscriptionId,
          name: row?.name || row?.itemName || `Item #${index + 1}`,
          itemIndex: Number.isFinite(Number(row?.itemIndex ?? row?.item_index)) ? Number(row?.itemIndex ?? row?.item_index) : null,
          ownerAddress: row?.ownerAddress || row?.owner_address || row?.address || '',
          rarity: row?.rarity || '',
          attributes,
          metadata: row?.metadata || {},
        };
      })
      .filter(Boolean);
  };

  const handleHashlistFileSelect = async (file: File | null) => {
    if (!file) return;
    try {
      setError(null);
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeHashlistEntries(parsed);
      setHashlistEntries(normalized);
      const previewCount = Math.max(1, Math.min(20, Number(hashlistForm.maxPreview || '5')));
      setHashlistEntriesPreview(normalized.slice(0, previewCount));
      setMessage(`Loaded hashlist file with ${normalized.length} entries.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse hashlist file');
      setHashlistEntries([]);
      setHashlistEntriesPreview([]);
    }
  };

  const handleImportHashlist = async () => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const slug = hashlistForm.collectionSlug.trim();
      if (!slug) throw new Error('Collection slug is required for hashlist import');
      if (hashlistEntries.length === 0) throw new Error('Load a hashlist file first');
      setHashlistImporting(true);
      setError(null);
      const result = await importMarketplaceHashlist({
        adminAddress: connectedAddress,
        collectionSlug: slug,
        entries: hashlistEntries,
      });
      setMessage(
        `Hashlist imported: ${result.stats.imported} entries (traits on ${result.stats.withTraits}).`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to import hashlist');
    } finally {
      setHashlistImporting(false);
    }
  };

  const handleLoadTraitsSummary = async () => {
    try {
      const slug = traitsCollectionSlug.trim();
      if (!slug) throw new Error('Collection slug required');
      const data = await getMarketplaceTraitsSummary(slug);
      setTraitsSummary(data.traits || []);
      setRaritySummary(data.rarity || []);
      setTraitsTotal(Number(data.totalInscriptions || 0));
      setMessage(`Loaded traits summary for ${slug}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to load traits summary');
    }
  };

  const handleCancelListing = async (listingId: string, sellerAddress: string) => {
    try {
      if (!isAdmin) throw new Error('Admin wallet required');
      // Endpoint accepts adminAddress as override because backend validates with isAdmin(callerAddress).
      await cancelMarketplaceListing(listingId, connectedAddress || sellerAddress);
      setMessage(`Listing cancelled: ${listingId}`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel listing');
    }
  };

  const handleUpdateListingPrice = async (listingId: string, currentPrice: number) => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const raw = listingPriceDrafts[listingId];
      const nextPrice = Number(raw ?? currentPrice);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        throw new Error('Price must be a positive number');
      }
      await updateMarketplaceListingPrice({
        listingId,
        adminAddress: connectedAddress,
        priceSats: Math.round(nextPrice),
      });
      setMessage(`Listing price updated: ${listingId}`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update listing price');
    }
  };

  const handleArchiveCollection = async (slug: string, currentlyActive: boolean) => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      await archiveMarketplaceCollection({
        slug,
        adminAddress: connectedAddress,
        archived: currentlyActive,
      });
      setMessage(currentlyActive ? `Collection archived: ${slug}` : `Collection reactivated: ${slug}`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update collection status');
    }
  };

  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Marketplace Admin Tool</h1>
          <p className="text-gray-400">Connect your wallet first.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Admin access required</h1>
          <p className="text-gray-400">This tool is available only for admin wallets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-12 px-4">
      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-400">
            Marketplace Admin Tool
          </h1>
          <p className="text-xs text-gray-400 mt-1">Manage collections, listings, and marketplace activity from one page.</p>
        </div>

        {message && <div className="p-3 rounded border border-emerald-600/70 text-emerald-200 bg-emerald-900/20 text-sm">{message}</div>}
        {error && <div className="p-3 rounded border border-red-600/70 text-red-200 bg-red-900/20 text-sm">{error}</div>}

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Health</h2>
            <button onClick={loadAll} className="px-3 py-1.5 bg-zinc-700 rounded hover:bg-zinc-600 text-sm" disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-300">
            {health ? (
              <div className="flex flex-wrap gap-4">
                <span>API: {health.ok ? 'OK' : 'ERROR'}</span>
                <span>DB: {health.db ? 'Connected' : 'Disconnected'}</span>
                <span>Mode: {health.mode}</span>
                <span>At: {new Date(health.timestamp).toLocaleString()}</span>
              </div>
            ) : (
              <span className="text-gray-500">No data yet</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">One-Click Integrate Collection by Name</h2>
            <input
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
              placeholder="Collection name or slug (e.g. bitcoin-frogs)"
              value={integrationForm.query}
              onChange={(e) => setIntegrationForm((p) => ({ ...p, query: e.target.value }))}
            />
            <input
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
              placeholder="Max inscriptions to import (e.g. 5000)"
              value={integrationForm.maxInscriptionIds}
              onChange={(e) => setIntegrationForm((p) => ({ ...p, maxInscriptionIds: e.target.value }))}
            />
            <p className="text-xs text-gray-500">
              Finds the collection via BestInSlot, creates/updates marketplace collection, then imports inscription ownership into marketplace_inscriptions.
            </p>
            <div>
              <button onClick={handleIntegrateByName} className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 font-semibold">
                Integrate Fully (One Click)
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">Create / Update Collection</h2>
            <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Slug (e.g. badcats)" value={collectionForm.slug} onChange={(e) => setCollectionForm((p) => ({ ...p, slug: e.target.value }))} />
            <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Name" value={collectionForm.name} onChange={(e) => setCollectionForm((p) => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Symbol" value={collectionForm.symbol} onChange={(e) => setCollectionForm((p) => ({ ...p, symbol: e.target.value }))} />
              <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Cover image URL" value={collectionForm.coverImage} onChange={(e) => setCollectionForm((p) => ({ ...p, coverImage: e.target.value }))} />
            </div>
            <textarea className="w-full px-3 py-2 bg-black border border-gray-700 rounded min-h-[80px]" placeholder="Description" value={collectionForm.description} onChange={(e) => setCollectionForm((p) => ({ ...p, description: e.target.value }))} />
            <textarea className="w-full px-3 py-2 bg-black border border-gray-700 rounded min-h-[80px] font-mono text-xs" placeholder='Metadata JSON, e.g. {"supply":500}' value={collectionForm.metadataJson} onChange={(e) => setCollectionForm((p) => ({ ...p, metadataJson: e.target.value }))} />
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={collectionForm.verified} onChange={(e) => setCollectionForm((p) => ({ ...p, verified: e.target.checked }))} />
              Verified
            </label>
            <div>
              <button onClick={handleSaveCollection} className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 font-semibold">Save Collection</button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">Create Listing</h2>
            <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Inscription ID" value={listingForm.inscriptionId} onChange={(e) => setListingForm((p) => ({ ...p, inscriptionId: e.target.value }))} />
            <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Collection slug" value={listingForm.collectionSlug} onChange={(e) => setListingForm((p) => ({ ...p, collectionSlug: e.target.value }))} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Seller address (optional)" value={listingForm.sellerAddress} onChange={(e) => setListingForm((p) => ({ ...p, sellerAddress: e.target.value }))} />
              <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Buyer receive address (optional)" value={listingForm.buyerReceiveAddress} onChange={(e) => setListingForm((p) => ({ ...p, buyerReceiveAddress: e.target.value }))} />
            </div>
            <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Price sats" value={listingForm.priceSats} onChange={(e) => setListingForm((p) => ({ ...p, priceSats: e.target.value }))} />
            <p className="text-xs text-gray-500">
              Defaults: seller = connected admin wallet, buyer receive = connected admin wallet.
            </p>
            <div>
              <button onClick={handleCreateListing} className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 font-semibold">Create Listing</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">Import Own Hashlist (Traits + Rarity)</h2>
            <input
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
              placeholder="Collection slug (target)"
              value={hashlistForm.collectionSlug}
              onChange={(e) => setHashlistForm((p) => ({ ...p, collectionSlug: e.target.value }))}
            />
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => handleHashlistFileSelect(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-sm"
            />
            <p className="text-xs text-gray-500">
              Supports array or objects with `items/hashlist/inscriptions`. Fields: inscriptionId, ownerAddress, name, rarity, attributes/traits.
            </p>
            {hashlistEntries.length > 0 && (
              <div className="text-xs text-gray-300">
                Loaded entries: <span className="font-semibold">{hashlistEntries.length}</span>
              </div>
            )}
            <button
              onClick={handleImportHashlist}
              disabled={hashlistImporting || hashlistEntries.length === 0}
              className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 disabled:opacity-50 font-semibold"
            >
              {hashlistImporting ? 'Importing...' : 'Import Hashlist'}
            </button>
            {hashlistEntriesPreview.length > 0 && (
              <div className="border border-gray-700 rounded p-2 bg-black/40">
                <p className="text-xs text-gray-400 mb-1">Preview</p>
                <div className="space-y-1">
                  {hashlistEntriesPreview.map((e, i) => (
                    <div key={`${e.inscriptionId}-${i}`} className="text-xs text-gray-300 font-mono">
                      {e.inscriptionId.slice(0, 16)}... | rarity: {e.rarity || '-'} | traits: {Array.isArray(e.attributes) ? e.attributes.length : 0}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">Traits & Rarity Summary</h2>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded"
                placeholder="Collection slug"
                value={traitsCollectionSlug}
                onChange={(e) => setTraitsCollectionSlug(e.target.value)}
              />
              <button onClick={handleLoadTraitsSummary} className="px-3 py-2 bg-zinc-700 rounded hover:bg-zinc-600 text-sm">
                Load
              </button>
            </div>
            <p className="text-xs text-gray-500">Total inscriptions: {traitsTotal}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-700 rounded p-2 max-h-[220px] overflow-auto">
                <p className="text-xs text-gray-400 mb-1">Rarity</p>
                {raritySummary.length === 0 ? (
                  <p className="text-xs text-gray-500">No rarity data</p>
                ) : (
                  raritySummary.map((r) => (
                    <div key={r.rarity} className="text-xs text-gray-300 flex justify-between">
                      <span>{r.rarity}</span>
                      <span>{r.count}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="border border-gray-700 rounded p-2 max-h-[220px] overflow-auto">
                <p className="text-xs text-gray-400 mb-1">Traits</p>
                {traitsSummary.length === 0 ? (
                  <p className="text-xs text-gray-500">No trait data</p>
                ) : (
                  traitsSummary.slice(0, 200).map((t, idx) => (
                    <div key={`${t.trait_type}-${t.value}-${idx}`} className="text-xs text-gray-300 flex justify-between gap-2">
                      <span className="truncate">{t.trait_type}: {t.value}</span>
                      <span>{t.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 font-semibold">Collections</div>
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 sticky top-0">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Verified</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.slug} className="border-t border-gray-800">
                    <td className="px-4 py-2 font-mono">{c.slug}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2">{c.verified ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2">{c.active ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{c.updated_at ? new Date(c.updated_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleArchiveCollection(c.slug, !!c.active)}
                        className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600 text-xs"
                      >
                        {c.active ? 'Archive' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {collections.length === 0 && (
                  <tr><td className="px-4 py-3 text-gray-500" colSpan={6}>No collections yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 font-semibold flex items-center justify-between">
            <span>Listings</span>
            <select
              value={listingStatusFilter}
              onChange={(e) => setListingStatusFilter(e.target.value as 'active' | 'sold' | 'cancelled' | 'all')}
              className="bg-black border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="sold">sold</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
          <div className="max-h-[340px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 sticky top-0">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-2">Inscription</th>
                  <th className="px-4 py-2">Collection</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-t border-gray-800">
                    <td className="px-4 py-2 font-mono">{l.inscription_id.slice(0, 20)}...</td>
                    <td className="px-4 py-2">{l.collection_slug}</td>
                    <td className="px-4 py-2">
                      {l.status === 'active' ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="w-28 px-2 py-1 bg-black border border-gray-700 rounded text-xs font-mono"
                            value={listingPriceDrafts[l.id] ?? String(Number(l.price_sats || 0))}
                            onChange={(e) => setListingPriceDrafts((p) => ({ ...p, [l.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => handleUpdateListingPrice(l.id, Number(l.price_sats || 0))}
                            className="px-2 py-1 bg-emerald-700 rounded hover:bg-emerald-600 text-xs"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono">{Number(l.price_sats || 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{l.status}</td>
                    <td className="px-4 py-2">
                      {l.status === 'active' ? (
                        <button onClick={() => handleCancelListing(l.id, l.seller_address)} className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600 text-xs">
                          Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {listings.length === 0 && (
                  <tr><td className="px-4 py-3 text-gray-500" colSpan={5}>No listings</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 font-semibold">Ranking</div>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr className="text-left text-gray-400">
                    <th className="px-4 py-2">Collection</th>
                    <th className="px-4 py-2">Floor</th>
                    <th className="px-4 py-2">Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.slug} className="border-t border-gray-800">
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 font-mono">{Number(r.floor_price_sats || 0).toLocaleString()}</td>
                      <td className="px-4 py-2">{r.listed_count}</td>
                    </tr>
                  ))}
                  {ranking.length === 0 && (
                    <tr><td className="px-4 py-3 text-gray-500" colSpan={3}>No ranking data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 font-semibold">Activity</div>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr className="text-left text-gray-400">
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Inscription</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id} className="border-t border-gray-800">
                      <td className="px-4 py-2 capitalize">{a.activity_type}</td>
                      <td className="px-4 py-2 font-mono">{String(a.inscription_id || '').slice(0, 18)}...</td>
                      <td className="px-4 py-2 font-mono">{a.price_sats ? Number(a.price_sats).toLocaleString() : '-'}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr><td className="px-4 py-3 text-gray-500" colSpan={4}>No activity</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceAdminToolPage;

