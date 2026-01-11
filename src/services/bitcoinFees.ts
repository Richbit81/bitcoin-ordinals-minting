/**
 * Bitcoin Fee Rate Service
 * Ruft aktuelle Fee Rates vom Mempool ab und berechnet Transaktionsgebühren
 */

export interface FeeRates {
  fastestFee: number;      // Sat/vB für Transaktionen die im nächsten Block bestätigt werden
  halfHourFee: number;     // Sat/vB für Transaktionen die in ~30 Minuten bestätigt werden
  hourFee: number;         // Sat/vB für Transaktionen die in ~1 Stunde bestätigt werden
  economyFee: number;      // Sat/vB für langsamere aber günstigere Transaktionen
  minimumFee: number;      // Sat/vB minimale Fee Rate
}

/**
 * Ruft aktuelle Fee Rates vom Mempool ab
 * Quelle: https://mempool.space/api/v1/fees/recommended
 */
export const getCurrentFeeRates = async (): Promise<FeeRates | null> => {
  try {
    const response = await fetch('https://mempool.space/api/v1/fees/recommended', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch fee rates from mempool.space:', response.status);
      return null;
    }

    const data = await response.json();
    
    return {
      fastestFee: data.fastestFee || 20,
      halfHourFee: data.halfHourFee || 10,
      hourFee: data.hourFee || 5,
      economyFee: data.economyFee || 2,
      minimumFee: data.minimumFee || 1,
    };
  } catch (error) {
    console.warn('Error fetching fee rates:', error);
    // Fallback zu konservativen Werten
    return {
      fastestFee: 20,
      halfHourFee: 10,
      hourFee: 5,
      economyFee: 2,
      minimumFee: 1,
    };
  }
};

/**
 * Schätzt die Transaktionsgröße in vBytes
 * Eine Standard Bitcoin-Transaktion (1 Input, 2 Outputs) ist ~140-250 vBytes
 */
export const estimateTransactionSize = (inputCount: number = 1, outputCount: number = 2): number => {
  // Basis-Transaktionsgröße
  const baseSize = 10; // Overhead (Version, Locktime, etc.)
  
  // Input-Größe: ~148 vBytes pro Input (UTXO + Signature)
  const inputSize = inputCount * 148;
  
  // Output-Größe: ~34 vBytes pro Output (Adresse + Betrag)
  const outputSize = outputCount * 34;
  
  // Witness Data (für Taproot): ~17 vBytes zusätzlich pro Input
  const witnessSize = inputCount * 17;
  
  return baseSize + inputSize + outputSize + witnessSize;
};

/**
 * Berechnet die geschätzten Netzwerkgebühren in BTC
 * @param feeRate Fee Rate in Sat/vB
 * @param estimatedSize Geschätzte Transaktionsgröße in vBytes
 * @returns Gebühren in BTC
 */
export const calculateNetworkFees = (feeRate: number, estimatedSize: number): number => {
  // Gebühren in Satoshi = Fee Rate (Sat/vB) * Größe (vB)
  const feesInSatoshi = feeRate * estimatedSize;
  
  // Konvertiere zu BTC (1 BTC = 100,000,000 Satoshi)
  return feesInSatoshi / 100000000;
};

/**
 * Ruft aktuelle Fee Rates ab und berechnet geschätzte Gebühren
 * @param priority 'fast' | 'medium' | 'slow' | 'economy'
 * @returns Geschätzte Gebühren in BTC
 */
export const estimateNetworkFees = async (
  priority: 'fast' | 'medium' | 'slow' | 'economy' = 'medium',
  inputCount: number = 1,
  outputCount: number = 2
): Promise<{ fees: number; feeRate: number; estimatedSize: number } | null> => {
  const feeRates = await getCurrentFeeRates();
  
  if (!feeRates) {
    return null;
  }

  // Wähle Fee Rate basierend auf Priorität
  let selectedFeeRate: number;
  switch (priority) {
    case 'fast':
      selectedFeeRate = feeRates.fastestFee;
      break;
    case 'medium':
      selectedFeeRate = feeRates.halfHourFee;
      break;
    case 'slow':
      selectedFeeRate = feeRates.hourFee;
      break;
    case 'economy':
      selectedFeeRate = feeRates.economyFee;
      break;
    default:
      selectedFeeRate = feeRates.halfHourFee;
  }

  const estimatedSize = estimateTransactionSize(inputCount, outputCount);
  const fees = calculateNetworkFees(selectedFeeRate, estimatedSize);

  return {
    fees,
    feeRate: selectedFeeRate,
    estimatedSize,
  };
};

