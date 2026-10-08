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
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface GtlResultsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

/**
 * Guess the Link — Results.
 * Reveals the hidden concept, everyone's angle, who read the link, the points
 * awarded, and which response gave the game away.
 */
export function GtlResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: GtlResultsScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;
  const guesses = results?.gtlGuesses || [];
  const hints = results?.gtlHints || [];
  const correct = guesses.filter((g) => g.correct);
  const myGuess = guesses.find((g) => g.playerId === myPlayer.id);

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
            <span>{results?.winnerTitle || 'Link Round Complete'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {results?.summary || 'Round Complete!'}
          </h2>
        </div>

        {/* The concept */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="party-card p-6 rounded-3xl text-center mb-4"
        >
          <span className="text-xs font-black uppercase tracking-widest block mb-1 text-neutral-400">
            The Hidden Concept
          </span>
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--text-primary)]">
            {results?.gtlConcept || 'Unknown'}
          </h3>
          {results?.gtlCategory && (
            <span className="inline-block mt-2 px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {results.gtlCategory}
            </span>
          )}
        </motion.div>

        {/* Your own result */}
        {myGuess && (
          <div
            className="p-3 rounded-2xl mb-4 flex items-center gap-2.5"
            style={{
              backgroundColor: myGuess.correct ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.10)',
            }}
          >
            {myGuess.correct ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div className="text-left min-w-0">
              <span className="text-xs font-black text-[var(--text-primary)] block">
                You guessed "{myGuess.guessText}"
              </span>
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                Your angle was "{myGuess.hint}"
                {myGuess.correct
                  ? ` — +${myGuess.pointsAdded} point${myGuess.pointsAdded === 1 ? '' : 's'}`
                  : ' — no point this round'}
              </span>
            </div>
          </div>
        )}

        {/* Giveaway */}
        {results?.gtlGiveawayName && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 mb-4 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Biggest Giveaway</span>
            </span>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
              {results.gtlGiveawayName} wrote "{results.gtlGiveawayResponse}" —{' '}
              {results.gtlGiveawayNote || 'the closest response to the concept.'}
            </p>
          </div>
        )}

        {/* Guess breakdown */}
        <div className="party-card p-5 rounded-3xl mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Who Read the Link</span>
            </span>
            <span className="text-xs font-bold text-neutral-400">
              {correct.length} / {guesses.length}
            </span>
          </div>

          <div className="space-y-2">
            {guesses.map((guess, idx) => (
              <motion.div
                key={guess.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-3 rounded-2xl border flex items-center justify-between gap-3"
                style={{
                  backgroundColor: guess.correct
                    ? 'rgba(16, 185, 129, 0.10)'
                    : 'var(--surface-card-subtle)',
                  borderColor: guess.correct ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    name={guess.playerName}
                    colorIndex={guess.colorIndex}
                    colorHex={guess.playerColor}
                    size="sm"
                  />
                  <div className="text-left min-w-0">
                    <span className="font-extrabold text-sm block leading-tight truncate text-[var(--text-primary)]">
                      {guess.playerName}
                      {guess.playerId === myPlayer.id && ' (You)'}
                    </span>
                    <span className="text-[11px] font-semibold text-neutral-400 block truncate">
                      Angle: {guess.hint}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block truncate">
                      Guessed "{guess.guessText}"
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg ${
                      guess.correct
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {guess.correct ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Correct</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Missed</span>
                      </>
                    )}
                  </span>

                  {guess.pointsAdded > 0 && (
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 block mt-1">
                      +{guess.pointsAdded} pt
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Every angle */}
        {hints.length > 0 && (
          <div className="party-card p-5 rounded-3xl mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 block mb-3">
              Angles on "{results?.gtlConcept}"
            </span>
            <div className="flex flex-wrap gap-1.5">
              {hints.map((entry) => (
                <span
                  key={entry.playerId}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                >
                  {entry.playerName}: {entry.hint}
                </span>
              ))}
            </div>
          </div>
        )}

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
              subtext="A fresh concept with six new angles"
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
