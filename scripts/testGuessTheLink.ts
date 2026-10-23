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

let checks = 0;
function check(label: string, condition: boolean) {
  checks += 1;
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  }
}

const puzzle = SEED_LINK_PUZZLES[0];

// Normalisation, aliases and fuzzy matching
check('exact link matches', isCorrectGtlGuess(puzzle, 'Fire'));
check('alias matches', isCorrectGtlGuess(puzzle, 'flames'));
check('article and case are ignored', isCorrectGtlGuess(puzzle, 'THE FIRE'));
check('one-letter typo tolerated on longer answers', isCorrectGtlGuess(SEED_LINK_PUZZLES[6], 'trunck'));
check('unrelated guess rejected', !isCorrectGtlGuess(puzzle, 'water'));
check('sanitizer strips control characters', sanitizeGtlGuess('  fire  ') === 'fire');

// No-repeat bag
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
  recordGtlGuess(room, 'p1', 'definitely wrong');
  recordGtlGuess(room, 'p2', state.puzzle.link);
  recordGtlGuess(room, 'p3', state.puzzle.aliases[0]);
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
}

check('no puzzle repeats until the bag is empty', seen.size === SEED_LINK_PUZZLES.length);
check('every seed has at least four aliases', SEED_LINK_PUZZLES.every((p) => p.aliases.length >= 4));
check('every seed has three distinct items', SEED_LINK_PUZZLES.every((p) => new Set(p.items.map((i) => i.name)).size === 3));
check('every seed has a hint', SEED_LINK_PUZZLES.every((p) => p.hint.length > 0));

cleanupGtlRound('TEST');
syncGtlPublicState(room);
check('cleanup drops the round', room.gtlState === null);

console.log(`\nGuess the Link: ${checks} checks passed`);
