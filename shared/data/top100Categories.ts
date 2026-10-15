/**
 * Public Top 100 category vocabulary.
 *
 * The lists themselves live in `shared/data/top100/*.json` and are server-only
 * (a client must never receive a ranking). The *names* of the categories are not
 * secrets — the host needs them to filter which lists a room may draw — so the
 * client imports this file instead of the lists. `npm run validate:top100`
 * fails if a list uses a category that is not declared here.
 */

export interface Top100CategoryOption {
  id: string;
  label: string;
}

export const TOP100_CATEGORY_OPTIONS: Top100CategoryOption[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'brands', label: 'Brands' },
  { id: 'food', label: 'Food & drink' },
  { id: 'geography', label: 'Geography' },
  { id: 'literature', label: 'Books' },
  { id: 'movies', label: 'Movies' },
  { id: 'music', label: 'Music' },
  { id: 'names', label: 'Names' },
  { id: 'olympics', label: 'Olympics' },
  { id: 'population', label: 'Population' },
  { id: 'social-media', label: 'Social media' },
  { id: 'sports', label: 'Sports' },
];

export const TOP100_CATEGORY_IDS: string[] = TOP100_CATEGORY_OPTIONS.map((option) => option.id);

export function top100CategoryLabel(id: string): string {
  return TOP100_CATEGORY_OPTIONS.find((option) => option.id === id)?.label ?? id;
}
