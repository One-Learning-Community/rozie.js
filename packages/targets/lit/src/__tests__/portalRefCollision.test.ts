// PORTAL cluster Finding 5 (R1) — Lit `ref=` + `r-portal` on ONE element.
//
// Before the fix, an element carrying BOTH an author `ref="box"` and
// `r-portal="<expr>"` emitted TWO `data-rozie-ref` attributes on the same
// open tag: `data-rozie-ref="box"` (author ref) and
// `data-rozie-ref="__roziePortal0"` (portal marker). The HTML parser keeps
// only the FIRST duplicate attribute, so `data-rozie-ref` resolves to "box"
// and the portal's `@query('[data-rozie-ref="__roziePortal0"]')` matches
// nothing — the portal is silently inert.
//
// Fix: the portal marker uses a DISTINCT attribute name
// (`data-rozie-portal-ref`), so it can never collide with an author `ref=`
// by construction, and the controller query targets that distinct name.
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitLit } from '../emitLit.js';

function compile(src: string): string {
  const result = parse(src, { filename: 'RefPortal.rozie' });
  if (!result.ast) {
    throw new Error(`parse() null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitLit(ir, { filename: 'RefPortal.rozie', source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return code;
}

const SRC = `<rozie name="RefPortal">
<script>
function target() { return document.body }
</script>
<template>
<div ref="box" r-portal="target()">hi</div>
</template>
</rozie>
`;

describe('emitLit — ref= + r-portal collision (Finding 5 / R1)', () => {
  it('emits the author ref and the portal marker on DISTINCT attribute names', () => {
    const code = compile(SRC);

    // Author ref stays on data-rozie-ref.
    expect(code).toMatch(/data-rozie-ref="box"/);

    // Portal marker rides a DISTINCT attribute so it never collides with the
    // author ref (which would make the first-wins duplicate silently inert).
    expect(code).toMatch(/data-rozie-portal-ref="__roziePortal0"/);

    // The portal must NOT reuse data-rozie-ref for its own marker.
    expect(code).not.toMatch(/data-rozie-ref="__roziePortal0"/);

    // The controller query targets the distinct portal attribute.
    expect(code).toMatch(/@query\('\[data-rozie-portal-ref="__roziePortal0"\]', true\)/);
  });
});
