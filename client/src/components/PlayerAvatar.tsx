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
 * e.g. "Alex Smith" -> "AS", "P1" -> "P1", "Charlie" -> "C"
 */
function getPlayerInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const clean = name.trim();
  const parts = clean.split(/[\s_-]+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0].charAt(0);
    const second = parts[1].charAt(0);
    return `${first}${second}`.toUpperCase();
  }

  // If single word, use first letter (or up to 2 letters if short like P1, J2)
  if (clean.length <= 2 && /^[a-zA-Z0-9]+$/.test(clean)) {
    return clean.toUpperCase();
  }

  return clean.charAt(0).toUpperCase();
}

export function PlayerAvatar({
  name = 'Player',
  avatarUrl,
  colorIndex = 0,
  colorHex,
  size = 'md',
  isHost = false,
  connected = true,
  showBorder = false,
  borderWidth = 2,
  interactive = false,
  onClick,
  className = '',
  id,
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Determine identity color and contrast text
  const colorToken = getPlayerColor(colorIndex);
  const bgColor = colorHex || colorToken.hex;
  const textColor = colorHex ? '#FFFFFF' : colorToken.contrastText;

  // Size styling maps
  const sizeStyles = {
    xs: {
      dimension: 'w-6 h-6',
      fontSize: 'text-[10px]',
      crownSize: 'w-2.5 h-2.5 -top-1 -right-1',
      badgeSize: 'w-2 h-2',
      crownIconSize: 'w-2 h-2',
    },
    sm: {
      dimension: 'w-8 h-8',
      fontSize: 'text-xs',
      crownSize: 'w-3.5 h-3.5 -top-1 -right-1',
      badgeSize: 'w-2.5 h-2.5',
      crownIconSize: 'w-2.5 h-2.5',
    },
    md: {
      dimension: 'w-10 h-10',
      fontSize: 'text-sm',
      crownSize: 'w-4 h-4 -top-1.5 -right-1.5',
      badgeSize: 'w-3 h-3',
      crownIconSize: 'w-3 h-3',
    },
    lg: {
      dimension: 'w-12 h-12',
      fontSize: 'text-base',
      crownSize: 'w-5 h-5 -top-2 -right-2',
      badgeSize: 'w-3.5 h-3.5',
      crownIconSize: 'w-3.5 h-3.5',
    },
    xl: {
      dimension: 'w-16 h-16',
      fontSize: 'text-xl',
      crownSize: 'w-6 h-6 -top-2.5 -right-2.5',
      badgeSize: 'w-4 h-4',
      crownIconSize: 'w-4 h-4',
    },
    '2xl': {
      dimension: 'w-20 h-20',
      fontSize: 'text-2xl',
      crownSize: 'w-7 h-7 -top-3 -right-3',
      badgeSize: 'w-5 h-5',
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
      {/* Circular Avatar Container */}
      <div
        className={`rounded-full flex items-center justify-center font-black tracking-tight overflow-hidden shadow-xs ${
          sizeStyles.dimension
        } ${sizeStyles.fontSize} ${
          !connected ? 'opacity-50 grayscale-40' : ''
        }`}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          border: showBorder
            ? `${borderWidth}px solid var(--surface-card, #FFFFFF)`
            : undefined,
          boxShadow: showBorder
            ? `0 0 0 2px ${bgColor}80`
            : '0 2px 6px rgba(0,0,0,0.08)',
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
          <span className="leading-none drop-shadow-2xs font-extrabold">
            {initials}
          </span>
        )}
      </div>

      {/* Host Crown Badge */}
      {isHost && (
        <div
          className={`absolute ${sizeStyles.crownSize} bg-amber-400 text-amber-950 rounded-full flex items-center justify-center shadow-xs border border-amber-300 ring-1 ring-white dark:ring-neutral-900 z-10`}
          title="Room Host"
        >
          <Crown className={`${sizeStyles.crownIconSize} fill-amber-950`} />
        </div>
      )}

      {/* Connection Offline Indicator */}
      {!connected && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${sizeStyles.badgeSize} rounded-full bg-red-500 border border-white dark:border-neutral-900 flex items-center justify-center text-white z-10`}
          title="Player disconnected"
        >
          <WifiOff className="w-2 h-2" />
        </div>
      )}
    </motion.div>
  );
}
