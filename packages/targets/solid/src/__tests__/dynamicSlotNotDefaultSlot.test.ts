/**
 * dynamicSlotNotDefaultSlot.test.ts — Phase 79 Plan 12 Task 3 escape (R6).
 *
 * `emitSolid.ts`'s `hasDefaultSlot` computation — `(ir.slots ?? []).some((s)
 * => s.name === '')` — predates Phase 79 and does not know about
 * `dynamicNameExpr`. A dynamic-name slot shares the `''` default-slot
 * sentinel (79-06 Assumption A1) but is NOT the genuine default slot, so a
 * producer with ONLY dynamic-name/record-only slots (no genuine default
 * slot at all) was incorrectly treated as `hasDefaultSlot === true`:
 *   - `'children'` gets pushed into the `splitProps` destructure key list,
 *     even though the component's `Props` interface has no `children` field
 *     at all — `tsc --strict` rejects this (`'children'` is not `keyof
 *     Props`, and `local.children` does not exist on the picked type).
 *   - `const resolved = children(() => local.children);` is emitted and
 *     never used, and the `children` import from `solid-js` becomes unused.
 *
 * Discovered compiling the real DynamicSlots consumer-ts fixture (Task 3)
 * under `tsc --strict` — the fixture declares a `cell-` family, a `row-`
 * family, and a static `cell-total` record-only slot, but NO genuine
 * default slot.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

describe('emitSolid — a dynamic-name slot does NOT count as the genuine default slot for hasDefaultSlot (D-131)', () => {
  it("a producer with ONLY a dynamic-name slot (no genuine default slot) does NOT split 'children' or emit the children() accessor", () => {
    const ir = lowerInline(`
<rozie name="OnlyDynamic">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'OnlyDynamic.rozie' });
    expect(code).not.toContain("'children'");
    expect(code).not.toContain('children(() => local.children)');
    expect(code).not.toMatch(/^import \{[^}]*\bchildren\b[^}]*\} from 'solid-js';/m);
  });

  it('a dynamic-name slot alongside a genuine default slot still correctly treats the REAL default slot as hasDefaultSlot', () => {
    const ir = lowerInline(`
<rozie name="DynamicPlusDefault">
<data>{ dynName: 'cell-total' }</data>
<template>
<div>
  <slot :name="$data.dynName" :value="1"></slot>
  <slot></slot>
</div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'DynamicPlusDefault.rozie' });
    expect(code).toContain("'children'");
    expect(code).toContain('children(() => local.children)');
  });
});
