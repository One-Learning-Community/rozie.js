/**
 * collectExposedFunctions — shared `$expose`-verb function-node resolution.
 *
 * Phase 21 ($expose) introduced TWO independent call sites that need to map an
 * `ir.expose` method NAME back to the actual `<script>` AST function node:
 *   - `synthesizeHandleType` (the `<Name>Handle` interface/TSX signature) —
 *     needs the node to read the author's param/return types.
 *   - `typeNeutralizeScript` (emitter-hardening backlog item #5) — needs the
 *     node to decide which TRAILING untyped params of an exposed verb should
 *     lower `?: any` instead of `: any` (see that file for the full rationale).
 *
 * Both need the identical resolution: a top-level `function name() {}` /
 * `const name = () => {}` declaration, OR an inline value inside the
 * `$expose({ name: () => {} })` call itself. Extracted here so the two
 * consumers cannot silently drift on what "the exposed function" means.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent } from '../ir/types.js';

/** A function-like node whose signature/params we can read. */
export type FnLike =
  | t.FunctionDeclaration
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.ObjectMethod;

/**
 * Top-level `<script>` function declarations by name:
 *   - `function reset() {}` → FunctionDeclaration
 *   - `const reset = (...) => {}` / `const reset = function () {}` → the init.
 * A `$computed(...)`-bound const is intentionally excluded (reactive value).
 */
function collectScriptFunctions(ir: IRComponent): Map<string, FnLike> {
  const out = new Map<string, FnLike>();
  const body = ir.setupBody.scriptProgram.program.body;
  for (const stmt of body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      out.set(stmt.id.name, stmt);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id)) continue;
        const init = decl.init;
        if (
          init &&
          (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
        ) {
          out.set(decl.id.name, init);
        }
      }
    }
  }
  return out;
}

/**
 * Inline `$expose({ name: () => ... })` arrow/function values so a method
 * exposed only as an inline expression still resolves to its own node.
 */
function collectInlineExposeFns(ir: IRComponent): Map<string, FnLike> {
  const out = new Map<string, FnLike>();
  const body = ir.setupBody.scriptProgram.program.body;
  for (const stmt of body) {
    if (!t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (
      !t.isCallExpression(expr) ||
      !t.isIdentifier(expr.callee) ||
      expr.callee.name !== '$expose'
    ) {
      continue;
    }
    const arg = expr.arguments[0];
    if (!arg || !t.isObjectExpression(arg)) continue;
    for (const prop of arg.properties) {
      if (t.isObjectMethod(prop) && !prop.computed && t.isIdentifier(prop.key)) {
        out.set(prop.key.name, prop);
        continue;
      }
      if (t.isObjectProperty(prop) && !prop.computed && t.isIdentifier(prop.key)) {
        const value = prop.value;
        if (
          t.isArrowFunctionExpression(value) ||
          t.isFunctionExpression(value)
        ) {
          out.set(prop.key.name, value);
        }
      }
    }
  }
  return out;
}

/**
 * Resolve every `ir.expose` method name to its `<script>` function node.
 * Returns an empty Map when `ir.expose` is empty (or `ir` is not yet
 * available — callers pass `undefined`/omit `ir` entirely in that case).
 * A method name with no resolvable node (should not happen post-validation,
 * defensive only) is simply absent from the returned Map.
 */
export function collectExposedFunctionsByName(
  ir: IRComponent,
): Map<string, FnLike> {
  if (!ir.expose || ir.expose.length === 0) return new Map();
  const scriptFns = collectScriptFunctions(ir);
  const inlineFns = collectInlineExposeFns(ir);
  const out = new Map<string, FnLike>();
  for (const method of ir.expose) {
    const fn = scriptFns.get(method.name) ?? inlineFns.get(method.name);
    if (fn) out.set(method.name, fn);
  }
  return out;
}
