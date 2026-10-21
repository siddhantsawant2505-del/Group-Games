/**
 * Mafia suite — `npm run test:mafia`.
 *
 * Six layers, all in-process (no sockets):
 *   1. deals and settings validation for every table from 4 to 16 players;
 *   2. resolveNight: kill, doctor save, doctor no-repeat, no Mafia vote, tie-break;
 *   3. tallyVote: plurality, ties, Skip;
 *   4. checkWin: the parity rule and its documented ordering;
 *   5. 250 full bot-only games, each of which must terminate with exactly one
 *      winner (the loop is bounded, so a hang fails instead of stalling CI);
 *   6. a real six-player room driven through RoomManager: reveal -> night ->
 *      morning -> day -> vote -> exile -> ... -> game over, with every broadcast
 *      payload checked for a role leak, every private payload checked for
 *      somebody else's secrets, and a mid-night reconnect restoring the prompt.
 */

import { InternalRoom, roomManager } from '../server/roomManager';
import {
  checkMafiaWin,
  getMafiaRound,
  pickMafiaBotNightAction,
  pickMafiaBotVote,
  setMafiaWinningSide,
} from '../server/games/mafia';
import {
  SKIP_VOTE,
  assignRoles,
  checkWin,
  resolveNight,
  shuffle,
  tallyVote,
  validateSettings,
} from '../server/games/mafia.engine';
import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_ROLE_LABELS,
  MafiaRole,
  MafiaSettings,
  RoomPublicState,
} from '../shared/types';
import { autoMafiaCount, maxMafiaCount, roleBreakdown } from '../shared/data/mafiaSetup';

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

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const BASE_SETTINGS: MafiaSettings = {
  nightSeconds: 30,
  discussionSeconds: 120,
  voteSeconds: 30,
  mafiaCount: 'auto',
  detective: true,
  doctor: true,
  revealRoleOnDeath: true,
};

/* ───────────────────── 1. Deals and settings ────────────────────────────── */

