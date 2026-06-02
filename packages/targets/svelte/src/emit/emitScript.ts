/**
 * emitScript — Phase 5 Plan 02a Task 1.
 *
 * Produces the body of `<script lang="ts">` for a Svelte 5+ SFC. Output
 * order (per RESEARCH.md Pattern 1 + Plan §<action>):
 *
 *   1. import type { Snippet } from 'svelte';        (only if slots present)
 *   2. interface Props { ... }                       (only if props OR slots present)
 *   3. let { ... }: Props = $props();                (only if props OR slots present)
 *   4. let dataX = $state(initializer);              (per StateDecl)
 *   5. let refX = $state<HTMLElement>();             (per RefDecl — bare let, bind:this in template)
 *   6. residual <script> body (verbatim @babel/generator output)
 *   7. const computedX = $derived(expr);             (per ComputedDecl)
 *   8. $effect(() => { setup; return cleanup; });    (per LifecycleHook — D-19 paired)
 *   9. $effect listener blocks                       (appended by emitListeners — Task 3)
 *
 * Residual-before-derived/effect mirrors Vue: keeps user-authored helper
 * functions and `console.log` close to the top of the script and lets
 * `$derived`/`$effect` references resolve naturally because `const`
 * declarations from the residual body are in scope.
 *
 * Per RESEARCH Pitfall 7: array re-assignments (`items = [...items, x]`) are
 * preserved verbatim — Svelte's `$state` re-runs effects on re-assignment.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-svelte` imports —
 * debounce / throttle / outsideClick all inline in v1.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  ComputedDecl,
  RefDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers, svelteCallbackPropName } from '../rewrite/rewriteScript.js';
import { collectSvelteImports } from '../rewrite/collectSvelteImports.js';
import { buildSlotTypeFields } from './refineSlotTypes.js';
import { emitPortals } from './emitPortals.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations (D-104/D-106) give
// those maps real positional content; non-annotated scaffolding falls back
// to nearest-segment via the surrounding shell map (D-102).
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
  sourceFileName: '<rozie>',
};

// Used only when emitting the residual (user-authored) statement block with
// source maps — a single t.Program generate call so we get one coherent map.
const GEN_OPTS_MAP: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/**
 * Phase 16 D-02 — Capitalize the first letter for `__default<Capitalized>`
 * factory-default cache name (e.g. prop `items` → `__defaultItems`).
 */
function capitalize(name: string): string {
  return name.length === 0 ? name : name[0]!.toUpperCase() + name.slice(1);
}

/**
 * Phase 14.1 follow-up — does any element in the IR template carry a
 * `spreadBinding` attribute? The Plan 14-05 gates at three sites in this
 * module only synthesise the `...__rozieAttrs` destructure (and its
 * accompanying Props interface index signature + the no-props-block
 * short-circuit) when `inheritAttrs !== false`. That's correct for
 * auto-fallthrough, but wrong for the explicit-manual case:
 * `inherit-attrs="false"` plus author-written `r-bind="$attrs"` produces a
 * `spreadBinding` whose template emit references `__rozieAttrs` — but the
 * destructure that declares it is gated off, so the rendered component hits
 * "__rozieAttrs is not defined" at runtime and the Svelte tree collapses.
 *
 * Mirrors the Lit + React fixes: `inherit-attrs="false"` only opts out of
 * auto-fallthrough, not out of the author's right to reference `$attrs`
 * explicitly via `r-bind="$attrs"`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function templateUsesSpreadBinding(node: any): boolean {
  if (node === null || node === undefined) return false;
  if (node.type === 'TemplateElement') {
    for (const a of node.attributes ?? []) {
      if (a.kind === 'spreadBinding') return true;
    }
    for (const c of node.children ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateConditional' || node.type === 'TemplateMatch') {
    for (const branch of node.branches ?? []) {
      for (const c of branch.body ?? []) {
        if (templateUsesSpreadBinding(c)) return true;
      }
    }
    if (node.hostElement && templateUsesSpreadBinding(node.hostElement)) return true;
    return false;
  }
  if (node.type === 'TemplateLoop') {
    for (const c of node.body ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateFragment') {
    for (const c of node.children ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateSlotInvocation') {
    for (const c of node.fallback ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  return false;
}

/**
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Building the arrow as a Babel node (rather than string-templating
 * `() => ${genCode(body)}`) lets @babel/generator auto-wrap ObjectExpression
 * bodies in parens, so `$computed(() => ({ x: 1 }))` emits `() => ({ x: 1 })`
 * instead of `() => { x: 1 }` (a BlockStatement with LabeledStatement
 * `x: 1`).
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
}

/**
 * SvelteScriptInjection — opaque token type that Tasks 2/3 append to. Mirrors
 * Vue's ScriptInjection — emitTemplate (Task 2) may add inline-debounce IIFEs
 * for template @event modifiers, emitListeners (Task 3) may add throttle
 * wrapper IIFEs. Plan 02a v1 emits ZERO injections from emitScript itself.
 *
 * Each injection has:
 *   - `decl`: a script-level `const X = (() => { ... })();` style declaration
 *   - `position`: where to splice it ('top' = before residual body, 'bottom' =
 *      after residual body, used for handlers that reference user-declared
 *      consts which would TDZ if hoisted)
 */
export interface SvelteScriptInjection {
  /** Stable name for the injected helper (used by callers to reference it). */
  name: string;
  /** Full declaration text (including trailing semicolon). */
  decl: string;
  /** Splice position relative to the residual <script> body. */
  position: 'top' | 'bottom';
}

/**
 * Render a PropTypeAnnotation as a TypeScript type string. Mirrors the Vue
 * target's renderType helper.
 */
function renderType(type: PropTypeAnnotation): string {
  if (type.kind === 'identifier') {
    switch (type.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      // Array/Object widen to `any[]` / `any` so user-authored params on
      // items / nodes don't surface as `'x' is of type 'unknown'` under
      // svelte-check. v1 IR doesn't carry element / property shape so we
      // can't narrow further; consumers can still annotate explicitly in
      // .rozie when they care (TYPES-01 / Phase 6 refines).
      case 'Array':
        return 'any[]';
      case 'Object':
        return 'any';
      case 'Function':
        return '(...args: any[]) => any';
      default:
        return type.name;
    }
  }
  if (type.kind === 'union') {
    return type.members.map(renderType).join(' | ');
  }
  if (type.kind === 'literal') {
    if (type.value === 'array') return 'any[]';
    if (type.value === 'object') return 'any';
    if (type.value === 'function') return '(...args: any[]) => any';
    return type.value;
  }
  return 'unknown';
}

