/**
 * Seeds the Guess the Link puzzle library.
 *
 * Writes the shipped seed puzzles into data/puzzle-library/index.json so they
 * can be curated on the dev page. With an image provider configured the script
 * would render each clue; without one it stores the emoji-only puzzles and says
 * so, instead of failing silently.
 *
 * Run: npm run seed:link
 */
import fs from 'node:fs';
import path from 'node:path';
import { SEED_LINK_PUZZLES } from '../server/content/guessTheLink/seedPuzzles';

const libraryDir = process.env.LIBRARY_DIR || path.join(process.cwd(), 'data', 'puzzle-library');
const indexFile = path.join(libraryDir, 'index.json');
const provider = (process.env.IMAGE_PROVIDER || 'none').toLowerCase();
const hasKey = Boolean(process.env.IMAGE_API_KEY || process.env.GEMINI_API_KEY);

fs.mkdirSync(path.join(libraryDir, 'images'), { recursive: true });
fs.writeFileSync(
  indexFile,
  JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), puzzles: SEED_LINK_PUZZLES }, null, 2)
);

console.log(`Wrote ${SEED_LINK_PUZZLES.length} puzzles to ${indexFile}`);

if (provider === 'none' || !hasKey) {
  console.log(
    'No image provider configured (IMAGE_PROVIDER/IMAGE_API_KEY). Puzzles were stored with emoji tiles only.'
  );
  console.log('Set IMAGE_PROVIDER=gemini and IMAGE_API_KEY (or GEMINI_API_KEY) to render clue images.');
} else {
  console.log(
    `Image provider "${provider}" is configured, but this build ships without the image renderer; clues stay as emoji tiles.`
  );
}
