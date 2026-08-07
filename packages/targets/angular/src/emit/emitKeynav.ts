/**
 * emitKeynav — Phase 71 Plan 09 (Angular target — highest blast radius,
 * Landmine 3), reworked by Phase 77 Plan 05 from one-plan-per-component to
 * one-plan-per-root (77-SPEC.md §6, §7.3), mirroring the React reference's
 * Plan 77-03 rework (also replicated by Vue/Svelte/Solid Plan 77-04, Lit
 * Plan 77-05 Task 1).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02, extended Phase 77 Plan 02 with
 * `grid`/`groupIndex`/`indexExpression`) to an INLINE controller emitted
 * directly into the component class — per the 71-01 Wave-2 binding decision,
 * there is NO dedicated Angular runtime package for this primitive, and
 * SPEC §6/§7.3 keep it that way for Phase 77 too. The heavy keydown/
 * typeahead state-machine logic is
 * still NOT duplicated per component: this module imports
 * `createKeynavStateMachine`/`normalizeClassTokens` from the framework-
 * neutral `@rozie/runtime-keynav-core` (Plan 71-03, grid branch Plan 77-01)
 * and generates only a thin bridge — the SAME hybrid architecture (SPEC §8)
 * every other target's dedicated controller implements, expressed here as
 * generated class members instead of a hand-authored runtime package.
 *
 * Two responsibilities, resolved ONCE per component:
 *
 *   1. `resolveKeynavPlans(ir)` — locates EVERY `keynavRoot` element in the
 *      component and, for each, the FIRST `keynavItem` associated to THAT
 *      root (via `KeynavItemIR.groupIndex`, defaulting to 0 — core's
 *      `resolveKeynavGroups` owns the association rule; the emitter never
 *      re-derives containment) + its enclosing `r-for` loop. Returns one plan
 *      per root, in document order. Returns `[]` for the overwhelming
 *      majority case (no `r-keynav` in the component) — every call site
 *      below short-circuits on an empty array, so a non-keynav component's
 *      emit is completely untouched (SPEC §7.4: "no corpus rebless").
 *
 *   2. `buildKeynavClassEmission(plans, ir, listenerOpts)` — generates the
 *      class-body wiring for ALL resolved plans at once (field decls +
 *      `ngAfterViewInit` instantiation/delegation + a constructor `effect()`
 *      per root), consumed by `emitScript.ts` the SAME way it already
 *      consumes `emitPortals`'s `PortalsEmit` shape — reuse of an
 *      established integration seam, not a new one. Taking the WHOLE plans
 *      array (rather than being called once per plan) keeps `emitScript.ts`'s
 *      call site a SINGLE call, and lets this module de-duplicate the ONE
 *      genuinely shared piece of infrastructure across roots — the injected
 *      `Renderer2` (see `RENDERER_FIELD` below).
 *
 * **Identifier naming (mirrors the React reference exactly):** the group-id/
 * root-ref/controller-var/sync-method identifiers keep their PRE-PHASE-77
 * spelling for group index 0 and append the index for later groups
 * (`__rozieKeynavGroupId` / `__rozieKeynavGroupId1` / `__rozieKeynavGroupId2`
 * …) — the mechanism that keeps a single-root, non-grid component's emitted
 * identifiers unchanged from pre-Phase-77.
 *
 * ANGULAR-SPECIFIC DIVERGENCES FROM THE OTHER FIVE TARGETS (Phase 71,
 * unchanged in shape by Phase 77):
 *
 *   - **Two expression-rewrite contexts**, mirroring the Vue reference's
 *     identical split: `rewriteListenerExpression` (SCRIPT context — `this.`
 *     prefixed, signal-call reads, `.set()` writes) for everything wired into
 *     `ngAfterViewInit`/the constructor `effect()` (getSource/getActive/
 *     setActive/commit/page/gridColumns/activeClass), and
 *     `rewriteTemplateExpression` (TEMPLATE context — bare, no `this.`) for
 *     the `keynavRootAttrs`/`keynavItemAttrs` template-attribute fragments.
 *
 *   - **Grid columns are embedded DIRECTLY in `config.grid`, not a SIBLING
 *     controller option** — unlike React/Vue/Svelte/Solid/Lit's dedicated
 *     hook/controller wrapper (whose `config` object is captured ONCE at
 *     mount, so a reactive columns closure inside it would go stale across
 *     re-renders), Angular's `createKeynavStateMachine(host, config)` call
 *     happens exactly ONCE inside `ngAfterViewInit` — there is no
 *     "controller options object the wrapper re-reads every render" concept
 *     here at all, since Angular has no per-render re-invocation the way
 *     React does. `config.grid.columns` is still a CLOSURE
 *     (`() => this.cols()`), not a captured value, so it reads the LIVE
 *     signal on every keydown exactly like every other target's design —
 *     it just doesn't need the sibling-option indirection to stay live,
 *     because the closure itself is the live part. Follows the standing
 *     Angular constraint that a columns EXPRESSION must be a pure
 *     expression (never inline-arrow inside a TEMPLATE interpolation) — this
 *     is SCRIPT-context generated code, not a template binding, so an arrow
 *     here is ordinary valid TS; the `.grid(<expr>)` grammar (SPEC §10.5.2)
 *     only accepts a `$`-prefixed dotted path, which always rewrites to a
 *     single bare signal-call read, so no method-hoisting is needed in
 *     practice for the shapes the parser can produce.
 *
 *   - **The state machine is constructed ONCE in `ngAfterViewInit`; root
 *     keydown/pointer/focusin delegation is a REACTIVE, identity-diffed
 *     re-attach (Plan 77-10, KNG-06)** — `viewChild()` signals return
 *     `undefined` until after view init, so the class field itself is
 *     declared eagerly and `createKeynavStateMachine(...)` is assigned once
 *     `ngAfterViewInit` runs (the machine's only internal state is a
 *     typeahead buffer that never captures the root element, so
 *     re-constructing it per root identity would needlessly reset
 *     typeahead — construct-once is safe). Root delegation, however, is NOT
 *     safe to do only once at mount time: a `r-keynav` root nested inside an
 *     `r-if`/`@if` branch may not exist yet at `ngAfterViewInit` time, or may
 *     disappear and a DIFFERENT root element may later take its place. The
 *     generated `__rozieKeynavAttachRoot{suffix}` arrow-field method reads
 *     the root through `viewChild()`, identity-diffs it against a tracked
 *     `__rozieKeynavAttachedRoot{suffix}` anchor (a no-op re-run when
 *     unchanged), detaches the previous `Renderer2.listen(...)` set via a
 *     stored `__rozieKeynavDetach{suffix}` teardown when the root identity
 *     changed, then re-attaches. It runs from a constructor `effect()`
 *     (auto-tracking the `viewChild()` signal read — so it re-fires the
 *     moment a conditional branch resolves a fresh root) AND once explicitly
 *     in `ngAfterViewInit` (mirroring the `__rozieKeynavSyncActive{suffix}`
 *     explicit-call precedent, 71-11: a constructor effect's first flush is
 *     not guaranteed to observe an already-resolved `viewChild()` signal).
 *     `DestroyRef.onDestroy(...)` registration is UNCONDITIONAL (not nested
 *     inside a root-present guard) so a root that never resolves, or
 *     resolves and later closes, still gets its detach/rAF-cancel/dispose
 *     run on component destroy. Because each root mints its OWN `viewChild()`
 *     ref (or reuses an author `ref=`) and `Renderer2.listen` attaches
 *     DIRECTLY on that root's `nativeElement` (never a shared delegation
 *     surface the way Lit's single shadow root forces), a multi-root
 *     component's per-group listeners are naturally scoped by ordinary DOM
 *     event bubbling — Angular needs NO `data-rozie-keynav-root` containment
 *     marker the way Lit does (see Lit's `emitKeynav.ts` module doc comment
 *     for the contrast).
 *
 *   - **The active-change imperative work (focus/scroll/`r-keynav-active-class`
 *     toggle) is a `constructor`-body `effect()`** — Angular's signal
 *     `effect()` auto-tracks the `getActive()`-equivalent signal read
 *     performed directly inside its callback. Phase 77 — a same-tick
 *     dataset swap (grid paging) may set the active index before the
 *     landing item exists in the DOM; `__rozieKeynavSyncActive` (per-group,
 *     suffixed) now schedules a SINGLE `requestAnimationFrame`-deferred
 *     retry (cancelled on a newer active-change and on `DestroyRef.onDestroy`,
 *     guarded so a stale pass never steals focus from a newer navigation) —
 *     mirrors the React reference's identical pattern, applied here to the
 *     71-11-fixed `ngAfterViewInit`-explicit-sync design rather than
 *     invented fresh. The pre-existing per-active-change body is UNCHANGED —
 *     it moves into an extracted `__rozieKeynavApplyActive` method the
 *     scheduling wrapper calls, so every pre-Phase-77 emitted line still
 *     appears verbatim, just inside a different method.
 *
 *   - **No dedicated Angular runtime package's hook/composable/primitive/
 *     controller exists to call, and Phase 77 keeps it that way** —
 *     `buildKeynavClassEmission`
 *     generates the field decls + `ngAfterViewInit` lines + constructor
 *     `effect()` text directly, one full set per resolved plan, EXCEPT the
 *     injected `Renderer2` field (`RENDERER_FIELD`), which is genuinely
 *     shared, stateless infrastructure — declared once (group index 0 only)
 *     and referenced bare (unsuffixed) by every group's delegation block.
 *
 * Plan 260806-lz7 — the tabindex model's first/redundant focus+scroll pass
 * (a fresh attach, or a root-identity change) is gated by
 * `@rozie/runtime-keynav-core`'s `focusIsWithinScope` strict-containment
 * predicate: it only runs when DOM focus is already inside the owning
 * component. Angular derives its anchor NATIVELY from a single shared
 * `inject(ElementRef)` field (`HOST_ELEMENT_FIELD`, declared once at group
 * index 0, like `RENDERER_FIELD`) — no threaded opts field, since the whole
 * component's own root element IS the exact component boundary. The
 * may-apply decision is computed ONCE per `syncMethod` invocation (not
 * inside `applyMethod`, which the deferred rAF retry calls a SECOND time
 * with the SAME active value — recomputing there would misclassify the
 * retry as a redundant pass instead of the navigation/guarded pass it is a
 * continuation of) and threaded down as a parameter. A genuine navigation
 * pass is never gated. See `focusGuard.ts`'s module doc comment for the full
 * rule.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  KeynavItemIR,
  KeynavRootIR,
  TemplateElementIR,
  TemplateLoopIR,
  TemplateNode,
} from '../../../../core/src/ir/types.js';
import {
  type RewriteListenerOpts,
  rewriteListenerExpression,
} from '../rewrite/rewriteListenerExpression.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` so they can never collide with a `<script>`-declared
// binding (mirrors the React/Vue/Solid/Lit references' identical
// convention). Group index 0 keeps the bare spelling; later groups append
// the index (see `suffixFor` below) — the mechanism that keeps single-root
// emit unchanged.
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';
/** Genuinely SHARED infrastructure — declared once (group 0 only), referenced bare by every group. */
const RENDERER_FIELD = '__rozieKeynavRenderer';
const CONTROLLER_VAR = '__rozieKeynavController';
const SYNC_ACTIVE_METHOD = '__rozieKeynavSyncActive';
const APPLY_ACTIVE_METHOD = '__rozieKeynavApplyActive';
const RAF_ID_FIELD = '__rozieKeynavRafId';
/**
 * Plan 77-10 (KNG-06 gap closure) — the identity-diff anchor for the
 * currently-attached root, the stored teardown for that attachment, and the
 * reactive attach/re-attach method itself. See this module's doc comment
 * ("Root delegation is a reactive, identity-diffed attach") for the full
 * rationale.
 */
