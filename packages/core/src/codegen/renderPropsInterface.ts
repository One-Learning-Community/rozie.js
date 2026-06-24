/**
 * renderPropsInterface — Phase 22 Plan 22-02 (typed `.rozie` imports).
 *
 * The framework-AGNOSTIC half of a per-target `.d.rozie.ts` renderer: the
 * `export interface <Name>Props { … }` body. Hoisted VERBATIM out of React's
 * `emitTypes.ts` so the five Wave-2 per-target type renderers (Vue / Svelte /
 * Solid / Angular / Lit) consume ONE source for the prop→TS-type mapping. A
 * copy-paste of this loop into five files would guarantee eventual drift; a
 * single shared renderer guarantees parity (PATTERNS "Prop→TS-type mapping
 * (must not drift)" + emitTypes.ts's own documented Pitfall 1).
 *
 * The ONLY React-specific token in the interface body is the slot-children type
 * (`ReactNode`). It is PARAMETERIZED via `opts.slotChildrenType` so a non-React
 * target substitutes its own slot idiom (e.g. Svelte's `Snippet`, Solid's
 * `JSX.Element`) — the React-specific `ReactNode` is NOT hard-coded in core.
 *
 * What this renders (the framework-agnostic interface body ONLY):
 *   - the `export interface <Name>Props<generics> {` opening line,
 *   - the D-84 model:true triplet (`value? / defaultValue? / onValueChange?`),
 *   - required/optional gating (required ⇒ no `?`; defaulted ⇒ `?`),
 *   - `ir.emits` → `on<Event>?: (...args: unknown[]) => void` (SPEC-R3),
 *   - slot params via `inferParamType` (D-86 best-effort inference),
 *   - the closing `}`.
 *
 * What it does NOT render (the per-target default-export declaration —
 * `declare function Foo(): JSX.Element` / `ForwardRefExoticComponent` /
 * `DefineComponent` / element class — stays in each target's emitTypes.ts).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent, PropTypeAnnotation, ParamDecl } from '../ir/types.js';
import { buildPropJsdoc } from './buildPropJsdoc.js';

/**
 * Options controlling the shared props-interface body rendering.
 *
 * @experimental — shape may change before v1.0
 */
export interface RenderPropsInterfaceOptions {
  /**
   * Type parameter list, e.g. `['T']` ⇒ `export interface FooProps<T> {`.
   * D-85 React full generic preservation; non-React targets pass the same list
   * so the interface header carries the same type parameters.
   */
  genericParams?: string[];
  /**
   * The slot-children type token for this target. React passes `'ReactNode'`;
   * other targets substitute their own slot idiom. REQUIRED so the
   * React-specific `ReactNode` is never hard-coded in core.
   */
  slotChildrenType: string;
}

/**
 * Render the `export interface <Name>Props<...> { ... }` block (INCLUDING the
 * interface keyword line and the closing brace) from an IRComponent.
 *
 * @public — consumed by React's `emitTypes.ts` and the five Wave-2 per-target
 * type renderers.
 */
