import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, RotateCcw, Award } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';

interface ResultsPhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
}

export function ResultsPhaseScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
}: ResultsPhaseScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;

  useEffect(() => {
    // Launch celebratory party confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#FF5A5F', '#3AA0FF', '#FFC93C', '#4CD787', '#9B6DFF', '#FF6FB0'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-xs font-black text-amber-800 dark:text-amber-200 mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>{results?.winnerTitle || 'Round Results'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {results?.summary || 'Round Complete!'}
          </h2>
        </div>

        {/* Secret Word & Impostor Unmasked Spotlight Card */}
        <div className="party-card p-5 rounded-3xl mb-4 border border-[var(--border-subtle)] space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)]">
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 block mb-0.5">
                Real Secret Word
              </span>
              <span className="text-xl font-black text-[var(--text-primary)] block">
                {results?.secretWord || 'Hidden'}
              </span>
              {results?.category && (
                <span className="text-[10px] font-bold text-neutral-400 block mt-0.5">
                  {results.category}
                </span>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-500 block mb-0.5">
                The Impostor
              </span>
              <span className="text-xl font-black text-red-600 dark:text-red-400 block">
                {results?.impostorName || 'Unknown'}
              </span>
              {results?.impostorClue && (
                <span className="text-[10px] font-bold text-neutral-400 block mt-0.5">
                  Bluffed: "{results.impostorClue}"
                </span>
              )}
            </div>
          </div>

          {/* Short Why Hint */}
          {results?.whyHint && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
                Round Analysis
              </span>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
                {results.whyHint}
              </p>
            </div>
          )}
        </div>

        {/* Vote Tally Section */}
        {results?.voteTallies && (
          <div className="party-card p-5 rounded-3xl mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                Vote Tally
              </span>
              <span className="text-xs font-bold text-neutral-400">
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
                    className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-[var(--border-subtle)] flex items-center justify-between gap-3"
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
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400">
                              Impostor
                            </span>
                          )}
                        </div>
                        {voters.length > 0 && (
                          <span className="text-[11px] text-neutral-400 font-medium block truncate">
                            Voted by: {voters.map((v) => v.voterName).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-[var(--text-primary)]">
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
          <div className="party-card p-5 rounded-3xl mb-4 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 block">
              Player Clues & Roles
            </span>

            <div className="space-y-2">
              {results.roleReveals.map((item) => {
                return (
                  <motion.div
                    key={item.playerId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-2xl flex items-center justify-between gap-2 border"
                    style={{
                      backgroundColor: item.isSpecialRole
                        ? '#3D2C4E'
                        : 'var(--surface-card-subtle)',
                      color: item.isSpecialRole ? '#FFFFFF' : 'var(--text-primary)',
                      borderColor: item.isSpecialRole
                        ? '#5E4378'
                        : 'var(--border-subtle)',
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
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {item.explanation}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          item.isSpecialRole
                            ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
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

        {/* Score Standings Leaderboard */}
        {results?.standings && (
          <div className="party-card p-5 rounded-3xl mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Running Scoreboard</span>
              </span>
              <span className="text-xs text-neutral-400 font-bold">Total Points</span>
            </div>

            <div className="space-y-2">
              {results.standings.map((st, idx) => {
                return (
                  <div
                    key={st.playerId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center text-xs font-black text-neutral-400">
                        #{idx + 1}
                      </span>
                      <PlayerAvatar
                        name={st.playerName}
                        colorIndex={st.colorIndex}
                        size="xs"
                      />
                      <span className="font-extrabold text-sm text-[var(--text-primary)]">
                        {st.playerName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {st.pointsAdded > 0 ? (
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50">
                          +{st.pointsAdded} pt
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-neutral-400">
                          +0
                        </span>
                      )}
                      <span className="font-black text-sm text-[var(--text-primary)]">
                        {st.totalScore} {st.totalScore === 1 ? 'pt' : 'pts'}
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
          </>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Waiting for host to start next round or return to lobby...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
