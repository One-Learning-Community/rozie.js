// Phase 71 Plan 01 Task 1 — LANDMINE 1: red-witness probe.
//
// FLIPPED GREEN by Plan 71-02 Task 1. This file originally locked the
// pre-fix behavior: the `.rozie` directive grammar hard-coded the
// `.modifier`-chain split (parseTemplate.ts) and the colon-arg /
// binding-attribute allowlists (lowerTemplate.ts) to `r-model` ONLY, so
// `r-keynav:<focus-model>[.<modifier>…]="…"` compiled to a hard ROZ962
// (DIRECTIVE_TAKES_NO_MODIFIERS) with the directive dropped, and
// `r-keynav-item="{ … }"` was dropped with ZERO diagnostic.
//
// 71-02 Task 1 generalized both guard sites (parseTemplate.ts's `directiveBase`
// allowlist now includes `keynav` alongside `model`; lowerTemplate.ts gained
// dedicated early-return branches for `keynav:`/`keynav-item`/
// `keynav-active-class` placed before the ROZ962 generic guard). The target
// IR shape landed as ADDITIVE OPTIONAL FIELDS on `TemplateElementIR`
// (`keynavRoot?: KeynavRootIR`, `keynavItem?: KeynavItemIR` — types.ts,
// following the `isExternal?`/`slotFillers?` precedent) rather than as new
// `AttributeBinding` kinds — see 71-02-PLAN.md's interfaces section. The
// assertions below were updated accordingly from 71-01's original
// commented-out `attrs.find((a) => a.kind === 'keynavRoot')` sketch (written
// before that design decision was finalized).
//
// Harness mirrors tests/ir/lowerTemplate-rmodel-modifiers.test.ts.
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

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
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

describe('LANDMINE 1 red-witness — r-keynav directive grammar (Phase 71 Plan 01, flipped green by 71-02)', () => {
  it('r-keynav:tabindex.vertical.loop → lowers to a keynavRoot marker, zero ROZ962', () => {
    const { ir, diagnostics } = lower(
      rozie('<div r-keynav:tabindex.vertical.loop="$data.active"></div>'),
    );
    expect(byCode(diagnostics, 'ROZ962')).toEqual([]);
    const els = ir?.template ? collectElements(ir.template) : [];
    const div = els.find((el) => el.tagName === 'div');
    expect(div?.keynavRoot).toBeDefined();
    expect(div?.keynavRoot?.focusModel).toBe('tabindex');
    expect(div?.keynavRoot?.orientation).toBe('vertical');
    expect(div?.keynavRoot?.loop).toBe(true);
    expect(div?.keynavRoot?.typeahead).toBe(false);
    // `.skipdisabled` defaults ON when absent from the modifier chain.
    expect(div?.keynavRoot?.skipDisabled).toBe(true);
  });

  it('r-keynav:activedescendant.vertical (combobox model) → lowers cleanly, zero ROZ962', () => {
    const { ir, diagnostics } = lower(
      rozie('<input r-keynav:activedescendant.vertical="$data.active"/>'),
    );
    expect(byCode(diagnostics, 'ROZ962')).toEqual([]);
    const els = ir?.template ? collectElements(ir.template) : [];
    const input = els.find((el) => el.tagName === 'input');
    expect(input?.keynavRoot).toBeDefined();
    expect(input?.keynavRoot?.focusModel).toBe('activedescendant');
    expect(input?.keynavRoot?.orientation).toBe('vertical');
    expect(input?.keynavRoot?.loop).toBe(false);
  });

  it('r-keynav-item="{ label }" → lowers to a keynavItem marker with labelExpression', () => {
    const { ir, diagnostics } = lower(
      rozie(
        '<ul><li r-for="it in items :key it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</li></ul>',
      ),
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const els = ir?.template ? collectElements(ir.template) : [];
    const li = els.find((el) => el.tagName === 'li');
    expect(li?.keynavItem).toBeDefined();
    expect(li?.keynavItem?.labelExpression).toBeDefined();
    expect(li?.keynavItem?.disabledExpression).toBeUndefined();
  });
});
