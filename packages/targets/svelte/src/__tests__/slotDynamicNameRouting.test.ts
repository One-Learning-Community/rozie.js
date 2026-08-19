/**
 * Plan 79-10 Task 2 — Svelte runtime-keyed producer dispatch + matchedFamily
 * consumer routing (R3/R5/D-09).
 *
 * Generalizes 79-05's "non-identifier slot name" record-only routing to a
 * SECOND trigger: a producer `<slot :name="expr">` whose bound name does NOT
 * constant-fold (SlotDecl.dynamicNameExpr / 79-06).
 *
 * Svelte-specific hazard discovered while authoring this plan: a dynamic-name
 * slot keeps `SlotDecl.name === ''` — the SAME sentinel a genuine default
 * slot uses (79-06's Assumption A1) — and `distinctSlotsByName` (the shared
 * dedup used by every producer-side minting site) previously deduped PURELY
 * by `.name`. Two independent dynamic-name slots on one producer therefore
 * collapsed into ONE `$derived` binding, and the LIVE template render site
 * (`emitSlotInvocation.ts`, inline-imported by `emitTemplateNode.ts`) always
 * resolved to the bare `children` merge identifier REGARDLESS of which
 * dynamic slot was being rendered — confirmed empirically during authoring:
 * BOTH of `DynamicSlots.rozie`'s two dynamic slots rendered
 * `{@render children(...)}` against a `snippets?.children` lookup keyed on
 * the LITERAL string `"children"`, never the runtime expression at all. This
 * plan's fix gives each dynamic-name SlotDecl its own identity keyed on its
 * declaration ordinal (`refineSlotTypes.ts`'s `distinctSlotsByName`, mirrors
 * Lit's `slotIdentityKey.ts`), and a NEW `dynamicSlotOrdinal.ts` helper
 * locates the matching ordinal at an invocation site by comparing rewritten
 * expression TEXT (see that file's doc comment for why this is reliable).
 *
 * `matchedFamily` is exercised by hand-setting the flag directly on the
 * lowered IR's SlotFillerDecl (see the React/Solid sibling test files for the
 * rationale) — Task 3's cold-gate compile assertion covers the real
 * cross-file `compile()` round trip.
 */

import type { IRComponent, SlotFillerDecl } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelte } from '../emitSvelte.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

function compileSvelte(ir: IRComponent, filename: string): string {
  return emitSvelte(ir, { filename }).code;
}

function findFiller(node: unknown, targetName: string): SlotFillerDecl | null {
  if (node !== null && typeof node === 'object') {
    const n = node as { type?: string; slotFillers?: SlotFillerDecl[]; children?: unknown[] };
    if (n.type === 'TemplateElement' && Array.isArray(n.slotFillers)) {
      const found = n.slotFillers.find((f) => f.name === targetName);
      if (found) return found;
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) {
        const found = findFiller(c, targetName);
        if (found) return found;
      }
    }
  }
  return null;
}

