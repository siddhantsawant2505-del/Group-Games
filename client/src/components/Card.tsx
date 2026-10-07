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

  return (
    <motion.div
      id={id}
      whileHover={isClickable ? { y: -2, scale: 1.01 } : undefined}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      onClick={isClickable ? onClick : undefined}
      aria-busy={loading}
      className={`rounded-[var(--radius-card)] p-5 border transition-all relative overflow-hidden ${
        isClickable ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={{
        backgroundColor:
          variant === 'subtle'
            ? 'var(--surface-card-subtle)'
            : 'var(--surface-card)',
        borderColor:
          variant === 'player' && resolvedColor
            ? `${resolvedColor}80`
            : 'var(--border-subtle)',
        borderLeft:
          variant === 'player' && resolvedColor
            ? `6px solid ${resolvedColor}`
            : undefined,
        boxShadow:
          variant === 'highlight'
            ? '0 8px 24px rgba(0,0,0,0.06)'
            : '0 4px 12px rgba(0,0,0,0.03)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Subtle top indeterminate progress bar while loading */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-neutral-200/50 dark:bg-neutral-800/50 z-10">
          <motion.div
            className="h-full bg-neutral-900 dark:bg-neutral-100 opacity-60 rounded-full"
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
          <div className="p-2.5 rounded-2xl bg-[var(--surface-card)]/90 backdrop-blur-xs border border-[var(--border-subtle)] shadow-xs">
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
      className={`rounded-[var(--radius-card)] p-5 border animate-pulse relative overflow-hidden ${className}`}
      style={{
        backgroundColor:
          variant === 'subtle'
            ? 'var(--surface-card-subtle)'
            : 'var(--surface-card)',
        borderColor:
          variant === 'player' && resolvedColor
            ? `${resolvedColor}80`
            : 'var(--border-subtle)',
        borderLeft:
          variant === 'player' && resolvedColor
            ? `6px solid ${resolvedColor}`
            : undefined,
      }}
    >
      {/* Top indeterminate shimmer */}
      <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-neutral-200/40 dark:bg-neutral-800/40">
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
        <div className="h-5 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
        <div className="h-6 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
      </div>

      {/* Skeleton Body Lines */}
      <div className="space-y-2.5">
        <div className="h-4 w-full bg-neutral-200/80 dark:bg-neutral-800/80 rounded-md" />
        <div className="h-4 w-4/5 bg-neutral-200/70 dark:bg-neutral-800/70 rounded-md" />
      </div>

      {/* Skeleton Action Footer */}
      <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
      </div>
    </div>
  );
}
