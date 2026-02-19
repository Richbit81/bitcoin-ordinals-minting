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
  group?: string;
}

/** Leerer Layer = Name "none" – wird im SVG übersprungen (kein image-Tag) */
function isNoneTrait(t: TraitItem): boolean {
  return t.name === 'none';
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
  layers: { layerName: string; traitType: string; trait: TraitItem; offsetX?: number; offsetY?: number }[];
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
const LAST_PROJECT_KEY = 'recursive_collection_last_project';

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

function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch { return null; }
}

function setLastProjectId(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_PROJECT_KEY, id);
    else localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {}
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
  const [editingItem, setEditingItem] = useState(false);
  const [selectedLayerPreview, setSelectedLayerPreview] = useState<{ layerId: string; traitIdx: number } | null>(null);
  const [livePreviewTraits, setLivePreviewTraits] = useState<Record<string, number>>({}); // layerId -> traitIdx
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [traitDrag, setTraitDrag] = useState<{ layerId: string; fromIdx: number } | null>(null);
  const [traitDragOverIdx, setTraitDragOverIdx] = useState<number | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<Record<string, Set<number>>>({}); // layerId -> Set of traitIdx

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<{
    activeProjectId: string | null;
    projects: SavedProject[];
    collectionName: string;
    totalCount: number;
    viewBox: string;
    layers: Layer[];
    scanAddress: string;
    walletInscriptions: WalletInscription[];
    generated: GeneratedItem[];
    hashlist: HashlistEntry[];
  }>({ activeProjectId: null, projects: [], collectionName: '', totalCount: 100, viewBox: '', layers: [], scanAddress: '', walletInscriptions: [], generated: [], hashlist: [] });

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
    setLastProjectId(null);
  }, [saveCurrentProject]);

  // Ref für beforeunload-Save (hält immer aktuellen State)
  useEffect(() => {
    stateRef.current = {
      activeProjectId,
      projects,
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

  // Speichern bei Tab/Browser-Schließen (damit nichts verloren geht!)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = stateRef.current;
      if (!s.activeProjectId) return;
      const updated = s.projects.map(p => {
        if (p.id !== s.activeProjectId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          name: s.collectionName || p.name,
          collectionName: s.collectionName,
          totalCount: s.totalCount,
          viewBox: s.viewBox,
          layers: s.layers,
          scanAddress: s.scanAddress,
          walletInscriptions: s.walletInscriptions,
          generated: s.generated,
          hashlist: s.hashlist,
        };
      });
      saveProjects(updated);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Beim Zurückkehren: letztes Projekt wieder öffnen
  useEffect(() => {
    if (projects.length === 0) return;
    const lastId = getLastProjectId();
    if (lastId && projects.some(p => p.id === lastId) && !activeProjectId) {
      setActiveProjectId(lastId);
      const proj = projects.find(p => p.id === lastId);
      if (proj) loadProjectIntoState(proj);
    }
  }, []); // Nur einmal beim Mount

  // lastProjectId merken wenn Projekt gewechselt wird
  useEffect(() => {
    if (activeProjectId) setLastProjectId(activeProjectId);
  }, [activeProjectId]);

  // ---- AUTO-SAVE (1 Sekunde Debounce – schneller als vorher!) ----
  useEffect(() => {
    if (!activeProjectId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentProject();
    }, 1000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [layers, collectionName, totalCount, viewBox, scanAddress, walletInscriptions, generated, hashlist, activeProjectId, saveCurrentProject]);

  // ============================================================
  // WALLET SCANNER (UniSat Open API)
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
      let cursor = 0;
      const pageSize = 100;
      let total = 0;

      do {
        const url = `https://open-api.unisat.io/v1/indexer/address/${addr}/inscription-data?cursor=${cursor}&size=${pageSize}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
        const json = await res.json();
        if (json.code !== 0) throw new Error(json.msg || 'API Error');
        const data = json.data;
        total = data.total || 0;
        setScanTotal(total);

        const items: WalletInscription[] = (data.inscription || []).map((r: any) => ({
          id: r.inscriptionId,
          number: r.inscriptionNumber,
          contentType: r.contentType,
          contentLength: r.contentLength,
        }));

        allInscriptions = [...allInscriptions, ...items];
        setWalletInscriptions([...allInscriptions]);
        setScanProgress(`${allInscriptions.length} / ${total} geladen...`);
        cursor += pageSize;

        if (items.length < pageSize) break;
        await new Promise(r => setTimeout(r, 200));
      } while (cursor < total);

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
        if (trait.inscriptionId && !isNoneTrait(trait)) set.add(trait.inscriptionId);
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

  /** Leeres Layer "none" hinzufügen – kein Bild im SVG */
  const addTraitNone = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, traits: [...l.traits, { inscriptionId: '', name: 'none', rarity: 50 }] } : l
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

  const moveTrait = useCallback((layerId: string, traitIdx: number, direction: 'up' | 'down') => {
    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      const newIdx = direction === 'up' ? traitIdx - 1 : traitIdx + 1;
      if (newIdx < 0 || newIdx >= l.traits.length) return l;
      const traits = [...l.traits];
      [traits[traitIdx], traits[newIdx]] = [traits[newIdx], traits[traitIdx]];
      return { ...l, traits };
    }));
  }, []);

  const toggleTraitSelection = useCallback((layerId: string, traitIdx: number, shiftKey: boolean) => {
    setSelectedTraits(prev => {
      const next = { ...prev };
      const current = new Set(next[layerId] || []);
      if (shiftKey && current.size > 0) {
        const existing = Array.from(current);
        const min = Math.min(...existing, traitIdx);
        const max = Math.max(...existing, traitIdx);
        for (let i = min; i <= max; i++) current.add(i);
      } else if (current.has(traitIdx)) {
        current.delete(traitIdx);
      } else {
        current.add(traitIdx);
      }
      next[layerId] = current;
      return next;
    });
  }, []);

  const handleTraitDrop = useCallback((layerId: string, toIdx: number) => {
    if (!traitDrag || traitDrag.layerId !== layerId) return;
    const sel = selectedTraits[layerId];
    const isMulti = sel && sel.size > 1 && sel.has(traitDrag.fromIdx);

    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      if (isMulti) {
        const indices = Array.from(sel).sort((a, b) => a - b);
        const movedTraits = indices.map(i => l.traits[i]);
        const remaining = l.traits.filter((_, i) => !sel.has(i));
        const insertAt = Math.min(toIdx, remaining.length);
        remaining.splice(insertAt, 0, ...movedTraits);
        return { ...l, traits: remaining };
      }
      const traits = [...l.traits];
      const [moved] = traits.splice(traitDrag.fromIdx, 1);
      traits.splice(toIdx, 0, moved);
      return { ...l, traits };
    }));
    setTraitDrag(null);
    setTraitDragOverIdx(null);
    setSelectedTraits(prev => ({ ...prev, [layerId]: new Set() }));
  }, [traitDrag, selectedTraits]);

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

    if (layers.length === 0) { setError('Kein Layer definiert! Erstelle mindestens einen Layer.'); return; }

    // Check what's missing per layer
    const issues: string[] = [];
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const label = `Layer #${i + 1}${l.name ? ` "${l.name}"` : ''}`;
      if (!l.name) issues.push(`${label}: Layer Name fehlt`);
      if (!l.traitType) issues.push(`${label}: trait_type fehlt`);
      if (l.traits.length === 0) issues.push(`${label}: Keine Traits`);
    }
    if (issues.length > 0) { setError(issues.join(' | ')); return; }

    const validLayers = layers.filter(l => l.name && l.traitType && l.traits.length > 0);
    if (validLayers.some(l => l.traits.some(t => !t.name))) { setError('Alle Traits brauchen einen Namen!'); return; }
    if (validLayers.some(l => l.traits.some(t => !isNoneTrait(t) && !t.inscriptionId))) { setError('Alle Traits (außer "none") brauchen eine Inscription ID!'); return; }

    const items: GeneratedItem[] = [];
    const seenCombos = new Set<string>();
    const maxAttempts = totalCount * 10;
    let attempts = 0;

    // First group = primary/linking group, rest = properties/modifiers
    const primaryGroup = (t: TraitItem): string | null => {
      if (!t.group) return null;
      const first = t.group.split(',')[0]?.toLowerCase().trim();
      return first || null;
    };
    const isUngrouped = (t: TraitItem) => !primaryGroup(t);

    const allPrimaries = new Set<string>();
    validLayers.forEach(l => l.traits.forEach(t => {
      const pg = primaryGroup(t);
      if (pg) allPrimaries.add(pg);
    }));
    const hasPrimaries = allPrimaries.size > 0;

    const noneTrait: TraitItem = { name: 'none', inscriptionId: '', rarity: 1 };

    // Weight calculation for primary group selection
    const primaryWeights: { pg: string | null; weight: number }[] = [];
    if (hasPrimaries) {
      const ungW = validLayers.reduce((sum, l) =>
        sum + l.traits.filter(t => isUngrouped(t)).reduce((s, t2) => s + (t2.rarity || 1), 0), 0);
      if (ungW > 0) primaryWeights.push({ pg: null, weight: ungW });
      for (const pg of allPrimaries) {
        const gw = validLayers.reduce((sum, l) =>
          sum + l.traits.filter(t => primaryGroup(t) === pg).reduce((s, t2) => s + (t2.rarity || 1), 0), 0);
        if (gw > 0) primaryWeights.push({ pg, weight: gw });
      }
    }
    const primaryTotalW = primaryWeights.reduce((s, w) => s + w.weight, 0);

    while (items.length < totalCount && attempts < maxAttempts) {
      attempts++;

      // Pick a random primary group
      let activePrimary: string | null = null;
      if (hasPrimaries) {
        let rand = Math.random() * primaryTotalW;
        for (const w of primaryWeights) {
          rand -= w.weight;
          if (rand <= 0) { activePrimary = w.pg; break; }
        }
      }

      const selectedLayers = validLayers.map(layer => {
        let pool = layer.traits;

        if (hasPrimaries) {
          const layerHasGroups = pool.some(t => !isUngrouped(t));

          if (!layerHasGroups) {
            // Neutral layer → use all traits
          } else if (activePrimary) {
            const matching = pool.filter(t => primaryGroup(t) === activePrimary);
            if (matching.length > 0) {
              pool = matching;
            } else {
              return { layerName: layer.name, traitType: layer.traitType, trait: noneTrait };
            }
          } else {
            const ungrouped = pool.filter(t => isUngrouped(t));
            if (ungrouped.length > 0) {
              pool = ungrouped;
            } else {
              return { layerName: layer.name, traitType: layer.traitType, trait: noneTrait };
            }
          }
        }

        const trait = weightedRandom(pool);
        return { layerName: layer.name, traitType: layer.traitType, trait };
      });

      const comboKey = selectedLayers.map(l => isNoneTrait(l.trait) ? 'none' : l.trait.inscriptionId).join('|');
      if (seenCombos.has(comboKey) && attempts < maxAttempts - totalCount) continue;
      seenCombos.add(comboKey);

      const index = items.length + 1;
      const svgImages = selectedLayers
        .filter(l => !isNoneTrait(l.trait))
        .map(l => `  <image href="/content/${l.trait.inscriptionId}" />`)
        .join('\n');
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
  // EDIT SINGLE GENERATED ITEM
  // ============================================================
  const updateGeneratedItemTrait = useCallback((itemIdx: number, layerIdx: number, newTraitIdx: number) => {
    setGenerated(prev => {
      const updated = [...prev];
      const item = { ...updated[itemIdx] };
      const layersCopy = [...item.layers];
      const layerEntry = { ...layersCopy[layerIdx] };

      // Find the matching layer definition to get the trait
      const matchingLayer = layers.find(l => l.traitType === layerEntry.traitType && l.name === layerEntry.layerName);
      if (!matchingLayer || newTraitIdx >= matchingLayer.traits.length) return prev;

      layerEntry.trait = matchingLayer.traits[newTraitIdx];
      layersCopy[layerIdx] = layerEntry;
      item.layers = layersCopy;
      item.svg = buildSvgFromLayers(layersCopy);

      updated[itemIdx] = item;
      return updated;
    });

    // Also update hashlist
    setHashlist(prev => {
      const updated = [...prev];
      if (!updated[itemIdx]) return prev;
      const entry = { ...updated[itemIdx] };
      const genItem = generated[itemIdx];
      if (!genItem) return prev;

      // We need the updated layers — get from generated after setState
      // Instead, compute from current layers
      const matchingLayer = layers.find(l => {
        const gl = genItem.layers[layerIdx];
        return gl && l.traitType === gl.traitType && l.name === gl.layerName;
      });
      if (!matchingLayer) return prev;

      const newTrait = matchingLayer.traits[newTraitIdx];
      if (!newTrait) return prev;

      const attrs = [...(entry.meta?.attributes || [])];
      if (attrs[layerIdx]) {
        attrs[layerIdx] = { ...attrs[layerIdx], value: newTrait.name };
      }
      entry.meta = { ...entry.meta, attributes: attrs };
      updated[itemIdx] = entry;
      return updated;
    });
  }, [layers, buildSvgFromLayers, generated]);

  const buildSvgFromLayers = useCallback((itemLayers: GeneratedItem['layers']) => {
    const svgImages = itemLayers
      .filter(l => !isNoneTrait(l.trait))
      .map(l => {
        const ox = l.offsetX || 0;
        const oy = l.offsetY || 0;
        return ox || oy
          ? `  <image href="/content/${l.trait.inscriptionId}" x="${ox}" y="${oy}" />`
          : `  <image href="/content/${l.trait.inscriptionId}" />`;
      })
      .join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${svgImages}\n</svg>`;
  }, [viewBox]);

  const moveGeneratedItemLayer = useCallback((itemIdx: number, layerIdx: number, direction: -1 | 1) => {
    setGenerated(prev => {
      const updated = [...prev];
      const item = { ...updated[itemIdx] };
      const layersCopy = [...item.layers];
      const targetIdx = layerIdx + direction;
      if (targetIdx < 0 || targetIdx >= layersCopy.length) return prev;

      [layersCopy[layerIdx], layersCopy[targetIdx]] = [layersCopy[targetIdx], layersCopy[layerIdx]];
      item.layers = layersCopy;
      item.svg = buildSvgFromLayers(layersCopy);

      updated[itemIdx] = item;
      return updated;
    });

    setHashlist(prev => {
      const updated = [...prev];
      if (!updated[itemIdx]) return prev;
      const entry = { ...updated[itemIdx] };
      const attrs = [...(entry.meta?.attributes || [])];
      const targetIdx = layerIdx + direction;
      if (targetIdx < 0 || targetIdx >= attrs.length) return prev;
      [attrs[layerIdx], attrs[targetIdx]] = [attrs[targetIdx], attrs[layerIdx]];
      entry.meta = { ...entry.meta, attributes: attrs };
      updated[itemIdx] = entry;
      return updated;
    });
  }, [buildSvgFromLayers]);

  const nudgeGeneratedItemLayer = useCallback((itemIdx: number, layerIdx: number, dx: number, dy: number, reset?: boolean) => {
    setGenerated(prev => {
      const updated = [...prev];
      const item = { ...updated[itemIdx] };
      const layersCopy = [...item.layers];
      const entry = { ...layersCopy[layerIdx] };
      if (reset) {
        delete entry.offsetX;
        delete entry.offsetY;
      } else {
        entry.offsetX = (entry.offsetX || 0) + dx;
        entry.offsetY = (entry.offsetY || 0) + dy;
        if (entry.offsetX === 0) delete entry.offsetX;
        if (entry.offsetY === 0) delete entry.offsetY;
      }
      layersCopy[layerIdx] = entry;
      item.layers = layersCopy;
      item.svg = buildSvgFromLayers(layersCopy);
      updated[itemIdx] = item;
      return updated;
    });
  }, [buildSvgFromLayers]);

  // ============================================================
  // LIVE PREVIEW (random trait per layer, respecting groups)
  // ============================================================
  const randomizeLivePreview = useCallback(() => {
    // First group = primary/linking group, rest = properties/modifiers
    const primaryGroup = (t: TraitItem): string | null => {
      if (!t.group) return null;
      const first = t.group.split(',')[0]?.toLowerCase().trim();
      return first || null;
    };
    const isUngrouped = (t: TraitItem) => !primaryGroup(t);

    // Collect all unique primary groups
    const allPrimaries = new Set<string>();
    layers.forEach(l => l.traits.forEach(t => {
      const pg = primaryGroup(t);
      if (pg) allPrimaries.add(pg);
    }));
    const hasPrimaries = allPrimaries.size > 0;

    // Pick a random primary group (weighted) or "ungrouped"
    let activePrimary: string | null = null;
    if (hasPrimaries) {
      const weights: { pg: string | null; weight: number }[] = [];
      const ungW = layers.reduce((s, l) =>
        s + l.traits.filter(t => isUngrouped(t)).reduce((s2, t) => s2 + (t.rarity || 1), 0), 0);
      if (ungW > 0) weights.push({ pg: null, weight: ungW });
      for (const pg of allPrimaries) {
        const gw = layers.reduce((s, l) =>
          s + l.traits.filter(t => primaryGroup(t) === pg).reduce((s2, t) => s2 + (t.rarity || 1), 0), 0);
        if (gw > 0) weights.push({ pg, weight: gw });
      }
      const totalW = weights.reduce((s, w) => s + w.weight, 0);
      let rand = Math.random() * totalW;
      for (const w of weights) {
        rand -= w.weight;
        if (rand <= 0) { activePrimary = w.pg; break; }
      }
    }

    console.log(`[Shuffle] === Primary: "${activePrimary ?? '(ungrouped)'}" ===`);

    const newPreview: Record<string, number> = {};
    for (const layer of layers) {
      if (layer.traits.length === 0) continue;

      let pool = layer.traits.map((t, i) => ({ t, i }));
      const layerHasGroups = pool.some(({ t }) => !isUngrouped(t));

      if (hasPrimaries && layerHasGroups) {
        if (activePrimary) {
          const matching = pool.filter(({ t }) => primaryGroup(t) === activePrimary);
          console.log(`[Shuffle]   "${layer.name}": ${matching.length}/${pool.length} match "${activePrimary}"`);
          pool = matching.length > 0 ? matching : [];
        } else {
          const ung = pool.filter(({ t }) => isUngrouped(t));
          console.log(`[Shuffle]   "${layer.name}": ungrouped → ${ung.length}`);
          pool = ung.length > 0 ? ung : [];
        }
      }

      if (pool.length > 0) {
        const totalW = pool.reduce((s, { t }) => s + (t.rarity || 1), 0);
        let rand = Math.random() * totalW;
        for (const { t, i } of pool) {
          rand -= (t.rarity || 1);
          if (rand <= 0) { newPreview[layer.id] = i; break; }
        }
        if (newPreview[layer.id] === undefined) newPreview[layer.id] = pool[pool.length - 1].i;
        const picked = layer.traits[newPreview[layer.id]];
        console.log(`[Shuffle]   → "${picked?.name}" [${picked?.group || ''}]`);
      } else {
        const noneIdx = layer.traits.findIndex(t => isNoneTrait(t));
        newPreview[layer.id] = noneIdx >= 0 ? noneIdx : -1;
        console.log(`[Shuffle]   → NONE`);
      }
    }
    setLivePreviewTraits(newPreview);
  }, [layers]);

  // Computed: get the current preview traits (use random selection or first trait)
  const livePreviewLayers = useMemo(() => {
    const noneTrait: TraitItem = { name: 'none', inscriptionId: '', rarity: 1 };
    return layers
      .filter(l => l.traits.length > 0)
      .map(l => {
        const idx = livePreviewTraits[l.id] ?? 0;
        const trait = idx < 0 ? noneTrait : l.traits[Math.min(idx, l.traits.length - 1)];
        return { layerName: l.name, traitType: l.traitType, trait, layerId: l.id };
      });
  }, [layers, livePreviewTraits]);

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

  /** Vollständiges Projekt als JSON extern speichern (Backup – unabhängig von localStorage) */
  const exportProjectToFile = useCallback(() => {
    if (!activeProjectId) return;
    const proj = projects.find(p => p.id === activeProjectId);
    const full: SavedProject = proj ? {
      ...proj,
      updatedAt: new Date().toISOString(),
      name: collectionName || proj.name,
      collectionName,
      totalCount,
      viewBox,
      layers,
      scanAddress,
      walletInscriptions,
      generated,
      hashlist,
    } : {
      id: activeProjectId,
      name: collectionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      collectionName,
      totalCount,
      viewBox,
      layers,
      scanAddress,
      walletInscriptions,
      generated,
      hashlist,
    };
    const slug = (collectionName || 'projekt').replace(/\s+/g, '_').replace(/[^\w\-]/g, '') || 'projekt';
    downloadJSON(full, `${slug}_backup_${new Date().toISOString().slice(0, 10)}.json`);
  }, [activeProjectId, projects, collectionName, totalCount, viewBox, layers, scanAddress, walletInscriptions, generated, hashlist, downloadJSON]);

  /** Projekt aus externer JSON-Datei importieren */
  const importProjectFromFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') throw new Error('Ungültiges Format');
        const hasLayers = Array.isArray(data.layers);
        const full: SavedProject = {
          id: projectId(),
          name: data.name || data.collectionName || file.name.replace(/\.[^.]+$/, '') || 'Import',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          collectionName: data.collectionName || data.name || 'Import',
          totalCount: data.totalCount ?? 100,
          viewBox: data.viewBox || '0 0 1000 1000',
          layers: hasLayers ? data.layers : [],
          scanAddress: data.scanAddress || '',
          walletInscriptions: Array.isArray(data.walletInscriptions) ? data.walletInscriptions : [],
          generated: Array.isArray(data.generated) ? data.generated : [],
          hashlist: Array.isArray(data.hashlist) ? data.hashlist : [],
        };
        const updated = [full, ...projects];
        setProjects(updated);
        saveProjects(updated);
        setActiveProjectId(full.id);
        loadProjectIntoState(full);
        setError('');
      } catch (err: any) {
        setError(err?.message || 'Ungültige Projekt-Datei!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [projects, loadProjectIntoState]);

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

          {/* NEW / IMPORT */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => createNewProject()}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 text-lg shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">+</span>
              <span>Neues Projekt erstellen</span>
            </button>
            <label className="px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer text-lg shadow-lg flex items-center justify-center gap-2 transition-colors">
              📂 Projekt importieren
              <input type="file" accept=".json" onChange={importProjectFromFile} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-6 -mt-2">Import: JSON-Datei von Export oder Backup – unabhängig von localStorage</p>

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
                        onClick={() => { downloadJSON(project, `${(project.collectionName || project.name || 'projekt').replace(/\s+/g, '_')}_backup.json`); }}
                        className="px-4 py-1.5 bg-amber-700 text-amber-100 rounded text-xs hover:bg-amber-600"
                        title="Projekt als JSON extern speichern"
                      >
                        📥 Export
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
          <button onClick={exportProjectToFile}
            className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 flex items-center gap-1"
            title="Projekt als JSON-Datei speichern (externer Backup)">
            📥 Export
          </button>
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
                    <>
                    {(selectedTraits[layer.id]?.size || 0) > 0 && (
                      <div className="flex items-center gap-2 mb-2 px-2">
                        <span className="text-xs text-cyan-400">{selectedTraits[layer.id]?.size} selected</span>
                        <button onClick={() => setSelectedTraits(prev => ({ ...prev, [layer.id]: new Set() }))}
                          className="text-xs text-gray-500 hover:text-white">Clear</button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {layer.traits.map((trait, traitIdx) => {
                        const isSelected = selectedTraits[layer.id]?.has(traitIdx) || false;
                        const isDragSource = traitDrag?.layerId === layer.id && (
                          selectedTraits[layer.id]?.size > 1 && selectedTraits[layer.id]?.has(traitDrag.fromIdx)
                            ? isSelected
                            : traitDrag.fromIdx === traitIdx
                        );
                        return (
                        <div key={traitIdx}
                          draggable
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setTraitDrag({ layerId: layer.id, fromIdx: traitIdx }); }}
                          onDragOver={e => { if (traitDrag?.layerId === layer.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setTraitDragOverIdx(traitIdx); } }}
                          onDragLeave={() => setTraitDragOverIdx(null)}
                          onDrop={e => { e.preventDefault(); handleTraitDrop(layer.id, traitIdx); }}
                          onDragEnd={() => { setTraitDrag(null); setTraitDragOverIdx(null); }}
                          className={`flex gap-2 items-start p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                            isDragSource
                              ? 'opacity-40 border-gray-800 bg-black/50'
                              : traitDrag?.layerId === layer.id && traitDragOverIdx === traitIdx
                                ? 'border-purple-500 bg-purple-900/30'
                                : isSelected
                                  ? 'border-cyan-600 bg-cyan-900/20'
                                  : 'border-gray-800 bg-black/50'
                          }`}>
                          <div className="flex-shrink-0 flex flex-col items-center gap-1">
                            <input type="checkbox" checked={isSelected}
                              onChange={e => { e.stopPropagation(); toggleTraitSelection(layer.id, traitIdx, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey); }}
                              className="accent-cyan-500 w-3.5 h-3.5 mt-1 cursor-pointer" />
                            <div className="w-14 h-14 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden cursor-pointer"
                              onClick={() => !isNoneTrait(trait) && setSelectedLayerPreview(
                              selectedLayerPreview?.layerId === layer.id && selectedLayerPreview?.traitIdx === traitIdx
                                ? null : { layerId: layer.id, traitIdx }
                            )}>
                            {isNoneTrait(trait) ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-purple-400 text-[10px] font-bold border-2 border-dashed border-purple-600/50 rounded">
                                <span>none</span>
                                <span className="text-gray-600 text-[8px]">leer</span>
                              </div>
                            ) : trait.inscriptionId ? (
                              <img src={`https://ordinals.com/content/${trait.inscriptionId}`} alt={trait.name}
                                className="w-full h-full object-contain" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
                            )}
                            </div>
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
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
                            <div>
                              <label className="block text-xs text-gray-500">Group</label>
                              <input type="text" value={trait.group || ''}
                                onChange={e => updateTrait(layer.id, traitIdx, { group: e.target.value.trim() || undefined })}
                                placeholder="z.B. ice, fire"
                                className={`w-full px-2 py-1.5 bg-gray-900 border rounded text-xs text-white ${trait.group ? 'border-cyan-600' : 'border-gray-700'}`} />
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <label className="block text-xs text-gray-500">Rarity ({trait.rarity})</label>
                                <input type="range" value={trait.rarity}
                                  onChange={e => updateTrait(layer.id, traitIdx, { rarity: parseInt(e.target.value) })}
                                  min={1} max={100} className="w-full accent-purple-500" />
                              </div>
                              <button onClick={() => moveTrait(layer.id, traitIdx, 'up')} disabled={traitIdx === 0}
                                className="p-1 text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                              <button onClick={() => moveTrait(layer.id, traitIdx, 'down')} disabled={traitIdx === layer.traits.length - 1}
                                className="p-1 text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                              <button onClick={() => removeTrait(layer.id, traitIdx)}
                                className="p-1.5 text-red-500 hover:text-red-400 text-xs">✕</button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <button onClick={() => addTraitNone(layer.id)}
                      className="px-3 py-1.5 bg-purple-900/70 border-2 border-purple-500 rounded text-xs font-bold text-purple-200 hover:bg-purple-800/70 hover:border-purple-400"
                      title="Leerer Layer – wird im SVG als leer gerendert (kein Bild)">
                      + Leer (none)
                    </button>
                    <button onClick={() => addTraitManually(layer.id)}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-700">
                      + Trait manuell hinzufügen
                    </button>
                    <span className="text-[10px] text-gray-500">Leer = optionaler Layer ohne Bild</span>
                  </div>
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

        {/* ════════════════ LIVE LAYER PREVIEW ════════════════ */}
        {livePreviewLayers.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold"><span className="text-purple-400">👁️</span> Layer-Vorschau</h2>
              <button onClick={randomizeLivePreview}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-sm font-bold">
                🎲 Zufällig mischen
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
              {/* Stacked Preview */}
              <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
                <div className="w-full aspect-square relative">
                  {livePreviewLayers
                    .filter(lp => !isNoneTrait(lp.trait))
                    .map((lp, i) => (
                      <img key={lp.layerId} src={`https://ordinals.com/content/${lp.trait.inscriptionId}`}
                        alt={lp.trait.name} className="absolute inset-0 w-full h-full object-contain"
                        style={{ zIndex: i }} loading="lazy" />
                    ))}
                </div>
              </div>
              {/* Layer Breakdown */}
              <div className="space-y-2">
                {livePreviewLayers.map((lp, i) => {
                  const layer = layers.find(l => l.id === lp.layerId);
                  const currentIdx = livePreviewTraits[lp.layerId] ?? 0;
                  return (
                    <div key={lp.layerId} className="flex items-center gap-2 bg-black/50 rounded-lg p-2 border border-gray-800">
                      <span className="text-purple-400 font-bold text-xs w-6 text-center">#{i + 1}</span>
                      <div className="flex-shrink-0 w-10 h-10 bg-gray-900 border border-gray-700 rounded overflow-hidden">
                        {isNoneTrait(lp.trait) ? (
                          <div className="w-full h-full flex items-center justify-center text-purple-400 text-[10px] font-bold">none</div>
                        ) : (
                          <img src={`https://ordinals.com/content/${lp.trait.inscriptionId}`}
                            alt="" className="w-full h-full object-contain" loading="lazy" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">{lp.layerName || lp.traitType}</p>
                        <p className="text-sm text-white truncate">{lp.trait.name || '(kein Name)'}</p>
                      </div>
                      {/* Quick-switch trait per layer */}
                      {layer && layer.traits.length > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setLivePreviewTraits(prev => ({
                              ...prev, [lp.layerId]: (currentIdx - 1 + layer.traits.length) % layer.traits.length
                            }))}
                            className="w-6 h-6 bg-gray-800 border border-gray-600 rounded text-gray-400 hover:text-white text-xs flex items-center justify-center">◀</button>
                          <span className="text-[10px] text-gray-500 w-10 text-center">
                            {currentIdx + 1}/{layer.traits.length}
                          </span>
                          <button
                            onClick={() => setLivePreviewTraits(prev => ({
                              ...prev, [lp.layerId]: (currentIdx + 1) % layer.traits.length
                            }))}
                            className="w-6 h-6 bg-gray-800 border border-gray-600 rounded text-gray-400 hover:text-white text-xs flex items-center justify-center">▶</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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

            {/* Preview & Edit */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold"><span className="text-purple-400">👀</span> Vorschau</h2>
                <button onClick={() => setEditingItem(!editingItem)}
                  className={`px-3 py-1.5 rounded text-sm font-bold transition ${
                    editingItem
                      ? 'bg-yellow-600 text-white hover:bg-yellow-500'
                      : 'bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}>
                  {editingItem ? '✏️ Bearbeiten AN' : '✏️ Bearbeiten'}
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex === 0}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white hover:bg-gray-700 disabled:opacity-30">◀</button>
                <span className="text-sm text-gray-400">#{previewIndex + 1} / {generated.length}</span>
                <button onClick={() => setPreviewIndex(Math.min(generated.length - 1, previewIndex + 1))} disabled={previewIndex >= generated.length - 1}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white hover:bg-gray-700 disabled:opacity-30">▶</button>
                <button onClick={() => setPreviewIndex(Math.floor(Math.random() * generated.length))}
                  className="px-3 py-1.5 bg-purple-900 border border-purple-600 rounded text-sm text-purple-300 hover:bg-purple-800">🎲</button>
                <div className="flex items-center gap-2 ml-2">
                  <label className="text-xs text-gray-500">Gehe zu #</label>
                  <input type="number" min={1} max={generated.length}
                    value={previewIndex + 1}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= generated.length) setPreviewIndex(v - 1);
                    }}
                    className="w-16 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white text-center" />
                </div>
                <button onClick={() => downloadSVG(previewIndex)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 ml-auto">⬇️ SVG</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
                  <div className="w-full aspect-square relative">
                    {(() => {
                      const vbParts = viewBox.split(/\s+/).map(Number);
                      const vbW = vbParts[2] || 1000;
                      const vbH = vbParts[3] || 1000;
                      return generated[previewIndex]?.layers
                        .filter(l => !isNoneTrait(l.trait))
                        .map((layer, i) => (
                          <img key={`${previewIndex}-${i}-${layer.trait.inscriptionId}`}
                            src={`https://ordinals.com/content/${layer.trait.inscriptionId}`}
                            alt={layer.trait.name} className="absolute inset-0 w-full h-full object-contain"
                            style={{
                              zIndex: i,
                              ...(layer.offsetX || layer.offsetY ? {
                                transform: `translate(${((layer.offsetX || 0) / vbW) * 100}%, ${((layer.offsetY || 0) / vbH) * 100}%)`
                              } : {})
                            }} loading="lazy" />
                        ));
                    })()}
                  </div>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-2">{collectionName} #{previewIndex + 1}</h3>
                  <div className="space-y-2 mb-4">
                    {generated[previewIndex]?.layers.map((layer, i) => {
                      // Find matching layer definition for dropdown
                      const matchingLayer = layers.find(l => l.traitType === layer.traitType && l.name === layer.layerName);
                      const currentTraitIdx = matchingLayer?.traits.findIndex(t => t.inscriptionId === layer.trait.inscriptionId) ?? -1;

                      return (
                        <div key={i} className={`flex items-center gap-2 rounded p-2 border ${
                          editingItem ? 'bg-yellow-900/20 border-yellow-700/50' : 'bg-black/50 border-gray-800'
                        }`}>
                          {isNoneTrait(layer.trait) ? (
                            <div className="w-8 h-8 flex items-center justify-center rounded border border-purple-600/50 flex-shrink-0 text-[10px] text-purple-400 font-bold">none</div>
                          ) : (
                            <img src={`https://ordinals.com/content/${layer.trait.inscriptionId}`}
                              alt="" className="w-8 h-8 object-contain rounded border border-gray-700 flex-shrink-0" loading="lazy" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500">{layer.traitType}</p>
                            {editingItem && matchingLayer && matchingLayer.traits.length > 1 ? (
                              <select
                                value={currentTraitIdx >= 0 ? currentTraitIdx : 0}
                                onChange={e => updateGeneratedItemTrait(previewIndex, i, parseInt(e.target.value))}
                                className="w-full px-2 py-1 bg-gray-900 border border-yellow-600 rounded text-sm text-white mt-0.5 cursor-pointer">
                                {matchingLayer.traits.map((t, tIdx) => (
                                  <option key={tIdx} value={tIdx}>
                                    {t.name || `Trait ${tIdx + 1}`} (Rarity: {t.rarity})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-sm text-white truncate">{layer.trait.name}</p>
                            )}
                          </div>
                          {editingItem && (
                            <div className="flex gap-1 flex-shrink-0 items-center">
                              <div className="flex flex-col gap-0.5" title="Layer-Reihenfolge">
                                <button
                                  onClick={() => moveGeneratedItemLayer(previewIndex, i, -1)}
                                  disabled={i === 0}
                                  className="w-6 h-4 bg-blue-900 border border-blue-700 rounded text-blue-300 hover:text-white text-[10px] flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">▲</button>
                                <button
                                  onClick={() => moveGeneratedItemLayer(previewIndex, i, 1)}
                                  disabled={i === (generated[previewIndex]?.layers.length ?? 1) - 1}
                                  className="w-6 h-4 bg-blue-900 border border-blue-700 rounded text-blue-300 hover:text-white text-[10px] flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed">▼</button>
                              </div>
                              <div className="grid grid-cols-3 gap-px w-[42px]" title={`Position: ${layer.offsetX || 0}, ${layer.offsetY || 0}`}>
                                <div />
                                <button onClick={() => nudgeGeneratedItemLayer(previewIndex, i, 0, -10)}
                                  className="w-[13px] h-[13px] bg-green-900 border border-green-700 rounded-sm text-green-300 hover:text-white text-[8px] flex items-center justify-center">↑</button>
                                <div />
                                <button onClick={() => nudgeGeneratedItemLayer(previewIndex, i, -10, 0)}
                                  className="w-[13px] h-[13px] bg-green-900 border border-green-700 rounded-sm text-green-300 hover:text-white text-[8px] flex items-center justify-center">←</button>
                                <button onClick={() => nudgeGeneratedItemLayer(previewIndex, i, 0, 0, true)}
                                  className="w-[13px] h-[13px] bg-gray-800 border border-gray-600 rounded-sm text-gray-400 hover:text-white text-[7px] flex items-center justify-center"
                                  title="Position zurücksetzen"
                                  style={{ opacity: (layer.offsetX || layer.offsetY) ? 1 : 0.3 }}>⟲</button>
                                <button onClick={() => nudgeGeneratedItemLayer(previewIndex, i, 10, 0)}
                                  className="w-[13px] h-[13px] bg-green-900 border border-green-700 rounded-sm text-green-300 hover:text-white text-[8px] flex items-center justify-center">→</button>
                                <div />
                                <button onClick={() => nudgeGeneratedItemLayer(previewIndex, i, 0, 10)}
                                  className="w-[13px] h-[13px] bg-green-900 border border-green-700 rounded-sm text-green-300 hover:text-white text-[8px] flex items-center justify-center">↓</button>
                                <div />
                              </div>
                              {matchingLayer && matchingLayer.traits.length > 1 && (
                                <div className="flex gap-0.5">
                                  <button
                                    onClick={() => {
                                      const newIdx = (currentTraitIdx - 1 + matchingLayer.traits.length) % matchingLayer.traits.length;
                                      updateGeneratedItemTrait(previewIndex, i, newIdx);
                                    }}
                                    className="w-6 h-6 bg-gray-800 border border-gray-600 rounded text-gray-400 hover:text-white text-xs flex items-center justify-center self-center">◀</button>
                                  <button
                                    onClick={() => {
                                      const newIdx = (currentTraitIdx + 1) % matchingLayer.traits.length;
                                      updateGeneratedItemTrait(previewIndex, i, newIdx);
                                    }}
                                    className="w-6 h-6 bg-gray-800 border border-gray-600 rounded text-gray-400 hover:text-white text-xs flex items-center justify-center self-center">▶</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {editingItem && (
                    <p className="text-xs text-yellow-500/70 mb-2">
                      💡 Traits: Dropdown/◀▶ | Reihenfolge: ▲▼ | Position: ←↑↓→ (grün)
                    </p>
                  )}
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
                    {item.layers.filter(l => !isNoneTrait(l.trait)).map((layer, i) => (
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
