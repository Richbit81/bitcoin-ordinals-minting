import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { PINK_PUPPETS_HASHLIST } from '../data/pinkPuppetsHashlist';
import { getMarketplaceWalletInscriptionsViaUnisat } from '../services/marketplaceService';

type PuppetListing = { seller: string; priceSats: number; listedAt: number };
type ListingsMap = Record<string, PuppetListing>;
const STORAGE_KEY = 'pinkpuppets_marketplace_v1';

const formatSats = (value: number) => new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(value)));
const shortAddress = (value: string) => (value.length > 14 ? `${value.slice(0, 7)}...${value.slice(-5)}` : value || '-');
const formatDateTime = (value?: number) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const normalizeAddress = (addr: string) => String(addr || '').trim().toLowerCase();
const buildRarityMap = () => {
  const freq = new Map<string, number>();
  for (const item of PINK_PUPPETS_HASHLIST) {
    for (const attr of item.attributes) {
      const key = `${attr.trait_type}::${attr.value}`;
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  const scoreById = new Map<string, number>();
  for (const item of PINK_PUPPETS_HASHLIST) {
    let score = 0;
    for (const attr of item.attributes) {
      const key = `${attr.trait_type}::${attr.value}`;
      const count = Math.max(1, Number(freq.get(key) || 1));
      score += 1 / count;
    }
    scoreById.set(item.inscriptionId, Number((score * 1000).toFixed(2)));
  }
  return scoreById;
};

export const PinkPuppetsMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [listings, setListings] = React.useState<ListingsMap>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [listPrice, setListPrice] = React.useState('10000');
  const [search, setSearch] = React.useState('');
  const [myOnly, setMyOnly] = React.useState(false);
  const [ownedIds, setOwnedIds] = React.useState<Set<string>>(new Set());
  const [loadingOwned, setLoadingOwned] = React.useState(false);
  const [ownershipError, setOwnershipError] = React.useState<string | null>(null);
  const rarityScores = React.useMemo(() => buildRarityMap(), []);

  const walletAddr = String(walletState.accounts?.[0]?.address || '').trim();
  const walletAddrNorm = normalizeAddress(walletAddr);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setListings(parsed as ListingsMap);
    } catch {
      // ignore
    }
  }, []);

  const persistListings = React.useCallback((next: ListingsMap) => {
    setListings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!walletState.connected || !Array.isArray(walletState.accounts) || walletState.accounts.length === 0) {
        setOwnedIds(new Set());
        setLoadingOwned(false);
        setOwnershipError(null);
        return;
      }
      setLoadingOwned(true);
      setOwnershipError(null);
      try {
        const addresses = walletState.accounts
          .map((acc) => String(acc?.address || '').trim())
          .filter(Boolean);
        const uniqAddresses = Array.from(new Set(addresses));
        const allWalletIds = new Set<string>();
        for (const address of uniqAddresses) {
          const rows = await getMarketplaceWalletInscriptionsViaUnisat(address).catch(() => []);
          for (const row of rows) {
            const inscriptionId = String(row?.inscription_id || '').trim();
            if (inscriptionId) allWalletIds.add(inscriptionId);
          }
        }
        const hashlistIdSet = new Set(PINK_PUPPETS_HASHLIST.map((item) => item.inscriptionId));
        const nextOwned = new Set<string>();
        for (const id of allWalletIds) {
          if (hashlistIdSet.has(id)) nextOwned.add(id);
        }
        if (!cancelled) setOwnedIds(nextOwned);
      } catch (err: any) {
        if (!cancelled) setOwnershipError(err?.message || 'Could not load wallet puppets');
      } finally {
        if (!cancelled) setLoadingOwned(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [walletState.connected, walletState.accounts]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return PINK_PUPPETS_HASHLIST.filter((item) => {
      if (myOnly && !ownedIds.has(item.inscriptionId)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.inscriptionId.toLowerCase().includes(q);
    }).map((item, idx) => {
      const listing = listings[item.inscriptionId] || null;
      const isOwnedByConnectedWallet = ownedIds.has(item.inscriptionId);
      return { ...item, listing, displayIndex: idx + 1, rarityScore: rarityScores.get(item.inscriptionId) || 0, isOwnedByConnectedWallet };
    });
  }, [listings, myOnly, ownedIds, rarityScores, search]);

  const activeListingsCount = rows.filter((row) => !!row.listing).length;
  const floor = rows.reduce((min, row) => {
    const p = Number(row.listing?.priceSats || 0);
    if (!p) return min;
    return min <= 0 ? p : Math.min(min, p);
  }, 0);

  const selected = rows.find((row) => row.inscriptionId === selectedId) || null;

  const handleList = () => {
    if (!selected || !walletAddrNorm) return;
    if (!selected.isOwnedByConnectedWallet) return;
    const price = Number(listPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    const next: ListingsMap = {
      ...listings,
      [selected.inscriptionId]: { seller: walletAddrNorm, priceSats: Math.floor(price), listedAt: Date.now() },
    };
    persistListings(next);
  };

  const handleDelist = () => {
    if (!selected?.listing || !walletAddrNorm) return;
    if (normalizeAddress(selected.listing.seller) !== walletAddrNorm) return;
    const next = { ...listings };
    delete next[selected.inscriptionId];
    persistListings(next);
  };

  const handleBuy = () => {
    if (!selected?.listing || !walletAddrNorm) return;
    if (normalizeAddress(selected.listing.seller) === walletAddrNorm) return;
    const next = { ...listings };
    delete next[selected.inscriptionId];
    persistListings(next);
  };

  return (
    <div className="min-h-screen bg-[#1a001a] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 8px 8px, #ff4fcf 2px, transparent 0), radial-gradient(circle at 24px 24px, #ff9de8 2px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate('/pinkpuppets')} className="rounded-lg border border-pink-300/70 bg-black/35 px-3 py-2 text-sm text-pink-100 hover:bg-pink-900/30">← Back to PinkPuppets</button>
          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Items: <b>{rows.length}</b></span>
            <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Listed: <b>{activeListingsCount}</b></span>
            <span className="rounded-full border border-pink-300/60 bg-black/35 px-3 py-1">Floor: <b>{floor > 0 ? `${formatSats(floor)} sats` : '-'}</b></span>
            <button
              onClick={() => setMyOnly((v) => !v)}
              className={`rounded-full border px-3 py-1 font-semibold ${myOnly ? 'border-pink-200 bg-pink-500/30 text-pink-50' : 'border-pink-300/60 bg-black/35 text-pink-100'}`}
            >
              My Puppets {walletState.connected ? `(${ownedIds.size})` : ''}
            </button>
          </div>
        </div>

        <div className="mb-3 flex w-full items-center gap-4">
          <div className="w-full max-w-[320px] overflow-hidden rounded-lg border border-pink-300/60 bg-black/35">
            <img src="/images/pinkpuppets-banner.png" alt="PinkPuppets Logo" className="h-auto w-full object-cover" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#ffd0f2]" style={{ textShadow: '2px 2px 0 #000' }}>
            PuppetMarket
          </h1>
        </div>

        <div className="mt-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or inscription id..." className="w-full rounded-lg border border-pink-300/70 bg-black/45 px-3 py-2 text-sm outline-none placeholder:text-pink-200/50" />
        </div>
        {walletState.connected && loadingOwned && (
          <div className="mt-2 text-xs text-pink-100/80">Loading your wallet puppets...</div>
        )}
        {walletState.connected && ownershipError && (
          <div className="mt-2 text-xs text-red-200">Ownership check failed: {ownershipError}</div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {rows.map((row) => {
            const contentUrl = `https://ordinals.com/content/${encodeURIComponent(row.inscriptionId)}`;
            const ownerAddress = row.isOwnedByConnectedWallet && walletAddr ? walletAddr : row.listing?.seller || '';
            return (
              <article key={row.inscriptionId} className="rounded-xl border-2 border-pink-300/70 bg-black/40 p-2">
                <button onClick={() => setSelectedId(row.inscriptionId)} className="aspect-square w-full overflow-hidden rounded-lg border border-pink-300/60 bg-[#140014] text-left">
                  <img src={contentUrl} title={row.name} alt={row.name} className="h-full w-full object-contain p-0.5" loading="lazy" />
                </button>
                <h3 className="mt-2 line-clamp-2 text-[11px] font-semibold text-pink-100">{row.name}</h3>
                <p className="mt-1 text-[10px] text-pink-200/80">Rarity: <b>{row.rarityScore.toFixed(2)}</b></p>
                <p className="mt-1 text-[10px] text-pink-200/60">{row.inscriptionId.slice(0, 10)}...{row.inscriptionId.slice(-4)}</p>
                <p className="mt-1 text-[10px] text-pink-200/70">Owner: <b>{ownerAddress ? shortAddress(ownerAddress) : '-'}</b></p>
                <div className="mt-2 text-[10px]">
                  {row.listing ? (
                    <div className="rounded-md border border-pink-300/50 bg-pink-900/20 p-2">
                      <div className="flex justify-between"><span>Price</span><b>{formatSats(row.listing.priceSats)} sats</b></div>
                      <div className="flex justify-between"><span>Seller</span><span>{shortAddress(row.listing.seller)}</span></div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-pink-300/30 bg-black/30 p-2 text-pink-200/70">Not listed</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedId(null)}>
            <div className="w-full max-w-2xl rounded-xl border-2 border-pink-300 bg-[#2a002a] p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-pink-100">{selected.name}</h2>
                  <p className="text-xs text-pink-200/70">{selected.inscriptionId}</p>
                </div>
                <button className="rounded border border-pink-300/60 px-2 py-1 text-xs" onClick={() => setSelectedId(null)}>Close</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="aspect-square overflow-hidden rounded-lg border border-pink-300/60 bg-[#140014]">
                  <img
                    src={`https://ordinals.com/content/${encodeURIComponent(selected.inscriptionId)}`}
                    title={selected.name}
                    alt={selected.name}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                    <p className="mb-2 text-pink-100 font-semibold">Details</p>
                    <div className="space-y-1 text-xs text-pink-100/90">
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Collection</span>
                        <span>PinkPuppets</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Item ID</span>
                        <span>{selected.displayIndex}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Status</span>
                        <span>{selected.listing ? 'Listed' : 'Not listed'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Owner</span>
                        <span>{selected.isOwnedByConnectedWallet && walletAddr ? shortAddress(walletAddr) : selected.listing?.seller ? shortAddress(selected.listing.seller) : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Seller</span>
                        <span>{selected.listing?.seller ? shortAddress(selected.listing.seller) : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Price</span>
                        <span>{selected.listing ? `${formatSats(selected.listing.priceSats)} sats` : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-pink-200/70">Listed At</span>
                        <span>{selected.listing ? formatDateTime(selected.listing.listedAt) : '-'}</span>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-pink-300/30 bg-black/40 p-2">
                      <p className="text-[10px] text-pink-200/70">Inscription ID</p>
                      <p className="mt-1 break-all text-[11px] text-pink-100">{selected.inscriptionId}</p>
                    </div>
                    <div className="mt-2 rounded border border-pink-300/30 bg-black/40 p-2">
                      <p className="text-[10px] text-pink-200/70">Owner Address</p>
                      <p className="mt-1 break-all text-[11px] text-pink-100">{selected.isOwnedByConnectedWallet && walletAddr ? walletAddr : selected.listing?.seller || '-'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                    <p>Rarity Score: <b>{selected.rarityScore.toFixed(2)}</b></p>
                    <p className="mt-1">Traits:</p>
                    <ul className="mt-1 space-y-1 text-xs text-pink-100/85">
                      {selected.attributes.map((attr, i) => (
                        <li key={`${attr.trait_type}-${attr.value}-${i}`}>{attr.trait_type}: <b>{attr.value}</b></li>
                      ))}
                    </ul>
                  </div>

                  {!walletState.connected && (
                    <div className="rounded-lg border border-yellow-300/60 bg-yellow-900/20 p-3 text-xs text-yellow-100">
                      Connect wallet to list or buy.
                    </div>
                  )}

                  {walletState.connected && (
                    <div className="space-y-2 rounded-lg border border-pink-300/50 bg-black/30 p-3 text-sm">
                      {selected.listing ? (
                        <>
                          <p>Listed at <b>{formatSats(selected.listing.priceSats)} sats</b></p>
                          <p className="text-xs text-pink-200/70">Seller: {shortAddress(selected.listing.seller)}</p>
                          {normalizeAddress(selected.listing.seller) === walletAddrNorm ? (
                            <button onClick={handleDelist} className="w-full rounded border-2 border-black bg-pink-300 px-3 py-2 text-xs font-bold text-black">Delist</button>
                          ) : (
                            <button onClick={handleBuy} className="w-full rounded border-2 border-black bg-[#ff4fcf] px-3 py-2 text-xs font-bold text-black">Buy Now</button>
                          )}
                        </>
                      ) : (
                        selected.isOwnedByConnectedWallet ? (
                          <>
                            <label className="text-xs">List price (sats)</label>
                            <input value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full rounded border border-pink-300/50 bg-black/50 px-2 py-1 text-sm" />
                            <button onClick={handleList} className="w-full rounded border-2 border-black bg-[#ff4fcf] px-3 py-2 text-xs font-bold text-black">List Item</button>
                          </>
                        ) : (
                          <div className="rounded border border-yellow-300/60 bg-yellow-900/20 px-2 py-2 text-xs text-yellow-100">
                            Listing only possible for puppets owned by your connected wallet.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

