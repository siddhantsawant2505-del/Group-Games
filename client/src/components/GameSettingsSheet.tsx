import { Settings, Sparkles } from 'lucide-react';
import { GameMetadata, ImpostorSettings, Player, RoomPublicState } from '@shared/types';
import { GameSettingsPanel } from './GameSettingsPanel';
import { GtlCustomPromptPanel } from './GtlCustomPromptPanel';
import { SettingsSheet } from './SettingsSheet';
import { TeamSupportBadge } from './TeamSupportBadge';

type SettingsPatch = { impostor?: Partial<ImpostorSettings> };

interface GameSettingsSheetProps {
  game: GameMetadata | null;
  open: boolean;
  room: RoomPublicState;
  myPlayer: Player;
  onClose: () => void;
  onSaveGameSettings?: (
    patch: SettingsPatch,
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  onSaveGtlPrompt?: (
    input: { concept: string; category?: string; hints?: string[] },
    callback: (res: {
      success: boolean;
      error?: string;
      prompt?: { concept: string; category: string; hints: string[] } | null;
    }) => void
  ) => void;
}

/** Impostor ships two modes: secret-word rounds and question rounds. */
const QUESTION_MODE_AVAILABLE = true;

/**
 * Settings for one game, opened from the gear on that game's card, so each game
 * keeps its own options instead of one shared panel at the bottom of the list.
 */
export function GameSettingsSheet({
  game,
  open,
  room,
  myPlayer,
  onClose,
  onSaveGameSettings,
  onSaveGtlPrompt,
}: GameSettingsSheetProps) {
  const isHost = myPlayer.isHost;

  const body = (() => {
    if (!game) return null;

    if (game.id === 'impostor') {
      return (
        <GameSettingsPanel
          room={room}
          myPlayer={myPlayer}
          onSaveGameSettings={onSaveGameSettings}
          questionModeAvailable={QUESTION_MODE_AVAILABLE}
        />
      );
    }

    if (game.id === 'guess-the-link') {
      return (
        <GtlCustomPromptPanel
          room={room}
          myPlayer={myPlayer}
          onSaveGtlPrompt={onSaveGtlPrompt}
        />
      );
    }

    return (
      <div className="party-card p-4 rounded-2xl space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-neutral-500/15 text-neutral-500 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
              No extra settings yet
            </span>
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {game.title} always deals the same way — set the room mode and team split instead.
            </p>
          </div>
        </div>

        <ul className="text-xs space-y-1 text-neutral-600 dark:text-neutral-300">
          {game.rules.map((rule, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span className="text-neutral-400">•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  })();

  return (
    <SettingsSheet
      open={open}
      onClose={onClose}
      title={game ? `${game.title} settings` : 'Game settings'}
      subtitle={isHost ? 'Applied to the next round' : 'Chosen by the host'}
    >
      <div className="space-y-3">
        {game && (
          <div className="flex flex-wrap items-center gap-2">
            <TeamSupportBadge game={game} size="md" />
            <span className="text-[10px] font-semibold text-neutral-400">
              {game.minPlayers}-{game.maxPlayers} players
            </span>
          </div>
        )}

        {room.playMode === 'team' && game && (
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Team mode is on: every point you earn here is also added to your team’s total.
            </span>
          </p>
        )}

        {body}
      </div>
    </SettingsSheet>
  );
}
