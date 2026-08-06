/**
 * emitKeynav — Phase 71 Plan 04 (React target, REFERENCE implementation),
 * reworked by Phase 77 Plan 03 from one-plan-per-component to
 * one-plan-per-root (77-SPEC.md §6, §7.3).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02, extended Phase 77 Plan 02 with
 * `grid`/`groupIndex`/`indexExpression`) to the `useKeynav` React controller
 * (Phase 71 Plan 03's `@rozie/runtime-keynav-core` + Phase 77 Plan 03's
 * `onPage`/`gridColumns` extension). Two responsibilities, resolved ONCE per
 * component (unlike most `emit/*` modules, which are pure per-node
 * functions) because each root's hook-wiring and its own items' attribute
 * bindings all share the SAME group id + active-binding code:
 *
 *   1. `resolveKeynavPlans(ir)` — locates EVERY `keynavRoot` element in the
 *      component and, for each, the FIRST `keynavItem` associated to THAT
 *      root (via `KeynavItemIR.groupIndex`, defaulting to 0 — core's
 *      `resolveKeynavGroups` owns the association rule; the emitter never
 *      re-derives containment) + its enclosing `r-for` loop, mirroring
 *      core's own walk (`packages/core/src/ir/resolveKeynavGroups.ts`).
 *      Returns one plan per root, in document order. Returns `[]` for the
 *      overwhelming majority case (no `r-keynav` in the component) — every
 *      call site below short-circuits on an empty array, so a non-keynav
 *      component's emit is completely untouched (SPEC §7.4: "no corpus
 *      rebless").
 *
 *   2. `buildKeynavScriptInjections(plan, ir, collectors)` — renders ONE
 *      `useKeynav(...)` call (plus its `useRef`/`useId` scaffolding) per
 *      plan as scriptInjection strings. `emitTemplate.ts` calls this once per
 *      resolved plan, so a two-root component gets two independent
 *      controller calls. `emitTemplate.ts` folds these into
 *      `EmitTemplateResult.scriptInjections`, and `shell.ts` places
 *      non-`function`-prefixed scriptInjections AFTER the user script body —
 *      required because `onCommit`/`onPage` may reference a user-authored
 *      handler.
 *
 * **Identifier naming (the shape the other five target plans mirror):** the
 * root-ref and group-id identifiers keep their PRE-PHASE-77 spelling for
 * group index 0 and append the index for later groups (`__rozieKeynavGroupId`
 * / `__rozieKeynavGroupId1` / `__rozieKeynavGroupId2` …). This is the exact
 * mechanism that keeps a single-root, non-grid component's emitted output
 * byte-identical to before this plan.
 *
 * Per-element attribute emission (root `ref`/`aria-activedescendant`, item
 * `id`/`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabIndex`) is
 * built by `keynavRootAttrs`/`keynavItemAttrs` below and spliced directly
 * into `emitTemplateNode.ts`'s `headParts` array — mirroring the existing
 * `rShowStyleAttr`/`scopeAttrJsx` raw-string-splice pattern rather than
 * routing through the `AttributeBinding` machinery, since these markers are
 * emitter-synthesized, not author-authored bindings. `emitTemplateNode.ts`
 * selects the CORRECT plan for each element by comparing the element's own
 * `keynavRoot.groupIndex`/`keynavItem.groupIndex` (each defaulting to 0)
 * against `KeynavEmitPlan.groupIndex` — never by using "the" plan, since
 * there may now be several.
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
import { resolveTwoWayTarget } from './resolveTwoWayTarget.js';
import { htmlElementTypeForTag } from './emitTemplateAttribute.js';
import type {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` so they can never collide with a `<script>`-declared
// binding (mirrors the `__rozieMatch_N`/`__rozieExposeRef` convention).
// Group index 0 keeps the bare spelling; later groups append the index (see
// `suffixFor` below) — the mechanism that keeps single-root emit unchanged.
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
  /** `ref={...}` identifier to emit on the root — reuses an author `ref="x"` when present. */
  rootRefVar: string;
  /** Group-id identifier shared by the root's `aria-activedescendant` and every item's `id`. */
  groupIdVar: string;
  /** The active-index get/set pair resolved from `keynavRoot.activeExpression` (mirrors `r-model`). */
  activeGet: string;
  activeSet: string;
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

    // Reuse an author-declared `ref="x"` on the SAME element when present
    // (JSX permits only one `ref=` attribute) rather than minting a second,
    // colliding one — mirrors the "don't break an author's own wiring"
    // discipline elsewhere in the emitter (Rule 2 territory, not Rule 4: this
    // is additive robustness, not a structural change).
    const existingRef = findStaticAttrValue(root.element, 'ref');
    const rootRefVar =
      existingRef !== null && ir.refs.some((r) => r.name === existingRef)
        ? existingRef
        : `${ROOT_REF_VAR}${suffix}`;

    const { local: activeGet, setter: activeSet } = resolveTwoWayTarget(
      root.keynavRoot.activeExpression,
      ir,
    );

    return {
      groupIndex,
      rootElement: root.element,
      keynavRoot: root.keynavRoot,
      itemElement: firstItem?.element ?? null,
      itemLoop: firstItem?.enclosingLoop ?? null,
      rootRefVar,
      groupIdVar: `${GROUP_ID_VAR}${suffix}`,
      activeGet,
      activeSet,
    };
  });
}

