/**
 * emitKeynav — Phase 71 Plan 07 (Solid target), reworked by Phase 77 Plan 04
 * from one-plan-per-component to one-plan-per-root (77-SPEC.md §6, §7.3),
 * mirroring the React reference's Plan 77-03 rework.
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02, extended Phase 77 Plan 02 with
 * `grid`/`groupIndex`/`indexExpression`) to the `createKeynav` Solid
 * primitive (Phase 71 Plan 03's `@rozie/runtime-keynav-core` + Phase 77 Plan
 * 04's `onPage`/`gridColumns` extension). Modeled directly on the React
 * REFERENCE implementation (`packages/targets/react/src/emit/emitKeynav.ts`,
 * Plan 71-04, extended Plan 77-03) — same two responsibilities, resolved
 * ONCE per component:
 *
 *   1. `resolveKeynavPlans(ir)` — locates EVERY `keynavRoot` element in the
 *      component and, for each, the FIRST `keynavItem` associated to THAT
 *      root (via `KeynavItemIR.groupIndex`, defaulting to 0 — core's
 *      `resolveKeynavGroups` owns the association rule; the emitter never
 *      re-derives containment) + its enclosing `r-for` loop, mirroring
 *      core's own walk. Returns one plan per root, in document order.
 *      Returns `[]` for the overwhelming majority case (no `r-keynav` in the
 *      component) — every call site below short-circuits on an empty array,
 *      so a non-keynav component's emit is completely untouched (SPEC §7.4:
 *      "no corpus rebless").
 *
 *   2. `buildKeynavScriptInjections(plan, ir, collectors)` — renders the
 *      root-ref `let` declaration, the component-unique group id, and the
 *      `createKeynav(...)` call as scriptInjection lines, ONE set per
 *      resolved plan. `emitTemplate.ts` folds these into
 *      `EmitTemplateResult.scriptInjections`, and `shell.ts` places them
 *      right before the JSX `return` statement — AFTER the user script
 *      body, since `onCommit`/`onPage` may reference a user-authored
 *      handler (e.g. `@keynav-commit="run(items[$data.active])"`).
 *
 * **Identifier naming (mirrors the React reference exactly):** the root-ref
 * and group-id identifiers keep their PRE-PHASE-77 spelling for group index
 * 0 and append the index for later groups (`__rozieKeynavGroupId` /
 * `__rozieKeynavGroupId1` / `__rozieKeynavGroupId2` …) — the mechanism that
 * keeps a single-root, non-grid component's emitted output byte-identical to
 * before this plan.
 *
 * SOLID-SPECIFIC DIVERGENCE FROM REACT — root ref is a callback-ref
 * ACCESSOR, not a ref OBJECT: Solid's idiom for a DOM ref is a plain
 * `let fooRef: HTMLElement | null = null;` variable assigned via a JSX
 * callback ref (`ref={(el) => { fooRef = el; }}` — see `emitScript.ts`'s
 * ref-decl comment / `emitTemplateAttribute.ts`'s `ref=` branch), NOT
 * React's `useRef` object. The minted root-ref variable
 * (`__rozieKeynavRootRef`) follows the SAME `let X: T | null = null;` +
 * callback-ref shape every OTHER Solid ref uses, and `createKeynav` is
 * called with `() => __rozieKeynavRootRef` (an accessor closing over the
 * variable), mirroring `createOutsideClick`'s identical
 * `Array<() => Element | null | undefined>` shape.
 *
 * Solid's component function runs EXACTLY ONCE per instance (no per-render
 * re-invocation the way React's function body re-runs) — so, like the Vue
 * reference, the group id is minted via a plain `Math.random()`-derived
 * string rather than React's `useId()`, and NO latest-ref/`optsRef`
 * indirection is needed (every closure below reads through the SAME
 * long-lived `opts` object for the primitive's whole lifetime — see
 * `createKeynav.ts`'s own module doc comment for the identical rationale).
 *
 * Solid signal reads need `()` call-form (`rewriteTemplateExpression`
 * already appends it for `$data`/model-`$props` MemberExpressions — Solid
 * has no Vue-style template-vs-script auto-unwrap split, so ONE rewriter
 * suffices everywhere, exactly like the React reference). The two-way
 * active-index get/set pair is resolved via `resolveTwoWayTarget` (the SAME
 * helper the `r-model:propName=` consumer-side twoWayBinding emit branch
 * uses) — its `local` is a bare Accessor identifier (needs an explicit `()`
 * appended here) and its `setter` is a bare Setter identifier (passed
 * directly — `setActive(v)` already matches `KeynavHost.setActive`'s
 * `(i: number) => void` signature).
 *
 * A loop item's own index (`ctx.keynavItemIndexAlias`, threaded through
 * `emitTemplateNode.ts`) is ALSO a Solid Accessor inside a `<For>` body
 * (`(item, index) => ...`, RESEARCH: "the index parameter is a reactive
 * accessor, NOT a scalar") — `keynavItemAttrs` below therefore appends `()`
 * to it too wherever it renders a value, unlike the React/Vue references
 * (whose loop index is a plain number). Phase 77's explicit `index`
 * expression is instead rewritten via `rewriteTemplateExpression` WITH the
 * caller's `invokeAccessors` set threaded through — an explicit index may
 * itself reference one or more ENCLOSING loops' own index aliases (e.g. the
 * date-picker's `w * 7 + d`, both Accessors), and `invokeAccessors`
 * accumulates every ancestor loop's index alias as `emitLoop` descends
 * (`emitTemplateNode.ts`'s `bodyAccessors`), so this is a direct reuse of
 * the SAME mechanism rather than a bespoke one.
 *
 * Per-element attribute emission (root `ref=`/`aria-activedescendant`, item
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
import type { RuntimeSolidImportCollector, SolidImportCollector } from '../rewrite/collectSolidImports.js';

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` so they can never collide with a `<script>`-declared
// binding (mirrors the React/Vue references' `__rozieMatch_N`/
// `__rozieExposeRef` convention). Group index 0 keeps the bare spelling;
// later groups append the index (see `suffixFor` below) — the mechanism
// that keeps single-root emit unchanged.
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const SET_ROOT_REF_VAR = '__setRozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';

function suffixFor(groupIndex: number): string {
  return groupIndex === 0 ? '' : String(groupIndex);
}

/**
 * 77-07 — the `createSignal` setter identifier paired with a minted,
 * conditional-root ref getter (`rootRefVar`, e.g. `__rozieKeynavRootRef1`).
 * Only ever called when `mintedRootRef && insideConditional` — see
 * `KeynavEmitPlan.insideConditional`'s doc comment.
 */
