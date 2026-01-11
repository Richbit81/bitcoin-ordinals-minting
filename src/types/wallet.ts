export interface WalletAccount {
  address: string;
  publicKey?: string;
}

export type WalletType = 'unisat' | 'xverse' | null;

export interface WalletState {
  walletType: WalletType;
  accounts: WalletAccount[];
  connected: boolean;
  network: 'mainnet' | 'testnet';
}

// Raritäts-System
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mystic-legendary';
export type CardType = 'animal' | 'action' | 'status';

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  inscriptionId: string; // ID der bereits eingeschriebenen Karte (Delegate-ID)
  originalInscriptionId?: string; // Original-Inskription-ID für Bild-Abruf (wenn verfügbar)
  cardType?: CardType; // 'animal' (Standard), 'action', 'status'
  effect?: string; // Effekt-Text für Action/Status-Karten
  svgIcon?: string; // SVG als String für Action/Status-Karten
  imageUrl?: string;
  imageData?: string; // SVG/Image-Daten der Master-Karte (von Blockchain abgerufen)
  metadata?: Record<string, any>;
  revealed?: boolean; // Ob die Karte bereits aufgedeckt wurde
}

export interface CardPack {
  id: string;
  name: string;
  description: string;
  price: number; // in BTC
  cardCount: number;
  imageUrl: string;
  totalSupply?: number; // Maximale Anzahl an Packs
  soldCount?: number; // Aktuell verkaufte Packs
  isPremium?: boolean; // Premium Pack = komplettes Deck
  guaranteedRarities?: Rarity[]; // Garantiert enthaltene Raritäten
  // inscriptions werden nicht mehr direkt gespeichert - Delegates werden dynamisch erstellt
}

export interface InscriptionData {
  content: string; // Base64 encoded oder URL
  contentType: string; // z.B. 'image/png', 'image/jpeg'
}

export interface MintingStatus {
  packId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  inscriptionIds?: string[];
  cards?: Card[]; // Gemintete Karten
  error?: string;
}

// Raritäts-Gewichtung für Pack-Generierung
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 30,          // 30% Chance
  uncommon: 25,        // 25% Chance
  rare: 25,            // 25% Chance
  epic: 15,            // 15% Chance
  legendary: 4,        // 4% Chance
  'mystic-legendary': 1, // 1% Chance - Extrem selten!
};

// Raritäts-Farben für UI
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9CA3AF',      // Grau
  uncommon: '#10B981',    // Grün
  rare: '#3B82F6',        // Blau
  epic: '#8B5CF6',        // Lila
  legendary: '#F59E0B',   // Gold
  'mystic-legendary': '#EF4444', // Rot - Extrem exklusiv
};

// Raritäts-Namen für Anzeige
export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  'mystic-legendary': 'Mystic Legendary',
};

// Hashliste für Kollektion
export interface CollectionHash {
  id: string;
  name: string;
  rarity: Rarity;
  inscriptionId: string;
}

