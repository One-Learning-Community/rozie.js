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
 * Fix: for every `this` whose nearest NON-ARROW function ancestor is nested (has
 * its own function parent), redirect it to a stable alias `const __rozieSelf =
 * this;` declared in the OUTERMOST enclosing function (the promoted method /
 * class-field arrow, where `this` IS the component). Authors never write a bare
 * `this` in a `.rozie` `<script>` (there is no `this` in the authoring model), so
 * every `this` in the rewritten output is emitter-injected and safe to redirect.
 *
 * Byte-identity: only components that actually place a state read inside a nested
 * plain function are touched; every other emit is unchanged.
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

export function redirectNestedThis(ast: t.File): void {
  const outerNeedsAlias = new Set<t.Function>();

  traverse(ast, {
    ThisExpression(path: NodePath<t.ThisExpression>) {
      // The value of `this` is set by the nearest NON-ARROW function ancestor;
      // arrows inherit lexical `this`, so skip past them.
      let na: NodePath | null = path.getFunctionParent();
      while (na && na.isArrowFunctionExpression()) {
        na = na.getFunctionParent();
      }
      // No non-arrow ancestor (only top-level arrow fields up the chain) → this
      // is the component. A top-level non-arrow function → promoted method →
      // this is the component. Either way, leave it.
      if (!na || !na.getFunctionParent()) return;

      // `na` is a NESTED non-arrow function → this `this` is broken. Find the
      // outermost enclosing function (the promoted method / class-field arrow,
      // where `this` is the component) to host the alias.
      let outer: NodePath = na;
      for (let p = outer.getFunctionParent(); p; p = p.getFunctionParent()) {
        outer = p;
      }
      outerNeedsAlias.add(outer.node as t.Function);
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
}
