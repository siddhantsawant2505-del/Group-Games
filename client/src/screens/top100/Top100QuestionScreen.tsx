import { motion } from 'motion/react';
import { ArrowRight, Hash, ListOrdered, Sparkles } from 'lucide-react';
import { Player, RoomPublicState } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { top100CategoryLabel } from '@shared/data/top100Categories';

interface Top100QuestionScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  /** Host-only: opens the guess phase early. */
  onAdvance?: () => void;
}

/**
 * Top 100 — Question (reveal phase).
 * The list itself stays on the server; this screen shows the question, its
 * category and how the round scores.
 */
export function Top100QuestionScreen({ room, myPlayer, onAdvance }: Top100QuestionScreenProps) {
  const state = room.top100State;
  if (!state) return null;

  const isTeamMode = room.playMode === 'team' && room.teams.length > 0;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="text-center pt-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-black text-neutral-600 dark:text-neutral-400">
          <Hash className="w-3.5 h-3.5" />
          <span>
            Round {state.roundNumber} of {state.roundCount}
          </span>
        </span>
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="party-card p-6 rounded-3xl my-auto text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto mb-3">
          <ListOrdered className="w-6 h-6" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400">
            {top100CategoryLabel(state.category)}
          </span>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            {state.asOf}
          </span>
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
          The Top 100
        </span>
        <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] leading-tight break-words">
          {state.question}
        </h2>

        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-4">
          Name something that is on the Top 100. The deeper it ranks, the more points you get. If
          it isn&apos;t on the list, you get 0.
        </p>

        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400 mt-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>
            {isTeamMode
              ? 'One guess per team — the captain locks it'
              : `One guess each — ${state.guessSeconds}s to think`}
          </span>
        </div>
      </motion.div>

      {myPlayer.isHost && onAdvance && (
        <div className="pt-3">
          <ActionButton
            variant="personal"
            playerColorIndex={myPlayer.colorIndex}
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Or wait for the timer"
          >
            Open the Guess Phase
          </ActionButton>
        </div>
      )}
    </div>
  );
}
