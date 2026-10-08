import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, Lock, CheckCircle2, Target, Shuffle } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { getPlayerColor } from '@shared/theme/tokens';

interface GtlGuessScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onGuess: (guess: string) => void;
  onHostSkip?: () => void;
}

const MAX_GUESS_CHARS = 24;

/**
 * Guess the Link — Guess Phase.
 * Everyone answers at the same time (like a secret vote); guesses stay private
 * until the concept is revealed in results.
 */
export function GtlGuessScreen({
  room,
  myPlayer,
  privateState,
  onGuess,
  onHostSkip,
}: GtlGuessScreenProps) {
  const [guess, setGuess] = useState(privateState.gtlGuessText || '');
  const [isPending, setIsPending] = useState(false);

  const gtl = room.gtlState;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const hasGuessed = Boolean(
    privateState.gtlGuessSubmitted || gtl?.guessesSubmitted.includes(myPlayer.id)
  );
  const lockCount = gtl?.guessesSubmitted.length || 0;
  const totalPlayers = room.players.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guess.replace(/\s+/g, ' ').trim();
    if (!trimmed || isPending) return;
    setIsPending(true);
    onGuess(trimmed);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
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
            <Target className="w-3.5 h-3.5" style={{ color: playerColor.hex }} />
            <span>Guess the concept</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {lockCount} / {totalPlayers} Locked In
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Guessing Deadline"
          />
        )}
      </div>

      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-6 rounded-3xl my-auto"
        style={{ boxShadow: `0 8px 24px ${playerColor.hex}15` }}
      >
        <div className="text-center mb-4">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block mb-1">
            The Hidden Concept
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
            What single concept links every response?
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {gtl?.category && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                {gtl.category}
              </span>
            )}
            {gtl?.conceptWordCount ? (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                {gtl.conceptWordCount} {gtl.conceptWordCount === 1 ? 'word' : 'words'}
              </span>
            ) : null}
            {gtl?.hintsDealt ? (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Shuffle className="w-3 h-3" />
                <span>{gtl.hintsDealt} different angles</span>
              </span>
            ) : null}
          </div>
        </div>

        {hasGuessed ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span className="text-base font-black text-emerald-800 dark:text-emerald-200">
              Guess Locked In!
            </span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              "{privateState.gtlGuessText || guess}"
            </p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Nobody sees anyone's guess until the concept is revealed
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={MAX_GUESS_CHARS}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Your guess at the concept..."
                className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] text-center tracking-wide focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
                autoFocus
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-1">
                <span>Close spellings count</span>
                <span>
                  {guess.length}/{MAX_GUESS_CHARS}
                </span>
              </div>
            </div>

            <ActionButton
              type="submit"
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              disabled={!guess.trim()}
              loading={isPending && !hasGuessed}
              loadingText="Locking in guess..."
              icon={<Lock className="w-5 h-5" />}
              subtext="Private until the reveal"
            >
              Lock In Guess
            </ActionButton>
          </form>
        )}

        {/* Lock-in tracker */}
        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 block mb-2 text-left">
            Who has guessed:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {room.players.map((p) => {
              const locked = Boolean(gtl?.guessesSubmitted.includes(p.id));
              return (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  isYou={p.id === myPlayer.id}
                  status={locked ? 'submitted' : 'idle'}
                  size="sm"
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>One point for every player who names the link.</span>
        </div>
      </motion.div>

      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: Reveal the concept now
          </button>
        </div>
      )}
    </div>
  );
}
