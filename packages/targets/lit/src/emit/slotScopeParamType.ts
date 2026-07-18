/**
 * slotScopeParamType — shared Lit scope-param type synthesis (quick 260717-uvm).
 *
 * Lit was the only target whose scoped-slot scope params threaded as
 * `unknown` at three sites: the producer-side `interface Rozie<X>SlotCtx`
 * fields (emitSlotDecl.ts), the producer-side `@property ... (scope: {...})`
 * type (emitSlotDecl.ts), and the consumer-side function-prop `(scope: {...})`
 * type (emitSlotFiller.ts). `unknown` (unlike React's `any`) forbids property
 * access without narrowing, forcing consumer authors into `any`-typed shim
 * helpers purely to dodge the Lit-only `unknown`.
 *
 * This module is the SINGLE source of truth all three sites consume so they
 * can never drift from one another. Per param, the synthesized type is:
 *
 *   - the serialized `TSType` (via `@babel/generator`) when the IR's
 *     `paramTypes[index]` entry is present (future `<script lang="ts">`
 *     support — the IR already threads `SlotDecl.paramTypes` /
 *     `SlotFillerDecl.paramTypes` producer→consumer via core's
 *     `threadParamTypes`), else
 *   - the literal `any`, mirroring React's `refineSlotTypes` fallback (never
 *     `unknown`).
 *
 * This mirrors the exact serialization pattern used by
 * `buildManifest.serializeSlotParamTypes` (`generate(t).code` per TSType
 * entry, `undefined` paramTypes ⇒ untyped fallback).
 *
 * The render-callback RETURN type (`=> unknown`) on the property/function-prop
 * declarations is UNCHANGED by this helper — only the scope PARAMETER types
 * are affected.
 *
 * @experimental — shape may change before v1.0
 */
import type { TSType } from '@babel/types';
import type { ParamDecl } from '../../../../core/src/ir/types.js';
import _generate from '@babel/generator';

// @babel/generator ships CJS default-export; unwrap for ESM consumers.
// Mirrors the same interop shim used by emitScript.ts / buildManifest.ts.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

/**
 * Synthesize the TS type token for ONE scope param.
 *
 * `paramTypes?.[index]` is the serialized-TSType source (threaded from the
 * producer's `SlotDecl.paramTypes` when the IR carries a real TS annotation);
 * when absent, falls back to `any` — mirroring React's `refineSlotTypes`,
 * which types every slot-scope param `any`, never `unknown`.
 */
export function slotScopeParamType(
  paramTypes: TSType[] | undefined,
  index: number,
): string {
  const tsType = paramTypes?.[index];
  if (tsType === undefined) return 'any';
  return generate(tsType).code;
}

/**
 * Synthesize the full `{ p1: T1; p2: T2; ... }` scope-type object literal for
 * a slot's params array, keyed by each param's producer slot key (`p.name`)
 * — NOT the consumer-local `bindAs` rename — matching the pre-existing
 * `unknown`-based formatting (`; `-joined, single space inside braces) so
 * non-scope emit stays byte-identical.
 */
export function slotScopeTypeObject(
  params: ParamDecl[],
  paramTypes: TSType[] | undefined,
): string {
  return `{ ${params
    .map((p, i) => `${p.name}: ${slotScopeParamType(paramTypes, i)}`)
    .join('; ')} }`;
}
