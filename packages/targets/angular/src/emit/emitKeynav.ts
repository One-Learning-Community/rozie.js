/**
 * emitKeynav — Phase 71 Plan 09 (Angular target — highest blast radius,
 * Landmine 3).
 *
 * Bridges the compiler front-end IR (`keynavRoot?`/`keynavItem?` on
 * `TemplateElementIR`, Phase 71 Plan 02) to an INLINE controller emitted
 * directly into the component class — per the 71-01 Wave-2 binding decision,
 * there is NO `@rozie/runtime-angular` package. The heavy keydown/typeahead
 * state-machine logic is still NOT duplicated per component: this module
 * imports `createKeynavStateMachine`/`normalizeClassTokens` from the
 * framework-neutral `@rozie/runtime-keynav-core` (Plan 71-03) and generates
 * only a thin bridge — the SAME hybrid architecture (SPEC §8) every other
 * target's dedicated controller (`useKeynav`/`createKeynav`/`KeynavController`)
 * implements, expressed here as generated class members instead of a
 * hand-authored runtime package.
 *
 * Modeled on the React REFERENCE (`packages/targets/react/src/emit/emitKeynav.ts`,
 * Plan 71-04) and the Vue port (Plan 71-05) — same `resolveKeynavPlan`/
 * `keynavRootAttrs`/`keynavItemAttrs`/`stripKeynavCommitEvent` shape — plus a
 * NEW `buildKeynavClassEmission` responsibility unique to Angular: because
 * there is no separate runtime hook/composable to call, the controller
 * wiring itself (field decls + `ngAfterViewInit` instantiation + a
 * `constructor`-body `effect()`) is generated INLINE by this module and
 * spliced into the class body by `emitScript.ts`.
 *
 * ANGULAR-SPECIFIC DIVERGENCES FROM THE OTHER FIVE TARGETS:
 *
 *   - **Two expression-rewrite contexts**, mirroring the Vue reference's
 *     identical split: `rewriteListenerExpression` (SCRIPT context — `this.`
 *     prefixed, signal-call reads, `.set()` writes) for everything wired into
 *     `ngAfterViewInit`/the constructor `effect()` (getSource/getActive/
 *     setActive/commit/activeClass), and `rewriteTemplateExpression`
 *     (TEMPLATE context — bare, no `this.`) for the `keynavRootAttrs`/
 *     `keynavItemAttrs` template-attribute fragments, which genuinely render
 *     inside the Angular template compilation unit.
 *
 *   - **The state machine is instantiated in `ngAfterViewInit`, not a field
 *     initializer** — `viewChild()` signals return `undefined` until after
 *     view init (the SAME reason `$onMount` bodies bucket into
 *     `ngAfterViewInit`, see `emitScript.ts`'s `renderLifecycleHook` doc
 *     comment). The class field itself is declared eagerly
 *     (`private __rozieKeynavController: KeynavStateMachine | null = null;`)
 *     so every method can reference it; `ngAfterViewInit` assigns it once the
 *     root's `nativeElement` is guaranteed to exist. Root keydown/pointer
 *     delegation (`Renderer2.listen`) and its `DestroyRef`-registered
 *     teardown live in the SAME `ngAfterViewInit` block, right after the
 *     controller is built — both need the guaranteed-populated root element.
 *
 *   - **The active-change imperative work (focus/scroll/`r-keynav-active-class`
 *     toggle) is a `constructor`-body `effect()`** — Angular's signal
 *     `effect()` auto-tracks the `getActive()`-equivalent signal read
 *     (`this.<prop>()`) performed directly inside its callback, giving the
 *     EXACT "runs once per active-change" semantics SPEC §9 requires with
 *     zero framework dependency-array machinery, mirroring the pre-existing
 *     `$watch` → `effect()` lowering already established in `emitScript.ts`.
 *
 *   - **No `@rozie/runtime-angular` hook/composable/primitive/controller
 *     exists to call** — `buildKeynavClassEmission` generates the field
 *     decls + `ngAfterViewInit` lines + constructor `effect()` text directly,
 *     consumed by `emitScript.ts` the SAME way it already consumes
 *     `emitPortals`'s `PortalsEmit` shape (field decls / `ngAfterViewInit`
 *     splice / `needsDestroyRefField` / `angularImports`) — reuse of an
 *     established integration seam, not a new one.
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
// binding (mirrors the React/Vue reference's `__rozieMatch_N`/
// `__rozieExposeRef` convention).
const ROOT_REF_VAR = '__rozieKeynavRootRef';
const GROUP_ID_VAR = '__rozieKeynavGroupId';
const RENDERER_FIELD = '__rozieKeynavRenderer';
const CONTROLLER_VAR = '__rozieKeynavController';

export interface KeynavEmitPlan {
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
  item: {
    element: TemplateElementIR;
    keynavItem: KeynavItemIR;
    enclosingLoop: TemplateLoopIR | null;
  } | null;
} {
  const found: {
    root: { element: TemplateElementIR; keynavRoot: KeynavRootIR } | null;
    item: {
      element: TemplateElementIR;
      keynavItem: KeynavItemIR;
      enclosingLoop: TemplateLoopIR | null;
    } | null;
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
  // Angular permits only one `#name` template-ref per element, so silently
  // overwriting an author's own ref would be a Rule-1-class bug. Mirrors the
  // React/Vue reference's identical defensive check (untested by a dedicated
  // fixture there too — SPEC §3.1 has no example combining both).
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

/** Find the `@keynav-commit` template-event Listener on the root, if authored. */
function findCommitListener(root: TemplateElementIR) {
  return root.events.find((e) => e.event === 'keynav-commit') ?? null;
}

