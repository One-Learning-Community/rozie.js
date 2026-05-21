// Phase 9 Plan 09-01 Task 3 — OQ-1 Wave 0 RED scaffold.
//
// OQ-1 (09-RESEARCH.md "Open Questions"): TS type-reference identifiers must
// NOT leak into the reactive dep graph.
//
// `computeExpressionDeps` (reactivity/computeDeps.ts) has an `Identifier`
// visitor that classifies free identifiers as `closure` deps. `@babel/traverse`
// descends into `TS*` nodes by default — so an author writing
// `let x: SomeType = makeIt()` inside a `$computed` / lifecycle / `$watch`
// callback parses `SomeType` as an `Identifier` nested in a `TSTypeReference`.
// That `Identifier` is currently visited and — because `SomeType` has no
// runtime binding and is not a known computed — pushed as a spurious `closure`
// dep. Downstream, the React target would emit `[SomeType]` in a `useEffect` /
// `useMemo` dep array → `ReferenceError: SomeType is not defined` at runtime.
//
// This file REPRODUCES that bug. The assertion below is wrapped in
// `it.fails(...)` so the suite stays green-pending while the bug exists: the
// `it.fails` test PASSES exactly while the assertion fails (the bug is real),
// and would itself FAIL the day the bug is fixed — flagging the moment to flip
// it to a plain `it(...)`.
//
// RED: OQ-1 — turned green by Plan 09-02 Task 1, which adds `TS*` skip guards
// to the `computeExpressionDeps` `Identifier` visitor (skip any Identifier
// whose ancestry includes a `TS*` node). When 09-02 lands, change `it.fails`
// to `it` and this becomes a permanent regression guard.
import { describe, expect, it } from 'vitest';
import { parse as babelParse } from '@babel/parser';
import type {
  ArrowFunctionExpression,
  ExpressionStatement,
  File,
} from '@babel/types';
import { computeExpressionDeps } from '../../src/reactivity/computeDeps.js';
import { createEmptyBindings } from '../../src/semantic/bindings.js';

/**
 * Parse a TypeScript callback expression and return its ArrowFunctionExpression
 * node. Mirrors how `buildDepGraph` feeds `$computed` / lifecycle / `$watch`
 * callback bodies into `computeExpressionDeps`.
 */
function parseTsArrow(src: string): ArrowFunctionExpression {
  // `typescript` plugin ON — this is the `<script lang="ts">` parse path.
  const file: File = babelParse(src, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  const stmt = file.program.body[0] as ExpressionStatement;
  return stmt.expression as ArrowFunctionExpression;
}

/** Flatten a SignalRef set to a comparable list of identifier/path strings. */
function depNames(
  deps: ReturnType<typeof computeExpressionDeps>,
): string[] {
  return deps.map((d) =>
    d.scope === 'closure' ? d.identifier : `${d.scope}.${d.path.join('.')}`,
  );
}

describe('computeExpressionDeps — TS type-reference tolerance (OQ-1)', () => {
  // RED: OQ-1 — turned green by Plan 09-02 Task 1.
  // While the bug exists, the inner assertion fails → `it.fails` PASSES.
  // When 09-02 adds the TS* skip guards, the inner assertion will pass →
  // `it.fails` will FAIL, signalling "flip this to a plain `it`".
  it.fails(
    'does NOT collect a type-reference identifier as a closure dep [RED — flips green after 09-02 Task 1]',
    () => {
      // A callback body declaring a typed local. `SomeType` is a PURE type
      // reference — it has no runtime binding. `makeIt` is a genuine runtime
      // closure dep and SHOULD appear; `SomeType` must NOT.
      const arrow = parseTsArrow(
        '() => { let x: SomeType = makeIt(); return x; }',
      );
      const bindings = createEmptyBindings();
      const deps = computeExpressionDeps(arrow, bindings);
      const names = depNames(deps);

      // The correct, post-09-02 expectation: `SomeType` is absent.
      expect(names).not.toContain('SomeType');
    },
  );

  it('the genuine runtime identifier IS still collected (sanity — not affected by OQ-1)', () => {
    // Control case: `makeIt` is a real runtime free identifier and must be
    // tracked as a closure dep regardless of the type-reference bug. This
    // assertion holds today and must keep holding after the 09-02 fix —
    // confirming the fix only filters TS* identifiers, not runtime ones.
    const arrow = parseTsArrow(
      '() => { let x: SomeType = makeIt(); return x; }',
    );
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    expect(depNames(deps)).toContain('makeIt');
  });
});
