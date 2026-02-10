import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import {
  GalleryItem,
  InscriptionSession,
  encodeGalleryAsCBOR,
  createInscriptionCommit,
  checkCommitFunding,
  buildRevealTransaction,
  broadcastTransaction,
  getRecommendedFees,
  estimateInscription,
  detectContentType,
  saveSession,
  loadSession,
  clearAllData,
  saveImageData,
  loadImageData,
  saveGalleryDataHex,
  loadGalleryDataHex,
} from '../services/inscriptionBuilder';
import { hex as hexCodec } from '@scure/base';

export const GalleryInscriptionToolPage: React.FC = () => {
  const { walletState } = useWallet();

  // Admin check
  const connectedAddress = walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && isAdminAddress(connectedAddress);

  // State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<Uint8Array | null>(null);
  const [imageContentType, setImageContentType] = useState<string>('');

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryFileName, setGalleryFileName] = useState<string>('');
  const [galleryCborData, setGalleryCborData] = useState<Uint8Array | null>(null);

  const [parentIds, setParentIds] = useState<string>('');
  const [feeRate, setFeeRate] = useState<number>(2);
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [recommendedFees, setRecommendedFees] = useState<any>(null);

  const [session, setSession] = useState<InscriptionSession | null>(null);
  const [polling, setPolling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [revealing, setRevealing] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load fees on mount
  useEffect(() => {
    getRecommendedFees().then(fees => {
      setRecommendedFees(fees);
      if (fees.hour >= 1) setFeeRate(fees.hour);
    }).catch(console.error);
  }, []);

  // Restore session on mount
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.status !== 'revealed') {
      setSession(saved);
      setDestinationAddress(saved.destinationAddress);
      setFeeRate(saved.feeRate);
      setImageContentType(saved.imageContentType);

      // Restore image and gallery data from localStorage
      const imgHex = loadImageData();
      if (imgHex) {
        try {
          setImageData(hexCodec.decode(imgHex));
        } catch (e) { /* ignore */ }
      }
      const galHex = loadGalleryDataHex();
      if (galHex) {
        try {
          setGalleryCborData(hexCodec.decode(galHex));
        } catch (e) { /* ignore */ }
      }

      if (saved.status === 'created') {
        setStatusMessage('⏳ Warte auf Funding... Sende BTC an die Commit-Adresse.');
      } else if (saved.status === 'funded') {
        setStatusMessage('✅ Commit funded! Bereit für Reveal.');
      }
    }
  }, []);

  // Start polling when session is created
  useEffect(() => {
    if (session?.status === 'created' && !polling) {
      startPolling();
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [session?.status]);

  // ---- IMAGE HANDLING ----
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setError('');

    // Preview
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Binary data
    const binaryReader = new FileReader();
    binaryReader.onload = () => {
      const data = new Uint8Array(binaryReader.result as ArrayBuffer);
      setImageData(data);
      const ct = detectContentType(file.name, data);
      setImageContentType(ct);
    };
    binaryReader.readAsArrayBuffer(file);
  }, []);

  // ---- JSON GALLERY HANDLING ----
  const handleGalleryUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGalleryFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!Array.isArray(json)) {
          setError('JSON muss ein Array sein!');
          return;
        }

        // Validate structure
        const items: GalleryItem[] = json.map((item: any) => {
          if (!item.id || !item.meta?.name) {
            throw new Error(`Item fehlt id oder meta.name: ${JSON.stringify(item).substring(0, 100)}`);
          }
          return {
            id: item.id,
            meta: {
              name: item.meta.name,
              attributes: item.meta.attributes || [],
            },
          };
        });

        setGalleryItems(items);

        // Encode as CBOR
        const cbor = encodeGalleryAsCBOR(items);
        setGalleryCborData(cbor);
        setStatusMessage(`✅ ${items.length} Gallery-Items geladen (${(cbor.length / 1024).toFixed(1)} KB CBOR)`);
      } catch (err: any) {
        setError(`JSON Fehler: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  // ---- ESTIMATE ----
  const estimate = imageData && galleryCborData
    ? estimateInscription(imageData.length, galleryCborData.length, feeRate)
    : null;

  // ---- CREATE COMMIT ----
  const handleCreateCommit = useCallback(() => {
    if (!imageData || !galleryCborData) {
      setError('Bild und JSON müssen geladen sein!');
      return;
    }
    if (!destinationAddress || !destinationAddress.startsWith('bc1')) {
      setError('Gültige Bitcoin-Adresse (bc1...) eingeben!');
      return;
    }
    if (feeRate < 1) {
      setError('Fee Rate muss mindestens 1 sat/vB sein!');
      return;
    }

    try {
      setError('');
      setStatusMessage('🔨 Erstelle Inscription...');

      // Parse parent IDs
      const parents = parentIds
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const newSession = createInscriptionCommit(
        imageContentType,
        imageData,
        galleryCborData,
        feeRate,
        destinationAddress,
        parents,
      );

      newSession.galleryItemCount = galleryItems.length;

      // Save to localStorage for recovery
      saveSession(newSession);
      try {
        saveImageData(hexCodec.encode(imageData));
        saveGalleryDataHex(hexCodec.encode(galleryCborData));
      } catch (e) {
        console.warn('Could not save data to localStorage (may be too large):', e);
      }

      setSession(newSession);
      setStatusMessage(`✅ Commit-Adresse erstellt! Sende ${newSession.requiredAmount.toLocaleString()} sats dorthin.`);
    } catch (err: any) {
      setError(`Fehler: ${err.message}`);
    }
  }, [imageData, galleryCborData, imageContentType, destinationAddress, feeRate, parentIds, galleryItems]);

  // ---- POLLING ----
  const startPolling = useCallback(() => {
    if (!session?.commitAddress) return;
    setPolling(true);

    const poll = async () => {
      const result = await checkCommitFunding(session.commitAddress);
      if (result.funded && result.txid !== undefined) {
        // Stop polling
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPolling(false);

        const updated: InscriptionSession = {
          ...session,
          status: 'funded',
          commitTxid: result.txid,
          commitVout: result.vout,
        };
        setSession(updated);
        saveSession(updated);
        setStatusMessage(`✅ Commit funded! TXID: ${result.txid?.substring(0, 16)}... (${result.amount?.toLocaleString()} sats)`);
      }
    };

    // Poll every 5 seconds
    poll(); // immediate check
    pollingRef.current = setInterval(poll, 5000);
  }, [session]);

  // ---- REVEAL ----
  const handleReveal = useCallback(async () => {
    if (!session || session.status !== 'funded') {
      setError('Session nicht funded!');
      return;
    }
    if (!imageData || !galleryCborData) {
      setError('Bild und Gallery-Daten müssen noch geladen sein!');
      return;
    }
    if (!session.commitTxid || session.commitVout === undefined) {
      setError('Commit UTXO fehlt!');
      return;
    }

    try {
      setRevealing(true);
      setError('');
      setStatusMessage('🔨 Baue Reveal-Transaktion...');

      const parents = parentIds
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Get actual commit amount from the UTXO
      const funding = await checkCommitFunding(session.commitAddress);
      const commitAmount = funding.amount || session.requiredAmount;

      const rawTxHex = buildRevealTransaction(
        session,
        session.commitTxid,
        session.commitVout,
        commitAmount,
        imageData,
        galleryCborData,
        parents,
      );

      setStatusMessage('📡 Broadcaste Reveal-Transaktion...');

      const revealTxid = await broadcastTransaction(rawTxHex);
      const inscriptionId = `${revealTxid}i0`;

      const updated: InscriptionSession = {
        ...session,
        status: 'revealed',
        revealTxid,
        inscriptionId,
      };
      setSession(updated);
      saveSession(updated);
      setStatusMessage(`🎉 Gallery inscribed! Inscription ID: ${inscriptionId}`);
    } catch (err: any) {
      setError(`Reveal Fehler: ${err.message}`);
      setStatusMessage('');
    } finally {
      setRevealing(false);
    }
  }, [session, imageData, galleryCborData, parentIds]);

  // ---- RESET ----
  const handleReset = useCallback(() => {
    if (session?.status === 'created' || session?.status === 'funded') {
      if (!confirm('⚠️ ACHTUNG: Wenn du resettest und BTC bereits gesendet wurden, gehen die Funds verloren! Bist du sicher?')) {
        return;
      }
    }
    clearAllData();
    setSession(null);
    setImageFile(null);
    setImagePreview(null);
    setImageData(null);
    setGalleryItems([]);
    setGalleryCborData(null);
    setGalleryFileName('');
    setParentIds('');
    setStatusMessage('');
    setError('');
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPolling(false);
  }, [session]);

  // ---- RENDER ----
  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">🔒 Wallet verbinden</h1>
          <p className="text-gray-400">Bitte verbinde dein Wallet um fortzufahren.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-600 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">⛔ Zugriff verweigert</h1>
          <p className="text-gray-400">Diese Seite ist nur für Admins zugänglich.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-400 mb-2">🖼️ Gallery Inscription Tool</h1>
          <p className="text-gray-400 text-sm">
            Erstelle Ordinals Gallery Inscriptions direkt on-chain – ohne externe Services.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Status Display */}
        {statusMessage && (
          <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-4 mb-6">
            <p className="text-emerald-300 text-sm">{statusMessage}</p>
          </div>
        )}

        {/* Already revealed - show result */}
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
            <div className="flex gap-3 justify-center">
              <a
                href={`https://ordinals.com/inscription/${session.inscriptionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold"
              >
                📖 Auf ordinals.com anschauen
              </a>
              <a
                href={`https://mempool.space/tx/${session.revealTxid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-bold"
              >
                🔗 Mempool
              </a>
            </div>
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              🔄 Neue Inscription
            </button>
          </div>
        )}

        {/* Active session - waiting for funding or ready for reveal */}
        {session && session.status !== 'revealed' && (
          <div className="bg-gray-900 border border-yellow-600 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">
              {session.status === 'created' ? '⏳ Warte auf Funding' : '✅ Bereit für Reveal'}
            </h2>

            {/* Commit Address */}
            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Commit-Adresse (sende BTC hierhin):</p>
              <p className="text-yellow-300 font-mono text-sm break-all select-all">{session.commitAddress}</p>
            </div>

            {/* Required Amount */}
            <div className="bg-black rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Benötigter Betrag:</p>
              <p className="text-white font-bold text-lg">{session.requiredAmount.toLocaleString()} sats</p>
              <p className="text-gray-500 text-xs">({(session.requiredAmount / 100_000_000).toFixed(8)} BTC)</p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black rounded-lg p-3">
                <p className="text-gray-400 text-xs">Fee Rate</p>
                <p className="text-white font-bold">{session.feeRate} sat/vB</p>
              </div>
              <div className="bg-black rounded-lg p-3">
                <p className="text-gray-400 text-xs">Script Size</p>
                <p className="text-white font-bold">{(session.totalScriptSize / 1024).toFixed(1)} KB</p>
              </div>
              <div className="bg-black rounded-lg p-3">
                <p className="text-gray-400 text-xs">Gallery Items</p>
                <p className="text-white font-bold">{session.galleryItemCount}</p>
              </div>
              <div className="bg-black rounded-lg p-3">
                <p className="text-gray-400 text-xs">Destination</p>
                <p className="text-white font-mono text-xs truncate">{session.destinationAddress}</p>
              </div>
            </div>

            {/* Polling indicator */}
            {polling && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm mb-4">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                Überprüfe alle 5 Sekunden...
              </div>
            )}

            {/* Commit info if funded */}
            {session.commitTxid && (
              <div className="bg-black rounded-lg p-4 mb-4">
                <p className="text-gray-400 text-xs mb-1">Commit TXID:</p>
                <a
                  href={`https://mempool.space/tx/${session.commitTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 font-mono text-sm break-all hover:underline"
                >
                  {session.commitTxid}
                </a>
              </div>
            )}

            {/* Reveal Button */}
            {session.status === 'funded' && (
              <button
                onClick={handleReveal}
                disabled={revealing}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {revealing ? '⏳ Reveal läuft...' : '🚀 Reveal Transaction Broadcasten'}
              </button>
            )}

            {/* Reset */}
            <button
              onClick={handleReset}
              className="mt-3 w-full py-2 bg-red-900/50 text-red-400 border border-red-700 rounded-lg hover:bg-red-900 text-sm"
            >
              ⚠️ Session zurücksetzen
            </button>
          </div>
        )}

        {/* Setup Form - only show when no active session */}
        {(!session || session.status === 'revealed') && (
          <>
            {/* Step 1: Image Upload */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3">
                <span className="text-emerald-400">1.</span> Cover-Bild auswählen
              </h2>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-emerald-600 file:text-white
                  hover:file:bg-emerald-500
                  cursor-pointer"
              />
              {imagePreview && (
                <div className="mt-4 flex items-start gap-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-contain rounded-lg border border-gray-600 bg-black"
                  />
                  <div className="text-sm text-gray-400">
                    <p><strong>Datei:</strong> {imageFile?.name}</p>
                    <p><strong>Größe:</strong> {imageData ? `${(imageData.length / 1024).toFixed(1)} KB` : '...'}</p>
                    <p><strong>Typ:</strong> {imageContentType}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Gallery JSON */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3">
                <span className="text-emerald-400">2.</span> Gallery JSON laden
              </h2>
              <input
                type="file"
                accept=".json"
                onChange={handleGalleryUpload}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-500
                  cursor-pointer"
              />
              {galleryItems.length > 0 && (
                <div className="mt-4 text-sm text-gray-400">
                  <p><strong>Datei:</strong> {galleryFileName}</p>
                  <p><strong>Items:</strong> {galleryItems.length}</p>
                  <p><strong>CBOR Größe:</strong> {galleryCborData ? `${(galleryCborData.length / 1024).toFixed(1)} KB` : '...'}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Erstes Item: {galleryItems[0]?.meta.name} ({galleryItems[0]?.id.substring(0, 16)}...)
                  </p>
                </div>
              )}
            </div>

            {/* Step 3: Settings */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3">
                <span className="text-emerald-400">3.</span> Einstellungen
              </h2>

              {/* Fee Rate */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-300 mb-1">Fee Rate (sat/vB)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={feeRate}
                    onChange={(e) => setFeeRate(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-24 px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm"
                  />
                  {recommendedFees && (
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setFeeRate(recommendedFees.economy)} className="px-2 py-1 bg-green-900 text-green-300 rounded hover:bg-green-800">
                        Economy: {recommendedFees.economy}
                      </button>
                      <button onClick={() => setFeeRate(recommendedFees.hour)} className="px-2 py-1 bg-blue-900 text-blue-300 rounded hover:bg-blue-800">
                        1h: {recommendedFees.hour}
                      </button>
                      <button onClick={() => setFeeRate(recommendedFees.fastest)} className="px-2 py-1 bg-red-900 text-red-300 rounded hover:bg-red-800">
                        Fast: {recommendedFees.fastest}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Address */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-300 mb-1">Ziel-Adresse (wohin die Inscription geht)</label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value.trim())}
                  placeholder="bc1p..."
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono"
                />
                {connectedAddress && (
                  <button
                    onClick={() => setDestinationAddress(connectedAddress)}
                    className="mt-1 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    → Verbundene Adresse verwenden ({connectedAddress.substring(0, 12)}...)
                  </button>
                )}
              </div>

              {/* Parent Inscription IDs (optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">
                  Parent Inscription IDs <span className="text-gray-500">(optional, kommagetrennt)</span>
                </label>
                <input
                  type="text"
                  value={parentIds}
                  onChange={(e) => setParentIds(e.target.value)}
                  placeholder="abc123...i0, def456...i0"
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono"
                />
              </div>
            </div>

            {/* Step 4: Review & Create */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
              <h2 className="text-lg font-bold text-white mb-3">
                <span className="text-emerald-400">4.</span> Überprüfen & Erstellen
              </h2>

              {estimate ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Bild</p>
                      <p className="text-white font-bold">{(imageData!.length / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="bg-black rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Gallery CBOR</p>
                      <p className="text-white font-bold">{(galleryCborData!.length / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="bg-black rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Script Größe</p>
                      <p className="text-white font-bold">{(estimate.totalScriptSize / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="bg-black rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Virtual Size</p>
                      <p className="text-white font-bold">{estimate.virtualSize.toLocaleString()} vB</p>
                    </div>
                  </div>

                  <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Geschätzte Fee:</span>
                      <span className="text-white font-bold">{estimate.fee.toLocaleString()} sats</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-300">Commit Betrag (Fee + Postage):</span>
                      <span className="text-emerald-400 font-bold text-lg">{estimate.commitAmount.toLocaleString()} sats</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      = {(estimate.commitAmount / 100_000_000).toFixed(8)} BTC
                    </p>
                  </div>

                  {estimate.virtualSize > 100000 && (
                    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                      <p className="text-yellow-300 text-sm">
                        ⚠️ Große Transaktion ({(estimate.virtualSize / 1000).toFixed(0)} kvB).
                        Manche Nodes könnten sie nicht relayern. Eventuell Bild verkleinern.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleCreateCommit}
                    disabled={!destinationAddress || !imageData || !galleryCborData}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg mt-4"
                  >
                    🔨 Commit-Adresse generieren
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Lade zuerst ein Bild und eine Gallery JSON um die Kosten zu berechnen.
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-500">
              <h3 className="font-bold text-gray-400 mb-2">ℹ️ So funktioniert es:</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Bild + JSON laden und Einstellungen wählen</li>
                <li>Commit-Adresse generieren lassen</li>
                <li>Den angezeigten Betrag an die Commit-Adresse senden (von beliebigem Wallet)</li>
                <li>Warten bis die Transaktion bestätigt ist</li>
                <li>Reveal-Transaktion broadcasten → Gallery ist on-chain!</li>
              </ol>
              <p className="mt-2 text-yellow-600">
                ⚠️ WICHTIG: Tab nicht schließen nachdem du BTC gesendet hast! Der Private Key wird lokal gespeichert,
                aber geh kein Risiko ein.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
