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
 *     `includes` pair gave). For primitive values this is the whole rule, and
 *     it costs what the spine's code cost.
 *   - Only when NO option is identical does content decide, and only between
 *     PLAIN objects and arrays: the model value then selects every option whose
 *     value has equal contents (`sameContent`). Every other object — a Date, a
 *     Map, a Set, an Error, a class instance — matches by identity only.
 *
 * Content matching exists for one reason. A consumer whose state is deeply
 * reactive (Vue's ref / reactive, Svelte's $state) hands a committed object back
 * wrapped in a proxy, and a proxy is never `===` to the object the option
 * carries: with identity alone no object-valued option would ever read as
 * selected there. The cost is the limit stated in the `options` prop
 * description: on those targets two options whose object values have equal
 * contents cannot be told apart.
 *
 * Nothing here caches: every function answers from the arrays it is handed, so a
 * model or an option list changed in place is seen as it is now.
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

/** 1: a plain object (`Object.prototype` or no prototype); 2: an array; 0: anything else. */
function plainKind(v: Record<string, unknown>): 0 | 1 | 2 {
  if (Array.isArray(v)) return 2;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null ? 1 : 0;
}

/** Nesting deeper than this is not compared: the values count as different. */
const MAX_DEPTH = 32;
/** Total object pairs one comparison may visit before it gives up as different. */
const MAX_PAIRS = 2000;

/**
 * `path` holds the pairs being compared further up the recursion — the pairs on
 * the CURRENT path only (each is removed again when its comparison returns). Meeting
 * such a pair again means the two values are cyclic in the same place, and the pair
 * is equal exactly if everything else is: it adds no evidence either way, so it
 * counts as equal. A value merely SEEN before (a shared sub-object, a pair from a
 * finished branch) is compared again in full — which is what `budget` bounds: a
 * structure that shares sub-objects at every level doubles the work per level.
 */
function compare(a: unknown, b: unknown, path: [unknown, unknown][], budget: { left: number }): boolean {
  if (identical(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  const kind = plainKind(a);
  if (kind === 0 || kind !== plainKind(b)) return false;
  if (kind === 2 && (a as unknown as unknown[]).length !== (b as unknown as unknown[]).length) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  if (keys.length === 0) return true;
  if (path.some((p) => p[0] === a && p[1] === b)) return true;
  if (path.length >= MAX_DEPTH || budget.left <= 0) {
    budget.left = -1; // spent: every comparison still open returns different
    return false;
  }
  budget.left--;
  path.push([a, b]);
  let same = true;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !compare(a[k], b[k], path, budget)) {
      same = false;
      break;
    }
  }
  path.pop();
  return same && budget.left >= 0;
}

/**
 * Whether two values are identical, or are both plain objects / both arrays with
 * equal own enumerable contents (recursively). Symmetric; never true for values
 * whose contents differ. Anything that is not a plain object or an array is equal
 * only to itself. Values nested deeper than 32 levels, or needing more than 2,000
 * object comparisons, count as different; so do values whose contents cannot be
 * read (a throwing getter). "Plain" is judged by prototype, so a plain object from
 * another realm (an iframe) is not plain here and matches by identity only.
 */
