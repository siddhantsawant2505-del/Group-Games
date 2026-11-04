import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, RotateCcw, Award, Crown } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamLeaderboard, rowsFromStandings } from '../components/TeamLeaderboard';

interface ResultsPhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

export function ResultsPhaseScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: ResultsPhaseScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;
  const teamRows = rowsFromStandings(results?.teamStandings);

  useEffect(() => {
    // Launch celebratory party confetti with our soothing pastel palette
    try {
      confetti({
        particleCount: 50,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#FDA4AF', '#93C5FD', '#FEF08A', '#86EFAC', '#C4B5FD', '#FDBA74'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black mb-2">
            <Trophy className="w-4 h-4 text-[#18181B]" />
            <span>{results?.winnerTitle || 'Round Results'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {results?.summary || 'Round Complete!'}
          </h2>
        </div>

        {/* Secret Word & Impostor Unmasked Spotlight Card */}
        <div className="p-5 rounded-3xl mb-4 bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)] space-y-3">
          {/* Question mode reveals both questions instead of a secret word. */}
          {results?.impostorCrewQuestion ? (
            <div className="grid grid-cols-1 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-[#93C5FD]/30 border-2 border-[var(--border-neo)]">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#18181B] block mb-0.5">
                  The Question Everyone Answered
                </span>
                <span className="text-sm font-black text-[var(--text-primary)] block leading-snug">
                  “{results.impostorCrewQuestion}”
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#FDA4AF]/40 border-2 border-[var(--border-neo)]">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#18181B] block mb-0.5">
                  The Impostor's Question
                </span>
                <span className="text-sm font-black text-[var(--text-primary)] block leading-snug">
                  “{results.impostorImpostorQuestion || 'Hidden'}”
                </span>
                <span className="text-[10px] font-bold opacity-75 block mt-1">
                  {results.impostorName || 'The impostor'} answered:
                  {results.impostorClue ? ` "${results.impostorClue}"` : ' —'}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)]">
                <span className="text-[11px] font-black uppercase tracking-wider opacity-60 block mb-0.5">
                  Secret Word
                </span>
                <span className="text-xl font-black text-[var(--text-primary)] block">
                  {results?.secretWord || 'Hidden'}
                </span>
                {results?.category && (
                  <span className="text-[10px] font-bold opacity-60 block mt-0.5">
                    {results.category}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-[#FDA4AF] border-2 border-[var(--border-neo)] text-center text-[#18181B]">
                <span className="text-[11px] font-black uppercase tracking-wider block mb-0.5">
                  The Impostor
                </span>
                <span className="text-xl font-black block">
                  {results?.impostorName || 'Unknown'}
                </span>
                {results?.impostorClue && (
                  <span className="text-[10px] font-bold block mt-0.5">
                    Bluffed: "{results.impostorClue}"
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Question mode: one line on how the two questions differed. */}
          {results?.impostorQuestionNote && (
            <div className="p-3 rounded-2xl bg-[#93C5FD]/25 border-2 border-[var(--border-neo)] text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#18181B] block mb-1">
                Why It Showed
              </span>
              <p className="text-xs font-bold leading-relaxed text-[#18181B]">
                {results.impostorQuestionNote}
              </p>
            </div>
          )}

          {/* Short Why Hint */}
          {results?.whyHint && (
            <div className="p-3 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] text-left text-[#18181B]">
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1">
                Round Analysis
              </span>
              <p className="text-xs font-bold leading-relaxed">
                {results.whyHint}
              </p>
            </div>
          )}
        </div>

        {/* Team mode: the team leaderboard comes first, individual scores below */}
        {teamRows.length > 0 && (
          <TeamLeaderboard rows={teamRows} myTeamId={myPlayer.teamId} />
        )}

        {/* Vote Tally Section */}
        {results?.voteTallies && (
          <div className="p-5 rounded-3xl mb-4 space-y-3 bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider opacity-60">
                Vote Tally
              </span>
              <span className="text-xs font-bold opacity-60">
                Total Accusations
              </span>
            </div>

            <div className="space-y-2">
              {room.players.map((p) => {
                const votesReceived = results.voteTallies?.[p.id] || 0;
                const voters = results.voteBreakdown?.filter((b) => b.targetId === p.id) || [];
                const isImpostor = p.id === results.impostorPlayerId;

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        name={p.name}
                        colorIndex={p.colorIndex}
                        size="sm"
                        isHost={p.isHost}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-[var(--text-primary)] truncate">
                            {p.name}
                          </span>
                          {isImpostor && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#FDA4AF] text-[#18181B] border border-[var(--border-neo)]">
                              Impostor
                            </span>
                          )}
                        </div>
                        {voters.length > 0 && (
                          <span className="text-[11px] opacity-60 font-medium block truncate">
                            Voted by: {voters.map((v) => v.voterName).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-[var(--text-primary)] font-mono">
                        {votesReceived} {votesReceived === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Roles Reveal List */}
        {results?.roleReveals && (
          <div className="p-5 rounded-3xl mb-4 space-y-3 bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)]">
            <span className="text-xs font-black uppercase tracking-wider opacity-60 block">
              Player Clues & Roles
            </span>

            <div className="space-y-2">
              {results.roleReveals.map((item) => {
                return (
                  <motion.div
                    key={item.playerId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-2xl flex items-center justify-between gap-2 border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)]"
                    style={{
                      backgroundColor: item.isSpecialRole
                        ? '#3D2C4E'
                        : 'var(--surface-card-subtle)',
                      color: item.isSpecialRole ? '#FFFFFF' : 'var(--text-primary)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        name={item.playerName}
                        colorIndex={item.colorIndex}
                        size="sm"
                      />
                      <div className="text-left min-w-0">
                        <span className="font-extrabold text-sm block leading-tight truncate">
                          {item.playerName}
                          {item.playerId === myPlayer.id && ' (You)'}
                        </span>
                        <span
                          className={`text-xs block truncate ${
                            item.isSpecialRole
                              ? 'text-amber-300 font-semibold'
                              : 'opacity-70 font-semibold'
                          }`}
                        >
                          {item.explanation}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-black px-2 py-1 rounded-lg border border-[var(--border-neo)] ${
                          item.isSpecialRole
                            ? 'bg-[#FDA4AF] text-[#18181B]'
                            : 'bg-[#86EFAC] text-[#18181B]'
                        }`}
                      >
                        {item.isSpecialRole ? 'Impostor' : 'Crew'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Winner of the round: +1 Room Score Announcement Banner */}
        {results?.roomScoreWinners && results.roomScoreWinners.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] mb-4 flex items-center justify-between gap-3 text-[#18181B]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0" aria-hidden="true">👑</span>
              <div className="min-w-0">
                <span className="text-xs font-black block leading-tight truncate">
                  {results.roomScoreWinners.length === 1
                    ? `${results.roomScoreWinners[0]} won this round!`
                    : `${results.roomScoreWinners.join(' & ')} tied for the round win!`}
                </span>
                <span className="text-[10px] font-bold opacity-80 block truncate">
                  Top score earned +1 Point on the Main Room Scoreboard!
                </span>
              </div>
            </div>
            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-white border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] font-mono shrink-0">
              +1 Room Win
            </span>
          </div>
        )}

        {/* Dual Score Standings Leaderboard */}
        {results?.standings && (
          <div className="p-5 rounded-3xl mb-4 bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Round & Room Standings</span>
              </span>
              <span className="text-[11px] opacity-70 font-black">Round · Game · Room</span>
            </div>

            <div className="space-y-2">
              {results.standings.map((st, idx) => {
                return (
                  <div
                    key={st.playerId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] ${
                      st.isRoundWinner ? 'bg-[#FEF08A]/30' : 'bg-[var(--surface-card-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[#FEF08A] border border-[var(--border-neo)] flex items-center justify-center text-xs font-black text-[#18181B] shrink-0">
                        #{idx + 1}
                      </span>
                      <PlayerAvatar
                        name={st.playerName}
                        colorIndex={st.colorIndex}
                        size="xs"
                      />
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-black text-sm text-[var(--text-primary)] truncate">
                          {st.playerName}
                        </span>
                        {st.isRoundWinner && (
                          <span className="text-xs shrink-0" title="Round Winner (+1 Room Point)">
                            👑
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Round Points Added */}
                      {st.pointsAdded > 0 ? (
                        <span className="text-xs font-black text-[#18181B] px-1.5 py-0.5 rounded-md bg-[#86EFAC] border border-[var(--border-neo)] font-mono" title="Round points">
                          +{st.pointsAdded}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold opacity-60 font-mono px-1">
                          +0
                        </span>
                      )}

                      {/* Game Total Points */}
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[#93C5FD] text-[#18181B] border border-[var(--border-neo)] shadow-[0.5px_0.5px_0px_var(--border-neo)]" title="Game Points">
                        {st.gameScore ?? st.totalScore}p
                      </span>

                      {/* Main Room Score (Wins) */}
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[#FEF08A] text-[#18181B] border border-[var(--border-neo)] shadow-[0.5px_0.5px_0px_var(--border-neo)] flex items-center gap-0.5" title="Main Room Wins">
                        <Crown className="w-2.5 h-2.5 text-[#EAB308]" />
                        <span>{st.roomScore ?? 0}w</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div className="pt-2 space-y-2">
        {isHost ? (
          <>
            <ActionButton
              variant="shared"
              onClick={onNextRound}
              icon={<ArrowRight className="w-5 h-5" />}
              subtext="Start next round with new secret assignment"
            >
              Play Next Round
            </ActionButton>

            <ActionButton
              variant="subtle"
              onClick={onReturnToLobby}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Return to Lobby
            </ActionButton>

            <ActionButton
              variant="subtle"
              onClick={onEndSession}
              icon={<Trophy className="w-4 h-4 text-amber-500" />}
              subtext="View final standings and conclude session"
            >
              End Session
            </ActionButton>
          </>
        ) : (
          <div className="p-4 rounded-2xl text-center bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)]">
            <p className="text-xs font-bold opacity-60">
              Waiting for host to start next round or return to lobby...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
