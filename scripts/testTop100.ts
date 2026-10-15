/**
 * Top 100 suite — `npm run test:top100`.
 *
 * Four layers, all in-process (no server, no sockets):
 *   1. the pure matcher/scorer (`server/games/top100.match.ts`): normalisation,
 *      aliases, typo windows, ambiguity, position scoring, duplicate policies,
 *      host overrules and the revealed slices;
 *   2. the content provider (`server/content/top100Provider.ts`): the per-room
 *      shuffle-bag, no repeats inside a cycle, category variety, the region /
 *      category / verified filters and the empty-pool fallback;
 *   3. a 5-round four-player SOLO room with bots driven through the real
 *      RoomManager, checking the round contract, the awards, every phase and the
 *      list-leak guard (the payloads a broadcast would send);
 *   4. a 2-team room: rotating captains, team-private suggestions, the
 *      suggestion fallback, one guess per team scored with awardTeamPoints() and
 *      the team leaderboard shown first.
 *
 * The unmatched-guess log is redirected to a temp file so a test run never
 * touches `data/unmatched-guesses.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { InternalRoom, awardPoints, roomManager } from '../server/roomManager';
import { awardTeamPoints } from '../server/scoring';
import {
  TOP100_MAX_SUGGESTION_CHARS,
  TOP100_MAX_SUGGESTIONS_PER_MEMBER,
  TOP100_QUESTION_SECONDS,
  effectiveTop100GuessSeconds,
  finalizeTop100Guesses,
  getTop100Round,
  lockTop100Row,
  pendingTop100Guessers,
  readTop100Settings,
  simulateTop100BotGuesses,
  simulateTop100BotSuggestions,
  teamSuggestions,
  type Top100RoundState,
} from '../server/games/top100';
import {
  TOP100_NO_ANSWER_LABEL,
  TOP100_TOP_SLICE_SIZE,
  buildTop100MatchIndex,
  buildTop100Slices,
  matchTop100Guess,
  normalizeTop100Text,
  sanitizeTop100Guess,
  scoreTop100Round,
} from '../server/games/top100.match';
import { readUnmatchedGuesses } from '../server/games/top100UnmatchedLog';
import {
  TOP100_LISTS,
  isTop100ListEligible,
  resetTop100ProviderForTests,
  top100Categories,
  top100PoolSizeFor,
  top100Provider,
} from '../server/content/top100Provider';
import {
  DEFAULT_TOP100_SETTINGS,
  TOP100_SETTINGS_LIMITS,
  TOP100_TEAM_MIN_GUESS_SECONDS,
  type Top100Item,
  type Top100List,
} from '../shared/types';

const TOP_100_GAME_ID = 'top-100';
const UNMATCHED_LOG_TMP = 'data/.tmp-top100-unmatched.json';
const OFF_LIST_GUESS = 'absolutely not on any top hundred list';

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

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ────────────────────────────── A synthetic list ───────────────────────────── */

/**
 * A 100-item fixture: a handful of named entries the matcher tests lean on, and
 * filler that deliberately shares no typo window with them.
 */
const SPECIALS: Record<number, { name: string; aliases?: string[] }> = {
  1: { name: 'Alpha' },
  2: { name: '@nike' },
  3: { name: 'The Beatles' },
  4: { name: 'Beyoncé', aliases: ['Beyonce Knowles'] },
  5: { name: 'Big' },
  7: { name: 'Basketball', aliases: ['Hoop Game'] },
  40: { name: 'Champion' },
  41: { name: 'Champioz' },
  56: { name: 'Fifty Six' },
  100: { name: 'Last One' },
};

function testList(): Top100List {
  const items: Top100Item[] = Array.from({ length: 100 }, (_, index) => {
    const rank = index + 1;
    const special = SPECIALS[rank];
    return {
      rank,
      name: special?.name ?? `Unrelated Entry ${rank}`,
      aliases: special?.aliases ?? [],
    };
  });
  return {
    id: 'test-list',
    question: 'A fixture list (2025)',
    category: 'test',
    region: 'global',
    asOf: '2025',
    source: 'test fixture',
    verified: true,
    items,
  };
}

/* ───────────────────────────── Room + leak helpers ─────────────────────────── */

function makeRoom(botCount: number, name = 'Host'): InternalRoom {
  const { room } = roomManager.createRoom(name, `sock_${Math.random().toString(36).slice(2, 9)}`);
  for (let i = 0; i < botCount; i += 1) roomManager.addBotPlayer(room.code);
  return room;
}

/**
 * Every string that reaches a client as a value: the public state plus each
 * player's private state — exactly the objects `server/index.ts` emits.
 *
 * Comparison is by whole value on purpose. A substring test would report the
 * hidden "India" whenever a *question* says "names in India", or "Yellow"
 * because a player's colour is called "Sunny Yellow", and a real leak always
 * arrives as a value.
 */
function valuesOf(value: unknown): Set<string> {
  const values = new Set<string>();
  const collect = (entry: unknown): void => {
    if (typeof entry === 'string') {
      values.add(entry);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(collect);
      return;
    }
    if (entry && typeof entry === 'object') Object.values(entry).forEach(collect);
  };
  collect(value);
  return values;
}

function payloadValues(room: InternalRoom): Set<string> {
  const values = valuesOf(roomManager.getPublicRoomState(room));
  room.players.forEach((player) =>
    valuesOf(roomManager.getPlayerPrivateState(room, player.id)).forEach((value) => values.add(value))
  );
  return values;
}

/** A shipped list would arrive as an array of 100; nothing here is that big. */
function hasListSizedArray(value: unknown, limit = 50): boolean {
  if (Array.isArray(value)) {
    return value.length >= limit || value.some((entry) => hasListSizedArray(entry, limit));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((entry) => hasListSizedArray(entry, limit));
  }
  return false;
}

