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
  '918c258a61b8eb7c00ee5b04f3e0637377dd7cd8ec4035d087d109cda68072d6i0';

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
 * dieser marketplace-aware: er rendert eine sichtbare cyan-pulsierende
 * "◆ MP"-Pill in der unteren rechten Ecke, die nach kurzer Intro-Phase
 * (6 s) auf einen subtilen Hint herunterdimmt. Hover/Touch holt sie
 * zurück, Click slidet das eigentliche Marketplace-Panel rein (URL,
 * COPY, OPEN-Link). Auto-Hide nach 5 s ohne Interaktion.
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
  /* Visible MP trigger.  Sits in the bottom-right corner above the
     iframe so it's always tappable even though the iframe eats every
     other click.  Cyan pulsing pill -- subtle but unmistakable. */
  #mpz{position:fixed;right:14px;bottom:14px;z-index:60;
       padding:7px 11px;cursor:pointer;
       font:9px/1 ui-monospace,'Cascadia Code',Consolas,'Courier New',monospace;
       letter-spacing:.22em;color:#00ffd5;font-weight:700;
       background:rgba(3,3,8,.70);border:1px solid rgba(0,255,213,.55);
       border-radius:3px;backdrop-filter:blur(6px);
       -webkit-backdrop-filter:blur(6px);
       text-shadow:0 0 8px rgba(0,255,213,.55);
       box-shadow:0 0 14px rgba(0,255,213,.20),0 0 28px rgba(255,0,170,.10);
       text-transform:uppercase;user-select:none;
       animation:mpz-pulse 2.4s ease-in-out infinite;
       transition:opacity .25s,transform .15s,background .15s,box-shadow .15s}
  #mpz:hover,#mpz.dim:hover{opacity:1;background:rgba(0,255,213,.18);
       box-shadow:0 0 18px rgba(0,255,213,.45),0 0 36px rgba(255,0,170,.18)}
  #mpz:active{transform:scale(.96)}
  #mpz::before{content:'\\25CF';margin-right:6px;color:#ff00aa;
       text-shadow:0 0 6px rgba(255,0,170,.65);font-size:7px;
       vertical-align:middle;animation:mpz-blink 1.4s steps(2) infinite}
  /* dim state -- fades to a subtle hint after a few seconds of idle. */
  #mpz.dim{opacity:.12;animation:none;
       box-shadow:0 0 8px rgba(0,255,213,.10);
       transition:opacity 1.2s ease, box-shadow .6s}
  #mpz.gone{opacity:0;pointer-events:none}
  @keyframes mpz-pulse{
    0%,100%{box-shadow:0 0 14px rgba(0,255,213,.20),0 0 28px rgba(255,0,170,.10)}
    50%{box-shadow:0 0 22px rgba(0,255,213,.45),0 0 44px rgba(255,0,170,.20)}}
  @keyframes mpz-blink{50%{opacity:.25}}
  /* Floating marketplace panel.  Slides up from bottom-right above the
     trigger.  Auto-hides after a few seconds of no interaction.
     Iframe-safe: shows the URL inline so the user can copy it even
     when popups / target=_blank are blocked. */
  #mpx{position:fixed;right:14px;bottom:14px;z-index:99;
       transform:translateY(8px);
       display:flex;align-items:center;gap:8px;padding:8px 11px;
       background:rgba(3,3,8,.86);border:1px solid #00ffd5;border-radius:3px;
       backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
       box-shadow:0 0 18px rgba(0,255,213,.18),0 0 36px rgba(255,0,170,.10);
       font:10px/1 ui-monospace,'Cascadia Code',Consolas,'Courier New',monospace;
       color:#e8fff7;letter-spacing:.14em;text-transform:uppercase;
       max-width:calc(100vw - 28px);box-sizing:border-box;
       opacity:0;visibility:hidden;pointer-events:none;
       transition:opacity .22s,transform .22s,visibility 0s linear .22s}
  #mpx.on{opacity:1;visibility:visible;pointer-events:auto;
       transform:translateY(0);
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
</style>
<body>
<script>
var b="${TESSERACT_PARENT_INSCRIPTION_ID}",
    p=location.pathname.split("/").pop()||"",
    s=/^[0-9a-f]{64}i\\d+$/i.test(p)?p:b;
document.write('<iframe src="/content/'+b+'#inscription='+s+'" referrerpolicy="unsafe-url" allow="autoplay; fullscreen" title="Tesseract"></iframe>');
</script>
<div id=mpz title="Open marketplace">&#9670; MP</div>
<div id=mpx>
  <b>TESSERACT&nbsp;MP</b>
  <input id=mpu readonly value="https://ordinals.com/content/${TESSERACT_MARKETPLACE_INSCRIPTION_ID}">
  <button id=mpc title="Copy link">COPY</button>
  <a id=mpo href="https://ordinals.com/content/${TESSERACT_MARKETPLACE_INSCRIPTION_ID}" target="_blank" rel="noopener noreferrer">OPEN &rarr;</a>
  <button id=mpx_ class=x title="Dismiss">&times;</button>
</div>
<script>
(function(){
  var z=document.getElementById('mpz'),
      p=document.getElementById('mpx'),u=document.getElementById('mpu'),
      c=document.getElementById('mpc'),o=document.getElementById('mpo'),
      x=document.getElementById('mpx_'),
      t=0,    /* panel auto-hide timer */
      dt=0,   /* trigger pill dim timer */
      HIDE=5000,         /* panel idle timeout */
      INTRO=6000,        /* pill stays full-bright on load */
      DIM_AFTER=4500;    /* pill dims after this much idle */
  function show(){p.classList.add('on');z.classList.add('gone');
                  clearTimeout(t);t=setTimeout(hide,HIDE)}
  function hide(){p.classList.remove('on');z.classList.remove('gone');
                  clearTimeout(t);bumpPill()}
  function poke(){if(p.classList.contains('on')){
                    clearTimeout(t);t=setTimeout(hide,HIDE)}}
  /* Pill idle/dim management.  Show full-bright, then fade after
     idle.  Any hover/touch on the pill brings it back. */
  function bumpPill(){
    z.classList.remove('dim');
    clearTimeout(dt);
    dt=setTimeout(function(){z.classList.add('dim')},DIM_AFTER);
  }
  function dimNow(){clearTimeout(dt);z.classList.add('dim')}
  z.addEventListener('mouseenter',bumpPill);
  z.addEventListener('mousemove',bumpPill);
  z.addEventListener('touchstart',bumpPill,{passive:true});
  z.addEventListener('mouseleave',function(){
    clearTimeout(dt);dt=setTimeout(dimNow,1500);
  });
  /* Initial intro -- keep pill bright for a longer first window so
     the user actually notices it before it fades to ambient. */
  clearTimeout(dt);dt=setTimeout(dimNow,INTRO);
  z.addEventListener('click',function(e){e.stopPropagation();show()});
  z.addEventListener('touchstart',function(e){e.stopPropagation();show()},{passive:true});
  ['mousemove','keydown','touchstart','click'].forEach(function(ev){p.addEventListener(ev,poke)});
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
