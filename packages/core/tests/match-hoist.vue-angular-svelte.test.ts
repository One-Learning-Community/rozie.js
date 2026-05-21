// Phase 11 plan 11-06 — D-04 evaluate-once discriminant hoist probe for the
// three HIGHER-RISK targets: Vue, Angular, Svelte. (React/Solid/Lit are
// covered by plan 11-05's sibling `match-hoist.react-solid-lit`.)
//
// RESEARCH § Hoist-Placement Idioms classifies all three placement mechanisms
// as net-new emit work with ZERO existing precedent:
//   - Vue:     a synthesized `computed` script injection referenced by v-if.
//   - Angular: an `@let __rozieMatch_N = <discriminant>;` line before @if.
//   - Svelte:  a `$derived` script injection (the `{@const}` chicken-and-egg
//              fallback resolved in RESEARCH Open Question 1).
//
// R5 — an impure `CallExpression` discriminant must evaluate EXACTLY ONCE per
// render. `ExpensiveDiscriminant.rozie` has two `CallExpression` discriminants
// (`classify()` outer, `subClassify()` nested). The probe asserts, per target:
//
//   1. the discriminant call token appears EXACTLY ONCE in the emitted code —
//      a per-rung re-evaluation (the bug this hoist prevents) would emit it
//      once per `r-case`;
//   2. the two `__rozieMatch_` temp names (outer + nested) are DISTINCT — a
//      per-match-local counter would collide (RESEARCH Pitfall 5);
//   3. the fixture compiles with zero error diagnostics.
//
// Each output is ALSO captured via `toMatchFileSnapshot` so a structural
// regression surfaces here. Snapshots land under
// `__snapshots__/match-hoist.vue-angular-svelte/`.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const SNAP_DIR = resolve(__dirname, '__snapshots__/match-hoist.vue-angular-svelte');

// Plan 11-06 owns Vue / Angular / Svelte — the three zero-precedent hoist
// mechanisms. React / Solid / Lit are plan 11-05's sibling test.
const TARGETS: CompileTarget[] = ['vue', 'angular', 'svelte'];

const FIXTURE = 'match/ExpensiveDiscriminant.rozie';

function compileFixture(file: string, target: CompileTarget) {
  const path = resolve(EXAMPLES_DIR, file);
  const source = readFileSync(path, 'utf8');
  const result = compile(source, { target, filename: path });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  return { result, errors };
}

/** Count non-overlapping occurrences of a literal substring. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count++;
    from = idx + needle.length;
  }
  return count;
}

describe('r-match hoist probe — evaluate-once discriminant (R5)', () => {
  it.each(TARGETS)(
    'ExpensiveDiscriminant → %s emits each CallExpression discriminant exactly once',
    (target) => {
      const { result, errors } = compileFixture(FIXTURE, target);
      // R5 / R2 — the fixture must compile clean on every higher-risk target.
      expect(errors).toEqual([]);
      const code = result.code;

      // The OUTER discriminant is `classify()`; the nested one is
      // `subClassify()`. `countOccurrences` is case-sensitive, so the literal
      // `classify()` does NOT match inside `subClassify()` (capital `C`) —
      // the two call counts are independent. The hoist guarantees exactly ONE
      // call site per discriminant per render.
      const outerCalls = countOccurrences(code, 'classify()');
      const subCalls = countOccurrences(code, 'subClassify()');

      // R5 — exactly one call site per render for each discriminant. A
      // per-`r-case`-rung re-evaluation (the correctness bug the hoist exists
      // to prevent) would emit the call 2-3 times.
      expect(outerCalls).toBe(1);
      expect(subCalls).toBe(1);
    },
  );
});

describe('r-match hoist probe — distinct nested temp names (R5 / Pitfall 5)', () => {
  it.each(TARGETS)(
    'ExpensiveDiscriminant → %s allocates distinct __rozieMatch_ temp names',
    (target) => {
      const { result, errors } = compileFixture(FIXTURE, target);
      expect(errors).toEqual([]);
      const code = result.code;

      // Both `r-match` constructs have `CallExpression` discriminants and are
      // therefore `hoist`-mode — each gets a `__rozieMatch_N` temp. The core
      // per-component counter (plan 11-01) must allocate two DISTINCT names; a
      // per-match-local counter would emit `__rozieMatch_0` for both.
      expect(code).toContain('__rozieMatch_0');
      expect(code).toContain('__rozieMatch_1');

      // Sanity — exactly the two expected names, nothing higher.
      expect(code).not.toContain('__rozieMatch_2');
    },
  );
});

describe('r-match hoist probe — per-target hoist placement (D-04)', () => {
  it('Vue declares the hoist temp as a `computed` script injection', () => {
    const { result, errors } = compileFixture(FIXTURE, 'vue');
    expect(errors).toEqual([]);
    const code = result.code;
    // Vue (D-04) — a synthesized `computed` for each hoist temp.
    expect(code).toContain('const __rozieMatch_0 = computed(() => classify())');
    expect(code).toContain(
      'const __rozieMatch_1 = computed(() => subClassify())',
    );
  });

  it('Angular declares the hoist temp via an `@let` line', () => {
    const { result, errors } = compileFixture(FIXTURE, 'angular');
    expect(errors).toEqual([]);
    const code = result.code;
    // Angular (D-04) — `@let` lines before the `@if` ladder. Angular template
    // expressions reference class fields BARE (no `this.` prefix — that is the
    // emitter's `prefixThis: false` default for template-context rewrites).
    expect(code).toContain('@let __rozieMatch_0 = classify();');
    expect(code).toContain('@let __rozieMatch_1 = subClassify();');
  });

  it('Svelte declares the hoist temp via a `$derived` script injection', () => {
    const { result, errors } = compileFixture(FIXTURE, 'svelte');
    expect(errors).toEqual([]);
    const code = result.code;
    // Svelte (D-04) — the `$derived` fallback (RESEARCH Open Question 1).
    expect(code).toContain('const __rozieMatch_0 = $derived(classify())');
    expect(code).toContain('const __rozieMatch_1 = $derived(subClassify())');
  });
});

describe('r-match hoist probe — emitted-code snapshots', () => {
  it.each(TARGETS)('ExpensiveDiscriminant → %s structural snapshot', async (target) => {
    const { result, errors } = compileFixture(FIXTURE, target);
    expect(errors).toEqual([]);
    await expect(result.code).toMatchFileSnapshot(
      resolve(SNAP_DIR, `ExpensiveDiscriminant.${target}.snap`),
    );
  });
});
