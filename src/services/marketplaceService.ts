const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

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

export interface MarketplaceTraitSummaryRow {
  trait_type: string;
  value: string;
  count: number;
}

export interface MarketplaceRaritySummaryRow {
  rarity: string;
  count: number;
}

export async function getMarketplaceRanking(): Promise<MarketplaceCollectionRanking[]> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/ranking/collections`);
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
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to load marketplace collections');
  const data = await res.json();
  return data.collections || [];
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

export async function importMarketplaceHashlist(payload: {
  adminAddress: string;
  collectionSlug: string;
  entries: Array<Record<string, any>>;
}): Promise<{
  success: boolean;
  collectionSlug: string;
  stats: {
    imported: number;
    skipped: number;
    withTraits: number;
    rarityCounts: Record<string, number>;
  };
}> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/collections/${encodeURIComponent(payload.collectionSlug)}/import-hashlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminAddress: payload.adminAddress,
      entries: payload.entries,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to import marketplace hashlist');
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

export async function getMarketplaceHealth(): Promise<{ ok: boolean; db: boolean; mode: string; timestamp: string }> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/health`);
  if (!res.ok) throw new Error('Failed to load marketplace health');
  return res.json();
}

export async function getMarketplaceProfile(address: string): Promise<MarketplaceProfile> {
  const res = await fetch(`${API_URL}/api/marketplace/v1/profile/${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('Failed to load marketplace profile');
  return res.json();
}

export async function getMarketplaceListings(params?: {
  status?: 'active' | 'sold' | 'cancelled' | 'all';
  sellerAddress?: string;
  collectionSlug?: string;
  limit?: number;
  offset?: number;
}): Promise<MarketplaceListing[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.sellerAddress) query.set('sellerAddress', params.sellerAddress);
  if (params?.collectionSlug) query.set('collectionSlug', params.collectionSlug);
  if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
  const res = await fetch(`${API_URL}/api/marketplace/v1/listings?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load marketplace listings');
  const data = await res.json();
  return data.listings || [];
}

export async function createMarketplaceListing(payload: {
  inscriptionId: string;
  collectionSlug: string;
  sellerAddress: string;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to complete advanced PSBT purchase');
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

