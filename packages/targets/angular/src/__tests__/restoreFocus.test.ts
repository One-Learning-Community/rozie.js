// Phase 16 Plan 16-03 — Angular `$restoreFocus` emit test.
//
// `$restoreFocus(selector, idx)` is the Phase 16 author-surface sigil. Angular's
// keyed reconciler (`*ngFor; trackBy`) MOVES the existing DOM element on
// reorder, so focus survives natively; the sigil lowers to `void 0` (no-op)
// on Angular per the SPEC R4 lowering table.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitAngular } from '../emitAngular.js';

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
  const emitted = emitAngular(ir, {
    filename: 'RestoreFocusProbe.rozie',
    source: SOURCE,
    modifierRegistry: registry,
  });
  return {
    code: emitted.code,
    diagnostics: [...parseDiags, ...lowerDiags, ...emitted.diagnostics],
  };
}

describe('$restoreFocus emit (Angular) [Phase 16]', () => {
  it('compiles with no error diagnostic', () => {
    const { diagnostics } = compileProbe();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it("lowers to `void 0` (no-op) — Angular's keyed reconciler preserves DOM identity natively", () => {
    const { code } = compileProbe();
    expect(code).toContain('void 0');
    // The raw helper call must NOT survive into emitted output.
    expect(code).not.toContain('$restoreFocus');
  });
});
