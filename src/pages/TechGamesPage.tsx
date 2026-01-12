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

interface TechGameItem {
  inscriptionId: string;
  name: string;
  description: string;
  price: number; // in sats
}

const TECH_GAMES_ITEMS: TechGameItem[] = [
  {
    inscriptionId: '94c91f823f145daf0200394433c1116781a7a669ba0b24a0d232f46838b37351i0',
    name: 'TACTICAL',
    description: 'Tactical is a turn-based tactical strategy game. Command an elite squad and complete missions against alien enemies.\n\nMain Features:\n-Optimized for Full Screen\n-Turn-based combat system with Action Points\n-Fog of War mechanics that reveal the battlefield as you explore\n-Multiple weapon modes: Snap Shot, Aimed Shot, Burst\n-Special abilities: Psi attacks, Teleport, Shield, Overwatch, Grenades, Medkits\n-Campaign mode with Command Center: manage your soldiers, equipment, and progression between missions\n-Map Editor to create custom missions\n-Arcade Mode with predefined missions\n-Multiple difficulty levels\n-Strategic gameplay',
    price: 10000,
  },
  {
    inscriptionId: '0107df3459c64a889c4249011017a13dbbf7ad8e43cf075d3ca6aae7ddb511fai0',
    name: "SANTA'S REVENGE",
    description: "Do you want to help Santa give the Grinch a serious kick where it hurts? Then Santas Revenge is the game for you! Santas Revenge is an action-packed 3D shooter where you fight your way through a maze and defeat various enemies. The game features multiple levels, different weapons, various difficulty settings, and many additional features. Despite all challenges, I managed to overcome the many obstacles of blockchain development and create a full-fledged shooter. The game runs only on PC, in fullscreen mode, and is played with mouse & keyboard. Enjoy Santas Revenge and good luck defeating all enemies!",
    price: 10000,
  },
  {
    inscriptionId: 'f90df6134b4d171c5b1f9c85884c3e1075ef7fb32fa404a58004e28a0db274d1i0',
    name: 'SEQUENCER',
    description: 'Welcome to the S3QU3NC3R. An audio system completely as a standalone ordinal. It consists of over 8,000 lines of code. Mint Live on Lunalauncher.io\n\nSpecs:\n-8 Banks with 16 Steps, 9 Instruments\n-21 Effects, 2 FX per Instrument + EQ + Volume\n-Polyphony Control\n-Tone.js Framework + HTML Audio\n-Design with 4 themes\n-8 Audio Chains max (Auto-cleanup)\n-Memory Management with Garbage Collection\n-Import/Export Fiction via Text\n-AI Composition & Generative Patterns\n-Euclidean Rhythms & Pattern Evolution\n-Polyrhythmic Support',
    price: 10000,
  },
  {
    inscriptionId: '93c6cae72268f19c1da6f2f6ca6f5d5aaa450c5c21f25265764d605288c1dffbi0',
    name: 'STREET REIGN',
    description: 'Street Reign is a point-and-click game. It puts you in the world of a drug dealer. Buy, sell, escape from the police. The goal is to make money and climb the ranks. Will you succeed? Best gaming experience on PC in full screen.',
    price: 10000,
  },
  {
    inscriptionId: '5be3dfb109321291c0469ab1253be7b5c9d023e694945dbbd71a1dfe7518a4bfi0',
    name: 'TimeBIT',
    description: 'Binary clock',
    price: 2000,
  },
  {
    inscriptionId: '1164c8fc35613512724f816b98d4b147846d18afe506b62c6a6b552a325cbea9i0',
    name: 'Slot Machine',
    description: 'Push the Button! Try your luck with this little slot machine. 6 designs, sounds, 3 slots. The slot machine is a little experiment and shows what else you can do with ordinals besides art. Over 1500 lines of code and 250kB of data were used to create this machine.',
    price: 2000,
  },
  {
    inscriptionId: 'e6805a3c68fd1abb1904dfb8193b2a01ef2ccbd96d6b8be2c4b9aba4332c413di0',
    name: 'BLOCKTRIS',
    description: 'Tetris Clone in Bitmap/Memepool style',
    price: 2000,
  },
  {
    inscriptionId: '26f1282b9473c0aa38c7fad53cf3d147cec3c85769540009956b3924f002a9d7i0',
    name: 'RichArt Synthesizer',
    description: 'Beta version of the RichArt Synthesizer',
    price: 0, // 0 = Test only, not for purchase
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

    const userAddress = walletState.accounts[0].address;
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

  return (
    <div className="min-h-screen bg-black p-8 pt-20">
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
      <h1 className="text-4xl font-bold text-center mb-8 text-white flex items-center justify-center gap-3">
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

      {/* Fee Rate Selector */}
      <div className="max-w-2xl mx-auto mb-8">
        <FeeRateSelector
          selectedFeeRate={inscriptionFeeRate}
          onFeeRateChange={setInscriptionFeeRate}
        />
      </div>

      {/* Items Grid - Optimized for performance */}
      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto"
        style={{
          contentVisibility: 'auto',
        }}
      >
        {TECH_GAMES_ITEMS.map((item) => (
          <div
            key={item.inscriptionId}
            className="bg-gray-900 border border-red-600 rounded-lg p-6 hover:border-red-500 transition-colors flex flex-col"
          >
            {/* Preview - HTML Inscription in iframe - Optimized for performance */}
            <div
              className="w-full aspect-square bg-black rounded mb-4 cursor-pointer overflow-hidden border-2 border-gray-800 hover:border-red-600 transition-colors"
              onClick={() => setSelectedItem(item)}
            >
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
                <iframe
                  src={`https://ordinals.com/content/${item.inscriptionId}`}
                  className="w-full h-full border-0"
                  title={item.name}
                  sandbox="allow-scripts allow-same-origin"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  style={{
                    transform: 'translateZ(0)',
                    willChange: 'auto',
                  }}
                  onError={(e) => {
                    console.log(`[TechGames] Iframe load error for ${item.name}`);
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
              )}
            </div>

            {/* Item Info */}
            <h3 
              className="text-xl font-bold text-white mb-2 cursor-pointer hover:text-red-600 transition-colors"
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

            {/* Price Info - nur anzeigen wenn price > 0 */}
            {item.price > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Price: {formatPrice(item.price)}</p>
                <p className="text-sm text-gray-400">+ inscription fees</p>
              </div>
            )}

            {/* Mint oder Test Button - mt-auto schiebt ihn nach unten */}
            <div className="mt-auto">
              {item.price > 0 ? (
                <button
                  onClick={() => handleMint(item)}
                  disabled={mintingStatus?.status === 'in-progress'}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                >
                  {mintingStatus?.status === 'in-progress' ? 'Minting...' : 'Mint'}
                </button>
              ) : (
                <button
                  onClick={() => setSelectedItem(item)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-semibold"
                >
                  Test
                </button>
              )}
            </div>
          </div>
        ))}
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
            className="p-4 border-t-2 border-red-600 bg-gray-900 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="text-sm text-gray-300 line-clamp-2">{selectedItem.description.split('\n\n')[0]}</p>
                </div>
                {/* Price Info - nur anzeigen wenn price > 0 */}
                {selectedItem.price > 0 && (
                  <div className="ml-4 text-right">
                    <p className="text-sm text-gray-400">Price</p>
                    <p className="text-lg font-bold text-red-600">{formatPrice(selectedItem.price)}</p>
                    <p className="text-xs text-gray-500">+ inscription fees</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

