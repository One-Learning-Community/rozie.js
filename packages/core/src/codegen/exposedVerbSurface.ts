/**
 * exposedVerbSurface — the ONE rule for how an `$expose`d verb is typed on the
 * consumer surface (typed public surface P1, final wave I1).
 *
 * Every target reads it: React/Vue/Solid render it into the `<Name>Handle`
 * interface (`synthesizeHandleType`); Svelte/Angular/Lit, whose handle IS the
 * component instance, decide from it whether the verb's declaration needs an
 * overload/annotation. The rule, in priority order:
 *
 *   1. an `$expose` compile-time signature → that signature;
 *   2. an author-typed implementation in `<script lang="ts">` — a return-type
 *      annotation on the function (`function add(by: number): string`), or a
 *      type annotation on the verb's `const` declarator
 *      (`const add: AddFn = (by) => …`) → the author's own types;
 *   3. otherwise the verb is untyped: `(...args: any[]) => any`.
 *
 * @experimental — added in typed-surface P1
 */
import * as t from '@babel/types';
import type { ExposedMethod, IRComponent } from '../ir/types.js';
import { collectExposedFunctionsByName, type FnLike } from './collectExposedFunctions.js';

/** @experimental — added in typed-surface P1 */
export type ExposedVerbTyping =
  | { kind: 'signature'; signature: t.TSFunctionType }
  | { kind: 'author-fn'; fn: FnLike }
  | { kind: 'author-declarator'; annotation: t.TSType }
  | { kind: 'untyped' };

/**
 * AST form of the untyped-verb handle shape `(...args: any[]) => any`.
 *
 * @experimental — added in typed-surface P1
 */
export function untypedExposeSignature(): t.TSFunctionType {
  const rest = t.restElement(t.identifier('args'));
  rest.typeAnnotation = t.tsTypeAnnotation(t.tsArrayType(t.tsAnyKeyword()));
  return t.tsFunctionType(null, [rest], t.tsTypeAnnotation(t.tsAnyKeyword()));
}

/** Top-level `const name: T = <fn>` declarator annotations, by verb name. */
function declaratorAnnotations(ir: IRComponent): Map<string, t.TSType> {
  const out = new Map<string, t.TSType>();
  for (const stmt of ir.setupBody.scriptProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id) || !t.isTSTypeAnnotation(d.id.typeAnnotation)) continue;
      if (!(t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))) continue;
      out.set(d.id.name, d.id.typeAnnotation.typeAnnotation);
    }
  }
  return out;
}

/**
 * How each exposed verb is typed (see the module doc for the rule), keyed by
 * verb name in `ir.expose` order.
 *
 * @experimental — added in typed-surface P1
 */
export function exposedVerbTypings(ir: IRComponent): Map<string, ExposedVerbTyping> {
  const out = new Map<string, ExposedVerbTyping>();
  if (ir.expose.length > 0) {
    const fns = collectExposedFunctionsByName(ir);
    const decls = declaratorAnnotations(ir);
    for (const method of ir.expose) out.set(method.name, typingOf(method, fns.get(method.name), decls.get(method.name)));
  }
  return out;
}

function typingOf(method: ExposedMethod, fn: FnLike | undefined, declared: t.TSType | undefined): ExposedVerbTyping {
  if (method.signature !== undefined) return { kind: 'signature', signature: method.signature };
  if (declared !== undefined) return { kind: 'author-declarator', annotation: declared };
  if (fn && fn.returnType != null && t.isTSTypeAnnotation(fn.returnType)) return { kind: 'author-fn', fn };
  return { kind: 'untyped' };
}

/**
 * The function type a target must place on an exposed verb's declaration
 * (Svelte overload / `const` annotation, Angular field annotation, Lit method
 * overload / field annotation), or `undefined` when the declaration must stay
 * as authored:
 *   - a signature → the signature;
 *   - an author-typed implementation → `undefined` (its own types are the
 *     surface; never overloaded, never re-annotated);
 *   - an untyped verb → `(...args: any[]) => any` in a component that declares
 *     at least one `$expose` signature, `undefined` otherwise (components that
 *     don't opt in compile exactly as before).
 *
 * @experimental — added in typed-surface P1
 */
export function exposedVerbSurface(ir: IRComponent, name: string): t.TSFunctionType | undefined {
  const typing = exposedVerbTypings(ir).get(name);
  if (typing === undefined) return undefined;
  if (typing.kind === 'signature') return typing.signature;
  if (typing.kind !== 'untyped') return undefined;
  return ir.expose.some((e) => e.signature !== undefined) ? untypedExposeSignature() : undefined;
}
