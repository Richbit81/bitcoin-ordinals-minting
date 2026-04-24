/**
 * Engine-Inscription für SIGNAL (Bitcoin Mainnet).
 * Reine application/javascript-Inscription, ~60 KB. Wird von jedem
 * SIGNAL-Mint via <script src="/content/<engineId>"> geladen.
 *
 * Achtung: dies ist KEINE Parent-Inscription im ord-protocol-Sinn (anders
 * als bei Tesseract). Der Wrapper bezieht die Engine zur Laufzeit, nicht
 * über provenance.
 */
export const SIGNAL_ENGINE_INSCRIPTION_ID =
  'af23cd3c031cc6eabc5f2850925c21b65e5b4e89f84a2279ca244db3facd0b9bi0';

/**
 * Maximale Auflage der SIGNAL-Edition. Wird vom Frontend gegen
 * /api/techgames/count-by-original geprüft; bei Erreichen wird der
 * Mint-Button deaktiviert und ein Sold-Out-State angezeigt.
 *
 * Der Wert kann jederzeit angehoben werden — der On-Chain-State bleibt
 * davon unberührt.
 */
export const SIGNAL_EDITION_LIMIT = 1000;

/**
 * Bytegenauer Wrapper-HTML-Inhalt — wird bei jedem SIGNAL-Mint identisch
 * eingeschrieben. Eindeutigkeit entsteht zur Laufzeit: die Engine liest
 * `window.location.pathname` der eigenen Inscription-Adresse aus und nutzt
 * die ID als deterministischen FNV-1a-Seed (siehe extractInscriptionId in
 * der Engine).
 *
 * Anders als bei Tesseract laden wir die Engine direkt per <script src>,
 * weil die SIGNAL-Engine als application/javascript-Inscription vorliegt
 * (Tesseract ist eine vollständige HTML-Inscription, deshalb dort iframe).
 *
 * WICHTIG: Bytes müssen exakt `SIGNAL_WRAPPER_BYTES` ergeben — Runtime-Guard
 * im Mint-Service verweigert sonst das Inscriben.
 */
// eslint-disable-next-line max-len
export const SIGNAL_WRAPPER_HTML = `<!doctype html><meta charset=utf-8><title>SIGNAL</title><style>html,body{margin:0;height:100%;background:#0a0a0a;overflow:hidden}</style><body><script src="/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>`;

/**
 * Erwartete Byte-Länge des Wrappers (UTF-8, ASCII-only). Wird vom
 * Mint-Service gegen die Konstante geprüft, um versehentliche
 * Modifikationen zu verhindern.
 *
 * Wichtig: das `<body>`-Tag (+6 Bytes) ist zwingend erforderlich, sonst
 * läuft das Engine-Script in der "in head"-Phase des Parsers und
 * `document.body` ist `null` (TypeError beim insertBefore).
 */
export const SIGNAL_WRAPPER_BYTES = 242;

/**
 * Vorschau-Markup für die richart-Card und das Try-Modal. Identisch zum
 * inscribed Wrapper, aber mit absoluter Engine-URL statt `/content/...`,
 * damit es auch außerhalb von ord-Servern (z. B. Vite-Dev, Vercel) sauber
 * lädt. Ohne Inscription-Kontext fällt die Engine auf einen Zufalls-Seed
 * zurück — das ist für die Vorschau exakt das gewünschte Verhalten
 * (zeigt die visuelle Vielfalt, nicht eine spezifische Edition).
 */
export const SIGNAL_PREVIEW_SRCDOC =
  `<!doctype html><meta charset=utf-8><title>SIGNAL</title>` +
  `<style>html,body{margin:0;height:100%;background:#0a0a0a;overflow:hidden}</style>` +
  `<body><script src="https://ordinals.com/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>`;
