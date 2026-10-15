/**
 * Impostor — Question mode.
 *
 * Every player privately receives a question. The crew all get the SAME question
 * (Q); the impostor gets a DIFFERENT but related one (Q'). Nobody is told which
 * side they are on — the impostor is only discovered by noticing that the other
 * answers fit a different question. Answers are collected privately and revealed
 * together, after which the standard discussion → vote → results flow runs
 * unchanged.
 *
 * Word mode lives in `impostor.ts` and is untouched by this module.
 */

import {
  AnswerType,
  PhaseResultsData,
  Player,
  PlayerPrivateState,
  PlayerResultStanding,
  QuestionPair,
  RevealedAnswer,
  RoleRevealInfo,
  VoteBreakdownItem,
} from '../../shared/types';
import { InternalPlayer, InternalRoom } from '../roomManager';
import { awardPoints } from '../scoring';
import { shuffle } from '../content/contentBag';

export const QUESTION_INPUT_SECONDS = 30;
export const QUESTION_REVEAL_SECONDS = 15;
export const QUESTION_MAX_WORDS = 4;
export const QUESTION_MAX_CHARS = 40;

export interface QuestionAnswer {
  playerId: string;
  answerType: AnswerType;
  /** What the board shows. */
  text: string;
  /** The raw submitted value (player id, number as string, choice, free text). */
  raw: string;
  answeredPlayerId?: string;
  answeredPlayerName?: string;
}

export interface QuestionRoundState {
  pair: QuestionPair;
  impostorPlayerId: string;
  targetPlayerId?: string;
  crewQuestion: string;
  impostorQuestion: string;
  answers: Record<string, QuestionAnswer>;
  roundsPlayed: number;
}

const activeRounds = new Map<string, QuestionRoundState>();

/* ------------------------------------------------------------------ sanitizing */

