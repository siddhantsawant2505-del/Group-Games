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
  let activeColorHex = '#FDA4AF';

  const effectiveColor = color !== undefined ? color : (colorHex || colorIndex || 0);

  if (typeof effectiveColor === 'number') {
    const token = getPlayerColor(effectiveColor);
    activeColorHex = token.hex;
  } else if (typeof effectiveColor === 'string') {
    activeColorHex = effectiveColor;
  }

  const sizeClasses = {
    sm: {
      container: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-xl min-h-[36px]',
      avatarSize: 'xs' as const,
    },
    md: {
      container: 'px-3.5 py-2 text-sm gap-2.5 rounded-xl min-h-[46px]',
      avatarSize: 'sm' as const,
    },
    lg: {
      container: 'px-4 py-3 text-base gap-3 rounded-2xl min-h-[54px]',
      avatarSize: 'md' as const,
    },
  }[size];

  return (
    <motion.button
      id={id}
      type="button"
      whileHover={selectable ? { y: -1, x: -1 } : undefined}
      whileTap={selectable ? { x: 2, y: 2 } : undefined}
      onClick={onClick}
      disabled={!selectable && !onClick}
      className={`inline-flex items-center transition-all font-bold border-2 border-[var(--border-neo)] select-none ${
        selectable ? 'cursor-pointer active:shadow-[1px_1px_0px_var(--border-neo)]' : 'cursor-default'
      } ${
        selected
          ? 'shadow-[4px_4px_0px_var(--border-neo)] -translate-y-0.5'
          : 'shadow-[2px_2px_0px_var(--border-neo)]'
      } ${sizeClasses.container}`}
      style={{
        backgroundColor: selected ? '#FEF08A' : 'var(--surface-card, #FFFFFF)',
        color: '#18181B',
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
      <span className="truncate max-w-[140px] font-black text-left text-[var(--text-primary)]">
        {name}
        {isYou && (
          <span className="ml-1 text-[11px] font-bold opacity-75">
            (You)
          </span>
        )}
      </span>

      {/* Status: Voted / Submitted checkmark */}
      {(status === 'voted' || status === 'submitted') && (
        <span
          title={status === 'voted' ? 'Voted' : 'Submitted'}
          className="shrink-0 w-5 h-5 rounded-lg bg-[#86EFAC] text-[#18181B] border border-[var(--border-neo)] flex items-center justify-center ml-auto font-black"
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </span>
      )}

      {/* Badge or Score */}
      {score !== undefined && (
        <span className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-black bg-[#93C5FD] text-[#18181B] border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] ml-auto font-mono">
          {score} pts
        </span>
      )}

      {badge && (
        <span className="shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-black bg-[#C4B5FD] text-[#18181B] border border-[var(--border-neo)] ml-auto">
          {badge}
        </span>
      )}
    </motion.button>
  );
}
