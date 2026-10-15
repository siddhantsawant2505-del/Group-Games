import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Zap } from 'lucide-react';
import { playNotificationSound, triggerHaptic } from '../../services/sound';

interface AvoidMatchedBannerProps {
  /** Player name from the public state — the answer itself is never announced. */
  playerName: string;
  /** Changes every time a new player matches, so the banner can replay. */
  matchKey: string;
}

/**
 * Avoid the Word — Live Match Banner.
 * Announces "<name> matched the anchor's answer!" the moment the server compares
 * the answers. Deliberately no answer text: the round reveal shows that later.
 */
export function AvoidMatchedBanner({ playerName, matchKey }: AvoidMatchedBannerProps) {
  useEffect(() => {
    if (!matchKey) return;
    playNotificationSound('card-reveal');
    triggerHaptic('heavy');
  }, [matchKey]);

  return (
    <AnimatePresence>
      {Boolean(matchKey) && (
        <motion.div
          key={matchKey}
          initial={{ opacity: 0, scale: 0.9, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="p-3 rounded-2xl border flex items-center gap-2.5"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.45)',
          }}
          role="status"
          aria-live="polite"
        >
          <motion.span
            animate={{ rotate: [0, -12, 12, 0] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            className="shrink-0"
          >
            <Zap className="w-5 h-5 text-red-500" />
          </motion.span>
          <span className="text-sm font-black text-[var(--text-primary)] leading-snug">
            {playerName} matched the anchor&apos;s answer!
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