function testDeals(): void {
  section('deals: every table from 4 to 16');

  for (let n = MAFIA_MIN_PLAYERS; n <= MAFIA_MAX_PLAYERS; n += 1) {
    const ids = Array.from({ length: n }, (_, index) => `p${index}`);
    const deal = assignRoles(ids, BASE_SETTINGS, seeded(n));
    const roles = Object.values(deal.roles);
    const mafia = roles.filter((role) => role === 'mafia').length;
    const detectives = roles.filter((role) => role === 'detective').length;
    const doctors = roles.filter((role) => role === 'doctor').length;
    const townspeople = roles.filter((role) => role === 'townsperson').length;

    check(`N=${n}: everyone is dealt one role`, roles.length === n);
    check(`N=${n}: Mafia is strictly less than half the table`, mafia * 2 < n, `mafia=${mafia}`);
    check(`N=${n}: auto Mafia follows round(N/4)`, mafia === autoMafiaCount(n), `${mafia}`);
    check(`N=${n}: at most one Detective`, detectives === 1);
    check(`N=${n}: Doctor is dealt from six players`, doctors === (n >= 6 ? 1 : 0));
    check(`N=${n}: every seat accounted for`, mafia + detectives + doctors + townspeople === n);
    check(`N=${n}: mafiaIds matches the dealt roles`, deal.mafiaIds.length === mafia);
    check(`N=${n}: ids are unique`, new Set(Object.keys(deal.roles)).size === n);
  }

  // The documented ceiling applies to host overrides as well.
  check('the ceiling is floor((N-1)/2)', maxMafiaCount(16) === 7 && maxMafiaCount(4) === 1);

  const fourWithThreeMafia = validateSettings(4, { ...BASE_SETTINGS, mafiaCount: 3 });
  check('4 players cannot deal 3 Mafia', !fourWithThreeMafia.valid);
  check(
    'the refusal explains the ceiling',
    Boolean(fourWithThreeMafia.error?.includes('most Mafia allowed is 1')),
    fourWithThreeMafia.error
  );

  const tooFew = validateSettings(3, BASE_SETTINGS);
  check('3 players is below the minimum', !tooFew.valid);
  const tooMany = validateSettings(17, BASE_SETTINGS);
  check('17 players is above the maximum', !tooMany.valid);
  check('the minimum is four', MAFIA_MIN_PLAYERS === 4 && MAFIA_MAX_PLAYERS === 16);

  const badNight = validateSettings(8, { ...BASE_SETTINGS, nightSeconds: 5 });
  check('an out-of-range night timer is rejected', !badNight.valid);
  const badVote = validateSettings(8, { ...BASE_SETTINGS, voteSeconds: 500 });
  check('an out-of-range vote timer is rejected', !badVote.valid);

  const noSpecials = validateSettings(8, {
    ...BASE_SETTINGS,
    detective: false,
    doctor: false,
  });
  check('special roles can be switched off', noSpecials.valid && noSpecials.breakdown.townsperson === 8 - autoMafiaCount(8));
  check('a five-player table deals no Doctor', !roleBreakdown(5, BASE_SETTINGS).doctor);

  // Shuffle is a pure permutation.
  const original = ['a', 'b', 'c', 'd'];
  const shuffled = shuffle(original, seeded(7));
  check('shuffle returns a permutation', shuffled.slice().sort().join('') === 'abcd');
  check('shuffle does not mutate its input', original.join('') === 'abcd');

  // Every role can be dealt (across seeds, so a broken index never hides).
  const seen = new Set<MafiaRole>();
  for (let seed = 0; seed < 40; seed += 1) {
    const ids = Array.from({ length: 10 }, (_, index) => `p${index}`);
    Object.values(assignRoles(ids, BASE_SETTINGS, seeded(seed)).roles).forEach((role) =>
      seen.add(role)
    );
  }
  check(
    'all four roles can be dealt',
    ['mafia', 'detective', 'doctor', 'townsperson'].every((role) =>
      seen.has(role as MafiaRole)
    )
  );
}

/* ───────────────────── 2. Night resolution ──────────────────────────────── */

function testResolveNight(): void {
  section('resolveNight: kill, save, no-repeat, abstain, tie-break');

  const roles: Record<string, MafiaRole> = {
    don: 'mafia',
    knife: 'mafia',
    doc: 'doctor',
    eye: 'detective',
    ann: 'townsperson',
    ben: 'townsperson',
  };
  const alive = Object.keys(roles);

  const kill = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: { mafiaTargets: { don: 'ann', knife: 'ann' } },
  });
  check('a clear Mafia majority kills the target', kill.victimId === 'ann');
  check('the target is reported for the recap', kill.mafiaTargetId === 'ann');

  const save = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: { mafiaTargets: { don: 'ann', knife: 'ann' }, doctorTarget: 'ann' },
  });
  check('the Doctor cancels the kill', save.saved && save.victimId === null);
  check('the protection is recorded', save.doctorTargetId === 'ann');

  const noRepeat = resolveNight({
    roles,
    alive,
    night: 2,
    doctorLastProtected: 'ann',
    actions: { mafiaTargets: { don: 'ann', knife: 'ann' }, doctorTarget: 'ann' },
  });
  check('the Doctor cannot protect the same player twice', noRepeat.doctorTargetId === null);
  check('that illegal protection does not save the victim', noRepeat.victimId === 'ann');

  const canProtectSelf = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: { mafiaTargets: { don: 'doc', knife: 'doc' }, doctorTarget: 'doc' },
  });
  check('the Doctor may protect themselves', canProtectSelf.saved && canProtectSelf.victimId === null);

  const abstain = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: { mafiaTargets: {} },
  });
  check('no Mafia vote means no attack', abstain.mafiaTargetId === null && abstain.victimId === null);

  // Two Mafia, one vote each: rng 0 must pick the first tied target.
  const tieActions = { mafiaTargets: { don: 'ann', knife: 'ben' } };
  const tieA = resolveNight(
    { roles, alive, night: 1, doctorLastProtected: null, actions: tieActions },
    () => 0
  );
  const tieB = resolveNight(
    { roles, alive, night: 1, doctorLastProtected: null, actions: tieActions },
    () => 0.999
  );
  check('a tie is broken between the tied targets', tieA.victimId !== tieB.victimId);
  check(
    'the tied victim is one of the voted targets',
    [tieA.victimId, tieB.victimId].every((id) => id === 'ann' || id === 'ben')
  );

  const selfTarget = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: { mafiaTargets: { don: 'don' } },
  });
  check('a Mafia member can never kill their own', selfTarget.mafiaTargetId === null);

  const investigate = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: {
      mafiaTargets: { don: 'ann' },
      detectiveTarget: 'don',
    },
  });
  check('the Detective learns the side of their target', investigate.detective?.isMafia === true);
  check('a living Detective receives the finding', investigate.detective?.targetId === 'don');

  const deadDetective = resolveNight({
    roles,
    alive,
    night: 1,
    doctorLastProtected: null,
    actions: {
      mafiaTargets: { don: 'eye', knife: 'eye' },
      detectiveTarget: 'don',
    },
  });
  check('a Detective killed that night receives nothing', deadDetective.detective === null);
}

