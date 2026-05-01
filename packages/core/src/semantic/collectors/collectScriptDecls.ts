/**
 * Collect script-level declarations into the BindingsTable:
 *
 *   - `const X = $computed(() => ...)` → ComputedDeclEntry { name: 'X', callback }
 *   - `$onMount(...)` / `$onUnmount(...)` / `$onUpdate(...)` at Program top
 *     level → LifecycleHookEntry (ordered by source position).
 *   - `$emit('name', ...)` call sites anywhere in script → emits.add('name').
 *
 * **D-19 cleanup-pairing happens in Plan 05 lowerScript, NOT here.** This
 * collector captures the raw call sites; lowerScript reads them and runs
 * `extractCleanupReturn` to produce paired LifecycleHook IR.
 *
 * Lifecycle calls inside nested functions (NOT Program top level) are not
 * collected. Plan 02 unknownRefValidator emits ROZ104 for those; this
 * collector stays silent (collectors do not emit diagnostics per Plan
 * 02-01 contract).
 *
 * Uses @babel/traverse default-export visitor for $emit discovery (which
 * may appear inside arrow handlers, computed bodies, etc.). Top-level
 * computed/lifecycle iteration walks `script.program.program.body` directly
 * for source-order preservation (REACT-04).
 *
 * Per D-08 collected-not-thrown: NEVER throws.
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type {
  BindingsTable,
  ComputedDeclEntry,
  LifecycleHookEntry,
} from '../types.js';

// Default export interop: @babel/traverse ships a CJS default export that
// some bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }.
// Normalize at import time.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  (typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default);

const LIFECYCLE_CALLS: Record<string, 'mount' | 'unmount' | 'update'> = {
  $onMount: 'mount',
  $onUnmount: 'unmount',
  $onUpdate: 'update',
};

function extractComputedFromDeclarator(
  declarator: t.VariableDeclarator,
): ComputedDeclEntry | null {
  if (!t.isIdentifier(declarator.id)) return null;
  const init = declarator.init;
  if (!init || !t.isCallExpression(init)) return null;
  if (!t.isIdentifier(init.callee) || init.callee.name !== '$computed') return null;
  const cb = init.arguments[0];
  if (!cb) return null;
  if (!t.isArrowFunctionExpression(cb) && !t.isFunctionExpression(cb)) return null;
  return {
    name: declarator.id.name,
    callback: cb,
    sourceLoc: { start: declarator.start ?? 0, end: declarator.end ?? 0 },
  };
}

function extractLifecycleFromExpression(
  expr: t.Expression,
): LifecycleHookEntry | null {
  if (!t.isCallExpression(expr)) return null;
  if (!t.isIdentifier(expr.callee)) return null;
  const phase = LIFECYCLE_CALLS[expr.callee.name];
  if (!phase) return null;
  const callback = expr.arguments[0];
  if (!callback || !t.isExpression(callback)) return null;
  return {
    phase,
    callback,
    sourceLoc: { start: expr.start ?? 0, end: expr.end ?? 0 },
  };
}

export function collectScriptDecls(script: ScriptAST, bindings: BindingsTable): void {
  const programBody = script.program.program.body;

  // Iterate top-level statements in source order to preserve REACT-04
  // ordering of lifecycle entries.
  for (const stmt of programBody) {
    // const X = $computed(...) — VariableDeclaration with at least one matching declarator
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        const computed = extractComputedFromDeclarator(decl);
        if (computed) bindings.computeds.set(computed.name, computed);
      }
      continue;
    }
    // $onMount(...) etc. at Program top level (ExpressionStatement → CallExpression)
    if (t.isExpressionStatement(stmt)) {
      const lifecycle = extractLifecycleFromExpression(stmt.expression);
      if (lifecycle) bindings.lifecycle.push(lifecycle);
    }
  }

  // $emit discovery: walk the entire program for any CallExpression where
  // callee is the identifier '$emit' and the first argument is a StringLiteral.
  // @babel/traverse handles nested scopes and visitor enter automatically.
  traverse(script.program, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$emit') return;
      const firstArg = path.node.arguments[0];
      if (firstArg && t.isStringLiteral(firstArg)) {
        bindings.emits.add(firstArg.value);
      }
    },
  });
}
