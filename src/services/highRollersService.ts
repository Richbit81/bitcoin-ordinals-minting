/**
 * High Rollers client helpers.
 *
 * Minting itself goes through UniSat (see highRollersMintService.ts).
 * These helpers talk to the backend for status / minted list / confirm.
 */

import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl().replace(/\/$/, '');

export function highRollersImageUrl(itemId: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const id = String(itemId || '').padStart(4, '0');
  return `${base}images/high-rollers/${id}.avif`;
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
  maxPerTx?: number;
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

/** Record a successful UniSat mint in the High Rollers DB + marketplace. */
export async function confirmHighRollersMint(body: {
  itemId: string;
  inscriptionId: string;
  ownerAddress: string;
  name?: string;
  orderId?: string | null;
  paymentTxid?: string | null;
}): Promise<void> {
  await jsonOrThrow(
    await fetch(`${API_URL}/api/high-rollers/confirm-mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
