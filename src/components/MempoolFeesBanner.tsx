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
    try {
      const [feesData, historyData] = await Promise.all([
        getRecommendedFees(),
        getFeeHistory24h()
      ]);
      
      setFees(feesData);
      setFeeHistory(historyData);
      setError(false);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[MempoolBanner] Error fetching data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700 py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <div className="animate-pulse text-gray-400 text-sm">
            ⚡ Loading Bitcoin network status...
          </div>
        </div>
      </div>
    );
  }

  if (error || !fees) {
    return (
      <div className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700 py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <div className="text-gray-500 text-sm">
            ⚠️ Unable to load fee data
          </div>
        </div>
      </div>
    );
  }

  const mainFee = fees.halfHourFee;
  const feeColor = getFeeColor(mainFee);

  return (
    <div className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700 py-3 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4">
        <div 
          className="flex items-center justify-center gap-6 cursor-pointer group"
          onClick={onDetailsClick}
        >
          {/* Title */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <span className="text-orange-500">⚡</span>
            <span>Bitcoin Network</span>
          </div>

          {/* Fee Indicators */}
          <div className="flex items-center gap-4">
            {/* Fastest */}
            <div className="group/fee relative">
              <div className="flex items-center gap-1.5 text-sm">
                <span>{getFeeEmoji(fees.fastestFee)}</span>
                <span className="font-bold" style={{ color: getFeeColor(fees.fastestFee) }}>
                  {fees.fastestFee}
                </span>
                <span className="text-gray-500 text-xs">sat/vB</span>
              </div>
              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-lg opacity-0 group-hover/fee:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                <div className="text-xs text-gray-300">
                  <div className="font-semibold text-white">Schnell</div>
                  <div>{getEstimatedTime('fastest')}</div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
              </div>
            </div>

            {/* Half Hour */}
            <div className="group/fee relative">
              <div className="flex items-center gap-1.5 text-sm">
                <span>{getFeeEmoji(fees.halfHourFee)}</span>
                <span className="font-bold" style={{ color: getFeeColor(fees.halfHourFee) }}>
                  {fees.halfHourFee}
                </span>
                <span className="text-gray-500 text-xs">sat/vB</span>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-lg opacity-0 group-hover/fee:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                <div className="text-xs text-gray-300">
                  <div className="font-semibold text-white">Mittel</div>
                  <div>{getEstimatedTime('halfHour')}</div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
              </div>
            </div>

            {/* Hour */}
            <div className="group/fee relative">
              <div className="flex items-center gap-1.5 text-sm">
                <span>{getFeeEmoji(fees.hourFee)}</span>
                <span className="font-bold" style={{ color: getFeeColor(fees.hourFee) }}>
                  {fees.hourFee}
                </span>
                <span className="text-gray-500 text-xs">sat/vB</span>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-lg opacity-0 group-hover/fee:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                <div className="text-xs text-gray-300">
                  <div className="font-semibold text-white">Langsam</div>
                  <div>{getEstimatedTime('hour')}</div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
              </div>
            </div>
          </div>

          {/* Mini Sparkline Chart */}
          {feeHistory.length > 0 && (
            <div className="w-32 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feeHistory}>
                  <Line 
                    type="monotone" 
                    dataKey="avgFee" 
                    stroke={feeColor}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Click hint */}
          <div className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
            📊 Details
          </div>
        </div>

        {/* Last update timestamp */}
        <div className="text-center mt-1">
          <span className="text-[10px] text-gray-600">
            Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};
