/**
 * redirectNestedThis — nested-`this` repair for the class-emitter targets.
 *
 * The Lit + Angular class emitters lower component-state reads (`$props.X`,
 * `$data.X`, `$refs.X`, and promoted bare names) to `this.<…>` expressions. That
 * is correct inside a class method or an arrow (which inherits lexical `this`),
 * but WRONG inside a nested plain `function`: a plain function rebinds `this`, so
 * when the author writes
 *
 *   function selected() {
 *     function inner() { return typeof $props.value === 'string' ? $props.value : '' }
 *     return inner()
 *   }
 *
 * the emitted `inner` body reads `this.value` where `this` is the call-site `this`
 * (`undefined` in an ESM-strict module) — a runtime `TypeError`, not the
 * component. React/Vue/Svelte/Solid are immune (closure / accessor lowering, no
 * `this`). Spike-012 BUG-2.
 *
 * Fix: for every `this` whose nearest NON-ARROW function ancestor is not a
 * component-`this` context, redirect it to a stable alias `const __rozieSelf =
 * this;` declared in the OUTERMOST enclosing function (the promoted method /
 * class-field arrow, where `this` IS the component). Authors never write a bare
 * `this` in a `.rozie` `<script>` (there is no `this` in the authoring model), so
 * every `this` in the rewritten output is emitter-injected and safe to redirect.
 *
 * A function is NOT a component-`this` context when it is either (a) nested — it
 * has its own function parent — or (b) a MEMBER OF AN OBJECT LITERAL, where
 * `this` is the object. Case (b) was missed until quick task 260830-cfi: a
 * top-level `const api = { load() { … } }` becomes a class FIELD, so `api`'s
 * members have no function parent and read as top-level promoted methods. When
 * such a member has no enclosing function at all, the alias is hosted in an arrow
 * IIFE wrapped around the field-initializer object — a field initializer's `this`
 * is the instance, and an arrow inherits it.
 *
 * `$provide(...)` payloads are EXCLUDED — `emitContext.bindProvidedValue` owns
 * that seam with its own `__rozieCtxHost` capture. See `isInsideProvidePayload`.
 *
 * Byte-identity: only components that actually place a state read inside a nested
 * plain function or a non-arrow object member are touched; every other emit is
 * unchanged.
 *
 * NOTE: mirrored byte-identical (in logic) into the Angular target's rewrite/
 * directory, matching the scopeAwareSkip.ts convention.
 *
 * @experimental — shape may change before v1.0
 */
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const ALIAS = '__rozieSelf';

/**
 * Is `p` a non-arrow function that is a MEMBER of an object literal — an
 * `ObjectMethod` (incl. `get`/`set`) or a `FunctionExpression` used as an
 * `ObjectProperty` value?
 *
 * Such a function's `this` is the OBJECT, never the component. That matters at
 * the top level specifically: a top-level `const api = { ... }` is promoted to a
 * class FIELD, so `api`'s members have no function parent and would otherwise
 * read as "top-level non-arrow function → promoted method → `this` is the
 * component" — which they are not (quick task 260830-cfi).
 */
function isObjectMemberFunction(p: NodePath): boolean {
  if (p.isObjectMethod()) return true;
  return (
    p.isFunctionExpression() &&
    !!p.parentPath?.isObjectProperty() &&
    (p.parentPath.node as t.ObjectProperty).value === p.node
  );
}

/**
 * Is this `this` inside a `$provide(...)` payload?
 *
 * `emitContext.bindProvidedValue` ALREADY owns exactly this problem for provided
 * values: it wraps the payload in a host-capturing IIFE and rewrites every
 * `ThisExpression` to a `__rozieCtxHost` parameter — precisely so a getter/method
 * on the payload object reads the component and not the object literal. It also
 * keys its reactivity bridge (the `effect(...)` that re-publishes the context on
 * change) on finding those `ThisExpression`s.
 *
 * So this pass must leave `$provide` payloads alone. Redirecting them first
 * consumes the `this` that `bindProvidedValue` looks for, which silently drops
 * the reactive bridge — caught by `emit-context.test.ts` (quick task 260830-cfi).
 */
