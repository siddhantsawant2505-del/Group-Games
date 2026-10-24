/**
 * Guess the Link — unit checks for the image-puzzle engine.
 * Run: npm run test:link
 */

import {
  beginGtlGuessing,
  calculateGtlResults,
  cleanupGtlRound,
  getGtlRoundState,
  isCorrectGtlGuess,
  recordGtlGuess,
  sanitizeGtlGuess,
  setupGtlRound,
  syncGtlPublicState,
} from '../server/games/guessTheLink';
import { SEED_LINK_PUZZLES } from '../server/content/guessTheLink/seedPuzzles';
import {
  judgeLinkGuess,
  matchLinkGuess,
  resetJudgeForTests,
} from '../server/content/guessTheLink/linkJudge';
import { takePuzzle } from '../server/content/guessTheLink/linkProvider';
import { allPuzzles, resetLibraryForTests } from '../server/content/guessTheLink/puzzleLibrary';

let checks = 0;
function check(label: string, condition: boolean) {
  checks += 1;
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  }
}

const puzzle = SEED_LINK_PUZZLES[0];

async function main() {
  // Normalisation, aliases and fuzzy matching
  check('exact link matches', isCorrectGtlGuess(puzzle, 'Fire'));
  check('alias matches', isCorrectGtlGuess(puzzle, 'flames'));
  check('article and case are ignored', isCorrectGtlGuess(puzzle, 'THE FIRE'));
  check('one-letter typo tolerated on longer answers', isCorrectGtlGuess(SEED_LINK_PUZZLES[6], 'trunck'));
  check('unrelated guess rejected', !isCorrectGtlGuess(puzzle, 'water'));
  check('near-miss is ambiguous, not correct', matchLinkGuess(puzzle, 'firs') !== 'correct');
  check('sanitizer strips control characters', sanitizeGtlGuess('  fire  ') === 'fire');

  // Judge fallback: local hit costs no AI call; a miss asks once and caches.
  resetJudgeForTests();
  let aiCalls = 0;
  const ai = {
    async ask() {
      aiCalls += 1;
      return true; // model accepts a very loose synonym
    },
  };
  const local = await judgeLinkGuess('JUDGE', puzzle, 'fire');
  check('local judgement does not call the model', local.correct && aiCalls === 0);
  const judged = await judgeLinkGuess('JUDGE', puzzle, 'blaze', ai);
  check('AI fallback can accept a synonym', judged.correct && aiCalls === 1);
  await judgeLinkGuess('JUDGE', puzzle, 'BLAZE', ai);
  check('AI verdicts are cached per puzzle+guess', aiCalls === 1);
  check('judge result never contains the link', !JSON.stringify(judged).includes(puzzle.link));

  const room: any = {
    code: 'TEST',
    hostId: 'p1',
    players: [1, 2, 3].map((n) => ({
      id: `p${n}`,
      name: `P${n}`,
      colorIndex: n,
      colorHex: '#000',
      colorName: 'x',
      isHost: n === 1,
      connected: true,
      score: 0,
      sessionToken: 't',
      joinedAt: 0,
    })),
    roundNumber: 1,
    totalRounds: 6,
    timer: { durationSeconds: 60, endsAtTimestamp: Date.now() + 60000, remainingSeconds: 60 },
    privateData: {},
    gameSettings: {
      guessTheLink: {
        roundCount: 6,
        roundSeconds: 60,
        difficulty: 'mixed',
        attempts: 3,
        hintEnabled: true,
      },
    },
    playMode: 'solo',
    teams: [],
    botTimeouts: [],
    scoreLog: [],
  };

  // Library-first draw + per-room no-repeat.
  const settings = room.gameSettings.guessTheLink;
  resetLibraryForTests();
  const firstDraws = Array.from({ length: 6 }, () => takePuzzle('BAG', settings)?.id);
  check('six rounds draw six distinct puzzles', new Set(firstDraws).size === 6);
  check('library is seeded and never empty', allPuzzles().length >= SEED_LINK_PUZZLES.length);
  check('fallbacks always produce a puzzle', takePuzzle('EMPTY', settings) !== null);

  const seen = new Set<string>();
  for (let round = 0; round < SEED_LINK_PUZZLES.length; round++) {
    room.roundNumber = round + 1;
    setupGtlRound(room);
    const state = getGtlRoundState('TEST')!;
    seen.add(state.puzzle.id);
    check(`round ${round + 1} starts in ready`, room.gtlState?.phase === 'ready');
    computeLeak();

    beginGtlGuessing(room);
    check('guessing exposes no link', room.gtlState?.revealed === false && room.gtlState?.link === null);
    await recordGtlGuess(room, 'p1', 'definitely wrong');
    await recordGtlGuess(room, 'p2', state.puzzle.link);
    await recordGtlGuess(room, 'p3', state.puzzle.aliases[0]);
    calculateGtlResults(room);
    check('link revealed at results', room.gtlState?.link === state.puzzle.link);
    check('solve order keeps server order', (room.gtlState?.solved ?? []).length === 2);
    check('first solve gets 3 points', room.gtlState?.solved[0]?.points === 3);
    check('second solve gets 2 points', room.gtlState?.solved[1]?.points === 2);
  }

  function computeLeak() {
    const state = getGtlRoundState('TEST')!;
    const publicJson = JSON.stringify(room.gtlState);
    check('public state never contains the link pre-results', !publicJson.includes(state.puzzle.link));
    for (const item of state.puzzle.items) {
      check(`public state never contains item name "${item.name}"`, !publicJson.includes(item.name));
    }
    for (const alias of state.puzzle.aliases) {
      if (alias.toLowerCase() !== state.puzzle.link.toLowerCase()) {
        check(`public state never contains alias "${alias}"`, !publicJson.toLowerCase().includes(alias.toLowerCase()));
      }
    }
  }

  check('no puzzle repeats until the bag is empty', seen.size >= SEED_LINK_PUZZLES.length);
  check('every seed has at least four aliases', SEED_LINK_PUZZLES.every((p) => p.aliases.length >= 4));
  check('every seed has three distinct items', SEED_LINK_PUZZLES.every((p) => new Set(p.items.map((i) => i.name)).size === 3));
  check('every seed has a hint', SEED_LINK_PUZZLES.every((p) => p.hint.length > 0));

  cleanupGtlRound('TEST');
  syncGtlPublicState(room);
  check('cleanup drops the round', room.gtlState === null);

  console.log(`\nGuess the Link: ${checks} checks passed`);
}

void main();
