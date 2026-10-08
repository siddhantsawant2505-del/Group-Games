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
      'Everyone gets the secret word except the Impostor. Take turns giving one-word clues and vote on who is faking.',
    rules: [
      'Every player receives a secret location/word, except one Impostor.',
      'Players submit subtle clues to prove they know the word without revealing it to the Impostor.',
      'Discuss clues, find inconsistencies, and vote to eliminate the Impostor.',
    ],
  },
  {
    id: 'avoid-the-word',
    title: 'Avoid the Word',
    tagline: 'Speak freely, but mind your traps!',
    minPlayers: 3,
    maxPlayers: 10,
    icon: 'ban',
    description:
      'Describe secret topics to your friends without accidentally saying any of the forbidden trap words on your card.',
    rules: [
      'Each player privately receives a target subject and 3 forbidden taboo words.',
      'Describers rotate one at a time and get 45 seconds to talk their subject through.',
      'Everyone else listens and buzzes if a taboo word slips — a majority confirms it.',
      'Score points for clean describes and for buzzes your group confirms.',
    ],
  },
  {
    id: 'mafia',
    title: 'Mafia',
    tagline: 'The village sleeps... who will survive?',
    minPlayers: 4,
    maxPlayers: 16,
    icon: 'detective',
    description:
      'Classic hidden-identity deduction with townspeople, detectives, and secret mafia members eliminating players in the dark.',
    rules: [
      'Secret roles are assigned secretly on each phone screen.',
      'Night phase: Mafia secretly selects a target.',
      'Day phase: Discussion, accusations, and town vote to exile a suspect.',
    ],
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
  },
  {
    id: 'top-100',
    title: 'Top 100',
    tagline: 'Rank the absurd, place your bets!',
    minPlayers: 3,
    maxPlayers: 10,
    icon: 'list-ordered',
    description:
      'Given an outrageous spectrum (1 to 100), players give examples scaled to their secret number. Guess the correct order!',
    rules: [
      'You are dealt a secret number from 1 to 100.',
      'Provide an example matching that exact intensity on the spectrum.',
      'The group must arrange all submitted answers in ascending order.',
    ],
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
  },
];
