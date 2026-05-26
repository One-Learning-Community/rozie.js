// Phase 16 Plan 16-03 — Solid `$restoreFocus` emit test.
//
// `$restoreFocus(selector, idx)` is the Phase 16 author-surface sigil. Solid's
// keyed reconciler RE-CREATES row DOM on reorder, so the previously focused
// element is removed; the sigil lowers to a deferred (microtask)
// `querySelectorAll(sel)[idx]?.focus()` scoped to the component's root
// element. SPEC R4 lowering table.
//
// The lowering uses a synthesised `$el` Identifier that Solid's
// rewriteScript Identifier handler then rewrites to `$refs.__rozieRoot` →
// Solid's callback-ref form synthesised by `lowerRootElementRef`.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitSolid } from '../emitSolid.js';

const SOURCE = `<rozie name="RestoreFocusProbe">

<data>
{ items: [1, 2, 3] }
</data>

<script>
$onMount(() => { $restoreFocus('.row', 2); })
</script>

<template>
<ul><li class="row">x</li></ul>
</template>

</rozie>
`;

function compileProbe(): { code: string; diagnostics: Diagnostic[] } {
  const { ast, diagnostics: parseDiags } = parse(SOURCE, {
    filename: 'RestoreFocusProbe.rozie',
  });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  const registry = createDefaultRegistry();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
  });
  if (!ir) throw new Error('lowerToIR returned null IR');
  const emitted = emitSolid(ir, {
    filename: 'RestoreFocusProbe.rozie',
    source: SOURCE,
    modifierRegistry: registry,
  });
  return {
    code: emitted.code,
    diagnostics: [...parseDiags, ...lowerDiags, ...emitted.diagnostics],
  };
}

describe('$restoreFocus emit (Solid) [Phase 16]', () => {
  it('compiles with no error diagnostic', () => {
    const { diagnostics } = compileProbe();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('lowers to queueMicrotask + querySelectorAll + focus()', () => {
    const { code } = compileProbe();
    expect(code).toContain('queueMicrotask');
    // Solid's emit may force single quotes; tolerate either quote style. The
    // lowering emits `querySelectorAll(sel)?.[idx]).focus()` — optional-
    // computed access on the NodeList result, then a plain `.focus()` call.
    expect(code).toMatch(/querySelectorAll\(\s*['"]\.row['"]\s*\)\s*\?\.\s*\[\s*2\s*\]/);
    expect(code).toMatch(/\.focus\s*\(\s*\)/);
    // The raw helper call must NOT survive into emitted output.
    expect(code).not.toContain('$restoreFocus');
  });
});
