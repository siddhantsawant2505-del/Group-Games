/**
 * Reverse Categories — Item Pool
 * 126 original items (three per theme across 42 themes) that the server draws from
 * to build a deliberately unrelated triplet every round.
 *
 * The `theme` tag is what guarantees "unrelated": the randomizer refuses to
 * pick two items that share a theme, so a round never hands out three birds or
 * three office supplies. All content is original.
 */

export interface ReverseCategoriesItem {
  item: string;
  theme: string;
}

export const REVERSE_CATEGORIES_ITEMS: ReverseCategoriesItem[] = [
  // Birds
  { item: 'flamingo', theme: 'birds' },
  { item: 'pigeon', theme: 'birds' },
  { item: 'penguin', theme: 'birds' },
  // Office supplies
  { item: 'spreadsheet', theme: 'office' },
  { item: 'stapler', theme: 'office' },
  { item: 'printer', theme: 'office' },
  // Weather
  { item: 'thunderstorm', theme: 'weather' },
  { item: 'rainbow', theme: 'weather' },
  { item: 'hailstone', theme: 'weather' },
  // Breakfast
  { item: 'waffle', theme: 'breakfast' },
  { item: 'cereal box', theme: 'breakfast' },
  { item: 'jam jar', theme: 'breakfast' },
  // Plumbing
  { item: 'drainpipe', theme: 'plumbing' },
  { item: 'tap washer', theme: 'plumbing' },
  { item: 'plunger', theme: 'plumbing' },
  // Space
  { item: 'comet', theme: 'space' },
  { item: 'satellite dish', theme: 'space' },
  { item: 'black hole', theme: 'space' },
  // Music
  { item: 'accordion', theme: 'music' },
  { item: 'castanets', theme: 'music' },
  { item: 'bagpipes', theme: 'music' },
  // Insects
  { item: 'ladybird', theme: 'insects' },
  { item: 'hornet', theme: 'insects' },
  { item: 'moth', theme: 'insects' },
  // Sport
  { item: 'badminton net', theme: 'sport' },
  { item: 'javelin', theme: 'sport' },
  { item: 'skipping rope', theme: 'sport' },
  // Kitchen tools
  { item: 'whisk', theme: 'kitchen' },
  { item: 'colander', theme: 'kitchen' },
  { item: 'ladle', theme: 'kitchen' },
  // Minerals
  { item: 'amethyst', theme: 'minerals' },
  { item: 'pumice stone', theme: 'minerals' },
  { item: 'quarry', theme: 'minerals' },
  // Transport
  { item: 'tram', theme: 'transport' },
  { item: 'ferry', theme: 'transport' },
  { item: 'unicycle', theme: 'transport' },
  // Clothing
  { item: 'mittens', theme: 'clothing' },
  { item: 'sombrero', theme: 'clothing' },
  { item: 'gumboot', theme: 'clothing' },
  // Feelings
  { item: 'nostalgia', theme: 'feelings' },
  { item: 'stage fright', theme: 'feelings' },
  { item: 'déjà vu', theme: 'feelings' },
  // Reptiles
  { item: 'chameleon', theme: 'reptiles' },
  { item: 'gecko', theme: 'reptiles' },
  { item: 'tortoise', theme: 'reptiles' },
  // Tabletop games
  { item: 'dominoes', theme: 'tabletop' },
  { item: 'dice cup', theme: 'tabletop' },
  { item: 'jigsaw puzzle', theme: 'tabletop' },
  // Desserts
  { item: 'marshmallow', theme: 'desserts' },
  { item: 'jelly mould', theme: 'desserts' },
  { item: 'custard', theme: 'desserts' },
  // Maritime
  { item: 'anchor chain', theme: 'maritime' },
  { item: 'buoy', theme: 'maritime' },
  { item: 'harbour bell', theme: 'maritime' },
  // Camping
  { item: 'tent peg', theme: 'camping' },
  { item: 'headlamp', theme: 'camping' },
  { item: 'thermos flask', theme: 'camping' },
  // Anatomy
  { item: 'kneecap', theme: 'anatomy' },
  { item: 'eyelash', theme: 'anatomy' },
  { item: 'collarbone', theme: 'anatomy' },
  // Abstract
  { item: 'paperwork', theme: 'abstract' },
  { item: 'hindsight', theme: 'abstract' },
  { item: 'small talk', theme: 'abstract' },
  // Measuring tools
  { item: 'protractor', theme: 'measuring' },
  { item: 'abacus', theme: 'measuring' },
  { item: 'tape measure', theme: 'measuring' },
  // Beach
  { item: 'surfboard', theme: 'beach' },
  { item: 'seashell', theme: 'beach' },
  { item: 'sunscreen', theme: 'beach' },
  // Garden
  { item: 'watering can', theme: 'garden' },
  { item: 'lawnmower', theme: 'garden' },
  { item: 'scarecrow', theme: 'garden' },
  // School
  { item: 'chalkboard', theme: 'school' },
  { item: 'pencil sharpener', theme: 'school' },
  { item: 'lunchbox', theme: 'school' },
  // Bakery
  { item: 'croissant', theme: 'bakery' },
  { item: 'rolling pin', theme: 'bakery' },
  { item: 'sourdough loaf', theme: 'bakery' },
  // Night sky
  { item: 'constellation', theme: 'night_sky' },
  { item: 'shooting star', theme: 'night_sky' },
  { item: 'telescope', theme: 'night_sky' },
  // Workshop
  { item: 'wrench', theme: 'workshop' },
  { item: 'sandpaper', theme: 'workshop' },
  { item: 'toolbox', theme: 'workshop' },
  // Forest
  { item: 'pinecone', theme: 'forest' },
  { item: 'acorn', theme: 'forest' },
  { item: 'campfire', theme: 'forest' },
  // Cinema
  { item: 'popcorn bucket', theme: 'cinema' },
  { item: 'clapperboard', theme: 'cinema' },
  { item: 'film reel', theme: 'cinema' },
  // Winter
  { item: 'snowman', theme: 'winter' },
  { item: 'icicle', theme: 'winter' },
  { item: 'earmuffs', theme: 'winter' },
  // Magic
  { item: 'top hat', theme: 'magic' },
  { item: 'magic wand', theme: 'magic' },
  { item: 'deck of cards', theme: 'magic' },
  // Farm
  { item: 'tractor', theme: 'farm' },
  { item: 'haystack', theme: 'farm' },
  { item: 'windmill', theme: 'farm' },
  // Travel
  { item: 'passport', theme: 'travel' },
  { item: 'luggage carousel', theme: 'travel' },
  { item: 'boarding pass', theme: 'travel' },
  // Gym
  { item: 'dumbbell', theme: 'gym' },
  { item: 'treadmill', theme: 'gym' },
  { item: 'yoga mat', theme: 'gym' },
  // Pets
  { item: 'scratching post', theme: 'pets' },
  { item: 'chew toy', theme: 'pets' },
  { item: 'fish bowl', theme: 'pets' },
  // Medical
  { item: 'stethoscope', theme: 'medical' },
  { item: 'thermometer', theme: 'medical' },
  { item: 'bandage', theme: 'medical' },
  // Amusement park
  { item: 'roller coaster', theme: 'fairground' },
  { item: 'cotton candy', theme: 'fairground' },
  { item: 'ferris wheel', theme: 'fairground' },
  // Photography
  { item: 'tripod', theme: 'photography' },
  { item: 'camera lens', theme: 'photography' },
  { item: 'polaroid', theme: 'photography' },
  // Chores
  { item: 'clothes peg', theme: 'chores' },
  { item: 'ironing board', theme: 'chores' },
  { item: 'feather duster', theme: 'chores' },
  // Art
  { item: 'easel', theme: 'art' },
  { item: 'paintbrush', theme: 'art' },
  { item: 'palette', theme: 'art' },
  // Sleep
  { item: 'pillowcase', theme: 'sleep' },
  { item: 'alarm clock', theme: 'sleep' },
  { item: 'sleep mask', theme: 'sleep' },
];

