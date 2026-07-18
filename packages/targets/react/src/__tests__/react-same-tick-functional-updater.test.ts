// quick 260718-uvo (TDD RED) — same-tick derived-local `$data` write must lower
// to the concurrent-safe functional updater.
//
// React loses all-but-the-last same-tick imperative `$data.<key>` write when the
// write's RHS is a state-derived LOCAL:
//
//   const next = $data.items.concat([x]); $data.items = next
//       → setItems(next)              ❌ plain value (stale closure; same-tick
//                                         writes coalesce to the last only)
//
// The functional-updater path (`setItems(prev => …)`) — the only lowering that
// is concurrent-safe and free of stale-closure capture — fired ONLY when the
// write's RHS *literally* contained `$data.items` (the `exprReadsAccessor` gate).
// The fix inlines a qualifying derived local into the updater:
//
//   const next = $data.items.concat([x]); $data.items = next
//       → setItems(prev => prev.concat([x]))   ✅ functional updater
//
// Mirrors rewriteScript.test.ts's harness: parse → lowerToIR (createDefaultRegistry)
// → cloneScriptProgram → rewriteRozieIdentifiers → generate.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import _generate from '@babel/generator';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');

function compileFixture(name: string): string {
  const src = readFileSync(resolve(FIXTURES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  const ir: IRComponent = lowered.ir;
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
  rewriteRozieIdentifiers(cloned, ir);
  return generate(cloned).code;
}

describe('React same-tick derived-local `$data` write → functional updater (260718-uvo)', () => {
  it('via-a-local write lowers to setItems(prev => prev.concat([x])), NOT setItems(next)', () => {
    const code = compileFixture('ReactSameTickDerivedLocalWrite');

    // Positive: the functional-updater arrow appears (whitespace-tolerant).
    expect(code).toMatch(/setItems\s*\(\s*prev\s*=>/);
    expect(code).toMatch(/setItems\s*\(\s*prev\s*=>\s*prev\.concat/);

    // Negative (the RED driver): the stale-closure plain form MUST NOT survive
    // for ANY of the three derived locals (`next`, `first`, `second`). Before
    // the fix, the via-a-local `append` lowers to `setItems(next)`.
    expect(code).not.toMatch(/setItems\s*\(\s*next\s*\)/);
    expect(code).not.toMatch(/setItems\s*\(\s*first\s*\)/);
    expect(code).not.toMatch(/setItems\s*\(\s*second\s*\)/);

    // The now-dead `const next = …` / `const first = …` / `const second = …`
    // declarators are removed once inlined — no orphan local remains.
    expect(code).not.toMatch(/const\s+next\s*=/);
    expect(code).not.toMatch(/const\s+first\s*=/);
    expect(code).not.toMatch(/const\s+second\s*=/);

    // No leftover Rozie sigils.
    expect(code).not.toContain('$data.');
  });

  it('byte-identity guard: the direct-RHS control still lowers to setItems(prev => prev.concat([x]))', () => {
    const code = compileFixture('ReactSameTickDerivedLocalWrite');
    // appendDirect: `$data.items = $data.items.concat([x])` — already correct,
    // must stay unchanged (this assertion is expected to pass RED and GREEN).
    expect(code).toMatch(/setItems\s*\(\s*prev\s*=>\s*prev\.concat\(\s*\[\s*x\s*\]\s*\)\s*\)/);
  });
});
