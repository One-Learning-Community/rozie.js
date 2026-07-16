// PORTAL cluster Finding 4 (R2) — Vue <Teleport> emit had three defects:
//   1. no SSR guard (React/Solid guard the container expression with
//      `typeof document === 'undefined' ? null : (...)` for parity),
//   2. the container expression was spliced TWICE (`:to` and `:disabled`),
//      so a side-effecting selector (`document.querySelector`) ran twice,
//   3. the raw expression was interpolated UNESCAPED into a double-quoted
//      attribute, so an expression containing a `"` broke the attribute.
//
// Fix: hoist the container to a single `computed` (an existing file pattern
// — the r-match D-04 hoist) that carries the SSR guard; `:to`/`:disabled`
// reference the computed identifier, so the raw expression sits in the
// script (where @babel/generator escapes it), evaluates once, and never
// lands unescaped in a quoted attribute.
import { describe, expect, it } from 'vitest';
import { parse as parseVueSFC } from '@vue/compiler-sfc';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitVue } from '../emitVue.js';

function compile(src: string): string {
  const result = parse(src, { filename: 'GuardPortal.rozie' });
  if (!result.ast) {
    throw new Error(`parse() null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitVue(ir, { filename: 'GuardPortal.rozie', source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return code;
}

// The container expression contains a DOUBLE-QUOTED string — with the old
// inline emit this produced `:to="pick("#host")"`, breaking the attribute.
const SRC = `<rozie name="GuardPortal">
<script>
function pick(sel) { return document.querySelector(sel) }
</script>
<template>
<div r-portal='pick("#host")'>hi</div>
</template>
</rozie>
`;

describe('emitVue — Teleport container SSR guard + single-eval + escaping (Finding 4 / R2)', () => {
  it('hoists the container to a guarded computed; :to/:disabled reference it once', () => {
    const code = compile(SRC);

    // Defect 1 — SSR guard present (parity with React/Solid).
    expect(code).toMatch(/typeof document === 'undefined'/);

    // Defect 2 — the raw container expression appears exactly ONCE (hoisted),
    // not spliced into both :to and :disabled. `#host` is unique to the call
    // (not the `pick(sel)` definition), so counting it isolates the splice.
    const rawCallCount = code.split('#host').length - 1;
    expect(rawCallCount, `expected the container expr once (hoisted), saw ${rawCallCount}`).toBe(1);

    // Defect 3 — :to must bind a bare computed identifier, never the raw
    // (double-quote-bearing) call spliced into the quoted attribute.
    expect(code).not.toMatch(/:to="pick/);
    expect(code).toMatch(/:to="[A-Za-z_$][\w$]*"/);
    // :disabled negates the SAME hoisted identifier.
    expect(code).toMatch(/:disabled="!\(?[A-Za-z_$][\w$]*\)?"/);

    // The hoisted binding is a Vue computed sourced from 'vue'.
    expect(code).toMatch(/import \{[^}]*\bcomputed\b[^}]*\} from 'vue';/);

    // Still a valid SFC (a broken :to attribute would corrupt the template).
    const parsed = parseVueSFC(code, { filename: 'GuardPortal.vue' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.descriptor.template).not.toBeNull();
  });
});
