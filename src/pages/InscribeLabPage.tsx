import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import {
  createInscriptionCommit,
  checkCommitFunding,
  buildRevealTransaction,
  broadcastTransaction,
  getRecommendedFees,
  encodeMetadataAsCBOR,
  detectContentType,
  type InscriptionSession,
  type InscriptionOptions,
} from '../services/inscriptionBuilder';

/**
 * "Art on Bitcoin — Step 2: Inscribe"
 *
 * Geführter, praktischer Teil: Wallet holen (Xverse), Seed sichern, Adresse,
 * Funds, etwas einschreiben. Zwei Modi:
 *   • Übungsmodus (virtuell): eine simulierte Xverse-Wallet zum gefahrlosen Üben.
 *   • Echt (on-chain): minimale Version des Admin-Inscribe-Tools, komplett
 *     client-seitig (Commit → Wallet-Zahlung → Reveal) über inscriptionBuilder.
 *
 * Zweisprachig (EN Standard / DE), Dark als Standard. Keine neuen Dependencies.
 */

// ─── i18n / theme ────────────────────────────────────────────────────────────
type Lang = 'en' | 'de';
type L = { en: string; de: string };
const tr = (l: L, lang: Lang) => l[lang];

const LIGHT = {
  '--bg': '#FAFAF8', '--card': '#FFFFFF', '--soft': '#F3F3EF',
  '--text': '#111111', '--muted': '#6B7280', '--border': '#EAEAE4',
  '--shadow': '0 20px 60px -30px rgba(0,0,0,0.25)',
} as React.CSSProperties;
const DARK = {
  '--bg': '#0B0B0F', '--card': '#16161C', '--soft': '#1E1E26',
  '--text': '#F5F5F7', '--muted': '#9CA3AF', '--border': '#2A2A33',
  '--shadow': '0 20px 60px -30px rgba(0,0,0,0.8)',
} as React.CSSProperties;
const BTC = '#F7931A';

// ─── helpers ─────────────────────────────────────────────────────────────────
const SEED_WORDS = [
  'apple', 'ocean', 'river', 'stone', 'tiger', 'cloud', 'ember', 'maple', 'north', 'quartz',
  'lemon', 'pixel', 'raven', 'solar', 'amber', 'cabin', 'delta', 'frost', 'grape', 'harbor',
  'ivory', 'jazz', 'koala', 'lunar', 'mango', 'nebula', 'orbit', 'panda', 'quiet', 'ripple',
  'satoshi', 'topaz', 'umbra', 'vivid', 'whale', 'xenon', 'yeti', 'zebra', 'bloom', 'cedar',
  'ridge', 'spark', 'timber', 'violet', 'willow', 'cosmos', 'dawn', 'flint',
];
const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function rand(n: number) { return Math.floor(Math.random() * n); }
function randomSeed(count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(SEED_WORDS[rand(SEED_WORDS.length)]);
  return out;
}
function fakeBech(prefix: string, len: number): string {
  let s = prefix;
  for (let i = 0; i < len; i++) s += BECH[rand(32)];
  return s;
}
function fakeTxid(): string {
  const hx = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 64; i++) s += hx[rand(16)];
  return s;
}

// ─── small atoms ─────────────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-3xl border p-6 sm:p-8 ${className || ''}`} style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
    {children}
  </div>
);

const Pill: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = BTC }) => (
  <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>
    {children}
  </span>
);

const InfoBox: React.FC<{ children: React.ReactNode; icon?: string; color?: string }> = ({ children, icon = '💡', color = BTC }) => (
  <div className="mt-4 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: `${color}55`, background: `${color}12` }}>
    <span className="mt-0.5 text-lg" aria-hidden>{icon}</span>
    <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{children}</div>
  </div>
);

