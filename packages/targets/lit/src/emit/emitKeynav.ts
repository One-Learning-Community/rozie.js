/**
 * emitKeynav — Phase 71 Plan 08 (Lit target), reworked by Phase 77 Plan 05
 * from one-plan-per-component to one-plan-per-root (77-SPEC.md §6, §7.3),
 * mirroring the React reference's Plan 77-03 rework (also replicated by Vue/
 * Svelte/Solid, Plan 77-04).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02, extended Phase 77 Plan 02 with
 * `grid`/`groupIndex`/`indexExpression`) to the `KeynavController` Lit
 * `ReactiveController` (Phase 71 Plan 03's `@rozie/runtime-keynav-core` +
 * this plan's `onPage`/`gridColumns`/`rootMarker` extension). Two
 * responsibilities, resolved ONCE per component:
 *
 *   1. `resolveKeynavPlans(ir)` — locates EVERY `keynavRoot` element in the
 *      component and, for each, the FIRST `keynavItem` associated to THAT
 *      root (via `KeynavItemIR.groupIndex`, defaulting to 0 — core's
 *      `resolveKeynavGroups` owns the association rule; the emitter never
 *      re-derives containment) + its enclosing `r-for` loop. Returns one plan
 *      per root, in document order. Returns `[]` for the overwhelming
 *      majority case (no `r-keynav` in the component) — every call site below
 *      short-circuits on an empty array, so a non-keynav component's emit is
 *      completely untouched (SPEC §7.4: "no corpus rebless").
 *
 *   2. `buildKeynavFieldDecls(plan, ir, collectors)` — renders the group-id
 *      field + the `new KeynavController(this, {...})` field initializer as
 *      CLASS-BODY field declarations (NOT scriptInjection lines placed before
 *      a `return` — Lit has no per-render function body; the controller is
 *      instantiated exactly once, in the implicit constructor, via a
 *      `private` field initializer — mirrors `createLitControllableProperty`'s
 *      identical class-field convention). `emitTemplate.ts` calls this ONCE
 *      PER resolved plan and folds the results into
 *      `EmitTemplateResult.keynavFieldDecls`; `emitLit.ts` splices them into
 *      the class body alongside the other field declarations.
 *
 * **Identifier naming (mirrors the React reference exactly):** the group-id
 * and controller field identifiers keep their PRE-PHASE-77 spelling for group
 * index 0 and append the index for later groups (`_rozieKeynavGroupId` /
 * `_rozieKeynavGroupId1` / `_rozieKeynavGroupId2` …) — the mechanism that
 * keeps a single-root, non-grid component's emitted output byte-identical to
 * before this plan.
 *
 * LIT-SPECIFIC DIVERGENCE FROM REACT/SOLID — NO PER-ROOT DOM REF IS MINTED.
 * The other five targets each mint a distinct DOM ref/node PER root and
 * attach that root's listeners directly on it, so containment scoping for a
 * multi-root component falls out of ordinary DOM event bubbling for free.
 * Lit's `KeynavController` instead delegates a SINGLE `keydown`/`pointerdown`
 * listener pair on the component's OWN shadow root (`host.renderRoot`,
 * Landmine 6, Plan 71-08) — there is only ONE shadow root per component, so
 * with the pre-Phase-77 "at most one r-keynav group per component" rule this
 * coincided exactly with "the r-keynav root's subtree". SPEC §6 lifts that
 * rule, so a NAIVE port (every controller instance delegating on the SAME
 * shared `renderRoot`) would cross-fire: a keydown/pointerdown originating in
 * group A's subtree would ALSO reach group B's controller instance, which
 * has no notion of "was this event actually inside MY subtree" (the reducer
 * is stateful, not target-aware — see `stateMachine.ts`).
 *
 * The fix, WITHOUT re-architecting the controller into a per-root-ref design
 * (SPEC §6: "the per-target change is dropping the 'single group' assumption
 * ..., not re-architecting controllers") — only emitted for a MULTI-root
 * component (`needsRootMarker`, `roots.length > 1`; a single-root component
 * emits nothing new here, preserving byte-identity):
 *
 *   - Each root element additionally stamps a STATIC
 *     `data-rozie-keynav-root="<groupIndex>"` marker attribute (`groupIndex`
 *     is compile-time-known, so this is a plain string literal, not a
 *     template binding).
 *   - Each controller construction gets a `rootMarker: '<groupIndex>'` opt.
 *   - `KeynavController` (this plan's Task 1) checks, on EVERY delegated
 *     event, whether `e.target.closest('[data-rozie-keynav-root="<marker>"]')`
 *     resolves — i.e. whether the event actually originated inside ITS OWN
 *     root's subtree — before ever touching the reducer. This is a
 *     containment CHECK performed lazily at real event-dispatch time (always
 *     well after the component's first render, since a user can't interact
 *     with DOM that doesn't exist yet), so it needs no new "wait for the
 *     first update" bookkeeping — it reuses the SAME closest()-based
 *     containment idiom `resolveItemIndex` already uses for the untrusted
 *     `data-rozie-keynav-item` marker (T-71-08-01). The controller's
 *     `hostUpdated()`-scoped item queries (`applyActiveSideEffects`) use the
 *     SAME marker to scope their `querySelector`/`querySelectorAll` calls to
 *     the owning root's subtree, so a same-index item in a DIFFERENT group
 *     is never targeted by mistake.
 *
 * The group id itself is minted via a `Math.random()`-derived string class
 * field (mirrors the Vue/Solid references — Lit has no React-`useId()`
 * equivalent, and a Lit class instance's constructor runs exactly once per
 * element instance, so a field initializer is stable for the component's
 * whole lifetime and collision-safe across instances).
 *
 * The two-way active-index get/set pair reuses the EXISTING
 * `resolveLitSetterText` helper (pre-Phase-71, TWO-WAY-03) rather than a
 * fresh `resolveTwoWayTarget` port — `resolveLitSetterText` already resolves
 * a `$data.X` / `$props.X` writable-lvalue expression to its Lit
 * assignment-target text (e.g. `this._active.value` / `this.active`), and
 * that SAME text doubles as the read expression (`getActive: () =>
 * this._active.value`) — no separate get/set helper split is needed the way
 * React's `local`/`setter` pair is, because a Lit signal member expression is
 * both readable and assignable through the identical text.
 *
 * Per-element attribute emission (root `data-rozie-keynav-root`/
 * `aria-activedescendant`, item `id`/`data-rozie-keynav-item`/
 * `data-rozie-keynav-active`/`tabindex`) is built by
 * `keynavRootAttrs`/`keynavItemAttrs` below and spliced directly into
 * `emitTemplate.ts`'s `emitElementOpenTag` `parts` array — mirroring the
 * existing `refAttr`/`data-rozie-s-<hash>` raw-string-splice pattern rather
 * than routing through the `AttributeBinding` machinery, since these markers
 * are emitter-synthesized, not author-authored bindings. `emitTemplate.ts`
 * selects the CORRECT plan for each element by comparing the element's own
 * `keynavRoot.groupIndex`/`keynavItem.groupIndex` (each defaulting to 0)
 * against `KeynavEmitPlan.groupIndex` — never by using "the" plan, since
 * there may now be several. `aria-activedescendant` routes through the
 * existing `rozieAttr` runtime helper so a `< 0` (no active item) value drops
 * the attribute via lit-html's `nothing` sentinel, matching the other five
 * targets' nullish-drops-attribute convention.
 *
 * @experimental — shape may change before v1.0
 */
