/**
 * Temp verification harness: host-authored Guess the Link concepts.
 * Covers the shared validator, room storage/lifecycle, one-shot consumption,
 * deck fallback, and privacy of the concept in broadcast state.
 */
import { roomManager } from './server/roomManager';
import { getGtlRoundState } from './server/games/guessTheLink';
import {
  GTL_MAX_HINTS,
  GTL_MIN_CUSTOM_HINTS,
  GTL_MAX_CONCEPT_CHARS,
  buildGtlCustomPrompt,
  isBlankGtlCustomPrompt,
} from './shared/data/guessTheLinkPrompts';
import { GTL_PROMPTS } from './shared/data/guessTheLinkPrompts';
import type { InternalPlayer, InternalRoom } from './server/roomManager';

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

/* ---------------- Validator ---------------- */

check('valid custom prompt accepted', buildGtlCustomPrompt({
  concept: 'Snow globe', category: 'Objects',
  hints: ['Glass dome', 'Shaken not stirred', 'Tiny storm', 'Desk ornament'],
}).ok);

const blank = buildGtlCustomPrompt({ concept: '  ', hints: ['a', 'b', 'c'] });
check('blank concept rejected', !blank.ok && blank.error.includes('concept'));

const tooFew = buildGtlCustomPrompt({ concept: 'Xylophone', hints: ['Two', 'only'] });
check('fewer than min hints rejected', !tooFew.ok && tooFew.error.includes(String(GTL_MIN_CUSTOM_HINTS)));

const tooLong = buildGtlCustomPrompt({ concept: 'a'.repeat(GTL_MAX_CONCEPT_CHARS + 1), hints: ['a1', 'b2', 'c3'] });
check('overlong concept rejected', !tooLong.ok && tooLong.error.includes('capped'));

const tooManyWords = buildGtlCustomPrompt({ concept: 'one two three four five', hints: ['a1', 'b2', 'c3'] });
check('5-word concept rejected', !tooManyWords.ok && tooManyWords.error.includes('words'));

const dupes = buildGtlCustomPrompt({
  concept: 'Campfire',
  hints: ['Marshmallow', 'marshmallow ', 'Glowing logs', 'Smoke rising', 'Circle of friends'],
});
if (dupes.ok) {
  check('dedupes repeated angles', dupes.prompt.hints.length === 4, dupes.prompt.hints);
  check('drops angle equal to concept', !dupes.prompt.hints.some((h) => h.toLowerCase().includes('campfire')));
} else {
  check('dedupe case should still validate', false, dupes);
}

const capped = buildGtlCustomPrompt({
  concept: 'Origami crane',
  hints: ['Folded paper', 'a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'],
});
check('caps at 6 angles', capped.ok && capped.prompt.hints.length === GTL_MAX_HINTS, capped);

check('all-blank input detected as blank', isBlankGtlCustomPrompt({ concept: ' ', hints: ['', '  '] }));
check('partial input not blank', !isBlankGtlCustomPrompt({ concept: ' ', hints: ['hint'] }));
check('default category applied', (() => {
  const r = buildGtlCustomPrompt({ concept: 'Kite', hints: ['Windy day', 'String and sticks', 'Soaring high'] });
  return r.ok && r.prompt.category === 'Custom Round';
})());

/* ---------------- Room lifecycle ---------------- */

function makeRoom(): { room: InternalRoom; host: InternalPlayer } {
  const { room, host } = roomManager.createRoom('Ada', 'sock_ada', 0);
  (['Bob', 'Cid'] as const).forEach((name, i) => {
    room.players.push({
      id: `p_${name}`,
      name,
      colorIndex: i + 1,
      colorHex: '#888888',
      colorName: 'Grey',
      isHost: false,
      connected: true,
      score: 0,
      sessionToken: `tok_${name}`,
      joinedAt: Date.now(),
      socketId: `sock_${name}`,
    });
  });
  return { room, host };
}

const CUSTOM = {
  concept: 'Snow globe',
  category: 'Objects',
  hints: ['Glass dome', 'Shaken not stirred', 'Tiny storm', 'Desk ornament', 'Fake snow falling'],
};

