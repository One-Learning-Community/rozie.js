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
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';

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
    return {
      propFieldName,
      propFieldType: 'ReactNode',
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
