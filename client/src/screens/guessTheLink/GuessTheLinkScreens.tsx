/**
 * Guess the Link screens: get-ready, live guessing and results.
 *
 * Every screen reads the server-authoritative `room.gtlState`; the link and the
 * item names are simply absent from it until the results phase, so the client
 * cannot leak them early. Images degrade to their emoji tile when missing.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, Lightbulb, Trophy, X } from 'lucide-react';
import { PlayerPrivateState, RoomPublicState, Player } from '@shared/types';
import { Timer } from '../../components/Timer';
import { Button } from '../../components/Button';
import { TeamLeaderboard } from '../../components/TeamLeaderboard';

interface ScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  /** Present for hosts who can skip the get-ready beat. */
  onAdvance?: () => void;
  onHostSkip?: () => void;
}

function ClueTile({
  emoji,
  url,
  label,
  onOpen,
}: {
  emoji: string;
  url: string | null;
  label: string;
  onOpen: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex-1 min-h-0 rounded-2xl overflow-hidden party-card flex items-center justify-center"
      aria-label={label}
    >
      {url && !broken ? (
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-6xl" role="img" aria-label={label}>
          {emoji}
        </span>
      )}
    </button>
  );
}

/** Get ready: three clues on screen with the countdown. */
export function GtlHintRevealScreen({ room }: ScreenProps) {
  const state = room.gtlState;
  const [zoom, setZoom] = useState<number | null>(null);
  return (
    <div className="flex-1 flex flex-col p-5 max-w-md mx-auto w-full gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
          Round {state?.roundNumber ?? 1} / {state?.roundCount ?? 6}
        </span>
        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> Get ready
        </span>
      </div>
      {room.timer && (
        <Timer
          secondsRemaining={room.timer.remainingSeconds}
          totalDuration={room.timer.durationSeconds}
          label="Starting in"
        />
      )}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {(state?.clues ?? []).map((clue, index) => (
          <ClueTile
            key={index}
            emoji={clue.emoji}
            url={clue.imageUrl}
            label={`Clue image ${index + 1} of 3`}
            onOpen={() => setZoom(index)}
          />
        ))}
      </div>
      <p className="text-center text-sm font-semibold text-neutral-500 dark:text-neutral-400">
        Three pictures. One hidden link.
      </p>
      {zoom !== null && state?.clues[zoom] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          {state.clues[zoom].imageUrl ? (
            <img
              src={state.clues[zoom].imageUrl!}
              alt={`Clue image ${zoom + 1} of 3`}
              className="max-w-full max-h-full rounded-2xl"
            />
          ) : (
            <span className="text-[10rem]" role="img" aria-label={`Clue image ${zoom + 1} of 3`}>
              {state.clues[zoom].emoji}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Live guessing with attempts, verdicts, hint and the public solve feed. */
export function GtlGuessScreen({
  room,
  privateState,
  onGuess,
}: ScreenProps & { onGuess: (guess: string) => void }) {
  const state = room.gtlState;
  const [guess, setGuess] = useState('');
  const [wrongShake, setWrongShake] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [sent, setSent] = useState(0);
  const verdicts = privateState.gtlVerdicts ?? [];
  const attemptsLeft = privateState.gtlAttemptsLeft ?? state?.attempts ?? 3;
  const solved = Boolean(privateState.gtlSolved);

  useEffect(() => {
    if (verdicts.length === 0 || verdicts[verdicts.length - 1]) return;
    setWrongShake(true);
    const id = setTimeout(() => setWrongShake(false), 420);
    return () => clearTimeout(id);
  }, [verdicts.length, sent]);

  const dots = useMemo(() => Array.from({ length: state?.attempts ?? 3 }), [state?.attempts]);

  const submit = () => {
    const text = guess.trim();
    if (!text || solved || attemptsLeft <= 0) return;
    onGuess(text);
    setGuess('');
    setSent((value) => value + 1);
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full min-h-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
          Round {state?.roundNumber ?? 1} / {state?.roundCount ?? 6}
        </span>
        <span className="flex items-center gap-1">
          {dots.map((_, index) => (
            <span
              key={index}
              className={`w-2.5 h-2.5 rounded-full ${
                index < attemptsLeft ? 'bg-[var(--accent)]' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            />
          ))}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 h-[42vh] shrink-0">
        {(state?.clues ?? []).map((clue, index) => (
          <ClueTile
            key={index}
            emoji={clue.emoji}
            url={clue.imageUrl}
            label={`Clue image ${index + 1} of 3`}
            onOpen={() => setZoom(index)}
          />
        ))}
      </div>

      {state?.hint && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-3 py-2 text-sm font-semibold">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
          {state.hint}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 min-h-6">
        {(state?.solved ?? []).map((entry) => (
          <motion.span
            key={entry.rowId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
          >
            {entry.name} got it! +{entry.points}
          </motion.span>
        ))}
      </div>

      <div className="mt-auto pt-3">
        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Guess the link"
          />
        )}
        {solved ? (
          <div className="mt-2 text-center text-sm font-black text-emerald-600 dark:text-emerald-400">
            You got it — waiting for the round to end
          </div>
        ) : attemptsLeft <= 0 ? (
          <div className="mt-2 text-center text-sm font-black text-neutral-500">
            Out of attempts — watching the round play out
          </div>
        ) : (
          <div className={`mt-2 flex gap-2 ${wrongShake ? 'animate-pulse' : ''}`}>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
              maxLength={40}
              placeholder="What links all three?"
              className="flex-1 min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"
            />
            <Button onClick={submit} disabled={!guess.trim()}>
              Guess
            </Button>
          </div>
        )}
      </div>

      {zoom !== null && state?.clues[zoom] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          {state.clues[zoom].imageUrl ? (
            <img
              src={state.clues[zoom].imageUrl!}
              alt={`Clue image ${zoom + 1} of 3`}
              className="max-w-full max-h-full rounded-2xl"
            />
          ) : (
            <span className="text-[10rem]" role="img" aria-label={`Clue image ${zoom + 1} of 3`}>
              {state.clues[zoom].emoji}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Results: the link, the three items, solve order and host overrules. */
export function GtlResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
  onOverrule,
}: ScreenProps & {
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
  onOverrule?: (index: number) => void;
}) {
  const state = room.gtlState;
  const standings = room.results?.standings ?? [];
  const isHost = myPlayer.isHost;

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full">
      <div className="text-center mb-4">
        <p className="text-xs font-black uppercase tracking-widest text-neutral-500">The link was</p>
        <h2 className="text-3xl font-black text-[var(--text-primary)]">{state?.link}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(state?.items ?? []).map((item, index) => (
          <div key={index} className="party-card rounded-2xl overflow-hidden">
            <div className="aspect-square flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.caption} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">{item.emoji}</span>
              )}
            </div>
            <p className="text-[11px] font-bold text-center p-1.5 truncate">{item.name}</p>
          </div>
        ))}
      </div>

      <div className="party-card rounded-2xl p-3 mb-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" /> Solve order
        </h3>
        {(state?.solved ?? []).length === 0 ? (
          <p className="text-sm font-semibold text-neutral-500">Nobody solved it this round.</p>
        ) : (
          <ol className="space-y-1">
            {state!.solved.map((entry, index) => (
              <li key={entry.rowId} className="flex items-center justify-between text-sm font-bold">
                <span>
                  {index + 1}. {entry.name}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">+{entry.points}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {isHost && (state?.wrongGuesses ?? []).some((guess) => !guess.overruled) && (
        <div className="party-card rounded-2xl p-3 mb-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-2">
            Close calls — mark as correct (+1)
          </h3>
          <div className="space-y-1.5">
            {state!.wrongGuesses.map((entry, index) =>
              entry.overruled ? null : (
                <button
                  key={index}
                  type="button"
                  onClick={() => onOverrule?.(index)}
                  className="w-full flex items-center justify-between gap-2 text-left text-sm font-semibold px-2 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800"
                >
                  <span className="truncate">
                    {entry.name}: “{entry.guess}”
                  </span>
                  <X className="w-4 h-4 shrink-0 text-neutral-400" />
                </button>
              )
            )}
          </div>
        </div>
      )}

      {room.playMode === 'team' && room.results?.teamStandings && (
        <div className="mb-4">
          <TeamLeaderboard rows={room.results.teamStandings} />
        </div>
      )}

      <div className="party-card rounded-2xl p-3 mb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-2">Standings</h3>
        <ol className="space-y-1">
          {standings.map((entry) => (
            <li key={entry.playerId} className="flex items-center justify-between text-sm font-bold">
              <span>
                {entry.rank}. {entry.playerName}
              </span>
              <span>
                {entry.totalScore}
                {entry.pointsAdded > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400"> (+{entry.pointsAdded})</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2 pb-6">
        {room.results?.gameOver ? (
          <Button className="w-full" onClick={onEndSession}>
            See final standings
          </Button>
        ) : (
          <Button className="w-full" onClick={onNextRound}>
            Next round
          </Button>
        )}
        <Button variant="secondary" className="w-full" onClick={onReturnToLobby}>
          Back to lobby
        </Button>
      </div>
    </div>
  );
}
