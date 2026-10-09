/**
 * Temp socket-level harness: host-authored Guess the Link concept over the wire.
 * Verifies validation errors, host-only access, broadcast privacy (no concept
 * leak), and that the reveal deals the custom angles to two humans.
 */
import { io, Socket } from 'socket.io-client';

const URL = 'http://localhost:3200';
const CUSTOM = {
  concept: 'Snow globe',
  category: 'Imagination',
  hints: ['Glass dome', 'Shaken not stirred', 'Tiny storm', 'Desk ornament', 'Fake snow falling'],
};

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL: ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

const host: Socket = io(URL, { transports: ['websocket'] });
const bob: Socket = io(URL, { transports: ['websocket'] });

let roomCode = '';

function nextRoomUpdate(sock: Socket, predicate: (room: any) => boolean, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off('room:update', handler);
      reject(new Error('timed out waiting for room:update'));
    }, timeoutMs);
    const handler = (room: any) => {
      if (predicate(room)) {
        clearTimeout(timer);
        sock.off('room:update', handler);
        resolve(room);
      }
    };
    sock.on('room:update', handler);
  });
}

function nextPrivateState(sock: Socket, predicate: (s: any) => boolean, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off('player:private-state', handler);
      reject(new Error('timed out waiting for private-state'));
    }, timeoutMs);
    const handler = (state: any) => {
      if (predicate(state)) {
        clearTimeout(timer);
        sock.off('player:private-state', handler);
        resolve(state);
      }
    };
    sock.on('player:private-state', handler);
  });
}

const emitCb = (sock: Socket, event: string, payload: any): Promise<any> =>
  new Promise((resolve) => sock.emit(event, payload, resolve));

async function run() {
  const created = await emitCb(host, 'create-room', { hostName: 'Ada', colorIndex: 0 });
  check('room created', created?.success === true);
  roomCode = created.room.roomCode;

  const joined = await emitCb(bob, 'join-room', {
    roomCode,
    playerName: 'Bob',
    sessionToken: null,
    colorIndex: 1,
  });
  check('second human joined', joined?.success === true);

  await emitCb(host, 'add-bot', { roomCode });
  host.emit('select-game', { roomCode, gameId: 'guess-the-link' });
  host.emit('advance-phase', { roomCode, targetPhase: 'game-select' });
  await nextRoomUpdate(host, (r) => r.phase === 'game-select' && r.selectedGame?.id === 'guess-the-link');

  // Validation over the wire
  const tooFew = await emitCb(host, 'gtl-set-prompt', {
    roomCode, playerId: created.player.id, concept: 'Xylophone', hints: ['a', 'b'],
  });
  check('wire validation rejects 2 angles', tooFew?.success === false && /different hint angles/.test(tooFew.error), tooFew);

  // Non-host cannot save
  const bobTry = await emitCb(bob, 'gtl-set-prompt', {
    roomCode, playerId: joined.player.id, concept: CUSTOM.concept, hints: CUSTOM.hints,
  });
  check('non-host save rejected', bobTry?.success === false && /host/i.test(bobTry.error), bobTry);

  // Host saves; broadcast flips the ready flag without leaking the concept
  const broadcastPromise = nextRoomUpdate(host, (r) => r.gtlCustomReady === true);
  const saved = await emitCb(host, 'gtl-set-prompt', {
    roomCode, playerId: created.player.id, ...CUSTOM,
  });
  const readyRoom: any = await broadcastPromise;
  check('host save succeeds over wire', saved?.success === true && saved.prompt?.concept === CUSTOM.concept);
  check('ready flag broadcast to room', readyRoom.gtlCustomReady === true);
  check('concept never broadcast before reveal', !JSON.stringify(readyRoom).includes(CUSTOM.concept));

  // Launch the round
  const privatePromise = nextPrivateState(host, (s: any) => Boolean(s.gtlHint));
  host.emit('advance-phase', { roomCode, targetPhase: 'reveal' });
  const revealRoom: any = await nextRoomUpdate(host, (r) => r.phase === 'reveal');
  const hostPrivate: any = await privatePromise;

  check('reveal deals a custom angle', CUSTOM.hints.includes(hostPrivate.gtlHint), hostPrivate.gtlHint);
  check('category is the custom one', hostPrivate.gtlCategory === CUSTOM.category);
  check('ready flag consumed on launch', revealRoom.gtlCustomReady === false);
  check('gtlState.concept stays hidden', revealRoom.gtlState?.concept === null);
  check('no concept in reveal broadcast', !JSON.stringify(revealRoom).includes(CUSTOM.concept));

  // Bob receives his own different angle
  const bobPrivate: any = await nextPrivateState(bob, (s: any) => Boolean(s.gtlHint));
  check('bob got a different custom angle', CUSTOM.hints.includes(bobPrivate.gtlHint) && bobPrivate.gtlHint !== hostPrivate.gtlHint, bobPrivate.gtlHint);

  // Round 2 falls back to the shipped deck
  host.emit('advance-phase', { roomCode, targetPhase: 'next-round' });
  const round2: any = await nextRoomUpdate(host, (r) => r.roundNumber === 2 && r.phase === 'reveal');
  const deckHint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('deck hint timeout')), 8000);
    const handler = (s: any) => {
      if (s.gtlHint && !CUSTOM.hints.includes(s.gtlHint)) {
        clearTimeout(timer);
        host.off('player:private-state', handler);
        resolve(s.gtlHint);
      }
    };
    host.on('player:private-state', handler);
  });
  check('round 2 uses deck hint', typeof deckHint === 'string' && deckHint.length > 0 && !CUSTOM.hints.includes(deckHint), deckHint);
  check('round 2 broadcast still leaks nothing of custom', !JSON.stringify(round2).includes(CUSTOM.concept));

  // Blank payload clears a queued concept over the wire
  host.emit('advance-phase', { roomCode, targetPhase: 'game-select' });
  await nextRoomUpdate(host, (r) => r.phase === 'game-select');
  await emitCb(host, 'gtl-set-prompt', { roomCode, playerId: created.player.id, ...CUSTOM });
  const cleared = await emitCb(host, 'gtl-set-prompt', {
    roomCode, playerId: created.player.id, concept: '', hints: [],
  });
  check('blank payload clears over wire', cleared?.success === true && cleared.prompt === null);

  console.log(`\n${passed} passed, ${failed} failed`);
  host.close();
  bob.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('HARNESS ERROR:', err?.message || err);
  process.exit(1);
});
