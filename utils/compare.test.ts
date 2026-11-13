import { describe, it, expect } from 'vitest';
import { compareRankings } from './compare';
import { encodeListLink, decodeListHash } from './shareLink';

describe('compareRankings', () => {
  it('reports full agreement for identical orders', () => {
    const result = compareRankings(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(result.agreement).toBe(1);
    expect(result.sameTop).toBe(true);
    expect(result.biggestGap).toBeNull();
  });

  it('reports no agreement for reversed orders', () => {
    const result = compareRankings(['a', 'b', 'c'], ['c', 'b', 'a']);
    expect(result.agreement).toBe(0);
    expect(result.sameTop).toBe(false);
    expect(result.biggestGap).toEqual({ label: 'a', mine: 1, theirs: 3 });
  });

  it('counts the pairs both put in the same order', () => {
    // Pairs: ab ac ad bc bd cd. Theirs flips only cd.
    expect(compareRankings(['a', 'b', 'c', 'd'], ['a', 'b', 'd', 'c']).agreement).toBeCloseTo(5 / 6);
  });

  it('matches labels without regard to case and compares only shared items', () => {
    const result = compareRankings(['Tea', 'Coffee', 'Water', 'Juice'], ['coffee', 'tea', 'milk']);
    expect(result.common).toBe(2);
    expect(result.agreement).toBe(0);
    expect(result.theirPlace.get('tea')).toBe(2);
    expect(result.theirPlace.has('juice')).toBe(false);
  });

  it('has nothing to say with fewer than two shared items', () => {
    expect(compareRankings(['a', 'b'], ['a', 'z']).agreement).toBeNull();
  });
});

describe('list links', () => {
  const hashOf = (link: string) => link.slice(link.indexOf('#'));

  it('carries a full ranking', async () => {
    const shared = await decodeListHash(hashOf(await encodeListLink(['c', 'a', 'b'])));
    expect(shared).toEqual({ labels: ['c', 'a', 'b'], ranking: ['c', 'a', 'b'] });
  });

  it('carries a Top N with the unranked items after it', async () => {
    const shared = await decodeListHash(hashOf(await encodeListLink(['c', 'a'], ['b', 'd'])));
    expect(shared).toEqual({ labels: ['c', 'a', 'b', 'd'], ranking: ['c', 'a'] });
  });

  it('still reads a link without a ranking', async () => {
    const shared = await decodeListHash(hashOf(await encodeListLink([], ['x', 'y', 'z'])));
    expect(shared).toEqual({ labels: ['x', 'y', 'z'] });
  });

  it('reads the older uncompressed format', async () => {
    const payload = btoa('one\ntwo').replace(/=+$/, '');
    expect(await decodeListHash('#list=v0.' + payload)).toEqual({ labels: ['one', 'two'] });
  });

  it('rejects a ranked link with a damaged header', async () => {
    const payload = btoa('x\none\ntwo').replace(/=+$/, '');
    expect(await decodeListHash('#list=r0.' + payload)).toBeNull();
  });
});
