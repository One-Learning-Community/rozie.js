/**
 * Parse the LHS of an `r-for` binding to extract the iter identifier and
 * (optional) index alias (Plan 02-02 Task 3).
 *
 * Supports both `in` and `of` forms (Gap B fix — WR-03):
 *   - `item in items`              → { item: 'item', index: null }
 *   - `item of items`              → { item: 'item', index: null }
 *   - `(item, idx) in items`       → { item: 'item', index: 'idx' }
 *   - `(item, idx) of items`       → { item: 'item', index: 'idx' }
 *   - `(value, key) in object`     → { item: 'value', index: 'key' }
 *
 * Returns null on parse failure (D-08 fallback) — the malformed r-for is
 * already reported by parseTemplate / would be reported by a separate
 * malformed-r-for diagnostic in a future plan; this helper stays silent.
 *
 * **ReDoS posture (T-2-02-01):** Both regexes are linear-time anchored
 * prefix matches with bounded character classes (`[A-Za-z_$][\w$]*`).
 * No nested quantifiers, no alternation backtracking. Validated by the
 * threat-model test that exercises a 10000-char input.
 */

const PAREN_FORM = /^\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s+(?:in|of)\s+/;
const SIMPLE_FORM = /^([A-Za-z_$][\w$]*)\s+(?:in|of)\s+/;

export interface RForAliases {
  item: string;
  index: string | null;
}

/**
 * Extract loop-variable aliases from an `r-for` LHS.
 * Returns null if the value does not match any supported form.
 */
export function extractRForAliases(rForValue: string): RForAliases | null {
  const trimmed = rForValue.trim();
  const parenMatch = trimmed.match(PAREN_FORM);
  if (parenMatch) {
    return { item: parenMatch[1]!, index: parenMatch[2]! };
  }
  const simpleMatch = trimmed.match(SIMPLE_FORM);
  if (simpleMatch) {
    return { item: simpleMatch[1]!, index: null };
  }
  return null;
}
