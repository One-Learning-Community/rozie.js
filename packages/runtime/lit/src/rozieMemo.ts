/**
 * rozieMemo — dep-keyed memoization helper for `@rozie/runtime-lit`.
 *
 * Quick 260828-sdw — Lit is the sole target of six that did not cache
 * `$computed`. React (`useMemo`), Solid (`createMemo`), Vue/Angular
 * (`computed`) and Svelte (`$derived`) all memoize on the IR's already-
 * resolved dep set; this converges Lit onto the same semantics.
 *
 * DESIGN CONSTRAINT — deliberately NOT `@lit-labs/preact-signals`'s
 * `computed()`. A preact `computed()` tracks signal READS only, and `$props`
 * lower to plain `@property` class fields on Lit (not signals), so a preact
 * computed would never invalidate on a prop change — a silent staleness
 * regression. `rozieMemo` instead compares dep VALUES via `Object.is`,
 * mirroring `useMemo`'s dependency-array contract exactly.
 *
 * Cache shape — a host-keyed `WeakMap<object, Map<string, Entry>>` rather
 * than a per-getter class field, chosen deliberately (quick 260828-sdw
 * Task 2 STEP A):
 *   - adds zero class fields to the emitted component, so there is no
 *     field-initialization-ordering hazard against an emitted `<data>`
 *     initializer that reads a computed before the field would be assigned;
 *   - no emitted-name collision surface (a per-getter field would need a
 *     name derived from the computed's name, which can collide with author
 *     bindings the same way the model-prop / ref field-naming schemes
 *     already have to guard against elsewhere in this emitter);
 *   - the per-getter emitted diff stays exactly one line
 *     (`rozieMemo(this, 'name', [...deps], () => expr)`).
 *
 * Tree-shaking safety — the module-level `WeakMap` is a private, package-
 * internal cache with no exported mutable binding; it holds no reference to
 * anything outside of values passed in by callers, and nothing in this
 * module has an import-time side effect. `@rozie/runtime-lit`'s
 * `package.json` declares `"sideEffects": false`; an unused `rozieMemo`
 * export is safely dropped by any bundler tree-shaking on that basis; a used
 * one is inert until its first call.
 *
 * Cache entries are collected together with the host element once nothing
 * else references it (`WeakMap` keys are held weakly), so there is no
 * unbounded growth risk (per-host `Map` size is bounded by the component's
 * static computed count).
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

interface MemoEntry {
  deps: readonly unknown[];
  value: unknown;
}

const memoCache = new WeakMap<object, Map<string, MemoEntry>>();

function depsEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Return `compute()`'s memoized value for `key` on `host`, re-running
 * `compute` only when `deps` differs (by `Object.is`, element-wise, and by
 * length) from the previous call for that same `(host, key)` pair.
 *
 * @param host - The component instance (`this` inside an emitted getter).
 *   Used only as a WeakMap key — never read or mutated.
 * @param key - The `$computed` declaration's name. Distinct keys on the same
 *   host never share a cache entry.
 * @param deps - The current dependency values, in declaration order (the
 *   same set the IR's `ComputedDecl.deps` already resolves for every other
 *   target's memoization). An empty array means "compute once and never
 *   again" — the deps-empty `$computed` case.
 * @param compute - Recomputes the value on a cache miss.
 */
export function rozieMemo<T>(
  host: object,
  key: string,
  deps: readonly unknown[],
  compute: () => T,
): T {
  let hostCache = memoCache.get(host);
  if (!hostCache) {
    hostCache = new Map();
    memoCache.set(host, hostCache);
  }

  const entry = hostCache.get(key);
  if (entry && depsEqual(entry.deps, deps)) {
    return entry.value as T;
  }

  const value = compute();
  // Store a COPY of `deps` — the caller may pass the same array reference on
  // every call (e.g. `[this.label]` re-evaluated fresh each time), but never
  // the SAME array instance twice, so copying costs nothing extra here and
  // protects against a hypothetical caller that mutates its deps array in
  // place after the call.
  hostCache.set(key, { deps: [...deps], value });
  return value;
}