const ATTACHED_ROOT_FIELD = '__rozieKeynavAttachedRoot';
const DETACH_FIELD = '__rozieKeynavDetach';
const ATTACH_ROOT_METHOD = '__rozieKeynavAttachRoot';
/**
 * Plan 260806-lz7 — the strict-containment focus guard's native anchor.
 * Genuinely SHARED infrastructure (like `RENDERER_FIELD`) — declared exactly
 * ONCE (group index 0) via `inject(ElementRef)`, and referenced bare
 * (unsuffixed) by every group's `applyMethod`. Angular has no
 * `getFocusScope` opts field the way the four fragment-target hooks/
 * composables do — the host component's OWN root element is the exact
 * component boundary, so this single injected ref is sufficient for every
 * group.
 */
const HOST_ELEMENT_FIELD = '__rozieKeynavHostEl';
/**
 * Plan 260806-lz7 — per-group last-focused-active bookkeeping, mirroring the
 * `lastFocusedActive` local every other target's implementation tracks.
 * Distinguishes a first/redundant pass (guarded by `focusIsWithinScope`)
 * from a genuine navigation pass (unconditional).
 */
const LAST_FOCUSED_FIELD = '__rozieKeynavLastFocused';
/**
 * Plan 260806-lz7 — per-group "has this attachment seen a REAL DOM
 * interaction (keydown/pointerdown/focusin) yet" flag. A value change alone
 * is NOT sufficient evidence of a navigation — a consumer may resolve its
 * true mount-time active index through an app-level effect deferred after
 * the initial render (date-picker's own `seedActiveDay`, one
 * `requestAnimationFrame` after mount), which looks identical to a real
 * navigation on a plain value diff — found via this plan's own Docker VR run
 * against @rozie-ui/date-picker.
 */