/** The positions that may never leave the server on their own (ranks 11-89). */
function hiddenNames(state: Top100RoundState): string[] {
  return state.list.items
    .filter((item) => item.rank > TOP100_TOP_SLICE_SIZE && item.rank < 90 && item.name.length >= 5)
    .map((item) => item.name);
}

/**
 * The single most important invariant: the list is a secret. Every payload a
 * client could receive is searched for the hidden positions, and the slices are
 * checked to appear at results and nowhere else.
 *
 * `earned` is what the guesses legitimately win — the item a guess matched is on
 * the board by design (that is the game). `teamPrivate` is material that only a
 * team is allowed to see (their own suggestions).
 */
function expectListSecret(
  room: InternalRoom,
  state: Top100RoundState,
  label: string,
  options: { slices: boolean; earned?: string[]; teamPrivate?: string[] }
): void {
  const earned = new Set(options.earned ?? []);
  const privatelyEarned = new Set([...(options.earned ?? []), ...(options.teamPrivate ?? [])]);
  const hidden = hiddenNames(state);

  const publicState = roomManager.getPublicRoomState(room);
  const publicValues = valuesOf(publicState);
  const publicLeaks = hidden.filter((name) => publicValues.has(name) && !earned.has(name));
  check(
    `${label}: none of the ${hidden.length} hidden positions reach any client in public state`,
    publicLeaks.length === 0,
    publicLeaks.length > 0 ? `leaked ${publicLeaks.slice(0, 3).map((name) => `"${name}"`).join(', ')}` : undefined
  );

  const privateLeaks: string[] = [];
  let listShaped = false;
  room.players.forEach((player) => {
    const privateState = roomManager.getPlayerPrivateState(room, player.id);
    const values = valuesOf(privateState);
    hidden.forEach((name) => {
      if (values.has(name) && !privatelyEarned.has(name) && !privateLeaks.includes(name)) {
        privateLeaks.push(name);
      }
    });
    if (hasListSizedArray(privateState)) listShaped = true;
  });
  check(
    `${label}: no hidden position reaches a player's private state unwarranted`,
    privateLeaks.length === 0,
    privateLeaks.length > 0 ? `leaked ${privateLeaks.slice(0, 3).map((name) => `"${name}"`).join(', ')}` : undefined
  );
  check(
    `${label}: no list-sized array is ever sent`,
    !hasListSizedArray(publicState) && !listShaped
  );

  const published = publicState.top100State;
  check(`${label}: public state carries no item list`, !published || !('items' in published));
  check(
    `${label}: the 1-10 / 90-100 slices are ${options.slices ? 'published' : 'still hidden'}`,
    Boolean(published?.slices) === options.slices
  );

  if (options.slices && published?.slices) {
    const ranks = [...published.slices.top, ...published.slices.bottom].map((entry) => entry.rank);
    check(
      `${label}: exactly the 21 slice positions are revealed`,
      ranks.length === 21 && ranks.every((rank) => rank <= TOP100_TOP_SLICE_SIZE || rank >= 90),
      `ranks ${ranks.join(',')}`
    );
  }
}

/**
 * Opens the round's reveal phase and waits for the (async) list to arrive. A
 * `next-round` transition already lands in `reveal`, so it is not repeated (a
 * second start would burn another rotation of the captain order).
 */
async function openRound(room: InternalRoom, previousListId?: string): Promise<Top100RoundState> {
  if (room.phase !== 'reveal') roomManager.transitionToPhase(room, 'reveal', noop);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = getTop100Round(room.code);
    if (state && state.list.id !== previousListId) return state;
    await tick();
  }
  throw new Error('the Top 100 round never opened');
}

/* ────────────────────────────── 1. The matcher ─────────────────────────────── */

function testMatcher(): void {
  section('matching (pure)');
  const list = testList();
  const index = buildTop100MatchIndex(list);
  const guess = (text: string) => matchTop100Guess(index, text);

  // Normalisation pipeline (shared with Avoid the Word, without plural folding).
  check('normalisation lowercases and drops punctuation', normalizeTop100Text('The Pizzas!') === 'pizzas');
  check('normalisation collapses whitespace', normalizeTop100Text('  Hello    World ') === 'hello world');
  check('normalisation strips diacritics', normalizeTop100Text('Beyoncé') === 'beyonce');
  check('normalisation drops a leading @', normalizeTop100Text('@nike') === 'nike');
  check('normalisation drops a leading article', normalizeTop100Text('The Beatles') === 'beatles');
  check(
    'Top 100 does NOT fold plurals (a plural is a different name)',
    normalizeTop100Text('Apples') !== normalizeTop100Text('Apple')
  );

  // Step 1: exact name / alias hits.
  check('an exact name matches its rank', guess('Basketball').rank === 7);
  check('an alias matches the same rank', guess('Hoop Game').rank === 7);
  check('case and punctuation are ignored', guess('BASKETBALL!').rank === 7);
  check('a leading article is ignored', guess('The Alpha').rank === 1);
  check('a leading @ is ignored', guess('nike').rank === 2 && guess('@nike').rank === 2);
  check('an accent-free spelling matches an accented name', guess('Beyonce').rank === 4);
  check('an accented alias also matches', guess('Beyoncé Knowles').rank === 4);
  check('a hyphen reads as a space', guess('fifty-six').rank === 56);
  check('an exact hit beats a neighbouring typo', guess('Champion').rank === 40);

  // Step 2: typo windows.
  check('a 1-edit typo matches for a 5+ character guess', guess('Basketbal').rank === 7);
  check('a 1-edit typo matches an alias too', guess('Hoop Gam').rank === 7);
  check(
    'a 2-edit typo matches for a 10+ character guess',
    guess('Beyonce Knowlezz').rank === 4,
    `got ${guess('Beyonce Knowlezz').rank}`
  );
  check('a typo of a 3-4 character guess is not forgiven', guess('Bih').rank === null);
  check('a short exact hit still matches', guess('Big').rank === 5);
  check('a spelled-out guess is still "no match"', guess('N O X Y Z').rank === null);

  // Ambiguity: two candidates inside the window means no automatic match.
  const ambiguous = guess('Champiox');
  check('a guess inside two windows is ambiguous', ambiguous.rank === null && ambiguous.ambiguous === true);
  const missing = guess('Nothing At All Here');
  check('an off-list guess is a clean miss', missing.rank === null && missing.ambiguous === false);
  check('an empty guess is a miss', guess('   ').rank === null && guess('').rank === null);

  // Guess sanitation (what actually gets stored).
  check(
    'a guess is capped to six words',
    sanitizeTop100Guess('one two three four five six seven eight') === 'one two three four five six'
  );
  check('a guess is capped to 60 characters', sanitizeTop100Guess('a'.repeat(200)).length === 60);
  check('control characters are stripped from a guess', sanitizeTop100Guess('ni\u0000ce <b>') === 'ni ce b');
}

