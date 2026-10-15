import { Users2 } from 'lucide-react';
import { RoomPublicState, TeamStanding, TeamStandingMember } from '@shared/types';
import { getTeamAccent } from '@shared/theme/tokens';
import { PlayerAvatar } from './PlayerAvatar';

/** A row of the team leaderboard (round results or the live session totals). */
export interface TeamBoardRow {
  teamId: string;
  name: string;
  icon: string;
  accentIndex: number;
  total: number;
  members: TeamStandingMember[];
}

interface TeamLeaderboardProps {
  rows: TeamBoardRow[];
  myTeamId?: string;
  title?: string;
}

/**
 * Team leaderboard: rank, icon, name and total, with every member's
 * contribution underneath so individual play is still visible. Used above the
 * individual standings whenever the room is in team mode.
 */
export function TeamLeaderboard({ rows, myTeamId, title = 'Team Standings' }: TeamLeaderboardProps) {
  if (rows.length === 0) return null;
  const ranked = [...rows].sort((a, b) => b.total - a.total);

  return (
    <div className="party-card p-5 rounded-3xl mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <Users2 className="w-3.5 h-3.5" />
          <span>{title}</span>
        </span>
        <span className="text-xs text-neutral-400 font-bold">Team Points</span>
      </div>

      <div className="space-y-2">
        {ranked.map((row, index) => {
          const accent = getTeamAccent(row.accentIndex);
          const isMine = myTeamId === row.teamId;
          return (
            <div
              key={row.teamId}
              className="rounded-2xl border-2 p-3"
              style={{
                borderColor: isMine ? accent.hex : 'var(--border-subtle)',
                backgroundColor: isMine ? `${accent.hex}14` : 'var(--surface-card-subtle)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 text-center text-xs font-black text-neutral-400">
                    #{index + 1}
                  </span>
                  <span className="text-lg leading-none" aria-hidden="true">
                    {row.icon}
                  </span>
                  <span className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                    {row.name}
                  </span>
                  {isMine && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: `${accent.hex}22`, color: accent.hex }}
                    >
                      Your team
                    </span>
                  )}
                </div>

                <span className="shrink-0 font-black text-sm text-[var(--text-primary)]">
                  {row.total} {row.total === 1 ? 'pt' : 'pts'}
                </span>
              </div>

              <div className="mt-2 space-y-1">
                {row.members.length === 0 ? (
                  <span className="text-[11px] font-semibold text-neutral-400">
                    No players on this team
                  </span>
                ) : (
                  row.members.map((member) => (
                    <div
                      key={member.playerId}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PlayerAvatar
                          name={member.playerName}
                          colorIndex={member.colorIndex}
                          size="xs"
                        />
                        <span className="font-bold text-[var(--text-primary)] truncate">
                          {member.playerName}
                        </span>
                      </div>
                      <span className="shrink-0 font-bold text-neutral-500 dark:text-neutral-400">
                        {member.pointsAdded > 0 ? `+${member.pointsAdded} · ` : ''}
                        {member.totalScore} {member.totalScore === 1 ? 'pt' : 'pts'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Live team rows for a room (used after the last round, where the session's
 * running totals matter rather than one round's awards).
 */
export function teamRowsFromRoom(room: RoomPublicState): TeamBoardRow[] {
  return room.teams.map((team) => ({
    teamId: team.id,
    name: team.name,
    icon: team.icon,
    accentIndex: team.accentIndex,
    total: team.score,
    members: room.players
      .filter((player) => player.teamId === team.id)
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        colorIndex: player.colorIndex,
        pointsAdded: 0,
        totalScore: player.score,
      }))
      .sort((a, b) => b.totalScore - a.totalScore),
  }));
}

/** Narrowing helper: the server's results payload is already leaderboard-shaped. */
export function rowsFromStandings(standings: TeamStanding[] | undefined): TeamBoardRow[] {
  if (!standings || standings.length === 0) return [];
  return standings.map((row) => ({
    teamId: row.teamId,
    name: row.name,
    icon: row.icon,
    accentIndex: row.accentIndex,
    total: row.total,
    members: row.members,
  }));
}