export function renderPropsInterface(
  ir: IRComponent,
  opts: RenderPropsInterfaceOptions,
): string {
  const slotChildrenType = opts.slotChildrenType;
  const lines: string[] = [];

  const generics =
    opts.genericParams && opts.genericParams.length > 0
      ? `<${opts.genericParams.join(', ')}>`
      : '';

  // Props interface (parameterized when generics present per D-85).
  lines.push(`export interface ${ir.name}Props${generics} {`);

  for (const prop of ir.props) {
    // Phase 58 (SC-2/SC-3) — leading per-prop JSDoc block from the shared
    // deterministic builder, gated on `prop.docs` (the builder returns '' for a
    // docless prop, so a prop WITHOUT docs takes the exact existing path and
    // stays byte-identical — SC-5). `buildPropJsdoc` returns a trailing newline
    // for direct text splicing; here we strip it because the block is pushed as
    // a single entry into the `\n`-joined `lines` array.
    const jsdoc = buildPropJsdoc(prop, '  ');
    let tsType = renderPropType(prop.typeAnnotation);
    // Phase 16 R1 — widen the prop type with `| null` when `default: null`
    // is declared, so the published `.d.ts` matches the inline Props
    // interface in emitPropsInterface.ts (which carries the same widening).
    // Without this the `.d.ts` and inline interface drift and consumers
    // pulling types via the package's `.d.ts` see a different contract
    // from what the inline interface offers.
    if (prop.defaultValue !== null && t.isNullLiteral(prop.defaultValue)) {
      tsType = `(${tsType}) | null`;
    }
    if (prop.isModel) {
      // D-84 model:true triplet, named after the actual prop identifier.
      const baseName = prop.name;
      const Pascal = capitalize(baseName);
      if (jsdoc) lines.push(jsdoc.replace(/\n$/, ''));
      lines.push(`  ${baseName}?: ${tsType};`);
      lines.push(`  default${Pascal}?: ${tsType};`);
      lines.push(`  on${Pascal}Change?: (next: ${tsType}) => void;`);
    } else {
      // Required when no default present; optional when a default is set.
      // WR-02: exclude both null AND undefined — the IR convention uses
      // `defaultValue: null` to mean "no default", but a partial IR
      // construction or JSON round-trip that drops the field entirely would
      // surface as `undefined`. Treating those identically prevents silent
      // required → optional drift if the IR shape evolves.
      const hasDefault =
        prop.defaultValue !== null && prop.defaultValue !== undefined;
      const optional = hasDefault ? '?' : '';
      if (jsdoc) lines.push(jsdoc.replace(/\n$/, ''));
      lines.push(`  ${prop.name}${optional}: ${tsType};`);
    }
  }

  // Emits → optional `on<EventPascal>` props.
  // Dedupe handler names to avoid PascalCase collisions (WR-01): two distinct
  // emit identifiers that PascalCase to the same key (e.g. `add` + `Add`, or
  // `value-change` + `valueChange`) would otherwise produce duplicate property
  // declarations on the props interface — invalid TypeScript or silently
  // last-write-wins. The IR validator should already reject empty emit names;
  // the empty-string guard here is defense-in-depth.
  //
  // CR-01 (Phase 22 review): the dedupe set must ALSO be pre-seeded with the
  // names already emitted by the props loop above, otherwise an emit can
  // collide with (1) the model triplet's `on<Pascal>Change` key, or (2) a
  // literal `on<Event>` prop name. Concrete failures: model prop `value`
  // (→ `onValueChange?`) plus emit `value-change` (→ `onValueChange?`); or a
  // literal prop `onSelect` plus emit `select` (→ `onSelect?`). Both would
  // land a duplicate member on the interface (TS2300) — a non-compiling
  // type-lie in the very sidecar this phase exists to make trustworthy. Seed
  // first, then skip collisions in the loop below.
  //
  // FOLLOW-UP: a lowering-time ROZ diagnostic that surfaces emit-vs-prop /
  // emit-vs-model collisions at compile time (rather than silently dropping
  // the emit from the type surface) is deferred — it needs its own design
  // pass against the existing ROZ code allocation.
  const emittedHandlers = new Set<string>();
  for (const prop of ir.props) {
    if (prop.isModel) emittedHandlers.add(`on${capitalize(prop.name)}Change`);
    // Literal `on<Event>` props (e.g. `onSelect`) occupy the same name space.
    emittedHandlers.add(prop.name);
  }
  for (const e of ir.emits) {
    const eventPascal = toPascalCase(e);
    if (eventPascal.length === 0) continue;
    const handlerName = `on${eventPascal}`;
    if (emittedHandlers.has(handlerName)) continue;
    emittedHandlers.add(handlerName);
    lines.push(`  ${handlerName}?: (...args: unknown[]) => void;`);
  }

  // Slots per D-84 + D-86. The slot-children type token is the per-target
  // parameter (`opts.slotChildrenType`); everything else is framework-agnostic.
  for (const slot of ir.slots) {
    const isDefault = slot.name === ''; // D-18 default-slot sentinel
    const renderName = isDefault ? 'children' : `render${capitalize(slot.name)}`;
    if (slot.params.length === 0) {
      if (isDefault) {
        lines.push(`  children?: ${slotChildrenType};`);
      } else {
        lines.push(`  ${renderName}?: () => ${slotChildrenType};`);
      }
    } else {
      const paramFields = slot.params
        .map((p) => `${p.name}: ${inferParamType(p, ir)}`)
        .join('; ');
      const sig = `(params: { ${paramFields} }) => ${slotChildrenType}`;
      if (isDefault) {
        // TS1385: function-type notation in a union MUST be parenthesised.
        // `ReactNode | (params: …) => ReactNode` is a parse error; wrap the
        // arrow form in parens to disambiguate the union member.
        lines.push(`  children?: ${slotChildrenType} | (${sig});`);
      } else {
        lines.push(`  ${renderName}?: ${sig};`);
      }
    }
  }

  // Phase 07.3.2 — mirror inline Props interface (emitPropsInterface.ts).
  // Public .d.ts MUST declare the same slots?: field so consumer typecheck
  // passes when they pass `slots={{ ... }}` from a `<template #[dynamic]>`
  // fill. Pitfall 1 — drift between the inline TSX Props interface and the
  // public .d.ts is the same class of bug Plan 04 fixes for ReactNode/() =>
  // ReactNode; mitigate by updating BOTH atomically.
  //
  // Phase 07.3.2 Plan 07 (CR-01 fix) — value type aligned with the no-args
  // invocation form at emitSlotInvocation.ts:302. See the sibling note in
  // emitPropsInterface.ts for the contract rationale.
  if (ir.slots.length > 0) {
    lines.push(`  slots?: Record<string, () => ${slotChildrenType}>;`);
  }

  lines.push(`}`);
  return lines.join('\n');
}

