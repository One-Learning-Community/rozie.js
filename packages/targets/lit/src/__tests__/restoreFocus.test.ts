// Phase 16 Plan 16-03 — Lit `$restoreFocus` emit test.
//
// `$restoreFocus(selector, idx)` is the Phase 16 author-surface sigil.
// lit-html's keyed reconciler (`repeat` directive) recreates row DOM on
// reorder, so the previously focused element is removed; the sigil lowers to
// a deferred (microtask) `this.renderRoot.querySelectorAll(sel)[idx]?.focus()`
// — scoped to the host's renderRoot, INLINE (no runtime helper). SPEC R4
// lowering table; per RESEARCH §Pitfall 7, RuntimeLitImport union is NOT
// extended.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitLit } from '../emitLit.js';

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
  const emitted = emitLit(ir, {
    filename: 'RestoreFocusProbe.rozie',
    source: SOURCE,
    modifierRegistry: registry,
  });
  return {
    code: emitted.code,
    diagnostics: [...parseDiags, ...lowerDiags, ...emitted.diagnostics],
  };
}

describe('$restoreFocus emit (Lit) [Phase 16]', () => {
  it('compiles with no error diagnostic', () => {
    const { diagnostics } = compileProbe();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('lowers to queueMicrotask + this.renderRoot.querySelectorAll + focus() INLINE (no runtime helper)', () => {
    const { code } = compileProbe();
    expect(code).toContain('queueMicrotask');
    expect(code).toContain('this.renderRoot');
    // The lowering emits `(this.renderRoot.querySelectorAll(sel)?.[idx] as
    // HTMLElement | undefined)?.focus?.()` — optional-computed access on the
    // NodeList result, cast to HTMLElement for typecheck, optional-chained
    // focus call. Phase 16-04 widened the cast so downstream TS gates accept
    // `.focus()` on the Element-typed indexed result.
    expect(code).toMatch(/querySelectorAll\(\s*['"]\.row['"]\s*\)\s*\?\.\s*\[\s*2\s*\]/);
    expect(code).toMatch(/as\s+HTMLElement\s*\|\s*undefined/);
    expect(code).toMatch(/\.focus\??\s*\.?\(\s*\)/);
    // The raw helper call must NOT survive into emitted output.
    expect(code).not.toContain('$restoreFocus');
    // Per RESEARCH §Pitfall 7 — no runtime helper added for $restoreFocus.
    expect(code).not.toContain('__rozieRestoreFocus');
  });
});