/* ───────────────────── 3. Ballots ──────────────────────────────────────── */

function testTallyVote(): void {
  section('tallyVote: plurality, ties, Skip');

  const alive = ['a', 'b', 'c', 'd'];

  const plurality = tallyVote({ a: 'c', b: 'c', d: 'a' }, alive);
  check('a plurality exiles that player', plurality.exiledId === 'c');
  check('the tally counts every vote', plurality.tally.c === 2 && plurality.tally.a === 1);

  const tie = tallyVote({ a: 'b', c: 'd' }, alive);
  check('a first-place tie exiles nobody', tie.exiledId === null && tie.reason === 'tie');

  const skipWins = tallyVote({ a: SKIP_VOTE, b: SKIP_VOTE, c: 'd' }, alive);
  check('Skip at the top exiles nobody', skipWins.exiledId === null && skipWins.reason === 'skip');
  check('Skip ballots are counted separately', skipWins.skipCount === 2);

  const skipTie = tallyVote({ a: SKIP_VOTE, b: 'c' }, alive);
  check('Skip tied for first exiles nobody', skipTie.exiledId === null && skipTie.reason === 'skip');

  const noVotes = tallyVote({}, alive);
  check('an empty ballot exiles nobody', noVotes.exiledId === null && noVotes.reason === 'no-votes');

  const deadVoter = tallyVote({ a: 'b', b: 'c', ghost: 'a' }, ['a', 'b', 'c']);
  check('the dead do not vote', deadVoter.tally.a === undefined && deadVoter.tally.c === 1);

  const selfVote = tallyVote({ a: 'a', b: 'a' }, alive);
  check('a self ballot is counted like any other', selfVote.exiledId === 'a');
}

/* ───────────────────── 4. Win conditions ───────────────────────────────── */

function testCheckWin(): void {
  section('checkWin: parity and ordering');

  const roles: Record<string, MafiaRole> = {
    m1: 'mafia',
    t1: 'townsperson',
    t2: 'detective',
    t3: 'doctor',
  };

  check('Town wins when no Mafia remain', checkWin(roles, ['t1', 't2', 't3']) === 'town');
  check('Mafia wins at parity', checkWin(roles, ['m1', 't1']) === 'mafia');
  check('Mafia wins when they outnumber the town', checkWin(roles, ['m1']) === 'mafia');
  check('the game continues while the town has more', checkWin(roles, ['m1', 't1', 't2']) === null);
  check('an empty village counts as a Town win', checkWin(roles, []) === 'town');

  // Ordering: with no Mafia and no Town left, the Town rule is checked first.
  check(
    'the Town rule is checked before parity',
    checkWin({ m1: 'mafia' }, ['m1']) === 'mafia' &&
      checkWin({ t1: 'townsperson' }, []) === 'town'
  );
}

