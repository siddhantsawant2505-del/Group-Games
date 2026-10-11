import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, MessageSquare, Vote, HelpCircle } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface DiscussionPhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onAdvanceToVote: () => void;
  /**
   * Impostor question mode only: the player's own question, re-openable on their
   * own screen. Never send another player's question here.
   */
  ownQuestion?: string;
}

export function DiscussionPhaseScreen({
  room,
  myPlayer,
  onAdvanceToVote,
  ownQuestion,
}: DiscussionPhaseScreenProps) {
  const isHost = myPlayer.isHost;
  const [showOwnQuestion, setShowOwnQuestion] = useState(false);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header and Timer */}
      <div>
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
            <span>Open Floor</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            Discussion Phase
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Talk out loud with your friends!
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Discussion Timer"
          />
        )}
      </div>

      {/* Impostor question mode: re-open your own question, nobody else's */}
      {ownQuestion && (
        <div className="party-card p-3 rounded-2xl mt-3">
          <button
            type="button"
            onClick={() => setShowOwnQuestion((prev) => !prev)}
            className="w-full flex items-center justify-between gap-2 cursor-pointer"
            aria-expanded={showOwnQuestion}
          >
            <span className="text-xs font-black text-[var(--text-primary)]">
              Your own question
            </span>
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 transition-transform ${
                showOwnQuestion ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showOwnQuestion && (
            <p className="text-sm font-bold text-[var(--text-primary)] mt-2 leading-snug">
              “{ownQuestion}”
            </p>
          )}
        </div>
      )}

      {/* Clue list from phase 3 kept visible during discussion */}
      <div className="my-auto space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
            Submitted Clues ({room.revealedAnswers.length})
          </span>
          <span className="text-xs font-bold text-neutral-400">
            Randomized Order
          </span>
        </div>

        <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
          {room.revealedAnswers.map((item, idx) => (
            <motion.div
              key={item.playerId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="party-card p-3.5 rounded-2xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <PlayerAvatar
                  name={item.playerName}
                  colorIndex={item.colorIndex}
                  size="sm"
                  isHost={item.subtext === 'Host'}
                />
                <span className="font-extrabold text-sm text-[var(--text-primary)]">
                  {item.playerName}
                  {item.playerId === myPlayer.id && ' (You)'}
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)] text-right">
                <span className="text-base font-black text-[var(--text-primary)] tracking-wide">
                  "{item.answerText}"
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400">
          {ownQuestion
            ? 'Compare answers out loud: whose answer fits a different question?'
            : 'Discuss out loud with your group: whose clue feels fake or out of place?'}
        </p>
      </div>

      {/* Bottom control: host or any player can skip early */}
      <div className="pt-4">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvanceToVote}
            icon={<Vote className="w-5 h-5" />}
            subtext="Ready to convict? Advance everyone to vote"
          >
            Start Voting Now
          </ActionButton>
        ) : (
          <ActionButton
            variant="subtle"
            onClick={onAdvanceToVote}
            icon={<Vote className="w-4 h-4" />}
            subtext="Skip remaining discussion and start voting"
          >
            Ready to Vote (Skip Early)
          </ActionButton>
        )}
      </div>
    </div>
  );
}
