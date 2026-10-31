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
  questionModeAvailable?: boolean;
}

const DIFFICULTY_HELP: Record<ContentDifficultySetting, string> = {
  easy: 'Everyday words everyone knows',
  medium: 'Less common words',
  any: 'The whole word pool',
};

const DIFFICULTY_COLORS: Record<ContentDifficultySetting, string> = {
  easy: 'bg-[#86EFAC]',
  medium: 'bg-[#93C5FD]',
  any: 'bg-[#C4B5FD]',
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
      className="bg-white border-[2.5px] border-[var(--border-neo)] shadow-[5px_5px_0px_var(--border-neo)] p-5 rounded-3xl mb-4 space-y-4"
    >
      <div className="flex items-center gap-2.5 pb-2 border-b-2 border-[#18181B]/10">
        <div className="w-10 h-10 rounded-2xl bg-[#FDA4AF] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
          <Settings2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="text-base font-black text-[var(--text-primary)] block leading-tight">
            Impostor Settings
          </span>
          <p className="text-xs font-bold text-[#52525B]">
            {isHost ? 'Applied to the next round' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {/* Mode */}
      {questionModeAvailable ? (
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
            Game Mode
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {(['word', 'question'] as const).map((mode) => {
              const active = settings.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleMode(mode)}
                  className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all ${
                    isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                  } ${
                    active
                      ? 'border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5'
                      : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                  }`}
                >
                  {IMPOSTOR_MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] font-bold text-[#52525B] mt-1.5">
            {settings.mode === 'word'
              ? 'Everyone hunts a secret word; the impostor bluffs a clue.'
              : 'The table answers questions — one player was asked a different one.'}
          </p>
        </div>
      ) : (
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1">
            Game Mode
          </span>
          <p className="text-xs font-black text-[var(--text-primary)]">
            {IMPOSTOR_MODE_LABELS[settings.mode]}
            <span className="font-bold text-[#52525B]"> · secret word round</span>
          </p>
        </div>
      )}

      {/* Difficulty */}
      {settings.mode === 'word' && (
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
            Word Difficulty
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'any'] as const).map((difficulty) => {
              const active = settings.difficulty === difficulty;
              const colorBg = DIFFICULTY_COLORS[difficulty];
              return (
                <button
                  key={difficulty}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleDifficulty(difficulty)}
                  className={`px-2 py-2.5 rounded-2xl text-xs font-black transition-all ${
                    isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                  } ${
                    active
                      ? `border-[2.5px] border-[var(--border-neo)] ${colorBg} text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5`
                      : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                  }`}
                >
                  {DIFFICULTY_LABELS[difficulty]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] font-bold text-[#52525B] mt-1.5">
            {DIFFICULTY_HELP[settings.difficulty]}
          </p>
        </div>
      )}

      {/* Tone */}
      {questionModeAvailable && settings.mode === 'question' && (
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
            Question Tone
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {(['clean', 'spicy'] as const).map((tone) => {
              const active = settings.tone === tone;
              const colorBg = tone === 'clean' ? 'bg-[#86EFAC]' : 'bg-[#FDA4AF]';
              return (
                <button
                  key={tone}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleTone(tone)}
                  className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all ${
                    isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                  } ${
                    active
                      ? `border-[2.5px] border-[var(--border-neo)] ${colorBg} text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5`
                      : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                  }`}
                >
                  {TONE_LABELS[tone]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] font-bold text-[#52525B] mt-1.5">
            Spicy stays mild — cheekier questions, never rude ones.
          </p>
        </div>
      )}

      {/* Custom theme */}
      {room.aiContentAvailable && settings.mode === 'word' && (
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
            Custom Theme {isHost ? '(optional)' : ''}
          </span>
          {isHost ? (
            <div className="space-y-2">
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
                className="w-full px-3.5 py-3 rounded-2xl border-[2.5px] border-[var(--border-neo)] bg-white font-black text-sm text-[var(--text-primary)] shadow-[2.5px_2.5px_0px_var(--border-neo)] focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-none transition-all placeholder:text-neutral-400"
              />
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-[#52525B]">
                  A topic, not an instruction — words are checked before use
                </span>
                <span className="text-[10px] text-[#18181B] font-black">
                  {themeDraft.length}/{THEME_MAX_CHARS}
                </span>
              </div>
              <div>
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
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-[#F3EFEA] border-2 border-[var(--border-neo)] font-black text-xs text-[var(--text-primary)]">
              {settings.theme ? `“${settings.theme}”` : 'All-purpose everyday words'}
            </div>
          )}
        </div>
      )}

      {!room.aiContentAvailable && (
        <div className="p-3 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-[11px] font-black text-[#18181B] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#18181B] shrink-0" />
          <span>
            Custom themes and AI-written extras need a GEMINI_API_KEY — using bundled word pool.
          </span>
        </div>
      )}

      {!isHost && (
        <p className="text-[11px] font-bold text-[#52525B]">
          The host can change these between rounds.
        </p>
      )}

      {status && (
        <div
          role="status"
          className={`p-3 rounded-2xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B] ${
            status.kind === 'saved' ? 'bg-[#86EFAC]' : 'bg-[#FDA4AF]'
          }`}
        >
          {status.message}
        </div>
      )}
    </motion.div>
  );
}