const { room, host } = makeRoom();
roomManager.selectGame(room.code, 'guess-the-link');

check('non-host cannot set custom prompt', !roomManager.setGtlCustomPrompt(room.code, 'p_Bob', CUSTOM).success);
check('wrong phase rejected (still lobby)', roomManager.setGtlCustomPrompt(room.code, host.id, CUSTOM).error?.includes('before launching') ?? false);

roomManager.transitionToPhase(room, 'game-select', () => {});
check('host saves custom prompt in game-select', roomManager.setGtlCustomPrompt(room.code, host.id, CUSTOM).success);
check('custom prompt stored on room', room.gtlCustomPrompt?.concept === 'Snow globe');
check('public state shows ready flag', roomManager.getPublicRoomState(room).gtlCustomReady === true);

const saved = roomManager.setGtlCustomPrompt(room.code, host.id, CUSTOM);
check('save echoes normalized prompt to host', saved.success && saved.prompt?.hints.length === 5);

roomManager.transitionToPhase(room, 'reveal', () => {});
const round = getGtlRoundState(room.code);
check('round uses custom concept', round?.prompt.concept === 'Snow globe');
check('custom prompt consumed (one-shot)', room.gtlCustomPrompt === null);
check('ready flag cleared after consumption', roomManager.getPublicRoomState(room).gtlCustomReady === false);
check('category survives from custom prompt', room.privateData[host.id]?.gtlCategory === 'Objects');

const hostHint = room.privateData[host.id]?.gtlHint || '';
check('host got one of the custom angles', CUSTOM.hints.includes(hostHint), hostHint);
check('host hint index tracked', (room.privateData[host.id]?.gtlHintIndex ?? 0) >= 1);
check('hint counts match custom deck', room.privateData[host.id]?.gtlHintCount === CUSTOM.hints.length);
check('all three players got angles', ['p_Bob', 'p_Cid'].every((id) => CUSTOM.hints.includes(room.privateData[id]?.gtlHint || '')));
check('angles are distinct across players', new Set([hostHint, room.privateData['p_Bob']?.gtlHint, room.privateData['p_Cid']?.gtlHint]).size === 3);

const publicState = JSON.stringify(roomManager.getPublicRoomState(room));
check('concept absent from public room state', !publicState.includes('Snow globe'));
check('concept absent from gtlState', room.gtlState?.concept === null);
check('concept absent from public state keys', Object.keys(room.gtlState || {}).every((k) => !JSON.stringify((room.gtlState as any)?.[k]).includes('Snow globe')));

// Next round falls back to the shipped deck.
roomManager.transitionToPhase(room, 'next-round', () => {});
const round2 = getGtlRoundState(room.code);
check('next round falls back to deck', round2?.prompt.concept !== 'Snow globe' && GTL_PROMPTS.some((p) => p.concept === round2?.prompt.concept), round2?.prompt.concept);

// Switching games clears a queued concept.
roomManager.transitionToPhase(room, 'lobby', () => {});
roomManager.transitionToPhase(room, 'game-select', () => {});
roomManager.setGtlCustomPrompt(room.code, host.id, CUSTOM);
roomManager.selectGame(room.code, 'mafia');
check('switching game clears queued concept', room.gtlCustomPrompt === null);

// Blank payload clears a queued concept.
roomManager.selectGame(room.code, 'guess-the-link');
roomManager.setGtlCustomPrompt(room.code, host.id, CUSTOM);
const cleared = roomManager.setGtlCustomPrompt(room.code, host.id, { concept: '', hints: [] });
check('blank payload clears and succeeds', cleared.success && cleared.prompt === null && room.gtlCustomPrompt === null);

// Lobby reset clears a queued concept too.
roomManager.setGtlCustomPrompt(room.code, host.id, CUSTOM);
roomManager.transitionToPhase(room, 'lobby', () => {});
check('lobby reset clears queued concept', room.gtlCustomPrompt === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
