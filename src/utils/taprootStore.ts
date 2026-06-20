/**
 * Per-Wallet Taproot-Bindung.
 *
 * Hintergrund / kritischer Bugfix: Früher wurde die Taproot-Empfangsadresse
 * unter EINEM globalen localStorage-Key (`unisat_taproot_address`) gespeichert
 * und beim Verbinden/Wallet-Wechsel blind wiederverwendet. Verband sich danach
 * eine ANDERE Wallet im SegWit-Modus (UniSat/OKX liefern dann keine Taproot-
 * Adresse), erbte sie die Taproot-Adresse der vorherigen Wallet — und die
 * Inscription ging an die FALSCHE Wallet.
 *
 * Lösung: Die Taproot-Adresse wird an die konkrete Wallet gebunden, identifiziert
 * über ihre Payment-Adresse (die UniSat/OKX im SegWit-Modus zurückgeben). Eine
 * andere Wallet hat eine andere Payment-Adresse → erbt NIE eine fremde Taproot.
 */

const MAP_KEY = 'unisat_taproot_bindings_v1';
// Legacy-Key wird nur noch beschrieben (für Altleser wie pointsService),
// aber NIE mehr zum Vererben beim Connect gelesen.
const LEGACY_KEY = 'unisat_taproot_address';

type Bindings = Record<string, string>;

const isTaproot = (v: unknown): v is string =>
  typeof v === 'string' && /^bc1p[0-9a-z]{8,}$/i.test(v.trim());

function readMap(): Bindings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Bindings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    /* localStorage nicht verfügbar — ignorieren */
  }
}

/**
 * Liefert die Taproot-Adresse, die GENAU dieser Wallet (Payment-Adresse)
 * zugeordnet ist. Gibt '' zurück, wenn keine eindeutige Bindung existiert.
 */
export function getBoundTaproot(paymentAddress: string | null | undefined): string {
  const key = String(paymentAddress || '').trim();
  if (!key) return '';
  const v = readMap()[key];
  return isTaproot(v) ? v.trim() : '';
}

/**
 * Bindet eine Taproot-Adresse an die aktuell verbundene Wallet (Payment-Adresse).
 * Schreibt den Legacy-Key zusätzlich als "zuletzt verwendet" (nur für Altleser).
 */
export function bindTaproot(paymentAddress: string | null | undefined, taproot: string): void {
  const key = String(paymentAddress || '').trim();
  const value = String(taproot || '').trim();
  if (!key || !isTaproot(value)) return;
  const map = readMap();
  map[key] = value;
  writeMap(map);
  try {
    localStorage.setItem(LEGACY_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Entfernt die Bindung einer Wallet (z.B. bei Disconnect). */
export function clearBoundTaproot(paymentAddress: string | null | undefined): void {
  const key = String(paymentAddress || '').trim();
  if (!key) return;
  const map = readMap();
  if (key in map) {
    delete map[key];
    writeMap(map);
  }
}
