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
  // Schritt 1: Hole PSBTs vom Backend (mit Platzhalter-Empfänger)
  const response = await fetch(`${API_URL}/api/trades/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maker: request.maker,
      offerCards: request.offerCards,
      requestCards: request.requestCards,
      expiresAt: request.expiresAt,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.msg || 'Failed to create trade offer');
  }

  const data = await response.json();

  // Wenn PSBTs zurückgegeben werden, signiere sie im Frontend
  if (data.requiresSigning && data.psbts && Array.isArray(data.psbts)) {
    const { signPSBT } = await import('../utils/wallet');
    
    if (data.psbts.length === 0) {
      throw new Error('No PSBTs found to sign');
    }

    // Signiere alle PSBTs (jede Karte einzeln)
    const signedPsbts = [];
    for (const psbtData of data.psbts) {
      try {
        console.log(`[Trading] Maker signing PSBT for ${psbtData.inscriptionId} (with placeholder recipient)...`);
        const signedPsbtHex = await signPSBT(psbtData.psbtBase64, request.walletType, false);
        signedPsbts.push({
          inscriptionId: psbtData.inscriptionId,
          signedPsbtHex: signedPsbtHex,
        });
        console.log(`[Trading] ✅ Maker signed PSBT for ${psbtData.inscriptionId}`);
      } catch (error: any) {
        throw new Error(`Failed to sign PSBT for ${psbtData.inscriptionId}: ${error.message}`);
      }
    }

    // Schritt 2: Sende signierte PSBTs zurück zum Backend
    const finalResponse = await fetch(`${API_URL}/api/trades/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maker: request.maker,
        offerCards: request.offerCards,
        requestCards: request.requestCards,
        expiresAt: request.expiresAt,
        signedPsbts: signedPsbts,
      }),
    });

    if (!finalResponse.ok) {
      const error = await finalResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.msg || 'Failed to save signed trade offer');
    }

    const finalData = await finalResponse.json();
    return finalData;
  }

  // Fallback: Direktes Offer (ohne PSBTs - Legacy)
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

  // Wenn PSBTs zurückgegeben werden, signiere nur Taker's PSBTs
  if (data.requiresSigning && data.takerPsbts && Array.isArray(data.takerPsbts)) {
    const { signPSBT } = await import('../utils/wallet');
    
    if (data.takerPsbts.length === 0) {
      throw new Error('No PSBTs found for taker to sign');
    }

    // Signiere alle Taker's PSBTs (jede Karte einzeln)
    const signedPsbts = [];
    for (const psbtData of data.takerPsbts) {
      try {
        console.log(`[Trading] Signing PSBT for ${psbtData.inscriptionId}...`);
        const signedPsbtHex = await signPSBT(psbtData.psbtBase64, walletType, false);
        signedPsbts.push({
          inscriptionId: psbtData.inscriptionId,
          signedPsbtHex: signedPsbtHex,
        });
        console.log(`[Trading] ✅ Signed PSBT for ${psbtData.inscriptionId}`);
      } catch (error: any) {
        throw new Error(`Failed to sign PSBT for ${psbtData.inscriptionId}: ${error.message}`);
      }
    }

    // Broadcast signierte PSBTs (Maker-PSBTs werden automatisch vom Backend verwendet, falls vorhanden)
    const broadcastResponse = await fetch(`${API_URL}/api/trades/offers/${offerId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        signedPsbts, // Nur Taker's signierte PSBTs
      }),
    });

    if (!broadcastResponse.ok) {
      const error = await broadcastResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.msg || 'Failed to broadcast trade transactions');
    }

    const broadcastData = await broadcastResponse.json();
    
    // Warnung: Trade ist noch nicht vollständig, wenn Maker noch nicht signiert hat
    if (data.makerPsbts && data.makerPsbts.length > 0) {
      const makerSignedPsbts = broadcastData.makerSignedPsbtsCount || 0;
      if (makerSignedPsbts === 0) {
        console.warn('[Trading] ⚠️ Trade partially completed. Maker must still sign their PSBTs.');
      }
    }
    
    return broadcastData.offer;
  }

  // Fallback: Direktes Accept (ohne PSBTs - Legacy)
  return data.offer;
};

/**
 * Signiere Maker's PSBTs für ein Trade Offer
 */
export const signMakerPsbts = async (
  offerId: string,
  makerPsbts: Array<{ inscriptionId: string; psbtBase64: string }>,
  walletType: 'unisat' | 'xverse'
): Promise<void> => {
  const { signPSBT } = await import('../utils/wallet');
  
  // Signiere alle Maker's PSBTs (jede Karte einzeln)
  const signedPsbts = [];
  for (const psbtData of makerPsbts) {
    try {
      console.log(`[Trading] Maker signing PSBT for ${psbtData.inscriptionId}...`);
      const signedPsbtHex = await signPSBT(psbtData.psbtBase64, walletType, false);
      signedPsbts.push({
        inscriptionId: psbtData.inscriptionId,
        signedPsbtHex: signedPsbtHex,
      });
      console.log(`[Trading] ✅ Maker signed PSBT for ${psbtData.inscriptionId}`);
    } catch (error: any) {
      throw new Error(`Failed to sign PSBT for ${psbtData.inscriptionId}: ${error.message}`);
    }
  }

  // Sende signierte PSBTs an Backend
  const response = await fetch(`${API_URL}/api/trades/offers/${offerId}/sign-maker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      signedPsbts,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.msg || 'Failed to save signed maker PSBTs');
  }
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



