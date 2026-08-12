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

/**
 * Quick task 260811-trz (D-04) — the Angular `output()` declaration shape
 * for one authored `$emit` event name, decomposed so BOTH emit seams
 * (`emitScript.ts`'s `output()` field declaration AND
 * `emitTemplateEvent.ts`'s consumer-side binding-name resolution) consume
 * the SAME derivation instead of each re-deriving it independently — the
 * single-source-of-truth link that makes the two sides structurally
 * un-driftable.
 */
export interface AngularOutputBinding {
  /** The class-field identifier (`sanitizeEventName(authoredEmitName)`). */
  fieldId: string;
  /**
   * The `output({ alias })` value, or `null` when no alias is emitted
   * (i.e. `fieldId === authoredEmitName`, matching `emitScript.ts`'s
   * existing `fieldId === e` gate).
   */
  alias: string | null;
  /**
   * What a CONSUMER must bind to receive this event — `alias ?? fieldId`.
   *
   * Derivation note (read before "simplifying" this): because the
   * declaration side emits an alias exactly when `fieldId !== authoredEmitName`,
   * and the alias VALUE is always `authoredEmitName`, `publicName` collapses
   * to `authoredEmitName` in BOTH branches today — no-alias means
   * `fieldId === authoredEmitName`, aliased means `alias === authoredEmitName`.
   * That collapse is a CONSEQUENCE of the current alias rule (`emitScript.ts`
   * §6d: emit `{ alias }` iff `fieldId !== e`), not the rule itself — express
   * this as `alias ?? fieldId`, not a direct return of `authoredEmitName`, so
   * the invariant survives if the alias rule ever changes independently.
   */
  publicName: string;
}

/**
 * Compute the `AngularOutputBinding` for one authored `$emit` event name.
 * Consumed by:
 *   - `emitScript.ts` §6d (the `for (const e of ir.emits)` output-declaration
 *     loop) — emits `${fieldId} = output<T>()` when `alias === null`, else
 *     `${fieldId} = output<T>({ alias: '${alias}' })`.
 *   - `emitTemplateEvent.ts`'s `resolveEventBindingName` — the resolved
 *     callee emit name's `publicName` is what the consumer's lowered
 *     `(eventName)=` binding must use.
 */
export function angularOutputBinding(authoredEmitName: string): AngularOutputBinding {
  const fieldId = sanitizeEventName(authoredEmitName);
  const alias = fieldId !== authoredEmitName ? authoredEmitName : null;
  const publicName = alias ?? fieldId;
  return { fieldId, alias, publicName };
}
