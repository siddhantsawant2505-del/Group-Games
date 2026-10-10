/**
 * Top 100 — Spectrum Prompt Data
 * 22 original 1-to-100 spectra. Every round the server reveals one spectrum
 * and hands each player a unique secret number; players then write an example
 * that fits their own number. Content is 100% original.
 *
 * Each prompt carries six sample examples spread from the low end to the high
 * end of the scale. They exist so simulated bots can write something that
 * actually belongs at their secret number — humans are never shown them.
 */

export interface Top100Prompt {
  id: string;
  category: string;
  /** The 1-end of the spectrum. */
  lowLabel: string;
  /** The 100-end of the spectrum. */
  highLabel: string;
  /** Six examples, ordered low → high, used by simulated bots. */
  examples: string[];
}

export const TOP100_PROMPTS: Top100Prompt[] = [
  {
    id: 'annoyance-disaster',
    category: 'Everyday Life',
    lowLabel: 'mildly annoying',
    highLabel: 'absolute catastrophic disaster',
    examples: [
      'A pen that skips once',
      'Phone at 3% with no charger nearby',
      'Forgot to mute on a work call',
      'Locked out of the house with no shoes',
      'Missed a flight by five minutes',
      'Your house is gone, totally lost',
    ],
  },
  {
    id: 'spice-heat',
    category: 'Food',
    lowLabel: 'barely spicy',
    highLabel: 'mouth-melting inferno',
    examples: [
      'A pinch of black pepper',
      'Mild salsa on a chip',
      'A surprise jalapeño in the taco',
      'A curry that makes you sweat',
      'Ghost pepper wing challenge',
      'A single drop of pure capsaicin',
    ],
  },
  {
    id: 'rain-severity',
    category: 'Weather',
    lowLabel: 'a single drop',
    highLabel: 'world-ending monsoon',
    examples: [
      'One drop on the windscreen',
      'A quick drizzle on the way home',
      'Steady rain all weekend',
      'A flooded street outside the shop',
      'A storm that cancels every flight',
      'A wave swallowing the whole coast',
    ],
  },
  {
    id: 'sandwich-size',
    category: 'Food',
    lowLabel: 'a sad thin slice',
    highLabel: 'an impossible mega-stack',
    examples: [
      'Dry slice of white bread',
      'A cheese toastie with ketchup',
      'Ham and mustard on rye',
      'A triple-decker club with fries',
      'A mountain of Thanksgiving leftovers',
      'Too tall for any human mouth',
    ],
  },
  {
    id: 'embarrassment-level',
    category: 'Feelings',
    lowLabel: 'a tiny cringe',
    highLabel: 'life-ruining humiliation',
    examples: [
      'A typo in your last text',
      'Waving at someone who was not waving',
      'Coughing during a silent exam',
      'Tripping on stage at graduation',
      'Your name mispronounced at an awards show',
      'Saying the wrong name on live television',
    ],
  },
  {
    id: 'speed-scale',
    category: 'Motion',
    lowLabel: 'a sleepy shuffle',
    highLabel: 'faster than physics allows',
    examples: [
      'A tortoise on a Sunday',
      'A brisk walk for the bus',
      'A cyclist freewheeling downhill',
      'A train at full cruise',
      'A jet on afterburner',
      'A particle in a collider',
    ],
  },
  {
    id: 'cooking-effort',
    category: 'Food',
    lowLabel: 'zero effort',
    highLabel: 'a marathon of gourmet labour',
    examples: [
      'Cereal straight from the box',
      'Scrambled eggs with toast',
      'A one-pot pasta dinner',
      'Roast chicken with all the sides',
      'A three-course dinner from scratch',
      'A multi-day croissant project',
    ],
  },
  {
    id: 'horror-intensity',
    category: 'Entertainment',
    lowLabel: 'barely a spook',
    highLabel: 'never sleeping again',
    examples: [
      'A friendly cartoon ghost',
      'A jump scare in a kids film',
      'A classic haunted-house story',
      'A slasher with real tension',
      'Horror so tense you cover your eyes',
      'A film that ends friendships for a week',
    ],
  },
  {
    id: 'gift-size',
    category: 'Celebrations',
    lowLabel: 'a tiny token',
    highLabel: 'overwhelming extravagance',
    examples: [
      'A single scratch card',
      'A scented candle',
      'A nice pair of headphones',
      'A booked weekend getaway',
      'A brand-new car with a bow',
      'A private island with staff',
    ],
  },
  {
    id: 'queue-length',
    category: 'Everyday Life',
    lowLabel: 'walked straight in',
    highLabel: 'an eternity in line',
    examples: [
      'Straight to the front, no wait',
      'Two minutes for a coffee',
      'Twenty minutes at the post office',
      'An hour for a theme park ride',
      'Six hours outside a concert',
      'Three days camping for tickets',
    ],
  },
  {
    id: 'loudness-scale',
    category: 'Sound',
    lowLabel: 'a whisper',
    highLabel: 'unbearable roar',
    examples: [
      'A single page turning',
      'A kettle coming to the boil',
      'A crowded cafe at lunch',
      'A truck passing on wet roads',
      'A jet engine at takeoff',
      'A volcano erupting up close',
    ],
  },
  {
    id: 'hair-tragedy',
    category: 'Everyday Life',
    lowLabel: 'a harmless trim',
    highLabel: 'hair tragedy of the century',
    examples: [
      'A slightly uneven fringe',
      'An inch shorter than you asked',
      'A surprise mullet',
      'A bowl cut from a bored barber',
      'A dye kit gone bright orange',
      'Bald patches and a chemical burn',
    ],
  },
  {
    id: 'heat-intensity',
    category: 'Weather',
    lowLabel: 'pleasantly warm',
    highLabel: 'surface of the sun',
    examples: [
      'A sun-warmed park bench',
      'A cup of tea left to cool a little',
      'A hot bath on a cold night',
      'A car parked in July sun',
      'A sauna turned all the way up',
      'Standing barefoot on volcanic rock',
    ],
  },
  {
    id: 'animal-size',
    category: 'Animals',
    lowLabel: 'fingertip-sized',
    highLabel: 'beyond comprehension',
    examples: [
      'A ladybird on a leaf',
      'A cat asleep on the sofa',
      'A pony in a paddock',
      'An elephant at the zoo',
      'A blue whale surfacing',
      'Something longer than a city block',
    ],
  },
  {
    id: 'pain-scale',
    category: 'Feelings',
    lowLabel: 'a mild twinge',
    highLabel: 'unimaginable agony',
    examples: [
      'A light toe stub',
      'A paper cut on a fingertip',
      'Biting your tongue hard',
      'A twisted ankle on a run',
      'A broken arm with no painkillers',
      'A bare foot on a sea urchin',
    ],
  },
  {
    id: 'bad-smell',
    category: 'Senses',
    lowLabel: 'barely noticeable',
    highLabel: 'evacuate the building',
    examples: [
      'A faint old book smell',
      'Yesterday coffee in the car',
      'Gym socks after a run',
      'A bin left out in summer',
      'A blocked drain in a heatwave',
      'Skunk spray released indoors',
    ],
  },
  {
    id: 'thrill-level',
    category: 'Fun & Rides',
    lowLabel: 'a gentle rock',
    highLabel: 'absolute terror',
    examples: [
      'A playground swing',
      'A slow carousel ride',
      'A log flume at the fair',
      'A medium family coaster',
      'The tallest drop tower in the park',
      'A wing-walk on a biplane',
    ],
  },
  {
    id: 'cleanliness-level',
    category: 'Everyday Life',
    lowLabel: 'spotless',
    highLabel: 'certified biohazard',
    examples: [
      'A freshly bleached kitchen',
      'A tidy desk at the end of the day',
      'A teenager bedroom floor',
      'A fridge of mystery leftovers',
      'A festival toilet on day three',
      'An abandoned house full of mould',
    ],
  },
  {
    id: 'lie-size',
    category: 'Social',
    lowLabel: 'a harmless white lie',
    highLabel: 'a nation-shaking fabrication',
    examples: [
      '"I love your new haircut"',
      '"Traffic was terrible"',
      '"I already sent that email"',
      '"I cannot come, I am sick"',
      '"I studied for the exam"',
      '"This is a completely new invention"',
    ],
  },
  {
    id: 'meeting-length',
    category: 'Work',
    lowLabel: 'a quick check-in',
    highLabel: 'a meeting that outlives you',
    examples: [
      'A two-minute stand-up',
      'A weekly team sync',
      'A monthly all-hands',
      'A half-day budget workshop',
      'An eight-hour training seminar',
      'A conference where every talk repeats the keynote',
    ],
  },
  {
    id: 'traffic-level',
    category: 'Travel',
    lowLabel: 'clear open roads',
    highLabel: 'gridlock apocalypse',
    examples: [
      'An empty early-morning motorway',
      'A brief red light',
      'Slow school-run traffic',
      'Rush hour downtown',
      'A gridlocked motorway in fog',
      'Every road closed, everyone stuck for a day',
    ],
  },
  {
    id: 'helpfulness-level',
    category: 'Social',
    lowLabel: 'completely unhelpful',
    highLabel: 'life-savingly helpful',
    examples: [
      'A shrug and "no idea"',
      'A vague point in the right direction',
      'A decent tip from a stranger',
      'Guiding you through the whole process',
      'Showing up with a van to help you move',
      'Donating an organ to a stranger',
    ],
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
 * Returns a random spectrum, excluding ones already played in this room.
 */
export function getRandomTop100Prompt(excludeIds: string[] = []): Top100Prompt {
  const pool = TOP100_PROMPTS.filter((p) => !excludeIds.includes(p.id));
  const source = pool.length > 0 ? pool : TOP100_PROMPTS;
  return source[Math.floor(Math.random() * source.length)];
}

/** How the spectrum is described everywhere: "1 = low, 100 = high". */
export function top100SpectrumText(prompt: Top100Prompt): string {
  return `1 = ${prompt.lowLabel}, 100 = ${prompt.highLabel}`;
}

/**
 * Deals every player a UNIQUE secret number from 1-100 (never repeated within
 * a round). Returns a playerId -> number map.
 */
export function dealTop100Numbers(playerIds: string[]): Record<string, number> {
  const pool = Array.from({ length: 100 }, (_, i) => i + 1);
  const shuffled = shuffle(pool);

  const deal: Record<string, number> = {};
  playerIds.forEach((playerId, index) => {
    deal[playerId] = shuffled[index % shuffled.length];
  });
  return deal;
}

/**
 * Picks the sample example that best matches a secret number. Used only to
 * simulate bots, never to guide a human player.
 */
export function botExampleForNumber(prompt: Top100Prompt, secretNumber: number): string {
  const clamped = Math.min(100, Math.max(1, Math.round(secretNumber)));
  const bucket = Math.min(
    prompt.examples.length - 1,
    Math.floor(((clamped - 1) / 100) * prompt.examples.length)
  );
  return prompt.examples[bucket];
}
