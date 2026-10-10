/**
 * Reverse Categories Game Module.
 * Server-authoritative logic for dealing three deliberately unrelated items
 * publicly, collecting every player's invented category, revealing the board
 * in shuffled order, reusing the standard secret-ballot mechanic to pick the
 * best category, and scoring the winner plus everyone who backed it.
 *
 * Flow: reveal -> input -> reveal-answers -> vote -> results
 *
 * Note: this game hides nothing. The three items are public from the start, so
 * there is no private reveal phase — privateData only carries a player's own
 * submitted category back to their own screen.
 */

import {
  REVERSE_CATEGORIES_ITEMS,
  pickUnrelatedTriplet,
} from '../../shared/data/reverseCategoriesItems';
import { InternalRoom } from '../roomManager';
import {
  PlayerResultStanding,
  RevCatCategoryResult,
  RevCatPublicState,
  RevealedAnswer,
  VoteBreakdownItem,
} from '../../shared/types';

/** Seconds players get to invent a category. */
export const RC_INPUT_SECONDS = 45;

/** Seconds the category board stays up before voting opens. */
export const RC_REVEAL_SECONDS = 20;

/** A category name is a short label, never an essay. */
export const RC_MAX_CATEGORY_WORDS = 6;
export const RC_MAX_CATEGORY_CHARS = 48;

/** Scoring: the best category's author scores, and so does everyone who backed it. */
export const RC_POINTS_BEST_CATEGORY = 2;
export const RC_POINTS_VOTER_BONUS = 1;

export interface RevCatRoundState {
  items: string[];
  themes: string[];
  categories: Record<string, string>;
  categoriesCompiled: boolean;
  /** Item names already used in this room, so triplets stay fresh. */
  usedItems: string[];
}

// In-memory store of active Reverse Categories round details per room
const activeRounds = new Map<string, RevCatRoundState>();

export function getRevCatRoundState(roomCode: string): RevCatRoundState | undefined {
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
 * Category sanitizer: one short, clean line — collapses whitespace and caps
 * both word count and length so every entry fits on the board and the ballot.
 */
export function sanitizeRevCatCategory(raw: string): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No category)';
  const words = cleaned.split(' ').slice(0, RC_MAX_CATEGORY_WORDS);
  return words.join(' ').slice(0, RC_MAX_CATEGORY_CHARS);
}

/**
 * 1. Reveal Phase
 * Three unrelated items are drawn server-side and shown to EVERYONE at once.
 * There is nothing private to deal in this game, so privateData only records
 * the round's items for each player's own screen.
 */
export function setupReverseCategoriesRound(room: InternalRoom): void {
  const previous = activeRounds.get(room.code);
  const usedItems = previous?.usedItems || [];

  const triplet = pickUnrelatedTriplet(usedItems);

  const state: RevCatRoundState = {
    items: triplet.items,
    themes: triplet.themes,
    categories: {},
    categoriesCompiled: false,
    usedItems: [...usedItems, ...triplet.items].slice(-REVERSE_CATEGORIES_ITEMS.length),
  };

  activeRounds.set(room.code, state);
  room.privateData = {};

  room.players.forEach((player) => {
    room.privateData[player.id] = {
      role: 'Category Inventor',
      revCatItems: state.items,
      secretInstructions: `Link "${state.items.join('", "')}" with one invented category name. Anything goes as long as it makes people laugh or nod.`,
      inputPlaceholder: 'Invent a category name...',
    };
  });

  syncRevCatPublicState(room, state);
  room.phasePrompt = 'Your Three Items';
  room.phaseSubprompt = 'Everyone sees the same items — invent the best category that links them';
}

