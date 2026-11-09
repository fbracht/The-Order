import { Item, ComparisonPair } from '../types';

/**
 * Ranking engine.
 *
 * The ranking is a merge sort whose comparisons are answered by the user.
 * `getRankingState` is a pure function of (items, answers so far): it re-runs
 * the sort, answering every comparison it can from the recorded answers, and
 * stops at the first one it cannot. That makes resume-after-reload and undo
 * trivial: change the list of answers and call it again.
 *
 * Two question orders share the same code and cost the same number of
 * questions for a full ranking:
 *
 * - eager (short lists): the classic order. Sort each half completely, then
 *   merge. Nothing is settled until the last merge.
 * - lazy (long lists): each merge only does the work needed to produce its
 *   next-best item. The overall winner is known after n - 1 questions and
 *   each further place costs about log2(n) more, so places settle from first
 *   downward and the user can stop early with a Top N.
 */

/** Lists at least this long settle from the top down and offer a Top N. */
export const TOP_N_MIN_ITEMS = 30;
const TOP_N_CHECKPOINTS = [5, 10, 20, 25, 50, 100];

/** The Top N sizes offered for a list of n items: only up to half the list. */
export function checkpointsFor(n: number): number[] {
  if (n < TOP_N_MIN_ITEMS) return [];
  return TOP_N_CHECKPOINTS.filter(k => k * 2 <= n);
}

/**
 * Expected questions left in a merge with l and r items still to place,
 * assuming every interleaving is equally likely. It is less than l + r - 1
 * because one side usually runs out early and the rest is placed for free.
 */
function expectedMerge(l: number, r: number): number {
  if (l <= 0 || r <= 0) return 0;
  return l + r - l / (r + 1) - r / (l + 1);
}

const totalCache = new Map<number, number>();

/** Expected number of questions to fully rank n items. */
export function expectedTotalComparisons(n: number): number {
  if (n <= 1) return 0;
  const cached = totalCache.get(n);
  if (cached !== undefined) return cached;
  const l = Math.floor(n / 2);
  const r = n - l;
  const total = expectedTotalComparisons(l) + expectedTotalComparisons(r) + expectedMerge(l, r);
  totalCache.set(n, total);
  return total;
}

/** Rounded estimate shown before a ranking starts. */
export function estimateTotalComparisons(n: number): number {
  return Math.round(expectedTotalComparisons(n));
}

// --- Merge tree -----------------------------------------------------------

/** Returns true when a beats b. May throw to signal "not known yet". */
type Ask = (a: Item, b: Item) => boolean;

interface Stream {
  /** The best item not yet taken, or null when empty. */
  peek(): Item | null;
  pop(): Item | null;
  /** Expected questions still needed to drain this stream. */
  expected(): number;
}

class ListStream implements Stream {
  private index = 0;
  constructor(private items: Item[]) {}
  peek() { return this.index < this.items.length ? this.items[this.index] : null; }
  pop() { return this.index < this.items.length ? this.items[this.index++] : null; }
  expected() { return 0; }
}

class MergeStream implements Stream {
  // undefined: the next item has not been decided yet
  private head: Item | null | undefined = undefined;
  private headFromLeft = false;
  private prepared = false;

  constructor(
    private left: Stream,
    private right: Stream,
    // Items on each side that have not yet won a place in this merge
    private remainingLeft: number,
    private remainingRight: number,
    private ask: Ask,
    private eager: boolean
  ) {}

  peek(): Item | null {
    if (this.head !== undefined) return this.head;

    if (this.eager && !this.prepared) {
      // Classic order: finish sorting both halves before merging them.
      this.left = drainToList(this.left);
      this.right = drainToList(this.right);
      this.prepared = true;
    }

    const l = this.left.peek();
    const r = this.right.peek();

    if (l === null && r === null) {
      this.head = null;
    } else if (r === null || (l !== null && this.ask(l, r))) {
      this.head = l;
      this.headFromLeft = true;
      this.remainingLeft--;
    } else {
      this.head = r;
      this.headFromLeft = false;
      this.remainingRight--;
    }
    return this.head;
  }

  pop(): Item | null {
    const head = this.peek();
    if (head !== null) {
      (this.headFromLeft ? this.left : this.right).pop();
      this.head = undefined;
    }
    return head;
  }

  expected(): number {
    return expectedMerge(this.remainingLeft, this.remainingRight) + this.left.expected() + this.right.expected();
  }
}