/**
 * `commit: (i: number) => void` — the `KeynavHost.commit` field, called
 * DIRECTLY by the state machine (no intermediate `onCommit` opts indirection
 * the way the hook/composable-based targets have — this IS the host object).
 * Mirrors the SAME bare-identifier-vs-arbitrary-expression convention
 * `emitListeners.ts`'s `renderListener` already uses for `<listeners>`-block
 * handlers: a bare identifier (e.g. `@keynav-commit="handleCommit"`) rewrites
 * to `this.handleCommit` (an arrow class field — safe to pass BY REFERENCE,
 * since arrow class fields close over `this` lexically) and is passed
 * directly; an arbitrary expression (SPEC's own `run(items[$data.active])`)
 * is wrapped in `(i) => { ...; }`.
 */
function buildCommitCode(
  root: TemplateElementIR,
  ir: IRComponent,
  listenerOpts: RewriteListenerOpts,
): string {
  const listener = findCommitListener(root);
  if (!listener) return '() => {}';
  const handlerCode = rewriteListenerExpression(listener.handler, ir, listenerOpts);
  if (/^this\.[A-Za-z_$][\w$]*$/.test(handlerCode)) {
    return handlerCode;
  }
  return `(i) => { ${handlerCode}; }`;
}

/**
 * Resolve the writable get/set pair for `keynavRoot.activeExpression` in
 * SCRIPT context — `this.<prop>()` read, `this.<prop>.set(i)` write. Mirrors
 * `rewriteListenerExpression.ts`'s own `buildAngularSetterCall` shape (both
 * `$data.X` and model `$props.X` lower IDENTICALLY on Angular — both are
 * signal fields). A deep chain reaching this defensive throw would indicate
 * `resolveKeynavGroups` (core) validated a non-writable active-index shape
 * that should never reach emit — mirrors the React/Vue reference's identical
 * defensive throw (D-08: a regression here should surface immediately rather
 * than silently emitting malformed script).
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
    'resolveActiveScriptTarget: unexpected r-keynav active-index expression shape reached the Angular emitter.',
  );
}

export interface KeynavClassEmission {
  /** Class-body field declarations (group id, root viewChild, injected Renderer2, controller field). */
  fieldDecls: string[];
  /** `constructor()`-body lines — the active-change `effect()` (focus/scroll/active-class). */
  constructorLines: string[];
  /** `ngAfterViewInit()`-body lines — controller instantiation + root keydown/pointer delegation + DestroyRef teardown. */
  afterViewInitLines: string[];
  /** Always true — `ngAfterViewInit`'s teardown registers via `this.__rozieDestroyRef.onDestroy(...)`. */
  needsDestroyRefField: boolean;
  /** `@angular/core` symbol names this emission references — caller adds them to the import collector. */
  angularImports: string[];
  /** `@rozie/runtime-keynav-core` symbol names this emission references. */
  runtimeImports: string[];
}

