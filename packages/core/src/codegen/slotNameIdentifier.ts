/**
 * slotNameIdentifier — Phase 79 Plan 03 (R12/D-04).
 *
 * The phase's SINGLE source of truth for "is this slot name a valid JS/TS
 * identifier?" Framework-agnostic, pure, zero dependencies.
 *
 * Prior to Phase 79, `packages/core/src/ir/validateSlotPropCollision.ts`
 * (ROZ127) hard-errored on any non-identifier slot name, because Vue's
 * `defineSlots<{ ... }>()` minted an unquoted object key that failed to parse
 * (TS1005) for a hyphenated / leading-digit slot name. Phase 79 retires that
 * IR-level hard error (D-05: a non-identifier slot name is legal, no
 * replacement diagnostic) and instead makes each target's own key/name
 * minting SHAPE-AWARE:
 *
 *   - Vue (this plan, Task 2): `refineSlotTypes.ts`'s `buildSlotTypeBlock`
 *     quotes the `defineSlots` key only when the slot name is not an
 *     identifier (D-04) — an identifier-named or default slot stays
 *     byte-identical to pre-phase output.
 *   - The other R12 routing plans (79-04, 79-05) and the Lit half (79-09)
 *     import THIS SAME predicate for their own shape-aware decisions. A
 *     second copy of this regex in any target package is a defect — every
 *     consumer must import from here.
 *
 * The pattern is exactly the shape the core validator used before Task 1
 * removed it: a leading letter, underscore, or dollar, followed by any
 * number of word characters or dollars. Anchored full-string test.
 *
 * @experimental — shape may change before v1.0
 */

const VALID_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Returns `true` when `name` is a valid JS/TS identifier shape (the same
 * shape a bare object-literal key, a bare class-field name, or a bare
 * function-parameter name would require to avoid quoting/escaping).
 *
 * Does NOT special-case the empty string (the default-slot sentinel) —
 * `''` does not match `VALID_IDENTIFIER` and returns `false`. Callers that
 * fold the empty-string default-slot sentinel to a literal `'default'` key
 * should do so BEFORE calling this predicate, since `'default'` itself IS a
 * valid identifier.
 */
export function isSlotNameIdentifier(name: string): boolean {
  return VALID_IDENTIFIER.test(name);
}