function drainToList(stream: Stream): Stream {
  if (stream instanceof ListStream) return stream;
  const items: Item[] = [];
  for (let item = stream.pop(); item !== null; item = stream.pop()) items.push(item);
  return new ListStream(items);
}

function buildTree(items: Item[], ask: Ask, eager: boolean): Stream {
  if (items.length <= 1) return new ListStream(items);
  const middle = Math.floor(items.length / 2);
  return new MergeStream(
    buildTree(items.slice(0, middle), ask, eager),
    buildTree(items.slice(middle), ask, eager),
    middle,
    items.length - middle,
    ask,
    eager
  );
}

// --- Public API -----------------------------------------------------------

export interface RankingProgress {
  /** The question to ask next, or null when the ranking is complete. */
  pair: ComparisonPair | null;
  /**
   * Places settled so far, best first. For long lists this grows from the top
   * as questions are answered; for short lists it fills in at the very end.
   */
  ranked: Item[];
  done: boolean;
  /** Expected questions still to come. */
  expectedRemaining: number;
}

/** Thrown inside the sort when it reaches a comparison with no answer yet. */
class Unanswered {
  constructor(public pair: ComparisonPair) {}
}

export function getRankingState(items: Item[], edges: [string, string][]): RankingProgress {
  // winner id -> ids it was chosen over
  const beats = new Map<string, Set<string>>();
  for (const [winner, loser] of edges) {
    if (!beats.has(winner)) beats.set(winner, new Set());
    beats.get(winner)!.add(loser);
  }

  const hasPath = (from: string, to: string): boolean => {
    const stack = [from];
    const visited = new Set<string>([from]);
    while (stack.length > 0) {
      const current = stack.pop()!;
      const next = beats.get(current);
      if (!next) continue;
      if (next.has(to)) return true;
      for (const id of next) {
        if (!visited.has(id)) {
          visited.add(id);
          stack.push(id);
        }
      }
    }
    return false;
  };

  // The sides of the previous question, so that an item carried from one
  // question to the next stays where it was on screen.
  let lastLeft: string | null = null;
  let lastRight: string | null = null;

  const ask: Ask = (a, b) => {
    const swap = a.id === lastRight || b.id === lastLeft;
    const left = swap ? b : a;
    const right = swap ? a : b;

    let aWins: boolean | null = null;
    if (beats.get(a.id)?.has(b.id)) aWins = true;
    else if (beats.get(b.id)?.has(a.id)) aWins = false;
    // Merge sort never asks a question it could infer, so this only matters
    // for sessions saved under a different question order.
    else if (hasPath(a.id, b.id)) aWins = true;
    else if (hasPath(b.id, a.id)) aWins = false;

    if (aWins === null) throw new Unanswered({ left, right });

    lastLeft = left.id;
    lastRight = right.id;
    return aWins;
  };

  const eager = items.length < TOP_N_MIN_ITEMS;
  const root = buildTree(items, ask, eager);
  const ranked: Item[] = [];

  try {
    for (let item = root.pop(); item !== null; item = root.pop()) ranked.push(item);
    return { pair: null, ranked, done: true, expectedRemaining: 0 };
  } catch (signal) {
    if (!(signal instanceof Unanswered)) throw signal;
    return {
      pair: signal.pair,
      ranked,
      done: false,
      // The pending question itself counts as remaining.
      expectedRemaining: Math.max(1, root.expected()),
    };
  }
}

const topCache = new Map<string, number>();

/**
 * Expected questions until the top k places of an n-item list are settled,
 * measured by running the sort on random orderings.
 */
export function estimateTopComparisons(n: number, k: number): number {
  const key = `${n}:${k}`;
  const cached = topCache.get(key);
  if (cached !== undefined) return cached;

  const RUNS = 24;
  let total = 0;
  for (let run = 0; run < RUNS; run++) {
    const strength = new Map<string, number>();
    const items: Item[] = [];
    for (let i = 0; i < n; i++) {
      const id = String(i);
      items.push({ id, label: id });
      strength.set(id, Math.random());
    }
    let asked = 0;
    const root = buildTree(items, (a, b) => {
      asked++;
      return strength.get(a.id)! > strength.get(b.id)!;
    }, false);
    for (let place = 0; place < k; place++) root.pop();
    total += asked;
  }

  const estimate = Math.round(total / RUNS);
  topCache.set(key, estimate);
  return estimate;
}
