import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getPoints, PointsData } from '../services/pointsService';

export const PointsDisplay: React.FC = () => {
  const { walletState } = useWallet();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  if (!walletState.connected) {
    return null;
  }

  return (
    <div className="bg-black border border-red-600 rounded p-3 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase mb-1">Your Points</p>
          {loading ? (
            <p className="text-lg font-bold text-white">Loading...</p>
          ) : (
            <p className="text-2xl font-bold text-red-600">
              {pointsData?.points || 0} <span className="text-sm text-gray-400">Points</span>
            </p>
          )}
        </div>
        {pointsData?.firstMint && (
          <div className="text-right">
            <p className="text-xs text-gray-400">⭐ First Mint</p>
            <p className="text-xs text-white">
              {new Date(pointsData.firstMint).toLocaleDateString('en-US')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};