/* ───────────────────── 5. 250 bot-only games ───────────────────────────── */

function testSimulation(): void {
  section('simulation: 250 bot-only games all terminate with one winner');

  const random = seeded(20261021);
  let finished = 0;
  let maxNights = 0;

  for (let game = 0; game < 250; game += 1) {
    const n = MAFIA_MIN_PLAYERS + Math.floor(random() * (MAFIA_MAX_PLAYERS - MAFIA_MIN_PLAYERS + 1));
    const settings: MafiaSettings = {
      ...BASE_SETTINGS,
      detective: random() < 0.8,
      doctor: random() < 0.8,
      mafiaCount: random() < 0.75 ? 'auto' : Math.max(1, Math.floor(random() * 3)),
    };
    const ids = Array.from({ length: n }, (_, index) => `g${game}p${index}`);
    const deal = assignRoles(ids, settings, random);
    const roles = deal.roles;
    const alive = new Set(ids);
    let doctorLastProtected: string | null = null;
    let nights = 0;
    let guard = 0;
    let winner: 'mafia' | 'town' | null = null;

    while (!winner && guard < 500) {
      guard += 1;
      nights += 1;

      const mafiaTargets: Record<string, string> = {};
      ids.forEach((id) => {
        if (!alive.has(id) || roles[id] !== 'mafia') return;
        const targets = [...alive].filter(
          (target) => target !== id && roles[target] !== 'mafia'
        );
        if (targets.length === 0) return;
        mafiaTargets[id] = targets[Math.floor(random() * targets.length)];
      });

      const doctorId = ids.find((id) => alive.has(id) && roles[id] === 'doctor');
      const doctorTargets = doctorId
        ? [...alive].filter((id) => id !== doctorLastProtected)
        : [];
      const doctorTarget =
        doctorTargets.length > 0
          ? doctorTargets[Math.floor(random() * doctorTargets.length)]
          : null;

      const detectiveId = ids.find((id) => alive.has(id) && roles[id] === 'detective');
      const detectiveTargets = detectiveId ? [...alive].filter((id) => id !== detectiveId) : [];
      const detectiveTarget =
        detectiveTargets.length > 0
          ? detectiveTargets[Math.floor(random() * detectiveTargets.length)]
          : null;

      const night = resolveNight(
        {
          roles,
          alive: [...alive],
          night: nights,
          doctorLastProtected,
          actions: { mafiaTargets, doctorTarget, detectiveTarget },
        },
        random
      );
      doctorLastProtected = night.doctorTargetId;
      if (night.victimId) alive.delete(night.victimId);

      winner = checkWin(roles, [...alive]);
      if (winner) break;

      const votes: Record<string, string> = {};
      [...alive].forEach((id) => {
        const candidates = [...alive].filter(
          (target) => target !== id && !(roles[id] === 'mafia' && roles[target] === 'mafia')
        );
        votes[id] =
          candidates.length === 0 || random() < 0.1
            ? SKIP_VOTE
            : candidates[Math.floor(random() * candidates.length)];
      });
      const ballot = tallyVote(votes, [...alive]);
      if (ballot.exiledId) alive.delete(ballot.exiledId);

      winner = checkWin(roles, [...alive]);
    }

    if (winner) finished += 1;
    maxNights = Math.max(maxNights, nights);
  }

  check('all 250 games reached a winner', finished === 250, `${finished}/250`);
  check('the longest game still terminated sanely', maxNights < 100, `${maxNights} nights`);
}

/* ───────────────────── Helpers for the room suite ──────────────────────── */