const Btn: React.FC<{ onClick?: () => void; disabled?: boolean; children: React.ReactNode; variant?: 'primary' | 'ghost'; className?: string }> = ({ onClick, disabled, children, variant = 'primary', className }) => (
  <button
    type="button" onClick={onClick} disabled={disabled}
    className={`rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${className || ''}`}
    style={variant === 'primary'
      ? { background: BTC, color: '#000' }
      : { background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}
  >
    {children}
  </button>
);

// ─── Transaction explainer (used in both modes) ──────────────────────────────
type TxStage = 'idle' | 'building' | 'mempool' | 'confirmed' | 'done';

// A real, permanent example inscription transaction on mempool.space —
// used in the practice mode so learners can see what a real tx page looks like.
const EXAMPLE_MEMPOOL_TX = 'b61b0172d95e266c18aea0c624db987e971a5d6d4ebc2aaed85da4642d635735';

const TxExplainer: React.FC<{ lang: Lang; stage: TxStage; txid?: string; virtual?: boolean }> = ({ lang, stage, txid, virtual }) => {
  const steps: { key: TxStage; icon: string; title: L; desc: L }[] = [
    { key: 'building', icon: '🔨', title: { en: 'Signing', de: 'Signieren' }, desc: { en: 'Your wallet signs the transaction with your private key.', de: 'Deine Wallet signiert die Transaktion mit deinem Private Key.' } },
    { key: 'mempool', icon: '⏳', title: { en: 'Mempool (waiting room)', de: 'Mempool (Warteraum)' }, desc: { en: 'The tx is broadcast and sits in the mempool. Miners pick txs — a higher fee means faster inclusion.', de: 'Die Tx wird gesendet und wartet im Mempool. Miner picken Txs — höhere Fee = schneller dran.' } },
    { key: 'confirmed', icon: '✅', title: { en: 'Confirmed in a block', de: 'Bestätigt in einem Block' }, desc: { en: 'A new block is found on average every ~10 minutes. Once your tx is in a block, it is confirmed.', de: 'Im Schnitt wird alle ~10 Minuten ein Block gefunden. Sobald deine Tx in einem Block ist, ist sie bestätigt.' } },
  ];
  const order: TxStage[] = ['building', 'mempool', 'confirmed'];
  const activeIdx = stage === 'done' ? order.length : order.indexOf(stage as TxStage);
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        🔎 {tr({ en: 'What happens now', de: 'Was jetzt passiert' }, lang)}
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const done = activeIdx > i && stage !== 'idle';
          const active = order[activeIdx] === s.key && stage !== 'idle';
          const color = done ? '#22C55E' : active ? BTC : 'var(--border)';
          return (
            <div key={s.key} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: active ? BTC : 'var(--border)', background: active ? `${BTC}10` : 'var(--card)' }}>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: `${color}22`, color }}>
                {done ? '✓' : s.icon}
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{tr(s.title, lang)}{active && <span className="ml-2 animate-pulse" style={{ color: BTC }}>●</span>}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{tr(s.desc, lang)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {txid && !virtual && (
          <a href={`https://mempool.space/tx/${txid}`} target="_blank" rel="noopener noreferrer"
            className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>
            🔗 {tr({ en: 'View on mempool.space', de: 'Auf mempool.space ansehen' }, lang)}
          </a>
        )}
        {txid && virtual && (stage === 'mempool' || stage === 'confirmed' || stage === 'done') && (
          <a href={`https://mempool.space/tx/${EXAMPLE_MEMPOOL_TX}`} target="_blank" rel="noopener noreferrer"
            title={tr({ en: 'Opens a real example inscription transaction on mempool.space', de: 'Öffnet eine echte Beispiel-Inscription-Transaktion auf mempool.space' }, lang)}
            className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>
            🔗 mempool.space/tx/{txid.slice(0, 8)}… {tr({ en: '(see live example ↗)', de: '(Live-Beispiel ansehen ↗)' }, lang)}
          </a>
        )}
        {txid && virtual && stage === 'building' && (
          <span className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            🔗 mempool.space/tx/{txid.slice(0, 8)}… {tr({ en: '(broadcasting…)', de: '(wird gesendet…)' }, lang)}
          </span>
        )}
        <a href="https://mempool.space" target="_blank" rel="noopener noreferrer"
          className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          🌐 mempool.space
        </a>
        <a href="https://www.richart.app/dashboard" target="_blank" rel="noopener noreferrer"
          className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          📊 {tr({ en: 'richart Dashboard', de: 'richart Dashboard' }, lang)}
        </a>
      </div>
      <p className="mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>
        {tr({ en: 'Tip: on mempool.space you can paste any address or transaction ID and watch it live.', de: 'Tipp: Auf mempool.space kannst du jede Adresse oder Transaktions-ID einfügen und live verfolgen.' }, lang)}
      </p>
    </div>
  );
};

// ─── Virtual Xverse (practice wallet) ────────────────────────────────────────
type VScreen = 'welcome' | 'seed' | 'confirm' | 'home' | 'inscribe' | 'result';

