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
    <div className="bg-gray-900 border border-gray-700 rounded p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-white uppercase">Fee Rate</label>
        <span className="text-[10px] text-white font-mono font-bold">{selectedFeeRate} sat/vB</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => handlePresetChange('economy')}
          className={`px-1.5 py-1 text-[9px] font-bold rounded border transition relative ${
            selectedFeeRate === feeRates.economyFee && !isCustom
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-600'
          }`}
        >
          Economy
          <div className="text-[7px] text-gray-400">{feeRates.economyFee} sat/vB</div>
        </button>

        <button
          onClick={() => handlePresetChange('medium')}
          className={`px-1.5 py-1 text-[9px] font-bold rounded border transition relative ${
            selectedFeeRate === feeRates.halfHourFee && !isCustom
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-600'
          }`}
        >
          Medium
          <div className="text-[7px] text-gray-400">{feeRates.halfHourFee} sat/vB</div>
          {selectedFeeRate === feeRates.halfHourFee && !isCustom && (
            <span className="absolute -top-1 -right-1 bg-white text-black text-[6px] px-0.5 rounded font-bold">
              ✓
            </span>
          )}
        </button>

        <button
          onClick={() => handlePresetChange('fast')}
          className={`px-1.5 py-1 text-[9px] font-bold rounded border transition relative ${
            selectedFeeRate === feeRates.fastestFee && !isCustom
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-600'
          }`}
        >
          Fast
          <div className="text-[7px] text-gray-400">{feeRates.fastestFee} sat/vB</div>
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-gray-700/50">
        <label className="text-[9px] text-gray-400 whitespace-nowrap">Custom:</label>
        <input
          type="number"
          min="1"
          step="1"
          value={customFeeRate || (isCustom ? String(selectedFeeRate) : '')}
          onChange={(e) => {
            const value = e.target.value;
            setCustomFeeRate(value);
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue) && numValue >= 1) {
              onFeeRateChange(numValue);
            }
          }}
          onBlur={(e) => {
            if (e.target.value === '') {
              setCustomFeeRate('');
            }
          }}
          placeholder="sat/vB"
          className="w-full px-2 py-0.5 bg-black border border-gray-700 rounded text-[10px] text-white font-mono focus:border-red-600 focus:outline-none"
        />
      </div>
    </div>
  );
};

