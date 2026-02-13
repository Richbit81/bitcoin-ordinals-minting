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
import { LinkGalleryPage } from './pages/LinkGalleryPage';
import { SmilePage } from './pages/SmilePage';
import { BitcoinMixtapePage } from './pages/BitcoinMixtapePage';
import { Orwell1984Page } from './pages/Orwell1984Page';
// NftMintingPage moved into RandomStuffPage
import { RandomStuffPage } from './pages/RandomStuffPage';
import { FreeStuffPage } from './pages/FreeStuffPage';
import { PalindromSoundBoxPage } from './pages/PalindromSoundBoxPage';
import { GalleryInscriptionToolPage } from './pages/GalleryInscriptionToolPage';
import RecursiveCollectionToolPage from './pages/RecursiveCollectionToolPage';
import CollectionDataToolPage from './pages/CollectionDataToolPage';
import { AvifConverterPage } from './pages/AvifConverterPage';
import { AudioSplitterPage } from './pages/AudioSplitterPage';
import { VideoSplitterPage } from './pages/VideoSplitterPage';
import { WalletProvider } from './contexts/WalletContext';
import { Gallery } from './components/Gallery';
import { MobileBottomNav } from './components/MobileBottomNav';
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
        <Route path="/bitcoin-mixtape" element={<BitcoinMixtapePage />} />
        <Route path="/1984" element={<Orwell1984Page />} />
        {/* NFT moved into /random-stuff */}
        <Route path="/free-stuff" element={<FreeStuffPage />} />
        <Route path="/random-stuff" element={<RandomStuffPage />} />
        <Route path="/collection/:id" element={<CollectionMintingPage />} />
        <Route path="/trade" element={<TradingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/play" element={<GamePage />} />
        <Route path="/link-gallery" element={<LinkGalleryPage />} />
        <Route path="/smile-a-bit" element={<SmilePage />} />
        <Route path="/palindrom-sound-box" element={<PalindromSoundBoxPage />} />
        <Route path="/admin/gallery-tool" element={<GalleryInscriptionToolPage />} />
        <Route path="/admin/recursive-tool" element={<RecursiveCollectionToolPage />} />
        <Route path="/admin/collection-data" element={<CollectionDataToolPage />} />
        <Route path="/admin/avif-converter" element={<AvifConverterPage />} />
        <Route path="/admin/audio-splitter" element={<AudioSplitterPage />} />
        <Route path="/admin/video-splitter" element={<VideoSplitterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showGallery && <Gallery onClose={() => setShowGallery(false)} />}
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
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
