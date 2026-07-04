/**
 * composition tests — Plan 06.3-01 Task 2 Tests 6-7.
 *
 * Test 6: Self-reference — Counter referencing <Counter>
 *   emits the function name as the JSX tag (no import needed; Solid named
 *   function declaration handles self-reference natively).
 *
 * Test 7: Cross-rozie import — IRComponent with components: [{ localName: 'Modal',
 *   importPath: './Modal.rozie' }] emits `import Modal from './Modal'`
 *   (extensionless per `solid: ''` in TARGET_EXT_MAP).
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSolid } from '../emitSolid.js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';

function compileSolid(src: string, filename = 'inline.rozie'): string {
  const result = parse(src, { filename });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  const out = emitSolid(lowered.ir, { filename, source: src });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.code;
}

function buildMinimalIR(overrides: Partial<IRComponent> = {}): IRComponent {
  const scriptProgram = t.file(t.program([]));
  return {
    type: 'IRComponent',
    name: 'Counter',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], engineRules: [], sourceLoc: { start: 0, end: 0 } },
    components: [],
    setupBody: {
      type: 'SetupBody',
      scriptProgram,
      annotations: [],
    },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  };
}

describe('emitSolid — composition', () => {
  it('Test 6: self-reference — function name is Counter, no self-import emitted', () => {
    const ir = buildMinimalIR({
      name: 'Counter',
      // Self-reference: components entry with same name as outer.
      components: [
        {
          type: 'ComponentDecl',
          localName: 'Counter',
          importPath: './Counter.rozie',
          sourceLoc: { start: 0, end: 0 },
        },
      ],
    });
    const result = emitSolid(ir);
    expect(result.code).toContain('export default function Counter');
    // Self-import should NOT appear.
    expect(result.code).not.toContain("import Counter from './Counter'");
  });

  it('Test 7: cross-rozie import — import Modal from ./Modal (extensionless)', () => {
    const ir = buildMinimalIR({
      name: 'App',
      components: [
        {
          type: 'ComponentDecl',
          localName: 'Modal',
          importPath: './Modal.rozie',
          sourceLoc: { start: 0, end: 0 },
        },
      ],
    });
    const result = emitSolid(ir);
    // solid: '' in TARGET_EXT_MAP → extensionless import.
    expect(result.code).toContain("import Modal from './Modal'");
  });
});

// Keyed-remount codegen, Task 5 — Solid `:key` on a composed component now
// lowers to `TemplateElementIR.remountKeyExpression` (Task 1, DONE) but Solid
// currently DROPS the raw `key`/`:key` binding entirely via
// `isConsumedAttribute` (emitTemplateAttribute.ts:117-124) — there is no inert
// prop forwarded, but there is also NO remount: the component never tears
// down and rebuilds when the key changes (data-table-super-crosstarget-
// findings.md §3.1). Fix: wrap the component invocation in
// `<Show keyed when={...}>` (Solid's native destroy+recreate primitive).
describe('emitSolid — component :key wraps <Show keyed when={expr}> (keyed-remount codegen Task 5)', () => {
  it('component :key wraps the invocation in <Show keyed when={`k${String(v)}`}>...</Show> and imports Show', () => {
    const src = `<rozie name="KeyedHost">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ v: 0 }</data>
<template>
  <div>
    <MyComp :key="String($data.v)" />
  </div>
</template>
</rozie>`;
    const code = compileSolid(src);
    // THE fix — a real <Show keyed when={...}> wrapping the component call.
    expect(code).toMatch(/<Show keyed when=\{`k\$\{String\(v\(\)\)\}`\}><MyComp[^]*?<\/Show>/);
    // Show must be imported from solid-js.
    expect(code).toMatch(/import\s*\{[^}]*\bShow\b[^}]*\}\s*from\s*['"]solid-js['"]/);
    // No inert key prop on the component call.
    expect(code).not.toMatch(/<MyComp[^/]*\bkey=/);
  });

  it('control: component WITHOUT :key emits no <Show> wrap and no Show import', () => {
    const src = `<rozie name="KeyedHostNoKey">
<components>{ MyComp: "./MyComp.rozie" }</components>
<template>
  <div>
    <MyComp />
  </div>
</template>
</rozie>`;
    const code = compileSolid(src);
    expect(code).not.toMatch(/<Show/);
    expect(code).not.toMatch(/\bShow\b/);
  });

  it('control: r-for loop key on a component is emitted exactly as before (unaffected by remountKeyExpression)', () => {
    const src = `<rozie name="KeyedHostLoop">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ xs: [] }</data>
<template>
  <div>
    <MyComp r-for="x in $data.xs" :key="x.id" />
  </div>
</template>
</rozie>`;
    const code = compileSolid(src);
    // Loop key is still consumed/dropped by the existing r-for path — no
    // <Show keyed> wrap is introduced by this task for the loop-key case.
    expect(code).not.toMatch(/<Show keyed/);
    expect(code).not.toMatch(/<MyComp[^/]*\bkey=/);
  });

  // Falsy-key edge: a component-level `:key` whose raw value can be falsy
  // (`$data.n` where `n` may be `0`). Bound directly to `when`, `<Show>`
  // would HIDE the component whenever the key is falsy. The `` `k${expr}` ``
  // guard prefixes a non-empty literal so the resulting string is NEVER
  // empty/falsy — the component stays visible — while still changing value
  // (and thus still triggering `keyed` recreation) whenever the key changes.
  it('falsy-key edge: a key that can be 0/false/"" is guarded so the component is never hidden', () => {
    const src = `<rozie name="KeyedHostFalsy">
<components>{ MyComp: "./MyComp.rozie" }</components>
<data>{ n: 0 }</data>
<template>
  <div>
    <MyComp :key="$data.n" />
  </div>
</template>
</rozie>`;
    const code = compileSolid(src);
    // The raw (possibly-falsy) key expression must NOT be bound directly to
    // `when=` — that would hide the component when the key is 0/false/"".
    expect(code).not.toMatch(/when=\{n\(\)\}/);
    // Instead it must be wrapped in the truthy-guaranteeing template literal.
    expect(code).toMatch(/<Show keyed when=\{`k\$\{n\(\)\}`\}>/);
  });
});
