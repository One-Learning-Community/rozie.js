// Phase 9 WR-02 — shared `isInTypePosition` guard.
//
// `isInTypePosition` (ast/typePosition.ts) was factored out of
// `reactivity/computeDeps.ts` so every per-target `rewriteScript` reuses the
// IDENTICAL type-position check. Without it, a `<script lang="ts">`
// type-reference identifier colliding with a `$computed` / `$data` / prop
// name would be rewritten into a runtime accessor INSIDE a type annotation,
// producing invalid TypeScript.
//
// These tests anchor the helper directly: an identifier inside a type
// construct returns true; the same name in runtime position returns false.
import { describe, expect, it } from 'vitest';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isInTypePosition } from '../../src/ast/typePosition.js';

// @babel/traverse ships a CJS default export some ESM resolvers wrap.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/**
 * Collect every Identifier named `name` in `src` (parsed as TS) and return
 * whether `isInTypePosition` reports it as type-positioned. Returns one entry
 * per occurrence, in source order.
 */
function classifyOccurrences(src: string, name: string): boolean[] {
  const file = babelParse(src, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  const results: boolean[] = [];
  traverse(file, {
    Identifier(path: NodePath<t.Identifier>) {
      if (path.node.name === name) results.push(isInTypePosition(path));
    },
  });
  return results;
}

describe('isInTypePosition — shared TS-type-position guard (WR-02)', () => {
  it('reports an identifier inside a type annotation as type position', () => {
    // `let x: total = …` — the `total` in `: total` is type position; the
    // RHS `total` (a runtime reference) is not.
    const flags = classifyOccurrences('let x: total = total;', 'total');
    expect(flags).toEqual([true, false]);
  });

  it('reports generic-type-parameter uses as type position', () => {
    // `function f<total>(x: total): total {}` — the `<total>` declaration is a
    // `TSTypeParameter` whose name is a bare string (no Identifier node), so
    // only the two USES — `x: total` and the `: total` return — surface as
    // Identifiers. Both are type-level; the runtime `x` binding is separate.
    const flags = classifyOccurrences(
      'function f<total>(x: total): total { return x; }',
      'total',
    );
    expect(flags).toEqual([true, true]);
  });

  it('reports interface / type-alias body identifiers as type position', () => {
    const ifaceFlags = classifyOccurrences(
      'interface Shape { field: count }',
      'count',
    );
    expect(ifaceFlags).toEqual([true]);
    const aliasFlags = classifyOccurrences('type Alias = count;', 'count');
    expect(aliasFlags).toEqual([true]);
  });

  it('reports both segments of a qualified type name as type position', () => {
    const nsFlags = classifyOccurrences('let x: Ns.Inner = y;', 'Ns');
    expect(nsFlags).toEqual([true]);
    const innerFlags = classifyOccurrences('let x: Ns.Inner = y;', 'Inner');
    expect(innerFlags).toEqual([true]);
  });

  it('treats only the TYPE child of an `as` assertion as type position', () => {
    // `runtimeRef as total` — `total` (the type) is type position; the wrapped
    // runtime expression `runtimeRef` is not.
    const typeFlags = classifyOccurrences('const z = runtimeRef as total;', 'total');
    expect(typeFlags).toEqual([true]);
    const runtimeFlags = classifyOccurrences(
      'const z = runtimeRef as total;',
      'runtimeRef',
    );
    expect(runtimeFlags).toEqual([false]);
  });

  it('reports a plain runtime identifier as NOT type position', () => {
    const flags = classifyOccurrences(
      'const a = total; foo(total);',
      'total',
    );
    expect(flags).toEqual([false, false]);
  });

  it('accepts a MemberExpression NodePath — a runtime member is NOT type position', () => {
    // The guard accepts any NodePath, so a per-target rewriteScript
    // `MemberExpression` visitor can call it directly. A plain runtime
    // `obj.field` read is not in type position. (TS type positions use
    // `TSQualifiedName` / `TSTypeQuery` entity names, never a JS
    // `MemberExpression` — so the MemberExpression guard is belt-and-braces;
    // what matters is that it never false-positives on a runtime member.)
    const file = babelParse('const z = obj.field;', {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    const memberFlags: boolean[] = [];
    traverse(file, {
      MemberExpression(path) {
        memberFlags.push(isInTypePosition(path));
      },
    });
    expect(memberFlags).toEqual([false]);
  });
});