function rootRefSetterVar(rootRefVar: string): string {
  return `${SET_ROOT_REF_VAR}${rootRefVar.slice(ROOT_REF_VAR.length)}`;
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
  /** `let <rootRefVar>Ref = ...` identifier the root's `ref=` callback assigns. */
  rootRefVar: string;
  /**
   * True when `rootRefVar` was FRESHLY synthesized (needs its own `let`
   * decl + `ref={(el) => {...}}` callback attribute). False when reusing an
   * author-declared `ref="x"` (already emits its own `let xRef` decl +
   * `ref={...}` callback via the normal attribute path — `emitScript.ts`'s
   * ref-decl loop / `emitTemplateAttribute.ts`'s `ref=` branch).
   */
  mintedRootRef: boolean;
  /** Group-id identifier shared by the root's `aria-activedescendant` and every item's `id`. */
  groupIdVar: string;
  /** The active-index get (Accessor-call, e.g. `active()`) / set (bare Setter identifier) pair. */
  activeGet: string;
  activeSet: string;
  /**
   * 77-07 — true when the root sits inside a `TemplateConditional`/
   * `TemplateMatch` (`r-if`/`r-match`) branch, i.e. its DOM element is torn
   * down and recreated each time the branch toggles. ONLY meaningful when
   * `mintedRootRef` is also true (an author-reused `$refs`-declared ref is
   * untouched by this fix — out of scope, see `createKeynav.ts`'s module
   * doc comment); combined with `mintedRootRef`, this selects a
   * `createSignal`-backed ref instead of a plain `let` variable so
   * `createKeynav`'s effect can reactively detect the root (re)appearing
   * (`createKeynav.ts`'s `createEffect`-over-`onMount` fix). `false` for
   * EVERY pre-77-07 fixture (no existing `r-keynav` root sits behind a
   * conditional), which is what keeps this fix's emit change unreachable —
   * and therefore byte-identical — for the whole pre-existing corpus.
   */
  insideConditional: boolean;
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
  roots: { element: TemplateElementIR; keynavRoot: KeynavRootIR; insideConditional: boolean }[];
  items: { element: TemplateElementIR; keynavItem: KeynavItemIR; enclosingLoop: TemplateLoopIR | null }[];
} {
  const roots: { element: TemplateElementIR; keynavRoot: KeynavRootIR; insideConditional: boolean }[] = [];
  const items: { element: TemplateElementIR; keynavItem: KeynavItemIR; enclosingLoop: TemplateLoopIR | null }[] = [];

  // 77-07 — `insideConditional` threads through the SAME recursive walk as
  // `enclosingLoop`, flipping to `true` the moment the walk descends into a
  // `TemplateConditional`/`TemplateMatch` (`r-if`/`r-match`) branch and
  // staying `true` for everything nested inside it (a root inside a loop
  // inside a conditional is still conditional). See `KeynavEmitPlan.
  // insideConditional`'s doc comment for why this drives the
  // createSignal-vs-plain-let ref choice below.
  const walk = (
    node: TemplateNode,
    enclosingLoop: TemplateLoopIR | null,
    insideConditional: boolean,
  ): void => {
    switch (node.type) {
      case 'TemplateElement': {
        if (node.keynavRoot) {
          roots.push({ element: node, keynavRoot: node.keynavRoot, insideConditional });
        }
        if (node.keynavItem) {
          items.push({ element: node, keynavItem: node.keynavItem, enclosingLoop });
        }
        for (const child of node.children) walk(child, enclosingLoop, insideConditional);
        if (node.slotFillers) {
          for (const filler of node.slotFillers) {
            for (const child of filler.body) walk(child, enclosingLoop, insideConditional);
          }
        }
        break;
      }
      case 'TemplateLoop':
        for (const child of node.body) walk(child, node, insideConditional);
        break;
      case 'TemplateFragment':
        for (const child of node.children) walk(child, enclosingLoop, insideConditional);
        break;
      case 'TemplateConditional':
        for (const branch of node.branches)
          for (const child of branch.body) walk(child, enclosingLoop, true);
        break;
      case 'TemplateMatch':
        for (const branch of node.branches)
          for (const child of branch.body) walk(child, enclosingLoop, true);
        if (node.hostElement) walk(node.hostElement, enclosingLoop, insideConditional);
        break;
      case 'TemplateSlotInvocation':
        for (const child of node.fallback) walk(child, enclosingLoop, insideConditional);
        break;
      // TemplateInterpolation / TemplateStaticText — leaves.
      default:
        break;
    }
  };

  walk(root, null, false);
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
    // Solid JSX permits only one `ref=` attribute per element, so silently
    // overwriting an author's own ref would be a Rule-1-class bug. Mirrors the
    // React/Vue references' identical defensive check (untested by a
    // dedicated fixture there too — SPEC §3.1 has no example combining both).
    const existingRef = findStaticAttrValue(root.element, 'ref');
    const mintedRootRef = !(existingRef !== null && ir.refs.some((r) => r.name === existingRef));
    const rootRefVar = mintedRootRef ? `${ROOT_REF_VAR}${suffix}` : `${existingRef}Ref`;

    // `activeExpression` is validated as a writable lvalue upstream
    // (`resolveKeynavGroups`, core) before this emitter ever sees it —
    // `resolveTwoWayTarget` returning `null` here would indicate an IR
    // regression, not a reachable v1 authoring shape (mirrors the React/Vue
    // references' identical defensive-throw discipline).
    const activeTarget = resolveTwoWayTarget(root.keynavRoot.activeExpression, ir);
    if (activeTarget === null) {
      throw new Error(
        'resolveKeynavPlans: unexpected r-keynav active-index expression shape reached the Solid emitter.',
      );
    }

    return {
      groupIndex,
      rootElement: root.element,
      keynavRoot: root.keynavRoot,
      itemElement: firstItem?.element ?? null,
      itemLoop: firstItem?.enclosingLoop ?? null,
      rootRefVar,
      mintedRootRef,
      groupIdVar: `${GROUP_ID_VAR}${suffix}`,
      // Solid signals are Accessors — `local` needs the explicit `()` call
      // (mirrors the twoWayBinding attribute emit branch's `${local}()` shape
      // in `emitTemplateAttribute.ts`). `setter` is passed BARE — a Solid
      // Setter already matches `(i: number) => void`.
      activeGet: `${activeTarget.local}()`,
      activeSet: activeTarget.setter,
      insideConditional: root.insideConditional,
    };
  });
}

