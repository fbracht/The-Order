import { sanitizeString, MAX_ITEM_LENGTH, MAX_LIST_SIZE } from './security';

/**
 * A list link carries the items in the part of the address after "#", which
 * browsers never send to a server. Nothing is stored anywhere.
 *
 * Format: #list=<version>.<base64url>
 *   v1: the items joined by newlines, deflate-compressed
 *   v0: the same text, uncompressed (browsers without CompressionStream)
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
const MAX_TEXT_BYTES = MAX_LIST_SIZE * (MAX_ITEM_LENGTH * 4 + 1);

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

export async function encodeListLink(labels: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(labels.join('\n'));
  let payload: string;
  if (typeof CompressionStream !== 'undefined') {
    payload = 'v1.' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  } else {
    payload = 'v0.' + toBase64Url(bytes);
  }
  return `${siteUrl()}#${PARAM}=${payload}`;
}

/** Reads a shared list from an address hash. Returns null when there is none or it cannot be read. */
export async function decodeListHash(hash: string): Promise<string[] | null> {
  const match = hash.match(new RegExp(`[#&]${PARAM}=(v[01])\\.([A-Za-z0-9_-]+)`));
  if (!match) return null;

  // Base64 is 4 characters per 3 bytes; anything longer cannot be a valid list
  if (match[2].length > Math.ceil(MAX_TEXT_BYTES / 3) * 4) return null;

  try {
    let bytes = fromBase64Url(match[2]);
    if (match[1] === 'v1') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    const text = new TextDecoder().decode(bytes);

    // A link can come from anyone, so treat its content like typed input.
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const line of text.split('\n')) {
      const label = sanitizeString(line, MAX_ITEM_LENGTH);
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
      if (labels.length >= MAX_LIST_SIZE) break;
    }
    return labels.length >= 2 ? labels : null;
  } catch {
    return null;
  }
}
