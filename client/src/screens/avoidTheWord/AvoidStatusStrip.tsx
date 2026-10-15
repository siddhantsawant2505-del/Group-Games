import { motion } from 'motion/react';
import { Check, Clock, Crown, MinusCircle, Skull, UserX } from 'lucide-react';
import { AVOID_STATUS_LABELS, AvoidPlayerStatus } from '@shared/types';
import { getPlayerColor } from '@shared/theme/tokens';

interface AvoidStatusStripProps {
  statuses: AvoidPlayerStatus[];
  anchorPlayerId: string;
  activePlayerId?: string;
  myPlayerId: string;
  /** Reveal-phase overrules, keyed by player id. */
  overrules?: Record<string, boolean>;
}

const STATUS_STYLES = {
  waiting: { bg: 'var(--surface-card-subtle)', fg: 'var(--text-primary)', icon: Clock },
  safe: { bg: 'rgba(34, 197, 94, 0.14)', fg: '#16A34A', icon: Check },
  matched: { bg: 'rgba(239, 68, 68, 0.16)', fg: '#DC2626', icon: Skull },
  skipped: { bg: 'rgba(245, 158, 11, 0.16)', fg: '#D97706', icon: MinusCircle },
  eliminated: { bg: 'var(--surface-card-subtle)', fg: '#A3A3A3', icon: UserX },
} as const;

/**
 * Avoid the Word — Status Strip.
 * One row per player: who is still in, whose turn it is and how their answer
 * landed. It never shows an answer — only the state of the player.
 */
export function AvoidStatusStrip({
  statuses,
  anchorPlayerId,
  activePlayerId,
  myPlayerId,
  overrules,
}: AvoidStatusStripProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {statuses.map((status, index) => {
        const color = getPlayerColor(status.colorIndex);
        const style = STATUS_STYLES[status.status];
        const StatusIcon = style.icon;
        const isActive = status.playerId === activePlayerId;
        const isAnchor = status.playerId === anchorPlayerId;
        const overruled = overrules?.[status.playerId];

        return (
          <motion.div
            key={status.playerId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-bold transition-colors ${
              isActive ? 'ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-500' : ''
            }`}
            style={{
              backgroundColor: style.bg,
              borderColor: isActive ? color.hex : 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
              style={{ backgroundColor: color.hex, color: color.contrastText }}
            >
              {status.playerName.charAt(0).toUpperCase()}
            </span>

            <span className="truncate max-w-[92px]">
              {status.playerName}
              {status.playerId === myPlayerId && ' (You)'}
            </span>

            {isAnchor && <Crown className="w-3.5 h-3.5 shrink-0 text-amber-500" />}

            <span
              className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-black"
              style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: style.fg }}
            >
              <StatusIcon className="w-3 h-3" />
              {AVOID_STATUS_LABELS[status.status]}
            </span>

            {overruled !== undefined && (
              <span className="shrink-0 text-[10px] font-black text-amber-600 dark:text-amber-400">
                Host: {overruled ? 'Match' : 'Safe'}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
