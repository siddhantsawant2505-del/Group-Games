/**
 * Development-time generator for `shared/data/words/commonNouns.json`.
 *
 *   npx tsx scripts/generateCommonNouns.ts            # rewrite the corpus + print the lint report
 *   npx tsx scripts/generateCommonNouns.ts --check    # lint only, fail on lint problems, no write
 *
 * The authored vocabulary lives in `scripts/commonNouns.source.txt` as `#Category` headers
 * followed by `1:` / `2:` / `3:` difficulty lines of comma-separated everyday nouns.
 * The tiers are hand-labelled (1 = a ten-year-old knows it, 3 = rarer/technical) because the
 * bundled subtitle-frequency list badly under-reports everyday nouns (it misses "grape",
 * "pancake" and "otter"). The frequency list is still used here as an independent
 * cross-check: every tier-1 word that it has never seen is reported, so mistakes show up.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'scripts', 'commonNouns.source.txt');
const FREQUENCY_PATH = path.join(ROOT, 'data', 'common-words-frequency.txt');
const BLOCKLIST_PATH = path.join(ROOT, 'data', 'blocklist.txt');
const OUTPUT_PATH = path.join(ROOT, 'shared', 'data', 'words', 'commonNouns.json');

export interface CorpusEntry {
  word: string;
  category: string;
  difficulty: 1 | 2 | 3;
}

const WORD_PATTERN = /^[a-z]{3,14}$/;

function readLines(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

function loadFrequencyRank(): Map<string, number> {
  const ranks = new Map<string, number>();
  const words = readLines(FREQUENCY_PATH)
    .map((line) => line.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w));
  words.forEach((word, index) => {
    if (!ranks.has(word)) ranks.set(word, index + 1);
  });
  return ranks;
}

function loadBlocklist(): Set<string> {
  return new Set(
    readLines(BLOCKLIST_PATH)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
  );
}

function parseSource(): { category: string; words: { word: string; difficulty: 1 | 2 | 3 }[] }[] {
  const groups: { category: string; words: { word: string; difficulty: 1 | 2 | 3 }[] }[] = [];
  for (const rawLine of readLines(SOURCE_PATH)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('#')) {
      groups.push({ category: line.slice(1).trim(), words: [] });
      continue;
    }
    if (groups.length === 0) continue;
    const marker = line.match(/^([123])\s*:/);
    if (!marker) continue;
    const difficulty = Number(marker[1]) as 1 | 2 | 3;
    const current = groups[groups.length - 1];
    for (const token of line.slice(marker[0].length).split(',')) {
      const word = token.trim().toLowerCase();
      if (word) current.words.push({ word, difficulty });
    }
  }
  return groups;
}


function build(): {
  entries: CorpusEntry[];
  problems: string[];
  stats: Record<string, unknown>;
} {
  const ranks = loadFrequencyRank();
  const blocklist = loadBlocklist();
  const groups = parseSource();

  const problems: string[] = [];
  const seen = new Map<string, string>(); // word -> category that claimed it
  const entries: CorpusEntry[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  const blocked: string[] = [];
  const absent: string[] = [];

  for (const group of groups) {
    const category = group.category.replace(/\s*&\s*/g, ' & ').trim();
    if (category.length < 2) problems.push('Category with no name');
    for (const raw of group.words) {
      // Authored placeholder suffixes ("banana2", "candle3") are intentional
      // de-duplication markers: strip trailing digits, keep the first spelling.
      const word = raw.word.replace(/\d+$/, '').replace(/-/g, '');
      if (!WORD_PATTERN.test(word)) {
        invalid.push(`${raw.word} (${category})`);
        continue;
      }
      if (seen.has(word)) {
        duplicates.push(`${word} (${category} also claimed by ${seen.get(word)})`);
        continue;
      }
      if (blocklist.has(word)) {
        blocked.push(`${word} (${category})`);
        continue;
      }
      seen.set(word, category);
      // Tier-1 words are claimed to be everyday vocabulary: the frequency list
      // not recognising them is worth a look, so they are reported for review.
      if (raw.difficulty === 1 && ranks.get(word) === undefined) {
        absent.push(`${word} (${category})`);
      }
      entries.push({ word, category, difficulty: raw.difficulty });
    }
  }

  const byDifficulty: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  entries.forEach((entry) => {
    byDifficulty[entry.difficulty] += 1;
  });

  if (entries.length < 2000) {
    problems.push(`Corpus has only ${entries.length} entries (needs at least 2000)`);
  }
  const categories = new Set(entries.map((entry) => entry.category));
  if (categories.size < 20) {
    problems.push(`Corpus only covers ${categories.size} categories (needs 20+)`);
  }
  if (invalid.length) problems.push(`${invalid.length} malformed tokens`);
  if (blocked.length) problems.push(`${blocked.length} blocklisted words`);

  return {
    entries,
    problems,
    stats: {
      entries: entries.length,
      categories: categories.size,
      byDifficulty,
      duplicatesRemoved: duplicates.length,
      invalid,
      blocked,
      notInFrequencyList: absent.length,
      absentSample: absent.slice(0, 40),
    },
  };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { entries, problems, stats } = build();

  console.log(JSON.stringify(stats, null, 2));

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    const json = entries
      .map(
        (entry) =>
          `  { "word": "${entry.word}", "category": ${JSON.stringify(
            entry.category
          )}, "difficulty": ${entry.difficulty} }`
      )
      .join(',\n');
    const file = `[\n${json}\n]\n`;
    fs.writeFileSync(OUTPUT_PATH, file);
    console.log(`\nWrote ${entries.length} entries to ${path.relative(ROOT, OUTPUT_PATH)}`);
  }

  if (problems.length) {
    console.error('\nLINT FAILED:');
    problems.forEach((problem) => console.error(` - ${problem}`));
    process.exitCode = 1;
    return;
  }
  console.log('\nLint OK.');
}

main();
