import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * "Art on Bitcoin — Ordinals Explained"
 *
 * Eine eigenständige, interaktive Lern-App für Bitcoin- & Ordinals-Grundlagen.
 * Bewusst OHNE zusätzliche Dependencies (nur React + Tailwind + inline SVG +
 * CSS/IntersectionObserver). Zweisprachig: Englisch (Standard) / Deutsch,
 * umschaltbar im Header. Eigenes Light/Dark-Theme über CSS-Variablen.
 */

// ─── i18n ───────────────────────────────────────────────────────────────────
type Lang = 'en' | 'de';
type L = { en: string; de: string };
const tr = (l: L, lang: Lang) => l[lang];

const LangContext = React.createContext<Lang>('en');
const useLang = () => useContext(LangContext);

// ─── Theme ────────────────────────────────────────────────────────────────
const LIGHT = {
  '--bg': '#FAFAF8',
  '--card': '#FFFFFF',
  '--soft': '#F3F3EF',
  '--text': '#111111',
  '--muted': '#6B7280',
  '--border': '#EAEAE4',
  '--shadow': '0 20px 60px -30px rgba(0,0,0,0.25)',
} as React.CSSProperties;

const DARK = {
  '--bg': '#0B0B0F',
  '--card': '#16161C',
  '--soft': '#1E1E26',
  '--text': '#F5F5F7',
  '--muted': '#9CA3AF',
  '--border': '#2A2A33',
  '--shadow': '0 20px 60px -30px rgba(0,0,0,0.8)',
} as React.CSSProperties;

const BTC = '#F7931A';

// ─── UI strings ──────────────────────────────────────────────────────────────
const UI = {
  heroSub: { en: 'Ordinals explained. Simple. Visual. No prior knowledge.', de: 'Ordinals erklärt. Einfach. Visuell. Ohne Vorwissen.' },
  heroLine: { en: 'Understand Bitcoin, wallets and Ordinals in just a few minutes.', de: 'Verstehe Bitcoin, Wallets und Ordinals in wenigen Minuten.' },
  heroCta: { en: "Let's go →", de: 'Los geht’s →' },
  chaptersBtn: { en: 'Chapters ▾', de: 'Kapitel ▾' },
  chaptersLabel: { en: 'Chapters', de: 'Kapitel' },
  remember: { en: 'Remember: ', de: 'Merke: ' },
  learnMore: { en: 'Learn more', de: 'Mehr erfahren' },
  quickQuestion: { en: 'Quick question', de: 'Kurze Frage' },
  chapterWord: { en: 'Chapter', de: 'Kapitel' },
  interactive: { en: '★ Interactive', de: '★ Interaktiv' },
  playgroundTitle: { en: 'Playground: From words to an address', de: 'Playground: Vom Wort zur Adresse' },
  playgroundLead: { en: 'See live how a seed phrase becomes a private key, then a public key, and finally a Bitcoin address.', de: 'Sieh live, wie aus einer Seed Phrase ein Private Key, daraus ein Public Key und schließlich eine Bitcoin-Adresse entsteht.' },
  newSeed: { en: '🎲 New seed phrase', de: '🎲 Neue Seed Phrase' },
  nextStep: { en: 'Next step →', de: 'Nächster Schritt →' },
  pgPriv: { en: 'Private Key (secret)', de: 'Private Key (geheim)' },
  pgPub: { en: 'Public Key', de: 'Public Key' },
  pgAddr: { en: 'Bitcoin address (Taproot · shareable)', de: 'Bitcoin-Adresse (Taproot · teilbar)' },
  pgDisclaimer: { en: 'Simplified illustration — NOT real cryptography. Only to show the flow.', de: 'Vereinfachte Darstellung — KEINE echte Kryptografie. Nur zur Veranschaulichung des Ablaufs.' },
  yourWallet: { en: '👛 Your wallet', de: '👛 Deine Wallet' },
  recipient: { en: '📤 Recipient', de: '📤 Empfänger' },
  satWithOrdinal: { en: 'Sat with Ordinal', de: 'Sat mit Ordinal' },
  nothingSent: { en: 'Nothing sent yet.', de: 'Noch nichts gesendet.' },
  ordinalMoved: { en: 'The Ordinal moved along with the satoshi — it "sticks" to that sat.', de: 'Der Ordinal ist mit dem Satoshi mitgewandert — er „klebt" am Sat.' },
  sendCoin: { en: 'Send this coin →', de: 'Diesen Coin senden →' },
  reset: { en: 'Reset', de: 'Zurücksetzen' },
  coinControl: { en: 'This is why Ordinals wallets need coin control: they make sure the satoshi carrying your inscription is NOT spent by accident.', de: 'Darum brauchen Ordinals-Wallets Coin-Control: Sie achten darauf, den Satoshi mit deiner Inscription NICHT versehentlich als Zahlung auszugeben.' },
  testYourself: { en: 'Test yourself', de: 'Teste dich' },
  quizTitle: { en: 'Quiz', de: 'Quiz' },
  lookUp: { en: 'Look it up', de: 'Nachschlagen' },
  glossaryTitle: { en: 'Glossary', de: 'Glossar' },
  glossarySearch: { en: 'Search the glossary…', de: 'Glossar durchsuchen…' },
  noHit: { en: 'No results.', de: 'Kein Treffer.' },
  scorePerfect: { en: '🎉 Perfect! You’ve got the basics.', de: '🎉 Perfekt! Du hast die Grundlagen drauf.' },
  scoreGood: { en: '👍 Well done — review the red answers again.', de: '👍 Gut gemacht — schau dir die roten Antworten nochmal an.' },
  scoreLow: { en: 'No worries — scroll up and read the chapters again.', de: 'Kein Stress — scrolle hoch und lies die Kapitel nochmal.' },
  footer: { en: 'Art on Bitcoin — Ordinals explained · Part of', de: 'Art on Bitcoin — Ordinals erklärt · Teil von' },
};

// ─── Simplified (NON-cryptographic) derivation helpers ───────────────────────
function pseudoHex(input: string, bytes = 32): string {
  let h = 2166136261 >>> 0;
  let s = '';
  let feed = input || ' ';
  while (s.length < bytes * 2) {
    for (let j = 0; j < feed.length; j++) {
      h ^= feed.charCodeAt(j);
      h = Math.imul(h, 16777619) >>> 0;
    }
    s += (h >>> 0).toString(16).padStart(8, '0');
    feed = s;
  }
  return s.slice(0, bytes * 2);
}

const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function toBech(hex: string, len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    const pair = hex.substr((i * 2) % hex.length, 2) || '00';
    out += BECH[parseInt(pair, 16) % 32];
  }
  return out;
}

const SEED_WORDS = [
  'apple', 'ocean', 'river', 'stone', 'tiger', 'cloud', 'ember', 'maple', 'north', 'quartz',
  'lemon', 'pixel', 'raven', 'solar', 'amber', 'cabin', 'delta', 'frost', 'grape', 'harbor',
  'ivory', 'jazz', 'koala', 'lunar', 'mango', 'nebula', 'orbit', 'panda', 'quiet', 'ripple',
  'satoshi', 'topaz', 'umbra', 'vivid', 'whale', 'xenon', 'yeti', 'zebra', 'bloom', 'cedar',
];

