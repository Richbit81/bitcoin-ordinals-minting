import { CardPack, Card } from '../types/wallet';
import { ALL_CARDS, ANIMAL_CARDS } from '../config/cards';
import { ACTION_CARDS, STATUS_CARDS } from '../config/actionStatusCards';
import { generatePremiumPack, generateStarterPack } from '../utils/rarityDistribution';
import { createBatchDelegates } from './delegate';

// API-Endpunkt für Inskriptionen
const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export interface InscriptionResponse {
  inscriptionIds: string[];
  txids: string[];
  cards: Card[]; // Gemintete Karten
}

/**
 * Erstellt mehrere Delegate-Inskriptionen für ein Kartenpack
 */
export const createBatchInscriptions = async (
  pack: CardPack,
  recipientAddress: string,
  feeRate: number = 1 // Sehr niedrig für Delegates (nur JSON)
): Promise<InscriptionResponse> => {
  // Validiere Taproot-Adresse
  if (!recipientAddress.startsWith('bc1p')) {
    throw new Error('Ungültige Adresse. Bitte verwenden Sie eine Taproot-Adresse (bc1p...)');
  }

  try {
    // Generiere zufälliges Pack basierend auf Rarität
    let selectedCards: Card[];
    
    if (pack.isPremium) {
      // Premium Pack = alle 47 Karten (Tier + Action + Status)
      selectedCards = generatePremiumPack(ALL_CARDS);
    } else {
      // Starter Pack = zufällige Karten mit Typ-Gewichtung (70% Tier, 25% Action, 5% Status)
      selectedCards = generateStarterPack(
        pack.cardCount,
        ANIMAL_CARDS,
        ACTION_CARDS,
        STATUS_CARDS
      );
    }

    // Erstelle Delegate-Inskriptionen für jede Karte
    const collectionId = 'Black & Wild'; // Kollektion-Name
    const results = await createBatchDelegates(
      selectedCards,
      recipientAddress,
      collectionId,
      feeRate
    );

    return {
      inscriptionIds: results.map(r => r.inscriptionId),
      txids: results.map(r => r.txid),
      cards: selectedCards, // Für Anzeige
    };
  } catch (error: any) {
    throw new Error(
      error.message || 'Fehler bei der Verbindung zum Inskriptions-Service'
    );
  }
};

/**
 * Prüft den Status einer Inskription
 */
export const checkInscriptionStatus = async (
  inscriptionId: string
): Promise<{
  confirmed: boolean;
  blockHeight?: number;
  txid?: string;
}> => {
  try {
    const healthResponse = await fetch(`${INSCRIPTION_API_URL}/api/health`);
    if (healthResponse.ok) {
      return {
        confirmed: false,
        txid: inscriptionId.includes('i') ? inscriptionId.split('i')[0] : inscriptionId,
      };
    }
    
    throw new Error('Backend nicht erreichbar');
  } catch (error) {
    return {
      confirmed: false,
      txid: inscriptionId.includes('i') ? inscriptionId.split('i')[0] : inscriptionId,
    };
  }
};

