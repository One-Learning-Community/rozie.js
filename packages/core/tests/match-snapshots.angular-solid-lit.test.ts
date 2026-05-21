// Emitted-code snapshot probes for the Phase 11 r-match construct — the
// Angular / Solid / Lit half of the cross-target matrix (plan 11-04).
//
// React / Vue / Svelte are covered by the sibling
// match-snapshots.react-vue-svelte.test.ts (plan 11-03); this file keeps
// those three targets out deliberately so a per-wave regression is
// attributable.
//
// Two falsifiable feature probes (11-VALIDATION § "three independently-
// falsifiable feature probes"):
//
//   - Comma probe (R3) — CommaAlternatives.rozie: each emitted target must
//     contain a `===` ... `||` ... `===` OR chain and must NOT contain
//     `.includes(`. The `===`-OR form is what preserves TypeScript
//     narrowing (R9); `.includes()` does not narrow.
//   - Literal-true probe (R4) — PredicateChain.rozie: a `r-match="true"`
//     discriminant switches to bare-predicate mode, so the emitted code
//     must contain neither `true ===` nor `false ===`.
//
// Each fixture × target emitted output is also file-snapshotted so an
// unexpected emit drift is visible in review.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const SNAP_DIR = resolve(__dirname, '__snapshots__/match-snapshots.angular-solid-lit');

// Angular / Solid / Lit only — React/Vue/Svelte are plan 11-03's file.
const TARGETS: CompileTarget[] = ['angular', 'solid', 'lit'];

function compileFixture(fixture: string, target: CompileTarget): string {
  const path = resolve(EXAMPLES_DIR, fixture);
  const source = readFileSync(path, 'utf8');
  const result = compile(source, { target, filename: path });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errors).toEqual([]);
  expect(result.code.length).toBeGreaterThan(0);
  return result.code;
}

describe('r-match emitted-code probes — Angular/Solid/Lit', () => {
  // ---- Comma probe (R3) — comma-alternative r-case → ===-OR, never .includes() ----
  describe('CommaAlternatives — comma alternatives lower to a ===-OR chain', () => {
    it.each(TARGETS)('emits a ===-OR chain (no .includes) on %s', (target) => {
      const code = compileFixture('match/CommaAlternatives.rozie', target);
      // The comma `r-case="'max', 'min'"` must fold to `=== 'max' || === 'min'`.
      expect(code).toContain('||');
      // A `===` ... `||` ... `===` OR pattern appears in the match region.
      expect(code).toMatch(/===[^|]*\|\|[^=]*===/);
      // `.includes()` does NOT narrow for TypeScript — it must never appear.
      expect(code).not.toContain('.includes(');
    });

    it.each(TARGETS)('matches the committed %s snapshot', async (target) => {
      const code = compileFixture('match/CommaAlternatives.rozie', target);
      await expect(code).toMatchFileSnapshot(
        resolve(SNAP_DIR, `CommaAlternatives.${target}.snap`),
      );
    });
  });

  // ---- Literal-true probe (R4) — r-match="true" → bare predicates ----
  describe('PredicateChain — r-match="true" emits bare predicates', () => {
    it.each(TARGETS)('emits no `true ===` / `false ===` on %s', (target) => {
      const code = compileFixture('match/PredicateChain.rozie', target);
      // Literal-true discriminant: each rung is its own bare predicate.
      expect(code).not.toContain('true ===');
      expect(code).not.toContain('false ===');
    });

    it.each(TARGETS)('matches the committed %s snapshot', async (target) => {
      const code = compileFixture('match/PredicateChain.rozie', target);
      await expect(code).toMatchFileSnapshot(
        resolve(SNAP_DIR, `PredicateChain.${target}.snap`),
      );
    });
  });
});
