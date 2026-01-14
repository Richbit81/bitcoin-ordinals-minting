/**
 * Point Shop Service für Frontend
 */

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

// UniSat Marketplace Flow - Response Interfaces
export interface CreateTransferResponse {
  code: number;
  msg: string;
  data: {
    transferId: string;
    psbt: string; // Base64 PSBT
    signIndexes: number[];
    inscriptionId: string;
    recipientAddress: string;
    feeRate: number;
  };
}

export interface ConfirmTransferResponse {
  code: number;
  msg: string;
  data: {
    transferId: string;
    signedTxHex: string;
    inscriptionId: string;
    recipientAddress: string;
  };
}

// Legacy Interface (for backward compatibility)
export interface PreparePSBTResponse {
  success: boolean;
  psbtBase64: string;
  estimatedFee: number;
  estimatedSize: number;
  inputCount: number;
  outputCount: number;
  utxoData?: any;
}

export interface PointShopItem {
  id: string;
  itemType: 'delegate' | 'original' | 'series';
  delegateInscriptionId?: string; // Nur für itemType === 'delegate'
  originalInscriptionId?: string; // Nur für itemType === 'original'
  // NEU für Serie:
  inscriptionIds?: string[]; // Array für mehrere Inskriptionen (series)
  currentIndex?: number; // Aktueller Index (0-based) für series
  totalCount?: number; // Gesamtanzahl für series
  seriesTitle?: string; // z.B. "Exclusive Art #1/7"
  // Bestimmt welcher Typ die Inskriptionen in der Serie sind (für series)
  inscriptionItemType?: 'delegate' | 'original';
  // NEU für Pre-Signing:
  signedTxHex?: string; // Signierte Transaktion (für einzelne original Items)
  presignedTxs?: Array<{ // Signierte Transaktionen (für series)
    inscriptionId: string;
    signedTxHex: string;
    createdAt?: string;
  }>;
  presignedAt?: string; // Wann wurde die Transaktion freigegeben
  title: string;
  description: string;
  pointsCost: number;
  createdAt: string;
  active: boolean;
}

/**
 * Hole alle aktiven Point Shop Items
 */
export const getPointShopItems = async (): Promise<PointShopItem[]> => {
  const response = await fetch(`${API_URL}/api/point-shop/items`);
  if (!response.ok) {
    throw new Error('Failed to fetch point shop items');
  }
  const data = await response.json();
  return data.items || [];
};

/**
 * Minte ein Point Shop Item (bezahlt mit Punkten, nur Fees müssen bezahlt werden)
 */
