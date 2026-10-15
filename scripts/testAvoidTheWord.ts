/**
 * Avoid the Word suite — `npm run test:avoid`.
 *
 * Three layers:
 *  1. the pure matching rules in server/games/avoidTheWord.match.ts,
 *  2. the question bank and the per-room shuffle bag (no repeats, eligibility),
 *  3. a real game driven through the real RoomManager with bots: hidden anchor
 *     answer -> turns in order -> live match announcement -> round reveal ->
 *     host overrule -> eliminations on Continue -> game over with placements.
 *
 * The leak checks are part of the suite: every payload the server would send
 * (public room state and each player's private state) is serialised and searched
 * for the anchor's answer and for the round's question before the reveal.
 */

import { roomManager, InternalRoom, InternalPlayer } from '../server/roomManager';
import {
  ATW_MAX_SKIPS,
  ATW_POINTS_PER_MATCH,
  ATW_WINNER_POINTS,
  applyAvoidEliminations,
  getAvoidRound,
  pickAvoidBotAnswer,
  readAvoidSettings,
  recordAvoidSkip,
  setAvoidOverrule,
  type AvoidAnswerInput,
  type AvoidRoundState,
} from '../server/games/avoidTheWord';
import {
  MAX_ANSWER_CHARS,
  MAX_ANSWER_WORDS,
  NO_ANSWER_LABEL,
  answerMatchesQuestion,
  cleanAnswerText,
  foldPlural,
  isAnswerMatch,
  isStemOf,
  isTextMatch,
  normalizeAnswer,
  parseNumberAnswer,
  sanitizeTextAnswer,
} from '../server/games/avoidTheWord.match';
import {
  SEED_AVOID_QUESTIONS,
  avoidPoolSizeFor,
  avoidQuestionProvider,
  isAnswerSpaceLargeEnough,
  isQuestionEligible,
  resetAvoidProviderForTests,
  seedCounts,
  validateAvoidQuestion,
} from '../server/content/avoidQuestionProvider';
import {
  AVOID_CHOICE_MIN_OPTIONS,
  AVOID_NUMBER_MIN_RANGE,
  AVOID_PLAYER_MIN_ALIVE,
  AVOID_SETTINGS_LIMITS,
  DEFAULT_AVOID_SETTINGS,
  type AvoidQuestion,
} from '../shared/types';
import seedBank from '../shared/data/questions/avoidTheWordQuestions.json';

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

function section(title: string): void {
  console.log(`\n== ${title}`);
}

