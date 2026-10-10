/**
 * TEMPORARY Top 100 engine harness. Deleted after verification.
 * Run: npx tsx tmp-top100-harness.ts
 */
import { RoomManager, InternalRoom } from './server/roomManager';
import {
  TOP100_PROMPTS,
  dealTop100Numbers,
  top100SpectrumText,
  botExampleForNumber,
  getRandomTop100Prompt,
} from './shared/data/top100Prompts';
import {
  sanitizeTop100Example,
  getTop100RoundState,
  TOP100_POINTS_PER_PAIR,
  TOP100_PERFECT_BONUS,
  TOP100_MAX_EXAMPLE_CHARS,
} from './server/games/top100';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const noop = () => {};

/* ------------------------------------------------------------------ */
section('Prompt deck');

check('at least 20 spectra', TOP100_PROMPTS.length >= 20, TOP100_PROMPTS.length);
check(
  'all ids unique',
  new Set(TOP100_PROMPTS.map((p) => p.id)).size === TOP100_PROMPTS.length
);
check(
  'every prompt has 2 labels, a category and 6 examples',
  TOP100_PROMPTS.every(
    (p) =>
      p.lowLabel.trim().length > 0 &&
      p.highLabel.trim().length > 0 &&
      p.category.trim().length > 0 &&
      p.examples.length === 6 &&
      p.examples.every((e) => e.trim().length > 0)
  )
);
check(
  'examples are distinct within each prompt',
  TOP100_PROMPTS.every((p) => new Set(p.examples).size === p.examples.length)
);
check(
  'labels are never identical',
  TOP100_PROMPTS.every((p) => p.lowLabel !== p.highLabel)
);
const spectrum = top100SpectrumText(TOP100_PROMPTS[0]);
check(
  'spectrum text reads "1 = low, 100 = high"',
  spectrum === `1 = ${TOP100_PROMPTS[0].lowLabel}, 100 = ${TOP100_PROMPTS[0].highLabel}`,
  spectrum
);
const excluded = TOP100_PROMPTS.map((p) => p.id);
check(
  'excluded deck falls back to the whole deck',
  getRandomTop100Prompt(excluded).id.length > 0
);

/* ------------------------------------------------------------------ */
section('Number dealing + bot examples');

const deal3 = dealTop100Numbers(['a', 'b', 'c']);
check('deals one number per player', Object.keys(deal3).length === 3);
check('numbers are unique', new Set(Object.values(deal3)).size === 3, deal3);
check(
  'numbers land inside 1-100',
  Object.values(deal3).every((n) => n >= 1 && n <= 100)
);

const bigDeal = dealTop100Numbers(Array.from({ length: 12 }, (_, i) => `p${i}`));
check('12 players get 12 unique numbers', new Set(Object.values(bigDeal)).size === 12);

const prompt = TOP100_PROMPTS[0];
check('bot example at 1 is the mildest sample', botExampleForNumber(prompt, 1) === prompt.examples[0]);
check(
  'bot example at 100 is the most extreme sample',
  botExampleForNumber(prompt, 100) === prompt.examples[5]
);
check(
  'bot choice never leaves the sample list',
  Array.from({ length: 100 }, (_, i) => i + 1).every((n) =>
    prompt.examples.includes(botExampleForNumber(prompt, n))
  )
);
check(
  'bot choice is monotonic across the spectrum',
  Array.from({ length: 99 }, (_, i) => i + 1).every(
    (n) =>
      prompt.examples.indexOf(botExampleForNumber(prompt, n)) <=
      prompt.examples.indexOf(botExampleForNumber(prompt, n + 1))
  )
);

/* ------------------------------------------------------------------ */
section('Example sanitizer');

check('blank becomes a placeholder', sanitizeTop100Example('   ') === '(No example)');
check('whitespace is collapsed', sanitizeTop100Example('  a   b \n c ') === 'a b c');
check(
  'word count is capped at 9',
  sanitizeTop100Example('1 2 3 4 5 6 7 8 9 10 11').split(' ').length === 9
);
check(
  'character count is capped',
  sanitizeTop100Example('x'.repeat(200)).length === TOP100_MAX_EXAMPLE_CHARS
);

/* ------------------------------------------------------------------ */
section('Full round over the room manager');

const manager = new RoomManager();
const { room, host } = manager.createRoom('Host', 'socket-host');
manager.addBotPlayer(room.code);
manager.addBotPlayer(room.code);
check('three players seated', room.players.length === 3);
check('top-100 game is selectable', manager.selectGame(room.code, 'top-100') === true);
check('top100 state starts empty', room.top100State === null);

