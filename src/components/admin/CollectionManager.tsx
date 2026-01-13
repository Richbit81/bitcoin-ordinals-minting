import React, { useState, useEffect } from 'react';
import {
  getAllCollectionsAdmin,
  createCollection,
  updateCollection,
  deleteCollection,
  getWalletInscriptions,
  Collection,
  CollectionItem,
  WalletInscription,
} from '../../services/collectionService';
import { InscriptionPreview } from './InscriptionPreview';
import { useWallet } from '../../contexts/WalletContext';
import { signPSBT } from '../../utils/wallet';
import { createTransfer, confirmTransfer } from '../../services/pointShopService';

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
  const [presigningItems, setPresigningItems] = useState<Map<string, { status: 'pending' | 'preparing' | 'ready' | 'signing' | 'signed' | 'error'; transferId?: string; psbtBase64?: string; error?: string }>>(new Map());
  const [presignFeeRate, setPresignFeeRate] = useState(15);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    thumbnail: '',
    price: '',
    items: [] as CollectionItem[],
  });

  useEffect(() => {
    loadCollections();
  }, [adminAddress]);

  const loadWalletInscriptions = async () => {
    if (!adminAddress) {
      console.warn('[CollectionManager] No admin address provided, cannot load wallet inscriptions');
      return;
    }
    console.log('[CollectionManager] Loading wallet inscriptions for:', adminAddress);
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
    if (showForm && adminAddress) {
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
      const transferData = await createTransfer(
        inscriptionId,
        adminAddress, // Placeholder recipient (wird später ersetzt)
        presignFeeRate,
      );
      
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, {
          status: 'ready',
          transferId: transferData.data.transferId,
          psbtBase64: transferData.data.psbt,
        });
        return newMap;
      });
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
    if (!item?.psbtBase64 || !item.transferId) {
      alert('PSBT not prepared yet');
      return;
    }
    
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      newMap.set(inscriptionId, { ...item, status: 'signing' });
      return newMap;
    });
    
    try {
      const signedPsbt = await signPSBT(
        item.psbtBase64,
        walletState.walletType,
        false
      );
      
      await confirmTransfer(
        item.transferId!,
        signedPsbt,
        adminAddress,
        true,
        `collection-${Date.now()}`
      );
      
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, { ...item, status: 'signed' });
        return newMap;
      });
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
    if (!formData.name || !formData.price || formData.items.length === 0) {
      alert('Please fill in all required fields (Name, Price, and select at least one item)');
      return;
    }

    // Prüfe ob alle Original-Inskriptionen signiert sind
    const originalItems = formData.items.filter(item => item.type === 'original');
    if (originalItems.length > 0 && !areAllOriginalsSigned()) {
      if (!confirm('Not all original inscriptions are pre-signed. Do you want to continue anyway?')) {
        return;
      }
    }

    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, adminAddress, formData);
        alert('Collection updated successfully!');
      } else {
        await createCollection(adminAddress, formData);
        alert('Collection created successfully!');
      }
      
      resetForm();
      loadCollections();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
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
    });
    setShowForm(true);
  };

  const handleDelete = async (collectionId: string) => {
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      thumbnail: '',
      price: '',
      items: [],
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

  const filteredInscriptions = walletInscriptions.filter(ins =>
    ins.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ins.inscriptionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <div className="flex gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="text-white text-sm"
                />
                {formData.thumbnail && (
                  <img
                    src={formData.thumbnail}
                    alt="Thumbnail preview"
                    className="w-20 h-20 object-cover rounded"
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Or enter URL:</p>
              <input
                type="text"
                value={formData.thumbnail}
                onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm mt-1"
                placeholder="https://example.com/image.png"
              />
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
              
              <div className="mb-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                  placeholder="Search inscriptions..."
                />
              </div>

              {!adminAddress ? (
                <div className="text-gray-400 text-sm py-4">Please connect admin wallet to view inscriptions</div>
              ) : loadingInscriptions ? (
                <div className="text-gray-400 text-sm py-4">Loading wallet inscriptions...</div>
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

            {/* Pre-Signing Controls für Original-Inskriptionen */}
            {formData.items.some(item => item.type === 'original') && (
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
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(collection)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(collection.id)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold text-white"
                    >
                      Deactivate
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

