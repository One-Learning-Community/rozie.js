// Phase 2 Plan 02-04 Task 2 — MOD-04 .passive builtin tests.
//
// arity 'none'; resolves to listenerOption entry. addEventListener({ passive: true }).
import { describe, expect, it } from 'vitest';
import { passive } from '../../../src/modifiers/builtins/passive.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'wheel',
  sourceLoc: { start: 0, end: 14 },
};

describe('builtin: .passive — Plan 02-04', () => {
  it('.passive → listenerOption entry with option: "passive"', () => {
    const result = passive.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'listenerOption',
      option: 'passive',
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.passive(true) → ROZ111 arity mismatch (no args expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 8, end: 9 } },
    ];
    const result = passive.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });
});
