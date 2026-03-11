import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  getMarketplaceCollections,
  getMarketplaceCollectionInscriptions,
  getMarketplaceWalletInscriptionsViaUnisat,
} from '../services/marketplaceService';

const CATTACK_URL = 'https://character-test-nine.vercel.app/?ws=wss://catwar-server-production.up.railway.app';
const BAD_CATS_SLUG_FALLBACKS = ['bad-cats', 'badcats'];
const BAD_CATS_COLLECTION_PAGE_LIMIT = 200;
const TEMP_DISABLE_BAD_CATS_GATE = true;

const getBadCatsAllowlist = async (): Promise<{
  ids: Set<string>;
  owners: Set<string>;
  slug: string;
}> => {
  const collections = await getMarketplaceCollections({ limit: 250, offset: 0 });
  const candidate =
    collections.find((c) => /bad\s*cats/i.test(String(c?.name || ''))) ||
    collections.find((c) => BAD_CATS_SLUG_FALLBACKS.includes(String(c?.slug || '').trim().toLowerCase()));
  const slug = String(candidate?.slug || BAD_CATS_SLUG_FALLBACKS[0]).trim().toLowerCase();

  const ids = new Set<string>();
  const owners = new Set<string>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  let guard = 0;

  while (offset < total && guard < 20) {
    const page = await getMarketplaceCollectionInscriptions({
      collectionSlug: slug,
      limit: BAD_CATS_COLLECTION_PAGE_LIMIT,
      offset,
    });
    total = Number(page?.total || 0);
    const rows = Array.isArray(page?.inscriptions) ? page.inscriptions : [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const id = String(row?.inscription_id || '').trim();
      if (id) ids.add(id);
      const owner = String(row?.owner_address || '').trim().toLowerCase();
      if (owner) owners.add(owner);
    }

    offset += rows.length;
    guard += 1;
  }

  return { ids, owners, slug };
};

export const CatWarPage: React.FC = () => {
  const { walletState } = useWallet();
  const [checkingAccess, setCheckingAccess] = React.useState(false);
  const [hasAccess, setHasAccess] = React.useState(false);
  const [allowlistCount, setAllowlistCount] = React.useState(0);
  const [walletCount, setWalletCount] = React.useState(0);
  const [accessError, setAccessError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (TEMP_DISABLE_BAD_CATS_GATE) {
        setHasAccess(true);
        setCheckingAccess(false);
        setAccessError(null);
        setAllowlistCount(0);
        setWalletCount(0);
        return;
      }
      if (!walletState.connected) {
        setHasAccess(false);
        setCheckingAccess(false);
        setAccessError(null);
        setWalletCount(0);
        return;
      }
      setCheckingAccess(true);
      setAccessError(null);
      try {
        const allowlist = await getBadCatsAllowlist();
        if (cancelled) return;
        setAllowlistCount(allowlist.ids.size);
        if (allowlist.ids.size === 0) {
          setHasAccess(false);
          setAccessError(`Bad Cats allowlist is empty (collection: ${allowlist.slug}).`);
          return;
        }

        const accountAddresses = (walletState.accounts || [])
          .map((acc) => String(acc?.address || '').trim())
          .filter(Boolean);
        const preferred = accountAddresses.filter((addr) => addr.startsWith('bc1p'));
        const addresses = preferred.length > 0 ? preferred : accountAddresses;

        const walletIds = new Set<string>();
        for (const addr of addresses) {
          const rows = await getMarketplaceWalletInscriptionsViaUnisat(addr);
          for (const row of rows) {
            const id = String(row?.inscription_id || '').trim();
            if (id) walletIds.add(id);
          }
        }
        if (cancelled) return;
        setWalletCount(walletIds.size);
        let allowed = false;
        for (const id of walletIds) {
          if (allowlist.ids.has(id)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          const lowerAddresses = new Set(addresses.map((a) => a.toLowerCase()));
          for (const owner of allowlist.owners) {
            if (lowerAddresses.has(owner)) {
              allowed = true;
              break;
            }
          }
        }
        setHasAccess(allowed);
        if (!allowed) {
          setAccessError('Access denied: no Bad Cats inscription found in connected wallet.');
        }
      } catch (err: any) {
        if (cancelled) return;
        setHasAccess(false);
        setAccessError(err?.message || 'Unable to verify Bad Cats ownership.');
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    };
    void run();
    if (TEMP_DISABLE_BAD_CATS_GATE) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => {
      setRefreshTick((v) => v + 1);
    }, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [walletState.connected, walletState.accounts, refreshTick]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6 pt-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <img
            src="/images/cattack-logo.png"
            alt="CATTACK"
            className="h-10 md:h-12 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <button
            onClick={() => setRefreshTick((v) => v + 1)}
            disabled={TEMP_DISABLE_BAD_CATS_GATE}
            className="px-3 py-1.5 text-xs rounded border border-red-700/70 hover:bg-red-900/40 transition"
            type="button"
          >
            {TEMP_DISABLE_BAD_CATS_GATE ? 'Access Check Disabled' : 'Recheck Access'}
          </button>
        </div>

        {TEMP_DISABLE_BAD_CATS_GATE ? (
          <div className="space-y-3">
            <div className="text-xs text-yellow-300">
              Access verification is temporarily disabled.
            </div>
            <div className="w-full h-[78vh] rounded-lg overflow-hidden border border-red-900/60 bg-black">
              <iframe
                src={CATTACK_URL}
                title="CATTACK"
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
              />
            </div>
          </div>
        ) : !walletState.connected ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-800/60 bg-black/60 p-4 text-sm text-gray-300">
              CATTACK is holder-gated. Connect a wallet that owns at least one Bad Cats inscription.
            </div>
            <WalletConnect />
          </div>
        ) : checkingAccess ? (
          <div className="rounded-lg border border-red-800/60 bg-black/60 p-6 text-center text-gray-300">
            Verifying Bad Cats ownership...
          </div>
        ) : hasAccess ? (
          <div className="space-y-3">
            <div className="text-xs text-green-400">
              Access granted. Allowlist: {allowlistCount} IDs, wallet scanned: {walletCount} inscriptions.
            </div>
            <div className="w-full h-[78vh] rounded-lg overflow-hidden border border-red-900/60 bg-black">
              <iframe
                src={CATTACK_URL}
                title="CATTACK"
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-red-800/60 bg-black/60 p-4">
            <p className="text-red-400 text-sm font-semibold mb-2">Access blocked</p>
            <p className="text-gray-300 text-sm">{accessError || 'Bad Cats ownership check failed.'}</p>
            <p className="text-gray-500 text-xs mt-2">
              Dynamic allowlist active: new minted Bad Cats are included automatically after backend sync.
            </p>
          </div>
        )}
      </div>
      <div className="fixed bottom-2 left-0 right-0 text-center text-[11px] tracking-[0.18em] text-white/45 pointer-events-none">
        BETA
      </div>
    </div>
  );
};
