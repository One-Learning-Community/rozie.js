// Phase 09 Plan 03 Task 2 — Vue `<script lang="ts">` author-annotation
// survival.
//
// `@babel/generator` prints `TS*` nodes verbatim, so author annotations on the
// cloned-and-rewritten script Program survive for free through Vue's
// clone→rewrite→residual-emit path. Vue's `<script setup>` IS module scope, so
// a user `import type { … }` emitted in the residual body lands at the SFC
// script top (legal), and `interface`/`type` declarations are legal anywhere
// inside `<script setup>`.
//
// Vue's emitted `<script setup>` has ALWAYS carried `lang="ts"` (the emitted
// output is TypeScript — `defineProps<FooProps>()` macros, typed refs); the
// shell emits it unconditionally. So a typed source's annotations simply land
// in an already-TS script block — no shell change needed (see SUMMARY
// Deviations).
//
// This suite locks:
//   - author type annotations on `let`/`const`/params survive into the SFC
//   - `import type { … }` lands at the top of `<script setup>`
//   - `interface`/`type` declared in `<script>` survive in the SFC script
//   - the `<script setup>` tag carries `lang="ts"`
//   - untyped emit is byte-identical to today (no dist-parity drift)

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitVue } from '../src/emitVue.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'TsPassthrough.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitVue(lowered.ir, { filename: 'TsPassthrough.rozie', source: src });
  return result.code;
}

const TYPED_SRC = `<rozie name="TsPassthrough">
<props>
{
  label: { type: String, default: 'Count' }
}
</props>
<script lang="ts">
import type { EditorOptions } from './editor-types';
interface InternalShape { id: number; ready: boolean }
type Mode = 'idle' | 'busy';
let count: number = 0;
let mode: Mode = 'idle';
function inc(by: number): void {
  count = count + by;
}
$onMount(() => {
  count = 1;
});
</script>
<template>
  <button @click="inc(1)">{{ label }}: {{ count }}</button>
</template>
</rozie>`;

const UNTYPED_SRC = `<rozie name="TsPassthrough">
<props>
{
  label: { type: String, default: 'Count' }
}
</props>
<script>
let count = 0;
let mode = 'idle';
function inc(by) {
  count = count + by;
}
$onMount(() => {
  count = 1;
});
</script>
<template>
  <button @click="inc(1)">{{ label }}: {{ count }}</button>
</template>
</rozie>`;

describe('Vue ts-passthrough — author annotation survival (Phase 09 Plan 03 Task 2)', () => {
  it('compiles a typed .rozie to a <script setup lang="ts"> SFC preserving annotations', () => {
    const code = compile(TYPED_SRC);
    expect(code).toMatchSnapshot('typed-vue');
  });

  it('the <script setup> tag carries lang="ts"', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('<script setup lang="ts">');
  });

  it('preserves the typed `let count: number` and typed `inc(by: number)` param', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('count: number');
    expect(code).toContain('by: number');
  });

  it('lands `import type { … }` at the top of <script setup>', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain("import type { EditorOptions } from './editor-types';");
    // The import must NOT appear inside a function body — it sits in the
    // module-scope <script setup>, before the `function inc` declaration.
    const importIdx = code.indexOf('import type { EditorOptions }');
    const fnIdx = code.indexOf('function inc');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(fnIdx).toBeGreaterThan(importIdx);
  });

  it('preserves an author `interface` / `type` declared in <script>', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('interface InternalShape');
    expect(code).toContain("type Mode = 'idle' | 'busy'");
  });
});

describe('Vue ts-passthrough — untyped emit byte-identity anchor', () => {
  it('untyped emit is byte-identical to today (snapshot anchor)', () => {
    const code = compile(UNTYPED_SRC);
    expect(code).toMatchSnapshot('untyped-vue-anchor');
  });

  it('untyped emit still carries lang="ts" (Vue output is always TypeScript)', () => {
    // The Vue shell emits `<script setup lang="ts">` unconditionally — the
    // emitted output uses `defineProps<T>()` macros and typed refs regardless
    // of whether the AUTHOR typed their <script>. Making the tag conditional
    // would break every untyped dist-parity fixture.
    const code = compile(UNTYPED_SRC);
    expect(code).toContain('<script setup lang="ts">');
  });
});
