import { motion } from 'motion/react';
import { ArrowRight, Eye, HelpCircle, Lightbulb, Shuffle, Sparkles } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { getPlayerColor } from '@shared/theme/tokens';

interface RevCatItemsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onAdvance: () => void;
}

/** Each of the three items gets its own accent so the triplet reads clearly. */
const ITEM_COLOR_INDEXES = [1, 2, 4];

/**
 * Reverse Categories — Item Reveal.
 * All three items are public: there is no secret in this game, so every player
 * stares at the exact same board before inventing a category.
 */
export function RevCatItemsScreen({ room, myPlayer, onAdvance }: RevCatItemsScreenProps) {
  const isHost = myPlayer.isHost;
  const revCat = room.revCatState;
  const items = revCat?.items || [];
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {room.roundNumber} • {room.selectedGame?.title || 'Reverse Categories'}
          </span>

          <span className="text-xs font-bold flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
            <Eye className="w-3.5 h-3.5" />
            <span>Everyone sees these</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Look at the Items"
          />
        )}
      </div>

      {/* The three items */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
        className="party-card p-6 rounded-3xl my-auto"
        style={{ boxShadow: `0 10px 28px ${playerColor.hex}1F` }}
      >
        <span className="text-center text-xs font-black uppercase tracking-widest block mb-4 text-neutral-400">
          Your Three Items
        </span>

        <div className="space-y-2.5">
          {items.map((item, index) => {
            const color = getPlayerColor(ITEM_COLOR_INDEXES[index % ITEM_COLOR_INDEXES.length]);
            return (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.12, type: 'spring', stiffness: 380, damping: 24 }}
                className="flex items-center gap-3 p-3.5 rounded-2xl border"
                style={{
                  backgroundColor: `${color.hex}14`,
                  borderColor: `${color.hex}55`,
                }}
              >
                <span
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ backgroundColor: color.hex, color: color.contrastText }}
                >
                  {index + 1}
                </span>
                <span className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                  {item}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-left flex items-start gap-2">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <p className="text-xs font-semibold leading-relaxed text-neutral-600 dark:text-neutral-300">
            Invent one category name that cleverly links all three. It does not have to be logical —
            funny, absurd, or oddly perfect all work.
          </p>
        </div>

        {myPlayer.isHost && (
          <p className="text-[11px] font-bold text-neutral-400 text-center mt-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Nobody has a secret this round — argue openly!</span>
          </p>
        )}
      </motion.div>

      {/* Host advance */}
      <div className="pt-4 space-y-2">
        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Next: everyone invents their own category name.</span>
        </p>

        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Ready? Skip the timer when everyone has looked"
          >
            Everyone Writes Now
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center flex items-center justify-center gap-2">
            <Shuffle className="w-3.5 h-3.5 text-neutral-400" />
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Waiting for the host to open the writing phase...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