/**
 * Build the `interface Props { ... }` body fields. Returns a list of indented
 * lines suitable for splicing inside `interface Props {\n${...}\n}`.
 *
 * Includes BOTH props and slots (per RESEARCH Pattern 1 + Pattern 3 — slots
 * are properties of the same Props type).
 */
function buildPropsInterfaceFields(ir: IRComponent): string[] {
  const lines: string[] = [];

  for (const p of ir.props) {
    let typeText = renderType(p.typeAnnotation);
    // When the declared default is `null`, broaden the type with `| null` so
    // the destructure `name = null` doesn't trip svelte-check (which sees
    // `Type 'null' is not assignable to type '...'`). Common case is
    // `Function`-typed props with `default: null` (CardHeader.onClose).
    // Parens are mandatory — without them `(...args: any[]) => any | null`
    // parses as `(...args: any[]) => (any | null)` (return-type union), not
    // a union of the function type with null.
    if (p.defaultValue !== null && t.isNullLiteral(p.defaultValue)) {
      typeText = `(${typeText}) | null`;
    }
    // 260521-oao — `p.required` is the SOLE optionality determinant: a
    // `required: true` prop drops the `?` and emits a non-optional field.
    // The destructure entry already emits a bare `name` (non-model) /
    // `$bindable()` (model) for no-default props, so no destructure change
    // is needed — the interface `?:` removal is the load-bearing change.
    const opt = p.required ? '' : '?';
    lines.push(`  ${p.name}${opt}: ${typeText};`);
  }

  // Slot fields share the Props interface — Snippet<[...]> typed.
  const slotLines = buildSlotTypeFields(ir.slots);
  for (const sl of slotLines) lines.push(sl);

  // Phase 07.3.1 D-SV-16 — accept consumer-side dynamic-name snippets map;
  // merged into named props via $derived in script body. The consumer-side
  // emitter (emitSlotFiller.ts:174) emits `snippets={{ [expr]: __rozieDynSlot_N }}`
  // for `<template #[dynamic]>` fills; without this prop the producer destructure
  // silently drops the dynamic projection.
  //
  // Typed as `Record<string, any>` (not `Record<string, Snippet<[any]>>`) so the
  // `const X = $derived(__XProp ?? snippets?.X)` merge below preserves the
  // per-slot Snippet signature from `__XProp`. A more specific Snippet<...>
  // would force the union into the more-strict shape and surface as
  // "Expected 1 arguments, but got 0" at every `{@render X?.()}` callsite for
  // zero-param slots (Card.children, TodoList.empty). Dynamic-name snippets
  // are inherently untyped — the fill expression is computed at runtime.
  if (ir.slots.length > 0) {
    lines.push('  snippets?: Record<string, any>;');
  }

  // Emit callback-prop declarations: $emit('search', x) was rewritten to
  // onsearch?.(x) by rewriteScript; the corresponding `onsearch?` prop must
  // be declared and destructured. Svelte 5 callback-prop convention is
  // ALL-LOWERCASE (e.g., `onclose`, `onsearch`) — NOT React's PascalCase
  // `onSearch`. v1 types args as `(...args: unknown[]) => void` since IR
  // doesn't carry per-emit arg types (Phase 6 TYPES-01 refines).
  //
  // Phase 07.7 fix — shared `svelteCallbackPropName` helper strips hyphens
  // from emit names before lowercasing. Without the strip, an emit like
  // `event-click` produced `onevent-click` (literal hyphen in identifier
  // position) — invalid TS syntax. Both this emit and rewriteScript's
  // $emit-lowering use the same helper to stay in lockstep.
  for (const e of ir.emits) {
    const onName = svelteCallbackPropName(e);
    lines.push(`  ${onName}?: (...args: unknown[]) => void;`);
  }

  // Plan 14-05 — when `inheritAttrs !== false`, declare an index signature so
  // the synthesised `...__rozieAttrs` rest destructure types as
  // `Record<string, unknown>`. The signature is permissive (`unknown` not
  // `any`) — consumer-facing typing stays strict for ALL declared props
  // above; only the rest bucket accepts arbitrary keys (mirrors Vue's
  // `$attrs: Record<string, unknown>` magic accessor / React's
  // `Omit<HTMLAttributes, …>` spread idiom).
  //
  // Phase 14.1 follow-up — the explicit-manual case (`inherit-attrs="false"`
  // + author-written `r-bind="$attrs"`) ALSO destructures `...__rozieAttrs`
  // via the gate-widen at `buildPropsDestructureEntries`; that destructure
  // needs a matching `Record<string,unknown>` slot on the Props interface or
  // svelte-check fails the rest pattern.
  if (ir.inheritAttrs !== false || templateUsesSpreadBinding(ir.template)) {
    lines.push('  [key: string]: unknown;');
  }

  return lines;
}

/**
 * Render the destructuring entries inside `let { ... }: Props = $props();`.
 *
 * Each prop becomes `name = defaultValue` or `name = $bindable(defaultValue)`
 * for `model: true`. Slot props (children + named) appear as bare names —
 * Svelte assigns the snippet to the destructured local; no default value.
 *
 * Per Pitfall 11: `$bindable()` props need an explicit `$bindable(...)` rune;
 * snippet props are immutable (we never emit reassignment to them).
 */
