import { useState } from 'react';
import { CheckCircle2, Link2 } from 'lucide-react';
import { Player, RoomPublicState } from '@shared/types';
import {
  GTL_MAX_CATEGORY_CHARS,
  GTL_MAX_CONCEPT_CHARS,
  GTL_MAX_HINTS,
  GTL_MAX_HINT_CHARS,
  GTL_MIN_CUSTOM_HINTS,
} from '@shared/data/guessTheLinkPrompts';
import { ActionButton } from './ActionButton';

interface GtlPromptDraft {
  concept: string;
  category: string;
  hints: string[];
}

const EMPTY_DRAFT: GtlPromptDraft = {
  concept: '',
  category: '',
  hints: Array(GTL_MAX_HINTS).fill(''),
};

interface GtlCustomPromptPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  /** Host only: saves a custom concept (an all-blank payload clears it). */
  onSaveGtlPrompt?: (
    input: { concept: string; category?: string; hints?: string[] },
    callback: (res: {
      success: boolean;
      error?: string;
      prompt?: { concept: string; category: string; hints: string[] } | null;
    }) => void
  ) => void;
}

/**
 * Guess the Link's host-authored round settings, shown inside the game card's
 * settings sheet. Only visible on the game-select screen, like the other
 * per-game settings.
 */
export function GtlCustomPromptPanel({
  room,
  myPlayer,
  onSaveGtlPrompt,
}: GtlCustomPromptPanelProps) {
  const isHost = myPlayer.isHost;
  const [draft, setDraft] = useState<GtlPromptDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);

  const setHint = (index: number, value: string) => {
    setDraft((prev) => {
      const hints = [...prev.hints];
      hints[index] = value;
      return { ...prev, hints };
    });
    setStatus(null);
  };

  const handleSavePrompt = () => {
    if (saving || !onSaveGtlPrompt) return;
    setSaving(true);
    onSaveGtlPrompt(
      { concept: draft.concept, category: draft.category, hints: draft.hints },
      (res) => {
        setSaving(false);
        if (res?.success) {
          const normalized = res.prompt;
          if (normalized) {
            setDraft({
              concept: normalized.concept,
              category: normalized.category === 'Custom Round' ? '' : normalized.category,
              hints: [...normalized.hints, ...Array(GTL_MAX_HINTS).fill('')].slice(
                0,
                GTL_MAX_HINTS
              ),
            });
            setStatus({
              kind: 'saved',
              message: 'Custom concept saved — it fuels the next round.',
            });
          } else {
            setDraft(EMPTY_DRAFT);
            setStatus({ kind: 'saved', message: 'Using the built-in deck of concepts.' });
          }
        } else {
          setStatus({
            kind: 'error',
            message: res?.error || 'Could not save the concept. Try again.',
          });
        }
      }
    );
  };

  const handleUseDeck = () => {
    if (saving || !onSaveGtlPrompt) return;
    setSaving(true);
    onSaveGtlPrompt({ concept: '', hints: [] }, (res) => {
      setSaving(false);
      if (res?.success) {
        setDraft(EMPTY_DRAFT);
        setStatus({ kind: 'saved', message: 'Using the built-in deck of concepts.' });
      } else {
        setStatus({ kind: 'error', message: res?.error || 'Could not update. Try again.' });
      }
    });
  };

  const filledHints = draft.hints.filter((hint) => hint.trim()).length;

  // Read-only view for everyone else: the concept itself never leaves the host.
  if (!isHost) {
    return (
      <div className="party-card p-4 rounded-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4" />
          </div>
          <span className="text-sm font-black text-[var(--text-primary)]">Round concept</span>
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)]">
          {room.gtlCustomReady
            ? 'The host wrote a custom concept for this round!'
            : 'The host can write their own concept — otherwise you play the built-in deck.'}
        </p>
      </div>
    );
  }

  return (
    <div className="party-card p-4 rounded-2xl">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
            Write your own round
          </span>
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            Optional — leave it blank and we deal from the built-in deck
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Hidden concept *
          </span>
          <input
            type="text"
            maxLength={GTL_MAX_CONCEPT_CHARS}
            value={draft.concept}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, concept: event.target.value }));
              setStatus(null);
            }}
            placeholder="e.g. Lighthouse"
            className="w-full px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-sm text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
          />
          <span className="text-[10px] text-neutral-400 block mt-0.5 text-right">
            {draft.concept.length}/{GTL_MAX_CONCEPT_CHARS} · short enough that everyone can type it
          </span>
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Category (optional)
          </span>
          <input
            type="text"
            maxLength={GTL_MAX_CATEGORY_CHARS}
            value={draft.category}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, category: event.target.value }));
              setStatus(null);
            }}
            placeholder="e.g. Places"
            className="w-full px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-sm text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
          />
        </label>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
              Hint angles
            </span>
            <span className="text-[10px] font-bold text-neutral-400">
              {filledHints}/{GTL_MAX_HINTS} filled · min {GTL_MIN_CUSTOM_HINTS}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {draft.hints.map((hint, index) => (
              <input
                key={index}
                type="text"
                maxLength={GTL_MAX_HINT_CHARS}
                value={hint}
                onChange={(event) => setHint(index, event.target.value)}
                placeholder={`Angle ${index + 1}`}
                aria-label={`Hint angle ${index + 1}`}
                className="w-full px-2.5 py-2 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-xs text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
              />
            ))}
          </div>
          <p className="text-[10px] font-semibold text-neutral-400 mt-1">
            Every player gets a different angle — nobody sees the concept. Rooms bigger than{' '}
            {GTL_MAX_HINTS} reuse them.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <ActionButton
          variant="personal"
          playerColorIndex={myPlayer.colorIndex}
          onClick={handleSavePrompt}
          disabled={!draft.concept.trim()}
          loading={saving}
          loadingText="Saving..."
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext={
            draft.concept.trim()
              ? 'Used for the next round, deck afterwards'
              : 'Type a concept to save it'
          }
        >
          Save Custom Round
        </ActionButton>

        {room.gtlCustomReady && (
          <button
            type="button"
            onClick={handleUseDeck}
            disabled={saving}
            className="w-full text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer underline underline-offset-2 py-1 disabled:opacity-50"
          >
            Clear it and use the built-in deck
          </button>
        )}

        {status && (
          <p
            className={`text-xs font-bold text-center ${
              status.kind === 'saved'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500'
            }`}
            role="status"
          >
            {status.message}
          </p>
        )}
        {!status && room.gtlCustomReady && (
          <p
            className="text-xs font-bold text-center text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            Custom concept queued for the next round
          </p>
        )}
      </div>
    </div>
  );
}
