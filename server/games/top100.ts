/**
 * Top 100 Game Module.
 * Server-authoritative logic for dealing every player a unique secret number
 * on a 1-100 spectrum, collecting their written examples, running a live
 * host-authoritative ordering phase, and scoring how close that ordering came
 * to the true numeric order.
 *
 * Flow: reveal -> input -> reveal-answers -> rank -> results
 */

import {
  TOP100_PROMPTS,
  Top100Prompt,
  botExampleForNumber,
  dealTop100Numbers,
  getRandomTop100Prompt,
  top100SpectrumText,
} from '../../shared/data/top100Prompts';
import { InternalRoom } from '../roomManager';
import { PlayerResultStanding, RevealedAnswer, Top100OrderEntry, Top100PublicState } from '../../shared/types';

/** Seconds players get to write an example that fits their secret number. */
export const TOP100_INPUT_SECONDS = 45;

/** Seconds the examples sit on the board before the ranking phase opens. */
export const TOP100_REVEAL_SECONDS = 20;

/** Seconds the host gets to arrange the examples before results lock in. */
export const TOP100_RANK_SECONDS = 120;

/** An example is a short scenario, never an essay. */
export const TOP100_MAX_EXAMPLE_WORDS = 9;
export const TOP100_MAX_EXAMPLE_CHARS = 72;

/** Scoring: the table shares one accuracy score (the ordering is collaborative). */
export const TOP100_POINTS_PER_PAIR = 2;
export const TOP100_PERFECT_BONUS = 3;

export interface Top100RoundState {
  prompt: Top100Prompt;
  /** playerId -> unique secret number (1-100, no repeats this round). */
  numbers: Record<string, number>;
  /** playerId -> written example. */
  examples: Record<string, string>;
  /** The examples in the host's (or the initial shuffled) order. */
  order: string[];
  examplesCompiled: boolean;
  orderLocked: boolean;
  revealed: boolean;
  /** Spectrum ids already played in this room, so rounds stay fresh. */
  usedPromptIds: string[];
}

export interface Top100OrderOutcome {
  accepted: boolean;
  error?: string;
}

// In-memory store of active Top 100 round details per room
const activeRounds = new Map<string, Top100RoundState>();

export function getTop100RoundState(roomCode: string): Top100RoundState | undefined {
  return activeRounds.get(roomCode);
}

/** Fisher-Yates shuffle on a copy of the array. */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Example sanitizer: collapses whitespace and caps length so the ranking cards
 * stay readable (everyone at the table has to read all of them).
 */
export function sanitizeTop100Example(raw: string): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No example)';
  const words = cleaned.split(' ').slice(0, TOP100_MAX_EXAMPLE_WORDS);
  return words.join(' ').slice(0, TOP100_MAX_EXAMPLE_CHARS);
}

/**
 * 1. Reveal Phase
 * One spectrum prompt is picked server-side and every player privately receives
 * a UNIQUE secret number from 1-100. Nobody sees anyone else's number, and the
 * numbers are never repeated within a round.
 */
export function setupTop100Round(room: InternalRoom): void {
  const previous = activeRounds.get(room.code);
  const usedPromptIds = previous?.usedPromptIds || [];

  const prompt = getRandomTop100Prompt(usedPromptIds);
  const playerIds = room.players.map((p) => p.id);
  const numbers = dealTop100Numbers(playerIds);
  const spectrum = top100SpectrumText(prompt);

  const state: Top100RoundState = {
    prompt,
    numbers,
    examples: {},
    order: [],
    examplesCompiled: false,
    orderLocked: false,
    revealed: false,
    usedPromptIds: [...usedPromptIds, prompt.id].slice(-TOP100_PROMPTS.length),
  };

  activeRounds.set(room.code, state);
  room.privateData = {};

  room.players.forEach((player) => {
    const myNumber = numbers[player.id] ?? 1;
    room.privateData[player.id] = {
      role: 'Top 100 Ranker',
      top100Number: myNumber,
      top100PromptText: spectrum,
      top100LowLabel: prompt.lowLabel,
      top100HighLabel: prompt.highLabel,
      top100Category: prompt.category,
      secretHint: prompt.category,
      secretInstructions: `Your secret number is ${myNumber}. On this spectrum, ${myNumber} means something close to "${
        myNumber <= 50 ? prompt.lowLabel : prompt.highLabel
      }". Write a short example that fits your number — nobody sees the number, only your example.`,
      inputPlaceholder: 'A short example that fits your number...',
    };
  });

  syncTop100PublicState(room, state);
  room.phasePrompt = 'Read Your Secret Number';
  room.phaseSubprompt = 'Only your own number is on this screen — keep it hidden!';
}

