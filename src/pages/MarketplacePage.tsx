import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  acceptMarketplaceOffer,
  cancelMarketplaceListing,
  completeMarketplaceOfferSale,
  completeMarketplacePurchaseAdvanced,
  createMarketplaceOffer,
  finalizeMarketplaceListingPsbt,
  getMarketplaceCollectionInscriptions,
  declineMarketplaceOffer,
  getMarketplaceCollections,
  getMarketplaceInscriptionDetail,
  getMarketplaceListings,
  prepareMarketplacePurchaseAdvanced,
  prepareMarketplaceListingPsbt,
  getMarketplaceProfile,
  getMarketplaceWalletInscriptionsByCollectionScan,
  getMarketplaceWalletInscriptionsViaUnisat,
  getMarketplaceRareSatsBatch,
  getMarketplaceRanking,
  MarketplaceCollection,
  MarketplaceCollectionInscription,
  MarketplaceCollectionRanking,
  MarketplaceInscriptionDetail,
  MarketplaceListing,
} from '../services/marketplaceService';
import { connectXverse, getOrdinalAddress, getPaymentAddress, signPSBT } from '../utils/wallet';
import { isAdminAddress } from '../config/admin';

const API_URL = String(import.meta.env.VITE_INSCRIPTION_API_URL || 'https://api.richart.app').replace(/\/+$/, '');
const ORD_SERVER_URL = String(import.meta.env.VITE_ORD_SERVER_URL || 'https://api.richart.app').replace(/\/+$/, '');
const COLLECTION_PAGE_SIZE = 80;
const INITIAL_LISTINGS_VISIBLE = 24;
const LISTINGS_LOAD_STEP = 24;
const INITIAL_ACTIVE_LISTINGS_LIMIT = 24;
const INITIAL_SOLD_LISTINGS_LIMIT = 8;
const FULL_ACTIVE_LISTINGS_LIMIT = 100;
const FULL_SOLD_LISTINGS_LIMIT = 20;
const MARKETPLACE_COLLECTIONS_CACHE_KEY = 'marketplaceCollectionsCacheV1';
const MARKETPLACE_COLLECTIONS_CACHE_TTL_MS = 60_000;
const MARKETPLACE_COLLECTION_TOTALS_CACHE_KEY = 'marketplaceCollectionTotalsCacheV1';
const MARKETPLACE_COLLECTION_TOTALS_CACHE_TTL_MS = 300_000;
const MARKETPLACE_LISTINGS_CACHE_KEY = 'marketplaceListingsCacheV1';
const MARKETPLACE_LISTINGS_CACHE_TTL_MS = 45_000;
const MARKETPLACE_RANKING_CACHE_KEY = 'marketplaceRankingCacheV1';
const MARKETPLACE_RANKING_CACHE_TTL_MS = 30_000;
const MARKETPLACE_WALLET_ROWS_CACHE_KEY_PREFIX = 'marketplaceWalletRowsV1:';
const MARKETPLACE_WALLET_ROWS_LAST_KEY = 'marketplaceWalletRowsLastV1';
const SATS_PER_BTC = 100_000_000;
const NAKAMOTO_SAT_MAX_EXCLUSIVE = 95_000_000_000_000;
const VINTAGE_SAT_MAX_EXCLUSIVE = 5_000_000_000_000;
const RARE_SAT_OVERRIDES_BY_INSCRIPTION: Record<string, string> = {
  '6efa80055d144fd67b477c828e4778e3c0582e0b6e728bb8f222c05b73ac3723i0': 'silk road',
};
const ordContentUrl = (id: string) => `${ORD_SERVER_URL}/content/${encodeURIComponent(String(id || '').trim())}`;
const ordPreviewUrl = (id: string) => `${ORD_SERVER_URL}/preview/${encodeURIComponent(String(id || '').trim())}`;
const ordinalsContentUrl = (id: string) => `https://ordinals.com/content/${encodeURIComponent(String(id || '').trim())}`;
const ordinalsPreviewUrl = (id: string) => `https://ordinals.com/preview/${encodeURIComponent(String(id || '').trim())}`;
const safeReadCache = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = window.sessionStorage.getItem(key);
    if (fromSession) return JSON.parse(fromSession) as T;
  } catch {}
  try {
    const fromLocal = window.localStorage.getItem(key);
    if (fromLocal) return JSON.parse(fromLocal) as T;
  } catch {}
  return null;
};
const safeWriteCache = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(key, serialized);
  } catch {}
  try {
    window.localStorage.setItem(key, serialized);
  } catch {}
};
const walletRowInscriptionId = (row: any): string =>
  String(row?.inscription_id || row?.inscriptionId || '').trim();
const walletRowCollectionSlug = (row: any): string =>
  String(row?.collection_slug || row?.collectionSlug || '').trim();
const readWalletPublicKeyFromEntry = (entry: any): string => {
  if (!entry || typeof entry !== 'object') return '';
  const candidates = [
    entry.publicKey,
    entry.publicKeyHex,
    entry.pubKey,
    entry.pubkey,
    entry.public_key,
    entry.paymentPublicKey,
    entry.paymentPublicKeyHex,
    entry.paymentPubkey,
    entry.ordinalsPublicKey,
    entry.addressPublicKey,
    entry.btcPublicKey,
    entry?.keys?.payment?.publicKey,
    entry?.keys?.payment?.publicKeyHex,
    entry?.keys?.ordinals?.publicKey,
    entry?.account?.publicKey,
  ];
  for (const value of candidates) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};
const readWalletRedeemScriptFromEntry = (entry: any): string => {
  if (!entry || typeof entry !== 'object') return '';
  const candidates = [
    entry.redeemScript,
    entry.redeem_script,
    entry.paymentRedeemScript,
    entry?.keys?.payment?.redeemScript,
    entry?.keys?.ordinals?.redeemScript,
    entry?.payment?.redeemScript,
  ];
  for (const value of candidates) {
    const normalized = String(value || '').trim().toLowerCase().replace(/^0x/i, '');
    if (normalized && /^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) return normalized;
  }
  return '';
};
const extractXverseAddressRows = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.addresses)) return payload.addresses;
  if (Array.isArray(payload?.addressses)) return payload.addressses;
  if (Array.isArray(payload?.result?.addresses)) return payload.result.addresses;
  if (Array.isArray(payload?.result?.addressses)) return payload.result.addressses;
  if (Array.isArray(payload?.data?.addresses)) return payload.data.addresses;
  if (Array.isArray(payload?.data?.addressses)) return payload.data.addressses;
  return [];
};
const extractXverseProviderAccounts = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.accounts)) return payload.accounts;
  if (Array.isArray(payload?.result?.accounts)) return payload.result.accounts;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.accounts)) return payload.data.accounts;
  return [];
};

const isPreviewDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search || '');
    return params.has('debugPreview') || import.meta.env.DEV;
  } catch {
    return false;
  }
};