function isInsideProvidePayload(path: NodePath): boolean {
  let cur: NodePath | null = path;
  while (cur) {
    const parent: NodePath | null = cur.parentPath;
    if (
      parent?.isCallExpression() &&
      t.isIdentifier(parent.node.callee, { name: '$provide' }) &&
      parent.node.arguments.some((a) => a === cur?.node)
    ) {
      return true;
    }
    cur = parent;
  }
  return false;
}

/**
 * The outermost `ObjectExpression` enclosing `memberFn` without crossing a
 * function boundary — i.e. the class-field initializer object that must carry
 * the alias. Returns null if there is none (defensive; the caller leaves the
 * `this` untouched rather than emitting a broken host).
 */
function outermostObjectExpression(memberFn: NodePath): NodePath<t.ObjectExpression> | null {
  let found: NodePath<t.ObjectExpression> | null = null;
  let p: NodePath | null = memberFn.parentPath;
  while (p) {
    if (p.isFunction()) break;
    if (p.isObjectExpression()) found = p;
    p = p.parentPath;
  }
  return found;
}

export function redirectNestedThis(ast: t.File): void {
  const outerNeedsAlias = new Set<t.Function>();
  const objectsNeedingAlias = new Set<NodePath<t.ObjectExpression>>();

  traverse(ast, {
    ThisExpression(path: NodePath<t.ThisExpression>) {
      // The value of `this` is set by the nearest NON-ARROW function ancestor;
      // arrows inherit lexical `this`, so skip past them.
      let na: NodePath | null = path.getFunctionParent();
      while (na && na.isArrowFunctionExpression()) {
        na = na.getFunctionParent();
      }
      // No non-arrow ancestor (only top-level arrow fields up the chain) → this
      // is the component. Leave it.
      if (!na) return;
      // A top-level non-arrow function is a promoted method → `this` is the
      // component — UNLESS it is an object-literal member, whose `this` is the
      // object. Anything nested is broken regardless.
      if (!na.getFunctionParent() && !isObjectMemberFunction(na)) return;
      // `$provide` payloads have their own host-capture owner — see above.
      if (isObjectMemberFunction(na) && isInsideProvidePayload(path)) return;

      // This `this` is broken. Find the outermost enclosing function — the
      // promoted method / class-field arrow, where `this` IS the component.
      let outer: NodePath = na;
      for (let p = outer.getFunctionParent(); p; p = p.getFunctionParent()) {
        outer = p;
      }

      if (isObjectMemberFunction(outer)) {
        // No enclosing component-`this` FUNCTION exists: the object literal sits
        // directly in a class-field initializer. A field initializer's `this` IS
        // the instance and an arrow inherits it, so host the alias in an arrow
        // IIFE wrapped around that initializer object.
        const obj = outermostObjectExpression(outer);
        if (!obj) return;
        objectsNeedingAlias.add(obj);
      } else {
        outerNeedsAlias.add(outer.node as t.Function);
      }
      path.replaceWith(t.identifier(ALIAS));
      path.skip();
    },
  });

  for (const fn of outerNeedsAlias) {
    const decl = t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(ALIAS), t.thisExpression()),
    ]);
    if (t.isBlockStatement(fn.body)) {
      fn.body.body.unshift(decl);
    } else {
      // Concise arrow body → wrap into a block that returns the original expr.
      fn.body = t.blockStatement([decl, t.returnStatement(fn.body)]);
    }
  }

  // `obj` → `(() => { const __rozieSelf = this; return obj; })()`. Runs after the
  // traversal so no visitor re-enters the freshly built IIFE. Arrow members of the
  // same object keep a plain `this` — still the instance, since the wrapping arrow
  // inherits the field initializer's `this`.
  for (const objPath of objectsNeedingAlias) {
    const objNode = objPath.node;
    objPath.replaceWith(
      t.callExpression(
        t.arrowFunctionExpression(
          [],
          t.blockStatement([
            t.variableDeclaration('const', [
              t.variableDeclarator(t.identifier(ALIAS), t.thisExpression()),
            ]),
            t.returnStatement(objNode),
          ]),
        ),
        [],
      ),
    );
  }
}
