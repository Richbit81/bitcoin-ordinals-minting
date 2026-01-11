import { CardPack, Rarity } from '../types/wallet';

// Verwende den public Pfad - Vite serviert public automatisch
const PACK_THUMBNAIL = '/images/pack-thumbnail.png';

export const PACK_CONFIGS: CardPack[] = [
  {
    id: 'starter-pack',
    name: 'Starter Pack',
    description: '5 random cards - Chance for Mystic Legendary!',
    price: 0.000025, // 2500 sats
    cardCount: 5,
    totalSupply: 600,
    soldCount: 0,
    imageUrl: PACK_THUMBNAIL,
    isPremium: false,
  },
  {
    id: 'premium-pack',
    name: 'Premium Pack - Complete Deck',
    description: 'The complete deck with all 46 cards (26 Animal + 12 Action + 8 Status)! Guaranteed to contain all Epic, Legendary & Mystic Legendary!',
    price: 0.00025, // 25000 sats
    cardCount: 46, // ALLE Karten: 26 Tier + 12 Action + 8 Status
    totalSupply: 25,
    soldCount: 0,
    imageUrl: PACK_THUMBNAIL,
    isPremium: true,
    guaranteedRarities: ['epic', 'legendary', 'mystic-legendary'],
  },
];

