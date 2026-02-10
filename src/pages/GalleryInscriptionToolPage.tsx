import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import {
  GalleryItem,
  InscriptionOptions,
  InscriptionSession,
  BatchFileEntry,
  encodeGalleryAsCBOR,
  encodeMetadataAsCBOR,
  createInscriptionCommit,
  checkCommitFunding,
  buildRevealTransaction,
  broadcastTransaction,
  getRecommendedFees,
  estimateInscription,
  detectContentType,
  isTextBasedContent,
  compressWithBrotli,
  isBrotliAvailable,
  saveSession,
  loadSession,
  clearAllData,
  saveImageData,
  loadImageData,
  saveGalleryDataHex,
  loadGalleryDataHex,
} from '../services/inscriptionBuilder';
import { hex as hexCodec } from '@scure/base';

// ============================================================
// CHECKBOX FEATURE TOGGLE COMPONENT
// ============================================================
const FeatureToggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}> = ({ label, description, checked, onChange, children }) => (
  <div className={`border rounded-lg p-4 transition-all ${checked ? 'border-emerald-500 bg-emerald-900/10' : 'border-gray-700 bg-gray-900/50'}`}>
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 accent-emerald-500 cursor-pointer flex-shrink-0"
      />
      <div className="flex-1">
        <span className="text-white font-semibold text-sm">{label}</span>
        {description && <p className="text-gray-400 text-xs mt-0.5">{description}</p>}
      </div>
    </label>
    {checked && children && <div className="mt-3 ml-8">{children}</div>}
  </div>
);

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export const GalleryInscriptionToolPage: React.FC = () => {
  const { walletState } = useWallet();
  const connectedAddress = walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && isAdminAddress(connectedAddress);

  // ---- FILE STATE ----
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<Uint8Array | null>(null);
  const [imageContentType, setImageContentType] = useState<string>('');

  // ---- GALLERY ----
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryFileName, setGalleryFileName] = useState<string>('');
  const [galleryCborData, setGalleryCborData] = useState<Uint8Array | null>(null);

  // ---- OPTIONAL FEATURES (checkbox toggles) ----
  const [enableTitle, setEnableTitle] = useState(false);
  const [title, setTitle] = useState('');

  const [enableTraits, setEnableTraits] = useState(false);
  const [traits, setTraits] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);

  const [enableParent, setEnableParent] = useState(false);
  const [parentIds, setParentIds] = useState('');

  const [enableSpecificSat, setEnableSpecificSat] = useState(false);
  const [specificSat, setSpecificSat] = useState('');

  const [enableReinscribe, setEnableReinscribe] = useState(false);
  const [reinscribeId, setReinscribeId] = useState('');

  const [enableBrotli, setEnableBrotli] = useState(false);
  const [brotliAvailable, setBrotliAvailable] = useState(false);
  const [brotliSavings, setBrotliSavings] = useState<number | null>(null);

  const [enableBatch, setEnableBatch] = useState(false);
  const [batchFiles, setBatchFiles] = useState<BatchFileEntry[]>([]);

  // ---- SETTINGS ----
  const [feeRate, setFeeRate] = useState<number>(2);
  const [galleryPreviewExpanded, setGalleryPreviewExpanded] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [recommendedFees, setRecommendedFees] = useState<any>(null);

  // ---- SESSION ----
  const [session, setSession] = useState<InscriptionSession | null>(null);
  const [polling, setPolling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [revealing, setRevealing] = useState(false);
  const [sendingPayment, setSendingPayment] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- CACHED INSCRIPTION OPTIONS (for reveal) ----
  const inscriptionOptsRef = useRef<InscriptionOptions[]>([]);

  // ============================================================
  // INIT
  // ============================================================
  useEffect(() => {
    getRecommendedFees().then(fees => {
      setRecommendedFees(fees);
      if (fees.hour >= 1) setFeeRate(fees.hour);
    }).catch(console.error);

    isBrotliAvailable().then(setBrotliAvailable).catch(() => setBrotliAvailable(false));
  }, []);

  // Restore session
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.status !== 'revealed') {
      setSession(saved);
      setDestinationAddress(saved.destinationAddress);
      setFeeRate(saved.feeRate);
      setImageContentType(saved.imageContentType);
      const imgHex = loadImageData();
      if (imgHex) try { setImageData(hexCodec.decode(imgHex)); } catch { /* */ }
      const galHex = loadGalleryDataHex();
      if (galHex) try { setGalleryCborData(hexCodec.decode(galHex)); } catch { /* */ }
      setStatusMessage(saved.status === 'funded' ? '✅ Commit funded! Bereit für Reveal.' : '⏳ Warte auf Funding...');
    }
  }, []);

  // Polling
  useEffect(() => {
    if (session?.status === 'created' && !polling) startPolling();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [session?.status]);

  // Brotli savings estimation
  useEffect(() => {
    if (!enableBrotli || !imageData || !brotliAvailable) { setBrotliSavings(null); return; }
    if (isTextBasedContent(imageContentType)) {
      compressWithBrotli(imageData).then(compressed => {
        setBrotliSavings(Math.round((1 - compressed.length / imageData.length) * 100));
      }).catch(() => setBrotliSavings(null));
    } else {
      setBrotliSavings(null);
    }
  }, [enableBrotli, imageData, imageContentType, brotliAvailable]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    const br = new FileReader();
    br.onload = () => {
      const data = new Uint8Array(br.result as ArrayBuffer);
      setImageData(data);
      setImageContentType(detectContentType(file.name, data));
    };
    br.readAsArrayBuffer(file);
  }, []);

  const handleGalleryUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!Array.isArray(json)) { setError('JSON muss ein Array sein!'); return; }
        const items: GalleryItem[] = json.map((item: any) => {
          if (!item.id || !item.meta?.name) throw new Error(`Item fehlt id oder meta.name`);
          return { id: item.id, meta: { name: item.meta.name, attributes: item.meta.attributes || [] } };
        });
        setGalleryItems(items);
        const cbor = encodeGalleryAsCBOR(items);
        setGalleryCborData(cbor);
        setStatusMessage(`✅ ${items.length} Gallery-Items geladen (${(cbor.length / 1024).toFixed(1)} KB CBOR)`);
      } catch (err: any) { setError(`JSON Fehler: ${err.message}`); }
    };
    reader.readAsText(file);
  }, []);

  const handleBatchUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    const entries: BatchFileEntry[] = [];
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        entries.push({
          fileName: file.name,
          data,
          contentType: detectContentType(file.name, data),
          sizeKB: Math.round(data.length / 1024 * 10) / 10,
        });
        loaded++;
        if (loaded === files.length) {
          setBatchFiles(entries);
          setStatusMessage(`✅ ${entries.length} Batch-Dateien geladen`);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const addTrait = useCallback(() => {
    setTraits(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const removeTrait = useCallback((idx: number) => {
    setTraits(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateTrait = useCallback((idx: number, field: 'key' | 'value', val: string) => {
    setTraits(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }, []);

  // ============================================================
  // BUILD INSCRIPTION OPTIONS
  // ============================================================

  const buildInscriptionOptionsList = useCallback(async (): Promise<InscriptionOptions[]> => {
    // Metadata (title + traits)
    const validTraits = enableTraits ? traits.filter(t => t.key.trim() && t.value.trim()) : [];
    const metadata = encodeMetadataAsCBOR(
      enableTitle ? title : undefined,
      validTraits.length > 0 ? validTraits : undefined,
    );

    // Parents
    const parents = enableParent
      ? parentIds.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    // Content encoding
    const contentEncoding = enableBrotli ? 'br' : null;

    if (enableBatch && batchFiles.length > 0) {
      // BATCH MODE: one inscription per file
      const inscriptions: InscriptionOptions[] = [];
      for (const bf of batchFiles) {
        let body = bf.data;
        if (enableBrotli && isTextBasedContent(bf.contentType)) {
          body = await compressWithBrotli(body);
        }
        inscriptions.push({
          contentType: bf.contentType,
          body,
          galleryData: inscriptions.length === 0 ? galleryCborData : null, // gallery only on first
          parentIds: parents,
          metadata,
          contentEncoding: enableBrotli && isTextBasedContent(bf.contentType) ? 'br' : null,
        });
      }
      return inscriptions;
    }

    // SINGLE MODE
    if (!imageData) throw new Error('Kein Bild geladen!');

    let body = imageData;
    if (enableBrotli && isTextBasedContent(imageContentType)) {
      body = await compressWithBrotli(imageData);
    }

    return [{
      contentType: imageContentType,
      body,
      galleryData: galleryCborData,
      parentIds: parents,
      metadata,
      contentEncoding: enableBrotli && isTextBasedContent(imageContentType) ? contentEncoding : null,
      reinscribeId: enableReinscribe ? reinscribeId : null,
    }];
  }, [
    imageData, imageContentType, galleryCborData,
    enableTitle, title, enableTraits, traits,
    enableParent, parentIds, enableBrotli,
    enableBatch, batchFiles, enableReinscribe, reinscribeId,
  ]);

  // ============================================================
  // ESTIMATE
  // ============================================================

  const estimate = (() => {
    if (enableBatch && batchFiles.length > 0) {
      const sizes = batchFiles.map(f => f.data.length);
      return estimateInscription(
        sizes,
        galleryCborData?.length || 0,
        encodeMetadataAsCBOR(enableTitle ? title : undefined, enableTraits ? traits.filter(t => t.key && t.value) : undefined)?.length || 0,
        feeRate,
      );
    }
    if (!imageData) return null;
    return estimateInscription(
      [imageData.length],
      galleryCborData?.length || 0,
      encodeMetadataAsCBOR(enableTitle ? title : undefined, enableTraits ? traits.filter(t => t.key && t.value) : undefined)?.length || 0,
      feeRate,
    );
  })();

  // ============================================================
  // CREATE COMMIT
  // ============================================================

  const handleCreateCommit = useCallback(async () => {
    if (!enableBatch && !imageData) { setError('Bild muss geladen sein!'); return; }
    if (enableBatch && batchFiles.length === 0) { setError('Batch-Dateien müssen geladen sein!'); return; }
    if (!destinationAddress || !destinationAddress.startsWith('bc1')) { setError('Gültige Bitcoin-Adresse eingeben!'); return; }
    if (feeRate < 0.1) { setError('Fee Rate muss mindestens 0.1 sein!'); return; }

    try {
      setError('');
      setStatusMessage('🔨 Erstelle Inscription...');

      const opts = await buildInscriptionOptionsList();
      inscriptionOptsRef.current = opts;

      const newSession = createInscriptionCommit(opts, feeRate, destinationAddress);
      newSession.galleryItemCount = galleryItems.length;

      saveSession(newSession);
      try {
        if (imageData) saveImageData(hexCodec.encode(imageData));
        if (galleryCborData) saveGalleryDataHex(hexCodec.encode(galleryCborData));
      } catch { /* localStorage may be full */ }

      setSession(newSession);
      setStatusMessage(`✅ Commit-Adresse erstellt! Sende ${newSession.requiredAmount.toLocaleString()} sats.`);
    } catch (err: any) {
      setError(`Fehler: ${err.message}`);
    }
  }, [imageData, galleryCborData, destinationAddress, feeRate, enableBatch, batchFiles, buildInscriptionOptionsList, galleryItems]);

  // ============================================================
  // POLLING
  // ============================================================

  const startPolling = useCallback(() => {
    if (!session?.commitAddress) return;
    setPolling(true);
    const poll = async () => {
      const result = await checkCommitFunding(session.commitAddress);
      if (result.funded && result.txid) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPolling(false);
        const updated: InscriptionSession = { ...session, status: 'funded', commitTxid: result.txid, commitVout: result.vout };
        setSession(updated);
        saveSession(updated);
        setStatusMessage(`✅ Commit funded! TXID: ${result.txid?.substring(0, 16)}... (${result.amount?.toLocaleString()} sats)`);
      }
    };
    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [session]);

  // ============================================================
  // PAY WITH WALLET
  // ============================================================

  const handlePayWithWallet = useCallback(async () => {
    if (!session || session.status !== 'created') return;

    try {
      setSendingPayment(true);
      setError('');
      setStatusMessage('💳 Öffne Wallet...');

      const satsConnect = await import('sats-connect');
      if (!satsConnect?.request) {
        throw new Error('sats-connect nicht verfügbar');
      }

      const amountSats = session.requiredAmount;
      console.log(`[InscriptionTool] Sende ${amountSats} sats an ${session.commitAddress}`);

      const response = await satsConnect.request('sendTransfer', {
        recipients: [{
          address: session.commitAddress,
          amount: amountSats,
        }],
      });

      console.log('[InscriptionTool] Wallet response:', response);

      if (response.status === 'success') {
        const txid = response.result?.txid || response.result;
        setStatusMessage(`✅ Zahlung gesendet! TXID: ${typeof txid === 'string' ? txid.substring(0, 16) + '...' : 'pending'}. Warte auf Bestätigung...`);
      } else {
        throw new Error(response.error?.message || 'Zahlung vom Wallet abgelehnt');
      }
    } catch (err: any) {
      if (err.message?.includes('rejected') || err.message?.includes('cancelled') || err.message?.includes('denied')) {
        setError('Zahlung abgebrochen.');
      } else {
        setError(`Wallet-Fehler: ${err.message}`);
      }
      setStatusMessage('');
    } finally {
      setSendingPayment(false);
    }
  }, [session]);

  // ============================================================
  // REVEAL
  // ============================================================

  const handleReveal = useCallback(async () => {
    if (!session || session.status !== 'funded') { setError('Nicht funded!'); return; }
    if (!session.commitTxid || session.commitVout === undefined) { setError('Commit UTXO fehlt!'); return; }

    try {
      setRevealing(true);
      setError('');
      setStatusMessage('🔨 Baue Reveal-Transaktion...');

      // Rebuild inscription options
      let opts = inscriptionOptsRef.current;
      if (!opts || opts.length === 0) {
        opts = await buildInscriptionOptionsList();
      }

      const funding = await checkCommitFunding(session.commitAddress);
      const commitAmount = funding.amount || session.requiredAmount;

      const rawTxHex = buildRevealTransaction(session, session.commitTxid, session.commitVout, commitAmount, opts);

      setStatusMessage('📡 Broadcaste Reveal...');
      const revealTxid = await broadcastTransaction(rawTxHex);
      const inscriptionId = `${revealTxid}i0`;

      const updated: InscriptionSession = { ...session, status: 'revealed', revealTxid, inscriptionId };
      setSession(updated);
      saveSession(updated);
      setStatusMessage(`🎉 Inscription erstellt! ID: ${inscriptionId}`);
    } catch (err: any) {
      setError(`Reveal Fehler: ${err.message}`);
      setStatusMessage('');
    } finally {
      setRevealing(false);
    }
  }, [session, buildInscriptionOptionsList]);

  // ============================================================
  // RESET
  // ============================================================

  const handleReset = useCallback(() => {
    if (session?.status === 'created' || session?.status === 'funded') {
      if (!confirm('⚠️ Wenn BTC bereits gesendet wurden, gehen die Funds verloren! Sicher?')) return;
    }
    clearAllData();
    setSession(null);
    setImageFile(null);
    setImagePreview(null);
    setImageData(null);
    setGalleryItems([]);
    setGalleryCborData(null);
    setGalleryFileName('');
    setBatchFiles([]);
    setStatusMessage('');
    setError('');
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPolling(false);
    inscriptionOptsRef.current = [];
  }, [session]);

  // ============================================================
  // ACCESS CONTROL
  // ============================================================

  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">🔒 Wallet verbinden</h1>
          <p className="text-gray-400">Bitte verbinde dein Wallet.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-600 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">⛔ Zugriff verweigert</h1>
          <p className="text-gray-400">Nur für Admins.</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  const numItems = enableBatch ? batchFiles.length : (imageData ? 1 : 0);

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-400 mb-2">🖼️ Inscription Tool</h1>
          <p className="text-gray-400 text-sm">Erstelle Ordinals Inscriptions on-chain – ohne externe Services.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Status */}
        {statusMessage && (
          <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-4 mb-6">
            <p className="text-emerald-300 text-sm">{statusMessage}</p>
          </div>
        )}

        {/* ════════════════ REVEALED RESULT ════════════════ */}
        {session?.status === 'revealed' && session.inscriptionId && (
          <div className="bg-emerald-900/30 border-2 border-emerald-500 rounded-xl p-6 mb-6 text-center">
            <h2 className="text-2xl font-bold text-emerald-400 mb-4">🎉 Inscription erstellt!</h2>
            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Inscription ID:</p>
              <p className="text-white font-mono text-sm break-all">{session.inscriptionId}</p>
            </div>
            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Reveal TXID:</p>
              <p className="text-white font-mono text-sm break-all">{session.revealTxid}</p>
            </div>
            {session.batchCount > 1 && (
              <p className="text-gray-400 text-sm mb-4">
                Batch: {session.batchCount} Inscriptions erstellt (IDs: {session.revealTxid}i0 bis i{session.batchCount - 1})
              </p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <a href={`https://ordinals.com/inscription/${session.inscriptionId}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold">📖 ordinals.com</a>
              <a href={`https://mempool.space/tx/${session.revealTxid}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-bold">🔗 Mempool</a>
            </div>
            <button onClick={handleReset} className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm">🔄 Neue Inscription</button>
          </div>
        )}

        {/* ════════════════ ACTIVE SESSION ════════════════ */}
        {session && session.status !== 'revealed' && (
          <div className="bg-gray-900 border border-yellow-600 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">
              {session.status === 'created' ? '⏳ Warte auf Funding' : '✅ Bereit für Reveal'}
            </h2>
            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Commit-Adresse:</p>
              <p className="text-yellow-300 font-mono text-sm break-all select-all">{session.commitAddress}</p>
            </div>
            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Betrag:</p>
              <p className="text-white font-bold text-lg">{session.requiredAmount.toLocaleString()} sats</p>
              <p className="text-gray-500 text-xs">({(session.requiredAmount / 100_000_000).toFixed(8)} BTC)</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Fee Rate</p><p className="text-white font-bold">{session.feeRate} sat/vB</p></div>
              <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Script</p><p className="text-white font-bold">{(session.totalScriptSize / 1024).toFixed(1)} KB</p></div>
              <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Inscriptions</p><p className="text-white font-bold">{session.batchCount}</p></div>
              {session.contentEncoding && <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Encoding</p><p className="text-emerald-400 font-bold">{session.contentEncoding}</p></div>}
            </div>

            {enableSpecificSat && specificSat && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4 text-sm text-yellow-300">
                ⚠️ Du willst auf SAT #{specificSat} inscribieren. Stelle sicher, dass du einen UTXO mit diesem SAT an die Commit-Adresse sendest!
              </div>
            )}
            {enableReinscribe && reinscribeId && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4 text-sm text-yellow-300">
                ⚠️ Reinscription auf {reinscribeId.substring(0, 20)}... – Sende den UTXO der diese Inscription enthält an die Commit-Adresse!
              </div>
            )}

            {session.status === 'created' && (
              <button
                onClick={handlePayWithWallet}
                disabled={sendingPayment}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50 text-lg mb-4"
              >
                {sendingPayment ? '⏳ Wallet öffnet sich...' : `💳 Mit Wallet bezahlen (${session.requiredAmount.toLocaleString()} sats)`}
              </button>
            )}

            {polling && <div className="flex items-center gap-2 text-yellow-400 text-sm mb-4"><div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />Überprüfe alle 5s...</div>}
            {session.commitTxid && (
              <div className="bg-black rounded-lg p-4 mb-4">
                <p className="text-gray-400 text-xs mb-1">Commit TXID:</p>
                <a href={`https://mempool.space/tx/${session.commitTxid}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-mono text-sm break-all hover:underline">{session.commitTxid}</a>
              </div>
            )}
            {session.status === 'funded' && (
              <button onClick={handleReveal} disabled={revealing} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 text-lg">
                {revealing ? '⏳ Reveal läuft...' : '🚀 Reveal Broadcasten'}
              </button>
            )}
            <button onClick={handleReset} className="mt-3 w-full py-2 bg-red-900/50 text-red-400 border border-red-700 rounded-lg hover:bg-red-900 text-sm">⚠️ Session zurücksetzen</button>
          </div>
        )}

        {/* ════════════════ SETUP FORM ════════════════ */}
        {(!session || session.status === 'revealed') && (
          <>
            {/* STEP 1: Content */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3"><span className="text-emerald-400">1.</span> Content</h2>

              {!enableBatch ? (
                <>
                  <p className="text-gray-400 text-xs mb-2">Einzelne Datei (Bild, HTML, Text, etc.)</p>
                  <input type="file" onChange={handleImageUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer" />
                  {imagePreview && (
                    <div className="mt-4 flex items-start gap-4">
                      <img src={imagePreview} alt="Preview" className="w-24 h-24 object-contain rounded-lg border border-gray-600 bg-black" />
                      <div className="text-sm text-gray-400">
                        <p><strong>Datei:</strong> {imageFile?.name}</p>
                        <p><strong>Größe:</strong> {imageData ? `${(imageData.length / 1024).toFixed(1)} KB` : '...'}</p>
                        <p><strong>Typ:</strong> {imageContentType}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-xs mb-2">Batch: Mehrere Dateien auswählen</p>
                  <input type="file" multiple onChange={handleBatchUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer" />
                  {batchFiles.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      <p className="text-gray-400 text-xs mb-1">{batchFiles.length} Dateien:</p>
                      {batchFiles.map((f, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-500 py-0.5">
                          <span className="truncate mr-2">{f.fileName}</span>
                          <span className="text-gray-600">{f.sizeKB} KB · {f.contentType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* STEP 2: Gallery JSON (optional) */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3"><span className="text-emerald-400">2.</span> Gallery JSON <span className="text-gray-500 text-sm font-normal">(optional)</span></h2>
              <input type="file" accept=".json" onChange={handleGalleryUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
              {galleryItems.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">
                      <strong className="text-white">{galleryItems.length}</strong> Items · <strong className="text-white">{galleryCborData ? `${(galleryCborData.length / 1024).toFixed(1)} KB` : '...'}</strong> CBOR
                    </p>
                    <button
                      onClick={() => setGalleryPreviewExpanded(!galleryPreviewExpanded)}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      {galleryPreviewExpanded ? '▲ Zuklappen' : '▼ Vorschau'}
                    </button>
                  </div>

                  {galleryPreviewExpanded && (
                    <div className="bg-black rounded-lg border border-gray-700 max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-800">
                          <tr>
                            <th className="text-left text-gray-400 px-3 py-2 font-semibold">#</th>
                            <th className="text-left text-gray-400 px-3 py-2 font-semibold">Name</th>
                            <th className="text-left text-gray-400 px-3 py-2 font-semibold">Inscription ID</th>
                            <th className="text-left text-gray-400 px-3 py-2 font-semibold">Traits</th>
                          </tr>
                        </thead>
                        <tbody>
                          {galleryItems.map((item, i) => (
                            <tr key={i} className="border-t border-gray-800 hover:bg-gray-900/50">
                              <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                              <td className="px-3 py-1.5 text-white font-medium truncate max-w-[140px]">{item.meta.name}</td>
                              <td className="px-3 py-1.5 text-gray-400 font-mono">
                                <a
                                  href={`https://ordinals.com/inscription/${item.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-blue-400"
                                  title={item.id}
                                >
                                  {item.id.substring(0, 10)}...{item.id.slice(-4)}
                                </a>
                              </td>
                              <td className="px-3 py-1.5 text-gray-500">
                                {item.meta.attributes.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.meta.attributes.slice(0, 3).map((attr, j) => (
                                      <span key={j} className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400" title={`${attr.trait_type}: ${attr.value}`}>
                                        {attr.trait_type}: {attr.value.length > 12 ? attr.value.substring(0, 12) + '…' : attr.value}
                                      </span>
                                    ))}
                                    {item.meta.attributes.length > 3 && (
                                      <span className="px-1.5 py-0.5 text-gray-600">+{item.meta.attributes.length - 3}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-600">–</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!galleryPreviewExpanded && (
                    <p className="text-xs text-gray-500">
                      Erstes Item: {galleryItems[0]?.meta.name} · Letztes: {galleryItems[galleryItems.length - 1]?.meta.name}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* STEP 3: Optional Features */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-4"><span className="text-emerald-400">3.</span> Optionale Features</h2>
              <div className="space-y-3">

                {/* Title */}
                <FeatureToggle label="Titel hinzufügen" description="Name/Titel der Inscription (gespeichert in Metadata)" checked={enableTitle} onChange={setEnableTitle}>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. SOS Evolution Gallery" className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm" />
                </FeatureToggle>

                {/* Traits */}
                <FeatureToggle label="Traits / Attributes" description="Key-Value Paare als Metadata (z.B. Artist, Collection)" checked={enableTraits} onChange={setEnableTraits}>
                  <div className="space-y-2">
                    {traits.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={t.key} onChange={e => updateTrait(i, 'key', e.target.value)} placeholder="Trait Name" className="flex-1 px-2 py-1.5 bg-black border border-gray-600 rounded text-white text-sm" />
                        <input type="text" value={t.value} onChange={e => updateTrait(i, 'value', e.target.value)} placeholder="Value" className="flex-1 px-2 py-1.5 bg-black border border-gray-600 rounded text-white text-sm" />
                        <button onClick={() => removeTrait(i)} className="px-2 text-red-400 hover:text-red-300 text-lg" title="Entfernen">×</button>
                      </div>
                    ))}
                    <button onClick={addTrait} className="text-emerald-400 hover:text-emerald-300 text-sm">+ Trait hinzufügen</button>
                  </div>
                </FeatureToggle>

                {/* Parent */}
                <FeatureToggle label="Parent Inscription" description="Inscription als Child eines Parents erstellen" checked={enableParent} onChange={setEnableParent}>
                  <input type="text" value={parentIds} onChange={e => setParentIds(e.target.value)} placeholder="abc123...i0 (mehrere kommagetrennt)" className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono" />
                </FeatureToggle>

                {/* Specific SAT */}
                <FeatureToggle label="Auf bestimmtem SAT inscribieren" description="Die Inscription wird auf einen spezifischen Satoshi gebunden" checked={enableSpecificSat} onChange={setEnableSpecificSat}>
                  <input type="text" value={specificSat} onChange={e => setSpecificSat(e.target.value)} placeholder="SAT Nummer (z.B. 1934567890123)" className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono" />
                  <p className="text-yellow-400 text-xs mt-2">⚠️ Du musst manuell einen UTXO senden, der diesen SAT enthält. Das Tool kann das nicht automatisch steuern.</p>
                </FeatureToggle>

                {/* Reinscribe */}
                <FeatureToggle label="Reinscription" description="Auf einem SAT inscribieren, der bereits eine Inscription hat" checked={enableReinscribe} onChange={setEnableReinscribe}>
                  <input type="text" value={reinscribeId} onChange={e => setReinscribeId(e.target.value)} placeholder="Bestehende Inscription ID (abc...i0)" className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono" />
                  <p className="text-yellow-400 text-xs mt-2">⚠️ Sende den UTXO mit dieser Inscription an die Commit-Adresse. Die neue Inscription wird auf demselben SAT erstellt.</p>
                </FeatureToggle>

                {/* Brotli */}
                <FeatureToggle
                  label="Brotli Kompression"
                  description="Reduziert Kosten für textbasierte Dateien (HTML, SVG, JSON, Text) signifikant"
                  checked={enableBrotli}
                  onChange={setEnableBrotli}
                >
                  {!brotliAvailable ? (
                    <p className="text-red-400 text-xs">⚠️ Brotli-WASM konnte nicht geladen werden.</p>
                  ) : (
                    <div className="text-xs text-gray-400">
                      <p className="text-emerald-400">✅ Brotli verfügbar</p>
                      {imageData && isTextBasedContent(imageContentType) && brotliSavings !== null && (
                        <p className="mt-1">Geschätzte Einsparung: <strong className="text-emerald-300">{brotliSavings}%</strong> kleiner</p>
                      )}
                      {imageData && !isTextBasedContent(imageContentType) && (
                        <p className="mt-1 text-yellow-400">⚠️ Brotli hilft nur bei Text-Dateien. Dein Content ({imageContentType}) ist binär – kein Effekt.</p>
                      )}
                    </div>
                  )}
                </FeatureToggle>

                {/* Batch */}
                <FeatureToggle label="Batch Inscribing" description="Mehrere Inscriptions in einer einzigen Transaktion (spart Commit-Fees)" checked={enableBatch} onChange={setEnableBatch}>
                  <p className="text-gray-400 text-xs">Wähle mehrere Dateien in Schritt 1 oben aus. Jede Datei wird eine separate Inscription.</p>
                  {batchFiles.length > 0 && <p className="text-emerald-400 text-xs mt-1">✅ {batchFiles.length} Dateien geladen</p>}
                </FeatureToggle>
              </div>
            </div>

            {/* STEP 4: Settings */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3"><span className="text-emerald-400">4.</span> Einstellungen</h2>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-300 mb-1">Fee Rate (sat/vB)</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input type="number" value={feeRate} onChange={e => setFeeRate(Math.max(0.1, parseFloat(e.target.value) || 0.1))} min={0.1} step={0.1} className="w-24 px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm" />
                  {recommendedFees && (
                    <div className="flex gap-2 text-xs flex-wrap">
                      <button onClick={() => setFeeRate(recommendedFees.economy)} className="px-2 py-1 bg-green-900 text-green-300 rounded hover:bg-green-800">Eco: {recommendedFees.economy}</button>
                      <button onClick={() => setFeeRate(recommendedFees.hour)} className="px-2 py-1 bg-blue-900 text-blue-300 rounded hover:bg-blue-800">1h: {recommendedFees.hour}</button>
                      <button onClick={() => setFeeRate(recommendedFees.fastest)} className="px-2 py-1 bg-red-900 text-red-300 rounded hover:bg-red-800">Fast: {recommendedFees.fastest}</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-300 mb-1">Ziel-Adresse</label>
                <input type="text" value={destinationAddress} onChange={e => setDestinationAddress(e.target.value.trim())} placeholder="bc1p..." className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono" />
                {connectedAddress && (
                  <button onClick={() => setDestinationAddress(connectedAddress)} className="mt-1 text-xs text-emerald-400 hover:text-emerald-300">→ Verbundene Adresse ({connectedAddress.substring(0, 12)}...)</button>
                )}
              </div>
            </div>

            {/* STEP 5: Review */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3"><span className="text-emerald-400">5.</span> Überprüfen & Erstellen</h2>
              {estimate ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Content</p><p className="text-white font-bold text-sm">{enableBatch ? `${batchFiles.length} Dateien` : `${imageData ? (imageData.length / 1024).toFixed(1) : 0} KB`}</p></div>
                    <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Gallery</p><p className="text-white font-bold text-sm">{galleryCborData ? `${(galleryCborData.length / 1024).toFixed(1)} KB` : '–'}</p></div>
                    <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">Script</p><p className="text-white font-bold text-sm">{(estimate.totalScriptSize / 1024).toFixed(1)} KB</p></div>
                    <div className="bg-black rounded-lg p-3"><p className="text-gray-400 text-xs">vSize</p><p className="text-white font-bold text-sm">{estimate.virtualSize.toLocaleString()} vB</p></div>
                  </div>

                  {/* Active features summary */}
                  {(enableTitle || enableTraits || enableParent || enableBrotli || enableSpecificSat || enableReinscribe || enableBatch) && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Aktive Features:</p>
                      <div className="flex flex-wrap gap-2">
                        {enableTitle && <span className="text-xs px-2 py-0.5 bg-emerald-900 text-emerald-300 rounded">Titel</span>}
                        {enableTraits && <span className="text-xs px-2 py-0.5 bg-emerald-900 text-emerald-300 rounded">Traits ({traits.filter(t => t.key && t.value).length})</span>}
                        {enableParent && <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded">Parent</span>}
                        {enableBrotli && <span className="text-xs px-2 py-0.5 bg-purple-900 text-purple-300 rounded">Brotli</span>}
                        {enableSpecificSat && <span className="text-xs px-2 py-0.5 bg-yellow-900 text-yellow-300 rounded">Specific SAT</span>}
                        {enableReinscribe && <span className="text-xs px-2 py-0.5 bg-orange-900 text-orange-300 rounded">Reinscription</span>}
                        {enableBatch && <span className="text-xs px-2 py-0.5 bg-purple-900 text-purple-300 rounded">Batch ({batchFiles.length})</span>}
                      </div>
                    </div>
                  )}

                  <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Fee:</span>
                      <span className="text-white font-bold">{estimate.fee.toLocaleString()} sats</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-300">Commit Betrag:</span>
                      <span className="text-emerald-400 font-bold text-lg">{estimate.commitAmount.toLocaleString()} sats</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">= {(estimate.commitAmount / 100_000_000).toFixed(8)} BTC</p>
                  </div>

                  {estimate.virtualSize > 100000 && (
                    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                      <p className="text-yellow-300 text-sm">⚠️ Große Transaktion ({(estimate.virtualSize / 1000).toFixed(0)} kvB). Brotli oder kleinere Dateien nutzen.</p>
                    </div>
                  )}

                  <button
                    onClick={handleCreateCommit}
                    disabled={numItems === 0 || !destinationAddress}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg mt-2"
                  >
                    🔨 Commit-Adresse generieren
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Lade Content um Kosten zu berechnen.</p>
              )}
            </div>

            {/* Info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-500">
              <h3 className="font-bold text-gray-400 mb-2">ℹ️ Ablauf:</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Content + optionale Features konfigurieren</li>
                <li>Commit-Adresse generieren lassen</li>
                <li>Betrag an Commit-Adresse senden</li>
                <li>Warten bis Transaktion erkannt wird</li>
                <li>Reveal broadcasten → Inscription on-chain!</li>
              </ol>
              <p className="mt-2 text-yellow-600">⚠️ Tab nicht schließen nach dem Senden! Private Key wird lokal gespeichert.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
