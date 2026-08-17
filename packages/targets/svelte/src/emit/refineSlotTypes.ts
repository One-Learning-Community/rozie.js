/**
 * refineSlotTypes — Phase 5 Plan 02a Task 1.
 *
 * Builds the per-slot Snippet type signature lines for inclusion inside a
 * Svelte 5 `interface Props { ... }` block. Each SlotDecl produces ONE entry:
 *
 *   - `name: ''`, params=[]                → `children?: Snippet`
 *   - `name: ''`, params=[Ctx(close)]      → `children?: Snippet<[{ close: any }]>`
 *   - `name: 'header'`, params=[]          → `header?: Snippet`
 *   - `name: 'header'`, params=[A, B, ...] → `header?: Snippet<[{ A: any; B: any; ... }]>`
 *
 * Phase 07.3.1 D-02 (Blocker #2): scoped slots emit a single-tuple object
 * literal (`Snippet<[{ A: any; B: any }]>`) rather than a multi-arg positional
 * tuple. This aligns the producer-side Snippet type with the object-payload
 * shape emitted by emitSlotInvocation.ts and matches the consumer-side
 * `{#snippet header({ close })}` destructure. Each param value type is `any`
 * for v1 (TYPES-01 / Phase 6 refines once the type-flow pass lands).
 *
 * Caller composes the returned lines into the Props interface body. Empty
 * input returns an empty array (caller skips the slot section entirely).
 *
 * Phase 79 Plan 05 (R12/D-03): a slot name that is NOT a valid JS identifier
 * (e.g. `cell-status`) mints NO named Props-interface member and is reachable
 * only through the bracket-keyed `snippets` record — `isRecordOnlySlotName`
 * below is this file's gate, `renderRecordKey` its escaped-key single source
 * of truth (T-79-07), and `buildSnippetsRecordType` folds a quoted-literal
 * member into the `snippets?: ...;` prop type for such a slot. The identifier
 * SHAPE check itself is `isSlotNameIdentifier`, imported from core — every
 * R12 routing site imports it directly (never redeclares it) so a future
 * edit that forgets the check in one module is grep-detectable (T-79-08).
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';

/**
 * Dedupe SlotDecls by DISTINCT slot name (first occurrence wins).
 *
 * A template may legitimately declare the same `<slot name="X">` more than once
 * (e.g. one value-bubble per thumb in a range slider), in which case `ir.slots`
 * carries one SlotDecl per OCCURRENCE. The render-time `{@render X?.()}`
 * invocation markup is emitted per-occurrence by emitSlotInvocation (each site
 * renders the same snippet) — but the Props-interface field, the `$props()`
 * destructure rename (`X: __XProp`) and the `$derived` merge must be emitted
 * EXACTLY ONCE per distinct slot name, otherwise the compiled `.svelte` has a
 * duplicate `__XProp` binding and fails Svelte's parser ("Identifier '__XProp'
 * has already been declared"). Matches the single-declaration behavior of the
 * other targets.
 */
export function distinctSlotsByName(slots: SlotDecl[]): SlotDecl[] {
  const seen = new Set<string>();
  return slots.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

/**
 * Phase 79 Plan 05 (R12/D-03) — whether `name` routes through the
 * bracket-keyed `snippets` record ONLY (no named Props-interface member, no
 * `$props()` destructure entry, no private prop alias). Mirrors the identical
 * helper on every other R12 target (Vue/React/Solid). The default slot (`''`)
 * is excluded explicitly — `isSlotNameIdentifier` does not special-case the
 * empty string, and the default slot always keeps its `children` merge path
 * regardless of shape.
 */
export function isRecordOnlySlotName(name: string): boolean {
  return name !== '' && !isSlotNameIdentifier(name);
}

/**
 * Escape a single-quoted string-literal key body: backslash first (so a
 * backslash inserted by the quote-escape step is not itself re-escaped), then
 * single quotes. Mirrors the identical helper in every other R12 target's
 * `refineSlotTypes.ts` (T-79-07) so every target's record-key emission
 * escapes the same way.
 */
function escapeSingleQuotedKey(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Render the bracket-lookup key for a record-only slot name: single-quoted
 * and escaped, so a quote/backslash in the author's slot name cannot break
 * out of the emitted string literal (T-79-07).
 */
export function renderRecordKey(name: string): string {
  return `'${escapeSingleQuotedKey(name)}'`;
}

/**
 * Build per-slot Snippet field declarations for the Props interface.
 *
 * Default slot (`name === ''`) emits as `children` per Svelte 5 magic-prop
 * convention (RESEARCH Pattern 3).
 *
 * Phase 79 Plan 05 — a record-only (non-identifier) slot name mints NO field
 * here at all; it is reachable only through the `snippets` record (see
 * `buildSnippetsRecordType` below).
 *
 * Returns an array of `key: type;` lines (no surrounding braces, two-space
 * indented for direct splicing into a `{\n${...}\n}` block).
 */
export function buildSlotTypeFields(slots: SlotDecl[]): string[] {
  const lines: string[] = [];
  for (const s of distinctSlotsByName(slots)) {
    if (isRecordOnlySlotName(s.name)) continue;
    const slotKey = s.name === '' ? 'children' : s.name;
    // Phase 07.3.1 D-02 — object-tuple matches the object-shape snippet args
    // emitted by emitSlotInvocation.ts. Single-element tuple wrapping a struct
    // literal aligns with Vue's `defineSlots<{ header(p: { close: any }): any }>`
    // convention and lets TypeScript catch destructure-mismatch on the
    // consumer side.
    const paramTuple =
      s.params.length === 0
        ? ''
        : `<[{ ${s.params.map((p) => `${p.name}: any`).join('; ')} }]>`;
    lines.push(`  ${slotKey}?: Snippet${paramTuple};`);
  }
  return lines;
}

/**
 * Render the `snippets?: ...;` prop's TYPE text (the RHS only — no leading
 * field name / trailing semicolon; the caller composes those).
 *
 * A component with no record-only slots keeps the pre-phase generic
 * `Record<string, any>` shape byte-identical (AC-22). A component with at
 * least one record-only slot gets a quoted-literal-keyed intersection member
 * for that slot, alongside the generic fallback for any OTHER dynamic-name
 * fill the R5 path already supports.
 */
export function buildSnippetsRecordType(slots: SlotDecl[]): string {
  const recordOnly = distinctSlotsByName(slots).filter((s) => isRecordOnlySlotName(s.name));
  if (recordOnly.length === 0) return 'Record<string, any>';
  const fields = recordOnly.map((s) => {
    const paramTuple =
      s.params.length === 0
        ? ''
        : `<[{ ${s.params.map((p) => `${p.name}: any`).join('; ')} }]>`;
    return `${renderRecordKey(s.name)}?: Snippet${paramTuple};`;
  });
  return `{ ${fields.join(' ')} } & Record<string, any>`;
}
