import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { getPoints, PointsData } from '../services/pointsService';
import { getAllCollections, Collection } from '../services/collectionService';
import { CollectionCard } from '../components/CollectionCard';
import { NewsBanner } from '../components/NewsBanner';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  const projects = [
    {
      id: 'black-wild',
      name: 'Black & Wild',
      thumbnail: '/thumbnail_Unbenanntes_Projekt-2026-01-01T222604.577-ezgif.com-apng-to-avif-converter - Kopie.avif',
      description: 'Bitcoin Ordinals Card Game',
    },
    {
      id: 'point-shop',
      name: 'Point Shop',
      thumbnail: '/pointshop.png',
      description: 'Mint exclusive Ordinals with your points',
      order: 3, // Für Grid-Reihenfolge
    },
    {
      id: 'tech-games',
      name: 'TECH & GAMES',
      thumbnail: '/techgame.png',
      description: 'Interactive games and tech tools',
      order: 2,
    },
  ];

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
    <div className="min-h-screen bg-black flex flex-col items-center p-8 pt-16 relative">
      {/* Punkte-Anzeige - oben links */}
      {walletState.connected && (
        <div className="fixed top-4 left-4 z-40">
          <p className="text-gray-400 text-sm">Your Points</p>
          {loading ? (
            <p className="text-2xl font-bold text-white">Loading...</p>
          ) : (
            <p className="text-2xl font-bold text-white">{pointsData?.points || 0}</p>
          )}
        </div>
      )}

      {/* Logo statt Titel */}
      <div className="mb-12 text-center">
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

      {/* News Banner */}
      <NewsBanner />

      {/* Projekte und Kollektionen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl w-full items-stretch">
        {projects.map((project, index) => (
          <div
            key={project.id}
            onClick={() => navigate(`/${project.id}`)}
            className={`w-full cursor-pointer hover:opacity-90 transition-opacity duration-300 flex flex-col items-center h-full ${
              project.id === 'point-shop' ? 'md:order-3' : 
              project.id === 'tech-games' ? 'md:order-2' : 
              'md:order-1'
            }`}
          >
            {/* Bild-Container - flex-1 damit er den verfügbaren Platz einnimmt */}
            <div className={`w-full mx-auto flex-1 flex flex-col justify-start min-h-0 ${
              project.id === 'black-wild' ? 'md:mt-32' :
              project.id === 'point-shop' || project.id === 'tech-games' ? 'md:mt-16' : ''
            } ${
              project.id === 'black-wild' ? 'max-w-48' : 'max-w-md'
            }`}>
              {/* Bild ohne Rahmen - klickbar, maximale Größe */}
              <img
                src={project.thumbnail}
                alt={project.name}
                className="w-full h-auto object-contain"
                onError={(e) => {
                  console.warn(`[HomePage] Could not load thumbnail: ${project.thumbnail}`);
                  // Fallback zu Icon wenn Bild nicht geladen werden kann
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              {/* Fallback wenn kein Bild vorhanden oder Fehler beim Laden */}
              <div className="w-full aspect-[2/3] bg-gray-900 border border-red-600 rounded flex items-center justify-center" style={{ display: project.thumbnail ? 'none' : 'flex' }}>
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">🛒</div>
                  <p className="text-white text-lg font-bold">{project.name}</p>
                </div>
              </div>
            </div>
            
            {/* Text unter dem Bild - mt-auto schiebt ihn nach unten, damit alle auf gleicher Höhe sind */}
            <div className="mt-auto pt-6 text-center w-full">
              {project.id === 'black-wild' ? (
                <h2 className="text-2xl font-bold mb-1">
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
                </h2>
              ) : (
                <h2 className="text-2xl font-bold text-white mb-1">{project.name}</h2>
              )}
              <p className="text-sm text-gray-400">{project.description}</p>
            </div>
          </div>
        ))}
        
        {/* Dynamische Kollektionen */}
        {loadingCollections ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-400">Loading collections...</p>
          </div>
        ) : (
          collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))
        )}
      </div>
    </div>
  );
};