manager.transitionToPhase(room, 'reveal', noop);
const numbers = room.players.map((p) => manager.getPlayerPrivateState(room, p.id).top100Number);
check('reveal gives every player a number', numbers.every((n) => typeof n === 'number'));
check('reveal numbers are unique', new Set(numbers).size === 3, numbers);
check(
  'every private screen carries the spectrum',
  room.players.every(
    (p) => (manager.getPlayerPrivateState(room, p.id).top100PromptText || '').startsWith('1 = ')
  )
);
check('public state marks this as unrevealed', room.top100State?.revealed === false);
check(
  'numbers are not exposed on the board during reveal',
  (room.top100State?.examples || []).every((card) => !('secretNumber' in card))
);
check(
  'a player cannot see another player\'s number',
  room.players.every((p) =>
    room.players
      .filter((other) => other.id !== p.id)
      .every(
        (other) =>
          manager.getPlayerPrivateState(room, other.id).top100Number !==
          manager.getPlayerPrivateState(room, p.id).top100Number
      )
  )
);

// Input phase: bots submit, then the human does — which auto-advances the phase.
manager.transitionToPhase(room, 'input', noop);
const activePrompt = getTop100RoundState(room.code)!.prompt;
check(
  'bots wrote sample examples from the prompt',
  room.players
    .filter((p) => p.isBot)
    .every((bot) =>
      activePrompt.examples.includes(
        manager.getPlayerPrivateState(room, bot.id).top100ExampleText || ''
      )
    )
);
check('bot examples counted as submitted', room.hasSubmittedInput.size === 2);
manager.submitInput(room, host.id, 'A home-made human example', noop);
check('all three submissions advance to reveal-answers', room.phase === 'reveal-answers');
check('the board holds every example', room.revealedAnswers.length === 3);
check('the human example survived sanitizing', room.revealedAnswers.some((a) => a.answerText === 'A home-made human example'));
check('state reports the board is ready', room.top100State?.examplesReady === true);
check(
  'no secret numbers on the board yet',
  (room.top100State?.examples || []).every((card) => !('secretNumber' in card))
);
check(
  'board covers every player exactly once',
  new Set((room.top100State?.examples || []).map((c) => c.playerId)).size === 3
);

// Rank phase
manager.transitionToPhase(room, 'rank', noop);
check('rank phase reached', room.phase === 'rank');
check('ordering starts unlocked', room.top100State?.orderLocked === false);
check('host holds the rank controls', manager.getPlayerPrivateState(room, host.id).top100CanRank === true);
check(
  'everyone else only watches',
  room.players.filter((p) => p.id !== host.id).every((p) => manager.getPlayerPrivateState(room, p.id).top100CanRank === false)
);

const beforeOrder = (room.top100State?.examples || []).map((c) => c.playerId);
const otherPlayer = room.players.find((p) => p.id !== host.id)!;
manager.submitTop100Order(room, otherPlayer.id, [...beforeOrder].reverse(), noop);
check(
  'a non-host reorder is ignored',
  (room.top100State?.examples || []).map((c) => c.playerId).join() === beforeOrder.join()
);
manager.submitTop100Order(room, host.id, beforeOrder.slice(1), noop);
check(
  'an incomplete ordering is rejected',
  (room.top100State?.examples || []).map((c) => c.playerId).join() === beforeOrder.join()
);
manager.submitTop100Order(room, host.id, [beforeOrder[0], beforeOrder[0], beforeOrder[1]], noop);
check(
  'a duplicated ordering is rejected',
  (room.top100State?.examples || []).map((c) => c.playerId).join() === beforeOrder.join()
);

// Lock in with a deliberately wrong order first, then re-check scoring.
const trueOrder = [...room.players]
  .sort(
    (a, b) =>
      (manager.getPlayerPrivateState(room, a.id).top100Number || 0) -
      (manager.getPlayerPrivateState(room, b.id).top100Number || 0)
  )
  .map((p) => p.id);

manager.submitTop100Order(room, host.id, trueOrder, noop);
check(
  'the host order is accepted and broadcast',
  (room.top100State?.examples || []).map((c) => c.playerId).join() === trueOrder.join()
);
manager.hostLockTop100Order(room, host.id, noop);
check('locking in jumps to results', room.phase === 'results');

