import React, { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  getRecommendedFees,
  getFeeHistory24h,
  getFeeColor,
  getFeeEmoji,
  getEstimatedTime,
  FeeRecommendation,
  FeeHistoryPoint
} from '../services/mempoolService';

interface MempoolFeesBannerProps {
  onDetailsClick?: () => void;
}

export const MempoolFeesBanner: React.FC<MempoolFeesBannerProps> = ({ onDetailsClick }) => {
  const [fees, setFees] = useState<FeeRecommendation | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch data
  const fetchData = async () => {
    console.log('[MempoolBanner] 🔄 Fetching mempool data...');
    try {
      const [feesData, historyData] = await Promise.all([
        getRecommendedFees(),
        getFeeHistory24h()
      ]);
      
      console.log('[MempoolBanner] ✅ Fees data:', feesData);
      console.log('[MempoolBanner] ✅ History data points:', historyData.length);
      
      setFees(feesData);
      setFeeHistory(historyData);
      setError(false);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[MempoolBanner] ❌ Error fetching data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    console.log('[MempoolBanner] 🚀 Component mounted, starting fetch...');
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s
    return () => {
      console.log('[MempoolBanner] 🛑 Component unmounted');
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    console.log('[MempoolBanner] 🔄 Rendering: LOADING state');
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 border-2 border-orange-500 rounded-lg px-4 py-2.5 shadow-2xl shadow-orange-500/50">
          <div className="animate-pulse text-white text-sm font-semibold">
            ⚡ Loading...
          </div>
        </div>
      </div>
    );
  }

  if (error || !fees) {
    console.log('[MempoolBanner] ❌ Rendering: ERROR state (hiding component)');
    return null; // Hide on error - no need to show error state
  }

  console.log('[MempoolBanner] ✅ Rendering: SUCCESS state with fees:', fees.halfHourFee);

  const mainFee = fees.halfHourFee;
  const feeColor = getFeeColor(mainFee);

  return (
    <div 
      className="fixed top-4 right-4 z-40 cursor-pointer group"
      onClick={onDetailsClick}
    >
      <div className="bg-gradient-to-br from-orange-600 to-orange-700 border-2 border-orange-500 rounded-lg px-4 py-2.5 hover:from-orange-500 hover:to-orange-600 transition-all duration-300 shadow-2xl shadow-orange-500/50">
        <div className="flex items-center gap-2">
          {/* Main Fee (Half Hour) */}
          <div className="flex items-center gap-1.5">
            <span className="text-base">⚡</span>
            <span className="text-lg font-bold text-white">
              {fees.halfHourFee}
            </span>
            <span className="text-xs text-white/90 font-semibold">sat/vB</span>
          </div>
          
          {/* Details hint */}
          <span className="text-sm group-hover:scale-110 transition-transform">📊</span>
        </div>
        
        {/* Hover tooltip */}
        <div className="absolute top-full right-0 mt-2 px-4 py-3 bg-gray-900 border-2 border-orange-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-2xl">
          <div className="text-sm text-white space-y-2">
            <div className="flex items-center gap-2">
              <span>🚀</span>
              <span>Schnell:</span>
              <span className="font-bold text-orange-400">{fees.fastestFee} sat/vB</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>Mittel:</span>
              <span className="font-bold text-orange-400">{fees.halfHourFee} sat/vB</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🐢</span>
              <span>Langsam:</span>
              <span className="font-bold text-orange-400">{fees.hourFee} sat/vB</span>
            </div>
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
              Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
