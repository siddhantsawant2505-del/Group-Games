import { useEffect } from 'react';
import { motion } from 'motion/react';
import { PLAYER_COLORS } from '@shared/theme/tokens';

interface LoadingScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export function LoadingScreen({ onComplete, durationMs = 1350 }: LoadingScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [onComplete, durationMs]);

  // Radius for circular dot cluster
  const radius = 32;

  return (
    <div className="flex-1 min-h-[80vh] flex flex-col items-center justify-center p-6 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center relative"
      >
        {/* Animated Rotating & Pulsing Cluster of Identity Dots */}
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: 'linear',
          }}
          className="relative w-24 h-24 flex items-center justify-center mb-6"
        >
          {PLAYER_COLORS.map((color, index) => {
            const angle = (index * 2 * Math.PI) / PLAYER_COLORS.length;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <motion.div
                key={color.hex}
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{
                  scale: [1, 1.35, 1],
                  x: [0, x, x * 0.9],
                  y: [0, y, y * 0.9],
                }}
                transition={{
                  scale: {
                    repeat: Infinity,
                    duration: 1.2,
                    delay: index * 0.12,
                    ease: 'easeInOut',
                  },
                  x: { duration: 0.5, delay: 0.1, type: 'spring', stiffness: 300, damping: 20 },
                  y: { duration: 0.5, delay: 0.1, type: 'spring', stiffness: 300, damping: 20 },
                }}
                className="absolute w-4 h-4 rounded-full shadow-md"
                style={{
                  backgroundColor: color.hex,
                }}
              />
            );
          })}

          {/* Central Pulsing Ambient Glow */}
          <motion.div
            animate={{
              scale: [0.85, 1.15, 0.85],
              opacity: [0.35, 0.7, 0.35],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: 'easeInOut',
            }}
            className="w-6 h-6 rounded-full bg-neutral-900/10 dark:bg-neutral-100/15 backdrop-blur-xs"
          />
        </motion.div>

        {/* Wordmark Animation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="text-center"
        >
          <motion.h1
            animate={{
              scale: [0.98, 1.02, 0.98],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.6,
              ease: 'easeInOut',
            }}
            className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--text-primary)] leading-none"
          >
            Party Games
          </motion.h1>
        </motion.div>
      </motion.div>
    </div>
  );
}