function randomSeed(count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]);
  return out;
}

// ─── Scroll-reveal hook ─────────────────────────────────────────────────────
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

const Reveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${className || ''}`}>
      {children}
    </div>
  );
};

// ─── Small UI atoms ─────────────────────────────────────────────────────────
const MerkBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lang = useLang();
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: `${BTC}55`, background: `${BTC}14` }}>
      <span className="mt-0.5 text-lg" aria-hidden>💡</span>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
        <span className="font-semibold" style={{ color: BTC }}>{tr(UI.remember, lang)}</span>
        {children}
      </p>
    </div>
  );
};

const Expandable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition hover:opacity-80"
        style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>
        {tr(UI.learnMore, lang)}
        <span className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      <div className="grid transition-all duration-500 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="pt-4 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

type ResolvedQA = { q: string; options: string[]; correct: number; explain: string };

const MiniQuiz: React.FC<{ data: ResolvedQA }> = ({ data }) => {
  const lang = useLang();
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        <span aria-hidden>❓</span> {tr(UI.quickQuestion, lang)}
      </div>
      <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text)' }}>{data.q}</p>
      <div className="flex flex-col gap-2">
        {data.options.map((opt, i) => {
          const isPicked = picked === i;
          const isCorrect = i === data.correct;
          let border = 'var(--border)';
          let bg = 'var(--card)';
          if (picked !== null && isCorrect) { border = '#22C55E'; bg = '#22C55E22'; }
          else if (isPicked && !isCorrect) { border = '#EF4444'; bg = '#EF444422'; }
          return (
            <button key={i} type="button" disabled={picked !== null} onClick={() => setPicked(i)}
              className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition disabled:cursor-default"
              style={{ borderColor: border, background: bg, color: 'var(--text)' }}>
              <span>{opt}</span>
              {picked !== null && isCorrect && <span>✅</span>}
              {isPicked && !isCorrect && <span>❌</span>}
            </button>
          );
        })}
      </div>
      {picked !== null && <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{data.explain}</p>}
    </div>
  );
};

// ─── Chapter shell ──────────────────────────────────────────────────────────
const Chapter: React.FC<{ id: string; n: number; title: string; emoji: string; children: React.ReactNode }> = ({ id, n, title, emoji, children }) => {
  const lang = useLang();
  return (
    <section id={id} className="scroll-mt-24 px-5 py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="rounded-3xl border p-7 sm:p-10" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl animate-slot-float" style={{ background: 'var(--soft)' }} aria-hidden>{emoji}</div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: BTC }}>{tr(UI.chapterWord, lang)} {n}</div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>{title}</h2>
              </div>
            </div>
            {children}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-3 text-[15px] leading-relaxed sm:text-base" style={{ color: 'var(--muted)' }}>{children}</p>
);

const Flow: React.FC<{ steps: string[]; accent?: string }> = ({ steps, accent = BTC }) => (
  <div className="mt-6 flex flex-col items-stretch gap-2">
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        <div className="rounded-xl border px-4 py-3 text-center text-sm font-medium" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>{s}</div>
        {i < steps.length - 1 && <div className="text-center text-lg leading-none" style={{ color: accent }}>↓</div>}
      </React.Fragment>
    ))}
  </div>
);

// ─── Interactive: Playground ─────────────────────────────────────────────────
const Playground: React.FC = () => {
  const lang = useLang();
  const [seed, setSeed] = useState<string[]>(() => randomSeed(12));
  const [step, setStep] = useState(0);

  const seedStr = seed.join(' ');
  const priv = useMemo(() => pseudoHex(seedStr, 32), [seedStr]);
  const pub = useMemo(() => '02' + pseudoHex('pub:' + priv, 32), [priv]);
  const address = useMemo(() => 'bc1p' + toBech(pseudoHex('addr:' + pub, 40), 39), [pub]);

  const reset = () => { setSeed(randomSeed(12)); setStep(0); };

  const Box: React.FC<{ active: boolean; label: string; value: string; color?: string }> = ({ active, label, value, color }) => (
    <div className={`rounded-2xl border p-4 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-40'}`} style={{ borderColor: active ? (color || BTC) : 'var(--border)', background: 'var(--soft)' }}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: color || BTC }}>{label}</div>
      <div className="break-all font-mono text-sm" style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={reset} className="rounded-full px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105" style={{ background: BTC }}>{tr(UI.newSeed, lang)}</button>
        <button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step >= 3} className="rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-40" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>{tr(UI.nextStep, lang)}</button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {seed.map((w, i) => (
          <div key={i} className="rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>
            <span style={{ color: 'var(--muted)' }}>{i + 1}. </span>{w}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <div className="text-center text-lg" style={{ color: BTC }}>↓</div>
        <Box active={step >= 1} label={tr(UI.pgPriv, lang)} value={step >= 1 ? priv : '••••••••••••••••••••••••••••••••'} color="#EF4444" />
        <div className="text-center text-lg" style={{ color: BTC }}>↓</div>
        <Box active={step >= 2} label={tr(UI.pgPub, lang)} value={step >= 2 ? pub : '••••••••••••••••••••'} color="#2563EB" />
        <div className="text-center text-lg" style={{ color: BTC }}>↓</div>
        <Box active={step >= 3} label={tr(UI.pgAddr, lang)} value={step >= 3 ? address : 'bc1p••••••••••••••••'} color="#22C55E" />
      </div>

      <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--muted)' }}>{tr(UI.pgDisclaimer, lang)}</p>
    </div>
  );
};

// ─── Interactive: UTXO / Ordinal animation ──────────────────────────────────
const UtxoAnim: React.FC = () => {
  const lang = useLang();
  const [sent, setSent] = useState(false);
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{tr(UI.yourWallet, lang)}</div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}>🪙 5,000 sats</div>
            <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}>🪙 900 sats</div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all duration-700"
              style={{ borderColor: BTC, background: `${BTC}18`, color: 'var(--text)', transform: sent ? 'translateX(115%)' : 'translateX(0)', opacity: sent ? 0.15 : 1 }}>
              <span>🪙 10,000 sats</span>
              <span title="Ordinal inscription lives here">🖼</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{tr(UI.recipient, lang)}</div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all duration-700"
            style={{ borderColor: sent ? BTC : 'var(--border)', background: sent ? `${BTC}18` : 'var(--card)', color: 'var(--text)', opacity: sent ? 1 : 0.3 }}>
            <span>🪙 {tr(UI.satWithOrdinal, lang)}</span>
            <span>{sent ? '🖼' : '—'}</span>
          </div>
          <p className="mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>{sent ? tr(UI.ordinalMoved, lang) : tr(UI.nothingSent, lang)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setSent(true)} disabled={sent} className="rounded-full px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-40" style={{ background: BTC }}>{tr(UI.sendCoin, lang)}</button>
        <button type="button" onClick={() => setSent(false)} className="rounded-full border px-4 py-2 text-sm font-medium transition" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>{tr(UI.reset, lang)}</button>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>{tr(UI.coinControl, lang)}</p>
    </div>
  );
};

