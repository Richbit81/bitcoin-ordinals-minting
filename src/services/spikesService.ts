/**
 * Spikes mint service (client).
 *
 * Like High Rollers, Spikes is minted on-demand by the project's own ord-wallet
 * (via the backend + shared ord-companion, collection="spikes"). The buyer pays
 * a quoted amount to a shown BTC address and receives the child inscription
 * (linked to the Spikes parent) on their taproot address.
 */

import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl().replace(/\/$/, '');

export function spikesImageUrl(itemId: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}images/spikes/${itemId}.avif`;
}

export function isTaprootAddress(address: string): boolean {
  return typeof address === 'string' && /^bc1p[0-9a-z]{20,90}$/i.test(address.trim());
}

export interface SpikesStatus {
  active: boolean;
  total: number;
  minted: number;
  available: number;
  pending?: number;
  priceSats?: number;
  maxPerTx?: number;
}

export interface SpikesQuote {
  orderId: string;
  itemId: string;
  name: string;
  quantity?: number;
  items?: Array<{ itemId: string; name: string }>;
  paymentAddress: string;
  amountSats: number;
  breakdown: { priceSats: number; postageSats: number; feeSats: number; bufferSats: number };
  feeRate: number;
  expiresAt: string;
}

export type SpikesOrderStatus = 'pending' | 'paid' | 'minting' | 'minted' | 'expired' | 'failed';

export interface SpikesOrder {
  orderId: string;
  itemId: string;
  quantity?: number;
  status: SpikesOrderStatus;
  amountSats: number;
  paidSats: number;
  paymentAddress: string;
  inscriptionId: string | null;
  inscriptionIds?: string[];
  items?: Array<{ itemId: string; name: string | null; inscriptionId: string | null }>;
  error: string | null;
  expiresAt: string | null;
}

export interface SpikesMint {
  item_id: string;
  name: string;
  inscription_id: string | null;
  owner_address: string | null;
  minted_at: string | null;
}

async function jsonOrThrow(res: Response) {
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(json?.message || json?.error || `HTTP ${res.status}`), { status: res.status, data: json });
  return json;
}

export async function fetchSpikesStatus(): Promise<SpikesStatus> {
  return jsonOrThrow(await fetch(`${API_URL}/api/spikes/status`));
}

export async function fetchSpikesMinted(): Promise<SpikesMint[]> {
  const j = await jsonOrThrow(await fetch(`${API_URL}/api/spikes/minted`));
  return Array.isArray(j?.mints) ? j.mints : [];
}

export async function requestSpikesQuote(taproot: string, quantity = 1): Promise<SpikesQuote> {
  return jsonOrThrow(
    await fetch(`${API_URL}/api/spikes/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taproot, quantity }),
    }),
  );
}

export async function fetchSpikesOrder(orderId: string): Promise<SpikesOrder> {
  return jsonOrThrow(await fetch(`${API_URL}/api/spikes/order/${encodeURIComponent(orderId)}`));
}
