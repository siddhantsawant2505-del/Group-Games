import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playNotificationSound, triggerHaptic } from '../services/sound';

interface TimerProps {
  secondsRemaining: number;
  totalDuration?: number;
  label?: string;
  size?: 'normal' | 'compact';
}

export function Timer({
  secondsRemaining,
  totalDuration = 30,
  label,
  size = 'normal',
}: TimerProps) {
  const isDanger = secondsRemaining <= 5 && secondsRemaining >= 0;
  const isWarning = secondsRemaining <= 10 && secondsRemaining > 5;

  useEffect(() => {
    if (secondsRemaining <= 5 && secondsRemaining > 0) {
      playNotificationSound('timer-warning');
      triggerHaptic('light');
    }
  }, [secondsRemaining]);

  const percent = totalDuration > 0
    ? Math.max(0, Math.min(100, (secondsRemaining / totalDuration) * 100))
    : 100;

  const badgeBg = isDanger
    ? '#FDA4AF'
    : isWarning
    ? '#FDBA74'
    : '#93C5FD';

  return (
    <div className="flex flex-col items-center justify-center my-1 select-none">
      {label && (
        <span className="text-xs font-black uppercase tracking-wider opacity-65 mb-1">
          {label}
        </span>
      )}

      {/* Chunky Neo-Brutalist Pill Timer */}
      <div
        className={`px-4 py-1.5 rounded-full border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] flex items-center justify-center gap-2 ${
          isDanger ? 'pulse-timer' : ''
        }`}
        style={{ backgroundColor: badgeBg }}
      >
        <span className="text-base">⏱️</span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={secondsRemaining}
            initial={{ scale: 0.85, opacity: 0.6 }}
            animate={{
              scale: isDanger ? [1.12, 1] : 1,
              opacity: 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 24,
            }}
            className={`font-black font-mono tracking-tight text-[#18181B] leading-none ${
              size === 'compact' ? 'text-xl' : 'text-2xl'
            }`}
          >
            {Math.max(0, secondsRemaining)}s LEFT
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Progress pill bar */}
      <div className="w-32 h-3 bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] rounded-full mt-2.5 overflow-hidden shadow-[1px_1px_0px_var(--border-neo)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: isDanger ? '#FDA4AF' : isWarning ? '#FDBA74' : '#86EFAC',
          }}
          animate={{ width: `${percent}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      </div>
    </div>
  );
}
