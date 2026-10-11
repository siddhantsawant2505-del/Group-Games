import { motion } from 'motion/react';
import { ArrowRight, HelpCircle, MessageCircleQuestion, ShieldQuestion } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState, AnswerType } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';

interface ImpostorQuestionRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

const ANSWER_HINTS: Record<AnswerType, string> = {
  player: 'You will tap a player.',
  text: 'You will write a short answer.',
  number: 'You will give a number.',
  choice: 'You will pick one option.',
};

/**
 * Impostor question mode — reveal phase.
 *
 * Shows the player ONLY their own question. Nothing here may hint that another
 * version of the question exists: discovering that is the entire game.
 */
export function ImpostorQuestionRevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: ImpostorQuestionRevealScreenProps) {
  const answerType = privateState.impostorAnswerType || room.impostorQuestionState?.answerType || 'text';
  const question = privateState.impostorQuestion || 'Waiting for your question...';

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
            <ShieldQuestion className="w-3.5 h-3.5" />
            <span>Only Your Question</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">Your Question</h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Keep your screen hidden from friends!
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Reveal Window"
          />
        )}

        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="party-card p-5 rounded-3xl mt-4 text-center border border-[var(--border-subtle)]"
        >
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <MessageCircleQuestion className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Your Question
            </span>
          </div>
          <p className="text-xl font-black text-[var(--text-primary)] leading-snug">“{question}”</p>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-2">
            {ANSWER_HINTS[answerType]}
          </p>
        </motion.div>

        <div className="party-card p-4 rounded-2xl mt-3">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {privateState.secretInstructions ||
              'Answer privately — nobody sees your answer until the reveal.'}
          </p>
        </div>
      </div>

      <div className="pt-5">
        {myPlayer.isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Ready? Skip waiting for timer"
          >
            Proceed to Answer Phase
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Answering starts when the timer runs out...
            </p>
          </div>
        )}
        <p className="text-[10px] font-semibold text-neutral-400 text-center mt-2 flex items-center justify-center gap-1">
          <HelpCircle className="w-3 h-3" />
          Read the question carefully before you answer.
        </p>
      </div>
    </div>
  );
}
