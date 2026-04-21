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
 * Eigene Mirror-Domain für die mempool.space-API (HTTPS + WebSocket).
 * Wird vom Wrapper als Fallback verwendet, falls mempool.space beim Boot
 * der Inscription nicht erreichbar ist (z. B. bei Ausfall, Sanktionen,
 * regionalen Sperren). Der Mirror selbst spricht primär mempool.space und
 * fällt intern auf blockstream.info zurück (siehe tesseract-mirror Repo).
 *
 * WICHTIG: Diese Subdomain ist Teil des on-chain inscribten Wrappers und
 * kann nach dem ersten Mint NICHT mehr geändert werden. Hosting-Wechsel
 * erfolgen ausschließlich über DNS (CNAME). Niemals durch eine Vendor-URL
 * ersetzen.
 */
export const TESSERACT_MIRROR_HOST = 'mempool.richart.app';

/**
 * Bytegenauer Wrapper-HTML-Inhalt (1002 Bytes, UTF-8, ASCII-only) — wird bei
 * jedem Tesseract-Mint identisch eingeschrieben. Der Wrapper macht drei Dinge:
 *
 *   1. **Eindeutigkeit:** Liest die eigene Inscription-ID aus
 *      `location.pathname` und reicht sie der Engine via
 *      `#inscription=<id>` weiter (höchste Priorität in der Engine vor
 *      parent/top/referrer/self-Fallback).
 *
 *   2. **Mempool-Failover:** Versucht beim Boot 2.5 s lang einen
 *      WebSocket-Connect zu `wss://mempool.space/api/v1/ws`. Klappt das,
 *      wird die Engine unverändert ausgeführt (Original direkt). Klappt es
 *      NICHT, werden im Engine-HTML alle Vorkommen von `mempool.space`
 *      durch den Mirror ersetzt (HTTPS + WSS) — der Tesseract bleibt also
 *      live, auch wenn mempool.space wegfällt.
 *
 *   3. **Engine-Hosting via Blob:** Die Engine-HTML wird per `fetch` aus
 *      `/content/<PARENT>` gelesen und über eine `Blob`-URL ins iframe
 *      gerendert. Da Blob-URLs den Origin des Erzeugers erben
 *      (`blob:https://ordinals.com/...`), funktionieren die rekursiven
 *      ord-Endpoints (`/r/blockheight`, `/r/...`) und die CSP weiterhin
 *      so wie beim direkten /content/-Aufruf.
 *
 * WICHTIG: Bytes müssen exakt 1002 ergeben — Runtime-Guard im Mint-Service
 * verweigert sonst das Inscriben. Jede Änderung am Wrapper-Inhalt ist
 * IRREVERSIBEL für bereits geprägte Editionen, weil jede Edition den dann
 * gültigen Wrapper-Bytestring bytegenau on-chain speichert.
 */
// eslint-disable-next-line max-len
export const TESSERACT_WRAPPER_HTML = `<!doctype html><meta charset=utf-8><title>TESSERACT</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#000}</style><body><script>(async()=>{var P="${TESSERACT_PARENT_INSCRIPTION_ID}",M="${TESSERACT_MIRROR_HOST}",p=location.pathname.split("/").pop()||"",c=/^[0-9a-f]{64}i\\d+$/i.test(p)?p:P,o=await new Promise(r=>{try{var w=new WebSocket("wss://mempool.space/api/v1/ws"),t=setTimeout(()=>{try{w.close()}catch(e){}r(0)},2500);w.onopen=()=>{clearTimeout(t);try{w.close()}catch(e){}r(1)};w.onerror=()=>{clearTimeout(t);r(0)}}catch(e){r(0)}}),h=await(await fetch("/content/"+P)).text();if(!o)h=h.split("mempool.space").join(M);var f=document.createElement("iframe");f.src=URL.createObjectURL(new Blob([h],{type:"text/html"}))+"#inscription="+c;f.referrerPolicy="unsafe-url";f.allow="autoplay; fullscreen";f.title="Tesseract";document.body.appendChild(f)})()</script>`;

/**
 * Erwartete Byte-Länge des Wrappers (UTF-8, ASCII-only). Wird vom Mint-Service
 * gegen die Konstante geprüft, um versehentliche Modifikationen zu verhindern.
 */
export const TESSERACT_WRAPPER_BYTES = 1002;
