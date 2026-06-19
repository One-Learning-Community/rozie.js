/**
 * emitPropsInterface — Solid target (port of react/emit/emitPropsInterface.ts).
 *
 * Emits `interface FooProps { ... }` inline above the function declaration.
 * Model:true props synthesize 3 fields per D-135 Solid analog:
 *   - `value?: T`         (controlled-input current value)
 *   - `defaultValue?: T`  (uncontrolled-mode initial value)
 *   - `onValueChange?: (value: T) => void`  (parent notification)
 *
 * Slot fields use `JSX.Element` (Solid) instead of `ReactNode` (React).
 * Default slot maps to `children?: JSX.Element`.
 * Named slots WITHOUT context → `slotName?: JSX.Element`.
 * Named slots WITH context → `slotName?: (ctx: SlotCtx) => JSX.Element`.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent, PropTypeAnnotation } from '../../../../core/src/ir/types.js';

export function renderType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        // Match the `Object → Record<string, any>` precedent: the
        // PropTypeAnnotation has no inner-element type info, so any element
        // access (`item.X`) would fail under `unknown[]`. `any[]` keeps
        // element access ergonomic without casts; refinement happens via
        // user type annotations when present.
        return 'any[]';
      case 'Object':
        // Use `any` (not `unknown`) so consumers can access arbitrary properties
        // on Object-typed props without explicit casts in emitted template code.
        // `unknown` requires cast at every access site which the emitter doesn't produce.
        return 'Record<string, any>';
      case 'Function':
        return '(...args: unknown[]) => unknown';
      default:
        return ann.name;
    }
  }
  if (ann.kind === 'union') {
    // A function-type member MUST be parenthesized inside a union — `string | (...) => x`
    // is ambiguous/invalid TS (the arrow binds the whole union); `string | ((...) => x)` is
    // correct. Only function members need wrapping.
    return ann.members
      .map((m) => {
        const r = renderType(m);
        const isFn =
          (m.kind === 'identifier' && m.name === 'Function') ||
          (m.kind === 'literal' && m.value === 'function');
        return isFn ? `(${r})` : r;
      })
      .join(' | ');
  }
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'any[]';
    if (ann.value === 'object') return 'Record<string, any>';
    if (ann.value === 'function') return '(...args: unknown[]) => unknown';
    return ann.value;
  }
  return 'unknown';
}

/**
 * 260521-oao — builtin zero-value for a prop type, used as the
 * `createControllableSignal` `defaultFallback` seed for a no-default model
 * prop. A custom (non-builtin) identifier type has no synthesizable zero —
 * fall back to `undefined as unknown as <T>` so the call still typechecks
 * (the seed is unobserved for a required model prop, always controlled).
 */
export function zeroValueFor(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return '0';
      case 'String':
        return "''";
      case 'Boolean':
        return 'false';
      case 'Array':
        return '[]';
      case 'Object':
        return '{}';
      case 'Function':
        return 'null';
    }
  }
  if (ann.kind === 'literal') {
    if (ann.value === 'number') return '0';
    if (ann.value === 'string') return "''";
    if (ann.value === 'boolean') return 'false';
    if (ann.value === 'array') return '[]';
    if (ann.value === 'object') return '{}';
    if (ann.value === 'function') return 'null';
  }
  return `undefined as unknown as ${renderType(ann)}`;
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export function emitPropsInterface(
  ir: IRComponent,
  slotPropFields?: string[],
  /**
   * Phase 21 ($expose, REQ-8 / REQ-10, D-05) — the callback-`ref` prop line
   * `ref?: (h: <Name>Handle) => void`. Passed (non-empty) only when
   * `ir.expose` is non-empty; emitted LAST so a non-$expose component's props
   * interface stays byte-identical (D-05 byte-identity-when-empty).
   */
  exposeRefField?: string,
): string {
  const fields: string[] = [];

  // Props (split by isModel).
  // 260521-oao — `p.required` is the SOLE optionality determinant: a
  // `required: true` prop emits a non-optional contract (`name: T`), every
  // other prop keeps the optional `name?: T` form. The model `default`/
  // `on…Change` companion fields STAY optional regardless of `required`.
  for (const p of ir.props) {
    let tsType = renderType(p.typeAnnotation);
    // Phase 16 R1 — widen with `| null` for null-default props so consumers
    // (including sub-component composition) see the accurate type contract.
    // Mirrors the React + Svelte widening; without it `<Card onClose={
    // props.onClose} />` chains fail TS2322 across the consumer tree.
    if (p.defaultValue !== null && t.isNullLiteral(p.defaultValue)) {
      tsType = `(${tsType}) | null`;
    }
    const opt = p.required ? '' : '?';
    if (p.isModel) {
      // 3-field synthesis per D-135 Solid analog.
      fields.push(`  ${p.name}${opt}: ${tsType};`);
      fields.push(`  default${capitalize(p.name)}?: ${tsType};`);
      fields.push(`  on${capitalize(p.name)}Change?: (${p.name}: ${tsType}) => void;`);
    } else {
      fields.push(`  ${p.name}${opt}: ${tsType};`);
    }
  }

  // Emits → optional `on<EventPascal>` props.
  for (const e of ir.emits) {
    const eventPascal = toPascalCase(e);
    if (eventPascal.length === 0) continue;
    fields.push(`  on${eventPascal}?: (...args: unknown[]) => void;`);
  }

  // Slots — use slotPropFields when provided (P2 filled by emitSlotDecl).
  if (slotPropFields !== undefined) {
    for (const line of slotPropFields) {
      fields.push(line);
    }
  } else {
    // P1 fallback: basic JSX.Element slot shapes.
    for (const s of ir.slots) {
      if (s.name === '') {
        // default slot → children
        fields.push(`  children?: JSX.Element;`);
      } else {
        fields.push(`  ${s.name}?: JSX.Element;`);
      }
    }
  }

  // Phase 07.3.2 — accept consumer-side dynamic-name slots map (D-SV-16
  // cross-target port of commit 6060408, svelte/emit/emitScript.ts:154-161).
  // The consumer-side emitter (emitSlotFiller.ts:166 `emitDynamicSlotsProp`)
  // emits `slots={{ [expr]: (ctx) => (<>...</>) }}` for `<template #[dynamic]>`
  // fills; without this prop the producer-side invocation site (emitSlotInvocation.ts)
  // has nothing to merge against and the dynamic-name fill is silently dropped.
  // Gated on `ir.slots.length > 0` so non-slotted components stay byte-identical
  // (D-05). Per-slot merge happens in emitSlotInvocation.ts.
  if (ir.slots.length > 0) {
    fields.push(`  slots?: Record<string, (ctx: any) => JSX.Element>;`);
  }

  // Phase 21 ($expose, D-05) — the typed callback `ref` prop, emitted last.
  // Only present when ir.expose is non-empty (caller passes the field then).
  if (exposeRefField !== undefined && exposeRefField.length > 0) {
    fields.push(`  ${exposeRefField}`);
  }

  if (fields.length === 0) {
    return `interface ${ir.name}Props {}`;
  }

  return `interface ${ir.name}Props {\n${fields.join('\n')}\n}`;
}