const VirtualXverse: React.FC<{ lang: Lang; onScreenChange?: (s: VScreen) => void }> = ({ lang, onScreenChange }) => {
  const [screen, setScreen] = useState<VScreen>('welcome');
  useEffect(() => { onScreenChange?.(screen); }, [screen, onScreenChange]);
  const [seed, setSeed] = useState<string[]>([]);
  const [seedRevealed, setSeedRevealed] = useState(false);
  const [wroteDown, setWroteDown] = useState(false);
  const [balance, setBalance] = useState(0);
  const [ordAddr, setOrdAddr] = useState('');
  const [payAddr, setPayAddr] = useState('');
  // inscribe form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('gm ₿');
  const [feeRate, setFeeRate] = useState(8);
  const [txStage, setTxStage] = useState<TxStage>('idle');
  const [resultTxid, setResultTxid] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);

  const createWallet = () => {
    setSeed(randomSeed(12));
    setOrdAddr(fakeBech('bc1p', 39));
    setPayAddr(fakeBech('bc1q', 34));
    setSeedRevealed(false);
    setWroteDown(false);
    setScreen('seed');
  };

  // confirm step: 3 random positions
  const [challenge, setChallenge] = useState<{ pos: number; options: string[]; picked: number | null }[]>([]);
  const buildChallenge = () => {
    const positions: number[] = [];
    while (positions.length < 3) { const p = rand(12); if (!positions.includes(p)) positions.push(p); }
    positions.sort((a, b) => a - b);
    const ch = positions.map((pos) => {
      const correct = seed[pos];
      const opts = new Set<string>([correct]);
      while (opts.size < 4) opts.add(SEED_WORDS[rand(SEED_WORDS.length)]);
      const options = [...opts].sort(() => Math.random() - 0.5);
      return { pos, options, picked: null as number | null };
    });
    setChallenge(ch);
    setScreen('confirm');
  };
  const allCorrect = challenge.length === 3 && challenge.every((c) => c.picked !== null && c.options[c.picked] === seed[c.pos]);

  const estCost = feeRate * 160 + 546; // rough demo cost
  const doVirtualInscribe = () => {
    if (balance < estCost) return;
    setResultTxid(fakeTxid());
    setTxStage('building');
    setScreen('result');
    timers.current.push(window.setTimeout(() => setTxStage('mempool'), 1400));
    timers.current.push(window.setTimeout(() => { setTxStage('confirmed'); setBalance((b) => Math.max(0, b - estCost)); }, 5200));
    // Shortcut: after 10s the block "arrives" and everything is fully settled (no endless pulsing).
    timers.current.push(window.setTimeout(() => setTxStage('done'), 10000));
  };

  const restart = () => {
    timers.current.forEach((t) => clearTimeout(t));
    setScreen('welcome'); setSeed([]); setBalance(0); setTitle(''); setContent('gm ₿'); setTxStage('idle'); setResultTxid('');
  };

  const AddrRow: React.FC<{ label: string; addr: string; tag: string; color: string }> = ({ label, addr, tag, color }) => (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</span>
        <Pill color={color}>{tag}</Pill>
      </div>
      <div className="mt-1 break-all font-mono text-xs" style={{ color: 'var(--text)' }}>{addr}</div>
    </div>
  );

  // phone frame
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="overflow-hidden rounded-[2rem] border-4 shadow-2xl" style={{ borderColor: '#000', background: 'var(--card)' }}>
        {/* wallet top bar */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(90deg,#1a1a1a,#2a2320)' }}>
          <span className="text-sm font-black" style={{ color: BTC }}>✦ Practice Wallet</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#fff' }}>{tr({ en: 'Xverse-style', de: 'Xverse-Stil' }, lang)}</span>
        </div>

        <div className="p-4" style={{ minHeight: 420 }}>
          {/* WELCOME */}
          {screen === 'welcome' && (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 text-5xl">👛</div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{tr({ en: 'Welcome', de: 'Willkommen' }, lang)}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{tr({ en: 'Create a practice wallet — no real money involved.', de: 'Erstelle eine Übungs-Wallet — kein echtes Geld im Spiel.' }, lang)}</p>
              <Btn className="mt-6" onClick={createWallet}>{tr({ en: 'Create new wallet', de: 'Neue Wallet erstellen' }, lang)}</Btn>
            </div>
          )}

          {/* SEED */}
          {screen === 'seed' && (
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{tr({ en: 'Back up your Seed Phrase', de: 'Sichere deine Seed Phrase' }, lang)}</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tr({ en: 'These 12 words ARE your wallet. Write them on paper. Never share or screenshot them.', de: 'Diese 12 Wörter SIND deine Wallet. Schreib sie auf Papier. Nie teilen oder screenshotten.' }, lang)}</p>
              <div className="relative mt-3">
                <div className={`grid grid-cols-2 gap-2 ${seedRevealed ? '' : 'blur-sm select-none'}`}>
                  {seed.map((w, i) => (
                    <div key={i} className="rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>
                      <span style={{ color: 'var(--muted)' }}>{i + 1}. </span>{w}
                    </div>
                  ))}
                </div>
                {!seedRevealed && (
                  <button onClick={() => setSeedRevealed(true)} className="absolute inset-0 flex items-center justify-center rounded-lg text-xs font-bold" style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}>
                    👁 {tr({ en: 'Tap to reveal', de: 'Zum Anzeigen tippen' }, lang)}
                  </button>
                )}
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
                <input type="checkbox" checked={wroteDown} onChange={(e) => setWroteDown(e.target.checked)} />
                {tr({ en: 'I wrote my 12 words down safely', de: 'Ich habe meine 12 Wörter sicher notiert' }, lang)}
              </label>
              <Btn className="mt-4 w-full" disabled={!seedRevealed || !wroteDown} onClick={buildChallenge}>{tr({ en: 'Continue', de: 'Weiter' }, lang)}</Btn>
            </div>
          )}

          {/* CONFIRM */}
          {screen === 'confirm' && (
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{tr({ en: 'Confirm your backup', de: 'Backup bestätigen' }, lang)}</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tr({ en: 'Pick the correct word for each position.', de: 'Wähle für jede Position das richtige Wort.' }, lang)}</p>
              <div className="mt-3 flex flex-col gap-3">
                {challenge.map((c, ci) => (
                  <div key={ci}>
                    <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>{tr({ en: 'Word', de: 'Wort' }, lang)} #{c.pos + 1}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {c.options.map((opt, oi) => {
                        const picked = c.picked === oi;
                        const isCorrect = opt === seed[c.pos];
                        let border = 'var(--border)'; let bg = 'var(--soft)';
                        if (c.picked !== null && isCorrect) { border = '#22C55E'; bg = '#22C55E22'; }
                        else if (picked && !isCorrect) { border = '#EF4444'; bg = '#EF444422'; }
                        return (
                          <button key={oi} disabled={c.picked !== null}
                            onClick={() => setChallenge((prev) => prev.map((x, idx) => idx === ci ? { ...x, picked: oi } : x))}
                            className="rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: border, background: bg, color: 'var(--text)' }}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <Btn className="mt-4 w-full" disabled={!allCorrect} onClick={() => setScreen('home')}>{tr({ en: 'Open wallet', de: 'Wallet öffnen' }, lang)}</Btn>
              {challenge.some((c) => c.picked !== null && c.options[c.picked!] !== seed[c.pos]) && (
                <button onClick={() => setScreen('seed')} className="mt-2 w-full text-xs underline" style={{ color: BTC }}>{tr({ en: 'Show words again', de: 'Wörter erneut zeigen' }, lang)}</button>
              )}
            </div>
          )}

          {/* HOME */}
          {screen === 'home' && (
            <div>
              <div className="rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{tr({ en: 'Balance', de: 'Guthaben' }, lang)}</div>
                <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>{balance.toLocaleString()} <span className="text-sm" style={{ color: BTC }}>sats</span></div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <AddrRow label={tr({ en: 'Ordinals address', de: 'Ordinals-Adresse' }, lang)} addr={ordAddr} tag="Taproot" color={BTC} />
                <AddrRow label={tr({ en: 'Payment address', de: 'Zahlungs-Adresse' }, lang)} addr={payAddr} tag="SegWit" color="#22C55E" />
              </div>
              <InfoBox icon="🎯" color="#2563EB">
                {tr({ en: 'Inscriptions go to your Taproot (bc1p…) address. Fees are paid from the payment address.', de: 'Inscriptions gehen an deine Taproot- (bc1p…) Adresse. Gebühren werden von der Zahlungs-Adresse bezahlt.' }, lang)}
              </InfoBox>
              <div className="mt-3 flex gap-2">
                <Btn variant="ghost" className="flex-1" onClick={() => setBalance((b) => b + 25000)}>＋ {tr({ en: 'Receive test sats', de: 'Test-Sats erhalten' }, lang)}</Btn>
                <Btn className="flex-1" disabled={balance <= 0} onClick={() => setScreen('inscribe')}>{tr({ en: 'Inscribe', de: 'Einschreiben' }, lang)} →</Btn>
              </div>
            </div>
          )}

          {/* INSCRIBE */}
          {screen === 'inscribe' && (
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{tr({ en: 'Inscribe something', de: 'Etwas einschreiben' }, lang)}</h3>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr({ en: 'Title', de: 'Titel' }, lang)}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr({ en: 'My first inscription', de: 'Meine erste Inscription' }, lang)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }} />
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr({ en: 'Content (text)', de: 'Inhalt (Text)' }, lang)}</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }} />
              <label className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                <span>{tr({ en: 'Fee rate', de: 'Gebühr' }, lang)}</span><span style={{ color: BTC }}>{feeRate} sat/vB</span>
              </label>
              <input type="range" min={1} max={50} value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: BTC }} />
              <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--muted)' }}>
                {tr({ en: 'Estimated cost', de: 'Geschätzte Kosten' }, lang)}: <strong style={{ color: 'var(--text)' }}>{estCost.toLocaleString()} sats</strong> · {tr({ en: 'Balance', de: 'Guthaben' }, lang)}: {balance.toLocaleString()} sats
              </div>
              {balance < estCost && <p className="mt-2 text-xs" style={{ color: '#EF4444' }}>{tr({ en: 'Not enough sats — receive test sats first.', de: 'Zu wenig Sats — hol dir zuerst Test-Sats.' }, lang)}</p>}
              <div className="mt-3 flex gap-2">
                <Btn variant="ghost" onClick={() => setScreen('home')}>←</Btn>
                <Btn className="flex-1" disabled={balance < estCost || !content.trim()} onClick={doVirtualInscribe}>{tr({ en: 'Inscribe now', de: 'Jetzt einschreiben' }, lang)}</Btn>
              </div>
            </div>
          )}

          {/* RESULT */}
          {screen === 'result' && (
            <div className="text-center">
              <div className="mb-2 text-4xl">{txStage === 'confirmed' || txStage === 'done' ? '🎉' : '⏳'}</div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                {txStage === 'confirmed' || txStage === 'done' ? tr({ en: 'Inscription confirmed!', de: 'Inscription bestätigt!' }, lang) : tr({ en: 'Broadcasting…', de: 'Wird gesendet…' }, lang)}
              </h3>
              {title && <p className="mt-1 text-sm" style={{ color: BTC }}>"{title}"</p>}
              <div className="mt-2 break-all rounded-lg border px-3 py-2 font-mono text-[10px]" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }}>
                {resultTxid}i0
              </div>
              <div className="mt-3 text-left"><TxExplainer lang={lang} stage={txStage} txid={resultTxid} virtual /></div>
              <Btn variant="ghost" className="mt-3 w-full" onClick={restart}>↺ {tr({ en: 'Practice again', de: 'Nochmal üben' }, lang)}</Btn>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
        🧪 {tr({ en: 'Simulation — no real wallet, seed or funds.', de: 'Simulation — keine echte Wallet, Seed oder Funds.' }, lang)}
      </p>
    </div>
  );
};

