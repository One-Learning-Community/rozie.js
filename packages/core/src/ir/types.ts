/**
 * RozieIR — framework-neutral intermediate representation (Plan 02-05 Task 1).
 *
 * This file holds the FULL IR type surface Phase 3+ target compilers consume.
 * Authored to match RESEARCH.md §"IR Shape" (lines 846-1099) verbatim. Three
 * shapes are LOCKED here:
 *
 *   - D-18 SlotDecl — fields { type, name, defaultContent, params, paramTypes?,
 *     presence, nestedSlots, sourceLoc }; Phase 4 React emitter MAY amend, but
 *     that amendment is a deliberate ROADMAP change. Snapshot test at
 *     fixtures/ir/SlotDecl-shape.snap plus type-level test in slot-shape.test.ts
 *     enforce the lock.
 *   - D-19 LifecycleHook — single paired node per $onMount/$onUnmount/$onUpdate.
 *     Pairing happens during IR-lowering (Plan 02-05 lowerScript) via
 *     extractCleanupReturn (from Plan 02-01 visitors.ts) — when an $onMount
 *     callback's body trails with a return-function, the returned function
 *     becomes the LifecycleHook.cleanup.
 *   - D-20 EventBinding.modifierPipeline — same shape consumed in both
 *     <listeners> entries and template @event bindings. Snapshot fixture pair
 *     fixtures/ir/D-20-{listeners,template}-context.snap asserts byte-identity
 *     modulo sourceLoc.
 *
 * Per IR-04 / REACT-03: IRComponent.setupBody.scriptProgram === ast.script.program
 * (referential equality — no clone). Phase 3+ target emitters traverse + rewrite
 * this Babel File without re-parsing. Risk 5 trust-erosion floor: console.log
 * survives parse → IR.
 *
 * Per D-08 collected-not-thrown: every IR node carries `sourceLoc: SourceLoc`
 * from its upstream AST source position; lowerers never throw on user input.
 *
 * Per D-09: every exported symbol is `@experimental`. Phase 6 promotes to @stable.
 *
 * @experimental — shape may change before v1.0
 */
import type { Expression, BlockStatement, TSType, File as BabelFile } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { ModifierPipelineEntry } from '../modifiers/ModifierRegistry.js';
import type { SignalRef } from '../reactivity/signalRef.js';
import type { IRNodeId } from '../reactivity/ReactiveDepGraph.js';

/**
 * Root IR node — output of lowerToIR. Phase 3+ target emitters consume this.
 *
 * @experimental — shape may change before v1.0
 */
export interface IRComponent {
  type: 'IRComponent';
  name: string;
  props: PropDecl[];
  state: StateDecl[];
  computed: ComputedDecl[];
  refs: RefDecl[];
  slots: SlotDecl[];
  emits: string[];
  /** D-19: ordered + paired. Each $onMount/$onUnmount/$onUpdate is one node. */
  lifecycle: LifecycleHook[];
  /**
   * Quick plan 260515-u2b — `$watch(getter, cb)` calls in source order.
   * Parallel to `lifecycle`. Empty array when no `<script>` block exists or
   * no `$watch` calls were collected.
   */
  watchers: WatchHook[];
  /** D-20: <listeners> block entries + template @event bindings, same shape. */
  listeners: Listener[];
  /** IR-04: preserved Babel Program (referential equality with ast.script.program). */
  setupBody: SetupBody;
  template: TemplateNode | null;
  styles: StyleSection;
  /**
   * Phase 06.2 P1 D-115 — declared via `<components>` block. Empty array
   * when no block is declared. Source-order via Map insertion (lowerComponents
   * builds a Map<string, ComponentDecl> internally then exports values()).
   */
  components: ComponentDecl[];
  sourceLoc: SourceLoc;
}

/**
 * ComponentDecl — Phase 06.2 P1 D-115.
 *
 * One per `<components>` block entry. Records the local PascalCase identifier
 * by which the parent template references the child component plus the
 * verbatim `.rozie` import path (no transitive resolution per D-122).
 *
 * Self-references (e.g., `TreeNode` inside `<rozie name="TreeNode">`) MAY
 * appear in `<components>`, but the lowering rule per D-114 routes the
 * outer-name match BEFORE the components-table match — `tagKind: 'self'`
 * wins. Redundant explicit self-imports are tolerated; they produce a
 * ROZ924 unused-entry warning (Task 4) only when never referenced.
 *
 * @experimental — shape may change before v1.0
 */
