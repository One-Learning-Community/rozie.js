// Phase 2 Plan 02-04 Task 2 — MOD-04 .throttle(ms) builtin tests.
//
// arity 'one'; mirror of debounce.
import { describe, expect, it } from 'vitest';
import { throttle } from '../../../src/modifiers/builtins/throttle.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'scroll',
  sourceLoc: { start: 0, end: 14 },
};

describe('builtin: .throttle — Plan 02-04', () => {
  it('.throttle(100) → wrap entry with literal:100 arg', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 100, loc: { start: 9, end: 12 } },
    ];
    const result = throttle.resolve(args, CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'wrap',
      modifier: 'throttle',
      args,
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.throttle() → ROZ111 arity mismatch (requires exactly 1 arg)', () => {
    const result = throttle.resolve([], CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });

  // Phase 07.1 — Solid/Lit emission descriptors (parallels svelte()/angular()).
  it('.throttle solid() → helper createThrottledHandler without listenerOnly', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 100, loc: { start: 9, end: 12 } },
    ];
    const desc = throttle.solid!(args, CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-solid',
      helperName: 'createThrottledHandler',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    expect(desc.listenerOnly).toBeUndefined();
  });

  it('.throttle lit() → helper throttle without listenerOnly', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 100, loc: { start: 9, end: 12 } },
    ];
    const desc = throttle.lit!(args, CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-lit',
      helperName: 'throttle',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    expect(desc.listenerOnly).toBeUndefined();
  });
});
