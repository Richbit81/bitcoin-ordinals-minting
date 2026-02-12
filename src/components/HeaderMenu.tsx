import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from './WalletConnect';
import { AdminPanel } from './AdminPanel';
import { isAdminAddress } from '../config/admin';

interface HeaderMenuProps {
  onGalleryClick: () => void;
  showFullMenu?: boolean; // Wenn false, werden nur Wallet-Info und Disconnect angezeigt (für HomePage)
  showMintingMenu?: boolean; // Wenn true, werden Gallery, History, Play, Trade angezeigt (nur auf Mint-Seite)
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({ 
  onGalleryClick, 
  showFullMenu = true,
  showMintingMenu = false
}) => {
  const navigate = useNavigate();
  const { walletState, disconnect, isUnisatInstalled, isXverseInstalled } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Prüfe ob verbundene Adresse Admin ist
  const isAdmin = walletState.connected && 
    walletState.accounts[0]?.address && 
    isAdminAddress(walletState.accounts[0].address);

  // Debug: Log wallet state changes
  React.useEffect(() => {
    console.log('HeaderMenu: walletState updated:', walletState);
  }, [walletState]);

  // Schließe Modal wenn Wallet verbunden wurde
  React.useEffect(() => {
    if (showWalletModal && walletState.connected && walletState.accounts && walletState.accounts.length > 0) {
      console.log('HeaderMenu: Closing wallet modal - wallet connected:', walletState.accounts[0].address, 'State:', walletState);
      // Schließe Modal mit kurzer Verzögerung, damit der User sieht, dass es funktioniert hat
      setTimeout(() => {
        setShowWalletModal(false);
      }, 500);
    }
  }, [showWalletModal, walletState.connected, walletState.accounts, walletState]);

  const handleDisconnect = () => {
    disconnect();
    setShowMenu(false);
  };

  return (
    <>
      {/* Home Button - oben links (nur wenn nicht auf HomePage) - auf Mobile versteckt wenn Bottom Nav da ist */}
      {showFullMenu && (
        <div className="fixed top-2 md:top-4 left-2 md:left-4 z-50">
          <button
            onClick={() => navigate('/')}
            className="bg-black border border-red-600 rounded shadow-lg px-2 md:px-3 py-2 flex items-center gap-2 hover:bg-red-600 active:scale-95 transition-all duration-300 text-sm touch-manipulation"
            title="To Home Page"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-bold text-white">Home</span>
          </button>
        </div>
      )}

      <div className="fixed top-2 md:top-4 right-2 md:right-4 z-50">
        <div className="relative">
          {/* Menu Button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="bg-black border border-red-600 rounded shadow-lg px-3 py-2 flex items-center gap-2 hover:bg-red-600 transition text-sm"
          >
            {walletState.connected && walletState.accounts && walletState.accounts.length > 0 ? (
              <>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" style={{ willChange: 'opacity, transform' }}></div>
                <span className="text-sm font-bold text-white">
                  Connected
                </span>
                <span className="text-xs font-mono text-gray-300">
                  {walletState.accounts[0]?.address?.slice(0, 6)}...{walletState.accounts[0]?.address?.slice(-4)}
                </span>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-white">Connect Wallet</span>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-56 bg-black border-2 border-red-600 rounded-lg shadow-xl z-50 py-2">
                {walletState.connected ? (
                  <>
                    <div className="px-4 py-2 border-b-2 border-red-600">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Wallet</p>
                      <p className="text-sm font-bold text-white capitalize">{walletState.walletType}</p>
                      <p className="text-xs font-mono text-gray-400 truncate mt-1">
                        {walletState.accounts[0]?.address}
                      </p>
                    </div>
                    {/* Nur auf Mint-Seite: Zeige Gallery, History, Play, Trade */}
                    {showMintingMenu && (
                      <>
                        <button
                          onClick={() => {
                            onGalleryClick();
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                        >
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-semibold">Gallery</span>
                        </button>
                        {/* History Button */}
                        <button
                          onClick={() => {
                            navigate('/history');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                        >
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">History</span>
                        </button>
                        {/* Play Button */}
                        <button
                          onClick={() => {
                            navigate('/play');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                        >
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">Play</span>
                        </button>
                        {/* Trade Button */}
                        <button
                          onClick={() => {
                            navigate('/trade');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                        >
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className="font-semibold">Trade</span>
                        </button>
                      </>
                    )}
                    {/* Mint-Seite Link - nur wenn showFullMenu true ist, aber nicht auf Mint-Seite selbst */}
                    {showFullMenu && !showMintingMenu && (
                      <button
                        onClick={() => {
                          navigate('/black-wild');
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                      >
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="font-semibold">Mint</span>
                      </button>
                    )}
                    {/* Admin Buttons - nur für Admins sichtbar */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowAdminPanel(true);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                      >
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-semibold">Admin Panel</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          navigate('/admin/gallery-tool');
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                      >
                        <span className="w-5 h-5 flex items-center justify-center text-emerald-400">🖼️</span>
                        <span className="font-semibold">Inscription Tool</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          navigate('/admin/recursive-tool');
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                      >
                        <span className="w-5 h-5 flex items-center justify-center text-purple-400">🎨</span>
                        <span className="font-semibold">Recursive Generator</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          navigate('/admin/collection-data');
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                      >
                        <span className="w-5 h-5 flex items-center justify-center text-amber-400">📊</span>
                        <span className="font-semibold">Collection Data</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          navigate('/admin/avif-converter');
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2 border-b border-gray-800"
                      >
                        <span className="w-5 h-5 flex items-center justify-center text-green-400">🖼</span>
                        <span className="font-semibold">AVIF Converter</span>
                      </button>
                    )}
                    <button
                      onClick={handleDisconnect}
                      className="w-full text-left px-4 py-2 hover:bg-gray-900 text-red-600 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="font-semibold">Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setShowWalletModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-900 text-white flex items-center gap-2"
                  >
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="font-semibold">Connect Wallet</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Wallet Connect Modal */}
      {showWalletModal && !walletState.connected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-black border-2 border-red-600 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b-2 border-red-600">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <WalletConnect onConnected={() => {
                console.log('WalletConnect callback called, closing modal');
                setShowWalletModal(false);
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </>
  );
};

