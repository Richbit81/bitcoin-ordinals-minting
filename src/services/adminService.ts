import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl();

export interface AdminStats {
  totalPacks: number;
  starterPacks: number;
  premiumPacks: number;
  totalInscriptions: number;
  totalTradeOffers: number;
  activeTradeOffers: number;
  totalDelegates: number;
  byRarity: Record<string, number>;
}

export interface TradeOfferAdmin {
  offerId: string;
  maker: string;
  offerCards: string[];
  requestCards: string[];
  expiresAt: number;
  createdAt: string;
  status: string;
}

/**
 * Hole Admin-Statistiken
 */
export const getAdminStats = async (adminAddress: string): Promise<AdminStats> => {
  const headers: Record<string, string> = {};
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/admin/stats`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Failed to fetch admin stats: ${response.status}`);
  }

  const data = await response.json();
  // Backend gibt direkt stats zurück, nicht { data: stats }
  return data as AdminStats;
};

/**
 * Hole alle Trade Offers (Admin)
 */
export const getAdminTradeOffers = async (adminAddress: string): Promise<TradeOfferAdmin[]> => {
  const headers: Record<string, string> = {};
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/admin/trades`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Failed to fetch trade offers: ${response.status}`);
  }

  const data = await response.json();
  // Backend gibt { trades: [...], count: ... } zurück
  return (data.trades || []) as TradeOfferAdmin[];
};

/**
 * Öffne Karten-Bilder Ordner
 */
export const openCardImagesFolder = async (adminAddress: string): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/admin/open-card-images`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to open folder');
  }
};

/**
 * Exportiere alle Karten-Informationen als JSON
 */
export const exportAllCardsInfo = async (adminAddress: string): Promise<void> => {
  const headers: Record<string, string> = {};
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/admin/export-cards`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to export cards');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `black-wild-cards-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};



