import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, LogOut, Sparkles, Grid } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

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
        colors: ['#FF5A5F', '#3AA0FF', '#FFC93C', '#4CD787', '#9B6DFF', '#FF6FB0'],
      });
    } catch {
      // ignore
    }
  }, []);

  // Compute final ranked standings sorted by total cumulative score descending
  const rankedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const highestScore = rankedPlayers[0]?.score ?? 0;
  const winners = rankedPlayers.filter((p) => p.score === highestScore && highestScore > 0);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center pt-2 mb-4"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-xs font-black text-amber-800 dark:text-amber-200 mb-2 shadow-xs">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Session Concluded</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            Final Standings
          </h2>
          <p className="text-xs font-semibold text-neutral-400 mt-1">
            {winners.length === 1
              ? `🏆 ${winners[0].name} takes the crown!`
              : winners.length > 1
              ? `🏆 Tie for victory between ${winners.map((w) => w.name).join(' & ')}!`
              : 'Great games all around!'}
          </p>
        </motion.div>

        {/* Podium / Final Scoreboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="party-card p-5 rounded-3xl border border-[var(--border-subtle)] space-y-3 mb-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
              Rank & Player
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
              Total Score
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
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isWinner
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-neutral-50 dark:bg-neutral-900/60 border-[var(--border-subtle)]'
                  } ${isYou ? 'ring-2 ring-neutral-900 dark:ring-neutral-100' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        index === 0
                          ? 'bg-amber-400 text-neutral-900 shadow-xs'
                          : index === 1
                          ? 'bg-neutral-300 dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100'
                          : index === 2
                          ? 'bg-amber-700/60 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
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
                          <span className="text-[10px] font-bold text-neutral-400">
                            (You)
                          </span>
                        )}
                        {isWinner && (
                          <span className="text-xs" title="Winner">
                            👑
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-neutral-400 block">
                        {player.colorName}
                      </span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-base font-black ${
                        isWinner
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {player.score}
                    </span>
                    <span className="text-xs font-bold text-neutral-400">
                      {player.score === 1 ? 'pt' : 'pts'}
                    </span>
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
          <div className="party-card p-3.5 rounded-2xl text-center mb-1">
            <p className="text-xs font-bold text-neutral-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Waiting for host to choose next action...</span>
            </p>
          </div>
        )}

        <ActionButton
          variant="subtle"
          onClick={onLeaveRoom}
          icon={<LogOut className="w-4 h-4 text-red-500" />}
        >
          Leave Room
        </ActionButton>
      </div>
    </div>
  );
}
