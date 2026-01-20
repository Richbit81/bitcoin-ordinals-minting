import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  getRecommendedFees,
  getMempoolStatus,
  getFeeHistory24h,
  getCurrentBlockHeight,
  getFeeColor,
  FeeRecommendation,
  MempoolStatus,
  FeeHistoryPoint
} from '../services/mempoolService';

interface MempoolDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MempoolDetailsModal: React.FC<MempoolDetailsModalProps> = ({ isOpen, onClose }) => {
  const [fees, setFees] = useState<FeeRecommendation | null>(null);
  const [mempool, setMempool] = useState<MempoolStatus | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeHistoryPoint[]>([]);
  const [blockHeight, setBlockHeight] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [feesData, mempoolData, historyData, heightData] = await Promise.all([
          getRecommendedFees(),
          getMempoolStatus(),
          getFeeHistory24h(),
          getCurrentBlockHeight()
        ]);

        setFees(feesData);
        setMempool(mempoolData);
        setFeeHistory(historyData);
        setBlockHeight(heightData);
      } catch (error) {
        console.error('[MempoolModal] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [isOpen]);

  if (!isOpen) return null;

  // Format chart data
  const chartData = feeHistory.map(point => ({
    time: new Date(point.timestamp * 1000).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    }),
    fee: Number(point.avgFee.toFixed(2)), // Round to 2 decimals for cleaner display
    timestamp: point.timestamp
  }));

  // Calculate domain for Y-axis to show variation better
  const feeValues = chartData.map(d => d.fee);
  const minFee = Math.min(...feeValues);
  const maxFee = Math.max(...feeValues);
  const padding = (maxFee - minFee) * 0.1 || 0.5; // 10% padding or 0.5 if flat

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">⚡</span>
              Bitcoin Network Status
            </h2>
            <p className="text-sm text-gray-400 mt-1">Live data from mempool.space</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="text-gray-400 animate-pulse">Loading network data...</div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Fee Rates Cards */}
            {fees && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🚀 High Priority</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.fastestFee) }}>
                    {fees.fastestFee < 1 ? fees.fastestFee.toFixed(2) : fees.fastestFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~10 min</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">⚡ Medium Priority</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.halfHourFee) }}>
                    {fees.halfHourFee < 1 ? fees.halfHourFee.toFixed(2) : fees.halfHourFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~30 min</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🐢 Low Priority</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.hourFee) }}>
                    {fees.hourFee < 1 ? fees.hourFee.toFixed(2) : fees.hourFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~1h</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">💰 Economy</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.economyFee) }}>
                    {fees.economyFee < 1 ? fees.economyFee.toFixed(2) : fees.economyFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~2-4h</div>
                </div>

                <div className="bg-gray-800 border border-orange-500/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🔻 Minimum</div>
                  <div className="text-3xl font-bold text-orange-400">
                    {fees.minimumFee < 1 ? fees.minimumFee.toFixed(2) : fees.minimumFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • lowest</div>
                </div>
              </div>
            )}

            {/* 24h Fee Chart */}
            {chartData.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Fee History (24 Hours)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#9ca3af"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      label={{ value: 'sat/vB', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                      domain={[minFee - padding, maxFee + padding]}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      labelStyle={{ color: '#9ca3af' }}
                      formatter={(value: number) => [`${value.toFixed(2)} sat/vB`, 'Fee']}
                    />
                    <Legend 
                      wrapperStyle={{ color: '#9ca3af' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="fee" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      dot={false}
                      name="Average Fee"
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Mempool Stats */}
            {mempool && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">📦 Unconfirmed TXs</div>
                  <div className="text-2xl font-bold text-white">
                    {mempool.count.toLocaleString('en-US')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Transactions in mempool</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">💾 Mempool Size</div>
                  <div className="text-2xl font-bold text-white">
                    {(mempool.vsize / 1000000).toFixed(1)} MB
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Virtual Bytes</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🏔️ Block Height</div>
                  <div className="text-2xl font-bold text-white">
                    #{blockHeight.toLocaleString('en-US')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Current block</div>
                </div>
              </div>
            )}

            {/* Recommendation */}
            {fees && (
              <div className={`border rounded-lg p-4 ${
                fees.halfHourFee <= 15 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : fees.halfHourFee <= 30 
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {fees.halfHourFee <= 15 ? '🟢' : fees.halfHourFee <= 30 ? '🟡' : '🔴'}
                  </span>
                  <div>
                    <div className="font-semibold text-white mb-1">
                      {fees.halfHourFee <= 15 
                        ? '✅ Great time to mint!' 
                        : fees.halfHourFee <= 30 
                          ? '⚠️ Moderate Fees' 
                          : '🚨 High Fees - Consider waiting'}
                    </div>
                    <div className="text-sm text-gray-300">
                      {fees.halfHourFee <= 15 
                        ? 'Network fees are low. Perfect for inscriptions!' 
                        : fees.halfHourFee <= 30 
                          ? 'Fees are slightly elevated but still acceptable.' 
                          : 'The network is currently congested. Better to wait for lower fees.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info Footer */}
            <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-800">
              Data updates automatically every 60 seconds • Powered by mempool.space
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
