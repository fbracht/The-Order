/** Rankings are matched by label, ignoring case and outer spaces. */
export const compareKey = (label: string): string => label.trim().toLowerCase();

export interface RankingComparison {
  /** The friend's place (1 = best) for each item they ranked, by compareKey. */
  theirPlace: Map<string, number>;
  /** How many items both people ranked. */
  common: number;
  /**
   * Of every pair of items both ranked, the share (0 to 1) that both put in
   * the same order. null when fewer than two items are shared.
   */
  agreement: number | null;
  /** Whether both have the same first place among the shared items. */
  sameTop: boolean;
  /** The shared item whose two places are furthest apart; null when all match. */
  biggestGap: { label: string; mine: number; theirs: number } | null;
}

/** mine and theirs are labels, best first. Either may hold items the other lacks. */
export function compareRankings(mine: string[], theirs: string[]): RankingComparison {
  const theirPlace = new Map<string, number>();
  theirs.forEach((label, index) => {
    const key = compareKey(label);
    if (!theirPlace.has(key)) theirPlace.set(key, index + 1);
  });

  // Shared items in my order, each with both places
  const shared = mine
    .map((label, index) => ({ label, mine: index + 1, theirs: theirPlace.get(compareKey(label)) }))
    .filter((entry): entry is { label: string; mine: number; theirs: number } => entry.theirs !== undefined);

  if (shared.length < 2) {
    return { theirPlace, common: shared.length, agreement: null, sameTop: false, biggestGap: null };
  }

  let same = 0;
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      if (shared[i].theirs < shared[j].theirs) same++;
    }
  }
  const pairs = (shared.length * (shared.length - 1)) / 2;

  const theirFirst = shared.reduce((best, entry) => (entry.theirs < best.theirs ? entry : best));
  const widest = shared.reduce((best, entry) =>
    Math.abs(entry.mine - entry.theirs) > Math.abs(best.mine - best.theirs) ? entry : best);

  return {
    theirPlace,
    common: shared.length,
    agreement: same / pairs,
    sameTop: theirFirst === shared[0],
    biggestGap: widest.mine === widest.theirs ? null : widest
  };
}
