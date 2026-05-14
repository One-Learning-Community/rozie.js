// Phase 2 Plan 02-04 Task 2 — MOD-04 .outside(...refs) builtin tests.
//
// `.outside()` (no-arg) is valid — defaults to $el at emit time per MOD-04.
// `.outside($refs.x)` accepts refExpr args; literals → ROZ112 invalid arg shape.
import { describe, expect, it } from 'vitest';
import { outside } from '../../../src/modifiers/builtins/outside.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'click',
  sourceLoc: { start: 100, end: 130 },
};

describe('builtin: .outside — Plan 02-04', () => {
  it('.outside($refs.triggerEl, $refs.panelEl) → wrap entry with both refExpr args', () => {
    const args: ModifierArg[] = [
      { kind: 'refExpr', ref: '$refs.triggerEl', loc: { start: 110, end: 124 } },
      { kind: 'refExpr', ref: '$refs.panelEl', loc: { start: 126, end: 138 } },
    ];
    const result = outside.resolve(args, CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'wrap',
      modifier: 'outside',
      args,
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.outside() (no args) → wrap entry with empty args (defaults to $el at emit time per MOD-04)', () => {
    const result = outside.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'wrap',
      modifier: 'outside',
      args: [],
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.outside("not-a-ref") (literal arg) → ROZ112 invalid arg shape, no entries', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 'not-a-ref', loc: { start: 110, end: 121 } },
    ];
    const result = outside.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'ROZ112',
      severity: 'error',
      loc: { start: 110, end: 121 },
    });
    expect(result.diagnostics[0].message).toMatch(/outside.*ref/i);
  });

  // Phase 07.1 — Solid/Lit emission descriptors (parallels svelte()/angular()).
  it('.outside solid() → helper createOutsideClick with listenerOnly: true', () => {
    const args: ModifierArg[] = [
      { kind: 'refExpr', ref: '$refs.triggerEl', loc: { start: 110, end: 124 } },
    ];
    const desc = outside.solid!(args, CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-solid',
      helperName: 'createOutsideClick',
      listenerOnly: true,
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
  });

  it('.outside lit() → helper attachOutsideClickListener with listenerOnly: true', () => {
    const args: ModifierArg[] = [
      { kind: 'refExpr', ref: '$refs.triggerEl', loc: { start: 110, end: 124 } },
    ];
    const desc = outside.lit!(args, CTX);
    expect(desc).toMatchObject({
      kind: 'helper',
      importFrom: '@rozie/runtime-lit',
      helperName: 'attachOutsideClickListener',
      listenerOnly: true,
    });
    if (desc.kind !== 'helper') throw new Error('unreachable: kind narrowing');
    expect(desc.args).toEqual(args);
  });
});
