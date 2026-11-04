import { RoomManager } from '../server/roomManager';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

console.log('== testing RoomManager two scoreboards & player removal ==');

const rm = new RoomManager();
const { room, host } = rm.createRoom('HostPlayer', 'socket_host');

assert(host.score === 0, 'host score starts at 0');
assert(host.gameScore === 0, 'host gameScore starts at 0');
assert(host.roomScore === 0, 'host roomScore starts at 0');

// Add 2 bots
const b1 = rm.addBotPlayer(room.code);
const b2 = rm.addBotPlayer(room.code);
assert(b1.success && Boolean(b1.bot), 'bot 1 added');
assert(b2.success && Boolean(b2.bot), 'bot 2 added');
assert(room.players.length === 3, 'room has 3 players');

const p1 = b1.bot!;
const p2 = b2.bot!;
assert(p1.gameScore === 0 && p1.roomScore === 0, 'p1 scores start at 0');
assert(p2.gameScore === 0 && p2.roomScore === 0, 'p2 scores start at 0');

// Test Player Removal permissions
console.log('== player removal tests ==');
// 1. Non-host cannot remove player
const nonHostKick = rm.removePlayer(room.code, p1.id, p2.id);
assert(!nonHostKick.success, 'non-host should not be able to remove players');
assert(room.players.length === 3, 'player count remains 3');

// 2. Host cannot remove themselves
const hostSelfKick = rm.removePlayer(room.code, host.id, host.id);
assert(!hostSelfKick.success, 'host should not be able to remove themselves');
assert(room.players.length === 3, 'player count remains 3');

// 3. Host removes p2
const hostKickP2 = rm.removePlayer(room.code, host.id, p2.id);
assert(hostKickP2.success, 'host should be able to remove p2');
assert(room.players.length === 2, 'player count is now 2');
assert(!room.players.some((p) => p.id === p2.id), 'p2 is no longer in room');

// Add a new player for game testing
const p3Join = rm.joinOrReconnect(room.code, 'Player3', null, 'socket_p3');
assert(p3Join.success && Boolean(p3Join.player), 'p3 joined');
const p3 = p3Join.player!;
assert(room.players.length === 3, 'room has 3 players again');

console.log('== scoring: gameScore vs roomScore ==');
// Simulate game results calculation
room.roundNumber = 1;
// Award game points: host gets 50, p1 gets 100, p3 gets 20
host.score = 50;
host.gameScore = 50;
p1.score = 100;
p1.gameScore = 100;
p3.score = 20;
p3.gameScore = 20;

room.results = {
  summary: 'Round 1 complete',
  standings: [
    { playerId: p1.id, playerName: p1.name, playerColor: p1.colorHex, colorIndex: p1.colorIndex, pointsAdded: 100, totalScore: 100 },
    { playerId: host.id, playerName: host.name, playerColor: host.colorHex, colorIndex: host.colorIndex, pointsAdded: 50, totalScore: 50 },
    { playerId: p3.id, playerName: p3.name, playerColor: p3.colorHex, colorIndex: p3.colorIndex, pointsAdded: 20, totalScore: 20 },
  ],
};

// Transition into 'results' phase
rm.transitionToPhase(room, 'results', () => {});

// The winner with highest score (p1 with 100 pts) should receive +1 Room Score
assert(p1.roomScore === 1, 'p1 (top score) should receive +1 roomScore');
assert(host.roomScore === 0, 'host should have 0 roomScore');
assert(p3.roomScore === 0, 'p3 should have 0 roomScore');
assert(room.results?.roomScoreWinners?.includes(p1.name) === true, 'p1 name in roomScoreWinners');

// Test that calling transitionToPhase again with results does not duplicate room score awards
rm.transitionToPhase(room, 'results', () => {});
assert(p1.roomScore === 1, 'p1 roomScore should not duplicate on same round');

// Play another round (Round 2) where host wins
room.roundNumber = 2;
host.score = 180;
host.gameScore = 180;
p1.score = 120;
p1.gameScore = 120;
p3.score = 40;
p3.gameScore = 40;

room.results = {
  summary: 'Round 2 complete',
  standings: [
    { playerId: host.id, playerName: host.name, playerColor: host.colorHex, colorIndex: host.colorIndex, pointsAdded: 130, totalScore: 180 },
    { playerId: p1.id, playerName: p1.name, playerColor: p1.colorHex, colorIndex: p1.colorIndex, pointsAdded: 20, totalScore: 120 },
    { playerId: p3.id, playerName: p3.name, playerColor: p3.colorHex, colorIndex: p3.colorIndex, pointsAdded: 20, totalScore: 40 },
  ],
};

rm.transitionToPhase(room, 'results', () => {});
assert(host.roomScore === 1, 'host should now have 1 roomScore');
assert(p1.roomScore === 1, 'p1 should retain 1 roomScore');

// Test resetting to lobby: gameScore resets to 0, roomScore persists
rm.transitionToPhase(room, 'lobby', () => {});
assert(host.gameScore === 0 && host.score === 0, 'host gameScore resets to 0 on lobby');
assert(p1.gameScore === 0 && p1.score === 0, 'p1 gameScore resets to 0 on lobby');
assert(host.roomScore === 1, 'host roomScore persists after game reset');
assert(p1.roomScore === 1, 'p1 roomScore persists after game reset');

// Check public room state
const pub = rm.getPublicRoomState(room);
const pubHost = pub.players.find((p) => p.id === host.id);
const pubP1 = pub.players.find((p) => p.id === p1.id);
assert(pubHost?.roomScore === 1 && pubHost?.gameScore === 0, 'public state matches host roomScore and gameScore');
assert(pubP1?.roomScore === 1 && pubP1?.gameScore === 0, 'public state matches p1 roomScore and gameScore');

console.log('All dual scoreboard and player removal checks passed!');
