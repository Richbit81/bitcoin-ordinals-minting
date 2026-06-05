import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { SIGNAL_PREVIEW_SRCDOC } from '../constants/signalInscription';
import { TESSERACT_PARENT_INSCRIPTION_ID } from '../constants/tesseractInscription';
import { RUNNER_PREVIEW_INSCRIPTION_ID } from '../constants/runnerInscription';

/**
 * AUTONOMOUS CULTURAL SYSTEMS ON BITCOIN
 *
 * Künstlerische Visitenkarten-Landingpage für die ART Basel (QR-Code-Ziel).
 * Bewusst full-bleed, ohne globalen Header/Bottom-Nav (siehe App.tsx) — die
 * Seite soll sich wie der Eingang in ein Kunstwerk anfühlen, nicht wie
 * Marketing. Jede Kachel zeigt eine LIVE on-chain Inscription (iframe) und
 * lässt sich per "ENTER" als Vollbild-Erlebnis öffnen.
 */

const GAVS_INSCRIPTION_ID =
  '927bdb131b4487f730fa500759d9d5fe80762b8ca52b0d1709930df038fc9303i0';
// Konkrete SIGNAL-Mint-Inscription für den "on-chain"-Link (vom Nutzer angegeben).
const SIGNAL_ONCHAIN_INSCRIPTION_ID =
  'abe2a1ee14c9aa769601904c26c58444ba4ebba0a6a885432386bf0e29d10532i0';
const BITCOIN_MIXTAPE_INSCRIPTION_ID =
  'a346945c962d4c9f25ca8a5bea7cfd4de3bc8665f0640d8991df6137878d2ee0i0';

type Project = {
  key: string;
  name: string;
  tagline: string;
  /** Renderbare Inscription-ID für die Live-Vorschau via /content. */
  inscriptionId?: string;
  /** Alternativ: fertiges srcDoc (z.B. SIGNAL Preview). */
  srcDoc?: string;
  /** ID für den "on-chain"-Link (falls abweichend von der Vorschau). */
  onchainId: string;
  /** Kurze Erklärung, wie die Chain das Werk erzeugt. */
  chainNote?: string;
  /** Tap-to-shuffle auf Touch-Geräten (simuliert die "R"-Taste). */
  tapShuffle?: boolean;
};

const PROJECTS: Project[] = [
  {
    key: 'tesseract',
    name: 'TESSERACT',
    tagline: 'Network-reactive audiovisual system',
    inscriptionId: TESSERACT_PARENT_INSCRIPTION_ID,
    onchainId: TESSERACT_PARENT_INSCRIPTION_ID,
    chainNote: 'Reads live network state — the work keeps evolving with the chain.',
    tapShuffle: true,
  },
  {
    key: 'signal',
    name: 'SIGNAL',
    tagline: 'Recursive generative art engine',
    srcDoc: SIGNAL_PREVIEW_SRCDOC,
    onchainId: SIGNAL_ONCHAIN_INSCRIPTION_ID,
    chainNote: 'Reads its own block height & sat rarity — rare sats unlock exclusive palettes.',
    tapShuffle: true,
  },
  {
    key: 'runner',
    name: 'RUNNER',
    tagline: 'Generative on-chain motion',
    inscriptionId: RUNNER_PREVIEW_INSCRIPTION_ID,
    onchainId: RUNNER_PREVIEW_INSCRIPTION_ID,
    chainNote: 'Deterministic motion, seeded by its own inscription ID.',
    tapShuffle: true,
  },
  {
    key: 'gavs',
    name: 'GAVS',
    tagline: 'Generative audio-visual system',
    inscriptionId: GAVS_INSCRIPTION_ID,
    onchainId: GAVS_INSCRIPTION_ID,
    chainNote: 'Nine generative operators compose endless audio-visual variations.',
  },
  {
    key: 'mixtape',
    name: 'BITCOIN MIXTAPE',
    tagline: 'Living on-chain music archive',
    inscriptionId: BITCOIN_MIXTAPE_INSCRIPTION_ID,
    onchainId: BITCOIN_MIXTAPE_INSCRIPTION_ID,
    chainNote: 'An evolving archive — tracks & covers fully stored on Bitcoin.',
  },
];

