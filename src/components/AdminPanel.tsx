import React, { useState, useEffect } from 'react';
import { getCollectionHashlist, getCollectionStats, exportHashlist, exportSimpleHashlist, CollectionStats } from '../services/collectionHashlist';
import { getAdminStats, getAdminTradeOffers, openCardImagesFolder, exportAllCardsInfo, TradeOfferAdmin } from '../services/adminService';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { ALL_CARDS } from '../config/cards';
import { getCachedInscriptionImage } from '../services/inscriptionImage';
import { Card } from '../types/wallet';
import { getPointShopItems, PointShopItem, createTransfer, confirmTransfer, preparePSBT, savePresignedTransaction, finalizePSBT } from '../services/pointShopService';
import { CollectionManager } from './admin/CollectionManager';
import { getWalletInscriptions, WalletInscription } from '../services/collectionService';
import { InscriptionPreview } from './admin/InscriptionPreview';
import { signPSBT, signPsbts } from '../utils/wallet';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { walletState } = useWallet();
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'cards' | 'settings' | 'pointShop' | 'collections'>('overview');
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [hashlist, setHashlist] = useState<any>(null);
  const [tradeOffers, setTradeOffers] = useState<TradeOfferAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = walletState.connected && 
    walletState.accounts[0]?.address && 
    isAdminAddress(walletState.accounts[0].address);

  const adminAddress = walletState.accounts[0]?.address;

  useEffect(() => {
    if (!isAdmin) {
      console.warn('Unauthorized access attempt to Admin Panel');
      onClose();
    }
  }, [isAdmin, onClose]);

  useEffect(() => {
    const loadData = async () => {
      if (!adminAddress) {
        setError('No admin address available');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [statsData, hashlistData, adminStatsData, tradesData] = await Promise.all([
          getCollectionStats(adminAddress).catch((err) => {
            console.warn('[AdminPanel] Failed to load collection stats:', err);
            return null;
          }),
          getCollectionHashlist(adminAddress).catch((err) => {
            console.warn('[AdminPanel] Failed to load hashlist:', err);
            return null;
          }),
          getAdminStats(adminAddress).catch((err) => {
            console.warn('[AdminPanel] Failed to load admin stats:', err);
            return null;
          }),
          getAdminTradeOffers(adminAddress).catch((err) => {
            console.warn('[AdminPanel] Failed to load trade offers:', err);
            return [];
          }),
        ]);
        
        setStats(statsData);
        setHashlist(hashlistData);
        setAdminStats(adminStatsData);
        setTradeOffers(tradesData || []);
      } catch (error: any) {
        console.error('[AdminPanel] ❌ Failed to load admin data:', error);
        setError(error.message || 'Failed to load admin data. Please check backend connection.');
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin && adminAddress) {
      loadData();
    }
  }, [isAdmin, adminAddress]);

  const handleExportFull = async () => {
    if (!adminAddress) {
      alert('Admin address required');
      return;
    }
    await exportHashlist(adminAddress);
  };

  const handleExportSimple = async () => {
    if (!adminAddress) {
      alert('Admin address required');
      return;
    }
    await exportSimpleHashlist(adminAddress);
  };

  const handleOpenCardImages = async () => {
    if (!adminAddress) {
      alert('Admin address required');
      return;
    }
    try {
      await openCardImagesFolder(adminAddress);
      alert('Ordner wird geöffnet...');
    } catch (error: any) {
      alert(`Fehler: ${error.message}`);
    }
  };

  const handleExportCardsInfo = async () => {
    if (!adminAddress) {
      alert('Admin address required');
      return;
    }
    try {
      await exportAllCardsInfo(adminAddress);
    } catch (error: any) {
      alert(`Fehler: ${error.message}`);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-black border-2 border-red-600 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-2 border-red-600">
          <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pt-4 border-b-2 border-gray-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'overview'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'trades'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trade Offers ({tradeOffers.length})
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'cards'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Cards ({ALL_CARDS.length})
          </button>
          <button
            onClick={() => setActiveTab('pointShop')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'pointShop'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Point Shop
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'collections'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Collections
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'settings'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-white text-center py-8">Loading...</div>
          ) : error ? (
            <div className="text-red-600 text-center py-8">
              <p className="font-bold mb-2">Error loading admin data</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Statistiken */}
                  {stats && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-2">
                        Collection Statistics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Total Packs</p>
                          <p className="text-white text-2xl font-bold">{stats.totalPacks}</p>
                        </div>
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Starter Packs</p>
                          <p className="text-white text-2xl font-bold">{stats.starterPacks}</p>
                        </div>
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Premium Packs</p>
                          <p className="text-white text-2xl font-bold">{stats.premiumPacks}</p>
                        </div>
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Total Inscriptions</p>
                          <p className="text-white text-2xl font-bold">{stats.totalInscriptions}</p>
                        </div>
                      </div>

                      {/* Rarity Stats */}
                      {stats.byRarity && Object.keys(stats.byRarity).length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-white mb-2">By Rarity</h4>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {Object.entries(stats.byRarity).map(([rarity, count]) => (
                              <div key={rarity} className="bg-gray-900 border border-red-600 rounded p-2">
                                <p className="text-gray-400 text-xs capitalize">{rarity}</p>
                                <p className="text-white text-lg font-bold">{count}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Stats */}
                  {adminStats && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-2">
                        System Statistics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Total Delegates</p>
                          <p className="text-white text-2xl font-bold">{adminStats.totalDelegates || 0}</p>
                        </div>
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Total Trade Offers</p>
                          <p className="text-white text-2xl font-bold">{adminStats.totalTradeOffers || 0}</p>
                        </div>
                        <div className="bg-gray-900 border border-red-600 rounded p-3">
                          <p className="text-gray-400 text-xs uppercase">Active Offers</p>
                          <p className="text-white text-2xl font-bold">{adminStats.activeTradeOffers || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Export Buttons */}
                  <div className="border-t border-red-600 pt-6">
                    <h3 className="text-xl font-bold text-white mb-4">Export Functions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={handleExportFull}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded border border-white transition"
                      >
                        Export Full Hashlist (JSON)
                      </button>
                      <button
                        onClick={handleExportSimple}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded border border-red-600 transition"
                      >
                        Export Simple (Inscription IDs only)
                      </button>
                      <button
                        onClick={handleExportCardsInfo}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded border border-red-600 transition"
                      >
                        Export All Cards Info (JSON)
                      </button>
                      <button
                        onClick={handleOpenCardImages}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded border border-red-600 transition"
                      >
                        📁 Open Card Images Folder
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Trades Tab */}
              {activeTab === 'trades' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-2">
                    Trade Offers Management
                  </h3>
                  
                  {tradeOffers.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>No trade offers found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tradeOffers.map((offer) => (
                        <div key={offer.offerId} className="bg-gray-900 border border-red-600 rounded p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-mono text-gray-400">{offer.offerId}</p>
                              <p className="text-xs text-gray-500">Maker: {offer.maker.slice(0, 12)}...</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              offer.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300'
                            }`}>
                              {offer.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Offers ({offer.offerCards.length}):</p>
                              <div className="space-y-1">
                                {offer.offerCards.slice(0, 3).map((id) => (
                                  <p key={id} className="text-xs font-mono text-white">{id.slice(0, 16)}...</p>
                                ))}
                                {offer.offerCards.length > 3 && (
                                  <p className="text-xs text-gray-500">+{offer.offerCards.length - 3} more</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Wants ({offer.requestCards.length}):</p>
                              <div className="space-y-1">
                                {offer.requestCards.slice(0, 3).map((id) => (
                                  <p key={id} className="text-xs font-mono text-white">{id.slice(0, 16)}...</p>
                                ))}
                                {offer.requestCards.length > 3 && (
                                  <p className="text-xs text-gray-500">+{offer.requestCards.length - 3} more</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Created: {new Date(offer.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cards Tab */}
              {activeTab === 'cards' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-2">
                    All Cards ({ALL_CARDS.length})
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                    {ALL_CARDS.map((card) => (
                      <CardPreview key={card.id} card={card} />
                    ))}
                  </div>
                </div>
              )}

              {/* Point Shop Tab */}
              {activeTab === 'pointShop' && (
                <PointShopManagement adminAddress={adminAddress} />
              )}

              {/* Collections Tab */}
              {activeTab === 'collections' && adminAddress && (
                <CollectionManager adminAddress={adminAddress} />
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-2">
                    Admin Settings
                  </h3>
                  
                  <div className="bg-gray-900 border border-red-600 rounded p-4">
                    <h4 className="font-bold text-white mb-3">System Information</h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-300">
                        <span className="text-gray-400">Total Cards:</span> {ALL_CARDS.length}
                      </p>
                      <p className="text-gray-300">
                        <span className="text-gray-400">Animal Cards:</span> {ALL_CARDS.filter(c => c.cardType === 'animal').length}
                      </p>
                      <p className="text-gray-300">
                        <span className="text-gray-400">Action Cards:</span> {ALL_CARDS.filter(c => c.cardType === 'action').length}
                      </p>
                      <p className="text-gray-300">
                        <span className="text-gray-400">Status Cards:</span> {ALL_CARDS.filter(c => c.cardType === 'status').length}
                      </p>
                    </div>
                  </div>

                  {hashlist && (
                    <div className="bg-gray-900 border border-red-600 rounded p-4">
                      <h4 className="font-bold text-white mb-3">Collection Info</h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-gray-300">
                          <span className="text-gray-400">Collection ID:</span> {hashlist.collection}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">Total Minted:</span> {hashlist.totalMinted} inscriptions
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">Generated:</span> {new Date(hashlist.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Card Preview Komponente mit Bild
const CardPreview: React.FC<{ card: Card }> = ({ card }) => {
  const [imageError, setImageError] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(() => {
    // Starte mit ordinals.com/content für ALLE Karten mit inscriptionId
    if (card.inscriptionId && !card.inscriptionId.startsWith('pending-') && !card.inscriptionId.startsWith('mock-')) {
      return `https://ordinals.com/content/${card.inscriptionId}`;
    }
    return '';
  });

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    
    console.error(`[AdminPanel] Image load error for ${card.name} from ${currentSrc}`);
    
    // Fallback-Kette: content -> preview -> ordiscan
    if (currentSrc.includes('ordinals.com/content')) {
      // Versuche preview
      const previewSrc = `https://ordinals.com/preview/${card.inscriptionId}`;
      console.log(`[AdminPanel] Trying preview URL: ${previewSrc}`);
      setCurrentImageSrc(previewSrc);
    } else if (currentSrc.includes('ordinals.com/preview')) {
      // Versuche ordiscan
      const ordiscanSrc = `https://ordiscan.com/content/${card.inscriptionId}`;
      console.log(`[AdminPanel] Trying ordiscan URL: ${ordiscanSrc}`);
      setCurrentImageSrc(ordiscanSrc);
    } else {
      // Alle Quellen fehlgeschlagen
      console.error(`[AdminPanel] All image sources failed for ${card.name}`);
      setImageError(true);
    }
  };

  // Prüfe ob wir eine inscriptionId haben (für alle Kartentypen)
  const hasInscriptionId = card.inscriptionId && 
    !card.inscriptionId.startsWith('pending-') && 
    !card.inscriptionId.startsWith('mock-');

  return (
    <div className="bg-gray-900 border border-red-600 rounded p-3 hover:border-red-500 transition">
      {/* Bild-Vorschau */}
      <div className="mb-3 aspect-square bg-black rounded overflow-hidden flex items-center justify-center border border-gray-700">
        {hasInscriptionId ? (
          imageError ? (
            <div className="text-red-500 text-xs text-center p-2">
              <p>Error loading image</p>
              <p className="text-gray-500 mt-1 text-[10px] break-all">{card.inscriptionId}</p>
              {/* Fallback zu svgIcon wenn verfügbar */}
              {card.svgIcon && (
                <div 
                  className="w-full h-full flex items-center justify-center p-2 mt-2"
                  dangerouslySetInnerHTML={{ __html: card.svgIcon }}
                />
              )}
            </div>
          ) : (
            <img 
              key={currentImageSrc} // Key ändern, um Bild neu zu laden
              src={currentImageSrc}
              alt={card.name}
              className="w-full h-full object-contain"
              onError={handleImageError}
              onLoad={() => {
                console.log(`[AdminPanel] ✅ Image loaded successfully for ${card.name} (${card.cardType}) from ${currentImageSrc}`);
              }}
            />
          )
        ) : card.svgIcon ? (
          // Fallback: Nur svgIcon wenn keine inscriptionId vorhanden
          <div 
            className="w-full h-full flex items-center justify-center p-2"
            dangerouslySetInnerHTML={{ __html: card.svgIcon }}
          />
        ) : (
          <div className="text-gray-500 text-xs">No preview</div>
        )}
      </div>

      {/* Karten-Info */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <p className="font-bold text-white">{card.name}</p>
          <p className="text-xs text-gray-400 capitalize">{card.rarity}</p>
          <p className="text-xs text-gray-500 capitalize">{card.cardType || 'animal'}</p>
        </div>
        <span className="text-xs px-2 py-1 bg-red-600 text-white rounded ml-2">
          {card.id}
        </span>
      </div>

      {/* Inscription ID */}
      <p className="text-xs font-mono text-gray-400 break-all mt-2 truncate" title={card.inscriptionId}>
        {card.inscriptionId}
      </p>

      {/* Effect */}
      {card.effect && (
        <p className="text-xs text-gray-300 mt-2 italic line-clamp-2">{card.effect}</p>
      )}
    </div>
  );
};

// Point Shop Management Component
const PointShopManagement: React.FC<{ adminAddress?: string }> = ({ adminAddress }) => {
  const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
  const { walletState } = useWallet();
  const [items, setItems] = useState<PointShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletInscriptions, setWalletInscriptions] = useState<WalletInscription[]>([]);
  const [loadingInscriptions, setLoadingInscriptions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInscriptions, setSelectedInscriptions] = useState<Set<string>>(new Set());
  const [createMode, setCreateMode] = useState<'single' | 'series' | 'bulk'>('single');
  const [newItem, setNewItem] = useState({
    itemType: 'delegate' as 'delegate' | 'original',
    inscriptionId: '',
    title: '',
    description: '',
    pointsCost: '',
  });
  // Pre-Signing State
  const [showPresignModal, setShowPresignModal] = useState(false);
  const [presignItem, setPresignItem] = useState<PointShopItem | null>(null);
  const [presignInscriptions, setPresignInscriptions] = useState<Array<{ inscriptionId: string; status: 'pending' | 'preparing' | 'ready' | 'signing' | 'signed' | 'error'; transferId?: string; psbtBase64?: string; error?: string }>>([]);
  const [presignFeeRate, setPresignFeeRate] = useState(15); // Default fee rate
  const [presignRecipient, setPresignRecipient] = useState(adminAddress || ''); // Default: Admin address (wird beim Kauf überschrieben)

  useEffect(() => {
    loadItems();
  }, []);

  // Lade Wallet-Inskriptionen wenn itemType auf 'original' geändert wird ODER wenn createMode series/bulk ist
  useEffect(() => {
    if ((newItem.itemType === 'original' || createMode === 'series' || createMode === 'bulk') && adminAddress) {
      loadWalletInscriptions();
    } else if (createMode === 'single' && newItem.itemType === 'delegate') {
      setWalletInscriptions([]);
      setSearchTerm('');
      setSelectedInscriptions(new Set());
    }
  }, [newItem.itemType, adminAddress, createMode]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getPointShopItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading point shop items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletInscriptions = async () => {
    if (!adminAddress) return;
    setLoadingInscriptions(true);
    try {
      const data = await getWalletInscriptions(adminAddress);
      setWalletInscriptions(data);
    } catch (error) {
      console.error('Error loading wallet inscriptions:', error);
      setWalletInscriptions([]);
    } finally {
      setLoadingInscriptions(false);
    }
  };

  const handleSelectInscription = (inscriptionId: string) => {
    setNewItem({ ...newItem, inscriptionId });
  };

  const handleToggleInscription = (inscriptionId: string) => {
    const newSelected = new Set(selectedInscriptions);
    if (newSelected.has(inscriptionId)) {
      newSelected.delete(inscriptionId);
    } else {
      newSelected.add(inscriptionId);
    }
    setSelectedInscriptions(newSelected);
  };

  const filteredInscriptions = walletInscriptions.filter(ins =>
    ins.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ins.inscriptionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = async () => {
    try {
      if (createMode === 'single') {
        // Bestehende Logik für einzelnes Item
        if (!newItem.inscriptionId || !newItem.title || !newItem.pointsCost) {
          alert('Please fill in all required fields (Inscription ID, Title, Points)');
          return;
        }

        const response = await fetch(`${API_URL}/api/point-shop/admin/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemType: newItem.itemType,
            inscriptionId: newItem.inscriptionId,
            title: newItem.title,
            description: newItem.description,
            pointsCost: parseInt(newItem.pointsCost, 10),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to add item');
        }

        const result = await response.json();
        await loadItems();
        
        // Wenn Original-Item: Öffne Pre-Signing Modal
        if (newItem.itemType === 'original' && result.item) {
          setPresignItem(result.item);
          setPresignInscriptions([{
            inscriptionId: newItem.inscriptionId,
            status: 'pending',
          }]);
          setShowPresignModal(true);
        } else {
          setNewItem({ itemType: 'delegate', inscriptionId: '', title: '', description: '', pointsCost: '' });
          alert('Item added successfully!');
        }
      } 
      else if (createMode === 'series') {
        // NEUE Logik für Serie
        if (selectedInscriptions.size === 0 || !newItem.title || !newItem.pointsCost) {
          alert('Please select at least one inscription and fill in title and points');
          return;
        }

        const inscriptionIdsArray = Array.from(selectedInscriptions);
        const response = await fetch(`${API_URL}/api/point-shop/admin/add-series`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inscriptionIds: inscriptionIdsArray,
            title: newItem.title,
            description: newItem.description,
            pointsCost: parseInt(newItem.pointsCost, 10),
            totalCount: inscriptionIdsArray.length,
            inscriptionItemType: newItem.itemType, // 'delegate' oder 'original'
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to add series');
        }

        const result = await response.json();
        await loadItems();
        
        // Wenn Original-Series: Öffne Pre-Signing Modal
        if (newItem.itemType === 'original' && result.item) {
          setPresignItem(result.item);
          setPresignInscriptions(inscriptionIdsArray.map(id => ({
            inscriptionId: id,
            status: 'pending',
          })));
          setShowPresignModal(true);
        } else {
          setSelectedInscriptions(new Set());
          setNewItem({ itemType: 'delegate', inscriptionId: '', title: '', description: '', pointsCost: '' });
          alert(`Series with ${inscriptionIdsArray.length} items created successfully!`);
        }
      }
      else if (createMode === 'bulk') {
        // NEUE Logik für Bulk
        if (selectedInscriptions.size === 0 || !newItem.title || !newItem.pointsCost) {
          alert('Please select at least one inscription and fill in title and points');
          return;
        }

        const inscriptionIdsArray = Array.from(selectedInscriptions);
        const response = await fetch(`${API_URL}/api/point-shop/admin/add-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemType: newItem.itemType, // 'delegate' oder 'original'
            inscriptionIds: inscriptionIdsArray,
            title: newItem.title, // Basistitel (wird für jedes Item verwendet)
            description: newItem.description,
            pointsCost: parseInt(newItem.pointsCost, 10),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to add bulk items');
        }

        const result = await response.json();
        await loadItems();
        
        // Wenn Original-Bulk: Öffne Pre-Signing Modal für alle Items
        if (newItem.itemType === 'original' && result.items && result.items.length > 0) {
          // Für Bulk: Jedes Item einzeln pre-signen
          // Zeige Modal für erstes Item, dann können wir durchklicken
          setPresignItem(result.items[0]);
          setPresignInscriptions(inscriptionIdsArray.map(id => ({
            inscriptionId: id,
            status: 'pending',
          })));
          setShowPresignModal(true);
        } else {
          setSelectedInscriptions(new Set());
          setNewItem({ itemType: 'delegate', inscriptionId: '', title: '', description: '', pointsCost: '' });
          alert(`${result.itemsCreated || inscriptionIdsArray.length} items created successfully!`);
        }
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Pre-Signing Funktionen (UniSat Marketplace Flow)
  const preparePresignPSBT = async (inscriptionId: string, index: number) => {
    if (!presignItem || !adminAddress) return;
    
    const updated = [...presignInscriptions];
    updated[index] = { ...updated[index], status: 'preparing' };
    setPresignInscriptions(updated);
    
    try {
      console.log('[AdminPanel] Calling createTransfer for inscription:', inscriptionId);
      // NEU: Verwende createTransfer (UniSat Marketplace Flow)
      const transferData = await createTransfer(
        inscriptionId,
        presignRecipient || adminAddress,
        presignFeeRate,
        adminAddress,
        presignItem.id
      );
      
      console.log('[AdminPanel] createTransfer successful:', {
        transferId: transferData.data.transferId,
        hasPsbt: !!transferData.data.psbt,
        psbtLength: transferData.data.psbt?.length
      });
      
      // Use functional update to ensure we have the latest state
      setPresignInscriptions(prev => {
        const newUpdated = [...prev];
        newUpdated[index] = {
          ...newUpdated[index],
          status: 'ready',
          transferId: transferData.data.transferId,
          psbtBase64: transferData.data.psbt, // Base64 PSBT aus response
        };
        console.log('[AdminPanel] Status updated to ready for index:', index, 'new status:', newUpdated[index].status);
        return newUpdated;
      });
    } catch (error: any) {
      console.error('[AdminPanel] createTransfer error:', error);
      // Use functional update to ensure we have the latest state
      setPresignInscriptions(prev => {
        const newUpdated = [...prev];
        newUpdated[index] = {
          ...newUpdated[index],
          status: 'error',
          error: error.message || 'Failed to create transfer',
        };
        return newUpdated;
      });
    }
  };

  const signPresignPSBT = async (inscriptionId: string, index: number) => {
    if (!presignItem || !walletState.connected || !walletState.walletType) return;
    
    const inscription = presignInscriptions[index];
    if (!inscription.psbtBase64 || !inscription.transferId) {
      alert('PSBT not prepared yet or transferId missing');
      return;
    }
    
    const updated = [...presignInscriptions];
    updated[index] = { ...updated[index], status: 'signing' };
    setPresignInscriptions(updated);
    
    try {
      // Signiere PSBT mit Wallet (gibt signierte PSBT zurück)
      const signedPsbt = await signPSBT(
        inscription.psbtBase64,
        walletState.walletType,
        false // autoFinalized = false (finalize in confirmTransfer)
      );
      
      // NEU: Verwende confirmTransfer (UniSat Marketplace Flow)
      // Dies finalisiert automatisch und speichert die Transaktion
      const confirmData = await confirmTransfer(
        inscription.transferId!,
        signedPsbt,
        adminAddress,
        true, // fromBase64 = true
        presignItem.id
      );
      
      // confirmTransfer gibt signedTxHex zurück und speichert automatisch
      updated[index] = {
        ...updated[index],
        status: 'signed',
      };
      setPresignInscriptions(updated);
      
      // Lade Items neu
      await loadItems();
    } catch (error: any) {
      updated[index] = {
        ...updated[index],
        status: 'error',
        error: error.message || 'Failed to sign or confirm transfer',
      };
      setPresignInscriptions(updated);
    }
  };

  const handlePresignAll = async () => {
    if (!presignItem) return;
    
    // Bereite alle PSBTs vor
    for (let i = 0; i < presignInscriptions.length; i++) {
      if (presignInscriptions[i].status === 'pending') {
        await preparePresignPSBT(presignInscriptions[i].inscriptionId, i);
        // Warte kurz zwischen Requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleSignAll = async () => {
    if (!presignItem || !walletState.connected || !walletState.walletType) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      // Sammle alle bereiten PSBTs
      const readyInscriptions = presignInscriptions
        .map((ins, index) => ({ ...ins, index }))
        .filter(ins => ins.status === 'ready' && ins.psbtBase64 && ins.transferId);
      
      if (readyInscriptions.length === 0) {
        alert('Keine bereiten PSBTs zum Signieren gefunden');
        return;
      }
      
      // Update Status für alle
      const updated = [...presignInscriptions];
      readyInscriptions.forEach(ins => {
        updated[ins.index] = { ...updated[ins.index], status: 'signing' };
      });
      setPresignInscriptions(updated);
      
      // NEU: Signiere alle PSBTs auf einmal (wenn UniSat und mehr als 1 PSBT)
      if (walletState.walletType === 'unisat' && readyInscriptions.length > 1) {
        // Batch-Signatur mit signPsbts
        const psbtBase64s = readyInscriptions.map(ins => ins.psbtBase64!);
        
        try {
          const signedPsbts = await signPsbts(
            psbtBase64s,
            walletState.walletType,
            false // autoFinalized = false (finalize in confirmTransfer)
          );
          
          // Bestätige alle signierten PSBTs
          for (let i = 0; i < readyInscriptions.length; i++) {
            const ins = readyInscriptions[i];
            const signedPsbt = signedPsbts[i];
            
            try {
              const confirmData = await confirmTransfer(
                ins.transferId!,
                signedPsbt,
                adminAddress,
                false, // fromBase64 = false (bereits Hex)
                presignItem.id
              );
              
              updated[ins.index] = {
                ...updated[ins.index],
                status: 'signed',
              };
            } catch (error: any) {
              updated[ins.index] = {
                ...updated[ins.index],
                status: 'error',
                error: error.message || 'Failed to confirm transfer',
              };
            }
          }
        } catch (error: any) {
          // Fallback: Signiere sequenziell
          console.warn('[AdminPanel] Batch-Signatur fehlgeschlagen, verwende sequenzielle Signatur:', error);
          for (const ins of readyInscriptions) {
            try {
              await signPresignPSBT(ins.inscriptionId, ins.index);
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err: any) {
              updated[ins.index] = {
                ...updated[ins.index],
                status: 'error',
                error: err.message || 'Failed to sign',
              };
            }
          }
        }
      } else {
        // Sequenzielle Signatur (Xverse oder einzelne PSBTs)
        for (const ins of readyInscriptions) {
          try {
            await signPresignPSBT(ins.inscriptionId, ins.index);
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error: any) {
            updated[ins.index] = {
              ...updated[ins.index],
              status: 'error',
              error: error.message || 'Failed to sign',
            };
          }
        }
      }
      
      setPresignInscriptions(updated);
      
      // Lade Items neu
      await loadItems();
      
      alert(`${readyInscriptions.length} PSBT(s) erfolgreich signiert!`);
    } catch (error: any) {
      console.error('[AdminPanel] Error in handleSignAll:', error);
      alert(`Fehler beim Signieren: ${error.message}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Möchtest du dieses Item wirklich deaktivieren?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/point-shop/admin/item/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      await loadItems();
      alert('Item erfolgreich deaktiviert!');
    } catch (error: any) {
      alert(`Fehler: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="text-white text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4 border-b border-red-600 pb-2">
        Point Shop Management
      </h3>

      {/* Add New Item Form */}
      <div className="bg-gray-900 border border-red-600 rounded p-4 mb-6">
        <h4 className="font-bold text-white mb-3">Add New Item</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Create Mode *</label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="createMode"
                  value="single"
                  checked={createMode === 'single'}
                  onChange={(e) => {
                    setCreateMode(e.target.value as 'single' | 'series' | 'bulk');
                    setSelectedInscriptions(new Set());
                    setNewItem({ ...newItem, inscriptionId: '' });
                  }}
                  className="text-red-600"
                />
                <span className="text-white text-sm">Single Item</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="createMode"
                  value="series"
                  checked={createMode === 'series'}
                  onChange={(e) => {
                    setCreateMode(e.target.value as 'single' | 'series' | 'bulk');
                    setSelectedInscriptions(new Set());
                    setNewItem({ ...newItem, inscriptionId: '' });
                  }}
                  className="text-red-600"
                />
                <span className="text-white text-sm">Series (1/N - N/N)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="createMode"
                  value="bulk"
                  checked={createMode === 'bulk'}
                  onChange={(e) => {
                    setCreateMode(e.target.value as 'single' | 'series' | 'bulk');
                    setSelectedInscriptions(new Set());
                    setNewItem({ ...newItem, inscriptionId: '' });
                  }}
                  className="text-red-600"
                />
                <span className="text-white text-sm">Bulk (Multiple Items)</span>
              </label>
            </div>
          </div>
          
          {createMode === 'single' && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Item Type *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    value="delegate"
                    checked={newItem.itemType === 'delegate'}
                    onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value as 'delegate' | 'original' })}
                    className="text-red-600"
                  />
                  <span className="text-white text-sm">Delegate (creates new delegate inscription)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    value="original"
                    checked={newItem.itemType === 'original'}
                    onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value as 'delegate' | 'original' })}
                    className="text-red-600"
                  />
                  <span className="text-white text-sm">Original (transfers existing ordinal)</span>
                </label>
              </div>
            </div>
          )}
          
          {(createMode === 'series' || createMode === 'bulk') && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Item Type * (für die Inskriptionen in Serie/Bulk)</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    value="delegate"
                    checked={newItem.itemType === 'delegate'}
                    onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value as 'delegate' | 'original' })}
                    className="text-red-600"
                  />
                  <span className="text-white text-sm">Delegate</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    value="original"
                    checked={newItem.itemType === 'original'}
                    onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value as 'delegate' | 'original' })}
                    className="text-red-600"
                  />
                  <span className="text-white text-sm">Original</span>
                </label>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              {createMode === 'single' 
                ? (newItem.itemType === 'delegate' ? 'Delegate Inscription ID *' : 'Original Inscription ID *')
                : (createMode === 'series' ? 'Select Inscriptions for Series *' : 'Select Inscriptions for Bulk *')}
            </label>
            
            {/* Wenn Single-Mode: Normale Eingabe oder Wallet-Browser */}
            {createMode === 'single' && newItem.itemType === 'original' ? (
              <div>
                <input
                  type="text"
                  value={newItem.inscriptionId}
                  onChange={(e) => setNewItem({ ...newItem, inscriptionId: e.target.value })}
                  placeholder="Select from wallet below or enter manually"
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm mb-2"
                />
                
                {adminAddress ? (
                  <>
                    <div className="mb-2">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search inscriptions..."
                        className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                      />
                    </div>
                    
                    {loadingInscriptions ? (
                      <div className="text-gray-400 text-sm py-4">Loading wallet inscriptions...</div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto border border-gray-700 rounded p-4 bg-black">
                        {filteredInscriptions.length === 0 ? (
                          <p className="text-gray-400 text-sm">No inscriptions found</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {filteredInscriptions.map((inscription) => {
                              const isSelected = newItem.inscriptionId === inscription.inscriptionId;
                              return (
                                <div
                                  key={inscription.inscriptionId}
                                  onClick={() => handleSelectInscription(inscription.inscriptionId)}
                                  className={`border rounded p-2 cursor-pointer transition ${
                                    isSelected
                                      ? 'border-red-600 bg-red-900/20'
                                      : 'border-gray-700 hover:border-gray-600'
                                  }`}
                                >
                                  <div className="aspect-square bg-gray-800 rounded mb-2 flex items-center justify-center overflow-hidden">
                                    <InscriptionPreview inscription={inscription} />
                                  </div>
                                  <div className="text-xs text-white truncate mb-1">
                                    {inscription.name}
                                  </div>
                                  <div className="text-xs text-gray-400 font-mono truncate">
                                    {inscription.inscriptionId.slice(0, 10)}...
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">Please connect admin wallet to view inscriptions</p>
                )}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={newItem.inscriptionId}
                  onChange={(e) => setNewItem({ ...newItem, inscriptionId: e.target.value })}
                  placeholder="e.g. f477036da334ea19d3d2a9dcd1c101641fe196fd67f4ca5f07aae686703930e7i0"
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The delegate inscription ID that will be referenced
                </p>
              </>
            )}
            
            {/* Wenn Series oder Bulk: Mehrfachauswahl */}
            {(createMode === 'series' || createMode === 'bulk') ? (
              <>
                {adminAddress ? (
                  <>
                    <div className="mb-2">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search inscriptions..."
                        className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                      />
                    </div>
                    
                    {loadingInscriptions ? (
                      <div className="text-gray-400 text-sm py-4">Loading wallet inscriptions...</div>
                    ) : (
                      <>
                        <div className="max-h-96 overflow-y-auto border border-gray-700 rounded p-4 bg-black">
                          {filteredInscriptions.length === 0 ? (
                            <p className="text-gray-400 text-sm">No inscriptions found</p>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {filteredInscriptions.map((inscription) => {
                                const isSelected = selectedInscriptions.has(inscription.inscriptionId);
                                return (
                                  <div
                                    key={inscription.inscriptionId}
                                    onClick={() => handleToggleInscription(inscription.inscriptionId)}
                                    className={`border rounded p-2 cursor-pointer transition relative ${
                                      isSelected
                                        ? 'border-red-600 bg-red-900/20'
                                        : 'border-gray-700 hover:border-gray-600'
                                    }`}
                                  >
                                    {/* Checkbox für Mehrfachauswahl */}
                                    <div className="absolute top-2 right-2 z-10">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleInscription(inscription.inscriptionId)}
                                        className="w-4 h-4 text-red-600 rounded bg-black border-2 border-gray-600"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    
                                    <div className="aspect-square bg-gray-800 rounded mb-2 flex items-center justify-center overflow-hidden">
                                      <InscriptionPreview inscription={inscription} />
                                    </div>
                                    <div className="text-xs text-white truncate mb-1">
                                      {inscription.name}
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono truncate">
                                      {inscription.inscriptionId.slice(0, 10)}...
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Auswahl-Anzeige */}
                        {createMode === 'series' && selectedInscriptions.size > 0 && (
                          <div className="mt-2 p-2 bg-blue-900/20 border border-blue-600 rounded text-sm text-blue-300">
                            {selectedInscriptions.size} Inskriptionen ausgewählt für Serie: "{newItem.title || 'Titel eingeben'}" (1/{selectedInscriptions.size} - {selectedInscriptions.size}/{selectedInscriptions.size})
                          </div>
                        )}
                        
                        {createMode === 'bulk' && selectedInscriptions.size > 0 && (
                          <div className="mt-2 p-2 bg-green-900/20 border border-green-600 rounded text-sm text-green-300">
                            {selectedInscriptions.size} Inskriptionen ausgewählt. Es werden {selectedInscriptions.size} separate Items erstellt (jedes mit "{newItem.title || 'Titel'} #1", "#2", etc.).
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">Please connect admin wallet to view inscriptions</p>
                )}
              </>
            ) : null}
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Title *</label>
            <input
              type="text"
              placeholder="e.g. Exclusive Art #1"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Description</label>
            <textarea
              placeholder="Item description..."
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Points Cost *</label>
            <input
              type="number"
              placeholder="e.g. 100"
              value={newItem.pointsCost}
              onChange={(e) => setNewItem({ ...newItem, pointsCost: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
              min="1"
            />
          </div>
          <button
            onClick={addItem}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold text-sm"
          >
            Add Item
          </button>
        </div>
      </div>

      {/* Items List */}
      <div>
        <h4 className="font-bold text-white mb-3">Active Items ({items.length})</h4>
        {items.length === 0 ? (
          <p className="text-gray-400 text-sm">No items yet</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              let inscriptionId: string | undefined;
              if (item.itemType === 'series') {
                // Für Series: Zeige erste verfügbare Inskription
                inscriptionId = item.inscriptionIds && item.inscriptionIds.length > 0 
                  ? item.inscriptionIds[item.currentIndex || 0] || item.inscriptionIds[0]
                  : undefined;
              } else {
                inscriptionId = item.itemType === 'delegate' 
                  ? item.delegateInscriptionId 
                  : item.originalInscriptionId;
              }
              
              const remaining = item.itemType === 'series' && item.totalCount && item.currentIndex !== undefined 
                ? item.totalCount - item.currentIndex 
                : null;
              
              return (
                <div key={item.id} className="bg-gray-900 border border-red-600 rounded p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-20 h-20 bg-gray-800 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {inscriptionId && (
                            <img
                              src={`https://ordinals.com/content/${inscriptionId}`}
                              alt={item.title}
                              className="w-full h-full object-contain rounded"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-1"><div class="text-2xl mb-1">🖼️</div></div>';
                                }
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h5 className="font-bold text-white text-lg">{item.title}</h5>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.itemType === 'series'
                                ? 'bg-purple-600 text-white'
                                : item.itemType === 'delegate' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-green-600 text-white'
                            }`}>
                              {item.itemType === 'series' ? 'Series' : item.itemType === 'delegate' ? 'Delegate' : 'Original'}
                            </span>
                            {item.itemType === 'series' && remaining !== null && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-800 text-white">
                                {remaining}/{item.totalCount} left
                              </span>
                            )}
                          </div>
                          {item.itemType === 'series' && item.seriesTitle && (
                            <p className="text-xs text-purple-400 mb-1 font-semibold">{item.seriesTitle}</p>
                          )}
                          <p className="text-gray-400 text-sm mt-1">{item.description}</p>
                          <div className="mt-2 flex items-center gap-4 flex-wrap">
                            <span className="text-red-600 font-bold">{item.pointsCost} Points</span>
                            {item.itemType === 'series' && item.inscriptionIds && (
                              <span className="text-gray-500 text-xs">{item.inscriptionIds.length} Inskriptionen</span>
                            )}
                            {inscriptionId && item.itemType !== 'series' && (
                              <span className="text-gray-500 text-xs">ID: {inscriptionId.slice(0, 20)}...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold text-white"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pre-Signing Modal */}
      {showPresignModal && presignItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-red-600 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Pre-Signing: {presignItem.title}</h3>
              <button
                onClick={() => {
                  setShowPresignModal(false);
                  setPresignItem(null);
                  setPresignInscriptions([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-4">
                Für Original-Items müssen Sie die Transaktionen VORHER freigeben. 
                Beim Kauf wird dann nur noch die bereits signierte Transaktion gebroadcastet.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fee Rate (sat/vB)</label>
                  <input
                    type="number"
                    value={presignFeeRate}
                    onChange={(e) => setPresignFeeRate(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Recipient (wird beim Kauf überschrieben)</label>
                  <input
                    type="text"
                    value={presignRecipient}
                    onChange={(e) => setPresignRecipient(e.target.value)}
                    placeholder="bc1p..."
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white text-sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={handlePresignAll}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
                  disabled={presignInscriptions.some(i => i.status === 'preparing')}
                >
                  Prepare All PSBTs
                </button>
                {walletState.connected && (
                  <button
                    onClick={handleSignAll}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
                    disabled={presignInscriptions.some(i => i.status === 'signing' || i.status !== 'ready')}
                  >
                    Sign All
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              {presignInscriptions.map((inscription, index) => (
                <div
                  key={inscription.inscriptionId}
                  className="bg-gray-800 border border-gray-700 rounded p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 font-mono mb-1">
                        {inscription.inscriptionId.slice(0, 20)}...
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          inscription.status === 'pending' ? 'bg-gray-600 text-white' :
                          inscription.status === 'preparing' ? 'bg-yellow-600 text-white' :
                          inscription.status === 'ready' ? 'bg-blue-600 text-white' :
                          inscription.status === 'signing' ? 'bg-orange-600 text-white' :
                          inscription.status === 'signed' ? 'bg-green-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                          {inscription.status === 'pending' ? 'Pending' :
                           inscription.status === 'preparing' ? 'Preparing...' :
                           inscription.status === 'ready' ? 'Ready to Sign' :
                           inscription.status === 'signing' ? 'Signing...' :
                           inscription.status === 'signed' ? '✓ Signed' :
                           'Error'}
                        </span>
                        {inscription.error && (
                          <span className="text-xs text-red-400">{inscription.error}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {inscription.status === 'pending' && (
                        <button
                          onClick={() => preparePresignPSBT(inscription.inscriptionId, index)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                        >
                          Prepare
                        </button>
                      )}
                      {inscription.status === 'ready' && walletState.connected && (
                        <button
                          onClick={() => signPresignPSBT(inscription.inscriptionId, index)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        >
                          Sign
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {presignInscriptions.every(i => i.status === 'signed') && (
              <div className="mt-4 p-4 bg-green-900/20 border border-green-600 rounded">
                <p className="text-green-400 text-sm font-semibold">
                  ✓ Alle Transaktionen wurden erfolgreich freigegeben!
                </p>
                <button
                  onClick={() => {
                    setShowPresignModal(false);
                    setPresignItem(null);
                    setPresignInscriptions([]);
                    setNewItem({ itemType: 'delegate', inscriptionId: '', title: '', description: '', pointsCost: '' });
                  }}
                  className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
                >
                  Fertig
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
