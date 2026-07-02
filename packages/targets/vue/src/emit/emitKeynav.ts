/**
 * emitKeynav — Phase 71 Plan 05 (Vue target).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02) to the `useKeynav` Vue composable
 * (Phase 71 Plan 03's `@rozie/runtime-keynav-core` + this plan's Task 1
 * composable). Modeled directly on the React REFERENCE implementation
 * (`packages/targets/react/src/emit/emitKeynav.ts`, Plan 71-04) — same two
 * responsibilities, resolved ONCE per component:
 *
 *   1. `resolveKeynavPlan(ir)` — locates the (at most one, SPEC §7 v1)
 *      `keynavRoot` element and the FIRST `keynavItem` element + its
 *      enclosing `r-for` loop. Mirrors core's own `resolveKeynavGroups` walk.
 *      Returns `null` for the overwhelming majority case (no `r-keynav` in
 *      the component) — every call site below short-circuits on `null`, so a
 *      non-keynav component's emit is completely untouched (SPEC §11: "no
 *      corpus rebless").
 *
 *   2. `buildKeynavScriptInjections(plan, ir)` — renders the
 *      `useKeynav(...)` call plus its `ref()`/group-id scaffolding as a
 *      SINGLE `ScriptInjection` (Vue's existing debounce/throttle/r-match
 *      hoist mechanism, `emitTemplateEvent.ts`). `mergeScriptInjections`
 *      (emitVue.ts) already places every injection's `decl` at the BOTTOM of
 *      the script body — required because `onCommit` may reference a
 *      user-authored handler (e.g. `@keynav-commit="run(items[$data.active])"`).
 *
 * VUE-SPECIFIC DIVERGENCE FROM REACT — two expression-rewrite contexts:
 * Vue's template compiler auto-unwraps top-level `ref()`/`defineModel()`
 * bindings (NO `.value`), but a plain `<script setup>` JS closure (which is
 * exactly what `useKeynav(...)`'s opts object is — it's spliced into the
 * script body by `mergeScriptInjections`, NOT rendered by the template
 * compiler) does NOT get that treatment. `rewriteTemplateExpression.ts`
 * (Plan 03) is therefore the WRONG rewriter for `getSource`/`getActive`/
 * `setActive`/`onCommit`/`activeClass` — this file's `rewriteScriptExpression`
 * (below) is the single-expression SCRIPT-context analogue of
 * `rewriteRozieIdentifiers` (which only operates on the whole cloned
 * `<script>` Program, not on IR nodes living OUTSIDE it like
 * `KeynavRootIR.activeExpression`). `rewriteTemplateExpression` is still the
 * right choice for the TEMPLATE-side attribute bindings
 * (`data-rozie-keynav-active`/`:tabindex`/`:aria-activedescendant`) since
 * those genuinely render inside `<template>` and benefit from Vue's native
 * auto-unwrap.
 *
 * Per-element attribute emission (root `ref`/`:aria-activedescendant`, item
 * `:id`/`:data-rozie-keynav-item`/`:data-rozie-keynav-active`/`:tabindex`) is
 * built by `keynavRootAttrs`/`keynavItemAttrs` below and spliced directly
 * into `emitTemplateNode.ts`'s `partsHead` array — mirroring the existing
 * `rHtml`/`extraDirective` raw-string-splice pattern (and the `r-match`
 * hoist's `ScriptInjection` push) rather than routing through the
 * `AttributeBinding`/`emitMergedAttributes` machinery, since these markers
 * are emitter-synthesized, not author-authored bindings.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type {
  IRComponent,
  KeynavItemIR,
  KeynavRootIR,
  TemplateElementIR,
  TemplateLoopIR,
  TemplateNode,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { ScriptInjection } from './emitTemplateEvent.js';

// CJS interop normalization (mirrors every other emit/* module in this package).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function flattenInlineCode(code: string): string {
  return code.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

// Synthesized (never author-visible) identifier names — namespaced
// `__rozieKeynav*` so they can never collide with a `<script>`-declared
// binding (mirrors the React reference's `__rozieMatch_N`/`__rozieExposeRef`
// convention).
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';

export interface KeynavEmitPlan {
  rootElement: TemplateElementIR;
  keynavRoot: KeynavRootIR;
  itemElement: TemplateElementIR | null;
  itemLoop: TemplateLoopIR | null;
  /** `ref="…"` identifier to emit on the root — reuses an author `ref="x"` when present. */
  rootRefVar: string;
  /** True when `rootRefVar` was FRESHLY synthesized (needs its own `ref()` decl + a `'vue'` `ref` import). False when reusing an author-declared ref (already emits its own `ref()` decl via `emitTemplateRefs`). */
  mintedRootRef: boolean;
  /** Group-id identifier shared by the root's `:aria-activedescendant` and every item's `:id`. */
  groupIdVar: string;
}

