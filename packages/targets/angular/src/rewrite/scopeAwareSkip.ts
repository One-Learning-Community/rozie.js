/**
 * scopeAwareSkip — shared binding-position / shadowing-binding guard for the
 * class-emitter identifier-rewrite pass.
 *
 * The Lit + Angular class emitters promote top-level script bindings (`const`
 * arrows, `function` declarations, and plain `let`/`const` value bindings such
 * as `let editor = null`) to class fields/methods, then rewrite every bare
 * reference to those names into `this.<name>`. That rewrite must NOT touch an
 * identifier that sits in a BINDING position — most importantly a destructured
 * parameter name that *shadows* the promoted name, e.g.
 *
 *   let editor = null                       // promoted to class field
 *   ...
 *   onUpdate: ({ editor }) => editor.foo()  // `editor` here is a LOCAL param
 *
 * Naively rewriting the shorthand `{ editor }` parameter to `{ editor: this.editor }`
 * produces the illegal binding pattern `({ editor: this.editor }) => …` that
 * @babel/parser rejects with "Binding member expression."
 *
 * This module ports the scope-awareness already proven correct for the React
 * target in `packages/targets/react/src/rewrite/hoistModuleLet.ts`:
 *   - `patternIntroducesBinding` — recurses ObjectPattern / ArrayPattern /
 *     AssignmentPattern / RestElement to decide whether a pattern binds `name`.
 *   - `hasShadowingBinding` — manual ancestor walk for function params
 *     (incl. destructured) and inner `let`/`const`/`var` declarations that
 *     introduce a shadowing local binding.
 *   - `isInBindingPosition` — true when the identifier itself sits anywhere
 *     inside an ObjectPattern / ArrayPattern (the destructured-parameter
 *     binding case). The upward walk stops at the enclosing Function and
 *     treats `AssignmentPattern.right` (a default *value*) as a non-binding
 *     (expression) side, so `{ x = expr }` default values still get rewritten.
 *
 * Babel's scope cache is unreliable mid-mutation (the rewrite pass mutates the
 * AST without re-crawling), so all checks use manual ancestor inspection —
 * never `path.scope.getBinding`.
 *
 * NOTE: this file is intentionally mirrored byte-identical (in logic) into the
 * Angular target's rewrite/ directory. The two passes import from different
 * package-relative paths; mirroring avoids a cross-package import.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';

/** Minimal NodePath-like shape — only the ancestor-walk surface we use. */
export type ParentPathLike = {
  node: t.Node;
  parentPath: ParentPathLike | null;
};

/**
 * Returns true if a binding-pattern node (Identifier in simple cases,
 * ObjectPattern / ArrayPattern / AssignmentPattern / RestElement for
 * destructured forms) introduces a binding for `name`.
 *
 * Ported verbatim from hoistModuleLet.ts.
 */
export function patternIntroducesBinding(pattern: t.Node, name: string): boolean {
  if (t.isIdentifier(pattern)) return pattern.name === name;
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        if (patternIntroducesBinding(prop.value as t.Node, name)) return true;
      } else if (t.isRestElement(prop)) {
        if (patternIntroducesBinding(prop.argument, name)) return true;
      }
    }
    return false;
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (el && patternIntroducesBinding(el, name)) return true;
    }
    return false;
  }
  if (t.isAssignmentPattern(pattern)) {
    return patternIntroducesBinding(pattern.left, name);
  }
  if (t.isRestElement(pattern)) {
    return patternIntroducesBinding(pattern.argument, name);
  }
  return false;
}

