import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { getPlayerColor } from '@shared/theme/tokens';

export interface CardProps {
  children?: React.ReactNode;
  variant?: 'default' | 'subtle' | 'player' | 'highlight';
  playerColor?: number | string;
  loading?: boolean;
  skeleton?: boolean;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  id?: string;
}

export function Card({
  children,
  variant = 'default',
  playerColor,
  loading = false,
  skeleton = false,
  className = '',
  onClick,
  interactive = false,
  id,
}: CardProps) {
  let resolvedColor: string | null = null;
  if (typeof playerColor === 'number') {
    resolvedColor = getPlayerColor(playerColor).hex;
  } else if (typeof playerColor === 'string') {
    resolvedColor = playerColor;
  }

  const isClickable = !loading && (interactive || Boolean(onClick));

  // If skeleton is requested, render the skeleton card layout
  if (skeleton) {
    return <CardSkeleton className={className} variant={variant} playerColor={playerColor} id={id} />;
  }

  const shadowStyle = variant === 'highlight'
    ? '6px 6px 0px var(--border-neo)'
    : '4px 4px 0px var(--border-neo)';

  return (
    <motion.div
      id={id}
      whileHover={isClickable ? { y: -2, x: -1 } : undefined}
      whileTap={isClickable ? { x: 2, y: 2 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={isClickable ? onClick : undefined}
      aria-busy={loading}
      className={`rounded-[var(--radius-card)] p-5 border-[2.5px] border-[var(--border-neo)] transition-colors relative overflow-hidden ${
        isClickable ? 'cursor-pointer select-none active:shadow-[1px_1px_0px_var(--border-neo)]' : ''
      } ${className}`}
      style={{
        backgroundColor:
          variant === 'subtle'
            ? 'var(--surface-card-subtle)'
            : 'var(--surface-card)',
        borderColor: 'var(--border-neo)',
        borderLeft:
          variant === 'player' && resolvedColor
            ? `8px solid ${resolvedColor}`
            : undefined,
        boxShadow: shadowStyle,
        color: 'var(--text-primary)',
      }}
    >
      {/* Subtle top indeterminate progress bar while loading */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden bg-black/15 z-10">
          <motion.div
            className="h-full bg-current opacity-70 rounded-full"
            initial={{ x: '-100%', width: '35%' }}
            animate={{ x: '350%' }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: 'easeInOut',
            }}
          />
        </div>
      )}

      {/* Dimmed contents with subtle spinner if loading */}
      <div className={`transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
        {children}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
          <div className="p-3 rounded-2xl bg-[var(--surface-card)] neo-border neo-shadow-sm">
            <Loader2 className="w-5 h-5 text-[var(--text-primary)] animate-spin" />
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Reusable CardSkeleton for placeholder state during WebSocket room/game sync
 */
export function CardSkeleton({
  className = '',
  variant = 'default',
  playerColor,
  id,
}: {
  className?: string;
  variant?: 'default' | 'subtle' | 'player' | 'highlight';
  playerColor?: number | string;
  id?: string;
}) {
  let resolvedColor: string | null = null;
  if (typeof playerColor === 'number') {
    resolvedColor = getPlayerColor(playerColor).hex;
  } else if (typeof playerColor === 'string') {
    resolvedColor = playerColor;
  }

  return (
    <div
      id={id}
      className={`rounded-[var(--radius-card)] p-5 border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] animate-pulse relative overflow-hidden ${className}`}
      style={{
        backgroundColor:
          variant === 'subtle'
            ? 'var(--surface-card-subtle)'
            : 'var(--surface-card)',
        borderColor: 'var(--border-neo)',
        borderLeft:
          variant === 'player' && resolvedColor
            ? `8px solid ${resolvedColor}`
            : undefined,
      }}
    >
      {/* Top indeterminate shimmer */}
      <div className="absolute top-0 left-0 right-0 h-1.5 overflow-hidden bg-black/10">
        <motion.div
          className="h-full bg-neutral-400 dark:bg-neutral-500 opacity-40 rounded-full"
          initial={{ x: '-100%', width: '30%' }}
          animate={{ x: '350%' }}
          transition={{
            repeat: Infinity,
            duration: 1.3,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Skeleton Header & Pill */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-lg border-2 border-neutral-300 dark:border-neutral-700" />
        <div className="h-6 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full border-2 border-neutral-300 dark:border-neutral-700" />
      </div>

      {/* Skeleton Body Lines */}
      <div className="space-y-2.5">
        <div className="h-4 w-full bg-neutral-200/80 dark:bg-neutral-800/80 rounded-md" />
        <div className="h-4 w-4/5 bg-neutral-200/70 dark:bg-neutral-800/70 rounded-md" />
      </div>

      {/* Skeleton Action Footer */}
      <div className="mt-5 pt-3 border-t-2 border-[var(--border-neo)] flex items-center justify-between">
        <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl border-2 border-neutral-300 dark:border-neutral-700" />
      </div>
    </div>
  );
}
