import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Gauge,
  Hash,
  ListOrdered,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { SpectrumBar } from '../components/SpectrumBar';

interface Top100ResultsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

/**
 * Top 100 — Results.
 * Reveals the true number behind every example, shows how close the host's
 * ordering came to the real order, and awards the table's accuracy score.
 */
export function Top100ResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: Top100ResultsScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;
  const entries = results?.top100Entries || [];
  const correctPairs = results?.top100CorrectPairs ?? 0;
  const totalPairs = results?.top100TotalPairs ?? 0;
  const points = results?.top100Points ?? 0;
  const perfect = totalPairs > 0 && correctPairs === totalPairs;

  useEffect(() => {
    if (!perfect) return;
    try {
      confetti({
        particleCount: 60,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#FF5A5F', '#3AA0FF', '#FFC93C', '#4CD787', '#9B6DFF', '#FF6FB0'],
      });
    } catch {
      // ignore
    }
  }, [perfect]);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="pb-4">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-xs font-black text-amber-800 dark:text-amber-200 mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>{results?.winnerTitle || 'Round Complete'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {results?.summary || 'The order is revealed!'}
          </h2>
        </div>

        {/* Spectrum with the true numbers plotted */}
        {results?.top100LowLabel && (
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="party-card p-4 rounded-3xl mb-4"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
              Where the numbers really fell
            </span>
            <SpectrumBar
              lowLabel={results.top100LowLabel}
              highLabel={results.top100HighLabel || 'high'}
              markers={entries.map((entry) => ({
                value: entry.secretNumber,
                colorHex: entry.playerColor,
              }))}
            />
          </motion.div>
        )}

        {/* Accuracy stat */}
        <div className="party-card p-4 rounded-3xl mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-500" />
              <span>Ordering Accuracy</span>
            </span>
            <span className="text-xs font-bold text-neutral-400">
              {correctPairs} / {totalPairs} pairs
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: perfect ? '#22C55E' : '#F59E0B' }}
              initial={{ width: 0 }}
              animate={{
                width: `${totalPairs > 0 ? Math.round((correctPairs / totalPairs) * 100) : 0}%`,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {results?.whyHint ||
              'Every neighbouring pair the host placed in the right order scored points.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              +{points} pts each
            </span>
            {perfect && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Flawless order</span>
              </span>
            )}
          </div>
        </div>

        {/* The final ordering with true numbers */}
        <div className="party-card p-5 rounded-3xl mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5" />
              <span>The Group's Final Order</span>
            </span>
            <span className="text-xs text-neutral-400 font-bold">
              {entries.length} examples
            </span>
          </div>

          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-2.5 rounded-2xl border flex items-center gap-2.5"
                style={{
                  backgroundColor: entry.correctlyPlaced
                    ? 'rgba(16, 185, 129, 0.10)'
                    : 'var(--surface-card-subtle)',
                  borderColor: entry.correctlyPlaced
                    ? 'rgba(16, 185, 129, 0.35)'
                    : 'var(--border-subtle)',
                }}
              >
                <span className="w-5 text-center text-[11px] font-black text-neutral-400 shrink-0">
                  {entry.hostPosition}
                </span>

                <PlayerAvatar
                  name={entry.playerName}
                  colorIndex={entry.colorIndex}
                  colorHex={entry.playerColor}
                  size="xs"
                />

                <div className="min-w-0 flex-1 text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                    {entry.playerName}
                    {entry.playerId === myPlayer.id && ' (You)'}
                  </span>
                  <p className="text-sm font-bold leading-snug text-[var(--text-primary)]">
                    {entry.text}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-0.5 text-sm font-black text-[var(--text-primary)]">
                    <Hash className="w-3 h-3 text-neutral-400" />
                    {entry.secretNumber}
                  </span>
                  <span className="block mt-0.5">
                    {entry.correctlyPlaced ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>exact</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-neutral-400">
                        <XCircle className="w-3 h-3" />
                        <span>#{entry.truePosition}</span>
                      </span>
                    )}
                  </span>
                </div>
              </motion.div>
            ))}
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
              subtext="A brand-new spectrum with fresh secret numbers"
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