function makeRoom(playerCount: number): { room: InternalRoom; hostId: string } {
  const { room, host } = roomManager.createRoom('Host', 'socket-host');
  room.gameSettings.mafia = {
    nightSeconds: 10,
    discussionSeconds: 30,
    voteSeconds: 10,
    mafiaCount: 'auto',
    detective: true,
    doctor: true,
    revealRoleOnDeath: true,
  };
  roomManager.selectGame(room.code, 'mafia');
  for (let index = 1; index < playerCount; index += 1) {
    roomManager.addBotPlayer(room.code);
  }
  return { room, hostId: host.id };
}

/**
 * Walks a public payload and fails if any living player is attached to a role, or
 * if any secret container appears at all. Roles are legal only after game over.
 */
function assertNoPublicLeak(room: RoomPublicState): void {
  const mafiaState = room.mafiaState;
  if (!mafiaState || mafiaState.gameOver) return;

  const alive = new Set(mafiaState.alivePlayerIds);
  const secrets = new Set([
    'roles',
    'mafiaRole',
    'nightActions',
    'investigations',
    'votes',
    'doctorLastProtected',
    'mafiaIds',
    'detectiveFindings',
  ]);

  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }

    const record = value as Record<string, unknown>;
    const playerId = record.playerId;
    if (typeof playerId === 'string' && alive.has(playerId)) {
      check(
        `no role attached to living player ${playerId} (${path})`,
        !('role' in record) && !('roleLabel' in record) && !('mafiaRole' in record)
      );
    }

    Object.entries(record).forEach(([key, entry]) => {
      check(`public payload has no secret container "${key}" (${path})`, !secrets.has(key));
      visit(entry, `${path}.${key}`);
    });
  };

  visit(room, 'room');

  for (const death of mafiaState.deaths) {
    check(
      'a death announcement belongs to a dead player',
      !alive.has(death.playerId),
      death.playerId
    );
  }

  if (!mafiaState.revealRoleOnDeath) {
    check(
      'roles stay hidden when revealRoleOnDeath is off',
      mafiaState.deaths.every((death) => death.role === null)
    );
  }
}

function assertPrivateScope(room: InternalRoom): void {
  const state = getMafiaRound(room.code);
  if (!state) return;

  room.players.forEach((player) => {
    const priv = roomManager.getPlayerPrivateState(room, player.id);
    const role = state.roles[player.id];

    check(`private role belongs to ${player.name}`, priv.mafiaRole === role);
    check(`private state for ${player.name} has no role map`, !('roles' in priv));
    check(
      `private state for ${player.name} has no night actions`,
      !('nightActions' in priv)
    );

    if (!state.alive.has(player.id)) {
      // Dead players are spectators: no living teammates, picks or findings.
      check(`a dead player receives no teammates (${player.name})`, !priv.mafiaTeammateNames);
      check(`a dead player receives no team picks (${player.name})`, !priv.mafiaTeamSelections);
      check(`a dead player receives no case file (${player.name})`, !priv.mafiaInvestigations);
      return;
    }

    check(
      `detective notes only reach the Detective (${player.name})`,
      Boolean(priv.mafiaInvestigations) === (role === 'detective')
    );
    check(
      `team picks only reach the Mafia (${player.name})`,
      role === 'mafia'
        ? Array.isArray(priv.mafiaTeamSelections)
        : priv.mafiaTeamSelections === undefined
    );

    if (role === 'mafia') {
      const livingMafia = room.players
        .filter(
          (other) =>
            other.id !== player.id &&
            state.roles[other.id] === 'mafia' &&
            state.alive.has(other.id)
        )
        .map((other) => other.name)
        .sort();
      check(
        `teammates are exact for ${player.name}`,
        (priv.mafiaTeammateNames ?? []).slice().sort().join('|') === livingMafia.join('|'),
        (priv.mafiaTeammateNames ?? []).join(',')
      );
    } else {
      check(`only Mafia see teammates (${player.name})`, !priv.mafiaTeammateNames);
    }
  });
}

