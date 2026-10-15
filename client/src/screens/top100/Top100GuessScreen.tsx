import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Lightbulb, Lock, ListOrdered, MessageSquarePlus, Users2 } from 'lucide-react';
import { Player, PlayerPrivateState, RoomPublicState, Top100Suggestion } from '@shared/types';
import { Timer } from '../../components/Timer';
import { ActionButton } from '../../components/ActionButton';
import { PlayerChip } from '../../components/PlayerChip';
import { getPlayerColor } from '@shared/theme/tokens';

interface Top100GuessScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  /** Locks this player's guess (solo) or the team's guess (captain). */
  onSubmitAnswer: (answer: string) => void;
  /** Team mode: a short suggestion only this team sees. */
  onSendSuggestion?: (text: string) => void;
  /** Host-only: opens the guesses board early. */
  onHostSkip?: () => void;
}

const MAX_GUESS_CHARS = 60;
const MAX_SUGGESTION_CHARS = 30;

/**
 * Top 100 — Guess (input phase).
 * Free text only: no autocomplete and nothing derived from the hidden list ever
 * reaches this screen. In team mode the captain types the team's single guess
 * while their teammates send suggestions only their own team can read.
 */
export function Top100GuessScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
  onSendSuggestion,
  onHostSkip,
}: Top100GuessScreenProps) {
  const state = room.top100State;
  const [guess, setGuess] = useState(privateState.top100GuessText || '');
  const [suggestion, setSuggestion] = useState('');
  const [pending, setPending] = useState(false);

  if (!state) return null;

  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const isTeamMode = room.playMode === 'team' && room.teams.length > 0;
  const isCaptain = !isTeamMode || Boolean(privateState.top100IsCaptain);
  const locked = Boolean(privateState.top100GuessSubmitted);
  const lockedText = privateState.top100GuessText || '';
  const captainName = privateState.top100CaptainName || 'the captain';
  const suggestions: Top100Suggestion[] = privateState.top100Suggestions || [];
  const suggestionsLeft = privateState.top100SuggestionsLeft ?? 0;
  const myTeamRowId = myPlayer.teamId;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = guess.replace(/\s+/g, ' ').trim();
    if (!trimmed || pending || locked) return;
    setPending(true);
    onSubmitAnswer(trimmed);
  };

  const sendSuggestion = () => {
    const trimmed = suggestion.replace(/\s+/g, ' ').trim();
    if (!trimmed || suggestionsLeft <= 0 || !onSendSuggestion) return;
    onSendSuggestion(trimmed.slice(0, MAX_SUGGESTION_CHARS));
    setSuggestion('');
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black"
            style={{
              backgroundColor: `${playerColor.hex}18`,
              borderColor: playerColor.hex,
              color: 'var(--text-primary)',
            }}
          >
            <ListOrdered className="w-3.5 h-3.5" style={{ color: playerColor.hex }} />
            <span>
              Round {state.roundNumber} of {state.roundCount}
            </span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {state.submittedIds.length} / {state.guesserIds.length} locked in
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label={isTeamMode ? 'Captains lock in by' : 'Guess deadline'}
          />
        )}
      </div>

      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-5 rounded-3xl my-auto space-y-4"
        style={{ boxShadow: `0 8px 24px ${playerColor.hex}15` }}
      >
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
            Name something on this list
          </span>
          <h2 className="text-lg font-black text-[var(--text-primary)] leading-snug break-words">
            {state.question}
          </h2>
          <span className="text-[11px] font-semibold text-neutral-400 mt-1 block">
            Position N scores N points · off the list scores 0
            {state.duplicatePolicy === 'zero' ? ' · duplicates score nothing' : ''}
          </span>
        </div>

        {isCaptain ? (
          locked ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center flex flex-col items-center gap-1.5">
              <Lock className="w-7 h-7 text-emerald-500" />
              <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                {isTeamMode ? 'Your team is locked in' : 'Guess locked in!'}
              </span>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 break-words">
                “{lockedText}”
              </p>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Nobody sees it until the guesses board
              </span>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <input
                type="text"
                maxLength={MAX_GUESS_CHARS}
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder={isTeamMode ? "Your team's one guess…" : 'Your guess…'}
                aria-label="Your guess"
                autoFocus
                className="w-full p-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-black text-lg text-[var(--text-primary)] text-center tracking-wide focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
              />
              <div className="flex justify-between text-xs text-neutral-400 px-1">
                <span>
                  {isTeamMode ? `Only you (captain) can lock it` : 'Close spellings count'}
                </span>
                <span>
                  {guess.length}/{MAX_GUESS_CHARS}
                </span>
              </div>

              <ActionButton
                type="submit"
                variant="personal"
                playerColorIndex={myPlayer.colorIndex}
                disabled={!guess.trim()}
                loading={pending && !locked}
                loadingText="Locking in…"
                icon={<Lock className="w-5 h-5" />}
                subtext={isTeamMode ? 'Locks your team in' : 'Private until the reveal'}
              >
                {isTeamMode ? 'Lock Team Guess' : 'Lock In Guess'}
              </ActionButton>
            </form>
          )
        ) : (
          <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-[var(--border-subtle)] text-center">
            <Crown className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <p className="text-sm font-black text-[var(--text-primary)]">
              {captainName} will lock the team&apos;s guess
            </p>
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
              Send suggestions below — only your team sees them.
            </p>
          </div>
        )}

        {/* Team-only suggestions: the captain's input, the teammates' ideas. */}
        {isTeamMode && (
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
              <Users2 className="w-3.5 h-3.5" />
              <span>Team suggestions (private)</span>
            </span>

            <div className="space-y-1.5 mb-2">
              {suggestions.length === 0 ? (
                <p className="text-[11px] font-semibold text-neutral-400">
                  Nothing suggested yet — the captain uses the last idea if the timer runs out.
                </p>
              ) : (
                suggestions.map((item) => (
                  <div
                    key={`${item.playerId}-${item.sequence}`}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="font-black text-[var(--text-primary)] shrink-0">
                      {item.playerName}:
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-300 break-words">
                      {item.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            {onSendSuggestion && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={MAX_SUGGESTION_CHARS}
                  value={suggestion}
                  onChange={(event) => setSuggestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      sendSuggestion();
                    }
                  }}
                  disabled={suggestionsLeft <= 0}
                  placeholder={
                    suggestionsLeft > 0
                      ? `Suggestion (${MAX_SUGGESTION_CHARS} chars)`
                      : 'No suggestions left'
                  }
                  aria-label="Team suggestion"
                  className="flex-1 px-3 py-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 font-bold text-sm text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={sendSuggestion}
                  disabled={!suggestion.trim() || suggestionsLeft <= 0}
                  aria-label="Send suggestion"
                  className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <MessageSquarePlus className="w-5 h-5" />
                </button>
              </div>
            )}

            {onSendSuggestion && (
              <p className="text-[10px] font-semibold text-neutral-400 mt-1">
                {suggestionsLeft} of 5 suggestions left this round
              </p>
            )}
          </div>
        )}

        {/* Who is still thinking */}
        <div className="pt-3 border-t border-[var(--border-subtle)]">
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 block mb-2">
            {isTeamMode ? 'Teams:' : 'Who has locked in:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {isTeamMode
              ? room.teams.map((team) => {
                  const done = state.submittedIds.includes(team.id);
                  const captain = room.players.find(
                    (player) => player.id === state.captains[team.id]
                  );
                  return (
                    <PlayerChip
                      key={team.id}
                      name={`${team.icon} ${team.name}${captain ? ` · ${captain.name}` : ''}`}
                      colorIndex={team.accentIndex}
                      isYou={team.id === myTeamRowId}
                      status={done ? 'submitted' : 'idle'}
                      size="sm"
                    />
                  );
                })
              : room.players.map((player) => (
                  <PlayerChip
                    key={player.id}
                    name={player.name}
                    colorIndex={player.colorIndex}
                    isYou={player.id === myPlayer.id}
                    status={state.submittedIds.includes(player.id) ? 'submitted' : 'idle'}
                    size="sm"
                  />
                ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Big lists stay secret — only the guesses board is revealed.</span>
        </div>
      </motion.div>

      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: close guessing now
          </button>
        </div>
      )}
    </div>
  );
}