export interface ComponentDecl {
  type: 'ComponentDecl';
  /** PascalCase identifier from the `<components>` key (e.g., 'Modal'). */
  localName: string;
  /** Verbatim `.rozie` import path (e.g., './Modal.rozie'). */
  importPath: string;
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface PropDecl {
  type: 'PropDecl';
  name: string;
  typeAnnotation: PropTypeAnnotation;
  defaultValue: Expression | null;
  isModel: boolean;
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 */
export type PropTypeAnnotation =
  | { kind: 'identifier'; name: string }
  | { kind: 'union'; members: PropTypeAnnotation[] }
  | { kind: 'literal'; value: 'string' | 'number' | 'boolean' | 'function' | 'object' | 'array' };

/**
 * @experimental — shape may change before v1.0
 */
export interface StateDecl {
  type: 'StateDecl';
  name: string;
  initializer: Expression;
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 *
 * Cross-reference: D-21 reactivity model — `deps` is the SignalRef set
 * from ReactiveDepGraph (Plan 02-03). Phase 4 React emitter consumes
 * `deps` to populate `useMemo` dep arrays.
 */
export interface ComputedDecl {
  type: 'ComputedDecl';
  name: string;
  body: Expression | BlockStatement;
  deps: SignalRef[];
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface RefDecl {
  type: 'RefDecl';
  name: string;
  elementTag: string;
  sourceLoc: SourceLoc;
}

/**
 * SlotDecl — D-18 LOCKED.
 *
 * The single most expensive decision in the project to retrofit. Snapshot
 * test at fixtures/ir/SlotDecl-shape.snap is the runtime lock; type-level
 * assertion in slot-shape.test.ts is the compile-time lock.
 *
 * - `name === ''` is the default-slot sentinel (RESEARCH.md A1 — JSON-
 *   snapshottable; matches Vue's slot model).
 * - `defaultContent` is the inline fallback content (lifted SEPARATELY —
 *   not inlined into slot body); null when the <slot> element has no
 *   children.
 * - `params` are the slot params from `:propName="expr"` attributes on
 *   the <slot> element.
 * - `paramTypes` is reserved for `<script lang="ts">` support (deferred
 *   beyond v1).
 * - `presence` is `'always'` for unconditional slots and `'conditional'`
 *   for slots wrapped in `r-if="$slots.<name>"` — Phase 3+ React emitter
 *   uses this to gate the `Slots` render-prop signature.
 * - `nestedSlots` is recursive — slot composition can declare its own
 *   `<slot>` inside default content.
 *
 * Phase 4 React emitter MAY amend this shape; that amendment is a deliberate
 * ROADMAP change (NOT silent drift).
 *
 * @experimental — shape may change before v1.0
 */
export interface SlotDecl {
  type: 'SlotDecl';
  name: string;
  defaultContent: TemplateNode | null;
  params: ParamDecl[];
  paramTypes?: TSType[];
  presence: 'always' | 'conditional';
  nestedSlots: SlotDecl[];
  sourceLoc: SourceLoc;
}

/**
 * SlotFillerDecl — Phase 07.2.
 *
 * Attached to `TemplateElementIR.slotFillers` when the element is
 * `tagKind: 'component' | 'self'`. One entry per `<template #name>` directive
 * inside the component body, plus a synthetic `{ name: '' }` entry when the
 * component tag's non-`<template>` children form a default-slot shorthand
 * (D-03 / R3).
 *
 * `name === ''` is the default-slot sentinel matching `SlotDecl`'s convention.
 *
 * `paramTypes` is threaded from the producer's `SlotDecl.paramTypes` via the
 * IR cache lookup at lowering time (R4 / D-01). Empty (undefined) when the
 * producer is unresolvable or its `SlotDecl` has no `paramTypes` annotation —
 * type-flow degrades gracefully rather than blocking compilation.
 *
 * `isDynamic` + `dynamicNameExpr` cover R5 — `<template #[expr]>`. The
 * dynamic-name expression is the parsed `@babel/parser` Expression for the
 * bracketed text.
 *
 * Per Phase 07.1 / MODX-01 self-reference pattern, this shape MUST be exported
 * from the `@rozie/core` barrel (`packages/core/src/index.ts`) so target
 * packages import the type via the package specifier and not via a relative
 * path — the latter re-creates the `.d.ts` divergence bug 07.1 fixed.
 *
 * @experimental — shape may change before v1.0
 */
export interface SlotFillerDecl {
  type: 'SlotFillerDecl';
  /** Slot name; '' (empty string) is the default-slot sentinel matching SlotDecl. */
  name: string;
  /** Scoped destructure params from `<template #name="{ a, b }">`; empty when no scope-arg. */
  params: ParamDecl[];
  /** Threaded from producer SlotDecl.paramTypes via IR cache; undefined when unresolved. */
  paramTypes?: TSType[];
  /** Fill body — recursive TemplateNode tree the consumer wrote inside the directive. */
  body: TemplateNode[];
  sourceLoc: SourceLoc;
  /** R5 — `<template #[expr]>` dynamic-name form. */
  isDynamic?: boolean;
  /** Parsed JS expression for the bracketed dynamic name; only populated when isDynamic. */
  dynamicNameExpr?: Expression;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface ParamDecl {
  type: 'ParamDecl';
  name: string;
  valueExpression: Expression;
  sourceLoc: SourceLoc;
}

/**
 * LifecycleHook — D-19 LOCKED.
 *
 * One paired node per `$onMount`/`$onUnmount`/`$onUpdate` source-group.
 * Pairing happens at IR-lowering time (Plan 02-05 lowerScript), not here.
 * Each emitter sees a complete pair:
 *   - React → `useEffect(() => { setup; return cleanup; }, [...setupDeps])`
 *   - Vue   → `onMounted(setup) + onBeforeUnmount(cleanup)` (or `onUpdated`)
 *   - Svelte → `$effect(() => { setup; return cleanup; })`
 *   - Angular → `effect(() => { ...; onCleanup(cleanup) })` w/ `DestroyRef`
 *
 * Cleanup-return EXTRACTION happens in lowerScript at IR-lowering time:
 *   - `$onMount(() => { ...; return fn })` — `fn` lifts to `cleanup`
 *   - `$onMount(setup) + $onUnmount(cleanup)` adjacent at Program scope —
 *     pair into one node when (a) prior is `phase: 'mount'`, (b) prior
 *     setup is an Identifier, (c) prior has no inline cleanup-return
 *     (T-2-05-05 conservative pairing rule — Modal.rozie's
 *     lockScroll/unlockScroll meets all three).
 *   - `$onMount(async () => …)` — async returns Promise, never cleanup
 *     (emit ROZ105; cleanup remains undefined).
 *
 * @experimental — shape may change before v1.0
 */
export interface LifecycleHook {
  type: 'LifecycleHook';
  phase: 'mount' | 'unmount' | 'update';
  setup: BlockStatement | Expression;
  cleanup?: Expression;
  setupDeps: SignalRef[];
  sourceLoc: SourceLoc;
}

/**
 * WatchHook — quick plan 260515-u2b.
 *
 * One node per `$watch(() => getter, () => callback)` call collected at
 * Program top level in source order. Both `getter` and `callback` carry the
 * function BODY (BlockStatement or Expression) — emitters wrap the body back
 * into an arrow expression at emission time.
 *
 * `getterDeps` is computed by `ReactiveDepGraph` from the getter's body
 * (NOT the callback body) — same `computeExpressionDeps` algorithm that powers
 * `LifecycleHook.setupDeps`. React's `useEffect(cb, [...getterDeps])` consumes
 * this; Vue/Svelte/Solid/Angular/Lit ignore it (their effect primitives
 * auto-track reactive reads).
 *
 * @experimental — shape may change before v1.0
 */
export interface WatchHook {
  type: 'WatchHook';
  /** Body of the getter arrow: `() => $props.open` → the `$props.open` Expression. */
  getter: BlockStatement | Expression;
  /** Body of the callback arrow: `() => { reposition() }` → BlockStatement. */
  callback: BlockStatement | Expression;
  /** SignalRef[] computed from the getter body (NOT the callback). */
  getterDeps: SignalRef[];
  sourceLoc: SourceLoc;
}

/**
 * Listener — D-20 LOCKED.
 *
 * Both `<listeners>` block entries AND template `@event` attribute bindings
 * lower to this shape. The same `ModifierRegistry.get(name).resolve(args, ctx)`
 * call produces the same `modifierPipeline` array for the same modifier chain
 * in either context — `ctx.source` distinguishes for emitters.
 *
 * Snapshot fixture pair fixtures/ir/D-20-{listeners,template}-context.snap
 * asserts byte-identity (modulo sourceLoc).
 *
 * @experimental — shape may change before v1.0
 */
export interface Listener {
  type: 'Listener';
  target: ListenerTarget;
  event: string;
  modifierPipeline: ModifierPipelineEntry[];
  /** <listeners>-only; null for template @event. */
  when: Expression | null;
  handler: Expression;
  deps: SignalRef[];
  source: 'listeners-block' | 'template-event';
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 */
export type ListenerTarget =
  | { kind: 'global'; name: 'document' | 'window' }
  | { kind: 'self'; el: '$el' }
  | { kind: 'ref'; refName: string };

/**
 * SetupBody — IR-04 referential preservation.
 *
 * `scriptProgram` is the SAME Babel `File` node as `ast.script.program` (no
 * clone — identity equality test in scriptPreservation.test.ts). Phase 3+
 * target emitters traverse this Babel File and rewrite identifier references
 * (e.g., `$props.value` → `value` for React) without re-parsing. Per IR-04
 * Risk 5 trust-erosion floor: `console.log("hello from rozie")` survives
 * parse → IR verbatim.
 *
 * `annotations` tag top-level Program statements with their semantic role
 * (computed declarator / lifecycle call site / helper-fn / plain-decl) so
 * emitters can route nodes without re-walking the Program.
 *
 * Cross-mutation hazard (T-2-05-01): per-target emitters MUST clone the
 * Program before mutation if they need to mutate. Plan 05 documents this
 * but does not enforce immutability at runtime (Object.freeze on Babel
 * ASTs is too costly).
 *
 * @experimental — shape may change before v1.0
 */
export interface SetupBody {
  type: 'SetupBody';
  scriptProgram: BabelFile;
  annotations: SetupAnnotation[];
}

/**
 * @experimental — shape may change before v1.0
 */
export interface SetupAnnotation {
  nodeId: IRNodeId;
  kind: 'computed' | 'lifecycle' | 'helper-fn' | 'plain-decl';
}

/**
 * Template IR — recursive discriminated union.
 *
 * @experimental — shape may change before v1.0
 */
export type TemplateNode =
  | TemplateElementIR
  | TemplateConditionalIR
  | TemplateLoopIR
  | TemplateSlotInvocationIR
  | TemplateFragmentIR
  | TemplateInterpolationIR
  | TemplateStaticTextIR;

/**
 * @experimental — shape may change before v1.0
 */
export interface TemplateElementIR {
  type: 'TemplateElement';
  tagName: string;
  attributes: AttributeBinding[];
  /** Template @event bindings — D-20: same Listener shape as <listeners> entries. */
  events: Listener[];
  children: TemplateNode[];
  sourceLoc: SourceLoc;
  /**
   * Phase 06.2 P1 D-114/D-115 — annotates how the tag was resolved at lowering:
   *   - 'html'      — DOM tag, custom-element (kebab-case), or unmatched.
   *   - 'component' — PascalCase tag matched in the parent's `<components>` table.
   *   - 'self'      — PascalCase tag matched the outer `<rozie name=>` (recursion);
   *                   checked BEFORE the components table per D-114.
   */
  tagKind: 'html' | 'component' | 'self';
  /**
   * Phase 06.2 P1 D-115 — populated when `tagKind === 'component'`; carries the
   * resolved ComponentDecl for downstream emitters (so per-target shells can
   * synthesize `import` statements without re-walking the table).
   */
  componentRef?: ComponentDecl;
  /**
   * Phase 07.2 — consumer-side slot fills declared inside this component-tag
   * body. Populated only when `tagKind === 'component' | 'self'`. One entry per
   * `<template #name>` / `<template #name="{ params }">` / `<template #default>`
   * / `<template #[expr]>` directive plus an optional synthetic
   * `{ name: '' }` shorthand entry when non-`<template>` children form the
   * default-slot content (R3 / D-03).
   */
  slotFillers?: SlotFillerDecl[];
}

/**
 * AttributeBinding — three kinds:
 *
 *   - 'static' — `class="counter"`
 *   - 'binding' — `:class="{ x: y }"`
 *   - 'interpolated' — `class="card--{{ $data.x }}"` (Pitfall 11 / A4)
 *
 * Per Pitfall 11: Vue forbids `{{ }}` in attribute values; Rozie permits it.
 * Mixed static + binding segments are preserved in the segments array so
 * emitters can render the literal-template-string idiom.
 *
 * @experimental — shape may change before v1.0
 */
export type AttributeBinding =
  | { kind: 'static'; name: string; value: string; sourceLoc: SourceLoc }
  | {
      kind: 'binding';
      name: string;
      expression: Expression;
      deps: SignalRef[];
      sourceLoc: SourceLoc;
    }
  | {
      kind: 'interpolated';
      name: string;
      segments: Array<
        | { kind: 'static'; text: string }
        | { kind: 'binding'; expression: Expression; deps: SignalRef[] }
      >;
      sourceLoc: SourceLoc;
    };

/**
 * @experimental — shape may change before v1.0
 *
 * Captures `r-if` / `r-else-if` / `r-else` sibling-group as ONE node with
 * branches[]. The else branch's `test` is `null`.
 */
export interface TemplateConditionalIR {
  type: 'TemplateConditional';
  branches: Array<{
    test: Expression | null;
    deps: SignalRef[];
    body: TemplateNode[];
    sourceLoc: SourceLoc;
  }>;
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 *
 * Captures `r-for="item in items"` / `(item, idx) in items` shapes.
 * `keyExpression` is the parsed `:key` attribute on the same element.
 */
export interface TemplateLoopIR {
  type: 'TemplateLoop';
  itemAlias: string;
  indexAlias: string | null;
  iterableExpression: Expression;
  iterableDeps: SignalRef[];
  keyExpression: Expression | null;
  body: TemplateNode[];
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 *
 * <slot name="x" :prop="expr"> in template ⇒ TemplateSlotInvocationIR.
 * `args` are the per-slot scoped-slot args; `fallback` is the inline children.
 */
export interface TemplateSlotInvocationIR {
  type: 'TemplateSlotInvocation';
  slotName: string;
  args: Array<{ name: string; expression: Expression; deps: SignalRef[] }>;
  fallback: TemplateNode[];
  sourceLoc: SourceLoc;
  /**
   * Phase 07.2 D-06 — set during lowering traversal:
   *  - `'declaration'`: `<slot>` in normal template position (default;
   *    producer-side semantics — declares a slot the consumer can fill).
   *  - `'fill-body'`: `<slot>` appears inside a `SlotFillerDecl.body`
   *    (re-projection — relay the wrapper's incoming slot to the inner
   *    component).
   *
   * Required field — every emit pathway reads it. The lowerer sets it via
   * a sticky-downward `lowerInFillBody` flag on the recursion frame so
   * arbitrarily deep `<slot>`-inside-`SlotFillerDecl.body` nesting still
   * carries `'fill-body'` (Pitfall 5 — re-projection-in-re-projection).
   */
  context: 'declaration' | 'fill-body';
}

/**
 * @experimental — shape may change before v1.0
 */
export interface TemplateFragmentIR {
  type: 'TemplateFragment';
  children: TemplateNode[];
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface TemplateInterpolationIR {
  type: 'TemplateInterpolation';
  expression: Expression;
  deps: SignalRef[];
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface TemplateStaticTextIR {
  type: 'TemplateStaticText';
  text: string;
  sourceLoc: SourceLoc;
}

/**
 * @experimental — shape may change before v1.0
 *
 * Phase 1 produces a StyleAST with raw CSS text + per-rule loc + isRootEscape
 * flag. lowerStyles passes this through into the IR as scopedRules vs
 * rootRules. The actual postcss Rule type is heavyweight; we hold it as
 * `unknown` on disk and let emitters cast as needed (postcss is a peer dep
 * for emitters that need full AST rule walking).
 */
export interface StyleSection {
  type: 'StyleSection';
  scopedRules: unknown[];
  rootRules: unknown[];
  sourceLoc: SourceLoc;
}

// Re-export IRNodeId so consumers of this module get the full IR-relevant id
// surface from one import.
export type { IRNodeId } from '../reactivity/ReactiveDepGraph.js';
