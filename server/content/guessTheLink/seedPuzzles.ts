/**
 * Seed puzzles for Guess the Link.
 *
 * These ship with the server so the game is always playable with zero AI and
 * zero images: every clue carries a concrete emoji tile. The library pipeline
 * (see puzzleLibrary.ts) layers generated, illustrated puzzles on top.
 *
 * Secret: this module is server-only. The link never appears in client state
 * before the round's results.
 */

import { GuessLinkPuzzle } from '../../../shared/types';

type Seed = Omit<GuessLinkPuzzle, 'quality' | 'createdAt' | 'useCount' | 'id'> & { id: string };

const RAW: Seed[] = [
  {
    id: 'seed-fire',
    link: 'fire',
    aliases: ['fire', 'fires', 'flame', 'flames'],
    linkType: 'shared-word',
    difficulty: 1,
    hint: 'Every picture is a compound word that starts with the same 4 letters.',
    items: [
      { name: 'Fire truck', emoji: '🚒', imagePrompt: 'a red fire truck with a ladder' },
      { name: 'Firefly', emoji: '🪰', imagePrompt: 'a glowing firefly at night' },
      { name: 'Fireplace', emoji: '🔥', imagePrompt: 'a cosy brick fireplace with logs' },
    ],
    botWrongGuesses: ['water', 'red', 'truck', 'summer'],
  },
  {
    id: 'seed-snow',
    link: 'snow',
    aliases: ['snow', 'snowy', 'winter', 'snowfall'],
    linkType: 'shared-word',
    difficulty: 1,
    hint: 'All three are compound words built on the same white thing.',
    items: [
      { name: 'Snowman', emoji: '⛄', imagePrompt: 'a cheerful snowman with a carrot nose' },
      { name: 'Snowflake', emoji: '❄️', imagePrompt: 'a single detailed snowflake' },
      { name: 'Snowboard', emoji: '🏂', imagePrompt: 'a snowboard standing in fresh snow' },
    ],
    botWrongGuesses: ['ice', 'cold', 'christmas', 'mountain'],
  },
  {
    id: 'seed-shell',
    link: 'shell',
    aliases: ['shell', 'shells', 'hard shell', 'outer shell'],
    linkType: 'shared-property',
    difficulty: 2,
    hint: 'All three have the same hard outer covering.',
    items: [
      { name: 'Turtle', emoji: '🐢', imagePrompt: 'a turtle seen from above' },
      { name: 'Snail', emoji: '🐌', imagePrompt: 'a snail with a spiral shell' },
      { name: 'Walnut', emoji: '🌰', imagePrompt: 'a whole walnut in its shell' },
    ],
    botWrongGuesses: ['slow', 'brown', 'nuts', 'water'],
  },
  {
    id: 'seed-wheel',
    link: 'wheel',
    aliases: ['wheel', 'wheels', 'steering wheel', 'turning wheel'],
    linkType: 'shared-word',
    difficulty: 1,
    hint: 'One round part is hidden inside all three words.',
    items: [
      { name: 'Bicycle', emoji: '🚲', imagePrompt: 'a bicycle side view' },
      { name: 'Ferris wheel', emoji: '🎡', imagePrompt: 'a big ferris wheel at a fair' },
      { name: 'Wheelbarrow', emoji: '🛒', imagePrompt: 'a garden wheelbarrow full of soil' },
    ],
    botWrongGuesses: ['round', 'spokes', 'transport', 'fair'],
  },
  {
    id: 'seed-keys',
    link: 'keys',
    aliases: ['key', 'keys', 'keyboard keys', 'piano keys'],
    linkType: 'shared-word',
    difficulty: 2,
    hint: 'A word that means both something you press and something you unlock.',
    items: [
      { name: 'Piano', emoji: '🎹', imagePrompt: 'a piano keyboard close up' },
      { name: 'Door lock', emoji: '🔑', imagePrompt: 'a brass key in a door lock' },
      { name: 'Computer keyboard', emoji: '⌨️', imagePrompt: 'a simple computer keyboard' },
    ],
    botWrongGuesses: ['music', 'door', 'black and white', 'typing'],
  },
  {
    id: 'seed-stars',
    link: 'stars',
    aliases: ['star', 'stars', 'starry', 'five stars'],
    linkType: 'shared-property',
    difficulty: 2,
    hint: 'Each picture famously shows this shape somewhere.',
    items: [
      { name: 'Starfish', emoji: '⭐', imagePrompt: 'a starfish on wet sand' },
      { name: 'Night sky', emoji: '🌌', imagePrompt: 'a clear night sky full of stars' },
      { name: 'Movie rating', emoji: '🎬', imagePrompt: 'a film clapperboard with five stars above it' },
    ],
    botWrongGuesses: ['night', 'sea', 'shine', 'five'],
  },
  {
    id: 'seed-trunk',
    link: 'trunk',
    aliases: ['trunk', 'trunks', 'tree trunk', 'elephant trunk'],
    linkType: 'shared-word',
    difficulty: 2,
    hint: 'One word names three very different long things.',
    items: [
      { name: 'Elephant', emoji: '🐘', imagePrompt: 'an elephant side view' },
      { name: 'Tree', emoji: '🌳', imagePrompt: 'a big oak tree' },
      { name: 'Car boot', emoji: '🚗', imagePrompt: 'a car with its rear boot open' },
    ],
    botWrongGuesses: ['nose', 'bark', 'luggage', 'big'],
  },
  {
    id: 'seed-brush',
    link: 'brush',
    aliases: ['brush', 'brushes', 'hairbrush', 'paintbrush'],
    linkType: 'shared-word',
    difficulty: 1,
    hint: 'Each one ends with the same tool.',
    items: [
      { name: 'Toothbrush', emoji: '🪥', imagePrompt: 'a toothbrush with toothpaste' },
      { name: 'Paintbrush', emoji: '🎨', imagePrompt: 'a paintbrush on a paint palette' },
      { name: 'Hairbrush', emoji: '💈', imagePrompt: 'a wooden hairbrush' },
    ],
    botWrongGuesses: ['clean', 'hair', 'paint', 'bathroom'],
  },
  {
    id: 'seed-flight',
    link: 'things that fly',
    aliases: ['fly', 'flying', 'things that fly', 'flight'],
    linkType: 'shared-property',
    difficulty: 1,
    hint: 'None of them stays on the ground for long.',
    items: [
      { name: 'Aeroplane', emoji: '✈️', imagePrompt: 'an aeroplane in a blue sky' },
      { name: 'Kite', emoji: '🪁', imagePrompt: 'a colourful kite on a string' },
      { name: 'Bee', emoji: '🐝', imagePrompt: 'a bumblebee on a flower' },
    ],
    botWrongGuesses: ['wings', 'sky', 'wind', 'travel'],
  },
  {
    id: 'seed-spots',
    link: 'spots',
    aliases: ['spot', 'spots', 'dotted', 'polka dots'],
    linkType: 'shared-property',
    difficulty: 1,
    hint: 'Look closely: each one is covered in the same pattern.',
    items: [
      { name: 'Ladybird', emoji: '🐞', imagePrompt: 'a red ladybird with black spots' },
      { name: 'Dalmatian', emoji: '🐕', imagePrompt: 'a dalmatian dog sitting' },
      { name: 'Dice', emoji: '🎲', imagePrompt: 'two white dice with black dots' },
    ],
    botWrongGuesses: ['black', 'white', 'dots', 'pattern'],
  },
  {
    id: 'seed-drum',
    link: 'drum',
    aliases: ['drum', 'drums', 'drum kit', 'percussion'],
    linkType: 'shared-word',
    difficulty: 3,
    hint: 'One word is both an instrument and a container.',
    items: [
      { name: 'Oil drum', emoji: '🛢️', imagePrompt: 'a metal oil drum' },
      { name: 'Drum kit', emoji: '🥁', imagePrompt: 'a drum kit with cymbals' },
      { name: 'Ear drum', emoji: '👂', imagePrompt: 'a simple drawing of a human ear' },
    ],
    botWrongGuesses: ['music', 'metal', 'loud', 'ear'],
  },
  {
    id: 'seed-crown',
    link: 'crown',
    aliases: ['crown', 'crowns', 'royal crown', 'tooth crown'],
    linkType: 'shared-word',
    difficulty: 3,
    hint: 'A word that sits on top of a king and inside a mouth.',
    items: [
      { name: 'King', emoji: '👑', imagePrompt: 'a golden crown on a velvet cushion' },
      { name: 'Tooth', emoji: '🦷', imagePrompt: 'a single white tooth' },
      { name: 'Chess board', emoji: '♟️', imagePrompt: 'a chess board with a queen piece' },
    ],
    botWrongGuesses: ['royal', 'gold', 'mouth', 'queen'],
  },
];

export const SEED_LINK_PUZZLES: GuessLinkPuzzle[] = RAW.map((seed) => ({
  ...seed,
  quality: { solverChecked: true, imagesChecked: false, disabled: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  useCount: 0,
}));
