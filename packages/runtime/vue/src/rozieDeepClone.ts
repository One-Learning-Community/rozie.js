/**
 * `rozieDeepClone` — recursive proxy-safe deep clone for the Vue `$clone` sigil
 * (Phase 45-07, WR-02 / WR-06 fix).
 *
 * ## Why this exists
 *
 * The original Vue `$clone(x)` lowering emitted `structuredClone(toRaw(x))`.
 * `toRaw` only unwraps the TOP-LEVEL reactive proxy: Vue's `reactive()` lazily
 * wraps nested members on access and caches the proxy in a separate
 * `reactiveMap` WeakMap rather than writing it back onto the raw target. That is
 * fine for a single `reactive()` tree of plain nested objects — `toRaw` yields a
 * raw target whose nested members are plain — but it is NOT fine when a nested
 * member is itself an INDEPENDENT reactive proxy or a `ref()`:
 *
 *   - `reactive({ box: { inner: reactive({...}) } })`  — nested independent proxy
 *   - `reactive({ box: { inner: ref({...}) } })`        — nested ref
 *   - `reactive({ items: [reactive({...}), ...] })`     — array of reactive items
 *   - `$clone({ d: src.data }).d` where `src.data` is a live nested proxy
 *     (the shipped FlowCanvas duplicate-node shape, WR-06)
 *
 * In every case the nested value survives `toRaw` as a live `Proxy`, and
 * `structuredClone` throws `DataCloneError: <proxy> could not be cloned`.
 * Svelte's `$state.snapshot` does NOT share this hole — it recursively
 * de-proxies. This helper brings Vue to parity: a deep copy with every Vue
 * proxy / ref recursively unwrapped, so the universal Phase 45 "proxy-safe deep
 * clone on all six targets" claim holds one level deep and beyond.
 *
 * ## Implementation: `structuredClone(deepToRaw(x))`
 *
 * `deepToRaw` recursively rebuilds the structure with `toRaw` / `unref` applied
 * at EVERY node (objects, arrays, Map keys+values, Set members), guarded by a
 * WeakMap so cyclic graphs terminate. The rebuilt structure contains no Vue
 * proxies anywhere, so the subsequent `structuredClone` only ever meets plain
 * values — it never throws "could not be cloned" on a proxy, while still
 * providing the well-tested independent-copy semantics (and native handling of
 * cycles, `Map` / `Set` / `Date` / typed arrays) that the previous lowering
 * relied on.
 *
 * The two-pass shape (de-proxy walk, THEN structuredClone) is deliberately
 * conservative: it changes ONLY the proxy-stripping step and leaves the actual
 * copy to the structured-clone algorithm, which already round-trips `Date`,
 * `Map`, `Set`, typed arrays and cycles correctly — matching the prior behavior
 * for the common case exactly.
 *
 * ## Preserved (non-regression) behavior
 *
 * Values containing FUNCTIONS still throw under `structuredClone` — exactly as
 * the previous `structuredClone(toRaw(x))` lowering did. `$clone` is for
 * serializable graph / history state (the FlowCanvas dogfood, undo/redo
 * snapshots); cloning a function-bearing value was never supported and is not
 * supported now. This is intentional, not a regression.
 *
 * @public — runtime API consumed by emitted Vue SFCs.
 */
import { isRef, toRaw, unref } from 'vue';

/**
 * Recursively rebuild `value` with every Vue reactive proxy / ref unwrapped to
 * its raw target. Plain primitives, functions, `Date`, and typed arrays are
 * returned/copied structurally; `Map` and `Set` are rebuilt with de-proxied
 * keys/values/members. A WeakMap of already-visited inputs guards cycles and
 * preserves shared-reference identity within a single clone.
 */
function deepToRaw<T>(value: T, seen: WeakMap<object, unknown>): T {
  // Refs unwrap first (a ref may hold another proxy/ref).
  if (isRef(value)) {
    return deepToRaw(unref(value) as T, seen);
  }

  // Primitives (incl. null/undefined) and functions pass straight through.
  // Functions are intentionally left as-is — structuredClone will reject them
  // downstream, matching the previous toRaw-based lowering.
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Strip a top-level reactive/readonly/shallow proxy to its raw target before
  // we inspect/recurse. toRaw is idempotent on already-raw objects.
  const raw = toRaw(value as object) as T & object;

  // Cycle / shared-reference guard.
  const existing = seen.get(raw);
  if (existing !== undefined) {
    return existing as T;
  }

  // Date / RegExp and other exotic objects: hand to structuredClone as-is
  // (no proxy can hide inside a Date's [[DateValue]] internal slot). Recursing
  // into them would lose their internal slots.
  if (raw instanceof Date || raw instanceof RegExp) {
    return raw;
  }

  if (Array.isArray(raw)) {
    const out: unknown[] = [];
    seen.set(raw, out);
    for (let i = 0; i < raw.length; i++) {
      out[i] = deepToRaw(raw[i], seen);
    }
    return out as T;
  }

  if (raw instanceof Map) {
    const out = new Map();
    seen.set(raw, out);
    for (const [k, v] of raw) {
      out.set(deepToRaw(k, seen), deepToRaw(v, seen));
    }
    return out as T;
  }

  if (raw instanceof Set) {
    const out = new Set();
    seen.set(raw, out);
    for (const v of raw) {
      out.add(deepToRaw(v, seen));
    }
    return out as T;
  }

  // ArrayBuffer-backed views (typed arrays, DataView): no proxy can live inside
  // their binary buffer; hand to structuredClone as-is.
  if (ArrayBuffer.isView(raw) || raw instanceof ArrayBuffer) {
    return raw;
  }

  // Plain object (or null-prototype object) — rebuild key-by-key. Preserve the
  // prototype so structuredClone's "plain object" detection stays consistent
  // with the raw target's shape.
  const out: Record<string | symbol, unknown> = Object.create(
    Object.getPrototypeOf(raw) as object | null,
  );
  seen.set(raw, out);
  for (const key of Reflect.ownKeys(raw as object)) {
    out[key] = deepToRaw((raw as Record<string | symbol, unknown>)[key], seen);
  }
  return out as T;
}

/**
 * Deep-clone `value` into an INDEPENDENT copy with every Vue reactive proxy /
 * ref recursively unwrapped. See the module doc-comment for the rationale and
 * the (preserved) function-throws caveat.
 */
export function rozieDeepClone<T>(value: T): T {
  return structuredClone(deepToRaw(value, new WeakMap<object, unknown>()));
}
