import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, LogOut, Sparkles, Grid, Crown } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamLeaderboard, teamRowsFromRoom } from '../components/TeamLeaderboard';

interface PostGameScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onPlayAgain: () => void;
  onChooseNewGame: () => void;
  onLeaveRoom: () => void;
}

export function PostGameScreen({
  room,
  myPlayer,
  onPlayAgain,
  onChooseNewGame,
  onLeaveRoom,
}: PostGameScreenProps) {
  const isHost = myPlayer.isHost;

  useEffect(() => {
    // Celebratory fireworks / confetti on session completion
    try {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#FDA4AF', '#93C5FD', '#FEF08A', '#86EFAC', '#C4B5FD', '#FDBA74'],
      });
    } catch {
      // ignore
    }
  }, []);

  const rankedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const highestScore = rankedPlayers[0]?.score ?? 0;
  const winners = rankedPlayers.filter((p) => p.score === highestScore && highestScore > 0);
  const teamRows = room.playMode === 'team' ? teamRowsFromRoom(room) : [];

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center pt-2 mb-4"
        >
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black mb-2">
            <Trophy className="w-4 h-4 text-[#18181B]" />
            <span>Session Concluded</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            Final Standings
          </h2>
          <p className="text-xs font-bold opacity-60 mt-1">
            {teamRows.length > 0
              ? `🏆 Top team: ${
                  [...teamRows].sort((a, b) => b.total - a.total)[0].name
                } — individual scores below`
              : winners.length === 1
              ? `🏆 ${winners[0].name} takes the crown!`
              : winners.length > 1
              ? `🏆 Tie for victory between ${winners.map((w) => w.name).join(' & ')}!`
              : 'Great games all around!'}
          </p>
        </motion.div>

        {/* Team mode: team totals first */}
        {teamRows.length > 0 && (
          <TeamLeaderboard
            rows={teamRows}
            myTeamId={myPlayer.teamId}
            title="Final Team Totals"
          />
        )}

        {/* Podium / Final Scoreboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-3xl bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)] space-y-3 mb-4"
        >
          <div className="flex items-center justify-between pb-2 border-b-2 border-[var(--border-neo)]">
            <span className="text-xs font-black uppercase tracking-wider opacity-60">
              Rank & Player
            </span>
            <span className="text-xs font-black uppercase tracking-wider opacity-60">
              Game Pts · Room Wins
            </span>
          </div>

          <div className="space-y-2">
            {rankedPlayers.map((player, index) => {
              const isWinner = player.score === highestScore && highestScore > 0;
              const isYou = player.id === myPlayer.id;

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className={`flex items-center justify-between p-3 rounded-2xl border-2 border-[var(--border-neo)] transition-all ${
                    isWinner
                      ? 'bg-[#FEF08A] shadow-[4px_4px_0px_var(--border-neo)] -translate-y-0.5'
                      : 'bg-[var(--surface-card-subtle)] shadow-[2px_2px_0px_var(--border-neo)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div
                      className={`w-7 h-7 rounded-lg border border-[var(--border-neo)] flex items-center justify-center text-xs font-black shrink-0 ${
                        index === 0
                          ? 'bg-[#FEF08A] text-[#18181B]'
                          : index === 1
                          ? 'bg-[#93C5FD] text-[#18181B]'
                          : index === 2
                          ? 'bg-[#FDA4AF] text-[#18181B]'
                          : 'bg-[var(--surface-card)] text-[var(--text-primary)]'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <PlayerAvatar
                      name={player.name}
                      colorHex={player.colorHex}
                      colorIndex={player.colorIndex}
                      size="xs"
                    />

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-[var(--text-primary)]">
                          {player.name}
                        </span>
                        {isYou && (
                          <span className="text-[10px] font-bold opacity-60">
                            (You)
                          </span>
                        )}
                        {isWinner && (
                          <span className="text-xs" title="Winner">
                            👑
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold opacity-60 block">
                        {player.colorName}
                      </span>
                    </div>
                  </div>

                  {/* Dual Scores */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="px-2 py-0.5 rounded-lg bg-[#93C5FD] text-[#18181B] border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-xs font-black font-mono"
                      title="Game Points"
                    >
                      {player.gameScore ?? player.score} pts
                    </div>
                    <div
                      className="px-2 py-0.5 rounded-lg bg-[#FEF08A] text-[#18181B] border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-xs font-black font-mono flex items-center gap-1"
                      title="Main Room Wins"
                    >
                      <Crown className="w-3 h-3 text-[#EAB308]" />
                      <span>{player.roomScore ?? 0}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 space-y-2">
        {isHost ? (
          <>
            <ActionButton
              variant="shared"
              onClick={onPlayAgain}
              icon={<RotateCcw className="w-5 h-5" />}
              subtext="Reset round state & replay with current scores"
            >
              Play Again
            </ActionButton>

            <ActionButton
              variant="subtle"
              onClick={onChooseNewGame}
              icon={<Grid className="w-5 h-5" />}
              subtext="Return to lobby to pick another game format"
            >
              Choose New Game
            </ActionButton>
          </>
        ) : (
          <div className="p-4 rounded-2xl text-center bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] mb-1">
            <p className="text-xs font-bold opacity-75 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Waiting for host to choose next action...</span>
            </p>
          </div>
        )}

        <ActionButton
          variant="subtle"
          onClick={onLeaveRoom}
          icon={<LogOut className="w-4 h-4 text-[#FDA4AF]" />}
        >
          Leave Room
        </ActionButton>
      </div>
    </div>
  );
}
