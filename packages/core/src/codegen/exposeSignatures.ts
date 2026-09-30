/**
 * exposeSignatures — typed public surface P1 (spec §4.2).
 *
 * AST builders that turn an `$expose` compile-time signature
 * (`ExposedMethod.signature`, a `TSFunctionType`) into the declaration shape
 * each target places next to the (possibly untyped JS) verb implementation:
 *
 *   - `exposeSignatureOverload`       ⇒ `function name(<params>): <ret>;`
 *     (Svelte — an overload above the implementation)
 *   - `exposeSignatureMethodOverload` ⇒ `name(<params>): <ret>;` class member
 *     (Lit — a method overload above the implementation)
 *   - `exposeSignatureAnnotation`     ⇒ `: (<params>) => <ret>`
 *     (Angular fields and Svelte `const` verbs)
 *
 * Every node is CLONED from the signature, so callers may place the result in
 * any number of emitted trees without aliasing the IR.
 *
 * @experimental — added in typed-surface P1
 */
import * as t from '@babel/types';

type SigParam = t.TSFunctionType['parameters'][number];

function cloneParams(sig: t.TSFunctionType): SigParam[] {
  return sig.parameters.map((p) => t.cloneNode(p, true));
}

function cloneReturn(sig: t.TSFunctionType): t.TSType {
  const ann = sig.typeAnnotation;
  return ann ? t.cloneNode(ann.typeAnnotation, true) : t.tsVoidKeyword();
}

/** @experimental — added in typed-surface P1 */
export function exposeSignatureOverload(
  name: string,
  sig: t.TSFunctionType,
): t.TSDeclareFunction {
  return t.tsDeclareFunction(
    t.identifier(name),
    null,
    cloneParams(sig),
    t.tsTypeAnnotation(cloneReturn(sig)),
  );
}

/** @experimental — added in typed-surface P1 */
export function exposeSignatureMethodOverload(
  name: string,
  sig: t.TSFunctionType,
): t.TSDeclareMethod {
  return t.tsDeclareMethod(
    null,
    t.identifier(name),
    null,
    cloneParams(sig),
    t.tsTypeAnnotation(cloneReturn(sig)),
  );
}

/** @experimental — added in typed-surface P1 */
export function exposeSignatureAnnotation(sig: t.TSFunctionType): t.TSTypeAnnotation {
  return t.tsTypeAnnotation(t.cloneNode(sig, true));
}
