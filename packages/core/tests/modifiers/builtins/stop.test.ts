// Phase 2 Plan 02-04 Task 2 — MOD-04 .stop builtin tests.
//
// arity 'none'; resolves to filter entry. event.stopPropagation() before handler.
import { describe, expect, it } from 'vitest';
import { stop } from '../../../src/modifiers/builtins/stop.js';
import type { ModifierContext } from '../../../src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../src/modifier-grammar/parseModifierChain.js';

const CTX: ModifierContext = {
  source: 'template-event',
  event: 'click',
  sourceLoc: { start: 0, end: 6 },
};

describe('builtin: .stop — Plan 02-04', () => {
  it('.stop → filter entry with modifier: "stop", empty args', () => {
    const result = stop.resolve([], CTX);
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'filter',
      modifier: 'stop',
      args: [],
      sourceLoc: CTX.sourceLoc,
    });
  });

  it('.stop(arg) → ROZ111 arity mismatch (no args expected)', () => {
    const args: ModifierArg[] = [
      { kind: 'literal', value: 1, loc: { start: 6, end: 7 } },
    ];
    const result = stop.resolve(args, CTX);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ code: 'ROZ111', severity: 'error' });
  });

  // Phase 07.1 — Solid/Lit emission descriptors (parallels svelte()/angular()).
  it('.stop solid() → inlineGuard with e.stopPropagation()', () => {
    const desc = stop.solid!([], CTX);
    expect(desc).toEqual({ kind: 'inlineGuard', code: 'e.stopPropagation();' });
  });

  it('.stop lit() → inlineGuard with e.stopPropagation()', () => {
    const desc = stop.lit!([], CTX);
    expect(desc).toEqual({ kind: 'inlineGuard', code: 'e.stopPropagation();' });
  });
});
