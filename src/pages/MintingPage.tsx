import React, { useState, useEffect, useCallback } from 'react';
import { WalletConnect } from '../components/WalletConnect';
import { PackSelector } from '../components/PackSelector';
import { MintingProgress } from '../components/MintingProgress';
import { Gallery } from '../components/Gallery';
import { useWallet } from '../contexts/WalletContext';
import { CardPack, MintingStatus } from '../types/wallet';
import { createBatchDelegates } from '../services/delegate';
import { PACK_CONFIGS } from '../config/packs';
import { checkPackAvailability, incrementPackSupply } from '../services/packSupply';
import { logMinting } from '../services/mintingLog';
import { generatePremiumPack, generateStarterPack } from '../utils/rarityDistribution';
import { ALL_CARDS, ANIMAL_CARDS } from '../config/cards';
import { ACTION_CARDS, STATUS_CARDS } from '../config/actionStatusCards';
import { addPointsAfterMinting } from '../services/pointsService';
import { PointsDisplay } from '../components/PointsDisplay';

export const MintingPage: React.FC = () => {
  console.log('✅✅✅ MINTING PAGE GELADEN - VERSION 3.0 - UNISAT API! ✅✅✅');
  console.log('[MintingPage] ✅ Diese Version verwendet UniSat API mit Zahlungen!');
  
  const { walletState, connect } = useWallet();
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [mintingPackId, setMintingPackId] = useState<string | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    console.log('[MintingPage] ✅ Minting-Seite wurde geladen');
  }, []);

  const handleMintInternal = useCallback(async (packId: string) => {
    console.log('✅✅✅ VERSION 3.0 - UNISAT API! ✅✅✅');
    console.log('[MintingPage] ========== HANDLE MINT START ==========');
    
    const pack = PACK_CONFIGS.find((p) => p.id === packId);
    if (!pack) {
      alert('Pack not found');
      return;
    }

    console.log('[MintingPage] Pack ID:', packId);
    console.log('[MintingPage] Wallet State:', { connected: walletState.connected, walletType: walletState.walletType, accounts: walletState.accounts.length });

    if (!walletState.connected || !walletState.accounts[0]) {
      console.log('[MintingPage] Wallet nicht verbunden - zeige Connect-Modal');
      setPendingPackId(packId);
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    console.log('[MintingPage] User Address:', userAddress);

    setMintingPackId(packId);
    setMintingStatus({
      packId,
      status: 'pending',
      progress: 0,
    });

    try {
      console.log('[MintingPage] ========== TRY BLOCK START ==========');

      // Schritt 1: Pack-Verfügbarkeit prüfen
      const isAvailable = await checkPackAvailability(packId);
      if (!isAvailable) {
        throw new Error('Pack ist nicht mehr verfügbar');
      }

      setMintingStatus((prev) => prev ? { ...prev, progress: 10, status: 'processing' } : null);

      // Schritt 2: Karten generieren
      let cards;
      if (packId === 'premium-pack') {
        cards = generatePremiumPack(ALL_CARDS);
      } else {
        // Starter Pack: 5 Karten
        cards = generateStarterPack(5, ANIMAL_CARDS, ACTION_CARDS, STATUS_CARDS);
      }
      console.log('[MintingPage] ✅', cards.length, 'Cards generiert');

      setMintingStatus((prev) => prev ? { ...prev, progress: 30 } : null);

      // Schritt 3: Inskriptionen erstellen + Zahlungen
      console.log('[MintingPage] ✅ Erstelle Inskriptionen über UniSat API...');
      setMintingStatus((prev) => prev ? { ...prev, progress: 40 } : null);

      const results = await createBatchDelegates(
        cards,
        userAddress,
        'Black & Wild', // Collection ID
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        pack.price
      );

      // NEU: Automatisches Polling für finale Inskription-IDs
      console.log('[MintingPage] 🔍 Starte automatische Status-Prüfung für finale IDs...');
      let finalResults = [...results];
      let attempts = 0;
      const maxAttempts = 10; // 10 Versuche über 5 Minuten
      let pollingInterval: NodeJS.Timeout | null = null;
      
      const checkForFinalIds = async () => {
        try {
          const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
          const checkResponse = await fetch(`${API_URL}/api/unisat/check-pending-inscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: userAddress }),
          });
          
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            if (checkData.updated > 0) {
              // Hole aktualisierte Delegates
              const delegatesResponse = await fetch(`${API_URL}/api/delegates/${userAddress}?checkPending=false`);
              if (delegatesResponse.ok) {
                const delegates = await delegatesResponse.json();
                
                // Aktualisiere results mit finalen IDs
                const updatedResults = results.map((result, index) => {
                  const pendingId = result.inscriptionId;
                  if (pendingId.startsWith('pending-')) {
                    // Finde Delegate mit passender Karte (über originalInscriptionId und cardId)
                    const card = cards[index];
                    const delegate = delegates.find((d: any) => {
                      // Prüfe ob die Delegate-Daten zur Karte passen
                      const matchesCard = d.originalInscriptionId === card?.inscriptionId && 
                                         d.cardId === card?.id;
                      
                      // Wenn noch pending, prüfe ob die pending-ID passt
                      if (d.delegateInscriptionId.startsWith('pending-')) {
                        return matchesCard && d.delegateInscriptionId === pendingId;
                      }
                      
                      // Wenn final, prüfe nur die Karten-Daten
                      return matchesCard;
                    });
                    
                    if (delegate && !delegate.delegateInscriptionId.startsWith('pending-')) {
                      console.log(`[MintingPage] ✅ Finale ID gefunden: ${pendingId} -> ${delegate.delegateInscriptionId}`);
                      return { ...result, inscriptionId: delegate.delegateInscriptionId };
                    }
                  }
                  return result;
                });
                
                // Prüfe ob sich etwas geändert hat
                const hasChanges = updatedResults.some((r, i) => r.inscriptionId !== finalResults[i]?.inscriptionId);
                if (hasChanges) {
                  finalResults = updatedResults;
                  
                  // Aktualisiere UI
                  setMintingStatus((prev) => prev ? {
                    ...prev,
                    inscriptionIds: finalResults.map(r => r.inscriptionId),
                    cards: cards.map((card, index) => ({
                      ...card,
                      inscriptionId: finalResults[index]?.inscriptionId || card.inscriptionId,
                    })),
                  } : null);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[MintingPage] Status-Prüfung fehlgeschlagen:', err);
        }
      };
      
      // Starte Polling (alle 30 Sekunden)
      pollingInterval = setInterval(async () => {
        attempts++;
        if (attempts >= maxAttempts) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          console.log('[MintingPage] ⏱️ Polling beendet nach', maxAttempts, 'Versuchen');
        } else {
          await checkForFinalIds();
        }
      }, 30000); // Alle 30 Sekunden
      
      // Erste Prüfung sofort
      await checkForFinalIds();

      setMintingStatus((prev) => prev ? { ...prev, progress: 70 } : null);

      // Schritt 4: Punkte hinzufügen
      try {
        await addPointsAfterMinting(userAddress, packId, pack.name, cards.length);
      } catch (err) {
        console.warn('Error adding points:', err);
      }

      // Schritt 5: Minting-Log speichern
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: pack.id,
          packName: pack.name,
          cards: cards.map((card, index) => ({
            ...card,
            inscriptionId: finalResults[index]?.inscriptionId || card.inscriptionId,
          })),
          inscriptionIds: finalResults.map(r => r.inscriptionId),
          txids: finalResults.map(r => r.txid),
          paymentTxid: finalResults[0]?.paymentTxid || 'unisat-api',
        });
      } catch (err) {
        console.warn('Error saving minting log:', err);
      }

      // Schritt 6: Pack-Supply aktualisieren
      try {
        await incrementPackSupply(packId);
      } catch (err) {
        console.warn('Error updating pack availability:', err);
      }

      setMintingStatus((prev) =>
        prev
          ? {
              ...prev,
              progress: 90,
              inscriptionIds: finalResults.map(r => r.inscriptionId),
              cards: cards.map((card, index) => ({
                ...card,
                inscriptionId: finalResults[index]?.inscriptionId || card.inscriptionId,
              })),
            }
          : null
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Stoppe Polling wenn abgeschlossen
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      setMintingStatus((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              progress: 100,
              inscriptionIds: finalResults.map(r => r.inscriptionId),
              cards: cards.map((card, index) => ({
                ...card,
                inscriptionId: finalResults[index]?.inscriptionId || card.inscriptionId,
              })),
            }
          : null
      );
    } catch (error: any) {
      console.error('[MintingPage] Minting-Fehler:', error);
      setMintingStatus((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              error: error.message || 'Unknown error',
            }
          : null
      );
    } finally {
      setMintingPackId(null);
      // Stoppe Polling falls noch aktiv
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    }
  }, [walletState, inscriptionFeeRate]);

  const handleMint = useCallback((packId: string) => {
    handleMintInternal(packId);
  }, [handleMintInternal]);

  useEffect(() => {
    if (showWalletConnect && walletState.connected && pendingPackId) {
      setShowWalletConnect(false);
      handleMintInternal(pendingPackId);
      setPendingPackId(null);
    }
  }, [showWalletConnect, walletState.connected, pendingPackId, handleMintInternal]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-4xl font-bold text-center mb-2 border-b-2 border-red-600 pb-4">
          <span 
            className="text-black"
            style={{
              textShadow: '-1px -1px 1px rgba(255, 255, 255, 0.5), 1px -1px 1px rgba(255, 255, 255, 0.5), -1px 1px 1px rgba(255, 255, 255, 0.5), 1px 1px 1px rgba(255, 255, 255, 0.5), 0 0 2px rgba(255, 255, 255, 0.3)'
            }}
          >
            BLACK
          </span>
          <span className="text-red-600 mx-1">&</span>
          <span className="text-white">WILD</span>
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Mint your card packs
        </p>

        {walletState.connected && <PointsDisplay />}

        {mintingStatus && (
          <div className="mb-6">
            <MintingProgress status={mintingStatus} />
          </div>
        )}

        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-red-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-red-600">
                <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
                <button
                  onClick={() => {
                    setShowWalletConnect(false);
                    setPendingPackId(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <WalletConnect onConnected={() => setShowWalletConnect(false)} />
              </div>
            </div>
          </div>
        )}

        <PackSelector
          packs={PACK_CONFIGS}
          onMint={handleMint}
          mintingPackId={mintingPackId}
          inscriptionFeeRate={inscriptionFeeRate}
          onFeeRateChange={setInscriptionFeeRate}
        />

        <div className="mt-6 text-center text-gray-300 text-xs border-t border-red-600 pt-3">
          <p className="mt-1">
            Ordinals are only supported on Taproot addresses (bc1p...).
          </p>
        </div>
      </div>

      {showGallery && <Gallery onClose={() => setShowGallery(false)} />}
    </div>
  );
};


