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
    console.log('[MempoolBanner] 📡 API URL:', 'https://mempool.space/api/v1/fees/recommended');
    try {
      const [feesData, historyData] = await Promise.all([
        getRecommendedFees(),
        getFeeHistory24h()
      ]);
      
      console.log('[MempoolBanner] ✅ RAW API Response:', JSON.stringify(feesData, null, 2));
      console.log('[MempoolBanner] 📊 fastestFee:', feesData.fastestFee);
      console.log('[MempoolBanner] 📊 halfHourFee:', feesData.halfHourFee);
      console.log('[MempoolBanner] 📊 hourFee:', feesData.hourFee);
      console.log('[MempoolBanner] 📊 economyFee:', feesData.economyFee);
      console.log('[MempoolBanner] 📊 minimumFee:', feesData.minimumFee);
      
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
      <div className="fixed top-4 right-52 md:right-64 z-40">
        <div className="animate-pulse text-orange-500 text-sm font-semibold">
          ⚡ Loading...
        </div>
      </div>
    );
  }

  if (error || !fees) {
    console.log('[MempoolBanner] ❌ Rendering: ERROR state (hiding component)');
    return null; // Hide on error - no need to show error state
  }

  console.log('[MempoolBanner] ✅ Rendering: SUCCESS state');
  console.log('[MempoolBanner] 📊 All Fees:', {
    fastest: fees.fastestFee,
    halfHour: fees.halfHourFee,
    hour: fees.hourFee,
    economy: fees.economyFee,
    minimum: fees.minimumFee
  });

  // Use minimum fee as main display (the lowest current fee)
  const mainFee = fees.minimumFee;
  const feeColor = getFeeColor(mainFee);

  return (
    <div 
      className="fixed top-4 right-52 md:right-64 z-40 cursor-pointer group"
      onClick={onDetailsClick}
    >
      {/* Dezenter Text ohne Box */}
      <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <span className="text-base">⚡</span>
        <span className="text-sm font-bold text-orange-500">
          {fees.minimumFee < 1 ? fees.minimumFee.toFixed(2) : Math.round(fees.minimumFee)}
        </span>
        <span className="text-xs text-gray-400 font-semibold">sat/vB</span>
        <span className="text-sm group-hover:scale-110 transition-transform">📊</span>
      </div>
      
      {/* Hover tooltip */}
      <div className="absolute top-full right-0 mt-2 px-4 py-3 bg-gray-900 border border-orange-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-2xl">
        <div className="text-sm text-white space-y-2">
          <div className="flex items-center gap-2">
            <span>🚀</span>
            <span>High:</span>
            <span className="font-bold text-orange-400">
              {fees.fastestFee < 1 ? fees.fastestFee.toFixed(2) : Math.round(fees.fastestFee)} sat/vB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>⚡</span>
            <span>Medium:</span>
            <span className="font-bold text-orange-400">
              {fees.halfHourFee < 1 ? fees.halfHourFee.toFixed(2) : Math.round(fees.halfHourFee)} sat/vB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>🐢</span>
            <span>Low:</span>
            <span className="font-bold text-orange-400">
              {fees.hourFee < 1 ? fees.hourFee.toFixed(2) : Math.round(fees.hourFee)} sat/vB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔻</span>
            <span>Min:</span>
            <span className="font-bold text-orange-400">
              {fees.minimumFee < 1 ? fees.minimumFee.toFixed(2) : Math.round(fees.minimumFee)} sat/vB
            </span>
          </div>
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
            Updated: {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};
