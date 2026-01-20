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
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2">
          <div className="animate-pulse text-gray-400 text-xs">
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
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2 hover:border-orange-500/50 transition-all duration-300 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Main Fee (Half Hour) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">⚡</span>
            <span className="text-sm font-bold" style={{ color: getFeeColor(fees.halfHourFee) }}>
              {fees.halfHourFee}
            </span>
            <span className="text-xs text-gray-500">sat/vB</span>
          </div>
          
          {/* Details hint */}
          <span className="text-xs text-gray-600 group-hover:text-gray-400">📊</span>
        </div>
        
        {/* Hover tooltip */}
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          <div className="text-xs text-gray-300 space-y-1">
            <div>🚀 Schnell: <span className="font-bold" style={{ color: getFeeColor(fees.fastestFee) }}>{fees.fastestFee}</span> sat/vB</div>
            <div>⚡ Mittel: <span className="font-bold" style={{ color: getFeeColor(fees.halfHourFee) }}>{fees.halfHourFee}</span> sat/vB</div>
            <div>🐢 Langsam: <span className="font-bold" style={{ color: getFeeColor(fees.hourFee) }}>{fees.hourFee}</span> sat/vB</div>
            <div className="text-[10px] text-gray-600 pt-1 border-t border-gray-800">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
