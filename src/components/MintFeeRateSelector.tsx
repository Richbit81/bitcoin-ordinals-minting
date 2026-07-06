import React, { useEffect, useState } from 'react';

interface RecFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

interface Props {
  /** Current fee rate in sat/vB. 0 / undefined means "not chosen yet" (auto). */
  value: number;
  onChange: (v: number) => void;
  /** Accent color (hex) so the control fits each collection's theme. */
  accent?: string;
  disabled?: boolean;
}

const clampMin1 = (v: number) => Math.max(1, Math.floor(Number.isFinite(v) ? v : 1));

/**
 * Buyer-facing network fee selector for the on-demand mints (High Rollers,
 * Spikes). Defaults to the live mempool recommendation (halfHourFee) and lets
 * the buyer pick any rate down to a floor of 1 sat/vB.
 */
export const MintFeeRateSelector: React.FC<Props> = ({ value, onChange, accent = '#e8b64b', disabled }) => {
  const [rec, setRec] = useState<RecFees | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('https://mempool.space/api/v1/fees/recommended')
      .then((r) => r.json())
      .then((j: RecFees) => {
        if (cancelled) return;
        setRec(j);
        if (!value || value <= 0) {
          onChange(clampMin1(Math.ceil(Number(j?.halfHourFee ?? j?.hourFee ?? 2))));
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!value || value <= 0) onChange(2);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVal = (v: number) => onChange(clampMin1(v));

  const presets = rec
    ? [
        { label: 'Slow', val: clampMin1(Math.ceil(rec.hourFee)) },
        { label: 'Normal', val: clampMin1(Math.ceil(rec.halfHourFee)) },
        { label: 'Fast', val: clampMin1(Math.ceil(rec.fastestFee)) },
      ]
    : [];

  return (
    <div className="mt-5">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: accent, opacity: 0.75 }}>
        Network fee (sat/vB)
      </label>

      {presets.length > 0 && (
        <div className="flex gap-2">
          {presets.map((p) => {
            const activeP = value === p.val;
            return (
              <button
                key={p.label}
                type="button"
                disabled={disabled}
                onClick={() => setVal(p.val)}
                className="flex-1 rounded-xl border py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={
                  activeP
                    ? { borderColor: accent, background: `${accent}22`, color: accent }
                    : { borderColor: `${accent}40`, background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.6)' }
                }
              >
                {p.label}
                <span className="block text-[10px] font-normal opacity-70">{p.val} sat/vB</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || value <= 1}
          onClick={() => setVal(value - 1)}
          className="h-9 w-9 shrink-0 rounded-lg border text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: `${accent}40`, color: accent }}
          aria-label="decrease fee"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          step={1}
          value={value > 0 ? value : ''}
          disabled={disabled}
          onChange={(e) => setVal(Number(e.target.value))}
          onBlur={(e) => setVal(Number(e.target.value))}
          className="h-9 w-full rounded-lg border bg-black/40 px-3 text-center font-mono text-sm outline-none disabled:opacity-50"
          style={{ borderColor: `${accent}40`, color: '#ffffff' }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVal((value > 0 ? value : 1) + 1)}
          className="h-9 w-9 shrink-0 rounded-lg border text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: `${accent}40`, color: accent }}
          aria-label="increase fee"
        >
          +
        </button>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
        {rec ? (
          <>Minimum 1 sat/vB. Mempool now: ~{clampMin1(Math.ceil(rec.halfHourFee))} normal · {clampMin1(Math.ceil(rec.hourFee))} slow · {clampMin1(Math.ceil(rec.fastestFee))} fast.</>
        ) : (
          <>Minimum 1 sat/vB · loading current mempool recommendation…</>
        )}
      </p>
    </div>
  );
};

export default MintFeeRateSelector;