/** `KeynavConfig` object literal — every field is statically known at compile time. */
function buildConfigCode(k: KeynavRootIR): string {
  return `{ focusModel: '${k.focusModel}', orientation: '${k.orientation}', loop: ${k.loop}, typeahead: ${k.typeahead}, skipDisabled: ${k.skipDisabled} }`;
}

/**
 * `getSource: () => unknown[]` — the `:source` array (explicit or
 * synthesized, SPEC §5), remapped through the item's `{ label?, disabled? }`
 * expressions (SPEC §5) when the item is `r-for`-driven and declares at
 * least one of them. `labelExpression`/`disabledExpression` were parsed
 * WITHIN the loop's own scope (the item alias is a bound identifier there),
 * so re-rendering them via `rewriteTemplateExpression` inside a synthesized
 * `.map((<itemAlias>) => ({...}))` callback is a direct, safe re-use of the
 * SAME expression text authored in `r-keynav-item="{ label: it.label }"` —
 * `itemAlias` here is a PLAIN value from the synthesized `.map()`, not a
 * Solid `<For>` Accessor, so no `invokeAccessors` wrapping is needed.
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
 * is passed BY REFERENCE — `createKeynav` calls it as `onCommit(i)`, so the
 * author's handler naturally receives the active index as its own
 * parameter. An arbitrary expression (SPEC's own `run(items[$data.active])`)
 * is wrapped in `(i) => { ...; }`.
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
 * Renders `let <ROOT_REF_VAR> = ...` (only when a fresh ref is minted), the
 * component-unique group id, and the `createKeynav(...)` call as
 * scriptInjection lines — `shell.ts` places every scriptInjection entry
 * right before the JSX `return` statement (after the user script body),
 * required because `onCommit` may reference a user-authored handler.
 */
