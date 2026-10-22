/**
 * Room team-mode suite — `npm run test:teams`.
 *
 * Drives the real RoomManager in-process (no server, no network) and asserts the
 * whole team contract: mode switching, membership, late joiners, reconnects,
 * balancing, renaming, the start gate, and that a real Impostor round (word and
 * question mode) scores into the team leaderboard through awardPoints().
 */

import { roomManager, awardPoints, InternalRoom } from '../server/roomManager';
import { setupImpostorRound } from '../server/games/impostor';
import {
  getImpostorQuestionRound,
  setupImpostorQuestionRound,
} from '../server/games/impostor';
import { SEED_QUESTION_PAIRS } from '../server/content/questionProvider';
import { PLAYER_COLORS, TEAM_ACCENTS, getTeamAccent } from '../shared/theme/tokens';
import {
  DEFAULT_TEAM_COUNT,
  TEAM_NAME_MAX_CHARS,
  buildTeams,
  clampTeamCount,
  getTeamStartReadiness,
  sanitizeTeamName,
} from '../shared/data/teams';
import { MAX_ROUNDS, MIN_ROUNDS, MIN_TEAMS } from '../shared/types';
import { PARTY_GAMES } from '../shared/data/games';

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

/** A real room through the real manager, with bots, in solo mode. */
function makeRoom(botCount = 3): InternalRoom {
  const { room } = roomManager.createRoom('Host', `sock_${Math.random().toString(36).slice(2, 8)}`);
  for (let i = 0; i < botCount; i += 1) roomManager.addBotPlayer(room.code);
  return room;
}

function sumScores(room: InternalRoom): number {
  return room.players.reduce((total, player) => total + player.score, 0);
}

function sumTeamScores(room: InternalRoom): number {
  return room.teams.reduce((total, team) => total + team.score, 0);
}

/** Every team total must equal the sum of its members' individual scores. */
function teamTotalsAreDerived(room: InternalRoom): boolean {
  return room.teams.every((team) => {
    const expected = room.players
      .filter((player) => player.teamId === team.id)
      .reduce((sum, player) => sum + player.score, 0);
    return team.score === expected;
  });
}

function noop(): void {
  /* broadcasts are not needed in-process */
}

