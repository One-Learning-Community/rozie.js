// Phase 11 — emitted-code snapshot probes for the r-match feature behaviors
// on the React / Vue / Svelte targets (plan 11-03 Task 2; Solid/Lit are
// covered by plan 11-04's sibling `match-snapshots.angular-solid-lit`).
//
// Two independently-falsifiable probes (D-06 — a regression in one is
// detectable without the other):
//
//   - Comma probe (R3): `CommaAlternatives.rozie` carries a comma-alternative
//     `r-case="'max', 'min'"`. Core folds the comma sub-grammar to a `===`-OR
//     chain (`bound === 'max' || bound === 'min'`) — NEVER `.includes()`. The
//     `===`-OR form is what preserves TypeScript narrowing. The probe asserts
//     the emitted code contains an `===`…`||`…`===` OR chain and contains NO
//     `.includes(` call.
//
//   - Literal-true probe (R4): `PredicateChain.rozie` uses `r-match="true"`,
//     which switches each `r-case` to BARE-PREDICATE mode — the rung lowers to
//     the predicate `X` directly, not `true === X`. The probe asserts no
//     `true ===` / `false ===` substring appears in the emitted match code.
//
// Each fixture×target output is ALSO captured via `toMatchFileSnapshot` so a
// structural regression surfaces here. Snapshot files land under
// `__snapshots__/match-snapshots.react-vue-svelte/`.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const SNAP_DIR = resolve(__dirname, '__snapshots__/match-snapshots.react-vue-svelte');

// Plan 11-03 owns React / Vue / Svelte. Solid + Lit are plan 11-04's sibling test.
const TARGETS: CompileTarget[] = ['react', 'vue', 'svelte'];

function compileFixture(file: string, target: CompileTarget) {
  const path = resolve(EXAMPLES_DIR, file);
  const source = readFileSync(path, 'utf8');
  const result = compile(source, { target, filename: path });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  return { result, errors };
}

describe('r-match snapshot probes — comma alternatives (R3)', () => {
  it.each(TARGETS)(
    'CommaAlternatives → %s emits a ===-OR chain, never .includes()',
    async (target) => {
      const { result, errors } = compileFixture(
        'match/CommaAlternatives.rozie',
        target,
      );
      expect(errors).toEqual([]);
      const code = result.code;

      // R3 — the comma alternative folds to a `===`-OR chain. We require an
      // `===` comparison joined by `||` to another `===` comparison somewhere
      // in the emitted code (the folded `bound === 'max' || bound === 'min'`).
      expect(code).toMatch(/===[^|]*\|\|[^=]*===/);

      // R3 / R9 — the `.includes()` form would destroy TypeScript narrowing.
      // It MUST NOT appear anywhere in the emitted match code.
      expect(code).not.toContain('.includes(');

      await expect(code).toMatchFileSnapshot(
        resolve(SNAP_DIR, `CommaAlternatives.${target}.snap`),
      );
    },
  );
});

describe('r-match snapshot probes — literal-true predicate chain (R4)', () => {
  it.each(TARGETS)(
    'PredicateChain → %s emits bare predicates, never true===/false===',
    async (target) => {
      const { result, errors } = compileFixture(
        'match/PredicateChain.rozie',
        target,
      );
      expect(errors).toEqual([]);
      const code = result.code;

      // R4 — `r-match="true"` switches each rung to bare-predicate mode. The
      // emitted code must NOT fold a `true ===` / `false ===` comparison.
      expect(code).not.toContain('true ===');
      expect(code).not.toContain('false ===');

      await expect(code).toMatchFileSnapshot(
        resolve(SNAP_DIR, `PredicateChain.${target}.snap`),
      );
    },
  );
});
