export type ListType = 'TEXT' | 'IMAGES';

export interface Item {
  /** Stable internal key used by the ranking graph and React. */
  id: string;
  /** Human-readable text shown in comparisons, results, and shared output. */
  label: string;
  /** Browser-local source for an uploaded image. Omitted for text lists. */
  imageUrl?: string;
}

export interface RankingState {
  status: 'INPUT' | 'COMPARING' | 'RESULTS';
  listType: ListType;
  /** The list in the order it is asked about (shuffled when ranking starts). */
  items: Item[];
  /** The list in the order the user entered it, for going back to edit. */
  inputItems?: Item[];
  edges: [string, string][]; // Directed edges: [Winner ID, Loser ID]
  finalItems?: Item[];
  /** The user's own name for the ranking; unset means the default title. */
  title?: string;
  /** When the ranking was finished (milliseconds since 1970). */
  finishedAt?: number;
}

export type ComparisonPair = {
  left: Item;
  right: Item;
};
