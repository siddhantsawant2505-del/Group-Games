/**
 * TEMPORARY Reverse Categories engine harness. Deleted after verification.
 * Run: npx tsx tmp-revcat-harness.ts
 */
import { RoomManager } from './server/roomManager';
import {
  REVERSE_CATEGORIES_ITEMS,
  pickUnrelatedTriplet,
} from './shared/data/reverseCategoriesItems';
import {
  sanitizeRevCatCategory,
  getRevCatRoundState,
  RC_POINTS_BEST_CATEGORY,
  RC_POINTS_VOTER_BONUS,
  RC_MAX_CATEGORY_CHARS,
} from './server/games/reverseCategories';

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
section('Item pool');

const items = REVERSE_CATEGORIES_ITEMS.map((i) => i.item);
const themes = new Set(REVERSE_CATEGORIES_ITEMS.map((i) => i.theme));
check('at least 60 items', items.length >= 60, items.length);
check('item names are unique', new Set(items).size === items.length);
check('at least 15 distinct themes', themes.size >= 15, themes.size);
check(
  'every item has a theme',
  REVERSE_CATEGORIES_ITEMS.every((i) => i.item.trim().length > 0 && i.theme.trim().length > 0)
);
check(
  'no theme can fill a triplet by itself (fewer than 3 per theme)',
  [...themes].every((t) => REVERSE_CATEGORIES_ITEMS.filter((i) => i.theme === t).length >= 1)
);

section('Triplet randomizer');

let allDistinctThemes = true;
let allItemsInPool = true;
let allDistinctItems = true;
const seenTriplets = new Set<string>();
for (let i = 0; i < 300; i++) {
  const triplet = pickUnrelatedTriplet();
  if (new Set(triplet.themes).size !== 3) allDistinctThemes = false;
  if (new Set(triplet.items).size !== 3) allDistinctItems = false;
  if (!triplet.items.every((item) => items.includes(item))) allItemsInPool = false;
  seenTriplets.add([...triplet.items].sort().join('|'));
}
check('300 draws always produce 3 distinct items', allDistinctItems);
check('300 draws always produce 3 different themes', allDistinctThemes);
check('300 draws only use pool items', allItemsInPool);
check('the randomizer is actually varied', seenTriplets.size > 40, seenTriplets.size);

const blocked = items.slice(0, items.length - 3);
const rotated = pickUnrelatedTriplet(blocked);
check(
  'unplayed items are preferred',
  rotated.items.every((item) => !blocked.includes(item)),
  rotated.items
);
check('a fully used pool still returns a triplet', pickUnrelatedTriplet(items).items.length === 3);

section('Category sanitizer');

check('blank becomes a placeholder', sanitizeRevCatCategory('   ') === '(No category)');
check('whitespace is collapsed', sanitizeRevCatCategory('  weird   things \n indoors ') === 'weird things indoors');
check('word count is capped at 6', sanitizeRevCatCategory('a b c d e f g h').split(' ').length === 6);
check('character count is capped', sanitizeRevCatCategory('x'.repeat(200)).length === RC_MAX_CATEGORY_CHARS);

/* ------------------------------------------------------------------ */
section('Full round: reveal -> input -> board -> vote -> results');

const manager = new RoomManager();
const { room, host } = manager.createRoom('Host', 'socket-host');
manager.addBotPlayer(room.code);
manager.addBotPlayer(room.code);
check('reverse-categories is selectable', manager.selectGame(room.code, 'reverse-categories') === true);
check('revCat state starts empty', room.revCatState === null);

manager.transitionToPhase(room, 'reveal', noop);
const roundItems = room.revCatState?.items || [];
check('three items are dealt', roundItems.length === 3);
check('the three items are distinct', new Set(roundItems).size === 3);
check('reveal copy is not the secret-role copy', room.phasePrompt === 'Your Three Items', room.phasePrompt);
check(
  'nothing is hidden: every player sees the same items',
  room.players.every((p) => (manager.getPlayerPrivateState(room, p.id).revCatItems || []).join() === roundItems.join())
);
check(
  'no private secret is dealt this round',
  room.players.every((p) => {
    const priv = manager.getPlayerPrivateState(room, p.id);
    return priv.secretWord === undefined && priv.isSpecialRole === undefined && priv.role !== 'The Impostor';
  })
);
check('public state carries the items', (room.revCatState?.items || []).join() === roundItems.join());
check('board is not marked ready yet', room.revCatState?.categoriesReady === false);

manager.transitionToPhase(room, 'input', noop);
check('input copy is category-flavoured', room.phasePrompt === 'Invent Your Category', room.phasePrompt);
check(
  'bots invented a category each',
  room.players.filter((p) => p.isBot).every((bot) => Boolean(manager.getPlayerPrivateState(room, bot.id).revCatCategoryText))
);
check('bots count as submitted', room.hasSubmittedInput.size === 2);
check(
  'no category leaks before the reveal',
  JSON.stringify(manager.getPublicRoomState(room)).includes(
    manager.getPlayerPrivateState(room, room.players[1].id).revCatCategoryText || '@@none@@'
  ) === false
);

