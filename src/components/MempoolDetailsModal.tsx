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
    time: new Date(point.timestamp * 1000).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    fee: point.avgFee,
    timestamp: point.timestamp
  }));

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
            <p className="text-sm text-gray-400 mt-1">Live-Daten von mempool.space</p>
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
            <div className="text-gray-400 animate-pulse">Lade Netzwerk-Daten...</div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Fee Rates Cards */}
            {fees && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🚀 Schnell</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.fastestFee) }}>
                    {fees.fastestFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~10 Min</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">⚡ Mittel</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.halfHourFee) }}>
                    {fees.halfHourFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~30 Min</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🐢 Langsam</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.hourFee) }}>
                    {fees.hourFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~1h</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">💰 Economy</div>
                  <div className="text-3xl font-bold" style={{ color: getFeeColor(fees.economyFee) }}>
                    {fees.economyFee}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">sat/vB • ~2-4h</div>
                </div>
              </div>
            )}

            {/* 24h Fee Chart */}
            {chartData.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Fee-Verlauf (24 Stunden)</h3>
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
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      labelStyle={{ color: '#9ca3af' }}
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
                      name="Durchschnittliche Fee"
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
                  <div className="text-sm text-gray-400 mb-1">📦 Unbestätigte TXs</div>
                  <div className="text-2xl font-bold text-white">
                    {mempool.count.toLocaleString('de-DE')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Transaktionen im Mempool</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">💾 Mempool-Größe</div>
                  <div className="text-2xl font-bold text-white">
                    {(mempool.vsize / 1000000).toFixed(1)} MB
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Virtuelle Bytes</div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">🏔️ Block Height</div>
                  <div className="text-2xl font-bold text-white">
                    #{blockHeight.toLocaleString('de-DE')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Aktueller Block</div>
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
                        ? '✅ Guter Zeitpunkt zum Minten!' 
                        : fees.halfHourFee <= 30 
                          ? '⚠️ Moderate Fees' 
                          : '🚨 Hohe Fees - Warten empfohlen'}
                    </div>
                    <div className="text-sm text-gray-300">
                      {fees.halfHourFee <= 15 
                        ? 'Die Netzwerk-Fees sind niedrig. Perfekt für Inscriptions!' 
                        : fees.halfHourFee <= 30 
                          ? 'Die Fees sind etwas erhöht, aber noch akzeptabel.' 
                          : 'Das Netzwerk ist momentan stark ausgelastet. Warte besser auf niedrigere Fees.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info Footer */}
            <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-800">
              Daten aktualisieren sich automatisch alle 60 Sekunden • Powered by mempool.space
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