// ─── Real inscriber (client-side commit + reveal) ────────────────────────────
const RealInscriber: React.FC<{ lang: Lang }> = ({ lang }) => {
  const { walletState, connect } = useWallet();
  const ordAddr = walletState.accounts?.find((a: any) => a.purpose === 'ordinals')?.address || walletState.accounts?.[0]?.address;

  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('gm ₿');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [feeRate, setFeeRate] = useState(6);
  const [recFees, setRecFees] = useState<{ economy: number; hour: number; halfHour: number; fastest: number } | null>(null);

  const [session, setSession] = useState<InscriptionSession | null>(null);
  const [txStage, setTxStage] = useState<TxStage>('idle');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    getRecommendedFees().then((f) => { setRecFees(f); setFeeRate(Math.max(1, f.halfHour)); }).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const doReveal = useCallback(async (s: InscriptionSession, commitTxid: string, commitVout: number, commitAmount: number) => {
    try {
      setStatus(tr({ en: 'Building reveal transaction…', de: 'Reveal-Transaktion wird gebaut…' }, lang));
      const rawTx = buildRevealTransaction(s, commitTxid, commitVout, commitAmount);
      setStatus(tr({ en: 'Broadcasting…', de: 'Wird gesendet…' }, lang));
      const revealTxid = await broadcastTransaction(rawTx);
      const inscriptionId = `${revealTxid}i0`;
      setSession({ ...s, status: 'revealed', revealTxid, inscriptionId });
      setTxStage('mempool');
      setStatus('');
    } catch (e: any) {
      setError(`Reveal: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, [lang]);

  const startPolling = useCallback((s: InscriptionSession) => {
    setTxStage('building');
    const poll = async () => {
      try {
        const r = await checkCommitFunding(s.commitAddress);
        if (r.funded && r.txid) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus(tr({ en: 'Payment detected — inscribing…', de: 'Zahlung erkannt — schreibe ein…' }, lang));
          await doReveal(s, r.txid, r.vout ?? 0, r.amount ?? s.requiredAmount);
        }
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = window.setInterval(poll, 5000);
  }, [doReveal, lang]);

  const buildBody = useCallback(async (): Promise<{ contentType: string; body: Uint8Array }> => {
    if (mode === 'image' && imageFile) {
      const buf = new Uint8Array(await imageFile.arrayBuffer());
      return { contentType: detectContentType(imageFile.name, buf), body: buf };
    }
    return { contentType: 'text/plain;charset=utf-8', body: new TextEncoder().encode(text) };
  }, [mode, imageFile, text]);

  const handleGo = useCallback(async () => {
    setError('');
    if (!ordAddr || !ordAddr.startsWith('bc1p')) {
      setError(tr({ en: 'Connect a wallet with a Taproot (bc1p…) address first.', de: 'Verbinde zuerst eine Wallet mit Taproot- (bc1p…) Adresse.' }, lang));
      return;
    }
    if (mode === 'text' && !text.trim()) { setError(tr({ en: 'Enter some text.', de: 'Gib etwas Text ein.' }, lang)); return; }
    if (mode === 'image' && !imageFile) { setError(tr({ en: 'Choose an image.', de: 'Wähle ein Bild.' }, lang)); return; }
    try {
      setBusy(true);
      setStatus(tr({ en: 'Preparing inscription…', de: 'Inscription wird vorbereitet…' }, lang));
      const { contentType, body } = await buildBody();
      const opts: InscriptionOptions = { contentType, body, metadata: encodeMetadataAsCBOR(title || undefined) };
      const s = createInscriptionCommit([opts], Math.max(1, feeRate), ordAddr);
      setSession(s);
      setStatus(tr({ en: 'Opening wallet for payment…', de: 'Wallet für Zahlung wird geöffnet…' }, lang));
      const satsConnect = await import('sats-connect');
      const resp: any = await (satsConnect as any).request('sendTransfer', {
        recipients: [{ address: s.commitAddress, amount: s.requiredAmount }],
      });
      if (resp?.status !== 'success') throw new Error(resp?.error?.message || tr({ en: 'Payment rejected', de: 'Zahlung abgelehnt' }, lang));
      setStatus(tr({ en: 'Payment sent — waiting for it in the mempool…', de: 'Zahlung gesendet — warte im Mempool darauf…' }, lang));
      startPolling(s);
    } catch (e: any) {
      const m = e?.message || String(e);
      setError(/reject|cancel|denied/i.test(m) ? tr({ en: 'Payment cancelled.', de: 'Zahlung abgebrochen.' }, lang) : m);
      setBusy(false);
      setTxStage('idle');
    }
  }, [ordAddr, mode, text, imageFile, title, feeRate, buildBody, startPolling, lang]);

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSession(null); setTxStage('idle'); setBusy(false); setStatus(''); setError('');
  };

  const restartAll = () => {
    reset();
    setTitle(''); setMode('text'); setText('gm ₿'); setImageFile(null);
  };

  const inscriptionId = session?.inscriptionId;

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill color="#EF4444">{tr({ en: 'REAL · on-chain', de: 'ECHT · on-chain' }, lang)}</Pill>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{tr({ en: 'Real BTC & network fees apply.', de: 'Echte BTC & Netzwerkgebühren fallen an.' }, lang)}</span>
        </div>
        <button onClick={restartAll} title={tr({ en: 'Start over', de: 'Von vorne' }, lang)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          ↺ {tr({ en: 'Restart', de: 'Neustart' }, lang)}
        </button>
      </div>

      {/* wallet connect */}
      {!ordAddr ? (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
          <p className="mb-3 text-sm" style={{ color: 'var(--text)' }}>{tr({ en: 'Connect your Xverse wallet to inscribe to your own address:', de: 'Verbinde deine Xverse-Wallet, um auf deine eigene Adresse einzuschreiben:' }, lang)}</p>
          <Btn onClick={() => connect('xverse' as any).catch((e: any) => setError(e?.message || 'Xverse'))}>{tr({ en: 'Connect Xverse', de: 'Xverse verbinden' }, lang)}</Btn>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>{tr({ en: "Don't have it yet?", de: 'Noch nicht installiert?' }, lang)} <a href="https://www.xverse.app" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: BTC }}>xverse.app ↗</a></p>
        </div>
      ) : (
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr({ en: 'Inscription goes to', de: 'Inscription geht an' }, lang)}</div>
          <div className="break-all font-mono text-xs" style={{ color: 'var(--text)' }}>{ordAddr}</div>
        </div>
      )}

      {!inscriptionId && (
        <details className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
          <summary className="cursor-pointer list-none text-sm font-semibold" style={{ color: 'var(--text)' }}>
            💰 {tr({ en: 'How to add funds to your wallet', de: 'Wie du Guthaben in deine Wallet lädst' }, lang)}
          </summary>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {tr({ en: 'You need a little bitcoin in your wallet for postage + network fees. Two ways:', de: 'Du brauchst etwas Bitcoin in deiner Wallet für Postage + Netzwerkgebühren. Zwei Wege:' }, lang)}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>💳 {tr({ en: 'Buy inside Xverse', de: 'In Xverse kaufen' }, lang)}</div>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {tr({ en: 'Tap “Buy” in Xverse and pay with credit/debit card, Apple Pay, Google Pay, SEPA, Revolut or bank transfer. The BTC lands directly in your wallet.', de: 'Tippe in Xverse auf „Buy" und zahle per Kredit-/Debitkarte, Apple Pay, Google Pay, SEPA, Revolut oder Banküberweisung. Das BTC landet direkt in deiner Wallet.' }, lang)}
              </p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>₿ {tr({ en: 'Send Bitcoin', de: 'Bitcoin senden' }, lang)}</div>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {tr({ en: 'Already own BTC (e.g. on an exchange or another wallet)? Send it to your payment address (bc1q…). It arrives after the transaction confirms.', de: 'Du besitzt schon BTC (z. B. auf einer Börse oder anderen Wallet)? Sende es an deine Zahlungs-Adresse (bc1q…). Es ist da, sobald die Transaktion bestätigt ist.' }, lang)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            💡 {tr({ en: 'Tip: a few thousand sats is usually enough for a small text inscription.', de: 'Tipp: Ein paar tausend Sats reichen meist für eine kleine Text-Inscription.' }, lang)}
          </p>
        </details>
      )}

      {ordAddr && !inscriptionId && (
        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr({ en: 'Title (metadata)', de: 'Titel (Metadaten)' }, lang)}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr({ en: 'My first inscription', de: 'Meine erste Inscription' }, lang)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }} />

          <div className="mt-3 flex gap-2">
            {(['text', 'image'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: mode === m ? BTC : 'var(--soft)', color: mode === m ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
                {m === 'text' ? tr({ en: 'Text', de: 'Text' }, lang) : tr({ en: 'Small image', de: 'Kleines Bild' }, lang)}
              </button>
            ))}
          </div>

          {mode === 'text' ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' }} />
          ) : (
            <div className="mt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>
                {tr({ en: 'Choose file', de: 'Datei wählen' }, lang)}
                <input type="file" accept="image/*,text/html,text/plain" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
              <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>{imageFile ? imageFile.name : tr({ en: 'No file selected', de: 'Keine Datei gewählt' }, lang)}</span>
              {imageFile && <p className="mt-1 text-[11px]" style={{ color: imageFile.size > 100_000 ? '#EF4444' : 'var(--muted)' }}>{(imageFile.size / 1024).toFixed(1)} KB {imageFile.size > 100_000 ? tr({ en: '(large → high fees!)', de: '(groß → hohe Gebühren!)' }, lang) : ''}</p>}
            </div>
          )}

          <label className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            <span>{tr({ en: 'Fee rate', de: 'Gebühr' }, lang)}</span><span style={{ color: BTC }}>{feeRate} sat/vB</span>
          </label>
          <input type="range" min={1} max={Math.max(50, (recFees?.fastest ?? 50))} value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: BTC }} />
          {recFees && (
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              {[['eco', recFees.economy], ['~1h', recFees.hour], ['~30m', recFees.halfHour], ['fast', recFees.fastest]].map(([lbl, v]) => (
                <button key={lbl as string} onClick={() => setFeeRate(Math.max(1, v as number))} className="rounded-full px-2 py-0.5" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>{lbl as string} {v as number}</button>
              ))}
            </div>
          )}

          <InfoBox icon="⚠️" color="#EF4444">
            {tr({ en: 'This spends real bitcoin. Start with a tiny fee rate and short text to keep it cheap. Total cost is roughly fee rate × transaction size + 546 sats postage.', de: 'Das gibt echtes Bitcoin aus. Beginne mit kleiner Gebühr und kurzem Text, um es günstig zu halten. Gesamtkosten ≈ Gebühr × Transaktionsgröße + 546 sats Postage.' }, lang)}
          </InfoBox>

          <Btn className="mt-4 w-full" disabled={busy} onClick={handleGo}>
            {busy ? (status || tr({ en: 'Working…', de: 'Läuft…' }, lang)) : tr({ en: 'Create & pay', de: 'Erstellen & bezahlen' }, lang)}
          </Btn>
          {session && !inscriptionId && (
            <div className="mt-3 rounded-lg border p-3 text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--muted)' }}>
              {tr({ en: 'Or send manually', de: 'Oder manuell senden' }, lang)}: <strong style={{ color: 'var(--text)' }}>{session.requiredAmount.toLocaleString()} sats</strong> → <span className="break-all font-mono" style={{ color: 'var(--text)' }}>{session.commitAddress}</span>
            </div>
          )}
        </div>
      )}

      {status && !error && <p className="mt-3 text-xs" style={{ color: BTC }}>{status}</p>}
      {error && <p className="mt-3 text-xs" style={{ color: '#EF4444' }}>{error}</p>}

      {session && txStage !== 'idle' && (
        <div className="mt-4">
          <TxExplainer lang={lang} stage={txStage} txid={session.revealTxid} />
        </div>
      )}

      {inscriptionId && (
        <div className="mt-4 rounded-2xl border p-4 text-center" style={{ borderColor: BTC, background: `${BTC}12` }}>
          <div className="text-3xl">🎉</div>
          <div className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>{tr({ en: 'Inscription broadcast!', de: 'Inscription gesendet!' }, lang)}</div>
          <div className="mt-2 break-all font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{inscriptionId}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a href={`https://ordinals.com/inscription/${inscriptionId}`} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>{tr({ en: 'View inscription', de: 'Inscription ansehen' }, lang)}</a>
            <button onClick={reset} className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>{tr({ en: 'Inscribe another', de: 'Weitere einschreiben' }, lang)}</button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>{tr({ en: 'It may take a few minutes to confirm and appear in explorers.', de: 'Es kann ein paar Minuten dauern, bis sie bestätigt ist und in Explorern erscheint.' }, lang)}</p>
        </div>
      )}
    </div>
  );
};

// ─── Guided step wrapper ─────────────────────────────────────────────────────
const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black" style={{ background: BTC, color: '#000' }}>{n}</div>
      <div className="mt-1 w-px flex-1" style={{ background: 'var(--border)' }} />
    </div>
    <div className="flex-1 pb-10">
      <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  </div>
);

