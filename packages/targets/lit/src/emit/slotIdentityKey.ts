/**
 * slotIdentityKey — Lit-target single derivation of a slot's emitter-side
 * identity (Phase 79 Plan 08 Task 2).
 *
 * Two Lit-only call sites key on `SlotDecl.name` to decide whether two slots
 * are "the same slot" for emission purposes:
 *   - `emitSlotDecl.ts`'s per-slot dedup (keep only the FIRST occurrence of
 *     each distinct identity before emitting per-slot class fields).
 *   - `shouldDistributeSlots.ts`'s duplicate-name gate (force manual slot
 *     assignment when any identity repeats across the component's
 *     non-portal slots).
 *
 * Both were written when `SlotDecl.name === ''` uniquely meant "the one
 * default slot" (Phase 07 era). Phase 79 R1 breaks that invariant: a
 * producer `<slot :name="...">` whose bound expression does not
 * constant-fold keeps `name === ''` (79-06's confirmed A1 resolution) while
 * carrying a NEW `dynamicNameExpr` (and, when derivable, a `namePrefix`).
 * Two independent dynamic-name families declared in one producer therefore
 * both carry the identical `name === ''` sentinel and, without this helper,
 * collide with each other AND with a genuine default slot — confirmed by
 * `slotNameIdentityCollision.test.ts`'s Task 1 probe.
 *
 * This module is the SINGLE source of truth for a slot's compile-time
 * identity; it MUST be used at every site that decides "are these two slots
 * the same slot" (currently `emitSlotDecl.ts` and `shouldDistributeSlots.ts`).
 *
 * Structure mirrors `portalSlotMemberName.ts` (one function, one place, used
 * at every reference site). Policy does NOT mirror it: `portalSlotMemberName`
 * applies a collision-GATED rename (bare name unless it collides with a
 * declared prop). `rozieSlots` — the record property Task 3 declares — is
 * PUBLIC consumer API (D-07), so no such rename policy applies here; this
 * module only disambiguates COMPILE-TIME class-member identity, never a
 * consumer-facing name.
 *
 * Derivation, in priority order:
 *   1. No `dynamicNameExpr` — key on `.name` exactly as today. Existing
 *      static-slot behaviour (including the real default slot, `name ===
 *      ''`) is bit-for-bit preserved (AC-1).
 *   2. `dynamicNameExpr` set AND a non-empty `namePrefix` — key on a
 *      namespaced form of that prefix. Two dynamic families declared on one
 *      producer are disambiguated by their AUTHORED prefix text.
 *   3. `dynamicNameExpr` set, no `namePrefix` — key on a namespaced form of
 *      the slot's declaration ordinal (`index`, its position in the flat
 *      `ir.slots` array as iterated by the caller). Two no-prefix dynamic
 *      slots on one producer are disambiguated by declaration order.
 *
 * The dynamic-key namespace prefix uses a literal NUL (U+0000) character
 * because the HTML tokenization algorithm replaces any NUL byte inside an
 * attribute value with U+FFFD before it ever reaches the parser — no
 * legally-authored static `name="..."` (or constant-folded `:name`) can
 * ever produce a `SlotDecl.name` containing a NUL character, so this prefix
 * can never collide with a real static slot's identity key.
 */
import type { SlotDecl } from '@rozie/core';

// WR-01 (quick task 260817-buk) — React (`findSlotDecl` in
// packages/targets/react/src/emit/emitSlotInvocation.ts) and Svelte
// (`findDynamicSlotOrdinal` in
// packages/targets/svelte/src/emit/dynamicSlotOrdinal.ts) now derive
// dynamic-name-slot INVOCATION-to-DECLARATION identity from the declaration
// site's `sourceLoc`, converging conceptually on the same declaration-site
// identity this module has always used (it solves a different problem —
// declaration-time class-member dedup, not a per-invocation lookup — so its
// own priority scheme below is unchanged). No behavior change here.

const DYNAMIC_FAMILY_PREFIX = '\u0000rozie-dyn-family:';
const DYNAMIC_ORDINAL_PREFIX = '\u0000rozie-dyn-ordinal:';

