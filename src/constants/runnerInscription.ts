/**
 * HTML-Inscription-ID für „Runner“ (Delegate-Quelle / Minting).
 */
export const RUNNER_INSCRIPTION_ID =
  '0fc37d11bddb53aed359fd200ceef0acb923d87c0777a905f43d9d2db63e1a4bi0';

/**
 * Eigene Inscription, die NUR für die Vorschau (Grid + Try-First-Lightbox) verwendet wird.
 * Ändert NICHT die Mint-Quelle (RUNNER_INSCRIPTION_ID).
 */
export const RUNNER_PREVIEW_INSCRIPTION_ID =
  '1293e6de9db0588cfdae0aba4e6ec43a3946cf0ce86ee7952589b25bd835561ei0';

/**
 * Eingebettete Vorschau (iframe). Direkt über ordinals.com/content — genau wie
 * alle anderen HTML-Kacheln auf der Startseite. Die frühere Variante über den
 * Proxy `ordin-delta.vercel.app` lieferte 404 (Dienst offline) und die reine
 * Wrapper-Inscription (RUNNER_PREVIEW_INSCRIPTION_ID) referenzierte ihre Engine
 * nur relativ (/content/…), was außerhalb von ordinals.com brach → leere/
 * kaputte Vorschau. Wir zeigen deshalb die echte, selbst-lauffähige Runner-
 * Inscription; deren relative Sub-Ressourcen lösen im iframe korrekt gegen
 * ordinals.com auf.
 */
export const RUNNER_PREVIEW_IFRAME_SRC = `https://ordinals.com/content/${RUNNER_INSCRIPTION_ID}`;
