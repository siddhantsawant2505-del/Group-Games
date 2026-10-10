import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Lightbulb, Send } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { getPlayerColor } from '@shared/theme/tokens';

interface RevCatInputScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSubmitAnswer: (answer: string) => void;
  onHostSkip?: () => void;
}

/** Mirrors the server caps (6 words / 48 characters). */
const MAX_CATEGORY_CHARS = 48;
const MAX_CATEGORY_WORDS = 6;

const ITEM_COLOR_INDEXES = [1, 2, 4];

/**
 * Reverse Categories — Category Submission.
 * One invented category name linking the three public items, held privately
 * until the whole board is revealed.
 */
export function RevCatInputScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
  onHostSkip,
}: RevCatInputScreenProps) {
  const [category, setCategory] = useState(privateState.revCatCategoryText || '');
  const [isPending, setIsPending] = useState(false);

  const revCat = room.revCatState;
  const items = revCat?.items || privateState.revCatItems || [];
  const hasSubmitted = Boolean(
    privateState.revCatCategorySubmitted || room.hasSubmittedInput.includes(myPlayer.id)
  );
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const cleaned = category.replace(/\s+/g, ' ').trim();
  const wordCount = cleaned ? cleaned.split(' ').length : 0;
  const tooManyWords = wordCount > MAX_CATEGORY_WORDS;

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
            <span>Your category is private</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {room.hasSubmittedInput.length} / {room.players.length} Submitted
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Time to Invent"
          />
        )}
      </div>

      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-6 rounded-3xl my-auto"
        style={{ boxShadow: `0 8px 24px ${playerColor.hex}15` }}
      >
        {/* Items reminder */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
          {items.map((item, index) => {
            const color = getPlayerColor(ITEM_COLOR_INDEXES[index % ITEM_COLOR_INDEXES.length]);
            return (
              <span
                key={item}
                className="px-2.5 py-1 rounded-xl text-[11px] font-black border"
                style={{ backgroundColor: `${color.hex}14`, borderColor: `${color.hex}55`, color: 'var(--text-primary)' }}
              >
                {item}
              </span>
            );
          })}
        </div>

        <div className="mb-4 text-center">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block mb-1">
            Your Category
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
            What is the category that links them?
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
            Everyone sees your category at the reveal — but not until then.
          </p>
        </div>

        {hasSubmitted ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span className="text-base font-black text-emerald-800 dark:text-emerald-200">
              Category Locked In!
            </span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              “{privateState.revCatCategoryText || category}”
            </p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Held privately until the category board opens
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={MAX_CATEGORY_CHARS}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={privateState.inputPlaceholder || 'Invent a category name...'}
                className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] text-center tracking-wide focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
                autoFocus
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-1">
                <span>
                  Up to {MAX_CATEGORY_WORDS} words
                  {tooManyWords ? ' — too many!' : ''}
                </span>
                <span>
                  {category.length}/{MAX_CATEGORY_CHARS}
                </span>
              </div>
            </div>

            <ActionButton
              type="submit"
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              disabled={!cleaned || tooManyWords}
              loading={isPending && !hasSubmitted}
              loadingText="Locking in category..."
              icon={<Send className="w-5 h-5" />}
              subtext="Private until the board reveals everyone's"
            >
              Submit Category
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
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Same three items for everyone — the fun is in the link.</span>
        </div>
      </motion.div>

      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: Show the category board now
          </button>
        </div>
      )}
    </div>
  );
}
