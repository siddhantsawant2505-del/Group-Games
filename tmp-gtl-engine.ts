/* Temporary Guess the Link engine checks. Deleted after running. */
import { GTL_PROMPTS, dealGtlHints, getRandomGtlPrompt } from './shared/data/guessTheLinkPrompts';
import {
  beginGtlGuessing,
  calculateGtlResults,
  cleanupGtlRound,
  finalizeGtlGuesses,
  finalizeGtlReveal,
  getGtlRoundState,
  isCorrectGtlGuess,
  pendingGtlGuessers,
  recordGtlGuess,
  recordGtlResponse,
  sanitizeGtlGuess,
  sanitizeGtlResponse,
  setupGtlRound,
  simulateGtlBotGuesses,
  simulateGtlBotResponses,
} from './server/games/guessTheLink';

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  [${extra}]` : ''}`);
}

/* -------------------------------------------------- prompt data integrity */
check('at least 40 concepts', GTL_PROMPTS.length >= 40, `${GTL_PROMPTS.length} concepts`);

const concepts = GTL_PROMPTS.map((p) => p.concept.toLowerCase());
check('concepts are unique', new Set(concepts).size === concepts.length);

let everySixHints = true;
let hintsDistinct = true;
let hintsStayClean = true;
for (const prompt of GTL_PROMPTS) {
  if (prompt.hints.length !== 6) {
    everySixHints = false;
    console.log(`      -> ${prompt.concept} has ${prompt.hints.length} hints`);
  }
  if (new Set(prompt.hints.map((h) => h.toLowerCase())).size !== prompt.hints.length) {
    hintsDistinct = false;
    console.log(`      -> ${prompt.concept} repeats a hint`);
  }
  const conceptWord = prompt.concept.toLowerCase();
  prompt.hints.forEach((hint) => {
    const lower = hint.toLowerCase();
    const banned = [conceptWord, ...(prompt.accepted || [])]
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 4);
    if (banned.some((word) => lower.includes(word))) {
      hintsStayClean = false;
      console.log(`      -> "${prompt.concept}" hint leaks: "${hint}"`);
    }
  });
}
check('every concept has exactly 6 hint angles', everySixHints);
check('hint angles are distinct within a concept', hintsDistinct);
check('no hint leaks the concept word', hintsStayClean);
check('every concept has a category', GTL_PROMPTS.every((p) => p.category.trim().length > 0));

