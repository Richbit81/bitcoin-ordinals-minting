// Pack Supply Management Service
// Verwaltet die Verfügbarkeit von Packs

import { PACK_CONFIGS } from '../config/packs';

const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export interface PackAvailability {
  packId: string;
  sold: number;
  total: number;
  remaining: number;
  soldOut: boolean;
}

/**
 * Prüft die Verfügbarkeit eines Packs
 * Fallback: Verwendet lokale Konfiguration wenn Backend nicht verfügbar ist
 */
export const checkPackAvailability = async (packId: string): Promise<PackAvailability | null> => {
  try {
    // Timeout nach 2 Sekunden
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${INSCRIPTION_API_URL}/api/packs/${packId}/availability`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('Backend response not ok');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // Fallback: Verwende lokale Konfiguration wenn Backend nicht verfügbar
    console.warn('Backend nicht verfügbar, verwende lokale Konfiguration für', packId);
    
    const pack = PACK_CONFIGS.find(p => p.id === packId);
    if (!pack) {
      return null;
    }
    
    // Verwende lokale Konfiguration - solange soldCount < totalSupply, ist noch etwas verfügbar
    const remaining = pack.totalSupply - pack.soldCount;
    return {
      packId: pack.id,
      sold: pack.soldCount,
      total: pack.totalSupply,
      remaining: remaining,
      soldOut: remaining <= 0
    };
  }
};

/**
 * Prüft die Verfügbarkeit aller Packs
 */
export const checkAllPackAvailability = async (): Promise<Record<string, PackAvailability>> => {
  try {
    const response = await fetch(`${INSCRIPTION_API_URL}/api/packs/availability`);
    
    if (!response.ok) {
      // Backend nicht verfügbar - verwende lokale Konfiguration (still)
      return {};
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // Backend nicht verfügbar - verwende lokale Konfiguration (still)
    return {};
  }
};

/**
 * Inkrementiert den Verkaufszähler eines Packs
 */
export const incrementPackSupply = async (packId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${INSCRIPTION_API_URL}/api/packs/${packId}/increment`, {
      method: 'POST',
    });
    
    return response.ok;
  } catch (error) {
    console.warn('Fehler beim Aktualisieren der Pack-Verfügbarkeit:', error);
    return false;
  }
};

