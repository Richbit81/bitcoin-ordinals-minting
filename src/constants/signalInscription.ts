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
 * Formatiert eine Edition-Nummer auf 4-stellig zero-padded (`0001`–`1000`).
 * Wichtig für die byte-stabilität des Wrappers: jeder Mint hat exakt die
 * gleiche Länge, egal ob #1 oder #999.
 */
const padEdition = (n: number): string => String(n).padStart(4, '0');

/**
 * Baut den per-Mint SIGNAL-Wrapper. Eindeutigkeit pro Mint kommt aus zwei
 * Quellen:
 *   1. Engine-Seed: deterministisch aus der eigenen Inscription-ID
 *      (Pathname `/content/<id>` → FNV-1a → mulberry32).
 *   2. Provenance-Metadaten: HTML <meta>-Tags identifizieren Collection +
 *      Edition-Nummer maschinenlesbar, ohne sichtbares Element im Bild.
 *
 * Die Meta-Tags rendern absichtlich nichts — sie sind nur für Marketplaces,
 * Indexer und Tools, die HTML-Metadata extrahieren.
 *
 * Anders als bei Tesseract laden wir die Engine direkt per <script src>,
 * weil die SIGNAL-Engine als application/javascript-Inscription vorliegt
 * (Tesseract ist eine vollständige HTML-Inscription, deshalb dort iframe).
 *
 * WICHTIG: das `<body>`-Tag ist zwingend erforderlich, sonst läuft das
 * Engine-Script in der "in head"-Phase des Parsers und `document.body` ist
 * `null` (TypeError beim insertBefore in der Engine).
 */
export const buildSignalWrapper = (editionNumber: number): string => {
  const ed = padEdition(editionNumber);
  const total = padEdition(SIGNAL_EDITION_LIMIT);
  return (
    `<!doctype html>` +
    `<meta charset=utf-8>` +
    `<title>SIGNAL #${ed}</title>` +
    `<meta name="generator" content="richart.app">` +
    `<meta name="collection" content="SIGNAL">` +
    `<meta name="edition" content="${ed} / ${total}">` +
    `<meta name="provenance" content="Mint on richart.app">` +
    `<style>html,body{margin:0;height:100%;background:#0a0a0a;overflow:hidden}</style>` +
    `<body>` +
    `<script src="/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>`
  );
};

/**
 * Erwartete Byte-Länge eines per-Mint Wrappers (UTF-8, ASCII-only).
 * Konstant über alle Editionen, weil die Edition-Nummer auf 4 Stellen
 * zero-padded wird. Wird vom Mint-Service gegen den tatsächlich gebauten
 * String geprüft (Runtime-Guard gegen versehentliche Modifikationen).
 */
export const SIGNAL_WRAPPER_BYTES = buildSignalWrapper(SIGNAL_EDITION_LIMIT).length;

/**
 * Vorschau-Markup für die richart-Card und das Try-Modal. Verwendet eine
 * absolute Engine-URL statt `/content/...`, damit es auch außerhalb von
 * ord-Servern (Vite-Dev, Vercel) läuft. Die Edition wird optional
 * mitgegeben — Default `0` bedeutet: Vorschau ohne konkrete Auflage.
 */
export const buildSignalPreviewSrcDoc = (editionNumber = 0): string => {
  const ed = padEdition(editionNumber);
  const total = padEdition(SIGNAL_EDITION_LIMIT);
  return (
    `<!doctype html>` +
    `<meta charset=utf-8>` +
    `<title>SIGNAL #${ed}</title>` +
    `<meta name="generator" content="richart.app">` +
    `<meta name="collection" content="SIGNAL">` +
    `<meta name="edition" content="${ed} / ${total}">` +
    `<meta name="provenance" content="Mint on richart.app">` +
    `<style>html,body{margin:0;height:100%;background:#0a0a0a;overflow:hidden}</style>` +
    `<body>` +
    `<script src="https://ordinals.com/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>`
  );
};

/**
 * Statisches Vorschau-srcDoc für die Card (Edition unbekannt → 0000).
 * Bestehende Imports (`SIGNAL_PREVIEW_SRCDOC`) bleiben kompatibel.
 */
export const SIGNAL_PREVIEW_SRCDOC = buildSignalPreviewSrcDoc(0);