/** Free-text answers: trimmed, whitespace collapsed, control characters gone. */
export function sanitizeQuestionText(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clampQuestionText(text: string): string {
  const words = text.split(' ').filter(Boolean).slice(0, QUESTION_MAX_WORDS);
  return words.join(' ').slice(0, QUESTION_MAX_CHARS);
}

function fillTarget(template: string, targetName: string): string {
  return template.split('{target}').join(targetName);
}

/* --------------------------------------------------------------------- dealing */

function pickIndex(length: number): number {
  return Math.floor(Math.random() * Math.max(1, length));
}

/**
 * Reveal phase: hides the pair, deals each player their own question and marks
 * who the impostor is (server-side only — the private state never says so).
 */
export function setupImpostorQuestionRound(room: InternalRoom, pair: QuestionPair): void {
  const connected = room.players.filter((player) => player.connected);
  const pool = connected.length > 0 ? connected : room.players;
  const impostor = pool[pickIndex(pool.length)];

  // Targets are always crew, so the impostor never gets a question about itself.
  const crewPool = pool.filter((player) => player.id !== impostor.id);
  const target = pair.needsTarget && crewPool.length > 0 ? crewPool[pickIndex(crewPool.length)] : undefined;
  const targetName = target?.name || 'this player';

  const crewQuestion = fillTarget(pair.crew.text, targetName);
  const impostorQuestion = fillTarget(pair.impostor.text, targetName);
  const targetSelfQuestion = pair.crew.selfText ? pair.crew.selfText : crewQuestion;

  const previousRounds = activeRounds.get(room.code)?.roundsPlayed ?? 0;
  const state: QuestionRoundState = {
    pair,
    impostorPlayerId: impostor.id,
    targetPlayerId: target?.id,
    crewQuestion,
    impostorQuestion,
    answers: {},
    roundsPlayed: previousRounds + 1,
  };
  activeRounds.set(room.code, state);

  room.privateData = {};
  room.players.forEach((player) => {
    const isImpostor = player.id === impostor.id;
    const question = isImpostor
      ? impostorQuestion
      : player.id === target?.id
      ? targetSelfQuestion
      : crewQuestion;

    const privateState: PlayerPrivateState = {
      // Deliberately neutral: telling the impostor who they are would end the mode.
      role: 'Player',
      isSpecialRole: false,
      specialAccentBg: false,
      secretInstructions: 'Answer privately — nobody sees your answer until the reveal.',
      inputPlaceholder: answerPlaceholder(pair),
      impostorQuestion: question,
      impostorAnswerType: pair.answerType,
      ...(pair.choices ? { impostorChoices: [...pair.choices] } : {}),
      ...(pair.numberRange ? { impostorNumberRange: { ...pair.numberRange } } : {}),
    };
    room.privateData[player.id] = privateState;
  });

  room.revealedAnswers = [];
  room.hasSubmittedInput.clear();
  room.impostorQuestionState = {
    answerType: pair.answerType,
    answeredPlayerIds: [],
    totalPlayers: room.players.length,
    roundsPlayed: state.roundsPlayed,
    ...(pair.choices ? { choices: [...pair.choices] } : {}),
    ...(pair.numberRange ? { numberRange: { ...pair.numberRange } } : {}),
    answersReady: false,
  };
}

function answerPlaceholder(pair: QuestionPair): string {
  switch (pair.answerType) {
    case 'player':
      return 'Tap the player you would pick...';
    case 'number':
      return 'Type a number...';
    case 'choice':
      return 'Tap an option...';
    default:
      return 'A short answer...';
  }
}

/* --------------------------------------------------------------------- answers */

export interface RecordAnswerResult {
  accepted: boolean;
  /** Every player who still owes an answer (connected players only). */
  pendingPlayerIds: string[];
  answered: QuestionAnswer | null;
}

export function recordImpostorQuestionAnswer(
  room: InternalRoom,
  playerId: string,
  rawValue: string,
  rawTargetPlayerId?: string
): RecordAnswerResult {
  const state = activeRounds.get(room.code);
  const pending = () => pendingQuestionAnswerers(room);
  if (!state) return { accepted: false, pendingPlayerIds: pending(), answered: null };

  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player) return { accepted: false, pendingPlayerIds: pending(), answered: null };

  const answer = buildAnswer(room, state, player, rawValue, rawTargetPlayerId);
  if (!answer) return { accepted: false, pendingPlayerIds: pending(), answered: null };

  state.answers[playerId] = answer;
  room.hasSubmittedInput.add(playerId);

  if (!room.privateData[playerId]) room.privateData[playerId] = {};
  room.privateData[playerId].inputSubmitted = true;
  room.privateData[playerId].submittedAnswer = answer.text;
  room.privateData[playerId].impostorAnswerSubmitted = true;
  room.privateData[playerId].impostorAnswerText = answer.text;
  if (answer.answeredPlayerId) {
    room.privateData[playerId].impostorAnswerPlayerId = answer.answeredPlayerId;
    room.privateData[playerId].impostorAnswerPlayerName = answer.answeredPlayerName;
  }

  if (room.impostorQuestionState) {
    room.impostorQuestionState.answeredPlayerIds = Object.keys(state.answers);
  }

  return { accepted: true, pendingPlayerIds: pending(), answered: answer };
}

function buildAnswer(
  room: InternalRoom,
  state: QuestionRoundState,
  player: InternalPlayer,
  rawValue: string,
  rawTargetPlayerId?: string
): QuestionAnswer | null {
  const { pair } = state;

  if (pair.answerType === 'player') {
    const targetId = rawTargetPlayerId || rawValue;
    const target = room.players.find((candidate) => candidate.id === targetId);
    if (!target) return null;
    return {
      playerId: player.id,
      answerType: 'player',
      text: target.name,
      raw: target.id,
      answeredPlayerId: target.id,
      answeredPlayerName: target.name,
    };
  }

  if (pair.answerType === 'number') {
    const range = pair.numberRange;
    if (!range) return null;
    const parsed = Number(String(rawValue).trim());
    if (!Number.isFinite(parsed)) return null;
    const rounded = Math.round(parsed);
    if (rounded < range.min || rounded > range.max) return null;
    return {
      playerId: player.id,
      answerType: 'number',
      text: String(rounded),
      raw: String(rounded),
    };
  }

  if (pair.answerType === 'choice') {
    const options = pair.choices || [];
    const wanted = sanitizeQuestionText(rawValue).toLowerCase();
    const match = options.find((option) => option.toLowerCase() === wanted);
    if (!match) return null;
    return { playerId: player.id, answerType: 'choice', text: match, raw: match };
  }

  const text = clampQuestionText(sanitizeQuestionText(rawValue));
  if (!text) return null;
  return { playerId: player.id, answerType: 'text', text, raw: text };
}