describe('Svelte producer — runtime-keyed dispatch for a dynamic-name slot (R3/D-09)', () => {
  it('a SlotDecl carrying dynamicNameExpr emits a bracket-keyed snippets lookup on the rewritten expression, with no private-prop-alias operand', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Cell.rozie');
    expect(code).toContain('const __rozieDynSlot0 = $derived(snippets?.[dynName]);');
    expect(code).toContain('{@render __rozieDynSlot0?.({ value: 1 })}');
    expect(code).not.toContain('??');
    expect(code).not.toContain('__dynNameProp');
  });

  it('TWO independent dynamic-name slots on one producer key on their OWN distinct expressions, not the same merged identifier', () => {
    const ir = lowerInline(`
<rozie name="Multi">
<data>{ a: 'x', b: 'y' }</data>
<template>
<div>
  <slot :name="$data.a" :value="1"></slot>
  <slot :name="$data.b" :value="2"></slot>
</div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Multi.rozie');
    expect(code).toContain('const __rozieDynSlot0 = $derived(snippets?.[a]);');
    expect(code).toContain('const __rozieDynSlot1 = $derived(snippets?.[b]);');
    expect(code).toContain('{@render __rozieDynSlot0?.({ value: 1 })}');
    expect(code).toContain('{@render __rozieDynSlot1?.({ value: 2 })}');
  });

  it('a static-name SlotDecl in the same component emits pre-phase output unchanged', () => {
    const ir = lowerInline(`
<rozie name="Mixed">
<data>{ dynName: 'cell-total' }</data>
<template>
<div>
  <slot :name="$data.dynName" :value="1"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Mixed.rozie');
    expect(code).toContain('const header = $derived(__headerProp ?? snippets?.header);');
    expect(code).toContain('{@render header?.()}');
  });

  it('backstop: a zero-scope-param dynamic producer emits a zero-arg record call on Svelte', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ dynName: 'freeform' }</data>
<template>
<div><slot :name="$data.dynName"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'X.rozie');
    expect(code).toContain('{@render __rozieDynSlot0?.()}');
  });

  // Phase 79 Plan 15 (bug fix) — a producer `<slot :name="expr">` declared
  // INSIDE an `r-for` reads a LOOP VARIABLE in its dynamicNameExpr (mirrors
  // examples/Table.rozie's real per-column `cell-${column.key}` family,
  // which crashed at runtime on Svelte with `ReferenceError: column is not
  // defined` — caught by this phase's own Docker VR run, not by any prior
  // fixture). The loop variable does not exist at top-level script scope, so
  // the record lookup must be inlined at the render site (inside the
  // `{#each}` block) instead of hoisted into a top-level `$derived`.
  it('a slot inside r-for whose dynamicNameExpr reads the loop variable does NOT hoist a top-level $derived, and inlines the record lookup at the render site', () => {
    const ir = lowerInline(`
<rozie name="Grid">
<props>{ columns: { type: Array, default: () => [] } }</props>
<template>
<div>
  <div r-for="column in $props.columns" :key="column.key">
    <slot :name="\`cell-\${column.key}\`" :column="column"></slot>
  </div>
</div>
</template>
</rozie>
`);
    const slot = ir.slots.find((s) => s.dynamicNameExpr !== undefined);
    expect(slot).toBeDefined();
    expect(slot!.inLoop).toBe(true);
    const code = compileSvelte(ir, 'Grid.rozie');
    // The bug: this used to appear as a top-level `const __rozieDynSlot0 =
    // $derived(snippets?.[`cell-${column.key}`]);` line in <script>, which
    // ReferenceErrors at runtime because `column` isn't in scope there.
    expect(code).not.toMatch(
      /const __rozieDynSlot\d+ = \$derived\(snippets\?\.\[`cell-\$\{column\.key\}`\]\);/,
    );
    expect(code).not.toContain('__rozieDynSlot0');
    // The fix: the record lookup is inlined directly at the render site,
    // inside the {#each} block where `column` IS in scope.
    expect(code).toContain('{#each columns as column (column.key)}');
    expect(code).toContain('{@render (snippets?.[`cell-${column.key}`])?.({ column })}');
  });
});

describe('Svelte consumer — matchedFamily fill emits the snippets record-object form (R5/D-09)', () => {
  it("a matchedFamily fill emits a {#snippet} block referenced from the snippets={{...}} record, keyed on the fill's own static name", () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #cellStatus="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const filler = findFiller(ir.template, 'cellStatus');
    expect(filler).not.toBeNull();
    filler!.matchedFamily = true;
    const code = compileSvelte(ir, 'ConsumerX.rozie');
    expect(code).toMatch(/snippets=\{\{\s*\['cellStatus'\]:\s*__rozieDynSlot_0/);
    expect(code).not.toContain('{#snippet cellStatus(');
  });

  it('a fill WITHOUT matchedFamily stays on its ordinary {#snippet name} path (byte-identical control)', () => {
    const ir = lowerInline(`
<rozie name="ConsumerY">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #cellStatus="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'ConsumerY.rozie');
    expect(code).toContain('{#snippet cellStatus({ value })}');
    expect(code).not.toMatch(/snippets=\{\{/);
  });
});
