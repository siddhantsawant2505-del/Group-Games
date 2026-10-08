import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle2, Link2, Lightbulb } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { getPlayerColor } from '@shared/theme/tokens';

interface GtlInputScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSubmitAnswer: (answer: string) => void;
  onHostSkip?: () => void;
}

/** Longest response the server accepts (3 words / 24 characters). */
const MAX_RESPONSE_CHARS = 24;
const MAX_RESPONSE_WORDS = 3;

/**
 * Guess the Link — Response Submission.
 * One word or a short phrase inspired by the player's own private angle.
 */
export function GtlInputScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
  onHostSkip,
}: GtlInputScreenProps) {
  const [answer, setAnswer] = useState(privateState.gtlResponseText || '');
  const [isPending, setIsPending] = useState(false);

  const hasSubmitted = Boolean(
    privateState.gtlResponseSubmitted || room.hasSubmittedInput.includes(myPlayer.id)
  );
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = answer.replace(/\s+/g, ' ').trim();
    if (!trimmed || isPending) return;
    setIsPending(true);
    onSubmitAnswer(trimmed);
  };

  const wordCount = answer.replace(/\s+/g, ' ').trim()
    ? answer.replace(/\s+/g, ' ').trim().split(' ').length
    : 0;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header and timer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black"
            style={{
              backgroundColor: `${playerColor.hex}18`,
              borderColor: playerColor.hex,
              color: 'var(--text-primary)',
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: playerColor.hex }}
            />
            <span>Your angle is private</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {room.hasSubmittedInput.length} / {room.players.length} Submitted
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Time to Respond"
          />
        )}
      </div>

      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-6 rounded-3xl my-auto"
        style={{ boxShadow: `0 8px 24px ${playerColor.hex}15` }}
      >
        {/* Your hint */}
        <div
          className="p-3 rounded-2xl mb-4 flex items-center gap-2.5"
          style={{ backgroundColor: `${playerColor.hex}12` }}
        >
          <Lightbulb className="w-4 h-4 shrink-0" style={{ color: playerColor.hex }} />
          <div className="text-left min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
              Your angle
            </span>
            <span className="text-base font-black text-[var(--text-primary)] truncate block">
              {privateState.gtlHint || 'Your angle'}
            </span>
          </div>
          {privateState.gtlCategory && (
            <span className="ml-auto shrink-0 text-[10px] font-black px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {privateState.gtlCategory}
            </span>
          )}
        </div>

        <div className="mb-4">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block mb-1">
            Response
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
            Write one word or a short phrase that fits your angle
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
            Everyone sees your response — but never your angle.
          </p>
        </div>

        {hasSubmitted ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span className="text-base font-black text-emerald-800 dark:text-emerald-200">
              Response Locked In!
            </span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              "{privateState.gtlResponseText || answer}"
            </p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Held privately until the link board reveals everything
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={MAX_RESPONSE_CHARS}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={privateState.inputPlaceholder || 'A word or short phrase...'}
                className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] text-center tracking-wide focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
                autoFocus
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-1">
                <span>
                  Up to {MAX_RESPONSE_WORDS} words
                  {wordCount > MAX_RESPONSE_WORDS ? ' — too many!' : ''}
                </span>
                <span>
                  {answer.length}/{MAX_RESPONSE_CHARS}
                </span>
              </div>
            </div>

            <ActionButton
              type="submit"
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              disabled={!answer.trim() || wordCount > MAX_RESPONSE_WORDS}
              loading={isPending && !hasSubmitted}
              loadingText="Locking in response..."
              icon={<Send className="w-5 h-5" />}
              subtext="Held privately until the reveal"
            >
              Submit Response
            </ActionButton>
          </form>
        )}

        {/* Submission tracker */}
        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 block mb-2 text-left">
            Player Status:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {room.players.map((p) => (
              <PlayerChip
                key={p.id}
                name={p.name}
                colorIndex={p.colorIndex}
                isYou={p.id === myPlayer.id}
                status={room.hasSubmittedInput.includes(p.id) ? 'submitted' : 'idle'}
                size="sm"
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
          <Link2 className="w-3.5 h-3.5" />
          <span>Different angle, same hidden concept for the whole table.</span>
        </div>
      </motion.div>

      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: Skip to the link board immediately
          </button>
        </div>
      )}
    </div>
  );
}
