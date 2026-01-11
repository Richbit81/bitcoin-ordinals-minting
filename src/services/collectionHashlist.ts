/**
 * Collection Hashlist Service
 * Verwaltet die Hashliste aller geminteten Inskriptionen
 */

export interface CollectionHashlistEntry {
  inscriptionId: string;
  txid?: string | null;
  mintTimestamp: number | string;
  walletAddress: string;
  packId: string;
  packName: string;
  cardId?: string | null;
  cardName?: string | null;
  rarity?: string | null;
  cardType?: string | null;
  originalInscriptionId?: string | null;
}

export interface CollectionHashlist {
  collection: string;
  totalMinted: number;
  inscriptions: CollectionHashlistEntry[];
  stats: {
    totalPacks: number;
    starterPacks: number;
    premiumPacks: number;
    totalCards: number;
    byRarity: Record<string, number>;
    byCard: Record<string, number>;
  };
  generatedAt: string;
}

export interface CollectionStats {
  totalPacks: number;
  starterPacks: number;
  premiumPacks: number;
  totalInscriptions: number;
  byRarity: Record<string, number>;
  byCard: Record<string, number>;
  byWallet: Record<string, number>;
}

const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

/**
 * Ruft die komplette Hashliste aller geminteten Inskriptionen ab
 * Benötigt Admin-Berechtigung
 */
export const getCollectionHashlist = async (adminAddress?: string): Promise<CollectionHashlist | null> => {
  if (!adminAddress) {
    console.error('Admin address required to fetch hashlist');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 Sekunden Timeout

    const response = await fetch(`${INSCRIPTION_API_URL}/api/collection/hashlist?address=${encodeURIComponent(adminAddress)}`, {
      signal: controller.signal,
      headers: {
        'X-Admin-Address': adminAddress,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Failed to fetch hashlist:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Hashlist request timeout');
    } else {
      console.error('Error fetching hashlist:', error);
    }
    return null;
  }
};

/**
 * Ruft Collection-Statistiken ab
 * Benötigt Admin-Berechtigung
 */
export const getCollectionStats = async (adminAddress?: string): Promise<CollectionStats | null> => {
  if (!adminAddress) {
    console.error('Admin address required to fetch stats');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${INSCRIPTION_API_URL}/api/collection/stats?address=${encodeURIComponent(adminAddress)}`, {
      signal: controller.signal,
      headers: {
        'X-Admin-Address': adminAddress,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Failed to fetch stats:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Stats request timeout');
    } else {
      console.error('Error fetching stats:', error);
    }
    return null;
  }
};

/**
 * Exportiert die Hashliste als JSON-Datei
 * Format für Marktplätze (Magic Eden, OrdinalsBot, etc.)
 */
export const exportHashlist = async (adminAddress?: string): Promise<void> => {
  if (!adminAddress) {
    alert('Admin address required to export hashlist.');
    return;
  }

  const hashlist = await getCollectionHashlist(adminAddress);
  
  if (!hashlist) {
    alert('Failed to fetch hashlist. Please make sure the backend server is running.');
    return;
  }

  // Erstelle Export-Datei
  const exportData = {
    collection: hashlist.collection,
    version: '1.0.0',
    generatedAt: hashlist.generatedAt,
    totalMinted: hashlist.totalMinted,
    inscriptions: hashlist.inscriptions.map(entry => ({
      inscriptionId: entry.inscriptionId,
      txid: entry.txid,
      mintTimestamp: entry.mintTimestamp,
      cardId: entry.cardId,
      cardName: entry.cardName,
      rarity: entry.rarity,
      cardType: entry.cardType,
      originalInscriptionId: entry.originalInscriptionId,
    })),
    stats: hashlist.stats,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collection-hashlist-${hashlist.collection}-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Exportiert eine vereinfachte Hashliste (nur Inskriptions-IDs)
 * Für einfache Marketplace-Registrierung
 */
export const exportSimpleHashlist = async (adminAddress?: string): Promise<void> => {
  if (!adminAddress) {
    alert('Admin address required to export hashlist.');
    return;
  }

  const hashlist = await getCollectionHashlist(adminAddress);
  
  if (!hashlist) {
    alert('Failed to fetch hashlist. Please make sure the backend server is running.');
    return;
  }

  // Nur Inskriptions-IDs für einfache Registrierung
  const simpleList = hashlist.inscriptions.map(entry => entry.inscriptionId);

  const blob = new Blob([JSON.stringify(simpleList, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collection-inscription-ids-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

