import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle2, Hash, Gauge } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { SpectrumBar } from '../components/SpectrumBar';
import { getPlayerColor } from '@shared/theme/tokens';

interface Top100InputScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSubmitAnswer: (answer: string) => void;
  onHostSkip?: () => void;
}

/** Mirrors the server caps (9 words / 72 characters). */
const MAX_EXAMPLE_CHARS = 72;
const MAX_EXAMPLE_WORDS = 9;

/**
 * Top 100 — Example Submission.
 * A short scenario the player believes belongs at their own secret number.
 */
export function Top100InputScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
  onHostSkip,
}: Top100InputScreenProps) {
  const [example, setExample] = useState(privateState.top100ExampleText || '');
  const [isPending, setIsPending] = useState(false);

  const top100 = room.top100State;
  const hasSubmitted = Boolean(
    privateState.top100ExampleSubmitted || room.hasSubmittedInput.includes(myPlayer.id)
  );
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const myNumber = privateState.top100Number ?? 0;

  const cleaned = example.replace(/\s+/g, ' ').trim();
  const wordCount = cleaned ? cleaned.split(' ').length : 0;
  const tooManyWords = wordCount > MAX_EXAMPLE_WORDS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleaned || tooManyWords || isPending) return;
    setIsPending(true);
    onSubmitAnswer(cleaned);
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
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: playerColor.hex }}
            />
            <span>Your number is private</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {room.hasSubmittedInput.length} / {room.players.length} Submitted
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Time to Write"
          />
        )}
      </div>

      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-6 rounded-3xl my-auto"
        style={{ boxShadow: `0 8px 24px ${playerColor.hex}15` }}
      >
        {/* Number + spectrum reminder */}
        <div
          className="p-3 rounded-2xl mb-4"
          style={{ backgroundColor: `${playerColor.hex}12` }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Hash className="w-4 h-4 shrink-0" style={{ color: playerColor.hex }} />
            <div className="text-left min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                Your secret number
              </span>
              <span className="text-lg font-black text-[var(--text-primary)] leading-none">
                {myNumber || '—'}
                <span className="text-xs font-bold text-neutral-400"> / 100</span>
              </span>
            </div>
            {(privateState.top100Category || top100?.category) && (
              <span className="ml-auto shrink-0 text-[10px] font-black px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                {privateState.top100Category || top100?.category}
              </span>
            )}
          </div>

          <SpectrumBar
            lowLabel={privateState.top100LowLabel || top100?.lowLabel || 'low'}
            highLabel={privateState.top100HighLabel || top100?.highLabel || 'high'}
            markers={[{ value: myNumber || 1, colorHex: playerColor.hex }]}
            compact
          />
        </div>

        <div className="mb-4">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block mb-1">
            Your Example
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
            Describe something that sits at your number
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
            Everyone sees your example — but never your number.
          </p>
        </div>

        {hasSubmitted ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span className="text-base font-black text-emerald-800 dark:text-emerald-200">
              Example Locked In!
            </span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              “{privateState.top100ExampleText || example}”
            </p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Your number is still secret — the group only reorders the examples
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                rows={3}
                maxLength={MAX_EXAMPLE_CHARS}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder={privateState.inputPlaceholder || 'A short example...'}
                className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-base text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors resize-none"
                autoFocus
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-1">
                <span>
                  Up to {MAX_EXAMPLE_WORDS} words
                  {tooManyWords ? ' — too many!' : ''}
                </span>
                <span>
                  {example.length}/{MAX_EXAMPLE_CHARS}
                </span>
              </div>
            </div>

            <ActionButton
              type="submit"
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              disabled={!cleaned || tooManyWords}
              loading={isPending && !hasSubmitted}
              loadingText="Locking in example..."
              icon={<Send className="w-5 h-5" />}
              subtext="Held privately until the board is revealed"
            >
              Submit Example
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
          <Gauge className="w-3.5 h-3.5" />
          <span>Every player owns a different number from 1 to 100.</span>
        </div>
      </motion.div>

      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: Show the example board now
          </button>
        </div>
      )}
    </div>
  );
}
