/**
 * Avoid the Word — Prompt Data
 * 40 original subjects, each with exactly 3 forbidden "taboo" words.
 * Content is 100% original and not copied from any commercial board game.
 */

export interface AvoidTheWordPrompt {
  subject: string;
  category: string;
  forbidden: [string, string, string];
}

export const ATW_PROMPTS: AvoidTheWordPrompt[] = [
  { subject: 'Submarine',   category: 'Vehicles',    forbidden: ['water', 'navy', 'underwater'] },
  { subject: 'Skyscraper',  category: 'Buildings',   forbidden: ['tall', 'city', 'floor'] },
  { subject: 'Campfire',    category: 'Outdoors',    forbidden: ['fire', 'wood', 'smoke'] },
  { subject: 'Telescope',   category: 'Science',     forbidden: ['star', 'lens', 'sky'] },
  { subject: 'Backpack',    category: 'Accessories', forbidden: ['bag', 'school', 'carry'] },
  { subject: 'Lighthouse',  category: 'Structures',  forbidden: ['light', 'coast', 'ship'] },
  { subject: 'Skateboard',  category: 'Sports',      forbidden: ['board', 'wheels', 'skate'] },
  { subject: 'Microwave',   category: 'Appliances',  forbidden: ['heat', 'kitchen', 'cook'] },
  { subject: 'Hammock',     category: 'Furniture',   forbidden: ['hang', 'relax', 'sleep'] },
  { subject: 'Compass',     category: 'Navigation',  forbidden: ['north', 'direction', 'needle'] },
  { subject: 'Trampoline',  category: 'Recreation',  forbidden: ['jump', 'bounce', 'spring'] },
  { subject: 'Cactus',      category: 'Plants',      forbidden: ['desert', 'spike', 'dry'] },
  { subject: 'Elevator',    category: 'Buildings',   forbidden: ['floor', 'button', 'lift'] },
  { subject: 'Firework',    category: 'Celebrations',forbidden: ['sky', 'explode', 'night'] },
  { subject: 'Kaleidoscope',category: 'Toys',        forbidden: ['color', 'tube', 'pattern'] },
  { subject: 'Escalator',   category: 'Buildings',   forbidden: ['stairs', 'move', 'step'] },
  { subject: 'Periscope',   category: 'Devices',     forbidden: ['submarine', 'mirror', 'look'] },
  { subject: 'Igloo',       category: 'Shelters',    forbidden: ['ice', 'cold', 'snow'] },
  { subject: 'Tornado',     category: 'Weather',     forbidden: ['wind', 'spin', 'storm'] },
  { subject: 'Suitcase',    category: 'Travel',      forbidden: ['travel', 'bag', 'pack'] },
  { subject: 'Gargoyle',    category: 'Architecture',forbidden: ['stone', 'roof', 'monster'] },
  { subject: 'Quicksand',   category: 'Nature',      forbidden: ['sand', 'sink', 'stuck'] },
  { subject: 'Boomerang',   category: 'Toys',        forbidden: ['throw', 'return', 'curve'] },
  { subject: 'Piñata',      category: 'Celebrations',forbidden: ['candy', 'hit', 'party'] },
  { subject: 'Glacier',     category: 'Geography',   forbidden: ['ice', 'cold', 'melt'] },
  { subject: 'Catapult',    category: 'History',     forbidden: ['launch', 'stone', 'siege'] },
  { subject: 'Pretzel',     category: 'Food',        forbidden: ['twist', 'salt', 'bread'] },
  { subject: 'Windmill',    category: 'Structures',  forbidden: ['wind', 'blade', 'turn'] },
  { subject: 'Accordion',   category: 'Music',       forbidden: ['squeeze', 'bellows', 'fold'] },
  { subject: 'Sundial',     category: 'Timekeeping', forbidden: ['shadow', 'time', 'sun'] },
  { subject: 'Staple',      category: 'Office',      forbidden: ['paper', 'metal', 'clip'] },
  { subject: 'Pothole',     category: 'Urban',       forbidden: ['road', 'hole', 'car'] },
  { subject: 'Blizzard',    category: 'Weather',     forbidden: ['snow', 'cold', 'storm'] },
  { subject: 'Silo',        category: 'Agriculture', forbidden: ['grain', 'farm', 'tall'] },
  { subject: 'Drawbridge',  category: 'Structures',  forbidden: ['castle', 'raise', 'water'] },
  { subject: 'Porcupine',   category: 'Animals',     forbidden: ['spike', 'quill', 'sharp'] },
  { subject: 'Treadmill',   category: 'Fitness',     forbidden: ['run', 'belt', 'gym'] },
  { subject: 'Percolator',  category: 'Appliances',  forbidden: ['coffee', 'brew', 'drip'] },
  { subject: 'Lava Lamp',   category: 'Decor',       forbidden: ['light', 'bubble', 'glow'] },
  { subject: 'Zipline',     category: 'Adventure',   forbidden: ['cable', 'slide', 'rope'] },
];

/**
 * Returns a random prompt, excluding recently used ones
 */
export function getRandomAtwPrompt(excludeSubjects: string[] = []): AvoidTheWordPrompt {
  const pool = ATW_PROMPTS.filter((p) => !excludeSubjects.includes(p.subject));
  const source = pool.length > 0 ? pool : ATW_PROMPTS;
  return source[Math.floor(Math.random() * source.length)];
}
