/**
 * Starter Word List for the Impostor Game.
 * Contains common, everyday nouns organized by theme.
 * Completely original, kid-and-party friendly, easily extensible.
 */

import wordlistData from '../../data/wordlist.json';

export type WordDifficulty = 'easy' | 'medium' | 'hard';

export interface ImpostorWord {
  word: string;
  category: string;
  difficulty?: WordDifficulty;
  contextHint?: string;
}

export interface WordlistDatabase {
  easy: ImpostorWord[];
  medium: ImpostorWord[];
  hard: ImpostorWord[];
}

// Flat list of all 100 thematic non-commercial nouns categorized by difficulty
export const IMPOSTOR_WORDS: ImpostorWord[] = [
  ...wordlistData.easy.map((w) => ({ ...w, difficulty: 'easy' as WordDifficulty })),
  ...wordlistData.medium.map((w) => ({ ...w, difficulty: 'medium' as WordDifficulty })),
  ...wordlistData.hard.map((w) => ({ ...w, difficulty: 'hard' as WordDifficulty })),
];

export const WORDLIST_BY_DIFFICULTY: WordlistDatabase = wordlistData as WordlistDatabase;

/**
 * Returns a random noun from the 100-word list, optionally filtered by difficulty
 */
export function getRandomImpostorWord(difficulty?: WordDifficulty): ImpostorWord {
  const pool = difficulty && WORDLIST_BY_DIFFICULTY[difficulty]
    ? WORDLIST_BY_DIFFICULTY[difficulty]
    : IMPOSTOR_WORDS;

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function getRandomWordFromList(difficulty?: WordDifficulty): ImpostorWord {
  return getRandomImpostorWord(difficulty);
}
