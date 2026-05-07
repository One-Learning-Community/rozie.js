/**
 * didYouMean — Levenshtein-based suggestion helper (Phase 06.2 P1 Task 4).
 * Hand-rolled per CLAUDE.md aesthetic constraint; two-row DP keeps memory at
 * O(min(m, n)). Alphabetical tiebreak via pre-sort.
 * @experimental — shape may change before v1.0
 */
export const DID_YOU_MEAN_THRESHOLD = 2;

/** Standard Levenshtein distance — O(n*m) time, O(min(n,m)) space. */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > b.length) [a, b] = [b, a];
  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr[i] = Math.min(
        (curr[i - 1] ?? 0) + 1,
        (prev[i] ?? 0) + 1,
        (prev[i - 1] ?? 0) + cost,
      );
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[a.length] ?? 0;
}

/**
 * Pick the candidate closest to `target` within DID_YOU_MEAN_THRESHOLD;
 * returns null when no candidate is in range. Pre-sorting candidates makes
 * ties resolve to the alphabetical-first match.
 */
export function didYouMean(
  target: string,
  candidates: readonly string[],
): string | null {
  if (candidates.length === 0) return null;
  let best: string | null = null;
  let bestDist = DID_YOU_MEAN_THRESHOLD + 1;
  const sorted = [...candidates].sort((a, b) => a.localeCompare(b));
  for (const cand of sorted) {
    const d = distance(target, cand);
    if (d <= DID_YOU_MEAN_THRESHOLD && d < bestDist) {
      best = cand;
      bestDist = d;
    }
  }
  return best;
}
