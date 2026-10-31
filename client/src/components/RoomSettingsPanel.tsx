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
    <div className="bg-white border-[2.5px] border-[var(--border-neo)] shadow-[5px_5px_0px_var(--border-neo)] p-5 rounded-3xl space-y-4">
      {/* Play mode */}
      <div>
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
          Play Mode
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {(['solo', 'team'] as const).map((mode) => {
            const active = room.playMode === mode;
            const activeBg = mode === 'solo' ? 'bg-[#FEF08A]' : 'bg-[#93C5FD]';
            return (
              <button
                key={mode}
                type="button"
                disabled={!editable}
                onClick={() => onSetPlayMode(mode)}
                aria-pressed={active}
                className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all ${
                  editable ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                } ${
                  active
                    ? `border-[2.5px] border-[var(--border-neo)] ${activeBg} text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5`
                    : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                }`}
              >
                {PLAY_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-bold text-[#52525B] mt-1.5">
          {room.playMode === 'solo'
            ? 'Everyone plays for themselves — individual score leaderboard.'
            : 'Individual scores stay, and each team also collects its members’ points.'}
        </p>
      </div>

      {/* Rounds */}
      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
          Rounds Per Session
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!editable || room.totalRounds <= MIN_ROUNDS}
            onClick={() => onSetRoundCount(room.totalRounds - 1)}
            aria-label="One round fewer"
            className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            −
          </button>
          <span className="w-12 text-center font-black text-2xl text-[var(--text-primary)] font-mono">
            {room.totalRounds}
          </span>
          <button
            type="button"
            disabled={!editable || room.totalRounds >= MAX_ROUNDS}
            onClick={() => onSetRoundCount(room.totalRounds + 1)}
            aria-label="One round more"
            className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            +
          </button>
          <span className="text-xs font-bold text-[#52525B]">
            Round {Math.min(room.roundNumber, room.totalRounds)} of {room.totalRounds}
          </span>
        </div>
      </div>

      {/* Teams */}
      {room.playMode === 'team' && (
        <div className="pt-2 border-t-2 border-[#18181B]/10">
          <div className="flex items-center justify-between mt-2 mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
              <Users2 className="w-4 h-4 text-[#18181B]" />
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
                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                      editable ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      room.teams.length === count
                        ? 'border-[2.5px] border-[var(--border-neo)] bg-[#86EFAC] text-[#18181B] shadow-[2px_2px_0px_var(--border-neo)]'
                        : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B]'
                    }`}
                  >
                    {count}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {room.teams.map((team) => {
              const accent = getTeamAccent(team.accentIndex);
              const isMine = myPlayer.teamId === team.id;
              const members = room.players.filter((player) => player.teamId === team.id);
              return (
                <div
                  key={team.id}
                  className="rounded-2xl border-[2.5px] border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] p-3.5"
                  style={{
                    backgroundColor: isMine ? `${accent.hex}22` : '#FAF8F5',
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
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border-2 border-[var(--border-neo)] bg-white font-black text-xs text-[var(--text-primary)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={commitRename}
                          aria-label="Save team name"
                          className="p-2 rounded-xl bg-[#86EFAC] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl leading-none" aria-hidden="true">
                          {team.icon}
                        </span>
                        <span className="font-black text-sm text-[var(--text-primary)] truncate">
                          {team.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-white border border-[var(--border-neo)] text-[10px] font-black text-[#18181B]">
                          {team.score} pts
                        </span>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => startRename(team)}
                            aria-label={`Rename ${team.name}`}
                            className="p-1 rounded-lg text-[#52525B] hover:text-[#18181B] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={locked || isMine}
                      onClick={() => onJoinTeam(team.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border-2 border-[var(--border-neo)] transition-all ${
                        isMine
                          ? 'bg-[#FEF08A] text-[#18181B] shadow-[1px_1px_0px_var(--border-neo)] cursor-default'
                          : locked
                          ? 'bg-[#F3EFEA] text-neutral-400 cursor-default opacity-50'
                          : 'bg-[#86EFAC] hover:bg-[#4ADE80] text-[#18181B] shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer'
                      }`}
                    >
                      {isMine ? 'Your team' : 'Join'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {members.length === 0 ? (
                      <span className="text-xs font-bold text-[#71717A] italic">
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
                className="px-3 py-2.5 rounded-xl border-2 border-[var(--border-neo)] bg-[#93C5FD] hover:bg-[#60A5FA] text-xs font-black text-[#18181B] shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Scale className="w-4 h-4" />
                Auto-balance
              </button>
              <button
                type="button"
                onClick={() => onBalanceTeams(true)}
                className="px-3 py-2.5 rounded-xl border-2 border-[var(--border-neo)] bg-[#FDBA74] hover:bg-[#FB923C] text-xs font-black text-[#18181B] shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Shuffle className="w-4 h-4" />
                Shuffle teams
              </button>
            </div>
          )}

          {/* Start readiness */}
          <div className="mt-3 space-y-1.5">
            {readiness.message && (
              <div className="p-3 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B]" role="status">
                {readiness.message}
              </div>
            )}
            {readiness.sizeWarning && (
              <div className="p-3 rounded-2xl bg-[#FDBA74] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B]" role="status">
                {readiness.sizeWarning}
              </div>
            )}
            {!locked && readiness.ready && (
              <div className="p-3 rounded-2xl bg-[#86EFAC] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B]">
                Team split looks good — ready to start!
              </div>
            )}
          </div>
        </div>
      )}

      {locked && (
        <p className="text-[11px] font-bold text-[#52525B]">
          These settings lock once a round starts and unlock back in the lobby.
        </p>
      )}
      {!isHost && !locked && (
        <p className="text-[11px] font-bold text-[#52525B]">
          The host controls these — tap a team to join it.
        </p>
      )}
    </div>
  );
}
