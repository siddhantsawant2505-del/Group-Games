/**
 * Guess the Link Game Module.
 * Server-authoritative logic for hiding one central concept, dealing every
 * player a different hint angle, collecting responses, running a simultaneous
 * "guess the concept" phase (voting-style, all at once), and scoring the reads.
 *
 * Flow: reveal -> input -> reveal-answers -> guess -> results
 */

import {
  GTL_PROMPTS,
  GuessTheLinkPrompt,
  dealGtlHints,
  getRandomGtlPrompt,
  gtlConceptWordCount,
} from '../../shared/data/guessTheLinkPrompts';
import { InternalRoom } from '../roomManager';
import {
  GtlGuessResult,
  GtlHintShare,
  GtlPublicState,
  PlayerResultStanding,
  RevealedAnswer,
} from '../../shared/types';

/** Seconds players get to write a response from their own hint. */
export const GTL_INPUT_SECONDS = 30;

/** Seconds everyone gets to lock in a guess at the hidden concept. */
export const GTL_GUESS_SECONDS = 30;

/** Seconds the shuffled responses stay on screen before guessing opens. */
export const GTL_REVEAL_SECONDS = 15;

/** Points for naming the hidden concept correctly. */
export const GTL_POINTS_CORRECT_GUESS = 1;

/** A response is a word or a short phrase, never an essay. */
export const GTL_MAX_RESPONSE_WORDS = 3;
export const GTL_MAX_RESPONSE_CHARS = 24;

/** Guesses are capped too (the concept itself is never long). */
export const GTL_MAX_GUESS_CHARS = 24;

/** Chance a simulated bot names the concept correctly. */
export const GTL_BOT_CORRECT_GUESS_CHANCE = 0.35;

export interface GtlRoundState {
  prompt: GuessTheLinkPrompt;
  hints: Record<string, string>;
  hintIndex: Record<string, number>;
  responses: Record<string, string>;
  guesses: Record<string, string>;
  responsesCompiled: boolean;
  guessesFinalized: boolean;
  revealed: boolean;
  /** Concepts already played in this room, so rounds stay fresh. */
  usedConcepts: string[];
}

export interface GtlGuessOutcome {
  accepted: boolean;
  /** Players who still owe a guess after this submission. */
  pendingPlayerIds: string[];
}

// In-memory store of active Guess the Link round details per room
const activeRounds = new Map<string, GtlRoundState>();

export function getGtlRoundState(roomCode: string): GtlRoundState | undefined {
  return activeRounds.get(roomCode);
}

/**
 * Shuffles a copy of an array with Fisher-Yates (display order is never
 * join order).
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function playerName(room: InternalRoom, playerId: string): string {
  return room.players.find((p) => p.id === playerId)?.name || 'Player';
}

/**
 * Normalizes an answer for comparison: lower-case, no punctuation, no leading
 * article, and plural-insensitive.
 */
function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/s$/, '');
}

/**
 * Clue sanitizer for responses: trims to a short phrase, collapses whitespace
 * and caps the word count (mirrors the Impostor clue sanitizer).
 */
export function sanitizeGtlResponse(raw: string): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(Blank)';
  const words = cleaned.split(' ').slice(0, GTL_MAX_RESPONSE_WORDS);
  return words.join(' ').slice(0, GTL_MAX_RESPONSE_CHARS);
}

/** Guess sanitizer: same idea, one short answer. */
export function sanitizeGtlGuess(raw: string): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(Blank)';
  return cleaned.slice(0, GTL_MAX_GUESS_CHARS);
}

/** Longest run of shared characters between two normalized answers. */
function longestCommonRun(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  let previous = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    const current = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        if (current[j] > best) best = current[j];
      }
    }
    previous = current;
  }

  return best;
}

/**
 * Judges a guess against the hidden concept. Exact matches win, and a guess
 * that clearly names the concept inside a longer answer counts too.
 */
export function isCorrectGtlGuess(prompt: GuessTheLinkPrompt, rawGuess: string): boolean {
  const text = normalizeAnswer(rawGuess);
  if (!text) return false;

  const accepted = [prompt.concept, ...(prompt.accepted || [])].map(normalizeAnswer);
  if (accepted.includes(text)) return true;

  return accepted.some(
    (key) => key.length >= 4 && (text.includes(key) || (key.includes(text) && text.length >= 4))
  );
}

