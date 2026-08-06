/**
 * emitKeynav — Phase 71 Plan 06 (Svelte target), reworked by Phase 77 Plan
 * 04 from one-plan-per-component to one-plan-per-root (77-SPEC.md §6, §7.3),
 * mirroring the React reference's Plan 77-03 rework.
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02, extended Phase 77 Plan 02 with
 * `grid`/`groupIndex`/`indexExpression`) to the `keynav` Svelte 5 action
 * (Phase 71 Plan 03's `@rozie/runtime-keynav-core` + Phase 77 Plan 04's
 * `onPage`/`gridColumns` extension). Modeled directly on the React REFERENCE
 * implementation (`packages/targets/react/src/emit/emitKeynav.ts`, Plan
 * 71-04, extended Plan 77-03) and the Vue target-pair
 * (`packages/targets/vue/src/emit/emitKeynav.ts`, Plan 71-05, extended Plan
 * 77-04) — same two responsibilities, resolved ONCE per component:
 *
 *   1. `resolveKeynavPlans(ir)` — locates EVERY `keynavRoot` element in the
 *      component and, for each, the FIRST `keynavItem` associated to THAT
 *      root (via `KeynavItemIR.groupIndex`, defaulting to 0 — core's
 *      `resolveKeynavGroups` owns the association rule; the emitter never
 *      re-derives containment) + its enclosing `r-for` loop, mirroring
 *      core's own walk (and the React/Vue references' identical
 *      `collectAllKeynavNodes`). Returns one plan per root, in document
 *      order. Returns `[]` for the overwhelming majority case (no
 *      `r-keynav` in the component) — every call site below short-circuits
 *      on an empty array, so a non-keynav component's emit is completely
 *      untouched (SPEC §7.4: "no corpus rebless").
 *
 *   2. `keynavRootAttrs`/`keynavItemAttrs` — build the declarative template
 *      attribute fragments spliced directly into `emitTemplateNode.ts`'s
 *      `partsHead` array (mirroring the existing raw-string-splice pattern
 *      used for other emitter-synthesized markers in that file), plus
 *      `buildKeynavScriptInjections` — the `let __rozieKeynavRootRef =
 *      $state<HTMLElement | undefined>(undefined);` / group-id declarations
 *      Svelte's `ref`-less template-binding idiom still needs at the script
 *      level (see `emitScript.ts`'s `emitRefDecls` doc comment: Svelte refs
 *      MUST be `$state(...)` to participate in reactivity), ONE set per
 *      resolved plan.
 *
 * **Identifier naming (mirrors the React/Vue references exactly):** the
 * root-ref and group-id identifiers keep their PRE-PHASE-77 spelling for
 * group index 0 and append the index for later groups (`__rozieKeynavGroupId`
 * / `__rozieKeynavGroupId1` / `__rozieKeynavGroupId2` …) — the mechanism that
 * keeps a single-root, non-grid component's emitted output byte-identical to
 * before this plan.
 *
 * SVELTE-SPECIFIC DIVERGENCE FROM VUE — ONE rewrite context, not two: Vue's
 * plan (71-05) needed a SEPARATE script-context expression rewriter because
 * Vue's `ref()`/`defineModel()` auto-unwrap is a `<template>`-compiler-only
 * affordance a plain `<script setup>` JS closure does NOT get. Svelte 5 has
 * no such split — `rewriteTemplateExpression.ts`'s own module doc comment
 * states it plainly: "Same rewrites as the script-side path because Svelte
 * 5's template surface uses bare identifiers (no `.value` suffix; no
 * `props.` prefix)". A `$data.active`/model-`$props.active` read lowers to
 * the SAME bare `active` identifier whether it appears inside a `<template>`
 * attribute binding OR inside a `use:keynav={{ … }}` action-parameter object
 * literal spliced into that same template (the object literal is still
 * TEMPLATE-context, not a separate `<script>` closure — see below). This
 * file therefore uses `rewriteTemplateExpression` EXCLUSIVELY, unlike the
 * Vue reference's `rewriteScriptExpression`.
 *
 * SVELTE-SPECIFIC DIVERGENCE FROM REACT/VUE — action `update()`, not a
 * script-injected hook/composable CALL: React's `useKeynav(...)` and Vue's
 * `useKeynav(...)` are both SCRIPT-level function calls threaded through
 * `ScriptInjection`/`SvelteScriptInjection`. Svelte's `keynav` action is
 * instead invoked directly as a TEMPLATE attribute — `use:keynav={{ …
 * }}` — on the root element itself, built by `keynavRootAttrs` below (NOT a
 * script injection), ONE per resolved plan. See `keynav.ts`'s (Plan 71-06
 * Task 1, extended Plan 77-04 Task 2) module doc comment for why the
 * action's reactive "watch active" mechanism is an ordinary Svelte action
 * `update()` triggered by a bare `active` field in that SAME object
 * literal, rather than a separately-emitted `$effect(...)` block —
 * `$effect` is a compiler rune unusable from a plain `.ts` runtime file, and
 * routing it through a script injection here would require a SECOND
 * runtime export + a second call site with no correctness benefit over the
 * action-parameter-reactivity mechanism Svelte already provides.
 *
 * Plan 260806-lz7 — additionally emits `getFocusScope`, the wiring for
 * `keynav`'s strict-containment focus guard: `resolveKeynavFocusScopeRefs`
 * mints one bare `$state`-backed ref per top-level template element (reusing
 * an existing ref over minting a fresh one), and every `use:keynav={{ … }}`
 * action reads them so the runtime's shared `focusIsWithinScope` predicate
 * (`@rozie/runtime-keynav-core`) can tell whether a first/redundant focus
 * pass is safe.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  KeynavItemIR,
  KeynavRootIR,
  TemplateElementIR,
  TemplateLoopIR,
  TemplateNode,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { SvelteScriptInjection } from './emitScript.js';

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` so they can never collide with a `<script>`-declared
// binding (mirrors the React/Vue references' `__rozieKeynavRootRef`/
// `__rozieKeynavGroupId` convention). Group index 0 keeps the bare spelling;
// later groups append the index (see `suffixFor` below) — the mechanism
// that keeps single-root emit unchanged.
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';
// Plan 260806-lz7 — the strict-containment focus scope's freshly-minted
// per-top-level-element refs (see `resolveKeynavFocusScopeRefs` below).
const SCOPE_REF_VAR = '__rozieKeynavScopeRef';

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
  /** `bind:this="…"` identifier to emit on the root — reuses an author `ref="x"` when present. */
  rootRefVar: string;
  /** True when `rootRefVar` was FRESHLY synthesized (needs its own `let … = $state(...)` decl). False when reusing an author-declared ref (already emits its own `bind:this={x}` via the normal attribute path — see `emitTemplateAttribute.ts`'s `ref=` → `bind:this=` lowering). */
  mintedRootRef: boolean;
  /** Group-id identifier shared by the root's `aria-activedescendant` and every item's `id`. */
  groupIdVar: string;
}

