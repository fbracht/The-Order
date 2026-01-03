import { Item, ComparisonPair } from '../types';

/**
 * Directed Graph to handle transitive inference checks
 */
class PreferenceGraph {
  private adj: Map<Item, Set<Item>>;

  constructor() {
    this.adj = new Map();
  }

  addEdge(winner: Item, loser: Item) {
    if (!this.adj.has(winner)) this.adj.set(winner, new Set());
    this.adj.get(winner)!.add(loser);
  }

  // Returns true if there is a path from start to end (implying start > end)
  hasPath(start: Item, end: Item): boolean {
    if (start === end) return true;
    const visited = new Set<Item>();
    const stack = [start];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr === end) return true;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const neighbors = this.adj.get(curr);
      if (neighbors) {
        for (const neighbor of neighbors) {
          stack.push(neighbor);
        }
      }
    }
    return false;
  }
}

/**
 * Generator that yields pairs to compare.
 * It uses a Merge Sort algorithm structure but pauses to ask for comparisons.
 * It checks the graph for transitive inferences before yielding.
 */
export async function* mergeSortGenerator(
  items: Item[],
  graph: PreferenceGraph
): AsyncGenerator<ComparisonPair, Item[], 'LEFT' | 'RIGHT'> {
  if (items.length <= 1) {
    return items;
  }

  const middle = Math.floor(items.length / 2);
  const leftItems = items.slice(0, middle);
  const rightItems = items.slice(middle);

  const sortedLeft: Item[] = yield* mergeSortGenerator(leftItems, graph);
  const sortedRight: Item[] = yield* mergeSortGenerator(rightItems, graph);

  return yield* mergeGenerator(sortedLeft, sortedRight, graph);
}

async function* mergeGenerator(
  left: Item[],
  right: Item[],
  graph: PreferenceGraph
): AsyncGenerator<ComparisonPair, Item[], 'LEFT' | 'RIGHT'> {
  let result: Item[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const lItem = left[i];
    const rItem = right[j];

    // Check inference first
    if (graph.hasPath(lItem, rItem)) {
      // We know Left > Right
      result.push(lItem);
      i++;
    } else if (graph.hasPath(rItem, lItem)) {
      // We know Right > Left
      result.push(rItem);
      j++;
    } else {
      // We don't know, ask the user
      // Yield the pair and wait for result
      const decision: 'LEFT' | 'RIGHT' = yield { left: lItem, right: rItem };
      
      if (decision === 'LEFT') {
        graph.addEdge(lItem, rItem);
        result.push(lItem);
        i++;
      } else {
        graph.addEdge(rItem, lItem);
        result.push(rItem);
        j++;
      }
    }
  }

  // Concatenate remaining
  return result.concat(left.slice(i)).concat(right.slice(j));
}

/**
 * Helper to calculate estimated max comparisons for N items
 * N * log2(N) is a decent approximation for Merge Sort worst case.
 */
export function estimateTotalComparisons(n: number): number {
  if (n <= 1) return 0;
  return Math.ceil(n * Math.log2(n));
}