const ordContentUrl = (id: string) => `https://ordinals.com/content/${id}`;
const ordExplorerUrl = (id: string) => `https://ordinals.com/inscription/${id}`;
const randomInscriptionId = () => {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 64; i++) s += hex[(Math.random() * 16) | 0];
  return `${s}i0`;
};
const shortId = (id: string) =>
  id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-5)}` : id;
const ACS_URL = 'https://www.richart.app/acs';

function ProjectFrame({
  project,
  title,
  loadingHint = false,
  autoFocus = false,
}: {
  project: Project;
  title: string;
  loadingHint?: boolean;
  autoFocus?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLIFrameElement | null>(null);

  // Tap-to-shuffle (Touch): simuliert "R". Gleicher Origin (srcDoc) → echtes
  // keydown-Event ins iframe. Fremder Origin → Neustart mit Zufalls-Seed.
  const shuffle = () => {
    const el = ref.current;
    if (!el) return;
    try {
      const win = el.contentWindow as (Window & typeof globalThis) | null;
      if (!win) throw new Error('no window');
      const doc = win.document; // wirft bei cross-origin
      const mk = () => {
        const ev = new KeyboardEvent('keydown', {
          key: 'r',
          code: 'KeyR',
          bubbles: true,
        });
        try {
          Object.defineProperty(ev, 'keyCode', { get: () => 82 });
          Object.defineProperty(ev, 'which', { get: () => 82 });
        } catch {
          /* ignore */
        }
        return ev;
      };
      win.dispatchEvent(mk());
      doc.dispatchEvent(mk());
      return;
    } catch {
      /* cross-origin: über neuen Seed neu laden */
    }
    if (project.inscriptionId) {
      setLoaded(false);
      // Wichtig: eine reine Hash-Änderung lädt das iframe NICHT neu. Daher
      // erzwingen wir das Neuladen über einen Cache-Bust-Query (?s=...) und
      // geben zusätzlich einen frischen Seed im Hash mit (#inscription=...).
      const seed = randomInscriptionId();
      const bust = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
      el.src = `${ordContentUrl(project.inscriptionId)}?s=${bust}#inscription=${seed}`;
    }
  };

  const common = {
    className: `acs-frame ${loaded ? 'is-loaded' : ''}`,
    title,
    loading: 'lazy' as const,
    referrerPolicy: 'no-referrer' as const,
    sandbox: 'allow-scripts allow-same-origin',
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
    onLoad: () => {
      setLoaded(true);
      // Vollbild: Werk direkt fokussieren, damit Tastatur-Controls (T, R, …) greifen.
      if (autoFocus) {
        try {
          ref.current?.focus();
        } catch {
          /* cross-origin focus ist erlaubt; Fehler ignorieren */
        }
      }
    },
  };

  return (
    <>
      {loadingHint && !loaded && (
        <div className="acs-frame-loading">
          <span className="acs-spin" />
        </div>
      )}
      {project.srcDoc ? (
        <iframe ref={ref} {...common} srcDoc={project.srcDoc} />
      ) : (
        <iframe ref={ref} {...common} src={ordContentUrl(project.inscriptionId as string)} />
      )}
      {project.tapShuffle && (
        <button
          type="button"
          className="acs-shuffle"
          onClick={shuffle}
          aria-label={`Shuffle ${project.name}`}
          title="Shuffle (new variation)"
        >
          <span className="acs-shuffle-ico">⟳</span>
          <span className="acs-shuffle-txt">SHUFFLE</span>
        </button>
      )}
    </>
  );
}

/**
 * Echter Tesseract (4-Würfel): 16 Ecken (alle ±1 in 4 Dimensionen), 32 Kanten.
 * Wird in 4D rotiert (XW- und YZ-Ebene = klassische „nach innen stülpende"
 * Hypercube-Bewegung), dann 4D→3D→2D perspektivisch projiziert und auf einen
 * Canvas gezeichnet. Äußerer Würfel cyan, innerer magenta, Verbindungskanten
 * dazwischen verblendet.
 */
