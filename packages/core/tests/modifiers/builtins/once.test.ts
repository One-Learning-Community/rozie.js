// Phase 2 Plan 02-04 Task 2 — MOD-04 .once builtin tests.
//
// arity 'none'; resolves to listenerOption entry. addEventListener({ once: true }).
import { describe, expect, it } from 'vitest';
import { once } from '../../../src/modifiers/builtins/once.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'click',
  sourceLoc: { start: 0, end: 6 },
};

describe('builtin: .once — Plan 02-04', () => {
  it('.once → listenerOption entry with option: "once"', () => {
    const result = once.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'listenerOption',
      option: 'once',
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.once(1) → ROZ111 arity mismatch (no args expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 6, end: 7 } },
    ];
    const result = once.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });
});
