/**
 * computeExpressionDeps — single-expression reactive-dep analyzer (REACT-06).
 *
 * Algorithm matches eslint-plugin-react-hooks/exhaustive-deps
 * `gatherDependenciesRecursively` per D-21. Walks ONLY the analyzed expression;
 * helper-function calls are recorded as closure deps but the analyzer does
 * NOT recurse into the helper's body. This OPAQUE-AT-HELPER-BOUNDARY rule is
 * the proven-correct minimum (cross-helper dep tracking was tried by Mitosis
 * and Vue Reactivity Transform with mixed results — see PITFALLS.md).
 *
 * Refs are stable-identity wrappers — exactly like ExhaustiveDeps's
 * `isStableKnownHookValue` recognizes `useRef` / `setState` setters. When we
 * encounter a `$refs.foo` MemberExpression, we skip it (refs are stable and
 * never appear in dep sets — this is the key property that prevents stale-
 * closure bugs in the React target's useEffect dep arrays).
 *
 * Per D-08 collected-not-thrown: NEVER throws. `null`/`undefined` input
 * silently returns `[]`; malformed AST nodes pass through harmlessly.
 *
 * Path narrowing per Pitfall 1: `$props.items.length` → `[{scope:'props',
 * path:['items']}]` (NOT `['items', 'length']`). The shallowest MemberExpression
 * in a chain anchors the path; deeper accesses are not recorded separately.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { BindingsTable } from '../semantic/types.js';
import type { SignalRef } from './signalRef.js';
import { detectMagicAccess } from '../semantic/visitors.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as semantic/collectors/collectScriptDecls.ts.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** Magic accessor identifiers — handled in MemberExpression visitor, not Identifier. */
const MAGIC_ACCESSOR_NAMES = new Set(['$props', '$data', '$refs', '$slots']);

/**
 * Stable identifiers that match ExhaustiveDeps's `isStableKnownHookValue` —
 * never appear as deps. `$refs.foo` is handled as a MemberExpression skip;
 * `$emit` and `$el` are handled as Identifier skips.
 */
const STABLE_IDENTIFIERS = new Set(['$emit', '$el']);

/**
 * Compute the set of SignalRef reads inside a single expression.
 *
 * @param expr - the Babel Expression / Node to analyze. May be null/undefined
 *   (returns [] without throwing per D-08).
 * @param bindings - the BindingsTable from Plan 02-01 collectors. Used to
 *   classify identifiers as `computed` vs `closure` vs locally-shadowed.
 * @returns Deduplicated array of SignalRefs in encounter order.
 */