function buildPropsDestructureEntries(ir: IRComponent): string[] {
  const entries: string[] = [];

  for (const p of ir.props) {
    const dflt = p.defaultValue !== null ? genCode(p.defaultValue) : null;
    if (p.isModel) {
      // model: true → $bindable(default) wrapper. With NO default → $bindable().
      //
      // D-VR-04: `$bindable(x)` takes a *fallback value*, not a factory — so a
      // Rozie `default: () => []` factory must be INVOKED here, not passed
      // through verbatim. Passing the arrow through made `items` resolve to the
      // function itself, so `items.filter(...)` threw "filter is not a
      // function" on a bare-mounted Svelte component. Mirror the React target,
      // which emits the invoked `(() => [])()` form. A non-function default
      // (literal / identifier) is passed straight through.
      let inner = dflt !== null ? dflt : '';
      if (
        p.defaultValue !== null &&
        (t.isArrowFunctionExpression(p.defaultValue) ||
          t.isFunctionExpression(p.defaultValue))
      ) {
        inner = `(${dflt})()`;
      }
      entries.push(`${p.name} = $bindable(${inner})`);
    } else if (dflt !== null) {
      // Phase 16 D-02 — for factory defaults (() => [], () => ({...})), use the
      // module-init cached value `__default<Capitalized>` rather than re-
      // invoking the factory at every props re-read. The cache prelude lines
      // are emitted by `buildPropsFactoryDefaultPrelude` and inserted before
      // the destructure in `emitPropsBlock`. This is the once-per-instance
      // contract (mirrors Vue 3's withDefaults factory-default semantics).
      //
      // Without this change the destructure `let { e = (() => [])() } = $props()`
      // re-runs the factory on every render, breaking `props.e === props.e`
      // reference-equality across renders — the SortableList canary surface
      // for SPEC R1 D-02.
      //
      // Literal/identifier/null/primitive defaults pass through verbatim.
      const isFactory =
        p.defaultValue !== null &&
        (t.isArrowFunctionExpression(p.defaultValue) ||
          t.isFunctionExpression(p.defaultValue));
      const value = isFactory ? `__default${capitalize(p.name)}` : dflt;
      entries.push(`${p.name} = ${value}`);
    } else {
      // No default — bare destructure (Svelte will leave undefined).
      entries.push(p.name);
    }
  }

  // Slot prop destructures.
  //
  // Phase 07.3.1 D-SV-16 — when slots are present, rename each destructured
  // slot prop to a temp (`header: __headerProp`) so the script body can
  // declare a `$derived` merge (`const header = $derived(__headerProp ?? snippets?.header)`)
  // that prefers the statically-named consumer fill but falls back to the
  // dynamic-name `snippets` map entry. Also destructures `snippets` itself.
  // When `ir.slots.length === 0` we keep the legacy no-snippets shape — no
  // rename and no `snippets` entry, so non-slotted components are unaffected.
  if (ir.slots.length > 0) {
    for (const s of ir.slots) {
      const key = s.name === '' ? 'children' : s.name;
      entries.push(`${key}: __${key}Prop`);
    }
    entries.push('snippets');
  } else {
    // Default-slot sentinel still maps to `children`; bare names per Svelte
    // magic-prop convention. (Loop body is unreachable when slots.length === 0
    // but kept for clarity / future-proofing.)
    for (const s of ir.slots) {
      const key = s.name === '' ? 'children' : s.name;
      entries.push(key);
    }
  }

  // Emits → bare destructure of the normalized callback prop. Matches
  // the rewriteScript output (`onsearch?.(x)` / `oneventclick?.(x)`).
  // Phase 07.7 fix — shared svelteCallbackPropName helper strips hyphens.
  for (const e of ir.emits) {
    entries.push(svelteCallbackPropName(e));
  }

  // Plan 14-05 — cross-framework attribute fallthrough rest binding. When
  // `inheritAttrs !== false`, synthesise `...__rozieAttrs` so the
  // template-root `{...$attrs}` spread (synthesised by `synthesizeAttrsFallthrough`
  // in lower.ts AND any author-written `r-bind="$attrs"`) has a runes-mode-
  // compatible target. Svelte 5 runes-mode rejects the legacy `$$restProps`
  // identifier (`Cannot use \`$$restProps\` in runes mode`), so the rewrite
  // in `rewriteTemplateExpression.ts` lowers `$attrs` → `__rozieAttrs` and
  // this entry binds the rest. When `inheritAttrs === false`, no entry is
  // added (and the synthesis pass skips the spread injection per R5).
  //
  // Phase 14.1 follow-up — also synthesise when the template carries an
  // explicit `spreadBinding` (`r-bind="$attrs"`). Without this, the
  // template emit references `__rozieAttrs` (via the `$attrs` → `__rozieAttrs`
  // rewrite) while the destructure that declares it is gated off, so the
  // component crashes with "__rozieAttrs is not defined" at runtime.
  if (ir.inheritAttrs !== false || templateUsesSpreadBinding(ir.template)) {
    entries.push('...__rozieAttrs');
  }

  return entries;
}

/**
 * Phase 07.3.1 D-SV-16 — Emit one `$derived` line per slot that merges the
 * statically-named consumer fill (via `__<key>Prop`) with the dynamic-name
 * fill (via `snippets?.<key>`).
 *
 * Precedence rule (`__<key>Prop ?? snippets?.<key>`): the statically-named
 * consumer fill wins when both are present. This matches user intent —
 * `<template #header=...>` is the more specific binding compared with
 * `<template #[dynamicName]>` where `dynamicName === 'header'`.
 *
 * Returns `[]` when `ir.slots.length === 0` so the helper is a no-op for
 * non-slotted components (preserving byte-identical output for Counter etc.).
 */
function emitSlotDerivedMerges(ir: IRComponent): string[] {
  if (ir.slots.length === 0) return [];
  const lines: string[] = [];
  for (const s of ir.slots) {
    const key = s.name === '' ? 'children' : s.name;
    lines.push(`const ${key} = $derived(__${key}Prop ?? snippets?.${key});`);
  }
  return lines;
}

/**
 * Phase 16 D-02 — Build module-init factory-default cache prelude lines.
 *
 * For each non-model prop whose `default:` is an arrow / function expression,
 * emit `let __default<Capitalized> = (<factory>)();` so the destructure can
 * reference the cached value rather than re-invoking the factory on every
 * props re-read. This is the once-per-instance contract — `props.e ===
 * props.e` across consecutive renders (matches Vue 3's withDefaults
 * factory-default semantics).
 *
 * Empty array when no factory-default props are present.
 */
function buildPropsFactoryDefaultPrelude(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const p of ir.props) {
    if (p.isModel) continue;
    if (p.defaultValue === null) continue;
    if (
      !t.isArrowFunctionExpression(p.defaultValue) &&
      !t.isFunctionExpression(p.defaultValue)
    ) continue;
    const raw = genCode(p.defaultValue);
    lines.push(`let __default${capitalize(p.name)} = (${raw})();`);
  }
  return lines;
}

