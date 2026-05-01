// Phase 2 Plan 02-04 Task 2 — MOD-04 .capture builtin tests.
//
// arity 'none'; resolves to listenerOption entry. addEventListener({ capture: true }).
import { describe, expect, it } from 'vitest';
import { capture } from '../../../src/modifiers/builtins/capture.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'listeners-block',
  event: 'click',
  sourceLoc: { start: 0, end: 8 },
};

describe('builtin: .capture — Plan 02-04', () => {
  it('.capture → listenerOption entry with option: "capture"', () => {
    const result = capture.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'listenerOption',
      option: 'capture',
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.capture(true) → ROZ111 arity mismatch (no args expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 8, end: 9 } },
    ];
    const result = capture.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });
});
