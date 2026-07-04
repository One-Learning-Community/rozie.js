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
import { locFromBabel } from '../../diagnostics/locFromBabel.js';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type {
  BindingsTable,
  ComputedDeclEntry,
  LifecycleHookEntry,
  WatchEntry,
  ExposedMethodEntry,
  ProvideEntry,
  InjectEntry,
} from '../types.js';

/**
 * Phase 21 ($expose) — prototype-pollution guard. Mirrors the FORBIDDEN_KEYS
 * filter in collectPropDecls / collectDataDecls (T-2-01-01): a `$expose` key
 * named `__proto__` / `constructor` / `prototype` is SKIPPED, never recorded.
 */
const FORBIDDEN_EXPOSE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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
    sourceLoc: locFromBabel(declarator),
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
    sourceLoc: locFromBabel(expr),
  };
}

/**
 * Quick plan 260515-u2b — extract a top-level `$watch(getter, cb)` call into a
 * WatchEntry. Both args MUST be function expressions (arrow or function
 * expression). Malformed calls are skipped silently here (collectors stay
 * silent per Plan 02-01 contract) — the validator emits ROZ109 separately.
 */
function extractWatchFromExpression(expr: t.Expression): WatchEntry | null {
  if (!t.isCallExpression(expr)) return null;
  if (!t.isIdentifier(expr.callee)) return null;
  if (expr.callee.name !== '$watch') return null;
  if (expr.arguments.length < 2) return null;
  const getter = expr.arguments[0];
  const callback = expr.arguments[1];
  if (
    !getter ||
    (!t.isArrowFunctionExpression(getter) && !t.isFunctionExpression(getter))
  ) {
    return null;
  }
  if (
    !callback ||
    (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback))
  ) {
    return null;
  }
  // Quick plan 260602-9lw: parse the optional third-arg `{ immediate: true }`.
  // Accept ONLY a literal object with an `immediate` property whose value is the
  // boolean literal `true` (non-computed Identifier or StringLiteral key). Any
  // other shape (missing arg, non-object, computed key, dynamic value, false)
  // defaults to `immediate = false`. The collector stays silent on malformed
  // input (Plan 02-01 contract); no eval / dynamic-key execution.
  let immediate = false;
  const optionsArg = expr.arguments[2];
  if (optionsArg && t.isObjectExpression(optionsArg)) {
    for (const prop of optionsArg.properties) {
      if (!t.isObjectProperty(prop)) continue;
      if (prop.computed) continue;
      let key: string | null = null;
      if (t.isIdentifier(prop.key)) key = prop.key.name;
      else if (t.isStringLiteral(prop.key)) key = prop.key.value;
      if (key !== 'immediate') continue;
      if (t.isBooleanLiteral(prop.value) && prop.value.value === true) {
        immediate = true;
      }
    }
  }
  return {
    getter,
    callback,
    immediate,
    sourceLoc: locFromBabel(expr),
  };
}

/**
 * Phase 21 ($expose) — read the canonical `$expose({...})` argument object and
 * return its property key names as ExposedMethodEntry items in source order.
 *
 * Mirrors `extractWatchFromExpression`'s guard shape. Returns `null` when the
 * expression is not a top-level `$expose(...)` call. Returns `[]` when the call
 * exists but its argument is not an ObjectExpression (malformed — the VALIDATOR
 * emits ROZ115; the collector stays silent). Each well-formed property (both
 * shorthand `{ clear }` and explicit `{ clear: clear }`) yields one entry keyed
 * by its property name; spread / computed-key / non-identifier-key properties
 * are skipped here (the validator emits ROZ116/ROZ117). `__proto__` /
 * `constructor` / `prototype` keys are filtered (FORBIDDEN_EXPOSE_KEYS).
 */
