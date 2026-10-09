import { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Sparkles, Link2, CheckCircle2 } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { PARTY_GAMES } from '@shared/data/games';
import {
  GTL_MAX_CATEGORY_CHARS,
  GTL_MAX_CONCEPT_CHARS,
  GTL_MAX_HINTS,
  GTL_MAX_HINT_CHARS,
  GTL_MIN_CUSTOM_HINTS,
} from '@shared/data/guessTheLinkPrompts';
import { GameCard } from '../components/GameCard';
import { ActionButton } from '../components/ActionButton';

const GTL_GAME_ID = 'guess-the-link';

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

interface GameSelectScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSelectGame: (gameId: string) => void;
  onConfirmAndStart: () => void;
  /** Guess the Link only: host saves a custom concept (blank payload clears it). */
  onSaveGtlPrompt?: (
    input: { concept: string; category?: string; hints?: string[] },
    callback: (res: { success: boolean; error?: string; prompt?: { concept: string; category: string; hints: string[] } | null }) => void
  ) => void;
}

export function GameSelectScreen({
  room,
  myPlayer,
  onSelectGame,
  onConfirmAndStart,
  onSaveGtlPrompt,
}: GameSelectScreenProps) {
  const isHost = myPlayer.isHost;
  const currentSelectedId = room.selectedGame?.id || PARTY_GAMES[0].id;
  const [localSelectedId, setLocalSelectedId] = useState(currentSelectedId);

  // Host-authored Guess the Link concept draft
  const [draft, setDraft] = useState<GtlPromptDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);

  const handleSelect = (gameId: string) => {
    setLocalSelectedId(gameId);
    if (isHost) {
      if (gameId !== GTL_GAME_ID) {
        // Server drops any queued concept when another game is picked.
        setDraft(EMPTY_DRAFT);
        setStatus(null);
      }
      onSelectGame(gameId);
    }
  };

  const selectedGame =
    PARTY_GAMES.find((g) => g.id === (isHost ? localSelectedId : currentSelectedId)) ||
    PARTY_GAMES[0];
  const isGtlSelected = (isHost ? localSelectedId : currentSelectedId) === GTL_GAME_ID;

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
            // Echo the server-normalized values back into the form.
            setDraft({
              concept: normalized.concept,
              category: normalized.category === 'Custom Round' ? '' : normalized.category,
              hints: [
                ...normalized.hints,
                ...Array(GTL_MAX_HINTS).fill(''),
              ].slice(0, GTL_MAX_HINTS),
            });
            setStatus({
              kind: 'saved',
              message: 'Custom concept saved — it fuels the next round.',
            });
          } else {
            setDraft(EMPTY_DRAFT);
            setStatus({
              kind: 'saved',
              message: 'Using the built-in deck of concepts.',
            });
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
        setStatus({
          kind: 'error',
          message: res?.error || 'Could not update. Try again.',
        });
      }
    });
  };

  const filledHints = draft.hints.filter((h) => h.trim()).length;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Party Game Collection</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            Select Game
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
            {isHost
              ? 'Tap a game card to pick the round format'
              : 'Host is selecting the game...'}
          </p>
        </div>

        {/* Game cards grid */}
        <div className="space-y-3 pb-4">
          {PARTY_GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              selected={
                (isHost ? localSelectedId : currentSelectedId) === game.id
              }
              onSelect={() => handleSelect(game.id)}
              isHost={isHost}
            />
          ))}
        </div>

        {/* Guess the Link: host-authored concept */}
        {isGtlSelected && isHost && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="party-card p-4 rounded-2xl mb-4"
          >
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
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, concept: e.target.value }));
                    setStatus(null);
                  }}
                  placeholder="e.g. Lighthouse"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-sm text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-neutral-400 block mt-0.5 text-right">
                  {draft.concept.length}/{GTL_MAX_CONCEPT_CHARS} · short enough that everyone can type it as a guess
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
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, category: e.target.value }));
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
                      onChange={(e) => setHint(index, e.target.value)}
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
                <p className="text-xs font-bold text-center text-emerald-600 dark:text-emerald-400" role="status">
                  Custom concept queued for the next round
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Guess the Link: everyone else just sees whether the host wrote one */}
        {isGtlSelected && !isHost && (
          <div className="party-card p-3 rounded-2xl mb-4 text-center">
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {room.gtlCustomReady
                ? 'The host wrote a custom concept for this round!'
                : 'The host can write their own concept — or you’ll play with the built-in deck.'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onConfirmAndStart}
            icon={<Play className="w-5 h-5 fill-current" />}
            subtext={`Launch round with ${selectedGame.title}`}
          >
            Launch Round
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
              Host selected: <strong className="text-[var(--text-primary)]">{selectedGame.title}</strong>
            </span>
            <p className="text-xs text-neutral-400 mt-0.5">
              Get your phone ready for the secret reveal!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
