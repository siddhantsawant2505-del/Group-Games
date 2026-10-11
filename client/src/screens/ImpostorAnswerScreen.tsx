import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Hash, Lock, MousePointerClick, PenLine } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';

interface ImpostorAnswerScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSubmitAnswer: (answer: string) => void;
  onHostSkip?: () => void;
}

const MAX_ANSWER_CHARS = 40;
const MAX_ANSWER_WORDS = 4;

/** Keeps a free-text answer inside the server's limits while typing. */
function clampAnswer(value: string): string {
  const words = value.replace(/\s+/g, ' ').trimStart().split(' ').filter(Boolean);
  return words.slice(0, MAX_ANSWER_WORDS).join(' ').slice(0, MAX_ANSWER_CHARS);
}

/**
 * Impostor question mode — answer phase.
 *
 * One screen, four answer types: a player grid, a short text answer, a number,
 * or one of the shared options. The player's own question stays on screen the
 * whole time.
 */
export function ImpostorAnswerScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
  onHostSkip,
}: ImpostorAnswerScreenProps) {
  const answerType = privateState.impostorAnswerType || room.impostorQuestionState?.answerType || 'text';
  const question = privateState.impostorQuestion || '';
  const choices = privateState.impostorChoices || room.impostorQuestionState?.choices || [];
  const numberRange = privateState.impostorNumberRange || room.impostorQuestionState?.numberRange;

  const [text, setText] = useState('');
  const [numberText, setNumberText] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const hasSubmitted = Boolean(
    privateState.impostorAnswerSubmitted ||
      privateState.inputSubmitted ||
      room.hasSubmittedInput.includes(myPlayer.id)
  );

  const answeredCount = room.hasSubmittedInput.length;
  const totalPlayers = room.impostorQuestionState?.totalPlayers || room.players.length;
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const parseNumber = (): number | null => {
    if (!numberText.trim()) return null;
    const parsed = Number(numberText.trim());
    if (!Number.isFinite(parsed)) return null;
    const rounded = Math.round(parsed);
    if (numberRange && (rounded < numberRange.min || rounded > numberRange.max)) return null;
    return rounded;
  };

  const canSubmit = (() => {
    if (hasSubmitted || isPending) return false;
    switch (answerType) {
      case 'player':
        return Boolean(selectedPlayerId);
      case 'number':
        return parseNumber() !== null;
      case 'choice':
        return Boolean(choice);
      default:
        return clampAnswer(text).trim().length > 0;
    }
  })();

  const submit = () => {
    if (!canSubmit) return;
    setIsPending(true);
    if (answerType === 'player' && selectedPlayerId) onSubmitAnswer(selectedPlayerId);
    else if (answerType === 'number') onSubmitAnswer(String(parseNumber()));
    else if (answerType === 'choice' && choice) onSubmitAnswer(choice);
    else onSubmitAnswer(clampAnswer(text).trim());
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="text-center mb-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black mb-1"
            style={{
              backgroundColor: `${playerColor.hex}18`,
              borderColor: playerColor.hex,
              color: 'var(--text-primary)',
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: playerColor.hex }} />
            <span>Your Answer</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">Answer Your Question</h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {answeredCount} of {totalPlayers} answers locked in
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Answer Deadline"
          />
        )}
      </div>

      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-5 rounded-3xl my-auto space-y-4"
      >
        {/* The player's own question stays visible for the whole phase. */}
        <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/70 border border-[var(--border-subtle)]">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-0.5">
            Your question
          </span>
          <p className="text-sm font-black text-[var(--text-primary)] leading-snug">“{question}”</p>
        </div>

        {/* Player answer: tap a player chip (yourself is allowed) */}
        {answerType === 'player' && (
          <div className="space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1">
              <MousePointerClick className="w-3 h-3" /> Tap a player
            </span>
            <div className="grid grid-cols-1 gap-2 max-h-[38vh] overflow-y-auto pr-1">
              {room.players.map((p) => {
                const isSelected = selectedPlayerId === p.id;
                const targetColor = getPlayerColor(p.colorIndex);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => !hasSubmitted && setSelectedPlayerId(p.id)}
                    className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left ${
                      hasSubmitted ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'
                    } ${
                      isSelected
                        ? 'bg-neutral-50 dark:bg-neutral-800/90 shadow-md'
                        : 'bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                    style={{
                      borderColor: isSelected ? targetColor.hex : 'var(--border-subtle)',
                      boxShadow: isSelected ? `0 4px 16px ${targetColor.hex}25` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        name={p.name}
                        colorIndex={p.colorIndex}
                        size="sm"
                        isHost={p.isHost}
                      />
                      <span className="font-black text-sm text-[var(--text-primary)] block truncate">
                        {p.name}
                        {p.id === myPlayer.id && ' (You)'}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: targetColor.hex }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Text answer */}
        {answerType === 'text' && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1 mb-1">
              <PenLine className="w-3 h-3" /> Short answer
            </span>
            <input
              type="text"
              value={text}
              disabled={hasSubmitted}
              onChange={(event) => setText(clampAnswer(event.target.value))}
              placeholder={privateState.inputPlaceholder || 'A short answer...'}
              aria-label="Your answer"
              className="w-full px-3 py-3 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-sm text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-semibold text-neutral-400">
                Max {MAX_ANSWER_WORDS} words
              </span>
              <span className="text-[10px] font-bold text-neutral-400">
                {text.length}/{MAX_ANSWER_CHARS}
              </span>
            </div>
          </div>
        )}

        {/* Number answer */}
        {answerType === 'number' && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1 mb-1">
              <Hash className="w-3 h-3" /> Your number
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={numberText}
              disabled={hasSubmitted}
              onChange={(event) => setNumberText(event.target.value)}
              placeholder={numberRange ? `${numberRange.min} - ${numberRange.max}` : 'Type a number'}
              aria-label="Your number"
              className="w-full px-3 py-3 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-lg text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
            />
            {numberRange && (
              <p className="text-[10px] font-semibold text-neutral-400 mt-1">
                Any whole number from {numberRange.min} to {numberRange.max}.
              </p>
            )}
            {numberText.trim() && parseNumber() === null && (
              <p className="text-[10px] font-bold text-red-500 mt-1">
                Enter a whole number in range.
              </p>
            )}
          </div>
        )}

        {/* Choice answer */}
        {answerType === 'choice' && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
              Pick one
            </span>
            <div className="grid grid-cols-1 gap-2">
              {choices.map((option) => {
                const isSelected = choice === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => !hasSubmitted && setChoice(option)}
                    className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm font-black text-left transition-all ${
                      hasSubmitted ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'
                    } ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lock-in / submit */}
        {hasSubmitted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3 text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <span className="text-sm font-black block">Answer locked in!</span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Everyone sees it on the answer board.
              </span>
            </div>
          </motion.div>
        ) : (
          <ActionButton
            variant="personal"
            playerColorIndex={myPlayer.colorIndex}
            disabled={!canSubmit}
            loading={isPending && !hasSubmitted}
            loadingText="Locking in..."
            onClick={submit}
            icon={<Lock className="w-5 h-5" />}
            subtext={
              answerType === 'player'
                ? 'Tap a player above to answer'
                : answerType === 'number'
                ? 'Enter a number in range'
                : answerType === 'choice'
                ? 'Pick an option above'
                : 'Keep it short and honest'
            }
          >
            Lock In Answer
          </ActionButton>
        )}
      </motion.div>

      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: Skip to the answer board
          </button>
        </div>
      )}
    </div>
  );
}
