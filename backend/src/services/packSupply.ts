// Pack Supply Management Service
// Verwaltet die Verfügbarkeit von Packs

interface PackSupplyState {
  [packId: string]: {
    soldCount: number;
    totalSupply: number;
  };
}

// In-memory Storage (kann später durch Datenbank ersetzt werden)
let packSupplyState: PackSupplyState = {
  'starter-pack': {
    soldCount: 0,
    totalSupply: 200,
  },
  'premium-pack': {
    soldCount: 0,
    totalSupply: 25,
  },
};

/**
 * Initialisiert den Supply-State (kann später aus Datenbank geladen werden)
 */
export const initializeSupplyState = () => {
  // Wird beim Server-Start aufgerufen
  console.log('Pack Supply State initialisiert:', packSupplyState);
};

/**
 * Prüft, ob ein Pack gemintet werden kann
 */
export const canMintPack = (packId: string): boolean => {
  const state = packSupplyState[packId];
  if (!state) return false;
  
  return state.soldCount < state.totalSupply;
};

/**
 * Inkrementiert den Verkaufszähler eines Packs
 */
export const incrementPackSupply = (packId: string): boolean => {
  const state = packSupplyState[packId];
  if (!state) return false;
  
  if (state.soldCount >= state.totalSupply) {
    return false; // Ausverkauft
  }
  
  state.soldCount++;
  console.log(`Pack ${packId} Supply aktualisiert: ${state.soldCount}/${state.totalSupply}`);
  return true;
};

/**
 * Gibt die Verfügbarkeit eines Packs zurück
 */
export const getPackAvailability = (packId: string) => {
  const state = packSupplyState[packId];
  if (!state) return null;
  
  return {
    packId,
    sold: state.soldCount,
    total: state.totalSupply,
    remaining: state.totalSupply - state.soldCount,
    soldOut: state.soldCount >= state.totalSupply,
  };
};

/**
 * Gibt die Verfügbarkeit aller Packs zurück
 */
export const getAllPackAvailability = (): Record<string, any> => {
  const result: Record<string, any> = {};
  
  Object.keys(packSupplyState).forEach((packId) => {
    result[packId] = getPackAvailability(packId);
  });
  
  return result;
};

/**
 * Setzt den Supply-State (für Admin/Testing)
 */
export const setPackSupply = (packId: string, soldCount: number, totalSupply: number): boolean => {
  packSupplyState[packId] = {
    soldCount,
    totalSupply,
  };
  return true;
};








