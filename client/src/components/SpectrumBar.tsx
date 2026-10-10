import { motion } from 'motion/react';

export interface SpectrumMarker {
  value: number;
  colorHex: string;
  /** Optional short caption under the dot (kept short to avoid overlap). */
  label?: string;
}

interface SpectrumBarProps {
  lowLabel: string;
  highLabel: string;
  markers?: SpectrumMarker[];
  /** Endpoint captions; the marker dots always show. */
  showLabels?: boolean;
  compact?: boolean;
}

/** 1-100 spectrum strip: green (low) → amber → red (high), with optional markers. */
export function SpectrumBar({
  lowLabel,
  highLabel,
  markers = [],
  showLabels = true,
  compact = false,
}: SpectrumBarProps) {
  const position = (value: number) =>
    `${((Math.min(100, Math.max(1, value)) - 1) / 99) * 100}%`;

  return (
    <div className="w-full select-none">
      {showLabels && (
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">
          <span className="truncate max-w-[46%]">1 · {lowLabel}</span>
          <span className="truncate max-w-[46%] text-right">100 · {highLabel}</span>
        </div>
      )}

      <div className={`relative ${compact ? 'py-1.5' : 'py-2'}`}>
        <div
          className={`w-full rounded-full ${compact ? 'h-2.5' : 'h-3.5'}`}
          style={{
            background:
              'linear-gradient(90deg, #4CD787 0%, #FFC93C 52%, #FF5A5F 100%)',
          }}
        />

        {markers.map((marker, index) => (
          <motion.div
            key={`${marker.value}-${index}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 420, damping: 22 }}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: position(marker.value) }}
          >
            <span
              className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} rounded-full border-2 shadow-md`}
              style={{
                backgroundColor: marker.colorHex,
                borderColor: 'var(--bg-app)',
              }}
            />
            {marker.label && (
              <span
                className="mt-0.5 text-[10px] font-black leading-none px-1 rounded"
                style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
              >
                {marker.label}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
