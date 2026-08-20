/**
 * Phase 80 Plan 05 — Angular consumer-side record-path slot-fill rewrite
 * (net deletion of the ViewChild/getter/binding path, replaced by a single
 * `<ng-template [rozieSlot]="<key>">` marker declaration — SPEC R4/R6).
 *
 * Task 1 exercises `emitDynamicSlotFiller` directly (not through the full
 * `emitAngular()` pipeline) — at Task 1's commit, `emitTemplateNode.ts`'s
 * caller has not yet been updated (that's Task 2), so driving these
 * assertions through the full compile round trip would exercise stale
 * caller code. Calling the reshaped function directly against a REAL
 * lowered `SlotFillerDecl` (obtained via `findFiller` over a real consumer
 * IR) isolates exactly what Task 1 changed.
 *
 * Task 2 and Task 3 add further describe blocks exercising the full
 * `emitAngular()` round trip, since by their commits the caller
 * (`emitTemplateNode.ts`) and the decorator/import wiring
 * (`emitDecorator.ts`/`emitAngular.ts`) are both updated.
 */

import type { IRComponent, SlotFillerDecl } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { type EmitSlotFillerCtx, emitDynamicSlotFiller } from '../emit/emitSlotFiller.js';
import { type EmitNodeCtx, emitNode } from '../emit/emitTemplateNode.js';
import { emitAngular } from '../emitAngular.js';

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

function compileAngular(ir: IRComponent, filename = 'inline.rozie'): string {
  const { code } = emitAngular(ir, { filename });
  return code;
}

/** Recursively locate the first SlotFillerDecl named `targetName` anywhere in the IR template tree. */
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

/** Build a minimal-but-real EmitSlotFillerCtx backed by the real emitNode recursion. */
function fillerCtxFor(ir: IRComponent): EmitSlotFillerCtx {
  const nodeCtx: EmitNodeCtx = {
    ir,
    registry: createDefaultRegistry(),
    diagnostics: [],
    scriptInjections: [],
    injectionCounter: { next: 0 },
    hasNgModel: { value: false },
  };
  return {
    ir,
    emitChildren: (children) => children.map((c) => emitNode(c, nodeCtx)).join(''),
  };
}

describe('Task 1 — emitDynamicSlotFiller emits a keyed [rozieSlot] marker declaration (Phase 80 R4)', () => {
  it('a dynamic-name fill emits <ng-template [rozieSlot]="<template-scope key>"> with its let-bindings and body, and no synthetic ref field', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ dynName: 'header' }</data>
<template>
<div>
  <Cell>
    <template #[$data.dynName]="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const filler = findFiller(ir.template, '$data.dynName');
    expect(filler).not.toBeNull();
    const emission = emitDynamicSlotFiller(filler!, fillerCtxFor(ir));
    expect(emission).not.toBeNull();
    expect(
      emission!.template.startsWith('<ng-template [rozieSlot]="dynName()" let-value="value">'),
    ).toBe(true);
    expect(emission!.template.endsWith('</ng-template>')).toBe(true);
    expect(emission!.template).toContain('value');
    expect(emission!.keyExpr).toBe('dynName()');
    expect(emission).not.toHaveProperty('refName');
    expect(emission).not.toHaveProperty('classBodyKeyExpr');
  });

  it('a non-identifier static fill (#cell-status) emits the same marker shape bound to the single-quoted escaped literal key', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #cell-status="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const filler = findFiller(ir.template, 'cell-status');
    expect(filler).not.toBeNull();
    const emission = emitDynamicSlotFiller(filler!, fillerCtxFor(ir));
    expect(emission).not.toBeNull();
    expect(
      emission!.template.startsWith(
        '<ng-template [rozieSlot]="\'cell-status\'" let-value="value">',
      ),
    ).toBe(true);
    expect(emission!.template.endsWith('</ng-template>')).toBe(true);
    expect(emission!.keyExpr).toBe("'cell-status'");
  });

  it('a matchedFamily fill emits the same marker shape bound to the single-quoted escaped literal key', () => {
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
    const emission = emitDynamicSlotFiller(filler!, fillerCtxFor(ir));
    expect(emission).not.toBeNull();
    expect(
      emission!.template.startsWith('<ng-template [rozieSlot]="\'cellStatus\'" let-value="value">'),
    ).toBe(true);
    expect(emission!.template.endsWith('</ng-template>')).toBe(true);
    expect(emission!.keyExpr).toBe("'cellStatus'");
  });

  it('no emitted marker declaration contains a synthetic dynamic-slot ref name', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ dynName: 'header' }</data>
<template>
<div>
  <Cell>
    <template #[$data.dynName]>
      <span>fallback</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const filler = findFiller(ir.template, '$data.dynName');
    const emission = emitDynamicSlotFiller(filler!, fillerCtxFor(ir));
    expect(emission!.template).not.toMatch(/__dynSlot_/);
  });
});

