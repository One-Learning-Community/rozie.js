// Spike-012 R7-3 — ROZ144 STYLE_BINDING_ARRAY_UNSUPPORTED.
//
// An array-form `:style="[a, b]"` binding silently miscompiled on 5 of 6 targets
// (only Vue merges it natively; react/solid/lit route it through the STRING-only
// `parseInlineStyle` runtime helper → an empty `{}`, dropping every style, and
// Angular's `[style]` does not merge arrays). Rather than ship a silent no-op, the
// fix emits a loud ROZ144 error and points the author at the object / computed
// form that works cross-target today. A real array-merge is backlogged.
//
// Mirrors `event-handler-not-expression-diagnostics.test.ts`: compile an inline
// `.rozie` source and assert on the returned `diagnostics` array. The validator is
// wired into the target-agnostic `lowerToIR` chokepoint, so the diagnostic fires
// uniformly — asserted across all six targets below.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { CompileTarget } from '../compile.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

const ALL_TARGETS: CompileTarget[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

function compileDiagnostics(source: string, target: CompileTarget): Diagnostic[] {
  return compile(source, {
    target,
    filename: 'StyleBindingArray.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

function rozie(name: string, templateBody: string, script = ''): string {
  return `<rozie name="${name}">
<data>
{ size: 12, on: true }
</data>
<script lang="ts">
${script}
</script>
<template>
${templateBody}
</template>
</rozie>
`;
}

function roz144(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.code === RozieErrorCode.STYLE_BINDING_ARRAY_UNSUPPORTED);
}

describe('style-binding array diagnostics (Spike-012 R7-3 silent miscompile fix)', () => {
  it('an array-form :style produces exactly one ROZ144 error on every target', () => {
    const src = rozie(
      'ArrayStyle',
      `<div :style="[{ color: 'red' }, dyn]">x</div>`,
      `const dyn = $computed(() => ({ fontSize: $data.size + 'px' }))`,
    );
    for (const target of ALL_TARGETS) {
      const hits = roz144(compileDiagnostics(src, target));
      expect(hits.length, `expected one ROZ144 on ${target}; got ${JSON.stringify(hits)}`).toBe(1);
      expect(hits[0]!.severity).toBe('error');
    }
  });

  it('a single object-form :style does NOT produce ROZ144', () => {
    const src = rozie(
      'ObjectStyle',
      `<div :style="{ color: color }">x</div>`,
      `const color = $computed(() => ($data.on ? 'red' : 'blue'))`,
    );
    for (const target of ALL_TARGETS) {
      expect(roz144(compileDiagnostics(src, target)).length, `unexpected ROZ144 on ${target}`).toBe(0);
    }
  });

  it('a string-expression :style does NOT produce ROZ144 (parseInlineStyle handles strings)', () => {
    const src = rozie('StringStyle', `<div :style="'color: ' + ($data.on ? 'red' : 'blue')">x</div>`);
    for (const target of ALL_TARGETS) {
      expect(roz144(compileDiagnostics(src, target)).length, `unexpected ROZ144 on ${target}`).toBe(0);
    }
  });
});
