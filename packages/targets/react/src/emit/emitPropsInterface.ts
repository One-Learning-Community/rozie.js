/**
 * emitPropsInterface — Plan 04-02 Task 2.
 *
 * Emits `interface FooProps { ... }` inline above the function declaration.
 * REACT-T-07 — Phase 4 v1 ships inline interfaces; consumer-side tsc reads
 * them as the source-of-truth for prop types. Phase 6 (TYPES-01) emits
 * separate .d.ts via dts-buddy.
 *
 * Model:true props synthesize 3 fields per D-31/D-56 React analog:
 *   - `value?: T`         (controlled-input current value)
 *   - `defaultValue?: T`  (uncontrolled-mode initial value)
 *   - `onValueChange?: (value: T) => void`  (parent notification)
 *
 * Slot decls produce render-prop signatures (`renderX?: (ctx: XCtx) => ReactNode`)
 * — Plan 04-03 implements the slot-side; this plan stubs to never emit slots.
 *
 * Each entry in ir.emits synthesizes an additional optional field on the
 * interface: `on<PascalCase>?: (...args: unknown[]) => void`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, PropTypeAnnotation } from '../../../../core/src/ir/types.js';

/**
 * Render a PropTypeAnnotation as a TypeScript type string.
 *
 *   - { kind: 'identifier', name: 'Number' }   → 'number'
 *   - { kind: 'identifier', name: 'String' }   → 'string'
 *   - { kind: 'identifier', name: 'Boolean' }  → 'boolean'
 *   - { kind: 'identifier', name: 'Array' }    → 'any[]'
 *   - { kind: 'identifier', name: 'Object' }   → 'Record<string, any>'
 *   - { kind: 'identifier', name: 'Function' } → '(...args: any[]) => any'
 *   - { kind: 'union', members }               → join with ' | '
 *   - { kind: 'literal', value }               → 'string'/'number'/etc.
 *
 * 2026-05-18 — `Array → any[]` (not `unknown[]`) and `Object → Record<string, any>`
 * (not `Record<string, unknown>`) to permit consumer-side property access without
 * forcing the author to type each rozie `<props>` element-by-element. Mirrors the
 * Solid+Lit emit fix (commit 536575a). The gate is the React-emit tsc gate at
 * tests/react-typecheck/; with `unknown` the gate fires TS18046 on every
 * `items.filter(i => !i.done)` shape and TS2339 on every `node.label` lookup.
 * `(...args: any[]) => any` for Function lets bare `@click="$props.onClose"`
 * call shapes type-check; the alternative is per-call-site casts which would
 * leak into emit at every template event.
 */
function renderType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'any[]';
      case 'Object':
        return 'Record<string, any>';
      case 'Function':
        return '(...args: any[]) => any';
      default:
        return ann.name;
    }
  }
  if (ann.kind === 'union') {
    return ann.members.map(renderType).join(' | ');
  }
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'any[]';
    if (ann.value === 'object') return 'Record<string, any>';
    if (ann.value === 'function') return '(...args: any[]) => any';
    return ann.value;
  }
  return 'unknown';
}

/** Capitalize first letter. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** PascalCase from hyphenated/snake_case event name. */
function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export function emitPropsInterface(
  ir: IRComponent,
  slotPropFields?: string[],
): string {
  const fields: string[] = [];

  // Props (split by isModel)
  for (const p of ir.props) {
    const tsType = renderType(p.typeAnnotation);
    if (p.isModel) {
      // 3-field synthesis per D-31/D-56 React analog
      fields.push(`  ${p.name}?: ${tsType};`);
      fields.push(`  defaultValue?: ${tsType};`);
      fields.push(`  on${capitalize(p.name)}Change?: (${p.name}: ${tsType}) => void;`);
    } else {
      fields.push(`  ${p.name}?: ${tsType};`);
    }
  }

  // Emits → optional `on<EventPascal>` props.
  // v1: ship `(...args: any[]) => void` since IR doesn't carry per-emit arg types.
  // 2026-05-18 — `any[]` (not `unknown[]`) so consumer-side TS doesn't complain
  // about untyped event args at call sites like `props.onSearch(query)`.
  for (const e of ir.emits) {
    const eventPascal = toPascalCase(e);
    if (eventPascal.length === 0) continue;
    fields.push(`  on${eventPascal}?: (...args: any[]) => void;`);
  }

  // Slots — Plan 04-03 fills slotPropFields via emitSlotDecl(ir).
  // Backward-compat fallback: if no slotPropFields passed, fall through to the
  // Plan 04-02 union stub.
  if (slotPropFields !== undefined) {
    for (const line of slotPropFields) {
      fields.push(line);
    }
  } else {
    for (const s of ir.slots) {
      if (s.name === '') {
        // default slot → children
        fields.push(`  children?: import('react').ReactNode | ((ctx: unknown) => import('react').ReactNode);`);
      } else {
        fields.push(`  render${capitalize(s.name)}?: (ctx: unknown) => import('react').ReactNode;`);
      }
    }
  }

  // Phase 07.3.2 — accept consumer-side dynamic-name slots map (D-SV-16
  // cross-target port of Svelte commit 6060408); merged into named
  // render-prop fields at each invocation site in emitSlotInvocation.ts.
  // The consumer-side emitter (emitSlotFiller.ts:140 emitDynamicSlotsProp)
  // emits `slots={{ [expr]: (ctx) => (<>...</>) }}` for `<template #[dynamic]>`
  // fills; without this field the producer Props interface silently rejects
  // the consumer's dynamic-name projection. Gated on `ir.slots.length > 0`
  // so non-slotted components (Counter, SearchInput) stay byte-equivalent
  // per D-05.
  //
  // Phase 07.3.2 Plan 07 (CR-01 fix) — value type is `() =>` (zero args)
  // matching the no-params named-slot invocation form at
  // emitSlotInvocation.ts:302. Earlier Plan 01 wrote `(ctx: any) =>` (one
  // arg) but Plan 04's `?.()` call site invokes with zero args — the
  // mismatch crashes consumers who destructure ctx (`(ctx) => ctx.x`
  // throws `TypeError: Cannot read properties of undefined`). Aligning the
  // declared type with the actual call site closes the contract gap
  // surfaced by REVIEW.md CR-01.
  if (ir.slots.length > 0) {
    fields.push(`  slots?: Record<string, () => import('react').ReactNode>;`);
  }

  if (fields.length === 0) {
    return `interface ${ir.name}Props {}`;
  }

  return `interface ${ir.name}Props {\n${fields.join('\n')}\n}`;
}
