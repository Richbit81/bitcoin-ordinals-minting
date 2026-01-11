import React, { useState, useEffect } from 'react';
import { getCurrentFeeRates } from '../services/bitcoinFees';

interface FeeRateSelectorProps {
  selectedFeeRate: number;
  onFeeRateChange: (feeRate: number) => void;
}

export const FeeRateSelector: React.FC<FeeRateSelectorProps> = ({
  selectedFeeRate,
  onFeeRateChange,
}) => {
  const [feeRates, setFeeRates] = useState<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [customFeeRate, setCustomFeeRate] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const loadFeeRates = async () => {
      setLoading(true);
      try {
        const rates = await getCurrentFeeRates();
        if (rates) {
          setFeeRates(rates);
          // Setze Standard NUR beim ersten Laden, nicht wenn User bereits eine Auswahl getroffen hat
          if (!hasInitialized && (!selectedFeeRate || selectedFeeRate === 1)) {
            onFeeRateChange(rates.halfHourFee);
            setHasInitialized(true);
          }
        }
      } catch (error) {
        console.warn('Failed to load fee rates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeeRates();
    // Aktualisiere alle 60 Sekunden (NUR die Werte, nicht die Auswahl!)
    const interval = setInterval(() => {
      getCurrentFeeRates().then(rates => {
        if (rates) {
          setFeeRates(rates);
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []); // WICHTIG: Nur beim Mount ausführen, nicht bei jeder selectedFeeRate Änderung!

  useEffect(() => {
    // Markiere als initialisiert, wenn eine Fee Rate gesetzt wurde
    if (selectedFeeRate && !hasInitialized) {
      setHasInitialized(true);
    }
  }, [selectedFeeRate, hasInitialized]);

  const handlePresetChange = (preset: 'economy' | 'medium' | 'fast' | 'custom') => {
    if (!feeRates && preset !== 'custom') return;

    switch (preset) {
      case 'economy':
        onFeeRateChange(feeRates!.economyFee);
        setCustomFeeRate('');
        break;
      case 'medium':
        onFeeRateChange(feeRates!.halfHourFee);
        setCustomFeeRate('');
        break;
      case 'fast':
        onFeeRateChange(feeRates!.fastestFee);
        setCustomFeeRate('');
        break;
      case 'custom':
        // Nichts ändern, nur Custom-Modus aktivieren
        break;
    }
  };

  const handleCustomFeeChange = (value: string) => {
    setCustomFeeRate(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1) {
      onFeeRateChange(numValue);
    }
  };

  if (loading || !feeRates) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded p-3">
        <p className="text-xs text-gray-400">Loading fee rates...</p>
      </div>
    );
  }

  // Prüfe ob Custom (vereinfacht, ohne Low Fee Prüfung)
  const isCustom = customFeeRate !== '' || (selectedFeeRate !== feeRates.economyFee && 
                                             selectedFeeRate !== feeRates.halfHourFee && 
                                             selectedFeeRate !== feeRates.fastestFee);

  return (
    <div className="bg-gray-900 border border-red-600 rounded p-3 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="text-xs font-bold text-white uppercase block">Inscription Fee Rate</label>
          <p className="text-[9px] text-gray-400 mt-0.5">
            Current Mempool rates • Auto-updates every 60s
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-white font-mono font-bold">{selectedFeeRate} sat/vB</span>
          <p className="text-[8px] text-gray-500 mt-0.5">Selected</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handlePresetChange('economy')}
          className={`px-2 py-1.5 text-[10px] font-bold rounded border transition relative ${
            selectedFeeRate === feeRates.economyFee && !isCustom
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-600'
          }`}
        >
          Economy
          <div className="text-[8px] text-gray-400 mt-0.5">{feeRates.economyFee} sat/vB</div>
          <div className="text-[7px] text-gray-500 mt-0.5">~1h+</div>
        </button>

        <button
          onClick={() => handlePresetChange('medium')}
          className={`px-2 py-1.5 text-[10px] font-bold rounded border transition relative ${
            selectedFeeRate === feeRates.halfHourFee && !isCustom
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-600'
          }`}
        >
          Medium
          <div className="text-[8px] text-gray-400 mt-0.5">{feeRates.halfHourFee} sat/vB</div>
          <div className="text-[7px] text-gray-500 mt-0.5">~30min</div>
          {selectedFeeRate === feeRates.halfHourFee && !isCustom && (
            <span className="absolute -top-1 -right-1 bg-white text-black text-[7px] px-1 rounded font-bold">
              ✓
            </span>
          )}
        </button>

        <button
          onClick={() => handlePresetChange('fast')}
          className={`px-2 py-1.5 text-[10px] font-bold rounded border transition relative ${
            selectedFeeRate === feeRates.fastestFee && !isCustom
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-600'
          }`}
        >
          Fast
          <div className="text-[8px] text-gray-400 mt-0.5">{feeRates.fastestFee} sat/vB</div>
          <div className="text-[7px] text-gray-500 mt-0.5">~10min</div>
        </button>
      </div>
      
      {/* Hinweis für empfohlene Fee Rate */}
      <div className="text-center pt-2">
        <p className="text-[9px] text-gray-400">
          💡 <span className="font-semibold">Recommended:</span> Medium ({feeRates.halfHourFee} sat/vB) - Best balance
        </p>
      </div>

      <div className="pt-2 border-t border-gray-700">
        <label className="text-[10px] text-gray-400 block mb-1">Custom (sat/vB):</label>
        <input
          type="number"
          min="1"
          step="1"
          value={customFeeRate || (isCustom ? String(selectedFeeRate) : '')}
          onChange={(e) => {
            const value = e.target.value;
            setCustomFeeRate(value);
            const numValue = parseInt(value, 10);
            // WICHTIG: Erlaube auch Werte unter dem Mempool-Minimum (z.B. 1 sat/vB)
            if (!isNaN(numValue) && numValue >= 1) {
              onFeeRateChange(numValue);
            }
          }}
          onBlur={(e) => {
            // Wenn leer, setze customFeeRate zurück
            if (e.target.value === '') {
              setCustomFeeRate('');
            }
          }}
          placeholder={`Min: 1, z.B. 1 oder 2`}
          className="w-full px-2 py-1 bg-black border border-gray-700 rounded text-xs text-white font-mono focus:border-red-600 focus:outline-none"
        />
        <p className="text-[8px] text-gray-500 mt-1">
          Lower fees = slower confirmation. You can enter any value ≥ 1 sat/vB
        </p>
      </div>
    </div>
  );
};

