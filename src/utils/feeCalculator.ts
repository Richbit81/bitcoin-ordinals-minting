/**
 * Berechnet geschätzte Fees für Delegate-Inskriptionen
 */

/**
 * Berechnet geschätzte Inskriptions-Fees für Delegate-Inskriptionen
 * Delegates sind sehr kleine JSON-Dateien (~100 bytes)
 */
export const calculateDelegateInscriptionFees = (
  cardCount: number,
  feeRate: number = 1, // sat/vB
  postage: number = 330 // Standard Postage für kleine Dateien
): number => {
  // Delegate JSON ist sehr klein (~100 bytes)
  // Geschätzte Transaktionsgröße pro Delegate: ~300-400 vB
  // Mit Postage: ~330 sats pro Inskription
  const estimatedFeePerInscription = postage + (feeRate * 300); // ~330 + 300 = 630 sats pro Inskription
  
  // Konvertiere zu BTC (1 BTC = 100,000,000 sats)
  const totalFeesInSats = estimatedFeePerInscription * cardCount;
  const totalFeesInBTC = totalFeesInSats / 100000000;
  
  return totalFeesInBTC;
};

/**
 * Berechnet Gesamtkosten (Pack-Preis + Inskriptions-Fees)
 */
export const calculateTotalCost = (
  packPrice: number,
  cardCount: number,
  feeRate: number = 1
): {
  packPrice: number;
  inscriptionFees: number;
  total: number;
} => {
  const inscriptionFees = calculateDelegateInscriptionFees(cardCount, feeRate);
  
  return {
    packPrice,
    inscriptionFees,
    total: packPrice + inscriptionFees,
  };
};