/**
 * Berechnet die GESCHÄTZTEN Fees für Delegate-Inskriptionen
 * 
 * WICHTIG: Dies ist nur eine Schätzung für die Anzeige!
 * Die tatsächlichen Fees werden von UniSat API berechnet nach der Formel:
 * amount = outputValue*count + minerFee + serviceFee + devFee
 * 
 * @param cardCount Anzahl der Karten/Inskriptionen im Pack
 * @param feeRate Fee Rate in sat/vB
 * @param estimatedFileSize Durchschnittliche Dateigröße pro Inskription in Bytes (optional, default: 500 für HTML)
 * @returns Geschätzte Gebühren in BTC
 */
export const calculateInscriptionFees = (
  cardCount: number, 
  feeRate: number,
  estimatedFileSize: number = 500 // Durchschnittliche HTML-Dateigröße (~400-600 bytes für HTML mit img-Tag)
): number => {
  // UniSat API Formel: amount = outputValue*count + minerFee + serviceFee + devFee
  // 
  // Komponenten:
  // 1. outputValue (Postage): 330 sats pro Inskription (fix)
  // 2. minerFee = (Dateigröße + Transaktions-Overhead) × feeRate
  // 3. serviceFee + devFee = UniSat Service-Gebühren (~100-200 sats pro Inskription, geschätzt)
  
  // KORRIGIERTE BERECHNUNG: ~500 sats pro Inskription bei 1 sat/vB
  // 
  // Aufschlüsselung für ca. 500 sats pro Inskription bei 1 sat/vB:
  // - Postage (outputValue): 330 sats (fix)
  // - Miner Fee: ~130 sats (bei 1 sat/vB)
  // - Service Fees: ~40 sats (bei Batch niedriger)
  // Total: ~500 sats
  // 
  // Für HTML-Delegates (~500 bytes) bei Batch-Inskriptionen:
  // - Bei Batch werden Transaktionen optimiert (Commit/Reveal zusammen)
  // - Effektive vBytes pro Inskription: ~130 vBytes (nicht 500+!)
  // - Dies berücksichtigt bereits die Batch-Optimierung
  const effectiveVBytesPerInscription = 130; // vBytes pro Inskription (bei Batch optimiert)
  
  // Miner-Fee pro Inskription = vBytes × feeRate
  const minerFeePerInscription = effectiveVBytesPerInscription * feeRate;
  
  // Postage (outputValue) pro Inskription: 330 sats (fix)
  const postage = 330;
  
  // UniSat Service-Fees (serviceFee + devFee) - bei Batch niedriger
  // Realistischer Wert für Batch-Inskriptionen: ~40 sats pro Inskription
  const serviceFeesPerInscription = 40; // sats pro Inskription (bei Batch niedriger)
  
  // Gesamt pro Inskription (Schätzung)
  // Bei 1 sat/vB: ~130 (miner) + 330 (postage) + 40 (service) = ~500 sats pro Inskription
  const totalPerInscription = minerFeePerInscription + postage + serviceFeesPerInscription;
  
  // Gesamt für alle Inskriptionen
  const totalFeeInSats = totalPerInscription * cardCount;
  
  // Konvertiere zu BTC (1 BTC = 100,000,000 Satoshi)
  return totalFeeInSats / 100000000;
};

/**
 * Formatiert BTC-Betrag für Anzeige
 */
export const formatBTC = (btc: number): string => {
  if (btc < 0.00001) {
    return `${(btc * 100000000).toFixed(0)} sats`;
  }
  return `${btc.toFixed(8)} BTC`;
};

