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
