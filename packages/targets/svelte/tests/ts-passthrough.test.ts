// Phase 09 Plan 03 Task 2 — Svelte `<script lang="ts">` author-annotation
// survival.
//
// `@babel/generator` prints `TS*` nodes verbatim, so author annotations on the
// cloned-and-rewritten script Program survive for free through Svelte's
// clone→rewrite→residual-emit path. Svelte's `<script>` block IS module scope
// for the component instance, so a user `import type { … }` lands at the
// script top (legal), and `interface`/`type` declarations are legal anywhere
// inside the `<script>`.
//
// Svelte's emitted `<script>` has ALWAYS carried `lang="ts"` (the emitted
// output is TypeScript — runes `$props<{…}>()`, typed `$state`); the shell
// emits it unconditionally. So a typed source's annotations simply land in an
// already-TS `<script>` block — no shell change needed (see SUMMARY
// Deviations).
//
// This suite locks:
//   - author type annotations on `let`/`const`/params survive into the .svelte
//   - `import type { … }` lands at the top of the `<script>` block
//   - `interface`/`type` declared in `<script>` survive in the .svelte script
//   - the `<script>` tag carries `lang="ts"`
//   - untyped emit is byte-identical to today (no dist-parity drift)

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../src/emitSvelte.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'TsPassthrough.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitSvelte(lowered.ir, { filename: 'TsPassthrough.rozie', source: src });
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

describe('Svelte ts-passthrough — author annotation survival (Phase 09 Plan 03 Task 2)', () => {
  it('compiles a typed .rozie to a .svelte whose <script> carries lang="ts"', () => {
    const code = compile(TYPED_SRC);
    expect(code).toMatchSnapshot('typed-svelte');
  });

  it('the <script> tag carries lang="ts"', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('<script lang="ts">');
  });

  it('preserves the typed `let count: number` and typed `inc(by: number)` param', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('count: number');
    expect(code).toContain('by: number');
  });

  it('lands `import type { … }` at the top of the <script> block', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain("import type { EditorOptions } from './editor-types';");
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

describe('Svelte ts-passthrough — untyped emit byte-identity anchor', () => {
  it('untyped emit is byte-identical to today (snapshot anchor)', () => {
    const code = compile(UNTYPED_SRC);
    expect(code).toMatchSnapshot('untyped-svelte-anchor');
  });

  it('untyped emit still carries lang="ts" (Svelte output is always TypeScript)', () => {
    // The Svelte shell emits `<script lang="ts">` unconditionally — the
    // emitted output uses runes `$props<{…}>()` and typed `$state` regardless
    // of whether the AUTHOR typed their <script>. Making the tag conditional
    // would break every untyped dist-parity fixture.
    const code = compile(UNTYPED_SRC);
    expect(code).toContain('<script lang="ts">');
  });
});

// WR-01 + ROOT CAUSE 1 regression — a callback typed via its DECLARATOR ID
// (`const f: (e: MouseEvent) => void = (e) => {…}`) must keep the author's
// `MouseEvent`: typeNeutralizeScript must NOT `: any`-stamp the contextually-
// typed param (which would override the author's type).
const DECLARATOR_TYPED_SRC = `<rozie name="DeclTyped">
<script lang="ts">
const onMove: (e: MouseEvent) => void = (e) => { document.title = String(e.clientX); };
</script>
<template><button @mousemove="onMove">go</button></template>
</rozie>`;

describe('ts-passthrough — declarator-id-typed callback (WR-01 / ROOT CAUSE 1)', () => {
  it('keeps the author MouseEvent: declarator annotation survives, param stays bare', () => {
    const code = compile(DECLARATOR_TYPED_SRC);
    expect(code).toContain('onMove: (e: MouseEvent) => void');
    // The param must NOT be `: any`-stamped — it is contextually typed by the
    // declarator annotation. A typo `e.clientXX` would then be a tsc error.
    expect(code).not.toMatch(/\be: any\b/);
  });
});
