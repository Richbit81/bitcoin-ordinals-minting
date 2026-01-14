/**
 * Collection Service für Frontend
 */

import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl();

export interface CollectionItem {
  inscriptionId: string;
  name: string;
  type: 'delegate' | 'original';
  imageUrl?: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  price: number; // BTC
  items: CollectionItem[];
  category?: string; // Optional: Kategorie (z.B. 'smileabit')
  page?: string | null; // Optional: Seiten-Zuordnung (z.B. 'smile-a-bit', 'tech-games', etc.)
  mintType?: 'individual' | 'random'; // Wie werden Items gemintet: einzeln auswählbar oder zufällig
  showBanner?: boolean; // Optional: Banner mit letzten Mints anzeigen
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface WalletInscription {
  inscriptionId: string;
  name: string;
  contentType: string;
  contentLength: number;
  timestamp: number;
  isDelegate?: boolean; // Flag für Delegate-Inskriptionen (HTML-Inskriptionen)
  originalInscriptionId?: string; // WICHTIG: Für Delegate-Inskriptionen - Original-Inskription-ID für Vorschau
  inscriptionNumber?: number; // Optional: Inskriptionsnummer
}

/**
 * Hole alle aktiven Kollektionen
 */
export const getAllCollections = async (): Promise<Collection[]> => {
  const response = await fetch(`${API_URL}/api/collections`);
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  const data = await response.json();
  return data.collections || [];
};

/**
 * Hole eine einzelne Kollektion
 */
export const getCollection = async (id: string): Promise<Collection> => {
  const response = await fetch(`${API_URL}/api/collections/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch collection');
  }
  const data = await response.json();
  // Backend gibt direkt collection zurück, nicht als { collection: ... }
  return data.collection || data;
};

/**
 * Hole alle Kollektionen (auch inaktive) - für Admin
 */
export const getAllCollectionsAdmin = async (adminAddress: string): Promise<Collection[]> => {
  if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
    throw new Error('Admin address is required');
  }
  
  const headers: Record<string, string> = {};
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const url = `${API_URL}/api/collections/admin/all${adminAddress && adminAddress !== 'undefined' && adminAddress !== '' ? `?adminAddress=${encodeURIComponent(adminAddress)}` : ''}`;
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  const data = await response.json();
  return data.collections || [];
};

/**
 * Hole Inskriptionen aus Admin-Wallet
 */
export const getWalletInscriptions = async (adminAddress: string): Promise<WalletInscription[]> => {
  if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
    throw new Error('Admin address is required');
  }
  
  const url = `${API_URL}/api/collections/admin/wallet-inscriptions?address=${encodeURIComponent(adminAddress)}`;
  console.log('[CollectionService] Fetching wallet inscriptions from:', url);
  console.log('[CollectionService] Admin address:', adminAddress);
  console.log('[CollectionService] Admin address type:', typeof adminAddress);
  console.log('[CollectionService] Admin address length:', adminAddress?.length);
  
  const headers: Record<string, string> = {};
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(url, {
    headers,
  });
  console.log('[CollectionService] Response status:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    // WICHTIG: Rate-Limit-Behandlung für Status 429 ODER wenn die Fehlermeldung "Rate limit" enthält
    // Prüfe auch, ob der errorData.error "rate limit" enthält (case-insensitive)
    const errorMsg = errorData.error || errorData.message || '';
    const isRateLimit = response.status === 429 || 
                       (errorMsg && (errorMsg.toLowerCase().includes('rate limit') || 
                                    errorMsg.toLowerCase().includes('exceeds rate limit') ||
                                    errorData.code === -2006));
    
    if (isRateLimit) {
      const retryAfter = errorData.retryAfter || 300;
      const displayMsg = errorMsg || 'Rate limit erreicht';
      throw new Error(`Rate limit erreicht! ${displayMsg}. Bitte warten Sie ${retryAfter} Sekunden (ca. ${Math.ceil(retryAfter / 60)} Minuten) bevor Sie es erneut versuchen.`);
    }
    
    // Bei 500 oder anderen Fehlern: Zeige die echte Fehlermeldung
    // Entferne alte Fehlermeldungen wie "All UniSat API endpoints returned 404"
    const errorMessage = errorData.error || errorData.message || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }
  const data = await response.json();
  console.log('[CollectionService] Response data:', data);
  console.log('[CollectionService] Response data type:', typeof data);
  console.log('[CollectionService] Is array?', Array.isArray(data));
  
  // Backend gibt direkt ein Array zurück, nicht als data.inscriptions
  const inscriptions = Array.isArray(data) ? data : (data.inscriptions || []);
  console.log('[CollectionService] Returning inscriptions:', inscriptions.length);
  return inscriptions;
};

/**
 * Erstelle eine neue Kollektion
 */
export const createCollection = async (
  adminAddress: string,
  collectionData: {
    name: string;
    description?: string;
    thumbnail: string;
    price: number;
    items: CollectionItem[];
    category?: string;
    page?: string | null;
    mintType?: 'individual' | 'random';
    showBanner?: boolean;
  }
): Promise<Collection> => {
  if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
    throw new Error('Admin address is required');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const bodyData: any = {
    ...collectionData,
  };
  
  // Nur adminAddress hinzufügen, wenn es gültig ist
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    bodyData.adminAddress = adminAddress;
  }
  
  console.log('[CollectionService] Creating collection with:', {
    name: collectionData.name,
    price: collectionData.price,
    itemsCount: collectionData.items.length,
    adminAddress: adminAddress ? `${adminAddress.substring(0, 10)}...` : 'MISSING',
    hasHeader: !!headers['X-Admin-Address'],
  });
  
  const response = await fetch(`${API_URL}/api/collections/admin/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to create collection');
  }

  const data = await response.json();
  return data.collection;
};

/**
 * Aktualisiere eine Kollektion
 */
export const updateCollection = async (
  collectionId: string,
  adminAddress: string,
  updates: {
    name?: string;
    description?: string;
    thumbnail?: string;
    price?: number;
    items?: CollectionItem[];
    category?: string;
    page?: string | null;
    mintType?: 'individual' | 'random';
    showBanner?: boolean;
  }
): Promise<Collection> => {
  if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
    throw new Error('Admin address is required');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const response = await fetch(`${API_URL}/api/collections/admin/${collectionId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      ...updates,
      adminAddress: (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') ? adminAddress : undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to update collection');
  }

  const data = await response.json();
  return data.collection;
};

/**
 * Lösche/Deaktiviere eine Kollektion
 */
export const deleteCollection = async (collectionId: string, adminAddress: string): Promise<void> => {
  if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
    throw new Error('Admin address is required');
  }
  
  const headers: Record<string, string> = {};
  if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
    headers['X-Admin-Address'] = adminAddress;
  }
  
  const url = `${API_URL}/api/collections/admin/${collectionId}${adminAddress && adminAddress !== 'undefined' && adminAddress !== '' ? `?adminAddress=${encodeURIComponent(adminAddress)}` : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to delete collection');
  }
};

