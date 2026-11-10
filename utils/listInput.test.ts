import { describe, it, expect } from 'vitest';
import { cleanPastedList, findDuplicates, removeDuplicates } from './listInput';
import { encodeListLink, decodeListHash } from './shareLink';

describe('cleanPastedList', () => {
  it('removes numbering and bullets', () => {
    expect(cleanPastedList('1. Arcs\n2. Root\n3) Oath')).toBe('Arcs\nRoot\nOath');
    expect(cleanPastedList('- Arcs\n• Root\n* Oath')).toBe('Arcs\nRoot\nOath');
  });
  it('splits a comma-separated line', () => {
    expect(cleanPastedList('Paris, London, Rome')).toBe('Paris\nLondon\nRome');
  });
  it('leaves ordinary text alone', () => {
    expect(cleanPastedList('1984\n2001: A Space Odyssey\nUp')).toBe('1984\n2001: A Space Odyssey\nUp');
    expect(cleanPastedList('Paris, France')).toBe('Paris, France');
    expect(cleanPastedList('Jay-Z\n- the one exception\nNas')).toBe('Jay-Z\n- the one exception\nNas');
  });
  it('handles Windows line endings', () => {
    expect(cleanPastedList('1. A\r\n2. B')).toBe('A\nB');
  });
});

describe('duplicates', () => {
  it('finds repeats ignoring case and spaces', () => {
    expect(findDuplicates('Root\nArcs\n root \nARCS')).toEqual({ label: 'Root', line: 3, extraCount: 2 });
    expect(findDuplicates('Root\nArcs')).toBeNull();
  });
  it('removes repeats and keeps the first of each', () => {
    expect(removeDuplicates('Root\nArcs\n root \nARCS\nOath')).toBe('Root\nArcs\nOath');
  });
});

describe('list links', () => {
  it('round-trips a list, including accents and emoji', async () => {
    const list = ['Pão de queijo', 'Brigadeiro 🍫', 'Açaí', 'Coxinha, the best'];
    const link = await encodeListLink(list);
    expect(await decodeListHash(link.slice(link.indexOf('#')))).toEqual(list);
  });
  it('rejects damaged or missing links', async () => {
    expect(await decodeListHash('')).toBeNull();
    expect(await decodeListHash('#list=v1.not-a-real-list')).toBeNull();
    expect(await decodeListHash('#list=v9.abc')).toBeNull();
  });
});
