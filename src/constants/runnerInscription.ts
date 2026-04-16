/**
 * HTML-Inscription-ID für „Runner“ (Delegate-Quelle / Minting).
 */
export const RUNNER_INSCRIPTION_ID =
  'ad217d6827a62b29f721195279f9b5558466b30be3d2aede7b0582885b24bc42i0';

/**
 * Nur für eingebettete Vorschau (iframe): ord.io kann nicht in fremden iframes geladen werden
 * (X-Frame-Options: SAMEORIGIN). Ord.io nutzt denselben Content-Endpunkt wie hier — damit
 * Mempool/Rendering der generativen HTML-Inscription dem Explorer auf ord.io entspricht,
 * nicht der rohen ordinals.com/content-Auslieferung.
 */
export const RUNNER_PREVIEW_IFRAME_SRC = `https://ordin-delta.vercel.app/content/${RUNNER_INSCRIPTION_ID}`;