/**
 * Emit the Props interface + destructure block. Returns an empty string when
 * there are no props AND no slots.
 */
function emitPropsBlock(ir: IRComponent): string {
  // Plan 14-05 — even when no props/slots/emits, an `inheritAttrs !== false`
  // component needs the `...__rozieAttrs` rest binding so the synthesised
  // template-root `{...$attrs}` spread (lower.ts `synthesizeAttrsFallthrough`)
  // resolves. The condition below therefore considers attr-fallthrough as a
  // gating signal alongside the legacy props/slots/emits trio.
  //
  // Phase 14.1 follow-up — also widen the gate to the explicit-manual case
  // (`inherit-attrs="false"` + `r-bind="$attrs"`), which carries a
  // `spreadBinding` in the IR template.
  const hasAttrsFallthrough =
    ir.inheritAttrs !== false || templateUsesSpreadBinding(ir.template);
  if (
    ir.props.length === 0 &&
    ir.slots.length === 0 &&
    ir.emits.length === 0 &&
    !hasAttrsFallthrough
  ) {
    return '';
  }

  const fields = buildPropsInterfaceFields(ir);
  const entries = buildPropsDestructureEntries(ir);
  // Phase 07.3.1 D-SV-16 — per-slot merge lines spliced after the destructure.
  const mergeLines = emitSlotDerivedMerges(ir);
  // Phase 16 D-02 — factory-default cache prelude (`let __defaultX =
  // (<factory>)();` per factory-default prop). Emitted BEFORE the destructure
  // so the destructure can reference the cached name.
  const factoryDefaultPrelude = buildPropsFactoryDefaultPrelude(ir);

  const interfaceBlock = `interface Props {\n${fields.join('\n')}\n}`;

  // Multi-line destructure for readability when more than 2 entries.
  // Plan 14-05 — when the last entry is the `...__rozieAttrs` rest pattern,
  // the trailing-comma form `..., \n}` is a JS parse error
  // ("Comma is not permitted after the rest element"). Use a no-trailing-comma
  // form for the multi-line variant; the rest entry is ALWAYS last when it
  // exists (appended after props/slots/emits in buildPropsDestructureEntries).
  let destructure: string;
  if (entries.length <= 2) {
    destructure = `let { ${entries.join(', ')} }: Props = $props();`;
  } else {
    destructure = `let {\n  ${entries.join(',\n  ')}\n}: Props = $props();`;
  }

  const preludeBlock =
    factoryDefaultPrelude.length > 0
      ? `${factoryDefaultPrelude.join('\n')}\n\n`
      : '';
  const mergeBlock = mergeLines.length > 0 ? `\n\n${mergeLines.join('\n')}` : '';
  return `${interfaceBlock}\n\n${preludeBlock}${destructure}${mergeBlock}`;
}

/**
 * Emit `let foo = $state(initializer);` per StateDecl.
 */
function emitStateDecls(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const s of ir.state) {
    // Quick task 260520-w18 bug class 2 — an empty-array `<data>` initializer
    // (`files: []`) types as `let files = $state([])` → `never[]`, so
    // `files.map(f => f.id)` fails TS2339 ("Property 'id' does not exist on
    // type 'never'"). Engine wrappers routinely seed a `$data` array empty
    // and let the engine populate it. Annotate the empty-array literal case
    // with an explicit `: any[]` type annotation on the `let` binding.
    //
    // Phase 16-04 — `<data>` `null` initializer types as `let x = $state(null)`
    // → `null`, so `x = <number>` fails TS2322. SortableList keyboard re-land
    // uses `liftedIndex: null` and assigns a number. Mirrors Angular's
    // `signal<any>(null)` widening (Plan 16-01) and React's `useState<any>(null)`
    // widening — annotate the bare-null case with `: any`.
    let typeAnnotation = '';
    if (t.isArrayExpression(s.initializer) && s.initializer.elements.length === 0) {
      typeAnnotation = ': any[]';
    } else if (t.isNullLiteral(s.initializer)) {
      typeAnnotation = ': any';
    }
    lines.push(`let ${s.name}${typeAnnotation} = $state(${genCode(s.initializer)});`);
  }
  return lines;
}

/**
 * Emit `let foo = $state<DomType>();` per RefDecl.
 *
 * Element-tag → DOM type guess; mirrors Vue's emitTemplateRefs helper.
 * In Svelte 5 refs are bare let bindings; the template's `bind:this={foo}`
 * directive populates them. They MUST be `$state(...)` to be reactive when
 * read inside `$derived` / `$effect` blocks.
 */
function emitRefDecls(refs: RefDecl[]): string[] {
  const lines: string[] = [];
  for (const r of refs) {
    let domType = 'HTMLElement';
    switch (r.elementTag.toLowerCase()) {
      case 'input':
        domType = 'HTMLInputElement';
        break;
      case 'textarea':
        domType = 'HTMLTextAreaElement';
        break;
      case 'select':
        domType = 'HTMLSelectElement';
        break;
      case 'button':
        domType = 'HTMLButtonElement';
        break;
      case 'form':
        domType = 'HTMLFormElement';
        break;
    }
    lines.push(`let ${r.name} = $state<${domType} | undefined>(undefined);`);
  }
  return lines;
}

/**
 * Walk the cloned program and locate, for each ComputedDecl by name, the
 * corresponding initializer expression in the clone (post-rewrite).
 */
function findClonedComputedBodies(
  clonedProgram: t.File,
): Map<string, t.Expression | t.BlockStatement> {
  const out = new Map<string, t.Expression | t.BlockStatement>();
  for (const stmt of clonedProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init || !t.isCallExpression(d.init)) continue;
      if (!t.isIdentifier(d.init.callee) || d.init.callee.name !== '$computed') continue;
      const cb = d.init.arguments[0];
      if (!cb) continue;
      if (t.isArrowFunctionExpression(cb) || t.isFunctionExpression(cb)) {
        out.set(d.id.name, cb.body);
      }
    }
  }
  return out;
}

/**
 * Emit `const X = $derived(expr);` per ComputedDecl. Block-bodied computed
 * functions get `$derived.by(() => { ... })` per RESEARCH Pattern 1.
 */
