/**
 * High Rollers mint service (client).
 *
 * Unlike the UniSat-based collections, High Rollers is minted on-demand by the
 * project's own ord-wallet (via the backend + ord-companion). The buyer simply
 * pays a quoted amount to a shown BTC address and receives the child inscription
 * (linked to the collection's parent) on their taproot address.
 */

import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl().replace(/\/$/, '');

export function highRollersImageUrl(itemId: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}images/high-rollers/${itemId}.avif`;
}

export function isTaprootAddress(address: string): boolean {
  return typeof address === 'string' && /^bc1p[0-9a-z]{20,90}$/i.test(address.trim());
}

export interface HighRollersStatus {
  active: boolean;
  total: number;
  minted: number;
  available: number;
  pending?: number;
  priceSats?: number;
}

export interface HighRollersQuote {
  orderId: string;
  itemId: string;
  name: string;
  paymentAddress: string;
  amountSats: number;
  breakdown: { priceSats: number; postageSats: number; feeSats: number; bufferSats: number };
  feeRate: number;
  expiresAt: string;
}

export type HighRollersOrderStatus = 'pending' | 'paid' | 'minting' | 'minted' | 'expired' | 'failed';

export interface HighRollersOrder {
  orderId: string;
  itemId: string;
  status: HighRollersOrderStatus;
  amountSats: number;
  paidSats: number;
  paymentAddress: string;
  inscriptionId: string | null;
  error: string | null;
  expiresAt: string | null;
}

export interface HighRollersMint {
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

export async function fetchHighRollersStatus(): Promise<HighRollersStatus> {
  return jsonOrThrow(await fetch(`${API_URL}/api/high-rollers/status`));
}

export async function fetchHighRollersMinted(): Promise<HighRollersMint[]> {
  const j = await jsonOrThrow(await fetch(`${API_URL}/api/high-rollers/minted`));
  return Array.isArray(j?.mints) ? j.mints : [];
}

export async function requestHighRollersQuote(taproot: string): Promise<HighRollersQuote> {
  return jsonOrThrow(
    await fetch(`${API_URL}/api/high-rollers/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taproot }),
    }),
  );
}

export async function fetchHighRollersOrder(orderId: string): Promise<HighRollersOrder> {
  return jsonOrThrow(await fetch(`${API_URL}/api/high-rollers/order/${encodeURIComponent(orderId)}`));
}
