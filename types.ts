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
  items: Item[];
  edges: [string, string][]; // Directed edges: [Winner ID, Loser ID]
  finalItems?: Item[];
}

export type ComparisonPair = {
  left: Item;
  right: Item;
};

// For the ranking engine generator
export type ComparisonResult = 'LEFT' | 'RIGHT';