function emitDerivedDecls(
  computedDecls: ComputedDecl[],
  clonedComputedBodies: Map<string, t.Expression | t.BlockStatement>,
): string[] {
  const lines: string[] = [];
  for (const c of computedDecls) {
    const body = clonedComputedBodies.get(c.name) ?? c.body;
    if (t.isBlockStatement(body)) {
      lines.push(`const ${c.name} = $derived.by(${arrowBody(body)});`);
    } else {
      // Plain Expression body — pass directly to $derived(expr) so reactivity
      // tracks the read sites in `expr`. ObjectExpression bodies render as
      // `$derived({ x: 1 })` which is valid (and tracks any reactive reads
      // inside the object literal).
      lines.push(`const ${c.name} = $derived(${genCode(body)});`);
    }
  }
  return lines;
}

/**
 * Quick plan 260515-u2b — emit `$effect(() => { (() => getter)(); (() => { cb; })(); })`
 * per top-level $watch call. Svelte 5's `$effect` auto-tracks any reactive
 * read inside its body; we IIFE-invoke the getter and the callback so:
 *   1. The getter's reads register the subscription on first run
 *   2. The callback fires both on first run AND on any subsequent re-trigger
 *      driven by getter signal changes
 *
 * Bug B fix (260519 linechart-watch-recreate) — the callback runs inside
 * `untrack(...)` so any reactive read that happens transitively (e.g. via a
 * helper `buildConfig()` that reads `$props.data`) is NOT pulled into the
 * watcher's dependency set. Only the getter defines what the watcher reacts
 * to — matching Vue's `watch(getter, cb)`, Solid's `on(getter, cb)`, and the
 * user's mental model. Without this, LineChart's `$watch($props.type)`
 * callback calls `buildConfig()` which reads `$props.data`; the data read
 * landed in the watcher's deps so it re-fired (and recreated the Chart.js
 * instance) on every data tick.
 *
 * Walks the cloned program; rewriteRozieIdentifiers already normalized
 * `$props.x` → `x` (post-destructure) and `$data.x` → bare-let-read.
 */
/**
 * 260602-9lw — detect a literal `{ immediate: true }` third argument on a cloned
 * `$watch(...)` call. Mirrors the core collector's parse discipline; any other
 * shape defaults to lazy. Re-read here because emitWatcherHooks walks the cloned
 * Program by source order rather than consuming `ir.watchers`.
 */
function watchCallIsImmediate(expr: t.CallExpression): boolean {
  const optionsArg = expr.arguments[2];
  if (!optionsArg || !t.isObjectExpression(optionsArg)) return false;
  for (const prop of optionsArg.properties) {
    if (!t.isObjectProperty(prop)) continue;
    if (prop.computed) continue;
    let key: string | null = null;
    if (t.isIdentifier(prop.key)) key = prop.key.name;
    else if (t.isStringLiteral(prop.key)) key = prop.key.value;
    if (key !== 'immediate') continue;
    if (t.isBooleanLiteral(prop.value) && prop.value.value === true) return true;
  }
  return false;
}

function emitWatcherHooks(
  clonedProgram: t.File,
): { lines: string[]; consumedIndices: Set<number>; needsUntrack: boolean } {
  const lines: string[] = [];
  const consumed = new Set<number>();
  let needsUntrack = false;
  let watchIdx = 0;
  const body = clonedProgram.program.body;
  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    if (!stmt || !t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) continue;
    if (expr.callee.name !== '$watch') continue;
    const getterArg = expr.arguments[0];
    const cbArg = expr.arguments[1];
    if (
      !getterArg ||
      (!t.isArrowFunctionExpression(getterArg) && !t.isFunctionExpression(getterArg))
    ) {
      continue;
    }
    if (
      !cbArg ||
      (!t.isArrowFunctionExpression(cbArg) && !t.isFunctionExpression(cbArg))
    ) {
      continue;
    }
    consumed.add(i);
    const getterCode = genCode(getterArg as t.Node);
    const cbCode = genCode(cbArg as t.Node);
    needsUntrack = true;
    const idx = watchIdx++;
    const immediate = watchCallIsImmediate(expr);
    // Wrap each in parens so the genCode emits a parenthesized arrow we can
    // immediately invoke as an IIFE inside the $effect block. Bind the
    // getter's evaluated value as the callback's first argument WHEN the
    // user-authored callback declares a parameter — otherwise svelte-check
    // flags "Expected 0 arguments, but got 1" for the `(() => {...})()` form.
    //
    // 260602-9lw — `$watch` is now LAZY by default on all six targets (REVERSES
    // the 260519 immediate-by-default contract). In Svelte 5 `$effect` fires
    // once at registration, so for the default (`!immediate`) we restore a
    // component-scope first-run gate (the `__rozieWatchInitial_N` flag that was
    // deleted in 260519). The getter still runs in tracking scope (subscribes);
    // the flag is read/written INSIDE `untrack(...)` so it does not subscribe
    // the effect to itself, and the callback is skipped on the first run.
    // `{ immediate: true }` keeps today's eager shape (callback fires at
    // registration).
    //
    // Bug B fix — the callback runs inside `untrack(...)` so transitive
    // reactive reads (a helper like `buildConfig()` reading `$props.data`) do
    // NOT subscribe the watcher. Only the getter defines the watcher's
    // dependency set — matching Vue/Solid/Angular/Lit.
    if (immediate) {
      if (cbParamCount(cbArg) > 0) {
        lines.push(
          `$effect(() => { const __watchVal = (${getterCode})(); untrack(() => (${cbCode})(__watchVal)); });`,
        );
      } else {
        lines.push(
          `$effect(() => { (${getterCode})(); untrack(() => (${cbCode})()); });`,
        );
      }
    } else {
      const flag = `__rozieWatchInitial_${idx}`;
      lines.push(`let ${flag} = true;`);
      if (cbParamCount(cbArg) > 0) {
        lines.push(
          `$effect(() => { const __watchVal = (${getterCode})(); untrack(() => { if (${flag}) { ${flag} = false; return; } (${cbCode})(__watchVal); }); });`,
        );
      } else {
        lines.push(
          `$effect(() => { (${getterCode})(); untrack(() => { if (${flag}) { ${flag} = false; return; } (${cbCode})(); }); });`,
        );
      }
    }
  }
  return { lines, consumedIndices: consumed, needsUntrack };
}

