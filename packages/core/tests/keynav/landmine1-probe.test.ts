// Phase 71 Plan 01 Task 1 — LANDMINE 1: red-witness probe.
//
// LANDMINE 1 — Wave 2 (plan 71-02) FLIPS these expectations to the target IR
// shape. This file locks TODAY's (pre-fix) behavior: the `.rozie` directive
// grammar hard-codes the `.modifier`-chain split (parseTemplate.ts) and the
// colon-arg / binding-attribute allowlists (lowerTemplate.ts) to `r-model`
// ONLY. `r-keynav:<focus-model>[.<modifier>…]="…"` therefore compiles TODAY
// to a hard ROZ962 (DIRECTIVE_TAKES_NO_MODIFIERS) error with the entire
// directive silently dropped from the IR — it never reaches an emitter.
// `r-keynav-item="{ … }"` (no dot, no colon) is even quieter: it hits NO
// guard at all and is dropped with ZERO diagnostic.
//
// This is a plain PASSING test asserting today's BROKEN behavior (not
// `.fixme`) — it is a version-controlled failure-mode lock, per 71-01-PLAN.md
// Task 1. When 71-02 lands the parser/lowerer generalization (Landmine 1
// fix), this file's expectations must be FLIPPED to the commented-out
// target-IR-shape assertions at the bottom of each `it()` block.
//
// Harness mirrors tests/ir/lowerTemplate-rmodel-modifiers.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import type { IRComponent, TemplateNode, AttributeBinding } from '../../src/ir/types.js';

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

/** Recursively collect every AttributeBinding from the IR template tree. */
function collectAttrs(root: TemplateNode): AttributeBinding[] {
  const out: AttributeBinding[] = [];
  const walk = (n: TemplateNode): void => {
    if (n.type === 'TemplateElement') {
      out.push(...n.attributes);
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

describe('LANDMINE 1 red-witness — r-keynav directive grammar (Phase 71 Plan 01)', () => {
  it('r-keynav:tabindex.vertical.loop → CURRENTLY ROZ962, directive silently dropped', () => {
    const { ir, diagnostics } = lower(
      rozie('<div r-keynav:tabindex.vertical.loop="$data.active"></div>'),
    );
    const hits = byCode(diagnostics, 'ROZ962');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    // Today the parser never splits `keynav:tabindex` off the modifier chain
    // (Landmine 1 — the split is `r-model`-ONLY), so the generic ROZ962 guard
    // sees the WHOLE unsplit remainder as the "directive base" and reports it
    // verbatim — proof the failure is exactly the guard-site the plan targets.
    expect(hits[0]!.message).toContain('r-keynav:tabindex');
    // No trace of keynav reaches the IR — the attribute is `continue`d away.
    const attrs = ir?.template ? collectAttrs(ir.template) : [];
    expect(attrs.some((a) => 'name' in a && String(a.name).includes('keynav'))).toBe(false);

    // ---- TARGET (post-71-02) — un-comment and flip once Landmine 1 is fixed ----
    // expect(byCode(diagnostics, 'ROZ962')).toEqual([]);
    // const keynavRoot = attrs.find((a) => a.kind === 'keynavRoot');
    // expect(keynavRoot).toBeDefined();
    // expect((keynavRoot as { focusModel: string }).focusModel).toBe('tabindex');
    // expect((keynavRoot as { modifiers: Record<string, unknown> }).modifiers).toEqual({
    //   orientation: 'vertical',
    //   loop: true,
    // });
  });

  it('r-keynav:activedescendant.vertical (combobox model) → CURRENTLY ROZ962', () => {
    const { diagnostics } = lower(
      rozie('<input r-keynav:activedescendant.vertical="$data.active"/>'),
    );
    const hits = byCode(diagnostics, 'ROZ962');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('r-keynav:activedescendant');

    // ---- TARGET (post-71-02) ----
    // expect(byCode(diagnostics, 'ROZ962')).toEqual([]);
    // const keynavRoot = collectAttrs(ir!.template!).find((a) => a.kind === 'keynavRoot');
    // expect((keynavRoot as { focusModel: string }).focusModel).toBe('activedescendant');
    // expect((keynavRoot as { modifiers: Record<string, unknown> }).modifiers).toEqual({
    //   orientation: 'vertical',
    // });
  });

  it('r-keynav-item="{ label }" → CURRENTLY unhandled: zero diagnostics, attribute silently dropped', () => {
    const { ir, diagnostics } = lower(
      rozie(
        '<ul><li r-for="it in items :key it.id" r-keynav-item="{ label: it.label }">{{ it.label }}</li></ul>',
      ),
    );
    // No guard in today's grammar even recognizes `r-keynav-item` (it carries
    // no `.` and no `:`, so it never trips the ROZ962 dot-guard) — it falls
    // through every branch and is dropped with NO diagnostic at all. This is
    // the quietest of the three Landmine-1 failure modes.
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const attrs = ir?.template ? collectAttrs(ir.template) : [];
    expect(attrs.some((a) => 'name' in a && String(a.name).includes('keynav'))).toBe(false);

    // ---- TARGET (post-71-02) ----
    // const keynavItem = collectAttrs(ir!.template!).find((a) => a.kind === 'keynavItem');
    // expect(keynavItem).toBeDefined();
  });
});
