/**
 * emitKeynav — Phase 71 Plan 04 (React target, REFERENCE implementation).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02) to the `useKeynav` React controller
 * (Phase 71 Plan 03's `@rozie/runtime-keynav-core` + this plan's Task 1
 * hook). Two responsibilities, resolved ONCE per component (unlike most
 * `emit/*` modules, which are pure per-node functions) because the root's
 * hook-wiring and every item's attribute bindings all share the SAME group
 * id + active-binding code:
 *
 *   1. `resolveKeynavPlan(ir)` — locates the (at most one, SPEC §7 v1)
 *      `keynavRoot` element and the FIRST `keynavItem` element + its
 *      enclosing `r-for` loop. Mirrors core's own `resolveKeynavGroups` walk
 *      (`packages/core/src/ir/resolveKeynavGroups.ts`), which performs the
 *      IDENTICAL "first item's enclosing loop" resolution for `:source`
 *      synthesis — this function reuses that same v1 convention rather than
 *      inventing a second one. Returns `null` for the overwhelming majority
 *      case (no `r-keynav` in the component) — every call site below
 *      short-circuits on `null`, so a non-keynav component's emit is
 *      completely untouched (SPEC §11: "no corpus rebless").
 *
 *   2. `buildKeynavScriptInjections(plan, ir, collectors)` — renders the
 *      `useKeynav(...)` call plus its `useRef`/`useId` scaffolding as
 *      scriptInjection strings. `emitTemplate.ts` folds these into
 *      `EmitTemplateResult.scriptInjections`, and `shell.ts` places
 *      non-`function`-prefixed scriptInjections AFTER the user script body —
 *      required because `onCommit` may reference a user-authored handler
 *      (e.g. `@keynav-commit="run(items[$data.active])"`).
 *
 * Per-element attribute emission (root `ref`/`aria-activedescendant`, item
 * `id`/`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabIndex`) is
 * built by `keynavRootAttrs`/`keynavItemAttrs` below and spliced directly
 * into `emitTemplateNode.ts`'s `headParts` array — mirroring the existing
 * `rShowStyleAttr`/`scopeAttrJsx` raw-string-splice pattern rather than
 * routing through the `AttributeBinding` machinery, since these markers are
 * emitter-synthesized, not author-authored bindings.
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
import type {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` so they can never collide with a `<script>`-declared
// binding (mirrors the `__rozieMatch_N`/`__rozieExposeRef` convention).
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';

export interface KeynavEmitPlan {
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

/**
 * Mirrors `resolveKeynavGroups.collectKeynavNodes` (core) — the SAME
 * traversal shape (incl. `slotFillers` bodies, `TemplateMatch.hostElement`)
 * so a keynav marker inside a slot-fill body or match host is found exactly
 * the way core already validated it. Only needs the FIRST root and FIRST
 * item: a second root is a core-level `KEYNAV_MULTIPLE_ROOTS` diagnostic
 * (ROZ986) that already fired upstream — this is a best-effort emit for an
 * already-erroring input, not a re-validation pass (D-08 collected-not-
 * thrown: core reports the diagnostic; the emitter never crashes on it).
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

  // Reuse an author-declared `ref="x"` on the SAME element when present
  // (JSX permits only one `ref=` attribute) rather than minting a second,
  // colliding one — mirrors the "don't break an author's own wiring"
  // discipline elsewhere in the emitter (Rule 2 territory, not Rule 4: this
  // is additive robustness, not a structural change).
  const existingRef = findStaticAttrValue(root.element, 'ref');
  const rootRefVar =
    existingRef !== null && ir.refs.some((r) => r.name === existingRef)
      ? existingRef
      : ROOT_REF_VAR;

  const { local: activeGet, setter: activeSet } = resolveTwoWayTarget(
    root.keynavRoot.activeExpression,
    ir,
  );

  return {
    rootElement: root.element,
    keynavRoot: root.keynavRoot,
    itemElement: item?.element ?? null,
    itemLoop: item?.enclosingLoop ?? null,
    rootRefVar,
    groupIdVar: GROUP_ID_VAR,
    activeGet,
    activeSet,
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

/** Find the `@keynav-commit` template-event Listener on the root, if authored. */
function findCommitListener(root: TemplateElementIR) {
  return root.events.find((e) => e.event === 'keynav-commit') ?? null;
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
  const listener = findCommitListener(root);
  if (!listener) return '() => {}';
  const handlerCode = rewriteTemplateExpression(listener.handler, ir);
  if (/^[A-Za-z_$][\w$]*$/.test(handlerCode)) {
    return handlerCode;
  }
  return `(i) => { ${handlerCode}; }`;
}

/**
 * Renders the `useKeynav(...)` call plus its `useRef`/`useId` scaffolding as
 * scriptInjection lines (placed AFTER the user script body by `shell.ts` —
 * see the module doc comment). Registers every import the emitted lines
 * reference.
 */
export function buildKeynavScriptInjections(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
): string[] {
  const injections: string[] = [];

  if (plan.rootRefVar === ROOT_REF_VAR) {
    collectors.react.add('useRef');
    injections.push(`const ${ROOT_REF_VAR} = useRef<HTMLElement | null>(null);`);
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
 */
export function keynavRootAttrs(plan: KeynavEmitPlan | null, node: TemplateElementIR): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.rootRefVar === ROOT_REF_VAR) {
    attrs.push(`ref={${ROOT_REF_VAR}}`);
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
 * are declarative JSX bindings comparing `indexExpr` (the loop's item index,
 * see `keynavItemIndexAlias` in `emitTemplateNode.ts`) against the live
 * active value — they update on the SAME render pass as the rest of the
 * component (`useKeynav` never writes these directly; see its module doc
 * comment). Returns `[]` when `indexExpr` is unavailable (e.g. a
 * `keynavItem` authored outside any `r-for` — an unsupported v1 shape;
 * degrades to a no-op rather than emitting malformed JSX).
 */
export function keynavItemAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  indexExpr: string | null,
): string[] {
  if (plan === null || node.keynavItem === undefined || indexExpr === null) return [];
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
 * Strips the `@keynav-commit` template-event Listener out of the root
 * element's `events` array — it is consumed by `buildOnCommitCode` above
 * and routed into `useKeynav`'s `onCommit` option, NEVER as a JSX
 * `onKeynavCommit={...}` prop (which would be inert — `keynav-commit` is a
 * synthetic event, not a real DOM event a host element dispatches).
 */
export function stripKeynavCommitEvent(node: TemplateElementIR): TemplateElementIR {
  if (node.keynavRoot === undefined) return node;
  const filtered = node.events.filter((e) => e.event !== 'keynav-commit');
  if (filtered.length === node.events.length) return node;
  return { ...node, events: filtered };
}

/**
 * True when `body` (a loop's direct body, NOT recursing into a NESTED
 * `r-for` — that loop synthesizes its own index) contains at least one
 * `keynavItem`-bearing element. Drives `emitLoop`'s index-alias synthesis in
 * `emitTemplateNode.ts`: an author who didn't write `(it, idx) in items`
 * still gets a working `data-rozie-keynav-item={index}` marker — the
 * compiler owns the plumbing (SPEC §1's guiding principle), not the author.
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
