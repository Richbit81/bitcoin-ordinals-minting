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
  const response = await fetch(`${API_URL}/api/trades/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.msg || 'Failed to create trade offer');
  }

  const data = await response.json();
  return data;
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
  return data.offers || [];
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
  return data;
};

/**
 * Akzeptiere ein Trade Offer
 */
export const acceptTradeOffer = async (
  offerId: string,
  taker: string,
  walletType: 'unisat' | 'xverse'
): Promise<TradeOffer> => {
  // Schritt 1: Hole PSBTs vom Backend
  const response = await fetch(`${API_URL}/api/trades/offers/${offerId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taker, walletType }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.msg || 'Failed to accept trade offer');
  }

  const data = await response.json();

  // Wenn PSBTs zurückgegeben werden, signiere sie im Frontend
  if (data.requiresSigning && data.psbts && Array.isArray(data.psbts)) {
    const { signPSBT } = await import('../utils/wallet');
    
    // Signiere alle PSBTs
    const signedPsbts = [];
    for (const psbtData of data.psbts) {
      try {
        // Nur Taker's PSBTs signieren (from === 'taker')
        // Maker's PSBTs müssen vom Maker signiert werden (separater Flow)
        if (psbtData.from === 'taker') {
          const signedPsbtHex = await signPSBT(psbtData.psbtBase64, walletType, false);
          signedPsbts.push({
            inscriptionId: psbtData.inscriptionId,
            signedPsbtHex: signedPsbtHex,
          });
        } else {
          // Maker's PSBTs werden nicht signiert - müssen separat behandelt werden
          // Für jetzt: Fehler werfen, da beide Seiten signieren müssen
          throw new Error('Trade requires both parties to sign. Maker must sign their PSBTs separately.');
        }
      } catch (error: any) {
        throw new Error(`Failed to sign PSBT for ${psbtData.inscriptionId}: ${error.message}`);
      }
    }

    // Broadcast signierte PSBTs
    const broadcastResponse = await fetch(`${API_URL}/api/trades/offers/${offerId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedPsbts }),
    });

    if (!broadcastResponse.ok) {
      const error = await broadcastResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.msg || 'Failed to broadcast trade transactions');
    }

    const broadcastData = await broadcastResponse.json();
    return broadcastData.offer;
  }

  // Fallback: Direktes Accept (ohne PSBTs - Legacy)
  return data.offer;
};

/**
 * Ziehe ein Trade Offer zurück
 */
export const cancelTradeOffer = async (offerId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/trades/offers/${offerId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.msg || 'Failed to cancel trade offer');
  }
};