/** Public state mirrored onto the room (the items are public by design). */
export function syncRevCatPublicState(room: InternalRoom, state?: RevCatRoundState): void {
  const active = state || activeRounds.get(room.code);
  if (!active) {
    room.revCatState = null;
    return;
  }

  const publicState: RevCatPublicState = {
    items: active.items,
    categoriesReady: active.categoriesCompiled,
    totalPlayers: room.players.length,
    roundsPlayed: Math.floor(active.usedItems.length / Math.max(1, active.items.length)),
  };

  room.revCatState = publicState;
}

/**
 * 2. Input Phase
 * Each player privately writes their own invented category. Held privately
 * until the board compiles.
 */
export function recordRevCatCategory(room: InternalRoom, playerId: string, rawCategory: string): string {
  const state = activeRounds.get(room.code);
  const sanitized = sanitizeRevCatCategory(rawCategory);

  if (!room.privateData[playerId]) room.privateData[playerId] = {};
  room.privateData[playerId].revCatCategoryText = sanitized;
  room.privateData[playerId].revCatCategorySubmitted = true;
  room.privateData[playerId].submittedAnswer = sanitized;
  room.privateData[playerId].inputSubmitted = true;

  if (state) {
    state.categories[playerId] = sanitized;
    syncRevCatPublicState(room, state);
  }

  room.hasSubmittedInput.add(playerId);
  return sanitized;
}

/**
 * Bots cannot be creative, so they submit a generic (clearly bot-ish) category
 * name. This exists so a host can walk a whole round solo.
 */
export function simulateRevCatBotCategories(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const templates = [
    'Things that ruin a Monday',
    'Unexplained modern mysteries',
    'What my brain does at 3am',
    'Worst pets imaginable',
    'Inevitable small disasters',
    'Great band names',
    'Things aliens would fear',
    'Bad answers to "how was your day"',
  ];

  room.players
    .filter((player) => player.isBot)
    .forEach((bot) => {
      const pick = templates[Math.floor(Math.random() * templates.length)];
      recordRevCatCategory(room, bot.id, pick);
    });
}

/**
 * 3. Simultaneous Reveal
 * Every invented category appears together in Fisher-Yates shuffled order,
 * attributed to its author (a friend group wants to know who wrote the winner).
 */
export function finalizeRevCatReveal(room: InternalRoom): RevealedAnswer[] {
  const state = activeRounds.get(room.code);
  if (state?.categoriesCompiled) return room.revealedAnswers;

  const compiled: RevealedAnswer[] = room.players.map((player) => {
    const category = state?.categories[player.id] || room.privateData[player.id]?.revCatCategoryText;
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      answerText: category && category.trim() ? category : '(No category)',
      revealed: true,
      subtext: player.isHost ? 'Host' : undefined,
    };
  });

  room.revealedAnswers = shuffleArray(compiled);
  if (state) state.categoriesCompiled = true;
  syncRevCatPublicState(room, state);
  return room.revealedAnswers;
}

/**
 * 4. Vote Phase
 * The standard secret ballot is reused wholesale: a player's vote targets the
 * AUTHOR of the category they liked best, exactly as the impostor round votes
 * for a suspect. `castVote` already forbids self-votes, so nobody can crown
 * their own category.
 */

/**
 * 5. Results & Scoreboard
 * Reveals the tally, awards the best category (ties included), and gives a
 * small bonus to the voters who backed a winning category.
 */
