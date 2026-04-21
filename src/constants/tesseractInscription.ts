/**
 * Parent / Genesis Inscription für TESSERACT (auf Bitcoin Mainnet, Block 945972).
 * Enthält die komplette Tesseract-Engine (~69 KB). Wird ausschließlich als
 * Vorschau (iframe) und als Eltern-Provenance beim Mint verwendet.
 */
export const TESSERACT_PARENT_INSCRIPTION_ID =
  '1e0d7855a006004929a5dba2428696bafe1e771a6a71b3a1fb0b0d66e7f5301ci0';

/**
 * Maximale Auflage der Tesseract-Edition. Wird vom Frontend gegen
 * /api/techgames/count-by-original geprüft; bei Erreichen wird der
 * Mint-Button deaktiviert und ein Sold-Out-State angezeigt.
 *
 * Der Wert kann jederzeit angehoben werden — der On-Chain-State bleibt
 * davon unberührt.
 */
export const TESSERACT_EDITION_LIMIT = 999;

/**
 * Bytegenauer Wrapper-HTML-Inhalt (547 Bytes, UTF-8, ASCII-only) — wird bei
 * jedem Tesseract-Mint identisch eingeschrieben. Eindeutigkeit entsteht zur
 * Laufzeit: das inline-Script liest die eigene Inscription-ID aus
 * `location.pathname` und reicht sie der Engine via `#inscription=<id>` an
 * den iframe weiter.
 *
 * Diese Hash-Methode hat in der Tesseract-Engine **höchste Priorität** vor
 * `parent`, `top`, `referrer` und der Self-Fallback-Logik. Sie funktioniert
 * deshalb auch dann zuverlässig, wenn der Mint in einem doppelt verschachtelten
 * iframe (z. B. ord.io / richart.app-Preview) angezeigt wird, wo
 * cross-origin-Zugriffe auf parent/top blockiert wären.
 *
 * Die VORIGE Variante (`<iframe src="/content/PARENT">` ohne Hash) erzeugte
 * für jeden Mint denselben Cube, weil die Engine im iframe nur die Parent-URL
 * sah und auf den Parent-ID-Self-Fallback zurückfiel. Dieser Wrapper behebt
 * das, ohne den Engine-Code im Parent zu verändern.
 *
 * WICHTIG: Bytes müssen exakt 547 ergeben — Runtime-Guard im Mint-Service
 * verweigert sonst das Inscriben.
 */
// eslint-disable-next-line max-len
export const TESSERACT_WRAPPER_HTML = `<!doctype html><meta charset=utf-8><title>TESSERACT</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#000}</style><script>var b="${TESSERACT_PARENT_INSCRIPTION_ID}",p=location.pathname.split("/").pop()||"",s=/^[0-9a-f]{64}i\\d+$/i.test(p)?p:b;document.write('<iframe src="/content/'+b+'#inscription='+s+'" referrerpolicy="unsafe-url" allow="autoplay; fullscreen" title="Tesseract"></iframe>')</script>`;

/**
 * Erwartete Byte-Länge des Wrappers (UTF-8, ASCII-only). Wird vom Mint-Service
 * gegen die Konstante geprüft, um versehentliche Modifikationen zu verhindern.
 */
export const TESSERACT_WRAPPER_BYTES = 547;