const PreviewImage: React.FC<{
  inscriptionId: string;
  alt: string;
  className: string;
  imageClassName?: string;
  fit?: 'cover' | 'contain';
  preferredSources?: string[];
  lightweight?: boolean;
  preferIframe?: boolean;
}> = ({
  inscriptionId,
  alt,
  className,
  imageClassName = '',
  fit = 'cover',
  preferredSources = [],
  lightweight = false,
  preferIframe = false,
}) => {
  const encodedId = encodeURIComponent(inscriptionId);
  const blobUrlRef = useRef<string | null>(null);
  const [preprocessedSrc, setPreprocessedSrc] = useState<string | null>(null);
  const [recursiveSvgDoc, setRecursiveSvgDoc] = useState<string | null>(null);
  const [htmlPreviewDoc, setHtmlPreviewDoc] = useState<string | null>(null);
  const [docProbeRequested, setDocProbeRequested] = useState(false);
  const debugEnabled = useMemo(() => isPreviewDebugEnabled(), []);
  const apiImageUrl = `${API_URL}/api/inscription/image/${encodedId}${debugEnabled ? '?debug=1' : ''}`;
  const normalizedPreferred = (preferredSources || [])
    .map((src) => String(src || '').trim())
    .filter(Boolean);
  const imageSources = Array.from(
    new Set(
      (lightweight
        ? [...normalizedPreferred, ordinalsPreviewUrl(inscriptionId), apiImageUrl]
        : [
            preprocessedSrc,
            ...normalizedPreferred,
            apiImageUrl,
            ordContentUrl(inscriptionId),
            ordinalsPreviewUrl(inscriptionId),
            ordinalsContentUrl(inscriptionId),
          ]
      ).filter(Boolean) as string[]
    )
  );
  const [loaded, setLoaded] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [iframeFallback, setIframeFallback] = useState(false);
  const [iframeFallbackUsePreview, setIframeFallbackUsePreview] = useState(false);
  const currentSrc = imageSources[sourceIndex];
  const noPreviewAvailable = sourceIndex >= imageSources.length && !iframeFallback;
  const debugLog = (...args: any[]) => {
    if (!debugEnabled) return;
    console.log('[MarketplacePreview]', inscriptionId, ...args);
  };

  useEffect(() => {
    setLoaded(false);
    setSourceIndex(0);
    setPreprocessedSrc(null);
    setRecursiveSvgDoc(null);
    setHtmlPreviewDoc(null);
    setDocProbeRequested(preferIframe && !lightweight);
    setIframeFallback(preferIframe && !lightweight);
    setIframeFallbackUsePreview(false);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    debugLog('reset', { imageSources });
  }, [inscriptionId, preferIframe, lightweight]);

  useEffect(() => {
    if (lightweight) return;
    if (!docProbeRequested) return;
    let cancelled = false;
    const controller = new AbortController();

    const getContentBaseUrl = (src: string): string => {
      try {
        return new URL(src).origin;
      } catch {
        return ORD_SERVER_URL;
      }
    };
    const normalizeRecursiveSvg = (svgRaw: string, contentBaseUrl: string): string => {
      let svg = svgRaw;
      svg = svg.replace(/(xlink:href|href|src)=["']\/content\//gi, `$1="${contentBaseUrl}/content/`);
      svg = svg.replace(/url\((["']?)\/content\//gi, `url($1${contentBaseUrl}/content/`);
      // Some recursive SVGs omit image dimensions; force full-canvas defaults for stability.
      svg = svg.replace(/<image(?![^>]*\swidth=)(?![^>]*\sheight=)\s/gi, '<image width="1000" height="1000" ');
      return svg;
    };
    const normalizeHtmlDoc = (htmlRaw: string, contentBaseUrl: string): string => {
      let html = htmlRaw;
      html = html.replace(/(xlink:href|href|src)=["']\/content\//gi, `$1="${contentBaseUrl}/content/`);
      html = html.replace(/url\((["']?)\/content\//gi, `url($1${contentBaseUrl}/content/`);
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="${contentBaseUrl}/"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111}img,svg,canvas,video{max-width:100%;max-height:100%;object-fit:contain}*{box-sizing:border-box}</style>`
        );
      } else {
        html = `<head><base href="${contentBaseUrl}/"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111}img,svg,canvas,video{max-width:100%;max-height:100%;object-fit:contain}*{box-sizing:border-box}</style></head>${html}`;
      }
      return html;
    };

    const hydrateRecursiveSvg = async () => {
      // Avoid cross-origin CORS noise from API content endpoints here.
      // Direct ordinals.com content fetch works better for srcDoc probing.
      const sources = [ordinalsContentUrl(inscriptionId)];
      debugLog('preprocess-start', { sources });
      for (const src of sources) {
        try {
          const contentBaseUrl = getContentBaseUrl(src);
          debugLog('preprocess-try', { src });
          const res = await fetch(src, {
            method: 'GET',
            headers: { Accept: 'image/svg+xml,text/plain,*/*' },
            signal: controller.signal,
          });
          if (!res.ok) {
            debugLog('preprocess-skip-status', { src, status: res.status });
            continue;
          }
          const text = await res.text();
          const trimmed = text.trim();
          if (!trimmed.startsWith('<svg')) {
            const looksLikeHtml =
              /^<!doctype html/i.test(trimmed) ||
              /<html[\s>]/i.test(trimmed) ||
              /<body[\s>]/i.test(trimmed) ||
              /<script[\s>]/i.test(trimmed) ||
              /<div[\s>]/i.test(trimmed) ||
              /data-l=/i.test(trimmed);
            if (looksLikeHtml) {
              const normalizedHtml = normalizeHtmlDoc(trimmed, contentBaseUrl);
              setHtmlPreviewDoc(normalizedHtml);
              // Prefer srcDoc rendering for recursive HTML inscriptions.
              setIframeFallback(false);
              setSourceIndex(0);
              debugLog('preprocess-html-success', { src, length: normalizedHtml.length });
              return;
            }
            debugLog('preprocess-skip-not-svg', { src, length: trimmed.length });
            continue;
          }
          if (!trimmed.includes('/content/')) {
            debugLog('preprocess-skip-no-recursive-content', { src });
            continue;
          }
          const normalized = normalizeRecursiveSvg(trimmed, contentBaseUrl);
          // For recursive SVGs, iframe srcDoc rendering is more reliable than <img src=blob>.
          setRecursiveSvgDoc(normalized);
          const blob = new Blob([normalized], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = url;
          setPreprocessedSrc(url);
          setSourceIndex(0);
          debugLog('preprocess-success', { src, blobSize: blob.size });
          return;
        } catch {
          debugLog('preprocess-error', { src });
        }
      }
      debugLog('preprocess-no-result');
    };

    hydrateRecursiveSvg();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [encodedId, docProbeRequested, debugEnabled, lightweight]);

  useEffect(() => {
    if (!noPreviewAvailable) return;
    debugLog('all-sources-failed', { imageSources });
  }, [noPreviewAvailable, inscriptionId, imageSources.length]);

  useEffect(() => {
    if (lightweight) return;
    if (loaded || iframeFallback || noPreviewAvailable) return;
    if (!currentSrc) return;
    const timeoutMs = 3500;
    const timer = window.setTimeout(() => {
      setLoaded(false);
      setSourceIndex((prev) => {
        const next = prev + 1;
        if (next >= imageSources.length) {
          setIframeFallback(true);
        }
        debugLog('img-load-timeout-next-source', { currentSrc, prev, next, timeoutMs });
        return next;
      });
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [loaded, iframeFallback, noPreviewAvailable, currentSrc, imageSources.length, lightweight]);

  useEffect(() => {
    if (lightweight) return;
    if (!iframeFallback || loaded || noPreviewAvailable || iframeFallbackUsePreview) return;
    // Keep collection cards responsive: switch to preview endpoint quickly when content stalls.
    const timeoutMs = 2500;
    const timer = window.setTimeout(() => {
      setIframeFallbackUsePreview(true);
      debugLog('iframe-fallback-switch-to-preview', { timeoutMs, inscriptionId });
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [iframeFallback, loaded, noPreviewAvailable, inscriptionId, iframeFallbackUsePreview, lightweight]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && !noPreviewAvailable && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      {!lightweight && recursiveSvgDoc ? (
        <iframe
          title={alt}
          srcDoc={recursiveSvgDoc}
          loading="lazy"
          className="h-full w-full border-0 bg-zinc-900"
          scrolling="no"
          onLoad={() => {
            setLoaded(true);
            debugLog('iframe-srcdoc-load-success');
          }}
        />
      ) : !lightweight && htmlPreviewDoc ? (
        <iframe
          title={alt}
          srcDoc={htmlPreviewDoc}
          loading="lazy"
          className="h-full w-full border-0 bg-zinc-900"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            setLoaded(true);
            debugLog('iframe-html-srcdoc-load-success');
          }}
        />
      ) : !lightweight && iframeFallback ? (
        <div className="absolute inset-0 overflow-hidden bg-zinc-900">
          <iframe
            title={alt}
            src={iframeFallbackUsePreview ? ordinalsPreviewUrl(inscriptionId) : ordinalsContentUrl(inscriptionId)}
            loading="lazy"
            scrolling="no"
            className="absolute border-0 bg-zinc-900"
            sandbox="allow-scripts allow-same-origin"
            style={{
              width: preferIframe ? '100%' : '170%',
              height: preferIframe ? '100%' : '170%',
              transform: preferIframe ? 'none' : 'translate(-20%, -20%) scale(0.6)',
              transformOrigin: preferIframe ? 'center center' : 'top left',
            }}
            onLoad={() => {
              setLoaded(true);
              debugLog('iframe-preview-load-success');
            }}
          />
        </div>
      ) : noPreviewAvailable ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-gray-500 text-xs px-2 text-center">
          Preview unavailable
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            setLoaded(true);
            // Some recursive ordinals "load" in <img> but still render blank.
            // Trigger doc probing only for suspiciously blank image loads.
            const img = e.currentTarget;
            const maybeBlank = !img || img.naturalWidth <= 1 || img.naturalHeight <= 1;
            if (!lightweight && maybeBlank && !docProbeRequested) {
              setDocProbeRequested(true);
            }
            debugLog('img-load-success', { currentSrc, sourceIndex });
          }}
          onError={() => {
            setLoaded(false);
            setSourceIndex((prev) => {
              const next = prev + 1;
              if (!lightweight && next >= imageSources.length) {
                // Always use iframe preview fallback after image sources are exhausted.
                setIframeFallback(true);
                if (!docProbeRequested) {
                  setDocProbeRequested(true);
                }
              }
              debugLog('img-load-error-next-source', { currentSrc, prev, next });
              return next;
            });
          }}
          className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${imageClassName} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        />
      )}
    </div>
  );
};

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { walletState } = useWallet();
  const [ranking, setRanking] = useState<MarketplaceCollectionRanking[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [soldListings, setSoldListings] = useState<MarketplaceListing[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [walletConnectModalOpen, setWalletConnectModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'latest' | 'price-asc' | 'price-desc'>('latest');
  const [visibleListingsCount, setVisibleListingsCount] = useState(INITIAL_LISTINGS_VISIBLE);
  const [selectedTraitFilters, setSelectedTraitFilters] = useState<Record<string, string[]>>({});
  const [collectionsMeta, setCollectionsMeta] = useState<MarketplaceCollection[]>([]);
  const [collectionTotalsBySlug, setCollectionTotalsBySlug] = useState<Record<string, number>>({});
  const [myItemCollectionSlugs, setMyItemCollectionSlugs] = useState<string[]>([]);
  const [myWalletInscriptionIds, setMyWalletInscriptionIds] = useState<Set<string>>(new Set());
  const [myCollectionsLoading, setMyCollectionsLoading] = useState(false);
  const [myItemsDebug, setMyItemsDebug] = useState<{
    source: string;
    rows: number;
    ids: number;
    slugs: number;
    error?: string;
  }>({ source: 'idle', rows: 0, ids: 0, slugs: 0 });
  const [collectionViewMode, setCollectionViewMode] = useState<'all' | 'my-items'>('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInscriptionDetail, setSelectedInscriptionDetail] = useState<MarketplaceInscriptionDetail | null>(null);
  const [selectedDetailListing, setSelectedDetailListing] = useState<MarketplaceListing | null>(null);
  const [detailListPriceSats, setDetailListPriceSats] = useState('10000');
  const [offerPriceSats, setOfferPriceSats] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerActionBusyId, setOfferActionBusyId] = useState<string | null>(null);
  const [offerTxids, setOfferTxids] = useState<Record<string, string>>({});
  const [offerCompleteBusyId, setOfferCompleteBusyId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'traits' | 'offers' | 'activity' | 'price' | 'details'>('traits');
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState('');
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionInscriptions, setCollectionInscriptions] = useState<MarketplaceCollectionInscription[]>([]);
  const [collectionRareSatsByInscription, setCollectionRareSatsByInscription] = useState<Record<string, string>>({});
  const [collectionActiveListingsByInscription, setCollectionActiveListingsByInscription] = useState<Record<string, MarketplaceListing>>({});
  const [listingRareSatsByInscription, setListingRareSatsByInscription] = useState<Record<string, string>>({});
  const [collectionInscriptionsTotal, setCollectionInscriptionsTotal] = useState(0);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionLoadingMore, setCollectionLoadingMore] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [showCollectionTraitFilters, setShowCollectionTraitFilters] = useState(false);
  const [collectionSelectedTraitFilters, setCollectionSelectedTraitFilters] = useState<Record<string, string[]>>({});
  const [collectionRarityFilter, setCollectionRarityFilter] = useState<'all' | 'mythic' | 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common'>('all');
  const [collectionItemsFilter, setCollectionItemsFilter] = useState<'all' | 'my-items'>('all');
  const [collectionSortMode, setCollectionSortMode] = useState<
    'price-asc' | 'price-desc' | 'rarity-desc' | 'rarity-asc' | 'name-asc' | 'name-desc' | 'score-desc' | 'score-asc'
  >('price-asc');
  const [selectedMyItemIds, setSelectedMyItemIds] = useState<Set<string>>(new Set());
  const [bulkListBasePriceSats, setBulkListBasePriceSats] = useState('10000');
  const [bulkListStepSats, setBulkListStepSats] = useState('1000');
  const [bulkListDirection, setBulkListDirection] = useState<'up' | 'down'>('up');
  const [bulkListRunning, setBulkListRunning] = useState(false);
  const rareSatsCacheRef = useRef<Record<string, string>>({});
  const listingsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const myItemsSlugHydrationKeyRef = useRef<string>('');
  const [form, setForm] = useState({
    inscriptionId: '',
    collectionSlug: '',
    priceSats: '10000',
  });
  const currentAddress = getOrdinalAddress(walletState.accounts || []);
  const isAdminWallet = useMemo(
    () => walletState.connected && !!currentAddress && isAdminAddress(currentAddress),
    [walletState.connected, currentAddress]
  );
  const paymentAddress = getPaymentAddress(walletState.accounts || []);
  const paymentPublicKey = useMemo(() => {
    const rows = walletState.accounts || [];
    const paymentByPurpose = rows.find((acc: any) => String(acc?.purpose || '').toLowerCase() === 'payment');
    const keyByPurpose = readWalletPublicKeyFromEntry(paymentByPurpose);
    if (keyByPurpose) {
      return keyByPurpose;
    }
    const paymentByAddress = rows.find((acc: any) => String(acc?.address || '').trim() === String(paymentAddress || '').trim());
    return readWalletPublicKeyFromEntry(paymentByAddress);
  }, [walletState.accounts, paymentAddress]);
  const ordinalsPublicKey = useMemo(() => {
    const rows = walletState.accounts || [];
    const ordByPurpose = rows.find((acc: any) => String(acc?.purpose || '').toLowerCase() === 'ordinals');
    const keyByPurpose = readWalletPublicKeyFromEntry(ordByPurpose);
    if (keyByPurpose) return keyByPurpose;
    const ordByAddress = rows.find((acc: any) => String(acc?.address || '').trim() === String(currentAddress || '').trim());
    return readWalletPublicKeyFromEntry(ordByAddress);
  }, [walletState.accounts, currentAddress]);
  const taprootAddress = useMemo(() => {
    const direct = String(currentAddress || '').trim().toLowerCase();
    if (direct.startsWith('bc1p')) return direct;
    const fromAccounts = (walletState.accounts || [])
      .map((acc) => String(acc?.address || '').trim().toLowerCase())
      .find((addr) => addr.startsWith('bc1p'));
    return fromAccounts || direct;
  }, [currentAddress, walletState.accounts]);
  const autoOpenKeyRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    const loadCollections = async () => {
      try {
        setCollectionsLoading(true);
        setError(null);
        if (typeof window !== 'undefined') {
          try {
            const parsed = safeReadCache<{ ts: number; data: MarketplaceCollection[] }>(MARKETPLACE_COLLECTIONS_CACHE_KEY);
            if (Array.isArray(parsed?.data) && Date.now() - Number(parsed?.ts || 0) < MARKETPLACE_COLLECTIONS_CACHE_TTL_MS) {
              setCollectionsMeta(parsed.data);
              setCollectionsLoading(false);
            }
          } catch {
            // Ignore malformed cache and continue with fresh fetch.
          }
        }
        const collectionsData = await getMarketplaceCollections({ includeInactive: false, adminAddress: currentAddress });
        if (cancelled) return;
        setCollectionsMeta(collectionsData);
        if (typeof window !== 'undefined') {
          try {
            // Keep cache payload compact to avoid Storage quota errors.
            const compactCollections = collectionsData.map((c) => ({
              slug: c.slug,
              name: c.name,
              symbol: c.symbol ?? null,
              cover_image: c.cover_image ?? null,
              verified: !!c.verified,
              source: c.source,
              source_ref: c.source_ref ?? null,
              active: c.active !== false,
              created_at: c.created_at,
              updated_at: c.updated_at,
            }));
            safeWriteCache(MARKETPLACE_COLLECTIONS_CACHE_KEY, { ts: Date.now(), data: compactCollections });
          } catch {
            // Storage quota exceeded - safe to skip cache write.
          }
        }
        // Totals nur teilweise und verzögert nachladen (sonst zu viele Requests beim Initial-Load).
        setTimeout(async () => {
          if (cancelled) return;
          try {
            const parsed = safeReadCache<{ ts: number; data: Record<string, number> }>(
              MARKETPLACE_COLLECTION_TOTALS_CACHE_KEY
            );
            if (parsed?.data && Date.now() - Number(parsed?.ts || 0) < MARKETPLACE_COLLECTION_TOTALS_CACHE_TTL_MS) {
              setCollectionTotalsBySlug(parsed.data);
              return;
            }
          } catch {
            // ignore malformed totals cache
          }

          const activeSlugs = collectionsData
            .filter((c) => c.active !== false)
            .map((c) => String(c.slug || '').trim())
            .filter(Boolean)
            .slice(0, 12);
          const nextTotals: Record<string, number> = {};
          const queue = [...activeSlugs];
          const workers = Array.from({ length: Math.min(3, queue.length) }).map(async () => {
            while (queue.length > 0) {
              const slug = queue.shift();
              if (!slug) return;
              try {
                const data = await getMarketplaceCollectionInscriptions({
                  collectionSlug: slug,
                  limit: 1,
                  offset: 0,
                });
                nextTotals[slug] = Number(data?.total || 0);
              } catch {
                // ignore per-slug total error
              }
            }
          });
          await Promise.allSettled(workers);
          if (!cancelled) {
            setCollectionTotalsBySlug(nextTotals);
            try {
              safeWriteCache(MARKETPLACE_COLLECTION_TOTALS_CACHE_KEY, { ts: Date.now(), data: nextTotals });
            } catch {
              // storage optional
            }
          }
        }, 1200);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load marketplace collections');
      } finally {
        if (!cancelled) setCollectionsLoading(false);
      }
    };
    loadCollections();
    return () => {
      cancelled = true;
    };
  }, [currentAddress]);

  useEffect(() => {
    let cancelled = false;
    const wantsMyItems = collectionViewMode === 'my-items' || collectionItemsFilter === 'my-items';
    const loadMyCollections = async () => {
      if (!wantsMyItems) {
        setMyCollectionsLoading(false);
        return;
      }
      if (!walletState.connected || !taprootAddress) {
        setMyCollectionsLoading(false);
        setMyItemCollectionSlugs([]);
        setMyWalletInscriptionIds(new Set());
        setMyItemsDebug({ source: 'inactive', rows: 0, ids: 0, slugs: 0 });
        return;
      }
      try {
        setMyCollectionsLoading(true);
        let walletRows: any[] = [];
        let source = 'none';
        if (typeof window !== 'undefined') {
          try {
            const cacheByAddress = window.sessionStorage.getItem(
              `${MARKETPLACE_WALLET_ROWS_CACHE_KEY_PREFIX}${taprootAddress.toLowerCase()}`
            );
            const cacheLast = window.sessionStorage.getItem(MARKETPLACE_WALLET_ROWS_LAST_KEY);
            const parsedByAddress = cacheByAddress ? (JSON.parse(cacheByAddress) as { ts: number; data: any[] }) : null;
            const parsedLast = cacheLast ? (JSON.parse(cacheLast) as { ts: number; address?: string; data: any[] }) : null;
            if (Array.isArray(parsedByAddress?.data) && parsedByAddress!.data.length > 0) {
              walletRows = parsedByAddress!.data;
              source = 'cache-address';
            } else if (
              Array.isArray(parsedLast?.data) &&
              parsedLast!.data.length > 0 &&
              String(parsedLast?.address || '').toLowerCase() === taprootAddress.toLowerCase()
            ) {
              walletRows = parsedLast!.data;
              source = 'cache-last';
            }
          } catch {
            // cache optional
          }
        }
        try {
          if (walletRows.length === 0) {
            const profile = await getMarketplaceProfile(taprootAddress);
            walletRows = profile.walletInscriptions || [];
            if (walletRows.length > 0) source = 'profile';
          }
        } catch {
          // profile endpoint unavailable
        }
        if (walletRows.length === 0) {
          try {
            walletRows = await getMarketplaceWalletInscriptionsViaUnisat(taprootAddress);
            if (walletRows.length > 0) source = 'unisat';
          } catch {
            // UniSat indexer unavailable or no rows
          }
        }
        if (walletRows.length === 0) {
          try {
            walletRows = await getMarketplaceWalletInscriptionsByCollectionScan(taprootAddress);
            if (walletRows.length > 0) source = 'collection-scan';
          } catch {
            // fallback optional
          }
        }
        if (walletRows.length === 0 && typeof window !== 'undefined') {
          try {
            const cacheKey = `${MARKETPLACE_WALLET_ROWS_CACHE_KEY_PREFIX}${taprootAddress.toLowerCase()}`;
            const raw = window.sessionStorage.getItem(cacheKey);
            if (raw) {
              const parsed = JSON.parse(raw) as { ts: number; data: any[] };
              if (Array.isArray(parsed?.data)) {
                walletRows = parsed.data;
              }
            }
          } catch {
            // cache optional
          }
        }
        if (cancelled) return;
        const slugs = Array.from(
          new Set(
            walletRows
              .map((ins) => walletRowCollectionSlug(ins))
              .filter(Boolean)
          )
        );
        const ids = new Set(
          walletRows
            .map((ins) => walletRowInscriptionId(ins))
            .filter(Boolean)
        );
        setMyItemCollectionSlugs(slugs);
        setMyWalletInscriptionIds(ids);
        setMyItemsDebug({
          source,
          rows: walletRows.length,
          ids: ids.size,
          slugs: slugs.length,
        });
        if (typeof window !== 'undefined' && walletRows.length > 0) {
          try {
            const cacheKey = `${MARKETPLACE_WALLET_ROWS_CACHE_KEY_PREFIX}${taprootAddress.toLowerCase()}`;
            window.sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ ts: Date.now(), data: walletRows })
            );
            window.sessionStorage.setItem(
              MARKETPLACE_WALLET_ROWS_LAST_KEY,
              JSON.stringify({ ts: Date.now(), address: taprootAddress.toLowerCase(), data: walletRows })
            );
          } catch {
            // storage optional
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = String(err?.message || 'load failed');
          setMyItemCollectionSlugs([]);
          setMyWalletInscriptionIds(new Set());
          setMyItemsDebug({ source: 'error', rows: 0, ids: 0, slugs: 0, error: msg });
        }
      } finally {
        if (!cancelled) setMyCollectionsLoading(false);
      }
    };
    loadMyCollections();
    return () => {
      cancelled = true;
    };
  }, [walletState.connected, taprootAddress, collectionViewMode, collectionItemsFilter]);

  useEffect(() => {
    if (collectionViewMode === 'my-items') {
      setCollectionItemsFilter('my-items');
    }
  }, [collectionViewMode]);

  useEffect(() => {
    if (collectionViewMode !== 'my-items') return;
    if (!walletState.connected || !taprootAddress) return;
    if (myWalletInscriptionIds.size === 0) return;
    if (myItemCollectionSlugs.length > 0) return;

    const hydrationKey = `${taprootAddress}:${myWalletInscriptionIds.size}`;
    if (myItemsSlugHydrationKeyRef.current === hydrationKey) return;
    myItemsSlugHydrationKeyRef.current = hydrationKey;

    let cancelled = false;
    const hydrateCollectionSlugs = async () => {
      const ids = Array.from(myWalletInscriptionIds).slice(0, 180);
      const foundSlugs = new Set<string>();
      const queue = [...ids];
      const workers = Array.from({ length: Math.min(8, queue.length) }).map(async () => {
        while (queue.length > 0 && !cancelled) {
          const inscriptionId = queue.shift();
          if (!inscriptionId) return;
          try {
            const detail = await getMarketplaceInscriptionDetail(inscriptionId);
            const slug = String(detail?.marketplaceInscription?.collection_slug || '').trim();
            if (slug) foundSlugs.add(slug);
          } catch {
            // ignore per-id failure
          }
        }
      });
      await Promise.allSettled(workers);
      if (!cancelled && foundSlugs.size > 0) {
        setMyItemCollectionSlugs(Array.from(foundSlugs));
      }
    };

    hydrateCollectionSlugs();
    return () => {
      cancelled = true;
    };
  }, [collectionViewMode, walletState.connected, taprootAddress, myWalletInscriptionIds, myItemCollectionSlugs.length]);

  useEffect(() => {
    let cancelled = false;
    const loadRanking = async () => {
      try {
        setRankingLoading(true);
        if (typeof window !== 'undefined') {
          try {
            const parsed = safeReadCache<{ ts: number; data: MarketplaceCollectionRanking[] }>(
              MARKETPLACE_RANKING_CACHE_KEY
            );
            if (Array.isArray(parsed?.data) && Date.now() - Number(parsed?.ts || 0) < MARKETPLACE_RANKING_CACHE_TTL_MS) {
              setRanking(parsed.data);
              setRankingLoading(false);
            }
          } catch {
            // cache optional
          }
        }
        const rankingData = await getMarketplaceRanking();
        if (!cancelled) {
          setRanking(rankingData);
          if (typeof window !== 'undefined') {
            try {
              safeWriteCache(MARKETPLACE_RANKING_CACHE_KEY, { ts: Date.now(), data: rankingData });
            } catch {
              // cache optional
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load ranking');
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    };
    const timer = window.setTimeout(loadRanking, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const loadListings = async (cancelCheck?: () => boolean) => {
    try {
      let hasImmediateData = false;
      let usedFreshCache = false;
      if (typeof window !== 'undefined') {
        try {
          const parsed = safeReadCache<{ ts: number; active: MarketplaceListing[]; sold: MarketplaceListing[] }>(
            MARKETPLACE_LISTINGS_CACHE_KEY
          );
          if (parsed) {
            const cacheAgeMs = Date.now() - Number(parsed?.ts || 0);
            if (Array.isArray(parsed?.active) && Array.isArray(parsed?.sold)) {
              setListings(parsed.active);
              setSoldListings(parsed.sold);
              setListingsLoading(false);
              hasImmediateData = true;
              usedFreshCache = cacheAgeMs < MARKETPLACE_LISTINGS_CACHE_TTL_MS;
            }
          }
        } catch {
          // cache optional
        }
      }
      if (!hasImmediateData) setListingsLoading(true);

      if (!usedFreshCache) {
        const activePromise = getMarketplaceListings({
          status: 'active',
          limit: INITIAL_ACTIVE_LISTINGS_LIMIT,
          lightweight: true,
        });
        const soldPromise = getMarketplaceListings({
          status: 'sold',
          limit: INITIAL_SOLD_LISTINGS_LIMIT,
          lightweight: true,
        });
        const initialActive = await activePromise;
        if (cancelCheck?.()) return;
        setListings(initialActive);
        setListingsLoading(false);
        const initialSold = await soldPromise;
        if (cancelCheck?.()) return;
        setSoldListings(initialSold);
      }

      // Vollständige Listen im Hintergrund nachladen (SWR).
      const [fullActive, fullSold] = await Promise.all([
        getMarketplaceListings({ status: 'active', limit: FULL_ACTIVE_LISTINGS_LIMIT, lightweight: true }),
        getMarketplaceListings({ status: 'sold', limit: FULL_SOLD_LISTINGS_LIMIT, lightweight: true }),
      ]);
      if (cancelCheck?.()) return;
      setListings(fullActive);
      setSoldListings(fullSold);
      if (typeof window !== 'undefined') {
        try {
          safeWriteCache(MARKETPLACE_LISTINGS_CACHE_KEY, {
            ts: Date.now(),
            active: fullActive,
            sold: fullSold,
          });
        } catch {
          // cache optional
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load listings');
    } finally {
      if (!cancelCheck?.()) setListingsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadListings(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const collectionSlug = String(params.get('collection') || '').trim();
    const inscriptionId = String(params.get('inscription') || '').trim();
    const key = `${collectionSlug}|${inscriptionId}`;
    if (!collectionSlug || key === autoOpenKeyRef.current) return;
    autoOpenKeyRef.current = key;
    const openFromQuery = async () => {
      await loadCollectionInscriptions(collectionSlug);
      if (inscriptionId) {
        await handleOpenInscriptionDetail(inscriptionId);
      }
    };
    openFromQuery();
  }, [location.search]);

  const syncDetailQuery = useCallback(
    (collectionSlug?: string, inscriptionId?: string) => {
      const params = new URLSearchParams(location.search || '');
      const normalizedCollection = String(collectionSlug || '').trim();
      const normalizedInscription = String(inscriptionId || '').trim();
      if (normalizedCollection) {
        params.set('collection', normalizedCollection);
      } else {
        params.delete('collection');
      }
      if (normalizedInscription) {
        params.set('inscription', normalizedInscription);
      } else {
        params.delete('inscription');
      }
      const nextSearchRaw = params.toString();
      const currentSearchRaw = String(location.search || '').replace(/^\?/, '');
      if (nextSearchRaw === currentSearchRaw) return;
      navigate(
        {
          pathname: '/marketplace',
          search: nextSearchRaw ? `?${nextSearchRaw}` : '',
        },
        { replace: true }
      );
    },
    [location.search, navigate]
  );

  const handleCreateListing = async () => {
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

      const listingPayload = {
        inscriptionId: form.inscriptionId.trim(),
        collectionSlug: form.collectionSlug.trim() || 'unknown',
        sellerAddress: currentAddress,
        sellerPaymentAddress: paymentAddress || currentAddress,
        sellerPublicKey: ordinalsPublicKey || undefined,
        buyerReceiveAddress: currentAddress,
        priceSats: Math.round(priceSats),
      };

      if (!walletState.walletType) throw new Error('Connect wallet first');
      const prepared = await prepareMarketplaceListingPsbt(listingPayload);
      if (!prepared?.psbtBase64 || !prepared?.listingId) {
        throw new Error('Listing PSBT preparation returned incomplete data');
      }
      const signedPsbtData = await signPSBT(
        prepared.psbtBase64,
        walletState.walletType,
        false,
        prepared.ownerAddress || currentAddress,
        0x82 // SIGHASH_NONE | ANYONECANPAY (buyer address replacement at buy-time)
      );
      const signedIsHex = /^[0-9a-fA-F]+$/.test(String(signedPsbtData || '').trim());
      await finalizeMarketplaceListingPsbt({
        listingId: prepared.listingId,
        walletAddress: currentAddress,
        signedPsbtHex: signedIsHex ? signedPsbtData : undefined,
        signedPsbtBase64: signedIsHex ? undefined : signedPsbtData,
      });

      setActionMessage('Listing created and signed via wallet PSBT.');
      setForm((prev) => ({ ...prev, inscriptionId: '' }));
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to create listing');
    }
  };

  const handleCancelListing = async (listingId: string) => {
    try {
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
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      if (!listing.signed_psbt_base64) {
        throw new Error('Legacy listing without PSBT data. Seller must relist with PSBT.');
      }
      // Persist open detail in URL so wallet popups/reloads do not drop context.
      syncDetailQuery(
        String(listing.collection_slug || selectedCollectionSlug || '').trim(),
        String(listing.inscription_id || '').trim()
      );
      await handleAdvancedBuyListing(listing);
    } catch (err: any) {
      setError(err?.message || 'Failed to buy listing');
    }
  };

  const handleAdvancedBuyListing = async (listing: MarketplaceListing) => {
    try {
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      if (!listing.signed_psbt_base64) {
        throw new Error('Listing has no signed PSBT data');
      }

      setBusyListingId(listing.id);
      setError(null);
      setActionMessage(null);

      let resolvedBuyerAddress = currentAddress;
      let resolvedFundingAddress = /^bc1[qp]/i.test(String(currentAddress || '').trim())
        ? currentAddress
        : paymentAddress || currentAddress;
      let resolvedFundingPublicKey = paymentPublicKey;
      const fundingPublicKeyCandidates = new Set<string>();
      const fundingPublicKeysByAddress = new Map<string, Set<string>>();
      const fundingRedeemScriptCandidates = new Set<string>();
      const addFundingPublicKeyCandidate = (value: string) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        fundingPublicKeyCandidates.add(normalized);
      };
      const addFundingPublicKeyForAddress = (address: string, value: string) => {
        const normalizedAddress = String(address || '').trim();
        const normalizedKey = String(value || '').trim();
        if (!normalizedAddress || !normalizedKey) return;
        const lower = normalizedAddress.toLowerCase();
        const existing = fundingPublicKeysByAddress.get(lower) || new Set<string>();
        existing.add(normalizedKey);
        fundingPublicKeysByAddress.set(lower, existing);
        addFundingPublicKeyCandidate(normalizedKey);
      };
      const addFundingRedeemScriptCandidate = (value: string) => {
        const normalized = String(value || '').trim().toLowerCase().replace(/^0x/i, '');
        if (!normalized || !/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) return;
        fundingRedeemScriptCandidates.add(normalized);
      };
      addFundingPublicKeyCandidate(paymentPublicKey);
      for (const account of walletState.accounts || []) {
        const accountAddress = String((account as any)?.address || '').trim();
        const accountPubKey = readWalletPublicKeyFromEntry(account);
        addFundingPublicKeyCandidate(accountPubKey);
        addFundingPublicKeyForAddress(accountAddress, accountPubKey);
        addFundingRedeemScriptCandidate(readWalletRedeemScriptFromEntry(account));
      }
      const applyXverseFundingCandidate = (rows: any[]) => {
        const list = Array.isArray(rows) ? rows : [];
        for (const row of list) {
          const rowAddress = String((row as any)?.address || '').trim();
          const rowPubKey = readWalletPublicKeyFromEntry(row);
          addFundingPublicKeyCandidate(rowPubKey);
          addFundingPublicKeyForAddress(rowAddress, rowPubKey);
          addFundingRedeemScriptCandidate(readWalletRedeemScriptFromEntry(row));
        }
        const ordinalsEntry =
          list.find((a: any) => String(a?.purpose || '').toLowerCase() === 'ordinals') ||
          list.find((a: any) => String(a?.address || '').trim().toLowerCase().startsWith('bc1p'));
        const fetchedBuyerAddress = String(ordinalsEntry?.address || '').trim();
        if (fetchedBuyerAddress) resolvedBuyerAddress = fetchedBuyerAddress;
        const paymentEntry =
          list.find((a: any) => String(a?.purpose || '').toLowerCase() === 'payment') ||
          list.find((a: any) => String(a?.addressType || '').toLowerCase() === 'p2sh') ||
          list.find((a: any) => String(a?.addressType || '').toLowerCase() === 'p2wpkh') ||
          list.find((a: any) => String(a?.address || '').trim() === String(paymentAddress || '').trim()) ||
          list.find((a: any) => !String(a?.address || '').trim().toLowerCase().startsWith('bc1p'));
        const fetchedPaymentAddress = String(paymentEntry?.address || '').trim();
        const fetchedPubKey = readWalletPublicKeyFromEntry(paymentEntry);
        if (fetchedPaymentAddress) resolvedFundingAddress = fetchedPaymentAddress;
        if (fetchedPubKey) {
          resolvedFundingPublicKey = fetchedPubKey;
          addFundingPublicKeyCandidate(fetchedPubKey);
        }
      };
      if (walletState.walletType === 'xverse') {
        try {
          const satsConnect: any = await import('sats-connect');
          if (satsConnect?.request) {
            // Prefer the dedicated getAddresses API. In Xverse this reliably carries payment publicKey.
            try {
              const addressesResponse = await satsConnect.request('getAddresses', {
                purposes: ['payment', 'ordinals'],
                message: 'Resolve payment key for marketplace purchase',
              });
              if (addressesResponse?.status === 'success') {
                const addresses = extractXverseAddressRows(addressesResponse);
                applyXverseFundingCandidate(addresses);
              }
            } catch {
              // Continue with compatibility fallbacks below.
            }
            const accountResponse = await satsConnect.request('wallet_getAccount', null);
            if (accountResponse?.status === 'success') {
              const addresses = extractXverseAddressRows(accountResponse);
              applyXverseFundingCandidate(addresses);
            }
            const stillMissingP2shPubkey =
              String(resolvedFundingAddress || '').startsWith('3') &&
              !String(resolvedFundingPublicKey || '').trim();
            if (stillMissingP2shPubkey) {
              const reconnectResponse = await satsConnect.request('wallet_connect', {
                addresses: ['payment', 'ordinals'],
                message: 'Marketplace purchase requires payment public key',
              });
              if (reconnectResponse?.status === 'success') {
                const addresses = extractXverseAddressRows(reconnectResponse);
                applyXverseFundingCandidate(addresses);
              }
            }
          }
          const xverseBitcoinProvider: any = (window as any)?.XverseProviders?.Bitcoin;
          if (xverseBitcoinProvider?.request) {
            const providerProbes: Array<{ method: string; params?: any }> = [
              { method: 'getAccounts', params: { purposes: ['payment', 'ordinals'] } },
              { method: 'getAccounts' },
            ];
            for (const probe of providerProbes) {
              try {
                const response = await xverseBitcoinProvider.request(probe.method, probe.params);
                const accounts = extractXverseProviderAccounts(response);
                if (accounts.length) {
                  applyXverseFundingCandidate(accounts);
                  break;
                }
              } catch {
                // ignore provider capability differences
              }
            }
          }
          const stillMissingP2shPubkey =
            String(resolvedFundingAddress || '').startsWith('3') &&
            !String(resolvedFundingPublicKey || '').trim();
          if (stillMissingP2shPubkey) {
            const refreshedAccounts = await connectXverse();
            applyXverseFundingCandidate(refreshedAccounts as any[]);
          }
          const stillMissingAfterReconnect =
            String(resolvedFundingAddress || '').startsWith('3') &&
            !String(resolvedFundingPublicKey || '').trim();
          if (stillMissingAfterReconnect) {
            const provider: any = (window as any).BitcoinProvider || (window as any).xverse;
            if (provider?.request) {
              const providerProbes: Array<{ method: string; params: any }> = [
                { method: 'wallet_getAccount', params: null },
                { method: 'getAddresses', params: { purposes: ['payment', 'ordinals'], message: 'Resolve payment key for marketplace purchase' } },
                { method: 'getAccounts', params: null },
              ];
              for (const probe of providerProbes) {
                if (!String(resolvedFundingAddress || '').startsWith('3') || String(resolvedFundingPublicKey || '').trim()) break;
                try {
                  const response = await provider.request(probe.method, probe.params);
                  const rows = extractXverseAddressRows(response);
                  if (rows.length) applyXverseFundingCandidate(rows);
                } catch {
                  // Ignore provider-specific method mismatch and continue probing.
                }
              }
            }
          }
        } catch {
          // Keep existing wallet-state key fallback.
        }
      }
      const pickPreferredFundingAddress = () => {
        const candidates = [
          resolvedBuyerAddress,
          taprootAddress,
          currentAddress,
          ...(walletState.accounts || []).map((acc: any) => String(acc?.address || '').trim()),
          resolvedFundingAddress,
          paymentAddress,
        ]
          .map((addr) => String(addr || '').trim())
          .filter(Boolean);
        const preferred = candidates.find((addr) => /^bc1[qp]/i.test(addr));
        return preferred || resolvedFundingAddress;
      };
      resolvedFundingAddress = pickPreferredFundingAddress();

      // Prepare a funded buy-PSBT (adds buyer fee inputs) before wallet signing.
      if (walletState.walletType === 'xverse' && String(resolvedFundingAddress || '').startsWith('3') && !resolvedFundingPublicKey) {
        throw new Error(
          'Xverse liefert keinen Payment-Public-Key fuer die 3... Adresse. Bitte andere Wallet-Extensions deaktivieren, Xverse neu verbinden und erneut versuchen.'
        );
      }
      const buildFundingCandidates = () =>
        Array.from(
          new Set(
            [
              resolvedFundingAddress,
              resolvedBuyerAddress,
              taprootAddress,
              ...(walletState.accounts || []).map((acc: any) => String(acc?.address || '').trim()),
            ]
              .map((addr) => String(addr || '').trim())
              .filter(Boolean)
          )
        );
      const buildFundingPublicKeyCandidates = () => {
        const prioritizedAddressKeys = Array.from(
          fundingPublicKeysByAddress.get(String(paymentAddress || '').trim().toLowerCase()) || []
        );
        return Array.from(
          new Set(
            [...prioritizedAddressKeys, resolvedFundingPublicKey, ...Array.from(fundingPublicKeyCandidates)]
              .map((key) => String(key || '').trim())
              .filter(Boolean)
          )
        );
      };
      const buildFundingRedeemScriptCandidates = () =>
        Array.from(
          new Set(
            Array.from(fundingRedeemScriptCandidates)
              .map((hex) => String(hex || '').trim().toLowerCase())
              .filter((hex) => /^[0-9a-f]+$/i.test(hex) && hex.length % 2 === 0)
          )
        );
      let prepared;
      try {
        const fundingAddressCandidates = buildFundingCandidates();
        const fundingPublicKeys = buildFundingPublicKeyCandidates();
        const fundingRedeemScripts = buildFundingRedeemScriptCandidates();
        const primaryFundingPublicKey = String(resolvedFundingPublicKey || fundingPublicKeys[0] || '').trim();
        prepared = await prepareMarketplacePurchaseAdvanced({
          listingId: listing.id,
          buyerAddress: resolvedBuyerAddress || currentAddress,
          fundingAddress: resolvedFundingAddress || currentAddress,
          fundingAddressCandidates,
          fundingPublicKey: primaryFundingPublicKey || undefined,
          fundingPublicKeys,
          fundingRedeemScripts,
        });
      } catch (prepErr: any) {
        const prepMsg = String(prepErr?.message || '');
        const isRawCountZero = prepMsg.includes('"rawCount":0');
        const hasP2shRedeemFailure =
          prepMsg.includes('"p2shMissingRedeem"') ||
          prepMsg.toLowerCase().includes('redeemscript could not be derived');
        const canFallbackToBuyerFundingAddress =
          String(resolvedFundingAddress || '').startsWith('3') &&
          /^bc1[qp]/i.test(String(resolvedBuyerAddress || ''));
        if (walletState.walletType === 'xverse' && hasP2shRedeemFailure && canFallbackToBuyerFundingAddress) {
          try {
            resolvedFundingAddress = String(resolvedBuyerAddress || '').trim();
            setActionMessage('P2SH-Funding nicht signierbar. Fallback auf bc1... Funding-Adresse mit strikten Inscription-Filtern...');
            const fallbackFundingAddressCandidates = buildFundingCandidates();
            const fallbackFundingPublicKeys = buildFundingPublicKeyCandidates();
            const fallbackFundingRedeemScripts = buildFundingRedeemScriptCandidates();
            const fallbackPrimaryFundingPublicKey = String(resolvedFundingPublicKey || fallbackFundingPublicKeys[0] || '').trim();
            prepared = await prepareMarketplacePurchaseAdvanced({
              listingId: listing.id,
              buyerAddress: resolvedBuyerAddress || currentAddress,
              fundingAddress: resolvedFundingAddress || currentAddress,
              fundingAddressCandidates: fallbackFundingAddressCandidates,
              fundingPublicKey: fallbackPrimaryFundingPublicKey || undefined,
              fundingPublicKeys: fallbackFundingPublicKeys,
              fundingRedeemScripts: fallbackFundingRedeemScripts,
            });
          } catch {
            throw prepErr;
          }
        } else if (walletState.walletType === 'xverse' && isRawCountZero) {
          try {
            const satsConnect: any = await import('sats-connect');
            if (satsConnect?.request) {
              const reconnectResponse = await satsConnect.request('wallet_connect', {
                addresses: ['payment', 'ordinals'],
                message: 'Refresh addresses for marketplace purchase',
              });
              const reconnectRows = extractXverseAddressRows(reconnectResponse);
              if (reconnectRows.length) {
                applyXverseFundingCandidate(reconnectRows);
                if (String(resolvedFundingAddress || '').startsWith('3') && !String(resolvedFundingPublicKey || '').trim()) {
                  throw new Error(
                    'Xverse liefert keinen Payment-Public-Key fuer die 3... Adresse. Bitte in Xverse neu verbinden und erneut versuchen.'
                  );
                }
                const refreshedFundingAddressCandidates = buildFundingCandidates();
                const refreshedFundingPublicKeys = buildFundingPublicKeyCandidates();
                const refreshedFundingRedeemScripts = buildFundingRedeemScriptCandidates();
                const refreshedPrimaryFundingPublicKey = String(resolvedFundingPublicKey || refreshedFundingPublicKeys[0] || '').trim();
                setActionMessage('Keine UTXOs gefunden. Retry mit frisch ausgelesenen Xverse-Adressen...');
                prepared = await prepareMarketplacePurchaseAdvanced({
                  listingId: listing.id,
                  buyerAddress: resolvedBuyerAddress || currentAddress,
                  fundingAddress: resolvedFundingAddress || currentAddress,
                  fundingAddressCandidates: refreshedFundingAddressCandidates,
                  fundingPublicKey: refreshedPrimaryFundingPublicKey || undefined,
                  fundingPublicKeys: refreshedFundingPublicKeys,
                  fundingRedeemScripts: refreshedFundingRedeemScripts,
                });
              } else {
                throw prepErr;
              }
            } else {
              throw prepErr;
            }
          } catch {
            throw prepErr;
          }
        } else {
          throw prepErr;
        }
      }

      const requiredPaymentFromPrepare = Number(prepared?.funding?.requiredPaymentSats);
      const estimatedBuyerDebit = Number(prepared?.funding?.estimatedBuyerDebitSats);
      const listingPriceSats = Number.isFinite(requiredPaymentFromPrepare) && requiredPaymentFromPrepare > 0
        ? requiredPaymentFromPrepare
        : Number.isFinite(estimatedBuyerDebit) && estimatedBuyerDebit > 0
          ? Math.max(0, estimatedBuyerDebit - Number(prepared?.funding?.estimatedFeeSats || 0))
          : Number(listing.price_sats || 0);
      const estimatedFeeSats = Number(prepared?.funding?.estimatedFeeSats || 0);
      const effectiveSpendSats = Math.max(0, listingPriceSats + estimatedFeeSats);
      setActionMessage(
        `Please review before signing: listing price ${listingPriceSats} sats + estimated network fee ${estimatedFeeSats} sats (estimated total ${effectiveSpendSats} sats).`
      );
      const userConfirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              `Purchase confirmation\n\nListing price (seller payment): ${listingPriceSats} sats\nEstimated network fee: ${estimatedFeeSats} sats\nEstimated total debit: ${effectiveSpendSats} sats\n\nNote: some wallets show only total send/receive amounts in the transaction view.\n\nOnly continue if these values are correct.`
            )
          : true;
      if (!userConfirmed) {
        throw new Error('Purchase cancelled before signing.');
      }

      const buyerSigningIndexes = Array.isArray(prepared?.funding?.buyerSigningIndexes)
        ? prepared.funding.buyerSigningIndexes
        : undefined;
      const signingAddress = String(prepared?.funding?.signingAddress || '').trim();
      console.log('📦 Step 1: Fetching buyer UTXOs...');
      console.log('🔨 Step 2: Building unsigned buyer PSBT...');
      console.log(
        `   Unsigned PSBT created, inputs to sign: ${
          buyerSigningIndexes && buyerSigningIndexes.length > 0
            ? buyerSigningIndexes.join(', ')
            : '(wallet decides)'
        }`
      );
      console.log('✍️ Step 3: Requesting buyer signature...');

      // Wallet signs the funded PSBT payload (advanced non-custodial mode).
      // IMPORTANT: use funding/payment address context for signatures, not ordinals receive address.
      const signedPsbtData = await signPSBT(
        prepared.fundedPsbtBase64,
        walletState.walletType,
        false,
        signingAddress || resolvedFundingAddress || resolvedBuyerAddress || currentAddress,
        undefined,
        buyerSigningIndexes
      );
      console.log('   ✅ Buyer signed PSBT');

      console.log('🚀 Step 4: Completing purchase...');
      const result = await completeMarketplacePurchaseAdvanced({
        listingId: listing.id,
        buyerAddress: resolvedBuyerAddress || currentAddress,
        signedPsbtBase64: signedPsbtData,
      });
      console.log(`🎉 Purchase complete! TX ID: ${result.paymentTxid}`);

      setActionMessage(`Advanced PSBT purchase completed. Txid: ${result.paymentTxid}`);
      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
    } catch (err: any) {
      setError(err?.message || 'Failed advanced PSBT buy');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleOpenDetail = async (listing: MarketplaceListing) => {
    try {
      setDetailLoading(true);
      setError(null);
      setDetailOpen(true);
      syncDetailQuery(listing.collection_slug, listing.inscription_id);
      setSelectedDetailListing(listing);
      setOfferPriceSats(String(Math.max(1, Math.floor(Number(listing.price_sats || 0) * 0.95))));
      setOfferNote('');
      setDetailTab('traits');
      const detail = await getMarketplaceInscriptionDetail(listing.inscription_id);
      setSelectedInscriptionDetail(detail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ordinal details');
      setSelectedInscriptionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const deriveActiveListingFromDetail = (detail: MarketplaceInscriptionDetail): MarketplaceListing | null => {
    const isOfferableStatus = (status: string): boolean => {
      const s = String(status || '').trim().toLowerCase();
      return s === 'active' || s === 'accepted' || s === 'listed' || s === 'open';
    };
    const byNewest = (a: any, b: any) =>
      new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
      new Date(String(a?.updated_at || a?.created_at || 0)).getTime();
    const historyRows = (detail.listingHistory || []).slice().sort(byNewest);
    const activeHistory = historyRows.find((row) => isOfferableStatus(String(row?.status || '')));
    // Fallback: some backends mark inscription as listed but don't expose "active" in history.
    const bestEffortHistory =
      activeHistory ||
      (detail.marketplaceInscription?.listed ? historyRows.find((row) => String(row?.id || '').trim()) : null);
    if (!bestEffortHistory) return null;
    const resolvedSignedPsbtBase64 = String((bestEffortHistory as any)?.signed_psbt_base64 || '').trim();
    return {
      id: String(bestEffortHistory.id || ''),
      inscription_id: String(bestEffortHistory.inscription_id || detail.inscriptionId || ''),
      collection_slug: String(bestEffortHistory.collection_slug || detail.marketplaceInscription?.collection_slug || selectedCollectionSlug || 'unknown'),
      seller_address: String(bestEffortHistory.seller_address || ''),
      buyer_receive_address: String(bestEffortHistory.buyer_receive_address || ''),
      price_sats: Number(bestEffortHistory.price_sats || 0),
      status: String(bestEffortHistory.status || 'active'),
      signed_psbt_base64: resolvedSignedPsbtBase64 || undefined,
      inscription_attributes: Array.isArray(detail.marketplaceInscription?.attributes)
        ? detail.marketplaceInscription?.attributes
        : [],
      inscription_metadata: detail.marketplaceInscription?.metadata || {},
      created_at: String(bestEffortHistory.created_at || ''),
      updated_at: String(bestEffortHistory.updated_at || bestEffortHistory.created_at || ''),
    };
  };

  const handleOpenInscriptionDetail = async (inscriptionId: string) => {
    try {
      setDetailLoading(true);
      setError(null);
      setDetailOpen(true);
      syncDetailQuery(selectedCollectionSlug, inscriptionId);
      setSelectedDetailListing(null);
      setDetailTab('traits');
      const detail = await getMarketplaceInscriptionDetail(inscriptionId);
      setSelectedInscriptionDetail(detail);
      const activeFromLoadedListings =
        listings.find((l) => {
          if (l.inscription_id !== inscriptionId) return false;
          const s = String(l.status || '').toLowerCase();
          return s === 'active' || s === 'accepted' || s === 'listed' || s === 'open';
        }) || null;
      let resolvedListing = activeFromLoadedListings || deriveActiveListingFromDetail(detail);
      if (!resolvedListing) {
        try {
          const byInscription = await getMarketplaceListings({
            status: 'all',
            inscriptionId,
            limit: 10,
          });
          resolvedListing =
            (byInscription || []).find((l) => {
              const s = String(l.status || '').toLowerCase();
              return s === 'active' || s === 'accepted' || s === 'listed' || s === 'open';
            }) || null;
        } catch {
          // Keep existing fallback result.
        }
      }
      setSelectedDetailListing(resolvedListing);
      setDetailListPriceSats('10000');
      const activePrice = Number((resolvedListing || deriveActiveListingFromDetail(detail))?.price_sats || 0);
      if (activePrice > 0) {
        setOfferPriceSats(String(Math.max(1, Math.floor(activePrice * 0.95))));
      } else {
        setOfferPriceSats('');
      }
      setOfferNote('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load inscription details');
      setSelectedInscriptionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateListingFromDetail = async () => {
    try {
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      if (!selectedInscriptionDetail?.inscriptionId) throw new Error('No inscription selected');
      const priceSats = Math.round(Number(detailListPriceSats || 0));
      if (!Number.isFinite(priceSats) || priceSats <= 0) throw new Error('Price must be greater than 0');

      setError(null);
      setActionMessage(null);
      setBusyListingId(selectedInscriptionDetail.inscriptionId);

      const collectionSlug = String(
        selectedInscriptionDetail.marketplaceInscription?.collection_slug || selectedCollectionSlug || 'unknown'
      ).trim();

      const listingPayload = {
        inscriptionId: selectedInscriptionDetail.inscriptionId,
        collectionSlug: collectionSlug || 'unknown',
        sellerAddress: currentAddress,
        sellerPaymentAddress: paymentAddress || currentAddress,
        sellerPublicKey: ordinalsPublicKey || undefined,
        buyerReceiveAddress: currentAddress,
        priceSats,
      };

      if (!walletState.walletType) throw new Error('Connect wallet first');
      const prepared = await prepareMarketplaceListingPsbt(listingPayload);
      if (!prepared?.psbtBase64 || !prepared?.listingId) {
        throw new Error('Listing PSBT preparation returned incomplete data');
      }
      const signedPsbtData = await signPSBT(
        prepared.psbtBase64,
        walletState.walletType,
        false,
        prepared.ownerAddress || currentAddress,
        0x82 // SIGHASH_NONE | ANYONECANPAY (buyer address replacement at buy-time)
      );
      const signedIsHex = /^[0-9a-fA-F]+$/.test(String(signedPsbtData || '').trim());
      await finalizeMarketplaceListingPsbt({
        listingId: prepared.listingId,
        walletAddress: currentAddress,
        signedPsbtHex: signedIsHex ? signedPsbtData : undefined,
        signedPsbtBase64: signedIsHex ? undefined : signedPsbtData,
      });

      const [refreshedDetail] = await Promise.all([
        getMarketplaceInscriptionDetail(selectedInscriptionDetail.inscriptionId),
        loadListings(),
        getMarketplaceRanking().then(setRanking),
      ]);
      setSelectedInscriptionDetail(refreshedDetail);
      const activeFromLoadedListings =
        listings.find(
          (l) =>
            l.inscription_id === selectedInscriptionDetail.inscriptionId &&
            String(l.status || '').toLowerCase() === 'active'
        ) || null;
      setSelectedDetailListing(activeFromLoadedListings || deriveActiveListingFromDetail(refreshedDetail));
      const activePrice = Number((activeFromLoadedListings || deriveActiveListingFromDetail(refreshedDetail))?.price_sats || 0);
      if (activePrice > 0) {
        setOfferPriceSats(String(Math.max(1, Math.floor(activePrice * 0.95))));
      }
      setActionMessage('Listing created and signed via wallet PSBT.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create listing');
    } finally {
      setBusyListingId(null);
    }
  };

  const handleBulkListMyItems = async () => {
    try {
      if (!walletState.connected || !currentAddress || !walletState.walletType) {
        throw new Error('Connect wallet first');
      }
      const selectedIds = Array.from(selectedMyItemIds).sort((a, b) => a.localeCompare(b));
      if (selectedIds.length === 0) {
        throw new Error('Select at least one item first');
      }
      const basePrice = Math.round(Number(bulkListBasePriceSats || 0));
      const stepPrice = Math.round(Number(bulkListStepSats || 0));
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error('Base price must be greater than 0');
      }
      if (!Number.isFinite(stepPrice) || stepPrice < 0) {
        throw new Error('Ladder step must be 0 or greater');
      }

      setError(null);
      setBulkListRunning(true);
      setBusyListingId('bulk-my-items');
      let successCount = 0;
      const successfulIds: string[] = [];
      const failed: string[] = [];

      for (let index = 0; index < selectedIds.length; index++) {
        const inscriptionId = selectedIds[index];
        const directionFactor = bulkListDirection === 'down' ? -1 : 1;
        const priceSats = Math.max(1, basePrice + directionFactor * stepPrice * index);
        try {
          setActionMessage(`Listing ${index + 1}/${selectedIds.length}: ${inscriptionId} at ${priceSats} sats...`);
          const detail = await getMarketplaceInscriptionDetail(inscriptionId);
          const collectionSlug = String(
            detail?.marketplaceInscription?.collection_slug || selectedCollectionSlug || 'unknown'
          ).trim();
          const listingPayload = {
            inscriptionId,
            collectionSlug: collectionSlug || 'unknown',
            sellerAddress: currentAddress,
            sellerPaymentAddress: paymentAddress || currentAddress,
            sellerPublicKey: ordinalsPublicKey || undefined,
            buyerReceiveAddress: currentAddress,
            priceSats,
          };
          const prepared = await prepareMarketplaceListingPsbt(listingPayload);
          if (!prepared?.psbtBase64 || !prepared?.listingId) {
            throw new Error('Listing PSBT preparation returned incomplete data');
          }
          const signedPsbtData = await signPSBT(
            prepared.psbtBase64,
            walletState.walletType,
            false,
            prepared.ownerAddress || currentAddress,
            0x82
          );
          const signedIsHex = /^[0-9a-fA-F]+$/.test(String(signedPsbtData || '').trim());
          await finalizeMarketplaceListingPsbt({
            listingId: prepared.listingId,
            walletAddress: currentAddress,
            signedPsbtHex: signedIsHex ? signedPsbtData : undefined,
            signedPsbtBase64: signedIsHex ? undefined : signedPsbtData,
          });
          successCount += 1;
          successfulIds.push(inscriptionId);
        } catch (err: any) {
          failed.push(`${inscriptionId}: ${String(err?.message || 'listing failed')}`);
        }
      }

      await Promise.all([loadListings(), getMarketplaceRanking().then(setRanking)]);
      if (successfulIds.length > 0) {
        setSelectedMyItemIds((prev) => {
          const next = new Set(prev);
          for (const id of successfulIds) next.delete(id);
          return next;
        });
      }
      setActionMessage(`Bulk listing done: ${successCount}/${selectedIds.length} listed.`);
      if (failed.length > 0) {
        setError(`Some items failed: ${failed.slice(0, 3).join(' | ')}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to bulk list items');
    } finally {
      setBulkListRunning(false);
      setBusyListingId(null);
    }
  };

  const handleCreateOfferFromDetail = async () => {
    try {
      if (!selectedDetailListing) throw new Error('No listing selected');
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      const offerSats = Math.round(Number(offerPriceSats || 0));
      if (!Number.isFinite(offerSats) || offerSats <= 0) throw new Error('Offer price must be greater than 0');
      if (currentAddress.toLowerCase() === selectedDetailListing.seller_address.toLowerCase()) {
        throw new Error('Seller cannot create own offer');
      }

      setOfferSubmitting(true);
      setError(null);
      setActionMessage(null);
      await createMarketplaceOffer({
        listingId: selectedDetailListing.id,
        buyerAddress: currentAddress,
        offerPriceSats: offerSats,
        note: offerNote.trim(),
      });
      setActionMessage('Offer submitted successfully.');
      const refreshed = await getMarketplaceInscriptionDetail(selectedDetailListing.inscription_id);
      setSelectedInscriptionDetail(refreshed);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit offer');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleOfferDecision = async (offerId: string, decision: 'accept' | 'decline') => {
    try {
      if (!selectedDetailListing) throw new Error('No listing selected');
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      setOfferActionBusyId(offerId);
      setError(null);
      setActionMessage(null);

      if (decision === 'accept') {
        await acceptMarketplaceOffer({
          listingId: selectedDetailListing.id,
          offerId,
          walletAddress: currentAddress,
        });
        setActionMessage('Offer accepted.');
      } else {
        await declineMarketplaceOffer({
          listingId: selectedDetailListing.id,
          offerId,
          walletAddress: currentAddress,
        });
        setActionMessage('Offer declined.');
      }

      const refreshed = await getMarketplaceInscriptionDetail(selectedDetailListing.inscription_id);
      setSelectedInscriptionDetail(refreshed);
    } catch (err: any) {
      setError(err?.message || `Failed to ${decision} offer`);
    } finally {
      setOfferActionBusyId(null);
    }
  };

  const handleCompleteOfferSale = async (offerId: string) => {
    try {
      if (!selectedDetailListing) throw new Error('No listing selected');
      if (!walletState.connected || !currentAddress) throw new Error('Connect wallet first');
      const paymentTxid = String(offerTxids[offerId] || '').trim();
      setOfferCompleteBusyId(offerId);
      setError(null);
      setActionMessage(null);
      const result = await completeMarketplaceOfferSale({
        listingId: selectedDetailListing.id,
        offerId,
        walletAddress: currentAddress,
        paymentTxid: paymentTxid || undefined,
      });
      setActionMessage(
        `Offer sale completed${result.paymentTxid ? `. Txid: ${result.paymentTxid}` : ''}.`
      );
      const [refreshedDetail] = await Promise.all([
        getMarketplaceInscriptionDetail(selectedDetailListing.inscription_id),
        loadListings(),
        getMarketplaceRanking().then(setRanking),
      ]);
      setSelectedInscriptionDetail(refreshedDetail);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete offer sale');
    } finally {
      setOfferCompleteBusyId(null);
    }
  };

  const loadCollectionInscriptions = async (slug: string, search = '', append = false) => {
    try {
      if (!slug) return;
      setCollectionModalOpen(true);
      if (append) setCollectionLoadingMore(true);
      else setCollectionLoading(true);
      setError(null);
      const mergeById = (
        base: MarketplaceCollectionInscription[],
        next: MarketplaceCollectionInscription[]
      ): MarketplaceCollectionInscription[] => {
        const byId = new Map<string, MarketplaceCollectionInscription>();
        for (const row of base) byId.set(row.inscription_id, row);
        for (const row of next) byId.set(row.inscription_id, row);
        return Array.from(byId.values());
      };

      let nextInscriptions: MarketplaceCollectionInscription[] = [];
      let total = 0;

      if (append) {
        const offset = collectionInscriptions.length;
        const data = await getMarketplaceCollectionInscriptions({
          collectionSlug: slug,
          search,
          limit: COLLECTION_PAGE_SIZE,
          offset,
        });
        nextInscriptions = data.inscriptions || [];
        total = Number(data.total || 0);
        setCollectionInscriptions((prev) => mergeById(prev, nextInscriptions));
      } else {
        // Fast path: load only first page, then append on demand.
        const firstPage = await getMarketplaceCollectionInscriptions({
          collectionSlug: slug,
          search,
          limit: COLLECTION_PAGE_SIZE,
          offset: 0,
        });
        total = Number(firstPage.total || 0);
        nextInscriptions = mergeById([], firstPage.inscriptions || []);
        setCollectionInscriptions(nextInscriptions);
      }

      setSelectedCollectionSlug(slug);
      const fromCache: Record<string, string> = {};
      for (const ins of nextInscriptions) {
        const cached = rareSatsCacheRef.current[ins.inscription_id];
        if (cached && cached !== '-') fromCache[ins.inscription_id] = cached;
      }
      setCollectionRareSatsByInscription((prev) => (append ? { ...prev, ...fromCache } : fromCache));
      if (!append) {
        setCollectionSelectedTraitFilters({});
        setCollectionRarityFilter('all');
        setCollectionSortMode('price-asc');
        setCollectionActiveListingsByInscription({});
        (async () => {
          try {
            const allRows: MarketplaceListing[] = [];
            let offset = 0;
            const pageSize = 200;
            for (let guard = 0; guard < 10; guard += 1) {
              const page = await getMarketplaceListings({
                status: 'active',
                collectionSlug: slug,
                limit: pageSize,
                offset,
              });
              if (!Array.isArray(page) || page.length === 0) break;
              allRows.push(...page);
              if (page.length < pageSize) break;
              offset += pageSize;
            }
            const nextMap: Record<string, MarketplaceListing> = {};
            for (const row of allRows) {
              const id = String(row.inscription_id || '').trim();
              if (!id) continue;
              const price = Number(row.price_sats || 0);
              const prev = nextMap[id];
              if (!prev || price < Number(prev.price_sats || 0)) {
                nextMap[id] = row;
              }
            }
            setCollectionActiveListingsByInscription(nextMap);
          } catch {
            // Keep UI functional even if listing hydration fails.
          }
        })();
      }
      setCollectionInscriptionsTotal(total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load collection inscriptions');
      if (!append) {
        setCollectionInscriptions([]);
        setCollectionRareSatsByInscription({});
        setCollectionInscriptionsTotal(0);
      }
    } finally {
      if (append) setCollectionLoadingMore(false);
      else setCollectionLoading(false);
    }
  };

  useEffect(() => {
    if (!collectionModalOpen || !selectedCollectionSlug || collectionInscriptions.length === 0) return;
    let cancelled = false;

    const missingIds = collectionInscriptions
      .filter((ins) => {
        const baseValue = extractInscriptionRareSats(ins);
        const cachedValue = rareSatsCacheRef.current[ins.inscription_id];
        return baseValue === '-' && cachedValue === undefined;
      })
      .map((ins) => ins.inscription_id)
      .slice(0, 120);

    const cachedVisible: Record<string, string> = {};
    for (const ins of collectionInscriptions) {
      const cached = rareSatsCacheRef.current[ins.inscription_id];
      if (cached && cached !== '-') cachedVisible[ins.inscription_id] = cached;
    }
    if (Object.keys(cachedVisible).length > 0) {
      setCollectionRareSatsByInscription((prev) => ({ ...prev, ...cachedVisible }));
    }

    if (!missingIds.length) return;

    const fetchIdsInChunks = async (ids: string[], chunkSize: number) => {
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        let details: Array<readonly [string, string]> = [];
        const byId = new Map<string, string>();
        try {
          const batch = await getMarketplaceRareSatsBatch(chunk);
          for (const item of batch.items || []) {
            const id = getBatchItemId(item);
            if (!id) continue;
            byId.set(id, normalizeRareSatsDisplay(getBatchItemRareSats(item)));
          }
        } catch {
          // Ignore batch errors and continue with detail fallback.
        }
        await hydrateRareSatsFromDetailFallback(chunk, byId);
        details = chunk.map((id) => {
          const normalized = byId.get(id) || '-';
          if (normalized !== '-') {
            rareSatsCacheRef.current[id] = normalized;
          }
          return [id, normalized] as const;
        });

        if (cancelled) return;

        const found: Record<string, string> = {};
        for (const [id, value] of details) {
          if (value && value !== '-') found[id] = value;
        }
        if (Object.keys(found).length > 0) {
          setCollectionRareSatsByInscription((prev) => ({ ...prev, ...found }));
        }
      }
    };

    const hydrateRareSats = async () => {
      // Prioritize first visible cards for faster perceived load.
      const priorityIds = missingIds.slice(0, 28);
      const backgroundIds = missingIds.slice(28);

      await fetchIdsInChunks(priorityIds, 8);
      if (cancelled || backgroundIds.length === 0) return;

      // Let UI render before continuing background hydration.
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (cancelled) return;
      await fetchIdsInChunks(backgroundIds, 6);
    };

    hydrateRareSats();
    return () => {
      cancelled = true;
    };
  }, [collectionModalOpen, selectedCollectionSlug, collectionInscriptions]);

  const totalListed = listings.length;
  const floorPriceSats = listings.reduce((min, l) => {
    const price = Number(l.price_sats || 0);
    if (price <= 0) return min;
    if (min === 0) return price;
    return Math.min(min, price);
  }, 0);
  const volumeSoldSats = soldListings.reduce((sum, s) => sum + Number(s.price_sats || 0), 0);
  const sold24h = soldListings.filter((s) => {
    const ts = Date.parse(s.updated_at || s.created_at || '');
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= 24 * 60 * 60 * 1000;
  }).length;
  const avgPriceSats = totalListed
    ? Math.round(listings.reduce((sum, l) => sum + Number(l.price_sats || 0), 0) / totalListed)
    : 0;
  const sortedPrices = listings
    .map((l) => Number(l.price_sats || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const highValueThreshold =
    sortedPrices.length > 0 ? sortedPrices[Math.max(0, Math.floor(sortedPrices.length * 0.85) - 1)] : 0;
  const verifiedCollectionSet = useMemo(
    () =>
      new Set(
        collectionsMeta
          .filter((c) => !!c.verified)
          .map((c) => String(c.slug || '').trim())
          .filter(Boolean)
      ),
    [collectionsMeta]
  );

  const collectionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) {
      if (l.collection_slug) set.add(l.collection_slug);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const orderedCollectionsMeta = useMemo(() => {
    const getDisplayOrder = (c: MarketplaceCollection): number => {
      const md = (c?.metadata || {}) as Record<string, any>;
      const raw = md.displayOrder ?? md.display_order ?? md.sortOrder ?? md.sort_order;
      const n = Number(raw);
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    };
    return [...collectionsMeta].sort((a, b) => {
      const ao = getDisplayOrder(a);
      const bo = getDisplayOrder(b);
      if (ao !== bo) return ao - bo;
      return String(a.name || a.slug || '').localeCompare(String(b.name || b.slug || ''));
    });
  }, [collectionsMeta]);

  const extractTraits = (l: MarketplaceListing): Array<{ trait_type: string; value: string }> => {
    const rows = Array.isArray(l.inscription_attributes) ? l.inscription_attributes : [];
    return rows
      .map((t) => ({
        trait_type: String(t?.trait_type || '').trim(),
        value: String(t?.value || '').trim(),
      }))
      .filter((t) => t.trait_type && t.value);
  };

  const normalizeRareSatsDisplay = (raw: any): string => {
    if (raw === undefined || raw === null || raw === '') return '-';
    if (typeof raw === 'number') return raw.toLocaleString();
    if (Array.isArray(raw)) {
      const values = raw.map((v) => String(v ?? '').trim()).filter(Boolean);
      return values.length ? values.join(', ') : '-';
    }
    if (typeof raw === 'object') {
      const values = Object.values(raw).map((v) => String(v ?? '').trim()).filter(Boolean);
      return values.length ? values.join(', ') : '-';
    }
    return String(raw).trim() || '-';
  };

  const normalizeRareSatKey = (value: string): string =>
    String(value || '')
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .trim();

  const splitRareSatTokens = (raw: any): string[] =>
    normalizeRareSatsDisplay(raw)
      .split(/[,+/|]/g)
      .map((v) => String(v || '').trim())
      .filter(Boolean);

  const RARE_SAT_SYMBOLS: Record<string, string> = {
    uncommon: '◍',
    rare: '◈',
    epic: '✶',
    legendary: '✧',
    mythic: '☉',
    black: '⬤',
    'black-sat': '⬤',
    'black-sats': '⬤',
    'black-uncommon': '⬤◍',
    blackuncommon: '⬤◍',
    'black-rare': '⬤◈',
    blackrare: '⬤◈',
    'black-epic': '⬤✶',
    blackepic: '⬤✶',
    'black-legendary': '⬤✧',
    blacklegendary: '⬤✧',
    'black-mythic': '⬤☉',
    blackmythic: '⬤☉',
    palindrome: '↔',
    palindrom: '↔',
    'number-palindrome': '↔',
    alpha: 'α',
    'alpha-sat': 'α',
    omega: 'ω',
    'omega-sat': 'ω',
    vintage: '⌛',
    pizza: '🍕',
    nakamoto: '₿',
    hitman: '🎯',
    'silk-road': '🕸',
    silkroad: '🕸',
    legacy: '🏛',
    jpeg: '🖼',
    'first-transaction': '①',
    firsttransaction: '①',
    'first-tx': '①',
    'block-9': '⑨',
    block9: '⑨',
    'block-78': '78',
    block78: '78',
    'block-286': '286',
    block286: '286',
    'block-666': '666',
    block666: '666',
    'block-999': '999',
    block999: '999',
  };

  const RARE_SAT_DEFINITIONS: Record<string, string> = {
    uncommon: 'First sat of a block.',
    rare: 'First sat of a difficulty adjustment period.',
    epic: 'First sat of a halving epoch.',
    legendary: 'First sat where halving and difficulty cycles align.',
    mythic: 'The very first sat (genesis sat).',
    black: 'Marks the end of a Bitcoin cycle/event.',
    'black-uncommon': 'Last sat of a block.',
    'black-rare': 'Last sat of a difficulty period.',
    'black-epic': 'Last sat of a halving epoch.',
    'black-legendary': 'Last sat of a full cycle alignment.',
    'black-mythic': 'Last sat in the mythic classification context.',
    palindrome: 'Sat number reads the same forward and backward.',
    'number-palindrome': 'Sat number reads the same forward and backward.',
    alpha: 'First sat in a bitcoin (ordinal convention).',
    omega: 'Last sat in a bitcoin (ordinal convention).',
    vintage: 'Sat mined in Bitcoin’s first 1,000 blocks.',
    pizza: 'Sat tied to the 10,000 BTC Pizza transaction.',
    nakamoto: 'Sat from early Satoshi-mined era range.',
    hitman: 'Sat linked to Silk Road hitman-related historical flow.',
    'silk-road': 'Sat linked to Silk Road historical flow.',
    legacy: 'Legacy-classified satribute from scanner providers.',
    jpeg: 'JPEG-classified satribute from scanner providers.',
    'first-transaction': 'Sat tied to Bitcoin’s first transaction history.',
    'block-9': 'Sat from block 9.',
    'block-78': 'Sat from block 78.',
    'block-286': 'Sat from block 286.',
    'block-666': 'Sat from block 666.',
    'block-999': 'Sat from block 999.',
  };

  const resolveRareSatMeta = (token: string): { symbol: string; definition: string } | null => {
    const key = normalizeRareSatKey(token);
    const exactSymbol = RARE_SAT_SYMBOLS[key];
    if (exactSymbol) {
      return {
        symbol: exactSymbol,
        definition: RARE_SAT_DEFINITIONS[key] || 'Rare sat attribute.',
      };
    }

    // Fuzzy fallbacks for provider-specific combined labels, e.g. "silkroad uncommon".
    if (key.includes('silk') && key.includes('road')) return { symbol: '🕸', definition: RARE_SAT_DEFINITIONS['silk-road'] };
    if (key.includes('nakamoto')) return { symbol: '₿', definition: RARE_SAT_DEFINITIONS.nakamoto };
    if (key.includes('vintage')) return { symbol: '⌛', definition: RARE_SAT_DEFINITIONS.vintage };
    if (key.includes('pizza')) return { symbol: '🍕', definition: RARE_SAT_DEFINITIONS.pizza };
    if (key.includes('palindrome') || key.includes('palindrom')) return { symbol: '↔', definition: RARE_SAT_DEFINITIONS.palindrome };
    if (key.includes('alpha')) return { symbol: 'α', definition: RARE_SAT_DEFINITIONS.alpha };
    if (key.includes('omega')) return { symbol: 'ω', definition: RARE_SAT_DEFINITIONS.omega };
    if (key.includes('hitman')) return { symbol: '🎯', definition: RARE_SAT_DEFINITIONS.hitman };
    if (key.includes('legacy')) return { symbol: '🏛', definition: RARE_SAT_DEFINITIONS.legacy };
    if (key.includes('jpeg')) return { symbol: '🖼', definition: RARE_SAT_DEFINITIONS.jpeg };
    if (key.includes('first') && key.includes('transaction')) return { symbol: '①', definition: RARE_SAT_DEFINITIONS['first-transaction'] };
    if (key.includes('block-9') || key.includes('block9')) return { symbol: '⑨', definition: RARE_SAT_DEFINITIONS['block-9'] };
    if (key.includes('block-78') || key.includes('block78')) return { symbol: '78', definition: RARE_SAT_DEFINITIONS['block-78'] };
    if (key.includes('block-286') || key.includes('block286')) return { symbol: '286', definition: RARE_SAT_DEFINITIONS['block-286'] };
    if (key.includes('block-666') || key.includes('block666')) return { symbol: '666', definition: RARE_SAT_DEFINITIONS['block-666'] };
    if (key.includes('block-999') || key.includes('block999')) return { symbol: '999', definition: RARE_SAT_DEFINITIONS['block-999'] };
    if (key.includes('black')) return { symbol: '⬤', definition: RARE_SAT_DEFINITIONS.black };
    if (key.includes('mythic')) return { symbol: '☉', definition: RARE_SAT_DEFINITIONS.mythic };
    if (key.includes('legendary')) return { symbol: '✧', definition: RARE_SAT_DEFINITIONS.legendary };
    if (key.includes('epic')) return { symbol: '✶', definition: RARE_SAT_DEFINITIONS.epic };
    if (key.includes('rare')) return { symbol: '◈', definition: RARE_SAT_DEFINITIONS.rare };
    if (key.includes('uncommon')) return { symbol: '◍', definition: RARE_SAT_DEFINITIONS.uncommon };
    return null;
  };

  const toRareSatSymbols = (raw: any): string => {
    const tokens = splitRareSatTokens(raw);
    if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === '-')) return '-';
    const symbols = tokens
      .map((token) => resolveRareSatMeta(token)?.symbol || '')
      .filter(Boolean);
    return symbols.length ? symbols.join(' ') : '◌';
  };

  const toRareSatTooltip = (raw: any): string => {
    const tokens = splitRareSatTokens(raw);
    if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === '-')) return 'No satribute data';
    return tokens
      .map((token) => {
        const meta = resolveRareSatMeta(token);
        const symbol = meta?.symbol || '◌';
        const def = meta?.definition || 'Rare sat attribute.';
        return `${symbol} ${token}: ${def}`;
      })
      .join(' | ');
  };

  const getBatchItemId = (item: any): string =>
    String(item?.inscriptionId || item?.inscription_id || item?.id || '').trim();

  const getBatchItemRareSats = (item: any): any =>
    item?.rareSats ??
    item?.rare_sats ??
    item?.rareSat ??
    item?.rare_sat ??
    item?.satributes ??
    item?.sattributes ??
    item?.satributes?.rarity;

  const extractRareSats = (l: MarketplaceListing): string => {
    const manual = RARE_SAT_OVERRIDES_BY_INSCRIPTION[String(l.inscription_id || '').trim()];
    if (manual) return manual;
    const md = l.inscription_metadata || {};
    const raw =
      md?.rareSats ??
      md?.rare_sats ??
      md?.rareSat ??
      md?.rare_sat ??
      md?.satributes ??
      md?.sattributes ??
      md?.satributes?.rarity;
    return normalizeRareSatsDisplay(raw);
  };

  const extractInscriptionRarity = (ins: MarketplaceCollectionInscription): string => {
    const md = ins.metadata || {};
    const rarity = String(md?.derivedRarityTier || md?.rarity || '').trim();
    return rarity || '-';
  };

  const extractInscriptionRareSats = (ins: MarketplaceCollectionInscription): string => {
    const manual = RARE_SAT_OVERRIDES_BY_INSCRIPTION[String(ins.inscription_id || '').trim()];
    if (manual) return manual;
    const md = ins.metadata || {};
    const raw =
      md?.rareSats ??
      md?.rare_sats ??
      md?.rareSat ??
      md?.rare_sat ??
      md?.satributes ??
      md?.sattributes ??
      md?.satributes?.rarity;
    return normalizeRareSatsDisplay(raw);
  };

  const extractRareSatsFromDetail = (detail: MarketplaceInscriptionDetail | null | undefined): string => {
    const manual = RARE_SAT_OVERRIDES_BY_INSCRIPTION[String(detail?.inscriptionId || '').trim()];
    if (manual) return manual;
    const md = detail?.marketplaceInscription?.metadata || {};
    const chain = detail?.chainInfo || {};
    const raw =
      chain?.rareSats ??
      chain?.rare_sats ??
      chain?.rareSat ??
      chain?.rare_sat ??
      chain?.satributes ??
      chain?.sattributes ??
      chain?.satributes?.rarity ??
      chain?.sat_rarity ??
      chain?.rarity ??
      md?.rareSats ??
      md?.rare_sats ??
      md?.rareSat ??
      md?.rare_sat ??
      md?.satributes ??
      md?.sattributes ??
      md?.satributes?.rarity;
    const normalized = normalizeRareSatsDisplay(raw);
    if (normalized !== '-') return normalized;

    const satCandidate = Number(
      chain?.satNumber ??
      chain?.sat_number ??
      chain?.sat ??
      md?.satNumber ??
      md?.sat_number ??
      md?.sat
    );
    if (!Number.isFinite(satCandidate) || satCandidate < 0) return '-';
    const sat = Math.trunc(satCandidate);
    const derived: string[] = [];
    if (sat < NAKAMOTO_SAT_MAX_EXCLUSIVE) derived.push('nakamoto');
    if (sat < VINTAGE_SAT_MAX_EXCLUSIVE) derived.push('vintage');
    if (sat % SATS_PER_BTC === 0) derived.push('alpha');
    if (sat % SATS_PER_BTC === SATS_PER_BTC - 1) derived.push('omega');
    const satText = String(sat);
    if (satText === satText.split('').reverse().join('')) derived.push('palindrome');
    return derived.length ? Array.from(new Set(derived)).join(', ') : '-';
  };

  const fetchExternalSatributesBySatNumber = async (_satNumber: number): Promise<string> => {
    // External per-sat crawling can trigger aggressive 429 rate limits.
    return '-';
  };

  const hydrateRareSatsFromDetailFallback = async (
    ids: string[],
    byId: Map<string, string>
  ): Promise<void> => {
    for (const id of ids) {
      if ((byId.get(id) || '-') !== '-') continue;
      try {
        const detail = await getMarketplaceInscriptionDetail(id);
        let normalized = extractRareSatsFromDetail(detail);
        if (normalized === '-') {
          const satCandidate = Number(
            detail?.chainInfo?.satNumber ??
            detail?.chainInfo?.sat_number ??
            detail?.chainInfo?.sat ??
            detail?.marketplaceInscription?.metadata?.satNumber ??
            detail?.marketplaceInscription?.metadata?.sat_number ??
            detail?.marketplaceInscription?.metadata?.sat
          );
          if (Number.isFinite(satCandidate) && satCandidate >= 0) {
            normalized = await fetchExternalSatributesBySatNumber(satCandidate);
          }
        }
        if (normalized !== '-') {
          byId.set(id, normalized);
        }
      } catch {
        // Retry on later hydration cycles; don't mark as permanent no-hit on transient API errors.
      }
    }
  };

  const firstPresentValue = (...values: any[]): any => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      return value;
    }
    return undefined;
  };

  const detailTextValue = (...values: any[]): string => {
    const value = firstPresentValue(...values);
    if (value === undefined) return '-';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const extractInscriptionTraits = (ins: MarketplaceCollectionInscription): Array<{ trait_type: string; value: string }> => {
    const rows = Array.isArray(ins.attributes) ? ins.attributes : [];
    return rows
      .map((t: any) => ({
        trait_type: String(t?.trait_type || '').trim(),
        value: String(t?.value || '').trim(),
      }))
      .filter((t) => t.trait_type && t.value);
  };

  const collectionTraitPercentByKey = useMemo(() => {
    const total = Math.max(1, collectionInscriptions.length);
    const counts = new Map<string, number>();
    for (const ins of collectionInscriptions) {
      for (const t of extractInscriptionTraits(ins)) {
        const k = `${t.trait_type}::${t.value}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    const out = new Map<string, number>();
    for (const [k, c] of counts.entries()) {
      out.set(k, (c / total) * 100);
    }
    return out;
  }, [collectionInscriptions]);

  const collectionCompositeRarityByInscription = useMemo(() => {
    const rawScores = new Map<string, number>();
    const forceTopRarityById = new Map<string, boolean>();
    const oneOfOneIds: string[] = [];
    for (const ins of collectionInscriptions) {
      const traits = extractInscriptionTraits(ins);
      const hasOneOfOne = traits.some((t) => {
        const traitType = String(t.trait_type || '').trim().toLowerCase();
        const value = String(t.value || '').trim().toLowerCase();
        return traitType === '1:1' || value === '1:1' || traitType === 'one of one' || value === 'one of one';
      });
      forceTopRarityById.set(ins.inscription_id, hasOneOfOne);
      if (hasOneOfOne) {
        // 1:1 items stay top rarity, but score remains in a realistic range.
        oneOfOneIds.push(ins.inscription_id);
        continue;
      }
      if (!traits.length) {
        rawScores.set(ins.inscription_id, 0);
        continue;
      }
      // Composite rarity: sum of inverse trait percentages (rarer traits add more score).
      const score = traits.reduce((sum, t) => {
        const key = `${t.trait_type}::${t.value}`;
        const pct = collectionTraitPercentByKey.get(key);
        if (!pct || pct <= 0) return sum;
        return sum + 100 / pct;
      }, 0);
      rawScores.set(ins.inscription_id, score);
    }

    // Keep 1:1 scores just above the highest regular score (instead of 1,000,000,000).
    if (oneOfOneIds.length > 0) {
      const normalScores = Array.from(rawScores.values()).filter((v) => Number.isFinite(v) && v > 0);
      const maxNormalScore = normalScores.length > 0 ? Math.max(...normalScores) : 0;
      const oneOfOneScore = Math.max(100, maxNormalScore + 10);
      for (const id of oneOfOneIds) {
        rawScores.set(id, oneOfOneScore);
      }
    }

    const values = Array.from(rawScores.values()).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    const percentileById = new Map<string, number>();
    if (!values.length) {
      for (const id of rawScores.keys()) percentileById.set(id, 0);
      return { rawScores, percentileById, forceTopRarityById };
    }

    for (const [id, score] of rawScores.entries()) {
      if (forceTopRarityById.get(id)) {
        percentileById.set(id, 100);
        continue;
      }
      if (!score || !Number.isFinite(score)) {
        percentileById.set(id, 0);
        continue;
      }
      let idx = values.findIndex((v) => v >= score);
      if (idx < 0) idx = values.length - 1;
      const pct = (idx / Math.max(1, values.length - 1)) * 100;
      percentileById.set(id, pct);
    }
    return { rawScores, percentileById, forceTopRarityById };
  }, [collectionInscriptions, collectionTraitPercentByKey]);

  const traitPctColorClass = (pct?: number): string => {
    if (pct === undefined || !Number.isFinite(pct)) return 'border-white/10 bg-zinc-900 text-gray-200';
    if (pct <= 1) return 'border-red-500/60 bg-red-900/30 text-red-200';
    if (pct <= 5) return 'border-orange-500/60 bg-orange-900/30 text-orange-200';
    if (pct <= 20) return 'border-amber-500/60 bg-amber-900/30 text-amber-200';
    if (pct <= 50) return 'border-sky-500/60 bg-sky-900/30 text-sky-200';
    return 'border-emerald-500/60 bg-emerald-900/30 text-emerald-200';
  };

  const compositeRarityLabel = (percentile: number): string => {
    if (percentile >= 95) return 'mythic';
    if (percentile >= 85) return 'legendary';
    if (percentile >= 70) return 'epic';
    if (percentile >= 50) return 'rare';
    if (percentile >= 30) return 'uncommon';
    return 'common';
  };

  const collectionTraitOptions = useMemo(() => {
    const traitMap = new Map<string, Map<string, number>>();
    for (const ins of collectionInscriptions) {
      for (const t of extractInscriptionTraits(ins)) {
        if (!traitMap.has(t.trait_type)) traitMap.set(t.trait_type, new Map<string, number>());
        const inner = traitMap.get(t.trait_type)!;
        inner.set(t.value, (inner.get(t.value) || 0) + 1);
      }
    }
    return Array.from(traitMap.entries())
      .map(([traitType, valueMap]) => ({
        traitType,
        values: Array.from(valueMap.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => a.traitType.localeCompare(b.traitType));
  }, [collectionInscriptions]);

  const selectedCollectionTraitCount = useMemo(
    () => Object.values(collectionSelectedTraitFilters).reduce((sum, arr) => sum + (arr?.length || 0), 0),
    [collectionSelectedTraitFilters]
  );

  const activeListingPriceByInscription = useMemo(() => {
    const map = new Map<string, number>();
    for (const listing of listings) {
      if (String(listing.status || '').toLowerCase() !== 'active') continue;
      const id = String(listing.inscription_id || '').trim();
      if (!id) continue;
      const price = Number(listing.price_sats || 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const existing = map.get(id);
      if (typeof existing !== 'number' || price < existing) map.set(id, price);
    }
    return map;
  }, [listings]);

  const filteredCollectionInscriptions = useMemo(() => {
    let rows = collectionInscriptions.filter((ins) => {
      if (collectionItemsFilter === 'my-items') {
        const owner = String(ins.owner_address || '').trim().toLowerCase();
        const idMatch = myWalletInscriptionIds.has(String(ins.inscription_id || '').trim());
        const ownerMatch =
          (!!currentAddress && owner === currentAddress.toLowerCase()) ||
          (!!taprootAddress && owner === taprootAddress.toLowerCase());
        if (!idMatch && !ownerMatch) return false;
      }
      const activeTraitTypes = Object.entries(collectionSelectedTraitFilters).filter(([, vals]) => vals && vals.length > 0);
      if (activeTraitTypes.length === 0) return true;
      const traits = extractInscriptionTraits(ins);
      return activeTraitTypes.every(([traitType, vals]) =>
        traits.some((t) => t.trait_type === traitType && vals.includes(t.value))
      );
    });

    if (collectionRarityFilter !== 'all') {
      rows = rows.filter((ins) => {
        const isOneOfOne = collectionCompositeRarityByInscription.forceTopRarityById.get(ins.inscription_id) || false;
        const pct = collectionCompositeRarityByInscription.percentileById.get(ins.inscription_id) || 0;
        const label = isOneOfOne ? 'mythic' : compositeRarityLabel(pct);
        return label === collectionRarityFilter;
      });
    }

    rows = [...rows].sort((a, b) => {
      if (collectionSortMode === 'price-asc' || collectionSortMode === 'price-desc') {
        const aPrice = activeListingPriceByInscription.get(a.inscription_id);
        const bPrice = activeListingPriceByInscription.get(b.inscription_id);
        if (collectionSortMode === 'price-desc') {
          const aSort = typeof aPrice === 'number' ? aPrice : Number.NEGATIVE_INFINITY;
          const bSort = typeof bPrice === 'number' ? bPrice : Number.NEGATIVE_INFINITY;
          if (!Number.isFinite(aSort) && !Number.isFinite(bSort)) return 0;
          return bSort - aSort;
        }
        const aSort = typeof aPrice === 'number' ? aPrice : Number.POSITIVE_INFINITY;
        const bSort = typeof bPrice === 'number' ? bPrice : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(aSort) && !Number.isFinite(bSort)) return 0;
        return aSort - bSort;
      }
      if (collectionSortMode === 'name-asc') {
        return String(a.metadata?.name || a.inscription_id).localeCompare(String(b.metadata?.name || b.inscription_id));
      }
      if (collectionSortMode === 'name-desc') {
        return String(b.metadata?.name || b.inscription_id).localeCompare(String(a.metadata?.name || a.inscription_id));
      }
      if (collectionSortMode === 'score-desc' || collectionSortMode === 'score-asc') {
        const aScore = collectionCompositeRarityByInscription.rawScores.get(a.inscription_id) || 0;
        const bScore = collectionCompositeRarityByInscription.rawScores.get(b.inscription_id) || 0;
        if (collectionSortMode === 'score-asc') return aScore - bScore;
        return bScore - aScore;
      }
      const aPct = collectionCompositeRarityByInscription.percentileById.get(a.inscription_id) || 0;
      const bPct = collectionCompositeRarityByInscription.percentileById.get(b.inscription_id) || 0;
      if (collectionSortMode === 'rarity-asc') return aPct - bPct;
      return bPct - aPct;
    });

    return rows;
  }, [
    collectionInscriptions,
    collectionItemsFilter,
    currentAddress,
    taprootAddress,
    myWalletInscriptionIds,
    collectionSelectedTraitFilters,
    collectionRarityFilter,
    collectionSortMode,
    collectionCompositeRarityByInscription,
    activeListingPriceByInscription,
  ]);

  const myWalletIdsForGallery = useMemo(
    () => Array.from(myWalletInscriptionIds).slice(0, 240),
    [myWalletInscriptionIds]
  );
  useEffect(() => {
    const visible = new Set(Array.from(myWalletInscriptionIds));
    setSelectedMyItemIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [myWalletInscriptionIds]);

  const baseFilteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((l) => {
      const matchCollection =
        collectionFilter === 'all' || String(l.collection_slug || '') === collectionFilter;
      if (!matchCollection) return false;
      if (!q) return true;
      return (
        String(l.inscription_id || '').toLowerCase().includes(q) ||
        String(l.collection_slug || '').toLowerCase().includes(q) ||
        String(l.seller_address || '').toLowerCase().includes(q)
      );
    });
  }, [listings, searchQuery, collectionFilter]);

  const filteredListings = useMemo(() => {
    let rows = baseFilteredListings.filter((l) => {
      const activeTraitTypes = Object.entries(selectedTraitFilters).filter(([, vals]) => vals && vals.length > 0);
      if (activeTraitTypes.length === 0) return true;
      const traits = extractTraits(l);
      return activeTraitTypes.every(([traitType, vals]) =>
        traits.some((t) => t.trait_type === traitType && vals.includes(t.value))
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === 'price-asc') return Number(a.price_sats || 0) - Number(b.price_sats || 0);
      if (sortMode === 'price-desc') return Number(b.price_sats || 0) - Number(a.price_sats || 0);
      return Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
    });
    return rows;
  }, [baseFilteredListings, selectedTraitFilters, sortMode]);

  const visibleFilteredListings = useMemo(
    () => filteredListings.slice(0, visibleListingsCount),
    [filteredListings, visibleListingsCount]
  );
  const hasMoreFilteredListings = visibleListingsCount < filteredListings.length;

  useEffect(() => {
    if (visibleFilteredListings.length === 0) return;
    let cancelled = false;

    const getBaseRareSats = (listing: MarketplaceListing): string => {
      const md = listing.inscription_metadata || {};
      const raw =
        md?.rareSats ??
        md?.rare_sats ??
        md?.rareSat ??
        md?.rare_sat ??
        md?.satributes ??
        md?.sattributes ??
        md?.satributes?.rarity;
      if (raw === undefined || raw === null || raw === '') return '-';
      if (typeof raw === 'number') return raw.toLocaleString();
      if (Array.isArray(raw)) {
        const values = raw.map((v) => String(v ?? '').trim()).filter(Boolean);
        return values.length ? values.join(', ') : '-';
      }
      if (typeof raw === 'object') {
        const values = Object.values(raw).map((v) => String(v ?? '').trim()).filter(Boolean);
        return values.length ? values.join(', ') : '-';
      }
      return String(raw).trim() || '-';
    };

    const cachedVisible: Record<string, string> = {};
    for (const listing of visibleFilteredListings) {
      const cached = rareSatsCacheRef.current[listing.inscription_id];
      if (cached && cached !== '-') cachedVisible[listing.inscription_id] = cached;
    }
    if (Object.keys(cachedVisible).length > 0) {
      setListingRareSatsByInscription((prev) => ({ ...prev, ...cachedVisible }));
    }

    const missingIds = visibleFilteredListings
      .filter((listing) => {
        const base = getBaseRareSats(listing);
        const cached = rareSatsCacheRef.current[listing.inscription_id];
        return base === '-' && cached === undefined;
      })
      .map((listing) => listing.inscription_id)
      .slice(0, 24);

    if (!missingIds.length) return;

    const hydrate = async () => {
      for (let i = 0; i < missingIds.length; i += 12) {
        const chunk = missingIds.slice(i, i + 12);
        let details: Array<readonly [string, string]> = [];
        const byId = new Map<string, string>();
        try {
          const batch = await getMarketplaceRareSatsBatch(chunk);
          for (const item of batch.items || []) {
            const id = getBatchItemId(item);
            if (!id) continue;
            byId.set(id, normalizeRareSatsDisplay(getBatchItemRareSats(item)));
          }
        } catch {
          // Ignore batch errors and continue with detail fallback.
        }
        await hydrateRareSatsFromDetailFallback(chunk, byId);
        details = chunk.map((id) => {
          const normalized = byId.get(id) || '-';
          if (normalized !== '-') {
            rareSatsCacheRef.current[id] = normalized;
          }
          return [id, normalized] as const;
        });

        if (cancelled) return;
        const found: Record<string, string> = {};
        for (const [id, value] of details) {
          if (value && value !== '-') found[id] = value;
        }
        if (Object.keys(found).length > 0) {
          setListingRareSatsByInscription((prev) => ({ ...prev, ...found }));
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [visibleFilteredListings]);

  useEffect(() => {
    setVisibleListingsCount(INITIAL_LISTINGS_VISIBLE);
  }, [searchQuery, collectionFilter, sortMode, selectedTraitFilters, listings.length]);

  useEffect(() => {
    if (listingsLoading || !hasMoreFilteredListings) return;
    const node = listingsLoadMoreRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        setVisibleListingsCount((prev) =>
          Math.min(prev + LISTINGS_LOAD_STEP, filteredListings.length)
        );
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [listingsLoading, hasMoreFilteredListings, filteredListings.length]);

  useEffect(() => {
    if (walletState.connected) {
      setWalletConnectModalOpen(false);
    }
  }, [walletState.connected]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 rounded-2xl border border-red-600/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Marketplace</h1>
              <p className="text-sm text-gray-400 mt-1">
                Marketplace for RichArt Stuff
              </p>
            </div>
            <div className="w-full md:w-auto flex flex-col gap-2 md:items-end">
              <div className="text-xs uppercase text-gray-400">Connected</div>
              {walletState.connected ? (
                <div className="text-xs font-mono bg-black/60 border border-white/15 rounded px-2 py-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                  {walletState.accounts?.[0]?.address || 'No wallet'}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setWalletConnectModalOpen(true)}
                  className="text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded px-3 py-1.5"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Floor</div>
              <div className="mt-1 text-lg font-bold font-mono">{floorPriceSats ? floorPriceSats.toLocaleString() : '-'} sats</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Volume</div>
              <div className="mt-1 text-lg font-bold font-mono">{volumeSoldSats.toLocaleString()} sats</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Sales 24h</div>
              <div className="mt-1 text-lg font-bold">{sold24h}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
              <div className="text-[11px] uppercase text-gray-400">Active Listings</div>
              <div className="mt-1 text-lg font-bold">{totalListed}</div>
            </div>
          </div>
        </div>

        {walletState.connected ? (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/marketplace/profile')}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            >
              Open My Marketplace Profile
            </button>
            {isAdminWallet && (
              <button
                onClick={() => setShowAdminTools((v) => !v)}
                className="px-4 py-2 rounded-lg bg-zinc-800 border border-white/15 hover:bg-zinc-700 text-sm font-semibold"
              >
                {showAdminTools ? 'Hide Admin Listing Tools' : 'Show Admin Listing Tools'}
              </button>
            )}
          </div>
        ) : null}

        {showAdminTools && walletState.connected && isAdminWallet && (
          <div className="mb-8 border border-white/20 rounded-xl p-4 bg-zinc-900/40">
            <h2 className="font-bold mb-3">Create Listing (Admin)</h2>
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

        <div className="mb-6 rounded-xl border border-white/15 bg-zinc-950/70 p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inscription / collection / seller"
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All collections</option>
              {collectionOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'latest' | 'price-asc' | 'price-desc')}
              className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"
            >
              <option value="latest">Sort: Latest</option>
              <option value="price-asc">Sort: Price Low -&gt; High</option>
              <option value="price-desc">Sort: Price High -&gt; Low</option>
            </select>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Showing {visibleFilteredListings.length} of {filteredListings.length} listing(s) • Avg price {avgPriceSats.toLocaleString()} sats
          </div>
        </div>

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

        {walletConnectModalOpen && !walletState.connected && (
          <div className="fixed inset-0 z-[150] bg-black/80 p-4 overflow-auto" onClick={() => setWalletConnectModalOpen(false)}>
            <div
              className="max-w-xl mx-auto mt-10 border border-white/20 rounded-xl bg-zinc-950 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Connect Wallet</h3>
                <button
                  type="button"
                  onClick={() => setWalletConnectModalOpen(false)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
                >
                  Close
                </button>
              </div>
              <WalletConnect />
            </div>
          </div>
        )}

        <div className="mb-8 rounded-xl border border-white/15 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold">Collections</h2>
            <div className="flex items-center gap-2">
              <select
                value={collectionViewMode}
                onChange={(e) => setCollectionViewMode(e.target.value as 'all' | 'my-items')}
                className="bg-black border border-white/20 rounded px-2 py-1 text-xs"
              >
                <option value="all">All Collections</option>
                <option value="my-items">My Items</option>
              </select>
              <span className="text-xs text-gray-400">Open a collection to browse all inscriptions</span>
            </div>
          </div>
          {collectionsLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading collections...</div>
          ) : collectionsMeta.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No collections available.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 p-2">
              {orderedCollectionsMeta
                .filter((c) => c.active !== false)
                .filter((c) => {
                  if (collectionViewMode === 'all') return true;
                  if (myItemCollectionSlugs.includes(c.slug)) return true;
                  // ID-based join fallback: when we have wallet IDs, keep collections visible
                  // and let modal filter by inscription_id membership.
                  return myWalletInscriptionIds.size > 0;
                })
                .map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => loadCollectionInscriptions(c.slug)}
                    className="text-left rounded-lg border border-white/10 bg-zinc-900/60 hover:border-red-500/40 transition-colors overflow-hidden max-w-[11rem]"
                  >
                    <div className="aspect-square bg-zinc-900">
                      {c.cover_image ? (
                        <img src={c.cover_image} alt={c.name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No cover</div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {typeof collectionTotalsBySlug[c.slug] === 'number'
                          ? `${Number(collectionTotalsBySlug[c.slug] ?? 0).toLocaleString()} items`
                          : 'items: -'}
                      </div>
                      <div className="text-[11px] text-gray-500">{c.slug}</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
          {collectionViewMode === 'my-items' && myCollectionsLoading && (
            <div className="px-4 pb-4 text-xs text-amber-300">Loading My Items from Taproot wallet...</div>
          )}
          {collectionViewMode === 'my-items' && !myCollectionsLoading && myWalletInscriptionIds.size > 0 && myItemCollectionSlugs.length === 0 && (
            <div className="px-4 pb-4 text-xs text-amber-300">
              My wallet has inscriptions, but collection mapping is not available yet. Open `My Marketplace Profile` to verify IDs.
            </div>
          )}
          {collectionViewMode === 'my-items' && !myCollectionsLoading && !walletState.connected && (
            <div className="px-4 pb-4 text-xs text-amber-300">
              Connect wallet first to load `My Items`.
            </div>
          )}
          {collectionViewMode === 'my-items' && !myCollectionsLoading && walletState.connected && myWalletInscriptionIds.size === 0 && (
            <div className="px-4 pb-4 text-xs text-gray-400">
              No Taproot inscriptions found for current wallet.
            </div>
          )}
          {collectionViewMode === 'my-items' && !myCollectionsLoading && myWalletInscriptionIds.size > 0 && (
            <div className="px-3 pb-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-400">My wallet items (direct preview)</span>
                <span className="text-gray-500">Selected: {selectedMyItemIds.size}</span>
                <button
                  type="button"
                  onClick={() => setSelectedMyItemIds(new Set(myWalletIdsForGallery))}
                  disabled={bulkListRunning}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Select visible
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMyItemIds(new Set())}
                  disabled={bulkListRunning || selectedMyItemIds.size === 0}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <div className="mb-3 rounded border border-white/10 bg-zinc-900/50 p-2">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input
                    value={bulkListBasePriceSats}
                    onChange={(e) => setBulkListBasePriceSats(e.target.value)}
                    placeholder="Base price (sats)"
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  />
                  <input
                    value={bulkListStepSats}
                    onChange={(e) => setBulkListStepSats(e.target.value)}
                    placeholder="Ladder step (sats)"
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  />
                  <select
                    value={bulkListDirection}
                    onChange={(e) => setBulkListDirection(e.target.value as 'up' | 'down')}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  >
                    <option value="up">Ladder: up (+step)</option>
                    <option value="down">Ladder: down (-step)</option>
                  </select>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={handleBulkListMyItems}
                      disabled={!walletState.connected || bulkListRunning || selectedMyItemIds.size === 0}
                      className="w-full px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-xs font-semibold"
                    >
                      {bulkListRunning ? 'Listing selected items...' : `List selected (${selectedMyItemIds.size})`}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10 gap-2">
                {myWalletIdsForGallery.map((inscriptionId) => (
                  <button
                    key={inscriptionId}
                    type="button"
                    onClick={() => handleOpenInscriptionDetail(inscriptionId)}
                    className={`relative rounded-md border bg-zinc-900/60 overflow-hidden transition-colors ${
                      selectedMyItemIds.has(inscriptionId)
                        ? 'border-red-500/70'
                        : 'border-white/10 hover:border-red-500/40'
                    }`}
                    title={inscriptionId}
                  >
                    <div className="absolute z-10 mt-1 ml-1">
                      <input
                        type="checkbox"
                        checked={selectedMyItemIds.has(inscriptionId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedMyItemIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(inscriptionId)) next.delete(inscriptionId);
                            else next.add(inscriptionId);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 accent-red-600"
                      />
                    </div>
                    <PreviewImage
                      inscriptionId={inscriptionId}
                      alt={inscriptionId}
                      className="w-full aspect-square"
                      fit="contain"
                      lightweight
                    />
                    <div className="px-1 py-1 text-[9px] font-mono text-gray-400 truncate">
                      {inscriptionId}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {collectionModalOpen && selectedCollectionSlug && (
          <div
            className="fixed inset-0 z-[110] bg-black/85 p-4 overflow-auto"
            onClick={() => setCollectionModalOpen(false)}
          >
            <div
              className="max-w-7xl mx-auto bg-zinc-950 border border-white/15 rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <h2 className="font-bold">
                  Collection View: <span className="text-red-300">{selectedCollectionSlug}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Search id/name/owner"
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => loadCollectionInscriptions(selectedCollectionSlug, collectionSearch)}
                    className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs"
                  >
                    Search
                  </button>
                  <span className="text-xs text-gray-400">Total: {collectionInscriptionsTotal}</span>
                  <span className="text-xs text-gray-500">Loaded: {collectionInscriptions.length}</span>
                  <button
                    type="button"
                    onClick={() => setCollectionModalOpen(false)}
                    className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 border-b border-white/10 bg-zinc-950/70">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <select
                    value={collectionSortMode}
                    onChange={(e) => setCollectionSortMode(e.target.value as typeof collectionSortMode)}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  >
                    <option value="price-asc">Sort: Price Low -&gt; High</option>
                    <option value="price-desc">Sort: Price High -&gt; Low</option>
                    <option value="rarity-desc">Sort: Rarity High -&gt; Low</option>
                    <option value="rarity-asc">Sort: Rarity Low -&gt; High</option>
                    <option value="score-desc">Sort: Score High -&gt; Low</option>
                    <option value="score-asc">Sort: Score Low -&gt; High</option>
                    <option value="name-asc">Sort: Name A -&gt; Z</option>
                    <option value="name-desc">Sort: Name Z -&gt; A</option>
                  </select>
                  <select
                    value={collectionRarityFilter}
                    onChange={(e) => setCollectionRarityFilter(e.target.value as typeof collectionRarityFilter)}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  >
                    <option value="all">Rarity: All</option>
                    <option value="mythic">Mythic</option>
                    <option value="legendary">Legendary</option>
                    <option value="epic">Epic</option>
                    <option value="rare">Rare</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="common">Common</option>
                  </select>
                  <select
                    value={collectionItemsFilter}
                    onChange={(e) => setCollectionItemsFilter(e.target.value as 'all' | 'my-items')}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  >
                    <option value="all">Items: All</option>
                    <option value="my-items">Items: My Items</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCollectionTraitFilters((v) => !v)}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs text-left hover:bg-zinc-900"
                  >
                    Traits Filter {selectedCollectionTraitCount > 0 ? `(${selectedCollectionTraitCount})` : ''}
                  </button>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>
                      Showing {filteredCollectionInscriptions.length} / {collectionInscriptions.length} loaded
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border ${
                        collectionInscriptionsTotal > 0 && collectionInscriptions.length >= collectionInscriptionsTotal
                          ? 'border-emerald-600/60 bg-emerald-900/20 text-emerald-300'
                          : 'border-amber-600/60 bg-amber-900/20 text-amber-300'
                      }`}
                      title="Trait counts are calculated from currently loaded inscriptions"
                    >
                      Traits based on {collectionInscriptions.length}/{collectionInscriptionsTotal || 0}
                    </span>
                  </div>
                </div>
                {showCollectionTraitFilters && (
                  <div className="mt-2 rounded border border-white/10 bg-black/40 p-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-400">Filter this collection by trait values</div>
                      <button
                        type="button"
                        onClick={() => setCollectionSelectedTraitFilters({})}
                        className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                      >
                        Clear Traits
                      </button>
                    </div>
                    {collectionTraitOptions.length === 0 ? (
                      <div className="text-xs text-gray-500">No traits available.</div>
                    ) : (
                      <div className="space-y-2 max-h-44 overflow-auto pr-1">
                        {collectionTraitOptions.map((group) => (
                          <div key={group.traitType} className="border border-white/10 rounded p-2">
                            <div className="text-xs font-semibold text-gray-300 mb-1">{group.traitType}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {group.values.slice(0, 40).map((entry) => {
                                const selected = (collectionSelectedTraitFilters[group.traitType] || []).includes(entry.value);
                                return (
                                  <button
                                    key={`${group.traitType}-${entry.value}`}
                                    type="button"
                                    onClick={() => {
                                      setCollectionSelectedTraitFilters((prev) => {
                                        const current = prev[group.traitType] || [];
                                        const nextValues = current.includes(entry.value)
                                          ? current.filter((v) => v !== entry.value)
                                          : [...current, entry.value];
                                        const next = { ...prev, [group.traitType]: nextValues };
                                        if (nextValues.length === 0) delete next[group.traitType];
                                        return next;
                                      });
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] border ${
                                      selected
                                        ? 'bg-red-600/30 border-red-500/70 text-red-100'
                                        : 'bg-zinc-800 border-zinc-600 text-gray-200 hover:bg-zinc-700'
                                    }`}
                                  >
                                    {entry.value} ({entry.count})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {collectionLoading ? (
                <div className="p-4 text-sm text-gray-400">Loading inscriptions...</div>
              ) : filteredCollectionInscriptions.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {collectionItemsFilter === 'my-items' && !walletState.connected
                    ? 'Connect wallet to see items.'
                    : 'No inscriptions found for this collection.'}
                </div>
              ) : (
                <div className="p-2">
                  {collectionItemsFilter === 'my-items' && (
                    <div className="mb-2 rounded border border-white/10 bg-zinc-900/40 p-2">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-300">My Items selection in Collection View</span>
                        <span className="text-gray-500">Selected: {selectedMyItemIds.size}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMyItemIds(new Set(filteredCollectionInscriptions.map((ins) => ins.inscription_id)))
                          }
                          disabled={bulkListRunning || filteredCollectionInscriptions.length === 0}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          Select visible
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedMyItemIds(new Set())}
                          disabled={bulkListRunning || selectedMyItemIds.size === 0}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <input
                          value={bulkListBasePriceSats}
                          onChange={(e) => setBulkListBasePriceSats(e.target.value)}
                          placeholder="Base price (sats)"
                          className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                        />
                        <input
                          value={bulkListStepSats}
                          onChange={(e) => setBulkListStepSats(e.target.value)}
                          placeholder="Ladder step (sats)"
                          className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                        />
                        <select
                          value={bulkListDirection}
                          onChange={(e) => setBulkListDirection(e.target.value as 'up' | 'down')}
                          className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                        >
                          <option value="up">Ladder: up (+step)</option>
                          <option value="down">Ladder: down (-step)</option>
                        </select>
                        <div className="md:col-span-2">
                          <button
                            type="button"
                            onClick={handleBulkListMyItems}
                            disabled={!walletState.connected || bulkListRunning || selectedMyItemIds.size === 0}
                            className="w-full px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-xs font-semibold"
                          >
                            {bulkListRunning ? 'Listing selected items...' : `List selected (${selectedMyItemIds.size})`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                    {filteredCollectionInscriptions.map((ins) => {
                    const rarity = extractInscriptionRarity(ins);
                    // Collection view must be resilient across mixed media types (AVIF/SVG/HTML/3D/recursive).
                    // Force iframe-capable rendering path here for maximum compatibility.
                    const preferIframePreview = true;
                    const rareSats = collectionRareSatsByInscription[ins.inscription_id] || extractInscriptionRareSats(ins);
                    const score = collectionCompositeRarityByInscription.rawScores.get(ins.inscription_id) || 0;
                    const isOneOfOne = collectionCompositeRarityByInscription.forceTopRarityById.get(ins.inscription_id) || false;
                    const rarityPercentile = collectionCompositeRarityByInscription.percentileById.get(ins.inscription_id) || 0;
                    const compositeLabel = isOneOfOne ? 'mythic' : compositeRarityLabel(rarityPercentile);
                    const activeListing =
                      collectionActiveListingsByInscription[ins.inscription_id] ||
                      listings.find((l) => l.inscription_id === ins.inscription_id && String(l.status || '').toLowerCase() === 'active') ||
                      null;
                    const listingPriceSats = Number(activeListing?.price_sats || 0);
                    const isOwnListing =
                      !!currentAddress &&
                      !!activeListing &&
                      String(activeListing.seller_address || '').toLowerCase() === currentAddress.toLowerCase();
                    const buyBusy = !!activeListing && busyListingId === activeListing.id;
                    return (
                      <div
                        key={ins.inscription_id}
                        className={`relative rounded-md border bg-zinc-900/60 overflow-hidden transition-colors ${
                          selectedMyItemIds.has(ins.inscription_id)
                            ? 'border-red-500/70'
                            : 'border-white/10 hover:border-red-500/40'
                        }`}
                      >
                        {collectionItemsFilter === 'my-items' && (
                          <div className="absolute z-10 mt-1 ml-1">
                            <input
                              type="checkbox"
                              checked={selectedMyItemIds.has(ins.inscription_id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedMyItemIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(ins.inscription_id)) next.delete(ins.inscription_id);
                                  else next.add(ins.inscription_id);
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 accent-red-600"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenInscriptionDetail(ins.inscription_id)}
                          className="block w-full text-left"
                        >
                        <PreviewImage
                          inscriptionId={ins.inscription_id}
                          alt={ins.inscription_id}
                          className="w-full aspect-square"
                          fit="contain"
                          preferIframe={preferIframePreview}
                          preferredSources={[
                            String(ins.previewUrl || '').trim(),
                            String(ins.contentUrl || '').trim(),
                          ]}
                        />
                        <div className="p-1.5">
                          <div className="text-[10px] font-mono text-gray-300 truncate">
                            {String(ins.metadata?.name || ins.inscription_id)}
                          </div>
                          <div className="text-[9px] text-gray-500 truncate">{ins.inscription_id}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[9px] px-1 py-0.5 rounded border border-violet-700/40 bg-violet-900/30 text-violet-200">
                              Rarity: {compositeLabel}
                            </span>
                            {isOneOfOne && (
                              <span className="text-[9px] px-1 py-0.5 rounded border border-red-600/60 bg-red-900/30 text-red-200">
                                1:1
                              </span>
                            )}
                            <span
                              className="text-[9px] px-1 py-0.5 rounded border border-amber-700/40 bg-amber-900/30 text-amber-200 font-mono"
                              title={toRareSatTooltip(rareSats)}
                            >
                              {toRareSatSymbols(rareSats)}
                            </span>
                            <span className="text-[9px] px-1 py-0.5 rounded border border-fuchsia-700/40 bg-fuchsia-900/30 text-fuchsia-200">
                              Score: {score > 0 ? score.toFixed(1) : '-'}
                            </span>
                            {rarity !== '-' && (
                              <span className="text-[9px] px-1 py-0.5 rounded border border-zinc-600/50 bg-zinc-800/40 text-zinc-200">
                                Meta: {rarity}
                              </span>
                            )}
                            {activeListing && listingPriceSats > 0 && (
                              <span className="text-[9px] px-1 py-0.5 rounded border border-emerald-700/40 bg-emerald-900/30 text-emerald-200 font-mono">
                                Price: {listingPriceSats.toLocaleString()} sats
                              </span>
                            )}
                          </div>
                        </div>
                        </button>
                        {activeListing && listingPriceSats > 0 && (
                          <div className="px-1.5 pb-1.5">
                            {isOwnListing ? (
                              <div className="text-[10px] text-gray-400">Listed by you</div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={!walletState.connected || buyBusy || !activeListing.signed_psbt_base64}
                                  onClick={() => handleBuyListing(activeListing)}
                                  className="w-full px-2 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-[10px] font-semibold"
                                  title={
                                    activeListing.signed_psbt_base64
                                      ? `Buy for ${listingPriceSats.toLocaleString()} sats + network fee`
                                      : 'Legacy listing without PSBT. Seller must relist.'
                                  }
                                >
                                  {buyBusy
                                    ? 'Buying...'
                                    : activeListing.signed_psbt_base64
                                      ? `Buy for ${listingPriceSats.toLocaleString()} sats + fee`
                                      : 'Relist required'}
                                </button>
                                {activeListing.signed_psbt_base64 && (
                                  <div className="mt-1 text-[9px] text-gray-400">
                                    You pay: {listingPriceSats.toLocaleString()} sats + network fee (exact fee shown before signing)
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                  {collectionInscriptions.length < collectionInscriptionsTotal && (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        onClick={() => loadCollectionInscriptions(selectedCollectionSlug, collectionSearch, true)}
                        disabled={collectionLoadingMore}
                        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs"
                      >
                        {collectionLoadingMore ? 'Loading more...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Active Listings</h2>
            <span className="text-xs text-gray-400">Preview-first cards</span>
          </div>
          {listingsLoading ? (
            <div className="rounded-xl border border-white/15 p-4 text-sm text-gray-400">Loading listings...</div>
          ) : filteredListings.length === 0 ? (
            <div className="rounded-xl border border-white/15 p-8 text-center bg-zinc-950/60">
              <div className="text-4xl mb-2">🧭</div>
              <div className="text-base font-semibold">No listings for current filters</div>
              <div className="text-sm text-gray-400 mt-1">Try another collection or search term.</div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCollectionFilter('all');
                }}
                className="mt-3 px-3 py-2 rounded border border-white/15 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
              {visibleFilteredListings.map((l) => {
                const isOwn = currentAddress && l.seller_address.toLowerCase() === currentAddress.toLowerCase();
                const isBusy = busyListingId === l.id;
                const rarityLabel = String(
                  l.inscription_metadata?.derivedRarityTier ||
                  l.inscription_metadata?.rarity ||
                  ''
                ).trim();
                const traitsCount = extractTraits(l).length;
                const rareSatsLabel = listingRareSatsByInscription[l.inscription_id] || extractRareSats(l);
                return (
                  <div
                    key={l.id}
                    className="group rounded-lg border border-white/15 bg-zinc-950/70 overflow-hidden hover:border-red-500/60 hover:shadow-[0_0_18px_rgba(239,68,68,0.25)] transition-all"
                  >
                    <div className="relative aspect-square bg-zinc-900">
                      <PreviewImage
                        inscriptionId={l.inscription_id}
                        alt={l.inscription_id}
                        className="h-full w-full"
                        imageClassName="group-hover:scale-[1.03] transition-transform duration-300"
                        fit="contain"
                        lightweight
                      />
                      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 border border-white/20 text-[10px] font-mono">
                        {Number(l.price_sats || 0).toLocaleString()} sats
                      </div>
                      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute inset-x-2 bottom-2 rounded-lg border border-white/20 bg-black/80 backdrop-blur-sm p-2">
                          <div className="flex items-center justify-between gap-2 text-[10px] text-gray-200">
                            <span className="uppercase tracking-wide text-gray-400">Quick Details</span>
                            {rarityLabel ? (
                              <span className="uppercase tracking-wide text-violet-200 bg-violet-900/40 border border-violet-700/40 rounded px-1.5 py-0.5">
                                {rarityLabel}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-gray-300">
                            <div className="truncate">
                              <span className="text-gray-500">ID:</span> {l.inscription_id.slice(0, 8)}...{l.inscription_id.slice(-4)}
                            </div>
                            <div className="truncate">
                              <span className="text-gray-500">Traits:</span> {traitsCount}
                            </div>
                            <div className="truncate">
                              <span className="text-gray-500">Owner:</span> {l.seller_address.slice(0, 6)}...{l.seller_address.slice(-4)}
                            </div>
                            <div className="truncate">
                              <span className="text-gray-500">Price:</span> {Number(l.price_sats || 0).toLocaleString()} sats
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold truncate">{l.collection_slug}</div>
                        <div className="flex items-center gap-1">
                          {rarityLabel && (
                            <span className="text-[10px] uppercase tracking-wide text-violet-200 bg-violet-900/40 border border-violet-700/40 rounded px-1.5 py-0.5">
                              {rarityLabel}
                            </span>
                          )}
                          {verifiedCollectionSet.has(String(l.collection_slug || '')) && (
                            <span className="text-[10px] uppercase tracking-wide text-sky-200 bg-sky-900/40 border border-sky-700/40 rounded px-1.5 py-0.5">
                              Verified
                            </span>
                          )}
                          {Number(l.price_sats || 0) >= highValueThreshold && highValueThreshold > 0 && (
                            <span className="text-[10px] uppercase tracking-wide text-amber-200 bg-amber-900/40 border border-amber-700/40 rounded px-1.5 py-0.5">
                              Rare
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-900/30 border border-emerald-700/40 rounded px-1.5 py-0.5">
                            Active
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-gray-400">
                        {l.inscription_id.slice(0, 12)}...{l.inscription_id.slice(-6)}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Seller: <span className="font-mono">{l.seller_address.slice(0, 8)}...{l.seller_address.slice(-6)}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono" title={toRareSatTooltip(rareSatsLabel)}>
                        {toRareSatSymbols(rareSatsLabel)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {extractTraits(l)
                          .slice(0, 3)
                          .map((t, idx) => (
                            <span
                              key={`${l.id}-${t.trait_type}-${t.value}-${idx}`}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-black/30 text-gray-200"
                            >
                              {t.trait_type}: {t.value}
                            </span>
                          ))}
                      </div>
                      {isOwn ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(l)}
                            className="px-1.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold"
                          >
                            Details
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleCancelListing(l.id)}
                            className="px-1.5 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-[11px] font-semibold"
                          >
                            {isBusy ? 'Working...' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(l)}
                            className="px-1.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold"
                          >
                            Details
                          </button>
                          <button
                            disabled={!walletState.connected || isBusy || !l.signed_psbt_base64}
                            onClick={() => handleBuyListing(l)}
                            className="px-1.5 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-[11px] font-semibold"
                            title={
                              l.signed_psbt_base64
                                ? `Buy for ${Number(l.price_sats || 0).toLocaleString()} sats + network fee`
                                : 'Legacy listing without PSBT. Seller must relist.'
                            }
                          >
                            {isBusy
                              ? 'Buying...'
                              : l.signed_psbt_base64
                                ? `Buy ${Number(l.price_sats || 0).toLocaleString()} + fee`
                                : 'Relist required'}
                          </button>
                        </div>
                      )}
                      {!isOwn && l.signed_psbt_base64 && (
                        <div className="text-[10px] text-gray-400">
                          Buyer pays: {Number(l.price_sats || 0).toLocaleString()} sats + network fee
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!listingsLoading && filteredListings.length > 0 && hasMoreFilteredListings && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <div ref={listingsLoadMoreRef} className="h-1 w-full" />
              <button
                type="button"
                onClick={() => setVisibleListingsCount((prev) => prev + LISTINGS_LOAD_STEP)}
                className="px-4 py-2 rounded-lg bg-zinc-800 border border-white/15 hover:bg-zinc-700 text-sm font-semibold"
              >
                Load more ({Math.min(LISTINGS_LOAD_STEP, filteredListings.length - visibleListingsCount)} more)
              </button>
              <div className="text-[11px] text-gray-500">Auto-loading while scrolling</div>
            </div>
          )}
        </div>

        <div className="mb-8 rounded-xl border border-white/15 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold">Recently Sold</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-zinc-700 text-zinc-100">Legacy</span>
              <span className="px-2 py-1 rounded bg-emerald-700/80 text-emerald-100">PSBT</span>
            </div>
          </div>
          {listingsLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading sold listings...</div>
          ) : soldListings.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 flex items-center gap-2">
              <span className="text-xl">🧾</span>
              <span>No sold listings yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {soldListings.slice(0, 12).map((s) => {
                const source = String(s.sale_metadata?.source || '');
                const advanced = source.includes('advanced-psbt');
                const soldPreferIframe = /(badcats|bad-cats|bchalloween|halloween)/i.test(
                  String(s.collection_slug || '')
                );
                return (
                  <div key={s.id} className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 hover:border-red-500/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <PreviewImage
                        inscriptionId={s.inscription_id}
                        alt={s.inscription_id}
                        className="w-16 h-16 rounded border border-white/10 shrink-0"
                        fit="contain"
                        lightweight={!soldPreferIframe}
                        preferIframe={soldPreferIframe}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.collection_slug}</div>
                        <div className="text-xs font-mono text-gray-400 truncate">
                          {s.inscription_id.slice(0, 14)}...{s.inscription_id.slice(-6)}
                        </div>
                        <div className="text-xs mt-1 font-mono">{Number(s.price_sats || 0).toLocaleString()} sats</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs rounded ${advanced ? 'bg-emerald-700/80 text-emerald-100' : 'bg-zinc-700 text-zinc-100'}`}>
                        {advanced ? 'Advanced PSBT' : 'Simple'}
                      </span>
                      {s.sale_txid ? (
                        <a
                          href={`https://mempool.space/tx/${s.sale_txid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-red-300 hover:text-red-200 underline"
                        >
                          TX
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">No TX</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/15 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10">
            <h2 className="font-bold">Collection Ranking</h2>
          </div>
          {rankingLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading ranking...</div>
          ) : ranking.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 flex items-center gap-2">
              <span className="text-xl">📊</span>
              <span>No ranking data yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {ranking.slice(0, 12).map((row) => (
                <div key={row.slug} className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 hover:border-red-500/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold truncate flex items-center gap-2">
                        <span>{row.name}</span>
                        {verifiedCollectionSet.has(String(row.slug || '')) && (
                          <span className="text-[10px] uppercase tracking-wide text-sky-200 bg-sky-900/40 border border-sky-700/40 rounded px-1.5 py-0.5">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{row.slug}</div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded border border-white/10 bg-black/40">
                      Listed: {row.listed_count || 0}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="rounded border border-white/10 p-2">
                      <div className="text-gray-500">Floor</div>
                      <div className="font-mono">{Number(row.floor_price_sats || 0).toLocaleString()}</div>
                    </div>
                    <div className="rounded border border-white/10 p-2">
                      <div className="text-gray-500">7d Sales</div>
                      <div>{row.sales_count_7d || 0}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 p-4 overflow-auto">
          <div className="max-w-5xl mx-auto bg-zinc-950 border border-white/15 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="font-bold text-lg">Ordinal Detail Preview</h3>
              <button
                onClick={() => {
                  setDetailOpen(false);
                  setSelectedInscriptionDetail(null);
                  setSelectedDetailListing(null);
                  syncDetailQuery(selectedCollectionSlug, '');
                }}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
              >
                Close
              </button>
            </div>

            {detailLoading ? (
              <div className="p-4 text-sm text-gray-400">Loading details...</div>
            ) : !selectedInscriptionDetail ? (
              <div className="p-4 text-sm text-gray-400">No detail data available.</div>
            ) : (
              <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-1 space-y-3">
                  <PreviewImage
                    inscriptionId={selectedInscriptionDetail.inscriptionId}
                    alt={selectedInscriptionDetail.inscriptionId}
                    className="w-full max-w-[520px] aspect-square rounded border border-white/10 mx-auto bg-zinc-900"
                    fit="contain"
                  />
                  <div className="text-xs font-mono text-gray-300 break-all">
                    {selectedInscriptionDetail.inscriptionId}
                  </div>
                  <a
                    href={selectedInscriptionDetail.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-red-300 hover:text-red-200 underline"
                  >
                    Open Content
                  </a>
                </div>

                <div className="xl:col-span-2 space-y-4">
                  <div className="rounded border border-white/10 p-3">
                    <div className="text-lg font-semibold">{String(selectedInscriptionDetail.marketplaceInscription?.metadata?.name || 'Ordinal')}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {String(selectedInscriptionDetail.marketplaceInscription?.collection_slug || selectedDetailListing?.collection_slug || '')}
                      {' '}• Recursive • On-Chain
                    </div>
                    <div className="mt-3 border-b border-white/10">
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: 'traits', label: 'Traits' },
                          { id: 'offers', label: 'Offers' },
                          { id: 'activity', label: 'Activity' },
                          { id: 'price', label: 'Price History' },
                          { id: 'details', label: 'Details' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDetailTab(tab.id as typeof detailTab)}
                            className={`px-3 py-1.5 text-xs rounded-t ${
                              detailTab === tab.id
                                ? 'bg-zinc-800 text-white border border-white/15 border-b-0'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const detailOwner = String(
                      selectedInscriptionDetail.marketplaceInscription?.owner_address ||
                        selectedInscriptionDetail.chainInfo?.ownerAddress ||
                        selectedInscriptionDetail.chainInfo?.owner_address ||
                        selectedInscriptionDetail.chainInfo?.address ||
                        ''
                    )
                      .trim()
                      .toLowerCase();
                    const myAddress = String(currentAddress || '').trim().toLowerCase();
                    const amOwner = !!myAddress && !!detailOwner && myAddress === detailOwner;

                    if (!selectedDetailListing) {
                      return (
                        <div className="rounded border border-white/10 p-3">
                          <div className="text-xs text-gray-400 mb-2">Listing</div>
                          {amOwner ? (
                            <div className="space-y-2">
                              <div className="text-xs text-gray-300">This is your item. Create a listing:</div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  value={detailListPriceSats}
                                  onChange={(e) => setDetailListPriceSats(e.target.value)}
                                  placeholder="List price (sats)"
                                  className="bg-black border border-white/15 rounded px-2 py-2 text-xs"
                                />
                                <div className="text-[11px] text-gray-500 flex items-center">
                                  Collection: {String(selectedInscriptionDetail.marketplaceInscription?.collection_slug || selectedCollectionSlug || 'unknown')}
                                </div>
                                <button
                                  disabled={!walletState.connected || busyListingId === selectedInscriptionDetail.inscriptionId}
                                  onClick={handleCreateListingFromDetail}
                                  className="px-3 py-2 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-xs font-semibold"
                                >
                                  {busyListingId === selectedInscriptionDetail.inscriptionId ? 'Listing...' : 'List Item'}
                                </button>
                              </div>
                              <div className="text-[11px] text-amber-300/90">
                                Listing is PSBT-signed (non-custodial). Buyers can only purchase via PSBT.
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              No active listing for this inscription right now. Offer/Buy becomes available as soon as it is listed.
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="rounded border border-white/10 p-3">
                        <div className="text-xs text-gray-400 mb-2">Offer / Buy</div>
                        {currentAddress &&
                        selectedDetailListing.seller_address.toLowerCase() === currentAddress.toLowerCase() ? (
                          <button
                            disabled={busyListingId === selectedDetailListing.id}
                            onClick={() => handleCancelListing(selectedDetailListing.id)}
                            className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-xs font-semibold"
                          >
                            {busyListingId === selectedDetailListing.id ? 'Working...' : 'Cancel Listing'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                value={offerPriceSats}
                                onChange={(e) => setOfferPriceSats(e.target.value)}
                                placeholder="Offer price (sats)"
                                className="bg-black border border-white/15 rounded px-2 py-2 text-xs"
                              />
                              <input
                                value={offerNote}
                                onChange={(e) => setOfferNote(e.target.value)}
                                placeholder="Optional note"
                                className="bg-black border border-white/15 rounded px-2 py-2 text-xs"
                              />
                              <button
                                disabled={!walletState.connected || offerSubmitting}
                                onClick={handleCreateOfferFromDetail}
                                className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold"
                                title="Submit price offer"
                              >
                                {offerSubmitting ? 'Submitting...' : 'Offer Buy'}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <button
                                disabled={!walletState.connected || busyListingId === selectedDetailListing.id || !selectedDetailListing.signed_psbt_base64}
                                onClick={() => handleBuyListing(selectedDetailListing)}
                                className="px-3 py-2 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-xs font-semibold"
                                title={
                                  selectedDetailListing.signed_psbt_base64
                                    ? 'PSBT buy'
                                    : 'Legacy listing without PSBT. Seller must relist.'
                                }
                              >
                                {busyListingId === selectedDetailListing.id
                                  ? 'Buying...'
                                  : (selectedDetailListing.signed_psbt_base64 ? 'Buy (PSBT)' : 'Relist required')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {detailTab === 'details' && (
                    <div className="rounded border border-white/10 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Inscription ID:</span> <span className="font-mono">{selectedInscriptionDetail.inscriptionId}</span></div>
                        <div><span className="text-gray-500">Inscription Number:</span> {detailTextValue(selectedInscriptionDetail.chainInfo?.inscriptionNumber, selectedInscriptionDetail.chainInfo?.inscription_number, selectedInscriptionDetail.chainInfo?.number)}</div>
                        <div><span className="text-gray-500">Owner:</span> <span className="font-mono">{detailTextValue(selectedInscriptionDetail.marketplaceInscription?.owner_address, selectedInscriptionDetail.chainInfo?.ownerAddress, selectedInscriptionDetail.chainInfo?.owner_address, selectedInscriptionDetail.chainInfo?.address)}</span></div>
                        <div><span className="text-gray-500">Content:</span> <a className="underline text-red-300 hover:text-red-200" target="_blank" rel="noreferrer" href={selectedInscriptionDetail.contentUrl}>Link</a></div>
                        <div><span className="text-gray-500">Content Type:</span> {detailTextValue(selectedInscriptionDetail.chainInfo?.contentType, selectedInscriptionDetail.chainInfo?.content_type, selectedInscriptionDetail.marketplaceInscription?.metadata?.contentType, selectedInscriptionDetail.marketplaceInscription?.metadata?.content_type)}</div>
                        <div><span className="text-gray-500">Created:</span> {detailTextValue(selectedInscriptionDetail.chainInfo?.timestamp, selectedInscriptionDetail.chainInfo?.created, selectedInscriptionDetail.marketplaceInscription?.metadata?.created, selectedInscriptionDetail.marketplaceInscription?.created_at)}</div>
                        <div><span className="text-gray-500">Genesis Tx:</span> <span className="font-mono">{detailTextValue(selectedInscriptionDetail.chainInfo?.genesisTransaction, selectedInscriptionDetail.chainInfo?.genesis_txid, selectedInscriptionDetail.chainInfo?.genesis_tx_id, selectedInscriptionDetail.marketplaceInscription?.metadata?.genesisTransaction, selectedInscriptionDetail.marketplaceInscription?.metadata?.genesis_txid, selectedInscriptionDetail.marketplaceInscription?.metadata?.genesis_tx_id)}</span></div>
                        <div><span className="text-gray-500">Genesis Block:</span> {detailTextValue(selectedInscriptionDetail.chainInfo?.genesisTransactionBlock, selectedInscriptionDetail.chainInfo?.genesis_block, selectedInscriptionDetail.chainInfo?.genesis_height, selectedInscriptionDetail.marketplaceInscription?.metadata?.genesisTransactionBlock, selectedInscriptionDetail.marketplaceInscription?.metadata?.genesis_block, selectedInscriptionDetail.marketplaceInscription?.metadata?.genesis_height)}</div>
                        <div><span className="text-gray-500">Location:</span> <span className="font-mono">{detailTextValue(selectedInscriptionDetail.chainInfo?.location, selectedInscriptionDetail.chainInfo?.satpoint, selectedInscriptionDetail.chainInfo?.sat_point, selectedInscriptionDetail.marketplaceInscription?.metadata?.location, selectedInscriptionDetail.marketplaceInscription?.metadata?.satpoint)}</span></div>
                        <div><span className="text-gray-500">Output:</span> <span className="font-mono">{detailTextValue(selectedInscriptionDetail.chainInfo?.output, selectedInscriptionDetail.chainInfo?.outpoint, selectedInscriptionDetail.marketplaceInscription?.metadata?.output, selectedInscriptionDetail.marketplaceInscription?.metadata?.outpoint)}</span></div>
                        <div><span className="text-gray-500">Rarity:</span> {detailTextValue(selectedInscriptionDetail.marketplaceInscription?.metadata?.derivedRarityTier, selectedInscriptionDetail.marketplaceInscription?.metadata?.rarity, selectedInscriptionDetail.chainInfo?.rarity, selectedInscriptionDetail.chainInfo?.sat_rarity, selectedInscriptionDetail.chainInfo?.satributes?.rarity)}</div>
                        <div>
                          <span className="text-gray-500">Satribute:</span>{' '}
                          <span
                            className="font-mono"
                            title={toRareSatTooltip(detailTextValue(selectedInscriptionDetail.chainInfo?.rareSats, selectedInscriptionDetail.chainInfo?.rare_sats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rareSats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rare_sats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rareSat, selectedInscriptionDetail.marketplaceInscription?.metadata?.rare_sat, selectedInscriptionDetail.marketplaceInscription?.metadata?.satributes?.rarity))}
                          >
                            {toRareSatSymbols(detailTextValue(selectedInscriptionDetail.chainInfo?.rareSats, selectedInscriptionDetail.chainInfo?.rare_sats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rareSats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rare_sats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rareSat, selectedInscriptionDetail.marketplaceInscription?.metadata?.rare_sat, selectedInscriptionDetail.marketplaceInscription?.metadata?.satributes?.rarity))}
                          </span>
                        </div>
                        <div><span className="text-gray-500">Sat number:</span> {detailTextValue(selectedInscriptionDetail.chainInfo?.satNumber, selectedInscriptionDetail.chainInfo?.sat_number, selectedInscriptionDetail.chainInfo?.sat, selectedInscriptionDetail.marketplaceInscription?.metadata?.satNumber, selectedInscriptionDetail.marketplaceInscription?.metadata?.sat_number, selectedInscriptionDetail.marketplaceInscription?.metadata?.sat)}</div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'traits' && (
                    <div className="rounded border border-white/10 p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(selectedInscriptionDetail.marketplaceInscription?.attributes) &&
                        selectedInscriptionDetail.marketplaceInscription!.attributes!.length > 0 ? (
                          selectedInscriptionDetail.marketplaceInscription!.attributes!.map((t, idx) => (
                            <span
                              key={`${t?.trait_type}-${t?.value}-${idx}`}
                              className={`text-[11px] px-2 py-1 rounded border ${(() => {
                                const traitType = String(t?.trait_type || '').trim();
                                const value = String(t?.value || '').trim();
                                const k = `${traitType}::${value}`;
                                const pct = collectionTraitPercentByKey.get(k);
                                return traitPctColorClass(pct);
                              })()}`}
                            >
                              {String(t?.trait_type || '?')}: {String(t?.value || '?')}
                              {(() => {
                                const traitType = String(t?.trait_type || '').trim();
                                const value = String(t?.value || '').trim();
                                if (!traitType || !value) return '';
                                const k = `${traitType}::${value}`;
                                const pct = collectionTraitPercentByKey.get(k);
                                return pct !== undefined ? ` (${pct.toFixed(1)}%)` : '';
                              })()}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No traits</span>
                        )}
                      </div>
                    </div>
                  )}

                  {detailTab === 'price' && (
                    <div className="rounded border border-white/10 p-3 max-h-72 overflow-auto">
                      {selectedInscriptionDetail.salesHistory.length === 0 ? (
                        <div className="text-xs text-gray-500">No sales yet.</div>
                      ) : (
                        selectedInscriptionDetail.salesHistory.map((s) => (
                          <div key={s.id} className="text-xs py-1 border-b border-white/5 last:border-b-0">
                            <div className="font-mono">{Number(s.price_sats || 0).toLocaleString()} sats</div>
                            <div className="text-gray-500">{String(s.sold_at || s.created_at || '')}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'activity' && (
                    <div className="rounded border border-white/10 p-3 max-h-72 overflow-auto">
                      {selectedInscriptionDetail.activity.length === 0 ? (
                        <div className="text-xs text-gray-500">No activity.</div>
                      ) : (
                        selectedInscriptionDetail.activity.map((a) => (
                          <div key={a.id} className="text-xs py-1 border-b border-white/5 last:border-b-0">
                            <div className="capitalize">{a.activity_type}</div>
                            <div className="text-gray-500">{String(a.created_at || '')}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'offers' && (
                    <div className="rounded border border-white/10 p-3 max-h-72 overflow-auto">
                      {selectedInscriptionDetail.offersHistory?.length === 0 ? (
                        <div className="text-xs text-gray-500">No offers yet.</div>
                      ) : (
                        (selectedInscriptionDetail.offersHistory || []).map((o) => (
                          <div key={o.id} className="text-xs py-1 border-b border-white/5 last:border-b-0">
                            <div className="font-mono">{Number(o.offer_price_sats || 0).toLocaleString()} sats</div>
                            <div className="text-gray-500">
                              {String(o.buyer_address || '').slice(0, 8)}...{String(o.buyer_address || '').slice(-6)} • {o.status}
                            </div>
                            {selectedDetailListing &&
                              currentAddress &&
                              selectedDetailListing.seller_address.toLowerCase() === currentAddress.toLowerCase() &&
                              o.status === 'active' && (
                                <div className="mt-1 flex gap-1">
                                  <button
                                    type="button"
                                    disabled={offerActionBusyId === o.id}
                                    onClick={() => handleOfferDecision(o.id, 'accept')}
                                    className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-[10px] font-semibold"
                                  >
                                    {offerActionBusyId === o.id ? 'Working...' : 'Accept'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={offerActionBusyId === o.id}
                                    onClick={() => handleOfferDecision(o.id, 'decline')}
                                    className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-[10px] font-semibold"
                                  >
                                    {offerActionBusyId === o.id ? 'Working...' : 'Decline'}
                                  </button>
                                </div>
                              )}
                            {selectedDetailListing &&
                              currentAddress &&
                              o.status === 'accepted' &&
                              (selectedDetailListing.seller_address.toLowerCase() === currentAddress.toLowerCase() ||
                                String(o.buyer_address || '').toLowerCase() === currentAddress.toLowerCase()) && (
                                <div className="mt-1.5 space-y-1">
                                  <input
                                    value={offerTxids[o.id] || ''}
                                    onChange={(e) =>
                                      setOfferTxids((prev) => ({ ...prev, [o.id]: e.target.value }))
                                    }
                                    placeholder="Payment txid (optional)"
                                    className="w-full bg-black border border-white/15 rounded px-2 py-1 text-[10px] font-mono"
                                  />
                                  <button
                                    type="button"
                                    disabled={offerCompleteBusyId === o.id}
                                    onClick={() => handleCompleteOfferSale(o.id)}
                                    className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-[10px] font-semibold"
                                  >
                                    {offerCompleteBusyId === o.id ? 'Completing...' : 'Finalize Sale'}
                                  </button>
                                </div>
                              )}
                            {o.status === 'completed' && (
                              <div className="text-[10px] text-emerald-300 mt-1">
                                Completed
                                {o.metadata?.paymentTxid ? (
                                  <>
                                    {' '}
                                    •{' '}
                                    <a
                                      href={`https://mempool.space/tx/${o.metadata.paymentTxid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline hover:text-emerald-200"
                                    >
                                      TX
                                    </a>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