export const mintPointShopItem = async (
  walletAddress: string,
  itemId: string,
  walletType: string,
  feeRate: number = 1,
  walletState?: { walletType?: 'unisat' | 'xverse' | null }
): Promise<{ inscriptionId: string; txid: string; paymentTxid?: string }> => {
  // Schritt 1: Punkte abziehen (Backend prüft und zieht ab)
  const pointsResponse = await fetch(`${API_URL}/api/point-shop/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      itemId,
      walletType,
      feeRate,
    }),
  });

  if (!pointsResponse.ok) {
    const errorData = await pointsResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to deduct points');
  }

  const pointsData = await pointsResponse.json();
  
  // Schritt 2: Je nach Item-Typ unterschiedlich vorgehen
  if (pointsData.itemType === 'series') {
    // NEU: Für Series: Hole nächste Inskription sequenziell
    const seriesResponse = await fetch(`${API_URL}/api/point-shop/mint-series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        itemId,
        walletType,
        feeRate,
      }),
    });

    if (!seriesResponse.ok) {
      const errorData = await seriesResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to mint series item');
    }

    const seriesData = await seriesResponse.json();
    
    // Je nach Typ der Inskriptionen in der Serie
    if (seriesData.inscriptionItemType === 'delegate') {
      // Für Delegates: Erstelle neue Delegate-Inskription
      const { mintPointShopItem: mintItem } = await import('./pointShopMinting');
      
      const mintingResult = await mintItem(
        seriesData.inscriptionId,
        walletAddress,
        feeRate,
        walletType as 'unisat' | 'xverse' | null,
        walletState
      );

      return {
        inscriptionId: mintingResult.inscriptionId,
        txid: mintingResult.txid,
        paymentTxid: mintingResult.paymentTxid,
        seriesInfo: {
          currentNumber: seriesData.currentNumber,
          totalCount: seriesData.totalCount,
          remaining: seriesData.remaining,
        },
      };
    } else {
      // Für Original-Ordinals: Transfer vom Admin-Wallet
      const transferResponse = await fetch(`${API_URL}/api/point-shop/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          itemId: seriesData.item.id, // Verwende Series Item ID
          recipientAddress: walletAddress,
          feeRate,
          inscriptionId: seriesData.inscriptionId, // Spezifische Inskription aus Serie
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to transfer ordinal');
      }

      const transferData = await transferResponse.json();

      // Wenn PSBT zurückgegeben wird (keine Pre-Signed TX), signiere im Frontend
      if (transferData.requiresSigning && transferData.psbtBase64) {
        const { signPSBT } = await import('../utils/wallet');
        const currentWalletType = walletState?.walletType || (walletType as 'unisat' | 'xverse') || 'unisat';
        
        // Signiere PSBT mit Wallet (UniSat oder Xverse)
        const signedPsbtHex = await signPSBT(transferData.psbtBase64, currentWalletType, false);
        
        // Broadcast signierte PSBT
        const broadcastResponse = await fetch(`${API_URL}/api/point-shop/transfer/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inscriptionId: transferData.inscriptionId,
            signedPsbtHex: signedPsbtHex,
          }),
        });

        if (!broadcastResponse.ok) {
          const errorData = await broadcastResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to broadcast transaction');
        }

        const broadcastData = await broadcastResponse.json();

        return {
          inscriptionId: broadcastData.inscriptionId,
          txid: broadcastData.txid || '',
          seriesInfo: {
            currentNumber: seriesData.currentNumber,
            totalCount: seriesData.totalCount,
            remaining: seriesData.remaining,
          },
        };
      }

      // Pre-Signed TX Flow (Xverse - unverändert)
      return {
        inscriptionId: transferData.inscriptionId,
        txid: transferData.txid || '',
        seriesInfo: {
          currentNumber: seriesData.currentNumber,
          totalCount: seriesData.totalCount,
          remaining: seriesData.remaining,
        },
      };
    }
  } else if (pointsData.itemType === 'delegate') {
    // Für Delegates: Erstelle neue Delegate-Inskription
    const { mintPointShopItem: mintItem } = await import('./pointShopMinting');
    
    const mintingResult = await mintItem(
      pointsData.delegateInscriptionId,
      walletAddress,
      feeRate,
      walletType as 'unisat' | 'xverse' | null
    );

    return {
      inscriptionId: mintingResult.inscriptionId,
      txid: mintingResult.txid,
      paymentTxid: mintingResult.paymentTxid,
    };
  } else {
    // Für Original-Ordinals: Transfer vom Admin-Wallet
    const transferResponse = await fetch(`${API_URL}/api/point-shop/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        itemId,
        recipientAddress: walletAddress,
        feeRate,
      }),
    });

    if (!transferResponse.ok) {
      const errorData = await transferResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to transfer ordinal');
    }

    const transferData = await transferResponse.json();

    // Wenn PSBT zurückgegeben wird (keine Pre-Signed TX), signiere im Frontend
    if (transferData.requiresSigning && transferData.psbtBase64) {
      const { signPSBT } = await import('../utils/wallet');
      const currentWalletType = walletState?.walletType || (walletType as 'unisat' | 'xverse') || 'unisat';
      
      // Signiere PSBT mit Wallet (UniSat oder Xverse)
      const signedPsbtHex = await signPSBT(transferData.psbtBase64, currentWalletType, false);
      
      // Broadcast signierte PSBT
      const broadcastResponse = await fetch(`${API_URL}/api/point-shop/transfer/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscriptionId: transferData.inscriptionId,
          signedPsbtHex: signedPsbtHex,
        }),
      });

      if (!broadcastResponse.ok) {
        const errorData = await broadcastResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to broadcast transaction');
      }

      const broadcastData = await broadcastResponse.json();

      return {
        inscriptionId: broadcastData.inscriptionId,
        txid: broadcastData.txid || '',
      };
    }

    // Pre-Signed TX Flow (Xverse - unverändert)
    return {
      inscriptionId: transferData.inscriptionId,
      txid: transferData.txid || '',
    };
  }
};

