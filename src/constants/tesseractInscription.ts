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
 * On-chain TESSERACT Marketplace (single-file Bitcoin Ordinal). Wird vom
 * Wrapper-Overlay als "OPEN →"-Link benutzt. Die Marketplace-Inscription
 * lädt ihre Items dynamisch via /r/sat/<HASHLIST_SAT>/at/-1, sodass neue
 * TESSERACTs auftauchen sobald eine neue Hashlist-Version auf demselben sat
 * eingeschrieben wird.
 */
export const TESSERACT_MARKETPLACE_INSCRIPTION_ID =
  '62cbf4f512b054c78eefa08a18e3816089da20a81ae508bcc1f98c4b2e26ded8i0';

/**
 * Sat-Pointer, auf dem die TESSERACT-Hashlist lebt. Jede neue Version der
 * Hashlist wird als weitere Inscription auf DENSELBEN sat geschrieben;
 * die Marketplace fragt /r/sat/<HASHLIST_SAT>/at/-1 ab und bekommt damit
 * automatisch immer die neueste Version.
 */
export const TESSERACT_HASHLIST_SAT = '520797771598128';

/**
 * Formatiert eine Edition-Nummer auf 4-stellig zero-padded (`0001`–`1000`).
 * Wichtig für die byte-stabilität des Wrappers: jeder Mint hat exakt die
 * gleiche Länge, egal ob #1 oder #999.
 */
const padEdition = (n: number): string => String(n).padStart(4, '0');

/**
 * Wrapper-Template (mit `__EDITION__`-Platzhalter). 1:1 aus
 * `tesseract-marketplace/wrapper-ready.html` übernommen — bitte NICHT
 * inline mit Whitespace-Trimming ändern, das Layout der CSS-Regeln ist
 * Teil der ästhetischen Definition.
 *
 * Substitution erfolgt in buildTesseractWrapper(): zwei Vorkommen von
 * `__EDITION__` werden auf 4-stellig zero-padded ersetzt → Byte-Länge
 * bleibt über alle Editionen identisch.
 *
 * Im Unterschied zum vorigen Wrapper (547 Bytes, reine iframe-Hülle) ist
 * dieser marketplace-aware: er rendert ein on-tap einblendbares MP-Panel
 * unten am Bildschirmrand mit Direktlink zur on-chain Marketplace.
 */
