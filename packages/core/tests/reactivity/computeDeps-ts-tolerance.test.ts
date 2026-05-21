// Phase 9 — OQ-1 regression guard (RED scaffolded by Plan 09-01, turned GREEN
// by Plan 09-02 Task 1).
//
// OQ-1 (09-RESEARCH.md "Open Questions"): TS type-reference identifiers must
// NOT leak into the reactive dep graph.
//
// `computeExpressionDeps` (reactivity/computeDeps.ts) has an `Identifier`
// visitor that classifies free identifiers as `closure` deps. `@babel/traverse`
// descends into `TS*` nodes by default — so an author writing
// `let x: SomeType = makeIt()` inside a `$computed` / lifecycle / `$watch`
// callback parses `SomeType` as an `Identifier` nested in a `TSTypeReference`.
// Before the fix that `Identifier` was visited and — because `SomeType` has no
// runtime binding and is not a known computed — pushed as a spurious `closure`
// dep. Downstream, the React target would emit `[SomeType]` in a `useEffect` /
// `useMemo` dep array → `ReferenceError: SomeType is not defined` at runtime.
//
// Plan 09-02 Task 1 added `isInTypePosition` — a narrow type-position skip
// guard in the `Identifier` visitor. These tests are now permanent regression
// guards: type-reference identifiers are dropped, runtime identifiers are kept.
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
  it('does NOT collect a type-reference identifier as a closure dep', () => {
    // A callback body declaring a typed local. `SomeType` is a PURE type
    // reference — it has no runtime binding. `makeIt` is a genuine runtime
    // closure dep and SHOULD appear; `SomeType` must NOT.
    const arrow = parseTsArrow(
      '() => { let x: SomeType = makeIt(); return x; }',
    );
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    const names = depNames(deps);

    expect(names).not.toContain('SomeType');
  });

  it('the genuine runtime identifier IS still collected (narrow-guard counter-case)', () => {
    // Control case: `makeIt` is a real runtime free identifier and must be
    // tracked as a closure dep — proving the type-position guard is narrow and
    // did NOT blanket-disable dep collection for identifiers near TS nodes.
    const arrow = parseTsArrow(
      '() => { let x: SomeType = makeIt(); return x; }',
    );
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    expect(depNames(deps)).toContain('makeIt');
  });

  it('a magic-accessor read inside a typed callback is still collected', () => {
    // The runtime `$data.count` read must survive even though the same
    // callback declares a typed local — the guard skips only type position,
    // never a runtime MemberExpression.
    const arrow = parseTsArrow(
      '() => { let x: SomeType = makeIt(); return $data.count + x; }',
    );
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    expect(depNames(deps)).toContain('data.count');
  });

  it('the runtime expression wrapped in `as` IS still collected', () => {
    // `expr as T` — the `T` child is type position (skipped) but the wrapped
    // runtime expression `runtimeRef` is NOT, so it remains a closure dep.
    const arrow = parseTsArrow(
      '() => { return runtimeRef as SomeType; }',
    );
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    const names = depNames(deps);
    expect(names).toContain('runtimeRef');
    expect(names).not.toContain('SomeType');
  });

  it('a qualified type name (A.B) does not leak either segment as a dep', () => {
    // `let x: Ns.Inner` — `Ns` and `Inner` are both type-level identifiers
    // inside a TSQualifiedName; neither may enter the dep graph.
    const arrow = parseTsArrow(
      '() => { let x: Ns.Inner = makeIt(); return x; }',
    );
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    const names = depNames(deps);
    expect(names).not.toContain('Ns');
    expect(names).not.toContain('Inner');
    expect(names).toContain('makeIt');
  });

  // ── Untyped-path no-regression anchor (Task 2) ──────────────────────────
  // computeExpressionDeps on an UNTYPED callback (no TS nodes at all) must
  // return exactly the dep set it returned before Phase 9. The type-position
  // guard is a pure no-op for any AST that contains no `TS*` node. This is the
  // documented regression anchor for the untyped path.
  it('untyped-path anchor — an untyped callback yields the unchanged dep set', () => {
    const file: File = babelParse(
      '() => { return $data.count + helper($props.step); }',
      { sourceType: 'module', plugins: [] },
    );
    const stmt = file.program.body[0] as ExpressionStatement;
    const arrow = stmt.expression as ArrowFunctionExpression;
    const bindings = createEmptyBindings();
    const deps = computeExpressionDeps(arrow, bindings);
    // Encounter order: $data.count, then helper, then $props.step.
    expect(depNames(deps)).toEqual(['data.count', 'helper', 'props.step']);
  });
});