const HAS_INTERACTED_FIELD = '__rozieKeynavHasInteracted';

function suffixFor(groupIndex: number): string {
  return groupIndex === 0 ? '' : String(groupIndex);
}

export interface KeynavEmitPlan {
  /**
   * Phase 77 — document-order group index (0-based). `0` for a single-root
   * component (mirrors `KeynavRootIR.groupIndex`'s `undefined`-defaults-to-0
   * convention) — this is what keeps a single-root component's identifier
   * spelling and emitted config unchanged from pre-Phase-77.
   */
  groupIndex: number;
  rootElement: TemplateElementIR;
  keynavRoot: KeynavRootIR;
  itemElement: TemplateElementIR | null;
  itemLoop: TemplateLoopIR | null;
  /** `#…` template-ref identifier to emit on the root — reuses an author `ref="x"` when present. */
  rootRefVar: string;
  /** True when `rootRefVar` was FRESHLY synthesized (needs its own `viewChild()` field decl + `#…` template-ref). False when reusing an author-declared ref (already emits its own `viewChild()` field via the normal ref path). */
  mintedRootRef: boolean;
  /** Group-id field name shared by the root's `[attr.aria-activedescendant]` and every item's `[id]`. */
  groupIdVar: string;
}

function findStaticAttrValue(el: TemplateElementIR, name: string): string | null {
  for (const a of el.attributes) {
    if (a.kind === 'static' && a.name === name) return a.value;
  }
  return null;
}

interface FoundRoot {
  element: TemplateElementIR;
  keynavRoot: KeynavRootIR;
}

interface FoundItem {
  element: TemplateElementIR;
  keynavItem: KeynavItemIR;
  enclosingLoop: TemplateLoopIR | null;
}

/**
 * Mirrors `resolveKeynavGroups.collectKeynavNodes` (core) — the SAME
 * traversal shape (incl. `slotFillers` bodies, `TemplateMatch.hostElement`)
 * so a keynav marker inside a slot-fill body or match host is found exactly
 * the way core already validated it. Collects EVERY root and EVERY item (not
 * just the first, per Phase 77 — core's `resolveKeynavGroups` already did
 * the association work; this walk only needs to LOCATE the nodes core
 * already stamped `groupIndex` onto).
 */
function collectAllKeynavNodes(root: TemplateNode): {
  roots: FoundRoot[];
  items: FoundItem[];
} {
  const roots: FoundRoot[] = [];
  const items: FoundItem[] = [];

  const walk = (node: TemplateNode, enclosingLoop: TemplateLoopIR | null): void => {
    switch (node.type) {
      case 'TemplateElement': {
        if (node.keynavRoot) {
          roots.push({ element: node, keynavRoot: node.keynavRoot });
        }
        if (node.keynavItem) {
          items.push({ element: node, keynavItem: node.keynavItem, enclosingLoop });
        }
        for (const child of node.children) walk(child, enclosingLoop);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            for (const child of filler.body) walk(child, enclosingLoop);
          }
        }
        break;
      }
      case 'TemplateLoop':
        for (const child of node.body) walk(child, node);
        break;
      case 'TemplateFragment':
        for (const child of node.children) walk(child, enclosingLoop);
        break;
      case 'TemplateConditional':
        for (const branch of node.branches)
          for (const child of branch.body) walk(child, enclosingLoop);
        break;
      case 'TemplateMatch':
        for (const branch of node.branches)
          for (const child of branch.body) walk(child, enclosingLoop);
        if (node.hostElement) walk(node.hostElement, enclosingLoop);
        break;
      case 'TemplateSlotInvocation':
        for (const child of node.fallback) walk(child, enclosingLoop);
        break;
      // TemplateInterpolation / TemplateStaticText — leaves.
      default:
        break;
    }
  };

  walk(root, null);
  return { roots, items };
}

/**
 * Resolve the per-component keynav emission plans — ONE per `r-keynav` root,
 * in document order. Returns `[]` when the component has no `r-keynav`
 * root — the overwhelmingly common case, and the one that MUST stay
 * byte-identical to pre-Phase-71 emit (SPEC §7.4).
 */
export function resolveKeynavPlans(ir: IRComponent): KeynavEmitPlan[] {
  if (ir.template === null) return [];
  const { roots, items } = collectAllKeynavNodes(ir.template);
  if (roots.length === 0) return [];

  return roots.map((root) => {
    const groupIndex = root.keynavRoot.groupIndex ?? 0;
    const suffix = suffixFor(groupIndex);

    // Reuse an author-declared `ref="x"` on the SAME element when present —
    // Angular permits only one `#name` template-ref per element, so silently
    // overwriting an author's own ref would be a Rule-1-class bug. Mirrors
    // the React/Vue/Solid/Lit references' identical defensive check.
    const existingRef = findStaticAttrValue(root.element, 'ref');
    const mintedRootRef = !(existingRef !== null && ir.refs.some((r) => r.name === existingRef));
    const rootRefVar = mintedRootRef ? `${ROOT_REF_VAR}${suffix}` : existingRef!;

    // itemElement/itemLoop resolved per-group below, using the SAME `items`
    // collection filtered by this root's groupIndex.
    const itemsForGroup = items.filter((it) => (it.keynavItem.groupIndex ?? 0) === groupIndex);
    const firstItem = itemsForGroup[0] ?? null;

    return {
      groupIndex,
      rootElement: root.element,
      keynavRoot: root.keynavRoot,
      itemElement: firstItem?.element ?? null,
      itemLoop: firstItem?.enclosingLoop ?? null,
      rootRefVar,
      mintedRootRef,
      groupIdVar: `${GROUP_ID_VAR}${suffix}`,
    };
  });
}

