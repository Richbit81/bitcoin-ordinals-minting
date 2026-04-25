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
 * On-chain SIGNAL Marketplace (single-file Bitcoin Ordinal). Wird vom
 * Wrapper-Overlay als "OPEN →"-Link benutzt. Die Marketplace-Inscription
 * lädt ihre Items dynamisch via /r/sat/<HASHLIST_SAT>/at/-1, sodass neue
 * SIGNALs auftauchen sobald eine neue Hashlist-Version auf demselben sat
 * eingeschrieben wird.
 */
export const SIGNAL_MARKETPLACE_INSCRIPTION_ID =
  '6cf707bbbfedbceb00f5afb0200570e9fe4c715b99c036fba16a4729beff2d14i0';

/**
 * Sat-Pointer, auf dem die SIGNAL-Hashlist lebt. Jede neue Version der
 * Hashlist wird als weitere Inscription auf DENSELBEN sat geschrieben;
 * die Marketplace fragt /r/sat/<HASHLIST_SAT>/at/-1 ab und bekommt damit
 * automatisch immer die neueste Version.
 */
export const SIGNAL_HASHLIST_SAT = '1446097958407412';

/**
 * Formatiert eine Edition-Nummer auf 4-stellig zero-padded (`0001`–`1000`).
 * Wichtig für die byte-stabilität des Wrappers: jeder Mint hat exakt die
 * gleiche Länge, egal ob #1 oder #999.
 */
const padEdition = (n: number): string => String(n).padStart(4, '0');

/**
 * Wrapper-Template (mit `__EDITION__`-Platzhalter). 1:1 aus
 * `signal-marketplace/wrapper-template.html` übernommen — bitte NICHT
 * inline mit Whitespace-Trimming ändern, das Layout der CSS-Regeln ist
 * Teil der ästhetischen Definition.
 *
 * Substitution erfolgt in buildSignalWrapper(): zwei Vorkommen von
 * `__EDITION__` werden auf 4-stellig zero-padded ersetzt → Byte-Länge
 * bleibt über alle Editionen identisch.
 */
const SIGNAL_WRAPPER_TEMPLATE = `<!doctype html>
<meta charset=utf-8>
<title>SIGNAL #__EDITION__</title>
<meta name="generator" content="richart.app">
<meta name="collection" content="SIGNAL">
<meta name="edition" content="__EDITION__ / 1000">
<meta name="provenance" content="Mint on richart.app">
<style>
  html,body{margin:0;height:100%;background:#0a0a0a;overflow:hidden}
  /* Floating marketplace panel.  Hidden by default; tap anywhere on
     the artwork to reveal.  Auto-hides after a few seconds of no
     interaction.  Iframe-safe: shows the URL inline so the user can
     copy it even when popups / target=_blank are blocked. */
  #mpx{position:fixed;right:12px;bottom:12px;z-index:99;
       display:flex;align-items:center;gap:7px;padding:7px 9px;
       background:rgba(0,0,0,.78);border:1px solid #ff2bd6;border-radius:3px;
       backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
       font:10px/1 'JetBrains Mono','SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;
       color:#f4f4f4;letter-spacing:.12em;text-transform:uppercase;
       max-width:calc(100vw - 24px);box-sizing:border-box;
       opacity:0;visibility:hidden;pointer-events:none;
       transform:translateY(6px);transition:opacity .2s,transform .2s,visibility 0s linear .2s}
  #mpx.on{opacity:1;visibility:visible;pointer-events:auto;transform:none;
       transition:opacity .2s,transform .2s,visibility 0s}
  #mpx b{color:#ff2bd6;letter-spacing:.18em;font-weight:400}
  #mpx b::before{content:'\\25CF';margin-right:5px;font-size:7px;animation:mpb 1.4s steps(2) infinite}
  #mpx input{flex:1;min-width:140px;background:#0a0a0a;border:1px solid rgba(255,43,214,.3);
       color:#f4f4f4;font:inherit;padding:5px 6px;border-radius:2px;outline:none;cursor:text}
  #mpx a,#mpx button{font:inherit;text-transform:uppercase;letter-spacing:.18em;
       padding:5px 9px;border-radius:2px;cursor:pointer;text-decoration:none;white-space:nowrap}
  #mpx a{color:#0a0a0a;background:#ff2bd6;border:1px solid #ff2bd6}
  #mpx a:hover{box-shadow:0 0 12px rgba(255,43,214,.55)}
  #mpx button{color:#f4f4f4;background:transparent;border:1px solid rgba(255,43,214,.55)}
  #mpx button:hover{background:rgba(255,43,214,.12)}
  #mpx .x{color:#aaa;border-color:rgba(255,255,255,.18);padding:5px 7px}
  @keyframes mpb{50%{opacity:.25}}
</style>
<body>
<script src="/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>
<div id=mpx>
  <b>MP</b>
  <input id=mpu readonly value="https://ordinals.com/content/${SIGNAL_MARKETPLACE_INSCRIPTION_ID}">
  <button id=mpc title="Copy link">COPY</button>
  <a id=mpo href="https://ordinals.com/content/${SIGNAL_MARKETPLACE_INSCRIPTION_ID}" target="_blank" rel="noopener noreferrer">OPEN &rarr;</a>
  <button id=mpx_ class=x title="Dismiss">&times;</button>
</div>
<script>
(function(){
  var p=document.getElementById('mpx'),u=document.getElementById('mpu'),
      c=document.getElementById('mpc'),o=document.getElementById('mpo'),
      x=document.getElementById('mpx_'),t=0,HIDE=4500;
  function show(){p.classList.add('on');clearTimeout(t);t=setTimeout(hide,HIDE)}
  function hide(){p.classList.remove('on');clearTimeout(t)}
  function poke(){if(p.classList.contains('on')){clearTimeout(t);t=setTimeout(hide,HIDE)}}
  document.addEventListener('click',function(e){
    if(p.contains(e.target))return;
    if(p.classList.contains('on'))hide();else show();
  },true);
  ['mousemove','keydown','touchstart'].forEach(function(ev){p.addEventListener(ev,poke)});
  u.addEventListener('focus',function(){u.select()});
  u.addEventListener('click',function(){u.select()});
  c.addEventListener('click',async function(e){
    e.stopPropagation();var ok=false,v=u.value;
    try{await navigator.clipboard.writeText(v);ok=true}catch(_){}
    if(!ok){try{u.select();u.setSelectionRange(0,v.length);ok=document.execCommand('copy')}catch(_){}}
    c.textContent=ok?'COPIED':'PRESS Ctrl+C';clearTimeout(t);t=setTimeout(function(){c.textContent='COPY';hide()},2200);
  });
  o.addEventListener('click',function(e){e.stopPropagation();poke()});
  x.addEventListener('click',function(e){e.stopPropagation();hide()});
})();
</script>
`;

