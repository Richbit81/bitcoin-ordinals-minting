import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  cancelMarketplaceListing,
  getMarketplaceActivity,
  getMarketplaceProfile,
  MarketplaceActivity,
  MarketplaceProfile,
} from '../services/marketplaceService';
import { isAdminAddress } from '../config/admin';

export const MarketplaceProfilePage: React.FC = () => {
  const { walletState } = useWallet();
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [activity, setActivity] = useState<MarketplaceActivity[]>([]);

  const address = walletState.accounts?.[0]?.address || '';
  const isAdminUser = isAdminAddress(address);

  useEffect(() => {
    const load = async () => {
      if (!walletState.connected || !address || !isAdminUser) {
        setProfile(null);
        setActivity([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [data, activityData] = await Promise.all([
          getMarketplaceProfile(address),
          getMarketplaceActivity({ address, limit: 40 }),
        ]);
        setProfile(data);
        setActivity(activityData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [walletState.connected, address, isAdminUser]);

  const reloadProfile = async () => {
    if (!address || !isAdminUser) return;
    const [data, activityData] = await Promise.all([
      getMarketplaceProfile(address),
      getMarketplaceActivity({ address, limit: 40 }),
    ]);
    setProfile(data);
    setActivity(activityData);
  };

  const handleCancelListing = async (listingId: string) => {
    if (!address) return;
    try {
      setBusyListingId(listingId);
      setError(null);
      await cancelMarketplaceListing(listingId, address);
      await reloadProfile();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel listing');
    } finally {
      setBusyListingId(null);
    }
  };

  if (!walletState.connected) {
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">My Marketplace Profile</h1>
          <p className="text-sm text-gray-400 mb-6">Connect UniSat, Xverse or OKX to view your profile.</p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">My Marketplace Profile</h1>
          <p className="text-sm text-red-300 mb-2">Admin wallet required.</p>
          <p className="text-sm text-gray-400 mb-6">
            Marketplace profile is currently available only for authorized admin wallet addresses.
          </p>
          <Link to="/" className="text-sm text-red-400 hover:text-red-300 underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">My Marketplace Profile</h1>
          <Link to="/marketplace" className="text-sm text-red-400 hover:text-red-300 underline">
            Back to Marketplace
          </Link>
        </div>
        <p className="text-xs font-mono text-gray-400 break-all mb-6">{address}</p>

        {loading && <p className="text-sm text-gray-400">Loading profile...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && profile && (
          <>
            {(() => {
              const myPurchases = (profile.recentSales || []).filter(
                (s) => String(s.buyer_address || '').toLowerCase() === address.toLowerCase()
              );
              return (
                <div className="mb-6 border border-white/20 rounded overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-900 border-b border-white/10 font-semibold">My Purchases</div>
                  <div className="max-h-[300px] overflow-auto">
                    {myPurchases.length === 0 ? (
                      <p className="p-4 text-sm text-gray-400">No purchases yet.</p>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead className="bg-zinc-950/80">
                          <tr className="text-left text-gray-400">
                            <th className="px-4 py-2">Inscription</th>
                            <th className="px-4 py-2">Collection</th>
                            <th className="px-4 py-2">Price</th>
                            <th className="px-4 py-2">TX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myPurchases.map((p) => (
                            <tr key={p.id} className="border-t border-white/10">
                              <td className="px-4 py-2 font-mono">{p.inscription_id.slice(0, 14)}...</td>
                              <td className="px-4 py-2">{p.collection_slug}</td>
                              <td className="px-4 py-2 font-mono">{Number(p.price_sats || 0).toLocaleString()}</td>
                              <td className="px-4 py-2 font-mono text-xs">{p.txid ? `${p.txid.slice(0, 10)}...` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="border border-white/20 rounded p-4">
                <p className="text-xs text-gray-400 uppercase">Active Listings</p>
                <p className="text-2xl font-bold mt-1">{profile.listingStats.active}</p>
              </div>
              <div className="border border-white/20 rounded p-4">
                <p className="text-xs text-gray-400 uppercase">Sold Listings</p>
                <p className="text-2xl font-bold mt-1">{profile.listingStats.sold}</p>
              </div>
              <div className="border border-white/20 rounded p-4">
                <p className="text-xs text-gray-400 uppercase">Seller Volume (sats)</p>
                <p className="text-2xl font-bold mt-1 font-mono">{profile.listingStats.totalVolumeSats.toLocaleString()}</p>
              </div>
            </div>

            <div className="mb-6 border border-white/20 rounded overflow-hidden">
              <div className="px-4 py-3 bg-zinc-900 border-b border-white/10 font-semibold">Activity Feed</div>
              <div className="max-h-[300px] overflow-auto">
                {activity.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">No activity yet.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-950/80">
                      <tr className="text-left text-gray-400">
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Inscription</th>
                        <th className="px-4 py-2">Price</th>
                        <th className="px-4 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map((a) => (
                        <tr key={a.id} className="border-t border-white/10">
                          <td className="px-4 py-2 capitalize">{a.activity_type}</td>
                          <td className="px-4 py-2 font-mono">{String(a.inscription_id || '').slice(0, 14)}...</td>
                          <td className="px-4 py-2 font-mono">{a.price_sats ? Number(a.price_sats).toLocaleString() : '-'}</td>
                          <td className="px-4 py-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border border-white/20 rounded overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900 border-b border-white/10 font-semibold">Wallet Inscriptions</div>
                <div className="max-h-[420px] overflow-auto">
                  {(profile.walletInscriptions || []).length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">No inscriptions found for this wallet.</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-950/80">
                        <tr className="text-left text-gray-400">
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Collection</th>
                          <th className="px-4 py-2">Inscription</th>
                          <th className="px-4 py-2">Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.walletInscriptions.map((ins) => {
                          const inscriptionName = String(ins.metadata?.name || ins.inscription_id);
                          const collectionLabel = String(ins.collection_name || ins.collection_slug || '-');
                          const collectionLink = ins.collection_slug
                            ? `/marketplace?collection=${encodeURIComponent(ins.collection_slug)}&inscription=${encodeURIComponent(ins.inscription_id)}`
                            : `/marketplace?inscription=${encodeURIComponent(ins.inscription_id)}`;
                          return (
                            <tr key={ins.inscription_id} className="border-t border-white/10">
                              <td className="px-4 py-2 truncate max-w-[220px]" title={inscriptionName}>{inscriptionName}</td>
                              <td className="px-4 py-2 truncate max-w-[180px]" title={collectionLabel}>{collectionLabel}</td>
                              <td className="px-4 py-2 font-mono text-xs">{ins.inscription_id.slice(0, 14)}...</td>
                              <td className="px-4 py-2">
                                <Link to={collectionLink} className="text-red-300 hover:text-red-200 underline text-xs">
                                  Open
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="border border-white/20 rounded overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900 border-b border-white/10 font-semibold">Recent Listings</div>
                <div className="max-h-[420px] overflow-auto">
                  {profile.recentListings.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">No listings yet.</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-950/80">
                        <tr className="text-left text-gray-400">
                          <th className="px-4 py-2">Inscription</th>
                          <th className="px-4 py-2">Price</th>
                          <th className="px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.recentListings.map((l) => (
                          <tr key={l.id} className="border-t border-white/10">
                            <td className="px-4 py-2 font-mono">{l.inscription_id.slice(0, 14)}...</td>
                            <td className="px-4 py-2 font-mono">{Number(l.price_sats || 0).toLocaleString()}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span>{l.status}</span>
                                {l.status === 'active' && (
                                  <button
                                    onClick={() => handleCancelListing(l.id)}
                                    disabled={busyListingId === l.id}
                                    className="px-2 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50"
                                  >
                                    {busyListingId === l.id ? '...' : 'Cancel'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="border border-white/20 rounded overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900 border-b border-white/10 font-semibold">Recent Sales</div>
                <div className="max-h-[420px] overflow-auto">
                  {profile.recentSales.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">No sales yet.</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-950/80">
                        <tr className="text-left text-gray-400">
                          <th className="px-4 py-2">Inscription</th>
                          <th className="px-4 py-2">Price</th>
                          <th className="px-4 py-2">TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.recentSales.map((s) => (
                          <tr key={s.id} className="border-t border-white/10">
                            <td className="px-4 py-2 font-mono">{s.inscription_id.slice(0, 14)}...</td>
                            <td className="px-4 py-2 font-mono">{Number(s.price_sats || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 font-mono text-xs">
                              {s.txid ? `${s.txid.slice(0, 10)}...` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

