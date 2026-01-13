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
import { createTransfer, confirmTransfer } from '../../services/pointShopService';
import { signPSBT } from '../../utils/wallet';
import { useWallet } from '../../contexts/WalletContext';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

interface SmileABitCollectionManagerProps {
  adminAddress: string;
}

export const SmileABitCollectionManager: React.FC<SmileABitCollectionManagerProps> = ({ adminAddress }) => {
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
    mintType: 'individual' as 'individual' | 'random',
  });

  useEffect(() => {
    loadCollections();
  }, [adminAddress]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const data = await getAllCollectionsAdmin(adminAddress);
      // Filter nur SMILE A BIT Kollektionen (category = 'smileabit')
      const smileCollections = data.filter(c => (c as any).category === 'smileabit');
      setCollections(smileCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletInscriptions = async () => {
    if (!adminAddress) {
      console.warn('[SmileABitCollectionManager] No admin address provided');
      return;
    }
    setLoadingInscriptions(true);
    try {
      const data = await getWalletInscriptions(adminAddress);
      setWalletInscriptions(data);
    } catch (error: any) {
      console.error('[SmileABitCollectionManager] Error loading wallet inscriptions:', error);
      setWalletInscriptions([]);
      alert(`Error loading wallet inscriptions: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoadingInscriptions(false);
    }
  };

  useEffect(() => {
    if (showForm && adminAddress) {
      loadWalletInscriptions();
    } else if (!showForm) {
      setWalletInscriptions([]);
      setSearchTerm('');
    }
  }, [showForm, adminAddress]);

  const toggleItemSelection = (inscription: WalletInscription, type: 'delegate' | 'original') => {
    const itemIndex = formData.items.findIndex(
      item => item.inscriptionId === inscription.inscriptionId
    );

    if (itemIndex >= 0) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== itemIndex),
      });
      // Entferne auch Pre-Signing Status
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(inscription.inscriptionId);
        return newMap;
      });
    } else {
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
      // Initialisiere Pre-Signing Status
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscription.inscriptionId, { status: 'pending' });
        return newMap;
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
          type: 'delegate',
          imageUrl,
        });
        // Initialisiere Pre-Signing Status
        setPresigningItems(prev => {
          const newMap = new Map(prev);
          newMap.set(inscription.inscriptionId, { status: 'pending' });
          return newMap;
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
    // Entferne Pre-Signing Status
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      filteredIds.forEach(id => newMap.delete(id));
      return newMap;
    });
  };

  const areAllItemsSelected = () => {
    if (filteredInscriptions.length === 0) return false;
    return filteredInscriptions.every(ins => isItemSelected(ins.inscriptionId));
  };

  const preparePresignPSBT = async (inscriptionId: string) => {
    if (!adminAddress) return;
    
    setPresigningItems(prev => {
      const newMap = new Map(prev);
      newMap.set(inscriptionId, { ...newMap.get(inscriptionId), status: 'preparing' } as any);
      return newMap;
    });
    
    try {
      const transferData = await createTransfer(
        inscriptionId,
        adminAddress, // Placeholder recipient
        presignFeeRate,
        adminAddress,
        `smileabit-${Date.now()}` // Temporary item ID
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
      console.error('[SmileABitCollectionManager] Error preparing PSBT:', error);
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
        `smileabit-${Date.now()}`
      );
      
      setPresigningItems(prev => {
        const newMap = new Map(prev);
        newMap.set(inscriptionId, { ...item, status: 'signed' });
        return newMap;
      });
    } catch (error: any) {
      console.error('[SmileABitCollectionManager] Error signing PSBT:', error);
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
    for (const item of formData.items) {
      const status = presigningItems.get(item.inscriptionId)?.status;
      if (status === 'pending' || status === 'error') {
        await preparePresignPSBT(item.inscriptionId);
        // Pause zwischen Requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const signAllPSBTs = async () => {
    if (!walletState.connected || !walletState.walletType) {
      alert('Please connect your wallet first');
      return;
    }
    
    for (const item of formData.items) {
      const status = presigningItems.get(item.inscriptionId)?.status;
      if (status === 'ready') {
        await signPresignPSBT(item.inscriptionId);
        // Pause zwischen Signatures
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || formData.items.length === 0) {
      alert('Please fill in all required fields (Name, Price, and select at least one item)');
      return;
    }

    // Prüfe ob alle Items pre-signed sind
    const allSigned = formData.items.every(item => {
      const status = presigningItems.get(item.inscriptionId)?.status;
      return status === 'signed';
    });

    if (!allSigned) {
      if (!confirm('Not all items are pre-signed. Do you want to continue anyway?')) {
        return;
      }
    }

    try {
      const collectionData = {
        name: formData.name,
        description: formData.description,
        thumbnail: formData.thumbnail,
        price: parseFloat(formData.price),
        items: formData.items,
        category: 'smileabit', // Markiere als SMILE A BIT Kollektion
      };

      if (editingCollection) {
        await updateCollection(editingCollection.id, adminAddress, collectionData);
        alert('Collection updated successfully!');
      } else {
        await createCollection(adminAddress, collectionData);
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
      mintType: collection.mintType || 'individual',
    });
    // Lade Pre-Signing Status für alle Items
    const newPresigningMap = new Map();
    collection.items.forEach(item => {
      newPresigningMap.set(item.inscriptionId, { status: 'signed' }); // Bereits signiert
    });
    setPresigningItems(newPresigningMap);
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

  const filteredInscriptions = walletInscriptions.filter(ins =>
    ins.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ins.inscriptionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-white text-center py-8">Loading...</div>;
  }

  const allItemsSigned = formData.items.length > 0 && formData.items.every(item => {
    const status = presigningItems.get(item.inscriptionId)?.status;
    return status === 'signed';
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white border-b border-red-600 pb-2">
          SMILE A BIT Collection Management
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, thumbnail: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
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
              
              <div className="mb-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                  placeholder="Search inscriptions..."
                />
              </div>

              {/* Pre-Signing Controls */}
              {formData.items.length > 0 && (
                <div className="mb-4 p-3 bg-gray-800 rounded border border-yellow-600">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Fee Rate (sat/vB)</label>
                    <input
                      type="number"
                      value={presignFeeRate}
                      onChange={(e) => setPresignFeeRate(parseInt(e.target.value, 10))}
                      className="w-20 px-2 py-1 bg-black border border-gray-700 rounded text-white text-xs"
                      min="1"
                    />
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={prepareAllPSBTs}
                      disabled={formData.items.some(item => {
                        const status = presigningItems.get(item.inscriptionId)?.status;
                        return status === 'preparing' || status === 'signing';
                      })}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-xs font-semibold text-white"
                    >
                      Prepare All PSBTs
                    </button>
                    <button
                      onClick={signAllPSBTs}
                      disabled={!walletState.connected || !formData.items.some(item => {
                        const status = presigningItems.get(item.inscriptionId)?.status;
                        return status === 'ready';
                      })}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-xs font-semibold text-white"
                    >
                      Sign All PSBTs
                    </button>
                  </div>
                  {allItemsSigned && (
                    <div className="text-xs text-green-400 font-semibold">
                      ✅ All items pre-signed and ready!
                    </div>
                  )}
                </div>
              )}

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
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {filteredInscriptions.map((inscription) => {
                        const selected = isItemSelected(inscription.inscriptionId);
                        const itemType = getItemType(inscription.inscriptionId);
                        const presignStatus = presigningItems.get(inscription.inscriptionId);
                        
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
                            {selected && presignStatus && (
                              <div className="space-y-1">
                                <div className={`text-[10px] px-1 py-0.5 rounded ${
                                  presignStatus.status === 'signed' ? 'bg-green-600 text-white' :
                                  presignStatus.status === 'ready' ? 'bg-blue-600 text-white' :
                                  presignStatus.status === 'error' ? 'bg-red-600 text-white' :
                                  presignStatus.status === 'preparing' || presignStatus.status === 'signing' ? 'bg-yellow-600 text-black' :
                                  'bg-gray-600 text-white'
                                }`}>
                                  {presignStatus.status === 'signed' ? '✅ Signed' :
                                   presignStatus.status === 'ready' ? '📝 Ready to Sign' :
                                   presignStatus.status === 'error' ? '❌ Error' :
                                   presignStatus.status === 'preparing' ? '⏳ Preparing...' :
                                   presignStatus.status === 'signing' ? '✍️ Signing...' :
                                   '⏸️ Pending'}
                                </div>
                                {presignStatus.status === 'pending' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      preparePresignPSBT(inscription.inscriptionId);
                                    }}
                                    className="w-full text-[10px] px-1 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-white"
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
                                    className="w-full text-[10px] px-1 py-0.5 bg-purple-600 hover:bg-purple-700 rounded text-white"
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
                                    className="w-full text-[10px] px-1 py-0.5 bg-red-600 hover:bg-red-700 rounded text-white"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                            )}
                            {selected && (
                              <div className="flex items-center gap-2 mt-1">
                                <select
                                  value={itemType}
                                  onChange={(e) => {
                                    const newItems = formData.items.map(item =>
                                      item.inscriptionId === inscription.inscriptionId
                                        ? { ...item, type: e.target.value as 'delegate' | 'original' }
                                        : item
                                    );
                                    setFormData({ ...formData, items: newItems });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs bg-gray-700 text-white rounded px-1 py-0.5"
                                >
                                  <option value="delegate">Delegate</option>
                                  <option value="original">Original</option>
                                </select>
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
          SMILE A BIT Collections ({collections.length})
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