/**
 * How strongly a response telegraphs the concept (0-1). A single shared letter
 * is coincidence rather than a giveaway, so runs under four characters score 0.
 */
function giveawayScore(response: string, prompt: GuessTheLinkPrompt): number {
  const normalized = normalizeAnswer(response);
  const concept = normalizeAnswer(prompt.concept);
  if (!normalized || !concept) return 0;
  const run = longestCommonRun(normalized, concept);
  if (run < 4) return 0;
  return run / Math.max(1, Math.min(normalized.length, concept.length));
}

/**
 * 1. Reveal Phase
 * One hidden concept is picked server-side and every player privately receives
 * a DIFFERENT hint angle pointing at it. The concept itself never leaves the
 * server until results.
 */
export function setupGtlRound(room: InternalRoom): void {
  const previous = activeRounds.get(room.code);
  const usedConcepts = previous?.usedConcepts || [];

  // A host-authored concept is consumed for exactly one round; afterwards
  // the shipped deck (filtered by what this room has already seen) takes over.
  const custom = room.gtlCustomPrompt;
  const prompt = custom || getRandomGtlPrompt(usedConcepts);
  if (custom) room.gtlCustomPrompt = null;
  const playerIds = room.players.map((p) => p.id);
  const hints = dealGtlHints(prompt, playerIds, room.roundNumber - 1);

  const hintIndex: Record<string, number> = {};
  playerIds.forEach((playerId) => {
    hintIndex[playerId] = prompt.hints.indexOf(hints[playerId]) + 1;
  });

  const state: GtlRoundState = {
    prompt,
    hints,
    hintIndex,
    responses: {},
    guesses: {},
    responsesCompiled: false,
    guessesFinalized: false,
    revealed: false,
    usedConcepts: [...usedConcepts, prompt.concept].slice(-GTL_PROMPTS.length),
  };

  activeRounds.set(room.code, state);
  room.privateData = {};

  room.players.forEach((player) => {
    room.privateData[player.id] = {
      role: 'Link Seeker',
      gtlHint: state.hints[player.id],
      gtlHintIndex: state.hintIndex[player.id],
      gtlHintCount: prompt.hints.length,
      gtlCategory: prompt.category,
      secretHint: `Category: ${prompt.category}`,
      secretInstructions: `Your angle is "${state.hints[player.id]}". Everyone else got a different angle on the SAME hidden concept — nobody sees the concept itself until the end.`,
      inputPlaceholder: 'A word or short phrase...',
    };
  });

  syncGtlPublicState(room, state);
  room.phasePrompt = 'Read Your Secret Hint';
  room.phaseSubprompt = 'Only your own angle is on this screen — keep it hidden!';
}

/** Public state mirrored onto the room (never contains the concept pre-reveal). */
export function syncGtlPublicState(room: InternalRoom, state?: GtlRoundState): void {
  const active = state || activeRounds.get(room.code);
  if (!active) {
    room.gtlState = null;
    return;
  }

  const publicState: GtlPublicState = {
    category: active.prompt.category,
    conceptWordCount: gtlConceptWordCount(active.prompt),
    hintsDealt: new Set(Object.values(active.hints)).size,
    totalPlayers: room.players.length,
    responsesReady: active.responsesCompiled,
    guessesSubmitted: Object.keys(active.guesses),
    guessSeconds: GTL_GUESS_SECONDS,
    revealed: active.revealed,
    concept: active.revealed ? active.prompt.concept : null,
    correctPlayerIds: active.revealed
      ? room.players
          .filter((player) => isCorrectGtlGuess(active.prompt, active.guesses[player.id] || ''))
          .map((player) => player.id)
      : [],
  };

  room.gtlState = publicState;
}

/**
 * 2. Response Submission
 * Stored privately until the reveal compiles everyone's answers together.
 */
