import { GameMetadata } from '../types';

export const PARTY_GAMES: GameMetadata[] = [
  {
    id: 'impostor',
    title: 'Impostor',
    tagline: 'Blend in or root out the fake!',
    minPlayers: 3,
    maxPlayers: 12,
    icon: 'mask',
    description:
      'Two modes: hunt the secret word, or answer a question while one player was quietly asked a different one. Clues or answers, then vote out the faker.',
    rules: [
      'Word mode: every player receives a secret word except one Impostor.',
      'Question mode: everyone receives the same question — except the Impostor, who gets a related one.',
      'Players submit private clues (or answers) to prove they belong, without giving the secret away.',
      'Discuss, find inconsistencies, and vote to eliminate the Impostor.',
    ],
    teamSupport: 'aggregate',
  },
  {
    id: 'avoid-the-word',
    title: 'Avoid the Word',
    tagline: "Don't say what they said!",
    minPlayers: 3,
    maxPlayers: 10,
    icon: 'ban',
    description:
      'One anchor answers a hidden question. Everyone else answers the same question and is knocked out if their answer matches — guess what the group would say, or be the last one standing.',
    rules: [
      'Each round an anchor is picked and privately answers a question.',
      'The same question then goes to every other alive player, one turn at a time.',
      'Any answer that matches the anchor is announced live and knocks that player out when the host continues.',
      'The anchor scores a point per match; the last player (or team) standing wins, and winners score 3.',
    ],
    // Team mode is native: a team survives while it has any alive member.
    teamSupport: 'native',
  },
  {
    id: 'mafia',
    title: 'Mafia',
    tagline: 'The village sleeps... who will survive?',
    minPlayers: 4,
    maxPlayers: 16,
    icon: 'detective',
    description:
      'Classic hidden-identity deduction: Townspeople, a Detective and a Doctor against a secret Mafia family. Every night the village acts in private; every day it argues and exiles someone.',
    rules: [
      'Secret roles are dealt on each phone: Mafia, Detective, Doctor and Townspeople.',
      'Night: the Mafia agree on a victim, the Doctor protects someone, the Detective investigates, and everyone else confirms a harmless choice.',
      'Morning: the server narrates what happened overnight; a Detective’s result stays private.',
      'Day: discuss, then vote in secret. A tie or a Skip majority exiles nobody.',
      'Town wins when every Mafia member is gone; Mafia wins at parity.',
    ],
    teamSupport: 'aggregate',
  },
  {
    id: 'guess-the-link',
    title: 'Guess the Link',
    tagline: 'Connect the mysterious clues!',
    minPlayers: 3,
    maxPlayers: 8,
    icon: 'link',
    description:
      'Every player writes an associated clue to an invisible hidden prompt. Uncover the secret thread tying all answers together.',
    rules: [
      'One hidden concept is picked server-side and every player privately receives a different hint angle on it.',
      'Each player writes a one-word or short-phrase response inspired by their own angle.',
      'All responses are revealed together in shuffled order.',
      'Everyone guesses the hidden concept at the same time — +1 point for every correct guess.',
    ],
    teamSupport: 'native',
    comingSoon: true,
  },
  {
    id: 'top-100',
    title: 'Top 100',
    tagline: 'Dig deep into the Top 100!',
    minPlayers: 3,
    maxPlayers: 10,
    icon: 'list-ordered',
    description:
      'Name something on a Top 100 list. The deeper it ranks, the more points you score, but miss the list and you get nothing.',
    rules: [
      'The server picks a hidden Top 100 list — a question about a real ranking you never see in full.',
      'Everyone types one guess: the item on position N scores exactly N points, anything off the list scores 0.',
      'The host can overrule a close call, then the guesses board resolves into points.',
      'Only positions 1-10 and 90-100 are ever revealed — the middle of the list stays a secret.',
      'Team mode: each team submits one guess, with rotating captains and team-only suggestions.',
    ],
    teamSupport: 'shipped',
  },
  {
    id: 'reverse-categories',
    title: 'Reverse Categories',
    tagline: 'Answers first, questions later!',
    minPlayers: 3,
    maxPlayers: 8,
    icon: 'shuffle',
    description:
      'Oddball answers appear on screen. Race against the clock to invent the category or question that makes them all make sense.',
    rules: [
      'Read 3 unrelated words or items.',
      'Invent the funniest or most accurate category linking them all.',
      'Players vote on the most clever category invention.',
    ],
    teamSupport: 'native',
  },
];

/** Games the room can actually launch today (everything without a Coming Soon badge). */
export const PLAYABLE_GAMES: GameMetadata[] = PARTY_GAMES.filter((game) => !game.comingSoon);

/** The fallback selection: the first playable game, or the catalogue's first entry. */
export const DEFAULT_GAME: GameMetadata = PLAYABLE_GAMES[0] ?? PARTY_GAMES[0];
