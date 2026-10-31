import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle2 } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { getPlayerColor } from '@shared/theme/tokens';

interface InputPhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSubmitAnswer: (answer: string) => void;
  onHostSkip?: () => void;
}

export function InputPhaseScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
  onHostSkip,
}: InputPhaseScreenProps) {
  const [answer, setAnswer] = useState(privateState.submittedAnswer || '');
  const [isPending, setIsPending] = useState(false);
  const hasSubmitted = Boolean(
    privateState.inputSubmitted || room.hasSubmittedInput.includes(myPlayer.id)
  );
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isPending) return;
    setIsPending(true);
    onSubmitAnswer(answer.trim());
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Top Header & Timer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          {/* "It's your turn" highlight using player's own identity color */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black"
            style={{
              backgroundColor: playerColor.hex,
              color: playerColor.contrastText,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-[var(--border-neo)] bg-[#18181B] animate-pulse"
            />
            <span>It’s your turn!</span>
          </div>

          <span className="text-xs font-black opacity-65">
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

      {/* Input Card */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-6 rounded-3xl my-auto bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)]"
      >
        <div className="mb-4">
          <span className="text-xs font-black uppercase tracking-wider opacity-60 block mb-1">
            {privateState.isSpecialRole ? 'Impostor Bluff' : 'One-Word Clue'}
          </span>
          <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
            {privateState.isSpecialRole
              ? 'Bluff with a single plausible word without knowing the secret word!'
              : `Type a one-word clue related to "${privateState.secretWord || 'the word'}"`}
          </h2>
          {privateState.secretHint && (
            <p className="text-xs font-bold opacity-60 mt-1">
              {privateState.secretHint}
            </p>
          )}
        </div>

        {hasSubmitted ? (
          <div className="p-5 rounded-2xl bg-[#86EFAC] text-[#18181B] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 stroke-[3]" />
            <span className="text-base font-black">
              Clue Locked In!
            </span>
            <p className="text-xl font-black">
              "{answer}"
            </p>
            <span className="text-xs font-bold mt-1 opacity-80">
              Clues stay hidden until everyone finishes or timer expires
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={24}
                value={answer}
                onChange={(e) => {
                  const val = e.target.value.replace(/\s+/g, '');
                  setAnswer(val);
                }}
                placeholder={privateState.inputPlaceholder || 'Single word clue...'}
                className="w-full p-4 rounded-2xl border-[2.5px] border-[var(--border-neo)] bg-[var(--surface-card-subtle)] font-black text-lg text-[var(--text-primary)] text-center tracking-wide focus:shadow-[4px_4px_0px_var(--border-neo)] focus:-translate-y-0.5 focus:outline-none transition-all"
                autoFocus
              />
              <div className="flex justify-between text-xs font-bold opacity-60 mt-1.5 px-1">
                <span>Single word only</span>
                <span>{answer.length}/24</span>
              </div>
            </div>

            <ActionButton
              type="submit"
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              disabled={!answer.trim()}
              loading={isPending && !hasSubmitted}
              loadingText="Locking in clue..."
              icon={<Send className="w-5 h-5" />}
              subtext="Held privately until reveal phase"
            >
              Submit One-Word Clue
            </ActionButton>
          </form>
        )}

        {/* Live Submissions Tracker */}
        <div className="mt-6 pt-4 border-t-2 border-[var(--border-neo)]">
          <span className="text-xs font-black opacity-60 block mb-2 text-left">
            Player Status:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {room.players.map((p) => {
              const submitted = room.hasSubmittedInput.includes(p.id);
              return (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  isYou={p.id === myPlayer.id}
                  status={submitted ? 'submitted' : 'idle'}
                  size="sm"
                />
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Host Skip button */}
      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-black opacity-60 hover:opacity-100 cursor-pointer underline underline-offset-4"
          >
            Host: Skip to reveal phase immediately
          </button>
        </div>
      )}
    </div>
  );
}
