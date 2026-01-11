/**
 * Recent Mints Service
 * Lädt die letzten geminteten Karten
 */

export interface RecentMint {
  cardId: string;
  cardName: string;
  rarity: string;
  cardType?: 'animal' | 'action' | 'status';
  inscriptionId: string;
  mintedAt: number;
  mintedBy: string;
  packName: string;
}

export interface RecentMintsResponse {
  recentMints: RecentMint[];
  total: number;
}

const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

/**
 * Ruft die letzten geminteten Karten ab
 */
export const getRecentMints = async (limit: number = 10): Promise<RecentMintsResponse | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${INSCRIPTION_API_URL}/api/minting/recent?limit=${limit}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Failed to fetch recent mints:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('Recent mints request timeout');
    } else {
      console.warn('Error fetching recent mints:', error);
    }
    return null;
  }
};




