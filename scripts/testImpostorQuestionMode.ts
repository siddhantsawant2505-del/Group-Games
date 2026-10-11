/**
 * Impostor question-mode suite — `npm run test:questions`.
 *
 * Drives the real engine against a real room (built through `roomManager`) with
 * bots, for all four answer types and a `{target}` question, and asserts the
 * security rules: no question ever reaches public state before results, and
 * nothing tells the impostor who they are.
 */

import { roomManager } from '../server/roomManager';
import {
  QUESTION_MAX_CHARS,
  QUESTION_MAX_WORDS,
  calculateImpostorQuestionResults,
  clampQuestionText,
  cleanupImpostorQuestionRound,
  finalizeImpostorQuestionReveal,
  getImpostorQuestionRound,
  recordImpostorQuestionAnswer,
  sanitizeQuestionText,
  setupImpostorQuestionRound,
  simulateImpostorQuestionBots,
} from '../server/games/impostor';
import fs from 'fs';
import path from 'path';
import {
  SEED_QUESTION_PAIRS,
  isNearDuplicate,
  pairPoolSizeFor,
  resetQuestionProviderForTests,
  textSimilarity,
  validateAiPairs,
  validateQuestionPair,
  questionProvider,
} from '../server/content/questionProvider';
import { AnswerType, QuestionPair } from '../shared/types';

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

/**
 * Builds a real room through the real manager (its own generated code), adds
 * bots, points it at Impostor question mode and drops it into the input phase.
 */
function makeRoom(botCount = 2) {
  const { room } = roomManager.createRoom(
    'Host',
    `sock_${Math.random().toString(36).slice(2, 8)}`
  );
  for (let i = 0; i < botCount; i += 1) roomManager.addBotPlayer(room.code);
  roomManager.selectGame(room.code, 'impostor');
  roomManager.setGameSettings(room.code, room.hostId, {
    impostor: { mode: 'question', tone: 'clean' },
  });
  room.phase = 'input';
  return room;
}

function pairFor(answerType: AnswerType, needsTarget?: boolean): QuestionPair {
  const match = SEED_QUESTION_PAIRS.find(
    (pair) =>
      pair.answerType === answerType && (needsTarget === undefined || pair.needsTarget === needsTarget)
  );
  if (!match) throw new Error(`no seed pair for ${answerType}${needsTarget ? ' with target' : ''}`);
  return match;
}

/** Public state as the client sees it — the surface secrets must never leak into. */
function publicSnapshot(room: ReturnType<typeof makeRoom>): string {
  return JSON.stringify({
    impostorQuestionState: room.impostorQuestionState,
    revealedAnswers: room.revealedAnswers,
    phasePrompt: room.phasePrompt,
    phaseSubprompt: room.phaseSubprompt,
    results: null,
  });
}