export function pendingQuestionAnswerers(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return [];
  return room.players
    .filter((player) => player.connected && !state.answers[player.id])
    .map((player) => player.id);
}

/* ------------------------------------------------------------------------ bots */

const BOT_TEXT_ANSWERS: Record<string, string[]> = {
  'most-likely': ['Pizza night', 'Road trip', 'Karaoke'],
  'about-player': ['Pizza', 'Chocolate', 'Socks', 'Coffee', 'Naps'],
  preference: ['Pizza', 'Summer', 'Coffee', 'Beach', 'Films'],
  hypothetical: ['Sleep in', 'Call a friend', 'Go outside', 'Bake something'],
  numeric: ['5', '8', '12', '3'],
  choice: [],
};

/**
 * Simulates bot answers. Bots never call the AI and never see either question:
 * their answers come from small canned lists per kind.
 */
export function simulateImpostorQuestionBots(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  const { pair } = state;

  room.players.forEach((player) => {
    if (!player.isBot) return;
    if (state.answers[player.id]) return;

    if (pair.answerType === 'player') {
      const pool = room.players.filter((candidate) => candidate.id !== player.id);
      const target = pool[pickIndex(pool.length)] || player;
      recordImpostorQuestionAnswer(room, player.id, target.id);
      return;
    }

    if (pair.answerType === 'number') {
      const range = pair.numberRange || { min: 0, max: 10 };
      const value = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
      recordImpostorQuestionAnswer(room, player.id, String(value));
      return;
    }

    if (pair.answerType === 'choice') {
      const options = pair.choices || [];
      if (options.length === 0) return;
      recordImpostorQuestionAnswer(room, player.id, options[pickIndex(options.length)]);
      return;
    }

    const canned = BOT_TEXT_ANSWERS[pair.kind] || ['Not sure', 'Something fun'];
    recordImpostorQuestionAnswer(room, player.id, canned[pickIndex(canned.length)]);
  });
}

/* ---------------------------------------------------------------------- reveal */

export const QUESTION_NO_ANSWER = '(No answer)';

/**
 * Compiles the answers board: every player's answer in Fisher-Yates order, with
 * "(No answer)" for anyone who ran out of time. Neither question is included.
 */
export function finalizeImpostorQuestionReveal(room: InternalRoom): RevealedAnswer[] {
  const state = activeRounds.get(room.code);
  const compiled: RevealedAnswer[] = room.players.map((player) => {
    const answer = state?.answers[player.id];
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      answerText: answer?.text || QUESTION_NO_ANSWER,
      revealed: true,
      subtext: player.isHost ? 'Host' : undefined,
      ...(answer?.answeredPlayerId ? { answeredPlayerId: answer.answeredPlayerId } : {}),
    };
  });

  room.revealedAnswers = shuffle(compiled);
  if (room.impostorQuestionState) {
    room.impostorQuestionState.answersReady = true;
    room.impostorQuestionState.answeredPlayerIds = Object.keys(state?.answers || {});
  }
  // Make sure every player carries a submitted flag for the private UI.
  room.players.forEach((player) => {
    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    const answer = state?.answers[player.id];
    room.privateData[player.id].impostorAnswerSubmitted = true;
    room.privateData[player.id].impostorAnswerText = answer?.text || QUESTION_NO_ANSWER;
  });
  return room.revealedAnswers;
}

/* --------------------------------------------------------------------- results */

const KIND_NOTES: Record<QuestionPair['kind'], string> = {
  'most-likely': 'Both questions asked who was most likely to do something — just not the same thing.',
  'about-player': 'Both questions were about the same player, from two different angles.',
  preference: 'One side was asked what they love; the other what they would avoid.',
  hypothetical: 'Both questions were hypothetical situations — with different situations.',
  numeric: 'Both sides had to give a number, about two different habits.',
  choice: 'Everyone picked from the same options: one side the best, the other the worst.',
};

/**
 * Question-mode results: the usual tally/role reveal plus BOTH questions and a
 * one-line explanation of how they differed. Scoring is identical to word mode.
 */
