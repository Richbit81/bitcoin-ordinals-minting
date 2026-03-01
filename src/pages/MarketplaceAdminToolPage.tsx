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
  getMarketplaceHashlist,
  getMarketplaceHealth,
  getMarketplaceListings,
  getMarketplaceRanking,
  getMarketplaceTraitsSummary,
  importMarketplaceHashlist,
  integrateMarketplaceCollectionByName,
  MarketplaceActivity,
  MarketplaceBisCollectionSuggestion,
  MarketplaceCollection,
  MarketplaceCollectionRanking,
  MarketplaceListing,
  MarketplaceRaritySummaryRow,
  MarketplaceTraitSummaryRow,
  searchMarketplaceBisCollections,
  recomputeMarketplaceRarityFromTraits,
  updateMarketplaceHashlist,
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
  const [hashlistImportReplaceMissing, setHashlistImportReplaceMissing] = useState(true);
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
  const [integrationSuggestions, setIntegrationSuggestions] = useState<MarketplaceBisCollectionSuggestion[]>([]);
  const [integrationSuggestionsLoading, setIntegrationSuggestionsLoading] = useState(false);
  const [showIntegrationSuggestions, setShowIntegrationSuggestions] = useState(false);
  const [hashlistEditorSlug, setHashlistEditorSlug] = useState('');
  const [hashlistEditorText, setHashlistEditorText] = useState('');
  const [hashlistEditorVisible, setHashlistEditorVisible] = useState(false);
  const [hashlistEditorLoading, setHashlistEditorLoading] = useState(false);
  const [hashlistEditorReplaceMissing, setHashlistEditorReplaceMissing] = useState(false);
  const [collectionOrderBusy, setCollectionOrderBusy] = useState(false);
  const [collectionOrderDraftBySlug, setCollectionOrderDraftBySlug] = useState<Record<string, string>>({});

  const getTraitRarityBand = (percent: number): {
    label: string;
    className: string;
  } => {
    if (percent <= 1) {
      return {
        label: '1%',
        className: 'bg-fuchsia-900/50 text-fuchsia-200 border border-fuchsia-700/60',
      };
    }
    if (percent <= 5) {
      return {
        label: '2-5%',
        className: 'bg-sky-900/50 text-sky-200 border border-sky-700/60',
      };
    }
    if (percent <= 20) {
      return {
        label: '5-20%',
        className: 'bg-emerald-900/50 text-emerald-200 border border-emerald-700/60',
      };
    }
    if (percent <= 50) {
      return {
        label: '20-50%',
        className: 'bg-amber-900/50 text-amber-200 border border-amber-700/60',
      };
    }
    return {
      label: '50-100%',
      className: 'bg-zinc-800 text-zinc-100 border border-zinc-600',
    };
  };

  const [collectionForm, setCollectionForm] = useState({
    slug: '',
    name: '',
    symbol: '',
    description: '',
    coverImage: '',
    verified: false,
    metadataJson: '{}',
  });
  const [collectionCoverFileName, setCollectionCoverFileName] = useState('');
  const [editingCollectionSlug, setEditingCollectionSlug] = useState('');

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

  const getCollectionDisplayOrder = (collection: MarketplaceCollection, fallback = Number.MAX_SAFE_INTEGER): number => {
    const md = (collection?.metadata || {}) as Record<string, any>;
    const raw = md.displayOrder ?? md.display_order ?? md.sortOrder ?? md.sort_order;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const orderedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      const ao = getCollectionDisplayOrder(a);
      const bo = getCollectionDisplayOrder(b);
      if (ao !== bo) return ao - bo;
      return String(a.name || a.slug || '').localeCompare(String(b.name || b.slug || ''));
    });
  }, [collections]);

  useEffect(() => {
    setCollectionOrderDraftBySlug((prev) => {
      const next: Record<string, string> = {};
      orderedCollections.forEach((c, idx) => {
        const key = String(c.slug || '');
        next[key] = prev[key] ?? String(idx + 1);
      });
      return next;
    });
  }, [orderedCollections]);

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

  useEffect(() => {
    const raw = integrationForm.query || '';
    const q = raw.trim();
    const qLower = q.toLowerCase();
    const localFallback: MarketplaceBisCollectionSuggestion[] = (collections || [])
      .filter((c) => {
        const slug = String(c.slug || '').toLowerCase();
        const name = String(c.name || '').toLowerCase();
        return !!q && (slug.includes(qLower) || name.includes(qLower));
      })
      .slice(0, 8)
      .map((c) => ({
        slug: String(c.slug || ''),
        name: String(c.name || c.slug || ''),
        symbol: c.symbol || null,
        image: c.cover_image || null,
        median_number: 0,
      }));
    if (!isAdmin || !connectedAddress || q.length < 1) {
      setIntegrationSuggestions([]);
      setIntegrationSuggestionsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIntegrationSuggestionsLoading(true);
        const rows = await searchMarketplaceBisCollections({
          q,
          adminAddress: connectedAddress,
          limit: 8,
        });
        // Fallback to already integrated collections if external search is empty.
        setIntegrationSuggestions(rows.length > 0 ? rows : localFallback);
      } catch {
        // External provider can fail/rate-limit; keep local suggestions usable.
        setIntegrationSuggestions(localFallback);
      } finally {
        setIntegrationSuggestionsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [integrationForm.query, isAdmin, connectedAddress, collections]);

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

  const handleLoadCollectionForEdit = (slug: string) => {
    const row = collections.find((c) => String(c.slug || '') === String(slug || ''));
    if (!row) {
      setError(`Collection not found: ${slug}`);
      return;
    }
    setCollectionForm({
      slug: String(row.slug || ''),
      name: String(row.name || ''),
      symbol: String(row.symbol || ''),
      description: String(row.description || ''),
      coverImage: String(row.cover_image || ''),
      verified: !!row.verified,
      metadataJson: JSON.stringify(row.metadata || {}, null, 2),
    });
    setCollectionCoverFileName('');
    setEditingCollectionSlug(String(row.slug || ''));
    setMessage(`Editing collection: ${row.slug}`);
    setError(null);
  };

  const handleResetCollectionForm = () => {
    setCollectionForm({
      slug: '',
      name: '',
      symbol: '',
      description: '',
      coverImage: '',
      verified: false,
      metadataJson: '{}',
    });
    setCollectionCoverFileName('');
    setEditingCollectionSlug('');
    setError(null);
    setMessage('Collection form reset. Create mode active.');
  };

  const handleCollectionCoverFileSelect = async (file: File | null) => {
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      // Keep DB payload reasonable and avoid huge inline base64 values.
      const maxBytes = 3 * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error('Image is too large. Max size is 3 MB');
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      setCollectionForm((p) => ({ ...p, coverImage: dataUrl }));
      setCollectionCoverFileName(file.name);
      setMessage(`Cover image loaded from file: ${file.name}`);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load cover image file');
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
      setShowIntegrationSuggestions(false);
      setIntegrationSuggestions([]);
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
            : Array.isArray(row?.meta?.attributes)
              ? row.meta.attributes
            : [];
        const derivedName = String(row?.name || row?.itemName || row?.meta?.name || '').trim();
        const derivedIndexFromName = (() => {
          const m = derivedName.match(/#\s*(\d+)/);
          return m ? Number(m[1]) : null;
        })();
        return {
          inscriptionId,
          name: derivedName || `Item #${index + 1}`,
          itemIndex: Number.isFinite(Number(row?.itemIndex ?? row?.item_index))
            ? Number(row?.itemIndex ?? row?.item_index)
            : derivedIndexFromName,
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
      if (hashlistImportReplaceMissing) {
        const result = await updateMarketplaceHashlist({
          adminAddress: connectedAddress,
          collectionSlug: slug,
          entries: hashlistEntries as any,
          replaceMissing: true,
        });
        setMessage(
          `Hashlist synced: imported ${result.stats.imported}, skipped ${result.stats.skipped}, deleted ${result.stats.deleted}.`
        );
      } else {
        const result = await importMarketplaceHashlist({
          adminAddress: connectedAddress,
          collectionSlug: slug,
          entries: hashlistEntries,
          replaceMissing: false,
        });
        setMessage(
          `Hashlist imported: ${result.stats.imported} entries (traits on ${result.stats.withTraits}, deleted ${result.stats.deleted || 0}).`
        );
      }
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to import hashlist');
    } finally {
      setHashlistImporting(false);
    }
  };

  const handleLoadHashlistEditor = async (forcedSlug?: string) => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const slug = String(forcedSlug || hashlistEditorSlug).trim();
      if (!slug) throw new Error('Collection slug is required');
      setHashlistEditorLoading(true);
      setError(null);
      const data = await getMarketplaceHashlist({
        adminAddress: connectedAddress,
        collectionSlug: slug,
      });
      setHashlistEditorText(JSON.stringify(data.entries || [], null, 2));
      setHashlistEditorVisible(true);
      setMessage(`Loaded hashlist for ${slug}: ${(data.entries || []).length} entries.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to load collection hashlist');
    } finally {
      setHashlistEditorLoading(false);
    }
  };

  const handleSaveHashlistEditor = async () => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const slug = hashlistEditorSlug.trim();
      if (!slug) throw new Error('Collection slug is required');
      const parsed = JSON.parse(hashlistEditorText || '[]');
      if (!Array.isArray(parsed)) throw new Error('Hashlist JSON must be an array');

      setHashlistEditorLoading(true);
      setError(null);
      const result = await updateMarketplaceHashlist({
        adminAddress: connectedAddress,
        collectionSlug: slug,
        entries: parsed,
        replaceMissing: hashlistEditorReplaceMissing,
      });
      setMessage(
        `Hashlist updated for ${slug}: imported ${result.stats.imported}, skipped ${result.stats.skipped}, deleted ${result.stats.deleted}.`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to update collection hashlist');
    } finally {
      setHashlistEditorLoading(false);
    }
  };

  const handleDownloadHashlistEditor = () => {
    try {
      const slug = hashlistEditorSlug.trim() || 'collection';
      const text = hashlistEditorText || '[]';
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-hashlist.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${slug}-hashlist.json`);
    } catch (err: any) {
      setError(err?.message || 'Failed to download hashlist');
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

  const handleRecomputeOrdinalRarity = async () => {
    try {
      if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
      const slug = traitsCollectionSlug.trim();
      if (!slug) throw new Error('Collection slug required');
      setError(null);
      setMessage('Computing ordinal rarity from trait frequencies...');
      const result = await recomputeMarketplaceRarityFromTraits({
        adminAddress: connectedAddress,
        collectionSlug: slug,
      });
      const tierText = Object.entries(result.tiers || {})
        .map(([tier, count]) => `${tier}: ${count}`)
        .join(', ');
      setMessage(
        `Rarity recomputed for ${result.updated} ordinals (${slug}). ${tierText ? `Tiers -> ${tierText}` : ''}`
      );
      await handleLoadTraitsSummary();
    } catch (err: any) {
      setError(err?.message || 'Failed to recompute ordinal rarity');
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

  const saveCollectionDisplayOrder = async (collection: MarketplaceCollection, displayOrder: number) => {
    if (!isAdmin || !connectedAddress) throw new Error('Admin wallet required');
    const nextMetadata = {
      ...(collection.metadata || {}),
      displayOrder,
      display_order: displayOrder,
    };
    await createMarketplaceCollection({
      adminAddress: connectedAddress,
      slug: String(collection.slug || '').trim(),
      name: String(collection.name || collection.slug || '').trim(),
      symbol: String(collection.symbol || '').trim() || undefined,
      description: String(collection.description || '').trim() || undefined,
      coverImage: String(collection.cover_image || '').trim() || undefined,
      verified: !!collection.verified,
      source: collection.source || undefined,
      sourceRef: collection.source_ref || undefined,
      metadata: nextMetadata,
    });
  };

  const handleMoveCollection = async (slug: string, direction: 'up' | 'down') => {
    try {
      if (collectionOrderBusy) return;
      const index = orderedCollections.findIndex((c) => String(c.slug || '') === String(slug || ''));
      if (index < 0) return;
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= orderedCollections.length) return;
      setCollectionOrderBusy(true);

      const nextOrdered = [...orderedCollections];
      const [moved] = nextOrdered.splice(index, 1);
      nextOrdered.splice(swapIndex, 0, moved);

      const normalizedOrders = new Map<string, number>();
      nextOrdered.forEach((row, idx) => normalizedOrders.set(row.slug, (idx + 1) * 10));

      const changed = nextOrdered.filter((row) => {
        const nextOrder = normalizedOrders.get(row.slug)!;
        const currentOrder = getCollectionDisplayOrder(
          collections.find((c) => c.slug === row.slug) || row,
          Number.MAX_SAFE_INTEGER
        );
        return currentOrder !== nextOrder;
      });

      await Promise.all(
        changed.map((row) => saveCollectionDisplayOrder(row, normalizedOrders.get(row.slug)!))
      );

      setCollections((prev) =>
        prev.map((row) => {
          const nextOrder = normalizedOrders.get(row.slug);
          if (nextOrder === undefined) return row;
          return {
            ...row,
            metadata: { ...(row.metadata || {}), displayOrder: nextOrder, display_order: nextOrder },
          };
        })
      );
      setCollectionOrderDraftBySlug(
        Object.fromEntries(nextOrdered.map((row, idx) => [row.slug, String(idx + 1)]))
      );

      setMessage(`Collection order updated: ${moved.slug} ${direction === 'up' ? 'up' : 'down'}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to move collection');
    } finally {
      setCollectionOrderBusy(false);
    }
  };

  const handleSetCollectionPosition = async (slug: string, inputPosition: number) => {
    try {
      if (collectionOrderBusy) return;
      const fromIndex = orderedCollections.findIndex((c) => String(c.slug || '') === String(slug || ''));
      if (fromIndex < 0) return;
      const targetIndex = Math.max(0, Math.min(orderedCollections.length - 1, Math.floor(Number(inputPosition) - 1)));
      if (targetIndex === fromIndex) return;
      setCollectionOrderBusy(true);

      const nextOrdered = [...orderedCollections];
      const [moved] = nextOrdered.splice(fromIndex, 1);
      nextOrdered.splice(targetIndex, 0, moved);

      const normalizedOrders = new Map<string, number>();
      nextOrdered.forEach((row, idx) => normalizedOrders.set(row.slug, (idx + 1) * 10));

      const changed = nextOrdered.filter((row) => {
        const nextOrder = normalizedOrders.get(row.slug)!;
        const currentOrder = getCollectionDisplayOrder(
          collections.find((c) => c.slug === row.slug) || row,
          Number.MAX_SAFE_INTEGER
        );
        return currentOrder !== nextOrder;
      });

      await Promise.all(
        changed.map((row) => saveCollectionDisplayOrder(row, normalizedOrders.get(row.slug)!))
      );

      setCollections((prev) =>
        prev.map((row) => {
          const nextOrder = normalizedOrders.get(row.slug);
          if (nextOrder === undefined) return row;
          return {
            ...row,
            metadata: { ...(row.metadata || {}), displayOrder: nextOrder, display_order: nextOrder },
          };
        })
      );
      setCollectionOrderDraftBySlug(
        Object.fromEntries(nextOrdered.map((row, idx) => [row.slug, String(idx + 1)]))
      );
      setMessage(`Collection moved to position ${targetIndex + 1}: ${moved.slug}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to set collection position');
    } finally {
      setCollectionOrderBusy(false);
    }
  };

  const getDraftPosition = (slug: string, fallbackIndex: number): number => {
    const raw = String(collectionOrderDraftBySlug[slug] ?? String(fallbackIndex + 1)).trim();
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed)) return fallbackIndex + 1;
    return Math.max(1, Math.min(orderedCollections.length, parsed));
  };

  const isDraftDirty = (slug: string, index: number): boolean => {
    return getDraftPosition(slug, index) !== index + 1;
  };

  const handleSaveDraftPosition = async (slug: string, index: number) => {
    const target = getDraftPosition(slug, index);
    await handleSetCollectionPosition(slug, target);
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
            <div className="relative">
              <input
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
                placeholder="Collection name or slug (type e.g. b...)"
                value={integrationForm.query}
                onFocus={() => setShowIntegrationSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowIntegrationSuggestions(false), 120);
                }}
                onChange={(e) => {
                  setIntegrationForm((p) => ({ ...p, query: e.target.value }));
                  setShowIntegrationSuggestions(true);
                }}
              />
              {showIntegrationSuggestions && (
                <div className="absolute z-20 mt-1 w-full rounded border border-gray-700 bg-black/95 shadow-xl max-h-72 overflow-auto">
                  {integrationSuggestionsLoading ? (
                    <div className="px-3 py-2 text-xs text-gray-400">Searching collections...</div>
                  ) : integrationSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No suggestions</div>
                  ) : (
                    integrationSuggestions.map((s) => (
                      <button
                        key={`${s.slug}-${s.name}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIntegrationForm((p) => ({ ...p, query: s.slug || s.name }));
                          setShowIntegrationSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 border-b border-gray-800 last:border-b-0 hover:bg-gray-900"
                      >
                        <div className="text-sm text-white">{s.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{s.slug}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Create / Update Collection</h2>
              <span className={`text-xs px-2 py-1 rounded ${editingCollectionSlug ? 'bg-amber-900/40 text-amber-200 border border-amber-700/50' : 'bg-zinc-800 text-zinc-200 border border-zinc-600'}`}>
                {editingCollectionSlug ? `Edit: ${editingCollectionSlug}` : 'Create mode'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
                value={editingCollectionSlug}
                onChange={(e) => {
                  const slug = e.target.value;
                  setEditingCollectionSlug(slug);
                  if (slug) handleLoadCollectionForEdit(slug);
                }}
              >
                <option value="">Load existing collection for edit...</option>
                {orderedCollections.map((c, index) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => editingCollectionSlug && handleLoadCollectionForEdit(editingCollectionSlug)}
                disabled={!editingCollectionSlug}
                className="px-3 py-2 bg-zinc-700 rounded hover:bg-zinc-600 disabled:opacity-50 text-sm font-semibold"
              >
                Reload Selected
              </button>
              <button
                type="button"
                onClick={handleResetCollectionForm}
                className="px-3 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-sm font-semibold"
              >
                New Collection
              </button>
            </div>
            <input
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded disabled:opacity-70"
              placeholder="Slug (e.g. badcats)"
              value={collectionForm.slug}
              onChange={(e) => setCollectionForm((p) => ({ ...p, slug: e.target.value }))}
              disabled={!!editingCollectionSlug}
            />
            <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Name" value={collectionForm.name} onChange={(e) => setCollectionForm((p) => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Symbol" value={collectionForm.symbol} onChange={(e) => setCollectionForm((p) => ({ ...p, symbol: e.target.value }))} />
              <input className="w-full px-3 py-2 bg-black border border-gray-700 rounded" placeholder="Cover image URL" value={collectionForm.coverImage} onChange={(e) => setCollectionForm((p) => ({ ...p, coverImage: e.target.value }))} />
            </div>
            <div className="border border-gray-700 rounded p-3 bg-black/30">
              <p className="text-xs text-gray-400 mb-2">Or upload cover image from your PC</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCollectionCoverFileSelect(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-sm"
              />
              {collectionCoverFileName && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 truncate">Loaded: {collectionCoverFileName}</span>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600"
                    onClick={() => {
                      setCollectionCoverFileName('');
                      setCollectionForm((p) => ({ ...p, coverImage: '' }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              {collectionForm.coverImage && (
                <img
                  src={collectionForm.coverImage}
                  alt="Collection cover preview"
                  className="mt-2 h-24 w-24 object-cover rounded border border-gray-700"
                />
              )}
            </div>
            <textarea className="w-full px-3 py-2 bg-black border border-gray-700 rounded min-h-[80px]" placeholder="Description" value={collectionForm.description} onChange={(e) => setCollectionForm((p) => ({ ...p, description: e.target.value }))} />
            <textarea className="w-full px-3 py-2 bg-black border border-gray-700 rounded min-h-[80px] font-mono text-xs" placeholder='Metadata JSON, e.g. {"supply":500}' value={collectionForm.metadataJson} onChange={(e) => setCollectionForm((p) => ({ ...p, metadataJson: e.target.value }))} />
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={collectionForm.verified} onChange={(e) => setCollectionForm((p) => ({ ...p, verified: e.target.checked }))} />
              Verified
            </label>
            <div>
              <button onClick={handleSaveCollection} className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 font-semibold">
                {editingCollectionSlug ? 'Update Collection' : 'Save Collection'}
              </button>
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

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <h2 className="font-bold">View / Edit / Download Hashlist</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
              placeholder="Collection slug (e.g. slums)"
              value={hashlistEditorSlug}
              onChange={(e) => setHashlistEditorSlug(e.target.value)}
            />
            <button
              onClick={handleLoadHashlistEditor}
              disabled={hashlistEditorLoading}
              className="px-4 py-2 bg-zinc-700 rounded hover:bg-zinc-600 disabled:opacity-50 font-semibold"
            >
              {hashlistEditorLoading ? 'Loading...' : 'Load Hashlist'}
            </button>
            <button
              onClick={() => setHashlistEditorVisible((v) => !v)}
              className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 font-semibold"
            >
              {hashlistEditorVisible ? 'Hide Text Editor' : 'Show Text Editor'}
            </button>
          </div>
          {collections.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded"
                value={hashlistEditorSlug}
                onChange={(e) => setHashlistEditorSlug(e.target.value)}
              >
                <option value="">Pick collection from list</option>
                {orderedCollections
                  .filter((c) => c.active !== false)
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({c.slug})
                    </option>
                  ))}
              </select>
              <button
                onClick={handleLoadHashlistEditor}
                disabled={hashlistEditorLoading || !hashlistEditorSlug}
                className="px-4 py-2 bg-zinc-700 rounded hover:bg-zinc-600 disabled:opacity-50 font-semibold"
              >
                Load Selected Collection Hashlist
              </button>
            </div>
          )}

          {hashlistEditorVisible && (
            <div className="space-y-3">
              <textarea
                className="w-full min-h-[260px] px-3 py-2 bg-black border border-gray-700 rounded font-mono text-xs"
                placeholder="Hashlist JSON array"
                value={hashlistEditorText}
                onChange={(e) => setHashlistEditorText(e.target.value)}
              />
              <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={hashlistEditorReplaceMissing}
                  onChange={(e) => setHashlistEditorReplaceMissing(e.target.checked)}
                />
                Replace mode: delete existing entries not present in edited JSON
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveHashlistEditor}
                  disabled={hashlistEditorLoading}
                  className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 disabled:opacity-50 font-semibold"
                >
                  {hashlistEditorLoading ? 'Saving...' : 'Save Hashlist'}
                </button>
                <button
                  onClick={handleDownloadHashlistEditor}
                  className="px-4 py-2 bg-sky-700 rounded hover:bg-sky-600 font-semibold"
                >
                  Download JSON
                </button>
              </div>
            </div>
          )}
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
            <label className="inline-flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={hashlistImportReplaceMissing}
                onChange={(e) => setHashlistImportReplaceMissing(e.target.checked)}
              />
              Replace missing entries (recommended): delete DB rows not present in this file
            </label>
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
              <button onClick={handleRecomputeOrdinalRarity} className="px-3 py-2 bg-purple-700 rounded hover:bg-purple-600 text-sm">
                Compute Ordinal Rarity
              </button>
            </div>
            <p className="text-xs text-gray-500">Total inscriptions: {traitsTotal}</p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded bg-fuchsia-900/50 text-fuchsia-200 border border-fuchsia-700/60">1%</span>
              <span className="px-2 py-1 rounded bg-sky-900/50 text-sky-200 border border-sky-700/60">2-5%</span>
              <span className="px-2 py-1 rounded bg-emerald-900/50 text-emerald-200 border border-emerald-700/60">5-20%</span>
              <span className="px-2 py-1 rounded bg-amber-900/50 text-amber-200 border border-amber-700/60">20-50%</span>
              <span className="px-2 py-1 rounded bg-zinc-800 text-zinc-100 border border-zinc-600">50-100%</span>
            </div>
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
                <p className="text-xs text-gray-400 mb-1">Traits (per value rarity)</p>
                {traitsSummary.length === 0 ? (
                  <p className="text-xs text-gray-500">No trait data</p>
                ) : (
                  traitsSummary.slice(0, 200).map((t, idx) => {
                    const percent = traitsTotal > 0 ? (Number(t.count || 0) / traitsTotal) * 100 : 0;
                    const band = getTraitRarityBand(percent);
                    return (
                      <div key={`${t.trait_type}-${t.value}-${idx}`} className="text-xs text-gray-300 flex items-center justify-between gap-2 py-0.5">
                        <span className="truncate">{t.trait_type}: {t.value}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-400">{t.count}</span>
                          <span className="font-mono text-[11px] text-white">{percent.toFixed(1)}%</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${band.className}`}>{band.label}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 font-semibold flex items-center justify-between gap-3">
            <span>Collections</span>
            <span className="text-xs text-gray-400">
              Position im Feld aendern und mit <span className="text-emerald-300">Save</span> speichern
            </span>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 sticky top-0">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Verified</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {orderedCollections.map((c, index) => (
                  <tr key={c.slug} className="border-t border-gray-800">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveCollection(c.slug, 'up')}
                          disabled={index === 0 || collectionOrderBusy}
                          className="px-2 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700 text-xs disabled:opacity-40"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveCollection(c.slug, 'down')}
                          disabled={index === orderedCollections.length - 1 || collectionOrderBusy}
                          className="px-2 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700 text-xs disabled:opacity-40"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={orderedCollections.length}
                          value={collectionOrderDraftBySlug[c.slug] ?? String(index + 1)}
                          disabled={collectionOrderBusy}
                          className="w-14 px-1.5 py-0.5 bg-black border border-gray-700 rounded text-[11px] font-mono text-right disabled:opacity-50"
                          title="Set exact position (1 = top)"
                          onChange={(e) => {
                            setCollectionOrderDraftBySlug((prev) => ({ ...prev, [c.slug]: e.target.value }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveDraftPosition(c.slug, index);
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSaveDraftPosition(c.slug, index)}
                          disabled={collectionOrderBusy || !isDraftDirty(c.slug, index)}
                          className="px-2 py-0.5 bg-emerald-700 rounded hover:bg-emerald-600 text-[11px] disabled:opacity-40"
                          title="Save position"
                        >
                          Save
                        </button>
                        <span className="text-[11px] text-gray-400 font-mono min-w-[2rem] text-right">
                          {Number.isFinite(getCollectionDisplayOrder(c)) ? getCollectionDisplayOrder(c) : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono">{c.slug}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2">{c.verified ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2">{c.active ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{c.updated_at ? new Date(c.updated_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => {
                            setHashlistEditorSlug(c.slug);
                            setHashlistEditorVisible(true);
                            handleLoadHashlistEditor(c.slug);
                          }}
                          className="px-2 py-1 bg-emerald-700 rounded hover:bg-emerald-600 text-xs"
                        >
                          Edit Hashlist
                        </button>
                        <button
                          onClick={() => handleLoadCollectionForEdit(c.slug)}
                          className="px-2 py-1 bg-sky-700 rounded hover:bg-sky-600 text-xs"
                        >
                          Edit Collection
                        </button>
                        <button
                          onClick={() => handleArchiveCollection(c.slug, !!c.active)}
                          className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600 text-xs"
                        >
                          {c.active ? 'Archive' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {collections.length === 0 && (
                  <tr><td className="px-4 py-3 text-gray-500" colSpan={7}>No collections yet</td></tr>
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

