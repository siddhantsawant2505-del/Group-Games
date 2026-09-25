import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { THEME_COLORS } from '../theme/tokens';
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

  // Calculate remaining percentage for progress bar if duration provided
  const percent = totalDuration > 0
    ? Math.max(0, Math.min(100, (secondsRemaining / totalDuration) * 100))
    : 100;

  const textColor = isDanger
    ? THEME_COLORS.semantic.danger
    : isWarning
    ? '#F59E0B'
    : 'var(--text-primary)';

  return (
    <div className="flex flex-col items-center justify-center my-1 select-none">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
          {label}
        </span>
      )}

      {/* Big Centered Numerals (40px+) */}
      <div className="relative flex items-center justify-center h-14">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={secondsRemaining}
            initial={{ scale: 0.8, opacity: 0.5, y: -4 }}
            animate={{
              scale: isDanger ? [1.15, 1] : [1.06, 1],
              opacity: 1,
              y: 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 24,
            }}
            className={`font-black tracking-tight leading-none ${
              size === 'compact' ? 'text-3xl' : 'text-5xl'
            }`}
            style={{ color: textColor }}
          >
            {Math.max(0, secondsRemaining)}s
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress pill bar */}
      <div className="w-28 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full mt-2 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: textColor,
          }}
          animate={{ width: `${percent}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      </div>
    </div>
  );
}
