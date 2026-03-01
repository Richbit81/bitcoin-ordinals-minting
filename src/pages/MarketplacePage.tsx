import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import {
  acceptMarketplaceOffer,
  cancelMarketplaceListing,
  completeMarketplaceOfferSale,
  completeMarketplacePurchaseAdvanced,
  completeMarketplacePurchase,
  createMarketplaceOffer,
  createMarketplaceListing,
  getMarketplaceCollectionInscriptions,
  declineMarketplaceOffer,
  getMarketplaceCollections,
  getMarketplaceInscriptionDetail,
  getMarketplaceListings,
  getMarketplaceRareSatsBatch,
  getMarketplaceRanking,
  MarketplaceCollection,
  MarketplaceCollectionInscription,
  MarketplaceCollectionRanking,
  MarketplaceInscriptionDetail,
  MarketplaceListing,
} from '../services/marketplaceService';
import { sendMultipleBitcoinPayments, signPSBT } from '../utils/wallet';
import { isAdminAddress } from '../config/admin';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
const COLLECTION_PAGE_SIZE = 80;
const INITIAL_LISTINGS_VISIBLE = 24;
const LISTINGS_LOAD_STEP = 24;
const MARKETPLACE_COLLECTIONS_CACHE_KEY = 'marketplaceCollectionsCacheV1';
const MARKETPLACE_COLLECTIONS_CACHE_TTL_MS = 60_000;
const SATS_PER_BTC = 100_000_000;
const NAKAMOTO_SAT_MAX_EXCLUSIVE = 95_000_000_000_000;
const VINTAGE_SAT_MAX_EXCLUSIVE = 5_000_000_000_000;

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
}> = ({ inscriptionId, alt, className, imageClassName = '', fit = 'cover' }) => {
  const encodedId = encodeURIComponent(inscriptionId);
  const blobUrlRef = useRef<string | null>(null);
  const [preprocessedSrc, setPreprocessedSrc] = useState<string | null>(null);
  const [recursiveSvgDoc, setRecursiveSvgDoc] = useState<string | null>(null);
  const [htmlPreviewDoc, setHtmlPreviewDoc] = useState<string | null>(null);
  const [docProbeRequested, setDocProbeRequested] = useState(false);
  const debugEnabled = useMemo(() => isPreviewDebugEnabled(), []);
  const apiImageUrl = `${API_URL}/api/inscription/image/${encodedId}${debugEnabled ? '?debug=1' : ''}`;
  const imageSources = [
    preprocessedSrc,
    apiImageUrl,
    `https://ordinals.com/preview/${encodedId}`,
    `https://ordinals.com/content/${encodedId}`,
  ].filter(Boolean) as string[];
  const [loaded, setLoaded] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [iframeFallback, setIframeFallback] = useState(false);
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
    setDocProbeRequested(false);
    setIframeFallback(false);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    debugLog('reset', { imageSources });
  }, [inscriptionId]);

  useEffect(() => {
    if (!docProbeRequested) return;
    let cancelled = false;
    const controller = new AbortController();

    const normalizeRecursiveSvg = (svgRaw: string): string => {
      let svg = svgRaw;
      svg = svg.replace(/(xlink:href|href|src)=["']\/content\//gi, '$1="https://ordinals.com/content/');
      svg = svg.replace(/url\((["']?)\/content\//gi, 'url($1https://ordinals.com/content/');
      // Some recursive SVGs omit image dimensions; force full-canvas defaults for stability.
      svg = svg.replace(/<image(?![^>]*\swidth=)(?![^>]*\sheight=)\s/gi, '<image width="1000" height="1000" ');
      return svg;
    };
    const normalizeHtmlDoc = (htmlRaw: string): string => {
      let html = htmlRaw;
      html = html.replace(/(xlink:href|href|src)=["']\/content\//gi, '$1="https://ordinals.com/content/');
      html = html.replace(/url\((["']?)\/content\//gi, 'url($1https://ordinals.com/content/');
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
          /<head([^>]*)>/i,
          '<head$1><base href="https://ordinals.com/"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111}img,svg,canvas,video{max-width:100%;max-height:100%;object-fit:contain}*{box-sizing:border-box}</style>'
        );
      } else {
        html = `<head><base href="https://ordinals.com/"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#111}img,svg,canvas,video{max-width:100%;max-height:100%;object-fit:contain}*{box-sizing:border-box}</style></head>${html}`;
      }
      return html;
    };

    const hydrateRecursiveSvg = async () => {
      const sources = [
        `https://ordinals.com/content/${encodedId}`,
        `https://ordinals.com/preview/${encodedId}`,
      ];
      debugLog('preprocess-start', { sources });
      for (const src of sources) {
        try {
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
              const normalizedHtml = normalizeHtmlDoc(trimmed);
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
          const normalized = normalizeRecursiveSvg(trimmed);
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
  }, [encodedId, docProbeRequested, debugEnabled]);

  useEffect(() => {
    if (!noPreviewAvailable) return;
    debugLog('all-sources-failed', { imageSources });
  }, [noPreviewAvailable, inscriptionId, imageSources.length]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && !noPreviewAvailable && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      {recursiveSvgDoc ? (
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
      ) : htmlPreviewDoc ? (
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
      ) : iframeFallback ? (
        <div className="absolute inset-0 overflow-hidden bg-zinc-900">
          <iframe
            title={alt}
            src={`https://ordinals.com/preview/${encodedId}`}
            loading="lazy"
            scrolling="no"
            className="absolute border-0 bg-zinc-900"
            style={{
              width: '170%',
              height: '170%',
              transform: 'translate(-20%, -20%) scale(0.6)',
              transformOrigin: 'top left',
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
          onLoad={() => {
            setLoaded(true);
            // Some recursive ordinals "load" in <img> but still render blank.
            // Trigger doc probing after first successful load so we can upgrade to srcDoc when needed.
            if (!docProbeRequested) {
              setDocProbeRequested(true);
            }
            debugLog('img-load-success', { currentSrc, sourceIndex });
          }}
          onError={() => {
            setLoaded(false);
            setSourceIndex((prev) => {
              const next = prev + 1;
              if (next >= imageSources.length) {
                setDocProbeRequested(true);
                setIframeFallback(true);
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInscriptionDetail, setSelectedInscriptionDetail] = useState<MarketplaceInscriptionDetail | null>(null);
  const [selectedDetailListing, setSelectedDetailListing] = useState<MarketplaceListing | null>(null);
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
  const [listingRareSatsByInscription, setListingRareSatsByInscription] = useState<Record<string, string>>({});
  const [collectionInscriptionsTotal, setCollectionInscriptionsTotal] = useState(0);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionLoadingMore, setCollectionLoadingMore] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [showCollectionTraitFilters, setShowCollectionTraitFilters] = useState(false);
  const [collectionSelectedTraitFilters, setCollectionSelectedTraitFilters] = useState<Record<string, string[]>>({});
  const [collectionRarityFilter, setCollectionRarityFilter] = useState<'all' | 'mythic' | 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common'>('all');
  const [collectionSortMode, setCollectionSortMode] = useState<'rarity-desc' | 'rarity-asc' | 'name-asc' | 'name-desc'>('rarity-desc');
  const rareSatsCacheRef = useRef<Record<string, string>>({});
  const listingsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    inscriptionId: '',
    collectionSlug: '',
    priceSats: '10000',
  });
  const currentAddress = walletState.accounts?.[0]?.address || '';
  const isAdminUser = isAdminAddress(currentAddress);
  const autoOpenKeyRef = useRef<string>('');

  useEffect(() => {
    if (!isAdminUser) return;
    const loadCollections = async () => {
      try {
        setCollectionsLoading(true);
        setError(null);
        if (typeof window !== 'undefined') {
          try {
            const raw = window.sessionStorage.getItem(MARKETPLACE_COLLECTIONS_CACHE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw) as { ts: number; data: MarketplaceCollection[] };
              if (Array.isArray(parsed?.data) && Date.now() - Number(parsed?.ts || 0) < MARKETPLACE_COLLECTIONS_CACHE_TTL_MS) {
                setCollectionsMeta(parsed.data);
                setCollectionsLoading(false);
              }
            }
          } catch {
            // Ignore malformed cache and continue with fresh fetch.
          }
        }
        const collectionsData = await getMarketplaceCollections({ includeInactive: false, adminAddress: currentAddress });
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
            window.sessionStorage.setItem(
              MARKETPLACE_COLLECTIONS_CACHE_KEY,
              JSON.stringify({ ts: Date.now(), data: compactCollections })
            );
          } catch {
            // Storage quota exceeded - safe to skip cache write.
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load marketplace collections');
      } finally {
        setCollectionsLoading(false);
      }
    };
    loadCollections();
  }, [isAdminUser, currentAddress]);

  useEffect(() => {
    if (!isAdminUser) return;
    const loadRanking = async () => {
      try {
        setRankingLoading(true);
        setError(null);
        const rankingData = await getMarketplaceRanking();
        setRanking(rankingData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load ranking');
      } finally {
        setRankingLoading(false);
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

  useEffect(() => {
    if (!isAdminUser) return;
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
  }, [isAdminUser, location.search]);

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

  const handleOpenDetail = async (listing: MarketplaceListing) => {
    try {
      setDetailLoading(true);
      setError(null);
      setDetailOpen(true);
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

  const handleOpenInscriptionDetail = async (inscriptionId: string) => {
    try {
      setDetailLoading(true);
      setError(null);
      setDetailOpen(true);
      setSelectedDetailListing(null);
      setDetailTab('traits');
      const detail = await getMarketplaceInscriptionDetail(inscriptionId);
      setSelectedInscriptionDetail(detail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load inscription details');
      setSelectedInscriptionDetail(null);
    } finally {
      setDetailLoading(false);
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
      const offset = append ? collectionInscriptions.length : 0;
      const data = await getMarketplaceCollectionInscriptions({
        collectionSlug: slug,
        search,
        limit: COLLECTION_PAGE_SIZE,
        offset,
      });
      setSelectedCollectionSlug(slug);
      const nextInscriptions = data.inscriptions || [];
      setCollectionInscriptions((prev) => {
        if (!append) return nextInscriptions;
        const byId = new Map<string, MarketplaceCollectionInscription>();
        for (const row of prev) byId.set(row.inscription_id, row);
        for (const row of nextInscriptions) byId.set(row.inscription_id, row);
        return Array.from(byId.values());
      });
      const fromCache: Record<string, string> = {};
      for (const ins of nextInscriptions) {
        const cached = rareSatsCacheRef.current[ins.inscription_id];
        if (cached && cached !== '-') fromCache[ins.inscription_id] = cached;
      }
      setCollectionRareSatsByInscription((prev) => (append ? { ...prev, ...fromCache } : fromCache));
      if (!append) {
        setCollectionSelectedTraitFilters({});
        setCollectionRarityFilter('all');
        setCollectionSortMode('rarity-desc');
      }
      setCollectionInscriptionsTotal(Number(data.total || 0));
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

  if (!isAdminUser) {
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Marketplace</h1>
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

  const RARE_SAT_SYMBOLS: Record<string, string> = {
    uncommon: '◍',
    rare: '◈',
    epic: '✶',
    legendary: '✧',
    mythic: '☉',
    'black-uncommon': '⬤◍',
    'black-rare': '⬤◈',
    'black-epic': '⬤✶',
    'black-legendary': '⬤✧',
    'black-mythic': '⬤☉',
    palindrome: '↔',
    palindrom: '↔',
    'number-palindrome': '↔',
    alpha: 'α',
    omega: 'ω',
    vintage: '⌛',
    pizza: '🍕',
    nakamoto: '₿',
    hitman: '🎯',
    legacy: '🏛',
    jpeg: '🖼',
    'first-transaction': '①',
    'first-tx': '①',
    'block-9': '⑨',
    'block-78': '78',
    'block-286': '286',
    'block-666': '666',
    'block-999': '999',
  };

  const toRareSatSymbols = (raw: any): string => {
    const label = normalizeRareSatsDisplay(raw);
    if (label === '-') return '-';
    const tokens = label
      .split(/[,+/|]/g)
      .map((v) => v.trim())
      .filter(Boolean);
    const symbols = tokens
      .map((token) => {
        const key = normalizeRareSatKey(token);
        return RARE_SAT_SYMBOLS[key] || '';
      })
      .filter(Boolean);
    return symbols.length ? symbols.join(' ') : '◌';
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

  const hydrateRareSatsFromDetailFallback = async (
    ids: string[],
    byId: Map<string, string>
  ): Promise<void> => {
    for (const id of ids) {
      if ((byId.get(id) || '-') !== '-') continue;
      try {
        const detail = await getMarketplaceInscriptionDetail(id);
        const normalized = extractRareSatsFromDetail(detail);
        if (normalized !== '-') {
          byId.set(id, normalized);
        }
      } catch {
        // Ignore detail errors for individual inscriptions.
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
    for (const ins of collectionInscriptions) {
      const traits = extractInscriptionTraits(ins);
      const hasOneOfOne = traits.some((t) => {
        const traitType = String(t.trait_type || '').trim().toLowerCase();
        const value = String(t.value || '').trim().toLowerCase();
        return traitType === '1:1' || value === '1:1' || traitType === 'one of one' || value === 'one of one';
      });
      forceTopRarityById.set(ins.inscription_id, hasOneOfOne);
      if (hasOneOfOne) {
        // 1:1 items are always top rarity by explicit project rule.
        rawScores.set(ins.inscription_id, 1_000_000_000);
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

  const filteredCollectionInscriptions = useMemo(() => {
    let rows = collectionInscriptions.filter((ins) => {
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
      if (collectionSortMode === 'name-asc') {
        return String(a.metadata?.name || a.inscription_id).localeCompare(String(b.metadata?.name || b.inscription_id));
      }
      if (collectionSortMode === 'name-desc') {
        return String(b.metadata?.name || b.inscription_id).localeCompare(String(a.metadata?.name || a.inscription_id));
      }
      const aPct = collectionCompositeRarityByInscription.percentileById.get(a.inscription_id) || 0;
      const bPct = collectionCompositeRarityByInscription.percentileById.get(b.inscription_id) || 0;
      if (collectionSortMode === 'rarity-asc') return aPct - bPct;
      return bPct - aPct;
    });

    return rows;
  }, [
    collectionInscriptions,
    collectionSelectedTraitFilters,
    collectionRarityFilter,
    collectionSortMode,
    collectionCompositeRarityByInscription,
  ]);

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
      .slice(0, 120);

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

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 rounded-2xl border border-red-600/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Marketplace</h1>
              <p className="text-sm text-gray-400 mt-1">
                Visual, non-custodial trading hub with rich previews and admin-safe execution.
              </p>
            </div>
            <div className="w-full md:w-auto flex flex-col gap-2 md:items-end">
              <div className="text-xs uppercase text-gray-400">Connected</div>
              <div className="text-xs font-mono bg-black/60 border border-white/15 rounded px-2 py-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {walletState.accounts?.[0]?.address || 'No wallet'}
              </div>
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

        {!walletState.connected ? (
          <div className="max-w-xl mb-8">
            <WalletConnect />
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/marketplace/profile')}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            >
              Open My Marketplace Profile
            </button>
            <button
              onClick={() => setShowAdminTools((v) => !v)}
              className="px-4 py-2 rounded-lg bg-zinc-800 border border-white/15 hover:bg-zinc-700 text-sm font-semibold"
            >
              {showAdminTools ? 'Hide Admin Listing Tools' : 'Show Admin Listing Tools'}
            </button>
          </div>
        )}

        {showAdminTools && walletState.connected && (
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

        <div className="mb-8 rounded-xl border border-white/15 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold">Collections</h2>
            <span className="text-xs text-gray-400">Open a collection to browse all inscriptions</span>
          </div>
          {collectionsLoading ? (
            <div className="p-4 text-sm text-gray-400">Loading collections...</div>
          ) : collectionsMeta.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No collections available.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 p-2">
              {collectionsMeta
                .filter((c) => c.active !== false)
                .map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => loadCollectionInscriptions(c.slug)}
                    className="text-left rounded-lg border border-white/10 bg-zinc-900/60 hover:border-red-500/40 transition-colors overflow-hidden max-w-[11rem]"
                  >
                    <div className="aspect-square bg-zinc-900">
                      {c.cover_image ? (
                        <img src={c.cover_image} alt={c.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No cover</div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-[11px] text-gray-500">{c.slug}</div>
                    </div>
                  </button>
                ))}
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    value={collectionSortMode}
                    onChange={(e) => setCollectionSortMode(e.target.value as typeof collectionSortMode)}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs"
                  >
                    <option value="rarity-desc">Sort: Rarity High -&gt; Low</option>
                    <option value="rarity-asc">Sort: Rarity Low -&gt; High</option>
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
                  <button
                    type="button"
                    onClick={() => setShowCollectionTraitFilters((v) => !v)}
                    className="bg-black border border-white/15 rounded px-2 py-1 text-xs text-left hover:bg-zinc-900"
                  >
                    Traits Filter {selectedCollectionTraitCount > 0 ? `(${selectedCollectionTraitCount})` : ''}
                  </button>
                  <div className="text-xs text-gray-400 flex items-center">
                    Showing {filteredCollectionInscriptions.length} / {collectionInscriptions.length} loaded
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
                <div className="p-4 text-sm text-gray-500">No inscriptions found for this collection.</div>
              ) : (
                <div className="p-2">
                  <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                    {filteredCollectionInscriptions.map((ins) => {
                    const rarity = extractInscriptionRarity(ins);
                    const rareSats = collectionRareSatsByInscription[ins.inscription_id] || extractInscriptionRareSats(ins);
                    const score = collectionCompositeRarityByInscription.rawScores.get(ins.inscription_id) || 0;
                    const isOneOfOne = collectionCompositeRarityByInscription.forceTopRarityById.get(ins.inscription_id) || false;
                    const rarityPercentile = collectionCompositeRarityByInscription.percentileById.get(ins.inscription_id) || 0;
                    const compositeLabel = isOneOfOne ? 'mythic' : compositeRarityLabel(rarityPercentile);
                    return (
                      <button
                        key={ins.inscription_id}
                        type="button"
                        onClick={() => handleOpenInscriptionDetail(ins.inscription_id)}
                        className="rounded-md border border-white/10 bg-zinc-900/60 overflow-hidden hover:border-red-500/40 transition-colors"
                      >
                        <PreviewImage
                          inscriptionId={ins.inscription_id}
                          alt={ins.inscription_id}
                          className="w-full aspect-square"
                          fit="contain"
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
                              title={rareSats}
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
                          </div>
                        </div>
                      </button>
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
                      <div className="text-[11px] text-gray-400 font-mono" title={rareSatsLabel}>
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
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(l)}
                            className="px-1.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold"
                          >
                            Details
                          </button>
                          <button
                            disabled={!walletState.connected || isBusy}
                            onClick={() => handleBuyListing(l)}
                            className="px-1.5 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-[11px] font-semibold"
                            title="Simple mode: direct payment + complete"
                          >
                            {isBusy ? 'Buying...' : 'Simple Buy'}
                          </button>
                          <button
                            disabled={!walletState.connected || isBusy}
                            onClick={() => handleAdvancedBuyListing(l)}
                            className="px-1.5 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-[11px] font-semibold"
                            title="Advanced mode: wallet PSBT signing and on-chain broadcast"
                          >
                            {isBusy ? 'PSBT...' : 'PSBT Buy'}
                          </button>
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
              <span className="px-2 py-1 rounded bg-zinc-700 text-zinc-100">Simple</span>
              <span className="px-2 py-1 rounded bg-emerald-700/80 text-emerald-100">Advanced PSBT</span>
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
                return (
                  <div key={s.id} className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 hover:border-red-500/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <PreviewImage
                        inscriptionId={s.inscription_id}
                        alt={s.inscription_id}
                        className="w-16 h-16 rounded border border-white/10 shrink-0"
                        fit="contain"
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

                  {selectedDetailListing && (
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              disabled={!walletState.connected || busyListingId === selectedDetailListing.id}
                              onClick={() => handleBuyListing(selectedDetailListing)}
                              className="px-3 py-2 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-xs font-semibold"
                              title="Simple mode: direct payment + complete"
                            >
                              {busyListingId === selectedDetailListing.id ? 'Buying...' : 'Simple Buy'}
                            </button>
                            <button
                              disabled={!walletState.connected || busyListingId === selectedDetailListing.id}
                              onClick={() => handleAdvancedBuyListing(selectedDetailListing)}
                              className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-xs font-semibold"
                              title="Advanced mode: wallet PSBT signing and on-chain broadcast"
                            >
                              {busyListingId === selectedDetailListing.id ? 'PSBT...' : 'PSBT Buy'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                            title={detailTextValue(selectedInscriptionDetail.chainInfo?.rareSats, selectedInscriptionDetail.chainInfo?.rare_sats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rareSats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rare_sats, selectedInscriptionDetail.marketplaceInscription?.metadata?.rareSat, selectedInscriptionDetail.marketplaceInscription?.metadata?.rare_sat, selectedInscriptionDetail.marketplaceInscription?.metadata?.satributes?.rarity)}
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
                                String(o.buyer_address || '').toLowerCase() === currentAddress.toLowerCase() ||
                                isAdminUser) && (
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