// ─── Practice guide (single active step, synced to the virtual wallet) ───────
type VStepDef = { screen: VScreen; title: L; body: L; tip?: { icon: string; color: string; text: L } };
const V_STEPS: VStepDef[] = [
  { screen: 'welcome', title: { en: '1 · Get a wallet', de: '1 · Wallet holen' }, body: { en: 'Xverse is a beginner-friendly wallet made for Ordinals. Here you use a safe practice wallet — just tap “Create new wallet”.', de: 'Xverse ist eine anfängerfreundliche Wallet für Ordinals. Hier nutzt du eine gefahrlose Übungs-Wallet — tippe einfach auf „Neue Wallet erstellen".' }, tip: { icon: '🧪', color: '#2563EB', text: { en: 'For the real thing later, install it only from xverse.app.', de: 'Für den Ernstfall später: nur von xverse.app installieren.' } } },
  { screen: 'seed', title: { en: '2 · Save your seed phrase', de: '2 · Seed Phrase sichern' }, body: { en: 'The wallet shows 12 words. Write them on paper, in order. These 12 words ARE your wallet.', de: 'Die Wallet zeigt 12 Wörter. Schreib sie in Reihenfolge auf Papier. Diese 12 Wörter SIND deine Wallet.' }, tip: { icon: '🚫', color: '#EF4444', text: { en: 'Never screenshot, cloud-save or share them.', de: 'Nie screenshotten, in der Cloud speichern oder teilen.' } } },
  { screen: 'confirm', title: { en: '3 · Confirm your backup', de: '3 · Backup bestätigen' }, body: { en: 'Pick the correct word for each requested position. This proves you really wrote them down.', de: 'Wähle für jede abgefragte Position das richtige Wort. So beweist du, dass du sie wirklich notiert hast.' } },
  { screen: 'home', title: { en: '4 · Your addresses & funding', de: '4 · Deine Adressen & Aufladen' }, body: { en: 'Your wallet has a Taproot address (bc1p…, receives inscriptions) and a payment address (bc1q…, pays fees). Tap “Receive test sats” to fund it.', de: 'Deine Wallet hat eine Taproot-Adresse (bc1p…, empfängt Inscriptions) und eine Zahlungs-Adresse (bc1q…, zahlt Gebühren). Tippe „Test-Sats erhalten", um sie aufzuladen.' } },
  { screen: 'inscribe', title: { en: '5 · Inscribe: title, content, fee', de: '5 · Einschreiben: Titel, Inhalt, Fee' }, body: { en: 'Give it a title, add content, choose a fee rate and confirm. Higher fee = faster; bigger content = more expensive.', de: 'Gib einen Titel, füge Inhalt hinzu, wähle eine Gebühr und bestätige. Höhere Fee = schneller; größerer Inhalt = teurer.' } },
  { screen: 'result', title: { en: '6 · Watch the transaction', de: '6 · Transaktion verfolgen' }, body: { en: 'Your tx is broadcast to the mempool, then confirmed in a block (~10 min on average). Follow the stages below.', de: 'Deine Tx geht in den Mempool und wird dann in einem Block bestätigt (~10 Min im Schnitt). Verfolge die Phasen unten.' } },
];

