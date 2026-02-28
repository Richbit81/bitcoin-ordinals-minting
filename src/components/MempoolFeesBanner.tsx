import React, { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getCurrentFeeRates, FeeRates } from '../services/bitcoinFees';
import {
  getFeeHistory24h,
  getFeeColor,
  getFeeEmoji,
  getEstimatedTime,
  FeeHistoryPoint
} from '../services/mempoolService';

interface MempoolFeesBannerProps {
  onDetailsClick?: () => void;
}

export const MempoolFeesBanner: React.FC<MempoolFeesBannerProps> = ({ onDetailsClick }) => {
  const isDebug = import.meta.env.DEV;
  const [fees, setFees] = useState<FeeRates | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch data - verwendet jetzt denselben Service wie FeeRateSelector
  const fetchData = async () => {
    if (isDebug) console.log('[MempoolBanner] 🔄 Fetching mempool data...');
    try {
      const [feesData, historyData] = await Promise.all([
        getCurrentFeeRates(),
        getFeeHistory24h()
      ]);
      
      if (feesData) {
        if (isDebug) console.log('[MempoolBanner] ✅ Fee Rates:', feesData);
        setFees(feesData);
        setFeeHistory(historyData);
        setError(false);
        setLastUpdate(new Date());
      } else {
        setError(true);
      }
    } catch (err) {
      if (isDebug) console.error('[MempoolBanner] ❌ Error fetching data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    if (isDebug) console.log('[MempoolBanner] 🚀 Component mounted, starting fetch...');
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s
    return () => {
      if (isDebug) console.log('[MempoolBanner] 🛑 Component unmounted');
      clearInterval(interval);
    };
  }, [isDebug]);

  if (loading) {
    if (isDebug) console.log('[MempoolBanner] 🔄 Rendering: LOADING state');
    return (
      <div className="fixed top-4 right-52 md:right-64 z-40">
        <div className="animate-pulse text-orange-500 text-sm font-semibold">
          ⚡ Loading...
        </div>
      </div>
    );
  }

  if (error || !fees) {
    if (isDebug) console.log('[MempoolBanner] ❌ Rendering: ERROR state (hiding component)');
    return null; // Hide on error - no need to show error state
  }

  // Logging entfernt für Production

  // Use halfHourFee as main display (medium priority - realistic value like mempool.space)
  const mainFee = fees.halfHourFee;
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
          {mainFee < 1 ? mainFee.toFixed(1) : Math.round(mainFee)}
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