/**
 * `KeynavConfig` object literal — every field is statically known at compile
 * time EXCEPT the grid entry, which (Angular-only, see module doc comment)
 * is embedded directly here as a closure rather than threaded as a sibling
 * controller option: `createKeynavStateMachine(host, config)` is called
 * exactly ONCE inside `ngAfterViewInit`, so there is no "config captured
 * once at mount, would go stale across re-renders" hazard the other five
 * targets' dedicated hook/controller wrapper designs guard against. A root
 * without `.grid` emits the EXACT literal it emitted pre-Phase-77.
 */
function buildConfigCode(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  listenerOpts: RewriteListenerOpts,
): string {
  const k = plan.keynavRoot;
  const base = `{ focusModel: '${k.focusModel}', orientation: '${k.orientation}', loop: ${k.loop}, typeahead: ${k.typeahead}, skipDisabled: ${k.skipDisabled}`;
  if (!k.grid) return `${base} }`;
  // SPEC §10.5.2 — `.grid(<expr>)`'s grammar only accepts a `$`-prefixed
  // dotted path, which `rewriteListenerExpression` always lowers to a single
  // bare signal-call read (e.g. `this.cols()`) — always a pure expression,
  // never statement-shaped, so no method-hoisting is needed for any shape
  // the parser can actually produce.
  const columnsCode = rewriteListenerExpression(k.grid.columnsExpression, ir, listenerOpts);
  return `${base}, grid: { columns: () => ${columnsCode} } }`;
}

/**
 * `getSource: () => unknown[]` — the `:source` array (explicit or
 * synthesized, SPEC §5), remapped through the item's `{ label?, disabled? }`
 * expressions (SPEC §5) when the item is `r-for`-driven and declares at
 * least one of them. Rendered via `rewriteListenerExpression` (SCRIPT
 * context — this code lives inside `ngAfterViewInit`), NOT
 * `rewriteTemplateExpression`.
 */
function buildGetSourceCode(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  listenerOpts: RewriteListenerOpts,
): string {
  const sourceExpr = plan.keynavRoot.sourceExpression;
  if (!sourceExpr) {
    // Core already emitted ROZ987 (KEYNAV_SOURCE_UNRESOLVED) upstream for
    // this shape — best-effort empty source keeps emitted code well-formed
    // rather than crashing the compiler on an already-erroring input (D-08).
    return '() => []';
  }
  const sourceCode = rewriteListenerExpression(sourceExpr, ir, listenerOpts);

  const item = plan.itemElement?.keynavItem;
  if (!item || plan.itemLoop === null) {
    return `() => (${sourceCode})`;
  }

  const fields: string[] = [];
  if (item.labelExpression) {
    fields.push(`label: ${rewriteListenerExpression(item.labelExpression, ir, listenerOpts)}`);
  }
  if (item.disabledExpression) {
    fields.push(
      `disabled: ${rewriteListenerExpression(item.disabledExpression, ir, listenerOpts)}`,
    );
  }
  if (fields.length === 0) {
    return `() => (${sourceCode})`;
  }

  return `() => (${sourceCode}).map((${plan.itemLoop.itemAlias}) => ({ ${fields.join(', ')} }))`;
}

/** Find a template-event Listener of the given synthetic event name on the root. */
function findRootListener(root: TemplateElementIR, event: string) {
  return root.events.find((e) => e.event === event) ?? null;
}

/**
 * `commit: (i: number) => void` / `page: (detail: KeynavPageDetail) => void`
 * — the `KeynavHost.commit`/`.page` fields, called DIRECTLY by the state
 * machine (no intermediate opts indirection the way the hook/composable-
 * based targets have — this IS the host object). Mirrors the SAME
 * bare-identifier-vs-arbitrary-expression convention `emitListeners.ts`'s
 * `renderListener` already uses for `<listeners>`-block handlers: a bare
 * identifier (e.g. `@keynav-commit="handleCommit"`) rewrites to
 * `this.handleCommit` (an arrow class field — safe to pass BY REFERENCE,
 * since arrow class fields close over `this` lexically) and is passed
 * directly; an arbitrary expression is wrapped in `(<paramName>) => { ...; }`.
 */
function buildHandlerCode(
  root: TemplateElementIR,
  ir: IRComponent,
  listenerOpts: RewriteListenerOpts,
  event: string,
  paramName: string,
): string | null {
  const listener = findRootListener(root, event);
  if (!listener) return null;
  const handlerCode = rewriteListenerExpression(listener.handler, ir, listenerOpts);
  if (/^this\.[A-Za-z_$][\w$]*$/.test(handlerCode)) {
    return handlerCode;
  }
  return `(${paramName}) => { ${handlerCode}; }`;
}

/** `commit: (i: number) => void`. See `buildHandlerCode`'s doc comment. */
function buildCommitCode(
  root: TemplateElementIR,
  ir: IRComponent,
  listenerOpts: RewriteListenerOpts,
): string {
  return buildHandlerCode(root, ir, listenerOpts, 'keynav-commit', 'i') ?? '() => {}';
}

/**
 * `page: (detail: KeynavPageDetail) => void` (Phase 77, SPEC §3, §4.1).
 * Mirrors `buildCommitCode`'s convention exactly. Returns `null` (not a
 * fallback no-op) when `@keynav-page` isn't authored on this root — the
 * caller OMITS the `page` host field entirely in that case, which is what
 * keeps a component with no `.grid`/`@keynav-page` usage byte-identical.
 */
function buildPageCode(
  root: TemplateElementIR,
  ir: IRComponent,
  listenerOpts: RewriteListenerOpts,
): string | null {
  return buildHandlerCode(root, ir, listenerOpts, 'keynav-page', 'detail');
}