const TESSERACT_WRAPPER_TEMPLATE = `<!doctype html>
<meta charset=utf-8>
<title>TESSERACT #__EDITION__</title>
<meta name="generator" content="richart.app">
<meta name="collection" content="TESSERACT">
<meta name="edition" content="__EDITION__ / 1000">
<meta name="provenance" content="Mint on richart.app">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#000}
  /* Transparent edge-zone above the iframe.  Catches taps near the
     bottom of the viewport without showing any UI -- when the user
     taps it, the marketplace panel slides in.  Pointer-events go to
     the iframe everywhere else, so the WebGL scene stays fully
     interactive. */
  #mpz{position:fixed;left:0;right:0;bottom:0;height:28px;z-index:50;
       background:transparent;cursor:pointer}
  /* Floating marketplace panel.  Slides up from bottom-center, hides
     after a few seconds of no interaction.  Iframe-safe: shows the
     URL inline so the user can copy it even when popups are blocked. */
  #mpx{position:fixed;left:50%;bottom:14px;z-index:99;
       transform:translate(-50%,8px);
       display:flex;align-items:center;gap:8px;padding:8px 11px;
       background:rgba(3,3,8,.86);border:1px solid #00ffd5;border-radius:3px;
       backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
       box-shadow:0 0 18px rgba(0,255,213,.18),0 0 36px rgba(255,0,170,.10);
       font:10px/1 ui-monospace,'Cascadia Code',Consolas,'Courier New',monospace;
       color:#e8fff7;letter-spacing:.14em;text-transform:uppercase;
       max-width:calc(100vw - 24px);box-sizing:border-box;
       opacity:0;visibility:hidden;pointer-events:none;
       transition:opacity .22s,transform .22s,visibility 0s linear .22s}
  #mpx.on{opacity:1;visibility:visible;pointer-events:auto;
       transform:translate(-50%,0);
       transition:opacity .22s,transform .22s,visibility 0s}
  #mpx b{color:#00ffd5;letter-spacing:.20em;font-weight:400;
       text-shadow:0 0 8px rgba(0,255,213,.55)}
  #mpx b::before{content:'\\25CF';margin-right:5px;font-size:7px;
       animation:mpb 1.4s steps(2) infinite;color:#f0a}
  #mpx input{flex:1;min-width:140px;background:#000;
       border:1px solid rgba(0,255,213,.32);color:#e8fff7;
       font:inherit;padding:5px 6px;border-radius:2px;outline:none;cursor:text}
  #mpx a,#mpx button{font:inherit;text-transform:uppercase;letter-spacing:.18em;
       padding:5px 9px;border-radius:2px;cursor:pointer;
       text-decoration:none;white-space:nowrap}
  #mpx a{color:#000;background:#00ffd5;border:1px solid #00ffd5;font-weight:700}
  #mpx a:hover{box-shadow:0 0 14px rgba(0,255,213,.65)}
  #mpx button{color:#e8fff7;background:transparent;
       border:1px solid rgba(0,255,213,.55)}
  #mpx button:hover{background:rgba(0,255,213,.10)}
  #mpx .x{color:#aaa;border-color:rgba(255,255,255,.18);padding:5px 7px}
  @keyframes mpb{50%{opacity:.25}}
  /* Tiny edge hint -- a barely-visible cyan line at the very bottom
     edge that pulses gently, so users have a faint visual cue that
     something is interactive down there. */
  #mph{position:fixed;left:50%;bottom:6px;width:36px;height:2px;
       transform:translateX(-50%);z-index:49;pointer-events:none;
       background:#00ffd5;border-radius:2px;opacity:.35;
       box-shadow:0 0 8px rgba(0,255,213,.65);
       animation:mph 2.6s ease-in-out infinite}
  #mph.gone{opacity:0;transition:opacity .4s}
  @keyframes mph{0%,100%{opacity:.18}50%{opacity:.55}}
</style>
<body>
<script>
var b="${TESSERACT_PARENT_INSCRIPTION_ID}",
    p=location.pathname.split("/").pop()||"",
    s=/^[0-9a-f]{64}i\\d+$/i.test(p)?p:b;
document.write('<iframe src="/content/'+b+'#inscription='+s+'" referrerpolicy="unsafe-url" allow="autoplay; fullscreen" title="Tesseract"></iframe>');
</script>
<div id=mpz title="Marketplace"></div>
<div id=mph></div>
<div id=mpx>
  <b>TESSERACT&nbsp;MP</b>
  <input id=mpu readonly value="https://ordinals.com/content/${TESSERACT_MARKETPLACE_INSCRIPTION_ID}">
  <button id=mpc title="Copy link">COPY</button>
  <a id=mpo href="https://ordinals.com/content/${TESSERACT_MARKETPLACE_INSCRIPTION_ID}" target="_blank" rel="noopener noreferrer">OPEN &rarr;</a>
  <button id=mpx_ class=x title="Dismiss">&times;</button>
</div>
<script>
(function(){
  var z=document.getElementById('mpz'),h=document.getElementById('mph'),
      p=document.getElementById('mpx'),u=document.getElementById('mpu'),
      c=document.getElementById('mpc'),o=document.getElementById('mpo'),
      x=document.getElementById('mpx_'),t=0,HIDE=4500;
  function show(){p.classList.add('on');h.classList.add('gone');clearTimeout(t);t=setTimeout(hide,HIDE)}
  function hide(){p.classList.remove('on');h.classList.remove('gone');clearTimeout(t)}
  function poke(){if(p.classList.contains('on')){clearTimeout(t);t=setTimeout(hide,HIDE)}}
  z.addEventListener('click',function(e){e.stopPropagation();show()});
  z.addEventListener('touchstart',function(e){e.stopPropagation();show()},{passive:true});
  ['mousemove','keydown','touchstart','click'].forEach(function(ev){p.addEventListener(ev,poke)});
  document.addEventListener('click',function(e){
    if(p.contains(e.target)||z.contains(e.target))return;
    if(p.classList.contains('on'))hide();
  },true);
  u.addEventListener('focus',function(){u.select()});
  u.addEventListener('click',function(){u.select()});
  c.addEventListener('click',async function(e){
    e.stopPropagation();var ok=false,v=u.value;
    try{await navigator.clipboard.writeText(v);ok=true}catch(_){}
    if(!ok){try{u.select();u.setSelectionRange(0,v.length);ok=document.execCommand('copy')}catch(_){}}
    c.textContent=ok?'COPIED':'PRESS Ctrl+C';
    clearTimeout(t);t=setTimeout(function(){c.textContent='COPY';hide()},2200);
  });
  o.addEventListener('click',function(e){e.stopPropagation();poke()});
  x.addEventListener('click',function(e){e.stopPropagation();hide()});
})();
</script>
`;