/* ────────────────────────────── 2. Round scoring ───────────────────────────── */

function testScoring(): void {
  section('scoring (pure)');
  const list = testList();

  const scored = scoreTop100Round(
    list,
    [
      { rowId: 'p1', text: 'Fifty Six' },
      { rowId: 'p2', text: 'Nothing At All Here' },
      { rowId: 'p3', text: 'Champion' },
      { rowId: 'p4', text: 'Champioz' },
      { rowId: 'p5', text: TOP100_NO_ANSWER_LABEL },
    ],
    'allow'
  );
  const byRow = new Map(scored.map((row) => [row.rowId, row]));

  check('position N scores exactly N points', byRow.get('p1')?.points === 56);
  check('an off-list guess scores 0', byRow.get('p2')?.points === 0);
  check('another position scores its own rank', byRow.get('p3')?.points === 40);
  check('a near-miss neighbour scores its own rank', byRow.get('p4')?.points === 41);
  check('a missing guess scores 0', byRow.get('p5')?.points === 0);
  check('the matched item name comes back for the board', byRow.get('p1')?.matchedName === 'Fifty Six');
  check('a clean miss reports no rank', byRow.get('p2')?.matchedRank === null);
  check('the score order follows the guess order', scored.map((row) => row.rowId).join(',') === 'p1,p2,p3,p4,p5');

  // Duplicate policy.
  const duplicates = [
    { rowId: 'a', text: 'Fifty Six' },
    { rowId: 'b', text: 'fifty-six' },
    { rowId: 'c', text: 'Alpha' },
  ];
  const allowed = scoreTop100Round(list, duplicates, 'allow');
  check('policy "allow": every duplicate keeps its points', allowed[0].points === 56 && allowed[1].points === 56);
  check('policy "allow": duplicates are flagged on the board', allowed[0].duplicate && allowed[1].duplicate);
  check('policy "allow": the lone guess is not flagged', allowed[2].duplicate === false);
  check('policy "allow": nothing is zeroed', allowed.every((row) => !row.zeroedByDuplicate));

  const zeroed = scoreTop100Round(list, duplicates, 'zero');
  check('policy "zero": the duplicate pair scores nothing', zeroed[0].points === 0 && zeroed[1].points === 0);
  check('policy "zero": the pair is marked as zeroed', zeroed[0].zeroedByDuplicate && zeroed[1].zeroedByDuplicate);
  check('policy "zero": an unrepeated item still scores', zeroed[2].points === 1);

  // Host overrules.
  const forced = scoreTop100Round(list, [{ rowId: 'p1', text: 'Nothing At All Here' }], 'allow', {
    p1: 3,
  })[0];
  check('an overrule assigns the forced position', forced.matchedRank === 3 && forced.points === 3);
  check('an overrule reports where the points came from', forced.matchedBy === 'overrule' && forced.overruled);
  check('an overrule names the forced item', forced.matchedName === 'The Beatles');

  const notOnList = scoreTop100Round(list, [{ rowId: 'p1', text: 'Alpha' }], 'allow', { p1: null })[0];
  check('a "not on the list" overrule zeroes the guess', notOnList.points === 0 && notOnList.matchedRank === null);
  check('a "not on the list" overrule is still flagged', notOnList.overruled && notOnList.matchedBy === 'none');

  const unusable = scoreTop100Round(list, [{ rowId: 'p1', text: 'Alpha' }], 'allow', { p1: 101 })[0];
  check('an out-of-range overrule can never award points', unusable.points === 0);

  const overruledDuplicate = scoreTop100Round(
    list,
    [
      { rowId: 'a', text: 'Alpha' },
      { rowId: 'b', text: 'Big' },
    ],
    'zero',
    { b: 1 }
  );
  check(
    'the duplicate policy also applies to overruled guesses',
    overruledDuplicate[0].points === 0 && overruledDuplicate[1].points === 0
  );

  // Slices: only 1-10 and 90-100 may be revealed.
  const slices = buildTop100Slices(list);
  check(
    'the top slice is positions 1-10',
    slices.top.length === 10 && slices.top[0].rank === 1 && slices.top[9].rank === 10
  );
  check(
    'the bottom slice is positions 90-100',
    slices.bottom.length === 11 && slices.bottom[0].rank === 90 && slices.bottom[10].rank === 100
  );
  check('the slices carry the list names', slices.top[0].name === 'Alpha' && slices.bottom[10].name === 'Last One');
  check(
    'nothing between the slices is included',
    [...slices.top, ...slices.bottom].every((entry) => entry.rank <= 10 || entry.rank >= 90)
  );
}

/* ──────────────────────────────── 3. Provider ──────────────────────────────── */