/**
 * Resolve the writable get/set pair for `keynavRoot.activeExpression` in
 * SCRIPT context — `this.<prop>()` read, `this.<prop>.set(i)` write. A deep
 * chain reaching this defensive throw would indicate `resolveKeynavGroups`
 * (core) validated a non-writable active-index shape that should never
 * reach emit (D-08).
 */
function resolveActiveScriptTarget(expr: t.Expression): { get: string; set: string } {
  if (
    t.isMemberExpression(expr) &&
    !expr.computed &&
    t.isIdentifier(expr.object) &&
    t.isIdentifier(expr.property) &&
    (expr.object.name === '$data' || expr.object.name === '$props')
  ) {
    const prop = expr.property.name;
    return { get: `this.${prop}()`, set: `(i) => { this.${prop}.set(i); }` };
  }
  throw new Error(
    'resolveKeynavPlans: unexpected r-keynav active-index expression shape reached the Angular emitter.',
  );
}

export interface KeynavClassEmission {
  /** Class-body field declarations (group id, root viewChild, injected Renderer2, controller field) for ALL resolved plans. */
  fieldDecls: string[];
  /** `constructor()`-body lines — one active-change `effect()` per plan. */
  constructorLines: string[];
  /** `ngAfterViewInit()`-body lines — one controller instantiation + root keydown/pointer delegation + DestroyRef teardown per plan. */
  afterViewInitLines: string[];
  /** True when at least one plan was emitted — `ngAfterViewInit`'s teardown registers via `this.__rozieDestroyRef.onDestroy(...)`. */
  needsDestroyRefField: boolean;
  /** `@angular/core` symbol names this emission references — caller adds them to the import collector. */
  angularImports: string[];
  /** `@rozie/runtime-keynav-core` symbol names this emission references. */
  runtimeImports: string[];
}

/**
 * Generate the INLINE controller's class-body wiring for ALL resolved
 * `r-keynav` roots — field decls + `ngAfterViewInit` instantiation/
 * delegation + a constructor `effect()`, one full set per plan (except the
 * genuinely shared `Renderer2` field, declared once at group index 0). See
 * this module's doc comment for the full rationale of each piece's
 * placement.
 */