/**
 * Map a `PropTypeAnnotation` to its TypeScript surface string.
 *
 * Mirrors the rules used by `emitPropsInterface.ts` (Plan 04-02) so the
 * inline interface in the `.tsx` body and the published `.d.ts` agree.
 *
 * @public — the single source of truth for prop→TS-type mapping across targets.
 */
export function renderPropType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'unknown[]';
      case 'Object':
        return 'Record<string, unknown>';
      case 'Function':
        return '(...args: unknown[]) => unknown';
      default:
        // Pass through user-defined identifiers verbatim — covers generic
        // type-parameter names (e.g., 'T') and consumer-declared interfaces.
        return ann.name;
    }
  }
  if (ann.kind === 'literal') {
    switch (ann.value) {
      case 'function':
        return '(...args: unknown[]) => unknown';
      case 'object':
        return 'Record<string, unknown>';
      case 'array':
        return 'unknown[]';
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      default:
        return 'unknown';
    }
  }
  if (ann.kind === 'union') {
    // A function-type member MUST be parenthesized inside a union — `string | (...) => x`
    // is ambiguous/invalid TS (the arrow binds the whole union); `string | ((...) => x)` is
    // correct. Only function members need wrapping; primitives/objects/arrays do not.
    return ann.members
      .map((m) => {
        const r = renderPropType(m);
        const isFn =
          (m.kind === 'identifier' && m.name === 'Function') ||
          (m.kind === 'literal' && m.value === 'function');
        return isFn ? `(${r})` : r;
      })
      .join(' | ');
  }
  return 'unknown';
}

/**
 * D-86 best-effort param-type inference.
 *
 *   1. Bare Identifier (`<slot :open="open">`) — look up in ir.props by name.
 *      (Note: Phase 2 IR's StateDecl does NOT carry a typeAnnotation field,
 *      so $data identifiers fall through to the function-fallback below;
 *      v2 may extend StateDecl with inferred types.)
 *   2. MemberExpression (`<slot :open="$props.open">` / `$data.open`) — resolve
 *      the property name and look up in `ir.props` (and reach state-decl
 *      existence-check for callable-vs-value disambiguation).
 *   3. Bare Identifier that doesn't resolve to a prop and isn't in ir.state →
 *      treat as a residual-script function reference, emit `() => void` as
 *      the canonical-Dropdown `toggle: () => void` shape (documented v1
 *      heuristic per plan §<action> Note on D-86 inference scope).
 *   4. Genuine fallback: `'unknown'` per CONTEXT.md D-86.
 *
 * @public — shared so slot-param inference cannot drift between targets.
 */
export function inferParamType(param: ParamDecl, ir: IRComponent): string {
  const expr = param.valueExpression;

  // Case 1 — bare Identifier; look up in props by name. State decls have no
  // typeAnnotation in v1 IR, so they cannot be resolved beyond existence.
  if (t.isIdentifier(expr)) {
    const name = expr.name;
    const propDecl = ir.props.find((p) => p.name === name);
    if (propDecl) return renderPropType(propDecl.typeAnnotation);

    // Case 3 — identifier present in ir.state is a known reactive value but
    // we have no v1 type info — fall through to the callable fallback below.
    // Identifier NOT in state OR props is treated as a residual-script
    // function reference per the canonical Dropdown `toggle` shape.
    return '() => void';
  }

  // Case 2 — MemberExpression (`$props.foo`, `$data.bar`, etc.).
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.property)) {
    const propName = expr.property.name;
    if (t.isIdentifier(expr.object)) {
      const objName = expr.object.name;
      if (objName === '$props' || objName === '_props') {
        const propDecl = ir.props.find((p) => p.name === propName);
        if (propDecl) return renderPropType(propDecl.typeAnnotation);
      }
      // `$data.x` / `_data.x` — StateDecl carries no typeAnnotation in v1
      // IR. Fall through to ultimate `'unknown'` fallback below; v2 IR
      // expansion would resolve this branch.
    }
  }

  // Case 4 — genuine fallback per D-86.
  return 'unknown';
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