/**
 * Baut den per-Mint SIGNAL-Wrapper. Eindeutigkeit pro Mint kommt aus drei
 * Quellen:
 *   1. Engine-Seed: deterministisch aus der eigenen Inscription-ID
 *      (Pathname `/content/<id>` → FNV-1a → mulberry32).
 *   2. Provenance-Metadaten: HTML <meta>-Tags identifizieren Collection +
 *      Edition-Nummer maschinenlesbar, ohne sichtbares Element im Bild.
 *   3. Marketplace-Overlay: ein on-tap einblendbares MP-Panel mit Link
 *      zur on-chain SIGNAL Marketplace Inscription. Standardmäßig
 *      versteckt — das Bild bleibt clean, bis jemand auf das Artwork tippt.
 *
 * Edition-Nummer wird auf 4-stellig zero-padded (`0001`–`1000`), damit
 * die Byte-Länge des Wrappers über alle Editionen identisch bleibt.
 */
export const buildSignalWrapper = (editionNumber: number): string => {
  const ed = padEdition(editionNumber);
  return SIGNAL_WRAPPER_TEMPLATE.replace(/__EDITION__/g, ed);
};

/**
 * Erwartete Byte-Länge eines per-Mint Wrappers (UTF-8, ASCII-only).
 * Konstant über alle Editionen, weil die Edition-Nummer auf 4 Stellen
 * zero-padded wird. Wird vom Mint-Service gegen den tatsächlich gebauten
 * String geprüft (Runtime-Guard gegen versehentliche Modifikationen).
 */
export const SIGNAL_WRAPPER_BYTES = buildSignalWrapper(SIGNAL_EDITION_LIMIT).length;

/**
 * Vorschau-Markup für die richart-Card und das Try-Modal. Identisch zum
 * inscribed Wrapper, aber mit absoluter Engine-URL statt `/content/...`,
 * damit es auch außerhalb von ord-Servern (Vite-Dev, Vercel) läuft. Die
 * Edition wird optional mitgegeben — Default `0` bedeutet: Vorschau ohne
 * konkrete Auflage.
 */
export const buildSignalPreviewSrcDoc = (editionNumber = 0): string => {
  return buildSignalWrapper(editionNumber).replace(
    `<script src="/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>`,
    `<script src="https://ordinals.com/content/${SIGNAL_ENGINE_INSCRIPTION_ID}"></script>`
  );
};

/**
 * Statisches Vorschau-srcDoc für die Card (Edition unbekannt → 0000).
 * Bestehende Imports (`SIGNAL_PREVIEW_SRCDOC`) bleiben kompatibel.
 */
export const SIGNAL_PREVIEW_SRCDOC = buildSignalPreviewSrcDoc(0);
