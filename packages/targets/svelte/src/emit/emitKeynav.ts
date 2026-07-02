/**
 * emitKeynav — Phase 71 Plan 06 (Svelte target).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02) to the `keynav` Svelte 5 action
 * (Phase 71 Plan 03's `@rozie/runtime-keynav-core` + this plan's Task 1
 * action). Modeled directly on the React REFERENCE implementation
 * (`packages/targets/react/src/emit/emitKeynav.ts`, Plan 71-04) and the Vue
 * target-pair (`packages/targets/vue/src/emit/emitKeynav.ts`, Plan 71-05) —
 * same two responsibilities, resolved ONCE per component:
 *
 *   1. `resolveKeynavPlan(ir)` — locates the (at most one, SPEC §7 v1)
 *      `keynavRoot` element and the FIRST `keynavItem` element + its
 *      enclosing `r-for` loop. Mirrors core's own `resolveKeynavGroups` walk
 *      (and the React/Vue references' identical `collectFirstKeynavNodes`).
 *      Returns `null` for the overwhelming majority case (no `r-keynav` in
 *      the component) — every call site below short-circuits on `null`, so a
 *      non-keynav component's emit is completely untouched (SPEC §11: "no
 *      corpus rebless").
 *
 *   2. `keynavRootAttrs`/`keynavItemAttrs` — build the declarative template
 *      attribute fragments spliced directly into `emitTemplateNode.ts`'s
 *      `partsHead` array (mirroring the existing raw-string-splice pattern
 *      used for other emitter-synthesized markers in that file), plus
 *      `buildKeynavScriptInjections` — the `let __rozieKeynavRootRef =
 *      $state<HTMLElement | undefined>(undefined);` / group-id declarations
 *      Svelte's `ref`-less template-binding idiom still needs at the script
 *      level (see `emitScript.ts`'s `emitRefDecls` doc comment: Svelte refs
 *      MUST be `$state(...)` to participate in reactivity).
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
 * script injection). See `keynav.ts`'s (Plan 71-06 Task 1) module doc
 * comment for why the action's reactive "watch active" mechanism is an
 * ordinary Svelte action `update()` triggered by a bare `active` field in
 * that SAME object literal, rather than a separately-emitted `$effect(...)`
 * block — `$effect` is a compiler rune unusable from a plain `.ts` runtime
 * file, and routing it through a script injection here would require a
 * SECOND runtime export + a second call site with no correctness benefit
 * over the action-parameter-reactivity mechanism Svelte already provides.
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
// `__rozieKeynavGroupId` convention).
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';

export interface KeynavEmitPlan {
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
  const rootRefVar = mintedRootRef ? ROOT_REF_VAR : existingRef!;

  return {
    rootElement: root.element,
    keynavRoot: root.keynavRoot,
    itemElement: item?.element ?? null,
    itemLoop: item?.enclosingLoop ?? null,
    rootRefVar,
    mintedRootRef,
    groupIdVar: GROUP_ID_VAR,
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

/** Find the `@keynav-commit` template-event Listener on the root, if authored. */
function findCommitListener(root: TemplateElementIR) {
  return root.events.find((e) => e.event === 'keynav-commit') ?? null;
}

/**
 * `onCommit: (i: number) => void`. Mirrors the SAME bare-identifier-vs-
 * arbitrary-expression convention `emitTemplateEvent` already uses for every
 * other template event: a bare identifier (e.g. `@keynav-commit="handleCommit"`)
 * is passed BY REFERENCE — `keynav` calls it as `onCommit(i)`. An arbitrary
 * expression is wrapped in `(i) => { ...; }`.
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
 * getSource, getActive, setActive, onCommit, activeClass? }` — spliced
 * directly into `use:keynav={{ … }}` on the root element (see
 * `keynavRootAttrs`). `windower` is deliberately NOT populated here (no v1
 * fixture wires one — mirrors the React/Vue references' identical
 * omission); the runtime action's `KeynavActionOpts.windower?` field remains
 * available for a future virtualized-list plan / hand-authored consumer.
 */
function buildKeynavOptsCode(plan: KeynavEmitPlan, ir: IRComponent): string {
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
  return `{ ${lines.join(', ')} }`;
}

/**
 * Script-level scaffolding — ONLY the freshly-minted root ref's `let … =
 * $state<HTMLElement | undefined>(undefined);` declaration (Svelte refs MUST
 * be `$state(...)` to participate in reactivity — `emitScript.ts`'s
 * `emitRefDecls` doc comment) plus the component-unique group id. UNLIKE the
 * React/Vue references, there is no `useKeynav(...)`/hook-CALL injection
 * here — the `keynav` action itself is invoked directly as a TEMPLATE
 * attribute (`keynavRootAttrs`), not a script-level call.
 */
export function buildKeynavScriptInjections(plan: KeynavEmitPlan): SvelteScriptInjection[] {
  const injections: SvelteScriptInjection[] = [];

  if (plan.mintedRootRef) {
    injections.push({
      name: ROOT_REF_VAR,
      decl: `let ${ROOT_REF_VAR} = $state<HTMLElement | undefined>(undefined);`,
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
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.mintedRootRef) {
    attrs.push(`bind:this={${ROOT_REF_VAR}}`);
  }
  attrs.push(`use:keynav={${buildKeynavOptsCode(plan, ir)}}`);
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
 * compare `indexExpr` (the loop's item index, see `keynavItemIndexAlias` in
 * `emitTemplateNode.ts`) against the live active value — declarative Svelte
 * template bindings (`keynav` never writes these directly; see its module
 * doc comment). Returns `[]` when `indexExpr` is unavailable.
 */
export function keynavItemAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  indexExpr: string | null,
  ir: IRComponent,
): string[] {
  if (plan === null || node.keynavItem === undefined || indexExpr === null) return [];
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
 * Strips the `@keynav-commit` template-event Listener out of the root
 * element's `events` array — it is consumed by `buildOnCommitCode` above and
 * routed into the `keynav` action's `onCommit` option, NEVER as a Svelte
 * `onkeynav-commit=` template attribute (which would be inert — `keynav-
 * commit` is a synthetic event, not a real DOM event a host element
 * dispatches).
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
