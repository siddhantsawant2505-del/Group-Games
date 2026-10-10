import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Award,
  Crown,
  RotateCcw,
  Sparkles,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface RevCatResultsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

/**
 * Reverse Categories — Results.
 * Reveals the vote tally, crowns the best category (ties included), and shows
 * the bonus picked up by everyone who voted for a winner.
 */
export function RevCatResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: RevCatResultsScreenProps) {
  const isHost = myPlayer.isHost;
  const results = room.results;
  const categories = results?.revCatCategories || [];
  const items = results?.revCatItems || [];
  const winners = categories.filter((c) => c.isWinner);
  const myEntry = categories.find((c) => c.playerId === myPlayer.id);

  useEffect(() => {
    if (winners.length === 0) return;
    try {
      confetti({
        particleCount: 55,
        spread: 62,
        origin: { y: 0.6 },
        colors: ['#FF5A5F', '#3AA0FF', '#FFC93C', '#4CD787', '#9B6DFF', '#FF6FB0'],
      });
    } catch {
      // ignore
    }
  }, [winners.length]);

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
            {results?.summary || 'The categories are in!'}
          </h2>
        </div>

        {/* The items that had to be linked */}
        {items.length > 0 && (
          <div className="party-card p-4 rounded-3xl mb-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
              The items everyone had to link
            </span>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span
                  key={item}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Winning category spotlight */}
        {winners.length > 0 && (
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="party-card p-5 rounded-3xl mb-4 text-center border border-amber-300/60 dark:border-amber-800/60"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5 mb-1">
              <Crown className="w-3.5 h-3.5" />
              <span>Best {winners.length === 1 ? 'Category' : 'Categories'}</span>
            </span>
            <h3 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              “{winners.map((w) => w.category).join('” / “')}”
            </h3>
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mt-2">
              {winners.map((w) => w.playerName).join(', ')} ·{' '}
              {results?.revCatWinningVotes || 0}{' '}
              {(results?.revCatWinningVotes || 0) === 1 ? 'vote' : 'votes'}
            </p>
          </motion.div>
        )}

        {/* Your own result */}
        {myEntry && (
          <div
            className="p-3 rounded-2xl mb-4 flex items-center gap-2.5"
            style={{
              backgroundColor: myEntry.isWinner
                ? 'rgba(16, 185, 129, 0.12)'
                : 'var(--surface-card-subtle)',
            }}
          >
            <Sparkles
              className="w-5 h-5 shrink-0"
              style={{ color: myEntry.isWinner ? '#22C55E' : '#A3A3A3' }}
            />
            <div className="text-left min-w-0">
              <span className="text-xs font-black text-[var(--text-primary)] block">
                You wrote “{myEntry.category}”
              </span>
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                {myEntry.votes} {myEntry.votes === 1 ? 'vote' : 'votes'}
                {myEntry.pointsAdded > 0
                  ? ` — +${myEntry.pointsAdded} point${myEntry.pointsAdded === 1 ? '' : 's'}`
                  : ' — no points this round'}
              </span>
            </div>
          </div>
        )}

        {/* Full tally */}
        <div className="party-card p-5 rounded-3xl mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Every Category</span>
            </span>
            <span className="text-xs text-neutral-400 font-bold">
              {categories.length} invented
            </span>
          </div>

          <div className="space-y-2">
            {categories.map((entry, idx) => (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-2.5 rounded-2xl border flex items-center gap-2.5"
                style={{
                  backgroundColor: entry.isWinner
                    ? 'rgba(16, 185, 129, 0.10)'
                    : 'var(--surface-card-subtle)',
                  borderColor: entry.isWinner ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-subtle)',
                }}
              >
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
                    {entry.category}
                  </p>
                </div>

                <span
                  className={`shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-black ${
                    entry.isWinner
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {entry.votes} {entry.votes === 1 ? 'vote' : 'votes'}
                </span>
              </motion.div>
            ))}
          </div>

          <p className="text-[11px] font-semibold text-neutral-400 mt-3 leading-relaxed">
            {results?.whyHint ||
              `The best category scores +${results?.revCatPointsBest ?? 2}, and anyone who voted for it gains +${results?.revCatPointsVoter ?? 1}.`}
          </p>
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
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
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
              subtext="Three brand-new unrelated items"
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
