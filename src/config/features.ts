/**
 * =====================================
 * FEATURE FLAGS
 * =====================================
 * 
 * Zentrale Konfiguration für Features, die aktiviert/deaktiviert werden können.
 * 
 * Verwendung:
 * import { FEATURES } from '../config/features';
 * if (FEATURES.ENABLE_UNISAT) { ... }
 */

export const FEATURES = {
  /**
   * UniSat Wallet Support
   * 
   * Status: AKTIVIERT (2026-02-11)
   * Fix: getOrdinalAddress() stellt sicher dass Inscriptions immer an Taproot gehen
   */
  ENABLE_UNISAT: true,

  /**
   * Xverse Wallet Support
   * 
   * Status: AKTIVIERT
   * Funktioniert stabil mit separaten payment/ordinals addresses
   */
  ENABLE_XVERSE: true,

  /**
   * OKX Wallet Support
   * 
   * Status: AKTIVIERT
   * API fast identisch mit UniSat (window.okxwallet.bitcoin)
   */
  ENABLE_OKX: true,
} as const;

/**
 * Type-safe Feature Flag Keys
 */
export type FeatureFlag = keyof typeof FEATURES;

/**
 * Helper: Prüfe ob ein Feature aktiviert ist
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURES[feature] === true;
}

/**
 * Helper: Liste aller aktiven Wallets
 */
export function getEnabledWallets(): string[] {
  const wallets: string[] = [];
  if (FEATURES.ENABLE_UNISAT) wallets.push('unisat');
  if (FEATURES.ENABLE_XVERSE) wallets.push('xverse');
  if (FEATURES.ENABLE_OKX) wallets.push('okx');
  return wallets;
}

/**
 * Helper: Mindestens ein Wallet aktiviert?
 */
export function hasAnyWalletEnabled(): boolean {
  return getEnabledWallets().length > 0;
}

// Debug-Ausgabe beim Start (nur in Development)
if (process.env.NODE_ENV === 'development') {
  console.log('[Features] 🎛️ Feature Flags:', FEATURES);
  console.log('[Features] 💰 Enabled Wallets:', getEnabledWallets());
}