function extractExposeFromExpression(
  expr: t.Expression,
): ExposedMethodEntry[] | null {
  if (!t.isCallExpression(expr)) return null;
  if (!t.isIdentifier(expr.callee)) return null;
  if (expr.callee.name !== '$expose') return null;
  const arg = expr.arguments[0];
  if (!arg || !t.isObjectExpression(arg)) return [];
  const entries: ExposedMethodEntry[] = [];
  for (const prop of arg.properties) {
    // SpreadElement / computed key / non-identifier key are malformed shapes
    // owned by the validator (ROZ116/ROZ117) — skip them silently here.
    if (!t.isObjectProperty(prop)) continue;
    if (prop.computed) continue;
    let name: string | null = null;
    if (t.isIdentifier(prop.key)) name = prop.key.name;
    else if (t.isStringLiteral(prop.key)) name = prop.key.value;
    if (name === null) continue;
    if (FORBIDDEN_EXPOSE_KEYS.has(name)) continue;
    entries.push({
      name,
      sourceLoc: locFromBabel(prop),
    });
  }
  return entries;
}

/**
 * Phase 36 ($provide) — read a top-level `$provide('key', value)`
 * ExpressionStatement and return its canonical ProvideEntry. Returns `null`
 * when the expression is not a `$provide(...)` call OR when the first argument
 * is not a StringLiteral (malformed key — the VALIDATOR emits ROZ129; the
 * collector stays silent). The 2nd argument (the provided value) is carried
 * through verbatim; an absent value yields `null` (skipped — there is nothing
 * to provide).
 */
function extractProvideFromExpression(
  expr: t.Expression,
): ProvideEntry | null {
  if (!t.isCallExpression(expr)) return null;
  if (!t.isIdentifier(expr.callee)) return null;
  if (expr.callee.name !== '$provide') return null;
  const keyArg = expr.arguments[0];
  if (!keyArg || !t.isStringLiteral(keyArg)) return null;
  const valueArg = expr.arguments[1];
  if (!valueArg || !t.isExpression(valueArg)) return null;
  return {
    key: keyArg.value,
    valueExpr: valueArg,
    sourceLoc: locFromBabel(expr),
  };
}

/**
 * Phase 36 ($inject) — read a `const x = $inject('key', fallback?)` declarator
 * and return its canonical InjectEntry. Returns `null` when `init` is not an
 * `$inject(...)` call, when the binding target is not a plain Identifier, OR
 * when the first argument is not a StringLiteral (malformed key — the VALIDATOR
 * emits ROZ130; the collector stays silent). The optional 2nd argument is the
 * fallback expression.
 */
