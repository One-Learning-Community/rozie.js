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
import type { IRComponent, PropTypeAnnotation, SlotDecl } from '../../../../core/src/ir/types.js';
import { buildPropJsdoc } from '../../../../core/src/codegen/buildPropJsdoc.js';
import { lowerSlotParamType } from '../../../../core/src/codegen/slotParamTypeLowering.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';
// WR-05 fix (79-REVIEW-FIX): was a local copy of this exact one-line
// escaping predicate — consolidated into core; see that module's doc
// comment for why (drift risk on shared, security-relevant escaping logic).
import { escapeSingleQuotedKey } from '../../../../core/src/codegen/escapeSingleQuotedKey.js';

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
        // Converge on React's permissive `any` precedent (see
        // renderPropsInterface.ts core comment) — a `Function` prop is
        // assignable to a strict typed function param (e.g. `CommandScorer<T>`).
        return '(...args: any[]) => any';
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
    if (ann.value === 'function') return '(...args: any[]) => any';
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

/**
 * Exported (Quick 260802-v1v seam 1) so `emitSolid.ts`'s `propKeys` skip
 * list can derive the SAME `on<Pascal>` handler names this file uses to
 * declare the props-interface fields, instead of re-deriving independently
 * — re-derivation is how the two sides would silently drift on a kebab
 * emit name.
 */
export function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/**
 * Build the value type of a family member (Phase 79 Plan 12, R6/AC-10): a
 * zero-param family types its value as a genuine zero-argument function —
 * NOT a function accepting an empty context object.
 */
function buildFamilyFnType(slot: SlotDecl): string {
  if (slot.params.length === 0) return '() => JSX.Element';
  const paramFields = slot.params
    .map((p, i) => `${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])}`)
    .join('; ');
  return `(ctx: { ${paramFields} }) => JSX.Element`;
}

/**
 * Build the TS type text for the `slots?:` record field (Phase 79 Plan 12,
 * R6). A component with no dynamic-name slot returns the EXACT pre-Plan-12
 * generic `Record<string, (ctx: any) => JSX.Element>` text — byte-identical.
 * Mirrors React's `refineSlotTypes.ts#buildSlotsRecordType` (same rationale
 * for the trailing broad catch-all: literal-key narrowing for consumer
 * fills, and satisfying the invocation site's non-literal runtime-string
 * index access).
 */
/** Escape a single-quoted string-literal key body (T-79-07 — mirrors every per-target copy). */
export function buildSlotsRecordType(slots: SlotDecl[]): string {
  const dynamicSlots = slots.filter((s) => s.dynamicNameExpr !== undefined);
  if (dynamicSlots.length === 0) {
    return 'Record<string, (ctx: any) => JSX.Element>';
  }
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
    members.push(`'${escapeSingleQuotedKey(s.name)}'?: (${buildFamilyFnType(s)}) | undefined;`);
  }
  for (const s of dynamicSlots) {
    if (s.namePrefix === undefined || s.namePrefix.length === 0) continue;
    const key = `\`${s.namePrefix}\${string}\``;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    members.push(`[key: ${key}]: (${buildFamilyFnType(s)}) | undefined;`);
  }
  members.push('[key: string]: ((...args: any[]) => JSX.Element) | undefined;');
  return `{ ${members.join(' ')} }`;
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
    // Phase 58 (SC-2/SC-3) — leading per-prop JSDoc from the shared builder,
    // gated on `p.docs` (returns '' for a docless prop → byte-identical, SC-5).
    const jsdoc = buildPropJsdoc(p, '  ');
    if (p.isModel) {
      // 3-field synthesis per D-135 Solid analog.
      if (jsdoc) fields.push(jsdoc.replace(/\n$/, ''));
      fields.push(`  ${p.name}${opt}: ${tsType};`);
      fields.push(`  default${capitalize(p.name)}?: ${tsType};`);
      fields.push(`  on${capitalize(p.name)}Change?: (${p.name}: ${tsType}) => void;`);
    } else {
      if (jsdoc) fields.push(jsdoc.replace(/\n$/, ''));
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
    fields.push(`  slots?: ${buildSlotsRecordType(ir.slots)};`);
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