export function sameContent(a: unknown, b: unknown): boolean {
  if (identical(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  try {
    return compare(a, b, [], { left: MAX_PAIRS });
  } catch {
    // A getter (or a proxy trap) that throws while the contents are read: the values
    // cannot be shown to be equal, so they are not — and nothing escapes into a render.
    return false;
  }
}

/**
 * Does model value `m` select an option whose value is `v`?
 *
 * `hasIdentical(m)` answers "is some option's value identical to `m`?". It is only
 * called when `m` and `v` are different objects with equal contents — never for
 * primitives, never for a plain mismatch — so the caller's scan over the options
 * runs only where identity-first actually has to be decided.
 */
export function selects(m: unknown, v: unknown, hasIdentical: (m: unknown) => boolean): boolean {
  if (identical(m, v)) return true;
  if (!isObject(m) || !isObject(v)) return false;
  return sameContent(m, v) && !hasIdentical(m);
}

/** Is an option whose value is `v` selected by a multi-select model? */
export function selectedIn(model: readonly unknown[], v: unknown, hasIdentical: (m: unknown) => boolean): boolean {
  // A primitive option value: the spine's `includes`, nothing more.
  if (!isObject(v)) return model.includes(v);
  for (const m of model) if (m === v) return true;
  for (const m of model) if (isObject(m) && sameContent(m, v) && !hasIdentical(m)) return true;
  return false;
}

/**
 * The multi-select commit for an option whose value is `v`: without it when the
 * model selects it (EVERY entry that does is removed), with it appended otherwise.
 * Always a fresh array.
 */
export function toggleIn(model: readonly unknown[], v: unknown, hasIdentical: (m: unknown) => boolean): unknown[] {
  if (!isObject(v)) {
    return model.includes(v) ? model.filter((x) => !identical(x, v)) : [...model, v];
  }
  const kept = model.filter((m) => !selects(m, v, hasIdentical));
  return kept.length < model.length ? kept : [...model, v];
}

/**
 * A cheap, shallow fingerprint of a plain object or array: its kind, its own keys in
 * sorted order, and each primitive member's type and value (a nested object is only
 * marked as one). Values with equal contents always have equal fingerprints; values
 * with equal fingerprints may still differ and are confirmed with `sameContent`.
 * `null` for anything content matching does not apply to.
 */
function fingerprint(v: unknown): string | null {
  if (!isObject(v)) return null;
  try {
    const kind = plainKind(v);
    if (kind === 0) return null;
    const keys = Object.keys(v).sort();
    let out = kind === 2 ? 'a' + (v as unknown as unknown[]).length : 'o';
    for (const k of keys) {
      const m = v[k];
      out += '|' + k.length + ':' + k + '=' + (isObject(m) || typeof m === 'function' ? '#' : typeof m + ':' + String(m));
    }
    return out;
  } catch {
    return null; // unreadable contents: identity only
  }
}

/**
 * What a multi-select model selects among object-valued options, prepared once so
 * that each option is then answered in O(1) instead of by a walk over the model:
 *
 *   - `identity`: every object in the model. An option whose value is one of them is
 *     selected.
 *   - `loose`: the model's plain objects / arrays that are identical to NO option,
 *     bucketed by fingerprint. Only these can select an option by content — a model
 *     value that IS some option's value never matches another option by content
 *     (identity first), so it is not in here.
 *
 * Building it is O(options + model). It describes the two arrays as they were when
 * it was built and must not outlive them: see `selectionTest`, which holds one for a
 * single pass.
 */
export interface MatchIndex {
  identity: Set<unknown>;
  loose: Map<string, unknown[]>;
}

export function buildMatchIndex(model: readonly unknown[], optionValues: readonly unknown[]): MatchIndex {
  const optionObjects = new Set<unknown>();
  for (const v of optionValues) if (isObject(v)) optionObjects.add(v);
  const identity = new Set<unknown>();
  const loose = new Map<string, unknown[]>();
  for (const m of model) {
    if (!isObject(m) || identity.has(m)) continue;
    identity.add(m);
    if (optionObjects.has(m)) continue;
    const print = fingerprint(m);
    if (print === null) continue;
    const bucket = loose.get(print);
    if (bucket) bucket.push(m);
    else loose.set(print, [m]);
  }
  return { identity, loose };
}

/**
 * `selectedIn(model, v, …)` answered from a prepared index: the same result, for an
 * index built from that model and the option list `v` belongs to.
 */
export function selectedByIndex(index: MatchIndex, model: readonly unknown[], v: unknown): boolean {
  if (!isObject(v)) return model.includes(v);
  if (index.identity.has(v)) return true;
  if (index.loose.size === 0) return false;
  const print = fingerprint(v);
  if (print === null) return false;
  const bucket = index.loose.get(print);
  return bucket !== undefined && bucket.some((m) => sameContent(m, v));
}

/**
 * A "is this option value selected?" test for ONE pass over the options (the rows of
 * one render, or one search for the first selected option), so the pass costs
 * O(options + model) in total instead of O(options × model).
 *
 * It is not a cache. It lives as long as the caller holds it — one function call —
 * and reads the model and the option values it was given then. Primitive option
 * values never touch the index: they are the spine's `model.includes(v)`. The index
 * for object values is built on the first object value asked about; `valuesOf()` is
 * only called then.
 */
export function selectionTest(model: readonly unknown[], valuesOf: () => readonly unknown[]): (v: unknown) => boolean {
  let index: MatchIndex | null = null;
  return (v) => {
    if (!isObject(v)) return model.includes(v);
    if (index === null) index = buildMatchIndex(model, valuesOf());
    return selectedByIndex(index, model, v);
  };
}

export interface ValueRow {
  /** The model value (its first occurrence). */
  value: unknown;
  /** Every position in the model that holds this value. */
  members: number[];
  /** The index of the first option this value selects, or -1 when it matches none. */
  at: number;
}

/**
 * One row per DISTINCT model value, in model order — what a multi-select shows as
 * chips. Two model entries are the same value when they are identical, or when
 * neither is identical to any option and their contents are equal.
 *
 * Primitive values are matched through one index built over the options, so the
 * cost is O(options + model). Object values are matched by identity first, through
 * a second index; the ones identical to no option are then matched by content
 * through a fingerprint index, built once and only if such a value exists — no
 * model value walks the option list.
 */
export function distinctValues(model: readonly unknown[], optionValues: readonly unknown[]): ValueRow[] {
  const primitiveAt = new Map<unknown, number>();
  const objectFirstAt = new Map<unknown, number>();
  const objectAt: number[] = [];
  optionValues.forEach((v, i) => {
    if (isObject(v)) {
      objectAt.push(i);
      if (!objectFirstAt.has(v)) objectFirstAt.set(v, i);
    } else if (!primitiveAt.has(v)) primitiveAt.set(v, i);
  });
  const rows: ValueRow[] = [];
  const primitiveRow = new Map<unknown, ValueRow>();
  const identityRow = new Map<unknown, ValueRow>();
  // Built on first need: the first option index per fingerprint bucket, and the rows of
  // the model values that matched by content, per bucket.
  let optionsByPrint: Map<string, number[]> | null = null;
  const contentRows = new Map<string, ValueRow[]>();
  model.forEach((m, j) => {
    if (!isObject(m)) {
      const known = primitiveRow.get(m);
      if (known) {
        known.members.push(j);
        return;
      }
      const at = primitiveAt.get(m);
      const row: ValueRow = { value: m, members: [j], at: at === undefined ? -1 : at };
      primitiveRow.set(m, row);
      rows.push(row);
      return;
    }
    const same = identityRow.get(m);
    if (same) {
      same.members.push(j);
      return;
    }
    const exactAt = objectFirstAt.get(m);
    if (exactAt !== undefined) {
      const row: ValueRow = { value: m, members: [j], at: exactAt };
      identityRow.set(m, row);
      rows.push(row);
      return;
    }
    // Identical to no option: content decides, for plain objects and arrays.
    const print = fingerprint(m);
    if (print !== null) {
      const alike = (contentRows.get(print) || []).find((r) => sameContent(r.value, m));
      if (alike) {
        alike.members.push(j);
        return;
      }
    }
    let at = -1;
    if (print !== null) {
      if (optionsByPrint === null) {
        optionsByPrint = new Map();
        for (const i of objectAt) {
          const p = fingerprint(optionValues[i]);
          if (p === null) continue;
          const bucket = optionsByPrint.get(p);
          if (bucket) bucket.push(i);
          else optionsByPrint.set(p, [i]);
        }
      }
      const found = (optionsByPrint.get(print) || []).find((i) => sameContent(optionValues[i], m));
      if (found !== undefined) at = found;
    }
    const row: ValueRow = { value: m, members: [j], at };
    identityRow.set(m, row);
    if (print !== null) {
      const bucket = contentRows.get(print);
      if (bucket) bucket.push(row);
      else contentRows.set(print, [row]);
    }
    rows.push(row);
  });
  return rows;
}

/**
 * Unique render keys for a list of key bases, in order: each key is the base
 * prefixed with how many earlier entries had the same base (`0|…`, `1|…`). The
 * count comes first and is followed by a fixed separator, so no base — whatever
 * characters it holds — can make two keys equal.
 */
export function uniqueKeys(bases: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return bases.map((base) => {
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n + '|' + base;
  });
}

/** The key base of a value: an object by the position given for it, anything else by its type and string form. */
export function keyBase(value: unknown, position: number): string {
  return isObject(value) || typeof value === 'function' ? '@' + position : typeof value + ':' + String(value);
}