describe('Task 2 — consumer emits record-path fills as plain children, no ViewChild/getter/binding (Phase 80 R4/R6)', () => {
  it('a consumer with a record-path fill emits it as a direct child of the producer tag, with no attribute binding added to that tag', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ dynName: 'header' }</data>
<template>
<div>
  <Cell>
    <template #[$data.dynName]>
      <span>fallback</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).toMatch(/<rozie-cell><ng-template \[rozieSlot\]="dynName\(\)">/);
    expect(code).not.toMatch(/<rozie-cell[^>]*\[templates\]/);
  });

  it('emitted output contains no synthetic ref, no view-query field, no record getter, and no record-input binding', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ dynName: 'header' }</data>
<template>
<div>
  <Cell>
    <template #[$data.dynName]>
      <span>fallback</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).not.toMatch(/__dynSlot_/);
    expect(code).not.toMatch(/@ViewChild\(/);
    expect(code).not.toMatch(/get templates\(\)/);
    expect(code).not.toMatch(/\[templates\]="templates"/);
  });

  it('the dynamic-slot-filler flag still fires — the producer tag`s marker fill still emits when at least one record-path fill is present', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ dynName: 'header' }</data>
<template>
<div>
  <Cell>
    <template #[$data.dynName]>
      <span>fallback</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).toContain('[rozieSlot]="dynName()"');
  });

  it('two fills on one producer tag with equal static-literal keys produce ROZ724, located at the second fill', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #cell-status="{ value }">
      <span>{{ value }}</span>
    </template>
    <template #cell-status2="{ value }">
      <strong>{{ value }}</strong>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    // Force a genuine key collision by giving the second filler the same
    // static name as the first, post-lowering (mirrors slotFamilyConsumerRouting's
    // hand-set-flag pattern for isolating the emit function's own dispatch).
    const second = findFiller(ir.template, 'cell-status2');
    expect(second).not.toBeNull();
    second!.name = 'cell-status';
    const { diagnostics } = emitAngular(ir, { filename: 'inline.rozie' });
    const dupes = diagnostics.filter((d) => d.code === 'ROZ724');
    expect(dupes.length).toBe(1);
    expect(dupes[0].loc).toEqual(second!.sourceLoc);
  });

  it('two fills whose keys are runtime expressions produce no ROZ724, even though they would collide at runtime', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ keyA: 'x', keyB: 'x' }</data>
<template>
<div>
  <Cell>
    <template #[$data.keyA]>
      <span>a</span>
    </template>
    <template #[$data.keyB]>
      <span>b</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const { diagnostics } = emitAngular(ir, { filename: 'inline.rozie' });
    const dupes = diagnostics.filter((d) => d.code === 'ROZ724');
    expect(dupes.length).toBe(0);
  });
});

describe('Task 3 — RozieSlot wired into imports: array and the top-of-file import line, gated on record-path presence (Phase 80 R4)', () => {
  // Quick task 260819-sg9 (Tier 2) — every fixture below is single-root, so
  // it also inherits the default `inherit-attrs` auto-fallthrough `$attrs`
  // spread unless disabled. That spread would legitimately pull in
  // `createRozieAttrApplier`/`createRozieHostAttrsReader` from
  // `@rozie/runtime-angular` too — a real, separately-proven seam
  // (`attrApplierRuntimeImports.test.ts`), not something this
  // RozieSlot-wiring-focused describe block should assert on.
  // `inherit-attrs="false"` keeps each fixture scoped to the slot seam.
  it('a consumer emitting a record-path fill lists RozieSlot in imports: and imports it from @rozie/runtime-angular', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX" inherit-attrs="false">
<components>{ Cell: "./Cell.rozie" }</components>
<data>{ dynName: 'header' }</data>
<template>
<div>
  <Cell>
    <template #[$data.dynName]>
      <span>fallback</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).toMatch(/import \{ RozieSlot \} from '@rozie\/runtime-angular';/);
    expect(code).toMatch(/imports:\s*\[[^\]]*\bRozieSlot\b[^\]]*\]/);
  });

  it('a zero-slot component imports nothing from @rozie/runtime-angular and has an unchanged imports: array', () => {
    const ir = lowerInline(`
<rozie name="Plain" inherit-attrs="false">
<template>
<div>Hello</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).not.toMatch(/@rozie\/runtime-angular/);
    expect(code).not.toMatch(/RozieSlot/);
  });

  it('a component with only identifier-named static slots imports nothing from @rozie/runtime-angular either', () => {
    const ir = lowerInline(`
<rozie name="ConsumerY" inherit-attrs="false">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #header>
      <span>Header</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const code = compileAngular(ir);
    expect(code).not.toMatch(/@rozie\/runtime-angular/);
    expect(code).not.toMatch(/\bRozieSlot\b/);
  });
});