/** Fisher-Yates shuffle on a copy of the array. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface RevCatTriplet {
  items: string[];
  themes: string[];
}

/** How many items make a round. */
export const REV_CAT_TRIPLET_SIZE = 3;

/**
 * Picks a triplet of items that never shares a theme, preferring items this
 * room has not played yet. Falls back to the whole pool once the fresh items
 * run out, and only repeats a theme if the pool is ever too small to avoid it.
 */
export function pickUnrelatedTriplet(usedItems: string[] = []): RevCatTriplet {
  const fresh = shuffle(REVERSE_CATEGORIES_ITEMS.filter((i) => !usedItems.includes(i.item)));
  const pool = fresh.length >= REV_CAT_TRIPLET_SIZE ? fresh : shuffle(REVERSE_CATEGORIES_ITEMS);

  const picked: ReverseCategoriesItem[] = [];
  const themes = new Set<string>();

  for (const entry of pool) {
    if (themes.has(entry.theme)) continue;
    themes.add(entry.theme);
    picked.push(entry);
    if (picked.length === REV_CAT_TRIPLET_SIZE) break;
  }

  // Defensive top-up: only reachable if the pool somehow lacks distinct themes.
  if (picked.length < REV_CAT_TRIPLET_SIZE) {
    for (const entry of pool) {
      if (picked.includes(entry)) continue;
      picked.push(entry);
      if (picked.length === REV_CAT_TRIPLET_SIZE) break;
    }
  }

  return {
    items: picked.map((entry) => entry.item),
    themes: picked.map((entry) => entry.theme),
  };
}
