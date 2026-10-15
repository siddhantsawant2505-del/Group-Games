import { useState } from 'react';
import { Check, Pencil, Shuffle, Scale, Users2 } from 'lucide-react';
import {
  MAX_ROUNDS,
  MAX_TEAMS,
  MIN_ROUNDS,
  MIN_TEAMS,
  PLAY_MODE_LABELS,
  PlayMode,
  Player,
  RoomPublicState,
  Team,
} from '@shared/types';
import { TEAM_NAME_MAX_CHARS, getTeamStartReadiness } from '@shared/data/teams';
import { getTeamAccent } from '@shared/theme/tokens';
import { PlayerChip } from './PlayerChip';

interface RoomSettingsPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSetPlayMode: (mode: PlayMode) => void;
  onSetTeamCount: (count: number) => void;
  onJoinTeam: (teamId: string) => void;
  onRenameTeam: (teamId: string, name: string) => void;
  onBalanceTeams: (shuffle: boolean) => void;
  onSetRoundCount: (rounds: number) => void;
}

/**
 * Room-wide settings, opened from the gear in the lobby. The play mode and the
 * team list are what every other screen reads, so they live here rather than on
 * a game card.
 */
export function RoomSettingsPanel({
  room,
  myPlayer,
  onSetPlayMode,
  onSetTeamCount,
  onJoinTeam,
  onRenameTeam,
  onBalanceTeams,
  onSetRoundCount,
}: RoomSettingsPanelProps) {
  const isHost = myPlayer.isHost;
  const locked = room.phase !== 'lobby' && room.phase !== 'game-select';
  const editable = isHost && !locked;
  const minPlayers = room.selectedGame?.minPlayers ?? 3;
  const readiness = getTeamStartReadiness(
    room.playMode,
    room.teams,
    room.players.length,
    minPlayers
  );

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const startRename = (team: Team) => {
    setRenamingId(team.id);
    setRenameDraft(team.name);
  };

  const commitRename = () => {
    if (renamingId) onRenameTeam(renamingId, renameDraft);
    setRenamingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Play mode */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
          Play mode
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(['solo', 'team'] as const).map((mode) => {
            const active = room.playMode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={!editable}
                onClick={() => onSetPlayMode(mode)}
                aria-pressed={active}
                className={`px-3 py-2.5 rounded-xl border-2 text-xs font-black transition-all ${
                  editable ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                } ${
                  active
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900/5 dark:bg-neutral-100/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {PLAY_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-semibold text-neutral-400 mt-1">
          {room.playMode === 'solo'
            ? 'Everyone plays for themselves — exactly as before.'
            : 'Individual scores stay, and each team also collects its members’ points.'}
        </p>
      </div>

      {/* Rounds */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
          Rounds per session
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!editable || room.totalRounds <= MIN_ROUNDS}
            onClick={() => onSetRoundCount(room.totalRounds - 1)}
            aria-label="One round fewer"
            className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            −
          </button>
          <span className="w-12 text-center font-black text-xl text-[var(--text-primary)]">
            {room.totalRounds}
          </span>
          <button
            type="button"
            disabled={!editable || room.totalRounds >= MAX_ROUNDS}
            onClick={() => onSetRoundCount(room.totalRounds + 1)}
            aria-label="One round more"
            className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            +
          </button>
          <span className="text-[10px] font-semibold text-neutral-400">
            Round {Math.min(room.roundNumber, room.totalRounds)} of {room.totalRounds}
          </span>
        </div>
      </div>

      {/* Teams */}
      {room.playMode === 'team' && (
        <div className="pt-1 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mt-3 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Users2 className="w-3.5 h-3.5" />
              Teams
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, index) => MIN_TEAMS + index).map(
                (count) => (
                  <button
                    key={count}
                    type="button"
                    disabled={!editable}
                    onClick={() => onSetTeamCount(count)}
                    aria-pressed={room.teams.length === count}
                    aria-label={`${count} teams`}
                    className={`w-7 h-7 rounded-lg border-2 text-xs font-black transition-all ${
                      editable ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      room.teams.length === count
                        ? 'border-neutral-900 dark:border-neutral-100 text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] text-neutral-400'
                    }`}
                  >
                    {count}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="space-y-2">
            {room.teams.map((team) => {
              const accent = getTeamAccent(team.accentIndex);
              const isMine = myPlayer.teamId === team.id;
              const members = room.players.filter((player) => player.teamId === team.id);
              return (
                <div
                  key={team.id}
                  className="rounded-2xl border-2 p-3"
                  style={{
                    borderColor: isMine ? accent.hex : 'var(--border-subtle)',
                    backgroundColor: isMine ? `${accent.hex}14` : 'var(--surface-card-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    {renamingId === team.id ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="text"
                          value={renameDraft}
                          maxLength={TEAM_NAME_MAX_CHARS}
                          autoFocus
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename();
                            if (event.key === 'Escape') setRenamingId(null);
                          }}
                          aria-label={`Rename ${team.name}`}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-xs text-[var(--text-primary)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={commitRename}
                          aria-label="Save team name"
                          className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg leading-none" aria-hidden="true">
                          {team.icon}
                        </span>
                        <span className="font-black text-sm text-[var(--text-primary)] truncate">
                          {team.name}
                        </span>
                        <span className="text-[10px] font-bold text-neutral-400">
                          {team.score} pts
                        </span>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => startRename(team)}
                            aria-label={`Rename ${team.name}`}
                            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={locked || isMine}
                      onClick={() => onJoinTeam(team.id)}
                      className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-colors ${
                        isMine
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 cursor-default'
                          : locked
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-default'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer'
                      }`}
                    >
                      {isMine ? 'Your team' : 'Join'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {members.length === 0 ? (
                      <span className="text-[11px] font-semibold text-neutral-400">
                        No players yet
                      </span>
                    ) : (
                      members.map((member) => (
                        <PlayerChip
                          key={member.id}
                          name={member.name}
                          colorIndex={member.colorIndex}
                          connected={member.connected}
                          isHost={member.isHost}
                          isYou={member.id === myPlayer.id}
                          size="sm"
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {editable && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => onBalanceTeams(false)}
                className="px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-xs font-black text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                Auto-balance
              </button>
              <button
                type="button"
                onClick={() => onBalanceTeams(true)}
                className="px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-xs font-black text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Shuffle teams
              </button>
            </div>
          )}

          {/* Start readiness, mirroring the lobby's start gate */}
          <div className="mt-3 space-y-1">
            {readiness.message && (
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300" role="status">
                {readiness.message}
              </p>
            )}
            {readiness.sizeWarning && (
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400" role="status">
                {readiness.sizeWarning}
              </p>
            )}
            {!locked && readiness.ready && (
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Team split looks good — the host can start.
              </p>
            )}
          </div>
        </div>
      )}

      {locked && (
        <p className="text-[10px] font-semibold text-neutral-400">
          These settings lock once a round starts and unlock back in the lobby.
        </p>
      )}
      {!isHost && !locked && (
        <p className="text-[10px] font-semibold text-neutral-400">
          The host controls these — tap a team to join it.
        </p>
      )}
    </div>
  );
}