// ─── Data: address types ─────────────────────────────────────────────────────
const ADDR_TYPES: { name: string; prefix: string; tags: L[]; verdict: L; badge: string; color: string }[] = [
  { name: 'Legacy', prefix: '1...', badge: '❌', color: '#EF4444',
    tags: [{ en: 'Oldest format', de: 'Älteste Form' }, { en: 'Higher fees', de: 'Höhere Gebühren' }],
    verdict: { en: 'Not recommended', de: 'Nicht empfohlen' } },
  { name: 'SegWit', prefix: 'bc1q...', badge: '✅', color: '#22C55E',
    tags: [{ en: 'More modern', de: 'Moderner' }, { en: 'Cheaper', de: 'Günstiger' }, { en: 'Widely used', de: 'Sehr verbreitet' }],
    verdict: { en: 'Good', de: 'Gut' } },
  { name: 'Taproot', prefix: 'bc1p...', badge: '⭐', color: BTC,
    tags: [{ en: 'Most modern address', de: 'Modernste Adresse' }, { en: 'Required for Ordinals', de: 'Nötig für Ordinals' }],
    verdict: { en: 'Recommended', de: 'Empfohlen' } },
];

// ─── Data: wallet recommendations (Magic Eden removed — discontinued) ────────
const WALLETS: { name: string; stars: number; note: L }[] = [
  { name: 'Xverse', stars: 5, note: { en: 'For beginners — simple & built for Ordinals', de: 'Für Anfänger — einfach & für Ordinals gemacht' } },
  { name: 'Leather', stars: 5, note: { en: 'For advanced users', de: 'Für Fortgeschrittene' } },
  { name: 'OKX Wallet', stars: 4, note: { en: 'All-in-one with solid Ordinals support', de: 'All-in-one mit solidem Ordinals-Support' } },
];

// ─── Data: rare sat rarity scale ─────────────────────────────────────────────
const RARITY: { name: string; note: L; color: string }[] = [
  { name: 'Common', color: '#9CA3AF', note: { en: 'Any ordinary sat (~99.9%)', de: 'Jeder gewöhnliche Sat (~99,9 %)' } },
  { name: 'Uncommon', color: '#22C55E', note: { en: 'First sat of each block', de: 'Erster Sat jedes Blocks' } },
  { name: 'Rare', color: '#2563EB', note: { en: 'First sat of each difficulty period', de: 'Erster Sat jeder Difficulty-Periode' } },
  { name: 'Epic', color: '#A855F7', note: { en: 'First sat of each halving', de: 'Erster Sat jedes Halvings' } },
  { name: 'Legendary', color: '#F97316', note: { en: 'First sat of each cycle', de: 'Erster Sat jedes Zyklus' } },
  { name: 'Mythic', color: BTC, note: { en: 'The very first sat ever (genesis block)', de: 'Der allererste Sat (Genesis-Block)' } },
];

// ─── Data: big quiz ──────────────────────────────────────────────────────────
const QUIZ: { q: L; options: L[]; correct: number; explain: L }[] = [
  { correct: 1,
    q: { en: 'Does your Bitcoin address need to stay secret?', de: 'Muss deine Bitcoin-Adresse geheim bleiben?' },
    options: [{ en: 'Yes', de: 'Ja' }, { en: 'No', de: 'Nein' }],
    explain: { en: 'No — an address can be shared, like an IBAN. What stays secret is the seed phrase.', de: 'Nein — eine Adresse darfst du teilen, wie eine IBAN. Geheim bleibt die Seed Phrase.' } },
  { correct: 1,
    q: { en: 'Where do your bitcoins actually live?', de: 'Wo liegen deine Bitcoins wirklich?' },
    options: [{ en: 'In the wallet app', de: 'In der Wallet-App' }, { en: 'On the blockchain', de: 'Auf der Blockchain' }, { en: 'On your phone', de: 'Auf deinem Handy' }],
    explain: { en: 'On the blockchain. The wallet only stores your keys.', de: 'Auf der Blockchain. Die Wallet speichert nur deine Schlüssel.' } },
  { correct: 2,
    q: { en: 'What must NEVER be shared?', de: 'Was darf NIEMALS geteilt werden?' },
    options: [{ en: 'Public key', de: 'Public Key' }, { en: 'Bitcoin address', de: 'Bitcoin-Adresse' }, { en: 'Seed phrase', de: 'Seed Phrase' }],
    explain: { en: 'The seed phrase (and private key). Whoever has it, has your coins.', de: 'Die Seed Phrase (und der Private Key). Wer sie hat, hat deine Coins.' } },
  { correct: 2,
    q: { en: 'Which address type do you need for Ordinals?', de: 'Welche Adresse brauchst du für Ordinals?' },
    options: [{ en: 'Legacy (1...)', de: 'Legacy (1...)' }, { en: 'SegWit (bc1q...)', de: 'SegWit (bc1q...)' }, { en: 'Taproot (bc1p...)', de: 'Taproot (bc1p...)' }],
    explain: { en: 'Taproot addresses (bc1p...) are the standard for Ordinals.', de: 'Taproot-Adressen (bc1p...) sind der Standard für Ordinals.' } },
  { correct: 0,
    q: { en: 'What does an inscription live on?', de: 'Worauf lebt eine Inscription?' },
    options: [{ en: 'A single satoshi', de: 'Auf einem einzelnen Satoshi' }, { en: 'The wallet app', de: 'In der Wallet-App' }, { en: 'The cloud', de: 'In der Cloud' }],
    explain: { en: 'On exactly one satoshi — stored permanently on Bitcoin.', de: 'Auf genau einem Satoshi — dauerhaft auf Bitcoin gespeichert.' } },
];

