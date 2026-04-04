import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as btc from '@scure/btc-signer';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { getOrdinalAddress, signPSBT, pushPsbt } from '../utils/wallet';
import {
  fetchUtxos, analyzeUtxo, fetchFeeRates, buildSplitPsbt, computeSplitOutputs, broadcastTx,
  SAT_TYPE_META, formatSatNumber, satsToBtc,
  PARASITE_BLOCK, PARASITE_SAT_START, PARASITE_SAT_END,
  type Utxo, type AnalyzedUtxo, type SplitOutput, type FeeRates, type SatType,
} from '../services/rareSatService';

const ORD_SERVER_URL = String(import.meta.env.VITE_ORD_SERVER_URL || '').replace(/\/+$/, '');

type Step = 'scan' | 'analyze' | 'split' | 'signing' | 'done';

function TypeBadge({ type }: { type: SatType }) {
  const meta = SAT_TYPE_META[type];
  if (!meta) return null;
  return (
    <span
      className="mr-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}44` }}
    >
      {meta.symbol} {meta.label}
    </span>
  );
}

function FeeSelector({ feeRates, selected, onChange }: {
  feeRates: FeeRates | null;
  selected: number;
  onChange: (v: number) => void;
}) {
  const [custom, setCustom] = useState('');
  const presets = feeRates ? [
    { label: 'Low', sub: '~1h', value: feeRates.hour },
    { label: 'Medium', sub: '~30m', value: feeRates.halfHour },
    { label: 'High', sub: '~10m', value: feeRates.fastest },
  ] : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button
          key={p.label}
          onClick={() => { onChange(p.value); setCustom(''); }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition
            ${selected === p.value && !custom
              ? 'border-purple-500 bg-purple-500/20 text-purple-300'
              : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'}`}
        >
          {p.label}<br /><span className="text-[10px] font-normal">{p.value} sat/vB · {p.sub}</span>
        </button>
      ))}
      <div className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1">
        <input
          type="number"
          min={1}
          placeholder="Custom"
          className="w-16 bg-transparent text-xs text-white outline-none"
          value={custom}
          onChange={e => {
            setCustom(e.target.value);
            const v = parseInt(e.target.value);
            if (v > 0) onChange(v);
          }}
        />
        <span className="text-[10px] text-gray-500">sat/vB</span>
      </div>
    </div>
  );
}

