/**
 * Recursive Collection Generator Tool (Admin Only)
 * 
 * Features:
 * - Projekt-Management: Erstellen, Speichern, Laden, Löschen, Duplizieren
 * - Auto-Save: Projekte werden automatisch in localStorage gespeichert
 * - Wallet Scanner: Lade Inscriptions von einer Taproot-Adresse
 * - Multi-Select: Wähle mehrere Inscriptions aus und schiebe sie in Layer
 * - Layer-System mit Traits, Namen und Rarity
 * - SVG-Generierung mit Layer-Stacking
 * - Hashlist JSON Export
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';

// ============================================================
// TYPES
// ============================================================
interface TraitItem {
  inscriptionId: string;
  name: string;
  rarity: number;
  contentType?: string;
}

interface Layer {
  id: string;
  name: string;
  traitType: string;
  traits: TraitItem[];
  expanded: boolean;
}

interface WalletInscription {
  id: string;
  number?: number;
  contentType?: string;
  contentLength?: number;
}

interface GeneratedItem {
  index: number;
  layers: { layerName: string; traitType: string; trait: TraitItem }[];
  svg: string;
}

interface HashlistEntry {
  id: string;
  meta: {
    name: string;
    attributes: { trait_type: string; value: string }[];
  };
}

interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  collectionName: string;
  totalCount: number;
  viewBox: string;
  layers: Layer[];
  scanAddress: string;
  walletInscriptions: WalletInscription[];
  generated: GeneratedItem[];
  hashlist: HashlistEntry[];
}

// ============================================================
const HIRO_API = 'https://api.hiro.so/ordinals/v1';
const STORAGE_KEY = 'recursive_collection_projects';

let idCounter = 0;
function uid() { return `layer_${Date.now()}_${idCounter++}`; }
function projectId() { return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function loadProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProjects(projects: SavedProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Save error:', e);
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
const RecursiveCollectionToolPage: React.FC = () => {
  const { walletState } = useWallet();
  const ordinalsAccount = walletState.accounts?.find((a: any) => a.purpose === 'ordinals');
  const connectedAddress = ordinalsAccount?.address || walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && isAdminAddress(connectedAddress);

  // ---- PROJECT MANAGEMENT ----
  const [projects, setProjects] = useState<SavedProject[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ---- INSCRIPTION LOADING ----
  const [loadMode, setLoadMode] = useState<'wallet' | 'idlist'>('wallet');
  const [idListText, setIdListText] = useState('');

  // ---- WALLET SCANNER ----
  const [scanAddress, setScanAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [walletInscriptions, setWalletInscriptions] = useState<WalletInscription[]>([]);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanProgress, setScanProgress] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  // ---- COLLECTION SETTINGS ----
  const [collectionName, setCollectionName] = useState('My Collection');
  const [totalCount, setTotalCount] = useState(100);
  const [viewBox, setViewBox] = useState('0 0 1000 1000');

  // ---- LAYERS ----
  const [layers, setLayers] = useState<Layer[]>([]);
  const [targetLayerId, setTargetLayerId] = useState<string | null>(null);

  // ---- RESULTS ----
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [hashlist, setHashlist] = useState<HashlistEntry[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [selectedLayerPreview, setSelectedLayerPreview] = useState<{ layerId: string; traitIdx: number } | null>(null);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // PROJECT MANAGEMENT
  // ============================================================
  const loadProjectIntoState = useCallback((project: SavedProject) => {
    setCollectionName(project.collectionName || 'My Collection');
    setTotalCount(project.totalCount || 100);
    setViewBox(project.viewBox || '0 0 1000 1000');
    setLayers(project.layers || []);
    setScanAddress(project.scanAddress || '');
    setWalletInscriptions(project.walletInscriptions || []);
    setGenerated(project.generated || []);
    setHashlist(project.hashlist || []);
    setPreviewIndex(0);
    setSelectedIds(new Set());
    setFilterText('');
    setTargetLayerId(null);
    setError('');
  }, []);

  const createNewProject = useCallback((name?: string) => {
    const id = projectId();
    const now = new Date().toISOString();
    const newProject: SavedProject = {
      id,
      name: name || 'Neues Projekt',
      createdAt: now,
      updatedAt: now,
      collectionName: name || 'My Collection',
      totalCount: 100,
      viewBox: '0 0 1000 1000',
      layers: [],
      scanAddress: '',
      walletInscriptions: [],
      generated: [],
      hashlist: [],
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    saveProjects(updated);
    setActiveProjectId(id);
    loadProjectIntoState(newProject);
  }, [projects, loadProjectIntoState]);

  const openProject = useCallback((id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    setActiveProjectId(id);
    loadProjectIntoState(project);
  }, [projects, loadProjectIntoState]);

  const saveCurrentProject = useCallback(() => {
    if (!activeProjectId) return;
    const now = new Date().toISOString();
    const updated = projects.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        updatedAt: now,
        name: collectionName || p.name,
        collectionName,
        totalCount,
        viewBox,
        layers,
        scanAddress,
        walletInscriptions,
        generated,
        hashlist,
      };
    });
    setProjects(updated);
    saveProjects(updated);
    setSaveStatus('✅ Gespeichert');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [activeProjectId, projects, collectionName, totalCount, viewBox, layers, scanAddress, walletInscriptions, generated, hashlist]);

  const deleteProject = useCallback((id: string) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    saveProjects(updated);
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
    setConfirmDelete(null);
  }, [projects, activeProjectId]);

  const duplicateProject = useCallback((id: string) => {
    const source = projects.find(p => p.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const newProj: SavedProject = {
      ...JSON.parse(JSON.stringify(source)),
      id: projectId(),
      name: `${source.name} (Kopie)`,
      collectionName: `${source.collectionName} (Kopie)`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newProj, ...projects];
    setProjects(updated);
    saveProjects(updated);
  }, [projects]);

  const closeProject = useCallback(() => {
    saveCurrentProject();
    setActiveProjectId(null);
  }, [saveCurrentProject]);

  // ---- AUTO-SAVE (debounced) ----
  useEffect(() => {
    if (!activeProjectId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentProject();
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [layers, collectionName, totalCount, viewBox, scanAddress, walletInscriptions, generated, hashlist]);

  // ============================================================
  // WALLET SCANNER
  // ============================================================
  const scanWallet = useCallback(async () => {
    const addr = scanAddress.trim();
    if (!addr || !addr.startsWith('bc1p')) {
      setError('Bitte eine gültige Taproot-Adresse (bc1p...) eingeben!');
      return;
    }

    setScanning(true);
    setError('');
    setWalletInscriptions([]);
    setScanProgress('Lade Inscriptions...');

    try {
      let allInscriptions: WalletInscription[] = [];
      let offset = 0;
      const limit = 60;
      let total = 0;

      do {
        const url = `${HIRO_API}/inscriptions?address=${addr}&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
        const data = await res.json();
        total = data.total || 0;
        setScanTotal(total);

        const items: WalletInscription[] = (data.results || []).map((r: any) => ({
          id: r.id,
          number: r.number,
          contentType: r.content_type,
          contentLength: r.content_length,
        }));

        allInscriptions = [...allInscriptions, ...items];
        setWalletInscriptions([...allInscriptions]);
        setScanProgress(`${allInscriptions.length} / ${total} geladen...`);
        offset += limit;

        if (items.length < limit) break;
        await new Promise(r => setTimeout(r, 200));
      } while (offset < total);

      setScanProgress(`✅ ${allInscriptions.length} Inscriptions geladen`);
    } catch (err: any) {
      setError(`Scan Fehler: ${err.message}`);
      setScanProgress('');
    } finally {
      setScanning(false);
    }
  }, [scanAddress]);

  // ============================================================
  // ID LIST LOADING
  // ============================================================
  const parseIdList = useCallback((text: string): string[] => {
    // Split by newlines, commas, semicolons, spaces, tabs
    const raw = text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
    // Keep only valid inscription IDs (hex + i + number)
    return raw.filter(id => /^[a-f0-9]{64}i\d+$/i.test(id));
  }, []);

  const loadFromIdList = useCallback(() => {
    const ids = parseIdList(idListText);
    if (ids.length === 0) {
      setError('Keine gültigen Inscription IDs gefunden! Format: abc123...i0');
      return;
    }

    const inscriptions: WalletInscription[] = ids.map(id => ({ id }));
    // Merge with existing (don't add duplicates)
    const existingIds = new Set(walletInscriptions.map(w => w.id));
    const newOnes = inscriptions.filter(i => !existingIds.has(i.id));
    const merged = [...walletInscriptions, ...newOnes];
    setWalletInscriptions(merged);
    setScanProgress(`✅ ${newOnes.length} neue IDs geladen (${merged.length} gesamt)`);
    setError('');
  }, [idListText, walletInscriptions, parseIdList]);

  const loadIdsFromFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        // Try JSON array first
        try {
          const json = JSON.parse(text);
          let ids: string[] = [];
          if (Array.isArray(json)) {
            // Could be array of strings or array of objects with id field
            ids = json.map((item: any) => {
              if (typeof item === 'string') return item.trim();
              if (item.id) return item.id.trim();
              if (item.inscriptionId) return item.inscriptionId.trim();
              return '';
            }).filter(Boolean);
          }
          if (ids.length > 0) {
            setIdListText(ids.join('\n'));
            // Auto-load
            const valid = ids.filter(id => /^[a-f0-9]{64}i\d+$/i.test(id));
            const existingIds = new Set(walletInscriptions.map(w => w.id));
            const newOnes = valid.filter(id => !existingIds.has(id)).map(id => ({ id } as WalletInscription));
            setWalletInscriptions(prev => [...prev, ...newOnes]);
            setScanProgress(`✅ ${newOnes.length} IDs aus Datei geladen (${walletInscriptions.length + newOnes.length} gesamt)`);
            return;
          }
        } catch { /* not JSON, treat as plain text */ }

        // Plain text – put it in the textarea
        setIdListText(text);
        const ids = parseIdList(text);
        if (ids.length > 0) {
          const existingIds = new Set(walletInscriptions.map(w => w.id));
          const newOnes = ids.filter(id => !existingIds.has(id)).map(id => ({ id } as WalletInscription));
          setWalletInscriptions(prev => [...prev, ...newOnes]);
          setScanProgress(`✅ ${newOnes.length} IDs aus Datei geladen (${walletInscriptions.length + newOnes.length} gesamt)`);
        } else {
          setError('Keine gültigen Inscription IDs in der Datei gefunden!');
        }
      } catch { setError('Fehler beim Lesen der Datei!'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [walletInscriptions, parseIdList]);

  // ============================================================
  // SELECTION
  // ============================================================
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredInscriptions.map(i => i.id)));
  }, [walletInscriptions, filterText]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const filteredInscriptions = useMemo(() => {
    if (!filterText) return walletInscriptions;
    const lower = filterText.toLowerCase();
    return walletInscriptions.filter(i =>
      i.id.toLowerCase().includes(lower) ||
      (i.contentType || '').toLowerCase().includes(lower) ||
      (i.number?.toString() || '').includes(lower)
    );
  }, [walletInscriptions, filterText]);

  const usedInscriptionIds = useMemo(() => {
    const set = new Set<string>();
    for (const layer of layers) {
      for (const trait of layer.traits) {
        if (trait.inscriptionId) set.add(trait.inscriptionId);
      }
    }
    return set;
  }, [layers]);

  // ============================================================
  // MOVE SELECTED TO LAYER
  // ============================================================
  const moveSelectedToLayer = useCallback((layerId: string) => {
    if (selectedIds.size === 0) return;
    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      const newTraits: TraitItem[] = [];
      for (const insId of selectedIds) {
        if (!l.traits.some(t => t.inscriptionId === insId)) {
          const insc = walletInscriptions.find(w => w.id === insId);
          newTraits.push({
            inscriptionId: insId,
            name: '',
            rarity: 50,
            contentType: insc?.contentType,
          });
        }
      }
      return { ...l, traits: [...l.traits, ...newTraits] };
    }));
    setSelectedIds(new Set());
  }, [selectedIds, walletInscriptions]);

  // ============================================================
  // DRAG & DROP
  // ============================================================
  const handleDragStart = useCallback((e: React.DragEvent, inscId: string) => {
    // If dragging a selected item, drag ALL selected items
    // If dragging an unselected item, drag only that one
    const ids = selectedIds.has(inscId) ? Array.from(selectedIds) : [inscId];
    e.dataTransfer.setData('text/plain', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  }, [selectedIds]);

  const handleLayerDragOver = useCallback((e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLayerId(layerId);
  }, []);

  const handleLayerDragLeave = useCallback(() => {
    setDragOverLayerId(null);
  }, []);

  const handleLayerDrop = useCallback((e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    setDragOverLayerId(null);
    try {
      const ids: string[] = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (!Array.isArray(ids) || ids.length === 0) return;

      setLayers(prev => prev.map(l => {
        if (l.id !== layerId) return l;
        const newTraits: TraitItem[] = [];
        for (const insId of ids) {
          if (!l.traits.some(t => t.inscriptionId === insId)) {
            const insc = walletInscriptions.find(w => w.id === insId);
            newTraits.push({
              inscriptionId: insId,
              name: '',
              rarity: 50,
              contentType: insc?.contentType,
            });
          }
        }
        return { ...l, traits: [...l.traits, ...newTraits] };
      }));
      setSelectedIds(new Set());
    } catch { /* ignore parse errors */ }
  }, [walletInscriptions]);

  // ============================================================
  // LAYER MANAGEMENT
  // ============================================================
  const addLayer = useCallback(() => {
    const newLayer: Layer = { id: uid(), name: '', traitType: '', traits: [], expanded: true };
    setLayers(prev => [...prev, newLayer]);
    // Don't auto-set targetLayerId - user should choose explicitly
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.filter(l => l.id !== layerId));
    if (targetLayerId === layerId) setTargetLayerId(null);
  }, [targetLayerId]);

  const moveLayer = useCallback((layerId: string, dir: -1 | 1) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }, []);

  const updateLayer = useCallback((layerId: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, ...updates } : l));
  }, []);

  const toggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, expanded: !l.expanded } : l));
  }, []);

  const addTraitManually = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, traits: [...l.traits, { inscriptionId: '', name: '', rarity: 50 }] } : l
    ));
  }, []);

  const removeTrait = useCallback((layerId: string, traitIdx: number) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, traits: l.traits.filter((_, i) => i !== traitIdx) } : l
    ));
  }, []);

  const updateTrait = useCallback((layerId: string, traitIdx: number, updates: Partial<TraitItem>) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, traits: l.traits.map((t, i) => i === traitIdx ? { ...t, ...updates } : t) } : l
    ));
  }, []);

  // ============================================================
  // GENERATE
  // ============================================================
  const weightedRandom = useCallback((traits: TraitItem[]): TraitItem => {
    const totalWeight = traits.reduce((sum, t) => sum + (t.rarity || 1), 0);
    let rand = Math.random() * totalWeight;
    for (const trait of traits) {
      rand -= (trait.rarity || 1);
      if (rand <= 0) return trait;
    }
    return traits[traits.length - 1];
  }, []);

  const handleGenerate = useCallback(() => {
    setError('');
    const validLayers = layers.filter(l => l.name && l.traitType && l.traits.length > 0);
    if (validLayers.length === 0) { setError('Mindestens ein Layer mit Traits definieren!'); return; }
    if (validLayers.some(l => l.traits.some(t => !t.name))) { setError('Alle Traits brauchen einen Namen!'); return; }
    if (validLayers.some(l => l.traits.some(t => !t.inscriptionId))) { setError('Alle Traits brauchen eine Inscription ID!'); return; }

    const items: GeneratedItem[] = [];
    const seenCombos = new Set<string>();
    const maxAttempts = totalCount * 10;
    let attempts = 0;

    while (items.length < totalCount && attempts < maxAttempts) {
      attempts++;
      const selectedLayers = validLayers.map(layer => ({
        layerName: layer.name,
        traitType: layer.traitType,
        trait: weightedRandom(layer.traits),
      }));
      const comboKey = selectedLayers.map(l => l.trait.inscriptionId).join('|');
      if (seenCombos.has(comboKey) && attempts < maxAttempts - totalCount) continue;
      seenCombos.add(comboKey);

      const index = items.length + 1;
      const svgImages = selectedLayers.map(l => `  <image href="/content/${l.trait.inscriptionId}" />`).join('\n');
      items.push({
        index,
        layers: selectedLayers,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${svgImages}\n</svg>`,
      });
    }

    setGenerated(items);
    setPreviewIndex(0);
    setHashlist(items.map((item, idx) => ({
      id: `PLACEHOLDER_${idx + 1}`,
      meta: {
        name: `${collectionName} #${idx + 1}`,
        attributes: item.layers.map(l => ({ trait_type: l.traitType, value: l.trait.name })),
      },
    })));
  }, [layers, totalCount, collectionName, viewBox, weightedRandom]);

  // ============================================================
  // RARITY STATS
  // ============================================================
  const rarityStats = useMemo(() => {
    if (generated.length === 0) return null;
    const stats: Record<string, Record<string, number>> = {};
    for (const item of generated) {
      for (const layer of item.layers) {
        if (!stats[layer.traitType]) stats[layer.traitType] = {};
        stats[layer.traitType][layer.trait.name] = (stats[layer.traitType][layer.trait.name] || 0) + 1;
      }
    }
    return stats;
  }, [generated]);

  // ============================================================
  // DOWNLOADS
  // ============================================================
  const downloadJSON = useCallback((data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadSVG = useCallback((idx: number) => {
    const item = generated[idx];
    if (!item) return;
    const blob = new Blob([item.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${collectionName.replace(/\s+/g, '_').toLowerCase()}_${idx + 1}.svg`; a.click();
    URL.revokeObjectURL(url);
  }, [generated, collectionName]);

  // ============================================================
  // IMPORT / EXPORT CONFIG (file-based)
  // ============================================================
  const exportConfig = useCallback(() => {
    downloadJSON({ collectionName, totalCount, viewBox, layers },
      `${collectionName.replace(/\s+/g, '_').toLowerCase()}_config.json`);
  }, [collectionName, totalCount, viewBox, layers, downloadJSON]);

  const importConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string);
        if (config.collectionName) setCollectionName(config.collectionName);
        if (config.totalCount) setTotalCount(config.totalCount);
        if (config.viewBox) setViewBox(config.viewBox);
        if (config.layers) setLayers(config.layers);
      } catch { setError('Ungültige Config-Datei!'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // ============================================================
  // RENDER: ACCESS CHECK
  // ============================================================
  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">🔒 Wallet verbinden</h1>
          <p className="text-gray-400">Verbinde dein Wallet um das Tool zu nutzen.</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">⛔ Kein Zugang</h1>
          <p className="text-gray-400">Dieses Tool ist nur für Admins verfügbar.</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: PROJECT LIST (no project open)
  // ════════════════════════════════════════════════════════════
  if (!activeProjectId) {
    return (
      <div className="min-h-screen bg-black text-white pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              🎨 Recursive Collection Generator
            </h1>
            <p className="text-gray-400 text-sm mt-2">Projekte verwalten – erstellen, speichern, weiterbearbeiten</p>
          </div>

          {/* NEW PROJECT */}
          <div className="mb-6">
            <button
              onClick={() => createNewProject()}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 text-lg shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">+</span>
              <span>Neues Projekt erstellen</span>
            </button>
          </div>

          {/* PROJECT LIST */}
          {projects.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-300 mb-2">📂 Gespeicherte Projekte ({projects.length})</h2>
              {projects.map(project => (
                <div key={project.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-600 transition-colors">
                  <div className="flex items-stretch">
                    {/* Thumbnail: first trait from first layer */}
                    <div className="w-20 h-20 flex-shrink-0 bg-black flex items-center justify-center border-r border-gray-800">
                      {project.layers?.[0]?.traits?.[0]?.inscriptionId ? (
                        <img
                          src={`https://ordinals.com/content/${project.layers[0].traits[0].inscriptionId}`}
                          alt="" className="w-full h-full object-contain" loading="lazy"
                        />
                      ) : (
                        <span className="text-3xl text-gray-700">🎨</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 min-w-0">
                      <h3 className="text-white font-bold truncate">{project.name || project.collectionName || 'Unnamed'}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                        <span>{project.layers?.length || 0} Layer</span>
                        <span>{project.layers?.reduce((s, l) => s + (l.traits?.length || 0), 0) || 0} Traits</span>
                        <span>{project.generated?.length || 0} generiert</span>
                        <span>{project.walletInscriptions?.length || 0} Inscriptions</span>
                      </div>
                      <div className="flex gap-x-4 text-[10px] text-gray-600 mt-1">
                        <span>Erstellt: {formatDate(project.createdAt)}</span>
                        <span>Zuletzt: {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-center gap-1 p-3 border-l border-gray-800">
                      <button
                        onClick={() => openProject(project.id)}
                        className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-500"
                      >
                        Öffnen
                      </button>
                      <button
                        onClick={() => duplicateProject(project.id)}
                        className="px-4 py-1.5 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700"
                      >
                        Duplizieren
                      </button>
                      {confirmDelete === project.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="px-2 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-500"
                          >
                            Ja!
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                          >
                            Nein
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(project.id)}
                          className="px-4 py-1.5 bg-gray-800 text-red-400 rounded text-xs hover:bg-red-900/30"
                        >
                          Löschen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-600 border border-dashed border-gray-700 rounded-xl">
              <p className="text-4xl mb-4">📂</p>
              <p className="text-lg">Keine Projekte vorhanden</p>
              <p className="text-sm mt-1">Erstelle dein erstes Projekt!</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: PROJECT EDITOR (project open)
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-black text-white pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4">

        {/* PROJECT HEADER BAR */}
        <div className="flex items-center gap-3 mb-4 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 sticky top-14 z-40">
          <button onClick={closeProject}
            className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-1">
            ◀ Projekte
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 truncate">
              🎨 {collectionName || 'Unnamed'}
            </h1>
          </div>
          <button onClick={saveCurrentProject}
            className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 flex items-center gap-1">
            💾 Speichern
          </button>
          {saveStatus && <span className="text-xs text-emerald-400 animate-pulse">{saveStatus}</span>}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white ml-2">✕</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            SECTION 1: WALLET SCANNER
            ════════════════════════════════════════════════ */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h2 className="text-lg font-bold mb-3"><span className="text-purple-400">🔍</span> Inscriptions laden</h2>

          {/* Tab Toggle */}
          <div className="flex gap-1 mb-3 bg-black/50 rounded-lg p-1 border border-gray-800 w-fit">
            <button onClick={() => setLoadMode('wallet')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${loadMode === 'wallet' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              🔍 Wallet scannen
            </button>
            <button onClick={() => setLoadMode('idlist')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${loadMode === 'idlist' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              📋 ID-Liste einfügen
            </button>
          </div>

          {/* Mode: Wallet Scanner */}
          {loadMode === 'wallet' && (
            <div className="flex gap-2 mb-3">
              <input type="text" value={scanAddress} onChange={e => setScanAddress(e.target.value.trim())}
                placeholder="bc1p... (Taproot-Adresse)"
                className="flex-1 px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono" />
              {connectedAddress && (
                <button onClick={() => setScanAddress(connectedAddress)}
                  className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-xs text-gray-300 hover:bg-gray-700 whitespace-nowrap">
                  Meine Adresse
                </button>
              )}
              <button onClick={scanWallet} disabled={scanning}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 text-sm font-bold whitespace-nowrap">
                {scanning ? '⏳ Scanne...' : '🔍 Scannen'}
              </button>
            </div>
          )}

          {/* Mode: ID List */}
          {loadMode === 'idlist' && (
            <div className="mb-3">
              <textarea
                value={idListText}
                onChange={e => setIdListText(e.target.value)}
                placeholder={"Inscription IDs eingeben (eine pro Zeile oder komma-getrennt):\n\nabc123...i0\ndef456...i0\nghi789...i0"}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-xs font-mono h-32 resize-y"
              />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={loadFromIdList}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-sm font-bold">
                  📋 IDs laden
                </button>
                <label className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
                  📂 JSON/TXT Datei laden
                  <input type="file" accept=".json,.txt,.csv" onChange={loadIdsFromFile} className="hidden" />
                </label>
                {idListText.trim() && (
                  <span className="text-xs text-gray-500">
                    {parseIdList(idListText).length} IDs erkannt
                  </span>
                )}
              </div>
            </div>
          )}

          {scanProgress && <p className="text-xs text-gray-400 mb-3">{scanProgress}</p>}

          {walletInscriptions.length > 0 && (
            <div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-black/50 rounded-lg border border-gray-800">
                <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
                  placeholder="🔎 Filter (ID, Typ, Nummer)..."
                  className="flex-1 min-w-[180px] px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                <span className="text-xs text-gray-500">{filteredInscriptions.length} angezeigt</span>
                <span className="text-xs text-purple-400 font-bold">{selectedIds.size} ausgewählt</span>
                <button onClick={selectAll} className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-700">Alle</button>
                <button onClick={deselectAll} className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-700">Keine</button>

                {selectedIds.size > 0 && layers.length > 0 && (
                  <div className="flex items-center gap-1 bg-purple-900/30 border border-purple-700 rounded-lg px-2 py-1">
                    <span className="text-xs text-purple-300 font-bold">→ In Layer:</span>
                    <select value={targetLayerId || ''} onChange={e => setTargetLayerId(e.target.value || null)}
                      className="px-2 py-1 bg-gray-900 border border-purple-500 rounded text-xs text-white font-bold min-w-[140px]">
                      <option value="">-- Layer wählen --</option>
                      {layers.map((l, i) => (
                        <option key={l.id} value={l.id}>#{i + 1} {l.name || '(unnamed)'} ({l.traits.length} Traits)</option>
                      ))}
                    </select>
                    <button onClick={() => targetLayerId && moveSelectedToLayer(targetLayerId)} disabled={!targetLayerId}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                      ↓ Verschieben ({selectedIds.size})
                    </button>
                  </div>
                )}
                {selectedIds.size > 0 && layers.length === 0 && (
                  <span className="text-xs text-yellow-400">⚠️ Erst einen Layer erstellen!</span>
                )}
                {selectedIds.size > 0 && layers.length > 0 && (
                  <span className="text-[10px] text-gray-600">oder per Drag & Drop in Layer ziehen</span>
                )}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5 max-h-[400px] overflow-y-auto p-1">
                {filteredInscriptions.map(insc => {
                  const isSelected = selectedIds.has(insc.id);
                  const isUsed = usedInscriptionIds.has(insc.id);
                  return (
                    <div key={insc.id}
                      onClick={() => !isUsed && toggleSelect(insc.id)}
                      draggable={!isUsed}
                      onDragStart={e => handleDragStart(e, insc.id)}
                      className={`aspect-square rounded-lg border-2 cursor-pointer relative overflow-hidden transition-all ${
                        isUsed ? 'border-green-600 opacity-40 cursor-not-allowed'
                          : isSelected ? 'border-purple-500 ring-2 ring-purple-500/50 scale-[1.02]'
                          : 'border-gray-800 hover:border-gray-500'
                      }`}
                      title={`${insc.id}\n#${insc.number || '?'}\n${insc.contentType || '?'}`}>
                      <img src={`https://ordinals.com/content/${insc.id}`} alt=""
                        className="w-full h-full object-contain bg-white" loading="lazy" />
                      {isSelected && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">✓</span>
                        </div>
                      )}
                      {isUsed && (
                        <div className="absolute inset-0 bg-green-900/50 flex items-center justify-center">
                          <span className="text-green-300 text-[10px] font-bold">IN LAYER</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            SECTION 2: SETTINGS
            ════════════════════════════════════════════════ */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h2 className="text-lg font-bold mb-3"><span className="text-purple-400">⚙️</span> Einstellungen</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Collection Name</label>
              <input type="text" value={collectionName} onChange={e => setCollectionName(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Anzahl generieren</label>
              <input type="number" value={totalCount} onChange={e => setTotalCount(Math.max(1, parseInt(e.target.value) || 1))}
                min={1} max={10000}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SVG viewBox</label>
              <input type="text" value={viewBox} onChange={e => setViewBox(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm font-mono" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={exportConfig} className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-700">💾 Config exportieren</button>
            <label className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-700 cursor-pointer">
              📂 Config importieren
              <input ref={fileInputRef} type="file" accept=".json" onChange={importConfig} className="hidden" />
            </label>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            SECTION 3: LAYERS
            ════════════════════════════════════════════════ */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold"><span className="text-purple-400">📚</span> Layer ({layers.length})</h2>
            <button onClick={addLayer} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-sm font-bold">+ Layer hinzufügen</button>
          </div>

          <p className="text-xs text-gray-500 mb-3">Layer werden von unten nach oben gestapelt. #1 = Hintergrund.</p>

          {layers.map((layer, layerIdx) => (
            <div key={layer.id}
              onDragOver={e => handleLayerDragOver(e, layer.id)}
              onDragLeave={handleLayerDragLeave}
              onDrop={e => handleLayerDrop(e, layer.id)}
              className={`bg-gray-900 border-2 rounded-xl mb-3 overflow-hidden transition-all ${
                dragOverLayerId === layer.id
                  ? 'border-purple-400 shadow-lg shadow-purple-500/40 scale-[1.01] bg-purple-900/20'
                  : targetLayerId === layer.id
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'border-gray-700'
              }`}>
              {/* Layer Header */}
              <div className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
                dragOverLayerId === layer.id ? 'bg-purple-900/40' : 'bg-gray-800'
              }`} onClick={() => toggleLayer(layer.id)}>
                <span className="text-purple-400 font-bold text-sm w-8">#{layerIdx + 1}</span>
                <span className="text-white font-semibold flex-1">{layer.name || '(Unnamed Layer)'}</span>
                <span className="text-xs text-gray-500">{layer.traits.length} Traits</span>
                <button
                  onClick={e => { e.stopPropagation(); setTargetLayerId(layer.id === targetLayerId ? null : layer.id); }}
                  className={`px-2 py-0.5 rounded text-xs font-bold ${targetLayerId === layer.id ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-purple-900 hover:text-purple-300'}`}
                  title="Als Ziel-Layer für Inscriptions setzen">
                  🎯 Ziel
                </button>
                <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, -1); }} disabled={layerIdx === 0}
                  className="p-1 text-gray-500 hover:text-white disabled:opacity-30">▲</button>
                <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, 1); }} disabled={layerIdx === layers.length - 1}
                  className="p-1 text-gray-500 hover:text-white disabled:opacity-30">▼</button>
                <button onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                  className="p-1 text-red-500 hover:text-red-400">✕</button>
                <span className="text-gray-500 text-sm">{layer.expanded ? '▾' : '▸'}</span>
              </div>

              {/* Layer Body */}
              {layer.expanded && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Layer Name</label>
                      <input type="text" value={layer.name} onChange={e => updateLayer(layer.id, { name: e.target.value })}
                        placeholder="z.B. background, eyes, head..."
                        className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">trait_type (für Hashlist)</label>
                      <input type="text" value={layer.traitType} onChange={e => updateLayer(layer.id, { traitType: e.target.value })}
                        placeholder="z.B. background, eyes, head..."
                        className="w-full px-3 py-2 bg-black border border-gray-600 rounded-lg text-white text-sm" />
                    </div>
                  </div>

                  {layer.traits.length === 0 ? (
                    <div className={`text-center py-6 border border-dashed rounded-lg transition-colors ${
                      dragOverLayerId === layer.id ? 'border-purple-400 bg-purple-900/20 text-purple-300' : 'border-gray-700 text-gray-600'
                    }`}>
                      <p className="text-sm mb-1">{dragOverLayerId === layer.id ? '⬇️ Hier ablegen!' : 'Keine Traits'}</p>
                      <p className="text-xs">Inscriptions oben auswählen und hierher ziehen (Drag & Drop)</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {layer.traits.map((trait, traitIdx) => (
                        <div key={traitIdx} className="flex gap-2 items-start bg-black/50 p-3 rounded-lg border border-gray-800">
                          <div className="flex-shrink-0 w-14 h-14 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden cursor-pointer"
                            onClick={() => setSelectedLayerPreview(
                              selectedLayerPreview?.layerId === layer.id && selectedLayerPreview?.traitIdx === traitIdx
                                ? null : { layerId: layer.id, traitIdx }
                            )}>
                            {trait.inscriptionId ? (
                              <img src={`https://ordinals.com/content/${trait.inscriptionId}`} alt={trait.name}
                                className="w-full h-full object-contain" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
                            )}
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500">Inscription ID</label>
                              <input type="text" value={trait.inscriptionId}
                                onChange={e => updateTrait(layer.id, traitIdx, { inscriptionId: e.target.value.trim() })}
                                placeholder="abc...i0"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-[10px] text-white font-mono" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Name</label>
                              <input type="text" value={trait.name}
                                onChange={e => updateTrait(layer.id, traitIdx, { name: e.target.value })}
                                placeholder="z.B. blue gradient"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <label className="block text-xs text-gray-500">Rarity ({trait.rarity})</label>
                                <input type="range" value={trait.rarity}
                                  onChange={e => updateTrait(layer.id, traitIdx, { rarity: parseInt(e.target.value) })}
                                  min={1} max={100} className="w-full accent-purple-500" />
                              </div>
                              <button onClick={() => removeTrait(layer.id, traitIdx)}
                                className="p-1.5 text-red-500 hover:text-red-400 text-xs">✕</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={() => addTraitManually(layer.id)}
                    className="mt-3 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-700">
                    + Trait manuell hinzufügen
                  </button>
                </div>
              )}
            </div>
          ))}

          {layers.length === 0 && (
            <div className="text-center py-12 text-gray-600 border border-dashed border-gray-700 rounded-xl">
              <p className="text-lg mb-2">Keine Layer definiert</p>
              <p className="text-sm">Klicke "Layer hinzufügen" um zu beginnen.</p>
            </div>
          )}
        </div>

        {/* ════════════════ LARGE TRAIT PREVIEW ════════════════ */}
        {selectedLayerPreview && (() => {
          const layer = layers.find(l => l.id === selectedLayerPreview.layerId);
          const trait = layer?.traits[selectedLayerPreview.traitIdx];
          if (!layer || !trait || !trait.inscriptionId) return null;
          return (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLayerPreview(null)}>
              <div className="bg-gray-900 border border-purple-500 rounded-xl p-4 max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-white font-bold">{trait.name || '(Kein Name)'}</p>
                    <p className="text-xs text-gray-400">Layer: {layer.name} | Rarity: {trait.rarity}</p>
                  </div>
                  <button onClick={() => setSelectedLayerPreview(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="w-full aspect-square bg-black rounded-lg overflow-hidden">
                  <img src={`https://ordinals.com/content/${trait.inscriptionId}`} alt={trait.name}
                    className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-gray-500 font-mono mt-2 break-all">{trait.inscriptionId}</p>
              </div>
            </div>
          );
        })()}

        {/* ════════════════ GENERATE BUTTON ════════════════ */}
        <div className="text-center mb-6">
          <button onClick={handleGenerate}
            disabled={layers.length === 0 || layers.every(l => l.traits.length === 0)}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-30 text-lg shadow-lg">
            🎲 {totalCount} Items generieren
          </button>
          {layers.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Mögliche Kombinationen: {layers.filter(l => l.traits.length > 0).reduce((acc, l) => acc * l.traits.length, 1).toLocaleString()}
            </p>
          )}
        </div>

        {/* ════════════════════════════════════════════════
            SECTION 4: RESULTS
            ════════════════════════════════════════════════ */}
        {generated.length > 0 && (
          <div className="space-y-4">
            {/* Downloads */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-3"><span className="text-purple-400">📥</span> Downloads</h2>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => downloadJSON(hashlist, `${collectionName.replace(/\s+/g, '_').toLowerCase()}_hashlist.json`)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold">
                  📋 Hashlist JSON ({generated.length})
                </button>
                <button onClick={() => downloadJSON(
                  generated.map((item, idx) => ({
                    filename: `${collectionName.replace(/\s+/g, '_').toLowerCase()}_${idx + 1}.svg`,
                    svg: item.svg,
                    traits: item.layers.map(l => ({ trait_type: l.traitType, value: l.trait.name })),
                  })),
                  `${collectionName.replace(/\s+/g, '_').toLowerCase()}_svgs.json`
                )}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-bold">
                  🖼️ Alle SVGs ({generated.length})
                </button>
              </div>
            </div>

            {/* Rarity Stats */}
            {rarityStats && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h2 className="text-lg font-bold mb-3"><span className="text-purple-400">📊</span> Rarity Statistik</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(rarityStats).map(([traitType, values]) => (
                    <div key={traitType} className="bg-black/50 rounded-lg p-3 border border-gray-800">
                      <h3 className="text-sm font-bold text-purple-400 mb-2">{traitType}</h3>
                      <div className="space-y-1">
                        {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                          const pct = ((count / generated.length) * 100).toFixed(1);
                          return (
                            <div key={name} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-300 flex-1 truncate">{name}</span>
                              <div className="w-20 bg-gray-800 rounded-full h-1.5">
                                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-gray-500 w-16 text-right">{count}x ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-3"><span className="text-purple-400">👀</span> Vorschau</h2>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex === 0}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white hover:bg-gray-700 disabled:opacity-30">◀</button>
                <span className="text-sm text-gray-400">#{previewIndex + 1} / {generated.length}</span>
                <button onClick={() => setPreviewIndex(Math.min(generated.length - 1, previewIndex + 1))} disabled={previewIndex >= generated.length - 1}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white hover:bg-gray-700 disabled:opacity-30">▶</button>
                <button onClick={() => setPreviewIndex(Math.floor(Math.random() * generated.length))}
                  className="px-3 py-1.5 bg-purple-900 border border-purple-600 rounded text-sm text-purple-300 hover:bg-purple-800">🎲</button>
                <button onClick={() => downloadSVG(previewIndex)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 ml-auto">⬇️ SVG</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
                  <div className="w-full aspect-square relative">
                    {generated[previewIndex]?.layers.map((layer, i) => (
                      <img key={i} src={`https://ordinals.com/content/${layer.trait.inscriptionId}`}
                        alt={layer.trait.name} className="absolute inset-0 w-full h-full object-contain"
                        style={{ zIndex: i }} loading="lazy" />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-2">{collectionName} #{previewIndex + 1}</h3>
                  <div className="space-y-2 mb-4">
                    {generated[previewIndex]?.layers.map((layer, i) => (
                      <div key={i} className="flex items-center gap-2 bg-black/50 rounded p-2 border border-gray-800">
                        <img src={`https://ordinals.com/content/${layer.trait.inscriptionId}`}
                          alt="" className="w-8 h-8 object-contain rounded border border-gray-700" loading="lazy" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">{layer.traitType}</p>
                          <p className="text-sm text-white">{layer.trait.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">SVG Code</summary>
                    <pre className="mt-2 p-3 bg-black rounded-lg text-xs text-green-400 font-mono overflow-x-auto border border-gray-800 whitespace-pre-wrap break-all">
                      {generated[previewIndex]?.svg}
                    </pre>
                  </details>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-3"><span className="text-purple-400">🖼️</span> Alle Items ({generated.length})</h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[600px] overflow-y-auto">
                {generated.map((item, idx) => (
                  <div key={idx} onClick={() => setPreviewIndex(idx)}
                    className={`aspect-square bg-black rounded-lg border cursor-pointer relative overflow-hidden ${
                      idx === previewIndex ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-gray-800 hover:border-gray-600'
                    }`}>
                    {item.layers.map((layer, i) => (
                      <img key={i} src={`https://ordinals.com/content/${layer.trait.inscriptionId}`}
                        alt="" className="absolute inset-0 w-full h-full object-contain"
                        style={{ zIndex: i }} loading="lazy" />
                    ))}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-center">
                      <span className="text-[10px] text-gray-400">#{idx + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecursiveCollectionToolPage;