export function buildKeynavClassEmission(
  plans: readonly KeynavEmitPlan[],
  ir: IRComponent,
  /**
   * The REAL (not preview) `rewriteRozieIdentifiers` result from
   * `emitScript.ts`'s own Step 3 — threading `classMembers`/`signalMembers`/
   * `collisionRenames` so a `<script>`-declared handler referenced from
   * `getSource`/`commit`/`page`/`activeClass` correctly rewrites to
   * `this.run(...)`, exactly like every other class-context rewrite site in
   * this target (mirrors `emitListeners()`'s identical parameter threading).
   */
  listenerOpts: RewriteListenerOpts,
): KeynavClassEmission {
  const fieldDecls: string[] = [];
  const constructorLines: string[] = [];
  const afterViewInitLines: string[] = [];
  const angularImports = new Set<string>();
  const runtimeImports = new Set<string>([
    'createKeynavStateMachine',
    'type KeynavStateMachine',
    // Plan 260806-lz7 — the shared strict-containment predicate.
    'focusIsWithinScope',
  ]);

  for (const plan of plans) {
    const suffix = suffixFor(plan.groupIndex);
    const groupIdVar = plan.groupIdVar;
    const controllerVar = `${CONTROLLER_VAR}${suffix}`;
    const syncMethod = `${SYNC_ACTIVE_METHOD}${suffix}`;
    const applyMethod = `${APPLY_ACTIVE_METHOD}${suffix}`;
    const rafField = `${RAF_ID_FIELD}${suffix}`;
    const attachedRootField = `${ATTACHED_ROOT_FIELD}${suffix}`;
    const detachField = `${DETACH_FIELD}${suffix}`;
    const attachMethod = `${ATTACH_ROOT_METHOD}${suffix}`;
    const lastFocusedField = `${LAST_FOCUSED_FIELD}${suffix}`;
    const hasInteractedField = `${HAS_INTERACTED_FIELD}${suffix}`;
    const rootRefExpr = `this.${plan.rootRefVar}()?.nativeElement`;

    const active = resolveActiveScriptTarget(plan.keynavRoot.activeExpression);
    const getSourceCode = buildGetSourceCode(plan, ir, listenerOpts);
    const commitCode = buildCommitCode(plan.rootElement, ir, listenerOpts);
    const pageCode = buildPageCode(plan.rootElement, ir, listenerOpts);
    const configCode = buildConfigCode(plan, ir, listenerOpts);

    const activeClassLines: string[] = [];
    if (plan.keynavRoot.activeClassExpression) {
      runtimeImports.add('normalizeClassTokens');
      const activeClassCode = rewriteListenerExpression(
        plan.keynavRoot.activeClassExpression,
        ir,
        listenerOpts,
      );
      activeClassLines.push(
        `  const __rozieKeynavTokens = normalizeClassTokens(${activeClassCode});`,
        `  if (__rozieKeynavTokens.length > 0) {`,
        `    __rozieKeynavRootEl.querySelectorAll('[data-rozie-keynav-item]').forEach((__rozieKeynavItemEl) => __rozieKeynavItemEl.classList.remove(...__rozieKeynavTokens));`,
        `    __rozieKeynavActiveEl?.classList.add(...__rozieKeynavTokens);`,
        `  }`,
      );
    }

    // Plan 260806-lz7: gated behind `__rozieKeynavMayApply` — a
    // first/redundant pass only focuses when the composed active element is
    // already inside the owning component; a genuine navigation pass always
    // focuses.
    const focusLines: string[] =
      plan.keynavRoot.focusModel === 'tabindex'
        ? ['  if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.focus();']
        : [];

    fieldDecls.push(
      `private ${groupIdVar} = 'rozie-keynav-' + Math.random().toString(36).slice(2);`,
    );
    if (plan.mintedRootRef) {
      fieldDecls.push(
        `private ${plan.rootRefVar} = viewChild<ElementRef<HTMLElement>>('${plan.rootRefVar}');`,
      );
    }
    // `RENDERER_FIELD` is genuinely SHARED, stateless infrastructure —
    // declared exactly ONCE (group index 0, always present when ANY plan
    // exists — core assigns groupIndex in document order starting at 0), and
    // referenced bare (unsuffixed) by every group's delegation block below.
    if (plan.groupIndex === 0) {
      fieldDecls.push(`private ${RENDERER_FIELD} = inject(Renderer2);`);
      // Plan 260806-lz7 — the strict-containment guard's native anchor,
      // genuinely SHARED infrastructure like `RENDERER_FIELD` above.
      fieldDecls.push(`private ${HOST_ELEMENT_FIELD} = inject(ElementRef);`);
      angularImports.add('ElementRef');
    }
    fieldDecls.push(`private ${controllerVar}: KeynavStateMachine | null = null;`);
    // Phase 77 (T-77-05-03) — the single outstanding rAF retry id for THIS
    // group, mirroring the React/Lit references' `rafId`/`pendingRafId`.
    fieldDecls.push(`private ${rafField}: number | null = null;`);
    // Plan 77-10 (KNG-06) — the identity-diff anchor for the currently
    // attached root, and the stored teardown for that attachment.
    fieldDecls.push(`private ${attachedRootField}: HTMLElement | null = null;`);
    fieldDecls.push(`private ${detachField}: (() => void) | null = null;`);
    // Plan 260806-lz7 — per-group last-focused-active bookkeeping.
    fieldDecls.push(`private ${lastFocusedField}: number | null = null;`);
    fieldDecls.push(`private ${hasInteractedField} = false;`);

    // Shared active-item sync (focus/scroll/`r-keynav-active-class` toggle,
    // SPEC §9), extracted into its own arrow-field method — see the 71-11
    // landmine fix this preserves (`ngAfterViewInit` explicit call in
    // addition to the constructor `effect()`, since a constructor effect's
    // FIRST flush is not guaranteed to observe a resolved `viewChild()`
    // query signal). Phase 77 splits this into TWO methods:
    // `${applyMethod}` (the pre-existing per-active-change body, UNCHANGED —
    // every pre-Phase-77 emitted line still appears, just here instead of
    // inline) and `${syncMethod}` (a scheduling wrapper that calls it once
    // synchronously and, if the landing item wasn't found — SPEC §77-03-03,
    // a same-tick dataset swap — schedules exactly ONE
    // `requestAnimationFrame`-deferred retry, cancelled on a newer
    // active-change/disconnect and guarded so a stale pass never steals
    // focus from a newer navigation; mirrors the React reference's identical
    // pattern).
    fieldDecls.push(
      [
        `private ${applyMethod} = (__rozieKeynavRootEl: HTMLElement, __rozieKeynavActive: number, __rozieKeynavMayApply: boolean): boolean => {`,
        `  const __rozieKeynavActiveEl = __rozieKeynavRootEl.querySelector<HTMLElement>(\`[data-rozie-keynav-item="\${__rozieKeynavActive}"]\`);`,
        ...activeClassLines,
        ...focusLines,
        `  if (__rozieKeynavMayApply) __rozieKeynavActiveEl?.scrollIntoView({ block: 'nearest' });`,
        `  return __rozieKeynavActiveEl !== null;`,
        `};`,
      ].join('\n'),
    );
    fieldDecls.push(
      [
        `private ${syncMethod} = () => {`,
        `  const __rozieKeynavActive = ${active.get};`,
        `  const __rozieKeynavRootEl = ${rootRefExpr};`,
        `  if (this.${rafField} !== null) { cancelAnimationFrame(this.${rafField}); this.${rafField} = null; }`,
        `  if (!__rozieKeynavRootEl || !Number.isFinite(__rozieKeynavActive)) return;`,
        // Plan 260806-lz7 — computed ONCE per `${syncMethod}` invocation (not
        // per `${applyMethod}` call) so the deferred rAF retry below reuses
        // the SAME may-apply decision the synchronous pass made, rather than
        // re-evaluating against a `${lastFocusedField}` this same invocation
        // already advanced to `__rozieKeynavActive`.
        // Also requires `this.${hasInteractedField}` — a value change alone
        // is not sufficient evidence of a real navigation (see
        // `HAS_INTERACTED_FIELD`'s doc comment).
        `  const __rozieKeynavIsNav = this.${hasInteractedField} && this.${lastFocusedField} !== null && this.${lastFocusedField} !== __rozieKeynavActive;`,
        `  const __rozieKeynavMayApply = __rozieKeynavIsNav || focusIsWithinScope([this.${HOST_ELEMENT_FIELD}.nativeElement, __rozieKeynavRootEl], __rozieKeynavRootEl.ownerDocument);`,
        `  this.${lastFocusedField} = __rozieKeynavActive;`,
        `  const __rozieKeynavFound = this.${applyMethod}(__rozieKeynavRootEl, __rozieKeynavActive, __rozieKeynavMayApply);`,
        `  if (!__rozieKeynavFound) {`,
        `    this.${rafField} = requestAnimationFrame(() => {`,
        `      this.${rafField} = null;`,
        `      if (${active.get} !== __rozieKeynavActive) return;`,
        `      const __rozieKeynavRetryRootEl = ${rootRefExpr};`,
        `      if (__rozieKeynavRetryRootEl) this.${applyMethod}(__rozieKeynavRetryRootEl, __rozieKeynavActive, __rozieKeynavMayApply);`,
        `    });`,
        `  }`,
        `};`,
      ].join('\n'),
    );

    // Plan 77-10 (KNG-06 gap closure) — the reactive, identity-diffed
    // attach/re-attach method. Runs from a constructor `effect()` (so it
    // re-fires the moment a conditional root's `viewChild()` signal first
    // resolves) AND once explicitly at `ngAfterViewInit` time (mirroring the
    // `${syncMethod}` explicit-call precedent above, 71-11). The three
    // `Renderer2.listen(...)` delegation lines and the T-71-09-01
    // marker-validation guards below are MOVED CHARACTER-FOR-CHARACTER from
    // the pre-Plan-77-10 inline `ngAfterViewInit` delegation block — this is
    // what keeps every pre-existing substring assertion a literal match with
    // zero test edits (the same technique Plan 77-05 used extracting
    // `${APPLY_ACTIVE_METHOD}`).
    fieldDecls.push(
      [
        `private ${attachMethod} = () => {`,
        `  const __rozieKeynavRootEl = ${rootRefExpr} ?? null;`,
        `  if (__rozieKeynavRootEl === this.${attachedRootField}) return;`,
        `  if (this.${detachField}) { this.${detachField}(); this.${detachField} = null; }`,
        // Plan 260806-lz7 — a root-identity change starts a fresh
        // attachment with no navigation history of its own.
        `  this.${lastFocusedField} = null;`,
        `  this.${hasInteractedField} = false;`,
        `  this.${attachedRootField} = __rozieKeynavRootEl;`,
        `  if (!__rozieKeynavRootEl) return;`,
        `  const __rozieKeynavHandleKeydown = ($event: KeyboardEvent) => { this.${hasInteractedField} = true; this.${controllerVar}?.onKeydown($event); };`,
        `  const __rozieKeynavHandlePointer = ($event: PointerEvent) => {`,
        `    this.${hasInteractedField} = true;`,
        `    const __rozieKeynavTarget = $event.target;`,
        `    if (!(__rozieKeynavTarget instanceof Element)) return;`,
        `    const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');`,
        `    if (!__rozieKeynavMarker) return;`,
        `    const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');`,
        `    if (__rozieKeynavRaw === null) return;`,
        // T-71-09-01 (threat register) — Number() + bounds-check on the
        // untrusted DOM marker BEFORE it reaches the reducer. The reducer
        // also clamps as a second line of defense (71-03's
        // onPointerActivate), but a malformed/negative index is rejected
        // here first, never coerced.
        `    const __rozieKeynavIdx = Number(__rozieKeynavRaw);`,
        `    if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;`,
        `    this.${controllerVar}?.onPointerActivate(__rozieKeynavIdx);`,
        `  };`,
        // DOM focus can land on an item WITHOUT a keydown or pointerdown
        // ever firing on the root — a programmatic `.focus()` call
        // (assistive tech, test automation) is the common case, but it's
        // really any focus arrival this delegation model can't otherwise
        // observe. `focusin` bubbles (unlike `focus`), so a single root
        // listener catches it the same way keydown/pointerdown already do.
        // `moveTo` only sets `active`, never commits — syncing the
        // roving-tabindex model's notion of "current item" to wherever DOM
        // focus ACTUALLY is, so a subsequent arrow key moves relative to
        // the real focus target instead of a stale prior `active`
        // (T-77-08-05 — found via 77-08's real-DOM Docker VR run:
        // date-picker's 260802-hla spec `.focus()`s a day cell directly,
        // then presses ArrowRight, which used to move relative to whatever
        // `active` happened to be BEFORE that focus call).
        `  const __rozieKeynavHandleFocusIn = ($event: FocusEvent) => {`,
        `    this.${hasInteractedField} = true;`,
        `    const __rozieKeynavTarget = $event.target;`,
        `    if (!(__rozieKeynavTarget instanceof Element)) return;`,
        `    const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');`,
        `    if (!__rozieKeynavMarker) return;`,
        `    const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');`,
        `    if (__rozieKeynavRaw === null) return;`,
        `    const __rozieKeynavIdx = Number(__rozieKeynavRaw);`,
        `    if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;`,
        `    this.${controllerVar}?.moveTo(__rozieKeynavIdx);`,
        `  };`,
        `  const __rozieKeynavUnlistenKeydown = this.${RENDERER_FIELD}.listen(__rozieKeynavRootEl, 'keydown', __rozieKeynavHandleKeydown);`,
        `  const __rozieKeynavUnlistenPointer = this.${RENDERER_FIELD}.listen(__rozieKeynavRootEl, 'pointerdown', __rozieKeynavHandlePointer);`,
        `  const __rozieKeynavUnlistenFocusIn = this.${RENDERER_FIELD}.listen(__rozieKeynavRootEl, 'focusin', __rozieKeynavHandleFocusIn);`,
        `  this.${detachField} = () => {`,
        `    __rozieKeynavUnlistenKeydown();`,
        `    __rozieKeynavUnlistenPointer();`,
        `    __rozieKeynavUnlistenFocusIn();`,
        `  };`,
        `};`,
      ].join('\n'),
    );

    const hostLines = [
      `this.${controllerVar} = createKeynavStateMachine({`,
      `  getSource: ${getSourceCode},`,
      `  getActive: () => ${active.get},`,
      `  setActive: ${active.set},`,
      `  commit: ${commitCode},`,
    ];
    if (pageCode !== null) {
      hostLines.push(`  page: ${pageCode},`);
    }
    hostLines.push(`}, ${configCode});`);
    afterViewInitLines.push(hostLines.join('\n'));

    // Explicit mount-time attach + sync — mirrors the `${syncMethod}`
    // explicit-call precedent (71-11): a constructor `effect()`'s FIRST
    // flush is not guaranteed to observe a resolved `viewChild()` query
    // signal, so an unconditional root still needs its listeners attached
    // here too, not only from the effect below.
    afterViewInitLines.push(`this.${attachMethod}();`);
    afterViewInitLines.push(`this.${syncMethod}();`);
    // Plan 77-10 (KNG-06) — teardown registration is now UNCONDITIONAL (no
    // longer nested inside an `if (root)` guard) so a conditional root that
    // never resolves, or resolves and later closes, still gets its
    // controller disposed and rAF cancelled on destroy.
    afterViewInitLines.push(
      [
        `this.__rozieDestroyRef.onDestroy(() => {`,
        `  this.${detachField}?.();`,
        `  if (this.${rafField} !== null) cancelAnimationFrame(this.${rafField});`,
        `  this.${controllerVar}?.dispose();`,
        `});`,
      ].join('\n'),
    );

    // Attach-ROOT effect (Plan 77-10, KNG-06) — re-runs whenever
    // `${rootRefExpr}`'s `viewChild()` query signal changes identity, which
    // is exactly when a conditional root's branch opens/closes/swaps.
    // Pushed BEFORE the active-sync effect so a newly-appeared root owns its
    // listeners before the active-sync focus pass runs against it.
    constructorLines.push(
      [`effect(() => {`, `  this.${attachMethod}();`, `});`].join('\n'),
    );

    // Active-CHANGE effect (SPEC §9: "evaluated once ... toggles on
    // active-change, not a live per-render binding") — the `this.<prop>()`
    // signal read happens DIRECTLY inside `${applyMethod}`'s call chain
    // (via `${syncMethod}`), so Angular's auto-tracking still subscribes to
    // it. Every SUBSEQUENT active-change is owned by this effect exactly as
    // before; the mount-time invocation is the explicit `ngAfterViewInit`
    // call above.
    constructorLines.push(
      [`effect(() => {`, `  this.${syncMethod}();`, `});`].join('\n'),
    );

    angularImports.add('inject');
    angularImports.add('Renderer2');
    angularImports.add('DestroyRef');
    angularImports.add('effect');
    if (plan.mintedRootRef) {
      angularImports.add('viewChild');
      angularImports.add('ElementRef');
    }
  }

  return {
    fieldDecls,
    constructorLines,
    afterViewInitLines,
    needsDestroyRefField: plans.length > 0,
    angularImports: [...angularImports],
    runtimeImports: [...runtimeImports],
  };
}

