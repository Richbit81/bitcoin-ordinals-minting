import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { logMinting } from '../services/mintingLog';
import {
  mintSmileRandom,
  loadSmileCollection,
  isTaprootAddress,
} from '../services/smileMintService';

const SMILE_PRICE_SATS = 8000;
const SMILE_DESCRIPTION = `SMILE A BIT – Bitcoin Smiley Ordinals Collection
Infinite good vibes.

Say hello to the smiley with the Bitcoin look – rocking the iconic ₿-shaped glasses and spreading nothing but positivity, energy, and real crypto emotion. Born from an idea back in 2021, this expressive icon first lit up the Ethereum blockchain… and now it's smiling its way onto Bitcoin with a limited Ordinals collection.

Each smiley reflects a different mood – from pure joy to crypto chaos – capturing the rollercoaster of Web3 life. But no matter the emotion, the message stays the same:
Life is better with a smile. 😎

Let's turn frowns into ₿rowns.
Let's smile a bit – on-chain`;

export const SmilePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collectionReady, setCollectionReady] = useState<boolean | null>(null);
  const [totalItems, setTotalItems] = useState(100);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  useEffect(() => {
    loadSmileCollection().then((col) => {
      if (col && col.generated.length > 0) {
        setCollectionReady(true);
        setTotalItems(col.generated.length);
        console.log(`[SmilePage] Collection geladen: ${col.generated.length} Items`);
      } else {
        setCollectionReady(false);
        console.warn('[SmilePage] Collection nicht gefunden');
      }
    });
  }, []);

  const handleMint = async () => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    // Taproot-Adresse suchen (Ordinals-Adresse)
    let userAddress = walletState.accounts[0].address;
    const ordinalsAccount = walletState.accounts.find(
      (acc) => acc.purpose === 'ordinals' || acc.address.startsWith('bc1p')
    );
    if (ordinalsAccount) {
      userAddress = ordinalsAccount.address;
      console.log(`[SmilePage] ✅ Verwende Taproot-Adresse: ${userAddress}`);
    }

    if (!isTaprootAddress(userAddress)) {
      alert('Ordinals werden nur an Taproot-Adressen (bc1p...) gesendet. Bitte verbinde eine Taproot-Wallet.');
      return;
    }

    setIsMinting(true);
    setMintingStatus({
      packId: 'smile-a-bit',
      status: 'processing',
      progress: 20,
    });

    try {
      const result = await mintSmileRandom(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat'
      );

      console.log(`[SmilePage] ✅ Mint erfolgreich: ${result.inscriptionId}`);

      // Minting-Log
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'smile-a-bit',
          packName: 'Smile A Bit',
          cards: [{
            id: `smile-${result.item.index}`,
            name: `Smile A Bit #${result.item.index}`,
            inscriptionId: result.inscriptionId,
            rarity: 'common',
          }],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: result.paymentTxid,
        });
        console.log('[SmilePage] Minting-Log gespeichert');
      } catch (logErr) {
        console.warn('[SmilePage] Log speichern fehlgeschlagen:', logErr);
      }

      setMintingStatus({
        packId: 'smile-a-bit',
        status: 'completed',
        progress: 100,
        inscriptionIds: [result.inscriptionId],
      });
    } catch (error: any) {
      console.error('[SmilePage] Mint-Fehler:', error);
      setMintingStatus({
        packId: 'smile-a-bit',
        status: 'failed',
        progress: 0,
        error: error.message || 'Minting failed',
      });
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black relative flex flex-col items-center justify-center overflow-hidden">
      {/* Hintergrundbild */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/SmileaBittt.png"
          alt="SMILE A BIT Background"
          className="w-full h-full object-cover opacity-30"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-8 py-20">
        {/* Zurück-Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors z-20"
        >
          ← Back
        </button>

        {/* Titel */}
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 text-center drop-shadow-2xl">
          SMILE A BIT
        </h1>

        {collectionReady === null ? (
          <div className="text-white text-center py-8">Loading...</div>
        ) : collectionReady === false ? (
          <div className="mt-auto mb-16">
            <p className="text-4xl md:text-6xl font-bold text-red-600 text-center drop-shadow-2xl mb-4">
              COMING SOON
            </p>
            <p className="text-gray-400 text-center text-sm">
              Collection data not found.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-lg">
            {/* Beschreibung */}
            <p className="text-gray-300 text-center mb-6 whitespace-pre-line">
              {SMILE_DESCRIPTION}
            </p>

            {/* Fee Rate Selector */}
            <div className="mb-6">
              <FeeRateSelector
                selectedFeeRate={inscriptionFeeRate}
                onFeeRateChange={setInscriptionFeeRate}
              />
            </div>

            {/* Minting Status */}
            {mintingStatus && (
              <div className="mb-6">
                <MintingProgress status={mintingStatus} />
              </div>
            )}

            {/* Mint Button */}
            <div className="bg-black/80 border-2 border-red-600 rounded-lg p-6 text-center backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-4 text-white">🎲 Random Mint</h3>
              <p className="text-gray-300 mb-4">
                You'll receive a random smiley – you don't see which one until it's yours!
              </p>
              <p className="text-red-600 font-bold text-xl mb-4">
                {SMILE_PRICE_SATS.toLocaleString()} sats
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Sent to your Taproot address (bc1p...)
              </p>
              <button
                onClick={handleMint}
                disabled={isMinting || !walletState.connected}
                className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors text-white"
              >
                {isMinting ? 'Minting...' : '🎲 Mint Random Smiley'}
              </button>
              <p className="text-xs text-gray-500 mt-4">
                {totalItems} unique smileys in collection
              </p>
            </div>

            {/* Wallet Connect */}
            {!walletState.connected && (
              <div className="text-center mt-8">
                <p className="text-gray-400 mb-4">Connect your wallet to mint</p>
                <button
                  onClick={() => setShowWalletConnect(true)}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white"
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wallet Connect Modal */}
      {showWalletConnect && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-black border-2 border-red-600 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-4 border-b-2 border-red-600">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={() => setShowWalletConnect(false)}
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
    </div>
  );
};
