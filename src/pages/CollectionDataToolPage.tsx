/**
 * Collection Data Tool (Admin Only)
 * Lädt Halter-Adressen und Inscription-IDs einer Ordinals-Kollektion.
 * Input: Collection-Name oder Slug (z.B. wie bei Magic Eden: bitcoin-frogs, scanmode).
 * Output: Adresse → Inscription IDs, Hashlist-Export, JSON-Download.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { getApiUrl } from '../utils/apiUrl';

interface BisCollection {
  name: string;
  slug: string;
  supply?: string;
}

interface BisHolder {
  wallet: string;
  inscription_ids: string[];
}

interface HolderData {
  address: string;
  inscriptionIds: string[];
  count: number;
}

const CollectionDataToolPage: React.FC = () => {
  const { walletState } = useWallet();
  const ordinalsAccount = walletState.accounts?.find((a: any) => a.purpose === 'ordinals');
  const connectedAddress = ordinalsAccount?.address || walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && connectedAddress && isAdminAddress(connectedAddress);

  const [collectionInput, setCollectionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [holdersData, setHoldersData] = useState<HolderData[]>([]);
  const [resolvedSlug, setResolvedSlug] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [allInscriptionIds, setAllInscriptionIds] = useState<string[]>([]);

  const getCollectionDataUrl = () => getApiUrl() + '/api/collection-data';

  const fetchApi = useCallback((url: string) => fetch(url, { headers: { Accept: 'application/json' } }), []);

  const searchCollections = useCallback(async (query: string): Promise<BisCollection | null> => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '-');
    if (!q) return null;
    let offset = 0;
    const count = 100;
    while (true) {
      const url = `${getCollectionDataUrl()}/collections?sort_by=median_number&order=desc&offset=${offset}&count=${count}`;
      const res = await fetchApi(url);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Backend Fehler ${res.status}`);
      }
      const json = await res.json();
      const data = json.data as BisCollection[] | undefined;
      if (!data || data.length === 0) break;
      for (const c of data) {
        const slugMatch = c.slug?.toLowerCase().includes(q) || c.slug?.toLowerCase() === q;
        const nameMatch = c.name?.toLowerCase().includes(q) || c.name?.toLowerCase().replace(/\s+/g, '-') === q;
        if (slugMatch || nameMatch) return c;
      }
      if (data.length < count) break;
      offset += count;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }, [fetchApi]);

  const fetchAllHolders = useCallback(async (slug: string): Promise<BisHolder[]> => {
    const all: BisHolder[] = [];
    let offset = 0;
    const count = 100;
    while (true) {
      const url = `${getCollectionDataUrl()}/holders?slug=${encodeURIComponent(slug)}&offset=${offset}&count=${count}`;
      const res = await fetchApi(url);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Holders-API Fehler ${res.status}`);
      }
      const json = await res.json();
      const data = json.data as BisHolder[] | undefined;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < count) break;
      offset += count;
      setProgress(`${all.length}+ Halter geladen...`);
      await new Promise(r => setTimeout(r, 150));
    }
    return all;
  }, [fetchApi]);

  const runSearch = useCallback(async () => {
    const query = collectionInput.trim();
    if (!query) {
      setError('Bitte Collection-Name oder Slug eingeben (z.B. bitcoin-frogs, scanmode).');
      return;
    }
    setLoading(true);
    setError('');
    setHoldersData([]);
    setAllInscriptionIds([]);
    setResolvedSlug('');
    setResolvedName('');

    try {
      setProgress('Suche Kollektion...');
      const collection = await searchCollections(query);
      if (!collection) {
        setError(`Kollektion "${query}" nicht gefunden. Prüfe den Namen/Slug (z.B. bitcoin-frogs).`);
        setLoading(false);
        return;
      }

      setResolvedSlug(collection.slug);
      setResolvedName(collection.name || collection.slug);
      setProgress(`Lade Halter für ${collection.name || collection.slug}...`);

      const holders = await fetchAllHolders(collection.slug);

      const byAddress: HolderData[] = holders.map(h => ({
        address: h.wallet,
        inscriptionIds: h.inscription_ids || [],
        count: (h.inscription_ids || []).length,
      }));

      const allIds = holders.flatMap(h => h.inscription_ids || []);

      setHoldersData(byAddress);
      setAllInscriptionIds(allIds);
      setProgress(`✅ ${allIds.length} Inscriptions • ${byAddress.length} Halter`);
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Abrufen der Daten. Evtl. CORS oder API-Key nötig.');
    } finally {
      setLoading(false);
    }
  }, [collectionInput, searchCollections, fetchAllHolders]);

  const downloadJSON = useCallback((data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const baseFilename = (resolvedName || resolvedSlug || 'collection').replace(/[^\w\-]/g, '_');

  const exportByAddress = useCallback(() => {
    const data = {
      collection: resolvedName || resolvedSlug,
      slug: resolvedSlug,
      generatedAt: new Date().toISOString(),
      totalInscriptions: allInscriptionIds.length,
      uniqueHolders: holdersData.length,
      holders: holdersData.map(h => ({
        address: h.address,
        inscriptionIds: h.inscriptionIds,
        count: h.count,
      })),
    };
    downloadJSON(data, `${baseFilename}_holders.json`);
  }, [holdersData, allInscriptionIds.length, resolvedName, resolvedSlug, downloadJSON]);

  const exportHashlist = useCallback(() => {
    const data = {
      collection: resolvedName || resolvedSlug,
      slug: resolvedSlug,
      generatedAt: new Date().toISOString(),
      totalInscriptions: allInscriptionIds.length,
      inscriptionIds: allInscriptionIds,
    };
    downloadJSON(data, `${baseFilename}_hashlist.json`);
  }, [allInscriptionIds, resolvedName, resolvedSlug, downloadJSON]);

  const exportHashlistTxt = useCallback(() => {
    const blob = new Blob([allInscriptionIds.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFilename}_hashlist.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allInscriptionIds, baseFilename]);

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
          Gib einen Kollektions-Namen oder Slug ein (wie bei Magic Eden, z.B. bitcoin-frogs, scanmode) – lädt Halter-Adressen und Inscription-IDs. Export als JSON oder Hashlist.
        </p>

        {/* Suche */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h2 className="text-lg font-bold mb-3">🔍 Kollektion suchen</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={collectionInput}
              onChange={e => setCollectionInput(e.target.value)}
              placeholder="z.B. bitcoin frogs, scanmode, bitcoin-frogs"
              className="flex-1 px-3 py-2 bg-black border border-gray-600 rounded-lg text-white"
              onKeyDown={e => e.key === 'Enter' && runSearch()}
            />
            <button
              onClick={runSearch}
              disabled={loading || !collectionInput.trim()}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 font-bold"
            >
              {loading ? '⏳ Suche...' : '🔍 Daten laden'}
            </button>
          </div>
          {progress && <p className="text-xs text-amber-400 mt-2">{progress}</p>}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Nutzt <strong>UNISAT_API_KEY</strong> (bereits in Railway) → UniSat Collection API. Fallback: BIS_API_KEY falls nötig.
          </p>
        </div>

        {/* Ergebnisse & Export */}
        {holdersData.length > 0 && (
          <>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-lg font-bold">📥 Hashlist &amp; JSON speichern</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportHashlistTxt}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold"
                  >
                    📄 Hashlist (.txt)
                  </button>
                  <button
                    onClick={exportHashlist}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold"
                  >
                    📋 Hashlist (.json)
                  </button>
                  <button
                    onClick={exportByAddress}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-bold"
                  >
                    📋 Nach Adresse (.json)
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {allInscriptionIds.length} Inscriptions • {holdersData.length} Halter
              </p>
            </div>

            {/* Tabelle */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <h2 className="text-lg font-bold p-4 border-b border-gray-700">Halter-Übersicht</h2>
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
                    {holdersData.map((h, i) => (
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