export function recordGtlResponse(room: InternalRoom, playerId: string, rawResponse: string): string {
  const state = activeRounds.get(room.code);
  const sanitized = sanitizeGtlResponse(rawResponse);

  if (!room.privateData[playerId]) room.privateData[playerId] = {};
  room.privateData[playerId].gtlResponseText = sanitized;
  room.privateData[playerId].gtlResponseSubmitted = true;
  room.privateData[playerId].submittedAnswer = sanitized;
  room.privateData[playerId].inputSubmitted = true;

  if (state) {
    state.responses[playerId] = sanitized;
    syncGtlPublicState(room, state);
  }

  room.hasSubmittedInput.add(playerId);
  return sanitized;
}

/** Bots echo a token from their own hint, which is exactly what a human would do. */
export function simulateGtlBotResponses(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  room.players
    .filter((player) => player.isBot)
    .forEach((bot) => {
      const hint = state.hints[bot.id] || '';
      const tokens = hint
        .split(/\s+/)
        .map((token) => token.replace(/[^A-Za-z]/g, ''))
        .filter((token) => token.length >= 4 && !/^(the|and|with|your|from|into)$/i.test(token));

      const pool = tokens.length > 0 ? tokens : ['Something', 'Classic', 'Vibes', 'Mystery'];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      recordGtlResponse(room, bot.id, pick);
    });
}

/**
 * 3. Simultaneous Reveal
 * Compiles every response (placeholders for stragglers) and randomizes the
 * display order with Fisher-Yates so nothing is grouped by join order.
 */
export function finalizeGtlReveal(room: InternalRoom): RevealedAnswer[] {
  const state = activeRounds.get(room.code);
  if (state?.responsesCompiled) return room.revealedAnswers;

  const compiled: RevealedAnswer[] = room.players.map((player) => {
    const response = state?.responses[player.id] || room.privateData[player.id]?.gtlResponseText;
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      answerText: response && response.trim() ? response : '(No response)',
      revealed: true,
      subtext: state?.hints[player.id] ? `Hint: ${state.hints[player.id]}` : undefined,
    };
  });

  room.revealedAnswers = shuffleArray(compiled);
  if (state) state.responsesCompiled = true;
  syncGtlPublicState(room, state);
  return room.revealedAnswers;
}

/**
 * 4. Guess Phase
 * Everyone locks in a guess at the hidden concept at the same time — the
 * concept itself is only revealed once results are calculated.
 */
export function beginGtlGuessing(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  state.guesses = {};
  state.guessesFinalized = false;

  room.players.forEach((player) => {
    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    room.privateData[player.id].gtlGuessSubmitted = false;
    room.privateData[player.id].gtlGuessText = undefined;
    room.privateData[player.id].gtlGuessCorrect = undefined;
  });

  syncGtlPublicState(room, state);
}

/** Players who still owe a guess. */
export function pendingGtlGuessers(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return [];
  return room.players
    .filter((player) => player.connected && !state.guesses[player.id])
    .map((player) => player.id);
}

export function recordGtlGuess(room: InternalRoom, playerId: string, rawGuess: string): GtlGuessOutcome {
  const state = activeRounds.get(room.code);
  const rejected: GtlGuessOutcome = { accepted: false, pendingPlayerIds: [] };
  if (!state) return rejected;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return rejected;

  const sanitized = sanitizeGtlGuess(rawGuess);
  state.guesses[playerId] = sanitized;

  if (!room.privateData[playerId]) room.privateData[playerId] = {};
  room.privateData[playerId].gtlGuessText = sanitized;
  room.privateData[playerId].gtlGuessSubmitted = true;

  syncGtlPublicState(room, state);

  return { accepted: true, pendingPlayerIds: pendingGtlGuessers(room) };
}

/** Bots either crack the link or bluff with another concept entirely. */
export function simulateGtlBotGuesses(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const wrongPool = GTL_PROMPTS.filter((p) => p.concept !== state.prompt.concept).map((p) => p.concept);

  room.players
    .filter((player) => player.isBot)
    .forEach((bot) => {
      const correct = Math.random() < GTL_BOT_CORRECT_GUESS_CHANCE;
      const guess = correct
        ? state.prompt.concept
        : wrongPool[Math.floor(Math.random() * wrongPool.length)];
      recordGtlGuess(room, bot.id, guess);
    });
}

