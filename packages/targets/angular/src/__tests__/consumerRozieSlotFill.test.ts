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
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitDynamicSlotFiller, type EmitSlotFillerCtx } from '../emit/emitSlotFiller.js';
import { emitNode, type EmitNodeCtx } from '../emit/emitTemplateNode.js';
import type { IRComponent, SlotFillerDecl } from '../../../../core/src/ir/types.js';

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
    expect(emission!.template.startsWith('<ng-template [rozieSlot]="dynName()" let-value="value">')).toBe(true);
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
    expect(emission!.template.startsWith("<ng-template [rozieSlot]=\"'cell-status'\" let-value=\"value\">")).toBe(true);
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
    expect(emission!.template.startsWith("<ng-template [rozieSlot]=\"'cellStatus'\" let-value=\"value\">")).toBe(true);
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