function cbParamCount(
  cbArg: t.ArrowFunctionExpression | t.FunctionExpression,
): number {
  return cbArg.params.length;
}

/**
 * Walk lifecycle hooks (D-19 paired) and emit lifecycle code per hook.
 * Returns lifecycle code lines + the SET of indices CONSUMED in
 * clonedProgram.body (so emitResidualScriptBody can skip them) + the set of
 * `'svelte'` runtime imports the emitted code needs (`onMount` / `onDestroy`).
 *
 * Lowering rules (260519 linechart-watch-recreate Bug B + D-19 + Pitfall 4):
 *   - `$onMount` lowers to `onMount(...)` from `'svelte'` — NOT `$effect`.
 *     `$effect` is a TRACKING context: any reactive read inside the mount
 *     body (directly, or transitively via a helper call like `buildConfig()`
 *     reading `$props.data`) subscribes the mount effect, so it re-runs on
 *     every data change and recreates engine instances (LineChart's Chart.js
 *     `new Chart()` re-fired every tick). `onMount`'s callback runs OUTSIDE
 *     any tracking scope and runs exactly once — matching Vue's `onMounted`,
 *     Lit's `firstUpdated`, and Angular's `ngAfterViewInit`. `onMount`
 *     natively supports a cleanup-return.
 *   - `$onUnmount` (standalone) lowers to `onDestroy(...)` from `'svelte'`.
 *   - `$onMount` + adjacent `$onUnmount` identifier pair → ONE `onMount` that
 *     returns the cleanup (Modal lockScroll/unlockScroll D-19 anchor).
 *   - `$onUpdate` STAYS a `$effect` — it IS the update phase: re-run on every
 *     tracked reactive change. Svelte's `$effect` auto-tracks signal reads.
 */
function emitLifecycleHooks(
  clonedProgram: t.File,
): { lines: string[]; consumedIndices: Set<number>; runtimeImports: Set<string> } {
  const lines: string[] = [];
  const consumed = new Set<number>();
  const runtimeImports = new Set<string>();

  const body = clonedProgram.program.body;

  for (let i = 0; i < body.length; i++) {
    if (consumed.has(i)) continue;
    const stmt = body[i];
    if (!stmt || !t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) continue;
    const calleeName = expr.callee.name;
    if (
      calleeName !== '$onMount' &&
      calleeName !== '$onUnmount' &&
      calleeName !== '$onUpdate'
    ) {
      continue;
    }

    const arg = expr.arguments[0];
    if (!arg) continue;
    consumed.add(i);

    if (calleeName === '$onUpdate') {
      // Update phase: re-run on every reactive change. Svelte's $effect
      // auto-tracks signal reads — a plain $effect(setup) IS update phase.
      lines.push(`$effect(() => (${genCode(arg as t.Node)})());`);
      continue;
    }

    if (calleeName === '$onUnmount') {
      // Standalone unmount (no preceding mount paired earlier). `onDestroy`
      // from 'svelte' runs the callback once at teardown — no tracking scope.
      runtimeImports.add('onDestroy');
      lines.push(`onDestroy(() => (${genCode(arg as t.Node)})());`);
      continue;
    }

    // calleeName === '$onMount' — emit `onMount(...)`; check for a paired
    // $onUnmount OR an inline cleanup-return inside an arrow callback.
    runtimeImports.add('onMount');

    if (t.isIdentifier(arg)) {
      // Identifier-pair case (Modal lockScroll/unlockScroll).
      let pairedIdx: number | null = null;
      let pairedCleanupName: string | null = null;
      for (let j = i + 1; j < body.length; j++) {
        if (consumed.has(j)) continue;
        const next = body[j];
        if (!next) continue;
        if (!t.isExpressionStatement(next)) break;
        const nextExpr = next.expression;
        if (
          t.isCallExpression(nextExpr) &&
          t.isIdentifier(nextExpr.callee) &&
          nextExpr.callee.name === '$onUnmount'
        ) {
          const cleanupArg = nextExpr.arguments[0];
          if (cleanupArg && t.isIdentifier(cleanupArg)) {
            pairedIdx = j;
            pairedCleanupName = cleanupArg.name;
          }
        }
        break;
      }

      if (pairedIdx !== null && pairedCleanupName !== null) {
        consumed.add(pairedIdx);
        // Modal D-19 anchor: ONE onMount block per pair; onMount returns the
        // cleanup function (Svelte invokes it on destroy).
        lines.push(
          `onMount(() => {\n  ${arg.name}();\n  return () => ${pairedCleanupName}();\n});`,
        );
        continue;
      }

      // No paired unmount — bare `onMount(() => identifier())`.
      lines.push(`onMount(() => { ${arg.name}(); });`);
      continue;
    }

    // arg is an arrow/function — check for inline cleanup-return.
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      const fnBody = arg.body;
      let cleanupExpr: t.Expression | null = null;
      let setupBody: t.BlockStatement | null = null;

      if (t.isBlockStatement(fnBody) && !arg.async) {
        const lastStmt = fnBody.body[fnBody.body.length - 1];
        if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
          cleanupExpr = lastStmt.argument;
          setupBody = t.blockStatement(fnBody.body.slice(0, -1));
        }
      }

      if (cleanupExpr && setupBody) {
        // onMount(() => { setupBody; return cleanupExpr; })
        // Reconstruct: emit the setup statements + a return statement holding
        // the cleanup expression. onMount runs the callback once and uses the
        // returned function as the destroy-time cleanup.
        //
        // Phase 09 rebuild-site audit (Pattern 4): `t.blockStatement([...])`
        // reuses `setupBody.body` statements by reference — any author `TS*`
        // annotation on a declaration / param / catch binding inside the
        // lifecycle setup body survives verbatim. This rebuilds a
        // BlockStatement, not a function, so there is no `returnType` /
        // `typeParameters` to drop. Every cloned setup/cleanup arrow elsewhere
        // in this emitter is passed whole to `genCode` (param annotations
        // survive); Svelte has no `t.functionDeclaration` /
        // `t.arrowFunctionExpression` rebuild of a USER function.
        const merged = t.blockStatement([
          ...setupBody.body,
          t.returnStatement(cleanupExpr),
        ]);
        lines.push(`onMount(${arrowBody(merged)});`);
        continue;
      }

      // No cleanup — invoke the arrow body inline as the onMount callback.
      // arrowBody handles BlockStatement vs Expression bodies (incl. the
      // ObjectExpression paren-wrap case).
      lines.push(`onMount(${arrowBody(fnBody)});`);
      continue;
    }

    // Fallback: emit as IIFE inside onMount.
    lines.push(`onMount(() => (${genCode(arg as t.Node)})());`);
  }

  return { lines, consumedIndices: consumed, runtimeImports };
}

