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
import type {
  Expression,
  BlockStatement,
  TSType,
  File as BabelFile,
  Identifier,
  Pattern,
  RestElement,
} from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type {
  ModifierPipelineEntry,
  ModelModifierDescriptor,
} from '../modifiers/ModifierRegistry.js';
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
  /**
   * Phase 21 — `$expose({...})` method names in source order; `[]` when no
   * `$expose` call. NOT deduped via Set — `{ name, sourceLoc }` objects survive
   * in source order so emitters + the handle-type synthesizer can resolve each
   * name back to its `<script>` declaration. Every emitter branches on
   * `expose.length === 0` for a byte-identical-when-empty guarantee (D-02).
   */
  expose: ExposedMethod[];
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
  /**
   * Phase 14 R5 — cross-framework attribute fallthrough.
   *
   * `true` (the default) enables auto-fallthrough: consumer-passed attributes
   * that do NOT match a declared `<props>` entry are forwarded onto the
   * component's single root element by each target emitter. `false` disables
   * it — the author opts out via `<rozie inherit-attrs="false">` and is then
   * responsible for placing `r-bind="$attrs"` explicitly.
   *
   * Threaded from `BlockMap.rozie.inheritAttrs` in `lower.ts`: an absent
   * `<rozie>` attribute (key omitted under `exactOptionalPropertyTypes`)
   * lowers to `true` here.
   */
  inheritAttrs: boolean;
  /**
   * Phase 15 R5 — cross-framework LISTENER fallthrough.
   *
   * `true` (the default) enables auto-listener-fallthrough: consumer-passed
   * event listeners (`@click`, `@mouseenter`, …) that are NOT handled inside
   * the component are forwarded onto the component's single root element by
   * each target emitter. `false` disables it — the author opts out via
   * `<rozie inherit-listeners="false">` and is then responsible for placing
   * `r-on="$listeners"` explicitly.
   *
   * INDEPENDENT of `inheritAttrs`. The two flags toggle separately — a
   * component may auto-fallthrough listeners while opting out of attribute
   * fallthrough, or vice versa (SPEC R5 four-corner matrix lock).
   *
   * Threaded from `BlockMap.rozie.inheritListeners` in `lower.ts`: an absent
   * `<rozie>` attribute (key omitted under `exactOptionalPropertyTypes`)
   * lowers to `true` here.
   */
  inheritListeners: boolean;
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
 * PropDecl — one declared `<props>` entry.
 *
 * Requiredness is a THREE-STATE semantic, and `required` is its SOLE
 * determinant — `defaultValue` is orthogonal (mirrors the Vue Options-API
 * model):
 *
 *   (a) `required === true` AND `defaultValue === null` ⇒ REQUIRED — the
 *       consumer MUST pass the prop; emitters produce a non-optional prop
 *       contract (`name: T` / `input.required` / `!: T` / `defineModel(...,
 *       { required: true })`).
 *   (b) any prop carrying a `default:` (`defaultValue !== null`) ⇒ OPTIONAL,
 *       regardless of `required`. A `required: true` + `default:` pairing is
 *       incoherent — the default could never fire — so `lowerProps` DROPS the
 *       default (forces `defaultValue` to `null`) and emits a ROZ014 warning;
 *       the prop then behaves as case (a).
 *   (c) neither `required` nor `default:` ⇒ OPTIONAL — the consumer MAY omit
 *       the prop and the internal value is `T | undefined`.
 *
 * @experimental — shape may change before v1.0
 */