/* --------------------------------------------------------------- fake room */
function makeRoom(playerCount: number, bots = 0, code = 'TEST') {
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player${index + 1}`,
    colorIndex: index % 6,
    colorHex: '#111111',
    colorName: 'Test',
    isHost: index === 0,
    connected: true,
    score: 0,
    sessionToken: `token${index + 1}`,
    joinedAt: Date.now(),
    socketId: `sock${index + 1}`,
    isBot: index >= playerCount - bots,
  }));

  return {
    code,
    hostId: 'p1',
    players,
    phase: 'reveal' as const,
    selectedGame: { id: 'guess-the-link' } as any,
    roundNumber: 1,
    totalRounds: 3,
    timer: null,
    timerIntervalId: null,
    phasePrompt: '',
    phaseSubprompt: '',
    hasSubmittedInput: new Set<string>(),
    hasVoted: new Set<string>(),
    revealedAnswers: [] as any[],
    voteTallies: {},
    playerVotes: {},
    privateData: {},
    results: null,
    atwState: null,
    mafiaState: null,
    gtlState: null,
    botTimeouts: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  } as any;
}

/* ---------------------------------------------------------- reveal phase */
const room = makeRoom(6);
setupGtlRound(room);

const hints = room.players.map((p: any) => room.privateData[p.id]?.gtlHint);
check('every player privately received a hint', hints.every((h: string) => Boolean(h)));
check('all six angles are different at a 6-player table', new Set(hints).size === 6, hints.join(' | '));
check(
  'the concept itself is never in the public state',
  room.gtlState?.concept === null && room.gtlState?.revealed === false
);
check(
  'public state exposes only the category and a word-count nudge',
  Boolean(room.gtlState?.category) && (room.gtlState?.conceptWordCount || 0) >= 1,
  `${room.gtlState?.category} / ${room.gtlState?.conceptWordCount} words`
);
check('hint index/count written for flavour', room.players.every((p: any) => room.privateData[p.id]?.gtlHintIndex >= 1 && room.privateData[p.id]?.gtlHintCount === 6));

const bigRoom = makeRoom(9);
setupGtlRound(bigRoom);
const bigHints = bigRoom.players.map((p: any) => bigRoom.privateData[p.id]?.gtlHint);
check('larger rooms reuse the six angles', new Set(bigHints).size === 6, `${new Set(bigHints).size} distinct`);
check('no player is left without a hint in a big room', bigHints.every(Boolean));

const state = getGtlRoundState('TEST')!;

/* --------------------------------------------------------- response phase */
check('sanitizer collapses whitespace', sanitizeGtlResponse('  round   shape ') === 'round shape', sanitizeGtlResponse('  round   shape '));
check('sanitizer caps a phrase at three words', sanitizeGtlResponse('one two three four five') === 'one two three', sanitizeGtlResponse('one two three four five'));
check('sanitizer handles blanks', sanitizeGtlResponse('   ') === '(Blank)');

room.players.slice(0, 5).forEach((player: any, index: number) => {
  recordGtlResponse(room, player.id, `response ${index + 1}`);
});
check('private responses stay private until the reveal', room.revealedAnswers.length === 0);
check('submitted responses are tracked for the reveal gate', room.hasSubmittedInput.size === 5);
check(
  'response text is stored on the private state only',
  room.privateData['p1']?.gtlResponseText === 'response 1' &&
    (room.gtlState?.responsesReady === false)
);

finalizeGtlReveal(room);
check('reveal compiles every player', room.revealedAnswers.length === 6);
check('stragglers get a placeholder', room.revealedAnswers.some((a) => a.answerText === '(No response)'));
check('reveal carries the owner hint as subtext', room.revealedAnswers.every((a) => (a.subtext || '').startsWith('Hint:')));
check('public state marks the board ready', room.gtlState?.responsesReady === true);

const shuffleA = room.revealedAnswers.map((a) => a.playerId).join(',');
finalizeGtlReveal(room);
check('reveal is idempotent (no reshuffle mid-phase)', room.revealedAnswers.map((a) => a.playerId).join(',') === shuffleA);

/* ------------------------------------------------------------ guess phase */
beginGtlGuessing(room);
check('guessing starts with nobody locked in', room.gtlState?.guessesSubmitted.length === 0);
check('all players owe a guess at the start', pendingGtlGuessers(room).length === 6);

check('guess sanitizer caps length', sanitizeGtlGuess('  a very long guess that runs on  ').length <= 24);

const concept = state.prompt.concept;
const outcome = recordGtlGuess(room, 'p1', concept);
check('guess is accepted and privacy preserved', outcome.accepted && room.gtlState?.concept === null);
check('pending list shrinks as players guess', outcome.pendingPlayerIds.length === 5);
check('guess stays on the private state', room.privateData['p1']?.gtlGuessText === concept);

finalizeGtlGuesses(room);
check(
  'stragglers are recorded as (No guess)',
  room.players.every((p: any) => room.privateData[p.id]?.gtlGuessText)
);
check('public state still withholds the concept', room.gtlState?.concept === null);

/* -------------------------------------------------- correctness matching */
const pizza = GTL_PROMPTS.find((p) => p.concept === 'Pizza')!;
check('exact concept counts', isCorrectGtlGuess(pizza, 'Pizza'));
check('case and spacing are ignored', isCorrectGtlGuess(pizza, '  pIzZa '));
check('a phrase containing the concept counts', isCorrectGtlGuess(pizza, 'pizza pie'));
check('an alias counts', isCorrectGtlGuess(GTL_PROMPTS.find((p) => p.concept === 'Bubble tea')!, 'boba'));
check('a wrong answer does not count', !isCorrectGtlGuess(pizza, 'calzone'));
check('short words need an exact match', !isCorrectGtlGuess(GTL_PROMPTS.find((p) => p.concept === 'Honey')!, 'hon'));

/* ---------------------------------------------------------------- results */
const resultRoom = makeRoom(4);
setupGtlRound(resultRoom);
const resultState = getGtlRoundState('TEST')!;
const answer = resultState.prompt.concept;

recordGtlResponse(resultRoom, 'p1', 'shares-something');
recordGtlResponse(resultRoom, 'p2', 'round');
recordGtlResponse(resultRoom, 'p3', 'cheese');
recordGtlResponse(resultRoom, 'p4', answer);
recordGtlGuess(resultRoom, 'p1', answer);
recordGtlGuess(resultRoom, 'p2', answer.toUpperCase());
recordGtlGuess(resultRoom, 'p3', 'wrong answer');
recordGtlGuess(resultRoom, 'p4', 'also wrong');
calculateGtlResults(resultRoom);

const results = resultRoom.results!;
check('results reveal the concept', results.gtlConcept === answer, String(results.gtlConcept));
check('public state now exposes the concept', resultRoom.gtlState?.concept === answer);
check('two correct guessers are recorded', (results.gtlCorrectPlayerIds || []).length === 2);
check(
  'points land only on correct guessers',
  resultRoom.players.filter((p: any) => p.score === 1).map((p: any) => p.id).join(',') === 'p1,p2',
  resultRoom.players.map((p: any) => `${p.id}:${p.score}`).join(' ')
);
check(
  'private state tells each player how they did',
  resultRoom.privateData['p1']?.gtlGuessCorrect === true &&
    resultRoom.privateData['p3']?.gtlGuessCorrect === false &&
    resultRoom.privateData['p1']?.gtlPointsAwarded === 1 &&
    resultRoom.privateData['p3']?.gtlPointsAwarded === 0
);
check('every guess is reported in the breakdown', (results.gtlGuesses || []).length === 4);
check('hint roster covers all players', (results.gtlHints || []).length === 4);
check(
  'giveaway names the response closest to the concept',
  Boolean(results.gtlGiveawayName) && results.gtlGiveawayResponse === answer,
  `${results.gtlGiveawayName}: ${results.gtlGiveawayResponse}`
);
check('standings carry badges for correct guessers', (results.standings || []).some((s) => s.badge === 'Cracked it'));
check(
  'standings are sorted by total score',
  (results.standings || []).every((s, i, arr) => i === 0 || arr[i - 1].totalScore >= s.totalScore)
);
check('winner title credits the guessers', (results.winnerTitle || '').includes('cracked it'), String(results.winnerTitle));

/* ------------------------------------------------------------- edge cases */
const noGuessRoom = makeRoom(3);
setupGtlRound(noGuessRoom);
calculateGtlResults(noGuessRoom);
check('a round with no guesses still produces results', Boolean(noGuessRoom.results?.gtlConcept));
check('nobody scores when nobody guesses', noGuessRoom.players.every((p: any) => p.score === 0));
check(
  'no giveaway is reported when nothing resembles the concept',
  !noGuessRoom.results?.gtlGiveawayName
);

const botRoom = makeRoom(5, 3);
setupGtlRound(botRoom);
simulateGtlBotResponses(botRoom);
check('bots submit responses from their own hint', botRoom.players.filter((p: any) => p.isBot).every((p: any) => Boolean(botRoom.privateData[p.id]?.gtlResponseText)));
beginGtlGuessing(botRoom);
simulateGtlBotGuesses(botRoom);
check('bots lock in guesses', botRoom.players.filter((p: any) => p.isBot).every((p: any) => Boolean(botRoom.privateData[p.id]?.gtlGuessText)));
check('human players are still pending after bots guess', pendingGtlGuessers(botRoom).length === 2);

const rotationRoom = makeRoom(6, 0, 'ROTATE');
setupGtlRound(rotationRoom);
const roundOneConcept = getGtlRoundState('ROTATE')?.prompt.concept;
const firstDeal = rotationRoom.players.map((p: any) => rotationRoom.privateData[p.id]?.gtlHint);
rotationRoom.roundNumber = 2;
setupGtlRound(rotationRoom);
const secondDeal = rotationRoom.players.map((p: any) => rotationRoom.privateData[p.id]?.gtlHint);
const roundTwoConcept = getGtlRoundState('ROTATE')?.prompt.concept;
check(
  'the deal rotates between rounds (not the same hint for the same player)',
  firstDeal.join('|') !== secondDeal.join('|')
);
const used = getGtlRoundState('ROTATE')?.usedConcepts || [];
check('played concepts are remembered for future rounds', used.length === 2, used.join(', '));
check(
  'a new round never repeats the previous concept while alternatives exist',
  roundTwoConcept !== roundOneConcept,
  `${roundOneConcept} -> ${roundTwoConcept}`
);

const dealt = dealGtlHints(pizza, ['a', 'b', 'c'], 1);
check('dealGtlHints gives distinct angles', new Set(Object.values(dealt)).size === 3);
check('getRandomGtlPrompt can avoid used concepts', getRandomGtlPrompt(['Pizza']).concept !== 'Pizza');

cleanupGtlRound('TEST');
check('cleanup clears the round state', getGtlRoundState('TEST') === undefined);

console.log(failures === 0 ? '\nALL GUESS THE LINK ENGINE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
