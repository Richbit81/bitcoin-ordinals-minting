import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { addPoints } from '../services/pointsService';

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

type Category = 'game' | 'tool' | 'music';

interface TechGameItem {
  inscriptionId: string;
  name: string;
  description: string;
  price: number; // in sats
  category: Category;
  specs?: string[]; // Für Specs (z.B. SEQUENCER)
  features?: string[]; // Für Features (z.B. TACTICAL)
}

const TECH_GAMES_ITEMS: TechGameItem[] = [
  {
    inscriptionId: 'a346945c962d4c9f25ca8a5bea7cfd4de3bc8665f0640d8991df6137878d2ee0i0',
    name: 'Bitcoin Mix Tape',
    description: 'Not a static Ordinal — but a dynamic, evolving music project fully embedded on the Bitcoin blockchain. The Bitcoin Mixtape is inscribed as Ordinals — 100% on-chain, permanent, interoperable, yet actively changeable and expandable. Features: 16 total tracks as Ordinals inscriptions, high-quality audio streamed from Bitcoin itself, 23 MB of data (5 full blocks!), interactive tracklist, multiple tape covers, Three.js-based 3D cassette player, animated cassette reels, and a dynamic day-and-night sky.',
    price: 20000,
    category: 'music',
    specs: [
      '16 total tracks as Ordinals inscriptions',
      'High-quality audio fully stored on Bitcoin',
      '23 MB of data directly on Bitcoin (5 full blocks!)',
      'Interactive tracklist with title, artist, duration',
      'Multiple tape covers + individual cover previews',
      'Three.js-based 3D cassette player',
      'Animated cassette reels that spin realistically',
      'Dynamic day-and-night sky rendered on-chain',
      'Living archive: new tracks & covers can be added',
    ],
  },
  {
    inscriptionId: '94c91f823f145daf0200394433c1116781a7a669ba0b24a0d232f46838b37351i0',
    name: 'TACTICAL',
    description: 'Tactical is a turn-based tactical strategy game. Command an elite squad and complete missions against alien enemies.',
    price: 10000,
    category: 'game',
    features: [
      'Turn-based combat system with Action Points',
      'Fog of War mechanics that reveal the battlefield as you explore',
      'Multiple weapon modes: Snap Shot, Aimed Shot, Burst',
      'Special abilities: Psi attacks, Teleport, Shield, Overwatch, Grenades, Medkits',
      'Campaign mode with Command Center: manage your soldiers, equipment, and progression between missions',
      'Map Editor to create custom missions',
      'Arcade Mode with predefined missions',
      'Multiple difficulty Levels',
    ],
  },
  {
    inscriptionId: '0107df3459c64a889c4249011017a13dbbf7ad8e43cf075d3ca6aae7ddb511fai0',
    name: "SANTA'S REVENGE",
    description: "Do you want to help Santa give the Grinch a serious kick where it hurts? Then Santas Revenge is the game for you! Santas Revenge is an action-packed 3D shooter where you fight your way through a maze and defeat various enemies. The game features multiple levels, different weapons, various difficulty settings, and many additional features. Despite all challenges, I managed to overcome the many obstacles of blockchain development and create a full-fledged shooter. The game runs only on PC, in fullscreen mode, and is played with mouse & keyboard. Enjoy Santas Revenge and good luck defeating all enemies!",
    price: 10000,
    category: 'game',
  },
  {
    inscriptionId: 'f90df6134b4d171c5b1f9c85884c3e1075ef7fb32fa404a58004e28a0db274d1i0',
    name: 'SEQUENCER',
    description: 'Welcome to the S3QU3NC3R. An audio system completely as a standalone ordinal. It consists of over 8,000 lines of code. Mint Live on Lunalauncher.io',
    price: 10000,
    category: 'music',
    specs: [
      '8 Banks with 16 Steps, 9 Instruments',
      '21 Effects, 2 FX per Instrument + EQ + Volume',
      'Polyphony Control',
      'Tone.js Framework + HTML Audio',
      'Design with 4 themes',
      '8 Audio Chains max (Auto-cleanup)',
      'Memory Management with Garbage Collection',
      'Import/Export Fiction via Text',
      'AI Composition & Generative Patterns',
      'Euclidean Rhythms & Pattern Evolution',
      'Polyrhythmic Support',
    ],
  },
  {
    inscriptionId: '93c6cae72268f19c1da6f2f6ca6f5d5aaa450c5c21f25265764d605288c1dffbi0',
    name: 'STREET REIGN',
    description: 'Street Reign is a point-and-click game. It puts you in the world of a drug dealer. Buy, sell, escape from the police. The goal is to make money and climb the ranks. Will you succeed? Best gaming experience on PC in full screen.',
    price: 10000,
    category: 'game',
  },
  {
    inscriptionId: '5be3dfb109321291c0469ab1253be7b5c9d023e694945dbbd71a1dfe7518a4bfi0',
    name: 'TimeBIT',
    description: 'Binary clock',
    price: 2000,
    category: 'tool',
  },
  {
    inscriptionId: '1164c8fc35613512724f816b98d4b147846d18afe506b62c6a6b552a325cbea9i0',
    name: 'Slot Machine',
    description: 'Push the Button! Try your luck with this little slot machine. 6 designs, sounds, 3 slots. The slot machine is a little experiment and shows what else you can do with ordinals besides art. Over 1500 lines of code and 250kB of data were used to create this machine.',
    price: 2000,
    category: 'game',
  },
  {
    inscriptionId: 'e6805a3c68fd1abb1904dfb8193b2a01ef2ccbd96d6b8be2c4b9aba4332c413di0',
    name: 'BLOCKTRIS',
    description: 'Tetris Clone in Bitmap/Memepool style',
    price: 2000,
    category: 'game',
  },
  {
    inscriptionId: '26f1282b9473c0aa38c7fad53cf3d147cec3c85769540009956b3924f002a9d7i0',
    name: 'RichArt Synthesizer',
    description: 'Beta version of the RichArt Synthesizer',
    price: 0, // 0 = Test only, not for purchase
    category: 'music',
  },
];