/**
 * Script-context (NOT template-context) rewrite of Rozie magic accessors for
 * a SINGLE expression — the single-expression analogue of
 * `rewriteRozieIdentifiers` (`../rewrite/rewriteScript.js`), needed because
 * `KeynavRootIR`/`KeynavItemIR`'s expressions live OUTSIDE
 * `ir.setupBody.scriptProgram` (they were parsed from template attribute
 * values), so the whole-Program rewriter never sees them. Appends `.value`
 * for `$data`/model-`$props`/`$refs` reads — `rewriteTemplateExpression.ts`
 * deliberately omits `.value` because it targets `<template>`'s auto-unwrap
 * context; this file's output is spliced into a plain `<script setup>` JS
 * closure (`useKeynav(...)`'s opts object), which gets NO such treatment.
 *
 * KNOWN LIMITATION (mirrors the class of scope-narrowing documented in the
 * React reference, Plan 71-04): a BARE `$computed`-declared name referenced
 * directly inside a keynav expression (e.g. `r-keynav-item="{ label:
 * someComputedName }"` with no member access) is passed through unchanged —
 * unlike `rewriteRozieIdentifiers`'s whole-Program pass, this single-
 * expression rewriter has no `computedNames` bare-read scan (that pass
 * requires whole-Program identifier-position context — declarator id,
 * parameter, shorthand-key, etc. — this helper only ever receives an
 * already-isolated attribute-value Expression). No SPEC §3.1 fixture
 * exercises this shape; out of scope for v1.
 */
