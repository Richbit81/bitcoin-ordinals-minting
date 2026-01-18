import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { WalletType, WalletAccount } from '../types/wallet';
import { waitForUnisat, waitForXverse } from '../utils/wallet';
import { WalletConnectFallback } from './WalletConnectFallback';
import { FEATURES } from '../config/features';

interface WalletConnectProps {
  onConnected?: () => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ onConnected }) => {
  const { walletState, connect, connectManually, disconnect } = useWallet();
  
  // Rufe Callback auf, wenn Wallet verbunden wurde
  React.useEffect(() => {
    if (walletState.connected && walletState.accounts && walletState.accounts.length > 0 && onConnected) {
      console.log('WalletConnect: Wallet connected, calling onConnected callback');
      onConnected();
    }
  }, [walletState.connected, walletState.accounts, onConnected]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unisatAvailable, setUnisatAvailable] = useState(false);
  const [xverseAvailable, setXverseAvailable] = useState(false);
  const [isCheckingWallets, setIsCheckingWallets] = useState(true);
  const [showFallback, setShowFallback] = useState(false);

  // Warte auf Wallet-Extensions (wichtig für localhost!)
  useEffect(() => {
    const checkWallets = async () => {
      setIsCheckingWallets(true);
      
      // Warte bis zu 3 Sekunden auf Wallets
      // UniSat nur prüfen wenn Feature aktiviert ist
      const [unisat, xverse] = await Promise.all([
        FEATURES.ENABLE_UNISAT ? waitForUnisat(3000) : Promise.resolve(false),
        waitForXverse(3000),
      ]);
      
      setUnisatAvailable(FEATURES.ENABLE_UNISAT && unisat);
      setXverseAvailable(xverse);
      setIsCheckingWallets(false);

      // Debug-Ausgabe - Detailliert
      const debugInfo = {
        unisat,
        xverse,
        windowUnisat: typeof window !== 'undefined' ? typeof window.unisat : 'N/A',
        windowBitcoinProvider: typeof window !== 'undefined' ? typeof window.BitcoinProvider : 'N/A',
        windowXverse: typeof window !== 'undefined' ? typeof window.xverse : 'N/A',
        location: typeof window !== 'undefined' ? window.location?.href : 'N/A',
        allWindowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.toLowerCase().includes('bitcoin') || k.toLowerCase().includes('unisat') || k.toLowerCase().includes('xverse')) : [],
      };
      console.log('🔍 Wallet Check - Detailliert:', debugInfo);
      
      // Prüfe direkt auf window-Objekte
      if (typeof window !== 'undefined') {
        console.log('🔍 Direkte Prüfung:');
        console.log('  window.unisat:', window.unisat);
        console.log('  window.BitcoinProvider:', window.BitcoinProvider);
        console.log('  window.xverse:', (window as any).xverse);
        console.log('  window.bitcoin:', (window as any).bitcoin);
        
        // Prüfe alle möglichen Wallet-Keys
        const walletKeys = Object.keys(window).filter(k => 
          k.toLowerCase().includes('bitcoin') || 
          k.toLowerCase().includes('unisat') || 
          k.toLowerCase().includes('xverse') ||
          k.toLowerCase().includes('wallet')
        );
        if (walletKeys.length > 0) {
          console.log('  Gefundene Wallet-Keys:', walletKeys);
        }
      }
    };

    checkWallets();

    // Prüfe erneut alle 2 Sekunden (falls Extension später lädt)
    const retryInterval = setInterval(async () => {
      if ((!unisatAvailable && FEATURES.ENABLE_UNISAT) || !xverseAvailable) {
        const [unisat, xverse] = await Promise.all([
          FEATURES.ENABLE_UNISAT ? waitForUnisat(2000) : Promise.resolve(false),
          waitForXverse(2000),
        ]);
        setUnisatAvailable(prev => prev || (FEATURES.ENABLE_UNISAT && unisat));
        setXverseAvailable(prev => prev || xverse);
      }
    }, 2000);

    return () => clearInterval(retryInterval);
  }, []);

  const handleConnect = async (walletType: WalletType) => {
    if (!walletType) return;

    setIsConnecting(true);
    setError(null);

    try {
      await connect(walletType);
      // Erfolgreich verbunden - keine Fehler mehr
      setError(null);
    } catch (err: any) {
      // Detaillierte Fehlerbehandlung
      let errorMessage = err.message || 'Unknown error occurred';
      
      // Spezifische Fehler erkennen
      if (errorMessage.includes('intercept') || errorMessage.includes('multiple wallet')) {
        errorMessage = 'Multiple wallet extensions detected. Please disable other Bitcoin wallet extensions (keep only the one you want to use) and reload the page.';
      } else if (errorMessage.includes('User rejected')) {
        errorMessage = 'Connection rejected. Please approve the connection request in your wallet popup.';
      } else if (errorMessage.includes('not available') || errorMessage.includes('API is not available')) {
        errorMessage = 'Wallet extension detected but connection failed. Try:\n1. Unlock your wallet\n2. Disable other Bitcoin wallet extensions\n3. Reload the page';
      }
      
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
  };

  const handleFallbackConnect = (account: WalletAccount) => {
    try {
      connectManually(account);
      setError(null);
      setShowFallback(false);
    } catch (err: any) {
      setError(err.message || 'Error with manual connection');
    }
  };

  // Zeige Loading während Wallet-Check
  if (isCheckingWallets) {
    return (
      <div className="bg-black border-2 border-red-600 rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-4"></div>
          <p className="text-white font-semibold">Checking wallets...</p>
          <p className="text-xs text-gray-400 mt-2">
            If wallets are not detected, try reloading the page.
          </p>
        </div>
      </div>
    );
  }

  if (walletState.connected) {
    return (
      <div className="bg-black border-2 border-red-600 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4 border-b-2 border-red-600 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              Wallet Connected
            </h3>
            <p className="text-sm text-gray-400 capitalize">
              {walletState.walletType} Wallet
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-600 text-white border-2 border-white rounded-lg hover:bg-white hover:text-black font-bold transition"
          >
            Disconnect
          </button>
        </div>
        
        <div className="bg-gray-900 border-2 border-red-600 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Address</p>
          <p className="text-sm font-mono text-white break-all">
            {walletState.accounts[0]?.address}
          </p>
          {!walletState.accounts[0]?.address.startsWith('bc1p') && (
            <p className="text-xs text-red-600 mt-2 font-semibold">
              ⚠️ Please use a Taproot address (bc1p...)
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-gray-900 border-2 border-red-600 text-red-600 rounded">
            <p className="font-semibold">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-black border-2 border-red-600 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4 border-b-2 border-red-600 pb-2">
        Connect Wallet
      </h3>
      <p className="text-sm text-gray-300 mb-6">
        Please connect your wallet to start minting.
      </p>

      <div className="space-y-3">
        {/* Info bei mehreren Extensions */}
        {FEATURES.ENABLE_UNISAT && unisatAvailable && xverseAvailable && (
          <div className="mb-4 p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
            <p className="text-sm font-bold text-gray-300 mb-1">
              ℹ️ Multiple Wallet Extensions Detected
            </p>
            <p className="text-xs text-gray-400">
              Both UniSat and Xverse are installed. The console warning "Failed to inject unisat" is harmless and can be ignored. Choose your preferred wallet below.
            </p>
          </div>
        )}

        {/* Fallback-Option anzeigen wenn keine AKTIVIERTEN Wallets gefunden */}
        {!xverseAvailable && (!FEATURES.ENABLE_UNISAT || !unisatAvailable) && !showFallback && (
          <div className="mb-4 p-4 bg-gray-900 border-2 border-red-600 rounded-lg">
            <p className="text-sm font-bold text-red-600 mb-2">
              ⚠️ Wallet Extensions Not Detected
            </p>
            <p className="text-xs text-gray-300 mb-3">
              Browser extensions were not found. This is normal on localhost.
            </p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setShowFallback(true)}
                className="px-4 py-2 bg-white text-black border-2 border-red-600 rounded text-sm hover:bg-red-600 hover:text-white font-bold transition"
              >
                🔧 Manual Connection (for Testing)
              </button>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-red-600 font-bold">ℹ️ Why don't extensions work on localhost?</summary>
              <div className="mt-2 p-2 bg-black border border-gray-700 rounded text-xs text-gray-300">
                <p className="mb-2">
                  Many browser extensions (including UniSat & Xverse) don't work on <code className="text-red-600">localhost</code> or <code className="text-red-600">127.0.0.1</code> for security reasons.
                </p>
                <p className="mb-2">
                  <strong className="text-white">Solutions:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>In production on an HTTPS domain it will work</li>
                  <li>For testing: Use the manual connection above</li>
                  <li>Alternative: Use ngrok or similar tools for HTTPS tunnels</li>
                </ul>
              </div>
            </details>
          </div>
        )}

        {/* Fallback-Komponente anzeigen */}
        {showFallback && (
          <div className="mb-4">
            <WalletConnectFallback onConnect={handleFallbackConnect} />
            <button
              onClick={() => setShowFallback(false)}
              className="mt-2 text-sm text-gray-400 hover:text-white font-semibold"
            >
              ← Back to Extension Buttons
            </button>
          </div>
        )}

        {/* UniSat Wallet - Nur anzeigen wenn Feature aktiviert */}
        {FEATURES.ENABLE_UNISAT && (unisatAvailable ? (
          <button
            onClick={() => handleConnect('unisat')}
            disabled={isConnecting}
            className="w-full flex items-center justify-center px-6 py-4 bg-white text-black border-2 border-red-600 rounded-lg font-bold hover:bg-red-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              'Connecting...'
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                Connect UniSat Wallet
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={async () => {
                console.log('🔧 Manuelle Prüfung UniSat...');
                // Prüfe nochmal manuell
                const unisat = await waitForUnisat(1000);
                if (unisat) {
                  setUnisatAvailable(true);
                  alert('✅ UniSat Wallet gefunden! Klicke auf "Connect UniSat Wallet"');
                } else {
                  alert(
                    `❌ UniSat Wallet nicht gefunden\n\n` +
                    `Lösung:\n` +
                    `1. Öffne: chrome://extensions/ (Chrome) oder about:addons (Firefox)\n` +
                    `2. Suche nach "UniSat Wallet"\n` +
                    `3. Stelle sicher, dass die Extension aktiviert ist\n` +
                    `4. Lade die Seite neu (F5)\n` +
                    `5. Versuche: http://127.0.0.1:3008 statt localhost\n\n` +
                    `Falls installiert: Extension neu laden in chrome://extensions/`
                  );
                }
              }}
              className="w-full flex items-center justify-center px-6 py-4 bg-gray-900 text-white border-2 border-gray-700 rounded-lg font-bold hover:border-red-600 transition"
            >
              🔧 Prüfe UniSat erneut
            </button>
            <a
              href="https://unisat.io/download"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center px-6 py-4 bg-gray-800 text-white border-2 border-gray-600 rounded-lg font-semibold hover:border-gray-500 transition text-sm"
            >
              Install UniSat Wallet
            </a>
          </div>
        ))}

        {xverseAvailable ? (
          <button
            onClick={() => handleConnect('xverse')}
            disabled={isConnecting}
            className="w-full flex items-center justify-center px-6 py-4 bg-white text-black border-2 border-red-600 rounded-lg font-bold hover:bg-red-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              'Connecting...'
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                Connect Xverse Wallet
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <a
              href="https://www.xverse.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center px-6 py-4 bg-gray-900 text-white border-2 border-gray-700 rounded-lg font-bold hover:border-red-600 transition"
            >
              Install Xverse Wallet
            </a>
            <button
              onClick={async () => {
                console.log('🔧 Manuelle Prüfung Xverse...');
                // Prüfe nochmal manuell
                const xverse = await waitForXverse(1000);
                if (xverse) {
                  setXverseAvailable(true);
                  alert('✅ Xverse Wallet gefunden! Klicke auf "Connect Xverse Wallet"');
                } else {
                  alert(
                    `❌ Xverse Wallet nicht gefunden\n\n` +
                    `Lösung:\n` +
                    `1. Öffne: chrome://extensions/ (Chrome) oder about:addons (Firefox)\n` +
                    `2. Suche nach "Xverse Wallet"\n` +
                    `3. Stelle sicher, dass die Extension aktiviert ist\n` +
                    `4. Lade die Seite neu (F5)\n` +
                    `5. Versuche: http://127.0.0.1:3008 statt localhost\n\n` +
                    `Falls installiert: Extension neu laden in chrome://extensions/`
                  );
                }
              }}
              className="w-full flex items-center justify-center px-6 py-4 bg-gray-900 text-white border-2 border-gray-700 rounded-lg font-bold hover:border-red-600 transition"
            >
              🔧 Prüfe Xverse erneut
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-gray-900 border-2 border-red-600 text-red-600 rounded">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-900 border-2 border-red-600 rounded-lg">
        <p className="text-xs text-gray-300">
          <strong className="text-white">Note:</strong> Please make sure you use a Taproot address (bc1p...) in your wallet. Ordinals are only supported on Taproot addresses.
        </p>
      </div>
    </div>
  );
};