/**
 * Returns true if `name` is bound by a LOCAL declaration that lexically
 * encloses `path`. Walks ancestors looking for function parameters
 * (including destructuring patterns) and inner `let`/`const`/`var`
 * declarations that introduce a shadowing binding.
 *
 * IMPORTANT — differs from hoistModuleLet.ts's variant:
 *   hoistModuleLet.ts splices the module-`let` declarations out of the
 *   Program BEFORE calling this, so it can safely scan the Program body.
 *   Here the promoted declarations (`const inc = …`, `let editor = null`,
 *   `const canIncrement = $computed(…)`) are STILL in the Program — they are
 *   precisely the names being rewritten TO `this.<name>`. A Program-level
 *   declaration of `name` is therefore the promoted declaration itself, NOT a
 *   shadow. So this walk EXCLUDES the Program node and only treats *inner*
 *   block-scoped declarations and function parameters as shadows.
 *
 * We do NOT rely on Babel's `path.scope.getBinding` here because the scope
 * cache is stale after the rewrite pass mutates the AST without re-crawling.
 * Manual ancestor inspection avoids the staleness.
 */
export function hasShadowingBinding(
  path: { parentPath: ParentPathLike | null },
  name: string,
): boolean {
  for (
    let walker: ParentPathLike | null = path.parentPath;
    walker;
    walker = walker.parentPath
  ) {
    const node = walker.node;
    // Function boundary: check parameters (including destructured ones).
    if (t.isFunction(node)) {
      for (const param of node.params) {
        if (patternIntroducesBinding(param, name)) return true;
      }
      // Don't stop here — keep walking outer scopes.
    }
    // Catch-clause binding: `catch (name)` / `catch ({ name })` shadows the
    // promoted name inside the catch block. `CatchClause.param` is a binding
    // position babel-types forbids from being a MemberExpression, so a reference
    // to `name` inside the catch body must resolve to the LOCAL, never
    // `this.<name>`.
    if (t.isCatchClause(node) && node.param && patternIntroducesBinding(node.param, name)) {
      return true;
    }
    // Inner block-scoped declarations. The Program node is intentionally
    // EXCLUDED: a top-level `const name = …` IS the promoted declaration the
    // rewrite targets, not a shadow.
    if (t.isBlockStatement(node)) {
      for (const stmt of node.body) {
        // Inner `let`/`const`/`var` declarations.
        if (t.isVariableDeclaration(stmt)) {
          for (const decl of stmt.declarations) {
            if (patternIntroducesBinding(decl.id, name)) return true;
          }
          continue;
        }
        // Inner `function name() {}` declarations shadow the promoted name for
        // any reference in the same block (the declaration is hoisted within
        // the block). A bare call `name()` intended for the inner function must
        // NOT be rewritten to `this.<name>()` (wrong target + arity).
        if (t.isFunctionDeclaration(stmt) && stmt.id && stmt.id.name === name) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Returns true when the identifier at `path` sits anywhere inside an
 * ObjectPattern / ArrayPattern — i.e. it is a destructuring BINDING, not a
 * reference. The upward walk stops at the enclosing Function. An
 * AssignmentPattern's `right` (the default *value*) is an expression, not a
 * binding, so the walk treats descent-via-`right` as a non-binding and keeps
 * looking; descent-via-`left` (or the binding subtree of an AssignmentPattern)
 * is a binding.
 *
 * Mirrors the nested-pattern ancestor walk in hoistModuleLet.ts.
 */
export function isInBindingPosition(path: {
  node: t.Node;
  parentPath: ParentPathLike | null;
}): boolean {
  let child: t.Node = path.node;
  let walker: ParentPathLike | null = path.parentPath;
  while (walker) {
    const node = walker.node;
    if (t.isObjectPattern(node) || t.isArrayPattern(node)) return true;
    if (t.isAssignmentPattern(node)) {
      // Descended via `right` (default value) → expression side, NOT a
      // binding. Stop the walk: a default value can legitimately reference
      // a class member, so it must remain rewritable.
      if (node.right === child) return false;
      // Descended via `left` → the binding subtree; keep walking up so an
      // enclosing ObjectPattern/ArrayPattern is still detected.
    }
    if (t.isFunction(node)) {
      // Reached the enclosing function without hitting a pattern — the
      // identifier is in the function body / a non-pattern position.
      return false;
    }
    child = node;
    walker = walker.parentPath;
  }
  return false;
}
