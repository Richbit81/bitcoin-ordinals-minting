import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  cancelMarketplaceListing,
  completeMarketplacePurchaseAdvanced,
  completeMarketplacePurchase,
  createMarketplaceListing,
  getMarketplaceListings,
  getMarketplaceRanking,
  MarketplaceCollectionRanking,
  MarketplaceListing,
} from '../services/marketplaceService';
import { sendMultipleBitcoinPayments, signPSBT } from '../utils/wallet';
import { isAdminAddress } from '../config/admin';

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [ranking, setRanking] = useState<MarketplaceCollectionRanking[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [soldListings, setSoldListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    inscriptionId: '',
    collectionSlug: '',
    priceSats: '10000',
  });

  useEffect(() => {
    if (!isAdminUser) return;
    const loadRanking = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMarketplaceRanking();
        setRanking(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load ranking');
      } finally {
        setLoading(false);
      }
    };
    loadRanking();
  }, [isAdminUser]);

  const loadListings = async () => {
    try {
      setListingsLoading(true);
      const [activeData, soldData] = await Promise.all([
        getMarketplaceListings({ status: 'active', limit: 100 }),
        getMarketplaceListings({ status: 'sold', limit: 20 }),
      ]);
      setListings(activeData);
      setSoldListings(soldData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load listings');
    } finally {
      setListingsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminUser) return;
    loadListings();
  }, [isAdminUser]);

  const currentAddress = walletState.accounts?.[0]?.address || '';
  const isAdminUser = isAdminAddress(currentAddress);

  const handleCreateListing = async () => {
    if (!isAdminUser) {
      setError('Marketplace is currently admin-only');
      return;
    }
    if (!walletState.connected || !currentAddress) {
      setError('Please connect wallet first');
      return;
    }
    try {
      setError(null);
      setActionMessage(null);
      const priceSats = Number(form.priceSats);
      if (!form.inscriptionId.trim()) throw new Error('Inscription ID is required');
      if (!Number.isFinite(priceSats) || priceSats <= 0) throw new Error('Price must be > 0');

      await createMarketplaceListing({
        inscriptionId: form.inscriptionId.trim(),
        collectionSlug: form.collectionSlug.trim() || 'unknown',
        sellerAddress: currentAddress,
        buyerReceiveAddress: currentAddress,
        priceSats: Math.round(priceSats),
      });

      setActionMessage('Listing created successfully.');
      setForm((prev) => ({ ...prev, inscriptionId: '' }));
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to create listing');
    }
  };

  const handleCancelListing = async (listingId: string) => {
    try {
      if (!isAdminUser) throw new Error('Marketplace is currently admin-only');
      if (!currentAddress) throw new Error('Connect wallet first');
      setBusyListingId(listingId);
      setError(null);
      setActionMessage(null);
      await cancelMarketplaceListing(listingId, currentAddress);
      setActionMessage('Listing cancelled.');
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel listing');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleBuyListing = async (listing: MarketplaceListing) => {
    try {
      if (!isAdminUser) throw new Error('Marketplace is currently admin-only');
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      setBusyListingId(listing.id);
      setError(null);
      setActionMessage(null);

      // Step 1: Payment from buyer wallet to seller
      const txid = await sendMultipleBitcoinPayments(
        [{ address: listing.seller_address, amount: Number(listing.price_sats) / 100000000 }],
        walletState.walletType
      );

      // Step 2: Mark completed sale in backend
      await completeMarketplacePurchase({
        listingId: listing.id,
        buyerAddress: currentAddress,
        paymentTxid: txid,
      });

      setActionMessage(`Purchase completed. Payment txid: ${txid}`);
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to buy listing');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleAdvancedBuyListing = async (listing: MarketplaceListing) => {
    try {
      if (!isAdminUser) throw new Error('Marketplace is currently admin-only');
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      if (!listing.signed_psbt_base64) {
        throw new Error('Listing has no signed PSBT data');
      }

      setBusyListingId(listing.id);
      setError(null);
      setActionMessage(null);

      // Wallet signs the listing PSBT payload (advanced non-custodial mode).
      const signedPsbtData = await signPSBT(
        listing.signed_psbt_base64,
        walletState.walletType,
        false,
        currentAddress
      );

      const result = await completeMarketplacePurchaseAdvanced({
        listingId: listing.id,
        buyerAddress: currentAddress,
        signedPsbtBase64: signedPsbtData,
      });

      setActionMessage(`Advanced PSBT purchase completed. Txid: ${result.paymentTxid}`);
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed advanced PSBT buy');
    } finally {
      setBusyListingId(null);
    }
  };

  if (!isAdminUser) {
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Ordinals Marketplace</h1>
          <p className="text-sm text-gray-400 mb-6">
            Marketplace is currently visible for admin wallet only.
          </p>
          <div className="border border-red-600/60 rounded-lg p-4 bg-zinc-900/60">
            <p className="text-sm text-red-300 font-semibold">Admin wallet required.</p>
            <p className="text-xs text-gray-400 mt-2">
              Connect with an authorized admin wallet address to access marketplace features.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Ordinals Marketplace</h1>
        <p className="text-sm text-gray-400 mb-6">
          Non-custodial marketplace core with UniSat, Xverse and OKX wallet login.
        </p>

        {!walletState.connected ? (
          <div className="max-w-xl mb-8">
            <WalletConnect />
          </div>
        ) : (
          <div className="mb-8 border border-red-600/60 rounded-lg p-4 bg-zinc-900/60">
            <p className="text-xs text-gray-400 uppercase mb-1">Connected wallet</p>
            <p className="text-sm font-mono break-all">{walletState.accounts?.[0]?.address}</p>
            <p className="text-xs text-gray-400 mt-1">Provider: {walletState.walletType}</p>
            <button
              onClick={() => navigate('/marketplace/profile')}
              className="mt-3 px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            >
              Open My Marketplace Profile
            </button>
          </div>
        )}

        {walletState.connected && (
          <div className="mb-8 border border-white/20 rounded-lg p-4 bg-zinc-900/30">
            <h2 className="font-bold mb-3">Create Listing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={form.inscriptionId}
                onChange={(e) => setForm((prev) => ({ ...prev, inscriptionId: e.target.value }))}
                placeholder="Inscription ID"
                className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
              />
              <input
                value={form.collectionSlug}
                onChange={(e) => setForm((prev) => ({ ...prev, collectionSlug: e.target.value }))}
                placeholder="Collection slug (e.g. badcats)"
                className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
              />
              <input
                value={form.priceSats}
                onChange={(e) => setForm((prev) => ({ ...prev, priceSats: e.target.value }))}
                placeholder="Price in sats"
                className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleCreateListing}
              className="mt-3 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            >
              Create Listing
            </button>
          </div>
        )}

        {actionMessage && (
          <div className="mb-6 p-3 rounded border border-green-600/60 text-green-300 bg-green-900/20 text-sm">
            {actionMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-3 rounded border border-red-600/60 text-red-300 bg-red-900/20 text-sm">
            {error}
          </div>
        )}

        <div className="border border-white/20 rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-3 bg-zinc-900 border-b border-white/10">
            <h2 className="font-bold">Active Listings</h2>
          </div>
          {listingsLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading listings...</div>
          ) : listings.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No active listings yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-950/80">
                  <tr className="text-left text-gray-400">
                    <th className="px-4 py-3">Inscription</th>
                    <th className="px-4 py-3">Collection</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">Price (sats)</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => {
                    const isOwn = currentAddress && l.seller_address.toLowerCase() === currentAddress.toLowerCase();
                    const isBusy = busyListingId === l.id;
                    return (
                      <tr key={l.id} className="border-t border-white/10">
                        <td className="px-4 py-3 font-mono">{l.inscription_id.slice(0, 16)}...</td>
                        <td className="px-4 py-3">{l.collection_slug}</td>
                        <td className="px-4 py-3 font-mono">{l.seller_address.slice(0, 8)}...{l.seller_address.slice(-6)}</td>
                        <td className="px-4 py-3 font-mono">{Number(l.price_sats || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {isOwn ? (
                            <button
                              disabled={isBusy}
                              onClick={() => handleCancelListing(l.id)}
                              className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50"
                            >
                              {isBusy ? 'Working...' : 'Cancel'}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                disabled={!walletState.connected || isBusy}
                                onClick={() => handleBuyListing(l)}
                                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50"
                                title="Simple mode: direct payment + complete"
                              >
                                {isBusy ? 'Buying...' : 'Simple Buy'}
                              </button>
                              <button
                                disabled={!walletState.connected || isBusy}
                                onClick={() => handleAdvancedBuyListing(l)}
                                className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50"
                                title="Advanced mode: wallet PSBT signing and on-chain broadcast"
                              >
                                {isBusy ? 'PSBT...' : 'Advanced PSBT Buy'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border border-white/20 rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-3 bg-zinc-900 border-b border-white/10">
            <h2 className="font-bold">Recently Sold (Flow Status)</h2>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2 py-1 rounded bg-zinc-700 text-zinc-100">Simple</span>
              <span className="px-2 py-1 rounded bg-emerald-700/80 text-emerald-100">Advanced PSBT</span>
            </div>
          </div>
          {listingsLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading sold listings...</div>
          ) : soldListings.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No sold listings yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-950/80">
                  <tr className="text-left text-gray-400">
                    <th className="px-4 py-3">Inscription</th>
                    <th className="px-4 py-3">Price (sats)</th>
                    <th className="px-4 py-3">TX</th>
                    <th className="px-4 py-3">Last Buy Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {soldListings.map((s) => {
                    const source = String(s.sale_metadata?.source || '');
                    const flowLabel = source.includes('advanced-psbt')
                      ? 'Advanced PSBT'
                      : 'Simple';
                    const flowBadgeClass = source.includes('advanced-psbt')
                      ? 'bg-emerald-700/80 text-emerald-100'
                      : 'bg-zinc-700 text-zinc-100';
                    return (
                      <tr key={s.id} className="border-t border-white/10">
                        <td className="px-4 py-3 font-mono">{s.inscription_id.slice(0, 16)}...</td>
                        <td className="px-4 py-3 font-mono">{Number(s.price_sats || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {s.sale_txid ? `${s.sale_txid.slice(0, 10)}...` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${flowBadgeClass}`}>{flowLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border border-white/20 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-zinc-900 border-b border-white/10">
            <h2 className="font-bold">Collection Ranking</h2>
          </div>
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading ranking...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-400">{error}</div>
          ) : ranking.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No ranking data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-950/80">
                  <tr className="text-left text-gray-400">
                    <th className="px-4 py-3">Collection</th>
                    <th className="px-4 py-3">Floor (sats)</th>
                    <th className="px-4 py-3">Listed</th>
                    <th className="px-4 py-3">Sales 7d</th>
                    <th className="px-4 py-3">Volume 7d (sats)</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr key={row.slug} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-xs text-gray-500">{row.slug}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{Number(row.floor_price_sats || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">{row.listed_count || 0}</td>
                      <td className="px-4 py-3">{row.sales_count_7d || 0}</td>
                      <td className="px-4 py-3 font-mono">{Number(row.volume_sats_7d || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