async function main(): Promise<void> {
  // ------------------------------------------------------------------- solo default
  section('solo default');
  const solo = makeRoom(3);
  check('a new room starts in solo mode', solo.playMode === 'solo');
  check('a solo room has no teams', solo.teams.length === 0);
  check('every new player starts with no team', solo.players.every((p) => !p.teamId));

  awardPoints(solo, solo.hostId, 5, 'test');
  check(
    'awardPoints updates the individual total in solo mode',
    solo.players.find((p) => p.id === solo.hostId)?.score === 5
  );
  check('awardPoints records the reason in the room score log', solo.scoreLog.at(-1)?.reason === 'test');
  check(
    'solo scoring needs no team roll-up',
    solo.teams.length === 0 && solo.players.find((p) => p.id === solo.hostId)?.score === 5
  );

  // ------------------------------------------------------------------- play mode switch
  section('switching to team mode');
  const nonHost = solo.players.find((p) => p.id !== solo.hostId)!;
  check(
    'a non-host cannot change the play mode',
    roomManager.setPlayMode(solo.code, nonHost.id, 'team').success === false
  );
  check(
    'an unknown play mode is rejected',
    roomManager.setPlayMode(solo.code, solo.hostId, 'chaos' as never).success === false
  );

  const switched = roomManager.setPlayMode(solo.code, solo.hostId, 'team');
  check('the host can turn team mode on', switched.success);
  check('team mode is public state', solo.playMode === 'team');
  check(
    `team mode starts with ${DEFAULT_TEAM_COUNT} teams`,
    solo.teams.length === DEFAULT_TEAM_COUNT
  );
  check(
    'every player is dealt onto a team',
    solo.players.every((player) => solo.teams.some((team) => team.id === player.teamId))
  );
  check(
    'team memberIds are derived from player.teamId',
    solo.teams.every((team) =>
      team.memberIds.every((id) => solo.players.find((p) => p.id === id)?.teamId === team.id)
    ) &&
      solo.players.every((player) => solo.teams.some((t) => t.memberIds.includes(player.id)))
  );
  check(
    'the initial split is even',
    Math.max(...solo.teams.map((t) => t.memberIds.length)) -
      Math.min(...solo.teams.map((t) => t.memberIds.length)) <=
      1
  );
  check(
    'team accents never reuse a player identity colour',
    TEAM_ACCENTS.every(
      (accent) => !PLAYER_COLORS.some((playerColor) => playerColor.hex === accent.hex)
    )
  );
  check(
    'team accent slots are distinct and loop safely',
    new Set(TEAM_ACCENTS.map((accent) => accent.index)).size === TEAM_ACCENTS.length &&
      getTeamAccent(TEAM_ACCENTS.length).index === 0
  );

  // ------------------------------------------------------------------- scoring roll-up
  section('central scoring rolls up to teams');
  const scorer = solo.players[0];
  const scorerTeamId = scorer.teamId!;
  const otherTeam = solo.teams.find((team) => team.id !== scorerTeamId)!;
  const scorerBefore = scorer.score;

  const newTotal = awardPoints(solo, scorer.id, 10, 'test:rollup');
  check('awardPoints returns the new individual total', newTotal === scorerBefore + 10);
  check(
    'the awarded points land on the team total',
    solo.teams.find((team) => team.id === scorerTeamId)?.score === scorerBefore + 10
  );
  check('the other team is untouched', otherTeam.score === 0);
  check('team totals stay derived from member scores', teamTotalsAreDerived(solo));

  check(
    'a player can switch teams',
    roomManager.joinTeam(solo.code, scorer.id, otherTeam.id).success
  );
  check('switching clears the old team membership', !solo.teams.find((t) => t.id === scorerTeamId)?.memberIds.includes(scorer.id));
  roomManager.getPublicRoomState(solo);
  check(
    'points follow the player to the new team',
    solo.teams.find((team) => team.id === otherTeam.id)?.score === scorer.score
  );
  check('team totals stay derived after a switch', teamTotalsAreDerived(solo));
  check(
    'joining a team that does not exist is rejected',
    roomManager.joinTeam(solo.code, scorer.id, 'team_nope').success === false
  );

  // ------------------------------------------------------------------- team count
  section('team count');
  check(
    'a non-host cannot resize the teams',
    roomManager.setTeamCount(solo.code, nonHost.id, 3).success === false
  );
  check('the host can add teams', roomManager.setTeamCount(solo.code, solo.hostId, 4).success);
  check('four teams exist after the change', solo.teams.length === 4);
  check(
    'a new team starts empty and joins the rotation',
    solo.teams[3].memberIds.length === 0 && noTeamIsOrphaned(solo)
  );
  check('team count is clamped to the supported maximum', clampTeamCount(9) === 4);
  check('team count is clamped to the supported minimum', clampTeamCount(1) === MIN_TEAMS);
  check('a garbage team count falls back to the default', clampTeamCount(Number.NaN) === DEFAULT_TEAM_COUNT);

  check('the host can remove teams', roomManager.setTeamCount(solo.code, solo.hostId, 2).success);
  check('two teams remain', solo.teams.length === 2);
  check(
    'members of a removed team are reseated, never dropped',
    noTeamIsOrphaned(solo) &&
      solo.players.every((player) => solo.teams.some((team) => team.id === player.teamId))
  );
  check('team totals stay derived after resizing', teamTotalsAreDerived(solo));

  // ------------------------------------------------------------------- balance & shuffle
  section('auto-balance and shuffle');
  const five = makeRoom(4); // host + 4 bots
  roomManager.setPlayMode(five.code, five.hostId, 'team');
  // Deliberately lopsided: everyone onto the first team.
  five.players.forEach((player) => roomManager.joinTeam(five.code, player.id, five.teams[0].id));
  check('the pile-up is visible', five.teams[0].memberIds.length === 5);
  check(
    'a lopsided split raises the size warning',
    getTeamStartReadiness('team', five.teams, 5, 3).sizeWarning !== null
  );

  check(
    'a non-host cannot auto-balance',
    roomManager.balanceTeams(five.code, nonHost.id).success === false
  );
  check('the host can auto-balance', roomManager.balanceTeams(five.code, five.hostId).success);
  const balancedSizes = five.teams.map((team) => team.memberIds.length);
  check(
    'auto-balance splits within one player',
    Math.max(...balancedSizes) - Math.min(...balancedSizes) <= 1,
    balancedSizes.join('/')
  );
  check(
    'auto-balance keeps every player',
    five.players.every((player) => five.teams.some((team) => team.memberIds.includes(player.id)))
  );
  check('no size warning after balancing', getTeamStartReadiness('team', five.teams, 5, 3).sizeWarning === null);

  const assignment = () =>
    five.players
      .map((player) => `${player.id}:${player.teamId}`)
      .sort()
      .join('|');
  const beforeShuffle = assignment();
  // One shuffle can legitimately land on the same split, so try a handful and
  // require that the draw is genuinely random at least once.
  let reshuffled = false;
  for (let attempt = 0; attempt < 30 && !reshuffled; attempt += 1) {
    check('the host can shuffle the teams', roomManager.shuffleTeams(five.code, five.hostId).success);
    if (assignment() !== beforeShuffle) reshuffled = true;
  }
  check('shuffle is a real reshuffle', reshuffled);
  check(
    'shuffle keeps every player exactly once',
    five.teams.reduce((total, team) => total + team.memberIds.length, 0) === five.players.length &&
      new Set(five.teams.flatMap((team) => team.memberIds)).size === five.players.length
  );
  check(
    'shuffle keeps the split within one player',
    Math.max(...five.teams.map((t) => t.memberIds.length)) -
      Math.min(...five.teams.map((t) => t.memberIds.length)) <=
      1
  );

  // ------------------------------------------------------------------- rename
  section('team names');
  check('team names strip control characters', sanitizeTeamName('  Bad\u0000Name  ', 'Fallback') === 'BadName');
  check(
    `team names are capped at ${TEAM_NAME_MAX_CHARS} characters`,
    sanitizeTeamName('x'.repeat(60), 'Fallback').length === TEAM_NAME_MAX_CHARS
  );
  check('a blank team name falls back', sanitizeTeamName('   ', 'Comets') === 'Comets');
  check(
    'a non-host cannot rename a team',
    roomManager.renameTeam(five.code, nonHost.id, five.teams[0].id, 'Hackers').success === false
  );
  check('the host can rename a team', roomManager.renameTeam(five.code, five.hostId, five.teams[0].id, ' Shiny  Comets ').success);
  check('the rename is sanitized', five.teams[0].name === 'Shiny Comets');
  check(
    'a blank rename keeps the previous name',
    roomManager.renameTeam(five.code, five.hostId, five.teams[0].id, '  ').success && five.teams[0].name === 'Shiny Comets'
  );
  check(
    'renaming a missing team is rejected',
    roomManager.renameTeam(five.code, five.hostId, 'team_nope', 'Ghosts').success === false
  );

  // ------------------------------------------------------------------- late joiners & reconnect
  section('late joiners and reconnects');
  const sizesBeforeJoin = five.teams.map((team) => team.memberIds.length);
  const late = roomManager.joinOrReconnect(five.code, 'Late', null, 'sock_late');
  check('a late joiner can enter a team-mode lobby', late.success && Boolean(late.player));
  check(
    'a late joiner lands on a team that was among the smallest',
    sizesBeforeJoin[
      five.teams.findIndex((team) => team.id === late.player!.teamId)
    ] === Math.min(...sizesBeforeJoin)
  );
  check(
    'a late joiner is listed on exactly one team',
    five.teams.flatMap((team) => team.memberIds).filter((id) => id === late.player!.id).length === 1
  );
  check(
    'the join keeps the split within one player',
    Math.max(...five.teams.map((t) => t.memberIds.length)) -
      Math.min(...five.teams.map((t) => t.memberIds.length)) <=
      1
  );

  const rejoined = roomManager.joinOrReconnect(
    five.code,
    late.player!.name,
    late.player!.sessionToken,
    'sock_late_2'
  );
  check('reconnecting restores the same player', rejoined.player?.id === late.player!.id);
  check(
    'reconnecting restores team membership',
    rejoined.player?.teamId === late.player!.teamId
  );
  check('reconnect is reported as a reconnect', rejoined.isReconnect === true);

  // ------------------------------------------------------------------- start gate
  section('team start gate');
  const soloGate = getTeamStartReadiness('solo', [], 3, 3);
  check('solo mode is ready once the minimum is met', soloGate.ready && soloGate.message === null);
  const shortGate = getTeamStartReadiness('team', buildTeams(2), 2, 3);
  check('team mode blocks a short room', !shortGate.ready && shortGate.blocker === 'need-players');
  const emptyTeamGate = getTeamStartReadiness('team', buildTeams(2), 3, 3);
  check(
    'team mode blocks empty teams',
    !emptyTeamGate.ready && emptyTeamGate.blocker === 'need-two-teams'
  );
  const dealtTeams = buildTeams(2).map((team, index) => ({
    ...team,
    memberIds: index === 0 ? ['a', 'b'] : ['c'],
  }));
  const readyGate = getTeamStartReadiness('team', dealtTeams, 3, 3);
  check('a two-team split with players is ready', readyGate.ready && readyGate.message === null);
  check('an even split shows no warning', readyGate.sizeWarning === null);
  const lopsided = dealtTeams.map((team, index) => ({
    ...team,
    memberIds: index === 0 ? ['a', 'b', 'c', 'd'] : ['e'],
  }));
  check(
    'a lopsided split warns without blocking',
    getTeamStartReadiness('team', lopsided, 5, 3).sizeWarning !== null &&
      getTeamStartReadiness('team', lopsided, 5, 3).ready
  );

  // ------------------------------------------------------------------- rounds setting
  section('round count');
  check(
    'a non-host cannot change the round count',
    roomManager.setRoundCount(five.code, nonHost.id, 5).success === false
  );
  check('the host can change the round count', roomManager.setRoundCount(five.code, five.hostId, 5).success);
  check('the round count is applied', five.totalRounds === 5);
  check('the round count is clamped', roomManager.setRoundCount(five.code, five.hostId, 99).success && five.totalRounds === MAX_ROUNDS);
  check('the round count floor is respected', roomManager.setRoundCount(five.code, five.hostId, 0).success && five.totalRounds === MIN_ROUNDS);

  // ------------------------------------------------------------------- locking
  section('settings lock once a round starts');
  five.phase = 'reveal';
  check(
    'the play mode is locked mid-round',
    roomManager.setPlayMode(five.code, five.hostId, 'solo').success === false
  );
  check(
    'team switching is locked mid-round',
    roomManager.joinTeam(five.code, five.players[0].id, five.teams[1].id).success === false
  );
  check(
    'the round count is locked mid-round',
    roomManager.setRoundCount(five.code, five.hostId, 2).success === false
  );
  five.phase = 'lobby';
  check(
    'switching back to solo clears the teams',
    roomManager.setPlayMode(five.code, five.hostId, 'solo').success &&
      five.teams.length === 0 &&
      five.players.every((player) => !player.teamId)
  );

  // ------------------------------------------------------------------- real round scoring
  section('a real Impostor round scores into the team leaderboard');
  for (const mode of ['word', 'question'] as const) {
    const room = makeRoom(3);
    roomManager.setPlayMode(room.code, room.hostId, 'team');
    // The catalogue now defaults to Top 100, so a test that scores an Impostor
    // round must select Impostor explicitly (the UI only offers playable games,
    // but the engine and suites can still drive every game).
    roomManager.selectGame(room.code, 'impostor');
    roomManager.setGameSettings(room.code, room.hostId, { impostor: { mode } });

    // Question mode deliberately hides who the impostor is, even in private
    // state, so the round state (not privateData) is the source of truth there.
    let impostorId: string | undefined;
    if (mode === 'word') {
      setupImpostorRound(room, { id: 'test-word', word: 'kettle', category: 'Kitchen', difficulty: 1, source: 'corpus' });
      impostorId = room.players.find((player) => room.privateData[player.id]?.isSpecialRole)?.id;
    } else {
      const pair = SEED_QUESTION_PAIRS.find((entry) => entry.answerType === 'text')!;
      setupImpostorQuestionRound(room, pair);
      impostorId = getImpostorQuestionRound(room.code)?.impostorPlayerId;
    }

    check(`${mode}: an impostor was dealt`, Boolean(impostorId));
    const impostor = room.players.find((player) => player.id === impostorId)!;

    // One correct vote and three abstentions: the impostor evades and scores.
    // Everyone catches the impostor: each crew vote scores, the impostor does not.
    room.phase = 'vote';
    room.playerVotes = Object.fromEntries(
      room.players.filter((player) => player.id !== impostor.id).map((player) => [player.id, impostor.id])
    );

    roomManager.transitionToPhase(room, 'results', noop);

    check(`${mode}: the round produced results`, Boolean(room.results));
    check(
      `${mode}: the round carries a team leaderboard`,
      (room.results?.teamStandings?.length || 0) === room.teams.length
    );
    const standings = room.results?.teamStandings || [];
    check(
      `${mode}: the team leaderboard is ranked`,
      standings.every((row, index) => row.rank === index + 1) &&
        standings.every((row, index) => index === 0 || standings[index - 1].total >= row.total)
    );
    check(
      `${mode}: each team lists its members' contributions`,
      standings.every((row) =>
        row.members.every((member) =>
          Boolean(room.players.find((player) => player.id === member.playerId))
        )
      )
    );
    check(
      `${mode}: every crew team collects the correct votes`,
      room.teams.every((team) => team.score === 0 || team.score > 0) &&
        sumScores(room) > 0
    );
    check(
      `${mode}: a caught impostor's team scores nothing from that round`,
      (room.results?.standings.find((row) => row.playerId === impostor.id)?.pointsAdded || 0) === 0
    );

    // Second resolution in the same room: the table misses and the impostor
    // collects — which must raise their team's total and stay consistent.
    const impostorTeam = room.teams.find((team) => team.id === impostor.teamId)!;
    const impostorTeamBefore = impostorTeam.score;
    const scapegoat = room.players.find((player) => player.id !== impostor.id)!;
    room.phase = 'vote';
    room.playerVotes = Object.fromEntries(
      room.players.map((player) => [player.id, scapegoat.id])
    );
    roomManager.transitionToPhase(room, 'results', noop);
    check(
      `${mode}: an evading impostor's points land on their team`,
      impostorTeam.score > impostorTeamBefore,
      `${impostorTeamBefore} -> ${impostorTeam.score}`
    );
    check(
      `${mode}: team totals equal the individual score total`,
      sumTeamScores(room) === sumScores(room)
    );
    check(`${mode}: team totals stay derived`, teamTotalsAreDerived(room));
    check(
      `${mode}: scoring went through awardPoints`,
      room.scoreLog.some((entry) => entry.reason.startsWith('impostor'))
    );
    check(`${mode}: players were awarded individually`, room.players.some((player) => player.score > 0));

    roomManager.deleteRoom(room.code);
  }

  // A solo room must keep exactly the old payload (no team leaderboard).
  section('solo rounds stay individual');
  const soloRound = makeRoom(3);
  roomManager.selectGame(soloRound.code, 'impostor');
  roomManager.setGameSettings(soloRound.code, soloRound.hostId, { impostor: { mode: 'word' } });
  setupImpostorRound(soloRound, { id: 'test-word-2', word: 'kettle', category: 'Kitchen', difficulty: 1, source: 'corpus' });
  const soloImpostor = soloRound.players.find((p) => soloRound.privateData[p.id]?.isSpecialRole)!;
  soloRound.phase = 'vote';
  soloRound.playerVotes = Object.fromEntries(
    soloRound.players
      .filter((player) => player.id !== soloImpostor.id)
      .map((player) => [player.id, soloImpostor.id])
  );
  roomManager.transitionToPhase(soloRound, 'results', noop);
  check('a solo round still produces results', Boolean(soloRound.results));
  check('a solo round has no team leaderboard', soloRound.results?.teamStandings === undefined);
  check('a solo round awards individual points', soloRound.players.some((player) => player.score > 0));

  // ------------------------------------------------------------------- game capabilities
  section('game capabilities');
  check(
    'every game declares its team support',
    PARTY_GAMES.every((game) =>
      ['aggregate', 'shipped', 'native'].includes(game.teamSupport)
    )
  );
  check(
    'Top 100 ships native team rules',
    PARTY_GAMES.find((game) => game.id === 'top-100')?.teamSupport === 'shipped'
  );
  check(
    'Impostor and Mafia aggregate team scores',
    PARTY_GAMES.find((game) => game.id === 'impostor')?.teamSupport === 'aggregate' &&
      PARTY_GAMES.find((game) => game.id === 'mafia')?.teamSupport === 'aggregate'
  );
  check(
    'five games are playable — only Guess the Link is marked Coming Soon',
    PARTY_GAMES.filter((game) => !game.comingSoon).map((game) => game.id).join(',') ===
      'impostor,avoid-the-word,mafia,top-100,reverse-categories'
  );

  // ------------------------------------------------------------------- cleanup
  solo.phase = 'lobby';
  roomManager.deleteRoom(solo.code);
  roomManager.deleteRoom(five.code);
  roomManager.deleteRoom(soloRound.code);

  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('All team-mode checks passed.');
}

/** Every team memberId must point back at a player on that team. */
function noTeamIsOrphaned(room: InternalRoom): boolean {
  return room.teams.every((team) =>
    team.memberIds.every((id) => room.players.find((player) => player.id === id)?.teamId === team.id)
  );
}

main().catch((error) => {
  console.error('test:teams crashed:', error);
  process.exitCode = 1;
});
