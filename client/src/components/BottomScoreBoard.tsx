import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users2, ChevronUp, ChevronDown, Crown, Wifi, WifiOff } from 'lucide-react';
import { Player, RoomPublicState, Team } from '@shared/types';
import { getPlayerColor, getTeamAccent } from '@shared/theme/tokens';
import { PlayerAvatar } from './PlayerAvatar';

interface BottomScoreBoardProps {
  room: RoomPublicState;
  myPlayer: Player;
}

export function BottomScoreBoard({ room, myPlayer }: BottomScoreBoardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isTeamMode = room.playMode === 'team' && room.teams.length > 0;

  // Ranked teams
  const rankedTeams = [...room.teams].sort((a, b) => b.score - a.score);

  // Ranked players
  const rankedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  // Quick summary string for collapsed bar
  const summaryLeader = isTeamMode
    ? rankedTeams[0]
      ? `${rankedTeams[0].icon} ${rankedTeams[0].name} (${rankedTeams[0].score} pts)`
      : 'No scores yet'
    : rankedPlayers[0]
    ? `${rankedPlayers[0].name} (${rankedPlayers[0].score} pts)`
    : 'No scores yet';

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)]';
      case 2:
        return 'bg-[#93C5FD] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)]';
      case 3:
        return 'bg-[#FDA4AF] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)]';
      default:
        return 'bg-[#F3EFEA] text-[#52525B] border border-[var(--border-neo)]/50';
    }
  };

  return (
    <div className="sticky bottom-0 z-30 w-full select-none">
      {/* Neo-brutalist bottom container */}
      <div className="bg-white border-t-[2.5px] border-x-[2.5px] border-[var(--border-neo)] shadow-[0px_-4px_0px_var(--border-neo)] rounded-t-3xl overflow-hidden transition-all">
        {/* Clickable Header Bar */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between gap-2.5 bg-[#FAF8F5] hover:bg-white border-b-2 border-[#18181B]/10 cursor-pointer tactile-btn transition-colors"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse Score Board' : 'Expand Score Board'}
        >
          {/* Left: Trophy Pill & Mode */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
              <Trophy className="w-4 h-4" />
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-black text-xs text-[var(--text-primary)] whitespace-nowrap">
                Score Board
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-black shrink-0 ${
                  isTeamMode
                    ? 'bg-[#93C5FD] text-[#18181B] border-[var(--border-neo)]'
                    : 'bg-[#FEF08A] text-[#18181B] border-[var(--border-neo)]'
                }`}
              >
                {isTeamMode ? 'Team' : 'Solo'}
              </span>
            </div>
          </div>

          {/* Center: Live leader preview */}
          <div className="hidden xs:flex items-center gap-1 min-w-0 px-2 py-0.5 rounded-lg bg-white border border-[var(--border-neo)]/40 text-[11px] font-bold text-[#18181B] truncate max-w-[150px] sm:max-w-[200px]">
            <Crown className="w-3 h-3 text-[#EAB308] shrink-0" />
            <span className="truncate">{summaryLeader}</span>
          </div>

          {/* Right: Expand / Collapse Toggle Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2.5 py-1 rounded-xl bg-white border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-[11px] font-black text-[#18181B] flex items-center gap-1">
              <span>{isExpanded ? 'Hide' : 'View Table'}</span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </span>
          </div>
        </button>

        {/* Expandable Score Board Table */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="max-h-[50vh] overflow-y-auto p-4 bg-white space-y-3"
            >
              {isTeamMode ? (
                /* ================= TEAM SCORE BOARD TABLE ================= */
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1 text-[10px] font-black uppercase tracking-wider text-[#71717A] px-1">
                    <span className="w-12">Rank</span>
                    <span className="flex-1">Team & Members</span>
                    <span className="text-right">Total Score</span>
                  </div>

                  {rankedTeams.map((team: Team, index: number) => {
                    const isMyTeam = myPlayer.teamId === team.id;
                    const accent = getTeamAccent(team.accentIndex);
                    const members = room.players.filter((p) => p.teamId === team.id);

                    return (
                      <div
                        key={team.id}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                          isMyTeam
                            ? 'border-[2.5px] border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)]'
                            : 'border-2 border-[var(--border-neo)]/40 shadow-[1.5px_1.5px_0px_var(--border-neo)]'
                        }`}
                        style={{
                          backgroundColor: isMyTeam ? `${accent.hex}18` : '#FAF8F5',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {/* Rank Badge */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${getRankBadge(
                                index + 1
                              )}`}
                            >
                              #{index + 1}
                            </span>

                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-lg leading-none shrink-0" aria-hidden="true">
                                {team.icon}
                              </span>
                              <span className="font-black text-sm text-[var(--text-primary)] truncate">
                                {team.name}
                              </span>
                              {isMyTeam && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#86EFAC] text-[#18181B] border border-[var(--border-neo)] text-[9px] font-black shrink-0">
                                  YOUR TEAM
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Team Score */}
                          <div className="px-2.5 py-1 rounded-xl bg-white border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] font-mono font-black text-sm text-[var(--text-primary)] shrink-0">
                            {team.score} <span className="text-[10px] font-sans font-bold">pts</span>
                          </div>
                        </div>

                        {/* Team Member chips */}
                        <div className="mt-2.5 pt-2 border-t border-[#18181B]/10 flex flex-wrap items-center gap-1.5">
                          {members.length === 0 ? (
                            <span className="text-[10px] font-bold text-[#71717A] italic">
                              No players assigned
                            </span>
                          ) : (
                            members.map((member) => {
                              const isMe = member.id === myPlayer.id;
                              const mColor = getPlayerColor(member.colorIndex);
                              return (
                                <div
                                  key={member.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${
                                    isMe
                                      ? 'border-[var(--border-neo)] bg-white shadow-[1px_1px_0px_var(--border-neo)]'
                                      : 'border-[var(--border-neo)]/30 bg-white/70'
                                  }`}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: mColor.hex }}
                                  />
                                  <span className="truncate max-w-[80px]">{member.name}</span>
                                  <span className="font-mono text-[#52525B]">({member.score}p)</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ================= SOLO SCORE BOARD TABLE ================= */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between pb-1 text-[10px] font-black uppercase tracking-wider text-[#71717A] px-1">
                    <span className="w-12">Rank</span>
                    <span className="flex-1">Player</span>
                    <span className="text-right">Score</span>
                  </div>

                  {rankedPlayers.map((player: Player, index: number) => {
                    const isMe = player.id === myPlayer.id;
                    const pColor = getPlayerColor(player.colorIndex);

                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border-2 transition-all ${
                          isMe
                            ? 'border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A]/35 shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5'
                            : 'border-[var(--border-neo)]/40 bg-[#FAF8F5]'
                        }`}
                      >
                        {/* Rank & Player Info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${getRankBadge(
                              index + 1
                            )}`}
                          >
                            #{index + 1}
                          </span>

                          <div className="relative shrink-0">
                            <PlayerAvatar
                              name={player.name}
                              colorIndex={player.colorIndex}
                              size="xs"
                              connected={player.connected}
                              isHost={player.isHost}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-black text-xs text-[var(--text-primary)] truncate">
                              {player.name}
                            </span>
                            {isMe && (
                              <span className="px-1.5 py-0.2 rounded-md bg-[#86EFAC] text-[#18181B] border border-[var(--border-neo)] text-[9px] font-black shrink-0">
                                YOU
                              </span>
                            )}
                            {player.isHost && (
                              <span title="Host">
                                <Crown className="w-3 h-3 text-[#EAB308] shrink-0" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Individual Score Pill */}
                        <div className="flex items-center gap-2 shrink-0">
                          {player.connected ? (
                            <span title="Online">
                              <Wifi className="w-3 h-3 text-emerald-600" />
                            </span>
                          ) : (
                            <span title="Disconnected">
                              <WifiOff className="w-3 h-3 text-rose-500" />
                            </span>
                          )}
                          <div className="px-2.5 py-0.5 rounded-xl bg-white border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] font-mono font-black text-xs text-[var(--text-primary)]">
                            {player.score}{' '}
                            <span className="text-[10px] font-sans font-bold">pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
