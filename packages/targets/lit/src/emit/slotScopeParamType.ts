/**
 * slotScopeParamType — shared Lit scope-param type synthesis (quick 260717-uvm;
 * unified onto the shared cross-target policy by Phase 79 Plan 12, D-13).
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
 * can never drift from one another. Per param, the synthesized type comes
 * from core's shared `lowerSlotParamType` (Phase 79 Plan 12, D-13) — the SAME
 * function-vs-`any` policy every one of the other five targets converged on:
 * a declared function-typed param lowers to the variadic-any function-type
 * shape (`(...args: any[]) => any`); everything else, including an ABSENT
 * `paramTypes` entry, is the `any` floor.
 *
 * Quick 260717-uvm originally serialized ANY declared `TSType` verbatim via
 * `@babel/generator` — broader than the cross-target policy, and precisely
 * the fork D-13 (the folded `popover-lit` slot-scope type decision) asks to
 * close: "neither `unknown` nor `any` [alone] but the real paramTypes,
 * using the SAME plumbing R6 needs for the family type surface." Since
 * `SlotDecl.paramTypes` is `undefined` for every slot the current
 * `<script>`-only lowering pipeline produces (the field is reserved for
 * future `<script lang="ts">` support), this unification is byte-identical
 * for every REAL fixture today — the bespoke-vs-shared distinction is only
 * observable for a hand-constructed non-function `TSType`, which no
 * production lowerer emits yet.
 *
 * The render-callback RETURN type (`=> unknown`) on the property/function-prop
 * declarations is UNCHANGED by this helper — only the scope PARAMETER types
 * are affected.
 *
 * @experimental — shape may change before v1.0
 */
import type { TSType } from '@babel/types';
import type { ParamDecl, SlotDecl } from '@rozie/core';
import { escapeSingleQuotedKey } from '../../../../core/src/codegen/escapeSingleQuotedKey.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';
import { lowerSlotParamType } from '../../../../core/src/codegen/slotParamTypeLowering.js';

/**
 * Synthesize the TS type token for ONE scope param — delegates to the
 * shared `lowerSlotParamType` (D-13) so Lit agrees with the other five
 * targets: a declared function type lowers to variadic-any; an absent or
 * any other `paramTypes` entry falls to the `any` floor (never `unknown`).
 */
export function slotScopeParamType(paramTypes: TSType[] | undefined, index: number): string {
  return lowerSlotParamType(paramTypes?.[index]);
}

/**
 * Synthesize the full `{ p1: T1; p2: T2; ... }` scope-type object literal for
 * a slot's params array, keyed by each param's producer slot key (`p.name`)
 * — NOT the consumer-local `bindAs` rename — matching the pre-existing
 * `unknown`-based formatting (`; `-joined, single space inside braces) so
 * non-scope emit stays byte-identical.
 */
export function slotScopeTypeObject(params: ParamDecl[], paramTypes: TSType[] | undefined): string {
  return `{ ${params
    .map((p, i) => `${p.name}: ${slotScopeParamType(paramTypes, i)}`)
    .join('; ')} }`;
}

/**
 * Build the TS type text for the `rozieSlots?:` record property (Phase 79
 * Plan 12, R6). A component with no dynamic-name slot returns the EXACT
 * pre-Plan-12 generic `Record<string, (scope: any) => unknown>` text — byte-
 * identical. A component with at least one PREFIXED dynamic-name family gets
 * one template-literal-keyed member per distinct `namePrefix`, naming every
 * family param via the shared `lowerSlotParamType` (D-13); the generic
 * `Record<...>` catch-all is ALWAYS retained alongside it — both for R6's
 * "no static prefix degrades to a plain string index signature" case and
 * because every `rozieSlots?.[<expr>]` runtime access indexes with a
 * non-literal `string`-typed expression, which only the generic catch-all
 * satisfies (mirrors React's `refineSlotTypes.ts#buildSlotsRecordType`
 * rationale exactly).
 */
/** Escape a single-quoted string-literal key body (T-79-07 — mirrors every per-target copy). */
export function buildRozieSlotsRecordType(slots: SlotDecl[]): string {
  const GENERIC = 'Record<string, (scope: any) => unknown>';
  const dynamicSlots = slots.filter((s) => s.dynamicNameExpr !== undefined);
  if (dynamicSlots.length === 0) return GENERIC;
  const members: string[] = [];
  const seenKeys = new Set<string>();
  // Phase 79 Plan 12 Task 3 escape (R6) — a STATIC record-only name that
  // textually matches a coexisting family's template-literal pattern is NOT
  // itself a family member, but without a dedicated NAMED entry TypeScript
  // resolves it against the family's index signature instead. Mirrors
  // React's `refineSlotTypes.ts#buildSlotsRecordType` identical fix.
  for (const s of slots) {
    if (s.dynamicNameExpr !== undefined) continue;
    if (s.name === '' || isSlotNameIdentifier(s.name)) continue;
    const scopeType = slotScopeTypeObject(s.params, s.paramTypes);
    members.push(`'${escapeSingleQuotedKey(s.name)}'?: (scope: ${scopeType}) => unknown;`);
  }
  for (const s of dynamicSlots) {
    if (s.namePrefix === undefined || s.namePrefix.length === 0) continue;
    const key = `\`${s.namePrefix}\${string}\``;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const scopeType = slotScopeTypeObject(s.params, s.paramTypes);
    members.push(`[key: ${key}]: (scope: ${scopeType}) => unknown;`);
  }
  if (members.length === 0) return GENERIC;
  return `{ ${members.join(' ')} } & ${GENERIC}`;
}
