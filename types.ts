export type Item = string;

export interface RankingState {
  status: 'INPUT' | 'COMPARING' | 'RESULTS';
  items: Item[]; // The initial list
  edges: [Item, Item][]; // Directed edges: [Winner, Loser]
}

export type ComparisonPair = {
  left: Item;
  right: Item;
};

// For the ranking engine generator
export type ComparisonResult = 'LEFT' | 'RIGHT';