/**
 * Collect residual top-level statements in source order — skipping computed
 * VariableDeclarators (handled by emitDerivedDecls) and lifecycle Expression-
 * Statements (handled by emitLifecycleHooks).
 *
 * Returns both the joined code string AND the raw statement array so the
 * caller can generate a single-program source map via GEN_OPTS_MAP.
 */
function emitResidualScriptBody(
  clonedProgram: t.File,
  consumedLifecycleIndices: Set<number>,
  exposeNames: Set<string>,
): { code: string; stmts: t.Statement[] } {
  const stmts: t.Statement[] = [];
  const body = clonedProgram.program.body;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    if (!stmt) continue;
    if (consumedLifecycleIndices.has(i)) continue;

    // Skip VariableDeclarations whose declarators are ALL $computed initializers.
    if (t.isVariableDeclaration(stmt)) {
      const allComputed =
        stmt.declarations.length > 0 &&
        stmt.declarations.every(
          (d) =>
            d.init &&
            t.isCallExpression(d.init) &&
            t.isIdentifier(d.init.callee) &&
            d.init.callee.name === '$computed',
        );
      if (allComputed) continue;
    }

    // Skip lifecycle ExpressionStatements (defensive; should already be in consumed).
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const callee = stmt.expression.callee;
      if (t.isIdentifier(callee)) {
        if (
          callee.name === '$onMount' ||
          callee.name === '$onUnmount' ||
          callee.name === '$onUpdate' ||
          // Quick plan 260515-u2b — $watch is consumed by emitWatcherHooks.
          callee.name === '$watch' ||
          // Phase 21 Plan 04 (REQ-6) — `$expose({...})` is a COMPILE-TIME
          // directive consumed via `ir.expose`; the matching `<script>`
          // functions are re-emitted below with an `export` modifier (Svelte 5
          // instance export). The `$expose(...)` call itself MUST be stripped
          // from the residual body — otherwise it leaks as an undefined-`$expose`
          // runtime reference. Mirrors the Vue + React strip.
          callee.name === '$expose'
        ) {
          continue;
        }
      }
    }

    stmts.push(stmt);
  }

  // Phase 21 Plan 04 (REQ-6) — mark-and-export (RESEARCH §B.Svelte option b):
  // a top-level user function whose name is in the `$expose` set becomes a
  // Svelte 5 instance export by prepending `export `. Applies ONLY to matching
  // top-level declarations:
  //   - `function name(...) {...}`         → `export function name(...) {...}`
  //   - `const name = (...) => {...}` / fn → `export const name = ...`
  // svelte-check infers the instance-export handle types from the function
  // signature (D-04, no explicit interface). When `exposeNames` is empty no
  // statement matches, so output is byte-identical to today.
  const code = stmts
    .map((s) => {
      if (exposeNames.size > 0 && isExposedTopLevelDecl(s, exposeNames)) {
        // Emit the instance export at the AST level rather than string-prepending
        // `export ` to `genCode(s)`. A bare `export ${generated}` orphans the
        // keyword when the declaration carries LEADING COMMENTS: @babel/generator
        // emits the comment block before the `function`/`const` keyword, so the
        // prefix produces the invalid `export // comment\nfunction name()` (the
        // declaration is then NOT exported). Wrapping in an ExportNamedDeclaration
        // and moving the leading comments onto the wrapper keeps `export` adjacent
        // to the keyword: `// comment\nexport function name()`.
        const exportDecl = t.exportNamedDeclaration(s as t.Declaration);
        exportDecl.leadingComments = s.leadingComments ?? null;
        s.leadingComments = null;
        return genCode(exportDecl);
      }
      return genCode(s);
    })
    .join('\n');
  return { code, stmts };
}

/**
 * Phase 21 Plan 04 (REQ-6) — true when `stmt` is a top-level user declaration
 * whose declared name is in the `$expose` set:
 *   - a `FunctionDeclaration` `function name(...) {...}`, or
 *   - a single-declarator `const/let name = <arrow|function-expression>`.
 *
 * The locked accept-set (21-01) guarantees every exposed name resolves to a
 * top-level `<script>` `FunctionDeclaration` or an arrow/function-valued
 * `const` (or an inline arrow, which carries no name and is never matched
 * here). Only those forms are eligible for the instance-export prefix.
 */
