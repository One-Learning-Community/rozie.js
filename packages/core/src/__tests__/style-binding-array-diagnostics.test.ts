// Quick task 260717-uvk — array-form `:style` merge delivered; ROZ144 removed.
//
// An array-form `:style="[a, b]"` binding used to silently miscompile on 5 of 6
// targets (only Vue merges it natively; react/solid/lit routed it through the
// STRING-only `parseInlineStyle` runtime helper → an empty `{}`, dropping every
// style, and Angular's `[style]` did not merge arrays). Rather than ship a
// silent no-op, Spike-012 R7-3 added a loud ROZ144 (STYLE_BINDING_ARRAY_UNSUPPORTED)
// diagnostic pointing the author at the object / computed form that worked
// cross-target.
//
// That restriction is now LIFTED: react/solid extend `parseInlineStyle` and
// lit/svelte extend `rozieStyle` with an Array branch that merges elements
// left-to-right (later wins, mirroring Vue's `normalizeStyle`); Angular routes
// through `[attr.style]="__rozieMergeStyle(...)"` with a self-contained class
// method. `validateStyleBinding` (the ROZ144 pass) is deleted — this suite now
// asserts the INVERSE of its original intent: an array-form `:style` produces
// ZERO diagnostics (and zero error-severity diagnostics overall) on every
// target.
//
// Mirrors `event-handler-not-expression-diagnostics.test.ts`: compile an inline
// `.rozie` source and assert on the returned `diagnostics` array.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
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

function errors(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.severity === 'error');
}

describe('array-form :style — ROZ144 removed, array-merge delivered', () => {
  it('an array-form :style compiles with zero error diagnostics on every target', () => {
    const src = rozie(
      'ArrayStyle',
      `<div :style="[{ color: 'red' }, dyn]">x</div>`,
      `const dyn = $computed(() => ({ fontSize: $data.size + 'px' }))`,
    );
    for (const target of ALL_TARGETS) {
      const hits = errors(compileDiagnostics(src, target));
      expect(hits, `expected zero error diagnostics on ${target}; got ${JSON.stringify(hits)}`).toEqual([]);
    }
  });

  it('a single object-form :style does NOT produce error diagnostics', () => {
    const src = rozie(
      'ObjectStyle',
      `<div :style="{ color: color }">x</div>`,
      `const color = $computed(() => ($data.on ? 'red' : 'blue'))`,
    );
    for (const target of ALL_TARGETS) {
      expect(errors(compileDiagnostics(src, target)), `unexpected error on ${target}`).toEqual([]);
    }
  });

  it('a string-expression :style does NOT produce error diagnostics (parseInlineStyle handles strings)', () => {
    const src = rozie('StringStyle', `<div :style="'color: ' + ($data.on ? 'red' : 'blue')">x</div>`);
    for (const target of ALL_TARGETS) {
      expect(errors(compileDiagnostics(src, target)), `unexpected error on ${target}`).toEqual([]);
    }
  });
});