const VirtualGuide: React.FC<{ lang: Lang; vScreen: VScreen }> = ({ lang, vScreen }) => {
  const idx = Math.max(0, V_STEPS.findIndex((s) => s.screen === vScreen));
  const step = V_STEPS[idx];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Pill color="#2563EB">🧪 {tr({ en: 'Practice guide', de: 'Übungs-Anleitung' }, lang)}</Pill>
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{tr({ en: 'Step', de: 'Schritt' }, lang)} {idx + 1} / {V_STEPS.length}</span>
      </div>
      <div className="mt-4 flex gap-1.5">
        {V_STEPS.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-500" style={{ background: i < idx ? '#22C55E' : i === idx ? BTC : 'var(--border)' }} />
        ))}
      </div>
      <div key={idx} className="mt-5 animate-fade-up">
        <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{tr(step.title, lang)}</h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{tr(step.body, lang)}</p>
        {step.tip && <InfoBox icon={step.tip.icon} color={step.tip.color}>{tr(step.tip.text, lang)}</InfoBox>}
      </div>
      <div className="mt-6 rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--muted)' }}>
        👉 {tr({ en: 'Do the highlighted action in the wallet on the right — the guide moves with you.', de: 'Führe die markierte Aktion rechts in der Wallet aus — die Anleitung wandert mit.' }, lang)}
      </div>
    </Card>
  );
};