async function testProvider(): Promise<void> {
  section('content provider');
  resetTop100ProviderForTests();

  check('the bank ships several lists', TOP100_LISTS.length >= 10, `${TOP100_LISTS.length} lists`);
  check(
    'every bundled list is complete and unique',
    TOP100_LISTS.every(
      (list) =>
        list.items.length === 100 &&
        new Set(list.items.map((item) => item.rank)).size === 100 &&
        list.question.trim().length > 0 &&
        list.source.trim().length > 0
    )
  );
  check(
    'aliases are unique inside every list',
    TOP100_LISTS.every((list) => {
      const keys = new Set<string>();
      return list.items.every((item) => {
        const own = [item.name, ...item.aliases].map((text) => normalizeTop100Text(text));
        const unique = own.every((key) => !keys.has(key));
        own.forEach((key) => keys.add(key));
        return unique;
      });
    })
  );
  const categories = top100Categories();
  check('the bank covers several categories', categories.length >= 5, categories.join(','));

  const unverified = TOP100_LISTS.find((list) => !list.verified);
  check(
    'verified-only hides the unchecked lists',
    !unverified || (!isTop100ListEligible(unverified, {}, true) && isTop100ListEligible(unverified, {}, false))
  );
  const indiaList = TOP100_LISTS.find((list) => list.region === 'india');
  check(
    'a region filter excludes the other region',
    !indiaList ||
      (isTop100ListEligible(indiaList, { region: 'india' }) &&
        isTop100ListEligible(indiaList, { region: 'mixed' }) &&
        !isTop100ListEligible(indiaList, { region: 'global' }))
  );

  // Shuffle-bag: no repeats until the eligible pool is exhausted.
  const poolSize = top100PoolSizeFor({ region: 'mixed' });
  const seen = new Set<string>();
  const servedCategories: string[] = [];
  let lastId = '';
  for (let index = 0; index < poolSize; index += 1) {
    const list = await top100Provider.next('room-bag', { region: 'mixed' });
    seen.add(list.id);
    servedCategories.push(list.category);
    lastId = list.id;
  }
  check(
    'a room is never served the same list twice in one cycle',
    seen.size === poolSize,
    `${seen.size}/${poolSize}`
  );
  // A differing category is always available for the first ten picks (the biggest
  // category holds five lists), which is as many rounds as a game may have.
  const openingCategories = servedCategories.slice(0, 10);
  check(
    'consecutive rounds change category while another one is available',
    openingCategories.every((category, index) => index === 0 || category !== openingCategories[index - 1]),
    openingCategories.join(',')
  );

  const cycled = await top100Provider.next('room-bag', { region: 'mixed' });
  check('a new cycle does not open with the list that just played', cycled.id !== lastId);
  top100Provider.release('room-bag');
  check('the bag forgets a room on release', top100Provider.servedCount('room-bag') === 0);

  // Filters.
  const indiaLists = TOP100_LISTS.filter((list) => list.region === 'india');
  if (indiaLists.length > 0) {
    const served: Top100List[] = [];
    for (let index = 0; index < indiaLists.length; index += 1) {
      served.push(await top100Provider.next('room-india', { region: 'india' }));
    }
    check('the india setting only serves india lists', served.every((list) => list.region === 'india'));
  }

  const musicLists = TOP100_LISTS.filter((list) => list.category === 'music');
  if (musicLists.length > 0) {
    const served: Top100List[] = [];
    for (let index = 0; index < musicLists.length; index += 1) {
      served.push(await top100Provider.next('room-music', { categories: ['music'] }));
    }
    check('a category filter only serves that category', served.every((list) => list.category === 'music'));
  }

  process.env.TOP100_ONLY_VERIFIED = 'true';
  try {
    const verifiedPool = top100PoolSizeFor({ region: 'mixed' });
    check('verified-only shrinks the pool', verifiedPool > 0 && verifiedPool <= poolSize);
    const served: Top100List[] = [];
    for (let index = 0; index < verifiedPool; index += 1) {
      served.push(await top100Provider.next('room-verified', { region: 'mixed' }));
    }
    check('verified-only never serves an unchecked list', served.every((list) => list.verified));
  } finally {
    delete process.env.TOP100_ONLY_VERIFIED;
  }

  const stranded = await top100Provider.next('room-stranded', {
    region: 'india',
    categories: ['music'],
  });
  check('an impossible filter combination still serves a list', Boolean(stranded?.id));
  resetTop100ProviderForTests();
}

/* ───────────────────── 4. A solo game through the RoomManager ──────────────── */

