// Phase 17 Plan 01 Task 2 — Solid producer `part="body"` passthrough (SPEC-R4b).
//
// `part` is a standard HTML static attribute. Solid keeps authored static
// attributes literal in the emitted JSX, so a producer-authored
// `<div class="card-body" part="body">` survives as `part="body"` in the
// Solid `.tsx` output. On Solid the cross-shadow `::part()` rule itself is a
// no-op (no shadow boundary) — only the producer attribute survives as a
// benign attr. The part name is the LITERAL `body` — never scope-hashed
// (SPEC-R6).
//
// No standalone emitTemplate.test.ts existed for the Solid target before this
// plan; this is the new file (the harness mirrors classSelector.test.ts).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSolid } from '../emitSolid.js';

function lowerInline(source: string, name = 'PartProducer'): IRComponent {
  const result = parse(source, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

const PRODUCER = `<rozie name="PartProducer">
<template>
<div class="card-body" part="body">
  <slot/>
</div>
</template>
</rozie>
`;

describe('emitTemplate — part= passthrough (SPEC-R3/R4b)', () => {
  it('emits the producer part="body" attribute verbatim into the Solid JSX', () => {
    const ir = lowerInline(PRODUCER);
    const { code } = emitSolid(ir, { filename: 'PartProducer.rozie', source: PRODUCER });
    expect(code).toContain('part="body"');
  });

  it('does NOT scope-hash the part name (literal `body`, SPEC-R6)', () => {
    const ir = lowerInline(PRODUCER);
    const { code } = emitSolid(ir, { filename: 'PartProducer.rozie', source: PRODUCER });
    expect(code).not.toMatch(/part="body-rozie-s/);
    expect(code).not.toMatch(/part="[^"]*data-rozie-s[^"]*"/);
  });
});