/**
 * NEU: Create Transfer Order (UniSat Marketplace Flow)
 * Erstellt eine Transfer-Order mit transferId und unsignierter PSBT
 */
export const createTransfer = async (
  inscriptionId: string,
  recipientAddress: string,
  feeRate: number,
  adminAddress: string,
  itemId?: string
): Promise<CreateTransferResponse> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/point-shop/admin/create-transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inscriptionId,
      recipientAddress,
      feeRate,
      itemId,
    }),
  });

  // Parse response once
  const data: CreateTransferResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.data?.toString() || 'Failed to create transfer');
  }

  if (data.code !== 0) {
    throw new Error(data.msg || 'Failed to create transfer');
  }

  return data;
};

/**
 * NEU: Confirm Transfer Order (UniSat Marketplace Flow)
 * Bestätigt signierte PSBT, finalisiert und speichert automatisch
 */
export const confirmTransfer = async (
  transferId: string,
  signedPsbt: string, // Base64 or Hex
  adminAddress: string,
  fromBase64: boolean = true,
  itemId?: string
): Promise<ConfirmTransferResponse> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/point-shop/admin/confirm-transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      transferId,
      psbt: signedPsbt,
      fromBase64,
      itemId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.error || 'Failed to confirm transfer');
  }

  const data: ConfirmTransferResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(data.msg || 'Failed to confirm transfer');
  }

  return data;
};

/**
 * LEGACY: Bereite PSBT für Pre-Signing vor (Backward Compatibility)
 * @deprecated Verwende createTransfer stattdessen
 */
export const preparePSBT = async (
  inscriptionId: string,
  recipientAddress: string,
  feeRate: number
): Promise<PreparePSBTResponse> => {
  try {
    // Versuche neuen Endpunkt zu verwenden
    const transferData = await createTransfer(inscriptionId, recipientAddress, feeRate);
    
    // Konvertiere zu altem Format für Backward Compatibility
    return {
      success: true,
      psbtBase64: transferData.data.psbt,
      estimatedFee: transferData.data.feeRate * 200, // Geschätzt
      estimatedSize: 200,
      inputCount: 1,
      outputCount: 1,
    };
  } catch (error) {
    // Fallback auf alten Endpunkt
    const response = await fetch(`${API_URL}/api/point-shop/admin/prepare-psbt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inscriptionId,
        recipientAddress,
        feeRate,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to prepare PSBT');
    }

    return await response.json();
  }
};

/**
 * LEGACY: Finalisiere eine signierte PSBT (Backward Compatibility)
 * @deprecated Verwende confirmTransfer stattdessen
 */
export const finalizePSBT = async (
  signedPsbtHex: string
): Promise<string> => {
  const response = await fetch(`${API_URL}/api/point-shop/admin/finalize-psbt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signedPsbtHex,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to finalize PSBT');
  }

  const data = await response.json();
  return data.signedTxHex;
};

/**
 * LEGACY: Speichere signierte Transaktion im Item (Backward Compatibility)
 * @deprecated Verwende confirmTransfer stattdessen (speichert automatisch)
 */
export const savePresignedTransaction = async (
  itemId: string,
  inscriptionId: string,
  signedTxHex: string
): Promise<PointShopItem> => {
  const response = await fetch(`${API_URL}/api/point-shop/admin/save-presigned`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId,
      inscriptionId,
      signedTxHex,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to save presigned transaction');
  }

  const data = await response.json();
  return data.item || data;
};