const BigQuiz: React.FC = () => {
  const lang = useLang();
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUIZ.map(() => null));
  const score = answers.reduce((acc: number, a, i) => acc + (a === QUIZ[i].correct ? 1 : 0), 0);
  const done = answers.every((a) => a !== null);
  return (
    <div className="flex flex-col gap-4">
      {QUIZ.map((item, qi) => (
        <div key={qi} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>{qi + 1}. {tr(item.q, lang)}</p>
          <div className="flex flex-col gap-2">
            {item.options.map((opt, oi) => {
              const picked = answers[qi];
              const isPicked = picked === oi;
              const isCorrect = oi === item.correct;
              let border = 'var(--border)';
              let bg = 'var(--soft)';
              if (picked !== null && isCorrect) { border = '#22C55E'; bg = '#22C55E22'; }
              else if (isPicked && !isCorrect) { border = '#EF4444'; bg = '#EF444422'; }
              return (
                <button key={oi} type="button" disabled={picked !== null}
                  onClick={() => setAnswers((prev) => prev.map((p, idx) => (idx === qi ? oi : p)))}
                  className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition disabled:cursor-default"
                  style={{ borderColor: border, background: bg, color: 'var(--text)' }}>
                  <span>{tr(opt, lang)}</span>
                  {picked !== null && isCorrect && <span>✅</span>}
                  {isPicked && !isCorrect && <span>❌</span>}
                </button>
              );
            })}
          </div>
          {answers[qi] !== null && <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{tr(item.explain, lang)}</p>}
        </div>
      ))}
      {done && (
        <div className="rounded-2xl border p-6 text-center" style={{ borderColor: BTC, background: `${BTC}14` }}>
          <div className="text-3xl font-black" style={{ color: BTC }}>{score} / {QUIZ.length}</div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text)' }}>
            {score === QUIZ.length ? tr(UI.scorePerfect, lang) : score >= 3 ? tr(UI.scoreGood, lang) : tr(UI.scoreLow, lang)}
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Data: glossary ──────────────────────────────────────────────────────────
const GLOSSARY: { term: L; def: L }[] = [
  { term: { en: 'Address', de: 'Adresse' }, def: { en: 'Public identifier for receiving Bitcoin — shareable, like an IBAN.', de: 'Öffentliche Kennung zum Empfangen von Bitcoin — teilbar, wie eine IBAN.' } },
  { term: { en: 'Block', de: 'Block' }, def: { en: 'A bundle of confirmed transactions, added to the chain roughly every 10 minutes.', de: 'Ein Bündel bestätigter Transaktionen, ca. alle 10 Minuten an die Blockchain gehängt.' } },
  { term: { en: 'Blockchain', de: 'Blockchain' }, def: { en: 'The shared, immutable database of all Bitcoin transactions.', de: 'Die gemeinsame, unveränderliche Datenbank aller Bitcoin-Transaktionen.' } },
  { term: { en: 'Fee', de: 'Fee (Gebühr)' }, def: { en: 'Payment to miners so your transaction gets into a block. Measured in sat/vByte.', de: 'Bezahlung an Miner, damit deine Transaktion in einen Block kommt. In sat/vByte.' } },
  { term: { en: 'Inscription', de: 'Inscription' }, def: { en: 'Data (image, text, HTML…) written permanently onto a satoshi.', de: 'Daten (Bild, Text, HTML …), die dauerhaft auf einen Satoshi geschrieben werden.' } },
  { term: { en: 'Ordinal', de: 'Ordinal' }, def: { en: 'The unique number of a single satoshi (Ordinal Theory).', de: 'Die eindeutige Nummer eines einzelnen Satoshi (Ordinal Theory).' } },
  { term: { en: 'Private Key', de: 'Private Key' }, def: { en: 'Secret key that signs transactions. Never share it.', de: 'Geheimer Schlüssel, der Transaktionen signiert. Niemals teilen.' } },
  { term: { en: 'Public Key', de: 'Public Key' }, def: { en: 'Derived from the private key; the address is derived from it.', de: 'Aus dem Private Key abgeleitet; daraus entsteht die Adresse.' } },
  { term: { en: 'Runes', de: 'Runes' }, def: { en: 'A standard for fungible tokens directly on Bitcoin.', de: 'Ein Standard für fungible Token direkt auf Bitcoin.' } },
  { term: { en: 'Satoshi (sat)', de: 'Satoshi (sat)' }, def: { en: 'Smallest unit of Bitcoin. 1 BTC = 100,000,000 sats.', de: 'Kleinste Einheit von Bitcoin. 1 BTC = 100.000.000 sats.' } },
  { term: { en: 'Seed Phrase', de: 'Seed Phrase' }, def: { en: 'Usually 12–24 words — the master key to your wallet. Strictly secret.', de: 'Meist 12–24 Wörter — der Generalschlüssel zu deiner Wallet. Streng geheim.' } },
  { term: { en: 'Taproot', de: 'Taproot' }, def: { en: 'Most modern address type (bc1p…). Standard for Ordinals.', de: 'Modernste Adressart (bc1p…). Standard für Ordinals.' } },
  { term: { en: 'UTXO', de: 'UTXO' }, def: { en: 'Unspent Transaction Output — a "coin" holding a specific amount of sats.', de: 'Unspent Transaction Output — eine „Münze" mit einem bestimmten Sat-Betrag.' } },
  { term: { en: 'Wallet', de: 'Wallet' }, def: { en: 'App that manages your keys — not the coins themselves.', de: 'App, die deine Schlüssel verwaltet — nicht die Coins selbst.' } },
];

const Glossary: React.FC = () => {
  const lang = useLang();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const items = [...GLOSSARY].sort((a, b) => tr(a.term, lang).localeCompare(tr(b.term, lang)));
    if (!s) return items;
    return items.filter((g) => tr(g.term, lang).toLowerCase().includes(s) || tr(g.def, lang).toLowerCase().includes(s));
  }, [q, lang]);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(UI.glossarySearch, lang)}
        className="mb-4 w-full rounded-xl border px-4 py-3 text-sm outline-none" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }} />
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((g) => (
          <div key={tr(g.term, 'en')} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="text-sm font-bold" style={{ color: BTC }}>{tr(g.term, lang)}</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{tr(g.def, lang)}</div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>{tr(UI.noHit, lang)}</p>}
      </div>
    </div>
  );
};

// ─── Chapter navigation data ────────────────────────────────────────────────
const NAV: { id: string; label: L }[] = [
  { id: 'bitcoin', label: { en: '1 · Bitcoin', de: '1 · Bitcoin' } },
  { id: 'wallet', label: { en: '2 · Wallet', de: '2 · Wallet' } },
  { id: 'seed', label: { en: '3 · Seed Phrase', de: '3 · Seed Phrase' } },
  { id: 'privkey', label: { en: '4 · Private Key', de: '4 · Private Key' } },
  { id: 'pubkey', label: { en: '5 · Public Key', de: '5 · Public Key' } },
  { id: 'address', label: { en: '6 · Address', de: '6 · Adresse' } },
  { id: 'playground', label: { en: '★ Playground', de: '★ Playground' } },
  { id: 'types', label: { en: '7 · Address types', de: '7 · Adress-Typen' } },
  { id: 'sats', label: { en: '8 · Satoshis', de: '8 · Satoshis' } },
  { id: 'utxo', label: { en: '9 · UTXO', de: '9 · UTXO' } },
  { id: 'ordinals', label: { en: '10 · Ordinals', de: '10 · Ordinals' } },
  { id: 'rare-sats', label: { en: '11 · Rare Sats', de: '11 · Rare Sats' } },
  { id: 'inscriptions', label: { en: '12 · Inscriptions', de: '12 · Inscriptions' } },
  { id: 'art', label: { en: '13 · Digital Art', de: '13 · Digitale Kunst' } },
  { id: 'wallets', label: { en: '14 · Wallets', de: '14 · Wallets' } },
  { id: 'security', label: { en: '15 · Security', de: '15 · Sicherheit' } },
  { id: 'quiz', label: { en: 'Quiz', de: 'Quiz' } },
  { id: 'glossary', label: { en: 'Glossary', de: 'Glossar' } },
];