async function testSoloGame(): Promise<void> {
  section('solo: 4 players, 5 rounds, bots');
  const room = makeRoom(3);
  const host = room.players[0];
  roomManager.selectGame(room.code, TOP_100_GAME_ID);
  check(
    'the host can set the round count and the guess timer',
    roomManager.setGameSettings(room.code, host.id, {
      top100: { roundCount: 5, guessSeconds: 45, duplicatePolicy: 'allow', region: 'mixed' },
    }).success
  );
  check(
    'the settings are clamped into their legal range',
    (() => {
      roomManager.setGameSettings(room.code, host.id, { top100: { guessSeconds: 9999, roundCount: 0 } });
      const settings = readTop100Settings(room);
      const clamped =
        settings.guessSeconds === TOP100_SETTINGS_LIMITS.guessSeconds.max &&
        settings.roundCount === TOP100_SETTINGS_LIMITS.roundCount.min;
      roomManager.setGameSettings(room.code, host.id, {
        ...DEFAULT_TOP100_SETTINGS,
        top100: { ...DEFAULT_TOP100_SETTINGS, roundCount: 5, guessSeconds: 45 },
      });
      return clamped;
    })()
  );
  check(
    'a non-host cannot change the settings',
    roomManager.setGameSettings(room.code, room.players[1].id, { top100: { roundCount: 2 } }).success === false
  );

  // Round 1: the host names the item at position 56, and a bot row is overruled.
  // Round 2: the host names something that is not on the list at all.
  // Rounds 3-5: the host names positions 1 and 100, then nothing at all.
  const plan: Array<{ rank: number | null; text?: string }> = [
    { rank: 56 },
    { rank: null, text: OFF_LIST_GUESS },
    { rank: 1 },
    { rank: 100 },
    { rank: null, text: '' },
  ];

  const listIds: string[] = [];
  const categories: string[] = [];
  let previousListId: string | undefined;
  let expectedHostTotal = 0;
  let categoryBreaks = 0;

  for (let round = 1; round <= plan.length; round += 1) {
    const state = await openRound(room, previousListId);
    previousListId = state.list.id;
    listIds.push(state.list.id);
    if (round > 1 && state.list.category === categories[categories.length - 1]) categoryBreaks += 1;
    categories.push(state.list.category);

    const question = roomManager.getPublicRoomState(room).top100State!;
    check(
      `round ${round}: the question and its category are public`,
      Boolean(question.question) && Boolean(question.category)
    );
    check(
      `round ${round}: the round counter is published`,
      question.roundNumber === round && question.roundCount === 5
    );
    check(
      `round ${round}: the question beat runs on its own timer`,
      room.phase === 'reveal' && room.timer?.remainingSeconds === TOP100_QUESTION_SECONDS,
      `phase ${room.phase}, timer ${room.timer?.remainingSeconds}`
    );
    check(
      `round ${round}: nobody has submitted yet`,
      question.submittedIds.length === 0 && question.guesses.length === 0
    );
    expectListSecret(room, state, `round ${round} (question)`, { slices: false });

    // Guess phase.
    roomManager.transitionToPhase(room, 'input', noop);
    check(
      `round ${round}: every solo player owes a guess`,
      pendingTop100Guessers(room).length === 4,
      `${pendingTop100Guessers(room).length} pending`
    );
    const bots = simulateTop100BotGuesses(room);
    check(`round ${round}: the bots lock their own guesses`, bots.length === 3);
    check(
      `round ${round}: the board stays empty while the phase is open`,
      roomManager.getPublicRoomState(room).top100State!.guesses.length === 0
    );

    const entry = plan[round - 1];
    const item =
      entry.rank === null ? undefined : state.list.items.find((candidate) => candidate.rank === entry.rank)!;
    const guessText = item ? item.name : entry.text ?? '';
    roomManager.submitInput(room, host.id, guessText, noop);

    check(
      `round ${round}: the phase ends early once everyone has locked`,
      room.phase === 'reveal-answers',
      `phase is ${room.phase}`
    );
    const board = roomManager.getPublicRoomState(room).top100State!;
    check(
      `round ${round}: the guesses grid holds every row`,
      board.guesses.length === 4 && board.submittedIds.length === 4
    );
    check(
      `round ${round}: points are not final on the guesses board`,
      board.revealed === false && room.players.find((player) => player.id === host.id)?.score === expectedHostTotal
    );
    // Guesses are public on the board: a named item a guess matched is earned.
    const earned = board.guesses.flatMap((row) => [row.text, row.matchedName ?? '']);
    expectListSecret(room, state, `round ${round} (guesses board)`, { slices: false, earned });

    const hostRow = board.guesses.find((row) => row.ownerId === host.id)!;
    const expectedPoints = entry.rank ?? 0;
    check(
      `round ${round}: the host's guess scores ${expectedPoints}`,
      hostRow.points === expectedPoints,
      `got ${hostRow.points}`
    );
    if (entry.rank === 56) {
      check('a guess at position 56 scores exactly 56', hostRow.points === 56 && hostRow.matchedRank === 56);
    }
    if (entry.rank === null) {
      check(`round ${round}: an off-list guess scores 0`, hostRow.points === 0 && hostRow.matchedRank === null);
    }
    check(
      `round ${round}: the locked guess is stored as typed`,
      hostRow.text === (sanitizeTop100Guess(guessText) || TOP100_NO_ANSWER_LABEL),
      `stored "${hostRow.text}"`
    );

    // Host overrule: a forced position on round 1, "not on the list" on round 2.
    const botRow = board.guesses.find((row) => row.ownerId !== host.id)!;
    if (round === 1) {
      check(
        'a non-host cannot overrule a guess',
        (() => {
          roomManager.hostOverruleTop100Guess(room, room.players[1].id, botRow.rowId, 4, noop);
          const row = roomManager
            .getPublicRoomState(room)
            .top100State!.guesses.find((candidate) => candidate.rowId === botRow.rowId)!;
          return row.points === botRow.points && !row.overruled;
        })()
      );
      check(
        'an out-of-range overrule is rejected',
        (() => {
          roomManager.hostOverruleTop100Guess(room, host.id, botRow.rowId, 101, noop);
          const row = roomManager
            .getPublicRoomState(room)
            .top100State!.guesses.find((candidate) => candidate.rowId === botRow.rowId)!;
          return row.overruled === false;
        })()
      );
      roomManager.hostOverruleTop100Guess(room, host.id, botRow.rowId, 4, noop);
      const overruled = roomManager
        .getPublicRoomState(room)
        .top100State!.guesses.find((row) => row.rowId === botRow.rowId)!;
      check('the host can force a guess onto a position', overruled.points === 4 && overruled.overruled);
    }
    if (round === 2) {
      roomManager.hostOverruleTop100Guess(room, host.id, botRow.rowId, null, noop);
      const offList = roomManager
        .getPublicRoomState(room)
        .top100State!.guesses.find((row) => row.rowId === botRow.rowId)!;
      check('the host can mark a guess as not on the list', offList.points === 0 && offList.matchedRank === null);
    }

    // Continue: points become final and the slices appear.
    const resultsBefore = room.results;
    roomManager.hostContinueTop100Reveal(room, room.players[1].id, noop);
    check(`round ${round}: a non-host cannot skip the overrule window`, room.results === resultsBefore && room.phase === 'reveal-answers');
    roomManager.hostContinueTop100Reveal(room, host.id, noop);
    check(`round ${round}: Continue resolves into results`, room.phase === 'results');

    expectedHostTotal += expectedPoints;
    check(
      `round ${round}: the host's total is now ${expectedHostTotal}`,
      room.players.find((player) => player.id === host.id)?.score === expectedHostTotal
    );
    check(
      `round ${round}: the award is logged for the round`,
      room.scoreLog.some((entry2) => entry2.playerId === host.id && entry2.reason === `top100:round${round}`)
    );
    if (round === 1) {
      check(
        'an overruled bot row paid the forced position',
        room.players.find((player) => player.id === botRow.ownerId)?.score === 4
      );
    }

    const results = room.results!;
    check(
      `round ${round}: the results carry the revealed slices`,
      results.top100Slices?.top.length === 10 && results.top100Slices?.bottom.length === 11
    );
    check(
      `round ${round}: the results name the question`,
      Boolean(results.top100Question) && Boolean(results.top100Category)
    );
    check(
      `round ${round}: the last round is flagged as final`,
      results.top100IsFinal === (round === plan.length)
    );
    if (entry.rank === null && entry.text) {
      check(
        `round ${round}: an off-list guess is listed as unmatched`,
        Boolean(results.top100Unmatched?.includes(sanitizeTop100Guess(entry.text)))
      );
    }
    expectListSecret(room, state, `round ${round} (results)`, {
      slices: true,
      earned: room.top100State!.guesses.flatMap((row) => [row.text, row.matchedName ?? '']),
    });

    if (round < plan.length) roomManager.transitionToPhase(room, 'next-round', noop);
  }

  check('five rounds used five different lists', new Set(listIds).size === 5, listIds.join(','));
  check('consecutive rounds differ in category when possible', categoryBreaks === 0, categories.join(','));
  check('the game reports itself over after the round count', room.top100State!.gameOver === true);

  // The unmatched-guess log: list id + normalised text, never an identity.
  const logFile = path.resolve(process.cwd(), UNMATCHED_LOG_TMP);
  const log = readUnmatchedGuesses(logFile);
  const bucket = log.lists[listIds[1]] ?? {};
  check(
    'the off-list guess is logged with its normalised text',
    (bucket[normalizeTop100Text(sanitizeTop100Guess(OFF_LIST_GUESS))] ?? 0) >= 1,
    JSON.stringify(log).slice(0, 200)
  );
  const raw = fs.readFileSync(logFile, 'utf8');
  check('the unmatched log never records a player identity', !raw.includes(host.id) && !raw.includes(host.name));

  roomManager.deleteRoom(room.code);
  check('a deleted room forgets its hidden round', getTop100Round(room.code) === undefined);
}

