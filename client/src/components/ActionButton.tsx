import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';

interface ActionButtonProps {
  children: React.ReactNode;
  variant?: 'personal' | 'shared' | 'danger' | 'subtle';
  playerColorIndex?: number;
  customBg?: string;
  customTextColor?: string;
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
  customBg,
  customTextColor,
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

  let bgStyle = 'var(--color-success, #86EFAC)';
  let textStyle = '#18181B';

  if (customBg) {
    bgStyle = customBg;
    textStyle = customTextColor || '#18181B';
  } else if (variant === 'personal') {
    bgStyle = playerColor.hex;
    textStyle = playerColor.contrastText;
  } else if (variant === 'shared') {
    bgStyle = '#FEF08A'; // Butter Yellow hero pop
    textStyle = '#18181B';
  } else if (variant === 'danger') {
    bgStyle = '#FDA4AF'; // Bubblegum Coral
    textStyle = '#18181B';
  } else if (variant === 'subtle') {
    bgStyle = 'var(--surface-card, #FFFFFF)';
    textStyle = 'var(--text-primary, #18181B)';
  }

  const isInteractivityDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      whileHover={!isInteractivityDisabled ? { y: -1, x: -1 } : undefined}
      whileTap={!isInteractivityDisabled ? { x: 2, y: 2 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={!isInteractivityDisabled ? onClick : undefined}
      disabled={isInteractivityDisabled}
      aria-busy={loading}
      className={`w-full min-h-[58px] px-6 py-3.5 rounded-2xl font-extrabold text-base flex flex-col items-center justify-center select-none border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] relative overflow-hidden transition-colors ${
        isInteractivityDisabled
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer active:shadow-[1px_1px_0px_var(--border-neo)]'
      } ${className}`}
      style={{
        backgroundColor: bgStyle,
        color: textStyle,
      }}
    >
      {/* Subtle top indeterminate progress bar while loading */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden bg-black/15">
          <motion.div
            className="h-full bg-current opacity-70 rounded-full"
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

      <span className="inline-flex items-center justify-center gap-2 tracking-wide font-black">
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
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
