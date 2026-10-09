/**
 * Guess the Link — Prompt Data
 * 44 original concepts, each with 6 distinct hint angles pointing at the same
 * hidden concept. Content is 100% original and not copied from any commercial
 * board game such as Codenames or Linkee.
 *
 * Each round the server hides one concept and deals a DIFFERENT angle to every
 * player, so nobody sees the concept itself — only their own single hint.
 */

export interface GuessTheLinkPrompt {
  concept: string;
  category: string;
  /** Alternate answers accepted as a correct guess (nicknames, spellings). */
  accepted?: string[];
  /** Six distinct angles on the same concept. */
  hints: string[];
}

export const GTL_PROMPTS: GuessTheLinkPrompt[] = [
  {
    concept: 'Pizza',
    category: 'Food & Drink',
    accepted: ['pizza pie'],
    hints: ['Italian import', 'Round and sliced', 'Arrives in a box', 'Cheesy pull', 'Wood-fired favourite', 'Late-night order'],
  },
  {
    concept: 'Lighthouse',
    category: 'Places',
    hints: ['Coastline sentinel', 'Sweeping beam', 'Striped tower', 'Warns passing ships', "Keeper's workplace", 'Storm-proof lamp'],
  },
  {
    concept: 'Rollercoaster',
    category: 'Fun & Rides',
    accepted: ['roller coaster'],
    hints: ['Queasy loop', 'Screams allowed', 'Safety bar down', 'Long queue first', 'Upside-down moment', 'Theme park headline'],
  },
  {
    concept: 'Cactus',
    category: 'Nature',
    hints: ['Desert survivor', 'Water hoarder', 'Spiky hug', 'Slow grower', 'Potted companion', 'Rarely needs watering'],
  },
  {
    concept: 'Snowman',
    category: 'Seasons',
    accepted: ['snow man'],
    hints: ['Three stacked balls', 'Carrot nose', 'Coal smile', 'Scarf and twigs', 'Melts by afternoon', 'Built after snowfall'],
  },
  {
    concept: 'Bicycle',
    category: 'Travel',
    accepted: ['bike', 'cycle'],
    hints: ['Pedal power', 'Two wheels', 'Ring-ring warning', 'City commuter', 'No engine needed', 'Chain and gears'],
  },
  {
    concept: 'Coffee',
    category: 'Food & Drink',
    accepted: ['espresso', 'java'],
    hints: ['Morning ritual', 'Bitter warmth', 'Barista craft', 'Cup that kickstarts', 'Late-night study fuel', 'Ground beans'],
  },
  {
    concept: 'Campfire',
    category: 'Outdoors',
    accepted: ['camp fire'],
    hints: ['Crackling warmth', 'Circle of logs', 'Marshmallow spot', 'Smoke in your eyes', 'Storytelling circle', 'Orange glow at night'],
  },
  {
    concept: 'Birthday party',
    category: 'Celebrations',
    accepted: ['birthday', 'party'],
    hints: ['Candles to blow', 'Wrapped boxes', 'Balloon clutter', 'Yearly milestone', 'Wish before cutting', 'Friends sing badly'],
  },
  {
    concept: 'Library',
    category: 'Places',
    hints: ['Whisper zone', 'Borrowed stacks', 'Silence rule', 'Overdue fines', 'Card catalogue past', 'Study carrels'],
  },
  {
    concept: 'Volcano',
    category: 'Nature',
    hints: ['Angry mountain', 'Red river', 'Ash cloud', 'Ring of fire member', 'Lava vent', 'Grumbles before erupting'],
  },
  {
    concept: 'Submarine',
    category: 'Travel',
    accepted: ['sub'],
    hints: ['Periscope peek', 'Pressure hull', 'Silent running', 'Cramped bunks', 'Deep-water tube', 'Torpedo tubes'],
  },
  {
    concept: 'Guitar',
    category: 'Music',
    hints: ['Six strings', 'Campfire companion', 'Strummed chords', 'Wooden body', 'Pick in hand', 'Barre chord pain'],
  },
  {
    concept: 'Spider web',
    category: 'Nature',
    accepted: ['spiderweb', 'cobweb'],
    hints: ['Eight-legged weaver', 'Sticky trap', 'Dew-drop necklace', 'Corner decoration', 'Fly paper', 'Geometry of patience'],
  },
  {
    concept: 'Hospital',
    category: 'Places',
    hints: ['Waiting room', 'Ward rounds', 'Scrubs and beeps', 'Emergency doors', 'Visiting hours', 'Discharge paperwork'],
  },
  {
    concept: 'Train station',
    category: 'Travel',
    accepted: ['railway station', 'station'],
    hints: ['Platform edge', 'Departure board', 'Tracks and sleepers', 'Rush hour crush', 'Whistle blast', 'Ticket gate'],
  },
  {
    concept: 'Ice cream',
    category: 'Food & Drink',
    accepted: ['icecream', 'gelato'],
    hints: ['Melting cone', 'Brain freeze', 'Cold scoop', 'Van with a chime', 'Sticky fingers', 'Sundae base'],
  },
  {
    concept: 'Chess',
    category: 'Games',
    hints: ['Two silent armies', 'Checkmate ending', 'Board of squares', 'Pawn sacrifice', 'Castling move', 'Clock pressure'],
  },
  {
    concept: 'Fireworks',
    category: 'Celebrations',
    hints: ['Midnight sky bursts', 'Loud bangs', 'Fizzing fuse', 'Sparkler cousin', 'Colours overhead', 'Dogs hate them'],
  },
  {
    concept: 'Rainforest',
    category: 'Nature',
    accepted: ['rain forest', 'jungle'],
    hints: ['Canopy layers', 'Constant drizzle', 'Loud insects', 'Green tangle', 'Rare medicine source', 'Thick humidity'],
  },
  {
    concept: 'Astronaut',
    category: 'Jobs',
    hints: ['Zero gravity', 'Bulky suit', 'Orbit duty', 'Spacewalk vacuum', 'Mission patch', 'Training in pools'],
  },
  {
    concept: 'Bakery',
    category: 'Places',
    hints: ['Early start', 'Flour cloud', 'Warm aroma', 'Bread racks', 'Icing bags', 'Queue at dawn'],
  },
  {
    concept: 'Penguin',
    category: 'Animals',
    hints: ['Tuxedo look', 'Antarctic colony', 'Waddle walk', 'Fish diet', 'Ice slide', 'Huddle for warmth'],
  },
  {
    concept: 'Cinema',
    category: 'Places',
    accepted: ['movie theater', 'movie theatre', 'the movies'],
    hints: ['Darkened room', 'Giant screen', 'Popcorn rustle', 'Opening credits', 'Armrest battle', 'Projector beam'],
  },
  {
    concept: 'Umbrella',
    category: 'Objects',
    hints: ['Rain shield', 'Folds to a stick', 'Forgotten on the bus', 'Canopy spread', 'Wind flips it inside out', 'Handbag staple'],
  },
  {
    concept: 'Toothbrush',
    category: 'Objects',
    accepted: ['tooth brush'],
    hints: ['Twice-daily duty', 'Bristle head', 'Bathroom cup', 'Dentist approved', 'Paste partner', 'Two-minute rule'],
  },
  {
    concept: 'Marathon',
    category: 'Sport',
    hints: ['Twenty-six miles', 'Hitting the wall', 'Number bib', 'Water stations', 'Blistered feet', 'Finish-line medal'],
  },
  {
    concept: 'Karaoke',
    category: 'Fun & Games',
    hints: ['Lyrics on screen', 'Off-key howl', 'Private booth', 'Microphone courage', 'Audience of friends', 'Song-choice regret'],
  },
  {
    concept: 'Museum',
    category: 'Places',
    hints: ['Do not touch', 'Roped-off exhibits', 'Audio guide', 'Ancient pots', 'Gift shop exit', 'School trip memory'],
  },
  {
    concept: 'Magnet',
    category: 'Science',
    hints: ['Invisible pull', 'Fridge clutter', 'North meets south', 'Iron filing map', 'Sticks like glue', 'Wipes hotel key cards'],
  },
  {
    concept: 'Hot air balloon',
    category: 'Travel',
    accepted: ['balloon', 'hot-air balloon'],
    hints: ['Wicker basket', 'Burner blast', 'Dawn flight', 'Slow drift', 'Bumpy landing', 'Colourful envelope'],
  },
  {
    concept: 'Desert',
    category: 'Places',
    hints: ['Endless dunes', 'No shade anywhere', 'Camel trains', 'Cold at night', 'Mirages', 'Sand in everything'],
  },
  {
    concept: 'Piano',
    category: 'Music',
    hints: ['Eighty-eight keys', 'Black and white', 'Pedals and hammers', 'Childhood lessons', 'Grand or upright', 'Scales practice'],
  },
  {
    concept: 'Honey',
    category: 'Food & Drink',
    hints: ['Busy bees', 'Sticky jar', 'Golden drizzle', 'Never spoils', 'Hexagon cells', 'Bear-shaped bottle'],
  },
  {
    concept: 'Skateboard',
    category: 'Sport',
    accepted: ['skate board'],
    hints: ['Four small wheels', 'Kickflip attempt', 'Grip tape', 'Bruised shins', 'Grind the rail', 'Wobble at first'],
  },
  {
    concept: 'Alarm clock',
    category: 'Objects',
    accepted: ['alarm'],
    hints: ['Rude awakening', 'Snooze button', 'Seven a.m. enemy', 'Beep beep beep', 'Bedside annoyance', 'Weekend spoiler'],
  },
  {
    concept: 'Theatre',
    category: 'Places',
    accepted: ['theater'],
    hints: ['Red curtain', 'Stage lights', 'Programme booklet', 'Interval drinks', 'Standing ovation', 'Costume changes'],
  },
  {
    concept: 'Mountain',
    category: 'Nature',
    hints: ['Thin air', 'Rocky climb', 'Summit flag', 'Snow line', 'Switchback trail', 'Echo call'],
  },
  {
    concept: 'Bubble tea',
    category: 'Food & Drink',
    accepted: ['boba', 'boba tea', 'bubbletea'],
    hints: ['Wide straw', 'Chewy pearls', 'Shake before sipping', 'Sweetness levels', 'Tapioca at the bottom', 'Sealed foil lid'],
  },
  {
    concept: 'Puppy',
    category: 'Animals',
    accepted: ['dog', 'pup'],
    hints: ['Chewed slippers', 'Wagging blur', 'Training pads', 'Adoption day', 'Vet visits', 'Endless energy'],
  },
  {
    concept: 'Mirror',
    category: 'Objects',
    hints: ['Copy of you', 'Bathroom wall', 'Reversed world', 'Seven years bad luck', 'Selfie spot', 'Never blinks'],
  },
  {
    concept: 'Surfing',
    category: 'Sport',
    accepted: ['surf'],
    hints: ['Waxed board', 'Waiting for sets', 'Wipeout tumble', 'Salt water up your nose', 'Dawn patrol', 'Tube ride'],
  },
  {
    concept: 'Meteor shower',
    category: 'Nature',
    accepted: ['meteor', 'shooting stars', 'meteor shower'],
    hints: ['Wish-making night', 'Falling streaks', 'Dark sky trip', 'Annual peak', 'Cosmic dust', 'Look up, not down'],
  },
  {
    concept: 'Telescope',
    category: 'Science',
    hints: ["Stargazer's tool", 'Tripod legs', 'Lens and tube', 'Backyard astronomy', 'Galaxy hunting', 'Pointed upward at night'],
  },
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

/**
 * Returns a random concept, excluding ones already used in this room.
 */
export function getRandomGtlPrompt(excludeConcepts: string[] = []): GuessTheLinkPrompt {
  const pool = GTL_PROMPTS.filter((p) => !excludeConcepts.includes(p.concept));
  const source = pool.length > 0 ? pool : GTL_PROMPTS;
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * Deals one distinct hint angle to each player. Rooms larger than the six
 * available angles reuse them from the top, and `offset` rotates the deal so
 * the same player does not always receive the first hint.
 */
export function dealGtlHints(
  prompt: GuessTheLinkPrompt,
  playerIds: string[],
  offset = 0
): Record<string, string> {
  const angles = shuffle(prompt.hints);
  const rotated =
    angles.length > 0
      ? [...angles.slice(offset % angles.length), ...angles.slice(0, offset % angles.length)]
      : angles;

  const deal: Record<string, string> = {};
  playerIds.forEach((playerId, index) => {
    deal[playerId] = rotated[index % Math.max(1, rotated.length)] || 'Something about it';
  });
  return deal;
}

/** How many words the hidden concept has (a fair nudge for guessers). */
export function gtlConceptWordCount(prompt: GuessTheLinkPrompt): number {
  return prompt.concept.trim().split(/\s+/).length;
}

/* ------------------------------------------------------------------ *
 * Host-authored rounds
 * A host may write their own concept plus up to six hint angles. The
 * validators below are shared so the client can show the same limits
 * the server enforces (the server is always the source of truth).
 * ------------------------------------------------------------------ */

/** Caps keep every guess typeable (guesses max out at 24 characters too). */
export const GTL_MAX_CONCEPT_CHARS = 24;
export const GTL_MAX_CONCEPT_WORDS = 4;
export const GTL_MAX_HINT_CHARS = 32;
export const GTL_MAX_CATEGORY_CHARS = 24;

/** Angles per round: six supports a full table; three is the playable floor. */
export const GTL_MAX_HINTS = 6;
export const GTL_MIN_CUSTOM_HINTS = 3;

export interface GtlCustomPromptInput {
  concept: string;
  category?: string;
  hints?: string[];
}

export type GtlCustomPromptResult =
  | { ok: true; prompt: GuessTheLinkPrompt }
  | { ok: false; error: string };

function cleanGtlField(raw: string): string {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

/** Loose key for duplicate detection: lower-case letters and digits only. */
function gtlKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** True when the host filled in nothing at all (means "use the deck"). */
export function isBlankGtlCustomPrompt(input: GtlCustomPromptInput): boolean {
  return (
    !cleanGtlField(input.concept) &&
    (input.hints || []).every((hint) => !cleanGtlField(hint))
  );
}

/**
 * Validates and normalizes a host-authored concept + hint angles.
 * Rejects a hint that repeats the concept itself (instant giveaway) and
 * silently dedupes repeated angles, keeping the first of each.
 */
export function buildGtlCustomPrompt(input: GtlCustomPromptInput): GtlCustomPromptResult {
  const concept = cleanGtlField(input.concept);
  if (!concept) {
    return { ok: false, error: 'Give the hidden concept a name.' };
  }
  if (concept.length > GTL_MAX_CONCEPT_CHARS) {
    return {
      ok: false,
      error: `Concepts are capped at ${GTL_MAX_CONCEPT_CHARS} characters so everyone can type their guess.`,
    };
  }
  if (concept.split(' ').length > GTL_MAX_CONCEPT_WORDS) {
    return {
      ok: false,
      error: `Keep the concept to ${GTL_MAX_CONCEPT_WORDS} words or fewer.`,
    };
  }

  const category = cleanGtlField(input.category || '').slice(0, GTL_MAX_CATEGORY_CHARS) || 'Custom Round';

  const seen = new Set<string>([gtlKey(concept)]);
  const hints: string[] = [];
  for (const raw of input.hints || []) {
    const hint = cleanGtlField(raw).slice(0, GTL_MAX_HINT_CHARS);
    if (!hint) continue;
    const key = gtlKey(hint);
    if (seen.has(key)) continue; // also drops hints identical to the concept
    seen.add(key);
    hints.push(hint);
    if (hints.length >= GTL_MAX_HINTS) break;
  }

  if (hints.length < GTL_MIN_CUSTOM_HINTS) {
    return {
      ok: false,
      error: `Add at least ${GTL_MIN_CUSTOM_HINTS} different hint angles (up to ${GTL_MAX_HINTS}).`,
    };
  }

  return { ok: true, prompt: { concept, category, hints } };
}