// ─── Chapter texts ───────────────────────────────────────────────────────────
const CH = {
  bitcoinTitle: { en: 'What is Bitcoin?', de: 'Was ist Bitcoin?' },
  bitcoin1: { en: 'Bitcoin is not a company. Bitcoin belongs to no one.', de: 'Bitcoin ist kein Unternehmen. Bitcoin gehört niemandem.' },
  bitcoin2: { en: 'It is a worldwide network of computers that runs itself.', de: 'Es ist ein weltweites Netzwerk aus Computern, das sich selbst verwaltet.' },
  bitcoin3: { en: 'Think of it like the internet for money — open to everyone, with no boss.', de: 'Stell es dir wie das Internet für Geld vor — offen für alle, ohne Chef.' },
  bitcoinMerke: { en: 'Bitcoin is an open network, not an account at some company.', de: 'Bitcoin ist ein offenes Netzwerk, kein Konto bei einer Firma.' },
  bitcoinMore: { en: 'Thousands of computers ("nodes") keep the same list of all transactions. Nobody can secretly change it because everyone verifies. That is why Bitcoin needs no bank in the middle.', de: 'Tausende Computer („Nodes") halten dieselbe Liste aller Transaktionen. Niemand kann sie heimlich ändern, weil alle mitprüfen. Deshalb braucht Bitcoin keine Bank in der Mitte.' },
  bitcoinQ: { en: 'Who owns Bitcoin?', de: 'Wem gehört Bitcoin?' },
  bitcoinQo: [{ en: 'A company', de: 'Einer Firma' }, { en: 'No one — the network', de: 'Niemandem — dem Netzwerk' }, { en: 'The government', de: 'Der Regierung' }] as L[],
  bitcoinQe: { en: 'Bitcoin belongs to no one. It is an open, worldwide network.', de: 'Bitcoin gehört niemandem. Es ist ein offenes, weltweites Netzwerk.' },

  walletTitle: { en: 'What is a wallet?', de: 'Was ist eine Wallet?' },
  wallet1: { en: 'A wallet does NOT store bitcoins.', de: 'Eine Wallet speichert KEINE Bitcoins.' },
  wallet2: { en: 'It only stores your keys. The bitcoins always live on the blockchain.', de: 'Sie speichert nur deine Schlüssel. Die Bitcoins liegen immer auf der Blockchain.' },
  walletFlow: [{ en: 'Wallet', de: 'Wallet' }, { en: 'Keys', de: 'Schlüssel' }, { en: 'Blockchain', de: 'Blockchain' }, { en: 'Bitcoin', de: 'Bitcoin' }] as L[],
  walletMerke: { en: 'The wallet is your keychain — not the vault.', de: 'Die Wallet ist dein Schlüsselbund — nicht der Tresor.' },
  walletQ: { en: 'What does a wallet store?', de: 'Was speichert eine Wallet?' },
  walletQo: [{ en: 'The bitcoins themselves', de: 'Die Bitcoins selbst' }, { en: 'Your keys', de: 'Deine Schlüssel' }] as L[],
  walletQe: { en: 'Only your keys. The coins live on the blockchain.', de: 'Nur deine Schlüssel. Die Coins liegen auf der Blockchain.' },

  seedTitle: { en: 'Seed Phrase', de: 'Seed Phrase' },
  seed1: { en: 'A seed phrase is usually 12–24 words. It is the master key.', de: 'Die Seed Phrase besteht meist aus 12–24 Wörtern. Sie ist der Generalschlüssel.' },
  seed2: { en: 'Whoever owns it, owns your bitcoins. Treat it like cash under the mattress.', de: 'Wer sie besitzt, besitzt deine Bitcoins. Behandle sie wie Bargeld unter der Matratze.' },
  seedMerke: { en: 'Never photograph it. Never send it. Never store it online. Best on paper/metal.', de: 'Nie fotografieren. Nie verschicken. Nie online speichern. Am besten auf Papier/Metall.' },
  seedQ: { en: 'How do you best secure your seed phrase?', de: 'Wie sicherst du deine Seed Phrase am besten?' },
  seedQo: [{ en: 'Screenshot in the cloud', de: 'Screenshot in der Cloud' }, { en: 'On paper, offline', de: 'Auf Papier, offline' }, { en: 'Email it to yourself', de: 'Per E-Mail an dich selbst' }] as L[],
  seedQe: { en: 'Offline (paper/metal). Digital copies are a risk.', de: 'Offline (Papier/Metall). Digitale Kopien sind ein Risiko.' },

  privTitle: { en: 'Private Key', de: 'Private Key' },
  priv1: { en: 'The private key proves the bitcoins are yours. It signs (authorises) transactions.', de: 'Der Private Key beweist, dass dir Bitcoins gehören. Er signiert (unterschreibt) Transaktionen.' },
  privFlow: [{ en: 'Private Key', de: 'Private Key' }, { en: 'Signs transactions', de: 'Signiert Transaktionen' }, { en: 'Nobody may know it', de: 'Niemand darf ihn kennen' }] as L[],
  privMerke: { en: 'Private key = signature + proof of ownership. Strictly secret.', de: 'Private Key = Unterschrift + Eigentumsnachweis. Streng geheim.' },

  pubTitle: { en: 'Public Key', de: 'Public Key' },
  pub1: { en: 'The public key is computed from the private key — one way only. From the public key comes your address.', de: 'Aus dem Private Key wird der Public Key berechnet — in eine Richtung. Aus dem Public Key entsteht dann deine Adresse.' },
  pubFlow: [{ en: 'Private Key', de: 'Private Key' }, { en: 'Public Key', de: 'Public Key' }, { en: 'Bitcoin address', de: 'Bitcoin-Adresse' }] as L[],
  pubMerke: { en: 'The path only goes forward: private key → public key — never backwards.', de: 'Der Weg geht nur vorwärts: aus dem Private Key lässt sich der Public Key ableiten — nicht umgekehrt.' },

  addrTitle: { en: 'Bitcoin Address', de: 'Bitcoin-Adresse' },
  addr1: { en: 'A Bitcoin address is comparable to an IBAN. You can show it to anyone to receive bitcoin.', de: 'Eine Bitcoin-Adresse ist vergleichbar mit einer IBAN. Du kannst sie jedem zeigen, um Bitcoin zu empfangen.' },
  addrMerke: { en: 'The address is public and shareable. Only the seed phrase / private key stays secret.', de: 'Die Adresse ist öffentlich und teilbar. Geheim bleibt nur die Seed Phrase / der Private Key.' },
  addrQ: { en: 'Can you share your address publicly?', de: 'Darfst du deine Adresse öffentlich zeigen?' },
  addrQo: [{ en: 'Yes', de: 'Ja' }, { en: 'No', de: 'Nein' }] as L[],
  addrQe: { en: 'Yes — like an IBAN. The seed phrase stays secret.', de: 'Ja — wie eine IBAN. Geheim bleibt die Seed Phrase.' },

  typesTitle: { en: 'Address Types', de: 'Adress-Typen' },
  types1: { en: 'There are several address types. For Ordinals you need Taproot.', de: 'Es gibt mehrere Adressarten. Für Ordinals brauchst du Taproot.' },
  typesMerke: { en: 'Legacy ❌ · SegWit ✅ · Taproot ⭐ — for Ordinals always Taproot (bc1p…).', de: 'Legacy ❌ · SegWit ✅ · Taproot ⭐ — für Ordinals immer Taproot (bc1p…).' },

  satsTitle: { en: 'What are Satoshis?', de: 'Was sind Satoshis?' },
  sats1: { en: 'A bitcoin is made of one hundred million tiny units — satoshis. Like euros and cents.', de: 'Ein Bitcoin besteht aus hundert Millionen kleinen Einheiten — den Satoshis. Wie Euro und Cent.' },
  satsFlow: [{ en: '1 BTC', de: '1 BTC' }, { en: '100,000,000 satoshis', de: '100.000.000 Satoshis' }] as L[],
  satsMerke: { en: 'The smallest building block of Bitcoin is the satoshi (sat). 1 BTC = 100,000,000 sats.', de: 'Der kleinste Baustein von Bitcoin heißt Satoshi (sat). 1 BTC = 100.000.000 sats.' },
  satsQ: { en: 'How many satoshis are 1 bitcoin?', de: 'Wie viele Satoshis sind 1 Bitcoin?' },
  satsQo: [{ en: '1,000', de: '1.000' }, { en: '1 million', de: '1 Million' }, { en: '100 million', de: '100 Millionen' }] as L[],
  satsQe: { en: '1 BTC = 100,000,000 satoshis.', de: '1 BTC = 100.000.000 Satoshis.' },

  utxoTitle: { en: 'UTXO', de: 'UTXO' },
  utxo1: { en: 'Think of UTXOs like individual coins in your wallet. When you pay, whole coins are used.', de: 'Stell dir UTXOs wie einzelne Münzen in deinem Portemonnaie vor. Beim Bezahlen werden ganze Münzen verwendet.' },
  utxo2: { en: 'Ordinals live on exactly ONE of these satoshis — and move along with it.', de: 'Ordinals leben auf genau EINEM dieser Satoshis — und wandern mit ihm mit.' },
  utxoMerke: { en: 'A UTXO is a "coin". The Ordinal sticks to a specific satoshi inside it.', de: 'Ein UTXO ist eine „Münze". Der Ordinal klebt an einem bestimmten Satoshi darin.' },

  ordTitle: { en: 'What are Ordinals?', de: 'Was sind Ordinals?' },
  ord1: { en: 'Every single satoshi can be numbered. That number is called an Ordinal.', de: 'Jeder einzelne Satoshi kann durchnummeriert werden. Diese Nummer nennt man Ordinal.' },
  ordCaption: { en: 'One marked satoshi among many — e.g. satoshi #123,456,789.', de: 'Ein markierter Satoshi unter vielen — z. B. Satoshi #123.456.789.' },
  ordMerke: { en: 'Ordinal Theory gives each satoshi a unique number — making it distinguishable.', de: 'Ordinal Theory gibt jedem Satoshi eine eindeutige Nummer — so wird er unterscheidbar.' },

  rareTitle: { en: 'Rare Sats', de: 'Rare Sats' },
  rare1: { en: 'Not every satoshi is equal. Because ordinal theory can track each sat, some are considered special — based on their place in Bitcoin’s history.', de: 'Nicht jeder Satoshi ist gleich. Weil die Ordinal Theory jeden Sat verfolgen kann, gelten manche als besonders — je nach ihrer Stelle in der Bitcoin-Geschichte.' },
  rare2: { en: 'There is a rarity scale — plus "exotic" sats collectors love (e.g. block 9, palindromes, pizza sats).', de: 'Es gibt eine Seltenheitsskala — dazu „exotische" Sats, die Sammler lieben (z. B. Block 9, Palindrome, Pizza-Sats).' },
  rareMerke: { en: 'Rarity comes from WHEN a sat was mined (block, difficulty period, halving, cycle) — not from how it looks.', de: 'Die Seltenheit ergibt sich daraus, WANN ein Sat gemint wurde (Block, Difficulty-Periode, Halving, Zyklus) — nicht aus dem Aussehen.' },
  rareMore: { en: 'You can also inscribe an Ordinal onto a rare sat — combining a special satoshi with special content. Wallets like Xverse can show which rare sats you hold.', de: 'Du kannst einen Ordinal auch auf einen rare Sat schreiben — ein besonderer Satoshi mit besonderem Inhalt. Wallets wie Xverse zeigen dir, welche rare Sats du besitzt.' },
  rareQ: { en: 'What makes a sat "rare"?', de: 'Was macht einen Sat „selten"?' },
  rareQo: [{ en: 'Its colour', de: 'Seine Farbe' }, { en: 'Its position in Bitcoin history', de: 'Seine Position in der Bitcoin-Geschichte' }, { en: 'Its wallet', de: 'Seine Wallet' }] as L[],
  rareQe: { en: 'Its position — e.g. the first sat of a block, halving or cycle.', de: 'Seine Position — z. B. der erste Sat eines Blocks, Halvings oder Zyklus.' },

  insTitle: { en: 'Inscriptions', de: 'Inscriptions' },
  ins1: { en: 'An inscription stores data permanently on Bitcoin — written directly onto a satoshi.', de: 'Eine Inscription speichert Daten dauerhaft auf Bitcoin — direkt auf einen Satoshi geschrieben.' },
  ins2: { en: 'It can be an image, text, video, HTML or music.', de: 'Das kann ein Bild, Text, Video, HTML oder Musik sein.' },
  insFlow: [{ en: 'Image / text / HTML', de: 'Bild / Text / HTML' }, { en: 'written onto a satoshi', de: 'auf einen Satoshi geschrieben' }, { en: 'forever on the blockchain', de: 'für immer auf der Blockchain' }] as L[],
  insMerke: { en: 'Inscription = content that lives on a satoshi. No server, no expiry date.', de: 'Inscription = Inhalt, der fest auf einem Satoshi lebt. Kein Server, kein Ablaufdatum.' },
  insQ: { en: 'Where is an inscription stored?', de: 'Wo wird eine Inscription gespeichert?' },
  insQo: [{ en: 'On a server', de: 'Auf einem Server' }, { en: 'Directly on a satoshi', de: 'Direkt auf einem Satoshi' }, { en: 'In the wallet app', de: 'In der Wallet-App' }] as L[],
  insQe: { en: 'Directly on a satoshi — permanently on Bitcoin.', de: 'Direkt auf einem Satoshi — dauerhaft auf Bitcoin.' },

  artTitle: { en: 'Digital Art on Bitcoin', de: 'Digitale Kunst auf Bitcoin' },
  art1: { en: 'This is how real digital art on Bitcoin works: a piece is inscribed, lives on a satoshi and moves from collector to collector.', de: 'So entsteht echte digitale Kunst auf Bitcoin: Ein Werk wird inskribiert, lebt auf einem Satoshi und wandert von Sammler zu Sammler.' },
  artFlow: [{ en: 'Ordinal (the artwork)', de: 'Ordinal (das Werk)' }, { en: "Artist's wallet", de: 'Wallet des Künstlers' }, { en: 'Collector', de: 'Sammler' }] as L[],
  artMerke: { en: 'Art as an inscription is tamper-proof and provably yours — no middleman.', de: 'Kunst als Inscription ist fälschungssicher und gehört nachweisbar dir — ohne Zwischenhändler.' },

  walletsTitle: { en: 'Wallet Recommendations', de: 'Wallet-Empfehlungen' },
  walletsMerke: { en: 'To start: pick an Ordinals-capable Taproot wallet (e.g. Xverse). Always use the official source.', de: 'Für den Start: eine Ordinals-fähige Taproot-Wallet wählen (z. B. Xverse). Immer die offizielle Quelle nutzen.' },

  secTitle: { en: 'Security', de: 'Sicherheit' },
  sec: [
    { en: 'Back up your seed phrase (offline)', de: 'Backup der Seed Phrase (offline)' },
    { en: 'Never share your seed — with anyone', de: 'Seed niemals teilen — mit niemandem' },
    { en: 'Large amounts: use a hardware wallet', de: 'Große Beträge: Hardware-Wallet' },
    { en: 'Send a small test transaction first', de: 'Erst kleine Testtransaktion senden' },
  ] as L[],
  secMerke: { en: 'Support staff will NEVER ask for your seed phrase. Anyone who does is a scammer.', de: 'Support-Mitarbeiter fragen NIE nach deiner Seed Phrase. Wer danach fragt, ist ein Betrüger.' },
};

