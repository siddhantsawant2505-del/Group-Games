import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, RotateCcw, Award, Skull, Search, Users, ScrollText } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface MafiaResultsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

function RoleIcon({ role }: { role: string }) {
  if (role.toLowerCase().includes('mafia')) return <Skull className="w-3.5 h-3.5" />;
  if (role.toLowerCase().includes('detective')) return <Search className="w-3.5 h-3.5" />;
  return <Users className="w-3.5 h-3.5" />;
}

/**
 * Mafia — Final Results.
 * Full role reveal for every player, the winning side, the game log and points.
 */
export function MafiaResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: MafiaResultsScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;
  const winningSide = results?.mafiaWinningSide || 'town';
  const mafiaWon = winningSide === 'mafia';

  useEffect(() => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: mafiaWon
          ? ['#EF4444', '#7F1D1D', '#1A1B1E', '#DC2626']
          : ['#22C55E', '#4CD787', '#FFC93C', '#3AA0FF'],
      });
    } catch {
      // ignore
    }
  }, [mafiaWon]);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        {/* Winner banner */}
        <div className="text-center mb-4">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-2"
            style={{
              backgroundColor: mafiaWon ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: mafiaWon ? '#EF4444' : '#22C55E',
            }}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{results?.winnerTitle || 'Game Over'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {mafiaWon ? 'The Mafia Took the Town' : 'The Town Survived'}
          </h2>

          <span className="text-xs font-bold text-neutral-400 block mt-1">
            {mafiaState_summary(room)}
          </span>
        </div>

        {results?.whyHint && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 mb-4 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
              What Happened
            </span>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
              {results.whyHint}
            </p>
          </div>
        )}

        {/* Final role reveal */}
        <div className="party-card p-5 rounded-3xl mb-4 space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-neutral-400 block">
            Final Role Reveal
          </span>

          {(results?.roleReveals || []).map((item, idx) => {
            const isMafiaRole = item.role.toLowerCase().includes('mafia');
            const isDetectiveRole = item.role.toLowerCase().includes('detective');

            return (
              <motion.div
                key={item.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="p-3 rounded-2xl flex items-center justify-between gap-2 border"
                style={{
                  backgroundColor: isMafiaRole ? '#2B1113' : 'var(--surface-card-subtle)',
                  borderColor: isMafiaRole
                    ? 'rgba(239,68,68,0.45)'
                    : isDetectiveRole
                    ? 'rgba(99,102,241,0.45)'
                    : 'var(--border-subtle)',
                  color: isMafiaRole ? '#F2F2F0' : 'var(--text-primary)',
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
                      className={`text-[11px] block truncate ${
                        isMafiaRole ? 'text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {item.explanation}
                    </span>
                  </div>
                </div>

                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: isMafiaRole
                      ? 'rgba(239,68,68,0.2)'
                      : isDetectiveRole
                      ? 'rgba(99,102,241,0.18)'
                      : 'rgba(148,163,184,0.18)',
                    color: isMafiaRole ? '#FCA5A5' : isDetectiveRole ? '#A5B4FC' : 'var(--text-secondary)',
                  }}
                >
                  <RoleIcon role={item.role} />
                  <span>{item.role}</span>
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Game log */}
        {(results?.mafiaLog || []).length > 0 && (
          <div className="party-card p-5 rounded-3xl mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
              <ScrollText className="w-3.5 h-3.5" />
              <span>Game Log</span>
            </span>

            <div className="space-y-1.5">
              {(results?.mafiaLog || []).map((entry, idx) => (
                <span
                  key={`${idx}-${entry}`}
                  className="block text-[11px] font-semibold text-neutral-500 dark:text-neutral-400"
                >
                  • {entry}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Standings */}
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
              {results.standings.map((st, idx) => (
                <div
                  key={st.playerId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 text-center text-xs font-black text-neutral-400">
                      #{idx + 1}
                    </span>
                    <PlayerAvatar name={st.playerName} colorIndex={st.colorIndex} size="xs" />
                    <span className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                      {st.playerName}
                    </span>
                    {st.badge && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                        {st.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {st.pointsAdded > 0 ? (
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50">
                        +{st.pointsAdded} pt
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-neutral-400">+0</span>
                    )}
                    <span className="font-black text-sm text-[var(--text-primary)]">
                      {st.totalScore} {st.totalScore === 1 ? 'pt' : 'pts'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-semibold text-neutral-400 mt-2">
              +1 point for every surviving member of the winning side.
            </p>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="pt-2 space-y-2">
        {isHost ? (
          <>
            <ActionButton
              variant="shared"
              onClick={onNextRound}
              icon={<ArrowRight className="w-5 h-5" />}
              subtext="Fresh roles, fresh night of suspicion"
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
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Waiting for host to start the next round or return to lobby...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** One-line recap of how the game ended. */
function mafiaState_summary(room: RoomPublicState): string {
  const kills = (room.results?.mafiaEliminations || []).filter((e) => e.cause === 'night-kill').length;
  const exiles = (room.results?.mafiaEliminations || []).filter((e) => e.cause === 'exile').length;
  return `${kills} eliminated overnight • ${exiles} exiled by the town`;
}
