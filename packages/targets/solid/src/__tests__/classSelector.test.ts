// Phase 13 Plan 13-01 (Wave 0 RED scaffold) — Solid `$classSelector` emit test.
//
// `$classSelector('<class>')` is the Phase 13 helper that lowers a class name
// to a CSS selector matching the class as it actually renders at runtime.
//
// Solid keeps authored class names LITERAL in the emitted DOM (style isolation
// via a `[data-rozie-s-<hash>]` attribute), so `$classSelector('grip')` lowers
// to the compile-time string literal `".grip"`. (React is the lone exception —
// it lowers to a runtime `"." + styles.grip` expression.)
//
// This scaffold is INTENTIONALLY RED. The lowering lands in Wave 2 (the
// per-target `rewrite/rewriteScript.ts` + `rewrite/rewriteTemplateExpression.ts`
// `$classSelector` branches). Until then these tests fail — which is the
// Nyquist contract: the downstream implementation task has a test waiting.
//
// Covers (per 13-VALIDATION Requirement -> Test Map):
//   R1 — `$classSelector('grip')` compiles with no error diagnostic.
//   R2 — emitted output contains the literal `".grip"` / `".panel"` for BOTH
//        the `<script>`-position call AND the `:attr`-position call.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitSolid } from '../emitSolid.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

/** Compile `examples/ClassSelectorProbe.rozie` to Solid `.tsx` output. */
function compileProbe(): { code: string; diagnostics: Diagnostic[] } {
  const filename = 'ClassSelectorProbe.rozie';
  const source = readFileSync(resolve(ROOT, `examples/${filename}`), 'utf8');
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  const registry = createDefaultRegistry();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
  });
  if (!ir) throw new Error('lowerToIR returned null IR');
  const emitted = emitSolid(ir, { filename, source, modifierRegistry: registry });
  return {
    code: emitted.code,
    diagnostics: [...parseDiags, ...lowerDiags, ...emitted.diagnostics],
  };
}

describe('$classSelector emit (Solid) [Wave 0 RED — implemented in Wave 2]', () => {
  it('R1: ClassSelectorProbe compiles with no error diagnostic', () => {
    const { diagnostics } = compileProbe();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('R2: <script>-position $classSelector(\'grip\') lowers to the literal ".grip"', () => {
    const { code } = compileProbe();
    expect(code).toContain('".grip"');
    // The raw helper call must NOT survive into emitted output.
    expect(code).not.toContain('$classSelector');
  });

  it('R2: :attr-position $classSelector(\'panel\') lowers to the literal ".panel"', () => {
    const { code } = compileProbe();
    // The :data-handle binding flows through rewriteTemplateExpression.ts.
    expect(code).toContain('".panel"');
    expect(code).not.toContain('$classSelector');
  });
});
