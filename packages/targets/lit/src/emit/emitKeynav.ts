/**
 * emitKeynav — Phase 71 Plan 08 (Lit target).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02) to the `KeynavController` Lit
 * `ReactiveController` (Phase 71 Plan 03's `@rozie/runtime-keynav-core` +
 * this plan's Task 1 controller). Modeled directly on the React REFERENCE
 * implementation (`packages/targets/react/src/emit/emitKeynav.ts`,
 * Plan 71-04) — same two responsibilities, resolved ONCE per component:
 *
 *   1. `resolveKeynavPlan(ir)` — locates the (at most one, SPEC §7 v1)
 *      `keynavRoot` element and the FIRST `keynavItem` element + its
 *      enclosing `r-for` loop. Mirrors core's own `resolveKeynavGroups` walk.
 *      Returns `null` for the overwhelming majority case (no `r-keynav` in
 *      the component) — every call site below short-circuits on `null`, so a
 *      non-keynav component's emit is completely untouched (SPEC §11: "no
 *      corpus rebless").
 *
 *   2. `buildKeynavFieldDecls(plan, ir, collectors)` — renders the
 *      group-id field + the `new KeynavController(this, {...})` field
 *      initializer as CLASS-BODY field declarations (NOT scriptInjection
 *      lines placed before a `return` — Lit has no per-render function body;
 *      the controller is instantiated exactly once, in the implicit
 *      constructor, via a `private` field initializer — mirrors
 *      `createLitControllableProperty`'s identical class-field convention).
 *      `emitTemplate.ts` folds these into `EmitTemplateResult.keynavFieldDecls`,
 *      and `emitLit.ts` splices them into the class body alongside the other
 *      field declarations.
 *
 * LIT-SPECIFIC DIVERGENCE FROM REACT — NO ROOT REF IS MINTED. Landmine 6
 * (Plan 71-08's own frontmatter): delegation and marker queries operate
 * INSIDE the shadow root (`host.renderRoot`), not against a specific queried
 * element. `KeynavController` therefore attaches its delegated
 * `keydown`/`pointerdown` listeners directly on the component's OWN shadow
 * root — every emitted Lit component has exactly one shadow root, and SPEC
 * §7 permits at most one `r-keynav` group per component, so "the shadow
 * root" and "the r-keynav root element's subtree" coincide for every v1
 * shape. This eliminates the entire `ROOT_REF_VAR` / minted-vs-reused-ref
 * bookkeeping the React/Solid/Vue references carry — there is no `ref=`
 * attribute to emit on the root element at all.
 *
 * The group id is minted via a `Math.random()`-derived string class field
 * (mirrors the Vue/Solid references — Lit has no React-`useId()` equivalent,
 * and a Lit class instance's constructor runs exactly once per element
 * instance, so a field initializer is stable for the component's whole
 * lifetime and collision-safe across instances).
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
 * Per-element attribute emission (root `aria-activedescendant`, item
 * `id`/`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabindex`) is
 * built by `keynavRootAttrs`/`keynavItemAttrs` below and spliced directly
 * into `emitTemplate.ts`'s `emitElementOpenTag` `parts` array — mirroring the
 * existing `refAttr`/`data-rozie-s-<hash>` raw-string-splice pattern rather
 * than routing through the `AttributeBinding` machinery, since these markers
 * are emitter-synthesized, not author-authored bindings. `aria-activedescendant`
 * routes through the existing `rozieAttr` runtime helper so a `< 0` (no
 * active item) value drops the attribute via lit-html's `nothing` sentinel,
 * matching the other five targets' nullish-drops-attribute convention.
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
// idiom, e.g. `_refX`/`_xControllable`).
const GROUP_ID_FIELD = '_rozieKeynavGroupId';
const CONTROLLER_FIELD = '_rozieKeynavController';

export interface KeynavEmitPlan {
  rootElement: TemplateElementIR;
  keynavRoot: KeynavRootIR;
  itemElement: TemplateElementIR | null;
  itemLoop: TemplateLoopIR | null;
  /** `this._rozieKeynavGroupId` — the field-read text used by root/item attrs. */
  groupIdField: string;
  /** The active-index read/write text (e.g. `this._active.value`) — doubles as get AND set target. */
  activeGet: string;
}

/**
 * Mirrors `resolveKeynavGroups.collectKeynavNodes` (core) — the SAME
 * traversal shape (incl. `slotFillers` bodies, `TemplateMatch.hostElement`)
 * so a keynav marker inside a slot-fill body or match host is found exactly
 * the way core already validated it. Only needs the FIRST root and FIRST
 * item — a second root is a core-level `KEYNAV_MULTIPLE_ROOTS` diagnostic
 * (ROZ986) that already fired upstream (D-08 collected-not-thrown: this is a
 * best-effort emit for an already-erroring input, not a re-validation pass).
 */