/**
 * Root-element template attribute fragments — `#…` template-ref (only when a
 * fresh ref was synthesized; an author-declared `ref="x"` already emits its
 * own `#x` via the normal attribute path, and Angular permits only one
 * `#name` per element) plus `[attr.aria-activedescendant]` for the
 * activedescendant focus model, pointing at the active item's id. Rendered
 * via `rewriteTemplateExpression` (TEMPLATE context — bare, no `this.`)
 * since these genuinely render inside the Angular template.
 *
 * `plan` must be the plan whose `groupIndex` matches THIS element's own
 * `keynavRoot.groupIndex` (defaulting to 0) — callers select it via
 * `emitTemplateNode.ts`'s per-node plan lookup, never "the" single plan.
 */
export function keynavRootAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  ir: IRComponent,
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.mintedRootRef) {
    attrs.push(`#${plan.rootRefVar}`);
  }
  if (plan.keynavRoot.focusModel === 'activedescendant') {
    const activeCode = rewriteTemplateExpression(plan.keynavRoot.activeExpression, ir);
    attrs.push(
      `[attr.aria-activedescendant]="${activeCode} >= 0 ? \`\${${plan.groupIdVar}}-item-\${${activeCode}}\` : undefined"`,
    );
  }
  return attrs;
}

/**
 * Item-element template attribute fragments — stable `[id]`, the
 * `[attr.data-rozie-keynav-item]` delegation/bounds-check marker (SPEC §8,
 * triple duty), the always-present `[attr.data-rozie-keynav-active]` marker
 * (SPEC §9), and — tabindex focus model only — the `[tabIndex]` roving
 * binding. All FOUR compare `indexExpr` (the loop's item index — for
 * Angular, `@for`'s implicit `$index` context variable is ALWAYS available
 * bare inside the block with no `let` alias needed) against the live active
 * value — declarative Angular template bindings (the inline controller never
 * writes these directly).
 *
 * Phase 77 (planner Gap B) — an item's OWN explicit index expression
 * (`r-keynav-item="{ index: <expr> }"`, rewritten via
 * `rewriteTemplateExpression` — TEMPLATE context, same as every other
 * fragment here) takes priority over `indexExpr` (the enclosing `@for`
 * block's `$index`) when present. This is what makes an explicit index
 * correct even when the item's nearest enclosing loop is a NESTED inner
 * loop — the expression's own identifier references are already bound to
 * whichever loop scope it was authored in, regardless of nesting depth.
 *
 * Returns `[]` when neither an explicit index nor a loop index is
 * available. `plan` must be the plan whose `groupIndex` matches THIS
 * element's own `keynavItem.groupIndex` (defaulting to 0) — see
 * `keynavRootAttrs`'s doc comment.
 */
