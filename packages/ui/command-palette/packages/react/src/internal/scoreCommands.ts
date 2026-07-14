/**
 * scoreCommands — the pure fuzzy-ranking + highlighting core of CommandPalette.
 *
 * Kept OUT of the `.rozie` <script> (and named `scoreCommands`, NOT `score`/
 * `filter`, either of which would shadow a builtin or read as a bare prop) so
 * it can be unit-tested in isolation and vendored verbatim into every leaf via
 * codegen's `copyInternal` (it lands at `src/internal/scoreCommands.ts` in each
 * of the six leaves, excluding `*.test.ts`).
 *
 * `fuzzyMatch` is the shared subsequence-matching primitive: every character of
 * `query` (case-insensitively) must appear, in order, somewhere in `text`. It
 * scores contiguous runs, word-start / camelCase boundaries, and earliness
 * higher, and returns the matched character POSITIONS in `text`. Two things
 * are built on it:
 *
 *   - `scoreCommands` (via `defaultScore`) — RANKS a command list: label hits
 *     outrank keyword-only hits (title-over-keywords), non-matches are
 *     dropped, ties keep source order (explicit index tie-break — never
 *     relies on engine sort stability). A consumer-supplied `scorer` swaps in
 *     for `defaultScore` entirely; returning `null` excludes an item.
 *   - `labelHighlight` — marks which characters of one visible label matched,
 *     for the option row to render as highlighted runs, REGARDLESS of which
 *     scorer produced the ranking.
 *
 * An empty/whitespace query is treated as "no filter" everywhere: `scoreCommands`
 * short-circuits to a source-order shallow copy (never reaches `fuzzyMatch`),
 * and `labelHighlight` returns no ranges. `disabled` items are kept in the
 * scored result (the UI styles + skips them for selection); they are excluded
 * only by score.
 */

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  keywords?: string[];
  disabled?: boolean;
  // Display-only, unused by ranking — surfaced through the `#icon` / `#actions`
  // option-row slots (consumers primarily read these off the `option` slot scope).
  icon?: unknown;
  actions?: unknown;
}

export interface FuzzyMatchResult {
  score: number;
  positions: number[];
}

export type CommandScorer<T extends CommandItem = CommandItem> = (item: T, query: string) => number | null;

// Tunable bonuses (internal — not a full fzf port; YAGNI). Adjusting these
// never changes the public API surface.
const CONTIGUOUS_BONUS = 15;
const WORD_START_BONUS = 20;
const EARLINESS_WEIGHT = 5;
const LABEL_WEIGHT = 1000; // ensures ANY label hit outranks ANY keyword-only hit

const WORD_BOUNDARY_RE = /[\s\-_/\\.:]/;

function isWordStart(text: string, index: number): boolean {
  if (index <= 0) return true;
  const prev = text[index - 1];
  const cur = text[index];
  if (WORD_BOUNDARY_RE.test(prev)) return true;
  // camelCase boundary: lowercase → uppercase.
  return prev >= 'a' && prev <= 'z' && cur >= 'A' && cur <= 'Z';
}

/**
 * Case-insensitive subsequence match: every character of `query` must appear,
 * in order, in `text`. Returns a tunable score plus the matched character
 * indices into the ORIGINAL `text` (`positions`), or `null` when `query` is
 * not a subsequence of `text` (including an empty `query`, which carries no
 * match signal here — see `scoreCommands`/`labelHighlight` for the
 * empty-query short-circuit).
 */
export function fuzzyMatch(text: string, query: string): FuzzyMatchResult | null {
  const str = String(text == null ? '' : text);
  const q = String(query == null ? '' : query);
  if (!q) return null;

  const lowerStr = str.toLowerCase();
  const lowerQ = q.toLowerCase();

  const positions: number[] = [];
  let score = 0;
  let searchFrom = 0;
  let prevMatchIndex = -1;

  for (let qi = 0; qi < lowerQ.length; qi++) {
    const idx = lowerStr.indexOf(lowerQ[qi], searchFrom);
    if (idx === -1) return null;

    let charScore = 1;
    if (prevMatchIndex !== -1 && idx === prevMatchIndex + 1) charScore += CONTIGUOUS_BONUS;
    if (isWordStart(str, idx)) charScore += WORD_START_BONUS;
    score += charScore;

    positions.push(idx);
    prevMatchIndex = idx;
    searchFrom = idx + 1;
  }

  const firstIndex = positions[0];
  score += EARLINESS_WEIGHT * (1 - firstIndex / Math.max(str.length, 1));

  return { score, positions };
}

