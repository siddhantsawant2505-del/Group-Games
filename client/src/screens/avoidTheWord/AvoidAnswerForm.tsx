import React, { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { AvoidAnswerType, Player } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { PlayerChip } from '../../components/PlayerChip';
import { getPlayerColor } from '@shared/theme/tokens';

/** Mirrors the server's text-answer limits (3 words / 30 characters). */
export const MAX_ANSWER_WORDS = 3;
export const MAX_ANSWER_CHARS = 30;

interface AvoidAnswerFormProps {
  answerType: AvoidAnswerType;
  question?: string;
  choices?: string[];
  numberRange?: { min: number; max: number };
  /** Alive players for 'player' questions. */
  eligiblePlayers: Player[];
  myPlayerId: string;
  myColorIndex: number;
  submitLabel: string;
  submitSubtext?: string;
  onSubmit: (raw: string, targetPlayerId?: string) => void;
}

/**
 * Avoid the Word — the input widget, shaped by the question's answer type.
 * Shared by the anchor's window and every turn window so the two stay identical.
 */
export function AvoidAnswerForm({
  answerType,
  question,
  choices,
  numberRange,
  eligiblePlayers,
  myPlayerId,
  myColorIndex,
  submitLabel,
  submitSubtext,
  onSubmit,
}: AvoidAnswerFormProps) {
  const [text, setText] = useState('');
  const [numberValue, setNumberValue] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const playerColor = getPlayerColor(myColorIndex);

  const trimmedText = useMemo(
    () => text.replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER_CHARS),
    [text]
  );
  const wordCount = trimmedText ? trimmedText.split(' ').length : 0;

  const parsedNumber = numberValue.trim() === '' ? null : Number(numberValue.trim());
  const numberValid =
    parsedNumber !== null &&
    Number.isInteger(parsedNumber) &&
    (answerType !== 'number' ||
      !numberRange ||
      (parsedNumber >= numberRange.min && parsedNumber <= numberRange.max));

  const canSubmit =
    !pending &&
    ((answerType === 'text' && trimmedText.length > 0 && wordCount <= MAX_ANSWER_WORDS) ||
      (answerType === 'number' && numberValid) ||
      (answerType === 'choice' && Boolean(choice)) ||
      (answerType === 'player' && Boolean(targetId)));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);

    if (answerType === 'player') {
      onSubmit(targetId as string, targetId as string);
      return;
    }
    if (answerType === 'choice') {
      onSubmit(choice as string);
      return;
    }
    if (answerType === 'number') {
      onSubmit(String(parsedNumber));
      return;
    }
    onSubmit(trimmedText);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {question && (
        <div
          className="p-3 rounded-2xl text-left"
          style={{ backgroundColor: `${playerColor.hex}12` }}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
            The question
          </span>
          <p className="text-base font-black text-[var(--text-primary)] leading-snug">{question}</p>
        </div>
      )}

      {answerType === 'text' && (
        <div>
          <input
            type="text"
            maxLength={MAX_ANSWER_CHARS}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Your answer..."
            autoFocus
            className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] text-center tracking-wide focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
          />
          <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-1">
            <span>
              Up to {MAX_ANSWER_WORDS} words
              {wordCount > MAX_ANSWER_WORDS ? ' — keeping the first 3' : ''}
            </span>
            <span>
              {trimmedText.length}/{MAX_ANSWER_CHARS}
            </span>
          </div>
        </div>
      )}

      {answerType === 'number' && (
        <div>
          <input
            type="number"
            inputMode="numeric"
            value={numberValue}
            min={numberRange?.min}
            max={numberRange?.max}
            onChange={(event) => setNumberValue(event.target.value)}
            placeholder={numberRange ? `${numberRange.min}–${numberRange.max}` : 'Your number'}
            autoFocus
            className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-2xl text-center text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
          />
          <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-1">
            <span>
              {numberRange
                ? `Pick between ${numberRange.min} and ${numberRange.max}`
                : 'Whole numbers only'}
            </span>
            {numberValue.trim() !== '' && !numberValid && (
              <span className="text-red-500 font-bold">Outside the range</span>
            )}
          </div>
        </div>
      )}

      {answerType === 'choice' && (
        <div className="grid grid-cols-2 gap-2">
          {(choices || []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setChoice(option)}
              aria-pressed={choice === option}
              className={`min-h-[48px] px-3 py-2.5 rounded-2xl border-2 text-sm font-black transition-colors cursor-pointer ${
                choice === option
                  ? 'border-transparent text-white'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-neutral-400'
              }`}
              style={choice === option ? { backgroundColor: playerColor.hex } : undefined}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {answerType === 'player' && (
        <div className="flex flex-wrap gap-2">
          {eligiblePlayers.map((player) => (
            <PlayerChip
              key={player.id}
              name={player.name}
              colorIndex={player.colorIndex}
              isYou={player.id === myPlayerId}
              size="md"
              selectable
              selected={targetId === player.id}
              onClick={() => setTargetId(player.id)}
            />
          ))}
        </div>
      )}

      <ActionButton
        type="submit"
        variant="personal"
        playerColorIndex={myColorIndex}
        disabled={!canSubmit}
        loading={pending}
        loadingText="Locking in..."
        icon={<Send className="w-5 h-5" />}
        subtext={submitSubtext}
      >
        {submitLabel}
      </ActionButton>
    </form>
  );
}