export function computeExpressionDeps(
  expr: t.Node | null | undefined,
  bindings: BindingsTable,
): SignalRef[] {
  if (!expr) return [];

  const deps: SignalRef[] = [];
  // Dedup key: 'closure::ident' or '${scope}::${path.join('.')}' — collapses
  // duplicate reads (e.g., `$props.x + $props.x` → one entry).
  const seen = new Set<string>();

  const push = (ref: SignalRef): void => {
    const key =
      ref.scope === 'closure'
        ? `closure::${ref.identifier}`
        : `${ref.scope}::${ref.path.join('.')}`;
    if (seen.has(key)) return;
    seen.add(key);
    deps.push(ref);
  };

  // @babel/traverse requires a Program-rooted path for `path.scope.getBinding(name)`
  // to work. Wrap the expression in a synthetic File. ExpressionStatement preserves
  // the original Expression node references intact.
  let file: t.File;
  try {
    const exprNode = t.isExpression(expr)
      ? expr
      : // Defensive — if the caller hands us a non-Expression node (e.g., a
        // BlockStatement from a $computed callback body), wrap it appropriately.
        // BlockStatement → wrap as ArrowFunctionExpression body, then walk that.
        t.isBlockStatement(expr)
        ? t.arrowFunctionExpression([], expr)
        : null;
    if (!exprNode) return [];
    file = t.file(t.program([t.expressionStatement(exprNode)]));
  } catch {
    // Defensive — if t.file/program builder rejects the node, return empty.
    return [];
  }

  try {
    traverse(file, {
      MemberExpression(path: NodePath<t.MemberExpression>) {
        // Walk to the SHALLOWEST MemberExpression in the chain — that's the
        // root of the path narrowing per Pitfall 1.
        // For `$props.items.filter(...).length`, the chain is:
        //   $props.items.filter(...).length
        //     - outermost: <chain>.length
        //     - inner:     $props.items.filter(...)  (CallExpression — chain breaks)
        //     - innermost: $props.items   ← THIS is the magic-accessor anchor
        // We descend as long as the .object is itself a MemberExpression.
        let cur: t.Expression = path.node;
        while (t.isMemberExpression(cur) && t.isMemberExpression(cur.object)) {
          cur = cur.object;
        }
        if (!t.isMemberExpression(cur)) return;

        const access = detectMagicAccess(cur);
        if (!access) {
          // Not a magic accessor (plain `someObj.foo`) OR computed access
          // ($props['foo']) — computed access is rejected by unknownRefValidator
          // (ROZ106); skip silently here.
          return;
        }

        // Refs are stable — matches ExhaustiveDeps `isStableKnownHookValue`.
        // Refs are stable-identity wrappers (D-21); they never appear in dep sets.
        if (access.scope === 'refs') {
          path.skip();
          return;
        }

        // Skip nested traversal — we've already handled the chain via its root.
        path.skip();
        push({ scope: access.scope, path: [access.member] } as SignalRef);
      },

      Identifier(path: NodePath<t.Identifier>) {
        const name = path.node.name;

        // Skip magic-accessor identifiers themselves — they're matched in
        // the MemberExpression visitor.
        if (MAGIC_ACCESSOR_NAMES.has(name)) return;

        // Skip stable identifiers ($emit, $el) — they behave like refs.
        if (STABLE_IDENTIFIERS.has(name)) return;

        const parent = path.parent;
        const node = path.node;

        // Skip property keys of MemberExpression (e.g., the `foo` in obj.foo).
        if (t.isMemberExpression(parent) && parent.property === node && !parent.computed) {
          return;
        }

        // Skip property keys of ObjectProperty / ObjectMethod (the `key:` part).
        if (
          (t.isObjectProperty(parent) || t.isObjectMethod(parent)) &&
          parent.key === node &&
          !parent.computed
        ) {
          return;
        }

        // Skip identifiers that are BEING DECLARED (var/let/const declarators,
        // function names, function params, catch params, class declarations).
        if (t.isVariableDeclarator(parent) && parent.id === node) return;
        if (t.isFunction(parent) && parent.params.includes(node)) return;
        if (
          (t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent)) &&
          parent.id === node
        ) {
          return;
        }

        // Skip label identifiers (loops, break/continue targets).
        if (t.isLabeledStatement(parent) && parent.label === node) return;

        // Shadowing: does this identifier resolve to a binding inside the
        // expression's own scope? If yes, it's locally declared (`let x =
        // ...; x.foo`); skip — not reactive.
        const binding = path.scope.getBinding(name);
        if (binding) return;

        // Identifier resolves OUTSIDE this expression. Look up classification
        // in BindingsTable.
        if (bindings.computeds.has(name)) {
          push({ scope: 'computed', path: [name] });
          return;
        }

        // Otherwise: closure dep. Could be a top-level helper function in
        // <script>, an external import, a globally-bound name, etc. D-21:
        // record the identifier as a closure dep but DO NOT recurse into the
        // referenced declaration's body.
        push({ scope: 'closure', identifier: name });
      },
    });
  } catch {
    // Defensive (D-08): traversal failure on unusual AST shapes returns whatever
    // deps we accumulated so far. Should be unreachable for any AST that came
    // from @babel/parser, but the catch prevents adversarial inputs from
    // bringing down the compiler.
  }

  return deps;
}
