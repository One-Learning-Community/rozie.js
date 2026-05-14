// Phase 2 Plan 02-04 Task 2 — MOD-04 .debounce(ms) builtin tests.
//
// arity 'one'; arg must be a numeric literal. .debounce() → ROZ111;
// .debounce(300, 500) → ROZ111; .debounce("foo") → ROZ112.
import { describe, expect, it } from 'vitest';
import { debounce } from '../../../src/modifiers/builtins/debounce.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'listeners-block',
  event: 'input',
  sourceLoc: { start: 50, end: 64 },
};

describe('builtin: .debounce — Plan 02-04', () => {
  it('.debounce(300) → wrap entry with literal:300 arg', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 300, loc: { start: 60, end: 63 } },
    ];
    const result = debounce.resolve(args, CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'wrap',
      modifier: 'debounce',
      args,
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.debounce() → ROZ111 arity mismatch (requires exactly 1 arg)', () => {
    const result = debounce.resolve([], CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });

  it('.debounce(300, 500) → ROZ111 arity mismatch (too many args)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 300, loc: { start: 60, end: 63 } },
      { kind: 'literal', value: 500, loc: { start: 65, end: 68 } },
    ];
    const result = debounce.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });

  // Phase 07.1 — Solid/Lit emission descriptors (parallels svelte()/angular()).
  it('.debounce solid() → helper createDebouncedHandler without listenerOnly', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 300, loc: { start: 60, end: 63 } },
    ];
    const desc = debounce.solid!(args, CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-solid',
      helperName: 'createDebouncedHandler',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    expect(desc.listenerOnly).toBeUndefined();
  });

  it('.debounce lit() → helper debounce without listenerOnly', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 300, loc: { start: 60, end: 63 } },
    ];
    const desc = debounce.lit!(args, CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-lit',
      helperName: 'debounce',
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
    expect(desc.listenerOnly).toBeUndefined();
  });
});
