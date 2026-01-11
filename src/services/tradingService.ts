const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export interface TradeOffer {
  offerId: string;
  maker: string;
  offerCards: string[];
  requestCards: string[];
  expiresAt: number;
  signature: string;
  createdAt: string;
  status: 'active' | 'accepted' | 'expired' | 'cancelled';
}

export interface CreateOfferRequest {
  maker: string;
  offerCards: string[];
  requestCards: string[];
  expiresAt: number;
  walletType: 'unisat' | 'xverse';
}

/**
 * Erstelle ein Trade Offer
 */
export const createTradeOffer = async (
  request: CreateOfferRequest
): Promise<TradeOffer> => {
  const response = await fetch(`${API_URL}/api/trades/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to create trade offer');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Hole alle Trade Offers
 */
export const getTradeOffers = async (): Promise<TradeOffer[]> => {
  const response = await fetch(`${API_URL}/api/trades/offers`);

  if (!response.ok) {
    throw new Error('Failed to fetch trade offers');
  }

  const data = await response.json();
  return data.data || [];
};

/**
 * Hole ein einzelnes Trade Offer
 */
export const getTradeOffer = async (offerId: string): Promise<TradeOffer> => {
  const response = await fetch(`${API_URL}/api/trades/offers/${offerId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch trade offer');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Akzeptiere ein Trade Offer
 */
export const acceptTradeOffer = async (
  offerId: string,
  walletType: 'unisat' | 'xverse'
): Promise<void> => {
  const response = await fetch(`${API_URL}/api/trades/accept/${offerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletType }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to accept trade offer');
  }
};

/**
 * Ziehe ein Trade Offer zurück
 */
export const cancelTradeOffer = async (offerId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/trades/offer/${offerId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to cancel trade offer');
  }
};