import * as bt from '@babel/types';
import type {
  IRComponent,
  KeynavItemIR,
  KeynavRootIR,
  TemplateElementIR,
  TemplateLoopIR,
  TemplateNode,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { resolveLitSetterText } from './resolveLitSetterText.js';
import type { RuntimeLitImportCollector } from '../rewrite/collectLitImports.js';

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` / `_rozieKeynav*` so they can never collide with a
// `<script>`-declared binding (mirrors the React/Vue/Solid references'
// `__rozieMatch_N`/`__rozieExposeRef` convention; the Lit class-field forms
// use a leading underscore to match this target's OWN private-field naming
// idiom, e.g. `_refX`/`_xControllable`). Group index 0 keeps the bare
// spelling; later groups append the index (see `suffixFor` below) — the
// mechanism that keeps single-root emit unchanged.
const GROUP_ID_FIELD = '_rozieKeynavGroupId';
const CONTROLLER_FIELD = '_rozieKeynavController';
const ROOT_MARKER_ATTR = 'data-rozie-keynav-root';

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
  /**
   * True when the component has MORE THAN ONE `r-keynav` root — the ONLY
   * condition under which the `data-rozie-keynav-root`/`rootMarker` DOM
   * containment-scoping machinery (module doc comment) is emitted at all.
   * False for every pre-Phase-77 single-root fixture, which is what keeps
   * their emit byte-identical.
   */
  needsRootMarker: boolean;
  rootElement: TemplateElementIR;
  keynavRoot: KeynavRootIR;
  itemElement: TemplateElementIR | null;
  itemLoop: TemplateLoopIR | null;
  /** `this._rozieKeynavGroupId[<suffix>]` — the field-read text used by root/item attrs. */
  groupIdField: string;
  /** The active-index read/write text (e.g. `this._active.value`) — doubles as get AND set target. */
  activeGet: string;
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
  const needsRootMarker = roots.length > 1;

  return roots.map((root) => {
    const groupIndex = root.keynavRoot.groupIndex ?? 0;
    const itemsForGroup = items.filter((it) => (it.keynavItem.groupIndex ?? 0) === groupIndex);
    const firstItem = itemsForGroup[0] ?? null;
    const suffix = suffixFor(groupIndex);

    return {
      groupIndex,
      needsRootMarker,
      rootElement: root.element,
      keynavRoot: root.keynavRoot,
      itemElement: firstItem?.element ?? null,
      itemLoop: firstItem?.enclosingLoop ?? null,
      groupIdField: `this.${GROUP_ID_FIELD}${suffix}`,
      activeGet: resolveLitSetterText(root.keynavRoot.activeExpression, ir),
    };
  });
}

/**
 * `KeynavConfig` object literal — every field is statically known at compile
 * time. Deliberately NEVER gains a `grid` key here (Phase 77): grid columns
 * are a reactive expression, threaded through the DEDICATED `gridColumns`
 * controller option instead (see `buildKeynavFieldDecls`), which
 * `KeynavController` re-reads on every keydown. A root without `.grid` emits
 * the EXACT literal it emitted pre-Phase-77.
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
 * so re-rendering them via `rewriteTemplateExpression` inside a synthesized
 * `.map((<itemAlias>) => ({...}))` callback is a direct, safe re-use of the
 * SAME expression text authored in `r-keynav-item="{ label: it.label }"`.
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
 * keynav event uses, mirroring Lit's own template-event emit convention
 * (`buildEventParts`): a bare identifier (e.g. `@keynav-commit="handleCommit"`)
 * is passed BY REFERENCE — the runtime calls it directly, so the author's
 * handler naturally receives the callback's own parameter. An arbitrary
 * expression is wrapped in `(<paramName>) => { ...; }`.
 *
 * LIT-SPECIFIC FIX vs. the React/Solid references: bareness MUST be tested
 * on the ORIGINAL (pre-rewrite) AST node (`bt.isIdentifier(listener.handler)`),
 * NOT on the rewritten text — `rewriteTemplateExpression` prefixes a bare
 * user-method identifier with `this.` for Lit (e.g. `choose` -> `this.choose`,
 * a class-field arrow function), which the React reference's post-rewrite
 * `/^[A-Za-z_$][\w$]*$/` regex would never match (it contains a `.`). Testing
 * the AST directly correctly routes `this.choose` through the BY-REFERENCE
 * path (`onCommit: this.choose,`) instead of silently falling through to the
 * wrap branch, which would emit a dead `(i) => { this.choose; }` statement
 * that references but never CALLS the handler.
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
  if (bt.isIdentifier(listener.handler)) {
    return handlerCode;
  }
  return `(${paramName}) => { ${handlerCode}; }`;
}

/** `onCommit: (i: number) => void`. See `buildHandlerCode`'s doc comment. */
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
 * Renders the group-id field + the `new KeynavController(this, {...})` field
 * initializer as class-body field declarations (Lit has no per-render
 * function body to inject a hook call into — a Lit class instance's
 * constructor runs exactly once, so BOTH fields are `private` field
 * initializers, mirroring `createLitControllableProperty`'s identical
 * per-model-prop field convention). `emitTemplate.ts` calls this ONCE PER
 * resolved plan and splices the results alongside the other class-field
 * declarations.
 */
export function buildKeynavFieldDecls(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  collectors: { runtime: RuntimeLitImportCollector },
): string[] {
  const lines: string[] = [];
  const suffix = suffixFor(plan.groupIndex);
  const groupIdField = `${GROUP_ID_FIELD}${suffix}`;
  const controllerField = `${CONTROLLER_FIELD}${suffix}`;

  lines.push(
    `  private ${groupIdField} = \`keynav-\${Math.random().toString(36).slice(2)}\`;`,
  );

  collectors.runtime.add('KeynavController');
  const optsLines = [
    `    config: ${buildConfigCode(plan.keynavRoot)},`,
    `    getSource: ${buildGetSourceCode(plan, ir)},`,
    `    getActive: () => ${plan.activeGet},`,
    `    setActive: (i: number) => { ${plan.activeGet} = i; },`,
    `    onCommit: ${buildOnCommitCode(plan.rootElement, ir)},`,
  ];
  if (plan.keynavRoot.activeClassExpression) {
    optsLines.push(
      `    activeClass: ${rewriteTemplateExpression(plan.keynavRoot.activeClassExpression, ir)},`,
    );
  }
  // Phase 77 — grid columns. Only present when the root carries `.grid()`;
  // absent entirely otherwise, which is what keeps a non-grid root's
  // KeynavController construction byte-identical to pre-Phase-77.
  if (plan.keynavRoot.grid) {
    const columnsCode = rewriteTemplateExpression(plan.keynavRoot.grid.columnsExpression, ir);
    optsLines.push(`    gridColumns: () => ${columnsCode},`);
  }
  // Phase 77 — `@keynav-page`, mirroring `onCommit`'s wiring exactly.
  const onPageCode = buildOnPageCode(plan.rootElement, ir);
  if (onPageCode !== null) {
    optsLines.push(`    onPage: ${onPageCode},`);
  }
  // Phase 77 — multi-root DOM containment scoping (module doc comment). Only
  // present when the component has more than one `r-keynav` root; a
  // single-root component omits this entirely (byte-identical to before).
  if (plan.needsRootMarker) {
    optsLines.push(`    rootMarker: '${plan.groupIndex}',`);
  }
  lines.push(
    [
      `  private ${controllerField} = new KeynavController(this, {`,
      ...optsLines,
      `  });`,
    ].join('\n'),
  );

  return lines;
}