export function calculateReverseCategoriesResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  const items = state?.items || [];
  const finalize = state || activeRounds.get(room.code);

  if (finalize) {
    finalize.categoriesCompiled = true;
  }

  // Tally votes per category author.
  const tallies: Record<string, number> = {};
  room.players.forEach((player) => {
    tallies[player.id] = 0;
  });

  const voteBreakdown: VoteBreakdownItem[] = [];

  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  for (const count of Object.values(tallies)) {
    if (count > maxVotes) maxVotes = count;
  }

  const winningIds = Object.keys(tallies).filter((id) => tallies[id] === maxVotes && maxVotes > 0);
  const winningSet = new Set(winningIds);

  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    const voter = room.players.find((p) => p.id === voterId);
    const target = room.players.find((p) => p.id === targetId);
    if (!voter || !target) continue;
    voteBreakdown.push({
      voterId,
      voterName: voter.name,
      voterColorIndex: voter.colorIndex,
      targetId,
      targetName: target.name,
      isCorrect: winningSet.has(targetId),
    });
  }

  const pointsAwarded: Record<string, number> = {};
  room.players.forEach((player) => {
    pointsAwarded[player.id] = 0;
  });

  // The best category's author scores (every tied author scores).
  winningIds.forEach((playerId) => {
    pointsAwarded[playerId] = (pointsAwarded[playerId] || 0) + RC_POINTS_BEST_CATEGORY;
  });

  // Everyone who backed a winning category gets a small bonus.
  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    if (winningSet.has(targetId)) {
      pointsAwarded[voterId] = (pointsAwarded[voterId] || 0) + RC_POINTS_VOTER_BONUS;
    }
  }

  room.players.forEach((player) => {
    const points = pointsAwarded[player.id] || 0;
    player.score += points;
    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    room.privateData[player.id].revCatPointsAwarded = points;
    room.privateData[player.id].revCatIsWinner = winningSet.has(player.id);
  });

  const categories: RevCatCategoryResult[] = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerColor: player.colorHex,
    colorIndex: player.colorIndex,
    category: state?.categories[player.id] || room.privateData[player.id]?.revCatCategoryText || '(No category)',
    votes: tallies[player.id] || 0,
    isWinner: winningSet.has(player.id),
    pointsAdded: pointsAwarded[player.id] || 0,
  }));

  const winnerNames = room.players
    .filter((player) => winningSet.has(player.id))
    .map((player) => player.name);

  const singleWinner =
    winningIds.length === 1 ? categories.find((c) => c.playerId === winningIds[0]) : undefined;

  if (finalize) finalize.categoriesCompiled = true;
  syncRevCatPublicState(room, finalize);

  const standings: PlayerResultStanding[] = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerColor: player.colorHex,
    colorIndex: player.colorIndex,
    pointsAdded: pointsAwarded[player.id] || 0,
    totalScore: player.score,
    badge: winningSet.has(player.id) ? 'Best Category' : undefined,
  }));

  standings.sort((a, b) => b.totalScore - a.totalScore);

  const summary =
    winningIds.length === 0
      ? 'Nobody cast a vote — no category took the round.'
      : winningIds.length === 1
      ? `${winnerNames[0]}'s category took the round with ${maxVotes} vote${maxVotes === 1 ? '' : 's'}.`
      : `${winningIds.length} categories tied for best with ${maxVotes} vote${maxVotes === 1 ? '' : 's'} each.`;

  room.results = {
    summary,
    category: 'Reverse Categories',
    whyHint: items.length
      ? `Everyone had to link "${items.join('", "')}". ${
          winningIds.length > 0
            ? `The best category scored +${RC_POINTS_BEST_CATEGORY}, and every player who voted for it picked up +${RC_POINTS_VOTER_BONUS}.`
            : 'Nobody voted, so no points were awarded.'
        }`
      : undefined,
    voteTallies: tallies,
    voteBreakdown,
    revCatItems: items,
    revCatCategories: categories.sort((a, b) => b.votes - a.votes),
    revCatWinnerNames: winnerNames,
    revCatWinnerCategory: singleWinner?.category ?? null,
    revCatWinningVotes: winningIds.length > 0 ? maxVotes : 0,
    revCatPointsBest: RC_POINTS_BEST_CATEGORY,
    revCatPointsVoter: RC_POINTS_VOTER_BONUS,
    standings,
    winnerTitle:
      winningIds.length === 0
        ? 'No votes cast'
        : singleWinner
        ? `Best Category: "${singleWinner.category}"`
        : `${winningIds.length}-way tie for best`,
  };
}

/** Cleans up active round state when a room returns to the lobby */
export function cleanupRevCatRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}
