import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getPoints, PointsData } from '../services/pointsService';
import { getAllCollections, Collection } from '../services/collectionService';
import { CollectionCard } from '../components/CollectionCard';
import { NewsBanner } from '../components/NewsBanner';
import { ProgressiveImage } from '../components/ProgressiveImage';
import { MempoolFeesBanner } from '../components/MempoolFeesBanner';
import { MempoolDetailsModal } from '../components/MempoolDetailsModal';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [isMempoolModalOpen, setIsMempoolModalOpen] = useState(false);

  // Statische Projekte (immer vorhanden)
  const staticProjects = [
    {
      id: 'black-wild',
      name: 'Black & Wild',
      thumbnail: '/thumbnail_Unbenanntes_Projekt-2026-01-01T222604.577-ezgif.com-apng-to-avif-converter - Kopie.avif',
      description: 'Bitcoin Ordinals Card Game',
      order: 1,
    },
    {
      id: 'tech-games',
      name: 'TECH & GAMES',
      thumbnail: '/techgame.png',
      description: 'Interactive games and tech tools',
      order: 3,
    },
    {
      id: 'point-shop',
      name: 'Point Shop',
      thumbnail: '/pointshop.png',
      description: 'Mint exclusive Ordinals with your points',
      order: 4,
    },
    {
      id: 'bitcoin-mixtape',
      name: 'Bitcoin Mix Tape',
      thumbnail: '/mixtape.png',
      description: 'Coming Soon',
      order: 6,
    },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📋 REGEL FÜR ALLE ZUKÜNFTIGEN COLLECTIONS (Admin Panel):
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ HAUPTSEITE: Nur Titel anzeigen (KEINE Beschreibung)
  // ✅ MINT-SEITE: Vollständige Beschreibung + Details anzeigen
  // 
  // Technische Umsetzung:
  // - Dynamische Collections haben ein `collectionId` Feld
  // - Beschreibung wird nur angezeigt wenn `!project.collectionId`
  // - Statische Projekte (Black & Wild, Tech & Games) zeigen Beschreibung
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Dynamische Projekte aus Collections
  // NUR Collections OHNE page Feld (z.B. Sons of Satoshi Evolution)
  // Collections MIT page Feld sind bereits in staticProjects definiert
  const dynamicProjects = collections
    .filter(collection => !collection.page || collection.page === '')
    .map(collection => {
      const projectId = collection.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      
      // Sons of Satoshi Evolution bekommt Position 2 (nach Black & Wild, vor Tech Games)
      const order = collection.name.toLowerCase().includes('sons of satoshi') ? 2 : 5; // Standard: 5 (nach Point Shop)
      
      return {
        id: projectId,
        name: collection.name,
        thumbnail: collection.thumbnail || '/images/RichArt.png',
        description: collection.description || 'Collection',
        order: order,
        collectionId: collection.id, // Für Navigation
      };
    });

  // Kombiniere statische und dynamische Projekte, entferne Duplikate
  const allProjectIds = new Set([...staticProjects.map(p => p.id), ...dynamicProjects.map(p => p.id)]);
  const projects = [
    ...staticProjects,
    ...dynamicProjects.filter(p => !staticProjects.some(sp => sp.id === p.id)),
  ].sort((a, b) => (a.order || 999) - (b.order || 999));

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      loadPoints();
    } else {
      setPointsData(null);
    }
  }, [walletState.connected, walletState.accounts]);

  const loadPoints = async () => {
    if (!walletState.accounts[0]) return;
    
    setLoading(true);
    try {
      const data = await getPoints(walletState.accounts[0].address);
      setPointsData(data);
    } catch (error) {
      console.error('Error loading points:', error);
      setPointsData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    setLoadingCollections(true);
    try {
      const data = await getAllCollections();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
      setCollections([]);
    } finally {
      setLoadingCollections(false);
    }
  };

  return (
    <>
      {/* Mempool Fees Banner - ganz oben */}
      <MempoolFeesBanner onDetailsClick={() => setIsMempoolModalOpen(true)} />
      
      {/* Mempool Details Modal */}
      <MempoolDetailsModal 
        isOpen={isMempoolModalOpen} 
        onClose={() => setIsMempoolModalOpen(false)} 
      />

      <div className="min-h-screen bg-black flex flex-col items-center p-4 md:p-8 pt-16 md:pt-20 pb-24 md:pb-8 relative">
        {/* Oben links: Link Gallery + Punkte-Anzeige */}
      <div className="fixed top-2 md:top-4 left-2 md:left-4 z-40 flex items-center gap-2 md:gap-4">
        {/* Link Gallery */}
        <a
          href="/link-gallery"
          onClick={(e) => {
            e.preventDefault();
            navigate('/link-gallery');
          }}
          className="inline-block hover:opacity-80 transition-opacity"
          title="Link Gallery"
        >
          <img
            src="/images/RichArt.png"
            alt="RichArt - Link Gallery"
            className="h-10 cursor-pointer"
            onError={(e) => {
              console.warn('[HomePage] Could not load RichArt logo');
              e.currentTarget.style.display = 'none';
            }}
          />
        </a>
        
        {/* Punkte-Anzeige */}
        {walletState.connected && (
          <div>
            <p className="text-gray-400 text-sm">Your Points</p>
            {loading ? (
              <p className="text-2xl font-bold text-white">Loading...</p>
            ) : (
              <p className="text-2xl font-bold text-white">{pointsData?.points || 0}</p>
            )}
          </div>
        )}
      </div>

      {/* Logo statt Titel */}
      <div className="mb-6 text-center">
        <img
          src="/richartlogo.png"
          alt="Atelier RichART"
          className="max-w-md mx-auto h-auto"
          onError={(e) => {
            console.warn('[HomePage] Could not load logo, falling back to text');
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Projekte und Kollektionen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-5xl w-full items-stretch">
        {projects.map((project, index) => {
          // Bestimme die Route basierend auf project.id oder collectionId
          const route = (project as any).collectionId 
            ? `/collection/${(project as any).collectionId}`
            : `/${project.id}`;
          
          return (
            <div
              key={project.id}
              onClick={() => navigate(route)}
            className={`w-full cursor-pointer transition-all duration-300 flex flex-col items-center h-full group relative touch-manipulation ${
              project.id === 'black-wild' ? 'md:order-1' :
              project.order === 2 ? 'md:order-2' : // Sons of Satoshi Evolution
              project.id === 'tech-games' ? 'md:order-3' : 
              project.id === 'point-shop' ? 'md:order-4' :
              project.order >= 5 ? 'md:order-5' : // Weitere dynamische Collections
              'md:order-6'
            } active:scale-95 md:hover:scale-105 hover:shadow-lg hover:shadow-red-600/20`}
          >
            {/* Glassmorphism Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
            {/* Bild-Container - flex-1 damit er den verfügbaren Platz einnimmt */}
            <div className={`w-full mx-auto flex-1 flex flex-col justify-start min-h-0 relative z-10 ${
              project.id === 'black-wild' ? 'md:mt-16' :
              project.order === 2 ? 'md:mt-20' : // Sons of Satoshi: optimal positioning
              project.id === 'bitcoin-mixtape' ? 'md:mt-8' : // Bitcoin Mix Tape: 30px nach unten
              project.id === 'point-shop' || project.id === 'tech-games' || project.order === 4 ? 'md:mt-8' : ''
            } ${
              project.id === 'black-wild' ? 'max-w-32' : 'max-w-48'
            }`}>
              {/* Bild ohne Rahmen - klickbar, maximale Größe */}
              {project.thumbnail ? (
                <ProgressiveImage
                  src={project.thumbnail}
                  alt={project.name}
                  className="w-full h-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-900 border border-red-600 rounded flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🛒</div>
                    <p className="text-white text-lg font-bold">{project.name}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Text unter dem Bild - mt-auto schiebt ihn nach unten, damit alle auf gleicher Höhe sind */}
            <div className={`mt-auto ${
              project.id === 'tech-games' ? '-mt-8' : 
              project.id === 'bitcoin-mixtape' ? '-mt-7' : 
              '-mt-2'
            } text-center w-full relative z-10 transition-all duration-300 group-hover:translate-y-[-4px]`}>
              {project.id === 'black-wild' ? (
                <h2 className="text-xl font-bold mb-1 transition-colors duration-300 group-hover:text-red-600">
                  <span 
                    className="text-black transition-all duration-300"
                    style={{
                      textShadow: '-1px -1px 1px rgba(255, 255, 255, 0.5), 1px -1px 1px rgba(255, 255, 255, 0.5), -1px 1px 1px rgba(255, 255, 255, 0.5), 1px 1px 1px rgba(255, 255, 255, 0.5), 0 0 2px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    BLACK
                  </span>
                  <span className="text-red-600 mx-1">&</span>
                  <span className="text-white">WILD</span>
                </h2>
              ) : (
                <h2 className="text-xl font-bold text-white mb-1 transition-colors duration-300 group-hover:text-red-400">{project.name}</h2>
              )}
              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  📋 WICHTIG: Beschreibung NUR für statische Projekte!
                  - Statische Projekte: Black & Wild, Tech & Games, Point Shop
                  - Dynamische Collections (Admin Panel): NUR Titel
                  - Beschreibung wird auf Mint-Seite angezeigt
                  - ABER: Unsichtbarer Platzhalter für gleiche Höhe der Titel
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              {!project.collectionId ? (
                <p className="text-xs text-gray-400 transition-colors duration-300 group-hover:text-gray-300">{project.description}</p>
              ) : (
                <p className="text-xs text-gray-400 opacity-0 pointer-events-none h-4">Placeholder</p>
              )}
            </div>
            </div>
          );
        })}
      </div>

      {/* News Banner - nach den Projekten */}
      <div className="mt-12 w-full">
        <NewsBanner />
      </div>
    </div>
    </>
  );
};

