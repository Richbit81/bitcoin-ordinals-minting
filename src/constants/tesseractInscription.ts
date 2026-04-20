/**
 * Parent / Genesis Inscription für TESSERACT (auf Bitcoin Mainnet, Block 945972).
 * Enthält die komplette Tesseract-Engine (~69 KB). Wird ausschließlich als
 * Vorschau (iframe) und als Eltern-Provenance beim Mint verwendet.
 */
export const TESSERACT_PARENT_INSCRIPTION_ID =
  '1e0d7855a006004929a5dba2428696bafe1e771a6a71b3a1fb0b0d66e7f5301ci0';

/**
 * Bytegenauer Wrapper-HTML-Inhalt (577 Bytes, UTF-8, ASCII-only) — wird bei
 * jedem Tesseract-Mint identisch eingeschrieben. Eindeutigkeit kommt allein
 * durch die vom Protokoll vergebene Inscription-ID, aus der die Engine im
 * Parent ihren deterministischen Seed ableitet (FNV-1a der ID).
 *
 * WICHTIG: Inhalt nicht modifizieren — Bytes müssen exakt 577 ergeben,
 * sonst weicht das Asset von der ursprünglichen Spezifikation ab.
 */
// eslint-disable-next-line max-len
export const TESSERACT_WRAPPER_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>TESSERACT</title><style>body,html{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#000}</style></head><body><iframe src="/content/${TESSERACT_PARENT_INSCRIPTION_ID}" referrerpolicy="unsafe-url" allow="autoplay; fullscreen" loading="eager" title="Tesseract"></iframe></body></html>`;