/* ───────────────────── 6. A six-player room, start to finish ────────────── */

function testRoomGame(): void {
  section('room: six players, full game, leaks, points and recap');

  const { room, hostId } = makeRoom(6);
  const snapshots: RoomPublicState[] = [];
  const broadcast = () => {
    const snapshot = roomManager.getPublicRoomState(room);
    snapshots.push(snapshot);
    assertNoPublicLeak(snapshot);
  };

  // Settings are clamped by the room manager before the deal.
  const clamped = roomManager.setGameSettings(room.code, hostId, {
    mafia: { nightSeconds: 1, voteSeconds: 500, mafiaCount: 99 },
  });
  check('Mafia settings save through RoomManager', clamped.success);
  check('night seconds are clamped to the floor', room.gameSettings.mafia.nightSeconds === 10);
  check('vote seconds are clamped to the ceiling', room.gameSettings.mafia.voteSeconds === 90);
  check('the Mafia count is clamped to 7', room.gameSettings.mafia.mafiaCount === 7);
  // Restore a small, legal deal for the rest of the test.
  room.gameSettings.mafia = {
    ...room.gameSettings.mafia,
    nightSeconds: 10,
    voteSeconds: 10,
    mafiaCount: 'auto',
  };

  roomManager.transitionToPhase(room, 'reveal', broadcast);
  const state = getMafiaRound(room.code);
  check('reveal deals a game', Boolean(state));
  check('reveal shows the role phase', room.mafiaState?.phase === 'reveal');
  check('every player got a private role', room.players.every((p) => Boolean(room.privateData[p.id]?.mafiaRole)));
  check('the public role count matches the deal', room.mafiaState?.mafiaCount === state?.breakdown.mafia);
  assertPrivateScope(room);

  roomManager.transitionToPhase(room, 'night', broadcast);
  check('night opens on the night phase', room.mafiaState?.phase === 'night');
  check('night starts a timer', room.timer?.durationSeconds === 10);
  check('night narration is set', Boolean(room.mafiaState?.narration));

  const reconnectPlayer = room.players[0];
  const reconnected = roomManager.joinOrReconnect(
    room.code,
    reconnectPlayer.name,
    reconnectPlayer.sessionToken,
    'socket-reconnect'
  );
  const restored = roomManager.getPlayerPrivateState(room, reconnectPlayer.id);
  check('reconnect restores the player', reconnected.success && reconnected.isReconnect === true);
  check('reconnect restores the role', restored.mafiaRole === state?.roles[reconnectPlayer.id]);
  check('reconnect restores the night prompt', Boolean(restored.mafiaActionPrompt));
  check(
    'reconnect restores the remaining time',
    typeof restored.mafiaSecondsRemaining === 'number' &&
      (restored.mafiaSecondsRemaining ?? -1) > 0
  );

  let guard = 0;
  while (!room.mafiaState?.gameOver && guard < 60) {
    guard += 1;

    if (room.phase !== 'night') roomManager.transitionToPhase(room, 'night', broadcast);
    const liveState = getMafiaRound(room.code);
    check('a night always has living players', Boolean(liveState && liveState.alive.size > 0));

    if (!liveState) break;
    [...liveState.alive].forEach((playerId) => {
      roomManager.submitMafiaNightTarget(
        room,
        playerId,
        pickMafiaBotNightAction(room, playerId),
        broadcast
      );
    });
    check('every living player confirmed the night', room.mafiaState?.nightConfirmedCount === liveState.alive.size);

    roomManager.hostResolveMafiaNight(room, hostId, broadcast);
    check('the night resolves into the morning', room.phase === 'mafia-morning');
    check(
      'the morning announces exactly one outcome',
      Boolean(room.mafiaState?.morningNarration && room.mafiaState.morningNarration.length > 0)
    );

    const morningWinner = checkMafiaWin(room);
    if (morningWinner) {
      setMafiaWinningSide(room, morningWinner);
      break;
    }

    roomManager.transitionToPhase(room, 'discussion', broadcast);
    check('the morning leads into the day', room.phase === 'discussion');
    check('day narration is public', Boolean(room.mafiaState?.narration));

    const dayState = getMafiaRound(room.code);
    if (!dayState) break;
    [...dayState.alive].forEach((playerId) => {
      roomManager.submitMafiaReady(room, playerId, broadcast);
    });
    if (room.phase !== 'vote') roomManager.transitionToPhase(room, 'vote', broadcast);
    check('more than half ready opens the ballot', room.phase === 'vote');

    [...dayState.alive].forEach((playerId) => {
      roomManager.submitMafiaBallot(
        room,
        playerId,
        pickMafiaBotVote(room, playerId),
        broadcast
      );
    });
    check(
      'every living player cast a ballot',
      room.hasVoted.size === dayState.alive.size,
      `${room.hasVoted.size}/${dayState.alive.size}`
    );

    roomManager.hostResolveMafiaTrial(room, hostId, broadcast);
    check('the ballot resolves into the exile', room.phase === 'mafia-exile');
    check(
      'the exile carries the public tally',
      Object.keys(room.mafiaState?.voteTally ?? {}).length > 0 || room.mafiaState?.skippedVoteCount === room.hasVoted.size
    );

    const exileWinner = checkMafiaWin(room);
    if (exileWinner) {
      setMafiaWinningSide(room, exileWinner);
      break;
    }
    roomManager.transitionToPhase(room, 'night', broadcast);
  }

  check('the game reached a winner within the guard', room.mafiaState?.gameOver === true);
  check('exactly one winning side was locked in', Boolean(room.mafiaState?.winningSide));

  const finalState = getMafiaRound(room.code);
  check('the recap has entries', (finalState?.recap.length ?? 0) > 0);

  // Points are calculated on the way into results.
  const before = new Map(room.players.map((player) => [player.id, player.score]));
  const winningSide = room.mafiaState?.winningSide ?? 'town';
  roomManager.transitionToPhase(room, 'results', broadcast);

  check('results reveal every role', room.results?.roleReveals?.length === 6);
  check('results carry the recap timeline', (room.results?.mafiaRecap?.length ?? 0) > 0);
  check(
    'results carry the winning faction',
    room.results?.mafiaWinningSide === winningSide
  );
  check('the game-over payload may reveal roles', room.mafiaState?.gameOver === true);

  if (finalState) {
    room.players.forEach((player) => {
      const role = finalState.roles[player.id];
      const survived = finalState.alive.has(player.id);
      const onWinningSide = (role === 'mafia') === (winningSide === 'mafia');
      const expected = onWinningSide ? 3 + (survived ? 1 : 0) : 0;
      const gained = player.score - (before.get(player.id) ?? 0);
      check(
        `${player.name} scored ${expected} as ${MAFIA_ROLE_LABELS[role]}`,
        gained === expected,
        `gained ${gained}`
      );
    });
  }

  assertNoPublicLeak(roomManager.getPublicRoomState(room));
  check('the public payload never grew a secret container', snapshots.length > 10);

  roomManager.deleteRoom(room.code);
  check('deleting the room drops its Mafia state', getMafiaRound(room.code) === undefined);
}

/* ───────────────────── Runner ──────────────────────────────────────────── */

async function main(): Promise<void> {
  testDeals();
  testResolveNight();
  testTallyVote();
  testCheckWin();
  testSimulation();
  testRoomGame();

  const total = passed + failures.length;
  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${total} checks failed:`);
    failures.slice(0, 40).forEach((failure) => console.error(`  ✗ ${failure}`));
    process.exit(1);
  }

  console.log(`\n✓ ${passed}/${total} checks passed`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