/** Public state mirrored onto the room (numbers stay hidden until results). */
export function syncTop100PublicState(room: InternalRoom, state?: Top100RoundState): void {
  const active = state || activeRounds.get(room.code);
  if (!active) {
    room.top100State = null;
    return;
  }

  const order = active.order.length > 0 ? active.order : room.players.map((p) => p.id);

  const publicState: Top100PublicState = {
    category: active.prompt.category,
    promptText: top100SpectrumText(active.prompt),
    lowLabel: active.prompt.lowLabel,
    highLabel: active.prompt.highLabel,
    examples: order
      .map((playerId) => {
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return null;
        const card = {
          playerId,
          playerName: player.name,
          playerColor: player.colorHex,
          colorIndex: player.colorIndex,
          text: active.examples[playerId] || '(No example)',
        };
        // The secret number is only attached once the round is over.
        return active.revealed ? { ...card, secretNumber: active.numbers[playerId] } : card;
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card)),
    examplesReady: active.examplesCompiled,
    orderLocked: active.orderLocked,
    revealed: active.revealed,
    playerCount: room.players.length,
    rankSeconds: TOP100_RANK_SECONDS,
  };

  room.top100State = publicState;
}

/**
 * 2. Example Submission
 * Stored privately until the reveal compiles every example onto the board.
 */
export function recordTop100Example(
  room: InternalRoom,
  playerId: string,
  rawExample: string
): string {
  const state = activeRounds.get(room.code);
  const sanitized = sanitizeTop100Example(rawExample);

  if (!room.privateData[playerId]) room.privateData[playerId] = {};
  room.privateData[playerId].top100ExampleText = sanitized;
  room.privateData[playerId].top100ExampleSubmitted = true;
  room.privateData[playerId].submittedAnswer = sanitized;
  room.privateData[playerId].inputSubmitted = true;

  if (state) {
    state.examples[playerId] = sanitized;
    syncTop100PublicState(room, state);
  }

  room.hasSubmittedInput.add(playerId);
  return sanitized;
}

/** Bots write the sample example that best matches their own secret number. */
export function simulateTop100BotExamples(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  room.players
    .filter((player) => player.isBot)
    .forEach((bot) => {
      const myNumber = state.numbers[bot.id] ?? 50;
      recordTop100Example(room, bot.id, botExampleForNumber(state.prompt, myNumber));
    });
}

/**
 * 3. Simultaneous Reveal
 * Compiles every example (placeholders for stragglers) in a randomized order —
 * WITHOUT the secret numbers. This is the board the table has to reorder.
 */
export function finalizeTop100Reveal(room: InternalRoom): RevealedAnswer[] {
  const state = activeRounds.get(room.code);
  if (state?.examplesCompiled) return room.revealedAnswers;

  const compiled: RevealedAnswer[] = room.players.map((player) => {
    const example = state?.examples[player.id] || room.privateData[player.id]?.top100ExampleText;
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      answerText: example && example.trim() ? example : '(No example)',
      revealed: true,
      // Deliberately no subtext: the secret number must never leak here.
    };
  });

  room.revealedAnswers = shuffleArray(compiled);

  if (state) {
    state.examplesCompiled = true;
    // The shuffled board is the starting order the host rearranges.
    state.order = room.revealedAnswers.map((answer) => answer.playerId);
  }

  syncTop100PublicState(room, state);
  return room.revealedAnswers;
}

/**
 * 4. Rank Phase
 * Host-authoritative v1: the host drags the examples into what they believe is
 * ascending numeric order and everyone else watches the order update live.
 */
export function beginTop100Ranking(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  state.orderLocked = false;
  // Keep the board order from the reveal; fall back to room order if missing.
  const participants = room.players.map((p) => p.id);
  if (state.order.length !== participants.length) {
    state.order = participants;
  }

  room.players.forEach((player) => {
    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    room.privateData[player.id].top100CanRank = player.id === room.hostId;
  });

  syncTop100PublicState(room, state);
}

/** True when `candidate` is exactly a re-ordering of the round's participants. */
function isCompletePermutation(candidate: string[], participants: string[]): boolean {
  if (candidate.length !== participants.length) return false;
  const set = new Set(candidate);
  if (set.size !== candidate.length) return false;
  return participants.every((id) => set.has(id));
}

/**
 * Applies the host's live ordering. Rejects anything that is not a complete
 * permutation of this round's examples, so one bad payload cannot drop or
 * duplicate a card on everybody's screen.
 */
export function setTop100Order(room: InternalRoom, orderedPlayerIds: string[]): Top100OrderOutcome {
  const state = activeRounds.get(room.code);
  if (!state) return { accepted: false, error: 'No active round.' };

  const participants = room.players.map((p) => p.id);
  if (!isCompletePermutation(orderedPlayerIds, participants)) {
    return { accepted: false, error: 'That ordering does not match the board.' };
  }

  state.order = [...orderedPlayerIds];
  syncTop100PublicState(room, state);
  return { accepted: true };
}