export const RareSatSplitterPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const accounts = walletState.accounts || [];
  const ordinalAddress = getOrdinalAddress(accounts);
  const isAdmin = walletState.connected && isAdminAddress(accounts[0]?.address);

  const [step, setStep] = useState<Step>('scan');
  const [manualAddress, setManualAddress] = useState('');
  const [manualUtxo, setManualUtxo] = useState('');
  const [utxos, setUtxos] = useState<Utxo[]>([]);
  const [analyzedUtxos, setAnalyzedUtxos] = useState<AnalyzedUtxo[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [feeRates, setFeeRates] = useState<FeeRates | null>(null);
  const [feeRate, setFeeRate] = useState(1);
  const [assetsPerUtxo, setAssetsPerUtxo] = useState(1);
  const [destAddress, setDestAddress] = useState('');
  const [splitOutputs, setSplitOutputs] = useState<SplitOutput[]>([]);
  const [splitFee, setSplitFee] = useState(0);
  const [splitError, setSplitError] = useState('');
  const [txid, setTxid] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  useEffect(() => {
    fetchFeeRates().then(r => { setFeeRates(r); setFeeRate(r.hour); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (ordinalAddress) {
      setDestAddress(ordinalAddress);
      setManualAddress(ordinalAddress);
    }
  }, [ordinalAddress]);

  const scanWallet = useCallback(async (address?: string) => {
    const addr = address || manualAddress;
    if (!addr) { setError('No address provided'); return; }
    setLoading(true);
    setLoadingMsg('Fetching UTXOs...');
    setError('');
    setAnalyzedUtxos([]);
    setSelectedIdx(null);
    abortRef.current = false;

    try {
      const rawUtxos = await fetchUtxos(addr);
      setUtxos(rawUtxos);
      setLoadingMsg(`Analyzing ${rawUtxos.length} UTXOs...`);
      setScanProgress({ current: 0, total: rawUtxos.length });

      if (!ORD_SERVER_URL) {
        setError('ORD_SERVER_URL not configured. Sat range detection unavailable.');
        setStep('analyze');
        setLoading(false);
        return;
      }

      const analyzed: AnalyzedUtxo[] = [];
      for (let i = 0; i < rawUtxos.length; i++) {
        if (abortRef.current) break;
        setLoadingMsg(`Analyzing UTXO ${i + 1}/${rawUtxos.length}...`);
        setScanProgress({ current: i + 1, total: rawUtxos.length });
        try {
          const a = await analyzeUtxo(rawUtxos[i], ORD_SERVER_URL);
          analyzed.push(a);
        } catch {
          analyzed.push({
            ...rawUtxos[i], satRanges: [], rareSatGroups: [], totalRareSats: 0,
            inscriptions: [], scriptPubKey: '', address: addr, satRangesAvailable: false,
          });
        }
      }

      analyzed.sort((a, b) => b.totalRareSats - a.totalRareSats);
      setAnalyzedUtxos(analyzed);
      setStep('analyze');
    } catch (e: any) {
      setError(e.message || 'Scan failed');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }, [manualAddress]);

  const scanSingleUtxo = useCallback(async () => {
    const parts = manualUtxo.split(':');
    if (parts.length !== 2) { setError('Format: txid:vout'); return; }
    const [txid, voutStr] = parts;
    const vout = parseInt(voutStr);
    if (!txid || isNaN(vout)) { setError('Invalid UTXO format'); return; }

    setLoading(true);
    setLoadingMsg('Analyzing UTXO...');
    setError('');

    try {
      const utxo: Utxo = { txid, vout, value: 0, status: { confirmed: true } };
      const analyzed = await analyzeUtxo(utxo, ORD_SERVER_URL);
      setAnalyzedUtxos([analyzed]);
      setStep('analyze');
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [manualUtxo]);

  const selectUtxo = useCallback((idx: number) => {
    setSelectedIdx(idx);
    const utxo = analyzedUtxos[idx];
    if (!utxo) return;

    if (utxo.rareSatGroups.length > 0 && destAddress) {
      const result = computeSplitOutputs(utxo, destAddress, assetsPerUtxo, feeRate);
      setSplitOutputs(result.outputs);
      setSplitFee(result.fee);
      setSplitError(result.error || '');
    }
    setStep('split');
  }, [analyzedUtxos, destAddress, assetsPerUtxo, feeRate]);

  useEffect(() => {
    if (selectedIdx !== null && analyzedUtxos[selectedIdx] && destAddress) {
      const result = computeSplitOutputs(analyzedUtxos[selectedIdx], destAddress, assetsPerUtxo, feeRate);
      setSplitOutputs(result.outputs);
      setSplitFee(result.fee);
      setSplitError(result.error || '');
    }
  }, [selectedIdx, destAddress, assetsPerUtxo, feeRate, analyzedUtxos]);

  const executeSplit = useCallback(async () => {
    if (selectedIdx === null) return;
    const utxo = analyzedUtxos[selectedIdx];
    if (!utxo || splitOutputs.length === 0) return;

    setStep('signing');
    setError('');
    setLoadingMsg('Building PSBT...');

    try {
      const psbtBytes = buildSplitPsbt({
        utxo: { txid: utxo.txid, vout: utxo.vout, value: utxo.value, scriptPubKey: utxo.scriptPubKey },
        outputs: splitOutputs,
        feeRate,
      });

      const psbtBase64 = btoa(String.fromCharCode(...psbtBytes));
      setLoadingMsg('Please sign the transaction in your wallet...');

      const walletType = walletState.walletType as 'unisat' | 'xverse' | 'okx';
      const signedPsbt = await signPSBT(psbtBase64, walletType, true);

      setLoadingMsg('Broadcasting transaction...');

      let resultTxid: string;
      try {
        resultTxid = await pushPsbt(signedPsbt, walletType);
      } catch {
        const signedHex = Array.from(atob(signedPsbt), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
        const tx = btc.Transaction.fromPSBT(hexToBytes(signedHex));
        tx.finalize();
        resultTxid = await broadcastTx(Array.from(tx.extract()).map(b => b.toString(16).padStart(2, '0')).join(''));
      }

      setTxid(resultTxid);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
      setStep('split');
    } finally {
      setLoadingMsg('');
    }
  }, [selectedIdx, analyzedUtxos, splitOutputs, feeRate, walletState.walletType]);

  if (!walletState.connected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Rare Sat Splitter</h1>
          <p className="text-gray-400">Connect your wallet to use this tool.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Access Denied</h1>
          <p className="mb-4 text-gray-400">Admin wallet required.</p>
          <button onClick={() => navigate('/')} className="rounded-lg bg-purple-600 px-4 py-2 text-sm">Back to Home</button>
        </div>
      </div>
    );
  }

  const selected = selectedIdx !== null ? analyzedUtxos[selectedIdx] : null;
  const rareCount = analyzedUtxos.reduce((s, u) => s + u.totalRareSats, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800">
              ← Back
            </button>
            <h1 className="text-xl font-bold">
              <span className="text-purple-400">◈</span> Rare Sat Splitter
            </h1>
          </div>
          <div className="text-xs text-gray-500">
            {ordinalAddress && <span>Wallet: {ordinalAddress.slice(0, 8)}...{ordinalAddress.slice(-4)}</span>}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Scan Section */}
        {(step === 'scan' || step === 'analyze') && (
          <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-300">Scan for Rare Sats</h2>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">Wallet Address</label>
                <input
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  placeholder="bc1p..."
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={() => scanWallet()}
                disabled={loading || !manualAddress}
                className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-40"
              >
                {loading ? 'Scanning...' : 'Scan Wallet'}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">Or enter specific UTXO</label>
                <input
                  value={manualUtxo}
                  onChange={e => setManualUtxo(e.target.value)}
                  placeholder="txid:vout"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={scanSingleUtxo}
                disabled={loading || !manualUtxo}
                className="rounded-lg border border-purple-500 bg-transparent px-5 py-2 text-sm font-semibold text-purple-400 transition hover:bg-purple-500/10 disabled:opacity-40"
              >
                Analyze UTXO
              </button>
            </div>

            {loading && (
              <div className="mt-4">
                <p className="text-xs text-gray-400">{loadingMsg}</p>
                {scanProgress.total > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all"
                      style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {step !== 'scan' && analyzedUtxos.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            {/* UTXO List */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-300">UTXOs ({analyzedUtxos.length})</h2>
                {rareCount > 0 && (
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                    {rareCount} rare sat{rareCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-1">
                {analyzedUtxos.map((u, i) => (
                  <button
                    key={`${u.txid}:${u.vout}`}
                    onClick={() => selectUtxo(i)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedIdx === i
                        ? 'border-purple-500 bg-purple-500/10'
                        : u.totalRareSats > 0
                          ? 'border-yellow-600/30 bg-yellow-900/10 hover:border-yellow-500/50'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-400">
                        {u.txid.slice(0, 8)}...:{u.vout}
                      </span>
                      <span className="text-xs font-semibold text-white">{formatSatNumber(u.value)} sats</span>
                    </div>
                    {u.totalRareSats > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {u.rareSatGroups.slice(0, 5).map((g, gi) => (
                          <span key={gi}>
                            {g.types.slice(0, 2).map(t => <TypeBadge key={t} type={t} />)}
                          </span>
                        ))}
                        {u.rareSatGroups.length > 5 && (
                          <span className="text-[10px] text-gray-500">+{u.rareSatGroups.length - 5} more</span>
                        )}
                      </div>
                    )}
                    {!u.satRangesAvailable && (
                      <p className="mt-1 text-[10px] text-gray-600">Sat ranges unavailable</p>
                    )}
                    {u.inscriptions.length > 0 && (
                      <p className="mt-1 text-[10px] text-amber-500">⚠ {u.inscriptions.length} inscription(s)</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail / Split Panel */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              {!selected ? (
                <div className="flex h-full items-center justify-center text-gray-600">
                  <p>Select a UTXO to view details</p>
                </div>
              ) : (
                <div>
                  {/* UTXO Info */}
                  <h2 className="mb-4 text-sm font-bold text-gray-300">UTXO Details</h2>
                  <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">TXID</span>
                      <p className="mt-0.5 break-all font-mono text-gray-300">{selected.txid}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Output Index</span>
                      <p className="mt-0.5 font-mono text-gray-300">{selected.vout}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Value</span>
                      <p className="mt-0.5 font-semibold text-white">{formatSatNumber(selected.value)} sats ({satsToBtc(selected.value)} BTC)</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Rare Sats</span>
                      <p className="mt-0.5 font-semibold text-purple-300">{selected.totalRareSats}</p>
                    </div>
                  </div>

                  {selected.inscriptions.length > 0 && (
                    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-900/10 px-3 py-2 text-xs text-amber-300">
                      ⚠ This UTXO contains {selected.inscriptions.length} inscription(s). Splitting may affect them.
                    </div>
                  )}

                  {/* Rare Sat Groups */}
                  {selected.rareSatGroups.length > 0 && (
                    <div className="mb-5">
                      <h3 className="mb-2 text-xs font-bold text-gray-400">Rare Sats Found</h3>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {selected.rareSatGroups.map((g, i) => (
                          <div key={i} className="rounded-lg border border-gray-700 bg-gray-800/50 p-2.5">
                            <div className="flex flex-wrap gap-1">
                              {g.types.map(t => <TypeBadge key={t} type={t} />)}
                            </div>
                            <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] text-gray-400">
                              <div>Sat: <span className="text-gray-300">#{formatSatNumber(g.satStart)}</span></div>
                              <div>Block: <span className="text-gray-300">{g.blockHeight.toLocaleString()}</span></div>
                              <div>Count: <span className="text-gray-300">{g.count.toLocaleString()}</span></div>
                            </div>
                            <div className="mt-1 text-[10px] text-gray-500">
                              Offset in UTXO: {g.offsetStart}–{g.offsetEnd}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sat Range Map */}
                  {selected.satRanges.length > 0 && (
                    <div className="mb-5">
                      <h3 className="mb-2 text-xs font-bold text-gray-400">Sat Ranges</h3>
                      <div className="max-h-32 space-y-1 overflow-y-auto text-[10px] font-mono text-gray-500">
                        {selected.satRanges.map((r, i) => (
                          <div key={i}>
                            [{formatSatNumber(r.start)} – {formatSatNumber(r.end)}] ({(r.end - r.start).toLocaleString()} sats)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Split Configuration */}
                  {selected.rareSatGroups.length > 0 && (
                    <div className="border-t border-gray-800 pt-4">
                      <h3 className="mb-3 text-sm font-bold text-gray-300">Split Configuration</h3>

                      <div className="mb-3">
                        <label className="mb-1 block text-xs text-gray-500">Destination Address</label>
                        <input
                          value={destAddress}
                          onChange={e => setDestAddress(e.target.value)}
                          placeholder="bc1p..."
                          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="mb-1 block text-xs text-gray-500">Assets per UTXO</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAssetsPerUtxo(Math.max(1, assetsPerUtxo - 1))}
                            className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-300"
                          >−</button>
                          <span className="w-8 text-center text-sm font-bold">{assetsPerUtxo}</span>
                          <button
                            onClick={() => setAssetsPerUtxo(assetsPerUtxo + 1)}
                            className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-300"
                          >+</button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="mb-1 block text-xs text-gray-500">Fee Rate</label>
                        <FeeSelector feeRates={feeRates} selected={feeRate} onChange={setFeeRate} />
                      </div>

                      {/* Split Preview */}
                      {splitOutputs.length > 0 && (
                        <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                          <h4 className="mb-2 text-xs font-bold text-gray-400">Transaction Preview</h4>
                          <div className="space-y-1.5">
                            {splitOutputs.map((out, i) => (
                              <div
                                key={i}
                                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                                  out.isRare ? 'border border-purple-500/30 bg-purple-900/10' : 'bg-gray-900/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${out.isRare ? 'bg-purple-400' : 'bg-gray-600'}`} />
                                  <span className={out.isRare ? 'text-purple-300' : 'text-gray-400'}>{out.label}</span>
                                </div>
                                <span className="font-mono text-gray-300">{formatSatNumber(out.value)} sats</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-gray-700 pt-2 text-xs">
                            <span className="text-gray-500">Network Fee</span>
                            <span className="font-mono text-amber-400">{formatSatNumber(splitFee)} sats</span>
                          </div>
                        </div>
                      )}

                      {splitError && (
                        <p className="mb-3 text-xs text-red-400">{splitError}</p>
                      )}

                      <button
                        onClick={executeSplit}
                        disabled={splitOutputs.length === 0 || !!splitError || !destAddress || step === 'signing'}
                        className="w-full rounded-lg bg-purple-600 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:opacity-40"
                      >
                        {step === 'signing' ? (loadingMsg || 'Processing...') : 'Split & Sign Transaction'}
                      </button>
                    </div>
                  )}

                  {selected.rareSatGroups.length === 0 && selected.satRangesAvailable && (
                    <p className="text-sm text-gray-500">No rare sats detected in this UTXO.</p>
                  )}
                  {!selected.satRangesAvailable && (
                    <p className="text-sm text-amber-500">
                      Sat range data unavailable. Make sure your ord server has <code className="rounded bg-gray-800 px-1">--index-sats</code> enabled.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && txid && (
          <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-6 text-center">
            <h2 className="mb-2 text-lg font-bold text-green-300">Transaction Broadcast!</h2>
            <p className="mb-4 text-sm text-gray-400">Your rare sats have been isolated.</p>
            <a
              href={`https://mempool.space/tx/${txid}`}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm text-purple-400 underline hover:text-purple-300"
            >
              {txid}
            </a>
            <div className="mt-5">
              <button
                onClick={() => { setStep('scan'); setTxid(''); setSelectedIdx(null); }}
                className="rounded-lg border border-gray-600 bg-gray-800 px-5 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Split Another
              </button>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="mb-3 text-sm font-bold text-gray-400">Supported Rare Sat Types</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SAT_TYPE_META) as [SatType, typeof SAT_TYPE_META[SatType]][]).map(([type, meta]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ backgroundColor: meta.color + '15', color: meta.color, border: `1px solid ${meta.color}33` }}
              >
                {meta.symbol} {meta.label}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-gray-500">
            <strong className="text-gray-400">Parasite Sats:</strong> All sats from block {PARASITE_BLOCK.toLocaleString()}
            {' '}(sat range {formatSatNumber(PARASITE_SAT_START)} – {formatSatNumber(PARASITE_SAT_END)})
          </div>
        </div>
      </div>
    </div>
  );
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

export default RareSatSplitterPage;
