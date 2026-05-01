// Phase 2 Plan 02-04 Task 2 — MOD-04 .self builtin tests.
//
// arity 'none'; resolves to filter entry. event.target === event.currentTarget guard.
import { describe, expect, it } from 'vitest';
import { self } from '../../../src/modifiers/builtins/self.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'click',
  sourceLoc: { start: 0, end: 6 },
};

describe('builtin: .self — Plan 02-04', () => {
  it('.self → filter entry with modifier: "self", empty args', () => {
    const result = self.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'filter',
      modifier: 'self',
      args: [],
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.self(arg) → ROZ111 arity mismatch (no args expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 6, end: 7 } },
    ];
    const result = self.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });
});