// ─── Main page ──────────────────────────────────────────────────────────────
export const InscribeLabPage: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('en');
  const [dark, setDark] = useState(true);
  const [mode, setMode] = useState<'virtual' | 'real'>('virtual');
  const [vScreen, setVScreen] = useState<VScreen>('welcome');
  const theme = dark ? DARK : LIGHT;

  return (
    <div style={theme} className="min-h-screen">
      <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
        {/* Header */}
        <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: 'var(--border)', background: dark ? 'rgba(11,11,15,0.72)' : 'rgba(250,250,248,0.72)' }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/ordinals-explained')} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>
                <span style={{ color: BTC }}>←</span> {tr({ en: 'Step 1', de: 'Step 1' }, lang)}
              </button>
              <button onClick={() => navigate('/')} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>
                🏠 {tr({ en: 'Home', de: 'Startseite' }, lang)}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border" style={{ borderColor: 'var(--border)' }}>
                {(['en', 'de'] as Lang[]).map((lng) => (
                  <button key={lng} onClick={() => setLang(lng)} className="px-2.5 py-1 text-xs font-bold uppercase transition" style={{ background: lang === lng ? BTC : 'var(--soft)', color: lang === lng ? '#000' : 'var(--muted)' }}>{lng}</button>
                ))}
              </div>
              <button onClick={() => setDark((d) => !d)} className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }} aria-label="Toggle theme">{dark ? '☀️' : '🌙'}</button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="px-5 pt-14 pb-6 text-center">
          <div className="mx-auto max-w-3xl">
            <Pill>{tr({ en: 'Step 2', de: 'Step 2' }, lang)}</Pill>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--text)' }}>{tr({ en: 'Inscribe it yourself', de: 'Selbst einschreiben' }, lang)}</h1>
            <p className="mx-auto mt-3 max-w-xl text-base" style={{ color: 'var(--muted)' }}>
              {tr({ en: 'A guided, hands-on walkthrough: get a wallet, secure your seed, fund it, and create your first inscription — practice safely first, then do it for real.', de: 'Eine geführte Praxis-Anleitung: Wallet holen, Seed sichern, aufladen und deine erste Inscription erstellen — erst gefahrlos üben, dann echt machen.' }, lang)}
            </p>
          </div>
        </section>

        {/* Mode toggle */}
        <div className="mx-auto mb-8 flex max-w-3xl justify-center px-5">
          <div className="flex w-full max-w-md overflow-hidden rounded-full border p-1" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
            <button onClick={() => setMode('virtual')} className="flex-1 rounded-full px-4 py-2 text-sm font-bold transition" style={{ background: mode === 'virtual' ? BTC : 'transparent', color: mode === 'virtual' ? '#000' : 'var(--muted)' }}>
              🧪 {tr({ en: 'Practice (virtual)', de: 'Üben (virtuell)' }, lang)}
            </button>
            <button onClick={() => setMode('real')} className="flex-1 rounded-full px-4 py-2 text-sm font-bold transition" style={{ background: mode === 'real' ? '#EF4444' : 'transparent', color: mode === 'real' ? '#fff' : 'var(--muted)' }}>
              🔴 {tr({ en: 'Real (on-chain)', de: 'Echt (on-chain)' }, lang)}
            </button>
          </div>
        </div>

        {/* Body */}
        <main className="mx-auto max-w-5xl px-5 pb-20">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: guided steps */}
            <div>
              {mode === 'virtual' ? (
                <VirtualGuide lang={lang} vScreen={vScreen} />
              ) : (
              <Card>
                <Step n={1} title={tr({ en: 'Get the Xverse wallet', de: 'Xverse-Wallet holen' }, lang)}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tr({ en: 'Xverse is a beginner-friendly wallet made for Ordinals. Install it from the official site only.', de: 'Xverse ist eine anfängerfreundliche Wallet für Ordinals. Installiere sie nur von der offiziellen Seite.' }, lang)}
                  </p>
                  <a href="https://www.xverse.app" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>xverse.app ↗</a>
                  {mode === 'virtual' && <InfoBox icon="🧪" color="#2563EB">{tr({ en: 'For now, use the practice wallet on the right — no install needed.', de: 'Für jetzt nutze rechts die Übungs-Wallet — keine Installation nötig.' }, lang)}</InfoBox>}
                </Step>

                <Step n={2} title={tr({ en: 'Create a wallet & save your seed', de: 'Wallet erstellen & Seed sichern' }, lang)}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tr({ en: 'The wallet shows you 12 words (your seed phrase). Write them on paper in order. This is the ONE thing you must never lose or share.', de: 'Die Wallet zeigt dir 12 Wörter (deine Seed Phrase). Schreib sie in Reihenfolge auf Papier. Das ist das EINE, das du nie verlieren oder teilen darfst.' }, lang)}
                  </p>
                  <InfoBox icon="🚫" color="#EF4444">{tr({ en: 'No screenshots, no cloud, no typing it into websites. Anyone with your seed owns your coins.', de: 'Keine Screenshots, keine Cloud, nie auf Webseiten eintippen. Wer deine Seed hat, besitzt deine Coins.' }, lang)}</InfoBox>
                </Step>

                <Step n={3} title={tr({ en: 'Find your Taproot address', de: 'Deine Taproot-Adresse finden' }, lang)}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tr({ en: 'Your wallet has two addresses: a payment address (bc1q…, pays fees) and an Ordinals/Taproot address (bc1p…, receives inscriptions).', de: 'Deine Wallet hat zwei Adressen: eine Zahlungs-Adresse (bc1q…, zahlt Gebühren) und eine Ordinals-/Taproot-Adresse (bc1p…, empfängt Inscriptions).' }, lang)}
                  </p>
                </Step>

                <Step n={4} title={tr({ en: 'Fund your wallet', de: 'Wallet aufladen' }, lang)}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tr({ en: 'Send a small amount of BTC to your payment address (e.g. from an exchange). You only need enough for postage + network fees.', de: 'Sende einen kleinen BTC-Betrag an deine Zahlungs-Adresse (z. B. von einer Börse). Du brauchst nur genug für Postage + Netzwerkgebühren.' }, lang)}
                  </p>
                  {mode === 'virtual' && <InfoBox icon="🧪" color="#2563EB">{tr({ en: 'In practice mode, tap “Receive test sats”.', de: 'Im Übungsmodus tippe auf „Test-Sats erhalten".' }, lang)}</InfoBox>}
                </Step>

                <Step n={5} title={tr({ en: 'Inscribe: title, content, fee', de: 'Einschreiben: Titel, Inhalt, Fee' }, lang)}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tr({ en: 'Give it a title, add your content (text or a small image), pick a fee rate, and confirm. Your wallet pays; the content is written onto a satoshi.', de: 'Gib einen Titel, füge deinen Inhalt hinzu (Text oder kleines Bild), wähle eine Gebühr und bestätige. Deine Wallet zahlt; der Inhalt wird auf einen Satoshi geschrieben.' }, lang)}
                  </p>
                  <InfoBox icon="⛽" color={BTC}>{tr({ en: 'Higher fee = faster confirmation. Bigger content = more expensive. Keep it small to keep it cheap.', de: 'Höhere Fee = schnellere Bestätigung. Größerer Inhalt = teurer. Klein halten = günstig.' }, lang)}</InfoBox>
                </Step>

                <Step n={6} title={tr({ en: 'Watch the transaction', de: 'Die Transaktion verfolgen' }, lang)}>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {tr({ en: 'After you confirm, the transaction is broadcast to the mempool, then confirmed in a block (~10 min on average). You can track it live.', de: 'Nach dem Bestätigen wird die Transaktion an den Mempool gesendet und dann in einem Block bestätigt (~10 Min im Schnitt). Du kannst sie live verfolgen.' }, lang)}
                  </p>
                  <TxExplainer lang={lang} stage="idle" virtual={mode === 'virtual'} />
                </Step>
              </Card>
              )}
            </div>

            {/* Right: interactive tool */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              {mode === 'virtual' ? (
                <Card>
                  <div className="mb-4 text-center">
                    <Pill color="#2563EB">🧪 {tr({ en: 'Practice wallet', de: 'Übungs-Wallet' }, lang)}</Pill>
                    <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{tr({ en: 'Try the whole flow safely. Nothing here is real.', de: 'Probiere den ganzen Ablauf gefahrlos. Nichts hier ist echt.' }, lang)}</p>
                  </div>
                  <VirtualXverse lang={lang} onScreenChange={setVScreen} />
                </Card>
              ) : (
                <Card>
                  <div className="mb-4 text-center">
                    <Pill color="#EF4444">🔴 {tr({ en: 'Real inscriber', de: 'Echter Inscriber' }, lang)}</Pill>
                    <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{tr({ en: 'Runs fully in your browser with your own wallet. We never hold your funds.', de: 'Läuft komplett im Browser mit deiner eigenen Wallet. Wir halten nie deine Funds.' }, lang)}</p>
                  </div>
                  <RealInscriber lang={lang} />
                </Card>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t px-5 py-10 text-center" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {tr({ en: 'Art on Bitcoin — Step 2 · Part of', de: 'Art on Bitcoin — Step 2 · Teil von' }, lang)}{' '}
            <button onClick={() => navigate('/')} className="underline" style={{ color: BTC }}>richart.app</button>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default InscribeLabPage;
