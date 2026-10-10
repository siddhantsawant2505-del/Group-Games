import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { RevealCard } from '../components/RevealCard';
import { ActionButton } from '../components/ActionButton';

/**
 * Optional copy overrides so a game can reuse this screen with its own framing
 * (Reverse Categories votes on categories rather than accusing the impostor).
 * Every field falls back to the impostor-round wording.
 */
export interface RevealAnswersCopy {
  badge?: string;
  title?: string;
  subtitle?: string;
  timerLabel?: string;
  actionLabel?: string;
  actionSubtext?: string;
  waitingLabel?: string;
}

interface RevealAnswersScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onAdvance: () => void;
  copy?: RevealAnswersCopy;
}

export function RevealAnswersScreen({
  room,
  myPlayer,
  onAdvance,
  copy = {},
}: RevealAnswersScreenProps) {
  const isHost = myPlayer.isHost;
  // Local reveal override toggles if host wants to reveal one by one
  const [hiddenCards, setHiddenCards] = useState<Record<string, boolean>>({});

  const toggleCard = (pId: string) => {
    setHiddenCards((prev) => ({
      ...prev,
      [pId]: !prev[pId],
    }));
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header & Timer */}
      <div>
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{copy.badge || 'Answers Revealed'}</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            {copy.title || 'Review the Clues'}
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {copy.subtitle || 'Compare responses to spot whoever is bluffing'}
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label={copy.timerLabel || 'Reading Clues'}
          />
        )}

        {/* List of Reveal Cards */}
        <div className="space-y-3 mt-4">
          {room.revealedAnswers.map((ans, idx) => {
            const isRevealed = !hiddenCards[ans.playerId];
            return (
              <RevealCard
                key={ans.playerId}
                playerName={ans.playerName}
                playerColorIndex={ans.colorIndex}
                answerText={ans.answerText}
                revealed={isRevealed}
                subtext={ans.subtext}
                isHost={isHost}
                onToggleReveal={() => toggleCard(ans.playerId)}
                indexDelay={idx}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom control */}
      <div className="pt-5 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext={copy.actionSubtext || 'Start discussion phase'}
          >
            {copy.actionLabel || 'Start Discussion'}
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              {copy.waitingLabel || 'Discussion starts when timer runs out...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
