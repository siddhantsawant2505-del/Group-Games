/**
 * Top 100 data validation — `npm run validate:top100`.
 *
 * Fails (non-zero exit) unless every shipped list is playable:
 *  - exactly 100 items, ranks exactly 1..100 with no gaps or duplicates;
 *  - no empty names/aliases, and every name/alias must survive normalisation
 *    (a name that normalises to nothing could never be matched);
 *  - names unique inside a list, and every alias unique across the whole list —
 *    an alias may not equal another item's name or alias once normalised;
 *  - question, category, region, asOf and source present, with the category
 *    declared in shared/data/top100Categories.ts;
 *  - list ids unique across the bank.
 *
 * It also prints a coverage summary (lists and categories) so the size of the
 * shipped bank is always visible.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOP100_CATEGORY_IDS } from '../shared/data/top100Categories';
import { normalizeTop100Text } from '../server/games/top100.match';
import { isUsableTop100List } from '../server/content/top100Provider';
import type { Top100List } from '../shared/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LISTS_DIR = path.join(ROOT, 'shared', 'data', 'top100');

const VALID_REGIONS = new Set(['global', 'india']);

interface LoadedList {
  file: string;
  list: unknown;
}

function loadFiles(): LoadedList[] {
  if (!fs.existsSync(LISTS_DIR)) {
    fail(`missing list directory: ${path.relative(ROOT, LISTS_DIR)}`);
    return [];
  }

  const files = fs
    .readdirSync(LISTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();

  const loaded: LoadedList[] = [];
  for (const file of files) {
    const fullPath = path.join(LISTS_DIR, file);
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const lists = Array.isArray(parsed?.lists) ? parsed.lists : [];
      if (lists.length === 0) {
        fail(`${file}: no "lists" array`);
        continue;
      }
      lists.forEach((list: unknown) => loaded.push({ file, list }));
    } catch (error) {
      fail(`${file}: not valid JSON — ${(error as Error).message}`);
    }
  }
  return loaded;
}

const problems: string[] = [];

function fail(message: string): void {
  problems.push(message);
  console.log(`  ✗ ${message}`);
}

function checkList(file: string, candidate: Top100List): void {
  const label = `${file} → ${candidate.id || '(no id)'}`;

  if (!candidate.id || typeof candidate.id !== 'string') fail(`${label}: missing id`);
  if (!candidate.question || !String(candidate.question).trim()) fail(`${label}: missing question`);
  if (!candidate.category || !String(candidate.category).trim()) fail(`${label}: missing category`);
  if (!candidate.asOf || !String(candidate.asOf).trim()) fail(`${label}: missing asOf`);
  if (!candidate.source || !String(candidate.source).trim()) fail(`${label}: missing source`);
  if (typeof candidate.verified !== 'boolean') fail(`${label}: verified must be a boolean`);
  if (!VALID_REGIONS.has(candidate.region)) {
    fail(`${label}: region must be 'global' or 'india' (got ${String(candidate.region)})`);
  }
  if (candidate.category && !TOP100_CATEGORY_IDS.includes(candidate.category)) {
    fail(`${label}: category "${candidate.category}" is not declared in shared/data/top100Categories.ts`);
  }
  if (candidate.source && !/^https?:\/\//.test(candidate.source)) {
    fail(`${label}: source must be a URL`);
  }

  const items = Array.isArray(candidate.items) ? candidate.items : [];
  if (items.length !== 100) {
    fail(`${label}: expected exactly 100 items, found ${items.length}`);
  }

  const ranks = new Set<number>();
  const names = new Map<string, number>();
  /** Normalised key → where it came from ("name" / "alias of rank N"). */
  const keys = new Map<string, string>();

  items.forEach((item, index) => {
    const where = `${label} rank ${item?.rank ?? index + 1}`;

    if (!item || typeof item.rank !== 'number' || !Number.isInteger(item.rank)) {
      fail(`${where}: rank must be an integer`);
      return;
    }
    if (item.rank < 1 || item.rank > 100) fail(`${where}: rank out of range`);
    if (ranks.has(item.rank)) fail(`${where}: duplicate rank ${item.rank}`);
    ranks.add(item.rank);

    if (typeof item.name !== 'string' || !item.name.trim()) {
      fail(`${where}: empty name`);
      return;
    }

    const nameKey = normalizeTop100Text(item.name);
    if (!nameKey) fail(`${where}: name "${item.name}" normalises to nothing`);
    else if (names.has(nameKey)) {
      fail(`${where}: name "${item.name}" collides with rank ${names.get(nameKey)}`);
    } else {
      names.set(nameKey, item.rank);
    }
    if (nameKey && keys.has(nameKey)) {
      fail(`${where}: name "${item.name}" collides with ${keys.get(nameKey)}`);
    } else if (nameKey) {
      keys.set(nameKey, `the name of rank ${item.rank}`);
    }

    if (!Array.isArray(item.aliases)) {
      fail(`${where}: aliases must be an array`);
      return;
    }
    item.aliases.forEach((alias) => {
      if (typeof alias !== 'string' || !alias.trim()) {
        fail(`${where}: empty alias`);
        return;
      }
      const aliasKey = normalizeTop100Text(alias);
      if (!aliasKey) {
        fail(`${where}: alias "${alias}" normalises to nothing`);
        return;
      }
      const existing = keys.get(aliasKey);
      if (existing) {
        // An alias may repeat its own item's name, but nothing else.
        if (existing !== `the name of rank ${item.rank}` && existing !== `an alias of rank ${item.rank}`) {
          fail(`${where}: alias "${alias}" collides with ${existing}`);
        }
        return;
      }
      keys.set(aliasKey, `an alias of rank ${item.rank}`);
    });
  });

  const missingRanks: number[] = [];
  for (let rank = 1; rank <= 100; rank += 1) {
    if (!ranks.has(rank)) missingRanks.push(rank);
  }
  if (missingRanks.length > 0) {
    fail(`${label}: missing ranks ${missingRanks.slice(0, 8).join(', ')}${missingRanks.length > 8 ? '…' : ''}`);
  }
}

