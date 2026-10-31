import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';

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
  let resolvedColor = '#FDA4AF';
  let resolvedContrastText = '#18181B';

  if (typeof playerColor === 'number') {
    const token = getPlayerColor(playerColor);
    resolvedColor = token.hex;
    resolvedContrastText = token.contrastText;
  } else if (typeof playerColor === 'string') {
    resolvedColor = playerColor;
    resolvedContrastText = '#18181B';
  }

  let bgStyle = 'var(--color-success, #86EFAC)';
  let textStyle = '#18181B';

  if (variant === 'personal') {
    bgStyle = resolvedColor;
    textStyle = resolvedContrastText;
  } else if (variant === 'shared' || variant === 'primary') {
    bgStyle = 'var(--color-success, #86EFAC)';
    textStyle = '#18181B';
  } else if (variant === 'secondary' || variant === 'subtle') {
    bgStyle = 'var(--surface-card, #FFFFFF)';
    textStyle = 'var(--text-primary, #18181B)';
  } else if (variant === 'danger') {
    bgStyle = 'var(--color-danger, #FDA4AF)';
    textStyle = '#18181B';
  }

  const sizeClasses = {
    sm: 'min-h-[44px] px-4 py-2 text-sm shadow-[2px_2px_0px_var(--border-neo)]',
    md: 'min-h-[52px] px-6 py-3.5 text-base shadow-[4px_4px_0px_var(--border-neo)]',
    lg: 'min-h-[60px] px-7 py-4 text-lg shadow-[4px_4px_0px_var(--border-neo)]',
  }[size];

  const spinnerSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const isInteractivityDisabled = disabled || loading;

  return (
    <motion.button
      id={id}
      type={type}
      whileHover={!isInteractivityDisabled ? { y: -1, x: -1 } : undefined}
      whileTap={!isInteractivityDisabled ? { x: 2, y: 2 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={!isInteractivityDisabled ? onClick : undefined}
      disabled={isInteractivityDisabled}
      aria-busy={loading}
      className={`font-extrabold rounded-[var(--radius-button)] flex flex-col items-center justify-center select-none border-[2.5px] border-[var(--border-neo)] relative overflow-hidden transition-colors ${
        fullWidth ? 'w-full' : 'w-auto inline-flex'
      } ${sizeClasses} ${
        isInteractivityDisabled
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer active:shadow-[1px_1px_0px_var(--border-neo)]'
      } ${className}`}
      style={{
        backgroundColor: bgStyle,
        color: textStyle,
      }}
    >
      {/* Subtle top indeterminate progress bar when loading */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden bg-black/15">
          <motion.div
            className="h-full bg-current opacity-70 rounded-full"
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

      <span className="inline-flex items-center justify-center gap-2 tracking-wide font-black">
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
        <span className="text-xs font-semibold opacity-85 mt-0.5 whitespace-nowrap">
          {subtext}
        </span>
      )}
    </motion.button>
  );
}
