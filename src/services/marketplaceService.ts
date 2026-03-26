const API_URL = String(import.meta.env.VITE_INSCRIPTION_API_URL || 'https://api.richart.app').replace(/\/+$/, '');
const API_FALLBACK_URL = 'https://bitcoin-ordinals-backend-production.up.railway.app';

let _primaryDown = false;
let _primaryDownSince = 0;
const PRIMARY_RETRY_MS = 120_000;

async function fetchWithFallback(pathWithQuery: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const skipPrimary = _primaryDown && (now - _primaryDownSince) < PRIMARY_RETRY_MS;

  if (!skipPrimary) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const primary = await fetch(`${API_URL}${pathWithQuery}`, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (primary.status !== 502 && primary.status !== 503 && primary.status !== 504) {
        _primaryDown = false;
        return primary;
      }
      _primaryDown = true;
      _primaryDownSince = now;
    } catch {
      _primaryDown = true;
      _primaryDownSince = now;
    }
  }

  return fetch(`${API_FALLBACK_URL}${pathWithQuery}`, init);
}

async function fetchMarketplace(pathWithQuery: string, init?: RequestInit): Promise<Response> {
  return fetchWithFallback(pathWithQuery, init);
}

export interface MarketplaceCollectionRanking {
  slug: string;
  name: string;
  cover_image?: string | null;
  listed_count: number;
  floor_price_sats: number;
  sales_count_7d: number;
  volume_sats_7d: number;
  sales_count_all: number;
  volume_sats_all: number;
}

