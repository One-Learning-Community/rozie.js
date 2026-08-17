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
 * bracket-keyed record alone. `renderRecordKey` below is this file's single
 * source of truth for the escaped record-key text, reused by
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

/**
 * Escape a single-quoted string-literal key body: backslash first (so a
 * backslash inserted by the quote-escape step is not itself re-escaped),
 * then single quotes. Mirrors Vue's `refineSlotTypes.ts` escape helper
 * (Phase 79 Plan 03) so every target's record-key emission escapes the same
 * way (T-79-07).
 */
function escapeSingleQuotedKey(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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
 * Render the bracket-lookup key for a record-only slot name: single-quoted
 * and escaped, so a quote/backslash in the author's slot name cannot break
 * out of the emitted string literal (T-79-07).
 */
export function renderRecordKey(name: string): string {
  return `'${escapeSingleQuotedKey(name)}'`;
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
    const paramFields = slot.params.map((p) => `${p.name}: any;`).join(' ');
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
  const paramFields = slot.params.map((p) => `${p.name}: any;`).join(' ');
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
