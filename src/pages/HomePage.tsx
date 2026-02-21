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

// SLUMS preview layers (item #124)
const SLUMS_PREVIEW_LAYERS = [
  '8f5fc247bf80511bd5b175b1f527cef1098d5e908c34acf81e986bfb99dcfa80i0',
  'b1776bc34762f7a6ef0122276e7cbd2922dfe6d5301a57bf7eb105bac167a364i0',
  '3c6549906170fe529005d201f77fa5a4f0cab7bfa283ed2c3e4c44d57887921fi0',
  '64abdaab518f553ef692fb59fb1244dd7c4833c2ae085b40fe71a14c253b9600i0',
  '397e179ca9c6b62c7982fd3426c569fcc52ff0e3f7c97a68b5dd9c89ea0bbb5di0',
  '8e26e5823d7fc3cd092b605feec7d1e7ce6e8908ca320d702a75f6160a552a89i0',
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [slumsPreview, setSlumsPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [isMempoolModalOpen, setIsMempoolModalOpen] = useState(false);

  // Statische Projekte (immer vorhanden)
  const staticProjects = [
    {
      id: 'bitcoin-mixtape',
      name: 'Bitcoin Mix Tape',
      thumbnail: '/mixtape.png',
      description: 'On-Chain Music Experience',
      order: 1, // Position 1 - ganz vorne!
    },
    {
      id: 'smile-a-bit',
      name: 'SMILE A ₿IT',
      thumbnail: '/images/smile-collection.png',
      description: '222 Unique Bitcoin Smiley Ordinals',
      order: 3,
    },
    {
      id: 'slums',
      name: 'SLUMS',
      thumbnail: slumsPreview || '',
      description: '333 Unique Pixel Ordinals',
      order: 4,
    },
    {
      id: 'badcats',
      name: 'BAD CATS',
      thumbnail: 'https://ordinals.com/content/35ccb1e128e691647258687c53f06a5f3f2078f15770eb0afedcd743524e63bdi0',
      description: '500 Recursive Ordinals',
      order: 2,
    },
    {
      id: 'black-wild',
      name: 'Black & Wild',
      thumbnail: '/thumbnail_Unbenanntes_Projekt-2026-01-01T222604.577-ezgif.com-apng-to-avif-converter - Kopie.avif',
      description: 'Bitcoin Ordinals Card Game',
      order: 5,
    },
    {
      id: 'tech-games',
      name: 'TECH & GAMES',
      thumbnail: '/techgame.png',
      description: 'Interactive games and tech tools',
      order: 6,
    },
    {
      id: 'point-shop',
      name: 'Point Shop',
      thumbnail: '/pointshop.png',
      description: 'Mint exclusive Ordinals with your points',
      order: 7,
    },
    {
      id: '1984',
      name: '1984',
      thumbnail: `https://ordinals.com/content/5c50d2e25d833e1357de824184e9d7859945c62f3b6af54c0f2f2a03caf5fd74i0`,
      description: 'Orwell on Bitcoin',
      order: 8,
    },
    {
      id: 'free-stuff',
      name: 'Free Stuff',
      thumbnail: `https://ordinals.com/content/4a019b00eaed13dce49df0ba18d1f82c95a276ca09a4b16c6990336ae7bc189bi0`,
      description: 'Free Ordinals Mints',
      order: 9,
    },
    {
      id: 'random-stuff',
      name: 'Random Stuff',
      thumbnail: `https://ordinals.com/content/c46de6b56a28fc5c9da4d22a8a15825e604418c1ad1e4eea6650afdebff0e670i0`,
      description: 'Random Ordinals Collection',
      order: 10,
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

  // Render SLUMS preview from on-chain AVIF layers
  useEffect(() => {
    let cancelled = false;
    const renderSlumsPreview = async () => {
      try {
        const SIZE = 400;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        for (const id of SLUMS_PREVIEW_LAYERS) {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('load failed'));
            el.src = `https://ordinals.com/content/${id}`;
          });
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
        }
        if (!cancelled) setSlumsPreview(canvas.toDataURL('image/png'));
      } catch {
        console.warn('[HomePage] SLUMS preview render failed');
      }
    };
    renderSlumsPreview();
    return () => { cancelled = true; };
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
              project.id === 'bitcoin-mixtape' ? 'md:order-1' :
              project.id === 'badcats' ? 'md:order-2' :
              project.id === 'smile-a-bit' ? 'md:order-3' :
              project.id === 'slums' ? 'md:order-4' :
              project.id === 'black-wild' ? 'md:order-5' :
              (project as any).collectionId ? 'md:order-6' :
              project.id === 'tech-games' ? 'md:order-7' : 
              project.id === 'point-shop' ? 'md:order-8' :
              project.id === 'free-stuff' ? 'md:order-9' :
              project.id === 'random-stuff' ? 'md:order-10' :
              project.order >= 8 ? 'md:order-11' :
              'md:order-12'
            } active:scale-95 md:hover:scale-105 hover:shadow-lg hover:shadow-red-600/20`}
          >
            {/* Glassmorphism Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
            {/* Bild-Container - flex-1 damit er den verfügbaren Platz einnimmt */}
            <div className={`w-full mx-auto flex-1 flex flex-col justify-start min-h-0 relative z-10 ${
              project.id === 'bitcoin-mixtape' ? 'md:mt-8' :
              project.id === 'smile-a-bit' ? 'md:-mt-2' :
              project.id === 'slums' ? 'md:mt-4' :
              project.id === 'black-wild' ? 'md:mt-16' :
              (project as any).collectionId ? 'md:mt-20' :
              project.id === 'point-shop' || project.id === 'tech-games' ? 'md:mt-8' : ''
            } ${
              project.id === 'black-wild' ? 'max-w-32' :
              project.id === 'smile-a-bit' ? 'max-w-[180px]' :
              project.id === 'slums' ? 'max-w-[180px]' : 'max-w-48'
            }`}>
              {/* Bild ohne Rahmen - klickbar, maximale Größe */}
              {project.id === 'slums' ? (
                <div className="overflow-hidden rounded relative">
                  {slumsPreview ? (
                    <img
                      src={slumsPreview}
                      alt="SLUMS"
                      className="w-full h-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-900 rounded flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {/* FREE badge */}
                  <div className="absolute top-2 -right-6 rotate-45 bg-green-500 text-white font-bold text-[10px] px-6 py-0.5 shadow-lg z-10">
                    FREE
                  </div>
                </div>
              ) : project.id === 'badcats' ? (
                <div className="overflow-hidden rounded-xl relative">
                  <ProgressiveImage
                    src={project.thumbnail}
                    alt={project.name}
                    className="w-full h-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-red-600 text-white font-bold px-4 py-1.5 border-[3px] border-black shadow-[3px_3px_0_#000]"
                      style={{
                        fontFamily: "'Bangers', 'Creepster', cursive",
                        transform: 'rotate(-8deg)',
                        fontSize: '18px',
                        letterSpacing: '0.08em',
                        textShadow: '2px 2px 0 #000',
                      }}>
                      COMING SOON
                    </div>
                  </div>
                </div>
              ) : project.thumbnail ? (
                <div className={
                  project.id === 'smile-a-bit' ? 'overflow-hidden rounded' : ''
                }>
                  <ProgressiveImage
                    src={project.thumbnail}
                    alt={project.name}
                    className={`w-full h-auto object-contain transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-lg group-hover:drop-shadow-red-600/50 ${
                      project.id === 'smile-a-bit' ? 'scale-[1.08]' : ''
                    }`}
                    loading="lazy"
                  />
                </div>
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

      {/* Palindrom Sound Box - NUR sichtbar für bestimmte Wallets */}
      {walletState.connected && walletState.accounts?.some(acc =>
        ['bc1p8mex3g66tsrqlura04ts6xgxlfwhf23adrxpc5g6c0zmqdgqtq3syq0elu',
         'bc1p9j4g6r27yqhmp4c403vn33mz7uug439sthqngkkrylu7d7uq7d6qvz39jj'
        ].includes(acc.address)
      ) && (
        <div className="mt-8 flex justify-center">
          <div
            onClick={() => navigate('/palindrom-sound-box')}
            className="cursor-pointer transition-all duration-300 hover:scale-105 hover:drop-shadow-lg hover:drop-shadow-purple-500/50"
          >
            <img
              src="/images/palindrom-link.png"
              alt="Palindrom Sound Box"
              className="max-w-xs h-auto rounded-lg"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* News Banner - nach den Projekten */}
      <div className="mt-12 w-full">
        <NewsBanner />
      </div>
    </div>
    </>
  );
};