/* ───────────────────── 5. A team game through the RoomManager ──────────────── */

async function testTeamGame(): Promise<void> {
  section('team mode: 2 teams, rotating captains, private suggestions');
  const room = makeRoom(3, 'Captain');
  const host = room.players[0];
  check('the host turns team mode on', roomManager.setPlayMode(room.code, host.id, 'team').success);
  check('the host sets two teams', roomManager.setTeamCount(room.code, host.id, 2).success);
  const [teamA, teamB] = room.teams;
  check('the host joins the first team', roomManager.joinTeam(room.code, host.id, teamA.id).success);
  check('every player sits on a team', room.players.every((player) => Boolean(player.teamId)));
  roomManager.selectGame(room.code, TOP_100_GAME_ID);
  roomManager.setGameSettings(room.code, host.id, { top100: { roundCount: 3, guessSeconds: 45 } });

  // ── awardTeamPoints(): team-only, and it must survive a derived recompute.
  awardTeamPoints(room, teamA.id, 30, 'test');
  check('awardTeamPoints moves the team total', teamA.score === 30);
  check('individual scores are untouched by a team award', room.players.every((player) => player.score === 0));
  roomManager.getPublicRoomState(room);
  check('a team-only award survives the derived-total recompute', teamA.score === 30);
  const member = room.players.find((player) => player.teamId === teamA.id)!;
  awardPoints(room, member.id, 5, 'test');
  check('a player award rolls up to their team', teamA.score === 35 && member.score === 5);
  check(
    'a team-only award stays with the team when a member leaves',
    (() => {
      roomManager.joinTeam(room.code, member.id, teamB.id);
      roomManager.getPublicRoomState(room);
      const ok = teamA.score === 30 && teamB.score === 5;
      roomManager.joinTeam(room.code, member.id, teamA.id);
      roomManager.getPublicRoomState(room);
      return ok;
    })()
  );
  // Start the rounds from a clean slate.
  room.players.forEach((player) => {
    player.score = 0;
  });
  room.teams.forEach((team) => {
    team.bonusPoints = 0;
    team.score = 0;
  });
  room.scoreLog.length = 0;

  const listIds: string[] = [];
  let previousListId: string | undefined;

  // ── Round 1: the human host captains team A and locks a real item.
  let state = await openRound(room);
  listIds.push(state.list.id);
  previousListId = state.list.id;
  let previousCaptains = new Map(state.captains);

  check('the captain of the host team is the host', state.captains.get(teamA.id) === host.id);
  check('team mode keeps a 60s guess window', state.guessSeconds >= TOP100_TEAM_MIN_GUESS_SECONDS);
  check(
    'solo mode keeps the host setting',
    effectiveTop100GuessSeconds(readTop100Settings(room), 'solo') === 45
  );
  check(
    'team mode asks one guess per team',
    roomManager.getPublicRoomState(room).top100State!.guesserIds.length === 2
  );

  roomManager.transitionToPhase(room, 'input', noop);
  const hostPrivate = roomManager.getPlayerPrivateState(room, host.id);
  check('the captain is told that they type the guess', hostPrivate.top100IsCaptain === true);
  check(
    'the captain sees their teammates',
    (hostPrivate.top100TeamNames ?? []).length === teamA.memberIds.length - 1
  );

  check(
    'a teammate cannot lock the team guess',
    (() => {
      const teammate = room.players.find((player) => player.teamId === teamA.id && player.id !== host.id)!;
      roomManager.submitInput(room, teammate.id, 'Basketball', noop);
      return !roomManager.getPublicRoomState(room).top100State!.submittedIds.includes(teamA.id);
    })()
  );

  const botSuggestions = simulateTop100BotSuggestions(room);
  check('bot teammates offer suggestions of their own', botSuggestions >= 1);

  const hostSuggestion = roomManager.submitTop100Suggestion(room, host.id, 'a'.repeat(50), noop);
  check('a suggestion is accepted and capped to 30 characters', hostSuggestion.success);
  const capped = roomManager.top100SuggestionsForTeam(room.code, teamA.id).at(-1)!;
  check('the suggestion text is capped', capped.text.length === TOP100_MAX_SUGGESTION_CHARS);

  const teamBMember = room.players.find((player) => player.teamId === teamB.id)!;
  // Two bots may suggest the same item, so only texts that are team B's alone
  // prove the channel is private.
  const teamAOwn = new Set(
    roomManager.top100SuggestionsForTeam(room.code, teamA.id).map((suggestion) => suggestion.text)
  );
  const teamBOnly = roomManager
    .top100SuggestionsForTeam(room.code, teamB.id)
    .map((suggestion) => suggestion.text)
    .filter((text) => !teamAOwn.has(text));
  check(
    'a team never sees another team suggestion',
    teamBOnly.length >= 1 &&
      [host.id, ...room.players.filter((player) => player.teamId === teamA.id).map((player) => player.id)].every(
        (playerId) => {
          const values = valuesOf(roomManager.getPlayerPrivateState(room, playerId));
          return teamBOnly.every((text) => !values.has(text));
        }
      )
  );
  check(
    'the other team keeps its own suggestions',
    (roomManager.getPlayerPrivateState(room, teamBMember.id).top100Suggestions ?? []).length >= 1
  );

  const distinctive = 'a very distinct team b idea';
  check(
    'a teammate suggestion is accepted through the team channel',
    roomManager.submitTop100Suggestion(room, teamBMember.id, distinctive, noop).success
  );
  check(
    'the team channel reaches that team only',
    valuesOf(roomManager.getPlayerPrivateState(room, teamBMember.id)).has(distinctive) &&
      room.players
        .filter((player) => player.teamId === teamB.id)
        .every((player) => valuesOf(roomManager.getPlayerPrivateState(room, player.id)).has(distinctive)) &&
      room.players
        .filter((player) => player.teamId === teamA.id)
        .every((player) => !valuesOf(roomManager.getPlayerPrivateState(room, player.id)).has(distinctive)) &&
      !valuesOf(roomManager.getPublicRoomState(room)).has(distinctive)
  );
  check(
    'the suggestion never enters public state',
    !valuesOf(roomManager.getPublicRoomState(room)).has(capped.text)
  );
  check(
    'the suggestions reach the captain',
    (roomManager.getPlayerPrivateState(room, host.id).top100Suggestions ?? []).length >= 1
  );
  check(
    'a suggestion limit is enforced per member per round',
    (() => {
      for (let index = 0; index < TOP100_MAX_SUGGESTIONS_PER_MEMBER + 2; index += 1) {
        roomManager.submitTop100Suggestion(room, host.id, `spam ${index}`, noop);
      }
      const hostPrivate1 = roomManager.getPlayerPrivateState(room, host.id);
      return (
        hostPrivate1.top100SuggestionsLeft === 0 &&
        roomManager.submitTop100Suggestion(room, host.id, 'one more', noop).success === false
      );
    })()
  );

  const targetItem = state.list.items.find(
    (item) => item.rank > 1 && item.rank <= 50 && item.name.length <= 25
  )!;
  roomManager.submitInput(room, host.id, targetItem.name, noop);
  check(
    'the captain locks the team guess',
    roomManager.getPublicRoomState(room).top100State!.submittedIds.includes(teamA.id)
  );
  check('the other team still owes a guess', pendingTop100Guessers(room).join(',') === teamB.id);
  check('the round waits for the second team', room.phase === 'input');

  check('the bot captain locks its single team guess', simulateTop100BotGuesses(room).join(',') === teamB.id);
  finalizeTop100Guesses(room);
  roomManager.transitionToPhase(room, 'reveal-answers', noop);

  let board = roomManager.getPublicRoomState(room).top100State!;
  check('the board shows exactly one row per team', board.guesses.length === 2);
  check(
    'every row belongs to a team',
    board.guesses.every((row) => row.rowId === teamA.id || row.rowId === teamB.id)
  );
  const rowA = board.guesses.find((row) => row.rowId === teamA.id)!;
  const rowB = board.guesses.find((row) => row.rowId === teamB.id)!;
  check('the captain guess scores its position', rowA.points === targetItem.rank, `${rowA.points}`);
  check('the team row is labelled with the team name', rowA.name === teamA.name && rowA.teamName === teamA.name);
  check('no team scored before Continue', room.teams.every((team) => team.score === 0));
  // A team's own suggestions are private by design, so they are allowed there.
  const suggested = room.teams.flatMap((team) =>
    teamSuggestions(room.code, team.id).map((suggestion) => suggestion.text)
  );
  const teamEarned = board.guesses.flatMap((row) => [row.text, row.matchedName ?? '']);
  expectListSecret(room, state, 'team round 1 (board)', {
    slices: false,
    earned: teamEarned,
    teamPrivate: suggested,
  });

  roomManager.hostContinueTop100Reveal(room, host.id, noop);
  check('the round resolves for both teams', room.phase === 'results');
  check('the team guess was scored with awardTeamPoints', teamA.score === targetItem.rank, `${teamA.score}`);
  check('the second team scored its own guess', teamB.score === rowB.points);
  check('individual scores stay untouched in team mode', room.players.every((player) => player.score === 0));
  check(
    'the team totals carry the team-only awards',
    room.teams.every((team) => (team.bonusPoints ?? 0) === team.score)
  );
  check(
    'the score log names the teams, not the players',
    room.scoreLog.filter((entry) => entry.reason === 'top100:round1').length === 2 &&
      room.scoreLog.every((entry) => entry.playerId === teamA.id || entry.playerId === teamB.id)
  );

  const teamResults = room.results!;
  check('the team leaderboard is built for the results screen', (teamResults.teamStandings ?? []).length === 2);
  check(
    'the team leaderboard is ranked first to last',
    (teamResults.teamStandings ?? []).every(
      (standing, index, all) => standing.rank === index + 1 && (index === 0 || all[index - 1].total >= standing.total)
    )
  );
  check(
    'the individual standings add no points in team mode',
    teamResults.standings.every((standing) => standing.pointsAdded === 0)
  );
  check(
    'the captain is badged on the leaderboard',
    teamResults.standings.filter((standing) => standing.badge === 'Captain').length === 2
  );
  expectListSecret(room, state, 'team round 1 (results)', {
    slices: true,
    earned: teamEarned,
    teamPrivate: suggested,
  });

  // ── Round 2: the captain rotates and a timeout falls back to a suggestion.
  roomManager.transitionToPhase(room, 'next-round', noop);
  state = await openRound(room, previousListId);
  listIds.push(state.list.id);
  previousListId = state.list.id;
  check(
    'the captain rotates to the next teammate',
    state.captains.get(teamA.id) !== host.id && state.captains.get(teamA.id) !== previousCaptains.get(teamA.id)
  );
  check(
    'every team rotated its captain',
    room.teams.every((team) => state.captains.get(team.id) !== previousCaptains.get(team.id))
  );
  check('the round counter advanced', state.roundNumber === 2);
  previousCaptains = new Map(state.captains);

  roomManager.transitionToPhase(room, 'input', noop);
  const hostPrivate2 = roomManager.getPlayerPrivateState(room, host.id);
  check(
    'a non-captain is told who locks the guess',
    hostPrivate2.top100IsCaptain === false && Boolean(hostPrivate2.top100CaptainName)
  );

  const fallbackItem = state.list.items.find(
    (item) => item.rank > 1 && item.rank <= 50 && item.name.length <= TOP100_MAX_SUGGESTION_CHARS
  )!;
  check('a non-captain may suggest', roomManager.submitTop100Suggestion(room, host.id, fallbackItem.name, noop).success);

  lockTop100Row(room, teamB.id, state.list.items.find((item) => item.rank === 1)!.name);
  finalizeTop100Guesses(room);
  roomManager.transitionToPhase(room, 'reveal-answers', noop);
  board = roomManager.getPublicRoomState(room).top100State!;
  const fallbackRow = board.guesses.find((row) => row.rowId === teamA.id)!;
  check(
    'a captain who runs out of time falls back to the newest suggestion',
    fallbackRow.text === fallbackItem.name,
    `got "${fallbackRow.text}"`
  );
  check('the fallback guess is scored like any other', fallbackRow.points === fallbackItem.rank);

  roomManager.hostContinueTop100Reveal(room, host.id, noop);
  check('the fallback points reached the team', teamA.score === targetItem.rank + fallbackItem.rank);

  // ── Round 3: no suggestions and no locks: both teams score nothing.
  roomManager.transitionToPhase(room, 'next-round', noop);
  state = await openRound(room, previousListId);
  listIds.push(state.list.id);
  roomManager.transitionToPhase(room, 'input', noop);
  finalizeTop100Guesses(room);
  roomManager.transitionToPhase(room, 'reveal-answers', noop);
  board = roomManager.getPublicRoomState(room).top100State!;
  check(
    'a team with no guess and no suggestion is stored as "(no answer)"',
    board.guesses.every((row) => row.text === TOP100_NO_ANSWER_LABEL && row.points === 0)
  );
  roomManager.hostContinueTop100Reveal(room, host.id, noop);
  check(
    'a no-answer round moves nothing',
    teamA.score === targetItem.rank + fallbackItem.rank &&
      teamB.score === rowB.points + 1,
    `A=${teamA.score} B=${teamB.score}`
  );
  check('three rounds used three different lists', new Set(listIds).size === 3, listIds.join(','));
  check('the last round is reported as final', room.results!.top100IsFinal === true);
  check(
    'the final winner is a team, not a player',
    (room.results!.winnerTitle || '').includes(teamA.name) || (room.results!.winnerTitle || '').includes(teamB.name)
  );

  roomManager.deleteRoom(room.code);
}

/* ─────────────────────────────── Entry point ───────────────────────────────── */

async function main(): Promise<void> {
  // Keep the unmatched-guess log out of `data/unmatched-guesses.json`.
  process.env.TOP100_UNMATCHED_LOG = UNMATCHED_LOG_TMP;
  const logFile = path.resolve(process.cwd(), UNMATCHED_LOG_TMP);
  fs.rmSync(logFile, { force: true });

  testMatcher();
  testScoring();
  await testProvider();
  await testSoloGame();
  await testTeamGame();
  resetTop100ProviderForTests();

  fs.rmSync(logFile, { force: true });
  delete process.env.TOP100_UNMATCHED_LOG;

  console.log(`\n${passed} checks passed`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} FAILED:`);
    failures.forEach((failure) => console.error(`  x ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('Top 100 suite: all green.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
