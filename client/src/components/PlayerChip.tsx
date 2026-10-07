import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerChipProps {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  colorIndex?: number;
  color?: string | number; // Dynamically accepts color index (0-5) or hex string
  colorHex?: string;
  isHost?: boolean;
  isYou?: boolean;
  connected?: boolean;
  score?: number;
  badge?: string | null;
  status?: 'ready' | 'voted' | 'submitted' | 'idle' | 'disconnected';
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
}

export function PlayerChip({
  id,
  name,
  avatarUrl,
  colorIndex,
  color,
  colorHex,
  isHost = false,
  isYou = false,
  connected = true,
  score,
  badge,
  status,
  size = 'md',
  selected = false,
  selectable = false,
  onClick,
}: PlayerChipProps) {
  // Dynamically resolve player assigned color
  let activeColorHex = '#FF5A5F';

  const effectiveColor = color !== undefined ? color : (colorHex || colorIndex || 0);

  if (typeof effectiveColor === 'number') {
    const token = getPlayerColor(effectiveColor);
    activeColorHex = token.hex;
  } else if (typeof effectiveColor === 'string') {
    activeColorHex = effectiveColor;
  }

  const sizeClasses = {
    sm: {
      container: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-full',
      avatarSize: 'xs' as const,
    },
    md: {
      container: 'px-3.5 py-2 text-sm gap-2.5 rounded-full min-h-[44px]',
      avatarSize: 'sm' as const,
    },
    lg: {
      container: 'px-4 py-3 text-base gap-3 rounded-2xl min-h-[52px]',
      avatarSize: 'md' as const,
    },
  }[size];

  return (
    <motion.button
      id={id}
      type="button"
      whileHover={selectable ? { scale: 1.03 } : undefined}
      whileTap={selectable ? { scale: 0.96 } : undefined}
      onClick={onClick}
      disabled={!selectable && !onClick}
      className={`inline-flex items-center transition-colors font-medium border ${
        selectable ? 'cursor-pointer' : 'cursor-default'
      } ${
        selected
          ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-neutral-100 shadow-md'
          : ''
      } ${sizeClasses.container}`}
      style={{
        backgroundColor: selected ? `${activeColorHex}18` : 'var(--surface-card)',
        borderColor: selected ? activeColorHex : 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Player Avatar Component */}
      <PlayerAvatar
        name={name}
        avatarUrl={avatarUrl}
        colorHex={activeColorHex}
        size={sizeClasses.avatarSize}
        isHost={isHost}
        connected={connected}
      />

      {/* Name and Indicators */}
      <span className="truncate max-w-[140px] font-semibold text-left">
        {name}
        {isYou && (
          <span className="ml-1 text-[11px] font-normal opacity-70">
            (You)
          </span>
        )}
      </span>

      {/* Status: Voted / Submitted checkmark */}
      {(status === 'voted' || status === 'submitted') && (
        <span
          title={status === 'voted' ? 'Voted' : 'Submitted'}
          className="shrink-0 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ml-auto"
        >
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}

      {/* Badge or Score */}
      {score !== undefined && (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 ml-auto">
          {score} pts
        </span>
      )}

      {badge && (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-200 dark:bg-neutral-700 ml-auto">
          {badge}
        </span>
      )}
    </motion.button>
  );
}
