import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Settings2, Sparkles } from 'lucide-react';
import {
  RoomPublicState,
  Player,
  ImpostorSettings,
  ContentDifficultySetting,
  IMPOSTOR_MODE_LABELS,
  DIFFICULTY_LABELS,
  TONE_LABELS,
} from '@shared/types';
import { ActionButton } from './ActionButton';

const THEME_MAX_CHARS = 40;

type SettingsPatch = { impostor?: Partial<ImpostorSettings> };
type SaveCallback = (res: { success: boolean; error?: string }) => void;

interface GameSettingsPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSaveGameSettings?: (patch: SettingsPatch, callback: SaveCallback) => void;
  /**
   * Question mode ships behind this flag: while it is false the panel only
   * offers what the server can actually play today.
   */
  questionModeAvailable?: boolean;
}

const DIFFICULTY_HELP: Record<ContentDifficultySetting, string> = {
  easy: 'Everyday words everyone knows',
  medium: 'Less common words',
  any: 'The whole word pool',
};

export function GameSettingsPanel({
  room,
  myPlayer,
  onSaveGameSettings,
  questionModeAvailable = false,
}: GameSettingsPanelProps) {
  const isHost = myPlayer.isHost;
  const settings = room.gameSettings.impostor;
  const [themeDraft, setThemeDraft] = useState(settings.theme || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);

  const emit = (patch: SettingsPatch, onDone?: SaveCallback) => {
    if (!onSaveGameSettings) {
      onDone?.({ success: false, error: 'Settings are unavailable right now.' });
      return;
    }
    onSaveGameSettings(patch, (res) => {
      onDone?.(res);
    });
  };

  const handleDifficulty = (difficulty: ContentDifficultySetting) => {
    if (!isHost || difficulty === settings.difficulty) return;
    setStatus(null);
    emit({ impostor: { difficulty } }, (res) => {
      if (!res.success) setStatus({ kind: 'error', message: res.error || 'Could not save.' });
    });
  };

  const handleMode = (mode: ImpostorSettings['mode']) => {
    if (!isHost || mode === settings.mode) return;
    setStatus(null);
    emit({ impostor: { mode } }, (res) => {
      if (!res.success) setStatus({ kind: 'error', message: res.error || 'Could not save.' });
    });
  };

  const handleTone = (tone: ImpostorSettings['tone']) => {
    if (!isHost || tone === settings.tone) return;
    setStatus(null);
    emit({ impostor: { tone } }, (res) => {
      if (!res.success) setStatus({ kind: 'error', message: res.error || 'Could not save.' });
    });
  };

  const handleSaveTheme = () => {
    if (!isHost || saving) return;
    setSaving(true);
    setStatus(null);
    emit({ impostor: { theme: themeDraft.trim() } }, (res) => {
      setSaving(false);
      setStatus(
        res.success
          ? {
              kind: 'saved',
              message: themeDraft.trim()
                ? 'Custom theme saved — fresh words arrive for the next round.'
                : 'Theme cleared — back to the everyday word pool.',
            }
          : { kind: 'error', message: res.error || 'Could not save the theme.' }
      );
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="party-card p-4 rounded-2xl mb-4"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
          <Settings2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
            Impostor Settings
          </span>
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {isHost ? 'Applied to the next round' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {/* Mode */}
      {questionModeAvailable ? (
        <div className="mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Mode
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['word', 'question'] as const).map((mode) => {
              const active = settings.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleMode(mode)}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                    isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                  } ${
                    active
                      ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {IMPOSTOR_MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] font-semibold text-neutral-400 mt-1">
            {settings.mode === 'word'
              ? 'Everyone hunts a secret word; the impostor bluffs a clue.'
              : 'The table answers questions — one player was asked a different one.'}
          </p>
        </div>
      ) : (
        <div className="mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Mode
          </span>
          <p className="text-xs font-bold text-[var(--text-primary)]">
            {IMPOSTOR_MODE_LABELS[settings.mode]}
            <span className="font-semibold text-neutral-400"> · secret word round</span>
          </p>
        </div>
      )}

      {/* Difficulty (word mode) */}
      <div className="mb-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
          Difficulty
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(['easy', 'medium', 'any'] as const).map((difficulty) => {
            const active = settings.difficulty === difficulty;
            return (
              <button
                key={difficulty}
                type="button"
                disabled={!isHost}
                onClick={() => handleDifficulty(difficulty)}
                className={`px-2 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                } ${
                  active
                    ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {DIFFICULTY_LABELS[difficulty]}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-semibold text-neutral-400 mt-1">
          {DIFFICULTY_HELP[settings.difficulty]}
        </p>
      </div>

      {/* Tone (question mode only) */}
      {questionModeAvailable && settings.mode === 'question' && (
        <div className="mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Tone
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['clean', 'spicy'] as const).map((tone) => {
              const active = settings.tone === tone;
              return (
                <button
                  key={tone}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleTone(tone)}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                    isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                  } ${
                    active
                      ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {TONE_LABELS[tone]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] font-semibold text-neutral-400 mt-1">
            Spicy stays mild — cheekier questions, never rude ones.
          </p>
        </div>
      )}

      {/* Custom theme: only offered when the server has a working AI provider */}
      {room.aiContentAvailable && settings.mode === 'word' && (
        <div className="mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Custom theme {isHost ? '(optional)' : ''}
          </span>
          {isHost ? (
            <>
              <input
                type="text"
                maxLength={THEME_MAX_CHARS}
                value={themeDraft}
                onChange={(event) => {
                  setThemeDraft(event.target.value);
                  setStatus(null);
                }}
                placeholder="e.g. Space station, Bakery, Jungle"
                aria-label="Custom word theme"
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-sm text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-semibold text-neutral-400">
                  A topic, not an instruction — words are checked before use
                </span>
                <span className="text-[10px] text-neutral-400 font-bold">
                  {themeDraft.length}/{THEME_MAX_CHARS}
                </span>
              </div>
              <div className="mt-2">
                <ActionButton
                  variant="personal"
                  playerColorIndex={myPlayer.colorIndex}
                  onClick={handleSaveTheme}
                  loading={saving}
                  loadingText="Saving..."
                  disabled={themeDraft.trim() === (settings.theme || '')}
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  subtext={
                    themeDraft.trim() === (settings.theme || '')
                      ? 'Theme already applied'
                      : 'Used for the next round'
                  }
                >
                  Save Theme
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {settings.theme ? `“${settings.theme}”` : 'All-purpose everyday words'}
            </p>
          )}
        </div>
      )}

      {!room.aiContentAvailable && (
        <p className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
          Custom themes and AI-written extras need a GEMINI_API_KEY on the server — the bundled
          word pool is being used.
        </p>
      )}

      {!isHost && (
        <p className="text-[10px] font-semibold text-neutral-400 mt-2">
          The host can change these between rounds.
        </p>
      )}

      {status && (
        <p
          role="status"
          className={`text-xs font-bold text-center mt-2 ${
            status.kind === 'saved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
          }`}
        >
          {status.message}
        </p>
      )}
    </motion.div>
  );
}