export function buildKeynavScriptInjections(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  collectors: { runtime: RuntimeSolidImportCollector; solid: SolidImportCollector },
): string[] {
  const lines: string[] = [];

  if (plan.mintedRootRef) {
    if (plan.insideConditional) {
      // 77-07 — a `createSignal`-backed ref, NOT the plain `let` every other
      // minted ref uses: the root sits behind `r-if`/`r-match`, so its DOM
      // element is torn down and recreated each time the branch toggles.
      // `createKeynav`'s effect (`createEffect`, not `onMount` — see its
      // module doc comment) needs a genuinely TRACKED read to detect the
      // node (re)appearing; a plain variable gives it nothing to track.
      // Unreachable for any pre-77-07 fixture (see `KeynavEmitPlan.
      // insideConditional`'s doc comment), so this branch never touches the
      // existing corpus's emit.
      collectors.solid.add('createSignal');
      lines.push(
        `const [${plan.rootRefVar}, ${rootRefSetterVar(plan.rootRefVar)}] = createSignal<HTMLElement | null>(null);`,
      );
    } else {
      lines.push(`let ${plan.rootRefVar}: HTMLElement | null = null;`);
    }
  }

  // Component-unique group id (T-71-07-02) — Solid's component function
  // runs exactly ONCE per instance (no React-style per-render
  // re-invocation), so a plain `Math.random()`-derived string minted here is
  // stable for the component's whole lifetime and collision-safe across
  // instances/groups without needing a framework-level id primitive
  // (mirrors the Vue reference's identical rationale; Solid has no
  // React-`useId()` equivalent).
  lines.push(
    `const ${plan.groupIdVar} = \`keynav-\${Math.random().toString(36).slice(2)}\`;`,
  );

  collectors.runtime.add('createKeynav');
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
  // createKeynav call byte-identical to pre-Phase-77.
  if (plan.keynavRoot.grid) {
    const columnsCode = rewriteTemplateExpression(plan.keynavRoot.grid.columnsExpression, ir);
    optsLines.push(`  gridColumns: () => ${columnsCode},`);
  }
  // Phase 77 — `@keynav-page`, mirroring `onCommit`'s wiring exactly.
  const onPageCode = buildOnPageCode(plan.rootElement, ir);
  if (onPageCode !== null) {
    optsLines.push(`  onPage: ${onPageCode},`);
  }
  // 77-07 — the conditional-root case's `rootRefVar` IS already a
  // `createSignal` Accessor (`() => T`), so it's passed BARE, matching
  // `createKeynav`'s `rootRef: () => HTMLElement | null | undefined`
  // signature directly. Every other case (plain `let` variable, minted or
  // author-reused) keeps the pre-77-07 `() => rootRefVar` wrapper — the
  // unreachable-for-existing-corpus branch above is the ONLY thing that
  // changes this line's output for any pre-77-07 fixture (it never fires).
  const rootRefArg =
    plan.mintedRootRef && plan.insideConditional ? plan.rootRefVar : `() => ${plan.rootRefVar}`;
  lines.push(`createKeynav(${rootRefArg}, {\n${optsLines.join('\n')}\n});`);

  return lines;
}

