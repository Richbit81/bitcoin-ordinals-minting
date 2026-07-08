import React, { useCallback, useEffect, useRef, useState } from 'react';
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
 * Public "Inscribe on Bitcoin" tool (English).
 *
 * A more advanced companion to the guided Ordinals workshop: it runs the full
 * commit → fund → reveal flow client-side via inscriptionBuilder and exposes
 * optional features: Title, Traits/Attributes, Parent inscription and inscribing
 * onto a specific satoshi (manual funding). Xverse only.
 */

const DARK = {
  '--bg': '#0B0B0F', '--card': '#16161C', '--soft': '#1E1E26',
  '--text': '#F5F5F7', '--muted': '#9CA3AF', '--border': '#2A2A33',
  '--shadow': '0 20px 60px -30px rgba(0,0,0,0.8)',
} as React.CSSProperties;
const BTC = '#F7931A';

type TxStage = 'idle' | 'building' | 'mempool' | 'confirmed';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-3xl border p-6 sm:p-7 ${className || ''}`} style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
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
    className={`rounded-full px-5 py-2.5 text-sm font-bold transition hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed ${className || ''}`}
    style={variant === 'primary' ? { background: BTC, color: '#000' } : { background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}
  >
    {children}
  </button>
);

const label = "block text-[11px] font-semibold uppercase tracking-wider";
const input = "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: 'var(--border)', background: 'var(--soft)', color: 'var(--text)' } as React.CSSProperties;

// Collapsible feature toggle
const Feature: React.FC<{ on: boolean; onToggle: () => void; title: string; desc: string; children?: React.ReactNode }> = ({ on, onToggle, title, desc, children }) => (
  <div className="rounded-2xl border p-4" style={{ borderColor: on ? BTC : 'var(--border)', background: on ? `${BTC}0c` : 'var(--soft)' }}>
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={on} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0" style={{ accentColor: BTC }} />
      <div>
        <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{title}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{desc}</div>
      </div>
    </label>
    {on && children && <div className="mt-3 pl-7">{children}</div>}
  </div>
);

const TxStages: React.FC<{ stage: TxStage; txid?: string }> = ({ stage, txid }) => {
  const steps = [
    { key: 'building', icon: '🔨', title: 'Signing', desc: 'Your wallet signs the reveal transaction.' },
    { key: 'mempool', icon: '⏳', title: 'Mempool', desc: 'Broadcast and waiting to be mined. Higher fee = sooner.' },
    { key: 'confirmed', icon: '✅', title: 'Confirmed', desc: 'Included in a block (~10 min on average).' },
  ] as const;
  const order = ['building', 'mempool', 'confirmed'];
  const activeIdx = order.indexOf(stage);
  return (
    <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>🔎 What happens now</div>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const done = activeIdx > i && stage !== 'idle';
          const active = order[activeIdx] === s.key && stage !== 'idle';
          const color = done ? '#22C55E' : active ? BTC : 'var(--border)';
          return (
            <div key={s.key} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: active ? BTC : 'var(--border)', background: active ? `${BTC}10` : 'var(--card)' }}>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: `${color}22`, color }}>{done ? '✓' : s.icon}</span>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.title}{active && <span className="ml-2 animate-pulse" style={{ color: BTC }}>●</span>}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      {txid && (
        <a href={`https://mempool.space/tx/${txid}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>
          🔗 View on mempool.space
        </a>
      )}
    </div>
  );
};

