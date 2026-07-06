/**
 * Spike-012 — classify a prop `default:` expression as a mutable-literal FACTORY.
 *
 * Rozie's factory-default convention (mirroring Vue 3's `withDefaults`) invokes an
 * arrow whose body is an array/object LITERAL so each instance gets a fresh copy
 * of a mutable default: `default: () => []` → `(() => [])()` → a new `[]` per
 * mount. Only these are factories.
 *
 * An arrow whose body is NOT an array/object literal is a plain function VALUE,
 * NOT a factory — most importantly `type: Function, default: () => {}` (an empty
 * BLOCK body = a noop function), whose intended default IS the noop function.
 * Invoking it would pass the `void` result as the prop → `void | ((…)=>any)`
 * (TS2322/TS2345 on React/Solid, an untyped `void` default on Svelte). Vue,
 * Angular, and Lit already treat such an arrow as a value; this predicate lets
 * the bare-ident targets (React/Solid/Svelte) agree.
 *
 * Function EXPRESSIONS (`function () { … }`) are likewise never factories here —
 * only the array/object-literal-body arrow is. Kept as a single shared predicate
 * so every target's default lowering classifies identically.
 */
import * as t from '@babel/types';

export function isMutableLiteralFactoryDefault(
  defaultValue: t.Expression | null | undefined,
): boolean {
  return (
    defaultValue != null &&
    t.isArrowFunctionExpression(defaultValue) &&
    (t.isArrayExpression(defaultValue.body) || t.isObjectExpression(defaultValue.body))
  );
}
