/**
 * sanitizeEventName — Bug 2 (Angular), quick task 260520-gi1.
 *
 * The Angular target emits one `output<T>()` class field per `$emit` event
 * name. `$emit('file-added', …)` previously emitted the field declaration
 * `file-added = output<unknown>()` — `file-added` is NOT a valid JS
 * identifier, so @babel/parser / esbuild reject the whole class. compile()
 * produced no ROZ diagnostic.
 *
 * This module is the ONE canonical mapping from a raw `$emit` event name to a
 * valid camelCase class-field identifier:
 *
 *   sanitizeEventName('file-added')        → 'fileAdded'
 *   sanitizeEventName('upload-progress')   → 'uploadProgress'
 *   sanitizeEventName('restriction-failed')→ 'restrictionFailed'
 *   sanitizeEventName('close')             → 'close'   (byte-identical passthrough)
 *
 * Critical invariant: an event name that is ALREADY a valid JS identifier
 * (`close`, `search`, `clear`, `add`, `toggle`, `remove`) is returned
 * byte-identically — no rename, no alias. Angular `output()` keeps the
 * consumer-facing event name via the optional `{ alias }` argument, which is
 * only emitted when `sanitizeEventName(e) !== e`.
 *
 * @experimental — shape may change before v1.0
 */

/**
 * Returns true when `name` is a syntactically valid, non-reserved-safe JS
 * identifier usable as a class-field name. We deliberately do NOT reject
 * reserved words here — a reserved word like `class` as an event name is
 * vanishingly unlikely and would need a different mitigation; the realistic
 * failure mode this task addresses is kebab/snake-case names that contain
 * `-` (illegal in identifiers).
 */
export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/**
 * Convert a raw `$emit` event name into a valid camelCase class-field
 * identifier. Already-valid identifiers are returned verbatim (byte-identical).
 *
 * Kebab-case and snake_case segments are camel-cased: each run of one or more
 * `-`/`_`/whitespace separators is removed and the following character is
 * upper-cased. Any remaining character that is not identifier-legal is
 * dropped. If the result would start with a digit, an `_` is prefixed.
 */
export function sanitizeEventName(eventName: string): string {
  // Fast path: already a valid identifier — return byte-identical.
  if (isValidIdentifier(eventName)) return eventName;

  // Camel-case across `-` / `_` / whitespace separators.
  let out = eventName.replace(/[-_\s]+([A-Za-z0-9])/g, (_m, ch: string) =>
    ch.toUpperCase(),
  );
  // Drop any leftover non-identifier characters (incl. trailing separators).
  out = out.replace(/[^A-Za-z0-9_$]/g, '');
  // Identifiers may not start with a digit.
  if (/^[0-9]/.test(out)) out = `_${out}`;
  // Degenerate input (e.g. all-separator) — fall back to a stable placeholder.
  if (out === '') out = '_event';
  return out;
}
