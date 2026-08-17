/**
 * Plan 79-11 Task 2 — Angular matchedFamily consumer routing (R5/D-09), the
 * sixth and final target for this phase.
 *
 * `matchedFamily` (set by threadParamTypes's cross-file family-matching pass,
 * 79-07) is exercised here by hand-setting the flag directly on the lowered
 * IR's SlotFillerDecl rather than through a real cross-file `compile()` —
 * this isolates the EMIT function's dispatch (this plan's actual job) from
 * the family-matching THREADING itself (already covered by 79-07's own
 * tests), mirroring React/Solid's 79-10 test structure verbatim. Task 3's
 * cold-gate compile assertion exercises the full, real-file-on-disk round
 * trip against the actual DynamicSlots fixture pair.
 *
 * DEAD-FILE WARNING (79-05, verified at orchestrator level 2026-08-16):
 * every assertion below drives the REAL `emitAngular()` entrypoint, which
 * exercises the LIVE consumer dispatch loop in `emitTemplateNode.ts` (the
 * `filler.isDynamic || isRecordOnlyStatic || filler.matchedFamily` entry
 * condition) and `emitSlotFiller.ts`'s `emitDynamicSlotFiller` — the SAME
 * seams the plan's DEAD-FILE WARNING calls out by name (this is exactly the
 * trap 79-05 hit: the plan's own `<files>` list for this task cites only
 * `emitSlotFiller.ts`, but the CALLER'S entry-condition switch in
 * `emitTemplateNode.ts` also had to change, or `matchedFamily` fills would be
 * silently dropped entirely rather than mis-routed).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
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

describe('Angular consumer — matchedFamily fill routes into the existing [templates] getter path (R5/D-09)', () => {
  it('a matchedFamily fill (identifier-shaped name) emits into the [templates] getter, not @ContentChild, keyed on a quoted string literal', () => {
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
    const code = compileAngular(ir);
    expect(code).toMatch(/\[templates\]="templates"/);
    expect(code).toMatch(/get templates\(\): Record<string, TemplateRef<unknown>>/);
    expect(code).toMatch(/\['cellStatus'\]: this\.__dynSlot_\d+!/);
    expect(code).not.toMatch(/#cellStatus/);
    expect(code).not.toMatch(/@ContentChild\('cellStatus'/);
  });

  it('a fill WITHOUT matchedFamily stays on its ordinary @ContentChild path (byte-identical control)', () => {
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
    const code = compileAngular(ir);
    expect(code).toContain('<ng-template #cellStatus let-value="value">');
    expect(code).not.toMatch(/\[templates\]="templates"/);
  });

  it('two matchedFamily fills on one element BOTH appear in the emitted getter map, neither dropped', () => {
    const ir = lowerInline(`
<rozie name="ConsumerZ">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #cellStatus="{ value }">
      <span>{{ value }}</span>
    </template>
    <template #cellScore="{ value }">
      <strong>{{ value }}</strong>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const statusFiller = findFiller(ir.template, 'cellStatus');
    const scoreFiller = findFiller(ir.template, 'cellScore');
    expect(statusFiller).not.toBeNull();
    expect(scoreFiller).not.toBeNull();
    statusFiller!.matchedFamily = true;
    scoreFiller!.matchedFamily = true;
    const code = compileAngular(ir);
    expect(code).toMatch(/\['cellStatus'\]: this\.__dynSlot_\d+!/);
    expect(code).toMatch(/\['cellScore'\]: this\.__dynSlot_\d+!/);
    // Exactly one [templates] binding on the element — both fills merge into
    // ONE getter/map rather than one binding per fill overwriting the other.
    const templatesBindingCount = (code.match(/\[templates\]="templates"/g) ?? []).length;
    expect(templatesBindingCount).toBe(1);
  });

  it('the [templates] getter is emitted as a component-class member, never as an inline arrow inside the template', () => {
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
    filler!.matchedFamily = true;
    const code = compileAngular(ir);
    expect(code).toMatch(/get templates\(\): Record<string, TemplateRef<unknown>> \{/);
    // The template-side binding is a bare identifier reference, not an arrow.
    const bindingMatch = code.match(/\[templates\]="[^"]*"/);
    expect(bindingMatch).not.toBeNull();
    expect(bindingMatch![0]).not.toContain('=>');
  });
});
