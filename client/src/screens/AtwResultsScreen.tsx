import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  ArrowRight,
  RotateCcw,
  Award,
  CheckCircle2,
  XCircle,
  BellRing,
  Ban,
} from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface AtwResultsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

/**
 * Avoid the Word — Results View.
 * Per-turn success/fail breakdown plus points, followed by the running scoreboard.
 */
export function AtwResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: AtwResultsScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;
  const turns = results?.atwTurnResults || [];
  const cleanTurns = turns.filter((t) => t.success).length;

  useEffect(() => {
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
      <div>
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-xs font-black text-amber-800 dark:text-amber-200 mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>{results?.winnerTitle || 'Taboo Round Complete'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {results?.summary || 'Round Complete!'}
          </h2>

          <span className="text-xs font-bold text-neutral-400 block mt-1">
            {cleanTurns} clean {cleanTurns === 1 ? 'describe' : 'describes'} •{' '}
            {turns.length - cleanTurns} buzzed out
          </span>
        </div>

        {/* Round analysis */}
        {results?.whyHint && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 mb-4 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
              Round Analysis
            </span>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
              {results.whyHint}
            </p>
          </div>
        )}

        {/* Per-turn breakdown */}
        <div className="party-card p-5 rounded-3xl mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-red-500" />
              <span>Turn by Turn</span>
            </span>
            <span className="text-xs font-bold text-neutral-400">Success / Fail</span>
          </div>

          <div className="space-y-2">
            {turns.map((turn, idx) => (
              <motion.div
                key={`${turn.playerId}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-3 rounded-2xl border flex items-center justify-between gap-3"
                style={{
                  backgroundColor: turn.success
                    ? 'var(--surface-card-subtle)'
                    : 'rgba(239, 68, 68, 0.08)',
                  borderColor: turn.success ? 'var(--border-subtle)' : 'rgba(239, 68, 68, 0.35)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    name={turn.playerName}
                    colorIndex={turn.colorIndex}
                    colorHex={turn.playerColor}
                    size="sm"
                  />
                  <div className="text-left min-w-0">
                    <span className="font-extrabold text-sm block leading-tight truncate text-[var(--text-primary)]">
                      {turn.playerName}
                      {turn.playerId === myPlayer.id && ' (You)'}
                    </span>
                    <span className="text-[11px] font-semibold text-neutral-400 block truncate">
                      Described “{turn.subject}”
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {turn.forbidden.map((word) => (
                        <span
                          key={word}
                          className="px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-500 text-[10px] font-bold"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                    {!turn.success && turn.buzzedByNames && turn.buzzedByNames.length > 0 && (
                      <span className="text-[10px] font-semibold text-neutral-400 block mt-1">
                        Buzzed by {turn.buzzedByNames.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg ${
                      turn.success
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-500/15 text-red-500'
                    }`}
                  >
                    {turn.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Clean</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Buzzed</span>
                      </>
                    )}
                  </span>

                  <span className="text-[11px] font-bold text-neutral-400 flex items-center justify-end gap-1 mt-1">
                    <BellRing className="w-3 h-3" />
                    <span>
                      {turn.buzzCount} {turn.buzzCount === 1 ? 'buzz' : 'buzzes'}
                    </span>
                  </span>
                </div>
              </motion.div>
            ))}

            {turns.length === 0 && (
              <p className="text-xs font-semibold text-neutral-400 text-center py-3">
                No describing turns were completed this round.
              </p>
            )}
          </div>
        </div>

        {/* Scoreboard */}
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
              subtext="New subjects and trap words for everyone"
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
