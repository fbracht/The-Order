import { describe, it, expect } from 'vitest';
import { getRankingState, checkpointsFor, expectedTotalComparisons, TOP_N_MIN_ITEMS } from './rankingEngine';
import { Item } from '../types';

/** n items whose true order is by number, presented in a repeatable shuffled order. */
function makeItems(n: number): Item[] {
  // A small seeded random generator, so every run tests the same lists
  let seed = n * 2654435761;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const values = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.map(value => ({ id: `item-${value}`, label: String(value).padStart(4, '0') }));
}

/** Answers every question truthfully (lower label wins) and records what happened. */
function play(items: Item[]) {
  const edges: [string, string][] = [];
  const progress: number[] = [];
  const settled: number[] = [];
  let sideSwitches = 0;
  let previous: { left: string; right: string } | null = null;

  for (;;) {
    const state = getRankingState(items, edges);
    settled.push(state.ranked.length);
    if (state.done) return { edges, ranked: state.ranked, progress, settled, sideSwitches };

    const { left, right } = state.pair!;
    if (previous && (left.id === previous.right || right.id === previous.left)) sideSwitches++;
    previous = { left: left.id, right: right.id };

    progress.push(edges.length / (edges.length + state.expectedRemaining));
    edges.push(left.label < right.label ? [left.id, right.id] : [right.id, left.id]);
  }
}

const isSorted = (ranked: Item[]) => ranked.every((item, i) => i === 0 || ranked[i - 1].label < item.label);

describe('getRankingState', () => {
  it.each([2, 3, 10, 29, 30, 31, 90, 250])('ranks %i items correctly', n => {
    const items = makeItems(n);
    const { ranked } = play(items);
    expect(ranked).toHaveLength(n);
    expect(isSorted(ranked)).toBe(true);
  });

  it('handles lists with fewer than two items', () => {
    expect(getRankingState([], []).done).toBe(true);
    const one = makeItems(1);
    expect(getRankingState(one, [])).toMatchObject({ done: true, ranked: one, pair: null });
  });

  it.each([10, 90, 250])('never asks more than a merge sort needs (%i items)', n => {
    const { edges } = play(makeItems(n));
    const worstCase = n * Math.ceil(Math.log2(n)) - 2 ** Math.ceil(Math.log2(n)) + 1;
    expect(edges.length).toBeLessThanOrEqual(worstCase);
    // ...and the estimate shown before starting is close to what happens
    expect(Math.abs(edges.length - expectedTotalComparisons(n)) / edges.length).toBeLessThan(0.1);
  });

  it('never asks the same pair twice', () => {
    const { edges } = play(makeItems(90));
    const pairs = new Set(edges.map(([a, b]) => [a, b].sort().join('|')));
    expect(pairs.size).toBe(edges.length);
  });

  it('undo returns to the previous question', () => {
    const items = makeItems(40);
    const { edges } = play(items);
    for (const cut of [1, 17, 60]) {
      const before = getRankingState(items, edges.slice(0, cut - 1)).pair!;
      const answered = edges[cut - 1];
      expect([before.left.id, before.right.id].sort()).toEqual([...answered].sort());
    }
  });

  it('keeps an item on its side when it appears in two questions in a row', () => {
    expect(play(makeItems(40)).sideSwitches).toBe(0);
    expect(play(makeItems(12)).sideSwitches).toBe(0);
  });

  it('progress never goes backwards and stays between 0 and 1', () => {
    for (const n of [12, 90]) {
      const { progress } = play(makeItems(n));
      progress.forEach((value, i) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        if (i > 0) expect(value).toBeGreaterThanOrEqual(progress[i - 1] - 1e-9);
      });
    }
  });

  it('settles long lists from the top, and short lists only at the end', () => {
    const long = play(makeItems(90));
    // The Top 10 is known long before the last question
    const firstTopTen = long.settled.findIndex(count => count >= 10);
    expect(firstTopTen).toBeLessThan(long.edges.length / 2);
    // Settled places are never taken back
    long.settled.forEach((count, i) => { if (i > 0) expect(count).toBeGreaterThanOrEqual(long.settled[i - 1]); });

    const short = play(makeItems(TOP_N_MIN_ITEMS - 1));
    // Nothing is settled until the final merge, well into the second half
    const firstSettled = short.settled.findIndex(count => count > 0);
    expect(firstSettled).toBeGreaterThan(short.edges.length / 2);
  });

  it('settled places are the true best items in order', () => {
    const items = makeItems(60);
    const { edges } = play(items);
    const partway = getRankingState(items, edges.slice(0, 120));
    expect(partway.ranked.length).toBeGreaterThan(0);
    expect(partway.ranked.map(item => item.label)).toEqual(
      items.map(item => item.label).sort().slice(0, partway.ranked.length)
    );
  });

  it('uses saved answers from a different question order', () => {
    // A > B and B > C are known; A vs C must be inferred, not asked.
    const [a, b, c] = ['a', 'b', 'c'].map(id => ({ id, label: id }));
    const state = getRankingState([a, c, b], [['a', 'b'], ['b', 'c']]);
    expect(state.done).toBe(true);
    expect(state.ranked.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('checkpointsFor', () => {
  it('offers nothing for short lists', () => {
    expect(checkpointsFor(29)).toEqual([]);
  });
  it('only offers a Top N up to half the list', () => {
    expect(checkpointsFor(30)).toEqual([5, 10]);
    expect(checkpointsFor(49)).toEqual([5, 10, 20]);
    expect(checkpointsFor(250)).toEqual([5, 10, 20, 25, 50, 100]);
  });
});
