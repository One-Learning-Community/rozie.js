/**
 * refineSlotTypes — Phase 5 Plan 02a Task 1.
 *
 * Builds the per-slot Snippet type signature lines for inclusion inside a
 * Svelte 5 `interface Props { ... }` block. Each SlotDecl produces ONE entry:
 *
 *   - `name: ''`, params=[]                → `children?: Snippet`
 *   - `name: ''`, params=[Ctx]             → `children?: Snippet<[any]>`
 *   - `name: 'header'`, params=[]          → `header?: Snippet`
 *   - `name: 'header'`, params=[A, B, ...] → `header?: Snippet<[any, any, ...]>`
 *
 * Per RESEARCH Pattern 3: single-param slots emit `Snippet<[any]>` (single-element
 * tuple); multi-param slots emit `Snippet<[any, any, ...]>`. Each param type is
 * `any` for v1 (TYPES-01 / Phase 6 refines once the type-flow pass lands).
 *
 * Caller composes the returned lines into the Props interface body. Empty
 * input returns an empty array (caller skips the slot section entirely).
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';

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
  for (const s of slots) {
    const slotKey = s.name === '' ? 'children' : s.name;
    const paramTuple =
      s.params.length === 0
        ? ''
        : `<[${s.params.map(() => 'any').join(', ')}]>`;
    lines.push(`  ${slotKey}?: Snippet${paramTuple};`);
  }
  return lines;
}
