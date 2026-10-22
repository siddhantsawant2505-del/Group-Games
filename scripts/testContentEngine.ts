/**
 * Content-engine test suite — `npm run test:content`.
 *
 * Runs the shuffle bag, the word provider, the AI-output validator and the
 * availability logic in-process (no server, no network). Every assertion is a
 * hard failure: a broken bag, a repeated word or a leaky validator exits 1.
 */

import fs from 'fs';
import path from 'path';
import corpusData from '../shared/data/words/commonNouns.json';
import { ShuffleBag, shuffle } from '../server/content/contentBag';
import {
  poolSizeFor,
  resetWordProviderForTests,
  validateAiWords,
  wordProvider,
} from '../server/content/wordProvider';
import { isAiAvailable, resetAiClientForTests } from '../server/content/aiClient';
import { readDifficulty, sanitizeTheme } from '../server/content/types';

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

const corpus = corpusData as { word: string; category: string; difficulty: number }[];
const corpusWords = new Set(corpus.map((entry) => entry.word));

function loadFrequencyWords(): string[] {
  const file = path.join(process.cwd(), 'data', 'common-words-frequency.txt');
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((word) => /^[a-z]{3,}$/.test(word));
}

function loadBlocklist(): string[] {
  const file = path.join(process.cwd(), 'data', 'blocklist.txt');
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------- shipped pool
  section('shipped corpus');
  const easyPool = poolSizeFor('easy');
  const mediumPool = poolSizeFor('medium');
  const anyPool = poolSizeFor('any');
  const categories = new Set(corpus.map((entry) => entry.category));
  const tiers = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
  corpus.forEach((entry) => {
    tiers[entry.difficulty] = (tiers[entry.difficulty] || 0) + 1;
  });
  const everydayShare = (tiers[1] + tiers[2]) / corpus.length;

  console.log(
    `pool: total ${anyPool}, easy ${easyPool}, medium ${mediumPool}, tiers ${JSON.stringify(
      tiers
    )}, categories ${categories.size}`
  );

  check('corpus has at least the required 2000 entries', corpus.length >= 2000, `${corpus.length}`);
  check('corpus spans at least 20 categories', categories.size >= 20, `${categories.size}`);
  check('easy pool covers a 500-round session', easyPool >= 500, `${easyPool}`);
  check(
    'the provider serves every entry of the corpus file',
    anyPool === corpus.length,
    `${anyPool} served vs ${corpus.length} in file`
  );
  check(
    'most words sit at difficulty 1-2',
    everydayShare >= 0.7,
    `${(everydayShare * 100).toFixed(1)}%`
  );
  check(
    'every corpus word is a clean lowercase token',
    corpus.every((entry) => /^[a-z]{3,14}$/.test(entry.word))
  );
  check('every corpus word has a difficulty of 1, 2 or 3', corpus.every((entry) => [1, 2, 3].includes(entry.difficulty)));
  check(
    'corpus words are unique',
    new Set(corpus.map((entry) => entry.word)).size === corpus.length
  );
  const blocklist = loadBlocklist();
  check('no corpus word is blocklisted', !corpus.some((entry) => blocklist.includes(entry.word)));

  // ---------------------------------------------------------------- shuffle bag
  section('shuffle bag');
  const smallPool = Array.from({ length: 20 }, (_, index) => `pool_${index}`);
  const bag = new ShuffleBag(smallPool, (id) => id);
  const cycleOne = Array.from({ length: 20 }, () => bag.next() as string);
  check('a full cycle serves every item exactly once', new Set(cycleOne).size === 20);
  const cycleTwoHead = Array.from({ length: 10 }, () => bag.next() as string);
  check(
    'after a reshuffle the first 10 items avoid the previous 10',
    cycleTwoHead.every((id) => !cycleOne.slice(-10).includes(id)),
    cycleTwoHead.join(',')
  );
  check('servedCount tracks distinct items', bag.servedCount === 20, `${bag.servedCount}`);

  const injected = new ShuffleBag(['a', 'b', 'c'], (id) => id);
  injected.next();
  const added = injected.add(['a', 'd', 'e', 'e']);
  check('add() ignores duplicates and keeps new items', added === 2, `${added}`);
  check('add() grows the pool', injected.size === 5, `${injected.size}`);

  // ---------------------------------------------------------------- 500-round room
  section('500 rounds in one room (difficulty easy)');
  resetWordProviderForTests();
  const roomId = 'TESTROOM';
  const seen: string[] = [];
  const seenSet = new Set<string>();
  let tierViolation = 0;
  for (let round = 0; round < 500; round += 1) {
    const word = await wordProvider.next(roomId, { difficulty: 'easy' });
    if (seenSet.has(word.word)) {
      failures.push(`repeat within 500 rounds: "${word.word}" at round ${round + 1}`);
    }
    seenSet.add(word.word);
    seen.push(word.word);
    if (word.difficulty !== 1) tierViolation += 1;
  }
  check('500 rounds produce 500 distinct words', seenSet.size === 500, `${seenSet.size}`);
  check('every easy word is tier 1', tierViolation === 0, `${tierViolation} off-tier draws`);

  // ---------------------------------------------------------------- full pool exhaustion
  section('no repeats across the whole pool (N = pool size)');
  const remaining = easyPool - 500;
  for (let round = 0; round < remaining; round += 1) {
    const word = await wordProvider.next(roomId, { difficulty: 'easy' });
    if (seenSet.has(word.word)) {
      failures.push(`repeat while exhausting the pool: "${word.word}"`);
    }
    seenSet.add(word.word);
  }
  check(
    `all ${easyPool} easy words were served with zero repeats`,
    seenSet.size === easyPool,
    `${seenSet.size}`
  );

  // ---------------------------------------------------------------- difficulty switch
  section('difficulty switch keeps room history');
  resetWordProviderForTests();
  const switchSeen = new Set<string>();
  for (let round = 0; round < 40; round += 1) {
    const word = await wordProvider.next(roomId, { difficulty: 'easy' });
    switchSeen.add(word.word);
  }
  let switchRepeats = 0;
  for (let round = 0; round < 200; round += 1) {
    const word = await wordProvider.next(roomId, { difficulty: 'any' });
    if (switchSeen.has(word.word)) switchRepeats += 1;
    switchSeen.add(word.word);
  }
  check('switching difficulty never repeats a played word', switchRepeats === 0, `${switchRepeats}`);
  check('medium pool draws are never tier 1', (
    await Promise.all(
      Array.from({ length: 60 }, () => wordProvider.next('MEDIUMROOM', { difficulty: 'medium' }))
    )
  ).every((word) => word.difficulty >= 2));

  // ---------------------------------------------------------------- release()
  section('release(roomId)');
  const beforeRelease = await wordProvider.next('RELEASEROOM', { difficulty: 'easy' });
  wordProvider.release('RELEASEROOM');
  const afterRelease = await wordProvider.next('RELEASEROOM', { difficulty: 'easy' });
  check(
    'release() gives the room a fresh bag',
    Boolean(beforeRelease.word) && Boolean(afterRelease.word)
  );

  // ---------------------------------------------------------------- AI validation
  section('AI output validation');
  resetWordProviderForTests();
  const validationRoom = 'VALIDROOM';
  const previouslyServed = await wordProvider.next(validationRoom, { difficulty: 'easy' });

  const frequencyWords = loadFrequencyWords();
  const freshCommonCandidate = frequencyWords.find(
    (word) => word.length >= 3 && word.length <= 12 && !corpusWords.has(word) && !blocklist.includes(word)
  );
  const freshCommon = freshCommonCandidate ?? '';
  const obscure = 'zzqxwv';
  const blockedWord = blocklist[0] ?? '';

  check(
    'found a common word outside the corpus for the test',
    Boolean(freshCommonCandidate),
    String(freshCommonCandidate)
  );

  const accepted = validateAiWords(
    [
      { word: freshCommon, category: 'Testing' },
      { word: obscure, category: 'Testing' },
      { word: blockedWord, category: 'Testing' },
      { word: previouslyServed.word, category: 'Testing' },
      { word: 'CORPUSWORD'.toLowerCase(), category: 'Testing' },
      { word: 'Two Words', category: 'Testing' },
      { word: 'x', category: 'Testing' },
      { word: 42, category: 'Testing' },
      { category: 'No word at all' },
    ],
    validationRoom
  );
  const acceptedWords = accepted.map((entry) => entry.word);
  check('a fresh common word is accepted', acceptedWords.includes(freshCommon), acceptedWords.join(','));
  check('an obscure word is rejected', !acceptedWords.includes(obscure));
  check('a blocklisted word is rejected', !acceptedWords.includes(blockedWord));
  check(
    'a word already served in the room is rejected',
    !acceptedWords.includes(previouslyServed.word)
  );
  check(
    'a word from the shipped corpus is rejected',
    !acceptedWords.some((word) => corpusWords.has(word))
  );
  check('shape violations are rejected', accepted.length === 1, `${accepted.length} accepted`);
  check('accepted AI words are labelled and tiered for easy mode', accepted[0]?.source === 'ai' && accepted[0]?.difficulty === 1);

  // ---------------------------------------------------------------- availability + sanitizers
  section('AI availability and sanitizers');
  const originalKey = process.env.GEMINI_API_KEY;
  const originalDisabled = process.env.CONTENT_AI_DISABLED;

  process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
  resetAiClientForTests();
  check('a placeholder key reports unavailable', isAiAvailable() === false);

  process.env.GEMINI_API_KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstu';
  resetAiClientForTests();
  check('a well-formed Gemini key reports available', isAiAvailable() === true);

  process.env.GEMINI_API_KEY = 'AQ.Ab8RN6J0abcdefghijklmnopqrstuvwxyz0123456789ABCDE';
  resetAiClientForTests();
  check('a newer AQ. Gemini key reports available', isAiAvailable() === true);

  process.env.GEMINI_API_KEY = 'AQ.placeholder';
  resetAiClientForTests();
  check('an AQ. shaped placeholder still reports unavailable', isAiAvailable() === false);

  process.env.CONTENT_AI_DISABLED = 'true';
  resetAiClientForTests();
  check('CONTENT_AI_DISABLED forces unavailable', isAiAvailable() === false);

  process.env.CONTENT_AI_DISABLED = originalDisabled;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  resetAiClientForTests();

  check('readDifficulty defaults to easy', readDifficulty(undefined) === 'easy');
  check('readDifficulty rejects junk', readDifficulty('nightmare') === 'easy');
  check('readDifficulty accepts medium', readDifficulty('medium') === 'medium');
  check(
    'sanitizeTheme strips control characters and clamps length',
    sanitizeTheme(`  space\u0000  station ${'x'.repeat(60)}`).length === 40,
    sanitizeTheme(`  space\u0000  station ${'x'.repeat(60)}`)
  );
  check('sanitizeTheme collapses whitespace', sanitizeTheme('  wild   west  ') === 'wild west');
  check('sanitizeTheme ignores non-strings', sanitizeTheme({ evil: true } as unknown) === '');

  // ---------------------------------------------------------------- misc
  section('misc');
  const unshuffled = [1, 2, 3, 4, 5, 6, 7, 8];
  check(
    'shuffle() returns a permutation without mutating the input',
    shuffle(unshuffled).sort().join(',') === unshuffled.join(',') && unshuffled.join(',') === '1,2,3,4,5,6,7,8'
  );

  // ---------------------------------------------------------------- report
  console.log(`\n${passed} checks passed, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('All content-engine checks passed.');
}

main().catch((error) => {
  console.error('test:content crashed:', error);
  process.exitCode = 1;
});
