/**
 * refineSlotTypes — Plan 04-03 Task 2 (React target).
 *
 * Phase 4 finalization gate verification + slot-context type synthesis per
 * RESEARCH Pattern 8 lines 758-793.
 *
 * For each SlotDecl in ir.slots, returns:
 *   - propFieldName — 'children' for default; 'render<Pascal>' for named
 *   - propFieldType — 'ReactNode' or '(ctx: TypeName) => ReactNode'
 *   - ctxInterface  — 'interface XCtx { ... }' or null when no params
 *   - defaultLifting — 'inline' | 'function-const' for default-content fallback
 *
 * paramTypes are `any` for v1 (Phase 6 TYPES-01 fills with real TS analysis).
 *
 * REACT-T-04 widened (dropdown-react-default-slot bugfix, 2026-05-15): the
 * default slot with params is now declared as a UNION — ReactNode |
 * ((ctx: ChildrenCtx) => ReactNode) — matching the public `.d.ts` shape
 * already emitted by emitTypes.ts (D-84 / line 163). Rationale: a Rozie
 * <slot :param="..."/> declaration says "the slot definition CAN provide a
 * scoped param to consumers that want one." It does NOT force every consumer
 * to provide a render-prop function. Consumers that pass ordinary JSX
 * children (e.g. `<Dropdown :open="true"><div/>…</Dropdown>` from
 * DropdownDemo.rozie) are legitimate — they simply opt out of the scope. The
 * call site in emitSlotInvocation switches on `typeof children === 'function'`
 * so both shapes work at runtime. Vue/Svelte/Solid handle this natively at
 * their respective runtime layers; React needs the explicit emit-side
 * accommodation.
 *
 * Phase 79 Plan 04 (R12/D-03): a slot name that is NOT a valid JS identifier
 * (e.g. `cell-status`) has no named-prop path at all — `emitSlotDecl.ts` skips
 * minting its `render<Pascal>` field/ctx-interface entirely and
 * `emitSlotInvocation.ts` drops the merge's left operand, routing through the
 * bracket-keyed record alone. `renderRecordKey` (re-exported here from core
 * — see WR-05, 79-REVIEW-FIX) is the escaped record-key text, reused by
 * `emitSlotInvocation.ts` and `emitSlotFiller.ts` so both sides of a
 * non-identifier record entry always agree on the exact key. The identifier
 * SHAPE check itself is `isSlotNameIdentifier`, imported from core — every
 * R12 routing site imports it directly (never redeclares it) so a future
 * edit that forgets the check in one module is grep-detectable.
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';
import { lowerSlotParamType } from '../../../../core/src/codegen/slotParamTypeLowering.js';
import { renderRecordKey } from '../../../../core/src/codegen/escapeSingleQuotedKey.js';

// WR-05 fix (79-REVIEW-FIX): re-export so existing `import { renderRecordKey }
// from './refineSlotTypes.js'` call sites (emitSlotInvocation.ts,
// emitSlotFiller.ts) keep working unchanged. `escapeSingleQuotedKey` and
// `renderRecordKey` now live in core — see that module's doc comment.
export { renderRecordKey };

/**
 * Whether `name` routes through the bracket-keyed record ONLY (D-03). The
 * default slot (`''`) is excluded explicitly — `isSlotNameIdentifier` does
 * not special-case the empty string, and the default slot always keeps its
 * `children` merge path regardless of shape.
 */
export function isRecordOnlySlotName(name: string): boolean {
  return name !== '' && !isSlotNameIdentifier(name);
}

/**
 * Whether `slot` is dynamic-name-only — routed through the bracket-keyed
 * `slots?:` record exclusively, never through a named `render<Name>?:`
 * field/ctx-interface (Phase 79 Plan 12, R6). A dynamic-name slot shares the
 * `''` default-slot sentinel (79-06 Assumption A1), so this check must be
 * consulted BEFORE any `slot.name === ''` branch treats it as the genuine
 * default slot — the exact "record-only check before dedup" ordering
 * Angular's `refineSlotTypes.ts` established in 79-11 for the same hazard.
 */
export function isDynamicOnlySlot(slot: SlotDecl): boolean {
  return slot.dynamicNameExpr !== undefined;
}

