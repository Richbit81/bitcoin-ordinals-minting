const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export interface DelegateCard {
  delegateInscriptionId: string;
  originalInscriptionId: string;
  cardId: string;
  name: string;
  rarity: string;
  walletAddress: string;
  cardType?: 'animal' | 'action' | 'status';
  effect?: string;
  svgIcon?: string;
  timestamp: string;
}

/**
 * Hole alle Delegate-Inskriptionen für eine Wallet-Adresse
 * @param checkPending - Wenn true, prüfe automatisch den Status aller pending Inskriptionen
 */
export const getDelegatesByWallet = async (walletAddress: string, checkPending: boolean = false): Promise<DelegateCard[]> => {
  // Standard: Hole aus Registry (ohne hybrid)
  // Für Gallery: Verwende hybrid=true direkt im fetchWalletCards
  const url = `${API_URL}/api/delegates/${walletAddress}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch delegates');
  }
  const data = await response.json();
  // Backend gibt { delegates, count, source } zurück, nicht { data }
  return data.delegates || [];
};

/**
 * Prüfe ob eine Inskription eine registrierte Delegate ist
 */
export const checkDelegate = async (inscriptionId: string): Promise<{ isRegistered: boolean; cardData: DelegateCard | null }> => {
  const response = await fetch(`${API_URL}/api/delegates/check/${inscriptionId}`);
  if (!response.ok) {
    throw new Error('Failed to check delegate');
  }
  const data = await response.json();
  return {
    isRegistered: data.isRegistered || false,
    cardData: data.cardData || null,
  };
};


