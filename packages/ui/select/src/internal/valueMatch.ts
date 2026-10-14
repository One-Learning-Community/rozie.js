/**
 * valueMatch — how Select decides that a model value and an option value are the
 * same value. Kept OUT of the `.rozie` <script> (the groupOptions.ts pattern) so
 * it is unit-tested in isolation (tests/value-match.test.ts) and vendored verbatim
 * into every leaf by codegen's `copyInternal` (`src/internal/valueMatch.ts`).
 *
 * The rule is IDENTITY FIRST:
 *
 *   - A model value selects every option whose value is identical to it
 *     (`identical`: `===`, plus NaN with NaN — what the list spine's `===` /
 *     `includes` pair gave).
 *   - Only when NO option is identical does content decide, and only for
 *     objects: the model value then selects every option whose value has the
 *     same prototype and equal own contents (`sameContent`).
 *
 * Content matching exists for one reason. A consumer whose state is deeply
 * reactive (Vue's ref / reactive, Svelte's $state) hands a committed object back
 * wrapped in a proxy, and a proxy is never `===` to the object the option
 * carries: with identity alone no object-valued option would ever read as
 * selected there. The cost is the limit stated in the `options` prop
 * description: on those targets two options whose object values have equal
 * contents cannot be told apart.
 *
 * PURE — no reactivity, no DOM, no imports.
 */

/** `===`, plus NaN with NaN. */
export function identical(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

/**
 * `path` holds the pairs being compared further up the recursion — the pairs on
 * the CURRENT path only (each is removed again when its comparison returns). Meeting
 * such a pair again means the two values are cyclic in the same place, and the pair
 * is equal exactly if everything else is: it adds no evidence either way, so it
 * counts as equal. A value merely SEEN before (a shared sub-object, a pair from a
 * finished branch) is compared again in full.
 */
function compare(a: unknown, b: unknown, path: [unknown, unknown][]): boolean {
  if (identical(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  const proto: unknown = Object.getPrototypeOf(a);
  if (proto !== Object.getPrototypeOf(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  // Nothing to compare: equal only for the two shapes that ARE their keys. A Date, a
  // Map or a field-less class instance keeps its state elsewhere — identity only.
  if (keys.length === 0) return proto === null || proto === Object.prototype || Array.isArray(a);
  if (path.some((p) => p[0] === a && p[1] === b)) return true;
  path.push([a, b]);
  let same = true;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !compare(a[k], b[k], path)) {
      same = false;
      break;
    }
  }
  path.pop();
  return same;
}

/**
 * Whether two values are identical, or are objects with the same prototype and
 * equal own enumerable contents (recursively). Symmetric; never true for values
 * whose contents differ.
 */
export function sameContent(a: unknown, b: unknown): boolean {
  return compare(a, b, []);
}

export interface ValueRow {
  /** The model value (its first occurrence). */
  value: unknown;
  /** Every position in the model that holds this value. */
  members: number[];
  /** The indices of the options this value selects (empty: it matches no option). */
  at: number[];
}

export interface ValueMatch {
  /** One row per DISTINCT model value, in model order. */
  rows: ValueRow[];
  /** Per option: whether some model value selects it. */
  picked: boolean[];
}

/**
 * Match a model (the single value as a one-entry list, or the multi-select array)
 * against the option values, identity first.
 *
 * Two model entries are the same value — one row — when they are identical, or
 * when neither is identical to any option and their contents are equal.
 */
export function matchValues(model: unknown[], optionValues: unknown[]): ValueMatch {
  const rows: (ValueRow & { exact: boolean })[] = [];
  model.forEach((m, j) => {
    const exactAt: number[] = [];
    optionValues.forEach((v, i) => {
      if (identical(v, m)) exactAt.push(i);
    });
    const exact = exactAt.length > 0;
    const known = rows.find((r) => identical(r.value, m) || (!exact && !r.exact && isObject(m) && sameContent(r.value, m)));
    if (known) {
      known.members.push(j);
      return;
    }
    const at = exact || !isObject(m) ? exactAt : optionValues.map((v, i) => (sameContent(v, m) ? i : -1)).filter((i) => i !== -1);
    rows.push({ value: m, members: [j], at, exact });
  });
  const picked = optionValues.map(() => false);
  for (const r of rows) for (const i of r.at) picked[i] = true;
  return { rows: rows.map((r) => ({ value: r.value, members: r.members, at: r.at })), picked };
}