/** Completes the order with any missing cards so results are always well-formed. */
export function finalizeTop100Order(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const participants = room.players.map((p) => p.id);
  const seen = new Set(state.order.filter((id) => participants.includes(id)));
  const completed = [...state.order.filter((id) => participants.includes(id))];
  participants.forEach((id) => {
    if (!seen.has(id)) completed.push(id);
  });

  state.order = completed;
  state.orderLocked = true;
  syncTop100PublicState(room, state);
}

/**
 * 5. Results & Scoreboard
 * Reveals every true number next to its example, measures how close the host's
 * ordering came to the real ascending order (correctly-placed adjacent pairs),
 * and awards the table's shared accuracy score.
 */
export function calculateTop100Results(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  const prompt = state?.prompt;
  finalizeTop100Order(room);

  const players = room.players;
  const numbers = state?.numbers || {};

  // True ascending order by secret number (ties broken by name for stability).
  const trueOrder = [...players]
    .sort((a, b) => {
      const diff = (numbers[a.id] ?? 0) - (numbers[b.id] ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    })
    .map((p) => p.id);

  const truePosition: Record<string, number> = {};
  trueOrder.forEach((playerId, index) => {
    truePosition[playerId] = index + 1;
  });

  const hostOrder = state?.order || players.map((p) => p.id);

  // An adjacent pair is "correct" when the host placed the two examples in the
  // right relative order (lower number first). A perfect sort scores every pair.
  let correctPairs = 0;
  for (let i = 0; i < hostOrder.length - 1; i++) {
    const current = numbers[hostOrder[i]] ?? 0;
    const next = numbers[hostOrder[i + 1]] ?? 0;
    if (current < next) correctPairs += 1;
  }

  const totalPairs = Math.max(0, hostOrder.length - 1);
  const perfect = totalPairs > 0 && correctPairs === totalPairs;
  const points = correctPairs * TOP100_POINTS_PER_PAIR + (perfect ? TOP100_PERFECT_BONUS : 0);

  const entries: Top100OrderEntry[] = hostOrder.map((playerId, index) => {
    const player = players.find((p) => p.id === playerId);
    return {
      playerId,
      playerName: player?.name || 'Player',
      playerColor: player?.colorHex || '#888888',
      colorIndex: player?.colorIndex ?? 0,
      text: state?.examples[playerId] || '(No example)',
      secretNumber: numbers[playerId] ?? 0,
      hostPosition: index + 1,
      truePosition: truePosition[playerId] ?? 0,
      correctlyPlaced: (truePosition[playerId] ?? 0) === index + 1,
    };
  });

  // The ordering is collaborative, so the accuracy score is shared by everyone.
  players.forEach((player) => {
    player.score += points;
    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    room.privateData[player.id].top100PointsAwarded = points;
    room.privateData[player.id].top100CanRank = false;
  });

  if (state) {
    state.revealed = true;
    syncTop100PublicState(room, state);
  }

  const standings: PlayerResultStanding[] = players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerColor: player.colorHex,
    colorIndex: player.colorIndex,
    pointsAdded: points,
    totalScore: player.score,
    badge: perfect ? 'Perfect order' : player.id === room.hostId ? 'Arranger' : undefined,
  }));

  standings.sort((a, b) => b.totalScore - a.totalScore);

  const summary = perfect
    ? 'Perfect order! Every neighbouring pair was in the right place.'
    : totalPairs === 0
    ? 'Not enough examples to measure an order.'
    : `${correctPairs} of ${totalPairs} neighbouring pairs were in the right order.`;

  room.results = {
    summary,
    secretWord: prompt ? top100SpectrumText(prompt) : undefined,
    category: prompt?.category || 'Top 100',
    whyHint: prompt
      ? `The spectrum ran from "${prompt.lowLabel}" to "${prompt.highLabel}". Each correct neighbouring pair scored +${TOP100_POINTS_PER_PAIR} points for the whole table${
          perfect ? `, plus a +${TOP100_PERFECT_BONUS} flawless bonus` : ''
        }.`
      : undefined,
    top100PromptText: prompt ? top100SpectrumText(prompt) : undefined,
    top100LowLabel: prompt?.lowLabel,
    top100HighLabel: prompt?.highLabel,
    top100Category: prompt?.category,
    top100Entries: entries,
    top100CorrectPairs: correctPairs,
    top100TotalPairs: totalPairs,
    top100Points: points,
    standings,
    winnerTitle: perfect
      ? `Flawless sort — +${points} pts each`
      : points > 0
      ? `+${points} pts for the table`
      : 'The order was scrambled',
  };
}

/** Cleans up active round state when a room returns to the lobby */
export function cleanupTop100Round(roomCode: string): void {
  activeRounds.delete(roomCode);
}