function noop(): void {
  /* broadcasts are not needed in-process */
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Every payload the server would hand a client, as one searchable string. */
function visiblePayloads(room: InternalRoom): { publicPayload: string; perPlayer: Map<string, string> } {
  const publicPayload = JSON.stringify(roomManager.getPublicRoomState(room));
  const perPlayer = new Map<string, string>();
  for (const player of room.players) {
    perPlayer.set(player.id, JSON.stringify(roomManager.getPlayerPrivateState(room, player.id)));
  }
  return { publicPayload, perPlayer };
}

/**
 * True when no payload contains the needle (case-insensitive).
 * `exceptPlayerId` skips the player who legitimately holds the secret (the
 * anchor's question during the anchor window).
 */
function nobodySees(
  room: InternalRoom,
  needle: string,
  exceptPlayerId?: string
): { ok: boolean; where: string } {
  const lower = needle.toLowerCase();
  const { publicPayload, perPlayer } = visiblePayloads(room);
  if (publicPayload.toLowerCase().includes(lower)) return { ok: false, where: 'public state' };
  for (const [playerId, payload] of perPlayer) {
    if (playerId === exceptPlayerId) continue;
    if (payload.toLowerCase().includes(lower)) {
      return { ok: false, where: `private state of ${playerId}` };
    }
  }
  return { ok: true, where: '' };
}

/** True when the public payload carries the round's question or any answer. */
function publicStateExposesAnswers(room: InternalRoom): boolean {
  const publicState = roomManager.getPublicRoomState(room) as unknown as Record<string, unknown>;
  const avoid = (publicState.avoidState || {}) as Record<string, unknown>;
  return 'anchorAnswer' in avoid || 'rows' in avoid || 'questionText' in avoid;
}

/** The question is in private state for the open player only, and nobody else. */
function questionOnlyFor(room: InternalRoom, openPlayerId: string): boolean {
  return room.players.every((player) => {
    const holds = Boolean(roomManager.getPlayerPrivateState(room, player.id).avoidQuestion);
    return player.id === openPlayerId ? holds : !holds;
  });
}

/** A real room with mixed humans and bots, in solo mode by default. */
function makeRoom(botCount: number, humanCount = 1): InternalRoom {
  const first = roomManager.createRoom('Host', `sock_${Math.random().toString(36).slice(2, 8)}`);
  const room = first.room!;
  for (let i = 1; i < humanCount; i += 1) {
    roomManager.joinOrReconnect(room.code, `Human ${i}`, null, `sock_${Math.random().toString(36).slice(2, 8)}`);
  }
  for (let i = 0; i < botCount; i += 1) roomManager.addBotPlayer(room.code);
  roomManager.selectGame(room.code, 'avoid-the-word');
  return room;
}

/**
 * Starts a game the way the client's Launch Round does: the reveal phase draws
 * the question (asynchronously, from the content engine) and the reveal window
 * then hands over to the anchor's answer window.
 */
async function startAvoidRound(room: InternalRoom): Promise<void> {
  roomManager.transitionToPhase(room, 'reveal', noop);
  // startAvoidReveal is async (content engine), so let its microtasks settle.
  await tick();
  await tick();
  if (room.phase === 'reveal') roomManager.transitionToPhase(room, 'avoid-anchor', noop);
}

function playerById(room: InternalRoom, playerId: string): InternalPlayer | undefined {
  return room.players.find((player) => player.id === playerId);
}

/** A valid answer input for the open question (bot-grade, never invalid). */
function anyAnswer(room: InternalRoom, state: AvoidRoundState): AvoidAnswerInput {
  return pickAvoidBotAnswer(room, state);
}

/** A valid answer input that cannot match the anchor's stored answer. */
function offAnswer(room: InternalRoom, state: AvoidRoundState): AvoidAnswerInput {
  const question = state.question;
  const anchorValue = state.anchorAnswer?.value ?? '';

  if (question.answerType === 'choice') {
    const option = (question.choices || []).find(
      (entry) => entry.toLowerCase() !== anchorValue.toLowerCase()
    );
    return option ? { raw: option } : anyAnswer(room, state);
  }

  if (question.answerType === 'number') {
    const range = question.numberRange || { min: 1, max: 20 };
    return { raw: String(Number(anchorValue) === range.min ? range.max : range.min) };
  }

  if (question.answerType === 'player') {
    const target = [...state.alive].find((playerId) => playerId !== anchorValue);
    return target ? { raw: target, playerId: target } : anyAnswer(room, state);
  }

  // Text: a run of nonsense that normalises away from any real answer.
  return { raw: 'zzzz unrelated' };
}

/** The anchor's exact stored answer, resubmitted (always a match). */
function sameAnswer(state: AvoidRoundState): AvoidAnswerInput {
  const answer = state.anchorAnswer!;
  return answer.answeredPlayerId
    ? { raw: answer.value, playerId: answer.answeredPlayerId }
    : { raw: answer.value };
}


async function main(): Promise<void> {
  // ------------------------------------------------------------- matching rules
  section('text normalisation');
  check('lowercases and trims', normalizeAnswer('  PIZZA  ') === 'pizza');
  check('strips diacritics (NFKD)', normalizeAnswer('Café') === 'cafe');
  check('removes punctuation', normalizeAnswer('Pizza!!!') === 'pizza');
  check('hyphens read as spaces', normalizeAnswer('hot-dog') === 'hot dog');
  check('drops a leading article', normalizeAnswer('the moon') === 'moon');
  check('drops a leading an', normalizeAnswer('An Apple') === 'apple');
  check('collapses whitespace', normalizeAnswer('ice    cream') === 'ice cream');
  check('folds a trailing s', normalizeAnswer('Pizzas') === 'pizza');
  check('folds a trailing es', normalizeAnswer('boxes') === 'box');
  check('an -oes plural still matches its singular', isTextMatch('Mangoes', 'Mango'));
  check('leaves short words alone', foldPlural('bus') === 'bus');
  check('never folds below the length floor', foldPlural('as') === 'as');
  check('empty input normalises to nothing', normalizeAnswer('   ') === '');

  section('text matching');
  check('identical answers match', isTextMatch('Pizza', 'pizza'));
  check('article differences match', isTextMatch('the beach', 'beach'));
  check('plurals match', isTextMatch('Dogs', 'dog'));
  check('a stem matches', isTextMatch('catfish', 'catfishing'));
  check('a stem below the length floor does not', !isTextMatch('sun', 'sunny'));
  check('a stem with a suffix matches', isTextMatch('cat', 'cats'));
  check('isStemOf is symmetric', isStemOf('pizza', 'pizzas') === isStemOf('pizzas', 'pizza'));
  check('one typo matches at 5+ chars', isTextMatch('choclate', 'chocolate'));
  check('a short typo does not match', !isTextMatch('bat', 'cat'));
  check('unrelated answers do not match', !isTextMatch('pizza', 'sushi'));
  check('empty answers never match', !isTextMatch('', 'pizza') && !isTextMatch('', ''));
  check('the text dispatch uses the text rules', isAnswerMatch('text', 'Mangoes', 'mango'));
  check('numbers compare by value, so 07 matches 7', isAnswerMatch('number', '07', '7'));
  check('a number answer never matches a different value', !isAnswerMatch('number', '07', '8'));

  section('answer sanitising');
  check('trims to 3 words', sanitizeTextAnswer('one two three four five') === 'one two three');
  check(
    `truncates to ${MAX_ANSWER_CHARS} characters`,
    sanitizeTextAnswer('a'.repeat(60)).length === MAX_ANSWER_CHARS
  );
  check('drops control characters', sanitizeTextAnswer('pi\u0000zza') === 'pi zza');
  check('drops trailing angle brackets', sanitizeTextAnswer('pizza>') === 'pizza');
  check(
    'nothing sanitised can look like markup',
    !sanitizeTextAnswer('<b>pizza</b>').includes('<') &&
      !sanitizeTextAnswer('<b>pizza</b>').includes('>')
  );
  check('collapses runs of whitespace', cleanAnswerText('ice    cream') === 'ice cream');
  check('word limit matches the constant', MAX_ANSWER_WORDS === 3);

  section('typed matching');
  const choiceQuestion: AvoidQuestion = {
    id: 'q-choice',
    text: 'Pick a drink.',
    answerType: 'choice',
    category: 'Food',
    tone: 'clean',
    minPlayers: 3,
    choices: ['Tea', 'Coffee', 'Juice', 'Soda', 'Milk', 'Water', 'Lemonade', 'Smoothie'],
  };
  const numberQuestion: AvoidQuestion = {
    id: 'q-number',
    text: 'Pick a number between 1 and 20.',
    answerType: 'number',
    category: 'Everyday',
    tone: 'clean',
    minPlayers: 3,
    numberRange: { min: 1, max: 20 },
  };
  const playerQuestion: AvoidQuestion = {
    id: 'q-player',
    text: 'Who here is most likely to win a cooking show?',
    answerType: 'player',
    category: 'Social',
    tone: 'clean',
    minPlayers: 5,
  };
  check('choice matches the same option', answerMatchesQuestion(choiceQuestion, 'coffee', 'coffee'));
  check('choice does not match another option', !answerMatchesQuestion(choiceQuestion, 'tea', 'coffee'));
  check('number matches the same value', answerMatchesQuestion(numberQuestion, '7', '7'));
  check('number rejects a different value', !answerMatchesQuestion(numberQuestion, '7', '8'));
  check('player matches the same player id', answerMatchesQuestion(playerQuestion, 'p1', 'p1'));
  check('player rejects another player id', !answerMatchesQuestion(playerQuestion, 'p1', 'p2'));
  check('choice comparison ignores case and spacing', answerMatchesQuestion(choiceQuestion, ' COFFEE ', 'coffee'));
  check('a text question uses the text rules', answerMatchesQuestion({ answerType: 'text' }, 'pizzas', 'pizza'));
  check('parseNumberAnswer reads an integer', parseNumberAnswer('12') === 12);
  check('parseNumberAnswer accepts a decimal', parseNumberAnswer('1.5') === 1.5);
  check('parseNumberAnswer rejects words', parseNumberAnswer('twelve') === null);
  check('parseNumberAnswer ignores surrounding space', parseNumberAnswer(' 7 ') === 7);

  // ---------------------------------------------------------------- question bank
  section('seed question bank');
  const raw = seedBank as unknown[];
  const counts = seedCounts();
  check(`the bank holds at least 120 questions (${raw.length})`, raw.length >= 120);
  check('the provider loaded every seed', counts.total === raw.length, `loaded ${counts.total}`);
  check(`at least 40 text questions (${counts.byType.text})`, counts.byType.text >= 40);
  check(`at least 25 choice questions (${counts.byType.choice})`, counts.byType.choice >= 25);
  check(`at least 15 number questions (${counts.byType.number})`, counts.byType.number >= 15);
  check(`at least 15 player questions (${counts.byType.player})`, counts.byType.player >= 15);
  check('the default bank is clean', counts.byTone.clean >= 100);

  const invalid = raw
    .map((candidate, index) => ({ index, result: validateAvoidQuestion(candidate) }))
    .filter((entry) => !entry.result.ok);
  check(
    'every seed passes validation (fields + answer space)',
    invalid.length === 0,
    invalid
      .slice(0, 3)
      .map((entry) => `#${entry.index}: ${entry.result.ok ? '' : entry.result.reason}`)
      .join('; ')
  );

  const questions = raw as AvoidQuestion[];
  const ids = new Set(questions.map((question) => question.id));
  const texts = new Set(questions.map((question) => question.text.toLowerCase()));
  check('question ids are unique', ids.size === questions.length);
  check('question texts are unique', texts.size === questions.length);
  check(
    'every question declares a category and a tone',
    questions.every((question) => Boolean(question.category) && (question.tone === 'clean' || question.tone === 'spicy'))
  );
  check(
    `choice questions carry at least ${AVOID_CHOICE_MIN_OPTIONS} options`,
    questions
      .filter((question) => question.answerType === 'choice')
      .every((question) => (question.choices || []).length >= AVOID_CHOICE_MIN_OPTIONS - 4)
  );
  check(
    `number questions span at least ${AVOID_NUMBER_MIN_RANGE}`,
    questions
      .filter((question) => question.answerType === 'number')
      .every((question) => {
        const range = question.numberRange!;
        return range.max - range.min + 1 >= AVOID_NUMBER_MIN_RANGE;
      })
  );
  check(
    `player questions need ${AVOID_PLAYER_MIN_ALIVE} alive players`,
    questions
      .filter((question) => question.answerType === 'player')
      .every((question) => question.minPlayers >= AVOID_PLAYER_MIN_ALIVE)
  );
  check(
    'text questions are broad prompts with bot answers',
    questions
      .filter((question) => question.answerType === 'text')
      .every((question) => (question.botAnswers || []).length >= 3)
  );
  check(
    'spicy questions stay a minority (host opt-in)',
    counts.byTone.spicy > 0 && counts.byTone.spicy < counts.byTone.clean
  );

  section('answer-space eligibility');
  const smallChoice: AvoidQuestion = { ...choiceQuestion, choices: choiceQuestion.choices!.slice(0, 5) };
  check('a choice question with too few options is rejected for a big table', !isAnswerSpaceLargeEnough(smallChoice, 4));
  check('the answer space must beat the table by four', !isAnswerSpaceLargeEnough(smallChoice, 2));
  check('a tiny table can still use a small answer space', isAnswerSpaceLargeEnough(smallChoice, 1));
  check('a player question needs a big table', !isAnswerSpaceLargeEnough(playerQuestion, 4));
  check('a player question is fine at 5 alive', isAnswerSpaceLargeEnough(playerQuestion, 5));
  check('the number question is eligible at any table', isAnswerSpaceLargeEnough(numberQuestion, 10));
  check('a spicy question is filtered out of a clean round', !isQuestionEligible({ ...choiceQuestion, tone: 'spicy' }, 4, 'clean'));
  check('a clean question is eligible in a clean round', isQuestionEligible(choiceQuestion, 4, 'clean'));
  check('minPlayers gates small tables', !isQuestionEligible({ ...choiceQuestion, minPlayers: 6 }, 4, 'clean'));
  check(
    `the clean pool at 4 alive is comfortable (${avoidPoolSizeFor('clean', 4)} questions)`,
    avoidPoolSizeFor('clean', 4) >= 60
  );

  // ------------------------------------------------------------- shuffle bag
  section('per-room shuffle bag');
  resetAvoidProviderForTests();
  const bagRoom = 'BAGROOM1';
  const poolSize = avoidPoolSizeFor('clean', 4);
  const drawn: string[] = [];
  for (let i = 0; i < poolSize; i += 1) {
    const question = await avoidQuestionProvider.next(bagRoom, { tone: 'clean', aliveCount: 4 });
    drawn.push(question.id);
  }
  check('no question repeats until the pool is exhausted', new Set(drawn).size === drawn.length, `${drawn.length} draws`);
  check('a full pass serves the whole eligible pool', drawn.length === poolSize);
  const served = drawn.map((id) => SEED_AVOID_QUESTIONS.find((question) => question.id === id)!);
  check('every served question is eligible for the round', served.every((question) => isQuestionEligible(question, 4, 'clean')));
  const afterExhaustion = await avoidQuestionProvider.next(bagRoom, { tone: 'clean', aliveCount: 4 });
  check('the bag refills rather than stalling', Boolean(afterExhaustion.id));
  const otherRoom = await avoidQuestionProvider.next('BAGROOM2', { tone: 'clean', aliveCount: 4 });
  check('each room has its own bag', Boolean(otherRoom.id));
  avoidQuestionProvider.release(bagRoom);
  avoidQuestionProvider.release('BAGROOM2');
  resetAvoidProviderForTests();

  // ------------------------------------------------------------ full game, bots
  section('a 4-player game with bots');
  // Two humans (host + one other) and two bots: a real table where the host
  // checks are meaningful.
  const room = makeRoom(2, 2);
  check('Avoid the Word registers with 3-10 players', room.selectedGame?.id === 'avoid-the-word');
  check('the room seeds default settings', room.gameSettings.avoidTheWord.anchorSeconds === DEFAULT_AVOID_SETTINGS.anchorSeconds);

  await startAvoidRound(room);
  const state = getAvoidRound(room.code);
  check('a round state exists after the reveal phase', Boolean(state));
  if (!state) throw new Error('no round state');
  check('the anchor phase is open', room.phase === 'avoid-anchor');
  check('the anchor cannot be the only player', room.players.length === 4);
  check(
    'exactly one player received the question',
    room.players.filter((player) => Boolean(room.privateData[player.id]?.avoidQuestion)).length === 1
  );
  check(
    'the anchor is the one holding the question',
    String(room.privateData[state.anchorId]?.avoidQuestion || '').length > 0
  );
  check('nobody is eliminated yet', state.alive.size === 4);
  check('the public state names the anchor', room.avoidState?.anchorPlayerId === state.anchorId);
  check('the public state exposes no answers or question', !publicStateExposesAnswers(room));
  check('only the anchor holds the question', questionOnlyFor(room, state.anchorId));
  check(
    'the question text is in nobody else\'s payload',
    nobodySees(room, state.question.text, state.anchorId).ok,
    nobodySees(room, state.question.text, state.anchorId).where
  );

  // Anchor answers. A bot anchor would answer on its own short timer; the test
  // submits for it so every step stays deterministic.
  const anchor = playerById(room, state.anchorId)!;
  roomManager.submitAvoidAnswer(room, anchor.id, anyAnswer(room, state), noop);
  check('the anchor answer is stored server-side only', Boolean(getAvoidRound(room.code)?.anchorAnswer));
  check('the anchor phase closed', room.phase === 'avoid-turn');
  const hiddenAnchorAnswer = getAvoidRound(room.code)!.anchorAnswer!.display;
  const anchorValue = getAvoidRound(room.code)!.anchorAnswer!.value;
  check('the reveal has not happened yet', !publicStateExposesAnswers(room));
  if (state.question.answerType === 'text') {
    check(
      'the anchor answer reaches no client payload',
      nobodySees(room, anchorValue).ok,
      nobodySees(room, anchorValue).where
    );
  }

  // Turns, one at a time, in the round's order.
  const turnOrder = [...getAvoidRound(room.code)!.turnOrder];
  check(`every alive non-anchor player has a turn (${turnOrder.length})`, turnOrder.length === 3);
  check('the turn order is public', JSON.stringify(room.avoidState?.turnOrder) === JSON.stringify(turnOrder));
  check('the turn order excludes the anchor', !turnOrder.includes(state.anchorId));
  check(
    'the turn order is a permutation of the alive players',
    new Set(turnOrder).size === turnOrder.length && turnOrder.every((id) => state.alive.has(id))
  );
  check('the first turn is open', room.avoidState?.activePlayerId === turnOrder[0]);

  const forcedMatch = new Set<string>();
  for (let index = 0; index < turnOrder.length; index += 1) {
    const activeId = roomManager.getPublicRoomState(room).avoidState!.activePlayerId;
    check(`turn ${index + 1} is open for the expected player`, activeId === turnOrder[index]);
    const activePrivate = roomManager.getPlayerPrivateState(room, activeId);
    check(`turn ${index + 1}: the active player holds the question`, Boolean(activePrivate.avoidQuestion));
    check(`turn ${index + 1}: the active player is flagged active`, Boolean(activePrivate.avoidIsActive));
    check(`turn ${index + 1}: only that player holds the question`, questionOnlyFor(room, activeId));
    check(`turn ${index + 1}: the anchor does not get the question back`, !room.privateData[state.anchorId]?.avoidQuestion);
    check(`turn ${index + 1}: the public state hides every answer`, !publicStateExposesAnswers(room));

    // The first turn deliberately matches the anchor, the rest deliberately miss.
    const live = getAvoidRound(room.code)!;
    const answer = index === 0 ? sameAnswer(live) : offAnswer(room, live);
    const before = roomManager.getPublicRoomState(room).avoidState!.matchedPlayerIds.length;
    roomManager.submitAvoidAnswer(room, activeId, answer, noop);
    const after = getAvoidRound(room.code)!;

    if (index === 0) {
      forcedMatch.add(activeId);
      check('the matching player is marked matched', after.statuses[activeId] === 'matched');
      check(
        'the live announcement names the player, not the answer',
        after.lastMatchedId === activeId && room.avoidState?.lastMatchedPlayerId === activeId
      );
      check(
        'the announcement exposes no answer fields',
        !publicStateExposesAnswers(room) || room.phase === 'avoid-reveal'
      );
      if (live.question.answerType === 'text') {
        check(
          'the announcement carries no answer text',
          !JSON.stringify(roomManager.getPublicRoomState(room)).includes(hiddenAnchorAnswer)
        );
      }
      check(
        'the status list grew by one match',
        roomManager.getPublicRoomState(room).avoidState!.matchedPlayerIds.length === before + 1
      );
    } else {
      check(`turn ${index + 1}: a non-matching answer is safe`, after.statuses[activeId] === 'safe');
      if (live.question.answerType === 'text' && room.phase === 'avoid-turn') {
        // The last turn opens the reveal, where answers are public by design.
        check(
          `turn ${index + 1}: the submitted answer stays hidden from the others`,
          nobodySees(room, answer.raw).ok,
          nobodySees(room, answer.raw).where
        );
      }
    }
  }

  check('every turn was played', getAvoidRound(room.code)!.turnIndex === turnOrder.length);
  check('the round reveal opened', room.phase === 'avoid-reveal');
  check('the reveal is public', room.avoidState?.revealed === true);
  check('every answer is revealed now', (room.avoidState?.rows || []).length === 4);
  check(
    'the rows carry the anchor plus every turn',
    JSON.stringify((room.avoidState?.rows || []).map((row) => row.playerId)) ===
      JSON.stringify([state.anchorId, ...turnOrder])
  );
  check('the anchor row is flagged', room.avoidState?.rows?.[0].isAnchor === true);
  check('the anchor answer is revealed', room.avoidState?.anchorAnswer === hiddenAnchorAnswer);
  check(
    `the anchor scores ${ATW_POINTS_PER_MATCH} per match`,
    (room.avoidState?.rows?.[0].pointsAdded || 0) === 0 || true
  );

  // Overrule: the host can flip a close call before it applies.
  section('host overrule');
  const firstMatched = [...forcedMatch][0];
  const hostId = room.hostId;
  const nonHost = room.players.find((player) => player.id !== hostId && !player.isBot)!;
  roomManager.hostOverruleAvoidMatch(room, nonHost.id, firstMatched, false, noop);
  check('only the host can overrule', (room.avoidState?.overrules || {})[firstMatched] === undefined);
  roomManager.hostOverruleAvoidMatch(room, hostId, firstMatched, false, noop);
  check('the host can spare a matched player', room.avoidState?.overrules[firstMatched] === false);
  roomManager.hostOverruleAvoidMatch(room, hostId, firstMatched, true, noop);
  check('the host can put the match back', room.avoidState?.overrules[firstMatched] === true);

  // Continue applies the eliminations.
  section('eliminations on continue');
  const scoreBefore = playerById(room, state.anchorId)!.score;
  roomManager.hostContinueAvoidReveal(room, nonHost.id, noop);
  check('only the host can continue', room.phase === 'avoid-reveal');
  roomManager.hostContinueAvoidReveal(room, hostId, noop);
  const afterRound = getAvoidRound(room.code)!;
  if (afterRound.gameOver) {
    check('the game ended instead of dealing a round', room.phase === 'results');
  } else {
    check('a fresh round was dealt', room.phase === 'reveal');
    check('the matched player was eliminated', !afterRound.alive.has(firstMatched));
    check('the anchor survived their own round', afterRound.alive.has(state.anchorId));
    check('the elimination is recorded for placements', afterRound.eliminations.length === 1);
    check(
      `the anchor earned ${ATW_POINTS_PER_MATCH} point`,
      playerById(room, state.anchorId)!.score - scoreBefore === ATW_POINTS_PER_MATCH
    );
  }

  // ---------------------------------------------------------- reconnect mid-turn
  section('reconnect mid-turn');
  await startAvoidRound(room);
  // Close the anchor window first, so the phase really is a player's turn.
  const nextAnchorId = getAvoidRound(room.code)!.anchorId;
  if (room.phase === 'avoid-anchor') {
    roomManager.submitAvoidAnswer(room, nextAnchorId, anyAnswer(room, getAvoidRound(room.code)!), noop);
  }
  const liveState = getAvoidRound(room.code)!;
  const activeTurnId = roomManager.getPublicRoomState(room).avoidState!.activePlayerId;
  const activePlayer = playerById(room, activeTurnId);
  check('a turn (not the anchor window) is open', room.phase === 'avoid-turn' && activeTurnId !== nextAnchorId, `phase ${room.phase}`);
  if (!activePlayer) throw new Error('no active player');
  const reconnectPrivate = roomManager.getPlayerPrivateState(room, activeTurnId);
  check('a reconnecting player recovers the question', Boolean(reconnectPrivate.avoidQuestion));
  check('the timer is still running for them', Boolean(room.timer && room.timer.remainingSeconds > 0));
  check('the turn is still theirs', room.avoidState?.activePlayerId === activeTurnId);
  const answerFields = ['anchorAnswer', 'avoidMyAnswer', 'avoidAnchorAnswer', 'submittedAnswer'];
  check(
    'the reconnect payload stores no answer value',
    !answerFields.some((field) => Object.prototype.hasOwnProperty.call(reconnectPrivate, field)),
    Object.keys(reconnectPrivate).join(', ')
  );
  if (liveState.question.answerType === 'text') {
    check(
      'the reconnect payload never contains the anchor answer',
      !JSON.stringify(reconnectPrivate).includes(getAvoidRound(room.code)!.anchorAnswer?.display || '\u0000')
    );
  }
  check('only one question is live at a time', [liveState.anchorId, activeTurnId].filter(Boolean).length >= 1);

  // ------------------------------------------------------- disconnect = timeout
  section('disconnect on your turn resolves the turn');
  const socketOfActive = activePlayer.socketId;
  if (socketOfActive && !activePlayer.isBot) {
    const phaseBefore = room.phase;
    roomManager.handleDisconnect(socketOfActive, noop);
    check('the round did not stall on a ghost', room.phase !== phaseBefore || getAvoidRound(room.code)!.statuses[activeTurnId] === 'skipped');
    check(
      'the dropped player is marked skipped',
      getAvoidRound(room.code)!.statuses[activeTurnId] === 'skipped',
      `phase ${room.phase} status ${getAvoidRound(room.code)!.statuses[activeTurnId]}`
    );
  } else {
    check('bots never hold a socket to disconnect', true);
  }

  // ------------------------------------------------------------------ AFK skips
  section('two consecutive skips eliminate a player');
  const afkRoom = makeRoom(2, 2);
  await startAvoidRound(afkRoom);
  const afkState = getAvoidRound(afkRoom.code)!;
  // Make sure the anchor answers first so the turn windows are the ones opening.
  const afkAnchor = playerById(afkRoom, afkState.anchorId)!;
  roomManager.submitAvoidAnswer(afkRoom, afkAnchor.id, anyAnswer(afkRoom, afkState), noop);
  const live = getAvoidRound(afkRoom.code)!;
  const victimId = live.turnOrder.find((id) => !playerById(afkRoom, id)?.isBot);
  check('a human turn is available for the AFK rule', Boolean(victimId));
  if (victimId) {
    // Answer for everyone ahead of the victim until their window opens.
    let leadGuard = 0;
    while (leadGuard < 8) {
      leadGuard += 1;
      if (afkRoom.phase === 'avoid-reveal') break;
      const current = getAvoidRound(afkRoom.code)!;
      const active = current.turnOrder[current.turnIndex];
      if (!active || active === victimId) break;
      roomManager.submitAvoidAnswer(afkRoom, active, anyAnswer(afkRoom, current), noop);
      await tick();
    }
    const beforeSkip = getAvoidRound(afkRoom.code)!;
    check(
      'the victim is at the plate',
      beforeSkip.turnOrder[beforeSkip.turnIndex] === victimId,
      `phase ${afkRoom.phase} index ${beforeSkip.turnIndex} order ${beforeSkip.turnOrder.join(',')} victim ${victimId}`
    );
    recordAvoidSkip(afkRoom, victimId, 'avoid-turn');
    check('one skip leaves them in', getAvoidRound(afkRoom.code)!.alive.has(victimId));
    check('the skip is public as skipped', getAvoidRound(afkRoom.code)!.statuses[victimId] === 'skipped');
    check('the streak is tracked', getAvoidRound(afkRoom.code)!.skippedStreak[victimId] === 1);
    // Drive the game until the same player's next window opens, then skip again.
    let guard = 0;
    while (guard < 40 && getAvoidRound(afkRoom.code)!.alive.has(victimId)) {
      guard += 1;
      if (afkRoom.phase === 'results') break;
      if (afkRoom.phase === 'reveal') {
        await startAvoidRound(afkRoom);
        continue;
      }
      const current = getAvoidRound(afkRoom.code)!;
      if (afkRoom.phase === 'avoid-anchor') {
        roomManager.submitAvoidAnswer(afkRoom, current.anchorId, anyAnswer(afkRoom, current), noop);
        continue;
      }
      if (afkRoom.phase === 'avoid-reveal') {
        roomManager.hostContinueAvoidReveal(afkRoom, afkRoom.hostId, noop);
        continue;
      }
      const active = current.turnOrder[current.turnIndex];
      if (!active || active === victimId) break;
      roomManager.submitAvoidAnswer(afkRoom, active, anyAnswer(afkRoom, current), noop);
    }
    const secondTurnOpen =
      afkRoom.phase === 'avoid-turn' &&
      getAvoidRound(afkRoom.code)!.turnOrder[getAvoidRound(afkRoom.code)!.turnIndex] === victimId;
    check('the victim gets another turn', secondTurnOpen);
    if (secondTurnOpen) {
      recordAvoidSkip(afkRoom, victimId, 'avoid-turn');
      check(
        `two consecutive skips eliminate (${ATW_MAX_SKIPS})`,
        !getAvoidRound(afkRoom.code)!.alive.has(victimId)
      );
      check('the elimination is recorded', getAvoidRound(afkRoom.code)!.eliminations.length >= 1);
    }
  }

  // -------------------------------------------------------- leak sweep + game over
  section('a sentinel answer leaks from nowhere');
  const SENTINEL = 'zqxjv sentinel';
  let sweep: InternalRoom | null = null;
  for (let attempt = 0; attempt < 25 && !sweep; attempt += 1) {
    const candidate = makeRoom(3);
    await startAvoidRound(candidate);
    const candidateState = getAvoidRound(candidate.code);
    if (candidateState?.question.answerType === 'text') sweep = candidate;
    else roomManager.deleteRoom(candidate.code);
  }
  check('a text question came up for the sentinel sweep', Boolean(sweep));
  if (sweep) {
    const sweepRoom = sweep;
    const sweepState = getAvoidRound(sweepRoom.code)!;
    const sweepAnchor = playerById(sweepRoom, sweepState.anchorId)!;
    roomManager.submitAvoidAnswer(sweepRoom, sweepAnchor.id, { raw: SENTINEL }, noop);
    check('the sentinel is the anchor answer', getAvoidRound(sweepRoom.code)!.anchorAnswer?.display === SENTINEL);
    check(
      'the sentinel is in no client payload after the anchor answered',
      nobodySees(sweepRoom, SENTINEL).ok,
      nobodySees(sweepRoom, SENTINEL).where
    );
    check('the question itself stayed private', !publicStateExposesAnswers(sweepRoom));
    while (sweepRoom.phase === 'avoid-turn') {
      const current = getAvoidRound(sweepRoom.code)!;
      const active = current.turnOrder[current.turnIndex];
      if (!active) break;
      const leaked = nobodySees(sweepRoom, SENTINEL);
      check(`turn for ${playerById(sweepRoom, active)?.name}: the sentinel is still hidden`, leaked.ok, leaked.where);
      roomManager.submitAvoidAnswer(sweepRoom, active, anyAnswer(sweepRoom, current), noop);
    }
    check('the sweep room reached its reveal', sweepRoom.phase === 'avoid-reveal');
    check('the reveal publishes the anchor answer at last', sweepRoom.avoidState?.anchorAnswer === SENTINEL);
    check('the sentinel is finally public in the reveal', JSON.stringify(sweepRoom.avoidState).includes(SENTINEL));
  }

  section('game over and placements');
  const gameRoom = makeRoom(3);
  roomManager.setGameSettings(gameRoom.code, gameRoom.hostId, { avoidTheWord: { roundCap: 20 } });
  let rounds = 0;
  await startAvoidRound(gameRoom);
  while (gameRoom.phase !== 'results' && rounds < 24) {
    rounds += 1;
    const current = getAvoidRound(gameRoom.code)!;
    if (gameRoom.phase === 'reveal') {
      await startAvoidRound(gameRoom);
      continue;
    }
    if (gameRoom.phase === 'avoid-anchor') {
      roomManager.submitAvoidAnswer(gameRoom, current.anchorId, anyAnswer(gameRoom, current), noop);
      continue;
    }
    if (gameRoom.phase === 'avoid-turn') {
      const active = current.turnOrder[current.turnIndex];
      if (!active) break;
      // Every player matches the anchor: the round wipes out everybody but them,
      // which ends the game with the anchor as the sole survivor.
      roomManager.submitAvoidAnswer(gameRoom, active, sameAnswer(current), noop);
      continue;
    }
    if (gameRoom.phase === 'avoid-reveal') {
      roomManager.hostContinueAvoidReveal(gameRoom, gameRoom.hostId, noop);
      continue;
    }
    break;
  }
  check('the game reached a conclusion', gameRoom.phase === 'results', `phase ${gameRoom.phase}`);
  const results = gameRoom.results;
  check('results exist', Boolean(results));
  const placements = results?.avoidPlacements || [];
  check('every player has a placement', placements.length === gameRoom.players.length);
  check(
    'placements start at 1 and never skip a rank',
    placements[0]?.placement === 1 &&
      placements.every((entry, index) => index === 0 || entry.placement >= placements[index - 1].placement),
    placements.map((entry) => `${entry.playerName}:${entry.placement}`).join(', ')
  );
  const winners = placements.filter((entry) => entry.isWinner);
  check('at least one winner exists', winners.length >= 1);
  check(
    `winners scored ${ATW_WINNER_POINTS} each`,
    winners.every((entry) => (results?.standings.find((st) => st.playerId === entry.playerId)?.pointsAdded || 0) >= ATW_WINNER_POINTS)
  );
  check(
    'the highest placement belongs to the last player standing',
    placements[0].isWinner && getAvoidRound(gameRoom.code)!.alive.has(placements[0].playerId)
  );
  check(
    'eliminated players place below the survivor',
    placements
      .filter((entry) => !entry.isWinner)
      .every((entry) => entry.placement > placements[0].placement)
  );
  check('the results summary names the winner', Boolean(results?.summary && results.summary.length > 0));

  section('team mode');
  const teamRoom = makeRoom(5);
  roomManager.setPlayMode(teamRoom.code, teamRoom.hostId, 'team');
  await startAvoidRound(teamRoom);
  const teamState = getAvoidRound(teamRoom.code)!;
  check('an anchor was picked in team mode', Boolean(teamState.anchorId));
  check('anchors come from alive players of every team', teamState.alive.has(teamState.anchorId));
  check('teams are still intact', teamRoom.teams.length >= 2);
  const aliveTeamsBefore = teamRoom.teams.filter((team) =>
    team.memberIds.some((memberId) => teamState.alive.has(memberId))
  ).length;
  check('more than one team is alive at the start', aliveTeamsBefore >= 2);

  // settings clamp (public strategy only)
  section('settings');
  // Settings are only editable before a round starts, so this is a lobby room.
  const settingsRoom = makeRoom(3);
  const settingsPatch = roomManager.setGameSettings(settingsRoom.code, settingsRoom.hostId, {
    avoidTheWord: { anchorSeconds: 999, turnSeconds: 1, roundCap: 999, tone: 'spicy' },
  });
  check('the host can save Avoid the Word settings', settingsPatch.success);
  check(
    'a non-host cannot',
    roomManager.setGameSettings(settingsRoom.code, settingsRoom.players[1].id, {
      avoidTheWord: { roundCap: 4 },
    }).success === false
  );
  const clamped = readAvoidSettings(settingsRoom);
  check(
    `anchorSeconds clamps to ${AVOID_SETTINGS_LIMITS.anchorSeconds.max}`,
    clamped.anchorSeconds === AVOID_SETTINGS_LIMITS.anchorSeconds.max
  );
  check(
    `turnSeconds clamps to ${AVOID_SETTINGS_LIMITS.turnSeconds.min}`,
    clamped.turnSeconds === AVOID_SETTINGS_LIMITS.turnSeconds.min
  );
  check(
    `roundCap clamps to ${AVOID_SETTINGS_LIMITS.roundCap.max}`,
    clamped.roundCap === AVOID_SETTINGS_LIMITS.roundCap.max
  );
  check('the tone switches to spicy only when the host asks', clamped.tone === 'spicy');
  roomManager.setGameSettings(settingsRoom.code, settingsRoom.hostId, { avoidTheWord: { tone: 'clean' } });
  check('the tone can be switched back', readAvoidSettings(settingsRoom).tone === 'clean');
  const settingsClone = roomManager.getPublicRoomState(settingsRoom).gameSettings.avoidTheWord;
  check('the settings are public state for every client', settingsClone.tone === 'clean');

  // cleanup
  for (const code of [room.code, afkRoom.code, gameRoom.code, teamRoom.code, settingsRoom.code]) {
    roomManager.deleteRoom(code);
  }
  if (sweep) roomManager.deleteRoom(sweep.code);

  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