// ─── Main page ──────────────────────────────────────────────────────────────
export const OrdinalsExplainedPage: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('en');
  const [dark, setDark] = useState(true);
  const [progress, setProgress] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('bitcoin');

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
      let current = NAV[0].id;
      for (const n of NAV) {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top <= 140) current = n.id;
      }
      setActiveId(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = useCallback((id: string) => {
    setNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const theme = dark ? DARK : LIGHT;

  return (
    <LangContext.Provider value={lang}>
      <div style={theme} className="min-h-screen">
        <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
          {/* ── Header ── */}
          <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: 'var(--border)', background: dark ? 'rgba(11,11,15,0.72)' : 'rgba(250,250,248,0.72)' }}>
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                <span style={{ color: BTC }}>◆</span> Art on Bitcoin
              </button>
              <div className="flex items-center gap-2">
                {/* Language toggle */}
                <div className="flex overflow-hidden rounded-full border" style={{ borderColor: 'var(--border)' }}>
                  {(['en', 'de'] as Lang[]).map((lng) => (
                    <button key={lng} onClick={() => setLang(lng)}
                      className="px-2.5 py-1 text-xs font-bold uppercase transition"
                      style={{ background: lang === lng ? BTC : 'var(--soft)', color: lang === lng ? '#000' : 'var(--muted)' }}>
                      {lng}
                    </button>
                  ))}
                </div>
                <div className="relative lg:hidden">
                  <button onClick={() => setNavOpen((o) => !o)} className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>
                    {tr(UI.chaptersBtn, lang)}
                  </button>
                  {navOpen && (
                    <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-56 overflow-auto rounded-2xl border p-2 shadow-xl" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                      {NAV.map((n) => (
                        <button key={n.id} onClick={() => go(n.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:opacity-80" style={{ color: 'var(--text)' }}>
                          {tr(n.label, lang)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setDark((d) => !d)} className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }} aria-label="Toggle theme">
                  {dark ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
            <div className="h-1 w-full" style={{ background: 'var(--soft)' }}>
              <div className="h-1 transition-[width] duration-150" style={{ width: `${progress * 100}%`, background: BTC }} />
            </div>
          </header>

          {/* ── Persistent side navigation (desktop) ── */}
          <aside className="fixed left-0 top-[57px] bottom-0 z-30 hidden w-56 overflow-y-auto border-r px-3 py-6 lg:block" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>{tr(UI.chaptersLabel, lang)}</div>
            <nav className="flex flex-col gap-0.5">
              {NAV.map((n) => {
                const active = activeId === n.id;
                return (
                  <button key={n.id} onClick={() => go(n.id)} className="rounded-lg px-3 py-2 text-left text-sm transition hover:opacity-90"
                    style={{ background: active ? `${BTC}1f` : 'transparent', color: active ? BTC : 'var(--muted)', fontWeight: active ? 700 : 500, borderLeft: active ? `2px solid ${BTC}` : '2px solid transparent' }}>
                    {tr(n.label, lang)}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="relative lg:pl-56">
          {/* ── Hero ── */}
          <section className="px-5 pt-16 pb-10 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 text-6xl sm:text-7xl animate-slot-float" aria-hidden>🟠</div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl" style={{ color: 'var(--text)' }}>Art on Bitcoin</h1>
              <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: 'var(--muted)' }}>{tr(UI.heroSub, lang)}</p>
              <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: 'var(--muted)' }}>{tr(UI.heroLine, lang)}</p>
              <button onClick={() => go('bitcoin')} className="mt-8 rounded-full px-7 py-3.5 text-base font-bold text-black transition hover:brightness-105" style={{ background: BTC }}>
                {tr(UI.heroCta, lang)}
              </button>
            </div>
          </section>

          {/* ── Chapter 1 ── */}
          <Chapter id="bitcoin" n={1} title={tr(CH.bitcoinTitle, lang)} emoji="🌍">
            <Para>{tr(CH.bitcoin1, lang)}</Para>
            <Para>{tr(CH.bitcoin2, lang)}</Para>
            <Para>{tr(CH.bitcoin3, lang)}</Para>
            <MerkBox>{tr(CH.bitcoinMerke, lang)}</MerkBox>
            <Expandable>{tr(CH.bitcoinMore, lang)}</Expandable>
            <MiniQuiz data={{ q: tr(CH.bitcoinQ, lang), options: CH.bitcoinQo.map((o) => tr(o, lang)), correct: 1, explain: tr(CH.bitcoinQe, lang) }} />
          </Chapter>

          {/* ── Chapter 2 ── */}
          <Chapter id="wallet" n={2} title={tr(CH.walletTitle, lang)} emoji="👛">
            <Para>{tr(CH.wallet1, lang)}</Para>
            <Para>{tr(CH.wallet2, lang)}</Para>
            <Flow steps={CH.walletFlow.map((s) => tr(s, lang))} />
            <MerkBox>{tr(CH.walletMerke, lang)}</MerkBox>
            <MiniQuiz data={{ q: tr(CH.walletQ, lang), options: CH.walletQo.map((o) => tr(o, lang)), correct: 1, explain: tr(CH.walletQe, lang) }} />
          </Chapter>

          {/* ── Chapter 3 ── */}
          <Chapter id="seed" n={3} title={tr(CH.seedTitle, lang)} emoji="📝">
            <Para>{tr(CH.seed1, lang)}</Para>
            <Para>{tr(CH.seed2, lang)}</Para>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {['ocean', 'maple', 'satoshi', 'quartz', 'raven', 'amber', '…', '…', '…', '…', '…', '…'].map((w, i) => (
                <div key={i} className="rounded-lg border px-2 py-1.5 text-center text-xs" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>
                  <span style={{ color: 'var(--muted)' }}>{i + 1}. </span>{w}
                </div>
              ))}
            </div>
            <MerkBox>{tr(CH.seedMerke, lang)}</MerkBox>
            <MiniQuiz data={{ q: tr(CH.seedQ, lang), options: CH.seedQo.map((o) => tr(o, lang)), correct: 1, explain: tr(CH.seedQe, lang) }} />
          </Chapter>

          {/* ── Chapter 4 ── */}
          <Chapter id="privkey" n={4} title={tr(CH.privTitle, lang)} emoji="🔑">
            <Para>{tr(CH.priv1, lang)}</Para>
            <Flow steps={CH.privFlow.map((s) => tr(s, lang))} accent="#EF4444" />
            <MerkBox>{tr(CH.privMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 5 ── */}
          <Chapter id="pubkey" n={5} title={tr(CH.pubTitle, lang)} emoji="🔓">
            <Para>{tr(CH.pub1, lang)}</Para>
            <Flow steps={CH.pubFlow.map((s) => tr(s, lang))} accent="#2563EB" />
            <MerkBox>{tr(CH.pubMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 6 ── */}
          <Chapter id="address" n={6} title={tr(CH.addrTitle, lang)} emoji="📬">
            <Para>{tr(CH.addr1, lang)}</Para>
            <div className="mt-4 rounded-xl border px-4 py-3 font-mono text-sm" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>bc1p…</div>
            <MerkBox>{tr(CH.addrMerke, lang)}</MerkBox>
            <MiniQuiz data={{ q: tr(CH.addrQ, lang), options: CH.addrQo.map((o) => tr(o, lang)), correct: 0, explain: tr(CH.addrQe, lang) }} />
          </Chapter>

          {/* ── Playground ── */}
          <section id="playground" className="scroll-mt-24 px-5 py-14 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <div className="rounded-3xl border p-7 sm:p-10" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: BTC }}>{tr(UI.interactive, lang)}</div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>{tr(UI.playgroundTitle, lang)}</h2>
                  <Para>{tr(UI.playgroundLead, lang)}</Para>
                  <div className="mt-6"><Playground /></div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── Chapter 7 ── */}
          <Chapter id="types" n={7} title={tr(CH.typesTitle, lang)} emoji="🏷️">
            <Para>{tr(CH.types1, lang)}</Para>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {ADDR_TYPES.map((t) => (
                <div key={t.name} className="rounded-2xl border p-4" style={{ borderColor: `${t.color}66`, background: 'var(--soft)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: 'var(--text)' }}>{t.name}</span>
                    <span>{t.badge}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs" style={{ color: t.color }}>{t.prefix}</div>
                  <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                    {t.tags.map((tag, i) => <li key={i}>• {tr(tag, lang)}</li>)}
                  </ul>
                  <div className="mt-3 text-xs font-semibold" style={{ color: t.color }}>{tr(t.verdict, lang)}</div>
                </div>
              ))}
            </div>
            <MerkBox>{tr(CH.typesMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 8 ── */}
          <Chapter id="sats" n={8} title={tr(CH.satsTitle, lang)} emoji="🪙">
            <Para>{tr(CH.sats1, lang)}</Para>
            <Flow steps={CH.satsFlow.map((s) => tr(s, lang))} />
            <MerkBox>{tr(CH.satsMerke, lang)}</MerkBox>
            <MiniQuiz data={{ q: tr(CH.satsQ, lang), options: CH.satsQo.map((o) => tr(o, lang)), correct: 2, explain: tr(CH.satsQe, lang) }} />
          </Chapter>

          {/* ── Chapter 9 ── */}
          <Chapter id="utxo" n={9} title={tr(CH.utxoTitle, lang)} emoji="🧩">
            <Para>{tr(CH.utxo1, lang)}</Para>
            <Para>{tr(CH.utxo2, lang)}</Para>
            <div className="mt-6"><UtxoAnim /></div>
            <MerkBox>{tr(CH.utxoMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 10 ── */}
          <Chapter id="ordinals" n={10} title={tr(CH.ordTitle, lang)} emoji="#️⃣">
            <Para>{tr(CH.ord1, lang)}</Para>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Array.from({ length: 40 }).map((_, i) => (
                <span key={i} className="h-3 w-3 rounded-full" style={{ background: i === 17 ? BTC : 'var(--border)' }} />
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{tr(CH.ordCaption, lang)}</p>
            <MerkBox>{tr(CH.ordMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 11 · Rare Sats ── */}
          <Chapter id="rare-sats" n={11} title={tr(CH.rareTitle, lang)} emoji="💎">
            <Para>{tr(CH.rare1, lang)}</Para>
            <Para>{tr(CH.rare2, lang)}</Para>
            <div className="mt-5 flex flex-col gap-2">
              {RARITY.map((r) => (
                <div key={r.name} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: `${r.color}66`, background: 'var(--soft)' }}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="w-24 shrink-0 text-sm font-bold" style={{ color: r.color }}>{r.name}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{tr(r.note, lang)}</span>
                </div>
              ))}
            </div>
            <MerkBox>{tr(CH.rareMerke, lang)}</MerkBox>
            <Expandable>{tr(CH.rareMore, lang)}</Expandable>
            <MiniQuiz data={{ q: tr(CH.rareQ, lang), options: CH.rareQo.map((o) => tr(o, lang)), correct: 1, explain: tr(CH.rareQe, lang) }} />
          </Chapter>

          {/* ── Chapter 12 ── */}
          <Chapter id="inscriptions" n={12} title={tr(CH.insTitle, lang)} emoji="🖼️">
            <Para>{tr(CH.ins1, lang)}</Para>
            <Para>{tr(CH.ins2, lang)}</Para>
            <Flow steps={CH.insFlow.map((s) => tr(s, lang))} />
            <MerkBox>{tr(CH.insMerke, lang)}</MerkBox>
            <MiniQuiz data={{ q: tr(CH.insQ, lang), options: CH.insQo.map((o) => tr(o, lang)), correct: 1, explain: tr(CH.insQe, lang) }} />
          </Chapter>

          {/* ── Chapter 13 ── */}
          <Chapter id="art" n={13} title={tr(CH.artTitle, lang)} emoji="🎨">
            <Para>{tr(CH.art1, lang)}</Para>
            <Flow steps={CH.artFlow.map((s) => tr(s, lang))} accent="#22C55E" />
            <MerkBox>{tr(CH.artMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 14 ── */}
          <Chapter id="wallets" n={14} title={tr(CH.walletsTitle, lang)} emoji="✅">
            <div className="grid gap-3 sm:grid-cols-3">
              {WALLETS.map((w) => (
                <div key={w.name} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
                  <div className="font-bold" style={{ color: 'var(--text)' }}>{w.name}</div>
                  <div className="mt-1 text-sm" style={{ color: BTC }}>{'⭐'.repeat(w.stars)}</div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{tr(w.note, lang)}</div>
                </div>
              ))}
            </div>
            <MerkBox>{tr(CH.walletsMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Chapter 15 ── */}
          <Chapter id="security" n={15} title={tr(CH.secTitle, lang)} emoji="🛡️">
            <div className="grid gap-2 sm:grid-cols-2">
              {CH.sec.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>
                  <span>✅</span> {tr(s, lang)}
                </div>
              ))}
            </div>
            <MerkBox>{tr(CH.secMerke, lang)}</MerkBox>
          </Chapter>

          {/* ── Quiz ── */}
          <section id="quiz" className="scroll-mt-24 px-5 py-14 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <div className="mb-6 text-center">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: BTC }}>{tr(UI.testYourself, lang)}</div>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{tr(UI.quizTitle, lang)}</h2>
                </div>
                <BigQuiz />
              </Reveal>
            </div>
          </section>

          {/* ── Glossary ── */}
          <section id="glossary" className="scroll-mt-24 px-5 py-14 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <div className="mb-6 text-center">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: BTC }}>{tr(UI.lookUp, lang)}</div>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{tr(UI.glossaryTitle, lang)}</h2>
                </div>
                <Glossary />
              </Reveal>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="border-t px-5 py-10 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {tr(UI.footer, lang)}{' '}
              <button onClick={() => navigate('/')} className="underline" style={{ color: BTC }}>richart.app</button>
            </p>
          </footer>
          </main>
        </div>
      </div>
    </LangContext.Provider>
  );
};

export default OrdinalsExplainedPage;