/**
 * Build the value type of a family member (R6/AC-10): a zero-param family
 * types its value as a genuine zero-argument function (`() => ${type}`) —
 * NOT a function accepting an empty params object, which is the (unrelated,
 * pre-existing) shape a zero-param NAMED slot keeps via `propFieldType`.
 */
function buildFamilyFnType(slot: SlotDecl, slotChildrenType: string): string {
  if (slot.params.length === 0) return `() => ${slotChildrenType}`;
  const paramFields = slot.params
    .map((p, i) => `${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])}`)
    .join('; ');
  return `(params: { ${paramFields} }) => ${slotChildrenType}`;
}

/**
 * Build the TS type text for the `slots?:` record field (Phase 79 Plan 12,
 * R6). A component with no dynamic-name slot returns the EXACT pre-Plan-12
 * generic `Record<string, () => X>` text — byte-identical (AC — "no-
 * dynamic-slot case").
 *
 * Otherwise the type is an object literal:
 *   - one template-literal-keyed index signature per DISTINCT `namePrefix`
 *     among the component's dynamic-name slots, naming every family param
 *     via the shared `lowerSlotParamType` (D-13) — TypeScript resolves a
 *     LITERAL-keyed access (`slots['cell-status']`) to this narrower
 *     signature over the broad catch-all below (verified: TS4.4+ template-
 *     literal index signatures coexist with a broader `string` index
 *     signature when the narrower value type is assignable to the broader
 *     one — see the catch-all's `(...args: any[]) => X` shape below).
 *   - ALWAYS a trailing broad `[key: string]: ((...args: any[]) => X) |
 *     undefined` catch-all — required both for R6's "no static prefix
 *     degrades to a plain string index signature" case AND because every
 *     dynamic-name record lookup at the invocation site
 *     (`props.slots?.[<runtime expr>]`) indexes with a non-literal `string`-
 *     typed expression, which only a broad string index signature satisfies.
 *     It also remains the catch-all for R12/D-03's pre-existing
 *     non-identifier STATIC record entries, unaffected by this plan.
 */
