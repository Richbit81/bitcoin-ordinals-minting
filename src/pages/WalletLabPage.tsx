import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeWallet, SEED_WORDS, rand } from './practiceWallet';

/**
 * "Art on Bitcoin — Step 2: Create your wallet"
 *
 * The wallet-creation half of the old Step 2. It creates a persisted practice
 * wallet (seed backup + confirm), then hands off to Step 3 for inscribing.
 * Bilingual (EN default / DE), dark by default. Pure simulation.
 */

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

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-3xl border p-6 sm:p-8 ${className || ''}`} style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
    {children}
  </div>
);
const Pill: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = BTC }) => (
  <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>{children}</span>
);
const InfoBox: React.FC<{ children: React.ReactNode; icon?: string; color?: string }> = ({ children, icon = '💡', color = BTC }) => (
  <div className="mt-4 flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: `${color}55`, background: `${color}12` }}>
    <span className="mt-0.5 text-lg" aria-hidden>{icon}</span>
    <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{children}</div>
  </div>
);
const Btn: React.FC<{ onClick?: () => void; disabled?: boolean; children: React.ReactNode; variant?: 'primary' | 'ghost'; className?: string }> = ({ onClick, disabled, children, variant = 'primary', className }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={`rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${className || ''}`}
    style={variant === 'primary' ? { background: BTC, color: '#000' } : { background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>
    {children}
  </button>
);

type WScreen = 'welcome' | 'seed' | 'confirm' | 'home';

const WStepDef: { screen: WScreen; title: L; body: L; tip?: { icon: string; color: string; text: L } }[] = [
  { screen: 'welcome', title: { en: '1 · Get a wallet', de: '1 · Wallet holen' }, body: { en: 'Xverse is a beginner-friendly wallet made for Ordinals. Here you use a safe practice wallet — just tap “Create new wallet”.', de: 'Xverse ist eine anfängerfreundliche Wallet für Ordinals. Hier nutzt du eine gefahrlose Übungs-Wallet — tippe einfach auf „Neue Wallet erstellen".' }, tip: { icon: '🧪', color: '#2563EB', text: { en: 'For the real thing later, install it only from xverse.app.', de: 'Für den Ernstfall später: nur von xverse.app installieren.' } } },
  { screen: 'seed', title: { en: '2 · Save your seed phrase', de: '2 · Seed Phrase sichern' }, body: { en: 'The wallet shows 12 words. Write them on paper, in order. These 12 words ARE your wallet.', de: 'Die Wallet zeigt 12 Wörter. Schreib sie in Reihenfolge auf Papier. Diese 12 Wörter SIND deine Wallet.' }, tip: { icon: '🚫', color: '#EF4444', text: { en: 'Never screenshot, cloud-save or share them.', de: 'Nie screenshotten, in der Cloud speichern oder teilen.' } } },
  { screen: 'confirm', title: { en: '3 · Confirm your backup', de: '3 · Backup bestätigen' }, body: { en: 'Pick the correct word for each requested position. This proves you really wrote them down.', de: 'Wähle für jede abgefragte Position das richtige Wort. So beweist du, dass du sie wirklich notiert hast.' } },
  { screen: 'home', title: { en: '4 · Your wallet is ready', de: '4 · Deine Wallet ist bereit' }, body: { en: 'Your wallet has a Taproot address (bc1p…, receives inscriptions) and a payment address (bc1q…, pays fees). It is saved in your browser — continue to Step 3 to inscribe.', de: 'Deine Wallet hat eine Taproot-Adresse (bc1p…, empfängt Inscriptions) und eine Zahlungs-Adresse (bc1q…, zahlt Gebühren). Sie ist im Browser gespeichert — weiter zu Step 3 zum Einschreiben.' } },
];

const WalletGuide: React.FC<{ lang: Lang; screen: WScreen }> = ({ lang, screen }) => {
  const idx = Math.max(0, WStepDef.findIndex((s) => s.screen === screen));
  const step = WStepDef[idx];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Pill color="#2563EB">🧪 {tr({ en: 'Wallet guide', de: 'Wallet-Anleitung' }, lang)}</Pill>
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{tr({ en: 'Step', de: 'Schritt' }, lang)} {idx + 1} / {WStepDef.length}</span>
      </div>
      <div className="mt-4 flex gap-1.5">
        {WStepDef.map((_, i) => (
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

const AddrRow: React.FC<{ label: string; addr: string; tag: string; color: string }> = ({ label, addr, tag, color }) => (
  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</span>
      <Pill color={color}>{tag}</Pill>
    </div>
    <div className="mt-1 break-all font-mono text-xs" style={{ color: 'var(--text)' }}>{addr}</div>
  </div>
);

const WalletApp: React.FC<{ lang: Lang; onScreenChange?: (s: WScreen) => void }> = ({ lang, onScreenChange }) => {
  const navigate = useNavigate();
  const { wallet, createWallet, patchWallet, resetWallet } = usePracticeWallet();
  const [screen, setScreen] = useState<WScreen>(wallet ? 'home' : 'welcome');
  const [seedRevealed, setSeedRevealed] = useState(false);
  const [wroteDown, setWroteDown] = useState(false);
  const [challenge, setChallenge] = useState<{ pos: number; options: string[]; picked: number | null }[]>([]);

  React.useEffect(() => { onScreenChange?.(screen); }, [screen, onScreenChange]);

  const seed = wallet?.seed ?? [];

  const startCreate = () => {
    createWallet();
    setSeedRevealed(false);
    setWroteDown(false);
    setScreen('seed');
  };

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

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="overflow-hidden rounded-[2rem] border-4 shadow-2xl" style={{ borderColor: '#000', background: 'var(--card)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(90deg,#1a1a1a,#2a2320)' }}>
          <span className="text-sm font-black" style={{ color: BTC }}>✦ Practice Wallet</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#fff' }}>{tr({ en: 'Xverse-style', de: 'Xverse-Stil' }, lang)}</span>
        </div>

        <div className="p-4" style={{ minHeight: 420 }}>
          {screen === 'welcome' && (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 text-5xl">👛</div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{tr({ en: 'Welcome', de: 'Willkommen' }, lang)}</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{tr({ en: 'Create a practice wallet — no real money involved.', de: 'Erstelle eine Übungs-Wallet — kein echtes Geld im Spiel.' }, lang)}</p>
              <Btn className="mt-6" onClick={startCreate}>{tr({ en: 'Create new wallet', de: 'Neue Wallet erstellen' }, lang)}</Btn>
            </div>
          )}

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

          {screen === 'home' && wallet && (
            <div>
              <div className="rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
                <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{tr({ en: 'Balance', de: 'Guthaben' }, lang)}</div>
                <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>{wallet.balance.toLocaleString()} <span className="text-sm" style={{ color: BTC }}>sats</span></div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <AddrRow label={tr({ en: 'Ordinals address', de: 'Ordinals-Adresse' }, lang)} addr={wallet.ordAddr} tag="Taproot" color={BTC} />
                <AddrRow label={tr({ en: 'Payment address', de: 'Zahlungs-Adresse' }, lang)} addr={wallet.payAddr} tag="SegWit" color="#22C55E" />
              </div>
              <InfoBox icon="🎯" color="#2563EB">
                {tr({ en: 'Inscriptions go to your Taproot (bc1p…) address. Fees are paid from the payment address.', de: 'Inscriptions gehen an deine Taproot- (bc1p…) Adresse. Gebühren werden von der Zahlungs-Adresse bezahlt.' }, lang)}
              </InfoBox>
              <Btn variant="ghost" className="mt-3 w-full" onClick={() => patchWallet((w) => ({ ...w, balance: w.balance + 25000 }))}>＋ {tr({ en: 'Receive test sats', de: 'Test-Sats erhalten' }, lang)}</Btn>

              {wallet.inscriptions.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{tr({ en: 'Collectibles', de: 'Sammlerstücke' }, lang)}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {wallet.inscriptions.map((it) => (
                      <div key={it.txid} className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
                        <img src={it.img} alt={it.title || 'inscription'} className="aspect-square w-full object-cover" style={{ imageRendering: 'pixelated' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => { resetWallet(); setScreen('welcome'); }} className="mt-4 w-full text-xs underline" style={{ color: 'var(--muted)' }}>
                {tr({ en: 'Create a fresh wallet', de: 'Neue Wallet erstellen' }, lang)}
              </button>
            </div>
          )}
        </div>
      </div>

      {screen === 'home' && wallet && (
        <div className="mt-4 rounded-3xl border p-5 text-center" style={{ borderColor: BTC, background: `${BTC}12` }}>
          <div className="text-sm font-black" style={{ color: 'var(--text)' }}>✅ {tr({ en: 'Wallet ready & saved', de: 'Wallet bereit & gespeichert' }, lang)}</div>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{tr({ en: 'You won’t need to recreate it — it stays in this browser.', de: 'Du musst sie nicht neu erstellen — sie bleibt in diesem Browser.' }, lang)}</p>
          <Btn className="mt-3" onClick={() => navigate('/ordinals-explained/step-3')}>{tr({ en: 'Continue to Step 3 — Inscribe →', de: 'Weiter zu Step 3 — Einschreiben →' }, lang)}</Btn>
        </div>
      )}

      <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
        🧪 {tr({ en: 'Simulation — no real wallet, seed or funds.', de: 'Simulation — keine echte Wallet, Seed oder Funds.' }, lang)}
      </p>
    </div>
  );
};

export const WalletLabPage: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('en');
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState<WScreen>('welcome');
  const theme = dark ? DARK : LIGHT;

  return (
    <div style={theme} className="min-h-screen">
      <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
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

        <section className="px-5 pt-14 pb-6 text-center">
          <div className="mx-auto max-w-3xl">
            <Pill>{tr({ en: 'Step 2', de: 'Step 2' }, lang)}</Pill>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--text)' }}>{tr({ en: 'Create your wallet', de: 'Erstelle deine Wallet' }, lang)}</h1>
            <p className="mx-auto mt-3 max-w-xl text-base" style={{ color: 'var(--muted)' }}>
              {tr({ en: 'Set up a safe practice wallet: back up the seed phrase and get your addresses. It is saved so you can jump straight to inscribing in Step 3 anytime.', de: 'Richte eine gefahrlose Übungs-Wallet ein: sichere die Seed Phrase und hol dir deine Adressen. Sie wird gespeichert, damit du in Step 3 jederzeit direkt einschreiben kannst.' }, lang)}
            </p>
          </div>
        </section>

        <div className="mx-auto mb-6 max-w-3xl px-5">
          <div className="flex flex-col items-start gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: `${BTC}55`, background: `${BTC}12` }}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg" aria-hidden>💡</span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                {tr({ en: 'Only do the hands-on part once you understand the basics (wallet, seed phrase, fees, inscriptions). If anything is unclear, go through Step 1 first.', de: 'Mach den Praxis-Teil erst, wenn du die Basics verstanden hast (Wallet, Seed Phrase, Fees, Inscriptions). Wenn etwas unklar ist, geh zuerst durch Step 1.' }, lang)}
              </p>
            </div>
            <button onClick={() => navigate('/ordinals-explained')} className="shrink-0 rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>
              {tr({ en: '← Review Step 1', de: '← Step 1 ansehen' }, lang)}
            </button>
          </div>
        </div>

        <main className="mx-auto max-w-5xl px-5 pb-20">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div><WalletGuide lang={lang} screen={screen} /></div>
            <div><WalletApp lang={lang} onScreenChange={setScreen} /></div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WalletLabPage;
