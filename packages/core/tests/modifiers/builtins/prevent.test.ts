// Phase 2 Plan 02-04 Task 2 — MOD-04 .prevent builtin tests.
//
// arity 'none'; resolves to filter entry. event.preventDefault() before handler.
import { describe, expect, it } from 'vitest';
import { prevent } from '../../../src/modifiers/builtins/prevent.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'submit',
  sourceLoc: { start: 0, end: 9 },
};

describe('builtin: .prevent — Plan 02-04', () => {
  it('.prevent → filter entry with modifier: "prevent", empty args', () => {
    const result = prevent.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'filter',
      modifier: 'prevent',
      args: [],
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.prevent(arg) → ROZ111 arity mismatch (no args expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 9, end: 10 } },
    ];
    const result = prevent.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });
});
