import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';

interface ActionButtonProps {
  children: React.ReactNode;
  variant?: 'personal' | 'shared' | 'danger' | 'subtle';
  playerColorIndex?: number;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  icon?: React.ReactNode;
  subtext?: string;
}

export function ActionButton({
  children,
  variant = 'shared',
  playerColorIndex = 0,
  onClick,
  disabled = false,
  loading = false,
  loadingText,
  type = 'button',
  className = '',
  icon,
  subtext,
}: ActionButtonProps) {
  const playerColor = getPlayerColor(playerColorIndex);

  let bgStyle = 'var(--text-primary)';
  let textStyle = 'var(--bg-app)';
  let borderStyle = 'transparent';

  if (variant === 'personal') {
    bgStyle = playerColor.hex;
    textStyle = playerColor.contrastText;
  } else if (variant === 'shared') {
    bgStyle = 'var(--text-primary)';
    textStyle = 'var(--bg-app)';
  } else if (variant === 'danger') {
    bgStyle = 'var(--color-danger)';
    textStyle = '#FFFFFF';
  } else if (variant === 'subtle') {
    bgStyle = 'var(--surface-card)';
    textStyle = 'var(--text-primary)';
    borderStyle = 'var(--border-subtle)';
  }

  const isInteractivityDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      whileHover={!isInteractivityDisabled ? { scale: 1.015, filter: 'brightness(1.04)' } : undefined}
      whileTap={!isInteractivityDisabled ? { scale: 0.96 } : undefined}
      transition={{ type: 'spring', stiffness: 450, damping: 22 }}
      onClick={!isInteractivityDisabled ? onClick : undefined}
      disabled={isInteractivityDisabled}
      aria-busy={loading}
      className={`w-full min-h-[52px] px-6 py-3.5 rounded-2xl font-bold text-base flex flex-col items-center justify-center transition-all select-none border shadow-xs relative overflow-hidden ${
        isInteractivityDisabled
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer active:shadow-inner'
      } ${className}`}
      style={{
        backgroundColor: bgStyle,
        color: textStyle,
        borderColor: borderStyle,
      }}
    >
      {/* Subtle top indeterminate progress bar while loading */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-black/10 dark:bg-white/10">
          <motion.div
            className="h-full bg-current opacity-60 rounded-full"
            initial={{ x: '-100%', width: '35%' }}
            animate={{ x: '350%' }}
            transition={{
              repeat: Infinity,
              duration: 1.1,
              ease: 'easeInOut',
            }}
          />
        </div>
      )}

      <span className="inline-flex items-center justify-center gap-2 tracking-wide font-bold">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="whitespace-nowrap">{loadingText || children}</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="whitespace-nowrap">{children}</span>
          </>
        )}
      </span>

      {!loading && subtext && (
        <span className="text-xs font-normal opacity-80 mt-0.5 whitespace-nowrap">
          {subtext}
        </span>
      )}
    </motion.button>
  );
}