/**
 * Root-element JSX attribute fragments — `ref={(el) => {...}}` (only when a
 * fresh ref was synthesized; an author-declared `ref="x"` already emits its
 * own callback via the normal attribute path, and Solid JSX permits only one
 * `ref=`) plus `aria-activedescendant` for the activedescendant focus model,
 * pointing at the active item's id (undefined — attribute omitted — when
 * there is no active item, e.g. an empty source).
 */
export function keynavRootAttrs(plan: KeynavEmitPlan | null, node: TemplateElementIR): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.mintedRootRef) {
    if (plan.insideConditional) {
      // 77-07 — calls the `createSignal` setter (see `buildKeynavScriptInjections`)
      // instead of assigning a plain variable. Solid's callback ref is ALSO
      // invoked with `undefined` on unmount (the element being torn down by
      // the surrounding `r-if`/`r-match`), so this naturally clears the
      // signal back to `null` when the branch flips away — `createKeynav`'s
      // effect sees that transition too, tearing down its own listeners
      // (see `createKeynav.ts`).
      attrs.push(
        `ref={(el) => { ${rootRefSetterVar(plan.rootRefVar)}(el as HTMLElement | null); }}`,
      );
    } else {
      attrs.push(`ref={(el) => { ${plan.rootRefVar} = el as HTMLElement; }}`);
    }
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
 * compare the resolved index against the live active value.
 *
 * SOLID DIVERGENCE — the LOOP index (`loopIndexExpr`) is a `<For>` Accessor
 * (`() => number`), NOT a plain number the way React's
 * `.map((it, idx) => ...)` / Vue's `v-for="(it, idx)"` index is — so every
 * use of it here appends `()` (`${loopIndexExpr}()`). This file builds raw
 * JSX-attribute strings directly for the LOOP-index path (bypassing
 * `rewriteTemplateExpression`'s `invokeAccessors` auto-wrap), so the `()`
 * must be added by hand there.
 *
 * Phase 77 (planner Gap B) — an item's OWN explicit index expression
 * (`r-keynav-item="{ index: <expr> }"`) takes priority over `loopIndexExpr`
 * when present, rewritten via `rewriteTemplateExpression` WITH
 * `invokeAccessors` threaded through — an explicit index may itself
 * reference one or more ENCLOSING loops' own index Accessors (e.g. the
 * date-picker's `w * 7 + d`), and `invokeAccessors` (accumulated by
 * `emitLoop` as it descends nested loops) already knows about every
 * ancestor's index alias, so this correctly appends `()` to EACH of them —
 * without this emitter needing to re-derive which identifiers are
 * Accessors itself.
 *
 * Declarative Solid JSX bindings (`createKeynav` never writes these
 * directly; see its module doc comment). Returns `[]` when neither an
 * explicit index nor a loop index is available.
 */
export function keynavItemAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  loopIndexExpr: string | null,
  ir: IRComponent,
  invokeAccessors?: ReadonlySet<string>,
): string[] {
  if (plan === null || node.keynavItem === undefined) return [];
  const explicitIndexExpr = node.keynavItem.indexExpression
    ? rewriteTemplateExpression(node.keynavItem.indexExpression, ir, { invokeAccessors })
    : null;
  const idx = explicitIndexExpr ?? (loopIndexExpr !== null ? `${loopIndexExpr}()` : null);
  if (idx === null) return [];
  const attrs: string[] = [
    `id={\`\${${plan.groupIdVar}}-item-\${${idx}}\`}`,
    `data-rozie-keynav-item={${idx}}`,
    `data-rozie-keynav-active={${plan.activeGet} === ${idx} ? '' : undefined}`,
  ];
  if (plan.keynavRoot.focusModel === 'tabindex') {
    attrs.push(`tabIndex={${plan.activeGet} === ${idx} ? 0 : -1}`);
  }
  return attrs;
}

