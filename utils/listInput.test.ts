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
    expect(await decodeListHash(link.slice(link.indexOf('#')))).toEqual({ labels: list, ranking: list });
  });
  it('refuses a link that expands to far more than a full list', async () => {
    // 20 MB of the same character compresses to a few kilobytes
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write(new Uint8Array(20_000_000).fill(97));
    writer.close();
    const packed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    let binary = '';
    packed.forEach(byte => { binary += String.fromCharCode(byte); });
    const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(payload.length).toBeLessThan(40_000);
    expect(await decodeListHash(`#list=v1.${payload}`)).toBeNull();
  });
  it('still accepts the largest list the app allows', async () => {
    const list = Array.from({ length: 250 }, (_, i) => `${String(i).padStart(3, '0')} ${'é'.repeat(96)}`);
    const link = await encodeListLink(list);
    expect(await decodeListHash(link.slice(link.indexOf('#')))).toEqual({ labels: list, ranking: list });
  });
  it('rejects damaged or missing links', async () => {
    expect(await decodeListHash('')).toBeNull();
    expect(await decodeListHash('#list=v1.not-a-real-list')).toBeNull();
    expect(await decodeListHash('#list=v9.abc')).toBeNull();
  });
});