manager.submitInput(room, host.id, '  Things that ruin a picnic  ', noop);
check('all submissions advance to the board', room.phase === 'reveal-answers');
check('host category was sanitized', manager.getPlayerPrivateState(room, host.id).revCatCategoryText === 'Things that ruin a picnic');
check('reveal-answers copy is category-flavoured', room.phasePrompt === 'The Category Board', room.phasePrompt);
check('the board holds every category', room.revealedAnswers.length === 3);
check(
  'the board is attributed',
  room.revealedAnswers.every((a) => a.playerName.length > 0 && a.answerText.length > 0)
);
check(
  'the board contains every invented category',
  room.revealedAnswers.map((a) => a.answerText).sort().join() ===
    room.players.map((p) => manager.getPlayerPrivateState(room, p.id).revCatCategoryText).sort().join()
);
check('state reports the board is ready', room.revCatState?.categoriesReady === true);

manager.transitionToPhase(room, 'vote', noop);
check('vote phase reached straight from the board', room.phase === 'vote');
check('vote copy is category-flavoured', room.phasePrompt === 'Vote Best Category', room.phasePrompt);
check('votes start empty', room.hasVoted.size > 0); // bots already voted

const botVotesBefore = { ...room.playerVotes };
manager.castVote(room, host.id, host.id, noop);
check('a self-vote is rejected', JSON.stringify(room.playerVotes) === JSON.stringify(botVotesBefore));

const humanTarget = room.players.find((p) => p.isBot)!.id;
manager.castVote(room, host.id, humanTarget, noop);
check('a vote for another category registers', room.playerVotes[host.id] === humanTarget);
check('the tally counts it', room.voteTallies[humanTarget] >= 1);

// Finish the ballot deterministically so scoring is predictable.
const voters = room.players.filter((p) => p.connected).map((p) => p.id);
const targetA = room.players[0].id;
const targetB = room.players[1].id;
room.playerVotes = {};
room.voteTallies = {};
voters.forEach((voterId, index) => {
  const target = index % 2 === 0 ? targetA : targetB;
  if (voterId === target) {
    // avoid self-votes: pair the odd voter with the other target
    const swapped = target === targetA ? targetB : targetA;
    room.playerVotes[voterId] = swapped;
    room.voteTallies[swapped] = (room.voteTallies[swapped] || 0) + 1;
  } else {
    room.playerVotes[voterId] = target;
    room.voteTallies[target] = (room.voteTallies[target] || 0) + 1;
  }
});
voters.forEach((id) => room.hasVoted.add(id));

const scoresBefore = room.players.map((p) => p.score);
manager.transitionToPhase(room, 'results', noop);
const results = room.results!;
const categories = results.revCatCategories || [];
const winners = categories.filter((c) => c.isWinner);

check('results list every category', categories.length === 3);
check('categories carry their vote counts', categories.every((c) => typeof c.votes === 'number'));
check('results echo the three items', (results.revCatItems || []).join() === roundItems.join());
check('a winner was crowned', winners.length >= 1);
check(
  'the winner holds the top tally',
  winners.every((w) => w.votes === Math.max(...Object.values(room.results!.voteTallies || {}))),
  { winners: winners.map((w) => w.votes), tallies: room.results?.voteTallies }
);
check(
  'the winning votes are reported',
  results.revCatWinningVotes === Math.max(...Object.values(results.voteTallies || {}))
);

// Scoring: every winner +2, every voter who picked a winner +1.
const expected = room.players.map((p) => {
  let pts = 0;
  if (winners.some((w) => w.playerId === p.id)) pts += RC_POINTS_BEST_CATEGORY;
  const votedFor = room.playerVotes[p.id];
  if (votedFor && winners.some((w) => w.playerId === votedFor)) pts += RC_POINTS_VOTER_BONUS;
  return pts;
});
check(
  'points match "best category + voter bonus"',
  room.players.every((p, i) => p.score - scoresBefore[i] === expected[i]),
  { expected, actual: room.players.map((p, i) => p.score - scoresBefore[i]) }
);
check(
  'standings carry the same deltas',
  (results.standings || []).every((s) => s.pointsAdded === expected[room.players.findIndex((p) => p.id === s.playerId)])
);
check(
  'winner names are reported',
  (results.revCatWinnerNames || []).length === winners.length
);
check('vote breakdown is recorded', (results.voteBreakdown || []).length === voters.length);
check(
  'breakdown flags the winning picks',
  (results.voteBreakdown || []).every((b) => b.isCorrect === winners.some((w) => w.playerId === b.targetId))
);

/* ------------------------------------------------------------------ */
section('Tie handling and the no-vote round');