export function calculateImpostorQuestionResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  const pair = state?.pair;
  const impostorId = state?.impostorPlayerId || '';
  const impostor = room.players.find((player) => player.id === impostorId);
  const crewQuestion = state?.crewQuestion || '';
  const impostorQuestion = state?.impostorQuestion || '';
  const impostorAnswer = state?.answers[impostorId]?.text || QUESTION_NO_ANSWER;

  const tallies: Record<string, number> = {};
  room.players.forEach((player) => {
    tallies[player.id] = 0;
  });

  const voteBreakdown: VoteBreakdownItem[] = [];
  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
    const voter = room.players.find((player) => player.id === voterId);
    const target = room.players.find((player) => player.id === targetId);
    if (voter && target) {
      voteBreakdown.push({
        voterId,
        voterName: voter.name,
        voterColorIndex: voter.colorIndex,
        targetId,
        targetName: target.name,
        isCorrect: targetId === impostorId,
      });
    }
  }

  let maxVotes = 0;
  for (const count of Object.values(tallies)) {
    if (count > maxVotes) maxVotes = count;
  }
  const highestVotedIds = Object.keys(tallies).filter((id) => tallies[id] === maxVotes && maxVotes > 0);
  const impostorCaught = highestVotedIds.length === 1 && highestVotedIds[0] === impostorId;
  const impostorEvaded = !impostorCaught;

  const pointsAwarded: Record<string, number> = {};
  room.players.forEach((player) => {
    pointsAwarded[player.id] = 0;
  });
  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    if (targetId === impostorId) pointsAwarded[voterId] = (pointsAwarded[voterId] || 0) + 1;
  }
  if (impostorEvaded && impostorId) pointsAwarded[impostorId] = (pointsAwarded[impostorId] || 0) + 1;

  room.players.forEach((player) => {
    awardPoints(room, player.id, pointsAwarded[player.id] || 0, 'impostor-question:round');
  });

  const roleReveals: RoleRevealInfo[] = room.players.map((player) => {
    const isImpostor = player.id === impostorId;
    const answer = state?.answers[player.id]?.text || QUESTION_NO_ANSWER;
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      role: isImpostor ? 'The Impostor' : 'Crew',
      isSpecialRole: isImpostor,
      explanation: isImpostor
        ? `Answered "${answer}" to a different question!`
        : `Answered "${answer}" to the shared question.`,
    };
  });

  const standings: PlayerResultStanding[] = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerColor: player.colorHex,
    colorIndex: player.colorIndex,
    pointsAdded: pointsAwarded[player.id] || 0,
    totalScore: player.score,
    badge: player.id === impostorId ? 'Impostor' : undefined,
  }));
  standings.sort((a, b) => b.totalScore - a.totalScore);

  const whyHint = impostorCaught
    ? `The table noticed ${impostor?.name || 'the impostor'} answered "${impostorAnswer}" as if the question were different.`
    : `${impostor?.name || 'The impostor'} blended in: "${impostorAnswer}" looked like a perfectly good answer to the crew's question.`;

  const note = pair
    ? `${KIND_NOTES[pair.kind]} The odd answer out was "${impostorAnswer}".`
    : 'The two questions were different, and one answer gave it away.';

  const results: PhaseResultsData = {
    summary: impostorCaught
      ? `Crew Victory! ${impostor?.name || 'The Impostor'} was unmasked!`
      : `Impostor Triumph! ${impostor?.name || 'The Impostor'} evaded detection!`,
    category: pair?.kind,
    impostorPlayerId: impostorId,
    impostorName: impostor?.name || 'The Impostor',
    impostorClue: impostorAnswer,
    impostorCaught,
    whyHint,
    voteTallies: tallies,
    voteBreakdown,
    roleReveals,
    standings,
    winnerTitle: impostorCaught ? 'Crew Victory (+1 pt for voters)' : 'Impostor Win (+1 pt)',
    impostorCrewQuestion: crewQuestion,
    impostorImpostorQuestion: impostorQuestion,
    impostorQuestionNote: note,
  };

  room.results = results;
}

export function cleanupImpostorQuestionRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}

/** Test seam: the active question round for a room. */
export function getImpostorQuestionRound(roomCode: string): QuestionRoundState | undefined {
  return activeRounds.get(roomCode);
}

export function impostorQuestionPlayerIds(room: InternalRoom): string[] {
  return room.players.map((player) => player.id);
}

/** Helper for the client/server to render a player-answer chip. */
export function describeQuestionAnswer(answer: QuestionAnswer, players: Player[]): string {
  if (answer.answeredPlayerId) {
    return players.find((player) => player.id === answer.answeredPlayerId)?.name || answer.text;
  }
  return answer.text;
}
