/**
 * Helpers for the text list on the input screen.
 */

// "1. ", "12) ", "- ", "* ", "• ", "– " and similar list markers at the start of a line
const LIST_MARKER = /^\s*(?:\d{1,3}[.)]|[-*•·–—▪◦‣])\s+/;

/**
 * Tidies text pasted into the list: removes list markers such as "1." or
 * "•" from the start of each line, and turns a single comma-separated line
 * ("Paris, London, Rome") into one item per line.
 *
 * It is only applied to pasted text, never to typing, so an item that really
 * starts with "1. " can still be typed by hand.
 */
export function cleanPastedList(pasted: string): string {
  let lines = pasted.replace(/\r\n?/g, '\n').split('\n');

  const filled = lines.filter(line => line.trim().length > 0);
  if (filled.length === 1 && (filled[0].match(/,/g) ?? []).length >= 2) {
    lines = filled[0].split(',');
  }

  // Only strip markers when most lines have one, so a lone "- " inside an
  // ordinary paste is left alone.
  const nonEmpty = lines.filter(line => line.trim().length > 0);
  const marked = nonEmpty.filter(line => LIST_MARKER.test(line)).length;
  const stripMarkers = nonEmpty.length > 0 && marked * 2 > nonEmpty.length;

  return lines
    .map(line => (stripMarkers ? line.replace(LIST_MARKER, '') : line).trim())
    .join('\n');
}

export interface DuplicateInfo {
  /** The first repeated item, as first typed. */
  label: string;
  /** 1-based line number of its first repeat. */
  line: number;
  /** How many lines would be removed. */
  extraCount: number;
}

/** Finds repeated items (ignoring case and surrounding spaces). */
export function findDuplicates(text: string): DuplicateInfo | null {
  const seen = new Map<string, string>();
  let first: { label: string; line: number } | null = null;
  let extraCount = 0;

  text.split('\n').forEach((raw, index) => {
    const label = raw.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) {
      extraCount++;
      if (!first) first = { label: seen.get(key)!, line: index + 1 };
    } else {
      seen.set(key, label);
    }
  });

  return first ? { ...(first as { label: string; line: number }), extraCount } : null;
}

/** Removes repeated items, keeping the first of each. */
export function removeDuplicates(text: string): string {
  const seen = new Set<string>();
  return text
    .split('\n')
    .filter(raw => {
      const key = raw.trim().toLowerCase();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}