function rewriteScriptExpression(expr: t.Expression, ir: IRComponent): string {
  const cloned = t.cloneNode(expr, true, false);

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));

  const wrapper = t.file(t.program([t.expressionStatement(cloned)]));

  traverse(wrapper, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value.value — defineModel() returns a
          // Ref<T>, the SAME `.value` convention as $data below.
          path.node.object = t.identifier(prop.name);
          path.node.property = t.identifier('value');
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // $props.step → props.step — NOT a ref, no `.value` in EITHER context.
          path.node.object = t.identifier('props');
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.active → active.value
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('value');
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogElRef.value (Pitfall 4 Ref suffix)
        path.node.object = t.identifier(prop.name + 'Ref');
        path.node.property = t.identifier('value');
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          path.node.object = t.identifier(prop.name);
          path.node.property = t.identifier('value');
        } else if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('value');
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name + 'Ref');
        path.node.property = t.identifier('value');
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === '$emit') {
        // $emit('foo', x) → emit('foo', x) — in case a keynav-commit
        // handler expression inlines a $emit call directly.
        path.node.callee = t.identifier('emit');
      }
    },
  });

  const stmt = wrapper.program.body[0]!;
  const raw = !t.isExpressionStatement(stmt)
    ? generate(cloned, GEN_OPTS).code
    : generate(stmt.expression, GEN_OPTS).code;
  return flattenInlineCode(raw);
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
  // Vue permits only one `ref=` attribute per element, so silently
  // overwriting an author's own ref would be a Rule-1-class bug. Mirrors the
  // React reference's identical defensive check (untested by a dedicated
  // fixture there too — SPEC §3.1 has no example combining both).
  const existingRef = findStaticAttrValue(root.element, 'ref');
  const mintedRootRef = !(existingRef !== null && ir.refs.some((r) => r.name === existingRef));
  const rootRefVar = mintedRootRef ? ROOT_REF_VAR : `${existingRef}Ref`;

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
 * least one of them. Rendered via `rewriteScriptExpression` (SCRIPT context
 * — see this module's doc comment), NOT `rewriteTemplateExpression`.
 */
function buildGetSourceCode(plan: KeynavEmitPlan, ir: IRComponent): string {
  const sourceExpr = plan.keynavRoot.sourceExpression;
  if (!sourceExpr) {
    // Core already emitted ROZ987 (KEYNAV_SOURCE_UNRESOLVED) upstream for
    // this shape — best-effort empty source keeps emitted code well-formed
    // rather than crashing the compiler on an already-erroring input (D-08).
    return '() => []';
  }
  const sourceCode = rewriteScriptExpression(sourceExpr, ir);

  const item = plan.itemElement?.keynavItem;
  if (!item || plan.itemLoop === null) {
    return `() => (${sourceCode})`;
  }

  const fields: string[] = [];
  if (item.labelExpression) {
    fields.push(`label: ${rewriteScriptExpression(item.labelExpression, ir)}`);
  }
  if (item.disabledExpression) {
    fields.push(`disabled: ${rewriteScriptExpression(item.disabledExpression, ir)}`);
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
 * is passed BY REFERENCE — `useKeynav` calls it as `onCommit(i)`. An
 * arbitrary expression is wrapped in `(i) => { ...; }`.
 */
function buildOnCommitCode(root: TemplateElementIR, ir: IRComponent): string {
  const listener = findCommitListener(root);
  if (!listener) return '() => {}';
  const handlerCode = rewriteScriptExpression(listener.handler, ir);
  if (/^[A-Za-z_$][\w$]*$/.test(handlerCode)) {
    return handlerCode;
  }
  return `(i) => { ${handlerCode}; }`;
}

/**
 * Resolve the writable get/set pair for `keynavRoot.activeExpression` in
 * SCRIPT context. `$data.X` and model `$props.X` (defineModel forwarding)
 * lower IDENTICALLY in Vue — both are `Ref<T>`, so both become `X.value` —
 * unlike React, which needs a 3-way useState-vs-forwarding split
 * (`resolveTwoWayTarget.ts`). A deep chain rooted in `$data` (D-03
 * permissive, rare) falls back to the rewritten member-chain text as the
 * getter and an inline reassignment arrow as the setter, mirroring the React
 * reference's identical fallback branch.
 */
function resolveActiveScriptTarget(
  expr: t.Expression,
  ir: IRComponent,
): { get: string; set: string } {
  if (
    t.isMemberExpression(expr) &&
    !expr.computed &&
    t.isIdentifier(expr.object) &&
    t.isIdentifier(expr.property) &&
    (expr.object.name === '$data' || expr.object.name === '$props')
  ) {
    const prop = expr.property.name;
    return { get: `${prop}.value`, set: `(v) => { ${prop}.value = v; }` };
  }
  if (t.isMemberExpression(expr) && t.isMemberExpression(expr.object)) {
    const code = rewriteScriptExpression(expr, ir);
    return { get: code, set: `(v) => { ${code} = v; }` };
  }
  // Defensive — resolveKeynavGroups (core) does not currently validate
  // activeExpression's writability shape; a regression there should surface
  // immediately rather than silently emitting malformed script (mirrors the
  // React reference's identical defensive throw).
  throw new Error(
    'resolveActiveScriptTarget: unexpected r-keynav active-index expression shape reached the Vue emitter.',
  );
}

/**
 * Renders the `useKeynav(...)` call plus its `ref()`/group-id scaffolding as
 * a SINGLE `ScriptInjection` — `mergeScriptInjections` (emitVue.ts) already
 * places every injection's `decl` at the bottom of the script body (after
 * the user's own handler declarations) and dedupes `@rozie/runtime-vue`
 * imports across every injection.
 */
export function buildKeynavScriptInjections(
  plan: KeynavEmitPlan,
  ir: IRComponent,
): ScriptInjection[] {
  const declLines: string[] = [];

  if (plan.mintedRootRef) {
    declLines.push(`const ${ROOT_REF_VAR} = ref<HTMLElement | null>(null);`);
  }

  // Component-unique group id (T-71-05-02) — Vue's setup runs exactly ONCE
  // per instance, so a plain `Math.random()`-derived string minted here is
  // stable for the component's whole lifetime and collision-safe across
  // instances/groups without needing a framework-level id primitive
  // (React's Plan 71-04 used `useId()`; Vue 3.4 — this project's floor — has
  // no equivalent stable composable, and one isn't needed given setup-runs-
  // once semantics).
  declLines.push(
    `const ${plan.groupIdVar} = \`keynav-\${Math.random().toString(36).slice(2)}\`;`,
  );

  const active = resolveActiveScriptTarget(plan.keynavRoot.activeExpression, ir);

  const optsLines = [
    `  config: ${buildConfigCode(plan.keynavRoot)},`,
    `  getSource: ${buildGetSourceCode(plan, ir)},`,
    `  getActive: () => ${active.get},`,
    `  setActive: ${active.set},`,
    `  onCommit: ${buildOnCommitCode(plan.rootElement, ir)},`,
  ];
  if (plan.keynavRoot.activeClassExpression) {
    optsLines.push(
      `  activeClass: ${rewriteScriptExpression(plan.keynavRoot.activeClassExpression, ir)},`,
    );
  }
  declLines.push(`useKeynav(${plan.rootRefVar}, {\n${optsLines.join('\n')}\n});`);

  return [
    {
      wrapName: 'useKeynav',
      import: { from: '@rozie/runtime-vue', name: 'useKeynav' },
      decl: declLines.join('\n'),
    },
  ];
}

/**
 * Root-element template attribute fragments — `ref="…"` (only when a fresh
 * ref was synthesized; an author-declared `ref="x"` already emits its own
 * `ref="xRef"` via the normal attribute path, and Vue permits only one
 * `ref=` per element) plus `:aria-activedescendant` for the activedescendant
 * focus model, pointing at the active item's id. Rendered via
 * `rewriteTemplateExpression` (TEMPLATE context — auto-unwrap) since these
 * genuinely render inside `<template>`.
 */
export function keynavRootAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  ir: IRComponent,
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.mintedRootRef) {
    attrs.push(`ref="${ROOT_REF_VAR}"`);
  }
  if (plan.keynavRoot.focusModel === 'activedescendant') {
    const activeCode = rewriteTemplateExpression(plan.keynavRoot.activeExpression, ir);
    attrs.push(
      `:aria-activedescendant="${activeCode} >= 0 ? \`\${${plan.groupIdVar}}-item-\${${activeCode}}\` : undefined"`,
    );
  }
  return attrs;
}

/**
 * Item-element template attribute fragments — stable `:id`, the
 * `:data-rozie-keynav-item` delegation/bounds-check marker (SPEC §8, triple
 * duty), the always-present `:data-rozie-keynav-active` marker (SPEC §9),
 * and — tabindex focus model only — the `:tabindex` roving binding. All FOUR
 * compare `indexExpr` (the loop's item index, see `keynavItemIndexAlias` in
 * `emitTemplateNode.ts`) against the live active value — declarative Vue
 * template bindings (`useKeynav` never writes these directly; see its module
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
    `:id="\`\${${plan.groupIdVar}}-item-\${${indexExpr}}\`"`,
    `:data-rozie-keynav-item="${indexExpr}"`,
    `:data-rozie-keynav-active="${activeCode} === ${indexExpr} ? '' : undefined"`,
  ];
  if (plan.keynavRoot.focusModel === 'tabindex') {
    attrs.push(`:tabindex="${activeCode} === ${indexExpr} ? 0 : -1"`);
  }
  return attrs;
}

/**
 * Strips the `@keynav-commit` template-event Listener out of the root
 * element's `events` array — it is consumed by `buildOnCommitCode` above and
 * routed into `useKeynav`'s `onCommit` option, NEVER as a Vue `@keynav-commit=`
 * template attribute (which would be inert — `keynav-commit` is a synthetic
 * event, not a real DOM event a host element dispatches).
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
 * still gets a working `:data-rozie-keynav-item="index"` marker.
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
