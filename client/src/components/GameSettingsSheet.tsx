import { Settings, Sparkles } from 'lucide-react';
import {
  AvoidSettings,
  GameMetadata,
  GtlSettings,
  ImpostorSettings,
  MafiaSettings,
  Player,
  RoomPublicState,
  Top100Settings,
} from '@shared/types';
import { AvoidSettingsPanel } from './AvoidSettingsPanel';
import { GameSettingsPanel } from './GameSettingsPanel';
import { GtlSettingsPanel } from './GtlSettingsPanel';
import { MafiaSettingsPanel } from './MafiaSettingsPanel';
import { SettingsSheet } from './SettingsSheet';
import { TeamSupportBadge } from './TeamSupportBadge';
import { Top100SettingsPanel } from './Top100SettingsPanel';

type SettingsPatch = {
  impostor?: Partial<ImpostorSettings>;
  avoidTheWord?: Partial<AvoidSettings>;
  top100?: Partial<Top100Settings>;
  mafia?: Partial<MafiaSettings>;
  guessTheLink?: Partial<GtlSettings>;
};

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

    if (game.id === 'avoid-the-word') {
      return (
        <AvoidSettingsPanel
          room={room}
          myPlayer={myPlayer}
          onSaveGameSettings={onSaveGameSettings}
        />
      );
    }

    if (game.id === 'guess-the-link') {
      return (
        <GtlSettingsPanel
          room={room}
          myPlayer={myPlayer}
          onSaveGameSettings={onSaveGameSettings}
        />
      );
    }

    if (game.id === 'top-100') {
      return (
        <Top100SettingsPanel
          room={room}
          myPlayer={myPlayer}
          onSaveGameSettings={onSaveGameSettings}
        />
      );
    }

    if (game.id === 'mafia') {
      return (
        <MafiaSettingsPanel
          room={room}
          myPlayer={myPlayer}
          onSaveGameSettings={onSaveGameSettings}
        />
      );
    }

    return (
      <div className="bg-white border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] p-4 rounded-3xl space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#93C5FD] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0">
            <Settings className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
              No extra settings yet
            </span>
            <p className="text-[11px] font-bold text-[#52525B]">
              {game.title} always deals the same way — set the room mode and team split instead.
            </p>
          </div>
        </div>

        <ul className="text-xs space-y-1.5 font-bold text-[#18181B]">
          {game.rules.map((rule, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FEF08A] border border-[var(--border-neo)] mt-1.5 shrink-0" />
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
            <span className="px-2.5 py-1 rounded-xl bg-[#F3EFEA] border-2 border-[var(--border-neo)] text-[10px] font-black text-[#18181B]">
              {game.minPlayers}-{game.maxPlayers} players
            </span>
          </div>
        )}

        {room.playMode === 'team' && game && (
          <div className="p-3 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B] flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#18181B] shrink-0 mt-0.5" />
            <span>
              Team mode is on: every point you earn here is also added to your team’s total.
            </span>
          </div>
        )}

        {body}
      </div>
    </SettingsSheet>
  );
}