/** Fills a placeholder for anyone who ran out of time, so results stay fair. */
export function finalizeGtlGuesses(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state || state.guessesFinalized) return;

  room.players.forEach((player) => {
    if (!state.guesses[player.id]) {
      state.guesses[player.id] = '(No guess)';
      if (!room.privateData[player.id]) room.privateData[player.id] = {};
      room.privateData[player.id].gtlGuessText = '(No guess)';
      room.privateData[player.id].gtlGuessSubmitted = true;
    }
  });

  state.guessesFinalized = true;
  syncGtlPublicState(room, state);
}

/**
 * 5. Results & Scoreboard
 * Reveals the concept, every angle that was dealt, who read the link, and the
 * points awarded — plus which response gave the game away.
 */
export function calculateGtlResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  const prompt = state?.prompt;
  finalizeGtlGuesses(room);

  const guesses: GtlGuessResult[] = room.players.map((player) => {
    const guessText = state?.guesses[player.id] || '(No guess)';
    const correct = prompt ? isCorrectGtlGuess(prompt, guessText) : false;
    const points = correct ? GTL_POINTS_CORRECT_GUESS : 0;
    player.score += points;

    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    room.privateData[player.id].gtlConcept = prompt?.concept;
    room.privateData[player.id].gtlGuessCorrect = correct;
    room.privateData[player.id].gtlPointsAwarded = points;

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      hint: state?.hints[player.id] || '',
      guessText,
      correct,
      pointsAdded: points,
    };
  });

  const correctIds = guesses.filter((g) => g.correct).map((g) => g.playerId);
  const correctNames = guesses.filter((g) => g.correct).map((g) => g.playerName);

  const hints: GtlHintShare[] = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    colorIndex: player.colorIndex,
    hint: state?.hints[player.id] || '',
  }));

  // Which response telegraphed the concept hardest? (heuristic similarity)
  const innocenceOrder = prompt
    ? room.players
        .map((player) => {
          const response = state?.responses[player.id] || '';
          return {
            playerId: player.id,
            name: player.name,
            response,
            score: response ? giveawayScore(response, prompt) : 0,
          };
        })
        .filter((entry) => entry.response && entry.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];
  const giveaway = innocenceOrder[0] || null;

  const standings: PlayerResultStanding[] = room.players.map((player) => {
    const guess = guesses.find((g) => g.playerId === player.id);
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      pointsAdded: guess?.pointsAdded || 0,
      totalScore: player.score,
      badge: guess?.correct ? 'Cracked it' : undefined,
    };
  });

  standings.sort((a, b) => b.totalScore - a.totalScore);

  const concept = prompt?.concept || 'Unknown';
  const total = room.players.length;
  const correctCount = correctIds.length;

  if (state) {
    state.revealed = true;
    syncGtlPublicState(room, state);
  }

  room.results = {
    summary:
      correctCount > 0
        ? `${correctCount} of ${total} read the link`
        : `Nobody read the link — it was "${concept}"`,
    category: prompt?.category || 'Guess the Link',
    secretWord: concept,
    whyHint: prompt
      ? `The hidden concept was "${concept}". Every player held a different angle on it — from "${hints[0]?.hint || ''}" to "${hints[hints.length - 1]?.hint || ''}".`
      : undefined,
    gtlConcept: concept,
    gtlCategory: prompt?.category,
    gtlGuesses: guesses.sort((a, b) => (b.correct ? 1 : 0) - (a.correct ? 1 : 0)),
    gtlHints: hints,
    gtlCorrectPlayerIds: correctIds,
    gtlGiveawayName: giveaway?.name,
    gtlGiveawayResponse: giveaway?.response,
    gtlGiveawayNote: giveaway
      ? `"${giveaway.response}" pointed hardest at "${concept}".`
      : undefined,
    standings,
    winnerTitle:
      correctNames.length === 1
        ? `${correctNames[0]} cracked it!`
        : correctNames.length > 1
        ? `${correctNames.length} players cracked it!`
        : 'Nobody cracked the link!',
  };
}

/** Cleans up active round state when a room returns to the lobby */
export function cleanupGtlRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}
