import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { getPlayerColor } from '../theme/tokens';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'personal' | 'shared' | 'primary' | 'secondary' | 'danger' | 'subtle';
  playerColor?: number | string; // Color index (0-5) or direct hex string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
  subtext?: string;
  id?: string;
}

export function Button({
  children,
  variant = 'shared',
  playerColor,
  onClick,
  disabled = false,
  loading = false,
  loadingText,
  type = 'button',
  fullWidth = true,
  size = 'md',
  className = '',
  icon,
  subtext,
  id,
}: ButtonProps) {
  // Resolve player color if provided
  let resolvedColor = '#FF5A5F';
  let resolvedContrastText = '#FFFFFF';

  if (typeof playerColor === 'number') {
    const token = getPlayerColor(playerColor);
    resolvedColor = token.hex;
    resolvedContrastText = token.contrastText;
  } else if (typeof playerColor === 'string') {
    resolvedColor = playerColor;
    resolvedContrastText = '#FFFFFF';
  }

  let bgStyle = 'var(--text-primary)';
  let textStyle = 'var(--bg-app)';
  let borderStyle = 'transparent';

  if (variant === 'personal') {
    bgStyle = resolvedColor;
    textStyle = resolvedContrastText;
  } else if (variant === 'shared' || variant === 'primary') {
    bgStyle = 'var(--text-primary)';
    textStyle = 'var(--bg-app)';
  } else if (variant === 'secondary' || variant === 'subtle') {
    bgStyle = 'var(--surface-card)';
    textStyle = 'var(--text-primary)';
    borderStyle = 'var(--border-subtle)';
  } else if (variant === 'danger') {
    bgStyle = 'var(--color-danger, #EF4444)';
    textStyle = '#FFFFFF';
  }

  const sizeClasses = {
    sm: 'min-h-[44px] px-4 py-2 text-sm',
    md: 'min-h-[50px] px-6 py-3.5 text-base',
    lg: 'min-h-[56px] px-7 py-4 text-lg',
  }[size];

  const spinnerSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const isInteractivityDisabled = disabled || loading;

  return (
    <motion.button
      id={id}
      type={type}
      whileHover={!isInteractivityDisabled ? { scale: 1.015, filter: 'brightness(1.03)' } : undefined}
      whileTap={!isInteractivityDisabled ? { scale: 0.96 } : undefined}
      transition={{ type: 'spring', stiffness: 450, damping: 22 }}
      onClick={!isInteractivityDisabled ? onClick : undefined}
      disabled={isInteractivityDisabled}
      aria-busy={loading}
      className={`font-bold rounded-[var(--radius-button)] flex flex-col items-center justify-center transition-all select-none border shadow-xs relative overflow-hidden ${
        fullWidth ? 'w-full' : 'w-auto inline-flex'
      } ${sizeClasses} ${
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
      {/* Subtle top indeterminate progress bar when loading */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-black/10 dark:bg-white/10">
          <motion.div
            className="h-full bg-current opacity-60 rounded-full"
            initial={{ x: '-100%', width: '40%' }}
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
            <Loader2 className={`${spinnerSize} animate-spin shrink-0`} />
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
