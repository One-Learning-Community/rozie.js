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
import { isSlotNameIdentifier } from './slotNameIdentifier.js';

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
    // Task 0 (79-12, R12 escape found during 79-04) — `render${capitalize(name)}`
    // only uppercases the first character; it does NOT split on `-`/`_` the way
    // `toPascalCase` does, so a non-identifier name like `cell-status` used to
    // mint the syntactically-INVALID field `renderCell-status?: ...` in this
    // PUBLIC `@rozie/core` .d.ts renderer. Mirror 79-04's policy for React's
    // inline interface exactly: a non-identifier, non-default slot name gets NO
    // `render<Name>` field at all — it is reachable only through the bracket-
    // keyed `slots` record below. Do NOT mangle the name into a sanitized
    // identifier (e.g. `renderCellStatus`) — that would silently collide with a
    // genuinely-named `cellStatus` slot and re-introduce the ROZ127-shaped
    // ambiguity 79-03 retired. Identifier-named slots and the default slot are
    // completely unaffected — this branch is a pure additive guard.
    if (!isDefault && !isSlotNameIdentifier(slot.name)) {
      continue;
    }
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
        // Converge on React's permissive precedent — `any`, not `unknown` —
        // so a Function prop is assignable to a strict typed function param
        // (e.g. `CommandScorer<T>`). React/Vue/Svelte already emit `any`;
        // Angular/Lit/Solid previously diverged to `unknown`, whose `unknown`
        // RETURN type is not assignable to a strict typed param, producing
        // TS2345 (memory: project_function_prop_type_lowering_gap).
        return '(...args: any[]) => any';
      default:
        // Pass through user-defined identifiers verbatim — covers generic
        // type-parameter names (e.g., 'T') and consumer-declared interfaces.
        return ann.name;
    }
  }
  if (ann.kind === 'literal') {
    switch (ann.value) {
      case 'function':
        // See the identifier-kind `Function` case above — same `any` rationale.
        return '(...args: any[]) => any';
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
 *   1. Bare Identifier (`<slot :open="open">`) — look up in ir.props by name;
 *      failing that, resolve against top-level `<script>` function names
 *      (Quick 260803-ibt CR-02, see below); failing that, genuine fallback.
 *      (Note: Phase 2 IR's StateDecl does NOT carry a typeAnnotation field,
 *      so $data identifiers fall through to the genuine fallback below;
 *      v2 may extend StateDecl with inferred types.)
 *   2. MemberExpression (`<slot :open="$props.open">` / `$data.open`) — resolve
 *      the property name and look up in `ir.props` (and reach state-decl
 *      existence-check for callable-vs-value disambiguation).
 *   3. Genuine fallback: `'unknown'` per CONTEXT.md D-86.
 *
 * Quick 260802-v1v seam 7 — a bare Identifier that doesn't resolve to a prop
 * PREVIOUSLY special-cased as "residual-script function reference" and
 * emitted `() => void` (the canonical-Dropdown `toggle` heuristic). That
 * heuristic could not distinguish an actual script-defined callback
 * (`toggle`) from an `r-for` LOOP VARIABLE (`<slot :slide="slide" :index="i">`
 * inside `r-for="slide, i in $props.slides"` — the `Carousel.rozie:573`
 * shape) — loop vars are unresolved by construction (never props) and hit
 * the same branch, so the PUBLIC `.d.ts` lied about the consumer-facing
 * shape (`slide: () => void` for a plain array element). Seam 7 removed the
 * heuristic entirely, correctly fixing the loop-var lie — but it ALSO
 * downgraded every genuinely-callable slot param that resolves to a
 * top-level script function (documented consumer API: popover `toggle`,
 * data-table `setFilter`, command-palette `retry`) — see CR-02 below.
 *
 * Quick 260803-ibt CR-02 fix — the seam-7 comment (formerly here) claimed
 * "there is no principled way to keep the callable heuristic for ONE
 * bare-identifier shape while excluding the other from this call site".
 * That claim is FALSE: the two shapes live in different SCOPES, and one of
 * those scopes IS visible to this function. `toggle` is a top-level
 * `<script>` declaration; `IRComponent.setupBody.scriptProgram` is the
 * PRESERVED Babel Program (IR-04 referential preservation — the SAME `File`
 * node as `ast.script.program`, no clone), so top-level script function
 * names are resolvable from `ir` alone, with NO signature change to this
 * function or to `renderPropsInterface` (which would ripple into six
 * `emitTypes.ts` call sites — the D2 entanglement this fix deliberately
 * avoids). `slide`/`index`, by contrast, are `r-for` TEMPLATE-scope
 * bindings — `inferParamType` has no visibility into template scope (it
 * receives only the `ParamDecl` + `IRComponent`, never the loop-variable
 * binding context) and correctly cannot resolve them, so they still
 * (correctly) fall through to `unknown`.
 *
 * Resolved script functions emit `(...args: any[]) => any` — the house
 * callable-lowering standard (see `renderPropType`'s `Function`/`'function'`
 * cases below) — not the original `() => void`, which was already a v1
 * arity lie (`setFilter(columnId, value)` consumers were already casting
 * around it). The INLINE `.tsx`/`.vue`/`.svelte` body path
 * (`refineSlotTypes.ts`, per-target) is unaffected — it already used the
 * safe `any` universally and does not call this function.
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
    // CR-02 — resolve against top-level script function names before
    // falling through. Matched -> callable (D3); unmatched (r-for loop
    // vars, template-only names) -> the genuine `unknown` fallback below
    // (D-86 preserved).
    if (collectTopLevelScriptFunctionNames(ir).has(name)) {
      return '(...args: any[]) => any';
    }
    // Unresolved bare identifier (r-for loop var OR an undeclared/template-
    // only name) — fall through to the genuine `unknown` fallback below.
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

  // Case 3 — genuine fallback per D-86.
  return 'unknown';
}

/**
 * Quick 260803-ibt CR-02 — the set of top-level `<script>` function names
 * for an `IRComponent`, memoized per-`ir` (a `WeakMap` avoids re-scanning
 * `setupBody.scriptProgram` on every `inferParamType` call within the same
 * render pass).
 *
 * Only TOP-LEVEL declarations are collected — nested function scopes are
 * never slot-param candidates (a slot param's `valueExpression` is always a
 * reference resolved at component setup scope) and must not widen the set.
 * Covers both top-level function shapes:
 *   - `function toggle() {}`     — FunctionDeclaration
 *   - `const toggle = () => {}` — VariableDeclarator whose init is an
 *     ArrowFunctionExpression or FunctionExpression (`let` included for
 *     symmetry; `var` is out of scope for `.rozie` script authoring).
 *
 * `setupBody.annotations`' `helper-fn` role (checked first per D2/T3) only
 * tags top-level `FunctionDeclaration` statements (see
 * `ir/lowerers/lowerScript.ts:buildAnnotations`) and does not carry names —
 * it cannot alone cover the arrow-const shape, so this function performs the
 * direct top-level scan described in the task brief's fallback path for both
 * shapes in one pass rather than partially relying on the annotation.
 */
const topLevelScriptFunctionNamesCache = new WeakMap<IRComponent, Set<string>>();

function collectTopLevelScriptFunctionNames(ir: IRComponent): Set<string> {
  const cached = topLevelScriptFunctionNamesCache.get(ir);
  if (cached) return cached;

  const names = new Set<string>();
  const body = ir.setupBody?.scriptProgram?.program?.body ?? [];
  for (const stmt of body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (
          t.isIdentifier(decl.id) &&
          decl.init &&
          (t.isArrowFunctionExpression(decl.init) || t.isFunctionExpression(decl.init))
        ) {
          names.add(decl.id.name);
        }
      }
    }
  }

  topLevelScriptFunctionNamesCache.set(ir, names);
  return names;
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