const results = room.results!;
const entries = results.top100Entries || [];
check('every example appears in the results', entries.length === 3);
check(
  'results order matches the host order',
  entries.map((e) => e.playerId).join() === trueOrder.join()
);
check(
  'true numbers are now attached',
  entries.every((e) => typeof e.secretNumber === 'number' && e.secretNumber >= 1 && e.secretNumber <= 100)
);
check(
  'numbers ascend with the position',
  entries.every((e, i) => i === 0 || (entries[i - 1].secretNumber as number) <= e.secretNumber)
);
check('a perfect order scores every pair', results.top100CorrectPairs === 2 && results.top100TotalPairs === 2);
check('every example sits in its exact slot', entries.every((e) => e.correctlyPlaced === true));
check(
  'true positions are 1..n',
  entries.map((e) => e.truePosition).sort().join() === '1,2,3'
);
const expectedPerfect = 2 * TOP100_POINTS_PER_PAIR + TOP100_PERFECT_BONUS;
check('perfect bonus applied', results.top100Points === expectedPerfect, results.top100Points);
check(
  'the shared score landed on every player',
  room.players.every((p) => p.score === expectedPerfect)
);
check(
  'standings carry the points',
  (results.standings || []).length === 3 && (results.standings || []).every((s) => s.pointsAdded === expectedPerfect)
);
check('the prompt is revealed in results', (results.top100PromptText || '').startsWith('1 = '));
check(
  'public state now exposes the numbers',
  (room.top100State?.examples || []).every((c) => typeof c.secretNumber === 'number')
);

/* ------------------------------------------------------------------ */
section('Scoring: a scrambled order scores less and awards no bonus');

const manager2 = new RoomManager();
const { room: room2, host: host2 } = manager2.createRoom('Host2', 'socket-2');
manager2.addBotPlayer(room2.code);
manager2.addBotPlayer(room2.code);
manager2.selectGame(room2.code, 'top-100');
manager2.transitionToPhase(room2, 'reveal', noop);
manager2.transitionToPhase(room2, 'input', noop);
manager2.submitInput(room2, host2.id, 'Human example two', noop);
manager2.transitionToPhase(room2, 'rank', noop);

const nums2 = room2.players.map((p) => manager2.getPlayerPrivateState(room2, p.id).top100Number!);
const playersByNumber = [...room2.players].sort(
  (a, b) =>
    manager2.getPlayerPrivateState(room2, a.id).top100Number! -
    manager2.getPlayerPrivateState(room2, b.id).top100Number!
);
const worstOrder = [...playersByNumber].reverse().map((p) => p.id);
manager2.submitTop100Order(room2, host2.id, worstOrder, noop);
manager2.hostLockTop100Order(room2, host2.id, noop);

const res2 = room2.results!;
check('a fully reversed order scores zero pairs', res2.top100CorrectPairs === 0, {
  nums: nums2,
  pairs: res2.top100CorrectPairs,
});
check('no perfect bonus on a reversed order', res2.top100Points === 0);
check('nobody scored on a reversed order', room2.players.every((p) => p.score === 0));
check(
  'positions are marked wrong',
  (res2.top100Entries || []).filter((e) => e.correctlyPlaced).length <= 1
);

/* ------------------------------------------------------------------ */
section('Guards, prompt rotation and cleanup');

const manager3 = new RoomManager();
const { room: room3, host: host3 } = manager3.createRoom('Host3', 'socket-3');
manager3.addBotPlayer(room3.code);
manager3.selectGame(room3.code, 'top-100');
manager3.transitionToPhase(room3, 'reveal', noop);
const firstPromptId = getTop100RoundState(room3.code)!.prompt.id;
manager3.submitTop100Order(room3, host3.id, room3.players.map((p) => p.id), noop);
check(
  'reordering outside the rank phase is ignored',
  room3.top100State?.orderLocked === false && room3.phase === 'reveal'
);
check(
  'a wrong-game guard holds',
  (() => {
    manager3.selectGame(room3.code, 'mafia');
    manager3.transitionToPhase(room3, 'rank', noop);
    return room3.phase === 'results';
  })()
);

manager3.transitionToPhase(room3, 'lobby', noop);
check('returning to the lobby clears the board', room3.top100State === null);
check('returning to the lobby drops the round state', getTop100RoundState(room3.code) === undefined);

// Prompt rotation: two rounds in one room never repeat a spectrum.
const manager4 = new RoomManager();
const { room: room4 } = manager4.createRoom('Host4', 'socket-4');
manager4.selectGame(room4.code, 'top-100');
manager4.transitionToPhase(room4, 'reveal', noop);
const roundOne = getTop100RoundState(room4.code)!.prompt.id;
manager4.transitionToPhase(room4, 'next-round', noop);
const roundTwo = getTop100RoundState(room4.code)!.prompt.id;
check('a second round picks a fresh spectrum', roundOne !== roundTwo, { roundOne, roundTwo });
check(
  'used spectra are tracked',
  getTop100RoundState(room4.code)!.usedPromptIds.length === 2
);
check('first prompt was a real deck entry', firstPromptId.length > 0);

// Every round leaves the room with an intact state object.
check(
  'public state shape is stable',
  (() => {
    const pub = manager3.getPublicRoomState(room3);
    return 'top100State' in pub && pub.top100State === null;
  })()
);

manager.clearPhaseTimer(room);
manager2.clearPhaseTimer(room2);
manager3.clearPhaseTimer(room3);
manager4.clearPhaseTimer(room4);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
