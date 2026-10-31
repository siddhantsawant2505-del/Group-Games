import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Crown, WifiOff } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';

export interface PlayerAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  colorIndex?: number;
  colorHex?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isHost?: boolean;
  connected?: boolean;
  showBorder?: boolean;
  borderWidth?: number;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  id?: string;
}

/**
 * Extracts 1-2 letter initials from player name.
 */
function getPlayerInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const clean = name.trim();
  const parts = clean.split(/[\s_-]+/).filter(Boolean);

  const firstOf = (part: string) => Array.from(part)[0] ?? '';

  if (parts.length >= 2) {
    const first = firstOf(parts[0]);
    const second = firstOf(parts[1]);
    return `${first}${second}`.toUpperCase();
  }

  if (Array.from(clean).length <= 2 && /^[a-zA-Z0-9]+$/.test(clean)) {
    return clean.toUpperCase();
  }

  return firstOf(clean).toUpperCase();
}

export function PlayerAvatar({
  name = 'Player',
  avatarUrl,
  colorIndex = 0,
  colorHex,
  size = 'md',
  isHost = false,
  connected = true,
  interactive = false,
  onClick,
  className = '',
  id,
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Determine identity color and contrast text
  const colorToken = getPlayerColor(colorIndex);
  const bgColor = colorHex || colorToken.hex;
  const textColor = colorHex ? '#18181B' : colorToken.contrastText;

  // Size styling maps
  const sizeStyles = {
    xs: {
      dimension: 'w-6 h-6',
      fontSize: 'text-[10px]',
      crownSize: 'w-3 h-3 -top-1.5 -right-1.5',
      badgeSize: 'w-2.5 h-2.5',
      crownIconSize: 'w-2 h-2',
    },
    sm: {
      dimension: 'w-8 h-8',
      fontSize: 'text-xs',
      crownSize: 'w-4 h-4 -top-1.5 -right-1.5',
      badgeSize: 'w-3 h-3',
      crownIconSize: 'w-2.5 h-2.5',
    },
    md: {
      dimension: 'w-10 h-10',
      fontSize: 'text-sm',
      crownSize: 'w-5 h-5 -top-2 -right-2',
      badgeSize: 'w-3.5 h-3.5',
      crownIconSize: 'w-3 h-3',
    },
    lg: {
      dimension: 'w-12 h-12',
      fontSize: 'text-base',
      crownSize: 'w-6 h-6 -top-2.5 -right-2.5',
      badgeSize: 'w-4 h-4',
      crownIconSize: 'w-3.5 h-3.5',
    },
    xl: {
      dimension: 'w-16 h-16',
      fontSize: 'text-xl',
      crownSize: 'w-7 h-7 -top-3 -right-3',
      badgeSize: 'w-5 h-5',
      crownIconSize: 'w-4 h-4',
    },
    '2xl': {
      dimension: 'w-20 h-20',
      fontSize: 'text-2xl',
      crownSize: 'w-8 h-8 -top-3.5 -right-3.5',
      badgeSize: 'w-6 h-6',
      crownIconSize: 'w-5 h-5',
    },
  }[size];

  const initials = getPlayerInitials(name);
  const isClickable = interactive || Boolean(onClick);

  return (
    <motion.div
      id={id}
      whileHover={isClickable ? { scale: 1.08 } : undefined}
      whileTap={isClickable ? { scale: 0.94 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={isClickable ? onClick : undefined}
      className={`relative inline-flex shrink-0 select-none ${
        isClickable ? 'cursor-pointer' : ''
      } ${className}`}
      title={`${name}${isHost ? ' (Host)' : ''}${!connected ? ' - Disconnected' : ''}`}
    >
      {/* Circular Avatar Container with Neo-Brutalist Border & Hard Offset Shadow */}
      <div
        className={`rounded-full flex items-center justify-center font-black tracking-tight overflow-hidden border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] ${
          sizeStyles.dimension
        } ${sizeStyles.fontSize} ${
          !connected ? 'opacity-50 grayscale-40' : ''
        }`}
        style={{
          backgroundColor: bgColor,
          color: textColor,
        }}
      >
        {avatarUrl && !imageError ? (
          <img
            src={avatarUrl}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span className="leading-none font-black">
            {initials}
          </span>
        )}
      </div>

      {/* Host Crown Badge */}
      {isHost && (
        <div
          className={`absolute ${sizeStyles.crownSize} bg-[#FEF08A] text-[#18181B] rounded-full flex items-center justify-center border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] z-10`}
          title="Room Host"
        >
          <Crown className={`${sizeStyles.crownIconSize} fill-[#18181B] text-[#18181B]`} />
        </div>
      )}

      {/* Connection Offline Indicator */}
      {!connected && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${sizeStyles.badgeSize} rounded-full bg-[#FDA4AF] border border-[var(--border-neo)] flex items-center justify-center text-[#18181B] z-10`}
          title="Player disconnected"
        >
          <WifiOff className="w-2.5 h-2.5" />
        </div>
      )}
    </motion.div>
  );
}
