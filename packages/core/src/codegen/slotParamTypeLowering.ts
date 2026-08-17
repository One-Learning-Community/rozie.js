/**
 * slotParamTypeLowering — Phase 79 Plan 12 (R6 + D-13).
 *
 * The phase's SINGLE source of truth for lowering a `SlotDecl.paramTypes`
 * entry (a Babel `TSType` node, reserved for future `<script lang="ts">`
 * support — see `ir/types.ts`'s `SlotDecl.paramTypes` doc comment) to its TS
 * surface string. Every one of the six per-target slot-scope-member type
 * builders (Vue/React/Solid/Svelte/Angular/Lit) imports THIS function rather
 * than reimplementing the same two-branch decision — a second copy anywhere
 * is a defect, mirroring `slotNameIdentifier.ts`'s "one predicate, every
 * consumer imports it" precedent from 79-03.
 *
 * D-13 (folded from `todos/popover-lit-slot-scope-type-decision.md`) asked
 * whether a Lit slot-scope member should be `unknown` or `any`. The answer is
 * neither: lower the REAL `paramTypes` when present, and keep `any` — never
 * `unknown` — as the floor for a genuinely un-inferable binding. `any` is
 * this project's established floor for "no usable type information" (see
 * `renderPropsInterface.ts`'s D-86 `inferParamType` and its `Function`/
 * `'function'` cases in `renderPropType`) — `unknown` would force every
 * consumer to narrow before use, which is the wrong default for a best-effort
 * inference floor.
 *
 * `SlotDecl.paramTypes` is `undefined` for every slot produced by the current
 * `<script>`-only lowering pipeline (the field is reserved, not yet
 * populated by any lowerer) — so in every REAL fixture today, every call
 * here returns the `any` floor, and the six targets' emitted output is
 * byte-identical to pre-Plan-12. The behavior this module adds is exercised
 * by hand-constructing a `SlotDecl.paramTypes` array in a unit test (the same
 * technique `renderPropsInterface.test.ts` uses for slot fixtures), proving
 * the lowering is CORRECT and ready the moment a future lowerer populates the
 * field — not dead code, a forward-compatible seam.
 */
import * as t from '@babel/types';
import type { TSType } from '@babel/types';
import type { ParamDecl } from '../ir/types.js';

/**
 * Lower a single `paramTypes` entry to its TS surface string.
 *
 *   - `undefined` (no usable type information) — the floor, `'any'`.
 *   - A declared function type (`TSFunctionType`, e.g. `(x: number) => void`
 *     authored in a future `<script lang="ts">` slot-param annotation) —
 *     `'(...args: any[]) => any'`, the SAME variadic-any function-type shape
 *     this project already converged on for function-valued props
 *     (`renderPropsInterface.ts`'s `renderPropType`'s `Function`/`'function'`
 *     cases; `project_function_prop_type_lowering_gap`, CLOSED).
 *   - Any other declared `TSType` shape — also the `'any'` floor for now;
 *     widening to lower additional shapes (string/number/boolean/etc.) is a
 *     future increment, not required by D-13's function-vs-any/unknown
 *     question.
 */
export function lowerSlotParamType(tsType: TSType | undefined): string {
  if (tsType === undefined) return 'any';
  if (t.isTSFunctionType(tsType)) return '(...args: any[]) => any';
  return 'any';
}

/**
 * Pair each `ParamDecl` with its lowered type, by INDEX — `SlotDecl.params`
 * and `SlotDecl.paramTypes` are parallel arrays (`paramTypes[i]` annotates
 * `params[i]`), never a name-keyed map. A shorter (or absent) `paramTypes`
 * array is legal: every param beyond its length lowers to the `any` floor.
 */
export function buildSlotParamFields(
  params: readonly ParamDecl[],
  paramTypes: readonly TSType[] | undefined,
): { name: string; type: string }[] {
  return params.map((p, i) => ({
    name: p.name,
    type: lowerSlotParamType(paramTypes?.[i]),
  }));
}
