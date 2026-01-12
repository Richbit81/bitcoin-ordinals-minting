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
    
    // Filtere nur Taker's PSBTs (die der Taker signieren kann)
    const takerPsbts = data.psbts.filter((psbt: any) => psbt.from === 'taker');
    const makerPsbts = data.psbts.filter((psbt: any) => psbt.from === 'maker');
    
    if (takerPsbts.length === 0) {
      throw new Error('No PSBTs found for taker to sign');
    }

    // Signiere nur Taker's PSBTs
    const signedPsbts = [];
    for (const psbtData of takerPsbts) {
      try {
        const signedPsbtHex = await signPSBT(psbtData.psbtBase64, walletType, false);
        signedPsbts.push({
          inscriptionId: psbtData.inscriptionId,
          signedPsbtHex: signedPsbtHex,
        });
      } catch (error: any) {
        throw new Error(`Failed to sign PSBT for ${psbtData.inscriptionId}: ${error.message}`);
      }
    }

    // Speichere signierte PSBTs im Backend (Maker muss später seine signieren)
    // Für jetzt: Broadcast nur Taker's PSBTs
    // TODO: Implementiere vollständigen Flow wo beide Seiten signieren müssen
    
    // Broadcast signierte PSBTs (nur Taker's für jetzt)
    const broadcastResponse = await fetch(`${API_URL}/api/trades/offers/${offerId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        signedPsbts,
        partial: true, // Markiere als partiell (Maker muss noch signieren)
        makerPsbtsCount: makerPsbts.length,
      }),
    });

    if (!broadcastResponse.ok) {
      const error = await broadcastResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.msg || 'Failed to broadcast trade transactions');
    }

    const broadcastData = await broadcastResponse.json();
    
    // Warnung: Trade ist noch nicht vollständig, Maker muss noch signieren
    if (makerPsbts.length > 0) {
      console.warn('[Trading] ⚠️ Trade partially completed. Maker must still sign their PSBTs.');
    }
    
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



