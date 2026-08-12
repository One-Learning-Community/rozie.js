/**
 * canonicalEventKey — quick task 260812-i67 (ROZ997 / ROZ998).
 *
 * The ONE core-side canonical collapse for a raw authored event name. Used by:
 *   - `ir/validateEmitNameCollision.ts` (ROZ997) — grouping a component's
 *     declared `$emit` names into canonical-equivalence classes;
 *   - `ir/threadParamTypes.ts` (ROZ998) — deciding whether a consumer's
 *     authored component-tag listener canonically matches some declared emit
 *     of the resolved callee.
 *
 * THE CONTRACT (plain terms): for every name both functions can see, this
 * function and the Angular target's `sanitizeEventName`
 * (`packages/targets/angular/src/rewrite/sanitizeEventName.ts`) MUST return
 * the same string. `resolveEventBindingName` (the Angular consumer-side
 * binding resolution) canonical-matches an authored listener name against the
 * callee's declared emits via `sanitizeEventName` equality — so ROZ998's
 * "canonical equivalent is silent" rule is only truthful while this function
 * agrees with that one. A divergence silently reintroduces the exact
 * consumer-vs-declaration event-name drift class that quick task 260811-trz
 * closed. The enforcement mechanism is the executable agreement test at
 * `packages/targets/angular/src/__tests__/canonicalEventKeyAgreement.test.ts`
 * (a table of adversarial names pinned to exact equality), NOT this comment.
 *
 * Deliberately does NOT import from `packages/targets/*` — the dependency
 * direction is targets-depend-on-core; reversing it would be a cycle. And it
 * does NOT re-export or wrap `sanitizeEventName`; the two implementations are
 * intentionally independent so the agreement test pins BEHAVIOR, not aliasing.
 *
 * Collapse rules (behaviorally identical to `sanitizeEventName`):
 *   - an already-valid JS identifier passes through byte-identically
 *     (`close` → `close`, `sortChange` → `sortChange`, and — note — the
 *     underscore-bearing `sort_change` → `sort_change`, because `_` is
 *     identifier-legal so the fast path keeps it verbatim);
 *   - runs of hyphen / underscore / whitespace are removed and the following
 *     character upper-cased (`sort-change` → `sortChange`);
 *   - remaining non-identifier characters are dropped;
 *   - a leading digit gets an `_` prefix;
 *   - a degenerate all-separator input falls back to the same stable
 *     `'_event'` placeholder `sanitizeEventName` uses.
 *
 * @experimental — shape may change before v1.0
 */

/** A syntactically valid JS identifier usable as a class-field name. */
const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Collapse a raw authored event name to its canonical key.
 * See the module header for the sanitizeEventName agreement contract.
 */
export function canonicalEventKey(name: string): string {
  // Fast path: already a valid identifier — byte-identical passthrough.
  if (VALID_IDENTIFIER.test(name)) return name;

  // Camel-case across `-` / `_` / whitespace separator runs.
  let out = name.replace(/[-_\s]+([A-Za-z0-9])/g, (_m, ch: string) =>
    ch.toUpperCase(),
  );
  // Drop any leftover non-identifier characters (incl. trailing separators).
  out = out.replace(/[^A-Za-z0-9_$]/g, '');
  // Identifiers may not start with a digit.
  if (/^[0-9]/.test(out)) out = `_${out}`;
  // Degenerate input (e.g. all-separator) — same stable placeholder as
  // sanitizeEventName.
  if (out === '') out = '_event';
  return out;
}
