/**
 * HTML-Inscription-ID für „Runner“ (Delegate-Quelle / Minting).
 */
export const RUNNER_INSCRIPTION_ID =
  '0fc37d11bddb53aed359fd200ceef0acb923d87c0777a905f43d9d2db63e1a4bi0';

/**
 * Nur für eingebettete Vorschau (iframe): ord.io kann nicht in fremden iframes geladen werden
 * (X-Frame-Options: SAMEORIGIN). Ord.io nutzt denselben Content-Endpunkt wie hier — damit
 * Mempool/Rendering der generativen HTML-Inscription dem Explorer auf ord.io entspricht,
 * nicht der rohen ordinals.com/content-Auslieferung.
 */
export const RUNNER_PREVIEW_IFRAME_SRC = `https://ordin-delta.vercel.app/content/${RUNNER_INSCRIPTION_ID}`;
