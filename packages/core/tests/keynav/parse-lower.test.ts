// Phase 71 Plan 02 Task 1 — parse-lower coverage for every `<behavior>` case
// in 71-02-PLAN.md Task 1. Proves the parser-level Landmine-1 allowlist
// widening (parseTemplate.ts) + the dedicated keynav lowering branches
// (lowerTemplate.ts) + the bespoke `resolveKeynavModifiers` resolver
// (Landmine 2) together produce the target additive IR shape
// (`keynavRoot?`/`keynavItem?` on `TemplateElementIR`) with zero diagnostics
// on valid input.
//
// Harness mirrors landmine1-probe.test.ts / tests/ir/lowerTemplate-rmodel-modifiers.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
} from '../../src/ir/types.js';

function lower(src: string): { ir: IRComponent | null; diagnostics: Diagnostic[] } {
  const result = parse(src, { filename: 'consumer.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir, diagnostics } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  return { ir, diagnostics };
}

/** Wrap a `<template>` body fragment into a complete .rozie source. */
function rozie(templateBody: string, dataBlock = '{ active: 0, items: [] }'): string {
  return `<rozie name="KeynavProbe">
<data>
${dataBlock}
</data>
<template>
${templateBody}
</template>
</rozie>
`;
}

/** Recursively collect every TemplateElementIR from the IR template tree. */
function collectElements(root: TemplateNode): TemplateElementIR[] {
  const out: TemplateElementIR[] = [];
  const walk = (n: TemplateNode): void => {
    if (n.type === 'TemplateElement') {
      out.push(n);
      n.children.forEach(walk);
    } else if (n.type === 'TemplateConditional') {
      n.branches.forEach((b) => b.body.forEach(walk));
    } else if (n.type === 'TemplateLoop') {
      n.body.forEach(walk);
    } else if (n.type === 'TemplateMatch') {
      n.branches.forEach((b) => b.body.forEach(walk));
    } else if (n.type === 'TemplateSlotInvocation') {
      n.fallback.forEach(walk);
    } else if (n.type === 'TemplateFragment') {
      n.children.forEach(walk);
    }
  };
  walk(root);
  return out;
}

function errors(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.severity === 'error');
}

describe('r-keynav parse + lower (71-02 Task 1 <behavior> cases)', () => {
  it('r-keynav:tabindex.vertical.loop="$data.active" → KeynavRootIR{ tabindex, vertical, loop:true }, zero diagnostics', () => {
    const { ir, diagnostics } = lower(
      rozie('<div r-keynav:tabindex.vertical.loop="$data.active"></div>'),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot).toMatchObject({
      focusModel: 'tabindex',
      orientation: 'vertical',
      loop: true,
      typeahead: false,
      skipDisabled: true,
    });
    expect(div?.keynavRoot?.activeExpression.type).toBe('MemberExpression');
  });

  it('r-keynav:activedescendant.vertical="$data.active" → KeynavRootIR{ activedescendant, vertical, loop:false }, zero diagnostics', () => {
    const { ir, diagnostics } = lower(
      rozie('<input r-keynav:activedescendant.vertical="$data.active"/>'),
    );
    expect(errors(diagnostics)).toEqual([]);
    const input = collectElements(ir!.template!).find((el) => el.tagName === 'input');
    expect(input?.keynavRoot).toMatchObject({
      focusModel: 'activedescendant',
      orientation: 'vertical',
      loop: false,
    });
  });

  it('r-keynav-item="{ label: it.label, disabled: it.disabled }" → KeynavItemIR{ labelExpr, disabledExpr }', () => {
    const { ir, diagnostics } = lower(
      rozie(
        '<ul><li r-for="it in items :key it.id" r-keynav-item="{ label: it.label, disabled: it.disabled }">{{ it.label }}</li></ul>',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const li = collectElements(ir!.template!).find((el) => el.tagName === 'li');
    expect(li?.keynavItem?.labelExpression).toBeDefined();
    expect(li?.keynavItem?.labelExpression?.type).toBe('MemberExpression');
    expect(li?.keynavItem?.disabledExpression).toBeDefined();
    expect(li?.keynavItem?.disabledExpression?.type).toBe('MemberExpression');
  });

  it('r-keynav:tabindex.both.loop.typeahead.skipdisabled(false) → orientation both, loop/typeahead true, skipDisabled false', () => {
    const { ir, diagnostics } = lower(
      rozie(
        '<div role="menu" r-keynav:tabindex.both.loop.typeahead.skipdisabled(false)="$data.active"></div>',
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot).toMatchObject({
      focusModel: 'tabindex',
      orientation: 'both',
      loop: true,
      typeahead: true,
      skipDisabled: false,
    });
  });

  it('.skipdisabled defaults ON when the modifier is absent from the chain', () => {
    const { ir, diagnostics } = lower(
      rozie('<div r-keynav:tabindex.vertical="$data.active"></div>'),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.skipDisabled).toBe(true);
  });

  it("r-keynav-active-class=\"'is-active'\" → captured as a raw expr on the co-located KeynavRootIR", () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav:tabindex.vertical.loop="$data.active" r-keynav-active-class="'is-active'"></div>`,
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.activeClassExpression).toBeDefined();
    expect(div?.keynavRoot?.activeClassExpression?.type).toBe('StringLiteral');
  });

  it('r-keynav-active-class before r-keynav:<focus-model> in source order still merges onto the same KeynavRootIR', () => {
    const { ir, diagnostics } = lower(
      rozie(
        `<div role="menu" r-keynav-active-class="'is-active'" r-keynav:tabindex.vertical.loop="$data.active"></div>`,
      ),
    );
    expect(errors(diagnostics)).toEqual([]);
    const div = collectElements(ir!.template!).find((el) => el.tagName === 'div');
    expect(div?.keynavRoot?.activeClassExpression).toBeDefined();
    expect(div?.keynavRoot?.focusModel).toBe('tabindex');
  });
});
