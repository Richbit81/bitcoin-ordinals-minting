// Force redeploy - Environment Variable Update
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HeaderMenu } from './components/HeaderMenu';
import { WalletProvider } from './contexts/WalletContext';
import { useWallet } from './contexts/WalletContext';
import { PinkChatAuthProvider } from './contexts/PinkChatAuthContext';
import { isAdminAddress } from './config/admin';
import { Gallery } from './components/Gallery';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MarketplacePage } from './pages/MarketplacePage';
import { MarketplaceProfilePage } from './pages/MarketplaceProfilePage';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const MintingPage = lazy(() => import('./pages/MintingPage').then((m) => ({ default: m.MintingPage })));
const PointShopPage = lazy(() => import('./pages/PointShopPage').then((m) => ({ default: m.PointShopPage })));
const TechGamesPage = lazy(() => import('./pages/TechGamesPage').then((m) => ({ default: m.TechGamesPage })));
const BitcoinMixtapePage = lazy(() => import('./pages/BitcoinMixtapePage').then((m) => ({ default: m.BitcoinMixtapePage })));
const Orwell1984Page = lazy(() => import('./pages/Orwell1984Page').then((m) => ({ default: m.Orwell1984Page })));
const FreeStuffPage = lazy(() => import('./pages/FreeStuffPage').then((m) => ({ default: m.FreeStuffPage })));
const BooksOnchainPage = lazy(() => import('./pages/BooksOnchainPage').then((m) => ({ default: m.BooksOnchainPage })));
const RandomStuffPage = lazy(() => import('./pages/RandomStuffPage').then((m) => ({ default: m.RandomStuffPage })));
const CollectionMintingPage = lazy(() => import('./pages/CollectionMintingPage').then((m) => ({ default: m.CollectionMintingPage })));
const TradingPage = lazy(() => import('./pages/TradingPage').then((m) => ({ default: m.TradingPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const GamePage = lazy(() => import('./pages/GamePage').then((m) => ({ default: m.GamePage })));
const LinkGalleryPage = lazy(() => import('./pages/LinkGalleryPage').then((m) => ({ default: m.LinkGalleryPage })));
const SmilePage = lazy(() => import('./pages/SmilePage').then((m) => ({ default: m.SmilePage })));
const SlumsPage = lazy(() => import('./pages/SlumsPage').then((m) => ({ default: m.SlumsPage })));
const BadCatsPage = lazy(() => import('./pages/BadCatsPage').then((m) => ({ default: m.BadCatsPage })));
const PinkPuppetsPage = lazy(() => import('./pages/PinkPuppetsPage').then((m) => ({ default: m.PinkPuppetsPage })));
const PinkPuppetsMarketplacePage = lazy(() =>
  import('./pages/PinkPuppetsMarketplacePage').then((m) => ({ default: m.PinkPuppetsMarketplacePage }))
);
const PalindromSoundBoxPage = lazy(() => import('./pages/PalindromSoundBoxPage').then((m) => ({ default: m.PalindromSoundBoxPage })));
const PalindromTablePage = lazy(() => import('./pages/PalindromTablePage').then((m) => ({ default: m.PalindromTablePage })));
const VoidSculptorPage = lazy(() => import('./pages/VoidSculptorPage').then((m) => ({ default: m.VoidSculptorPage })));
const GalleryInscriptionToolPage = lazy(() => import('./pages/GalleryInscriptionToolPage').then((m) => ({ default: m.GalleryInscriptionToolPage })));
const RecursiveCollectionToolPage = lazy(() => import('./pages/RecursiveCollectionToolPage'));
const CollectionDataToolPage = lazy(() => import('./pages/CollectionDataToolPage'));
const AvifConverterPage = lazy(() => import('./pages/AvifConverterPage').then((m) => ({ default: m.AvifConverterPage })));
const AudioSplitterPage = lazy(() => import('./pages/AudioSplitterPage').then((m) => ({ default: m.AudioSplitterPage })));
const VideoSplitterPage = lazy(() => import('./pages/VideoSplitterPage').then((m) => ({ default: m.VideoSplitterPage })));
const MarketplaceAdminToolPage = lazy(() => import('./pages/MarketplaceAdminToolPage'));
const DimensionBreakPage = lazy(() => import('./pages/DimensionBreakPage').then((m) => ({ default: m.DimensionBreakPage })));
const RareSatSplitterPage = lazy(() => import('./pages/RareSatSplitterPage'));
const EitoBittoMarketplacePage = lazy(() =>
  import('./pages/EitoBittoMarketplacePage').then((m) => ({ default: m.EitoBittoMarketplacePage }))
);
const OrdinalOdditiesMarketplacePage = lazy(() =>
  import('./pages/OrdinalOdditiesMarketplacePage').then((m) => ({ default: m.OrdinalOdditiesMarketplacePage }))
);

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
      
      <Suspense fallback={<div className="px-4 py-6 text-sm text-gray-300">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/black-wild" element={<MintingPage />} />
          <Route path="/point-shop" element={<PointShopPage />} />
          <Route path="/tech-games" element={<TechGamesPage />} />
          <Route path="/bitcoin-mixtape" element={<BitcoinMixtapePage />} />
          <Route path="/1984" element={<Orwell1984Page />} />
          {/* NFT moved into /random-stuff */}
          <Route path="/free-stuff" element={<FreeStuffPage />} />
          <Route path="/books-onchain" element={<BooksOnchainPage />} />
          <Route path="/random-stuff" element={<RandomStuffPage />} />
          <Route path="/collection/:id" element={<CollectionMintingPage />} />
          <Route path="/trade" element={<TradingPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/play" element={<GamePage />} />
          <Route path="/link-gallery" element={<LinkGalleryPage />} />
          <Route path="/smile-a-bit" element={<SmilePage />} />
          <Route path="/slums" element={<SlumsPage />} />
          <Route path="/badcats" element={<BadCatsPage />} />
          <Route path="/dimension-break" element={<DimensionBreakPage />} />
          <Route path="/pinkpuppets" element={<PinkPuppetsPage />} />
          <Route path="/pinkpuppets/marketplace" element={<PinkPuppetsMarketplacePage />} />
          <Route path="/pinkpuppets/markerplace" element={<Navigate to="/pinkpuppets/marketplace" replace />} />
          <Route path="/cattack" element={<ExternalGameRedirect />} />
          <Route path="/catwar" element={<ExternalGameRedirect />} />
          <Route path="/palindrom-sound-box" element={<PalindromSoundBoxPage />} />
          <Route path="/palindrom-table" element={<PalindromTablePage />} />
          <Route path="/void-sculptor" element={<VoidSculptorPage />} />
          <Route path="/admin/gallery-tool" element={<GalleryInscriptionToolPage />} />
          <Route path="/admin/recursive-tool" element={<RecursiveCollectionToolPage />} />
          <Route path="/admin/collection-data" element={<CollectionDataToolPage />} />
          <Route path="/admin/avif-converter" element={<AvifConverterPage />} />
          <Route path="/admin/audio-splitter" element={<AudioSplitterPage />} />
          <Route path="/admin/video-splitter" element={<VideoSplitterPage />} />
          <Route path="/admin/marketplace-tool" element={<AdminRoute><MarketplaceAdminToolPage /></AdminRoute>} />
          <Route path="/admin/rare-sat-splitter" element={<AdminRoute><RareSatSplitterPage /></AdminRoute>} />
          <Route path="/EitoBitto" element={<EitoBittoMarketplacePage />} />
          <Route path="/eitobitto" element={<Navigate to="/EitoBitto" replace />} />
          <Route path="/ordinaloddities" element={<OrdinalOdditiesMarketplacePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/profile" element={<MarketplaceProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {showGallery && <Gallery onClose={() => setShowGallery(false)} />}
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

function ExternalGameRedirect() {
  useEffect(() => {
    window.location.replace('https://catwar-game.vercel.app/');
  }, []);

  return <div className="px-4 py-6 text-sm text-gray-300">Opening game...</div>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { walletState } = useWallet();
  const connectedAddress = walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && !!connectedAddress && isAdminAddress(connectedAddress);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <WalletProvider>
      <PinkChatAuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </PinkChatAuthProvider>
    </WalletProvider>
  );
}

export default App;
