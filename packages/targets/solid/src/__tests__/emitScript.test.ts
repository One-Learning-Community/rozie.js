/**
 * emitScript tests — Plan 06.3-01 Task 2 Test 5.
 *
 * Test 5: createSignal mapping — IRComponent with data: [{ name: 'count', initial: '0' }]
 * produces code containing `createSignal(0)` and `[count, setCount]`.
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
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
});