function Tesseract() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 168;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // 16 Ecken des 4-Würfels.
    const verts: number[][] = [];
    for (let i = 0; i < 16; i++) {
      verts.push([
        i & 1 ? 1 : -1,
        i & 2 ? 1 : -1,
        i & 4 ? 1 : -1,
        i & 8 ? 1 : -1,
      ]);
    }
    // Kanten: Ecken, die sich in genau einer Koordinate unterscheiden.
    const edges: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        const d = i ^ j;
        if ((d & (d - 1)) === 0) edges.push([i, j]);
      }
    }

    const rot = (p: number[], a: number, b: number, ang: number) => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const pa = p[a];
      const pb = p[b];
      p[a] = pa * c - pb * s;
      p[b] = pa * s + pb * c;
    };

    const center = SIZE / 2;
    const scale = 58;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;
    let mx = 0;
    let my = 0;
    let tmx = 0;
    let tmy = 0;

    const project = (v: number[]) => {
      const p = v.slice();
      rot(p, 1, 3, my * 0.8); // pointer/gyro -> y-w
      rot(p, 0, 2, mx * 0.8); // pointer/gyro -> x-z
      rot(p, 0, 3, t); // x-w
      rot(p, 1, 2, t * 0.72); // y-z
      rot(p, 0, 1, t * 0.4); // x-y
      const w4 = 1 / (3.2 - p[3]); // 4D -> 3D
      const x3 = p[0] * w4;
      const y3 = p[1] * w4;
      const z3 = p[2] * w4;
      const w3 = 1 / (3.0 - z3); // 3D -> 2D
      return { x: center + x3 * scale * w3 * 2.0, y: center + y3 * scale * w3 * 2.0 };
    };

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.lineWidth = 1.15;
      const pts = verts.map(project);
      for (const [i, j] of edges) {
        const inner = verts[i][3] < 0 && verts[j][3] < 0;
        const outer = verts[i][3] > 0 && verts[j][3] > 0;
        let color = 'rgba(120,200,220,0.45)';
        if (inner) color = 'rgba(255,45,160,0.9)';
        else if (outer) color = 'rgba(0,255,213,0.85)';
        ctx.strokeStyle = color;
        ctx.shadowColor = inner ? 'rgba(255,45,160,0.6)' : 'rgba(0,255,213,0.55)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    };

    if (reduce) {
      t = 0.6;
      draw();
      return;
    }

    const onMove = (e: PointerEvent) => {
      tmx = (e.clientX / window.innerWidth - 0.5) * 2;
      tmy = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tmx = Math.max(-1, Math.min(1, e.gamma / 45));
      tmy = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onOrient);

    const loop = () => {
      t += 0.011;
      mx += (tmx - mx) * 0.06;
      my += (tmy - my) * 0.06;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onOrient);
    };
  }, []);

  return <canvas ref={ref} className="acs-tess-canvas" aria-hidden="true" />;
}

/** QR-Code für richart.app/acs — offline gerendert (qrcode), kein Drittanbieter. */
function QrTile({ url }: { url: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, url, {
      width: 200,
      margin: 1,
      color: { dark: '#040406', light: '#f4f3ef' },
      errorCorrectionLevel: 'M',
    }).catch(() => {});
  }, [url]);
  return <canvas ref={ref} className="acs-qr-canvas" aria-label="QR code to richart.app/acs" />;
}