/**
 * Baut den per-Mint TESSERACT-Wrapper. Eindeutigkeit pro Mint kommt aus
 * drei Quellen:
 *   1. Engine-Seed: deterministisch aus der eigenen Inscription-ID
 *      (Pathname `/content/<id>` → `#inscription=<id>` an iframe).
 *   2. Provenance-Metadaten: HTML <meta>-Tags identifizieren Collection +
 *      Edition-Nummer maschinenlesbar, ohne sichtbares Element im Bild.
 *   3. Marketplace-Overlay: ein on-tap einblendbares MP-Panel mit Link
 *      zur on-chain TESSERACT Marketplace Inscription. Standardmäßig
 *      versteckt — das Bild bleibt clean, bis jemand auf die untere
 *      Edge-Zone tippt.
 *
 * Edition-Nummer wird auf 4-stellig zero-padded (`0001`–`1000`), damit
 * die Byte-Länge des Wrappers über alle Editionen identisch bleibt.
 */
export const buildTesseractWrapper = (editionNumber: number): string => {
  const ed = padEdition(editionNumber);
  return TESSERACT_WRAPPER_TEMPLATE.replace(/__EDITION__/g, ed);
};

/**
 * Erwartete Byte-Länge eines per-Mint Wrappers (UTF-8, ASCII-only).
 * Konstant über alle Editionen, weil die Edition-Nummer auf 4 Stellen
 * zero-padded wird. Wird vom Mint-Service gegen den tatsächlich gebauten
 * String geprüft (Runtime-Guard gegen versehentliche Modifikationen).
 *
 * Wert wird beim Modul-Import einmalig berechnet — alle Editionen müssen
 * exakt identisch lang sein, sonst schlägt der Mint-Guard im Service an.
 */
export const TESSERACT_WRAPPER_BYTES = buildTesseractWrapper(TESSERACT_EDITION_LIMIT).length;

/**
 * @deprecated Bitte buildTesseractWrapper(editionNumber) verwenden — der
 * statische Wrapper ist nur noch ein Default-Build (Edition 0000) für
 * Komponenten, die keinen Counter kennen (z. B. Vorschau-Cards).
 *
 * Aufrufer, die echte Mints inscriben, MÜSSEN buildTesseractWrapper mit
 * der echten Edition aufrufen — sonst bekommt jeder Mint identische
 * Provenance-Tags.
 */
export const TESSERACT_WRAPPER_HTML = buildTesseractWrapper(0);
