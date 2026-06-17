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
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';

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
 * Build per-slot Snippet field declarations for the Props interface.
 *
 * Default slot (`name === ''`) emits as `children` per Svelte 5 magic-prop
 * convention (RESEARCH Pattern 3).
 *
 * Returns an array of `key: type;` lines (no surrounding braces, two-space
 * indented for direct splicing into a `{\n${...}\n}` block).
 */
export function buildSlotTypeFields(slots: SlotDecl[]): string[] {
  const lines: string[] = [];
  for (const s of distinctSlotsByName(slots)) {
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
