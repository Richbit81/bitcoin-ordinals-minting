import { Card, Rarity, CollectionHash } from '../types/wallet';
import { ACTION_CARDS, STATUS_CARDS, ALL_ACTION_STATUS_CARDS } from './actionStatusCards';

// Markiere alle Tier-Karten als 'animal' Typ
const markAnimalCards = (cards: Card[]): Card[] => {
  return cards.map(card => ({
    ...card,
    cardType: 'animal' as const,
  }));
};

// Alle Tier-Karten
export const ANIMAL_CARDS: Card[] = markAnimalCards([
  // COMMON (7 Karten)
  { id: 'card-1', name: 'Grasshopper', rarity: 'common', inscriptionId: '62de7de2fba34ce0b5718e94970c19f5965b131316b9615c3c2c61421cb51e76i0' },
  { id: 'card-2', name: 'Ant', rarity: 'common', inscriptionId: '446045d1613fb57610840eb1c6ba1491d5b0ea9624f7bda585e5f52e256f91e1i0' },
  { id: 'card-3', name: 'Bee', rarity: 'common', inscriptionId: '3aef296ead63f20a39c06ca04fc696dd98c532d6b595088fc58176cb46d1beaai0' },
  { id: 'card-4', name: 'Chicken', rarity: 'common', inscriptionId: 'c907865db233272d06a262c19da7379d4d36f1088dd825375b29a73686a3a184i0' },
  { id: 'card-5', name: 'Worm', rarity: 'common', inscriptionId: '7d91a2bb93f5ddfba2b16a6f0f463412e0faf12c46ca59cb2d76ec3b0bd3cf49i0' },
  { id: 'card-6', name: 'Spider', rarity: 'common', inscriptionId: '8564dd1ffef7bb5e2501819e562d4f98d123959899a3348a8def8dc4e3c7409di0' },
  { id: 'card-7', name: 'Butterfly', rarity: 'common', inscriptionId: '433c855aa38cc7b142dacaff65cfe9d58f2a79c40c87ddff56c3a283972a6a52i0' },

  // UNCOMMON (5 Karten)
  { id: 'card-8', name: 'Worm', rarity: 'uncommon', inscriptionId: 'f56c0801566cb9e46e1465f1d760f8976ba0bad328e39e84fa2e2209a4d6c540i0' },
  { id: 'card-9', name: 'Bird', rarity: 'uncommon', inscriptionId: 'd021efd186eb10c45fbdf043bf974e211772fce336d8287f02f85b6a06b2d8d9i0' },
  { id: 'card-10', name: 'Bird', rarity: 'uncommon', inscriptionId: '9ffd078c797dfdcbb6f72482f5499c124dd67c47044ccda1a1c42bf89926f2f0i0' },
  { id: 'card-11', name: 'Cow', rarity: 'uncommon', inscriptionId: '7f2a4963ed0c4e341db74d82dcc8c8fc0cdf4c84d7c1558f13b33b9ca6ef7251i0' },
  { id: 'card-12', name: 'Cow', rarity: 'uncommon', inscriptionId: '171f1741831bb019ee18e2a92dae9c711abf07e153641a4c1ceaa5892133032ci0' },

  // RARE (6 Karten)
  { id: 'card-14', name: 'Tiger', rarity: 'rare', inscriptionId: '195209f7e21b768fd7ca18a905ddac9ec4986412f4f8aa716290fbb743db6feai0' },
  { id: 'card-15', name: 'Rabbit', rarity: 'rare', inscriptionId: 'a0b9f4f33913f512ba4de73b1e4982cf5be76874062287fcd05efdd76a220a7fi0' },
  { id: 'card-17', name: 'Duck', rarity: 'rare', inscriptionId: 'a831e75a67d49d6e98594991cde68da3bf5f328ff49cc94a4a6bc05887ff8523i0' },
  { id: 'card-18', name: 'Crow', rarity: 'rare', inscriptionId: 'd67b09d7ac06aa9c217f95c69bf5c76f7f1634cad92fff5829546a22a279072ci0' },
  { id: 'card-19', name: 'Cat', rarity: 'rare', inscriptionId: 'e07446928e95b81b406592bf95007fb44948c252947304a7b31d34f84e96188ei0' },
  { id: 'card-20', name: 'Gecko', rarity: 'rare', inscriptionId: '9ad47ae89b8155ea8e4b02f53d4ced920d6dd4aeeaa744b99c44d33265827c44i0' },

  // EPIC (5 Karten)
  { id: 'card-21', name: 'Zebra', rarity: 'epic', inscriptionId: '3099b73fd35e81a8bf53a02af99f436d88b73b54945aaa97dfde155a08e174bdi0' },
  { id: 'card-22', name: 'Sheep', rarity: 'epic', inscriptionId: '4d2d4a2b258b18b95bfc55dc3c31cbcd4b204a4f001c9861793b993487af4560i0' },
  { id: 'card-23', name: 'Turtle', rarity: 'epic', inscriptionId: '3135eb862f9c56bf1884c05dd80bb28107ba9af82bed83fd39a1ff28e303a8a7i0' },
  { id: 'card-24', name: 'Penguin', rarity: 'epic', inscriptionId: '2cd0572f35441d5b443ad9c78ec62f84f9b6c77528903c86b8b23b9213f0e7c4i0' },
  { id: 'card-25', name: 'Koala', rarity: 'epic', inscriptionId: '4f6cce4ab7433ef48222e0a974c3a546f102cf38a455368757f5d5e00bfc1dddi0' },

  // LEGENDARY (2 Karten)
  { id: 'card-26', name: 'Fox', rarity: 'legendary', inscriptionId: 'e1a16dd9dea8b6ade622d24214c21ec29029127d40aa8ad44aa07c39f4620866i0' },
  { id: 'card-27', name: 'Octopus', rarity: 'legendary', inscriptionId: 'd52730b2f4b8c0095ad82853e3e27d72adaa65796dbb666d929d7ca36f570ad2i0' },

  // MYSTIC LEGENDARY (1 Karte) - Extrem selten
  { id: 'card-28', name: 'Ape', rarity: 'mystic-legendary', inscriptionId: '3898219212c8a1c66564e60734ab01872315c3900ef782b466caf4ae58c2afdbi0' },
]);

// Alle Karten zusammen: Tier + Action + Status
export const ALL_CARDS: Card[] = [
  ...ANIMAL_CARDS,
  ...ALL_ACTION_STATUS_CARDS,
];

// Hashliste für Kollektion (alle Karten)
export const COLLECTION_HASH: CollectionHash[] = ALL_CARDS.map(card => ({
  id: card.id,
  name: card.name,
  rarity: card.rarity,
  inscriptionId: card.inscriptionId,
}));

// Export für externe Nutzung (z.B. für Marktplätze)
export const generateCollectionManifest = (): string => {
  return JSON.stringify(COLLECTION_HASH, null, 2);
};

// Hilfsfunktion zum Exportieren der Hashliste
export const exportCollectionManifest = () => {
  const manifest = generateCollectionManifest();
  
  // Download als Datei
  const blob = new Blob([manifest], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'collection-manifest.json';
  a.click();
  URL.revokeObjectURL(url);
};