function main(): void {
  console.log('Validating Top 100 lists…\n');

  const loaded = loadFiles();
  const ids = new Map<string, string>();

  loaded.forEach(({ file, list }) => {
    if (!isUsableTop100List(list)) {
      // Structural check first: it catches the coarse problems, the detailed
      // pass below explains them.
      if (!list || typeof list !== 'object') {
        fail(`${file}: entry is not an object`);
        return;
      }
    }
    const candidate = list as Top100List;
    checkList(file, candidate);
    if (candidate?.id) {
      const existing = ids.get(candidate.id);
      if (existing) fail(`duplicate list id "${candidate.id}" (${existing} and ${file})`);
      else ids.set(candidate.id, file);
    }
  });

  const lists = loaded.map(({ list }) => list as Top100List).filter((list) => list?.id);
  const categories = [...new Set(lists.map((list) => list.category))].sort();
  const verified = lists.filter((list) => list.verified).length;
  const regionCounts = lists.reduce<Record<string, number>>((acc, list) => {
    acc[list.region] = (acc[list.region] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\nCoverage');
  console.log(`  lists:      ${lists.length}`);
  console.log(`  verified:   ${verified} (TOP100_ONLY_VERIFIED=true serves these only)`);
  console.log(`  categories: ${categories.length} — ${categories.join(', ')}`);
  console.log(
    `  regions:    ${Object.entries(regionCounts)
      .map(([region, count]) => `${region}=${count}`)
      .join(', ')}`
  );

  if (problems.length > 0) {
    console.log(`\n✗ ${problems.length} problem${problems.length === 1 ? '' : 's'} found.`);
    process.exit(1);
  }

  console.log('\n✓ every list is playable (100 items, ranks 1-100, unique names and aliases).');
}

main();