function collectFirstKeynavNodes(root: TemplateNode): {
  root: { element: TemplateElementIR; keynavRoot: KeynavRootIR } | null;
  item: { element: TemplateElementIR; keynavItem: KeynavItemIR; enclosingLoop: TemplateLoopIR | null } | null;
} {
  const found: {
    root: { element: TemplateElementIR; keynavRoot: KeynavRootIR } | null;
    item: { element: TemplateElementIR; keynavItem: KeynavItemIR; enclosingLoop: TemplateLoopIR | null } | null;
  } = { root: null, item: null };

  const walk = (node: TemplateNode, enclosingLoop: TemplateLoopIR | null): void => {
    switch (node.type) {
      case 'TemplateElement': {
        if (node.keynavRoot && found.root === null) {
          found.root = { element: node, keynavRoot: node.keynavRoot };
        }
        if (node.keynavItem && found.item === null) {
          found.item = { element: node, keynavItem: node.keynavItem, enclosingLoop };
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
  return found;
}

/**
 * Resolve the per-component keynav emission plan. Returns `null` when the
 * component has no `r-keynav` root — the overwhelmingly common case, and the
 * one that MUST stay byte-identical to pre-Phase-71 emit (SPEC §11).
 */
export function resolveKeynavPlan(ir: IRComponent): KeynavEmitPlan | null {
  if (ir.template === null) return null;
  const { root, item } = collectFirstKeynavNodes(ir.template);
  if (root === null) return null;

  return {
    rootElement: root.element,
    keynavRoot: root.keynavRoot,
    itemElement: item?.element ?? null,
    itemLoop: item?.enclosingLoop ?? null,
    groupIdField: `this.${GROUP_ID_FIELD}`,
    activeGet: resolveLitSetterText(root.keynavRoot.activeExpression, ir),
  };
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

/** Find the `@keynav-commit` template-event Listener on the root, if authored. */
function findCommitListener(root: TemplateElementIR) {
  return root.events.find((e) => e.event === 'keynav-commit') ?? null;
}

/**
 * `onCommit: (i: number) => void`. Mirrors the SAME bare-identifier-vs-
 * arbitrary-expression convention Lit's own template-event emit already uses
 * (`buildEventParts`): a bare identifier (e.g. `@keynav-commit="handleCommit"`)
 * is passed BY REFERENCE — `KeynavController` calls it as `onCommit(i)`, so
 * the author's handler naturally receives the active index as its own
 * parameter. An arbitrary expression (SPEC's own `run(items[$data.active])`)
 * is wrapped in `(i) => { ...; }`.
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
function buildOnCommitCode(root: TemplateElementIR, ir: IRComponent): string {
  const listener = findCommitListener(root);
  if (!listener) return '() => {}';
  const handlerCode = rewriteTemplateExpression(listener.handler, ir);
  if (bt.isIdentifier(listener.handler)) {
    return handlerCode;
  }
  return `(i) => { ${handlerCode}; }`;
}

/**
 * Renders the group-id field + the `new KeynavController(this, {...})` field
 * initializer as class-body field declarations (Lit has no per-render
 * function body to inject a hook call into — a Lit class instance's
 * constructor runs exactly once, so BOTH fields are `private` field
 * initializers, mirroring `createLitControllableProperty`'s identical
 * per-model-prop field convention). `emitLit.ts` splices these alongside the
 * other class-field declarations.
 */
export function buildKeynavFieldDecls(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  collectors: { runtime: RuntimeLitImportCollector },
): string[] {
  const lines: string[] = [];

  lines.push(
    `  private ${GROUP_ID_FIELD} = \`keynav-\${Math.random().toString(36).slice(2)}\`;`,
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
  lines.push(
    [
      `  private ${CONTROLLER_FIELD} = new KeynavController(this, {`,
      ...optsLines,
      `  });`,
    ].join('\n'),
  );

  return lines;
}

/**
 * Root-element template attribute fragments — `aria-activedescendant` for the
 * activedescendant focus model ONLY (no `ref=` — see the module doc comment's
 * "NO ROOT REF IS MINTED" section), pointing at the active item's id, routed
 * through `rozieAttr` so a `< 0` value (no active item, e.g. an empty source)
 * DROPS the attribute via lit-html's `nothing` sentinel rather than rendering
 * a literal `"undefined"` string.
 */
export function keynavRootAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  runtime: RuntimeLitImportCollector,
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  if (plan.keynavRoot.focusModel !== 'activedescendant') return [];
  runtime.add('rozieAttr');
  return [
    `aria-activedescendant=\${rozieAttr(${plan.activeGet} >= 0 ? \`\${${plan.groupIdField}}-item-\${${plan.activeGet}}\` : undefined)}`,
  ];
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
 * its module doc comment). Returns `[]` when `indexExpr` is unavailable (e.g.
 * a `keynavItem` authored outside any `r-for` — an unsupported v1 shape;
 * degrades to a no-op rather than emitting malformed template markup).
 */
export function keynavItemAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  indexExpr: string | null,
): string[] {
  if (plan === null || node.keynavItem === undefined || indexExpr === null) return [];
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
 * Strips the `@keynav-commit` template-event Listener out of the root
 * element's `events` array — it is consumed by `buildOnCommitCode` above and
 * routed into `KeynavController`'s `onCommit` option, NEVER as a
 * `@keynavCommit=${...}` template binding (which would be inert —
 * `keynav-commit` is a synthetic event, not a real DOM event a host element
 * dispatches).
 */
export function stripKeynavCommitEvent(node: TemplateElementIR): TemplateElementIR {
  if (node.keynavRoot === undefined) return node;
  const filtered = node.events.filter((e) => e.event !== 'keynav-commit');
  if (filtered.length === node.events.length) return node;
  return { ...node, events: filtered };
}