/**
 * Return the single compile-time identity key for `slot` (at flat-array
 * position `index` within the caller's `ir.slots` traversal), used by BOTH
 * `emitSlotDecl.ts`'s per-slot dedup and `shouldDistributeSlots.ts`'s
 * duplicate-identity gate.
 *
 * WR-04 (79-REVIEW-FIX): `index` is CALLER-SCOPED — it is only ever compared
 * for equality against other keys computed within the SAME caller's single
 * traversal (a `Set<string>` built up over one loop). The two current
 * callers derive `index` from different bases (`emitSlotDecl.ts` indexes the
 * FULL `ir.slots` array including portal slots; `shouldDistributeSlots.ts`
 * first filters out portal slots, then indexes the FILTERED array), so the
 * same `SlotDecl` can receive a different ordinal-based key from each
 * caller. That is safe ONLY because neither caller ever compares its own
 * keys against the other caller's keys — each does an internal
 * self-consistency check (dedup within one pass) and nothing more. Do NOT
 * persist a key across calls, compare keys computed by different callers, or
 * assume the ordinal component is stable across `ir.slots` filtering
 * choices — it is not, by design; only same-caller equality is guaranteed.
 */
export function slotIdentityKey(slot: SlotDecl, index: number): string {
  if (slot.dynamicNameExpr === undefined) return slot.name;
  if (slot.namePrefix !== undefined && slot.namePrefix.length > 0) {
    return `${DYNAMIC_FAMILY_PREFIX}${slot.namePrefix}`;
  }
  return `${DYNAMIC_ORDINAL_PREFIX}${index}`;
}

/**
 * PascalCase a raw authored fragment for use in a generated identifier —
 * every run of non-alphanumeric characters is treated as a segment
 * boundary, e.g. `'cell-'` -> `'Cell'`, `'user-row-'` -> `'UserRow'`.
 */
function pascalCaseFragment(raw: string): string {
  return raw
    .split(/[^a-zA-Z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Return the PascalCase field suffix used to name `emitSlotDecl.ts`'s
 * per-slot class members (`_hasSlot<suffix>`, `_slot<suffix>Elements`,
 * `Rozie<suffix>SlotCtx`). Derived from the SAME three-priority identity as
 * `slotIdentityKey` (kept in this one module so the two never drift), so
 * two slots with distinct identity keys always produce distinct suffixes.
 *
 * The identity-key Set (`slotIdentityKey`, gated on the NUL-prefixed
 * namespace) is what actually PREVENTS a duplicate class-member identifier
 * from ever being emitted; this suffix is a human-readable PascalCase
 * projection of that same identity for naming purposes only.
 *
 * Phase 79 Plan 09 (R12 — closing the gap this file's own doc comment used
 * to flag): a non-identifier/kebab STATIC slot name (e.g. `cell-total`) is
 * routed through `pascalCaseFragment` too, so its class-member suffix is a
 * legal identifier (`CellTotal`) instead of the raw hyphenated text, which
 * would otherwise emit an invalid `_hasSlotCell-total` class field (parses
 * as subtraction, not an identifier — a hard syntax error). For every
 * PRE-EXISTING identifier-shaped static name, `pascalCaseFragment` produces
 * the byte-identical result the old `charAt(0).toUpperCase() + slice(1)`
 * formula did (a single non-alphanumeric-free segment, first letter
 * capitalized) — AC-1 byte-identity is preserved for every fixture that
 * predates this plan.
 */
export function slotFieldSuffix(slot: SlotDecl, index: number): string {
  if (slot.dynamicNameExpr !== undefined) {
    if (slot.namePrefix !== undefined && slot.namePrefix.length > 0) {
      return `Dynamic${pascalCaseFragment(slot.namePrefix)}`;
    }
    return `Dynamic${index}`;
  }
  // Default slot: name === ''. Use 'Default' as the field suffix.
  if (slot.name === '') return 'Default';
  return pascalCaseFragment(slot.name);
}
