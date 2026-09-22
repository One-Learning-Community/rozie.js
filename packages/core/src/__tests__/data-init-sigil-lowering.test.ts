// Quick task 260717-uvl — make-it-work RED: per-target `<data>` initializer
// sigil-lowering.
//
// Today `lowerData` copies the Babel initializer Expression VERBATIM (no
// sigil-lowering pass), so `data: { count: $props.initial }` emits the raw
// free identifier on all six targets — `useState($props.initial)` (React),
// `ref($props.initial)` (Vue), `$state($props.initial)` (Svelte),
// `createSignal($props.initial)` (Solid), `signal($props.initial)`
// (Angular/Lit) — a TS2304 + runtime ReferenceError, currently guarded loud
// by ROZ208 (dataInitSigilValidator).
//
// This test asserts the FIX shape: a `$props`/`$data` member access in a
// `<data>` initializer must route through that target's existing
// `rewriteTemplateExpression` (the same machinery already used for
// `$props.X`/`$data.X` in templates/handlers) and lower to the per-target
// prop/state READ — no raw bare-sigil free identifier leaking into emit.
//
// This is a TEST file (not emitted output) — referencing the sigil tokens
// in assertions/prose below is fine; it is the EMITTED `.code` string that
// must never contain them.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import type { CompileTarget } from '../compile.js';

const ALL_TARGETS: CompileTarget[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

function rozie(dataBody: string): string {
  return `<rozie name="DataInitSigilLowering">
<props>
{ initial: { type: Number, default: 0 } }
</props>
<data>
${dataBody}
</data>
<script lang="ts">
function noop(): void {}
</script>
<template>
<button @click="noop()">Go</button>
</template>
</rozie>
`;
}

function compileCode(source: string, target: CompileTarget): string {
  return compile(source, {
    target,
    filename: 'DataInitSigilLowering.rozie',
    types: false,
    sourceMap: false,
  }).code;
}

describe('data-init sigil lowering (Spike-012 R9 make-it-work — $props/$data)', () => {
  describe('$props member access — { count: $props.initial }', () => {
    const dataBody = '{ count: $props.initial }';

    for (const target of ALL_TARGETS) {
      it(`${target}: does not leak a raw $props sigil into emit`, () => {
        const code = compileCode(rozie(dataBody), target);
        // STRICT absence — the raw bare-sigil free identifier must never
        // appear in emitted code (that's the TS2304 + ReferenceError leak).
        expect(code).not.toContain('$props.initial');
        expect(code).not.toContain('$props[');
      });

      it(`${target}: lowers to a per-target read of 'initial'`, () => {
        const code = compileCode(rozie(dataBody), target);
        // LOOSE presence — some lowered form of the prop read exists
        // (props.initial / local bare `initial` / this.initial / this.initial()).
        expect(code).toContain('initial');
      });
    }
  });

  // Quick 260922-hk4 (Task 2b) — `$model` in a `<data>` initializer. Every
  // target's data-initializer gate only recognised `$props`/`$data`, so a
  // `$model.X` read skipped the sigil rewrite and leaked verbatim on all six.
  describe('$model member access — { fromModel: $model.open }', () => {
    const modelSource = rozie('{ fromModel: $model.open }').replace(
      '{ initial: { type: Number, default: 0 } }',
      '{ initial: { type: Number, default: 0 }, open: { type: Boolean, default: false, model: true } }',
    );

    for (const target of ALL_TARGETS) {
      it(`${target}: does not leak a raw $model sigil into emit`, () => {
        const code = compileCode(modelSource, target);
        expect(code).not.toContain('$model');
      });
    }
  });

  // Quick 260922-hk4 (Task 2b) — Vue's `<data>` initializer sits in
  // `<script setup>`, where refs are NOT auto-unwrapped. The template-context
  // rewrite emitted `ref(a)` / `ref(open)`, and Vue's `ref(existingRef)`
  // RETURNS THAT SAME REF — the new field silently aliased its source. The
  // script-context form reads the value.
  describe('Vue script-context reads in <data> initializers', () => {
    it('vue: $data self-reference reads the ref value, not the ref', () => {
      const code = compileCode(rozie('{ a: 1, b: $data.a }'), 'vue');
      expect(code).toContain('const b = ref(a.value);');
    });

    it('vue: a model-prop read reads the defineModel ref value', () => {
      const src = rozie('{ fromModel: $props.open }').replace(
        '{ initial: { type: Number, default: 0 } }',
        '{ initial: { type: Number, default: 0 }, open: { type: Boolean, default: false, model: true } }',
      );
      const code = compileCode(src, 'vue');
      expect(code).toContain('const fromModel = ref(open.value);');
    });
  });

  describe('$data self-reference — { a: 1, b: $data.a }', () => {
    const dataBody = '{ a: 1, b: $data.a }';

    for (const target of ALL_TARGETS) {
      it(`${target}: does not leak a raw $data sigil into emit`, () => {
        const code = compileCode(rozie(dataBody), target);
        expect(code).not.toContain('$data.a');
        expect(code).not.toContain('$data[');
      });
    }
  });
});
