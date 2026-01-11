import { Card, Rarity, RARITY_WEIGHTS, CardType } from '../types/wallet';

/**
 * Wählt zufällig eine Karte basierend auf Raritäts-Gewichtung
 */
export const selectCardByRarity = (availableCards: Card[]): Card => {
  // Erstelle Gewichtungs-Array
  const weightedCards: Card[] = [];
  
  for (const card of availableCards) {
    const weight = RARITY_WEIGHTS[card.rarity];
    // Füge Karte mehrfach hinzu basierend auf Gewicht
    for (let i = 0; i < weight; i++) {
      weightedCards.push(card);
    }
  }
  
  // Zufällige Auswahl
  const randomIndex = Math.floor(Math.random() * weightedCards.length);
  return weightedCards[randomIndex];
};

/**
 * Wählt zuerst den Kartentyp (70% Tier, 25% Action, 5% Status)
 * dann wird innerhalb des Typs die Rarität angewendet
 */
export const selectCardWithTypeWeight = (
  animalCards: Card[],
  actionCards: Card[],
  statusCards: Card[]
): Card => {
  // Kartentyp-Gewichtung
  const typeRoll = Math.random() * 100;
  
  let targetType: CardType;
  let availableCards: Card[];
  
  if (typeRoll < 70) {
    // 70% Tier-Karten
    targetType = 'animal';
    availableCards = animalCards;
  } else if (typeRoll < 95) {
    // 25% Action-Karten (70-95%)
    targetType = 'action';
    availableCards = actionCards;
  } else {
    // 5% Status-Karten (95-100%)
    targetType = 'status';
    availableCards = statusCards;
  }
  
  // Wenn keine Karten des Typs verfügbar, Fallback auf Tier
  if (availableCards.length === 0) {
    availableCards = animalCards;
  }
  
  // Wähle jetzt basierend auf Rarität aus dem gewählten Typ
  return selectCardByRarity(availableCards);
};

/**
 * Generiert Premium Pack mit ALLEN Karten (Tier + Action + Status)
 */
export const generatePremiumPack = (allCards: Card[]): Card[] => {
  // Premium Pack = komplettes Deck, alle Karten inklusive
  return [...allCards];
};

/**
 * Generiert normales Pack mit zufälligen Karten
 * Verwendet Typ-Gewichtung (70% Tier, 25% Action, 5% Status)
 * dann Raritäts-Gewichtung innerhalb jedes Typs
 * MAXIMAL 1 Action- oder Status-Karte pro Pack
 * KEINE DUPLIKATE in einem Pack
 */
export const generateStarterPack = (
  cardCount: number,
  animalCards: Card[],
  actionCards: Card[],
  statusCards: Card[]
): Card[] => {
  const pack: Card[] = [];
  const usedCardIds = new Set<string>(); // Set zur Verfolgung bereits verwendeter Karten-IDs
  let actionStatusCount = 0; // Zähler für Action/Status-Karten
  const maxActionStatus = 1; // Maximal 1 Action/Status-Karte pro Pack
  const maxAttempts = 100; // Maximale Versuche, eine eindeutige Karte zu finden
  
  for (let i = 0; i < cardCount; i++) {
    let selectedCard: Card | null = null;
    let attempts = 0;
    
    // Versuche eine eindeutige Karte zu finden
    while (!selectedCard && attempts < maxAttempts) {
      attempts++;
      
      // Wenn bereits 1 Action/Status-Karte vorhanden, nur noch Tier-Karten
      if (actionStatusCount >= maxActionStatus) {
        // Filtere bereits verwendete Tier-Karten raus
        const availableAnimalCards = animalCards.filter(card => !usedCardIds.has(card.id));
        
        if (availableAnimalCards.length === 0) {
          // Keine weiteren Tier-Karten verfügbar, erlaube Duplikate als Fallback
          selectedCard = selectCardByRarity(animalCards);
        } else {
          selectedCard = selectCardByRarity(availableAnimalCards);
        }
      } else {
        // Normale Typ-Gewichtung, aber filtere bereits verwendete Karten
        const availableAnimalCards = animalCards.filter(card => !usedCardIds.has(card.id));
        const availableActionCards = actionCards.filter(card => !usedCardIds.has(card.id));
        const availableStatusCards = statusCards.filter(card => !usedCardIds.has(card.id));
        
        // Wenn keine Karten mehr verfügbar, erlaube Duplikate als Fallback
        if (availableAnimalCards.length === 0 && availableActionCards.length === 0 && availableStatusCards.length === 0) {
          selectedCard = selectCardWithTypeWeight(animalCards, actionCards, statusCards);
        } else {
          selectedCard = selectCardWithTypeWeight(availableAnimalCards, availableActionCards, availableStatusCards);
        }
        
        // Prüfe ob es eine Action/Status-Karte ist
        if (selectedCard && (selectedCard.cardType === 'action' || selectedCard.cardType === 'status')) {
          actionStatusCount++;
        }
      }
      
      // Prüfe ob die Karte bereits verwendet wurde
      if (selectedCard && usedCardIds.has(selectedCard.id)) {
        selectedCard = null; // Versuche erneut
      }
    }
    
    // Fallback: Wenn nach maxAttempts keine eindeutige Karte gefunden wurde
    if (!selectedCard) {
      // Wähle eine zufällige Karte (kann Duplikat sein, aber nur wenn keine anderen verfügbar)
      if (actionStatusCount >= maxActionStatus) {
        selectedCard = selectCardByRarity(animalCards);
      } else {
        selectedCard = selectCardWithTypeWeight(animalCards, actionCards, statusCards);
        if (selectedCard.cardType === 'action' || selectedCard.cardType === 'status') {
          actionStatusCount++;
        }
      }
    }
    
    // Füge Karte zum Pack hinzu und markiere als verwendet
    if (selectedCard) {
      pack.push(selectedCard);
      usedCardIds.add(selectedCard.id);
    }
  }
  
  return pack;
};

/**
 * Statistiken für ein Pack
 */
export const getPackStats = (cards: Card[]): Record<Rarity, number> => {
  return {
    common: cards.filter(c => c.rarity === 'common').length,
    uncommon: cards.filter(c => c.rarity === 'uncommon').length,
    rare: cards.filter(c => c.rarity === 'rare').length,
    epic: cards.filter(c => c.rarity === 'epic').length,
    legendary: cards.filter(c => c.rarity === 'legendary').length,
    'mystic-legendary': cards.filter(c => c.rarity === 'mystic-legendary').length,
  };
};

