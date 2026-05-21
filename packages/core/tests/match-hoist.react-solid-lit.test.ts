// Phase 11 — R5 evaluate-once hoist probe for the React / Solid / Lit targets
// (plan 11-05). The D-04 hoist is what makes an impure `CallExpression`
// `r-match` discriminant correct: without it the call is re-evaluated per
// `r-case` rung and can match zero or inconsistent branches.
//
// Two independently-falsifiable assertions per target:
//
//   - SINGLE CALL SITE: `examples/match/ExpensiveDiscriminant.rozie` uses a
//     `CallExpression` discriminant (`classify()` / `subClassify()`). Core
//     classifies it `discriminantMode: 'hoist'` and the emitter binds it once
//     to a `__rozieMatch_N` temp inside a return-position IIFE. Each
//     discriminant call must appear EXACTLY ONCE as a *value-position* call in
//     the emitted code — a hoist regression that inlines the call into every
//     rung makes the count > 1. (The fixture's `<script>` block ALSO emits a
//     function/method declaration for `classify`/`subClassify`; we count only
//     the value-position `= classify()` / `= this.classify()` call site, never
//     the `function classify() {` / `classify() {` declaration.)
//
//   - DISTINCT TEMP NAMES: the fixture nests a SECOND hoisting `r-match`
//     inside the first match's branch body. Core's per-component hoist counter
//     must allocate two DISTINCT `__rozieMatch_N` names — a per-match-local
//     counter would collide (RESEARCH Pitfall 5). We collect every
//     `__rozieMatch_<n>` token and assert at least two unique values.
//
// Each fixture×target output is captured via `toMatchFileSnapshot` so a
// structural regression also surfaces here. Snapshot files land under
// `__snapshots__/match-hoist.react-solid-lit/`.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const SNAP_DIR = resolve(__dirname, '__snapshots__/match-hoist.react-solid-lit');

// Plan 11-05 owns the React / Solid / Lit hoist paths.
const TARGETS: CompileTarget[] = ['react', 'solid', 'lit'];

const FIXTURE = 'match/ExpensiveDiscriminant.rozie';

// The two `CallExpression` discriminants in ExpensiveDiscriminant.rozie.
const DISCRIMINANTS = ['classify', 'subClassify'] as const;

function compileFixture(target: CompileTarget) {
  const path = resolve(EXAMPLES_DIR, FIXTURE);
  const source = readFileSync(path, 'utf8');
  const result = compile(source, { target, filename: path });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  return { result, errors };
}

/**
 * Count *value-position* call sites of a discriminant — `= name()` or
 * `= this.name()`. This deliberately excludes the function/method declaration
 * the fixture's `<script>` block emits (`function name() {` /
 * `name() {` — neither is preceded by `= `).
 */
function countCallSites(code: string, name: string): number {
  const re = new RegExp(`=\\s*(?:this\\.)?${name}\\(\\)`, 'g');
  return (code.match(re) ?? []).length;
}

describe('r-match evaluate-once hoist (R5) — React/Solid/Lit', () => {
  it.each(TARGETS)(
    'ExpensiveDiscriminant → %s evaluates each CallExpression discriminant exactly once',
    (target) => {
      const { result, errors } = compileFixture(target);
      expect(errors).toEqual([]);
      const code = result.code;

      // R5 — each hoisted discriminant is bound to its temp ONCE. A regression
      // that re-inlines the call into every `r-case` rung makes this > 1.
      for (const name of DISCRIMINANTS) {
        expect(countCallSites(code, name)).toBe(1);
      }
    },
  );

  it.each(TARGETS)(
    'ExpensiveDiscriminant → %s allocates distinct __rozieMatch_ temps for nested matches',
    (target) => {
      const { result, errors } = compileFixture(target);
      expect(errors).toEqual([]);
      const code = result.code;

      // R5 — the outer match and the nested match each hoist their own temp;
      // the per-component counter must produce DISTINCT names (Pitfall 5).
      const temps = new Set(code.match(/__rozieMatch_\d+/g) ?? []);
      expect(temps.size).toBeGreaterThanOrEqual(2);

      // Every temp is bound by exactly one `const` declaration — the hoist
      // wrapper, not a re-declaration per rung.
      for (const temp of temps) {
        const decls = (code.match(new RegExp(`const ${temp}\\b`, 'g')) ?? [])
          .length;
        expect(decls).toBe(1);
      }
    },
  );

  it.each(TARGETS)(
    'ExpensiveDiscriminant → %s emitted output (snapshot)',
    async (target) => {
      const { result, errors } = compileFixture(target);
      expect(errors).toEqual([]);
      await expect(result.code).toMatchFileSnapshot(
        resolve(SNAP_DIR, `ExpensiveDiscriminant.${target}.snap`),
      );
    },
  );
});
