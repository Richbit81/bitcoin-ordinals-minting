/**
 * Collection Data Tool (Admin Only)
 * Lädt Halter-Adressen und Inscription-IDs einer Ordinals-Kollektion.
 * Input: Hashlist (Inscription IDs) – Einfügen oder Datei-Upload.
 * Output: Adresse → [Inscription IDs], JSON-Download.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';

const HIRO_API = 'https://api.hiro.so/ordinals/v1';

function parseInscriptionIds(text: string): string[] {
  const raw = text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
  return raw.filter(id => /^[a-f0-9]{64}i\d+$/i.test(id));
}

interface HolderData {
  address: string;
  inscriptionIds: string[];
  count: number;
}

interface InscriptionWithOwner {
  inscriptionId: string;
  address: string;
  number?: number;
}

const CollectionDataToolPage: React.FC = () => {
  const { walletState } = useWallet();
  const ordinalsAccount = walletState.accounts?.find((a: any) => a.purpose === 'ordinals');
  const connectedAddress = ordinalsAccount?.address || walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && connectedAddress && isAdminAddress(connectedAddress);

  const [idListText, setIdListText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [rawResults, setRawResults] = useState<InscriptionWithOwner[]>([]);
  const [collectionName, setCollectionName] = useState('');

  const holdersByAddress = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of rawResults) {
      if (!r.address) continue;
      const list = map.get(r.address) || [];
      list.push(r.inscriptionId);
      map.set(r.address, list);
    }
    return Array.from(map.entries()).map(([address, inscriptionIds]) => ({
      address,
      inscriptionIds,
      count: inscriptionIds.length,
    } as HolderData));
  }, [rawResults]);

  const fetchInscriptionOwner = useCallback(async (inscriptionId: string): Promise<string | null> => {
    try {
      const res = await fetch(`${HIRO_API}/inscriptions/${inscriptionId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.address || data.owner || data.owner_address || data.current_owner || null;
    } catch {
      return null;
    }
  }, []);

  const runFetch = useCallback(async (ids: string[]) => {
    setLoading(true);
    setError('');
    setRawResults([]);
    const results: InscriptionWithOwner[] = [];
    const total = ids.length;

    for (let i = 0; i < ids.length; i++) {
      setProgress(`${i + 1} / ${total} – ${ids[i].slice(0, 16)}...`);
      const address = await fetchInscriptionOwner(ids[i]);
      results.push({
        inscriptionId: ids[i],
        address: address || '(unbekannt)',
      });
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 100));
    }

    setRawResults(results);
    setProgress(`✅ ${total} Inscriptions geladen – ${new Set(results.map(r => r.address)).size} Halter`);
    setLoading(false);
  }, [fetchInscriptionOwner]);

  const loadFromText = useCallback(() => {
    const ids = parseInscriptionIds(idListText);
    if (ids.length === 0) {
      setError('Keine gültigen Inscription IDs (Format: hex64i0)');
      return;
    }
    setError('');
    runFetch(ids);
  }, [idListText, runFetch]);

  const loadFromFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = (ev.target?.result as string) || '';
        let ids: string[] = [];
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            ids = json.map((item: any) => {
              if (typeof item === 'string') return item.trim();
              if (item.id) return item.id.trim();
              if (item.inscriptionId) return item.inscriptionId.trim();
              if (item.inscription_id) return item.inscription_id.trim();
              return '';
            }).filter(Boolean);
          }
        } catch {
          ids = parseInscriptionIds(text);
        }
        if (ids.length > 0) {
          setIdListText(ids.join('\n'));
          setCollectionName(file.name.replace(/\.[^.]+$/, ''));
          runFetch(ids);
        } else {
          setError('Keine gültigen IDs in der Datei gefunden.');
        }
      } catch {
        setError('Datei konnte nicht gelesen werden.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [runFetch]);

  const downloadJSON = useCallback((data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportByAddress = useCallback(() => {
    const data = {
      collection: collectionName || 'collection',
      generatedAt: new Date().toISOString(),
      totalInscriptions: rawResults.length,
      uniqueHolders: holdersByAddress.length,
      holders: holdersByAddress.map(h => ({
        address: h.address,
        inscriptionIds: h.inscriptionIds,
        count: h.count,
      })),
    };
    downloadJSON(data, `${(collectionName || 'collection').replace(/\s+/g, '_')}_holders.json`);
  }, [holdersByAddress, rawResults.length, collectionName, downloadJSON]);

  const exportByInscription = useCallback(() => {
    const data = {
      collection: collectionName || 'collection',
      generatedAt: new Date().toISOString(),
      totalInscriptions: rawResults.length,
      inscriptions: rawResults,
    };
    downloadJSON(data, `${(collectionName || 'collection').replace(/\s+/g, '_')}_inscriptions.json`);
  }, [rawResults, collectionName, downloadJSON]);

  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">🔒 Wallet verbinden</h1>
          <p className="text-gray-400">Verbinde dein Wallet um das Tool zu nutzen.</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold text-red-500 mb-4">⛔ Kein Zugang</h1>
          <p className="text-gray-400">Dieses Tool ist nur für Admins verfügbar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-2">
          📊 Collection Data Tool
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          Hole alle Halter-Adressen und Inscription-IDs einer Kollektion. Input: Hashlist (Inscription IDs).
        </p>

        {/* Input */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h2 className="text-lg font-bold mb-3">📋 Hashlist eingeben</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              placeholder="Collection Name (für Dateinamen)"
              className="flex-1 px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm"
            />
            <label className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 text-sm font-bold cursor-pointer whitespace-nowrap">
              📂 JSON/TXT laden
              <input type="file" accept=".json,.txt,.csv" onChange={loadFromFile} className="hidden" />
            </label>
          </div>
          <textarea
            value={idListText}
            onChange={e => setIdListText(e.target.value)}
            placeholder={"Inscription IDs (eine pro Zeile oder komma-getrennt):\n\nabc123...i0\ndef456...i0"}
            className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-xs font-mono h-32 resize-y"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={loadFromText}
              disabled={loading || parseInscriptionIds(idListText).length === 0}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 text-sm font-bold"
            >
              {loading ? '⏳ Lade...' : '🔍 Daten abrufen'}
            </button>
            {idListText.trim() && (
              <span className="text-xs text-gray-500">
                {parseInscriptionIds(idListText).length} IDs erkannt
              </span>
            )}
          </div>
          {progress && <p className="text-xs text-amber-400 mt-2">{progress}</p>}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>

        {/* Results */}
        {rawResults.length > 0 && (
          <>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">📥 Export</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportByAddress}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold"
                  >
                    📋 JSON (nach Adresse)
                  </button>
                  <button
                    onClick={exportByInscription}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-bold"
                  >
                    📋 JSON (Inscription → Adresse)
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {rawResults.length} Inscriptions • {holdersByAddress.length} Halter
              </p>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <h2 className="text-lg font-bold p-4 border-b border-gray-700">
                Halter-Übersicht
              </h2>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-400 font-semibold">Adresse</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-semibold">Anzahl</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-semibold">Inscription IDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdersByAddress.map((h, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-mono text-xs text-amber-300">{h.address}</td>
                        <td className="px-4 py-2 text-white font-bold">{h.count}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {h.inscriptionIds.slice(0, 3).map(id => (
                              <span key={id} className="text-[10px] font-mono text-gray-500 truncate max-w-[120px]" title={id}>
                                {id.slice(0, 12)}...
                              </span>
                            ))}
                            {h.inscriptionIds.length > 3 && (
                              <span className="text-gray-600">+{h.inscriptionIds.length - 3} weitere</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CollectionDataToolPage;