/**
 * Root-element template attribute fragments — the multi-root DOM
 * containment-scoping marker (module doc comment; ONLY when
 * `plan.needsRootMarker`) and `aria-activedescendant` for the
 * activedescendant focus model, pointing at the active item's id, routed
 * through `rozieAttr` so a `< 0` value (no active item, e.g. an empty
 * source) DROPS the attribute via lit-html's `nothing` sentinel rather than
 * rendering a literal `"undefined"` string.
 */
export function keynavRootAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  runtime: RuntimeLitImportCollector,
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.needsRootMarker) {
    // `groupIndex` is compile-time-known — a plain string-literal attribute,
    // not a template binding, so it never appears in a single-root emit.
    attrs.push(`${ROOT_MARKER_ATTR}="${plan.groupIndex}"`);
  }
  if (plan.keynavRoot.focusModel === 'activedescendant') {
    runtime.add('rozieAttr');
    attrs.push(
      `aria-activedescendant=\${rozieAttr(${plan.activeGet} >= 0 ? \`\${${plan.groupIdField}}-item-\${${plan.activeGet}}\` : undefined)}`,
    );
  }
  return attrs;
}

/**
 * Item-element template attribute fragments — stable `id`, the
 * `data-rozie-keynav-item` delegation/bounds-check marker (SPEC §8, triple
 * duty), the always-present `data-rozie-keynav-active` marker (SPEC §9,
 * boolean-attribute sigil `?data-rozie-keynav-active=`), and — tabindex focus
 * model only — the `tabindex` roving binding. All FOUR are declarative
 * `html\`\`` template bindings comparing `indexExpr` (the loop's item index —
 * Lit's `repeat()` template callback ALWAYS receives an index parameter,
 * whether or not the author declared one; see `emitTemplate.ts`'s `emitLoop`)
 * against the live active value — they update on the SAME render pass as the
 * rest of the component (`KeynavController` never writes these directly; see
 * its module doc comment).
 *
 * Phase 77 (planner Gap B) — an item's OWN explicit index expression
 * (`r-keynav-item="{ index: <expr> }"`, rewritten in the item's own loop
 * scope — it was parsed there, exactly like `label`/`disabled`) takes
 * priority over `loopIndexExpr` when present. This is what makes an explicit
 * index correct even when the item's nearest enclosing loop is a NESTED
 * inner loop (e.g. the date-picker's panels -> weeks -> days triple-nested
 * day grid) — the expression's own identifier references are already bound
 * to whichever loop scope it was authored in, regardless of nesting depth.
 *
 * Returns `[]` when neither an explicit index nor a loop index is available
 * (e.g. a `keynavItem` authored outside any `r-for` — an unsupported v1
 * shape; degrades to a no-op rather than emitting malformed template markup).
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
    // Whole-value single interpolation — unquoted, mirrors the
    // `data-rozie-keynav-item=${…}` / `.value=${…}` convention immediately
    // below (quotes are only needed for the MIXED static+dynamic
    // `'interpolated'` AttributeBinding kind, which this raw-string splice
    // is not).
    `id=\${\`\${${plan.groupIdField}}-item-\${${indexExpr}}\`}`,
    `data-rozie-keynav-item=\${${indexExpr}}`,
    `?data-rozie-keynav-active=\${${plan.activeGet} === ${indexExpr}}`,
  ];
  if (plan.keynavRoot.focusModel === 'tabindex') {
    attrs.push(`tabindex=\${${plan.activeGet} === ${indexExpr} ? 0 : -1}`);
  }
  return attrs;
}

/**
 * Strips the `@keynav-commit` / `@keynav-page` template-event Listeners out
 * of the root element's `events` array — both are consumed by
 * `buildOnCommitCode`/`buildOnPageCode` above and routed into
 * `KeynavController`'s `onCommit`/`onPage` options, NEVER as
 * `@keynavCommit=${...}` / `@keynavPage=${...}` template bindings (which
 * would be inert — neither is a real DOM event a host element dispatches).
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