function extractInjectFromDeclarator(
  declarator: t.VariableDeclarator,
): InjectEntry | null {
  if (!t.isIdentifier(declarator.id)) return null;
  const init = declarator.init;
  if (!init || !t.isCallExpression(init)) return null;
  if (!t.isIdentifier(init.callee) || init.callee.name !== '$inject') return null;
  const keyArg = init.arguments[0];
  if (!keyArg || !t.isStringLiteral(keyArg)) return null;
  const fallbackArg = init.arguments[1];
  const entry: InjectEntry = {
    key: keyArg.value,
    localBinding: declarator.id.name,
    sourceLoc: locFromBabel(init),
  };
  if (fallbackArg && t.isExpression(fallbackArg)) {
    entry.fallbackExpr = fallbackArg;
  }
  return entry;
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
        // Phase 36: top-level `const x = $inject('key', fallback?)` binder. Only
        // a `const`-declared, string-keyed, Identifier-bound form contributes a
        // canonical InjectEntry; other shapes are validator territory (ROZ130/
        // ROZ132). Multiple distinct $inject binders are all collected.
        if (stmt.kind === 'const') {
          const inject = extractInjectFromDeclarator(decl);
          if (inject) bindings.injects.push(inject);
        }
      }
      continue;
    }
    // $onMount(...) etc. at Program top level (ExpressionStatement → CallExpression)
    if (t.isExpressionStatement(stmt)) {
      const lifecycle = extractLifecycleFromExpression(stmt.expression);
      if (lifecycle) {
        bindings.lifecycle.push(lifecycle);
        continue;
      }
      // Quick plan 260515-u2b: top-level $watch(getter, cb) collection.
      const watcher = extractWatchFromExpression(stmt.expression);
      if (watcher) bindings.watchers.push(watcher);

      // Phase 21: top-level $expose({...}) — extract the canonical method names.
      // Only the FIRST top-level call contributes names (duplicate calls are a
      // validator error, ROZ119). Once `bindings.expose` is populated, later
      // top-level calls do not overwrite it; the validator inspects
      // `bindings.exposeCalls` for the duplicate.
      const exposed = extractExposeFromExpression(stmt.expression);
      if (exposed && bindings.expose.length === 0) {
        bindings.expose.push(...exposed);
      }

      // Phase 36: top-level `$provide('key', value)` statement. Unlike single-
      // `$expose`, multiple distinct $provide calls ARE allowed — each well-
      // formed call contributes a ProvideEntry. Malformed forms (non-string key
      // → ROZ129) are skipped here; the validator owns them.
      const provided = extractProvideFromExpression(stmt.expression);
      if (provided) bindings.provides.push(provided);
    }
  }

  // $emit discovery: walk the entire program for any CallExpression where
  // callee is the identifier '$emit' and the first argument is a StringLiteral.
  // @babel/traverse handles nested scopes and visitor enter automatically.
  traverse(script.program, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name === '$emit') {
        const firstArg = path.node.arguments[0];
        if (firstArg && t.isStringLiteral(firstArg)) {
          bindings.emits.add(firstArg.value);
        }
        return;
      }
      // Phase 21: record EVERY $expose call site for the validator. A call is
      // "at top level" iff it is the expression of an ExpressionStatement whose
      // parent is the Program body (the only valid placement). Anything nested
      // inside a function / block is atTopLevel:false → the validator emits
      // ROZ120. Duplicate top-level calls (>1) → ROZ119.
      if (callee.name === '$expose') {
        const parent = path.parent;
        const grandparent = path.parentPath?.parent;
        const atTopLevel =
          t.isExpressionStatement(parent) && t.isProgram(grandparent);
        bindings.exposeCalls.push({ call: path.node, atTopLevel });
        return;
      }
      // Phase 36: record EVERY $provide call site for the context validator.
      // `$provide` is a STATEMENT sigil — a valid call is the expression of an
      // ExpressionStatement. Anything else (expression position — assigned,
      // returned, nested in a larger expression) → ROZ131. ROZ129 (non-string
      // key) is checked against the call's first argument by the validator.
      if (callee.name === '$provide') {
        const parent = path.parent;
        const isStatement = t.isExpressionStatement(parent);
        bindings.provideCalls.push({ call: path.node, isStatement });
        return;
      }
      // Phase 36: record EVERY $inject call site for the context validator.
      // A valid `$inject` is the `init` of a `const` VariableDeclarator
      // (`const x = $inject('key')`). Anything else (bare statement, assigned to
      // a non-const, nested in an expression) → ROZ132. ROZ130 (non-string key)
      // is checked against the call's first argument by the validator.
      if (callee.name === '$inject') {
        const parent = path.parent;
        const grandparent = path.parentPath?.parent;
        const boundToConst =
          t.isVariableDeclarator(parent) &&
          parent.init === path.node &&
          t.isVariableDeclaration(grandparent) &&
          grandparent.kind === 'const';
        // CR-02 WR-02 — record whether this $inject is the SOLE declarator of its
        // enclosing const. A mixed declaration (`const x = $inject('k'), y = 5`)
        // defeats the per-statement strip in the emitters → ROZ134.
        const soleDeclarator =
          t.isVariableDeclaration(grandparent) &&
          grandparent.declarations.length === 1;
        bindings.injectCalls.push({ call: path.node, boundToConst, soleDeclarator });
        return;
      }
    },
  });
}