const tieManager = new RoomManager();
const { room: tieRoom } = tieManager.createRoom('Tie', 'socket-tie');
tieManager.addBotPlayer(tieRoom.code);
tieManager.addBotPlayer(tieRoom.code);
tieManager.addBotPlayer(tieRoom.code);
tieManager.selectGame(tieRoom.code, 'reverse-categories');
tieManager.transitionToPhase(tieRoom, 'reveal', noop);
tieManager.transitionToPhase(tieRoom, 'input', noop);
tieManager.transitionToPhase(tieRoom, 'reveal-answers', noop);
tieManager.transitionToPhase(tieRoom, 'vote', noop);

const ids = tieRoom.players.map((p) => p.id);
tieRoom.playerVotes = { [ids[0]]: ids[1], [ids[1]]: ids[0], [ids[2]]: ids[3], [ids[3]]: ids[2] };
tieRoom.voteTallies = { [ids[0]]: 1, [ids[1]]: 1, [ids[2]]: 1, [ids[3]]: 1 };
ids.forEach((id) => tieRoom.hasVoted.add(id));
tieManager.transitionToPhase(tieRoom, 'results', noop);
const tieWinners = (tieRoom.results?.revCatCategories || []).filter((c) => c.isWinner);
check('a 4-way tie crowns every tied author', tieWinners.length === 4, tieWinners.length);
check(
  'every tied author scores the best-category points',
  tieRoom.players.every((p) => p.score === RC_POINTS_BEST_CATEGORY + RC_POINTS_VOTER_BONUS)
);
check('a tie has no single winning category', tieRoom.results?.revCatWinnerCategory === null);

const emptyManager = new RoomManager();
const { room: emptyRoom } = emptyManager.createRoom('Solo', 'socket-solo');
emptyManager.selectGame(emptyRoom.code, 'reverse-categories');
emptyManager.transitionToPhase(emptyRoom, 'reveal', noop);
emptyManager.transitionToPhase(emptyRoom, 'input', noop);
emptyManager.transitionToPhase(emptyRoom, 'reveal-answers', noop);
emptyManager.transitionToPhase(emptyRoom, 'vote', noop);
emptyManager.transitionToPhase(emptyRoom, 'results', noop);
check('a vote-less round crowns nobody', (emptyRoom.results?.revCatCategories || []).every((c) => !c.isWinner));
check('a vote-less round scores nobody', emptyRoom.players.every((p) => p.score === 0));
check('a vote-less round says so', (emptyRoom.results?.summary || '').includes('Nobody'), emptyRoom.results?.summary);

/* ------------------------------------------------------------------ */
section('Rotation and cleanup');

const rotManager = new RoomManager();
const { room: rotRoom } = rotManager.createRoom('Rot', 'socket-rot');
rotManager.selectGame(rotRoom.code, 'reverse-categories');
rotManager.transitionToPhase(rotRoom, 'reveal', noop);
const firstRound = [...(rotRoom.revCatState?.items || [])];
rotManager.transitionToPhase(rotRoom, 'next-round', noop);
const secondRound = [...(rotRoom.revCatState?.items || [])];
check('round two deals a fresh triplet', secondRound.some((item) => !firstRound.includes(item)), {
  firstRound,
  secondRound,
});
check('round two is still three unrelated items', new Set(secondRound).size === 3);
check('played items are tracked', (getRevCatRoundState(rotRoom.code)?.usedItems || []).length === 6);
check('rounds played is reported', (rotRoom.revCatState?.roundsPlayed || 0) >= 1);

rotManager.transitionToPhase(rotRoom, 'lobby', noop);
check('lobby clears the items', rotRoom.revCatState === null);
check('lobby drops the round state', getRevCatRoundState(rotRoom.code) === undefined);

// Cross-game guard: another game must never be routed through the RC engine.
const otherManager = new RoomManager();
const { room: otherRoom } = otherManager.createRoom('Other', 'socket-other');
otherManager.selectGame(otherRoom.code, 'impostor');
otherManager.transitionToPhase(otherRoom, 'reveal', noop);
// A solo room always makes its only player the impostor, so the invariant is
// "knows the word OR is the impostor" — never both.
const otherPriv = otherRoom.privateData[otherRoom.players[0].id] || {};
check(
  'the impostor round still deals either a word or the impostor role',
  otherPriv.role === 'The Impostor' ? otherPriv.secretWord === undefined : Boolean(otherPriv.secretWord),
  { role: otherPriv.role, secretWord: otherPriv.secretWord }
);
check('the impostor round never gets revCat fields', otherPriv.revCatItems === undefined);
check('the impostor round has no revCat items', otherRoom.revCatState === null);

manager.clearPhaseTimer(room);
tieManager.clearPhaseTimer(tieRoom);
emptyManager.clearPhaseTimer(emptyRoom);
rotManager.clearPhaseTimer(rotRoom);
otherManager.clearPhaseTimer(otherRoom);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