export function buildSlotsRecordType(slots: SlotDecl[], slotChildrenType: string): string {
  const dynamicSlots = slots.filter((s) => isDynamicOnlySlot(s));
  if (dynamicSlots.length === 0) {
    return `Record<string, () => ${slotChildrenType}>`;
  }
  const members: string[] = [];
  const seenKeys = new Set<string>();
  // Phase 79 Plan 12 Task 3 escape (R6) — a STATIC record-only name (e.g.
  // `cell-total`, R12/D-03) that textually matches a coexisting family's
  // template-literal pattern (e.g. `` `cell-${string}` ``) is NOT itself a
  // member of that family — but without a dedicated NAMED entry for it,
  // TypeScript resolves `slots['cell-total']` against the family's index
  // signature (since 'cell-total' matches the pattern), corrupting AC-10's
  // "exact key wins" coexistence guarantee with the family's WRONG param
  // shape. A named property always wins over an overlapping index signature
  // for a literal-keyed access, so giving every static record-only name its
  // OWN entry (with ITS OWN param shape) here fixes this regardless of
  // whether its text happens to overlap any family's prefix. Discovered
  // compiling the real DynamicSlots consumer-ts fixture under `tsc --strict`.
  for (const s of slots) {
    if (isDynamicOnlySlot(s)) continue;
    if (!isRecordOnlySlotName(s.name)) continue;
    members.push(`${renderRecordKey(s.name)}?: (${buildFamilyFnType(s, slotChildrenType)}) | undefined;`);
  }
  for (const s of dynamicSlots) {
    if (s.namePrefix === undefined || s.namePrefix.length === 0) continue;
    const key = `\`${s.namePrefix}\${string}\``;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    members.push(`[key: ${key}]: (${buildFamilyFnType(s, slotChildrenType)}) | undefined;`);
  }
  members.push(`[key: string]: ((...args: any[]) => ${slotChildrenType}) | undefined;`);
  return `{ ${members.join(' ')} }`;
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function pascalCase(name: string): string {
  // Convert hyphenated/underscored to PascalCase
  const parts = name.split(/[-_]/).filter(Boolean);
  return parts.map((p) => capitalize(p)).join('');
}

export interface RefinedSlotType {
  /** Field name on the props interface (e.g., 'children', 'renderTrigger') */
  propFieldName: string;
  /** TS type string (e.g., 'ReactNode', '(ctx: TriggerCtx) => ReactNode') */
  propFieldType: string;
  /** Optional standalone interface declaration (e.g., 'interface TriggerCtx { ... }') or null */
  ctxInterface: string | null;
  /** Whether default content gets inlined or lifted as a function-const */
  defaultLifting: 'inline' | 'function-const' | 'none';
  /** Name of the lifted default-content function (when defaultLifting === 'function-const') */
  defaultFnName: string | null;
}

/**
 * Decide how to lift the slot's default content.
 *   - No defaultContent → 'none'
 *   - Has params → 'function-const' (params bind in the lifted fn)
 *   - Single TextNode child + no params → 'inline'
 *   - Otherwise → 'function-const'
 */
function decideDefaultLifting(slot: SlotDecl): 'inline' | 'function-const' | 'none' {
  if (slot.defaultContent === null) return 'none';
  // The IR holds defaultContent as a single TemplateNode; for inline-eligible
  // we'd need a single static-text node and zero params.
  if (slot.params.length > 0) return 'function-const';
  if (slot.defaultContent.type === 'TemplateStaticText') return 'inline';
  return 'function-const';
}

export function refineSlotTypes(slot: SlotDecl): RefinedSlotType {
  const isDefault = slot.name === '';
  const hasParams = slot.params.length > 0;
  const lifting = decideDefaultLifting(slot);

  if (isDefault) {
    if (!hasParams) {
      return {
        propFieldName: 'children',
        propFieldType: 'ReactNode',
        ctxInterface: null,
        defaultLifting: lifting,
        defaultFnName: lifting === 'function-const' ? '__defaultChildren' : null,
      };
    }
    // Default slot WITH params — union shape per dropdown-react-default-slot
    // bugfix. Function-type notation in a union MUST be parenthesised
    // (TS1385: `ReactNode | (ctx: X) => ReactNode` is a parse error).
    const paramFields = slot.params.map((p, i) => `${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])};`).join(' ');
    const ctxInterface = `interface ChildrenCtx { ${paramFields} }`;
    return {
      propFieldName: 'children',
      propFieldType: 'ReactNode | ((ctx: ChildrenCtx) => ReactNode)',
      ctxInterface,
      defaultLifting: lifting,
      defaultFnName: lifting === 'function-const' ? '__defaultChildren' : null,
    };
  }

  // Named slot
  const pascal = pascalCase(slot.name);
  const propFieldName = 'render' + pascal;
  if (!hasParams) {
    // Phase 07.3.2 fix — align inline TSX type with public .d.ts
    // (emitTypes.ts:152 declares `() => ReactNode`). Consumer-side
    // emitSlotFiller.ts:126 ALWAYS wraps body in an arrow
    // (`renderHeader={() => (<>...</>)}`); bare `ReactNode` here caused
    // React to render the function reference directly (React error:
    // "Functions are not valid as a React child") — root cause of
    // WrapperModal #brand/#actions silently rendering nothing in dogfood
    // Modal 3. Pattern 2 (RESEARCH §"State of the Art" / PATTERNS Pattern 2)
    // — same alignment-with-emitTypes precedent as the default-slot-with-
    // params union form at L88-100. Composes cleanly with Plan 01's merged
    // `(props.renderX ?? props.slots?.['x'])` fieldRef because the merge
    // and the invocation `(...)?.()` layer at distinct grammar levels:
    // `(a ?? b)?.()` is valid JS.
    return {
      propFieldName,
      propFieldType: '() => ReactNode',
      ctxInterface: null,
      defaultLifting: lifting,
      defaultFnName: lifting === 'function-const' ? `__default${pascal}` : null,
    };
  }
  const paramFields = slot.params.map((p, i) => `${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])};`).join(' ');
  const ctxName = pascal + 'Ctx';
  const ctxInterface = `interface ${ctxName} { ${paramFields} }`;
  return {
    propFieldName,
    propFieldType: `(ctx: ${ctxName}) => ReactNode`,
    ctxInterface,
    defaultLifting: lifting,
    defaultFnName: lifting === 'function-const' ? `__default${pascal}` : null,
  };
}
