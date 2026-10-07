import { motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';

interface RevealCardProps {
  playerName: string;
  playerColorIndex: number;
  answerText: string;
  revealed: boolean;
  subtext?: string;
  isHost?: boolean;
  onToggleReveal?: () => void;
  indexDelay?: number;
}

export function RevealCard({
  playerName,
  playerColorIndex,
  answerText,
  revealed,
  subtext,
  isHost,
  onToggleReveal,
  indexDelay = 0,
}: RevealCardProps) {
  const color = getPlayerColor(playerColorIndex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: indexDelay * 0.08,
        type: 'spring',
        stiffness: 350,
        damping: 25,
      }}
      className="party-card p-4 rounded-2xl flex flex-col gap-2 transition-shadow"
      style={{
        borderLeft: `6px solid ${color.hex}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Player identifier pill */}
        <div className="inline-flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              backgroundColor: color.hex,
              color: color.contrastText,
            }}
          >
            {playerName.charAt(0).toUpperCase()}
          </div>
          <span className="font-bold text-sm tracking-tight truncate max-w-[160px]">
            {playerName}
          </span>
        </div>

        {/* Reveal toggle for host / interactive preview */}
        {isHost && onToggleReveal && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 p-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            {revealed ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Hide</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Reveal</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Answer Container: Rounded pill colored by player identity or obscured */}
      <div className="mt-1">
        {revealed ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 450, damping: 20 }}
            className="p-3 rounded-xl font-bold text-base flex flex-col items-start break-words"
            style={{
              backgroundColor: `${color.hex}18`,
              color: 'var(--text-primary)',
              border: `1.5px solid ${color.hex}40`,
            }}
          >
            <span className="text-base font-extrabold tracking-wide">
              {answerText}
            </span>
            {subtext && (
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
                {subtext}
              </span>
            )}
          </motion.div>
        ) : (
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Hidden answer
            </span>
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 animate-pulse delay-75" />
              <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 animate-pulse delay-150" />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