/**
 * Plan 260806-lz7 — the strict-containment focus scope. One entry per
 * `html`-kind TOP-LEVEL element of the template (`<template>` does not
 * enforce a single root — multiple top-level elements are legal); a
 * `component`-kind or non-element top-level node is skipped (a ref on a
 * child component does not yield a DOM Element). Each entry either reuses an
 * EXISTING `ref=` on that element (the keynav root's own minted/reused ref
 * when the element IS a keynav root — appending it is a no-op in the normal
 * case; or an author-declared `ref="x"`) or mints a FRESH one — JSX permits
 * only one `ref=` attribute per element, so a fresh ref is only minted when
 * neither already exists.
 */
export interface KeynavFocusScopeRef {
  element: TemplateElementIR;
  refVar: string;
  /** False when `refVar` names an ALREADY-existing ref (the keynav root's
   * own, or an author-declared one) — no fresh `useRef`/`ref=` needs
   * minting/stamping for this entry. */
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
 * `html`-kind top-level elements, in which case every `useKeynav` opts
 * object OMITS `getFocusScope` entirely, and the runtime takes its
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
 * `ref={...}` for a FRESHLY-minted scope ref only — an already-covered scope
 * entry (the keynav root's own ref, or an author-declared one) already emits
 * its `ref=` via its own normal path, and JSX permits only one `ref=` per
 * element. `node` must be reference-identical to the element
 * `resolveKeynavFocusScopeRefs` walked (i.e. the ORIGINAL, pre-
 * `stripKeynavSyntheticEvents` node) — see `emitTemplateNode.ts`'s call site.
 */
export function keynavFocusScopeAttrs(
  scopeRefs: KeynavFocusScopeRef[],
  node: TemplateElementIR,
): string[] {
  const match = scopeRefs.find((r) => r.element === node);
  if (!match || !match.needsFreshRef) return [];
  return [`ref={${match.refVar}}`];
}

/**
 * `KeynavConfig` object literal — every field is statically known at compile
 * time. Deliberately NEVER gains a `grid` key here (Phase 77): grid columns
 * are a reactive expression, and `config` is captured exactly ONCE by
 * `useKeynav`'s mount effect — embedding a reactive closure directly here
 * would go stale across re-renders. The reactive columns getter instead
 * threads through the DEDICATED `gridColumns` hook option (see
 * `buildKeynavScriptInjections`), which the hook re-reads through its own
 * latest-ref on every keydown (`useKeynav.ts`'s module doc comment). A root
 * without `.grid` emits the EXACT literal it emitted pre-Phase-77.
 */
function buildConfigCode(k: KeynavRootIR): string {
  return `{ focusModel: '${k.focusModel}', orientation: '${k.orientation}', loop: ${k.loop}, typeahead: ${k.typeahead}, skipDisabled: ${k.skipDisabled} }`;
}

/**
 * `getSource: () => unknown[]` — the `:source` array (explicit or
 * synthesized, SPEC §5), remapped through the item's `{ label?, disabled? }`
 * expressions (SPEC §5) when the item is `r-for`-driven and declares at
 * least one of them. `labelExpression`/`disabledExpression` were parsed
 * WITHIN the loop's own scope (the item alias is a bound identifier there),
 * so re-rendering them via `rewriteTemplateExpression` inside a
 * `.map((<itemAlias>) => ({ ... }))` callback is a direct, safe re-use of
 * the SAME expression text authored in `r-keynav-item="{ label: it.label }"`.
 *
 * If the item declares neither field (or isn't `r-for`-driven — SPEC §5:
 * "item index comes from the r-for context"), the raw source array is
 * returned as-is: the state machine's `itemMetaAt` already degrades
 * gracefully for a non-`{label,disabled}`-shaped element (71-03's
 * `stateMachine.ts`), and SPEC §12 documents the `textContent` typeahead
 * fallback for a rendered-but-label-less item as a KNOWN v1 limitation —
 * out of scope for this (non-DOM-touching) getSource builder.
 */
function buildGetSourceCode(plan: KeynavEmitPlan, ir: IRComponent): string {
  const sourceExpr = plan.keynavRoot.sourceExpression;
  if (!sourceExpr) {
    // Core already emitted ROZ987 (KEYNAV_SOURCE_UNRESOLVED) upstream for
    // this shape — best-effort empty source keeps the emitted code
    // well-formed rather than crashing the compiler on an already-erroring
    // input (D-08).
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
 * keynav event uses (mirrors `emitTemplateEvent`/`emitListenerOutsideClick`'s
 * same convention for every other template event): a bare identifier is
 * passed BY REFERENCE — the runtime calls it directly, so the author's
 * handler naturally receives the callback's own parameter. An arbitrary
 * expression is wrapped in `(<paramName>) => { ...; }`.
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
 * arbitrary-expression convention `emitTemplateEvent`/`emitListenerOutsideClick`
 * already use for every other template event: a bare identifier (e.g.
 * `@keynav-commit="handleCommit"`) is passed BY REFERENCE — `useKeynav`
 * calls it as `onCommit(i)`, so the author's handler naturally receives the
 * active index as its own parameter. An arbitrary expression (SPEC's own
 * examples: `run(items[$data.active])`) is wrapped in `(i) => { ...; }` —
 * `i` is exposed but unused by SPEC's examples, which read `$data.active`
 * themselves instead; either style works.
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
 * Plan 260806-lz7 — emits the FRESH scope-ref `useRef<...>(null)` lines
 * (skipping any entry that reuses an existing ref — see
 * `resolveKeynavFocusScopeRefs`'s doc comment). Called ONCE per component
 * (unlike `buildKeynavScriptInjections`, which runs once per PLAN) —
 * duplicating a `const` declaration per plan would be a compile error the
 * instant a component has more than one `r-keynav` root.
 */
export function buildKeynavFocusScopeInjections(
  scopeRefs: KeynavFocusScopeRef[],
  collectors: { react: ReactImportCollector },
): string[] {
  const injections: string[] = [];
  for (const ref of scopeRefs) {
    if (!ref.needsFreshRef) continue;
    collectors.react.add('useRef');
    const refType = htmlElementTypeForTag(ref.element.tagName);
    injections.push(`const ${ref.refVar} = useRef<${refType} | null>(null);`);
  }
  return injections;
}

/**
 * Renders ONE `useKeynav(...)` call plus its `useRef`/`useId` scaffolding as
 * scriptInjection lines (placed AFTER the user script body by `shell.ts` —
 * see the module doc comment). `emitTemplate.ts` calls this once PER
 * resolved plan, so a two-root component emits TWO independent controller
 * calls. Registers every import the emitted lines reference.
 *
 * `scopeRefs` (Plan 260806-lz7) — the component-WIDE focus scope (shared
 * identically across every plan's `getFocusScope`, regardless of which root
 * this call is for — the guard's containment boundary is the whole
 * component, not a single root). `[]` when the template has zero
 * `html`-kind top-level elements, in which case `getFocusScope` is omitted
 * entirely from this plan's opts and the runtime takes its documented
 * fallback.
 */
export function buildKeynavScriptInjections(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
  scopeRefs: KeynavFocusScopeRef[] = [],
): string[] {
  const injections: string[] = [];

  if (plan.rootRefVar === `${ROOT_REF_VAR}${suffixFor(plan.groupIndex)}`) {
    collectors.react.add('useRef');
    // 77-07 — typed by the root's ACTUAL element tag (e.g. `HTMLDivElement`
    // for a `<div r-keynav:...>` root), not a bare `HTMLElement`: React's
    // JSX `ref=` typing is invariant on `RefObject['current']`, so
    // `useRef<HTMLElement | null>` is NOT assignable to a `<div ref={X}>`'s
    // `LegacyRef<HTMLDivElement>` (TS2322) — unreachable before this plan,
    // since no prior r-keynav consumer minted a fresh ref on a `<div>` (see
    // `htmlElementTypeForTag`'s doc comment).
    const refType = htmlElementTypeForTag(plan.rootElement.tagName);
    injections.push(`const ${plan.rootRefVar} = useRef<${refType} | null>(null);`);
  }

  collectors.react.add('useId');
  injections.push(`const ${plan.groupIdVar} = useId();`);

  collectors.runtime.add('useKeynav');
  const optsLines = [
    `  config: ${buildConfigCode(plan.keynavRoot)},`,
    `  getSource: ${buildGetSourceCode(plan, ir)},`,
    `  getActive: () => ${plan.activeGet},`,
    `  setActive: ${plan.activeSet},`,
    `  onCommit: ${buildOnCommitCode(plan.rootElement, ir)},`,
  ];
  if (plan.keynavRoot.activeClassExpression) {
    optsLines.push(
      `  activeClass: ${rewriteTemplateExpression(plan.keynavRoot.activeClassExpression, ir)},`,
    );
  }
  // Phase 77 — grid columns. Only present when the root carries `.grid()`;
  // absent entirely otherwise, which is what keeps a non-grid root's
  // useKeynav call byte-identical to pre-Phase-77 (see `buildConfigCode`'s
  // doc comment for why this is a SIBLING opts key, not a `config.grid`
  // entry).
  if (plan.keynavRoot.grid) {
    const columnsCode = rewriteTemplateExpression(plan.keynavRoot.grid.columnsExpression, ir);
    optsLines.push(`  gridColumns: () => ${columnsCode},`);
  }
  // Phase 77 — `@keynav-page`, mirroring `onCommit`'s wiring exactly.
  const onPageCode = buildOnPageCode(plan.rootElement, ir);
  if (onPageCode !== null) {
    optsLines.push(`  onPage: ${onPageCode},`);
  }
  // Plan 260806-lz7 — the strict-containment focus scope. Omitted entirely
  // when there are zero scope refs (a template with no `html`-kind top-level
  // elements at all — vanishingly rare), which is what lets the runtime take
  // its documented `documentHasRealFocus` fallback rather than emitting a
  // useless empty array.
  if (scopeRefs.length > 0) {
    const scopeReads = scopeRefs.map((r) => `${r.refVar}.current`).join(', ');
    optsLines.push(`  getFocusScope: () => [${scopeReads}],`);
  }
  injections.push(`useKeynav(${plan.rootRefVar}, {\n${optsLines.join('\n')}\n});`);

  return injections;
}

/**
 * Root-element JSX attribute fragments — `ref={...}` (only when a fresh ref
 * was synthesized; an author-declared `ref="x"` already emits its own
 * `ref={x}` via the normal attribute path, and JSX permits only one `ref=`)
 * plus `aria-activedescendant` for the activedescendant focus model,
 * pointing at the active item's id (undefined — attribute omitted — when
 * there is no active item, e.g. an empty source).
 *
 * `plan` must be the plan whose `groupIndex` matches THIS element's own
 * `keynavRoot.groupIndex` (defaulting to 0) — callers select it via
 * `emitTemplateNode.ts`'s per-node plan lookup, never "the" single plan.
 */
export function keynavRootAttrs(plan: KeynavEmitPlan | null, node: TemplateElementIR): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.rootRefVar === `${ROOT_REF_VAR}${suffixFor(plan.groupIndex)}`) {
    attrs.push(`ref={${plan.rootRefVar}}`);
  }
  if (plan.keynavRoot.focusModel === 'activedescendant') {
    attrs.push(
      `aria-activedescendant={${plan.activeGet} >= 0 ? \`\${${plan.groupIdVar}}-item-\${${plan.activeGet}}\` : undefined}`,
    );
  }
  return attrs;
}

/**
 * Item-element JSX attribute fragments — stable `id`, the
 * `data-rozie-keynav-item` delegation/bounds-check marker (SPEC §8, triple
 * duty), the always-present `data-rozie-keynav-active` marker (SPEC §9),
 * and — tabindex focus model only — the `tabIndex` roving binding. All FOUR
 * are declarative JSX bindings comparing the resolved index expression
 * against the live active value — they update on the SAME render pass as
 * the rest of the component (`useKeynav` never writes these directly; see
 * its module doc comment).
 *
 * Phase 77 (planner Gap B) — an item's OWN explicit index expression
 * (`r-keynav-item="{ index: <expr> }"`, rewritten in the item's own loop
 * scope — it was parsed there, exactly like `label`/`disabled`) takes
 * priority over `loopIndexExpr` (the enclosing loop's synthesized/authored
 * index alias) when present. This is what makes an explicit index correct
 * even when the item's nearest enclosing loop is a NESTED inner loop (e.g.
 * the date-picker's panels -> weeks -> days triple-nested day grid) — the
 * expression's own identifier references are already bound to whichever
 * loop scope it was authored in, regardless of nesting depth.
 *
 * Returns `[]` when neither an explicit index nor a loop index is
 * available (e.g. a `keynavItem` authored outside any `r-for` — an
 * unsupported v1 shape; degrades to a no-op rather than emitting malformed
 * JSX).
 *
 * `plan` must be the plan whose `groupIndex` matches THIS element's own
 * `keynavItem.groupIndex` (defaulting to 0) — see `keynavRootAttrs`'s doc
 * comment.
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
  const attrs: string[] = [
    `id={\`\${${plan.groupIdVar}}-item-\${${indexExpr}}\`}`,
    `data-rozie-keynav-item={${indexExpr}}`,
    `data-rozie-keynav-active={${plan.activeGet} === ${indexExpr} ? '' : undefined}`,
  ];
  if (plan.keynavRoot.focusModel === 'tabindex') {
    attrs.push(`tabIndex={${plan.activeGet} === ${indexExpr} ? 0 : -1}`);
  }
  return attrs;
}

/**
 * Strips the synthetic `@keynav-commit` / `@keynav-page` template-event
 * Listeners out of the root element's `events` array — both are consumed by
 * `buildOnCommitCode`/`buildOnPageCode` above and routed into `useKeynav`'s
 * `onCommit`/`onPage` options, NEVER as JSX `onKeynavCommit={...}` /
 * `onKeynavPage={...}` props (which would be inert — neither is a real DOM
 * event a host element dispatches).
 *
 * Also strips an explicit `:source="…"` binding attribute (`resolveKeynavGroups`
 * deliberately does NOT do this itself — see its module doc comment's "NOTE
 * for emitter plans" — every per-target emitter that walks `attributes` for
 * real DOM/component props must skip a `binding` attr named `'source'` on a
 * `keynavRoot` element). Latent since Phase 71/77-02 — no consumer had ever
 * authored an EXPLICIT `:source` (every prior root synthesized its source
 * from a co-located `r-for`) until the date-picker day grid's flat,
 * triple-nested-loop source (77-08) — a bare `source={rozieAttr(...)}` JSX
 * prop is not assignable to `DetailedHTMLProps<HTMLAttributes<...>>` (TS2322)
 * on a plain `<div>` root.
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
 * still gets a working `data-rozie-keynav-item={index}` marker — the
 * compiler owns the plumbing (SPEC §1's guiding principle), not the author.
 * Fires even for an item carrying an explicit `index` expression (Phase
 * 77) — synthesizing an alias that ends up unused for that one item is
 * harmless, and a MIXED loop body (some items explicit, some relying on the
 * loop context) still needs the alias for the ones that don't override it.
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
