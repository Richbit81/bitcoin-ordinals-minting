// Force redeploy - Environment Variable Update
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HeaderMenu } from './components/HeaderMenu';
import { HomePage } from './pages/HomePage';
import { MintingPage } from './pages/MintingPage';
import { TradingPage } from './pages/TradingPage';
import { HistoryPage } from './pages/HistoryPage';
import { GamePage } from './pages/GamePage';
import { PointShopPage } from './pages/PointShopPage';
import { TechGamesPage } from './pages/TechGamesPage';
import { CollectionMintingPage } from './pages/CollectionMintingPage';
import { WalletProvider } from './contexts/WalletContext';
import { Gallery } from './components/Gallery';
import { useState } from 'react';

function AppContent() {
  const [showGallery, setShowGallery] = useState(false);
  const location = useLocation();
  
  // HeaderMenu auf allen Seiten anzeigen, aber mit unterschiedlichen Optionen
  const isHomePage = location.pathname === '/';
  const isMintingPage = location.pathname === '/black-wild'; // Nur auf Mint-Seite

  return (
    <div className="min-h-screen bg-black">
      <HeaderMenu 
        onGalleryClick={() => setShowGallery(true)} 
        showFullMenu={!isHomePage}
        showMintingMenu={isMintingPage}
      />
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/black-wild" element={<MintingPage />} />
        <Route path="/point-shop" element={<PointShopPage />} />
        <Route path="/tech-games" element={<TechGamesPage />} />
        <Route path="/collection/:id" element={<CollectionMintingPage />} />
        <Route path="/trade" element={<TradingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/play" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showGallery && <Gallery onClose={() => setShowGallery(false)} />}
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
