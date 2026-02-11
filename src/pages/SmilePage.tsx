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

const SMILE_PRICE_SATS = 1000;
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
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{
        backgroundImage: 'url(/images/SmileaBittt.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-white drop-shadow-2xl">
            SMILE A BIT
          </h1>
          <p className="text-xl text-gray-300">
            100 Unique Bitcoin Smiley Ordinals
          </p>
        </div>

        {collectionReady === null ? (
          <div className="text-white text-center py-8">Loading...</div>
        ) : collectionReady === false ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl md:text-6xl font-bold text-red-600 drop-shadow-2xl mb-4">
                COMING SOON
              </p>
              <p className="text-gray-400 text-sm">Collection data not found.</p>
            </div>
          </div>
        ) : (
          /* Main Content - Two Column Layout (wie Mixtape) */
          <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 lg:gap-12">

            {/* Left Side: Mint Panel */}
            <div className="bg-black/80 border-2 border-red-600 rounded-xl p-8 max-w-lg w-full backdrop-blur-md">
              {/* Smiley Preview */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative mb-6 w-full max-w-sm aspect-square rounded-lg overflow-hidden shadow-2xl shadow-red-600/30 border border-red-600/30 bg-black flex items-center justify-center">
                  <img
                    src="/images/SmileaBittt.png"
                    alt="SMILE A BIT Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                {/* Price Display */}
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600 mb-1">
                    {SMILE_PRICE_SATS.toLocaleString()} sats
                  </p>
                  <p className="text-sm text-gray-400">
                    + inscription fees
                  </p>
                </div>
              </div>

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
              {!mintingStatus || mintingStatus.status === 'failed' ? (
                <button
                  onClick={handleMint}
                  disabled={isMinting || !walletState.connected}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-red-600/30"
                >
                  {isMinting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Minting...
                    </span>
                  ) : (
                    '🎲 MINT RANDOM SMILEY'
                  )}
                </button>
              ) : mintingStatus.status === 'completed' ? (
                <div className="text-center">
                  <p className="text-green-400 font-bold mb-4">Mint Successful!</p>
                  <button
                    onClick={() => setMintingStatus(null)}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                  >
                    Mint Another
                  </button>
                </div>
              ) : null}

              {/* Wallet Connection Info */}
              {!walletState.connected && (
                <p className="text-center text-gray-400 text-sm mt-4 cursor-pointer hover:text-white" onClick={() => setShowWalletConnect(true)}>
                  Connect your wallet to mint
                </p>
              )}

              <p className="text-xs text-gray-500 text-center mt-4">
                {totalItems} unique smileys · Sent to your Taproot address (bc1p...)
              </p>
            </div>

            {/* Right Side: Description */}
            <div className="bg-black/80 border-2 border-red-600/50 rounded-xl p-6 lg:p-8 max-w-xl w-full backdrop-blur-md">
              <div className="prose prose-invert prose-sm max-w-none">
                <h2 className="text-2xl font-bold text-white mb-2">
                  SMILE A BIT
                </h2>
                <p className="text-red-500 font-semibold text-lg mb-4">
                  Bitcoin Smiley Ordinals Collection
                </p>
                <p className="text-gray-300 text-lg italic mb-6">
                  Infinite good vibes.
                </p>

                <p className="text-gray-300 leading-relaxed mb-6">
                  Say hello to the smiley with the Bitcoin look – rocking the iconic <span className="text-red-500 font-semibold">₿-shaped glasses</span> and spreading nothing but positivity, energy, and real crypto emotion. Born from an idea back in 2021, this expressive icon first lit up the Ethereum blockchain… and now it's smiling its way onto Bitcoin with a limited Ordinals collection.
                </p>

                <p className="text-gray-300 leading-relaxed mb-6">
                  Each smiley reflects a different mood – from pure joy to crypto chaos – capturing the rollercoaster of Web3 life. But no matter the emotion, the message stays the same:
                </p>

                <div className="border-l-4 border-red-600 pl-4 py-2 mb-6 bg-red-600/10 rounded-r">
                  <p className="text-white font-bold text-lg">
                    Life is better with a smile. 😎
                  </p>
                </div>

                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🎲</span> How it works:
                </h3>

                <ul className="space-y-2 text-gray-300 mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span><strong className="text-white">100 unique smileys</strong> – each one different</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span><strong className="text-white">Random mint</strong> – you don't see which one you get</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>New SVG Ordinal inscribed <strong className="text-white">directly on Bitcoin</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>Sent to your <strong className="text-white">Taproot address (bc1p...)</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>Recursive SVG – composed of multiple on-chain layers</span>
                  </li>
                </ul>

                <div className="text-center mt-8 space-y-1">
                  <p className="text-white font-bold text-lg">
                    Let's turn frowns into ₿rowns.
                  </p>
                  <p className="text-red-500 font-bold text-lg italic">
                    Let's smile a bit – on-chain
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
};
