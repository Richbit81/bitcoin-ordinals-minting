/**
 * Card Image Service
 * Ruft Kartenbilder on-chain über Inscription-IDs ab
 */

/**
 * Ruft ein Kartenbild von der Blockchain ab
 */
export const getCardImageUrl = (inscriptionId: string): string => {
  // Verwende verschiedene Ordinals-Explorer als Fallback
  const explorers = [
    `https://ordinals.com/content/${inscriptionId}`,
    `https://ordinals.com/preview/${inscriptionId}`,
    `https://ordiscan.com/content/${inscriptionId}`,
  ];
  
  // Für jetzt: Verwende ersten Explorer
  // Später: Implementiere Fallback-Logik
  return explorers[0];
};

/**
 * Ruft ein Kartenbild als Data URL ab (für Caching)
 */
export const fetchCardImageAsDataUrl = async (inscriptionId: string): Promise<string | null> => {
  try {
    const url = getCardImageUrl(inscriptionId);
    const response = await fetch(url);
    
    if (!response.ok) {
      // Versuche nächsten Explorer
      const fallbackUrl = `https://ordinals.com/preview/${inscriptionId}`;
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const blob = await fallbackResponse.blob();
        return URL.createObjectURL(blob);
      }
      return null;
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`[CardImageService] Fehler beim Abrufen von ${inscriptionId}:`, error);
    return null;
  }
};

/**
 * Cache für Kartenbilder
 */
const imageCache = new Map<string, string>();

/**
 * Ruft ein Kartenbild ab (mit Cache)
 */
export const getCachedCardImage = async (inscriptionId: string): Promise<string | null> => {
  if (imageCache.has(inscriptionId)) {
    return imageCache.get(inscriptionId)!;
  }
  
  const dataUrl = await fetchCardImageAsDataUrl(inscriptionId);
  if (dataUrl) {
    imageCache.set(inscriptionId, dataUrl);
  }
  
  return dataUrl;
};