function isExposedTopLevelDecl(stmt: t.Statement, exposeNames: Set<string>): boolean {
  if (t.isFunctionDeclaration(stmt) && stmt.id && t.isIdentifier(stmt.id)) {
    return exposeNames.has(stmt.id.name);
  }
  if (t.isVariableDeclaration(stmt) && stmt.declarations.length === 1) {
    const d = stmt.declarations[0]!;
    if (
      t.isIdentifier(d.id) &&
      d.init &&
      (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
    ) {
      return exposeNames.has(d.id.name);
    }
  }
  return false;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — true when any slot has isPortal.
   * Informational; the actual extra imports are already spliced into the
   * scriptBlock by emitScript.
   */
  hasPortals: boolean;
  /** The script body (without surrounding `<script lang="ts">` tags). */
  scriptBlock: string;
  /** Pending injections — Plan 02a Task 2/3 append to this. v1 always empty. */
  scriptInjections: SvelteScriptInjection[];
  /**
   * Phase 06.1 P2 (D-100/D-101): source map for user-authored statements
   * (residual body), produced by @babel/generator with sourceMaps:true via a
   * single-program generate call. Maps positions in the generated residual
   * text back to the original .rozie source lines. The shell adjusts this
   * map's generated line numbers by userCodeLineOffset so the final map
   * references the correct .svelte output line numbers. Null when there are
   * no residual statements or no filename was provided.
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Number of lines in all sections assembled BEFORE the residual (user-code)
   * section. Used by buildShell to compute userCodeLineOffset — the total
   * number of output lines before the user-authored statements begin.
   */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

/**
 * Phase 06.1 P2 emitScript options.
 */
export interface EmitScriptOptions {
  /**
   * .rozie filename surfaced as `sourceFileName` on @babel/generator's
   * per-call output map (D-103). Defaults to '<rozie>' when omitted.
   */
  filename?: string;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string (the default) when the caller has no portal slots to scope.
   */
  portalScopeHash?: string;
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: SvelteScriptInjection[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Rewrite identifiers on the clone.
  rewriteRozieIdentifiers(cloned, ir, diagnostics);

  // 3. Compute Svelte imports based on IR shape (slots → Snippet).
  const importSet = collectSvelteImports(ir);
  const importLines: string[] = [];
  if (importSet.typeImports.size > 0) {
    const sorted = [...importSet.typeImports].sort();
    importLines.push(`import type { ${sorted.join(', ')} } from 'svelte';`);
  }

  // Portal-slot primitive (Spike 003) — synthesize PortalHost-based portal
  // closure for portal slots. Imports `mount`/`unmount` from 'svelte' and
  // `PortalHost` from '@rozie/runtime-svelte/PortalHost.svelte'.
  const portalsEmit = emitPortals(ir, opts.portalScopeHash ?? '');
  if (portalsEmit.hasPortals) {
    importLines.push(portalsEmit.extraImports.trimEnd());
  }

  // 4. Emit blocks in canonical order.
  const propsBlock = emitPropsBlock(ir);
  const stateLines = emitStateDecls(ir);
  const refLines = emitRefDecls(ir.refs);

  const clonedComputedBodies = findClonedComputedBodies(cloned);
  const derivedLines = emitDerivedDecls(ir.computed, clonedComputedBodies);

  const {
    lines: lifecycleLines,
    consumedIndices,
    runtimeImports: lifecycleRuntimeImports,
  } = emitLifecycleHooks(cloned);
  // Quick plan 260515-u2b — $watch lowering (emits `$effect(() => {...})`).
  const {
    lines: watcherLines,
    consumedIndices: watcherConsumed,
    needsUntrack,
  } = emitWatcherHooks(cloned);
  for (const idx of watcherConsumed) consumedIndices.add(idx);
  // Phase 21 Plan 04 (REQ-6) — the set of `$expose`d names; drives both the
  // `$expose(...)` call strip and the `export ` instance-export prefix in
  // emitResidualScriptBody. Empty set → byte-identical residual body.
  const exposeNames = new Set(ir.expose.map((e) => e.name));
  const { code: residualCode, stmts: residualStmts } = emitResidualScriptBody(
    cloned,
    consumedIndices,
    exposeNames,
  );

  // Bug B fix (260519 linechart-watch-recreate) — assemble the `'svelte'`
  // value-import line. `onMount` / `onDestroy` are emitted by emitLifecycleHooks
  // for mount/unmount-phase hooks (non-tracking lifecycle); `untrack` is
  // emitted by emitWatcherHooks to keep the $watch callback's transitive
  // reactive reads out of the watcher's dependency set. Runes
  // ($props/$state/$derived/$effect/$bindable) need no import.
  const valueImports = new Set<string>([...lifecycleRuntimeImports]);
  if (needsUntrack) valueImports.add('untrack');
  if (valueImports.size > 0) {
    const sorted = [...valueImports].sort();
    importLines.push(`import { ${sorted.join(', ')} } from 'svelte';`);
  }

  // 5. Assemble preamble sections (everything BEFORE the residual user code).
  const preambleSections: string[] = [];
  if (importLines.length > 0) preambleSections.push(importLines.join('\n'));
  if (propsBlock) preambleSections.push(propsBlock);
  if (stateLines.length > 0) preambleSections.push(stateLines.join('\n'));
  if (refLines.length > 0) preambleSections.push(refLines.join('\n'));

  // Count lines in preamble sections so shell can compute userCodeLineOffset.
  // Each section is joined with '\n\n' between sections; count newlines total.
  // When there IS a residual section, `scriptBlock = preambleText + '\n\n' + residualCode`.
  // The '\n\n' separator contributes 2 newlines:
  //   - 1st '\n' terminates the last preamble line
  //   - 2nd '\n' creates a blank separator line
  // So lines before residual = (newlines_in_preambleText + 1 lines) + 1 blank = N + 2.
  const preambleText = preambleSections.join('\n\n');
  const preambleSectionLines = preambleText.length > 0
    ? (preambleText.match(/\n/g) ?? []).length + 2  // +2: last preamble line + blank separator
    : 0;

  // 6. Assemble in canonical order with blank-line separators.
  // Residual body BEFORE derived/effect — DX-03 trust-erosion: console.log
  // appears near the top of <script>; user-declared consts (e.g., handler
  // arrows) are visible to subsequent $derived / $effect references.
  const sections = [...preambleSections];
  if (residualCode.trim().length > 0) sections.push(residualCode);
  // Portal-slot primitive — emit portal scaffolding before lifecycle so the
  // `portals` closure is in scope when user $onMount callbacks fire.
  if (portalsEmit.hasPortals) sections.push(portalsEmit.setupLines);
  if (derivedLines.length > 0) sections.push(derivedLines.join('\n'));
  if (lifecycleLines.length > 0) sections.push(lifecycleLines.join('\n'));
  // Quick plan 260515-u2b — watcher $effect blocks after lifecycle.
  if (watcherLines.length > 0) sections.push(watcherLines.join('\n'));

  const scriptBlock = sections.join('\n\n');

  // Generate a single-program source map for the residual (user-authored) statements.
  // These AST nodes carry correct .rozie line numbers from @babel/parser, so the
  // map produced here maps generated-output positions → actual .rozie lines.
  // buildShell will shift the generated lines by userCodeLineOffset so the final
  // map references the correct .svelte output line numbers.
  let scriptMap: EncodedSourceMap | null = null;
  if (residualStmts.length > 0 && opts.filename) {
    const genResult = generate(
      t.file(t.program(residualStmts)),
      { ...GEN_OPTS_MAP, sourceFileName: opts.filename },
    );
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  return {
    hasPortals: portalsEmit.hasPortals,
    scriptBlock,
    scriptInjections,
    scriptMap,
    preambleSectionLines,
    diagnostics,
  };
}