export interface PropDecl {
  type: 'PropDecl';
  name: string;
  typeAnnotation: PropTypeAnnotation;
  defaultValue: Expression | null;
  isModel: boolean;
  /**
   * `true` iff the `<props>` entry declared `required: true` (literal boolean
   * `true` — `false`, non-boolean values, and an absent key all yield
   * `false`). The SOLE determinant of prop requiredness; see the interface
   * JSDoc for the three-state semantic and the ROZ014 `required`+`default`
   * interaction.
   */
  required: boolean;
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
  /**
   * Portal-slot primitive (Spike 003). When `true`, the slot is NOT rendered
   * in the template — it exists only as a script-callable function via
   * `$portals.<name>(container, scope) => disposeFn`. Per-target emitters:
   *  - skip the matching TemplateSlotInvocationIR during template emit
   *  - synthesize a `portals` closure inside the mount-phase lifecycle hook
   *    that wraps the per-target imperative-render API
   *  - hoist a dispose-tracking Set at component scope so wrapper teardown
   *    bulk-disposes all in-flight portal mounts before destroying the engine
   *
   * Authored as `<slot name="event" portal :params="['arg']" />` in the
   * template; consumed as `<rozie-foo><template #event="{ arg }">…</template></rozie-foo>`
   * (Vue), `<Foo slotEvent={(s) => …} />` (React), etc.
   *
   * V1 constraint (REQ-5): portal slots are NOT reactive after mount. They
   * re-render only when the wrapper's script re-invokes them.
   *
   * Undefined === false (back-compat with pre-spike IRs).
   *
   * @experimental — added in Spike 003
   */
  isPortal?: boolean;
  /**
   * Portal-slot scope-key names declared via `:params="['name1', 'name2']"`
   * on the `<slot>` element. Only populated when `isPortal === true`. Used by
   * per-target emitters to type the scope parameter (each key → `unknown`).
   *
   * @experimental — added in Spike 003
   */
  portalParamNames?: string[];
  /**
   * Reactive portal-slot opt-in (Phase 33 / REQ-22). When `true`, the portal
   * slot re-renders IN PLACE as the wrapper's scope changes (no remount) —
   * the engine-driven `update(scope)` path, vs. the default mount-once portal
   * whose scope is frozen after first render (REQ-5). Only meaningful when
   * `isPortal === true`; the parser gates this flag on `isPortal`, so a bare
   * `reactive` attribute without `portal` is inert and never sets it.
   *
   * Authored as `<slot name="event" portal reactive :params="['arg']" />`.
   *
   * Undefined === false (back-compat). Non-reactive slots keep the existing
   * `() => void` portal emit shape — this is purely additive (REQ-22).
   *
   * @experimental — added in Phase 33
   */
  isReactive?: boolean;
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
  /**
   * Phase 07.5 — threaded from producer SlotDecl.isPortal via threadParamTypes.
   * When true, the consumer-side emitter (Lit specifically) emits a
   * function-prop `.<slotName>=${fn}` form instead of `<element slot="X">`
   * light-DOM projection. Cross-target: undefined === false (back-compat).
   */
  isPortal?: boolean;
  /**
   * Phase 07.5 — count of scope params declared by the matching producer SlotDecl.
   * Threaded by threadParamTypes (matchingSlot.params.length). Lets the consumer-side
   * emitter distinguish 'consumer destructures scope' (filler.params.length > 0 AND
   * producerSlotParamCount > 0) from 'consumer destructures nothing' (filler.params.length === 0).
   * Undefined === 0 (back-compat).
   */
  producerSlotParamCount?: number;
  /**
   * Lit-target portal-slot member disambiguation. `true` iff the producer
   * declares a `<props>` entry whose name equals this filler's slot name —
   * which forces the Lit producer to suffix its portal-slot `@property` bridge
   * member with `Slot` (collision-gated) to avoid a duplicate-identifier
   * rolldown error. The Lit consumer-side emitSlotFiller must then emit the
   * matching `.<slotName>Slot=${fn}` property assignment (instead of the bare
   * `.<slotName>=`) so producer/consumer stay in lockstep. Threaded by
   * threadParamTypes from the producer's prop list. Undefined === false
   * (back-compat; non-Lit targets ignore it).
   */
  producerPropCollision?: boolean;
  /**
   * Phase 33 / REQ-26 — threaded from producer SlotDecl.isReactive via
   * threadParamTypes. True iff the matching producer slot is BOTH a portal AND
   * carries the opt-in `reactive` flag (`<slot name="X" portal reactive />`).
   *
   * The Solid consumer-side emitSlotFiller is the ONLY target that reads this:
   * a reactive portal slot's scope is passed to the consumer fill as a Solid
   * `Accessor` (a `() => scope` getter backed by the producer's signal), NOT a
   * pre-destructured value object. So the Solid filler must emit the arrow as
   * `(scopeAcc) => …body…` and rewrite each scope-param read to
   * `scopeAcc().<param>` so every read re-tracks on `setScopeSig` → the
   * consumer fragment re-renders IN PLACE (no remount). Mount-once portal slots
   * (isReactive falsy) keep the byte-identical destructured-value shape.
   *
   * Cross-target: every target other than Solid ignores this flag entirely;
   * undefined === false (back-compat).
   */
  isReactive?: boolean;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface ParamDecl {
  type: 'ParamDecl';
  name: string;
  /**
   * Local-binding rename: when the consumer wrote `{ key: localName }`,
   * `name === 'key'` and `bindAs === 'localName'`. Absent for the shorthand
   * `{ key }` form (where the local binding IS `key`).
   *
   * Emitters honor `bindAs` when rendering destructure patterns:
   *   - JS-destructure shape (React/Vue/Svelte/Solid/Lit): `{ name: bindAs }`
   *   - Angular `let-` shape: `let-<bindAs>="<name>"`
   *
   * Producer-side validation (threadParamTypes ROZ947) continues to match
   * against `name` (the producer's slot-key), NOT `bindAs` (consumer-local).
   */
  bindAs?: string;
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
 * ExposedMethod — Phase 21 ($expose imperative-handle sigil).
 *
 * One node per property key of a top-level `$expose({ a, b, ... })` call, in
 * source order. `name` is the canonical method name (shorthand `{ clear }` and
 * explicit `{ clear: clear }` both yield `'clear'`); `sourceLoc` points at the
 * `ObjectProperty` in the `$expose` argument so emitters + diagnostics can map
 * back to source. Each name references an in-scope `<script>` function (or an
 * inline arrow/function-expression value) — validated by `runExposeValidator`.
 *
 * @experimental — shape may change before v1.0
 */
export interface ExposedMethod {
  type: 'ExposedMethod';
  name: string;
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
  /**
   * Parameters declared on the callback arrow. For `(v) => instance?.option('x', v)`
   * this is `[Identifier('v')]`; for `() => reposition()` this is `[]`.
   *
   * Emitters MUST preserve these on the reconstructed callback arrow AND bind
   * the getter's evaluated value as the first argument when invoking the
   * callback. Otherwise references to the param inside the body resolve to
   * `undefined` (Svelte/Angular/Lit silent no-op) or throw `ReferenceError`
   * (Solid, where esbuild strips the param entirely when the arrow is
   * reconstructed with `[]`).
   */
  callbackParams: Array<Identifier | Pattern | RestElement>;
  /** SignalRef[] computed from the getter body (NOT the callback). */
  getterDeps: SignalRef[];
  /**
   * Quick plan 260602-9lw: `true` when the author opted into the eager initial
   * fire via `$watch(getter, cb, { immediate: true })`. When `false` (the
   * default), every target SKIPS the first callback invocation at mount and
   * fires only on subsequent reference-`!==` changes of the getter value.
   */
  immediate: boolean;
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
  | TemplateMatchIR
  | TemplateLoopIR
  | TemplateSlotInvocationIR
  | TemplateFragmentIR
  | TemplateInterpolationIR
  | TemplateStaticTextIR;

/**
 * ListenerSpreadIR — Phase 15 R2 / D-16.
 *
 * The listener-side mirror of Phase 14's `AttributeBinding.spreadBinding` — the
 * IR variant emitted for `r-on="<expr>"` (object-form only; the colon form
 * `r-on:click="x"` is ROZ972). Lives in a STANDALONE interface on a NEW
 * `TemplateElementIR.listenerSpreads` field (Pitfall 3), NOT as a 6th
 * `AttributeBinding` kind: the `Listener` shape (D-20) stays LOCKED, and the
 * `AttributeBinding` union stays at 5 kinds (Phase 14 `spreadBinding` is the
 * 5th and final).
 *
 * Listener spreads do NOT lower into synthetic `Listener` entries (SPEC R2) —
 * each emitter consumes `listenerSpreads` directly alongside `events: Listener[]`
 * to produce hybrid output: literal-key object expressions compile to native
 * single-event syntax at zero runtime cost (SPEC R7 literal half), while
 * dynamic (non-literal) expressions route through a per-target runtime helper.
 *
 * `literalKeys` is populated by Wave 1 lowering ONLY when `expression.type ===
 * 'ObjectExpression'` and at least one own key is parseable as
 * `eventName[.modifier(args)]…` via the existing `peggy` modifier grammar
 * (D-15). Dynamic-key spreads leave the field undefined — SPEC §Out-of-scope
 * explicitly leaves dynamic-key modifiers undefined for v1.
 *
 * Wave 0 only adds the type; lowerTemplate populates the field in Wave 1.
 *
 * @experimental — shape may change before v1.0
 */
export interface ListenerSpreadIR {
  type: 'ListenerSpread';
  expression: Expression;
  deps: SignalRef[];
  sourceLoc: SourceLoc;
  /**
   * Per-key resolved-modifier metadata for literal-key `r-on` object
   * expressions. Populated by Wave 1 (Plan 15-02) lowerTemplate's r-on branch
   * when `expression` is an ObjectExpression and a key matches the
   * `eventName[.modifier(args)]…` grammar; undefined otherwise (dynamic
   * spreads). Each entry mirrors one parseable property of the object
   * literal — `eventName` is the head (e.g. `'click'`), `modifierPipeline` is
   * the resolved chain (potentially empty), `valueExpr` is the property
   * value (the listener function expression).
   */
  literalKeys?: Array<{
    eventName: string;
    modifierPipeline: ModifierPipelineEntry[];
    valueExpr: Expression;
  }>;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface TemplateElementIR {
  type: 'TemplateElement';
  tagName: string;
  attributes: AttributeBinding[];
  /** Template @event bindings — D-20: same Listener shape as <listeners> entries. */
  events: Listener[];
  /**
   * Phase 15 R2 — `r-on="<expr>"` listener-spread bindings, parallel to
   * `events: Listener[]`. Each emitter must iterate this field alongside
   * `events` to produce listener-fallthrough output; TS exhaustiveness on the
   * downstream consumers is the enforcement mechanism. Empty array `[]` is
   * the no-spread default; Wave 1 (Plan 15-02) lowerTemplate populates it.
   */
  listenerSpreads: ListenerSpreadIR[];
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
  /**
   * `r-external` marker — the author has declared that third-party code may
   * mutate the DOM INSIDE this element (e.g. a SortableJS-bound list, a
   * TipTap-bound editor, a Leaflet-bound map container). Combined with the
   * `$reconcileAfterDomMutation()` sigil, this lets per-target emitters apply
   * a target-specific rebuild strategy for the marked element's children
   * WITHOUT touching the marked element itself — so third-party event
   * listeners attached to the marked element survive the rebuild.
   *
   * Per-target meaning:
   *   - Lit: emitter wraps the marked element's children in
   *     `keyed(this._rozieReconcileSeq ?? 0, …)`. The runtime helper
   *     `__rozieReconcileAfterDomMutation` bumps the seq, lit-html disposes
   *     the inner DOM (orphan elements left by external mutation, stale
   *     sentinel-comment positions) and rebuilds children with a fresh
   *     sentinel layout. The outer marked element is preserved by
   *     template-instance reuse.
   *   - Vue / React / Svelte / Solid / Angular: no emit effect; their
   *     keyed reconcilers diff against live `parent.children` at patch time
   *     and already cope with engine DOM mutation natively. The marker is
   *     a hint for editor tooling and a forward-compatible hook.
   */
  isExternal?: boolean;
}

/**
 * AttributeBinding — four kinds:
 *
 *   - 'static' — `class="counter"`
 *   - 'binding' — `:class="{ x: y }"`
 *   - 'interpolated' — `class="card--{{ $data.x }}"` (Pitfall 11 / A4)
 *   - 'twoWayBinding' — `r-model:propName="$data.x"` (Phase 07.3 TWO-WAY-01)
 *
 * Per Pitfall 11: Vue forbids `{{ }}` in attribute values; Rozie permits it.
 * Mixed static + binding segments are preserved in the segments array so
 * emitters can render the literal-template-string idiom.
 *
 * The `twoWayBinding` variant is emitted ONLY by the consumer-side
 * `r-model:propName="expr"` form (TWO-WAY-01) — bare `r-model="expr"` on
 * form inputs stays as `kind: 'binding'` with `name === 'r-model'`
 * (TWO-WAY-02 producer-side machinery is untouched). The 6 per-target
 * emitters (Wave 3) must add a discriminated branch for this kind — TS
 * exhaustiveness is the enforcement mechanism.
 *
 * Carrying fields:
 *   - `name` — the propName segment (the part after `r-model:`)
 *   - `expression` — parsed Babel Expression for the RHS (the writable lvalue)
 *   - `deps` — SignalRef[] for re-execution accounting (same as 'binding')
 *
 * Phase 12 — the `binding` and `twoWayBinding` kinds carry an optional
 * `modifiers` field: the RESOLVED r-model modifier chain (built-in or custom),
 * one `{ name, descriptor }` pair per `.modifier` token in source order. The
 * registry lookup happens at lower time, so this is a resolved representation
 * — never raw chain text. The field is OPTIONAL: bare `<input r-model>` (no
 * `.modifier`) sets nothing, so its IR stays byte-identical to pre-phase. A
 * built-in model modifier on a `twoWayBinding` (`r-model:propName`) is itself
 * a compile error (ROZ963) — the field exists on both kinds so the lowerer
 * can carry whatever it resolved before emitting that diagnostic.
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
      /**
       * Phase 12 — resolved r-model modifier chain (built-in or custom), in
       * source order. Optional/absent when no `.modifier` chain is present, so
       * bare `r-model` IR is byte-identical to pre-phase.
       */
      modifiers?: ResolvedModelModifier[];
      /**
       * Phase 26 (D-06/D-07) — the attribute-binding wrap/raw gate, mirroring
       * `TemplateInterpolationIR.wrapForDisplay`. `true` → wrap the bound value
       * in `rozieDisplay(...)` on the five non-Vue targets; `false` → provably
       * primitive (raw) OR `safeInterpolation` off. Default `true`
       * (wrap-when-unsure); set by the `annotateDisplayWrap` pass.
       */
      wrapForDisplay?: boolean;
    }
  | {
      kind: 'interpolated';
      name: string;
      segments: Array<
        | { kind: 'static'; text: string }
        | {
            kind: 'binding';
            expression: Expression;
            deps: SignalRef[];
            /**
             * Phase 26 (D-06/D-07) — class-interpolation segment wrap/raw gate
             * (e.g. `class="card--{{ $data.x }}"`). Same semantics as
             * `TemplateInterpolationIR.wrapForDisplay`. Default `true`
             * (wrap-when-unsure); set by the `annotateDisplayWrap` pass.
             */
            wrapForDisplay?: boolean;
          }
      >;
      sourceLoc: SourceLoc;
    }
  | {
      kind: 'twoWayBinding';
      /** The propName segment after `r-model:` — never empty (empty is ROZ950). */
      name: string;
      /** Parsed RHS expression — caller validates writability via `isWritableLValue`. */
      expression: Expression;
      deps: SignalRef[];
      sourceLoc: SourceLoc;
      /**
       * Phase 12 — resolved r-model modifier chain (consumer-side
       * `r-model:propName`). Optional/absent when no `.modifier` chain is
       * present. A BUILT-IN model modifier here is a compile error (ROZ963).
       */
      modifiers?: ResolvedModelModifier[];
    }
  /**
   * Phase 14 R2 / D-07 — the `spreadBinding` kind: `r-bind="<expr>"` in the
   * bare (non-colon) form. The expression evaluates to an object whose own
   * enumerable keys are each applied as an attribute on the host element.
   *
   * INVARIANT — the name-less member. Unlike every other `AttributeBinding`
   * kind (`static` / `binding` / `interpolated` / `twoWayBinding`), this
   * member deliberately carries NO `name` field and NO `modifiers` field: a
   * spread binds an open-ended object, not a single named attribute. Any
   * emitter helper that buckets `AttributeBinding`s by `.name` (e.g. a
   * `bucket()`-by-name pass) MUST guard against `kind === 'spreadBinding'`
   * before reading `.name`, or TypeScript's exhaustiveness check will flag it.
   */
  | {
      kind: 'spreadBinding';
      expression: Expression;
      deps: SignalRef[];
      sourceLoc: SourceLoc;
    };

/**
 * ResolvedModelModifier — Phase 12. One entry of the resolved r-model
 * modifier chain carried on an `AttributeBinding`.
 *
 * `name` identifies which modifier (for emitters + tests); `descriptor` is
 * the resolved `ModelModifierDescriptor` shape (the `$v`-placeholder
 * value-transform fragment and/or the `eventSwap` flag) the registry's
 * `ModelModifierImpl.resolve()` produced. This is a RESOLVED representation —
 * the registry lookup already happened at lower time.
 *
 * @experimental — shape may change before v1.0
 */
export interface ResolvedModelModifier {
  name: string;
  descriptor: ModelModifierDescriptor;
}

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
 * Phase 11 — captures the `r-match` / `r-case` / `r-default` switch-style
 * construct as ONE node. It deliberately parallels `TemplateConditionalIR`:
 * its `branches[]` is byte-identical to `TemplateConditionalIR.branches[]`,
 * so each per-target `emitConditional` can lower it with zero bespoke match
 * logic (D-02).
 *
 * Per D-01 all semantic work is folded in core during lowering:
 *   - each `r-case` branch's `test` is a ready-to-emit Babel expression
 *     (`discriminant === caseValue`, an `||`-chain of `===` comparisons for
 *     comma alternatives, or a bare / negated predicate for the
 *     literal-boolean discriminant special case);
 *   - `r-default` is the only branch whose `test` is `null`.
 *
 * Per D-03 the discriminant is shape-classified during lowering:
 *   - a bare `Identifier` / `MemberExpression` → `discriminantMode: 'inline'`
 *     (the discriminant is substituted directly into each branch test;
 *     `tempName` is absent);
 *   - a `CallExpression` (or otherwise non-trivial expression) →
 *     `discriminantMode: 'hoist'`, with `tempName` a per-component-unique
 *     identifier (`__rozieMatch_0`, `_1`, …) so the discriminant evaluates
 *     exactly once and nested matches never collide.
 */
export interface TemplateMatchIR {
  type: 'TemplateMatch';
  /**
   * The `r-match` discriminant. Carried for the hoist wrapper (D-04); for the
   * `inline` mode it is already folded into each branch test, so emitters only
   * reference it directly in the `hoist` path.
   */
  discriminant: Expression;
  /** D-03 — `'inline'` (Identifier/MemberExpression) | `'hoist'` (CallExpression/other). */
  discriminantMode: 'inline' | 'hoist';
  /** D-03 — per-component-unique temp name; present iff `discriminantMode === 'hoist'`. */
  tempName?: string;
  /**
   * D-01 — conditional-shaped branches; byte-identical to
   * `TemplateConditionalIR.branches`. Each `test` is already folded; `null`
   * marks the `r-default` branch.
   */
  branches: Array<{
    test: Expression | null;
    deps: SignalRef[];
    body: TemplateNode[];
    sourceLoc: SourceLoc;
  }>;
  /**
   * The wrapper element for a real-element host (`<div r-match>`); `undefined`
   * for a non-rendering `<template r-match>` host.
   */
  hostElement?: TemplateElementIR;
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
  /**
   * Portal-slot primitive (Spike 003). When `true`, the slot was authored
   * with the `portal` boolean attribute and per-target template emitters
   * MUST skip rendering this invocation — portal slots are invoked from
   * script via `$portals.<name>`, not from the template tree.
   *
   * Undefined === false.
   *
   * @experimental — added in Spike 003
   */
  isPortal?: boolean;
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
  /**
   * Phase 26 (D-06/D-07) — the wrap/raw gate for `{{ }}` text interpolation on
   * the five non-Vue targets.
   *
   *   - `true`  → wrap in `rozieDisplay(...)` on React/Solid/Svelte/Lit/Angular
   *               (a non-primitive value renders portable pretty-printed JSON
   *               instead of crashing React / printing `[object Object]`).
   *   - `false` → the expression provably resolves to `string|number|boolean`
   *               (raw, byte-identical to pre-phase emit) OR the effective
   *               `safeInterpolation` flag is off (no wrap on any interpolation).
   *
   * Default `true` (wrap-when-unsure). Set to `false` ONLY by the
   * `annotateDisplayWrap` pass when the expression is provably primitive. The
   * invariant: a false-wrap is behavior-neutral; a false-raw re-introduces the
   * React object-child crash — so the gate defaults to wrap on ANY uncertainty.
   */
  wrapForDisplay: boolean;
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
  /**
   * Spike 004 — `@portal NAME { ... }` blocks (StyleRule with
   * `kind: 'portal-block'`). Each carries `portalName` + flattened `children`.
   * Target emitters rewrite each child selector to
   * `[data-rozie-portal-<NAME>="<scopeHash>"] <selector>`. `unknown[]` matches
   * the erased-type convention used by `scopedRules`/`rootRules`.
   */
  portalRules: unknown[];
  /**
   * Phase 34 — the engine-DOM escape hatch: `:root { .sel { ... } }` blocks
   * (StyleRule with `kind: 'root-block'`). Each carries flattened bare
   * `children` (NO `:root` wrapper, NO scope attr). The Wave 2 emitters route
   * these unscoped/global as-written so they reach runtime engine-rendered DOM
   * (e.g. CodeMirror's `.cm-*`) across all six targets, replacing the
   * cross-target-half-supported `:global()` (now ROZ128). `unknown[]` matches
   * the erased-type convention used by `scopedRules`/`rootRules`/`portalRules`
   * (emitters cast to `StyleRule[]`).
   */
  engineRules: unknown[];
  sourceLoc: SourceLoc;
}

// Re-export IRNodeId so consumers of this module get the full IR-relevant id
// surface from one import.
export type { IRNodeId } from '../reactivity/ReactiveDepGraph.js';