/**
 * Default `scorer`: `fuzzyMatch(label)` weighted ABOVE the best
 * `fuzzyMatch(keyword)` (title-over-keywords). Returns `null` when neither
 * the label nor any keyword subsequence-matches `query`.
 */
export function defaultScore<T extends CommandItem>(item: T, query: string): number | null {
  if (!item) return null;
  const label = item.label == null ? '' : String(item.label);
  const labelMatch = fuzzyMatch(label, query);

  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  let bestKeywordScore: number | null = null;
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i] == null ? '' : String(keywords[i]);
    const kwMatch = fuzzyMatch(kw, query);
    if (kwMatch && (bestKeywordScore === null || kwMatch.score > bestKeywordScore)) {
      bestKeywordScore = kwMatch.score;
    }
  }

  if (labelMatch) return LABEL_WEIGHT + labelMatch.score;
  if (bestKeywordScore !== null) return bestKeywordScore;
  return null;
}

/**
 * Rank a command list by a raw (un-normalized) query. Empty / whitespace-only
 * query short-circuits to a source-order SHALLOW COPY of `items` (today's
 * behavior — never reaches `scorer`/`defaultScore`). Otherwise every item is
 * scored via `scorer ?? defaultScore`; items scoring `null` are dropped, and
 * the rest are sorted by score descending with an EXPLICIT original-index
 * tie-break (does not rely on `Array.prototype.sort` engine stability).
 * `disabled` items are kept (filtered only by score). Non-array input yields
 * an empty array.
 */
export function scoreCommands<T extends CommandItem>(
  items: T[],
  rawQuery: string,
  // Accepts the strict CommandScorer AND the loosely-typed function the compiler
  // emits for a `Function` prop, which differs per target (React lowers it to
  // `(...args: any[]) => any`, Angular to `(...args: unknown[]) => unknown`) —
  // neither is assignable to the strict CommandScorer, so widen to the common
  // supertype here and coerce the result below. This is a vendored internal; the
  // consumer-facing contract is the per-leaf `score` prop, not this param.
  // biome-ignore lint/suspicious/noExplicitAny: cross-target Function-prop lowering
  scorer?: CommandScorer<T> | ((...args: any[]) => unknown) | null,
): T[] {
  const list = Array.isArray(items) ? items : [];
  const q = String(rawQuery == null ? '' : rawQuery).trim();
  if (!q) return list.slice();

  const scoreFn = scorer || defaultScore<T>;

  const decorated: Array<{ item: T; score: number; index: number }> = [];
  for (let i = 0; i < list.length; i++) {
    const raw = scoreFn(list[i], q);
    // A scorer returns `number | null`; coerce defensively — any non-number
    // (null / undefined / stray value) excludes the item from the results.
    if (typeof raw !== 'number') continue;
    decorated.push({ item: list[i], score: raw, index: i });
  }

  decorated.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));

  return decorated.map((d) => d.item);
}

/**
 * Highlight ranges for one visible label: `[start, end)` half-open ranges
 * built from `fuzzyMatch(label, query).positions`, collapsing adjacent
 * positions into a single run. No match (or an empty/whitespace query) → `[]`.
 * Runs the SAME primitive regardless of which `scorer` produced the ranking,
 * so a custom scorer still gets sensible highlighting on the visible label
 * (or none, when the query doesn't subsequence-match it).
 */
export function labelHighlight(label: string, query: string): Array<[number, number]> {
  const str = label == null ? '' : String(label);
  const q = String(query == null ? '' : query).trim();
  if (!q) return [];

  const match = fuzzyMatch(str, q);
  if (!match) return [];

  const ranges: Array<[number, number]> = [];
  let start = match.positions[0];
  let end = start + 1;
  for (let i = 1; i < match.positions.length; i++) {
    const p = match.positions[i];
    if (p === end) {
      end = p + 1;
    } else {
      ranges.push([start, end]);
      start = p;
      end = p + 1;
    }
  }
  ranges.push([start, end]);
  return ranges;
}
