import React, { useState, useEffect } from 'react';
import {
  getAllCollectionsAdmin,
  createCollection,
  updateCollection,
  deleteCollection,
  eraseCollection,
  getWalletInscriptions,
  Collection,
  CollectionItem,
  WalletInscription,
} from '../../services/collectionService';
import { InscriptionPreview } from './InscriptionPreview';
import { useWallet } from '../../contexts/WalletContext';
import { signPSBT } from '../../utils/wallet';
import { preparePresign, savePresigned } from '../../services/collectionPresigning';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

interface CollectionManagerProps {
  adminAddress: string;
}

export const CollectionManager: React.FC<CollectionManagerProps> = ({ adminAddress }) => {
  const { walletState } = useWallet();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletInscriptions, setWalletInscriptions] = useState<WalletInscription[]>([]);
  const [loadingInscriptions, setLoadingInscriptions] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [itemFilter, setItemFilter] = useState<'all' | 'delegate' | 'original'>('all');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [presigningItems, setPresigningItems] = useState<Map<string, { status: 'pending' | 'preparing' | 'ready' | 'signing' | 'signed' | 'error'; transferId?: string; psbtBase64?: string; error?: string }>>(new Map());
  const [presignFeeRate, setPresignFeeRate] = useState(15);
  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    thumbnail: '',
    price: '',
    items: [] as CollectionItem[],
    mintType: 'individual' as 'individual' | 'random',
    page: '' as string | null,
    category: 'default' as string,
    showBanner: false as boolean,
    isBackendSigned: true as boolean,
    ownerAddress: '' as string,
  });

  useEffect(() => {
    if (adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
      loadCollections();
    }
  }, [adminAddress]);

  // Debouncing für Suche (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadWalletInscriptions = async () => {
    if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
      console.warn('[CollectionManager] No admin address provided, cannot load wallet inscriptions');
      console.warn('[CollectionManager] adminAddress prop:', adminAddress);
      console.warn('[CollectionManager] adminAddress type:', typeof adminAddress);
      alert('Admin address is not available. Please connect your wallet.');
      return;
    }
    console.log('[CollectionManager] Loading wallet inscriptions for:', adminAddress);
    console.log('[CollectionManager] adminAddress type:', typeof adminAddress);
    console.log('[CollectionManager] adminAddress length:', adminAddress?.length);
    setLoadingInscriptions(true);
    try {
      const data = await getWalletInscriptions(adminAddress);
      console.log('[CollectionManager] ✅ Loaded wallet inscriptions:', data.length);
      console.log('[CollectionManager] First few inscriptions:', data.slice(0, 3));
      
      // Debug: Prüfe Delegate-Inskriptionen
      const delegates = data.filter(ins => ins.isDelegate === true || ins.originalInscriptionId);
      console.log(`[CollectionManager] 🔍 Found ${delegates.length} potential delegate inscriptions (isDelegate=true OR has originalInscriptionId)`);
      if (delegates.length > 0) {
        console.log(`[CollectionManager] 🔍 First 3 delegate inscriptions:`, delegates.slice(0, 3).map(d => ({
          inscriptionId: d.inscriptionId,
          isDelegate: d.isDelegate,
          originalInscriptionId: d.originalInscriptionId,
          contentType: d.contentType,
          name: d.name
        })));
      } else {
        console.warn(`[CollectionManager] ⚠️ No delegate inscriptions found! Checking all inscriptions for HTML content...`);
        const htmlInscriptions = data.filter(ins => ins.contentType && (ins.contentType.includes('html') || ins.contentType.includes('text/html')));
        console.log(`[CollectionManager] 🔍 Found ${htmlInscriptions.length} HTML inscriptions (but not marked as delegates):`, htmlInscriptions.slice(0, 3).map(d => ({
          inscriptionId: d.inscriptionId,
          contentType: d.contentType,
          isDelegate: d.isDelegate,
          originalInscriptionId: d.originalInscriptionId
        })));
      }
      
      setWalletInscriptions(data);
      
      if (data.length === 0) {
        console.warn('[CollectionManager] ⚠️ No inscriptions found. This might be because:');
        console.warn('[CollectionManager]   1. The wallet has no inscriptions');
        console.warn('[CollectionManager]   2. The API endpoint returned an error');
        console.warn('[CollectionManager]   3. The API key is invalid or missing');
        console.warn('[CollectionManager]   4. The address format is incorrect');
      }
    } catch (error: any) {
      console.error('[CollectionManager] ❌ Error loading wallet inscriptions:', error);
      console.error('[CollectionManager] Error message:', error?.message);
      console.error('[CollectionManager] Error stack:', error?.stack);
      setWalletInscriptions([]);
      
      // Zeige Fehler auch in der UI
      alert(`Error loading wallet inscriptions: ${error?.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setLoadingInscriptions(false);
    }
  };

  // Lade Wallet-Inskriptionen nur wenn Formular geöffnet ist
  useEffect(() => {
    if (showForm && adminAddress && adminAddress !== 'undefined' && adminAddress !== '') {
      console.log('[CollectionManager] Form opened, loading wallet inscriptions...');
      loadWalletInscriptions();
    } else if (!showForm) {
      // Reset when form is closed
      setWalletInscriptions([]);
      setSearchTerm('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, adminAddress]);

  const loadCollections = async () => {
    if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
      console.warn('[CollectionManager] No admin address provided, cannot load collections');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = await getAllCollectionsAdmin(adminAddress);
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, thumbnail: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag & Drop für Thumbnail
  const handleThumbnailDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingThumbnail(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, thumbnail: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingThumbnail(true);
  };

  const handleThumbnailDragLeave = () => {
    setIsDraggingThumbnail(false);
  };

  // Item-Sortierung
  const moveItemUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...formData.items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setFormData({ ...formData, items: newItems });
  };

  const moveItemDown = (index: number) => {
    if (index === formData.items.length - 1) return;
    const newItems = [...formData.items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setFormData({ ...formData, items: newItems });
  };

  const toggleItemSelection = (inscription: WalletInscription, type: 'delegate' | 'original') => {
    const itemIndex = formData.items.findIndex(
      item => item.inscriptionId === inscription.inscriptionId
    );

    if (itemIndex >= 0) {
      // Entferne Item
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== itemIndex),
      });
    } else {
      // Füge Item hinzu
      // Direkt von ordinals.com laden - KEIN Backend-API-Call mehr!
      const imageUrl = `https://ordinals.com/content/${inscription.inscriptionId}`;
      setFormData({
        ...formData,
        items: [
          ...formData.items,
          {
            inscriptionId: inscription.inscriptionId,
            name: inscription.name,
            type,
            imageUrl,
          },
        ],
      });
    }
  };

  const isItemSelected = (inscriptionId: string) => {
    return formData.items.some(item => item.inscriptionId === inscriptionId);
  };

  const getItemType = (inscriptionId: string): 'delegate' | 'original' => {
    const item = formData.items.find(item => item.inscriptionId === inscriptionId);
    return item?.type || 'delegate';
  };

  const selectAllItems = () => {
    const newItems: CollectionItem[] = [];
    const existingIds = new Set(formData.items.map(item => item.inscriptionId));
    
    filteredInscriptions.forEach(inscription => {
      if (!existingIds.has(inscription.inscriptionId)) {
        const imageUrl = `https://ordinals.com/content/${inscription.inscriptionId}`;
        newItems.push({
          inscriptionId: inscription.inscriptionId,
          name: inscription.name,
          type: 'delegate', // Default type
          imageUrl,
        });
      }
    });
    
    setFormData({
      ...formData,
      items: [...formData.items, ...newItems],
    });
  };

  const deselectAllItems = () => {
    const filteredIds = new Set(filteredInscriptions.map(ins => ins.inscriptionId));
    setFormData({
      ...formData,
      items: formData.items.filter(item => !filteredIds.has(item.inscriptionId)),
    });
  };

  const areAllItemsSelected = () => {
    if (filteredInscriptions.length === 0) return false;
    return filteredInscriptions.every(ins => isItemSelected(ins.inscriptionId));
  };

  const setAllSelectedToOriginal = () => {
    const selectedIds = new Set(formData.items.map(item => item.inscriptionId));
    const newItems = formData.items.map(item => ({
      ...item,
      type: 'original' as const
    }));
    setFormData({ ...formData, items: newItems });
    
    // Initialisiere Pre-Signing Status für alle Original-Inskriptionen
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      newItems.forEach(item => {
        if (!newMap.has(item.inscriptionId)) {
          newMap.set(item.inscriptionId, { status: 'pending' });
        }
      });
      return newMap;
    });
  };

  const setAllSelectedToDelegate = () => {
    const newItems = formData.items.map(item => ({
      ...item,
      type: 'delegate' as const
    }));
    setFormData({ ...formData, items: newItems });
    
    // Entferne Pre-Signing Status für Delegates (nicht benötigt)
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      newItems.forEach(item => {
        if (item.type === 'delegate') {
          newMap.delete(item.inscriptionId);
        }
      });
      return newMap;
    });
  };

  const preparePresignPSBT = async (inscriptionId: string) => {
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      newMap.set(inscriptionId, { status: 'preparing' });
      return newMap;
    });
    
    try {
      if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
        throw new Error('Admin address is required for pre-signing');
      }
      
      // Get owner address from wallet (where the inscription is stored)
      const ownerAddress = walletState.accounts[0]?.address;
      if (!ownerAddress) {
        throw new Error('Wallet not connected or address not found');
      }
      
      console.log('[CollectionManager] Preparing pre-sign PSBT...');
      console.log('   Inscription:', inscriptionId);
      console.log('   Owner:', ownerAddress);
      console.log('   Fee Rate:', presignFeeRate);
      
      const prepareData = await preparePresign(
        inscriptionId,
        ownerAddress,
        presignFeeRate,
        adminAddress
      );
      
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, {
          status: 'ready',
          psbtBase64: prepareData.psbtBase64,
          ownerAddress: prepareData.ownerAddress,
        });
        return newMap;
      });
      
      console.log('[CollectionManager] ✅ PSBT prepared for signing');
    } catch (error: any) {
      console.error('[CollectionManager] Error preparing PSBT:', error);
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, {
          status: 'error',
          error: error.message || 'Failed to prepare PSBT',
        });
        return newMap;
      });
    }
  };

  const signPresignPSBT = async (inscriptionId: string) => {
    if (!walletState.connected || !walletState.walletType) {
      alert('Please connect your wallet first');
      return;
    }
    
    const item = presigningItems.get(inscriptionId);
    if (!item?.psbtBase64) {
      alert('PSBT not prepared yet');
      return;
    }
    
    if (!formData.name || formData.items.length === 0) {
      alert('Please create the collection first before pre-signing');
      return;
    }
    
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      newMap.set(inscriptionId, { ...item, status: 'signing' });
      return newMap;
    });
    
    try {
      console.log('[CollectionManager] Signing PSBT with wallet...');
      console.log('   Wallet Type:', walletState.walletType);
      console.log('   PSBT Length:', item.psbtBase64.length);
      
      // Sign with SIGHASH_NONE | ANYONECANPAY (0x82) for marketplace-style pre-signing
      // ✅ Signiert NUR den Input, erlaubt Output-Adresse Ersetzung (Placeholder → Käufer)
      const signedPsbt = await signPSBT(
        item.psbtBase64,
        walletState.walletType,
        false,  // Do not broadcast
        item.ownerAddress,  // Owner address for inputsToSign
        0x82    // SIGHASH_NONE | ANYONECANPAY
      );
      
      console.log('[CollectionManager] ✅ PSBT signed successfully');
      console.log('   Signed PSBT Length:', signedPsbt.length);
      
      // Save the signed PSBT to the collection
      // We need collectionId, but collection might not exist yet
      // So we store it temporarily in the presigningItems map
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, { 
          ...item, 
          status: 'signed',
          signedPsbtHex: signedPsbt 
        });
        return newMap;
      });
      
      console.log('[CollectionManager] ✅ Pre-signed transaction ready');
      console.log('   Will be saved to collection after creation');
    } catch (error: any) {
      console.error('[CollectionManager] Error signing PSBT:', error);
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, {
          ...item,
          status: 'error',
          error: error.message || 'Failed to sign PSBT',
        });
        return newMap;
      });
    }
  };

  const prepareAllPSBTs = async () => {
    // Nur für Original-Inskriptionen
    const originalItems = formData.items.filter(item => item.type === 'original');
    for (const item of originalItems) {
      const status = presigningItems.get(item.inscriptionId)?.status;
      if (status === 'pending' || status === 'error' || !status) {
        await preparePresignPSBT(item.inscriptionId);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const signAllPSBTs = async () => {
    if (!walletState.connected || !walletState.walletType) {
      alert('Please connect your wallet first');
      return;
    }
    
    const originalItems = formData.items.filter(item => item.type === 'original');
    for (const item of originalItems) {
      const status = presigningItems.get(item.inscriptionId)?.status;
      if (status === 'ready') {
        await signPresignPSBT(item.inscriptionId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const areAllOriginalsSigned = () => {
    const originalItems = formData.items.filter(item => item.type === 'original');
    if (originalItems.length === 0) return true; // Keine Original-Inskriptionen = OK
    
    return originalItems.every(item => {
      const status = presigningItems.get(item.inscriptionId)?.status;
      return status === 'signed';
    });
  };

  const handleSave = async () => {
    if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
      alert('Admin address is not available. Please connect your wallet.');
      return;
    }
    
    if (!formData.name || !formData.price || formData.items.length === 0) {
      alert('Please fill in all required fields (Name, Price, and select at least one item)');
      return;
    }

    // Prüfe ob ownerAddress ausgefüllt ist für User-Signed Collections
    if (!formData.isBackendSigned && !formData.ownerAddress) {
      alert('Please provide an Owner Address for User-Signed Collections');
      return;
    }

    // Prüfe ob alle Original-Inskriptionen signiert sind (NUR für Backend-Signed Collections)
    const originalItems = formData.items.filter(item => item.type === 'original');
    if (formData.isBackendSigned && originalItems.length > 0 && !areAllOriginalsSigned()) {
      if (!confirm('Not all original inscriptions are pre-signed. Do you want to continue anyway?')) {
        return;
      }
    }

    // Zeige Vorschau-Dialog
    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      // Add pre-signed PSBTs to items if available
      const itemsWithPSBTs = formData.items.map(item => {
        const presignData = presigningItems.get(item.inscriptionId);
        if (presignData?.status === 'signed' && presignData.signedPsbtHex) {
          return {
            ...item,
            signedTxHex: presignData.signedPsbtHex,
            presignedAt: new Date().toISOString()
          };
        }
        return item;
      });
      
      const collectionData = {
        name: formData.name,
        description: formData.description,
        thumbnail: formData.thumbnail,
        price: parseFloat(formData.price),
        items: itemsWithPSBTs,
        category: formData.category,
        page: formData.page,
        mintType: formData.mintType,
        showBanner: formData.showBanner,
        isBackendSigned: formData.isBackendSigned,
        ownerAddress: formData.isBackendSigned ? null : formData.ownerAddress,
      };
      
      if (editingCollection) {
        await updateCollection(editingCollection.id, adminAddress, collectionData);
        alert('Collection updated successfully!');
      } else {
        await createCollection(adminAddress, collectionData);
        alert('Collection created successfully!');
      }
      
      resetForm();
      setShowPreview(false);
      loadCollections();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setFormData({
      name: collection.name,
      description: collection.description,
      thumbnail: collection.thumbnail,
      price: collection.price.toString(),
      items: collection.items,
      mintType: collection.mintType || 'individual',
      page: collection.page || null,
      showBanner: collection.showBanner !== undefined ? collection.showBanner : false,
      isBackendSigned: collection.isBackendSigned !== undefined ? collection.isBackendSigned : true,
      ownerAddress: collection.ownerAddress || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (collectionId: string) => {
    if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
      alert('Admin address is not available. Please connect your wallet.');
      return;
    }
    
    if (!confirm('Are you sure you want to deactivate this collection?')) {
      return;
    }

    try {
      await deleteCollection(collectionId, adminAddress);
      alert('Collection deactivated successfully!');
      loadCollections();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleErase = async (collectionId: string, collectionName: string) => {
    if (!adminAddress || adminAddress === 'undefined' || adminAddress === '') {
      alert('Admin address is not available. Please connect your wallet.');
      return;
    }
    
    // Erste Bestätigung
    if (!confirm(`⚠️ WARNING: Do you really want to ERASE the collection "${collectionName}"?\n\nThis will PERMANENTLY DELETE the collection and cannot be undone!`)) {
      return;
    }

    // Zweite Bestätigung (doppelte Sicherheit)
    if (!confirm(`🚨 FINAL WARNING: This will PERMANENTLY DELETE "${collectionName}"!\n\nThis action CANNOT be undone. Are you absolutely sure?`)) {
      return;
    }

    try {
      await eraseCollection(collectionId, adminAddress);
      alert('Collection permanently erased!');
      loadCollections();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      thumbnail: '',
      price: '',
      items: [],
      mintType: 'individual',
      page: null,
      showBanner: false,
      isBackendSigned: true,
      ownerAddress: '',
    });
    setEditingCollection(null);
    setShowForm(false);
    setPresigningItems(new Map());
  };

  // Initialisiere Pre-Signing Status wenn Items hinzugefügt werden
  useEffect(() => {
    if (formData.items.length > 0) {
      const newPresigningMap = new Map(presigningItems);
      formData.items.forEach(item => {
        if (item.type === 'original' && !newPresigningMap.has(item.inscriptionId)) {
          newPresigningMap.set(item.inscriptionId, { status: 'pending' });
        }
      });
      setPresigningItems(newPresigningMap);
    }
  }, [formData.items]);

  // Filter Inskriptionen basierend auf Suche und Filter
  const filteredInscriptions = walletInscriptions.filter(ins => {
    // Suche-Filter (mit Debouncing)
    const matchesSearch = ins.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      ins.inscriptionId.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Typ-Filter
    if (itemFilter === 'delegate') {
      return ins.isDelegate === true || ins.originalInscriptionId !== undefined;
    } else if (itemFilter === 'original') {
      return ins.isDelegate !== true && ins.originalInscriptionId === undefined;
    }
    
    return true; // 'all'
  });

  if (loading) {
    return <div className="text-white text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white border-b border-red-600 pb-2">
          Collection Management
        </h3>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold text-sm"
        >
          + New Collection
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-red-600 rounded p-6 mb-6">
          <h4 className="font-bold text-white mb-4">
            {editingCollection ? 'Edit Collection' : 'Create New Collection'}
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                placeholder="Collection name"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                rows={3}
                placeholder="Collection description"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Thumbnail</label>
              
              {/* File Upload */}
              <div className="mb-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="text-white text-sm"
                  id="thumbnail-upload"
                />
              </div>

              {/* Preview und Remove Button */}
              {formData.thumbnail && (
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={formData.thumbnail}
                    alt="Thumbnail preview"
                    className="w-20 h-20 object-cover rounded border border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, thumbnail: '' })}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold"
                  >
                    Remove Image
                  </button>
                  {formData.thumbnail.startsWith('data:') && (
                    <span className="text-xs text-green-400">✓ Image uploaded</span>
                  )}
                </div>
              )}

              {/* URL Input - nur anzeigen wenn KEIN Bild per Upload hochgeladen */}
              {!formData.thumbnail?.startsWith('data:') && (
                <>
                  <p className="text-xs text-gray-500 mt-2 mb-1">Or enter URL:</p>
                  <input
                    type="text"
                    value={formData.thumbnail?.startsWith('data:') ? '' : formData.thumbnail}
                    onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                    placeholder="https://example.com/image.png"
                  />
                </>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Price (BTC) *</label>
              <input
                type="number"
                step="0.00000001"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                placeholder="0.0001"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Mint Type *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mintType: 'individual' })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition ${
                    formData.mintType === 'individual'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Individual (Choose Item)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mintType: 'random' })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition ${
                    formData.mintType === 'random'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Random (Surprise)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.mintType === 'individual' 
                  ? 'Users can choose which item to mint' 
                  : 'Users receive a random item from the collection'}
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Page Assignment</label>
              <select
                value={formData.page || ''}
                onChange={(e) => setFormData({ ...formData, page: e.target.value || null })}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
              >
                <option value="">None (General Collection)</option>
                <option value="smile-a-bit">SMILE A BIT (/smile-a-bit)</option>
                <option value="tech-games">Tech & Games (/tech-games)</option>
                <option value="point-shop">Point Shop (/point-shop)</option>
                <option value="gallery">Gallery (/gallery)</option>
                <option value="trading">Trading (/trading)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select which page this collection should appear on. Leave empty for general collections.
              </p>
            </div>

            <div className="bg-gray-800 border border-yellow-600 rounded p-4">
              <label className="text-sm font-bold text-yellow-400 block mb-2">
                🎯 Show Recent Mints Banner
              </label>
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showBanner}
                    onChange={(e) => setFormData({ ...formData, showBanner: e.target.checked })}
                    className="w-5 h-5 text-red-600 bg-black border-gray-700 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-sm text-white font-semibold">
                    {formData.showBanner ? '✅ Enabled' : '❌ Disabled'}
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                When enabled, a banner showing the last 10 minted items (or wallet items if no mints yet) will be displayed on the minting page.
              </p>
            </div>

            <div className="bg-gray-800 border border-blue-600 rounded p-4">
              <label className="text-sm font-bold text-blue-400 block mb-2">
                🔐 Collection Signing Type
              </label>
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isBackendSigned}
                    onChange={(e) => setFormData({ ...formData, isBackendSigned: e.target.checked })}
                    className="w-5 h-5 text-blue-600 bg-black border-gray-700 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm text-white font-semibold">
                    {formData.isBackendSigned ? '✅ Backend-Signed (Admin Collection)' : '❌ User-Signed (User Collection)'}
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                <strong>Backend-Signed:</strong> You pre-sign originals. Instant transfer after purchase.<br />
                <strong>User-Signed:</strong> User signs with their wallet during minting. No pre-signing needed.
              </p>
              
              {!formData.isBackendSigned && (
                <div className="mt-3">
                  <label className="text-xs text-gray-400 block mb-1">Owner Address (for User-Signed Collections) *</label>
                  <input
                    type="text"
                    value={formData.ownerAddress}
                    onChange={(e) => setFormData({ ...formData, ownerAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                    placeholder="bc1p... (address where originals are stored)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This is YOUR wallet address where the original inscriptions are stored. Users will be prompted to sign with this address during minting.
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">
                  Select Items from Wallet ({formData.items.length} selected) *
                </label>
                {!loadingInscriptions && filteredInscriptions.length > 0 && (
                  <div className="flex gap-2">
                    {areAllItemsSelected() ? (
                      <button
                        onClick={deselectAllItems}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold text-white"
                      >
                        Deselect All
                      </button>
                    ) : (
                      <button
                        onClick={selectAllItems}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold text-white"
                      >
                        Select All ({filteredInscriptions.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Buttons zum Setzen aller ausgewählten Items auf Original oder Delegate */}
              {formData.items.length > 0 && (
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={setAllSelectedToOriginal}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-semibold text-white"
                    title="Set all selected items to Original (requires pre-signing)"
                  >
                    Set All to Original ({formData.items.length})
                  </button>
                  <button
                    onClick={setAllSelectedToDelegate}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold text-white"
                    title="Set all selected items to Delegate (no pre-signing needed)"
                  >
                    Set All to Delegate ({formData.items.length})
                  </button>
                </div>
              )}
              
              {/* Filter und Suche */}
              <div className="mb-2 flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                    placeholder="Search inscriptions..."
                  />
                </div>
                <select
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value as 'all' | 'delegate' | 'original')}
                  className="px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="delegate">Only Delegates</option>
                  <option value="original">Only Originals</option>
                </select>
              </div>

              {!adminAddress ? (
                <div className="text-gray-400 text-sm py-4">Please connect admin wallet to view inscriptions</div>
              ) : loadingInscriptions ? (
                <div className="text-gray-400 text-sm py-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    <span>Loading wallet inscriptions...</span>
                  </div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border border-gray-700 rounded p-4 bg-black">
                  {filteredInscriptions.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm mb-2">
                        {walletInscriptions.length === 0 
                          ? 'No inscriptions found in wallet' 
                          : 'No inscriptions match your search'}
                      </p>
                      {walletInscriptions.length > 0 && (
                        <p className="text-gray-500 text-xs">
                          Showing {filteredInscriptions.length} of {walletInscriptions.length} inscriptions
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {filteredInscriptions.map((inscription) => {
                        const selected = isItemSelected(inscription.inscriptionId);
                        const itemType = getItemType(inscription.inscriptionId);
                        // Content-Type: Falls "unknown" oder leer, prüfe ob es ein Delegate ist oder HTML enthält
                        let contentType = inscription.contentType?.toLowerCase() || 'unknown';
                        
                        // Fallback: Wenn Content-Type "unknown" ist, aber isDelegate-Flag gesetzt ist, setze auf HTML
                        if (contentType === 'unknown' && (inscription.isDelegate === true || inscription.isDelegate === 'true')) {
                          contentType = 'text/html';
                        }
                        
                        return (
                          <div
                            key={inscription.inscriptionId}
                            className={`border rounded p-2 cursor-pointer transition ${
                              selected
                                ? 'border-red-600 bg-red-900/20'
                                : 'border-gray-700 hover:border-gray-600'
                            }`}
                            onClick={() => toggleItemSelection(inscription, itemType)}
                          >
                            <div className="aspect-square bg-gray-800 rounded mb-2 flex items-center justify-center overflow-hidden">
                              <InscriptionPreview inscription={inscription} />
                            </div>
                            <div className="text-xs text-white truncate mb-1">
                              {inscription.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate mb-1">
                              {contentType}
                            </div>
                            {selected && (
                              <div className="flex flex-col gap-1 mt-1">
                                <select
                                  value={itemType}
                                  onChange={(e) => {
                                    const newItems = formData.items.map(item =>
                                      item.inscriptionId === inscription.inscriptionId
                                        ? { ...item, type: e.target.value as 'delegate' | 'original' }
                                        : item
                                    );
                                    setFormData({ ...formData, items: newItems });
                                    // Initialisiere Pre-Signing Status für Original-Inskriptionen
                                    if (e.target.value === 'original') {
                                      setPresigningItems(prev => {
                                        const newMap = new Map(prev);
                                        if (!newMap.has(inscription.inscriptionId)) {
                                          newMap.set(inscription.inscriptionId, { status: 'pending' });
                                        }
                                        return newMap;
                                      });
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-gray-700 text-white rounded px-1 py-0.5"
                                >
                                  <option value="delegate">Delegate</option>
                                  <option value="original">Original</option>
                                </select>
                                
                                {/* Pre-Signing Status für Original-Inskriptionen */}
                                {itemType === 'original' && (
                                  <div className="flex items-center gap-1">
                                    {(() => {
                                      const presignStatus = presigningItems.get(inscription.inscriptionId);
                                      if (!presignStatus) return null;
                                      
                                      return (
                                        <>
                                          <span className={`text-[10px] px-1 py-0.5 rounded ${
                                            presignStatus.status === 'signed' ? 'bg-green-600 text-white' :
                                            presignStatus.status === 'ready' ? 'bg-blue-600 text-white' :
                                            presignStatus.status === 'error' ? 'bg-red-600 text-white' :
                                            presignStatus.status === 'preparing' || presignStatus.status === 'signing' ? 'bg-yellow-600 text-black' :
                                            'bg-gray-600 text-white'
                                          }`}>
                                            {presignStatus.status === 'signed' ? '✅ Signed' :
                                             presignStatus.status === 'ready' ? '📝 Ready' :
                                             presignStatus.status === 'error' ? '❌ Error' :
                                             presignStatus.status === 'preparing' ? '⏳ Preparing...' :
                                             presignStatus.status === 'signing' ? '✍️ Signing...' :
                                             '⏸️ Pending'}
                                          </span>
                                          
                                          {presignStatus.status === 'pending' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                preparePresignPSBT(inscription.inscriptionId);
                                              }}
                                              className="text-[10px] px-1 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                            >
                                              Prepare
                                            </button>
                                          )}
                                          
                                          {presignStatus.status === 'ready' && walletState.connected && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                signPresignPSBT(inscription.inscriptionId);
                                              }}
                                              className="text-[10px] px-1 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded"
                                            >
                                              Sign
                                            </button>
                                          )}
                                          
                                          {presignStatus.status === 'error' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                preparePresignPSBT(inscription.inscriptionId);
                                              }}
                                              className="text-[10px] px-1 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                              Retry
                                            </button>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pre-Signing Controls für Original-Inskriptionen - NUR FÜR BACKEND-SIGNED COLLECTIONS */}
            {formData.isBackendSigned && formData.items.some(item => item.type === 'original') && (
              <div className="bg-gray-800 border border-yellow-600 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-yellow-400">
                    ⚠️ Pre-Signing Required for Original Inscriptions
                  </h5>
                  <div className="text-xs text-gray-400">
                    {formData.items.filter(item => item.type === 'original').length} original(s) selected
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <label className="text-xs text-gray-400">Fee Rate (sat/vB):</label>
                  <input
                    type="number"
                    min="1"
                    value={presignFeeRate}
                    onChange={(e) => setPresignFeeRate(parseInt(e.target.value, 10))}
                    className="w-20 px-2 py-1 bg-black border border-gray-700 rounded text-white text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={prepareAllPSBTs}
                    disabled={formData.items.filter(item => item.type === 'original').some(item => {
                      const status = presigningItems.get(item.inscriptionId)?.status;
                      return status === 'preparing' || status === 'signing';
                    })}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-semibold text-white"
                  >
                    Prepare All PSBTs
                  </button>
                  <button
                    onClick={signAllPSBTs}
                    disabled={!walletState.connected || formData.items.filter(item => item.type === 'original').some(item => {
                      const status = presigningItems.get(item.inscriptionId)?.status;
                      return status === 'preparing' || status === 'signing';
                    })}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-semibold text-white"
                  >
                    Sign All PSBTs
                  </button>
                </div>

                {areAllOriginalsSigned() && formData.items.some(item => item.type === 'original') && (
                  <div className="text-xs text-green-400 font-semibold">
                    ✅ All original inscriptions pre-signed and ready!
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold text-sm"
              >
                {editingCollection ? 'Update Collection' : 'Create Collection'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-bold text-white mb-3">
          Collections ({collections.length})
        </h4>
        {collections.length === 0 ? (
          <p className="text-gray-400 text-sm">No collections yet</p>
        ) : (
          <div className="space-y-4">
            {collections.map((collection) => (
              <div key={collection.id} className="bg-gray-900 border border-red-600 rounded p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {collection.thumbnail && (
                        <div className="w-20 h-20 bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                          <img
                            src={collection.thumbnail}
                            alt={collection.name}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-bold text-white text-lg">{collection.name}</h5>
                          {!collection.active && (
                            <span className="text-xs px-2 py-0.5 bg-gray-700 text-white rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mt-1">{collection.description}</p>
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-red-600 font-bold">
                            {collection.price} BTC
                          </span>
                          <span className="text-gray-500 text-xs">
                            {collection.items.length} items
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            collection.mintType === 'random' 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-blue-600 text-white'
                          }`}>
                            {collection.mintType === 'random' ? '🎲 Random' : '📋 Individual'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleEdit(collection)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold text-white"
                    >
                      Edit
                    </button>
                    {collection.mintType !== 'random' && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Set "${collection.name}" to Random Mint? Users will receive a random item instead of choosing.`)) {
                            return;
                          }
                          try {
                            await updateCollection(collection.id, adminAddress, { mintType: 'random' });
                            alert('Collection set to Random Mint!');
                            loadCollections();
                          } catch (error: any) {
                            alert(`Error: ${error.message}`);
                          }
                        }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold text-white"
                      >
                        Set Random
                      </button>
                    )}
                    {collection.mintType === 'random' && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Set "${collection.name}" to Individual Mint? Users will be able to choose which item to mint.`)) {
                            return;
                          }
                          try {
                            await updateCollection(collection.id, adminAddress, { mintType: 'individual' });
                            alert('Collection set to Individual Mint!');
                            loadCollections();
                          } catch (error: any) {
                            alert(`Error: ${error.message}`);
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold text-white"
                      >
                        Set Individual
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(collection.id)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold text-white"
                    >
                      Deactivate
                    </button>
                    <button
                      onClick={() => handleErase(collection.id, collection.name)}
                      className="px-3 py-1 bg-red-800 hover:bg-red-900 rounded text-sm font-semibold text-white"
                      title="Permanently delete this collection (cannot be undone)"
                    >
                      🗑️ Erase
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