async function main(): Promise<void> {
  // ------------------------------------------------------------------ seed bank
  section('seed bank');
  console.log(
    `pairs: total ${SEED_QUESTION_PAIRS.length}, clean ${pairPoolSizeFor('clean')}, spicy ${pairPoolSizeFor('spicy')}`
  );
  check('the bank ships at least 150 pairs', SEED_QUESTION_PAIRS.length >= 150, `${SEED_QUESTION_PAIRS.length}`);
  check(
    'at least 30 pairs need a target',
    SEED_QUESTION_PAIRS.filter((pair) => pair.needsTarget).length >= 30,
    `${SEED_QUESTION_PAIRS.filter((pair) => pair.needsTarget).length}`
  );
  const kindsCovered = new Set(SEED_QUESTION_PAIRS.map((pair) => pair.kind));
  const typesCovered = new Set(SEED_QUESTION_PAIRS.map((pair) => pair.answerType));
  check('all six kinds are covered', kindsCovered.size === 6, [...kindsCovered].join(','));
  check('all four answer types are covered', typesCovered.size === 4, [...typesCovered].join(','));
  check('both tones are covered', pairPoolSizeFor('clean') > 0 && pairPoolSizeFor('spicy') > 0);
  check(
    'every shipped pair passes the validator',
    SEED_QUESTION_PAIRS.every((pair) => validateQuestionPair(pair).ok),
    SEED_QUESTION_PAIRS.filter((pair) => !validateQuestionPair(pair).ok)
      .map((pair) => `${pair.id}: ${validateQuestionPair(pair).reason}`)
      .join(' | ')
  );
  check(
    'every targeted pair carries a selfText',
    SEED_QUESTION_PAIRS.filter((pair) => pair.needsTarget).every(
      (pair) => typeof pair.crew.selfText === 'string' && pair.crew.selfText.length > 0
    )
  );
  const maxSimilarity = Math.max(
    ...SEED_QUESTION_PAIRS.map((pair) => textSimilarity(pair.crew.text, pair.impostor.text))
  );
  const dupes = SEED_QUESTION_PAIRS.filter((pair) => isNearDuplicate(pair.crew.text, pair.impostor.text));
  check('no shipped pair is a near-duplicate', dupes.length === 0, dupes.map((pair) => pair.id).join(','));
  console.log(`highest shipped similarity: ${maxSimilarity.toFixed(2)}`);
  check(
    'parallel pairs that differ by one qualifier are not duplicates',
    !isNearDuplicate(
      'Who is most likely to arrive an hour early?',
      'Who is most likely to arrive an hour late?'
    )
  );

  // ------------------------------------------------------------------ validation
  section('validateQuestionPair');
  const rewordedDuplicate: unknown = {
    kind: 'preference',
    answerType: 'text',
    tone: 'clean',
    crew: { text: 'Name a food you could eat every single day.' },
    impostor: { text: 'Name a food you could eat every day.' },
    needsTarget: false,
  };
  const base = SEED_QUESTION_PAIRS[0];
  const rejections: [string, unknown, Record<string, unknown>?][] = [
    ['kind/answer-type mismatch', { ...base, kind: 'numeric' }],
    ['requested answer type mismatch', { ...base }, { requestedAnswerType: 'number' as AnswerType }],
    ['tone mismatch', { ...base }, { tone: 'spicy' as const }],
    ['short question text', { ...base, crew: { text: 'Who?' }, impostor: { text: 'Who is most likely to nap?' } }],
    ['near-identical pair', rewordedDuplicate],
    ['{target} on one side only', { ...pairFor('text', true), impostor: { text: 'What snack do you refuse to share?' } }],
    ['needsTarget without a token', { ...pairFor('text', true), crew: { text: 'What snack does someone eat most?' } }],
    ['targeted pair without selfText', { ...pairFor('text', true), crew: { text: 'What snack does {target} eat the most?' } }],
    ['unknown kind', { ...base, kind: 'nonsense' }],
    ['choices on a text pair', { ...base, choices: ['A', 'B', 'C'] }],
    ['range on a text pair', { ...base, numberRange: { min: 0, max: 5 } }],
    ['numeric pair with a bad range', { ...pairFor('number'), numberRange: { min: 9, max: 3 } }],
    ['numeric pair without a range', { ...pairFor('number'), numberRange: undefined }],
    ['choice pair with duplicate options', { ...pairFor('choice'), choices: ['Pizza', 'pizza', 'Toast'] }],
    ['choice pair with too few options', { ...pairFor('choice'), choices: ['Only'] }],
    ['mismatched per-side options', { ...pairFor('choice'), crewChoices: ['A', 'B', 'C'], impostorChoices: ['A', 'B', 'D'] }],
  ];
  for (const [label, candidate, options] of rejections) {
    const result = validateQuestionPair(candidate, options);
    check(`rejects ${label}`, !result.ok, result.ok ? 'accepted' : undefined);
  }
  const blocklistWords = fs
    .readFileSync(path.join(process.cwd(), 'data', 'blocklist.txt'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  const blocklisted: unknown = {
    ...base,
    crew: { text: `Who is most likely to shout ${blocklistWords[0]} at a wedding?` },
  };
  check(
    `rejects blocklisted language (${blocklistWords[0]})`,
    !validateQuestionPair(blocklisted).ok,
    validateQuestionPair(blocklisted).reason
  );
  check(
    'rejects blocklisted options in a choice pair',
    !validateQuestionPair({ ...pairFor('choice'), choices: ['Fine', blocklistWords[0], 'Also fine'] }).ok
  );
  check('accepts a shipped pair', validateQuestionPair(SEED_QUESTION_PAIRS[3]).ok);  check(
    'a reworded duplicate is rejected as near-identical',
    isNearDuplicate('Name a food you could eat every single day.', 'Name a food you could eat every day.')
  );
  check('similarity of an identical string is 1', textSimilarity('Same text here', 'Same text here') === 1);

  // ------------------------------------------------------------------ per-type play
  section('question rounds by answer type');
  for (const answerType of ['player', 'text', 'number', 'choice'] as AnswerType[]) {
    const room = makeRoom();
    const code = room.code;
    const pair = pairFor(answerType);
    setupImpostorQuestionRound(room, pair);

    const round = getImpostorQuestionRound(code);
    check(`${answerType}: round state exists`, Boolean(round));
    if (!round) continue;

    const impostor = room.players.find((player) => player.id === round.impostorPlayerId);
    check(`${answerType}: an impostor was picked`, Boolean(impostor));
    check(
      `${answerType}: public state carries no question text`,
      !publicSnapshot(room).includes(round.crewQuestion.replace(/"/g, '')) ||
        round.crewQuestion.length === 0,
      'crew question leaked into public state'
    );
    check(
      `${answerType}: nobody is told they are the impostor`,
      room.players.every((player) => {
        const priv = room.privateData[player.id];
        return priv?.isSpecialRole === false && priv?.specialAccentBg === false && priv?.role === 'Player';
      })
    );
    check(
      `${answerType}: each player privately holds exactly one question`,
      room.players.every((player) => {
        const question = room.privateData[player.id]?.impostorQuestion || '';
        return question.length > 0;
      })
    );
    if (!pair.needsTarget) {
      check(
        `${answerType}: the impostor's question differs from the crew's`,
        room.privateData[round.impostorPlayerId]?.impostorQuestion === round.impostorQuestion &&
          round.impostorQuestion !== round.crewQuestion
      );
      check(
        `${answerType}: every crew member sees the same question`,
        room.players
          .filter((player) => player.id !== round.impostorPlayerId)
          .every((player) => room.privateData[player.id]?.impostorQuestion === round.crewQuestion)
      );
    }

    // Answers: host submits a valid value, bots are simulated.
    let hostValue: string;
    if (answerType === 'player') hostValue = room.players[1].id; // answering about someone else
    else if (answerType === 'number') hostValue = String((pair.numberRange!.min + pair.numberRange!.max) / 2);
    else if (answerType === 'choice') hostValue = pair.choices![1];
    else hostValue = 'Test answer here';

    const before = recordImpostorQuestionAnswer(room, room.hostId, hostValue);
    check(`${answerType}: a valid answer is accepted`, before.accepted, before.answered?.text);

    // Invalid values must be refused.
    if (answerType === 'number') {
      const tooBig = recordImpostorQuestionAnswer(room, room.players[1].id, '9999');
      check('number: out-of-range answers are refused', !tooBig.accepted);
    }
    if (answerType === 'choice') {
      const bogus = recordImpostorQuestionAnswer(room, room.players[1].id, 'Not an option');
      check('choice: unknown options are refused', !bogus.accepted);
    }
    if (answerType === 'player') {
      const ghost = recordImpostorQuestionAnswer(room, room.players[1].id, 'player_nope');
      check('player: unknown player ids are refused', !ghost.accepted);
    }
    if (answerType === 'text') {
      const empty = recordImpostorQuestionAnswer(room, room.players[1].id, '   ');
      check('text: blank answers are refused', !empty.accepted);
    }

    simulateImpostorQuestionBots(room);
    const answered = room.players.filter((player) => room.hasSubmittedInput.has(player.id));
    check(`${answerType}: every player answered`, answered.length === room.players.length, `${answered.length}`);

    // The board.
    const board = finalizeImpostorQuestionReveal(room);
    check(`${answerType}: the board holds one entry per player`, board.length === room.players.length);
    check(
      `${answerType}: every entry was answered`,
      board.every((entry) => entry.answerText !== '(No answer)'),
      board.map((entry) => entry.answerText).join('|')
    );
    check(
      `${answerType}: public state has no unanswered placeholders to explain`,
      !publicSnapshot(room).includes('{target}')
    );
    if (answerType === 'player') {
      const playerAnswers = board.filter((entry) => entry.answeredPlayerId);
      check(
        'player: every board entry names the answered player',
        playerAnswers.length === room.players.length,
        `${playerAnswers.length}`
      );
      check(
        'player: the answered player is a real player',
        board.every((entry) => room.players.some((player) => player.id === entry.answeredPlayerId))
      );
    }
    check(
      `${answerType}: the board never contains either question`,
      !JSON.stringify(board).includes(round.crewQuestion) &&
        !JSON.stringify(board).includes(round.impostorQuestion)
    );
    check(
      `${answerType}: public state still hides both questions after the reveal`,
      !publicSnapshot(room).includes(round.impostorQuestion)
    );

    // Votes → results.
    const voters = room.players.filter((player) => player.id !== round.impostorPlayerId);
    room.playerVotes = {};
    voters.forEach((voter) => {
      room.playerVotes[voter.id] = round.impostorPlayerId;
    });
    room.players.forEach((player) => {
      player.score = 0;
    });
    calculateImpostorQuestionResults(room);

    const results = room.results;
    check(`${answerType}: results exist`, Boolean(results));
    check(`${answerType}: both questions are revealed`, Boolean(results?.impostorCrewQuestion) && Boolean(results?.impostorImpostorQuestion));
    check(`${answerType}: the why-it-showed note is present`, Boolean(results?.impostorQuestionNote));
    check(`${answerType}: the impostor was caught`, results?.impostorCaught === true);
    const caughtStandings = results?.standings || [];
    check(
      `${answerType}: every correct voter scored +1`,
      caughtStandings
        .filter((standing) => standing.playerId !== round.impostorPlayerId)
        .every((standing) => standing.pointsAdded === 1),
      caughtStandings.map((s) => `${s.playerName}:${s.pointsAdded}`).join(',')
    );
    check(
      `${answerType}: a caught impostor scores nothing`,
      caughtStandings.find((standing) => standing.playerId === round.impostorPlayerId)?.pointsAdded === 0
    );

    // Evasion scoring: one wrong vote makes the impostor the loser of the vote.
    room.playerVotes = { [round.impostorPlayerId]: room.players[0].id };
    room.players.forEach((player) => {
      player.score = 0;
    });
    calculateImpostorQuestionResults(room);
    check(
      `${answerType}: an evading impostor scores +1`,
      room.results?.standings.find((standing) => standing.playerId === round.impostorPlayerId)?.pointsAdded === 1
    );
    cleanupImpostorQuestionRound(code);
  }

  // ------------------------------------------------------------------- target rule
  section('{target} handling');
  const targetRoom = makeRoom();
  const targetPair = pairFor('text', true);
  setupImpostorQuestionRound(targetRoom, targetPair);
  const targetRound = getImpostorQuestionRound(targetRoom.code);
  check('a target was chosen', Boolean(targetRound?.targetPlayerId));
  check(
    'the target is never the impostor',
    Boolean(targetRound) && targetRound!.targetPlayerId !== targetRound!.impostorPlayerId
  );
  const targetPlayer = targetRoom.players.find((player) => player.id === targetRound?.targetPlayerId);
  check('the target is a real player', Boolean(targetPlayer));
  check(
    'the target sees the selfText phrasing',
    targetRoom.privateData[targetRound!.targetPlayerId!]?.impostorQuestion === targetPair.crew.selfText
  );
  check(
    'the target’s own question never contains the raw token',
    !(targetRoom.privateData[targetRound!.targetPlayerId!]?.impostorQuestion || '').includes('{target}')
  );
  check(
    'everybody else sees the target by name',
    targetRoom.players
      .filter((player) => player.id !== targetRound!.targetPlayerId)
      .every((player) => {
        const question = targetRoom.privateData[player.id]?.impostorQuestion || '';
        return question.includes(targetPlayer!.name) && !question.includes('{target}');
      })
  );
  check(
    'the impostor’s question names the same target',
    (targetRoom.privateData[targetRound!.impostorPlayerId]?.impostorQuestion || '').includes(
      targetPlayer!.name
    )
  );
  check(
    'public state never leaks the target',
    !publicSnapshot(targetRoom).includes(targetPlayer!.name)
  );
  check(
    'the answer board does not leak the target phrasing',
    !JSON.stringify(finalizeImpostorQuestionReveal(targetRoom)).includes('{target}')
  );
  cleanupImpostorQuestionRound(targetRoom.code);

  // ------------------------------------------------------------------- sanitizers
  section('answer sanitizers');
  check('text answers collapse whitespace', sanitizeQuestionText('  hello   world  ') === 'hello world');
  check(
    'text answers drop control characters',
    sanitizeQuestionText('bad\u0000\u0007text') === 'bad text'
  );
  check(
    `text answers clamp to ${QUESTION_MAX_WORDS} words`,
    clampQuestionText('one two three four five six').split(' ').length === QUESTION_MAX_WORDS
  );
  check(
    `text answers clamp to ${QUESTION_MAX_CHARS} characters`,
    clampQuestionText('x'.repeat(80)).length === QUESTION_MAX_CHARS
  );

  // ------------------------------------------------------------------- provider
  section('question provider');
  resetQuestionProviderForTests();
  const tastyRoom = 'QTPROV';
  const spicySeen = new Set<string>();
  for (let i = 0; i < pairPoolSizeFor('spicy'); i += 1) {
    const pair = await questionProvider.next(tastyRoom, { tone: 'spicy' });
    check('spicy bag only serves spicy pairs', pair.tone === 'spicy', pair.id);
    spicySeen.add(pair.id);
  }
  check(
    'the spicy pool is exhausted without repeats',
    spicySeen.size === pairPoolSizeFor('spicy'),
    `${spicySeen.size}/${pairPoolSizeFor('spicy')}`
  );
  const cleanPair = await questionProvider.next(tastyRoom, { tone: 'clean' });
  check('a tone switch serves the other pool', cleanPair.tone === 'clean');
  questionProvider.release(tastyRoom);
  resetQuestionProviderForTests();

  // ------------------------------------------------------------------- AI gate
  section('AI pair validation');
  const aiRoom = makeRoom(0);
  setupImpostorQuestionRound(aiRoom, pairFor('text'));
  const validAiPair = {
    kind: 'preference',
    answerType: 'text',
    tone: 'clean',
    crew: { text: 'Name a drink you would order on holiday.' },
    impostor: { text: 'Name a drink you would refuse on holiday.' },
    needsTarget: false,
  };
  const acceptedAi = validateAiPairs([validAiPair, { ...validAiPair }, rewordedDuplicate], aiRoom.code, 'clean');
  check('a valid AI pair is accepted', acceptedAi.length === 1, `${acceptedAi.length}`);
  check('AI pairs are re-tagged with a generated id', Boolean(acceptedAi[0]?.id?.startsWith('ai-')));
  const seedClash = validateAiPairs([SEED_QUESTION_PAIRS[5]], aiRoom.code, 'clean');
  check('a pair duplicating a shipped seed is rejected', seedClash.length === 0);
  const wrongTone = validateAiPairs([{ ...validAiPair, tone: 'spicy' }], aiRoom.code, 'clean');
  check('an AI pair with the wrong tone is rejected', wrongTone.length === 0);
  cleanupImpostorQuestionRound(aiRoom.code);

  // ------------------------------------------------------------------- report
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('All question-mode checks passed.');
}

main().catch((error) => {
  console.error('test:questions crashed:', error);
  process.exitCode = 1;
});