/**
 * Generate the INLINE controller's class-body wiring — field decls +
 * `ngAfterViewInit` instantiation/delegation + a constructor `effect()` for
 * active-change imperative work. See this module's doc comment for the full
 * rationale of each piece's placement.
 */
export function buildKeynavClassEmission(
  plan: KeynavEmitPlan,
  ir: IRComponent,
  /**
   * The REAL (not preview) `rewriteRozieIdentifiers` result from
   * `emitScript.ts`'s own Step 3 — threading `classMembers`/`signalMembers`/
   * `collisionRenames` so a `<script>`-declared handler referenced from
   * `getSource`/`commit`/`activeClass` (e.g. `run` in
   * `@keynav-commit="run($props.items[$data.active])"`) correctly rewrites
   * to `this.run(...)`, exactly like every other class-context rewrite site
   * in this target (mirrors `emitListeners()`'s identical parameter threading).
   */
  listenerOpts: RewriteListenerOpts,
): KeynavClassEmission {
  const fieldDecls: string[] = [
    `private ${GROUP_ID_VAR} = 'rozie-keynav-' + Math.random().toString(36).slice(2);`,
  ];
  if (plan.mintedRootRef) {
    fieldDecls.push(
      `private ${ROOT_REF_VAR} = viewChild<ElementRef<HTMLElement>>('${ROOT_REF_VAR}');`,
    );
  }
  fieldDecls.push(`private ${RENDERER_FIELD} = inject(Renderer2);`);
  fieldDecls.push(`private ${CONTROLLER_VAR}: KeynavStateMachine | null = null;`);

  const rootRefExpr = `this.${plan.rootRefVar}()?.nativeElement`;
  const active = resolveActiveScriptTarget(plan.keynavRoot.activeExpression);
  const getSourceCode = buildGetSourceCode(plan, ir, listenerOpts);
  const commitCode = buildCommitCode(plan.rootElement, ir, listenerOpts);
  const configCode = buildConfigCode(plan.keynavRoot);

  const afterViewInitLines: string[] = [
    [
      `this.${CONTROLLER_VAR} = createKeynavStateMachine({`,
      `  getSource: ${getSourceCode},`,
      `  getActive: () => ${active.get},`,
      `  setActive: ${active.set},`,
      `  commit: ${commitCode},`,
      `}, ${configCode});`,
    ].join('\n'),
    [
      `{`,
      `  const __rozieKeynavRootEl = ${rootRefExpr};`,
      `  if (__rozieKeynavRootEl) {`,
      `    const __rozieKeynavHandleKeydown = ($event: KeyboardEvent) => { this.${CONTROLLER_VAR}?.onKeydown($event); };`,
      `    const __rozieKeynavHandlePointer = ($event: PointerEvent) => {`,
      `      const __rozieKeynavTarget = $event.target;`,
      `      if (!(__rozieKeynavTarget instanceof Element)) return;`,
      `      const __rozieKeynavMarker = __rozieKeynavTarget.closest('[data-rozie-keynav-item]');`,
      `      if (!__rozieKeynavMarker) return;`,
      `      const __rozieKeynavRaw = __rozieKeynavMarker.getAttribute('data-rozie-keynav-item');`,
      `      if (__rozieKeynavRaw === null) return;`,
      // T-71-09-01 (threat register) — Number() + bounds-check on the
      // untrusted DOM marker BEFORE it reaches the reducer. The reducer also
      // clamps as a second line of defense (71-03's onPointerActivate), but a
      // malformed/negative index is rejected here first, never coerced.
      `      const __rozieKeynavIdx = Number(__rozieKeynavRaw);`,
      `      if (!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0) return;`,
      `      this.${CONTROLLER_VAR}?.onPointerActivate(__rozieKeynavIdx);`,
      `    };`,
      `    const __rozieKeynavUnlistenKeydown = this.${RENDERER_FIELD}.listen(__rozieKeynavRootEl, 'keydown', __rozieKeynavHandleKeydown);`,
      `    const __rozieKeynavUnlistenPointer = this.${RENDERER_FIELD}.listen(__rozieKeynavRootEl, 'pointerdown', __rozieKeynavHandlePointer);`,
      `    this.__rozieDestroyRef.onDestroy(() => {`,
      `      __rozieKeynavUnlistenKeydown();`,
      `      __rozieKeynavUnlistenPointer();`,
      `      this.${CONTROLLER_VAR}?.dispose();`,
      `    });`,
      `  }`,
      `}`,
    ].join('\n'),
  ];

  // `type KeynavStateMachine` — the emitted field declaration
  // (`private __rozieKeynavController: KeynavStateMachine | null = null;`)
  // needs the TYPE imported too; inline `type` specifier form (TS 5.6+, per
  // the project's floor) lets it share the SAME import statement as the
  // value import `createKeynavStateMachine`.
  const runtimeImports = ['createKeynavStateMachine', 'type KeynavStateMachine'];
  const activeClassLines: string[] = [];
  if (plan.keynavRoot.activeClassExpression) {
    runtimeImports.push('normalizeClassTokens');
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

  const focusLines: string[] =
    plan.keynavRoot.focusModel === 'tabindex' ? ['  __rozieKeynavActiveEl?.focus();'] : [];

  // Active-CHANGE effect (SPEC §9: "evaluated once ... toggles on
  // active-change, not a live per-render binding") — the `this.<prop>()`
  // signal read happens DIRECTLY inside the effect() callback body so
  // Angular's auto-tracking subscribes to it; every other captured value is a
  // plain closure read (no latest-ref indirection needed — a class instance's
  // fields are already live, matching the Vue/Solid/Lit references' identical
  // rationale for skipping React's optsRef pattern).
  const constructorLines: string[] = [
    [
      `effect(() => {`,
      `  const __rozieKeynavActive = ${active.get};`,
      `  const __rozieKeynavRootEl = ${rootRefExpr};`,
      `  if (!__rozieKeynavRootEl || !Number.isFinite(__rozieKeynavActive)) return;`,
      `  const __rozieKeynavActiveEl = __rozieKeynavRootEl.querySelector<HTMLElement>(\`[data-rozie-keynav-item="\${__rozieKeynavActive}"]\`);`,
      ...activeClassLines,
      ...focusLines,
      `  __rozieKeynavActiveEl?.scrollIntoView({ block: 'nearest' });`,
      `});`,
    ].join('\n'),
  ];

  const angularImports = ['inject', 'Renderer2', 'DestroyRef', 'effect'];
  if (plan.mintedRootRef) {
    angularImports.push('viewChild', 'ElementRef');
  }

  return {
    fieldDecls,
    constructorLines,
    afterViewInitLines,
    needsDestroyRefField: true,
    angularImports,
    runtimeImports,
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
 */
export function keynavRootAttrs(
  plan: KeynavEmitPlan | null,
  node: TemplateElementIR,
  ir: IRComponent,
): string[] {
  if (plan === null || node.keynavRoot === undefined) return [];
  const attrs: string[] = [];
  if (plan.mintedRootRef) {
    attrs.push(`#${ROOT_REF_VAR}`);
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
 * bare inside the block with no `let` alias needed, per Angular's own
 * `@for` docs; see `emitTemplateNode.ts`'s `emitLoop` for the
 * `node.indexAlias ?? '$index'` threading, which needs NO loop-declaration
 * synthesis unlike the React/Vue/Solid references) against the live active
 * value — declarative Angular template bindings (the inline controller never
 * writes these directly). Returns `[]` when `indexExpr` is unavailable.
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
 * Strips the `@keynav-commit` template-event Listener out of the root
 * element's `events` array — it is consumed by `buildCommitCode` above and
 * routed into the inline controller's `KeynavHost.commit`, NEVER as an
 * Angular `(keynavCommit)=` template binding (which would be inert —
 * `keynav-commit` is a synthetic event, not a real DOM event a host element
 * dispatches).
 */
export function stripKeynavCommitEvent(node: TemplateElementIR): TemplateElementIR {
  if (node.keynavRoot === undefined) return node;
  const filtered = node.events.filter((e) => e.event !== 'keynav-commit');
  if (filtered.length === node.events.length) return node;
  return { ...node, events: filtered };
}