export function keynavItemAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  loopIndexExpr: string | null,
  ir: IRComponent,
): string[] {
  if (plan === null || node.keynavItem === undefined) return [];
  const explicitIndexExpr = node.keynavItem.indexExpression
    ? rewriteTemplateExpression(node.keynavItem.indexExpression, ir)
    : null;
  const indexExpr = explicitIndexExpr ?? loopIndexExpr;
  if (indexExpr === null) return [];
  const activeCode = rewriteTemplateExpression(plan.keynavRoot.activeExpression, ir);
  const attrs: string[] = [
    `[id]="\`\${${plan.groupIdVar}}-item-\${${indexExpr}}\`"`,
    `[attr.data-rozie-keynav-item]="${indexExpr}"`,
    `[attr.data-rozie-keynav-active]="${activeCode} === ${indexExpr} ? '' : undefined"`,
  ];
  if (plan.keynavRoot.focusModel === 'tabindex') {
    attrs.push(`[tabIndex]="${activeCode} === ${indexExpr} ? 0 : -1"`);
  }
  return attrs;
}

/**
 * Strips the `@keynav-commit` / `@keynav-page` template-event Listeners out
 * of the root element's `events` array — both are consumed by
 * `buildCommitCode`/`buildPageCode` above and routed into the inline
 * controller's `KeynavHost.commit`/`.page`, NEVER as an Angular
 * `(keynavCommit)=`/`(keynavPage)=` template binding (which would be inert —
 * neither is a real DOM event a host element dispatches).
 *
 * Also strips an explicit `:source="…"` binding attribute (`resolveKeynavGroups`
 * deliberately does NOT do this itself — see its module doc comment's "NOTE
 * for emitter plans" — every per-target emitter that walks `attributes` for
 * real DOM/component props must skip a `binding` attr named `'source'` on a
 * `keynavRoot` element). Latent since Phase 71/77-02 — no consumer had ever
 * authored an EXPLICIT `:source` (every prior root synthesized its source
 * from a co-located `r-for`) until the date-picker day grid's flat,
 * triple-nested-loop source (77-08).
 */
export function stripKeynavSyntheticEvents(node: TemplateElementIR): TemplateElementIR {
  if (node.keynavRoot === undefined) return node;
  const filteredEvents = node.events.filter(
    (e) => e.event !== 'keynav-commit' && e.event !== 'keynav-page',
  );
  const filteredAttrs = node.attributes.filter(
    (a) => !(a.kind === 'binding' && a.name === 'source'),
  );
  if (filteredEvents.length === node.events.length && filteredAttrs.length === node.attributes.length) {
    return node;
  }
  return { ...node, events: filteredEvents, attributes: filteredAttrs };
}
