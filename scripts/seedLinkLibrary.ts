/**
 * Seeds the Guess the Link puzzle library.
 *
 * Writes the shipped seed puzzles into data/puzzle-library/index.json and, when
 * an image provider is configured, renders each clue through the same pipeline
 * rounds use. With no provider it stores emoji-only puzzles and says so instead
 * of failing silently.
 *
 * Run: npm run seed:link
 */
import fs from 'node:fs';
import path from 'node:path';
import { SEED_LINK_PUZZLES } from '../server/content/guessTheLink/seedPuzzles';
import { generateClueImage, getImageProvider, imageBudget, STYLE_PREFIX } from '../server/content/guessTheLink/imageProvider';
import { storeImage, INDEX_FILE, LIBRARY_DIR, IMAGES_DIR } from '../server/content/guessTheLink/imageStore';

async function main() {
  const provider = getImageProvider();
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const puzzles = SEED_LINK_PUZZLES.map((puzzle) => ({ ...puzzle, items: puzzle.items.map((item) => ({ ...item })) }));

  if (!provider.enabled) {
    console.log('No image provider configured (IMAGE_PROVIDER/IMAGE_API_KEY) — storing emoji-only puzzles.');
    console.log('Set IMAGE_PROVIDER=mock for placeholders, or IMAGE_PROVIDER=gemini with IMAGE_MODEL/IMAGE_API_KEY to draw clues.');
  } else {
    let drawn = 0;
    for (const puzzle of puzzles) {
      for (const [index, item] of puzzle.items.entries()) {
        const buffer = await imageBudget.run(() =>
          generateClueImage(`${STYLE_PREFIX}${item.imagePrompt}`, index + puzzle.link.length)
        );
        if (!buffer) continue;
        try {
          item.imageToken = (await storeImage(buffer)).token;
          drawn += 1;
        } catch (error) {
          console.log(`Could not store an image for ${puzzle.id}: ${String(error)}`);
        }
      }
    }
    console.log(`Rendered ${drawn} clue image(s) with "${provider.name}".`);
  }

  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  fs.writeFileSync(
    INDEX_FILE,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), puzzles }, null, 2)
  );
  console.log(`Wrote ${puzzles.length} puzzles to ${path.relative(process.cwd(), INDEX_FILE)}`);
}

void main();
