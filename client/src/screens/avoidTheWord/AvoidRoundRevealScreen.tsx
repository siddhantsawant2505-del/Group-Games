import { motion } from 'motion/react';
import { ArrowRight, Check, Crown, Skull, Sparkles, UserX, Wand2 } from 'lucide-react';
import { AvoidAnswerRow, Player, RoomPublicState } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';

interface AvoidRoundRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onOverrule: (targetPlayerId: string, countAsMatch: boolean) => void;
  onContinue: () => void;
}

/**
 * Avoid the Word — Round Reveal.
 * Every answer is public here, matches are highlighted, and the host can settle
 * close calls (synonyms, typos) before the eliminations actually apply.
 */
export function AvoidRoundRevealScreen({
  room,
  myPlayer,
  onOverrule,
  onContinue,
}: AvoidRoundRevealScreenProps) {
  const avoid = room.avoidState;
  const rows = avoid?.rows || [];
  const question = avoid?.questionText || '';
  const anchorAnswer = avoid?.anchorAnswer || '';
  const overrules = avoid?.overrules || {};
  const isHost = myPlayer.isHost;

  const effectiveMatch = (row: AvoidAnswerRow) =>
    overrules[row.playerId] !== undefined ? overrules[row.playerId] : row.matched;

  const toBeEliminated = rows.filter((row) => !row.isAnchor && effectiveMatch(row));
  const myRow = rows.find((row) => row.playerId === myPlayer.id);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="pb-3">
        <div className="text-center mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-black text-neutral-600 dark:text-neutral-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Round {avoid?.roundNumber ?? room.roundNumber} of {avoid?.roundCap ?? 10} — Reveal
            </span>
          </span>

          <h2 className="text-lg font-black tracking-tight text-[var(--text-primary)] leading-snug">
            {question || 'The round is revealed'}
          </h2>
        </div>

        {/* The anchor's hidden answer, finally public */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
          className="party-card p-4 rounded-3xl mb-3 text-center border border-amber-300/60 dark:border-amber-800/60"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5 mb-1">
            <Crown className="w-3.5 h-3.5" />
            <span>{avoid?.anchorPlayerName || 'The anchor'} answered</span>
          </span>
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)] break-words">
            “{anchorAnswer}”
          </p>
        </motion.div>

        {/* Every answer, matches highlighted */}
        <div className="party-card p-4 rounded-3xl mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2 text-left">
            Every answer
          </span>

          <div className="space-y-2">
            {rows.map((row, index) => {
              const matched = effectiveMatch(row);
              const overruled = overrules[row.playerId];
              const isAnchor = row.isAnchor;

              return (
                <motion.div
                  key={row.playerId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="p-2.5 rounded-2xl border flex flex-col gap-1.5"
                  style={{
                    backgroundColor: isAnchor
                      ? 'rgba(245, 158, 11, 0.10)'
                      : matched
                      ? 'rgba(239, 68, 68, 0.10)'
                      : 'var(--surface-card-subtle)',
                    borderColor: isAnchor
                      ? 'rgba(245, 158, 11, 0.4)'
                      : matched
                      ? 'rgba(239, 68, 68, 0.4)'
                      : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar
                      name={row.playerName}
                      colorIndex={row.colorIndex}
                      size="sm"
                      isHost={room.players.find((p) => p.id === row.playerId)?.isHost}
                    />

                    <div className="min-w-0 flex-1 text-left">
                      <span className="text-sm font-extrabold text-[var(--text-primary)] block leading-tight truncate">
                        {row.playerName}
                        {row.playerId === myPlayer.id && ' (You)'}
                        {isAnchor && ' · Anchor'}
                      </span>
                      <span className="text-base font-black text-[var(--text-primary)] block break-words">
                        {row.answer}
                      </span>
                      {row.answeredPlayerName && (
                        <span className="text-[11px] font-semibold text-neutral-400 block">
                          {row.answeredPlayerName}
                        </span>
                      )}
                    </div>

                    {!isAnchor && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black ${
                          matched
                            ? 'bg-red-500/15 text-red-500'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {matched ? (
                          <>
                            <Skull className="w-3.5 h-3.5" />
                            <span>Matched</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>{row.skipped ? 'Skipped' : 'Safe'}</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Host overrule: settle a close call before it counts */}
                  {isHost && !isAnchor && !row.skipped && (
                    <div className="flex items-center gap-1.5 pl-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                        <Wand2 className="w-3 h-3" />
                        <span>Overrule</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => onOverrule(row.playerId, true)}
                        aria-pressed={overruled === true}
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer transition-colors ${
                          overruled === true
                            ? 'bg-red-500 text-white border-transparent'
                            : 'border-[var(--border-subtle)] text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        Count as match
                      </button>

                      <button
                        type="button"
                        onClick={() => onOverrule(row.playerId, false)}
                        aria-pressed={overruled === false}
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer transition-colors ${
                          overruled === false
                            ? 'bg-emerald-500 text-white border-transparent'
                            : 'border-[var(--border-subtle)] text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        Not a match
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Elimination preview */}
        <div
          className="p-3 rounded-2xl border flex items-start gap-2.5"
          style={{
            backgroundColor: toBeEliminated.length
              ? 'rgba(239, 68, 68, 0.10)'
              : 'var(--surface-card-subtle)',
            borderColor: toBeEliminated.length
              ? 'rgba(239, 68, 68, 0.35)'
              : 'var(--border-subtle)',
          }}
        >
          <UserX
            className="w-4 h-4 shrink-0 mt-0.5"
            style={{ color: toBeEliminated.length ? '#DC2626' : '#A3A3A3' }}
          />
          <div className="text-left min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
              Eliminated when the host continues
            </span>
            <span className="text-sm font-black text-[var(--text-primary)]">
              {toBeEliminated.length
                ? toBeEliminated.map((row) => row.playerName).join(', ')
                : 'Nobody matched — everyone survives this round.'}
            </span>
            {myRow && !myRow.isAnchor && (
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mt-0.5">
                You {effectiveMatch(myRow) ? 'matched — you are out' : 'are safe'}.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pt-3">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onContinue}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Applies the eliminations and deals the next round"
          >
            Continue
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Waiting for the host to continue...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