export interface MarketplaceCollection {
  slug: string;
  name: string;
  symbol?: string | null;
  description?: string | null;
  cover_image?: string | null;
  verified?: boolean;
  source?: string;
  source_ref?: string | null;
  metadata?: Record<string, any>;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MarketplaceCollectionInscription {
  inscription_id: string;
  collection_slug?: string;
  owner_address?: string;
  listed?: boolean;
  attributes?: Array<{ trait_type?: string; value?: string }>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  previewUrl: string;
  contentUrl: string;
}

export interface MarketplaceBisCollectionSuggestion {
  slug: string;
  name: string;
  symbol?: string | null;
  image?: string | null;
  median_number?: number;
}

export interface MarketplaceProfile {
  address: string;
  listingStats: {
    active: number;
    sold: number;
    totalVolumeSats: number;
  };
  recentListings: Array<{
    id: string;
    inscription_id: string;
    collection_slug: string;
    price_sats: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  recentSales: Array<{
    id: string;
    listing_id: string;
    inscription_id: string;
    collection_slug: string;
    seller_address: string;
    buyer_address: string;
    price_sats: number;
    txid?: string;
    sold_at: string;
  }>;
  walletInscriptions: Array<{
    inscription_id: string;
    collection_slug?: string;
    collection_name?: string | null;
    owner_address?: string;
    listed?: boolean;
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
  }>;
}

export interface MarketplaceListing {
  id: string;
  inscription_id: string;
  collection_slug: string;
  seller_address: string;
  buyer_receive_address: string;
  price_sats: number;
  status: string;
  signed_psbt_base64?: string;
  inscription_attributes?: Array<{
    trait_type?: string;
    value?: string;
  }>;
  inscription_metadata?: Record<string, any>;
  sale_txid?: string;
  sale_metadata?: {
    source?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface MarketplaceActivity {
  id: number;
  activity_type: 'list' | 'sale' | 'cancel' | string;
  collection_slug: string;
  inscription_id: string;
  listing_id: string;
  payload?: Record<string, any>;
  created_at: string;
  seller_address?: string;
  buyer_address?: string;
  price_sats?: number;
  txid?: string;
}

export interface MarketplaceInscriptionDetail {
  inscriptionId: string;
  previewUrl: string;
  contentUrl: string;
  marketplaceInscription: {
    inscription_id: string;
    collection_slug?: string;
    owner_address?: string;
    listed?: boolean;
    attributes?: Array<{ trait_type?: string; value?: string }>;
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
  } | null;
  listingHistory: Array<{
    id: string;
    inscription_id: string;
    collection_slug?: string;
    seller_address?: string;
    buyer_receive_address?: string;
    price_sats: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  salesHistory: Array<{
    id: string;
    listing_id?: string;
    inscription_id: string;
    collection_slug?: string;
    seller_address?: string;
    buyer_address?: string;
    price_sats: number;
    txid?: string;
    metadata?: Record<string, any>;
    sold_at?: string;
    created_at?: string;
  }>;
  activity: MarketplaceActivity[];
  offersHistory: Array<{
    id: string;
    listing_id: string;
    inscription_id: string;
    collection_slug?: string;
    buyer_address: string;
    seller_address?: string;
    offer_price_sats: number;
    status: string;
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
  }>;
  chainInfo?: Record<string, any> | null;
}

export interface MarketplaceTraitSummaryRow {
  trait_type: string;
  value: string;
  count: number;
}

export interface MarketplaceRaritySummaryRow {
  rarity: string;
  count: number;
}

export interface MarketplaceHashlistEntry {
  inscriptionId: string;
  ownerAddress?: string;
  name?: string;
  itemIndex?: number | null;
  rarity?: string;
  attributes?: Array<{ trait_type?: string; value?: string }>;
  metadata?: Record<string, any>;
}

export async function getMarketplaceRanking(): Promise<MarketplaceCollectionRanking[]> {
  const res = await fetchMarketplace('/api/marketplace/v1/ranking/collections');
  if (!res.ok) throw new Error('Failed to load marketplace ranking');
  const data = await res.json();
  return data.ranking || [];
}

export async function getMarketplaceCollections(params?: {
  includeInactive?: boolean;
  adminAddress?: string;
}): Promise<MarketplaceCollection[]> {
  const query = new URLSearchParams();
  if (params?.includeInactive) query.set('includeInactive', '1');
  if (params?.adminAddress) query.set('adminAddress', params.adminAddress);
  const qs = query.toString();
  const res = await fetchMarketplace(`/api/marketplace/v1/collections${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to load marketplace collections');
  const data = await res.json();
  return data.collections || [];
}

export async function getMarketplaceCollectionInscriptions(params: {
  collectionSlug: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ collectionSlug: string; total: number; inscriptions: MarketplaceCollectionInscription[] }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (typeof params.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params.offset === 'number') query.set('offset', String(params.offset));
  const res = await fetchMarketplace(
    `/api/marketplace/v1/collections/${encodeURIComponent(params.collectionSlug)}/inscriptions?${query.toString()}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load collection inscriptions');
  return data;
}

export async function createMarketplaceCollection(payload: {
  adminAddress: string;
  slug: string;
  name: string;
  symbol?: string;
  description?: string;
  coverImage?: string;
  verified?: boolean;
  source?: string;
  sourceRef?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; slug: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to save marketplace collection');
  return data;
}

export async function integrateMarketplaceCollectionByName(payload: {
  adminAddress: string;
  query: string;
  maxInscriptionIds?: number;
}): Promise<{
  success: boolean;
  query: string;
  collection: { slug: string; name: string };
  stats: { holdersFetched: number; inscriptionsImported: number; maxInscriptionIds: number };
}> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections/integrate-by-name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to integrate collection by name');
  return data;
}

export async function searchMarketplaceBisCollections(payload: {
  q: string;
  adminAddress: string;
  limit?: number;
}): Promise<MarketplaceBisCollectionSuggestion[]> {
  const query = new URLSearchParams();
  query.set('q', payload.q);
  query.set('adminAddress', payload.adminAddress);
  if (typeof payload.limit === 'number') query.set('limit', String(payload.limit));
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections/search-bis?${query.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to search marketplace collections');
  return data.collections || [];
}

export async function importMarketplaceHashlist(payload: {
  adminAddress: string;
  collectionSlug: string;
  entries: Array<Record<string, any>>;
  replaceMissing?: boolean;
}): Promise<{
  success: boolean;
  collectionSlug: string;
  stats: {
    imported: number;
    skipped: number;
    withTraits: number;
    deleted?: number;
    rarityCounts: Record<string, number>;
  };
}> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(payload.collectionSlug)}/import-hashlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminAddress: payload.adminAddress,
      entries: payload.entries,
      replaceMissing: payload.replaceMissing === true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to import marketplace hashlist');
  return data;
}

export async function getMarketplaceHashlist(payload: {
  adminAddress: string;
  collectionSlug: string;
}): Promise<{ collectionSlug: string; entries: MarketplaceHashlistEntry[] }> {
  const query = new URLSearchParams();
  query.set('adminAddress', payload.adminAddress);
  const res = await fetch(
    `${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(payload.collectionSlug)}/hashlist?${query.toString()}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load marketplace hashlist');
  return data;
}

export async function updateMarketplaceHashlist(payload: {
  adminAddress: string;
  collectionSlug: string;
  entries: MarketplaceHashlistEntry[];
  replaceMissing?: boolean;
}): Promise<{
  success: boolean;
  collectionSlug: string;
  stats: { imported: number; skipped: number; deleted: number };
}> {
  const res = await fetch(
    `${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(payload.collectionSlug)}/hashlist`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminAddress: payload.adminAddress,
        entries: payload.entries,
        replaceMissing: payload.replaceMissing === true,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to update marketplace hashlist');
  return data;
}

export async function getMarketplaceTraitsSummary(collectionSlug: string): Promise<{
  collectionSlug: string;
  totalInscriptions: number;
  traits: MarketplaceTraitSummaryRow[];
  rarity: MarketplaceRaritySummaryRow[];
}> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(collectionSlug)}/traits-summary`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load marketplace traits summary');
  return data;
}

export async function recomputeMarketplaceRarityFromTraits(payload: {
  adminAddress: string;
  collectionSlug: string;
}): Promise<{
  success: boolean;
  collectionSlug: string;
  updated: number;
  tiers: Record<string, number>;
}> {
  const res = await fetch(
    `${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(payload.collectionSlug)}/recompute-rarity-from-traits`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminAddress: payload.adminAddress,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to recompute rarity from traits');
  return data;
}

export async function getMarketplaceHealth(): Promise<{ ok: boolean; db: boolean; mode: string; timestamp: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/health`);
  if (!res.ok) throw new Error('Failed to load marketplace health');
  return res.json();
}

export async function getMarketplaceProfile(address: string): Promise<MarketplaceProfile> {
  const res = await fetchWithFallback(`/api/marketplace/v1/profile/${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('Failed to load marketplace profile');
  return res.json();
}

export async function getMarketplaceWalletInscriptionsByCollectionScan(
  address: string
): Promise<MarketplaceProfile['walletInscriptions']> {
  const normalizedAddress = String(address || '').trim();
  if (!normalizedAddress) return [];
  const normalizedLower = normalizedAddress.toLowerCase();

  const collections = await getMarketplaceCollections({ includeInactive: false, adminAddress: normalizedAddress });
  const byId = new Map<string, MarketplaceProfile['walletInscriptions'][number]>();

  for (const collection of collections) {
    const slug = String(collection.slug || '').trim();
    if (!slug || collection.active === false) continue;

    let offset = 0;
    let total = Infinity;
    let pageGuard = 0;
    const limit = 120;

    while (offset < total && pageGuard < 200) {
      const page = await getMarketplaceCollectionInscriptions({
        collectionSlug: slug,
        limit,
        offset,
      });
      total = Number(page.total || 0);
      const rows = page.inscriptions || [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const owner = String(row.owner_address || '').trim().toLowerCase();
        if (owner !== normalizedLower) continue;
        const inscriptionId = String(row.inscription_id || '').trim();
        if (!inscriptionId) continue;
        byId.set(inscriptionId, {
          inscription_id: inscriptionId,
          collection_slug: slug,
          collection_name: collection.name || slug,
          owner_address: row.owner_address,
          listed: row.listed,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }

      offset += rows.length;
      pageGuard += 1;
    }
  }

  return Array.from(byId.values());
}

export async function getMarketplaceWalletInscriptionsViaUnisat(
  address: string
): Promise<MarketplaceProfile['walletInscriptions']> {
  const normalizedAddress = String(address || '').trim();
  if (!normalizedAddress) return [];

  const pageSize = 100;
  let cursor = 0;
  let total = Number.POSITIVE_INFINITY;
  let guard = 0;
  const byId = new Map<string, MarketplaceProfile['walletInscriptions'][number]>();

  while (cursor < total && guard < 300) {
    try {
      const res = await fetch(
        `${API_URL}/v1/indexer/address/${encodeURIComponent(normalizedAddress)}/inscription-data?cursor=${cursor}&size=${pageSize}`,
        { headers: { Accept: 'application/json' } }
      );
      let effectiveRes = res;
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        effectiveRes = await fetchWithFallback(
          `/v1/indexer/address/${encodeURIComponent(normalizedAddress)}/inscription-data?cursor=${cursor}&size=${pageSize}`,
          { headers: { Accept: 'application/json' } }
        );
      }
      if (!effectiveRes.ok) {
        // Keep already collected rows if UniSat rate-limits/CORS-blocks later pages.
        break;
      }
      const json = await effectiveRes.json();
      if (Number(json?.code) !== 0) {
        break;
      }

      const data = json?.data || {};
      const rows = Array.isArray(data?.inscription) ? data.inscription : [];
      total = Number(data?.total || 0);

      for (const row of rows) {
        const inscriptionId = String(row?.inscriptionId || row?.inscription_id || '').trim();
        if (!inscriptionId) continue;
        byId.set(inscriptionId, {
          inscription_id: inscriptionId,
          owner_address: normalizedAddress,
          listed: false,
          metadata: {
            name: String(row?.inscriptionNumber ?? '').trim() ? `#${row.inscriptionNumber}` : inscriptionId,
            inscriptionNumber: row?.inscriptionNumber,
            contentType: row?.contentType,
            contentLength: row?.contentLength,
          },
        });
      }

      if (rows.length < pageSize) break;
      cursor += pageSize;
      guard += 1;
    } catch {
      // Network/CORS failure: return partial results instead of failing whole My-Items flow.
      break;
    }
  }

  return Array.from(byId.values());
}

export async function getMarketplaceListings(params?: {
  status?: 'active' | 'sold' | 'cancelled' | 'all';
  sellerAddress?: string;
  collectionSlug?: string;
  inscriptionId?: string;
  limit?: number;
  offset?: number;
  lightweight?: boolean;
}): Promise<MarketplaceListing[]> {
  const buildQuery = (input?: {
    status?: 'active' | 'sold' | 'cancelled' | 'all';
    sellerAddress?: string;
    collectionSlug?: string;
    inscriptionId?: string;
    limit?: number;
    offset?: number;
    lightweight?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (input?.status) query.set('status', input.status);
    if (input?.sellerAddress) query.set('sellerAddress', input.sellerAddress);
    if (input?.collectionSlug) query.set('collectionSlug', input.collectionSlug);
    if (input?.inscriptionId) query.set('inscriptionId', input.inscriptionId);
    if (typeof input?.limit === 'number') query.set('limit', String(input.limit));
    if (typeof input?.offset === 'number') query.set('offset', String(input.offset));
    if (input?.lightweight) query.set('lightweight', '1');
    return query;
  };

  const primaryQuery = buildQuery(params);
  const primaryRes = await fetch(`${API_URL}/api/marketplace/v1/listings?${primaryQuery.toString()}`);
  if (primaryRes.ok) {
    const data = await primaryRes.json();
    return data.listings || [];
  }

  const shouldRetryUnfiltered = Boolean(params?.collectionSlug || params?.inscriptionId);
  if (!shouldRetryUnfiltered) {
    throw new Error('Failed to load marketplace listings');
  }

  // Backend fallback: some deployments throw 500 on filtered listings queries.
  // Retry with broad query, then filter client-side.
  const retryParams = {
    status: params?.status,
    sellerAddress: params?.sellerAddress,
    limit: Math.max(Number(params?.limit || 0), 200) || 200,
    offset: 0,
    lightweight: params?.lightweight,
  };
  const fallbackQuery = buildQuery(retryParams);
  const fallbackRes = await fetch(`${API_URL}/api/marketplace/v1/listings?${fallbackQuery.toString()}`);
  if (!fallbackRes.ok) {
    throw new Error('Failed to load marketplace listings');
  }
  const fallbackData = await fallbackRes.json();
  const baseListings = Array.isArray(fallbackData?.listings) ? fallbackData.listings : [];
  const targetSlug = String(params?.collectionSlug || '').trim().toLowerCase();
  const targetInscription = String(params?.inscriptionId || '').trim();

  return baseListings.filter((row: MarketplaceListing) => {
    if (targetSlug && String(row?.collection_slug || '').trim().toLowerCase() !== targetSlug) return false;
    if (targetInscription && String(row?.inscription_id || '').trim() !== targetInscription) return false;
    return true;
  });
}

export async function getMarketplaceInscriptionDetail(inscriptionId: string): Promise<MarketplaceInscriptionDetail> {
  const res = await fetchWithFallback(`/api/marketplace/v1/inscriptions/${encodeURIComponent(inscriptionId)}/detail`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load inscription detail');
  return data;
}

export async function getMarketplaceRareSatsBatch(inscriptionIds: string[]): Promise<{
  items: Array<{
    inscriptionId: string;
    rareSats?: string | null;
    rareSatsList?: string[];
    rareSatsRawList?: string[];
  }>;
  stats?: { requested: number; resolved: number };
}> {
  const ids = Array.from(new Set((inscriptionIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  const res = await fetchWithFallback(`/api/marketplace/v1/inscriptions/rare-sats-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inscriptionIds: ids }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to resolve rare sats batch');
  return data;
}

export async function createMarketplaceListing(payload: {
  inscriptionId: string;
  collectionSlug: string;
  sellerAddress: string;
  sellerPaymentAddress?: string;
  buyerReceiveAddress: string;
  priceSats: number;
}): Promise<{ listingId: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to create listing');
  return data;
}

export async function prepareMarketplaceListingPsbt(payload: {
  inscriptionId: string;
  collectionSlug: string;
  sellerAddress: string;
  sellerPaymentAddress?: string;
  sellerPublicKey?: string;
  buyerReceiveAddress: string;
  priceSats: number;
  feeRate?: number;
}): Promise<{ listingId: string; psbtBase64: string; ownerAddress?: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inscriptionId: payload.inscriptionId,
      collectionSlug: payload.collectionSlug,
      sellerAddress: payload.sellerAddress,
      sellerPaymentAddress: payload.sellerPaymentAddress || payload.sellerAddress,
      sellerPublicKey: payload.sellerPublicKey || '',
      buyerReceiveAddress: payload.buyerReceiveAddress,
      priceSats: payload.priceSats,
      feeRate: payload.feeRate || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to prepare marketplace listing PSBT');
  return data;
}

export async function finalizeMarketplaceListingPsbt(payload: {
  listingId: string;
  walletAddress: string;
  signedPsbtHex?: string;
  signedPsbtBase64?: string;
}): Promise<{ listingId: string; txid?: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: payload.walletAddress,
      signedPsbtHex: payload.signedPsbtHex || null,
      signedPsbtBase64: payload.signedPsbtBase64 || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to finalize marketplace listing PSBT');
  return data;
}

export async function updateMarketplaceListingPrice(payload: {
  listingId: string;
  adminAddress: string;
  priceSats: number;
}): Promise<{ success: boolean; listing: { id: string; price_sats: number } }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/price`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminAddress: payload.adminAddress,
      priceSats: payload.priceSats,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to update marketplace listing price');
  return data;
}

export async function archiveMarketplaceCollection(payload: {
  slug: string;
  adminAddress: string;
  archived?: boolean;
}): Promise<{ success: boolean; slug: string; active: boolean }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(payload.slug)}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminAddress: payload.adminAddress,
      archived: payload.archived !== false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to archive marketplace collection');
  return data;
}

export async function cancelMarketplaceListing(listingId: string, walletAddress: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(listingId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to cancel listing');
}

export async function completeMarketplacePurchase(payload: {
  listingId: string;
  buyerAddress: string;
  paymentTxid?: string;
}): Promise<{ saleId: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerAddress: payload.buyerAddress,
      paymentTxid: payload.paymentTxid || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to complete purchase');
  return data;
}

export async function completeMarketplacePurchaseAdvanced(payload: {
  listingId: string;
  buyerAddress: string;
  signedPsbtHex?: string;
  signedPsbtBase64?: string;
}): Promise<{ saleId: string; paymentTxid: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/buy-advanced`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerAddress: payload.buyerAddress,
      signedPsbtHex: payload.signedPsbtHex || null,
      signedPsbtBase64: payload.signedPsbtBase64 || null,
    }),
  });
  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const backendMsg = String(data?.error || '').trim();
    if (backendMsg) throw new Error(backendMsg);
    if (res.status === 400) {
      throw new Error('PSBT buy failed: wallet did not provide funded buyer inputs (outputs > inputs).');
    }
    throw new Error(`Failed to complete advanced PSBT purchase (HTTP ${res.status})`);
  }
  return data;
}

export async function prepareMarketplacePurchaseAdvanced(payload: {
  listingId: string;
  buyerAddress: string;
  fundingAddress?: string;
  fundingAddressCandidates?: string[];
  fundingPublicKey?: string;
  fundingPublicKeys?: string[];
  fundingRedeemScripts?: string[];
  feeRate?: number;
}): Promise<{
  fundedPsbtBase64: string;
  funding?: {
    addedInputCount?: number;
    addedInputTotalSats?: number;
    requiredPaymentSats?: number;
    estimatedFeeSats?: number;
    estimatedBuyerDebitSats?: number;
    changeSats?: number;
    signingAddress?: string;
    buyerSigningIndexes?: number[];
  };
}> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/buy-prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerAddress: payload.buyerAddress,
      fundingAddress: payload.fundingAddress || payload.buyerAddress,
      fundingAddressCandidates: Array.isArray(payload.fundingAddressCandidates)
        ? payload.fundingAddressCandidates
        : [],
      fundingPublicKey: payload.fundingPublicKey || '',
      fundingPublicKeys: Array.isArray(payload.fundingPublicKeys) ? payload.fundingPublicKeys : [],
      fundingRedeemScripts: Array.isArray(payload.fundingRedeemScripts) ? payload.fundingRedeemScripts : [],
      feeRate: payload.feeRate || 2,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const baseError = String(data?.error || '').trim() || 'Failed to prepare advanced PSBT purchase';
    const hint = String(data?.hint || '').trim();
    const diagnostics = data?.diagnostics && typeof data.diagnostics === 'object'
      ? ` diagnostics=${JSON.stringify(data.diagnostics)}`
      : '';
    const details = [hint, diagnostics].filter(Boolean).join(' ');
    throw new Error(details ? `${baseError} (${details})` : baseError);
  }
  const prepared = String(data?.fundedPsbtBase64 || '').trim();
  if (!prepared) throw new Error('Backend returned no funded PSBT payload');
  return {
    fundedPsbtBase64: prepared,
    funding: data?.funding || {},
  };
}

export async function createMarketplaceOffer(payload: {
  listingId: string;
  buyerAddress: string;
  offerPriceSats: number;
  note?: string;
}): Promise<{ success: boolean; offerId: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerAddress: payload.buyerAddress,
      offerPriceSats: payload.offerPriceSats,
      note: payload.note || '',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to create offer');
  return data;
}

export async function acceptMarketplaceOffer(payload: {
  listingId: string;
  offerId: string;
  walletAddress: string;
}): Promise<{ success: boolean; status: string }> {
  const res = await fetch(
    `${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/offers/${encodeURIComponent(payload.offerId)}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: payload.walletAddress }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to accept offer');
  return data;
}

export async function declineMarketplaceOffer(payload: {
  listingId: string;
  offerId: string;
  walletAddress: string;
}): Promise<{ success: boolean; status: string }> {
  const res = await fetch(
    `${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/offers/${encodeURIComponent(payload.offerId)}/decline`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: payload.walletAddress }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to decline offer');
  return data;
}

export async function completeMarketplaceOfferSale(payload: {
  listingId: string;
  offerId: string;
  walletAddress: string;
  paymentTxid?: string;
}): Promise<{
  success: boolean;
  saleId: string;
  paymentTxid?: string | null;
  buyerAddress?: string;
  priceSats?: number;
}> {
  const res = await fetch(
    `${API_URL}/api/marketplace/v1/listings/${encodeURIComponent(payload.listingId)}/offers/${encodeURIComponent(payload.offerId)}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: payload.walletAddress,
        paymentTxid: payload.paymentTxid || null,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to complete offer sale');
  return data;
}

export async function getMarketplaceActivity(params?: {
  address?: string;
  collectionSlug?: string;
  limit?: number;
}): Promise<MarketplaceActivity[]> {
  const query = new URLSearchParams();
  if (params?.address) query.set('address', params.address);
  if (params?.collectionSlug) query.set('collectionSlug', params.collectionSlug);
  if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
  const res = await fetch(`${API_URL}/api/marketplace/v1/activity?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load marketplace activity');
  const data = await res.json();
  return data.activity || [];
}