export const TechGamesPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [pendingItem, setPendingItem] = useState<TechGameItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<TechGameItem | null>(null);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [expandedSpecs, setExpandedSpecs] = useState<string | null>(null); // inscriptionId of expanded item

  // ESC-Taste Handler für Fullscreen-Modal und Performance-Optimierung
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedItem) {
        setSelectedItem(null);
      }
    };

    if (selectedItem) {
      document.addEventListener('keydown', handleEsc);
      // Verhindere Body-Scroll wenn Modal offen ist
      document.body.style.overflow = 'hidden';
      // Pausiere alle anderen iframes für bessere Performance
      const allIframes = document.querySelectorAll('iframe');
      allIframes.forEach((iframe) => {
        const iframeTitle = iframe.getAttribute('title');
        if (iframeTitle && iframeTitle !== selectedItem.name) {
          const src = iframe.src;
          if (src) {
            iframe.src = '';
            (iframe as any).__originalSrc = src; // Speichere Original-Src
            // Setze iframe auf display: none für zusätzliche Performance
            (iframe as HTMLElement).style.display = 'none';
          }
        }
      });
      // CPU-Priorität erhöhen durch requestAnimationFrame
      requestAnimationFrame(() => {
        // Force GPU acceleration
        const modalContainer = document.querySelector('[class*="fixed inset-0"]') as HTMLElement;
        if (modalContainer) {
          modalContainer.style.transform = 'translateZ(0)';
          modalContainer.style.willChange = 'contents';
        }
      });
    } else {
      // Stelle alle iframes wieder her, wenn Modal geschlossen ist
      const allIframes = document.querySelectorAll('iframe');
      allIframes.forEach((iframe) => {
        const originalSrc = (iframe as any).__originalSrc;
        if (originalSrc && !iframe.src) {
          (iframe as HTMLElement).style.display = '';
          iframe.src = originalSrc;
          delete (iframe as any).__originalSrc;
        }
      });
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [selectedItem]);

  const handleMint = async (item: TechGameItem) => {
    if (!walletState.connected || !walletState.accounts[0]?.address) {
      setPendingItem(item);
      setShowWalletConnect(true);
      return;
    }

    // WICHTIG: Inscription muss immer an die richtige Adresse gehen
    // Beide Wallets: Suche nach Ordinals-Adresse (Taproot), fallback zur ersten Adresse
    let userAddress = walletState.accounts[0].address;
    
    // Suche nach Ordinals-Adresse (für beide Wallet-Typen)
    const ordinalsAccount = walletState.accounts.find(acc => 
      acc.purpose === 'ordinals' || acc.address.startsWith('bc1p')
    );
    
    if (ordinalsAccount) {
      userAddress = ordinalsAccount.address;
      console.log(`[TechGamesPage] ✅ ${walletState.walletType?.toUpperCase()} - Verwende Ordinals-Adresse (Taproot) für Inscription:`, userAddress);
    } else {
      const addressType = userAddress.startsWith('bc1p') ? 'Taproot' :
                          userAddress.startsWith('bc1q') ? 'SegWit' :
                          userAddress.startsWith('3') ? 'Nested SegWit' : 'Legacy';
      console.warn(`[TechGamesPage] ⚠️ ${walletState.walletType?.toUpperCase()} - Keine Taproot-Adresse! Verwende ${addressType}:`, userAddress);
    }
    
    // Zeige Payment-Adresse (falls vorhanden)
    const paymentAccount = walletState.accounts.find(acc => acc.purpose === 'payment');
    if (paymentAccount) {
      console.log(`[TechGamesPage] 💰 ${walletState.walletType?.toUpperCase()} - Payment kommt von:`, paymentAccount.address);
    }
    
    setMintingStatus({ status: 'in-progress', progress: 10, message: 'Starting minting process...' });

    try {
      setMintingStatus(prev => prev ? { ...prev, progress: 30, message: 'Creating delegate inscription...' } : null);
      
      const result = await createSingleDelegate(
        item.inscriptionId,
        item.name,
        userAddress,
        'Tech & Games',
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        'html', // Tech & Games Inskriptionen sind HTML-Inskriptionen (interaktive Spiele/Tools)
        item.price // Item-Preis in sats (z.B. 2000 für TimeBIT, 10000 für TACTICAL)
      );

      // Füge Punkte hinzu basierend auf Item-Preis
      // Items über 8000 sats: 20 Punkte, Items unter 8000 sats: 5 Punkte
      try {
        const pointsToAdd = item.price >= 8000 ? 20 : 5;
        await addPoints(
          userAddress,
          pointsToAdd,
          `Minted Tech & Games item: ${item.name} (${item.price} sats)`,
          {
            collection: 'Tech & Games',
            itemName: item.name,
            itemPrice: item.price,
            inscriptionId: result.inscriptionId
          }
        );
        console.log(`[TechGames] ✅ Added ${pointsToAdd} points for minting ${item.name}`);
      } catch (pointsError) {
        console.error('[TechGames] ⚠️ Failed to add points:', pointsError);
        // Fehler beim Hinzufügen von Punkten sollte den Mint-Erfolg nicht beeinträchtigen
      }

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted ${item.name}!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });

      // Log the mint to backend
      try {
        await fetch(`${API_URL}/api/techgames/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            itemName: item.name,
            inscriptionId: result.inscriptionId,
            originalInscriptionId: item.inscriptionId,
            txid: result.txid,
            priceSats: item.price,
          }),
        });
        console.log(`[TechGames] ✅ Mint logged for ${item.name}`);
      } catch (logError) {
        console.warn('[TechGames] ⚠️ Failed to log mint:', logError);
      }
    } catch (err: any) {
      console.error('Minting error:', err);
      setMintingStatus({
        progress: 100,
        status: 'error',
        message: `Error: ${err.message || 'An unknown error occurred during minting.'}`,
        inscriptionIds: [],
        txid: '',
      });
    }
  };

  const formatPrice = (sats: number): string => {
    return `${sats.toLocaleString()} sats (${(sats / 100000000).toFixed(8)} BTC)`;
  };

  // Helper-Funktionen für Badges
  const getCategoryBadge = (category: Category) => {
    const badges = {
      game: { label: '🎮 Game', color: 'bg-blue-600 text-white' },
      tool: { label: '🔧 Tool', color: 'bg-green-600 text-white' },
      music: { label: '🎵 Music', color: 'bg-purple-600 text-white' },
    };
    return badges[category];
  };

  const getPriceBadge = (price: number) => {
    if (price === 0) {
      return { label: 'FREE', color: 'bg-gray-600 text-white' };
    } else if (price >= 8000) {
      return { label: 'PREMIUM', color: 'bg-yellow-600 text-white' };
    } else {
      return { label: 'STANDARD', color: 'bg-gray-700 text-white' };
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 pt-20 pb-24 md:pb-8">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white flex items-center gap-2"
          title="Back to Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-semibold">Back</span>
        </button>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-center mb-4 text-white flex items-center justify-center gap-3">
        Tech & Games
        <img
          src="/images/techgames-logo.gif"
          alt="Tech & Games"
          className="h-12 w-12 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </h1>

      {/* Statistics & Info Banner */}
      <div className="bg-gray-900/80 backdrop-blur-sm border border-red-600/50 rounded-lg p-6 mb-8 max-w-4xl mx-auto shadow-lg shadow-red-600/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-white mb-2">
              {TECH_GAMES_ITEMS.length} Games & Tools Available
            </h2>
            <p className="text-sm text-gray-400">
              {TECH_GAMES_ITEMS.filter(i => i.category === 'game').length} Games • {' '}
              {TECH_GAMES_ITEMS.filter(i => i.category === 'tool').length} Tools • {' '}
              {TECH_GAMES_ITEMS.filter(i => i.category === 'music').length} Music Tools
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center md:justify-end">
            <span className="px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm bg-blue-600 text-white shadow-sm">
              🎮 Game
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm bg-green-600 text-white shadow-sm">
              🔧 Tool
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm bg-purple-600 text-white shadow-sm">
              🎵 Music
            </span>
          </div>
        </div>
      </div>

      {/* Support Text */}
      <p className="text-sm text-gray-400 text-center mb-8 max-w-2xl mx-auto px-4">
        I really enjoy learning new things, but programming also requires a lot of time and effort.
        You can test and play everything here for free.
        If you enjoy it and like what I'm creating, I'd really appreciate any support by purchasing something.
      </p>

      {/* Items Grid - Optimized for performance */}
      <div 
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 max-w-7xl mx-auto"
        style={{
          contentVisibility: 'auto',
        }}
      >
        {TECH_GAMES_ITEMS.map((item) => (
          <div
            key={item.inscriptionId}
            className="bg-gray-900/80 backdrop-blur-sm border border-red-600/50 rounded-lg p-6 hover:border-red-500 hover:bg-gray-900/90 transition-all duration-300 flex flex-col hover:shadow-lg hover:shadow-red-600/20 hover:scale-[1.02] group relative overflow-hidden"
          >
            {/* Glassmorphism Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            {/* Badges */}
            <div className="flex gap-2 mb-3 relative z-10">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${getCategoryBadge(item.category).color} shadow-sm`}>
                {getCategoryBadge(item.category).label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${getPriceBadge(item.price).color} shadow-sm`}>
                {getPriceBadge(item.price).label}
              </span>
            </div>

            {/* Preview - HTML Inscription in iframe - Optimized for performance */}
            <div
              className="w-full aspect-square bg-black rounded mb-4 cursor-pointer overflow-hidden border-2 border-gray-800 hover:border-red-600 transition-all duration-300 relative group/preview hover:shadow-lg hover:shadow-red-600/30"
              onClick={() => setSelectedItem(item)}
            >
              {/* Gradient Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-red-600/0 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
              {selectedItem ? (
                // Wenn ein anderes Item im Modal ist, zeige Platzhalter statt iframe (spart Ressourcen)
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-gray-300 text-center p-4">
                  <div>
                    <div className="text-4xl mb-3">🎮</div>
                    <p className="text-lg font-bold mb-1">{item.name}</p>
                    <p className="text-xs text-gray-500">HTML Inscription</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Skeleton Loader */}
                  {loadingItems.has(item.inscriptionId) && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black animate-pulse flex items-center justify-center z-0">
                      <div className="text-center">
                        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-xs text-gray-400">Loading {item.name}...</p>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={`https://ordinals.com/content/${item.inscriptionId}`}
                    className={`w-full h-full border-0 ${loadingItems.has(item.inscriptionId) ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                    title={item.name}
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    style={{
                      transform: 'translateZ(0)',
                      willChange: 'auto',
                    }}
                    onLoad={() => {
                      setLoadingItems(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(item.inscriptionId);
                        return newSet;
                      });
                    }}
                    onLoadStart={() => {
                      setLoadingItems(prev => new Set(prev).add(item.inscriptionId));
                    }}
                    onError={(e) => {
                      console.log(`[TechGames] Iframe load error for ${item.name}`);
                      setLoadingItems(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(item.inscriptionId);
                        return newSet;
                      });
                      const iframe = e.currentTarget as HTMLIFrameElement;
                      iframe.style.display = 'none';
                      const parent = iframe.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-gray-300 text-center p-4">
                            <div>
                              <div class="text-4xl mb-3">🎮</div>
                              <p class="text-lg font-bold mb-1">${item.name}</p>
                              <p class="text-xs text-gray-500">HTML Inscription</p>
                            </div>
                          </div>
                        `;
                      }
                    }}
                  />
                </>
              )}
            </div>

            {/* Item Info */}
            <h3 
              className="text-xl font-bold text-white mb-2 cursor-pointer hover:text-red-600 transition-all duration-300 group-hover:translate-x-1"
              onClick={() => setSelectedItem(item)}
            >
              {item.name}
            </h3>
            <p 
              className="text-sm text-gray-400 mb-4 line-clamp-3 cursor-pointer hover:text-gray-300 transition-colors flex-1"
              onClick={() => setSelectedItem(item)}
            >
              {item.description.split('\n\n')[0].substring(0, 150)}
              {item.description.length > 150 ? '...' : ''}
            </p>

            {/* Expandable Specs/Features */}
            {(item.specs || item.features) && (
              <div className="mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedSpecs(expandedSpecs === item.inscriptionId ? null : item.inscriptionId);
                  }}
                  className="w-full text-left text-xs text-red-400 hover:text-red-300 font-semibold flex items-center justify-between transition-colors duration-300"
                >
                  <span>{item.specs ? 'Specs' : 'Main Features'}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 ${expandedSpecs === item.inscriptionId ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSpecs === item.inscriptionId && (
                  <div className="mt-2 space-y-1 bg-gray-800/50 rounded p-2 max-h-48 overflow-y-auto">
                    {(item.specs || item.features)?.map((itemText, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>{itemText}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price Info - nur anzeigen wenn price > 0 */}
            {item.price > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Price: {formatPrice(item.price)}</p>
                <p className="text-sm text-gray-400">+ inscription fees</p>
              </div>
            )}

            {/* Mint oder Test Button - mt-auto schiebt ihn nach unten */}
            <div className="mt-auto space-y-2">
              {item.price > 0 ? (
                <>
                  <button
                    onClick={() => handleMint(item)}
                    disabled={mintingStatus?.status === 'in-progress'}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-all duration-300 text-sm font-semibold hover:shadow-lg hover:shadow-red-600/30 hover:scale-[1.02]"
                  >
                    {mintingStatus?.status === 'in-progress' ? 'Minting...' : '🎯 Mint Now'}
                  </button>
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all duration-300 text-xs font-medium text-gray-300"
                  >
                    👁️ Try First
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedItem(item)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-300 text-sm font-semibold hover:shadow-lg hover:shadow-blue-600/30 hover:scale-[1.02]"
                >
                  🎮 Test Now
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fee Rate Selector - Jetzt unterhalb der Items */}
      <div className="max-w-2xl mx-auto mt-8">
        <FeeRateSelector
          selectedFeeRate={inscriptionFeeRate}
          onFeeRateChange={setInscriptionFeeRate}
        />
      </div>

      {/* Wallet Connect Modal */}
      {showWalletConnect && !walletState.connected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-black border-2 border-red-600 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-4 border-b-2 border-red-600">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={() => {
                  setShowWalletConnect(false);
                  setPendingItem(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <WalletConnect
                onConnected={() => {
                  setShowWalletConnect(false);
                  if (pendingItem) {
                    handleMint(pendingItem);
                    setPendingItem(null);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Minting Progress Modal */}
      {mintingStatus && (
        <MintingProgress
          status={mintingStatus}
          onClose={() => {
            setMintingStatus(null);
            if (mintingStatus.status === 'success' || mintingStatus.status === 'error') {
              // Optionally navigate or refresh
            }
          }}
        />
      )}

      {/* Item Detail Modal - Fullscreen */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={() => setSelectedItem(null)}
        >
          {/* Header with Close Button */}
          <div className="flex justify-between items-center p-4 border-b-2 border-red-600 bg-gray-900">
            <h2 className="text-2xl font-bold text-white">{selectedItem.name}</h2>
            <div className="flex items-center gap-4">
              {/* Mint Button - nur anzeigen wenn price > 0 */}
              {selectedItem.price > 0 && (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setPendingItem(selectedItem);
                    setShowWalletConnect(true);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-semibold"
                >
                  {walletState.connected ? 'Mint' : 'Connect & Mint'}
                </button>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white p-2"
                title="Close (ESC)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Fullscreen iframe - Optimized for performance */}
          <div 
            className="flex-1 w-full h-full bg-black overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              willChange: 'contents',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              contain: 'layout style paint',
              isolation: 'isolate',
            }}
          >
            <iframe
              src={`https://ordinals.com/content/${selectedItem.inscriptionId}`}
              className="w-full h-full border-0 absolute inset-0"
              title={selectedItem.name}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-fullscreen"
              loading="eager"
              referrerPolicy="no-referrer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; webgl; xr-spatial-tracking"
              allowFullScreen
              style={{
                willChange: 'contents',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                isolation: 'isolate',
                contain: 'layout style paint',
                pointerEvents: 'auto',
              }}
              onError={(e) => {
                console.log(`[TechGames] Iframe load error in modal for ${selectedItem.name}`);
                const iframe = e.currentTarget as HTMLIFrameElement;
                iframe.style.display = 'none';
                const parent = iframe.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-gray-900 text-gray-400 p-6 text-center">
                      <div>
                        <div class="text-5xl mb-4">🎮</div>
                        <p class="text-lg font-bold mb-2">${selectedItem.name}</p>
                        <p class="text-sm mb-4">HTML Inscription</p>
                        <a href="https://ordinals.com/inscription/${selectedItem.inscriptionId}" target="_blank" rel="noopener noreferrer" class="text-red-600 hover:text-red-500 mt-4 inline-block underline">
                          View on Ordinals.com →
                        </a>
                      </div>
                    </div>
                  `;
                }
              }}
            />
          </div>

          {/* Footer with Info */}
          <div 
            className="p-4 border-t-2 border-red-600 bg-gray-900 text-white max-h-[40vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-7xl mx-auto">
              {/* Description */}
              <div className="mb-4">
                <p className="text-sm text-gray-300">{selectedItem.description}</p>
              </div>
              
              {/* Specs/Features - Aufklappbar */}
              {(selectedItem.specs || selectedItem.features) && (
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedSpecs(expandedSpecs === selectedItem.inscriptionId ? null : selectedItem.inscriptionId)}
                    className="w-full text-left text-sm text-red-400 hover:text-red-300 font-semibold flex items-center justify-between transition-colors duration-300 mb-2"
                  >
                    <span>{selectedItem.specs ? 'Specs' : 'Main Features'}</span>
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 ${expandedSpecs === selectedItem.inscriptionId ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSpecs === selectedItem.inscriptionId && (
                    <div className="space-y-2 bg-gray-800/50 rounded p-3 max-h-64 overflow-y-auto">
                      {(selectedItem.specs || selectedItem.features)?.map((itemText, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="text-red-600 mt-0.5">•</span>
                          <span>{itemText}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Price Info - nur anzeigen wenn price > 0 */}
              {selectedItem.price > 0 && (
                <div className="flex justify-between items-center border-t border-gray-700 pt-4">
                  <div className="flex-1" />
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Price</p>
                    <p className="text-lg font-bold text-red-600">{formatPrice(selectedItem.price)}</p>
                    <p className="text-xs text-gray-500">+ inscription fees</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