function findStaticAttrValue(el: TemplateElementIR, name: string): string | null {
  for (const a of el.attributes) {
    if (a.kind === 'static' && a.name === name) return a.value;
  }
  return null;
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
  roots: { element: TemplateElementIR; keynavRoot: KeynavRootIR }[];
  items: { element: TemplateElementIR; keynavItem: KeynavItemIR; enclosingLoop: TemplateLoopIR | null }[];
} {
  const roots: { element: TemplateElementIR; keynavRoot: KeynavRootIR }[] = [];
  const items: { element: TemplateElementIR; keynavItem: KeynavItemIR; enclosingLoop: TemplateLoopIR | null }[] = [];

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
        for (const branch of node.branches) for (const child of branch.body) walk(child, enclosingLoop);
        break;
      case 'TemplateMatch':
        for (const branch of node.branches) for (const child of branch.body) walk(child, enclosingLoop);
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
    const itemsForGroup = items.filter((it) => (it.keynavItem.groupIndex ?? 0) === groupIndex);
    const firstItem = itemsForGroup[0] ?? null;
    const suffix = suffixFor(groupIndex);

    // Reuse an author-declared `ref="x"` on the SAME element when present —
    // Svelte permits only one `bind:this=` per element, so silently
    // overwriting an author's own ref would be a Rule-1-class bug. Mirrors the
    // React/Vue references' identical defensive check (untested by a
    // dedicated fixture there too — SPEC §3.1 has no example combining both).
    // UNLIKE Vue (which suffixes `${existingRef}Ref`), Svelte's ref variable
    // name IS the ref name verbatim — `emitRefDecls` declares `let x =
    // $state<…>(undefined);` and the template emits `bind:this={x}` directly
    // (see `emitTemplateAttribute.ts`'s `ref=` → `bind:this=` lowering) — no
    // suffix convention to mirror.
    const existingRef = findStaticAttrValue(root.element, 'ref');
    const mintedRootRef = !(existingRef !== null && ir.refs.some((r) => r.name === existingRef));
    const rootRefVar = mintedRootRef ? `${ROOT_REF_VAR}${suffix}` : existingRef!;

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
 * Plan 260806-lz7 — the strict-containment focus scope. One entry per
 * `html`-kind TOP-LEVEL element of the template (`<template>` does not
 * enforce a single root — multiple top-level elements are legal); a
 * `component`-kind or non-element top-level node is skipped (a ref on a
 * child component does not yield a DOM Element). Each entry either reuses an
 * EXISTING ref (the keynav root's own minted/reused ref when the element IS
 * a keynav root — appending it is a no-op in the normal case; or an
 * author-declared `ref="x"`, read verbatim per this file's no-suffix
 * convention) or mints a FRESH one — Svelte permits only one `bind:this=`
 * per element, so a fresh ref is only minted when neither already exists.
 */
export interface KeynavFocusScopeRef {
  element: TemplateElementIR;
  /** The bare variable name — Svelte reads it verbatim, no suffix/`.value`/`.current`. */
  refVar: string;
  /** False when `refVar` names an ALREADY-existing ref — no fresh `$state`
   * decl / `bind:this=` attribute needs minting/stamping for this entry. */
  needsFreshRef: boolean;
}

function topLevelTemplateElements(ir: IRComponent): TemplateElementIR[] {
  if (ir.template === null) return [];
  const root = ir.template;
  const candidates: TemplateNode[] = root.type === 'TemplateFragment' ? root.children : [root];
  return candidates.filter(
    (n): n is TemplateElementIR => n.type === 'TemplateElement' && n.tagKind === 'html',
  );
}

/**
 * Resolves the component-wide focus scope — `[]` when there are no keynav
 * plans (the overwhelming majority case) OR the template has zero
 * `html`-kind top-level elements, in which case every `use:keynav={{ … }}`
 * opts object OMITS `getFocusScope` entirely, and the runtime takes its
 * documented `documentHasRealFocus` fallback (never a hard rejection).
 */
export function resolveKeynavFocusScopeRefs(
  ir: IRComponent,
  plans: KeynavEmitPlan[],
): KeynavFocusScopeRef[] {
  if (plans.length === 0) return [];
  const elements = topLevelTemplateElements(ir);
  const refs: KeynavFocusScopeRef[] = [];
  let freshIndex = 0;
  for (const el of elements) {
    const rootPlan =
      el.keynavRoot !== undefined
        ? (plans.find((p) => p.groupIndex === (el.keynavRoot!.groupIndex ?? 0)) ?? null)
        : null;
    if (rootPlan !== null) {
      refs.push({ element: el, refVar: rootPlan.rootRefVar, needsFreshRef: false });
      continue;
    }
    const existingRef = findStaticAttrValue(el, 'ref');
    if (existingRef !== null && ir.refs.some((r) => r.name === existingRef)) {
      refs.push({ element: el, refVar: existingRef, needsFreshRef: false });
      continue;
    }
    refs.push({ element: el, refVar: `${SCOPE_REF_VAR}${freshIndex}`, needsFreshRef: true });
    freshIndex += 1;
  }
  return refs;
}

/**
 * `bind:this={…}` for a FRESHLY-minted scope ref only — an already-covered
 * scope entry (the keynav root's own ref, or an author-declared one) already
 * emits its `bind:this=` via its own normal path, and Svelte permits only
 * one `bind:this=` per element. `node` must be reference-identical to the
 * element `resolveKeynavFocusScopeRefs` walked (i.e. the ORIGINAL, pre-
 * `stripKeynavSyntheticEvents` node) — see `emitTemplateNode.ts`'s call site.
 */
export function keynavFocusScopeAttrs(
  scopeRefs: KeynavFocusScopeRef[],
  node: TemplateElementIR,
): string[] {
  const match = scopeRefs.find((r) => r.element === node);
  if (!match || !match.needsFreshRef) return [];
  return [`bind:this={${match.refVar}}`];
}

/** `KeynavConfig` object literal — every field is statically known at compile time. */
function buildConfigCode(k: KeynavRootIR): string {
  return `{ focusModel: '${k.focusModel}', orientation: '${k.orientation}', loop: ${k.loop}, typeahead: ${k.typeahead}, skipDisabled: ${k.skipDisabled} }`;
}

/**
 * `getSource: () => unknown[]` — the `:source` array (explicit or
 * synthesized, SPEC §5), remapped through the item's `{ label?, disabled? }`
 * expressions (SPEC §5) when the item is `r-for`-driven and declares at
 * least one of them. Rendered via `rewriteTemplateExpression` — see this
 * module's doc comment for why Svelte needs only ONE rewrite context.
 */
function buildGetSourceCode(plan: KeynavEmitPlan, ir: IRComponent): string {
  const sourceExpr = plan.keynavRoot.sourceExpression;
  if (!sourceExpr) {
    // Core already emitted ROZ987 (KEYNAV_SOURCE_UNRESOLVED) upstream for
    // this shape — best-effort empty source keeps emitted code well-formed
    // rather than crashing the compiler on an already-erroring input (D-08).
    return '() => []';
  }
  const sourceCode = rewriteTemplateExpression(sourceExpr, ir);

  const item = plan.itemElement?.keynavItem;
  if (!item || plan.itemLoop === null) {
    return `() => (${sourceCode})`;
  }

  const fields: string[] = [];
  if (item.labelExpression) {
    fields.push(`label: ${rewriteTemplateExpression(item.labelExpression, ir)}`);
  }
  if (item.disabledExpression) {
    fields.push(`disabled: ${rewriteTemplateExpression(item.disabledExpression, ir)}`);
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
 * Shared bare-identifier-vs-arbitrary-expression convention every synthetic
 * keynav event uses (mirrors `emitTemplateEvent`'s same convention for every
 * other template event): a bare identifier is passed BY REFERENCE — the
 * runtime calls it directly, so the author's handler naturally receives the
 * callback's own parameter. An arbitrary expression is wrapped in
 * `(<paramName>) => { ...; }`.
 */
function buildHandlerCode(
  root: TemplateElementIR,
  ir: IRComponent,
  event: string,
  paramName: string,
): string | null {
  const listener = findRootListener(root, event);
  if (!listener) return null;
  const handlerCode = rewriteTemplateExpression(listener.handler, ir);
  if (/^[A-Za-z_$][\w$]*$/.test(handlerCode)) {
    return handlerCode;
  }
  return `(${paramName}) => { ${handlerCode}; }`;
}

/**
 * `onCommit: (i: number) => void`. Mirrors the SAME bare-identifier-vs-
 * arbitrary-expression convention `emitTemplateEvent` already uses for every
 * other template event: a bare identifier (e.g. `@keynav-commit="handleCommit"`)
 * is passed BY REFERENCE — `keynav` calls it as `onCommit(i)`. An arbitrary
 * expression is wrapped in `(i) => { ...; }`.
 */
function buildOnCommitCode(root: TemplateElementIR, ir: IRComponent): string {
  return buildHandlerCode(root, ir, 'keynav-commit', 'i') ?? '() => {}';
}

/**
 * `onPage: (detail: KeynavPageDetail) => void` (Phase 77, SPEC §3, §4.1).
 * Mirrors `buildOnCommitCode`'s convention exactly. Returns `null` (not a
 * fallback no-op) when `@keynav-page` isn't authored on this root — the
 * caller OMITS the `onPage` opts line entirely in that case, which is what
 * keeps a component with no `.grid`/`@keynav-page` usage byte-identical.
 */
function buildOnPageCode(root: TemplateElementIR, ir: IRComponent): string | null {
  return buildHandlerCode(root, ir, 'keynav-page', 'detail');
}

/**
 * Resolve the bare-read code for `keynavRoot.activeExpression` — Svelte's
 * `rewriteTemplateExpression` already lowers `$data.X`/model-`$props.X` to
 * the SAME bare identifier `X` (no `.value`, no 3-way useState-vs-forwarding
 * split the way React's `resolveTwoWayTarget.ts` needs), so the setter is a
 * trivial `(v) => { X = v; }` reassignment for both the simple member-
 * expression case and a deep chain rooted in `$data` (mirrors the React/Vue
 * references' identical deep-chain fallback).
 */
function resolveActiveTarget(
  expr: import('@babel/types').Expression,
  ir: IRComponent,
): { get: string; set: string } {
  const code = rewriteTemplateExpression(expr, ir);
  return { get: code, set: `(v) => { ${code} = v; }` };
}

/**
 * The `keynav` action-parameter object literal — `{ config, active,
 * getSource, getActive, setActive, onCommit, activeClass?, gridColumns?,
 * onPage? }` — spliced directly into `use:keynav={{ … }}` on the root
 * element (see `keynavRootAttrs`). `windower` is deliberately NOT populated
 * here (no v1 fixture wires one — mirrors the React/Vue references'
 * identical omission); the runtime action's `KeynavActionOpts.windower?`
 * field remains available for a future virtualized-list plan / hand-authored
 * consumer.
 */
function buildKeynavOptsCode(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  scopeRefs: KeynavFocusScopeRef[],
): string {
  const active = resolveActiveTarget(plan.keynavRoot.activeExpression, ir);
  const lines = [
    `config: ${buildConfigCode(plan.keynavRoot)}`,
    `active: ${active.get}`,
    `getSource: ${buildGetSourceCode(plan, ir)}`,
    `getActive: () => ${active.get}`,
    `setActive: ${active.set}`,
    `onCommit: ${buildOnCommitCode(plan.rootElement, ir)}`,
  ];
  if (plan.keynavRoot.activeClassExpression) {
    lines.push(
      `activeClass: ${rewriteTemplateExpression(plan.keynavRoot.activeClassExpression, ir)}`,
    );
  }
  // Phase 77 — grid columns. Only present when the root carries `.grid()`;
  // absent entirely otherwise, which is what keeps a non-grid root's
  // `use:keynav={{ … }}` byte-identical to pre-Phase-77.
  if (plan.keynavRoot.grid) {
    const columnsCode = rewriteTemplateExpression(plan.keynavRoot.grid.columnsExpression, ir);
    lines.push(`gridColumns: () => ${columnsCode}`);
  }
  // Phase 77 — `@keynav-page`, mirroring `onCommit`'s wiring exactly.
  const onPageCode = buildOnPageCode(plan.rootElement, ir);
  if (onPageCode !== null) {
    lines.push(`onPage: ${onPageCode}`);
  }
  // Plan 260806-lz7 — the strict-containment focus scope. Omitted entirely
  // when there are zero scope refs, which is what lets the runtime take its
  // documented `documentHasRealFocus` fallback rather than emitting a
  // useless empty array.
  if (scopeRefs.length > 0) {
    const scopeReads = scopeRefs.map((r) => r.refVar).join(', ');
    lines.push(`getFocusScope: () => [${scopeReads}]`);
  }
  return `{ ${lines.join(', ')} }`;
}

/**
 * Script-level scaffolding — ONLY the freshly-minted root ref's `let … =
 * $state<HTMLElement | undefined>(undefined);` declaration (Svelte refs MUST
 * be `$state(...)` to participate in reactivity — `emitScript.ts`'s
 * `emitRefDecls` doc comment) plus the component-unique group id, PER
 * resolved plan. UNLIKE the React/Vue references, there is no
 * `useKeynav(...)`/hook-CALL injection here — the `keynav` action itself is
 * invoked directly as a TEMPLATE attribute (`keynavRootAttrs`), not a
 * script-level call.
 */
/**
 * Plan 260806-lz7 — emits the FRESH scope-ref `let … = $state<HTMLElement |
 * undefined>(undefined);` decls (skipping any entry that reuses an existing
 * ref — see `resolveKeynavFocusScopeRefs`'s doc comment), ONCE per component
 * (unlike `buildKeynavScriptInjections`, which runs once per PLAN) —
 * duplicating a `let` declaration per plan would be a compile error the
 * instant a component has more than one `r-keynav` root.
 */
export function buildKeynavFocusScopeInjections(
  scopeRefs: KeynavFocusScopeRef[],
): SvelteScriptInjection[] {
  return scopeRefs
    .filter((r) => r.needsFreshRef)
    .map((r) => ({
      name: r.refVar,
      decl: `let ${r.refVar} = $state<HTMLElement | undefined>(undefined);`,
      position: 'top' as const,
    }));
}

export function buildKeynavScriptInjections(plan: KeynavEmitPlan): SvelteScriptInjection[] {
  const injections: SvelteScriptInjection[] = [];

  if (plan.mintedRootRef) {
    injections.push({
      name: plan.rootRefVar,
      decl: `let ${plan.rootRefVar} = $state<HTMLElement | undefined>(undefined);`,
      position: 'top',
    });
  }

  // Component-unique group id (T-71-06-02) — a plain `Math.random()`-derived
  // string minted once per component instance is stable for the component's
  // whole lifetime and collision-safe across instances/groups without
  // needing a framework-level id primitive (mirrors the Vue reference's
  // identical choice — Svelte has no stable `useId()`-equivalent either).
  injections.push({
    name: plan.groupIdVar,
    decl: `const ${plan.groupIdVar} = \`keynav-\${Math.random().toString(36).slice(2)}\`;`,
    position: 'top',
  });

  return injections;
}

/**
 * Root-element template attribute fragments — `bind:this={…}` (only when a
 * fresh ref was synthesized; an author-declared `ref="x"` already emits its
 * own `bind:this={x}` via the normal attribute path, and Svelte permits only
 * one `bind:this=` per element), the `use:keynav={{ … }}` action attribute
 * (see `buildKeynavOptsCode`), and — activedescendant focus model only —
 * `aria-activedescendant`, pointing at the active item's id.
 */
export function keynavRootAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  ir: IRComponent,
  scopeRefs: KeynavFocusScopeRef[] = [],
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.mintedRootRef) {
    attrs.push(`bind:this={${plan.rootRefVar}}`);
  }
  attrs.push(`use:keynav={${buildKeynavOptsCode(plan, ir, scopeRefs)}}`);
  if (plan.keynavRoot.focusModel === 'activedescendant') {
    const activeCode = rewriteTemplateExpression(plan.keynavRoot.activeExpression, ir);
    attrs.push(
      `aria-activedescendant={${activeCode} >= 0 ? \`\${${plan.groupIdVar}}-item-\${${activeCode}}\` : undefined}`,
    );
  }
  return attrs;
}

/**
 * Item-element template attribute fragments — stable `id`, the
 * `data-rozie-keynav-item` delegation/bounds-check marker (SPEC §8, triple
 * duty), the always-present `data-rozie-keynav-active` marker (SPEC §9),
 * and — tabindex focus model only — the `tabindex` roving binding. All FOUR
 * compare `indexExpr` against the live active value — declarative Svelte
 * template bindings (`keynav` never writes these directly; see its module
 * doc comment).
 *
 * Phase 77 (planner Gap B) — an item's OWN explicit index expression
 * (`r-keynav-item="{ index: <expr> }"`, rewritten via
 * `rewriteTemplateExpression` — the SAME single rewrite context this whole
 * module uses) takes priority over `loopIndexExpr` (the enclosing loop's
 * synthesized/authored index alias) when present. This is what makes an
 * explicit index correct even when the item's nearest enclosing loop is a
 * NESTED inner loop (e.g. the date-picker's panels -> weeks -> days
 * triple-nested day grid) — the expression's own identifier references are
 * already bound to whichever loop scope it was authored in, regardless of
 * nesting depth.
 *
 * Returns `[]` when neither an explicit index nor a loop index is available.
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
    `id={\`\${${plan.groupIdVar}}-item-\${${indexExpr}}\`}`,
    `data-rozie-keynav-item={${indexExpr}}`,
    `data-rozie-keynav-active={${activeCode} === ${indexExpr} ? '' : undefined}`,
  ];
  if (plan.keynavRoot.focusModel === 'tabindex') {
    attrs.push(`tabindex={${activeCode} === ${indexExpr} ? 0 : -1}`);
  }
  return attrs;
}

/**
 * Strips the synthetic `@keynav-commit` / `@keynav-page` template-event
 * Listeners out of the root element's `events` array — both are consumed by
 * `buildOnCommitCode`/`buildOnPageCode` above and routed into the `keynav`
 * action's `onCommit`/`onPage` options, NEVER as Svelte
 * `onkeynav-commit=`/`onkeynav-page=` template attributes (which would be
 * inert — neither is a real DOM event a host element dispatches).
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

/**
 * True when `body` (a loop's direct body, NOT recursing into a NESTED
 * `r-for` — that loop synthesizes its own index) contains at least one
 * `keynavItem`-bearing element. Drives `emitLoop`'s index-alias synthesis in
 * `emitTemplateNode.ts`: an author who didn't write `(it, idx) in items`
 * still gets a working `data-rozie-keynav-item="index"` marker.
 */
export function loopBodyHasKeynavItem(body: TemplateNode[]): boolean {
  const walk = (node: TemplateNode): boolean => {
    switch (node.type) {
      case 'TemplateElement':
        if (node.keynavItem) return true;
        if (node.children.some(walk)) return true;
        if (node.slotFillers?.some((f) => f.body.some(walk))) return true;
        return false;
      case 'TemplateFragment':
        return node.children.some(walk);
      case 'TemplateConditional':
        return node.branches.some((b) => b.body.some(walk));
      case 'TemplateMatch':
        return (
          node.branches.some((b) => b.body.some(walk)) ||
          (node.hostElement !== undefined && walk(node.hostElement))
        );
      case 'TemplateSlotInvocation':
        return node.fallback.some(walk);
      // Deliberately NOT recursing into TemplateLoop — a keynavItem inside a
      // NESTED r-for gets THAT loop's own synthesized/authored index, not
      // this outer loop's.
      default:
        return false;
    }
  };
  return body.some(walk);
}
