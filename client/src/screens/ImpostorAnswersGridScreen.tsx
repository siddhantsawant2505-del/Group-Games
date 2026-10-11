import { motion } from 'motion/react';
import { ArrowRight, Shuffle, UserRound } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface ImpostorAnswersGridScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onAdvance: () => void;
}

/**
 * Impostor question mode — the answer board.
 *
 * Every answer in shuffled order. Neither question appears here: the table has
 * to work out whose answer fits a different question. Answers of type 'player'
 * render as the named player's chip instead of raw text.
 */
export function ImpostorAnswersGridScreen({
  room,
  myPlayer,
  onAdvance,
}: ImpostorAnswersGridScreenProps) {
  const isHost = myPlayer.isHost;
  const answerType = room.impostorQuestionState?.answerType || 'text';

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">
            <Shuffle className="w-3.5 h-3.5 text-amber-500" />
            <span>Answers Revealed</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">The Answer Board</h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            One of these answers was written for a different question
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Reading Answers"
          />
        )}

        <div className="space-y-3 mt-4 max-h-[58vh] overflow-y-auto pr-1">
          {room.revealedAnswers.map((answer, idx) => {
            const answeredPlayer = answer.answeredPlayerId
              ? room.players.find((p) => p.id === answer.answeredPlayerId)
              : undefined;
            return (
              <motion.div
                key={answer.playerId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="party-card p-3.5 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    name={answer.playerName}
                    colorIndex={answer.colorIndex}
                    size="sm"
                    isHost={answer.subtext === 'Host'}
                  />
                  <span className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                    {answer.playerName}
                    {answer.playerId === myPlayer.id && ' (You)'}
                  </span>
                </div>

                {answerType === 'player' && answeredPlayer ? (
                  <PlayerChip
                    name={answeredPlayer.name}
                    colorIndex={answeredPlayer.colorIndex}
                    isHost={answeredPlayer.isHost}
                    isYou={answeredPlayer.id === myPlayer.id}
                    size="sm"
                  />
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)] text-right shrink-0">
                    <span className="text-base font-black text-[var(--text-primary)] tracking-wide">
                      "{answer.answerText}"
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400 mt-3 flex items-center justify-center gap-1.5">
          <UserRound className="w-3.5 h-3.5" />
          Whose answer would make perfect sense for a slightly different question?
        </p>
      </div>

      <div className="pt-5">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Start discussion phase"
          >
            Start Discussion
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Discussion starts when the timer runs out...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
