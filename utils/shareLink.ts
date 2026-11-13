import { sanitizeString, MAX_ITEM_LENGTH, MAX_LIST_SIZE } from './security';

/**
 * A list link carries the items in the part of the address after "#", which
 * browsers never send to a server. Nothing is stored anywhere.
 *
 * Format: #list=<version>.<base64url>
 *   v1: the items joined by newlines, deflate-compressed
 *   v0: the same text, uncompressed (browsers without CompressionStream)
 *   r1, r0: the same two, for a list that comes with the sender's ranking.
 *     The first line is how many items the sender ranked; those items follow
 *     in ranked order, then any they left unranked (a Top N).
 */
const PARAM = 'list';

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

// The largest list the app accepts, in bytes of text (up to 4 bytes per character)
// plus the short count line of a ranked link
const MAX_TEXT_BYTES = MAX_LIST_SIZE * (MAX_ITEM_LENGTH * 4 + 1) + 8;

/**
 * Runs bytes through a compression or decompression stream. The output is
 * read in pieces and abandoned as soon as it passes MAX_TEXT_BYTES, so a
 * crafted link that expands to a huge amount of data cannot freeze the page.
 */
async function pipe(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Damaged input makes these fail too; the failure is reported once, by the read below
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_TEXT_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error('List is too large');
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** The address of this app, wherever it is hosted. */
export const siteUrl = (): string =>
  typeof window === 'undefined' ? '' : window.location.origin + import.meta.env.BASE_URL;

/** A list read from a link, with the sender's ranking when the link carries one. */
export interface SharedList {
  labels: string[];
  /** The sender's order, best first. Shorter than labels when they stopped at a Top N. */
  ranking?: string[];
}

/**
 * ranked: the sender's order, best first. rest: items they did not rank.
 * With an empty ranking the link carries the plain list.
 */
export async function encodeListLink(ranked: string[], rest: string[] = []): Promise<string> {
  const hasRanking = ranked.length >= 2;
  const lines = hasRanking ? [String(ranked.length), ...ranked, ...rest] : [...ranked, ...rest];
  const bytes = new TextEncoder().encode(lines.join('\n'));
  let payload: string;
  if (typeof CompressionStream !== 'undefined') {
    payload = (hasRanking ? 'r1.' : 'v1.') + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  } else {
    payload = (hasRanking ? 'r0.' : 'v0.') + toBase64Url(bytes);
  }
  return `${siteUrl()}#${PARAM}=${payload}`;
}

/** Reads a shared list from an address hash. Returns null when there is none or it cannot be read. */
export async function decodeListHash(hash: string): Promise<SharedList | null> {
  const match = hash.match(new RegExp(`[#&]${PARAM}=([vr][01])\\.([A-Za-z0-9_-]+)`));
  if (!match) return null;

  // Base64 is 4 characters per 3 bytes; anything longer cannot be a valid list
  if (match[2].length > Math.ceil(MAX_TEXT_BYTES / 3) * 4) return null;

  try {
    let bytes = fromBase64Url(match[2]);
    if (match[1][1] === '1') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    const rawLines = new TextDecoder().decode(bytes).split('\n');

    let rankedCount = 0;
    if (match[1][0] === 'r') {
      const header = rawLines.shift() ?? '';
      if (!/^\d{1,4}$/.test(header)) return null;
      rankedCount = Number(header);
    }

    // A link can come from anyone, so treat its content like typed input.
    const seen = new Set<string>();
    const labels: string[] = [];
    const ranking: string[] = [];
    rawLines.forEach((line, index) => {
      if (labels.length >= MAX_LIST_SIZE) return;
      const label = sanitizeString(line, MAX_ITEM_LENGTH);
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      labels.push(label);
      if (index < rankedCount) ranking.push(label);
    });
    if (labels.length < 2) return null;
    return ranking.length >= 2 ? { labels, ranking } : { labels };
  } catch {
    return null;
  }
}