/**
 * Strips the synthetic `@keynav-commit` / `@keynav-page` template-event
 * Listeners out of the root element's `events` array — both are consumed by
 * `buildOnCommitCode`/`buildOnPageCode` above and routed into
 * `createKeynav`'s `onCommit`/`onPage` options, NEVER as JSX
 * `onKeynavCommit={...}`/`onKeynavPage={...}` props (which would be inert —
 * neither is a real DOM event a host element dispatches).
 */
export function stripKeynavSyntheticEvents(node: TemplateElementIR): TemplateElementIR {
  if (node.keynavRoot === undefined) return node;
  const filtered = node.events.filter(
    (e) => e.event !== 'keynav-commit' && e.event !== 'keynav-page',
  );
  if (filtered.length === node.events.length) return node;
  return { ...node, events: filtered };
}

/**
 * True when `body` (a loop's direct body, NOT recursing into a NESTED
 * `r-for` — that loop synthesizes its own index) contains at least one
 * `keynavItem`-bearing element. Drives `emitLoop`'s index-alias synthesis in
 * `emitTemplateNode.ts`: an author who didn't write `it, idx in items` still
 * gets a working `data-rozie-keynav-item={index()}` marker — the compiler
 * owns the plumbing (SPEC §1's guiding principle), not the author.
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
