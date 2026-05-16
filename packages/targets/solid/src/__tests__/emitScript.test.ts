/**
 * emitScript tests — Plan 06.3-01 Task 2 Test 5.
 *
 * Test 5: createSignal mapping — IRComponent with data: [{ name: 'count', initial: '0' }]
 * produces code containing `createSignal(0)` and `[count, setCount]`.
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { emitScript } from '../emit/emitScript.js';

/** Build a minimal IRComponent with one StateDecl. */
function buildMinimalIR(overrides: Partial<IRComponent> = {}): IRComponent {
  const scriptProgram = t.file(t.program([]));
  return {
    type: 'IRComponent',
    name: 'Counter',
    props: [],
    state: [
      {
        name: 'count',
        initializer: t.numericLiteral(0),
        sourceLoc: { start: 0, end: 1 },
      },
    ],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
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

describe('emitScript — Solid target', () => {
  it('Test 5: maps StateDecl to createSignal + destructuring', () => {
    const ir = buildMinimalIR();
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });

    expect(result.hookSection).toContain('createSignal(0)');
    expect(result.hookSection).toContain('[count, setCount]');
    // createSignal should be added to imports.
    expect(solidImports.has('createSignal')).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('Quick 260515-u2b — $watch lowers to createEffect(() => { (getter)(); (cb)(); }); adds createEffect import', () => {
    const src = `<rozie name="WatchSynth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
$watch(() => $props.open, () => { console.log('fired') })
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerToIR(parse(src, { filename: 'WatchSynth.rozie' }).ast!, {
      modifierRegistry: createDefaultRegistry(),
    }).ir!;
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    // Solid: getter `() => $props.open` → `() => _props.open` after rewrite
    //   (or just `props.open` depending on Solid's per-target identifier scheme)
    expect(result.hookSection).toMatch(/createEffect\(\(\) => \{[\s\S]*?\(\(\) =>[\s\S]*?\)\(\);[\s\S]*?\(\(\) => \{[\s\S]*?\}\)\(\);[\s\S]*?\}\);/);
    expect(solidImports.has('createEffect')).toBe(true);
  });

  it('Quick 260515-u2b — no $watch means no extra createEffect call', () => {
    const ir = buildMinimalIR();
    const solidImports = new SolidImportCollector();
    const runtimeImports = new RuntimeSolidImportCollector();
    const result = emitScript(ir, { solidImports, runtimeImports });
    expect(result.hookSection).not.toContain('createEffect(');
    expect(solidImports.has('createEffect')).toBe(false);
  });
});