export const InscribeToolPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState, connect } = useWallet();
  const ordAddr = walletState.accounts?.find((a: any) => a.purpose === 'ordinals')?.address || walletState.accounts?.[0]?.address;

  // content
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('gm ₿');
  const [file, setFile] = useState<File | null>(null);

  // optional features
  const [enableTitle, setEnableTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [enableTraits, setEnableTraits] = useState(false);
  const [traits, setTraits] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [enableParent, setEnableParent] = useState(false);
  const [parentIds, setParentIds] = useState('');
  const [enableSat, setEnableSat] = useState(false);
  const [specificSat, setSpecificSat] = useState('');

  // fees
  const [feeRate, setFeeRate] = useState(6);
  const [recFees, setRecFees] = useState<{ economy: number; hour: number; halfHour: number; fastest: number } | null>(null);

  // session / flow
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
      setStatus('Building reveal transaction…');
      const rawTx = buildRevealTransaction(s, commitTxid, commitVout, commitAmount);
      setStatus('Broadcasting…');
      const revealTxid = await broadcastTransaction(rawTx);
      setSession({ ...s, status: 'revealed', revealTxid, inscriptionId: `${revealTxid}i0` });
      setTxStage('mempool');
      setStatus('');
    } catch (e: any) {
      setError(`Reveal failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const startPolling = useCallback((s: InscriptionSession) => {
    setTxStage('building');
    const poll = async () => {
      try {
        const r = await checkCommitFunding(s.commitAddress);
        if (r.funded && r.txid) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('Payment detected — inscribing…');
          await doReveal(s, r.txid, r.vout ?? 0, r.amount ?? s.requiredAmount);
        }
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = window.setInterval(poll, 5000);
  }, [doReveal]);

  const buildBody = useCallback(async (): Promise<{ contentType: string; body: Uint8Array }> => {
    if (mode === 'file' && file) {
      const buf = new Uint8Array(await file.arrayBuffer());
      return { contentType: detectContentType(file.name, buf), body: buf };
    }
    return { contentType: 'text/plain;charset=utf-8', body: new TextEncoder().encode(text) };
  }, [mode, file, text]);

  const handleCreate = useCallback(async () => {
    setError('');
    if (!ordAddr || !ordAddr.startsWith('bc1p')) {
      setError('Connect a wallet with a Taproot (bc1p…) address first.');
      return;
    }
    if (mode === 'text' && !text.trim()) { setError('Enter some text to inscribe.'); return; }
    if (mode === 'file' && !file) { setError('Choose a file to inscribe.'); return; }
    if (enableSat && !/^\d+$/.test(specificSat.trim())) { setError('Enter a valid satoshi number (digits only).'); return; }
    try {
      setBusy(true);
      setStatus('Preparing inscription…');
      const { contentType, body } = await buildBody();
      const validTraits = traits.filter((t) => t.key.trim() && t.value.trim());
      const metadata = encodeMetadataAsCBOR(
        enableTitle && title.trim() ? title.trim() : undefined,
        enableTraits && validTraits.length > 0 ? validTraits : undefined,
      );
      const parents = enableParent
        ? parentIds.split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0)
        : [];
      const opts: InscriptionOptions = {
        contentType,
        body,
        metadata,
        parentIds: parents.length > 0 ? parents : undefined,
      };
      const s = createInscriptionCommit([opts], Math.max(1, feeRate), ordAddr);
      setSession(s);
      setStatus('');
      setBusy(false);
      // Manual funding is required for specific-sat inscriptions; otherwise poll immediately.
      startPolling(s);
    } catch (e: any) {
      setError(e?.message || String(e));
      setBusy(false);
      setTxStage('idle');
    }
  }, [ordAddr, mode, text, file, enableTitle, title, enableTraits, traits, enableParent, parentIds, enableSat, specificSat, feeRate, buildBody, startPolling]);

  const handlePayWithWallet = useCallback(async () => {
    if (!session) return;
    setError('');
    try {
      setBusy(true);
      setStatus('Opening wallet for payment…');
      const satsConnect = await import('sats-connect');
      const resp: any = await (satsConnect as any).request('sendTransfer', {
        recipients: [{ address: session.commitAddress, amount: session.requiredAmount }],
      });
      if (resp?.status !== 'success') throw new Error(resp?.error?.message || 'Payment rejected');
      setStatus('Payment sent — waiting for it in the mempool…');
    } catch (e: any) {
      const m = e?.message || String(e);
      setError(/reject|cancel|denied/i.test(m) ? 'Payment cancelled.' : m);
    } finally {
      setBusy(false);
    }
  }, [session]);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSession(null); setTxStage('idle'); setBusy(false); setStatus(''); setError('');
  }, []);

  const restartAll = useCallback(() => {
    reset();
    setMode('text'); setText('gm ₿'); setFile(null);
    setEnableTitle(false); setTitle('');
    setEnableTraits(false); setTraits([{ key: '', value: '' }]);
    setEnableParent(false); setParentIds('');
    setEnableSat(false); setSpecificSat('');
  }, [reset]);

  const inscriptionId = session?.inscriptionId;
  const activeFeatures = [enableTitle, enableTraits, enableParent, enableSat].filter(Boolean).length;

  return (
    <div style={DARK} className="min-h-screen">
      <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
        {/* Header */}
        <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: 'var(--border)', background: 'rgba(11,11,15,0.72)' }}>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
              <span style={{ color: BTC }}>◆</span> Inscribe on Bitcoin
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/ordinals-explained')} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>
                📚 Learn Ordinals
              </button>
              <button onClick={() => navigate('/')} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--soft)' }}>
                🏠 Home
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-10">
          <div className="mb-6">
            <Pill color="#EF4444">REAL · on-chain</Pill>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl" style={{ color: 'var(--text)' }}>Create a Bitcoin Inscription</h1>
            <p className="mt-2 text-base" style={{ color: 'var(--muted)' }}>
              Inscribe text or a file directly onto a satoshi — fully in your browser. This spends real bitcoin (network fees). New to this? Start with the{' '}
              <button onClick={() => navigate('/ordinals-explained')} className="underline" style={{ color: BTC }}>guided walkthrough</button>.
            </p>
          </div>

          {/* Wallet */}
          <Card className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Pill>Wallet</Pill>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Xverse · Taproot</span>
              </div>
              <button onClick={restartAll} title="Start over" className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>↺ Restart</button>
            </div>
            {!ordAddr ? (
              <div className="mt-4">
                <p className="mb-3 text-sm" style={{ color: 'var(--text)' }}>Connect your Xverse wallet to inscribe to your own Taproot address:</p>
                <Btn onClick={() => connect('xverse' as any).catch((e: any) => setError(e?.message || 'Xverse connection failed'))}>Connect Xverse</Btn>
                <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>Don&apos;t have it yet? <a href="https://www.xverse.app" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: BTC }}>xverse.app ↗</a></p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Inscription goes to</div>
                <div className="break-all font-mono text-xs" style={{ color: 'var(--text)' }}>{ordAddr}</div>
              </div>
            )}
          </Card>

          {ordAddr && !session && (
            <>
              {/* 1. Content */}
              <Card className="mb-5">
                <div className="mb-3 flex items-center gap-2"><Pill>1 · Content</Pill></div>
                <div className="flex gap-2">
                  {(['text', 'file'] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className="rounded-full px-4 py-1.5 text-xs font-bold" style={{ background: mode === m ? BTC : 'var(--soft)', color: mode === m ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
                      {m === 'text' ? 'Text' : 'File (image / HTML / …)'}
                    </button>
                  ))}
                </div>
                {mode === 'text' ? (
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={`${input} mt-3`} style={inputStyle} placeholder="Type anything — a message, JSON, SVG, HTML…" />
                ) : (
                  <div className="mt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>
                      Choose file
                      <input type="file" accept="image/*,text/html,text/plain,image/svg+xml,application/json" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                    </label>
                    <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>{file ? file.name : 'No file selected'}</span>
                    {file && <p className="mt-1 text-[11px]" style={{ color: file.size > 100_000 ? '#EF4444' : 'var(--muted)' }}>{(file.size / 1024).toFixed(1)} KB {file.size > 100_000 ? '(large → high fees!)' : ''}</p>}
                  </div>
                )}
              </Card>

              {/* 2. Optional features */}
              <Card className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                  <Pill>2 · Optional features</Pill>
                  {activeFeatures > 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>{activeFeatures} enabled</span>}
                </div>
                <div className="flex flex-col gap-3">
                  <Feature on={enableTitle} onToggle={() => setEnableTitle((v) => !v)} title="Add a title" desc="A name for your inscription, stored in on-chain metadata.">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} style={inputStyle} placeholder="My first inscription" />
                  </Feature>

                  <Feature on={enableTraits} onToggle={() => setEnableTraits((v) => !v)} title="Traits / attributes" desc="Key–value pairs stored as metadata (e.g. Artist, Collection).">
                    <div className="flex flex-col gap-2">
                      {traits.map((t, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={t.key} onChange={(e) => setTraits((arr) => arr.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} className={`${input} mt-0`} style={inputStyle} placeholder="Trait (e.g. Artist)" />
                          <input value={t.value} onChange={(e) => setTraits((arr) => arr.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className={`${input} mt-0`} style={inputStyle} placeholder="Value (e.g. RichArt)" />
                          <button onClick={() => setTraits((arr) => arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)} className="shrink-0 rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => setTraits((arr) => [...arr, { key: '', value: '' }])} className="self-start rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>+ Add trait</button>
                    </div>
                  </Feature>

                  <Feature on={enableParent} onToggle={() => setEnableParent((v) => !v)} title="Parent inscription" desc="Create this as a child of one or more parent inscriptions (provenance).">
                    <input value={parentIds} onChange={(e) => setParentIds(e.target.value)} className={input} style={inputStyle} placeholder="parent inscription id(s), comma-separated" />
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>You must own the parent inscription in this wallet for the child to be valid.</p>
                  </Feature>

                  <Feature on={enableSat} onToggle={() => setEnableSat((v) => !v)} title="Inscribe on a specific SAT" desc="Bind the inscription to a chosen satoshi (e.g. a rare sat). Requires manual funding.">
                    <input value={specificSat} onChange={(e) => setSpecificSat(e.target.value.replace(/[^\d]/g, ''))} className={input} style={inputStyle} placeholder="satoshi number, e.g. 1234567890" inputMode="numeric" />
                    <InfoBox icon="⚠️" color="#EF4444">
                      Sat-specific inscribing can&apos;t use the automatic “Pay with wallet” button. After creating the commit, you must manually send the UTXO that contains sat #{specificSat || '…'} to the commit address (with enough value to cover fees). The inscription lands on the first sat of that UTXO.
                    </InfoBox>
                  </Feature>
                </div>
              </Card>

              {/* 3. Fee */}
              <Card className="mb-5">
                <div className="mb-3 flex items-center gap-2"><Pill>3 · Network fee</Pill></div>
                <label className={label} style={{ color: 'var(--muted)' }}>
                  <span className="flex items-center justify-between"><span>Fee rate</span><span style={{ color: BTC }}>{feeRate} sat/vB</span></span>
                </label>
                <input type="range" min={1} max={Math.max(50, recFees?.fastest ?? 50)} value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} className="mt-2 w-full" style={{ accentColor: BTC }} />
                {recFees && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {([['eco', recFees.economy], ['~1h', recFees.hour], ['~30m', recFees.halfHour], ['fast', recFees.fastest]] as [string, number][]).map(([lbl, v]) => (
                      <button key={lbl} onClick={() => setFeeRate(Math.max(1, v))} className="rounded-full px-2 py-0.5" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>{lbl} {v}</button>
                    ))}
                  </div>
                )}
                <InfoBox icon="⚠️" color="#EF4444">This spends real bitcoin. Start with a small fee rate and short content to keep it cheap. Total cost ≈ fee rate × transaction size + 546 sats postage.</InfoBox>
                <Btn className="mt-4 w-full" disabled={busy} onClick={handleCreate}>{busy ? (status || 'Working…') : 'Create inscription →'}</Btn>
              </Card>
            </>
          )}

          {/* Funding / progress */}
          {session && !inscriptionId && (
            <Card className="mb-5">
              <div className="mb-3 flex items-center justify-between">
                <Pill color="#22C55E">Commit created</Pill>
                <button onClick={restartAll} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>↺ Restart</button>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Fund the commit address with <strong style={{ color: 'var(--text)' }}>{session.requiredAmount.toLocaleString()} sats</strong>. We watch the mempool and inscribe automatically once the payment arrives.</p>
              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--soft)' }}>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Commit address</div>
                <div className="break-all font-mono text-xs" style={{ color: 'var(--text)' }}>{session.commitAddress}</div>
              </div>

              {enableSat ? (
                <InfoBox icon="🎯" color={BTC}>
                  <strong>Manual funding required.</strong> Send the UTXO that contains sat #{specificSat} to the commit address above (value ≥ {session.requiredAmount.toLocaleString()} sats). Do not use the automatic button — it wouldn&apos;t select your chosen sat.
                </InfoBox>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Btn disabled={busy} onClick={handlePayWithWallet}>{busy ? (status || 'Working…') : `Pay ${session.requiredAmount.toLocaleString()} sats with wallet`}</Btn>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>or send the amount to the address above manually</span>
                </div>
              )}

              {txStage !== 'idle' && <TxStages stage={txStage} txid={session.revealTxid} />}
            </Card>
          )}

          {/* Result */}
          {inscriptionId && (
            <Card className="mb-5">
              <div className="rounded-2xl border p-5 text-center" style={{ borderColor: BTC, background: `${BTC}12` }}>
                <div className="text-4xl">🎉</div>
                <div className="mt-1 text-lg font-black" style={{ color: 'var(--text)' }}>Inscription broadcast!</div>
                <div className="mt-2 break-all font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{inscriptionId}</div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <a href={`https://ordinals.com/inscription/${inscriptionId}`} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: BTC, color: '#000' }}>View inscription ↗</a>
                  {session?.revealTxid && <a href={`https://mempool.space/tx/${session.revealTxid}`} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>Transaction ↗</a>}
                  <button onClick={restartAll} className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: 'var(--soft)', color: 'var(--text)', border: '1px solid var(--border)' }}>Inscribe another</button>
                </div>
                <p className="mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>It may take a few minutes to confirm and appear in explorers.</p>
              </div>
            </Card>
          )}

          {status && !error && !inscriptionId && <p className="text-sm" style={{ color: BTC }}>{status}</p>}
          {error && <p className="mt-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#EF444455', background: '#EF444412', color: '#FCA5A5' }}>{error}</p>}
        </main>
      </div>
    </div>
  );
};

export default InscribeToolPage;