export function ArtBaselPage() {
  const [active, setActive] = useState<Project | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootFade, setBootFade] = useState(false);
  const [block, setBlock] = useState<number | null>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'AUTONOMOUS CULTURAL SYSTEMS ON BITCOIN — Richart';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Boot-Sequenz: kurzer Terminal-Intro, dann ausblenden ("enter the system").
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const t1 = window.setTimeout(() => setBootFade(true), 2300);
    const t2 = window.setTimeout(() => {
      setBooting(false);
      document.body.style.overflow = '';
    }, 2900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      document.body.style.overflow = '';
    };
  }, []);

  // Live Bitcoin block height (mempool.space, CORS-fähig).
  useEffect(() => {
    let alive = true;
    const fetchBlock = async () => {
      try {
        const r = await fetch('https://mempool.space/api/blocks/tip/height');
        if (!r.ok) return;
        const n = parseInt((await r.text()).trim(), 10);
        if (alive && !Number.isNaN(n)) setBlock(n);
      } catch {
        /* offline / blocked — ticker zeigt dann nur "MAINNET" */
      }
    };
    fetchBlock();
    const iv = window.setInterval(fetchBlock, 30000);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, []);

  // Scroll-Reveal: Werke & Karten faden beim Sichtbarwerden ein.
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>('.acs-root .acs-reveal'),
    );
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const skipBoot = () => {
    setBootFade(true);
    window.setTimeout(() => {
      setBooting(false);
      document.body.style.overflow = '';
    }, 400);
  };

  // ESC schließt das Vollbild-Erlebnis.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);

  return (
    <div className="acs-root">
      <style>{ACS_STYLES}</style>

      {/* ---------------- BOOT SEQUENCE ---------------- */}
      {booting && (
        <div
          className={`acs-boot ${bootFade ? 'is-out' : ''}`}
          onClick={skipBoot}
          role="button"
          aria-label="Skip intro"
        >
          <div className="acs-boot-log">
            <span>&gt; initializing system</span>
            <span>&gt; connecting to bitcoin mainnet</span>
            <span>&gt; loading autonomous cultural systems</span>
            <span className="ok">&gt; access granted</span>
          </div>
        </div>
      )}

      {/* Live Bitcoin block ticker */}
      <div className="acs-ticker" aria-hidden="true">
        <span className="acs-ticker-dot" />
        BITCOIN MAINNET
        {block != null && <>&nbsp;·&nbsp;BLOCK&nbsp;{block.toLocaleString('en-US')}</>}
      </div>

      {/* Ambient background */}
      <div className="acs-bg" aria-hidden="true">
        <div className="acs-bg-grid" />
        <div className="acs-bg-glow acs-bg-glow-a" />
        <div className="acs-bg-glow acs-bg-glow-b" />
        <div className="acs-noise" />
      </div>

      {/* ---------------- HERO ---------------- */}
      <header className="acs-hero">
        <div className="acs-tesseract" aria-hidden="true">
          <Tesseract />
        </div>

        <p className="acs-kicker">A Bitcoin-native art system</p>
        <h1 className="acs-title">
          <span>AUTONOMOUS</span>
          <span>CULTURAL SYSTEMS</span>
          <span className="acs-title-accent">ON BITCOIN</span>
        </h1>
        <p className="acs-sub">
          Generative art, music, games and evolving digital artifacts —
          fully embedded on Bitcoin.
        </p>
        <a className="acs-enter-hint" href="#works">
          ↓ enter the system
        </a>
      </header>

      {/* ---------------- STATEMENT ---------------- */}
      <section className="acs-statement">
        <span className="acs-eyebrow">Bitcoin as artistic material</span>
        <h2 className="acs-st-title">THE CHAIN IS THE ARTIST</h2>
        <p className="acs-st-lead">
          Generative art is made by systems, not by hand. An algorithm — given a
          seed — composes the work, so every output is unique and unrepeatable.
        </p>
        <p className="acs-st-body">
          These pieces are not images stored on a chain. They are programs,
          inscribed as Ordinals, that run in your browser and read their own
          on-chain context: the inscription ID becomes the seed, while block
          height and the rarity of the sat they live on reshape colour, motion
          and sound. The blockchain stops being a ledger — it becomes the medium,
          and the co-author.
        </p>

        <div className="acs-st-grid">
          <div className="acs-st-card acs-reveal">
            <h4>TESSERACT</h4>
            <p>
              A network-reactive audiovisual system. It responds to live network
              state, so the work never freezes — it keeps evolving with the chain
              it lives on.
            </p>
          </div>
          <div className="acs-st-card acs-reveal">
            <h4>SIGNAL</h4>
            <p>
              A recursive generative engine. Each mint reads block height and sat
              rarity through recursive endpoints; rare, epic, legendary and mythic
              sats unlock exclusive palettes. The artwork knows where it lives.
            </p>
          </div>
          <div className="acs-st-card acs-reveal">
            <h4>GAVS</h4>
            <p>
              A generative audio-visual system. Nine operators blend art and music
              into endless, deterministic compositions — every play a new state of
              the same on-chain organism.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- WORKS ---------------- */}
      <main id="works" className="acs-works">
        <div className="acs-works-head">
          <span className="acs-line" />
          <h2>SELECTED WORKS</h2>
          <span className="acs-line" />
        </div>

        <div className="acs-grid">
          {PROJECTS.map((p, i) => (
            <article
              key={p.key}
              className={`acs-card acs-reveal ${i === 0 ? 'acs-card-feature' : ''}`}
            >
              <div className="acs-card-stage">
                <ProjectFrame project={p} title={p.name} loadingHint />
                <button
                  type="button"
                  className="acs-card-enter"
                  onClick={() => setActive(p)}
                  aria-label={`Enter ${p.name} fullscreen`}
                >
                  ⤢ FULLSCREEN
                </button>
              </div>
              <div className="acs-card-meta">
                <div className="acs-card-text">
                  <h3>{p.name}</h3>
                  <p>{p.tagline}</p>
                  {p.chainNote && <span className="acs-card-chain">{p.chainNote}</span>}
                </div>
                <a
                  className="acs-onchain"
                  href={ordContentUrl(p.onchainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  on-chain ↗
                </a>
              </div>
              <div className="acs-card-facts">
                <span className="acs-badge">100% ON-CHAIN</span>
                <code className="acs-fact-id">{shortId(p.onchainId)}</code>
                <a
                  className="acs-explorer"
                  href={ordExplorerUrl(p.onchainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  explorer ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="acs-footer">
        <div className="acs-qr">
          <QrTile url={ACS_URL} />
          <span className="acs-qr-label">SCAN TO ENTER · richart.app/acs</span>
        </div>
        <p className="acs-footer-line">THIS ARTWORK LIVES ON BITCOIN</p>
        <div className="acs-footer-links">
          <a href="https://x.com/richbi11" target="_blank" rel="noopener noreferrer">
            X · @richbi11
          </a>
          <a href="https://www.richart.app" target="_blank" rel="noopener noreferrer">
            richart.app
          </a>
        </div>
        <p className="acs-footer-sign">Created by Richart</p>
      </footer>

      {/* ---------------- FULLSCREEN EXPERIENCE ---------------- */}
      {active && (
        <div className="acs-overlay" role="dialog" aria-modal="true">
          <div className="acs-overlay-bar">
            <span className="acs-overlay-name">{active.name}</span>
            <span className="acs-overlay-tag">{active.tagline}</span>
            <a
              className="acs-overlay-link"
              href={ordContentUrl(active.onchainId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              on-chain ↗
            </a>
            <button
              type="button"
              className="acs-overlay-close"
              onClick={() => setActive(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="acs-overlay-stage">
            <ProjectFrame
              project={active}
              title={`${active.name} — fullscreen`}
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ArtBaselPage;

const ACS_STYLES = `
.acs-root{
  --bg:#040406; --ink:#f4f3ef; --dim:#8c8a86;
  --cyan:#00ffd5; --magenta:#ff2da0;
  position:relative; min-height:100vh; background:var(--bg); color:var(--ink);
  font-family:'Helvetica Neue',Inter,system-ui,-apple-system,sans-serif;
  overflow-x:hidden;
}
.acs-root *{box-sizing:border-box}

/* ---- ambient background ---- */
.acs-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.acs-bg-grid{position:absolute;inset:-2px;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
  background-size:64px 64px;
  mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 75%);
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 75%);}
.acs-bg-glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
.acs-bg-glow-a{top:-12%;left:-8%;width:46vw;height:46vw;
  background:radial-gradient(circle,rgba(0,255,213,.22),transparent 70%);
  animation:acs-float 22s ease-in-out infinite}
.acs-bg-glow-b{bottom:-14%;right:-10%;width:50vw;height:50vw;
  background:radial-gradient(circle,rgba(255,45,160,.18),transparent 70%);
  animation:acs-float 28s ease-in-out infinite reverse}
.acs-noise{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes acs-float{0%,100%{transform:translate(0,0)}50%{transform:translate(4%,5%)}}

/* ---- hero ---- */
.acs-hero{position:relative;z-index:2;min-height:100vh;display:flex;
  flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:96px 24px 64px;gap:18px}
.acs-tesseract{width:168px;height:168px;margin-bottom:10px;
  display:flex;align-items:center;justify-content:center}
.acs-tess-canvas{width:168px;height:168px;display:block}

.acs-kicker{margin:0;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;
  font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--cyan);
  opacity:0;animation:acs-rise .8s ease forwards .1s}
.acs-title{margin:0;display:flex;flex-direction:column;gap:.06em;
  font-weight:800;line-height:.94;letter-spacing:.02em;
  font-size:clamp(2.1rem,8.5vw,6.4rem);text-transform:uppercase}
.acs-title span{opacity:0;animation:acs-rise .9s cubic-bezier(.2,.7,.2,1) forwards}
.acs-title span:nth-child(1){animation-delay:.18s}
.acs-title span:nth-child(2){animation-delay:.30s}
.acs-title span:nth-child(3){animation-delay:.42s}
.acs-title-accent{
  background:linear-gradient(90deg,var(--cyan),var(--magenta));
  -webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 0 40px rgba(0,255,213,.25)}
.acs-sub{margin:8px 0 0;max-width:46ch;color:var(--dim);
  font-size:clamp(.95rem,1.6vw,1.15rem);line-height:1.6;
  opacity:0;animation:acs-rise .9s ease forwards .56s}
.acs-enter-hint{margin-top:26px;font-family:ui-monospace,Consolas,monospace;
  font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--dim);
  text-decoration:none;opacity:0;animation:acs-rise .9s ease forwards .7s,acs-bob 2.4s ease-in-out infinite 1.6s}
.acs-enter-hint:hover{color:var(--ink)}
@keyframes acs-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes acs-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}

/* ---- boot sequence ---- */
.acs-boot{position:fixed;inset:0;z-index:200;background:#040406;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:opacity .5s ease}
.acs-boot.is-out{opacity:0;pointer-events:none}
.acs-boot-log{font-family:ui-monospace,'Cascadia Code',Consolas,monospace;
  font-size:clamp(11px,2.6vw,15px);line-height:2.1;color:var(--cyan);
  letter-spacing:.12em;text-align:left;text-shadow:0 0 10px rgba(0,255,213,.45)}
.acs-boot-log span{display:block;opacity:0;animation:acs-type .45s ease forwards}
.acs-boot-log span:nth-child(1){animation-delay:.15s}
.acs-boot-log span:nth-child(2){animation-delay:.65s}
.acs-boot-log span:nth-child(3){animation-delay:1.15s}
.acs-boot-log span:nth-child(4){animation-delay:1.7s}
.acs-boot-log .ok{color:var(--ink)}
.acs-boot-log .ok::after{content:'_';margin-left:5px;color:var(--cyan);
  animation:acs-blink 1s steps(2) infinite}
@keyframes acs-type{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}

/* ---- block ticker ---- */
.acs-ticker{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;
  display:flex;align-items:center;gap:8px;pointer-events:none;
  font-family:ui-monospace,Consolas,monospace;font-size:10px;letter-spacing:.24em;
  text-transform:uppercase;color:var(--dim);
  background:rgba(4,4,8,.5);border:1px solid rgba(255,255,255,.08);
  border-radius:999px;padding:6px 14px;backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);white-space:nowrap}
.acs-ticker-dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);
  box-shadow:0 0 8px var(--cyan);animation:acs-blink 1.6s ease-in-out infinite}
@keyframes acs-blink{50%{opacity:.3}}

/* ---- scroll reveal ---- */
.acs-reveal{opacity:0;transform:translateY(28px);
  transition:opacity .75s ease,transform .75s cubic-bezier(.2,.7,.2,1)}
.acs-reveal.is-in{opacity:1;transform:none}

/* ---- statement ---- */
.acs-statement{position:relative;z-index:2;max-width:860px;margin:0 auto;
  padding:30px 22px 20px;text-align:center}
.acs-eyebrow{display:inline-block;font-family:ui-monospace,Consolas,monospace;
  font-size:11px;letter-spacing:.38em;text-transform:uppercase;color:var(--cyan);
  margin-bottom:14px}
.acs-st-title{margin:0 0 22px;font-size:clamp(1.6rem,4.4vw,2.8rem);font-weight:800;
  letter-spacing:.04em;text-transform:uppercase;
  background:linear-gradient(90deg,var(--ink),#b9b7b2);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.acs-st-lead{margin:0 auto 16px;max-width:60ch;font-size:clamp(1.05rem,2vw,1.32rem);
  line-height:1.55;color:var(--ink)}
.acs-st-body{margin:0 auto;max-width:64ch;font-size:1rem;line-height:1.72;
  color:var(--dim)}
.acs-st-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;
  margin-top:46px;text-align:left}
.acs-st-card{border:1px solid rgba(255,255,255,.08);border-radius:4px;
  padding:20px 18px;background:rgba(10,10,14,.45);
  transition:border-color .3s,transform .3s}
.acs-st-card:hover{border-color:rgba(0,255,213,.4);transform:translateY(-2px)}
.acs-st-card h4{margin:0 0 9px;font-size:.82rem;letter-spacing:.24em;
  color:var(--cyan);font-weight:700}
.acs-st-card p{margin:0;font-size:.86rem;line-height:1.62;color:var(--dim)}

/* ---- works ---- */
.acs-works{position:relative;z-index:2;max-width:1180px;margin:0 auto;
  padding:40px 22px 90px}
.acs-works-head{display:flex;align-items:center;gap:18px;margin-bottom:38px}
.acs-works-head h2{margin:0;font-family:ui-monospace,Consolas,monospace;
  font-size:12px;letter-spacing:.4em;color:var(--dim);text-transform:uppercase;
  white-space:nowrap}
.acs-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)}

.acs-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
.acs-card{position:relative;border:1px solid rgba(255,255,255,.09);
  background:rgba(10,10,14,.55);border-radius:4px;overflow:hidden;
  backdrop-filter:blur(4px);transition:border-color .3s,transform .3s,box-shadow .3s}
.acs-card:hover{border-color:rgba(0,255,213,.45);transform:translateY(-3px);
  box-shadow:0 18px 50px -20px rgba(0,255,213,.35)}
.acs-card-feature{grid-column:1 / -1}
.acs-card-stage{position:relative;width:100%;aspect-ratio:16/10;background:#000;overflow:hidden}
.acs-card-feature .acs-card-stage{aspect-ratio:21/9}
.acs-frame{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;
  background:#000;opacity:0;transition:opacity .5s ease;transform:translateZ(0)}
.acs-frame.is-loaded{opacity:1}
.acs-frame-loading{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;background:#000}
.acs-spin{width:30px;height:30px;border-radius:50%;
  border:2px solid rgba(0,255,213,.25);border-top-color:var(--cyan);
  animation:acs-rot .9s linear infinite}
@keyframes acs-rot{to{transform:rotate(360deg)}}

.acs-card-enter{position:absolute;top:10px;right:10px;z-index:3;cursor:pointer;
  font-family:ui-monospace,Consolas,monospace;font-size:10px;letter-spacing:.2em;
  color:#000;background:var(--cyan);border:0;padding:7px 12px;border-radius:3px;
  font-weight:700;box-shadow:0 0 18px rgba(0,255,213,.45);
  opacity:0;transform:translateY(-4px);transition:opacity .25s,transform .25s,box-shadow .2s}
.acs-card:hover .acs-card-enter,.acs-card-enter:focus-visible{opacity:1;transform:none}
.acs-card-enter:hover{box-shadow:0 0 26px rgba(0,255,213,.7)}

/* shuffle button — kleiner Ecken-Button, lässt das Werk selbst bedienbar
   (SPIN/MUTE/? funktionieren auf Touch). Desktop: erscheint beim Hover;
   Touch & Vollbild: dauerhaft sichtbar. */
.acs-shuffle{position:absolute;top:10px;left:10px;z-index:4;cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;
  font-family:ui-monospace,Consolas,monospace;font-size:10px;letter-spacing:.2em;
  color:#000;background:var(--cyan);border:0;padding:7px 11px;border-radius:3px;
  font-weight:700;box-shadow:0 0 16px rgba(0,255,213,.4);
  opacity:0;transform:translateY(-4px);
  transition:opacity .25s,transform .25s,box-shadow .2s}
.acs-shuffle-ico{font-size:12px;line-height:1}
.acs-card:hover .acs-shuffle,.acs-shuffle:focus-visible{opacity:.95;transform:none}
.acs-shuffle:hover{opacity:1;box-shadow:0 0 24px rgba(0,255,213,.7)}
.acs-shuffle:active{transform:scale(.95)}
.acs-overlay-stage .acs-shuffle{opacity:.95;transform:none}
@media (pointer:coarse){.acs-shuffle{opacity:.95;transform:none}}

.acs-card-meta{display:flex;align-items:center;justify-content:space-between;
  gap:14px;padding:16px 18px}
.acs-card-text h3{margin:0;font-size:1.05rem;letter-spacing:.16em;font-weight:700}
.acs-card-text p{margin:4px 0 0;font-size:.82rem;color:var(--dim);letter-spacing:.02em}
.acs-card-chain{display:block;margin-top:8px;font-size:.74rem;line-height:1.5;
  color:rgba(0,255,213,.78);letter-spacing:.02em;max-width:52ch}
.acs-onchain{flex:none;font-family:ui-monospace,Consolas,monospace;font-size:10px;
  letter-spacing:.2em;text-transform:uppercase;color:var(--cyan);
  text-decoration:none;border:1px solid rgba(0,255,213,.35);
  padding:7px 11px;border-radius:2px;transition:background .2s,box-shadow .2s}
.acs-onchain:hover{background:rgba(0,255,213,.12);box-shadow:0 0 16px rgba(0,255,213,.3)}
.acs-card-facts{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:0 18px 16px;margin-top:-2px}
.acs-badge{font-family:ui-monospace,Consolas,monospace;font-size:9px;
  letter-spacing:.16em;color:var(--cyan);border:1px solid rgba(0,255,213,.38);
  border-radius:999px;padding:3px 9px}
.acs-fact-id{font-family:ui-monospace,Consolas,monospace;font-size:10px;
  color:#6f6d69;letter-spacing:.04em}
.acs-explorer{margin-left:auto;font-family:ui-monospace,Consolas,monospace;
  font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);
  text-decoration:none;transition:color .2s}
.acs-explorer:hover{color:var(--cyan)}

/* ---- footer ---- */
.acs-footer{position:relative;z-index:2;text-align:center;padding:54px 22px 70px;
  border-top:1px solid rgba(255,255,255,.07)}
.acs-qr{display:flex;flex-direction:column;align-items:center;gap:12px;
  margin-bottom:36px}
.acs-qr-canvas{width:160px;height:160px;border-radius:6px;padding:10px;
  background:#f4f3ef;box-shadow:0 0 30px rgba(0,255,213,.18)}
.acs-qr-label{font-family:ui-monospace,Consolas,monospace;font-size:10px;
  letter-spacing:.26em;text-transform:uppercase;color:var(--dim)}
.acs-footer-line{margin:0 0 22px;font-family:ui-monospace,Consolas,monospace;
  font-size:11px;letter-spacing:.4em;color:var(--dim);text-transform:uppercase}
.acs-footer-links{display:flex;flex-wrap:wrap;gap:10px 26px;justify-content:center}
.acs-footer-links a{color:var(--ink);text-decoration:none;font-size:.9rem;
  letter-spacing:.08em;border-bottom:1px solid transparent;transition:border-color .2s,color .2s}
.acs-footer-links a:hover{color:var(--cyan);border-color:var(--cyan)}
.acs-footer-sign{margin:26px 0 0;font-size:.78rem;letter-spacing:.28em;
  color:#5a5854;text-transform:uppercase}

/* ---- fullscreen overlay ---- */
.acs-overlay{position:fixed;inset:0;z-index:100;background:#000;
  display:flex;flex-direction:column;animation:acs-fade .25s ease}
@keyframes acs-fade{from{opacity:0}to{opacity:1}}
.acs-overlay-bar{display:flex;align-items:center;gap:14px;padding:12px 16px;
  background:rgba(4,4,8,.92);border-bottom:1px solid rgba(0,255,213,.25)}
.acs-overlay-name{font-weight:700;letter-spacing:.18em;font-size:.95rem}
.acs-overlay-tag{color:var(--dim);font-size:.8rem;letter-spacing:.04em;
  flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acs-overlay-link{color:var(--cyan);text-decoration:none;
  font-family:ui-monospace,Consolas,monospace;font-size:10px;letter-spacing:.2em;
  text-transform:uppercase;border:1px solid rgba(0,255,213,.35);padding:7px 11px;border-radius:2px}
.acs-overlay-link:hover{background:rgba(0,255,213,.12)}
.acs-overlay-close{background:transparent;border:1px solid rgba(255,255,255,.2);
  color:var(--ink);width:34px;height:34px;border-radius:2px;cursor:pointer;
  font-size:14px;line-height:1;flex:none}
.acs-overlay-close:hover{border-color:var(--magenta);color:var(--magenta)}
.acs-overlay-stage{position:relative;flex:1;background:#000}

@media (max-width:720px){
  .acs-grid{grid-template-columns:1fr;gap:16px}
  .acs-st-grid{grid-template-columns:1fr;gap:12px;margin-top:32px}
  .acs-card-feature .acs-card-stage{aspect-ratio:16/10}
  .acs-card-enter{opacity:1;transform:none}
  .acs-card-meta{flex-wrap:wrap;gap:10px}
  .acs-onchain{margin-left:auto}
  .acs-overlay-tag{display:none}
  .acs-hero{padding:84px 20px 52px;min-height:92vh}
  .acs-title{font-size:clamp(1.85rem,9vw,3rem)}
  .acs-ticker{font-size:9px;letter-spacing:.16em;padding:5px 11px}
  .acs-statement{padding:24px 20px 12px}
  .acs-works{padding:30px 18px 70px}
}
@media (max-width:380px){
  .acs-title{font-size:7.6vw}
}
@media (prefers-reduced-motion:reduce){
  .acs-tesseract,.acs-bg-glow-a,.acs-bg-glow-b{animation:none}
  .acs-title span,.acs-kicker,.acs-sub,.acs-enter-hint{animation:none;opacity:1}
  .acs-reveal{opacity:1;transform:none;transition:none}
}
`;
