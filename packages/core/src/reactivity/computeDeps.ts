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

/**
 * Magic accessor identifiers — handled in MemberExpression visitor, not Identifier.
 *
 * Includes `$portals` (Spike 003 portal-slot primitive). $portals.<name>
 * resolves to a per-target synthesized closure that lives inside the
 * mount-phase lifecycle hook — its identity is stable per-mount, not a
 * reactive dependency. Adding `$portals` here keeps it out of useEffect dep
 * arrays (without this, React's dep collector treats it as a free identifier
 * and emits a literal `$portals` token that doesn't resolve at runtime).
 */
const MAGIC_ACCESSOR_NAMES = new Set(['$props', '$data', '$refs', '$slots', '$portals']);

/**
 * Stable identifiers that match ExhaustiveDeps's `isStableKnownHookValue` —
 * never appear as deps. `$refs.foo` is handled as a MemberExpression skip;
 * `$emit` and `$el` are handled as Identifier skips.
 *
 * Also includes the JS-literal-shaped globals (`undefined`, `null`, `NaN`,
 * `Infinity`) — Babel parses these as Identifier nodes but they're value
 * literals, not bindings to track. Without this exclusion a user-written
 * `return undefined` inside `$onMount` lifts `undefined` into the React
 * useEffect cleanup wrapper and dep array → runtime `(void 0)()` TypeError.
 */
const STABLE_IDENTIFIERS = new Set([
  '$emit',
  '$el',
  // `$snapshot` is a target-rewritten passthrough (`$snapshot(x)` lowers to
  // `$state.snapshot(x)` on Svelte, `x` on the other five targets). It's not
  // itself a reactive binding — the dep tracking happens on the argument.
  '$snapshot',
  'undefined',
  'null',
  'NaN',
  'Infinity',
]);

/**
 * OQ-1 (Phase 9) — TS type-reference tolerance.
 *
 * A `<script lang="ts">` Program carries `TS*` Babel nodes. `@babel/traverse`
 * descends into `TS*` subtrees by default, so a type reference like
 * `let x: SomeType` parses `SomeType` as an `Identifier` nested inside a
 * `TSTypeReference`. Without a guard the `Identifier` visitor below would push
 * `SomeType` as a spurious `closure` dep — and the React target would emit
 * `[SomeType]` into a `useEffect` / `useMemo` dep array → a runtime
 * `ReferenceError` for a name that only ever existed at type level.
 *
 * `isInTypePosition` walks an Identifier's ancestor chain and returns true when
 * the identifier sits inside a TypeScript TYPE construct — a type annotation, a
 * type reference, an interface/alias declaration, a qualified type name, or the
 * type child of an `as` / angle-bracket assertion. The guard is deliberately
 * NARROW: it keys on type-position ancestry, not on "any ancestor is a TS node".
 * An `as`/assertion EXPRESSION still contributes the wrapped runtime
 * expression's deps — only the type child is in type position, and only that
 * child is skipped.
 */
function isInTypePosition(path: NodePath<t.Identifier>): boolean {
  let current: NodePath | null = path;
  let child: t.Node = path.node;
  while (current) {
    const node: t.Node = current.node;
    // Any TSType node (TSTypeReference, TSAnyKeyword, TSUnionType, …) — the
    // whole subtree is type-level. `t.isTSType` is the Babel alias covering
    // every type-expression node kind.
    if (t.isTSType(node)) return true;
    // A TS type annotation (`: SomeType`) — its `typeAnnotation` child is the
    // type. The annotation node itself is not a TSType, so check it explicitly.
    if (t.isTSTypeAnnotation(node)) return true;
    // Statement-position type declarations: `interface Foo {}` / `type Bar`.
    // Their entire body is type-level (the alias `id` IS runtime-shaped but is
    // a declaration name, not a free reference — never a dep regardless).
    if (
      t.isTSInterfaceDeclaration(node) ||
      t.isTSTypeAliasDeclaration(node) ||
      t.isTSInterfaceBody(node)
    ) {
      return true;
    }
    // Qualified type names (`A.B` inside a type) — the dotted segments are
    // Identifiers but live entirely at type level.
    if (t.isTSQualifiedName(node)) return true;
    // `expr as T` / `<T>expr`: only the TYPE child is type position. The
    // wrapped runtime expression must still be walked for its deps, so do NOT
    // treat the assertion node itself as type position — only short-circuit
    // when we arrived here via the `typeAnnotation` child.
    if (
      (t.isTSAsExpression(node) || t.isTSTypeAssertion(node)) &&
      (node.typeAnnotation as t.Node) === child
    ) {
      return true;
    }
    child = node;
    current = current.parentPath;
  }
  return false;
}

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

        // Skip the LHS of a plain `=` assignment when the magic accessor IS
        // the assignment target — `$data.x = expr` is a WRITE not a read, and
        // the rewriter lowers it to a target-native setter call (`setX(expr)`
        // on React; direct signal write elsewhere). Recording it as a dep here
        // pollutes the React useEffect dep array for $onMount bodies — every
        // state write inside the mount hook would push its own state var into
        // the deps, causing the effect to re-fire on its own writes (infinite
        // loop).
        //
        // Only the chain-depth-1 case is a pure write: `$data.events = arr`.
        // Deeper writes like `$data.events.foo = bar` still READ `$data.events`
        // to dereference the path, so we keep those as deps. Compound (`+=`)
        // and UpdateExpressions (`x++`) also read the LHS — left alone.
        if (
          path.node === cur &&
          t.isAssignmentExpression(path.parent) &&
          path.parent.operator === '=' &&
          path.parent.left === path.node
        ) {
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

        // OQ-1 (Phase 9) — skip identifiers that sit in TypeScript type
        // position (a type reference, type annotation, interface/alias body,
        // qualified type name, or the type child of an `as`/`<T>` assertion).
        // A `<script lang="ts">` Program carries `TS*` nodes; without this
        // guard a type reference like `SomeType` in `let x: SomeType` would be
        // misclassified as a runtime `closure` dep. The guard is narrow — a
        // genuine runtime identifier (`makeIt`, `$data.count`) is never in type
        // position and is still collected.
        if (isInTypePosition(path)) return;

        const parent = path.parent;
        const node = path.node;

        // Skip property keys of MemberExpression / OptionalMemberExpression
        // (e.g., the `foo` in `obj.foo` and the `focus` in `ref?.focus`).
        // OptionalMemberExpression must be handled here too — `inputEl.current?.focus`
        // would otherwise classify `focus` as a closure dep, polluting the
        // useEffect dep array (Plan 04-02 SearchInput / Modal regression).
        if (
          (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
          parent.property === node &&
          !parent.computed
        ) {
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
