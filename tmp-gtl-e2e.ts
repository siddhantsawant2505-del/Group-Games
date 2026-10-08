/* Temporary Guess the Link socket playthrough. Deleted after running. */
import { io, Socket } from 'socket.io-client';
import { GTL_PROMPTS } from './shared/data/guessTheLinkPrompts';
import { isCorrectGtlGuess } from './server/games/guessTheLink';

const URL = process.env.TEST_URL || 'http://localhost:3200';

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  [${extra}]` : ''}`);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'], forceNew: true });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function emitAck<T>(socket: Socket, event: string, payload: any): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, (res: T) => resolve(res)));
}

interface Client {
  socket: Socket;
  playerId: string;
  name: string;
  room: any;
  privateState: any;
}

async function main() {
  const hostSocket = await connect();
  const created: any = await emitAck(hostSocket, 'create-room', { hostName: 'Host', colorIndex: 0 });

  const makeClient = (socket: Socket, playerId: string, name: string): Client => {
    const client: Client = { socket, playerId, name, room: null, privateState: {} };
    socket.on('room:update', (room: any) => {
      client.room = room;
    });
    socket.on('player:private-state', (state: any) => {
      client.privateState = state;
    });
    return client;
  };

  const host = makeClient(hostSocket, created.player.id, 'Host');
  host.room = created.room;
  host.privateState = created.privateState || {};
  const code = created.room.roomCode;

  // Second human player joins
  const guestSocket = await connect();
  const joined: any = await emitAck(guestSocket, 'join-room', {
    roomCode: code,
    playerName: 'Guest',
    colorIndex: 1,
  });
  check('guest joined the room', Boolean(joined?.success), joined?.error || 'ok');
  const guest = makeClient(guestSocket, joined.player.id, 'Guest');
  guest.room = joined.room;
  guest.privateState = joined.privateState || {};

  // Two bots so the round has four participants
  await emitAck(hostSocket, 'add-bot', { roomCode: code });
  await emitAck(hostSocket, 'add-bot', { roomCode: code });
  await wait(400);
  check('room has four players', host.room.players.length === 4, `${host.room.players.length}`);

  // Select Guess the Link and start the round
  hostSocket.emit('select-game', { roomCode: code, gameId: 'guess-the-link' });
  await wait(300);
  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'reveal' });
  await wait(600);

  check('round starts in the reveal phase', host.room.phase === 'reveal', host.room.phase);
  check(
    'both humans received a private hint',
    Boolean(host.privateState.gtlHint) && Boolean(guest.privateState.gtlHint),
    `${host.privateState.gtlHint} / ${guest.privateState.gtlHint}`
  );
  check(
    'hints are different per player',
    host.privateState.gtlHint !== guest.privateState.gtlHint
  );
  check('category nudge is provided', Boolean(host.privateState.gtlCategory));
  check('concept word count is public', host.room.gtlState.conceptWordCount >= 1);

  const preRevealPayload = JSON.stringify(host.room);
  const leaked = GTL_PROMPTS.filter((p) => preRevealPayload.includes(p.concept)).map((p) => p.concept);
  check(
    'no concept appears anywhere in broadcast state before results',
    leaked.length === 0 || (leaked.length === 1 && host.room.gtlState.concept !== null),
    leaked.join(', ') || 'none'
  );
  check('public state withholds the concept', host.room.gtlState.concept === null);

  // Input phase — the two humans write responses, the two bots auto-submit
  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'input' });
  await wait(500);
  check('input phase is running', host.room.phase === 'input', host.room.phase);
  check('bots already submitted', host.room.hasSubmittedInput.length >= 2, `${host.room.hasSubmittedInput.length} submitted`);

  hostSocket.emit('submit-input', { roomCode: code, playerId: host.playerId, answer: 'round thing' });
  await wait(300);
  check('one human response is tracked', host.room.hasSubmittedInput.length === 3, `${host.room.hasSubmittedInput.length}`);
  guestSocket.emit('submit-input', { roomCode: code, playerId: guest.playerId, answer: 'cheesy slice' });
  await wait(600);

  check('all responses advance to the link board', host.room.phase === 'reveal-answers', host.room.phase);
  check('four responses are on the board', host.room.revealedAnswers.length === 4, `${host.room.revealedAnswers.length}`);
  check(
    'board entries carry the owner hint',
    host.room.revealedAnswers.every((a: any) => (a.subtext || '').startsWith('Hint:'))
  );
  check(
    'responses are private state, not the hints',
    !JSON.stringify(host.room.revealedAnswers).includes('gtlHint')
  );

  // Guess phase
  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'guess' });
  await wait(500);
  check('guess phase is running', host.room.phase === 'guess', host.room.phase);
  check('bots have locked in guesses', (host.room.gtlState.guessesSubmitted || []).length >= 2);
  check('concept is still withheld during guessing', host.room.gtlState.concept === null);

  hostSocket.emit('gtl-guess', { roomCode: code, playerId: host.playerId, guess: 'zzzqqq nonsense' });
  await wait(800);
  check('the round waits for the last human guess', host.room.phase === 'guess', host.room.phase);

  const conceptFreePayload = JSON.stringify(host.room);
  check(
    'still no concept leak while guessing',
    GTL_PROMPTS.every((p) => !conceptFreePayload.includes(p.concept))
  );

  guestSocket.emit('gtl-guess', { roomCode: code, playerId: guest.playerId, guess: 'pizza' });
  await wait(900);

  check('guessing completed advances to results', host.room.phase === 'results', host.room.phase);

  const results = host.room.results!;
  const concept = results.gtlConcept;
  check('results reveal the concept', Boolean(concept), String(concept));
  check('public state now exposes the concept', host.room.gtlState.concept === concept);
  check('results include every guess', (results.gtlGuesses || []).length === 4);
  check('results include the hint roster', (results.gtlHints || []).length === 4);

  const prompt = GTL_PROMPTS.find((p) => p.concept === concept);
  check('the revealed concept comes from the shipped prompt set', Boolean(prompt), String(concept));

  const humanGuess = results.gtlGuesses.find((g: any) => g.playerId === guest.playerId);
  check(
    'a deliberate nonsense guess is scored as incorrect',
    humanGuess && humanGuess.correct === false,
    `${humanGuess?.guessText} -> ${humanGuess?.correct}`
  );

  // Re-derive correctness from the engine and compare with what the server stored
  const mismatches = results.gtlGuesses.filter(
    (g: any) => prompt && g.correct !== isCorrectGtlGuess(prompt, g.guessText)
  );
  check('server correctness matches the engine judge', mismatches.length === 0, `${mismatches.length} mismatches`);

  const scorers = host.room.players.filter((p: any) => p.score > 0).map((p: any) => p.id);
  const flagged = results.gtlGuesses.filter((g: any) => g.correct).map((g: any) => g.playerId);
  check('only correct guessers scored a point', scorers.join(',') === flagged.join(','), `${scorers.join(',')} vs ${flagged.join(',')}`);
  check('every correct guesser got exactly +1', results.gtlGuesses.filter((g: any) => g.correct).every((g: any) => g.pointsAdded === 1));

  const guesserPrivate = host.privateState.gtlGuessCorrect !== undefined || guest.privateState.gtlGuessCorrect !== undefined;
  check('private state reports each player their own result', guesserPrivate,
    `host=${host.privateState.gtlGuessCorrect} guest=${guest.privateState.gtlGuessCorrect}`);

  if (results.gtlGiveawayName) {
    check(
      'giveaway is one of the real responses',
      results.gtlGuesses.some((g: any) => g.guessText === results.gtlGiveawayResponse) ||
        host.room.revealedAnswers.some((a: any) => a.answerText === results.gtlGiveawayResponse),
      `${results.gtlGiveawayName}: "${results.gtlGiveawayResponse}"`
    );
  } else {
    check('giveaway is optional and omitted when nothing resembles the concept', true);
  }

  /* ---------------- second round: host skip path + stragglers ---------------- */
  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'next-round' });
  await wait(700);
  check('next round returns to reveal with a fresh concept', host.room.phase === 'reveal', host.room.phase);
  check('round counter advanced', host.room.roundNumber === 2, `${host.room.roundNumber}`);
  check('fresh hints are dealt', guest.privateState.gtlHint !== results.gtlHints.find((h: any) => h.playerId === guest.playerId)?.hint);

  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'input' });
  await wait(400);
  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'reveal-answers' });
  await wait(400);
  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'guess' });
  await wait(400);
  check('host skip reaches the guess phase', host.room.phase === 'guess', host.room.phase);

  hostSocket.emit('advance-phase', { roomCode: code, targetPhase: 'results' });
  await wait(700);
  check('host can reveal the concept early', host.room.phase === 'results', host.room.phase);
  const round2 = host.room.results!;
  check('early reveal still produces results', Boolean(round2.gtlConcept), String(round2.gtlConcept));
  check(
    'players who never guessed are recorded as (No guess)',
    (round2.gtlGuesses || []).some((g: any) => g.guessText === '(No guess)'),
    (round2.gtlGuesses || []).map((g: any) => g.guessText).join(' | ')
  );
  check(
    'the two rounds used different concepts',
    round2.gtlConcept !== results.gtlConcept,
    `${results.gtlConcept} -> ${round2.gtlConcept}`
  );

  /* ---------------------------------- cleanup --------------------------------- */
  hostSocket.emit('reset-to-lobby', { roomCode: code });
  await wait(500);
  check('returning to the lobby clears the round state', host.room.phase === 'lobby' && host.room.gtlState === null);

  hostSocket.close();
  guestSocket.close();
  console.log(failures === 0 ? '\nALL GUESS THE LINK SOCKET CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('HARNESS ERROR', error);
  process.exit(1);
});
