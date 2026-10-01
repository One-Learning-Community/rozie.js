/**
 * targetModuleImports — the ONE catalog of every name the six emitters may
 * IMPORT into a compiled component's module scope (and its `.d.rozie.ts` /
 * `.d.ts` sidecar) — the scope the `<types>` block is rendered into.
 *
 * Two consumers read it:
 *   - the emitters: every typed import collector (`ReactImport`,
 *     `RuntimeSolidImport`, `AngularCoreImport`, `LitImport`, …) is DEFINED as
 *     `(typeof <LIST>)[number]` over the arrays below, and every hard-coded
 *     import line is one of the `*_IMPORT` line constants below, so an emitter
 *     cannot import a name this file does not list;
 *   - ROZ025 (`validateTypesNameCollisions`): `reservedTargetImportNames()`
 *     reserves every listed name for every component, because a `<types>`
 *     declaration or import with the same name fails the leaf build
 *     (TS2440 / TS2300).
 *
 * The handful of emitter sites that mint import names from untyped strings
 * (Vue/Svelte value imports, Angular keynav/portal helpers, modifier-registry
 * helper names) are pinned by `target-module-imports-drift.test.ts`, which
 * compiles the corpus on all six targets and fails if an emitted import name
 * is missing here.
 *
 * Many of these imports are only added when a feature is used; ROZ025
 * reserves them unconditionally (and on every target — `<types>` is
 * target-neutral).
 *
 * @experimental — added in typed-surface P1 (follow-up)
 */
import { parse } from '@babel/parser';
import { SOLID_JSX_TYPE_NAME } from './generatedTypeNames.js';

// ============================================================================
// REACT
// ============================================================================

/** `import { … } from 'react'` — the `ReactImportCollector` set. */
export const REACT_IMPORTS = [
  'useState',
  'useMemo',
  'useEffect',
  'useRef',
  'useCallback',
  // Phase 71 (r-keynav) — emitted ONLY when the component has an r-keynav
  // root, minting the SSR-safe group id shared by the root's
  // aria-activedescendant and every item's id (see emitKeynav.ts). Byte-
  // identical otherwise (D-03-style additive-only import).
  'useId',
  // Phase 21 ($expose) — emitted only when ir.expose is non-empty so a
  // non-$expose component's `react` import line stays byte-identical (D-03).
  'forwardRef',
  'useImperativeHandle',
  // Phase 36 ($inject) — emitted only when ir.injects is non-empty so a
  // non-context component's `react` import line stays byte-identical (R12/D-5).
  'useContext',
  // Phase 50 (<template r-for> multi-root) — emitted only when a keyed multi-root
  // loop body lowers to `<Fragment key={…}>` (the `<>` shorthand cannot carry a
  // key, and `React.Fragment` is an undefined UMD global under the automatic JSX
  // runtime where leaves import named hooks only). Byte-identical otherwise.
  'Fragment',
] as const;

/** `import { … } from '@rozie/runtime-react'` — the `RuntimeReactImportCollector` set. */
export const REACT_RUNTIME_IMPORTS = [
  'useControllableState',
  'useOutsideClick',
  // Phase 71 (r-keynav) — emitted ONLY when the component has an r-keynav
  // root (see emitKeynav.ts). Byte-identical otherwise.
  'useKeynav',
  'useDebouncedCallback',
  'useThrottledCallback',
  'clsx',
  // Phase 26 (D-01/D-06) — portable display helper. Added by the template
  // emitters ONLY when a `wrapForDisplay` interpolation actually wraps, so a
  // primitive-only component's `@rozie/runtime-react` import line stays
  // byte-identical to pre-phase (SPEC-3).
  'rozieDisplay',
  // 260608-sya — attribute-position display helper (nullish DROPS the
  // attribute, matching Vue's `:attr` semantics). Added by the attribute
  // emitter ONLY on the wrapped whole-value generic-attr binding branch.
  'rozieAttr',
  // Phase 36 ($provide/$inject) — globalThis-backed React context registry.
  // Added by emitContext ONLY when ir.provides/ir.injects is non-empty, so a
  // non-context component's `@rozie/runtime-react` import line stays
  // byte-identical (R12 / D-5).
  'rozieContext',
  'parseInlineStyle',
  'normalizeAttrs',
  // Quick 260804-f15 — the COMPONENT-tag twin of `normalizeAttrs`. Added by the
  // spread emitter ONLY when a DYNAMIC (non-literal, non-`$attrs`) `r-bind`
  // lands on a component/self tag, so an unaffected component's
  // `@rozie/runtime-react` import line stays byte-identical.
  'normalizeComponentAttrs',
  'normalizeListeners',
  'mergeListeners',
  // Typed-surface P3 review fix — filters `attrs` to listener keys for the R6
  // all-fire merge on an auto-fallthrough root with its own @events.
  'pickListeners',
  'isEnter',
  'isEscape',
  'isTab',
  'isSpace',
  'isUp',
  'isDown',
  'isLeft',
  'isRight',
  'isCtrl',
  'isAlt',
  'isShift',
  'isMeta',
] as const;

/** Module + sidecar: slot / children types. */
export const REACT_NODE_TYPE_IMPORT = "import type { ReactNode } from 'react';";
/** Portal-slot primitive (Spike 003): `createRoot`-into-container machinery. */
export const REACT_PORTAL_ROOT_IMPORTS =
  "import { createRoot, type Root } from 'react-dom/client';\nimport { flushSync } from 'react-dom';";
/** `r-portal` element teleport. */
export const REACT_ELEMENT_PORTAL_IMPORT = "import { createPortal } from 'react-dom';";
/** `.d.ts` sidecar of an `$expose` component (forwardRef-typed default export). */
export const REACT_SIDECAR_FORWARD_REF_IMPORTS =
  "import type { ForwardRefExoticComponent, RefAttributes } from 'react';\nimport type * as React from 'react';";

// ============================================================================
// SOLID
// ============================================================================

/** `import { … } from 'solid-js'` — the `SolidImportCollector` set. */
export const SOLID_IMPORTS = [
  'createSignal',
  'createMemo',
  'createEffect',
  // 260602-9lw — `on(deps, fn, { defer: true })` is the idiomatic Solid lazy
  // `$watch` form (skips the first `fn` run). Added to the allowlist alongside
  // `createEffect`/`untrack`. `on` is a first-class `solid-js` export.
  'on',
  'untrack',
  'mergeProps',
  'onMount',
  'onCleanup',
  'Show',
  'For',
  'children',
  'splitProps',
  // Phase 36 ($inject) — emitted only when ir.injects is non-empty so a
  // non-context component's `solid-js` import line stays byte-identical (R12/D-5).
  'useContext',
] as const;

/** `import { … } from '@rozie/runtime-solid'` — the `RuntimeSolidImportCollector` set. */
export const SOLID_RUNTIME_IMPORTS = [
  'createControllableSignal',
  'createOutsideClick',
  'createDebouncedHandler',
  'createThrottledHandler',
  // Phase 71 (r-keynav) — the Solid `r-keynav` primitive. Added by
  // `emitKeynav.ts`'s `buildKeynavScriptInjections` ONLY when the component
  // has an `r-keynav` root, so a non-keynav component's
  // `@rozie/runtime-solid` import line stays byte-identical (SPEC §11).
  'createKeynav',
  // Phase 26 (D-01/D-06) — portable display helper. Added by the template
  // emitters ONLY when a `wrapForDisplay` interpolation actually wraps, so a
  // primitive-only component's `@rozie/runtime-solid` import line stays
  // byte-identical to pre-phase (SPEC-3).
  'rozieDisplay',
  // 260608-sya — attribute-position display helper (nullish DROPS the
  // attribute, matching Vue's `:attr` semantics). Added by the attribute
  // emitter ONLY on the wrapped whole-value generic-attr binding branch.
  'rozieAttr',
  // 260620-kby — clsx-style `:class` normalizer. Added by the class-binding
  // emitter ONLY on a non-provably-string (`wrapForDisplay=true`) class binding,
  // so a provably-string / object-literal class component's
  // `@rozie/runtime-solid` import line stays byte-identical.
  'rozieClass',
  // Phase 36 ($provide/$inject) — globalThis-backed Solid context registry.
  // Added by emitContext ONLY when ir.provides/ir.injects is non-empty, so a
  // non-context component's `@rozie/runtime-solid` import line stays
  // byte-identical (R12 / D-5).
  'rozieContext',
  'parseInlineStyle',
  'normalizeAttrs',
  // Quick 260804-f15 — the COMPONENT-tag twin of `normalizeAttrs`. Added by the
  // spread emitter ONLY when a DYNAMIC (non-literal, non-`$attrs`) `r-bind`
  // lands on a component/self tag, so an unaffected component's
  // `@rozie/runtime-solid` import line stays byte-identical.
  'normalizeComponentAttrs',
  'normalizeListeners',
  'mergeListeners',
  // Quick 260926 (R6 mergeListeners full-attrs clobber fix) — filters an
  // opaque `attrs`/`$listeners` merge-partial down to its listener-shaped
  // (`on*`, function-valued) keys before it reaches `mergeListeners`, so the
  // component's own already-merged `class`/`style` isn't re-clobbered by the
  // untouched rest of `attrs` riding along in the same merge call. Added by
  // `emitListenerSpreadAsMergePartial` ONLY on the bare `$attrs`/`$listeners`
  // merge-partial branch, so an unaffected component's `@rozie/runtime-solid`
  // import line stays byte-identical.
  'pickListeners',
  /**
   * Pre-Phase-16 Item-1-residual closure — `__rozieInjectStyle` runtime
   * helper. Emitted at module top by the shell when `emitStyle` produced
   * a non-empty `injectStatement`. Replaces the previous inline
   * `<style>{...}</style>` JSX emit (which broke same-specificity cascade
   * in cross-SFC composition because each wrapper INSTANCE rendered its
   * own `<style>` element AFTER the consumer's in the DOM).
   */
  '__rozieInjectStyle',
] as const;

/** Module + slot-bearing sidecar (`JSX.Element`); the name is `SOLID_JSX_TYPE_NAME`. */
export const SOLID_JSX_TYPE_IMPORT = `import type { ${SOLID_JSX_TYPE_NAME} } from 'solid-js';`;
/** Portal-slot primitive (Spike 003). */
export const SOLID_WEB_RENDER_IMPORT = "import { render } from 'solid-js/web';";
/** `r-portal` element teleport. */
export const SOLID_WEB_PORTAL_IMPORT = "import { Portal } from 'solid-js/web';";
/** Keyed `r-for` (remount-on-key) lowering. */
export const SOLID_KEYED_IMPORT = "import { Key } from '@solid-primitives/keyed';";

// ============================================================================
// VUE
// ============================================================================

/** `import { … } from 'vue'` — the `VueImportCollector` set (+ `computed` script injections). */
export const VUE_IMPORTS = [
  'ref',
  'computed',
  'watch',
  'watchEffect',
  'provide',
  'inject',
  'useSlots',
  'onMounted',
  'onBeforeUnmount',
  'onUpdated',
  'h',
  'render',
  'Fragment',
] as const;

/** `import { … } from '@rozie/runtime-vue'` — `RuntimeVueImportCollector` + script-injection imports. */
export const VUE_RUNTIME_IMPORTS = [
  'useOutsideClick',
  'debounce',
  'throttle',
  'normalizeListeners',
  'rozieDeepClone',
  'useKeynav',
] as const;

/** `.d.rozie.ts` sidecar. */
export const VUE_SIDECAR_DEFINE_COMPONENT_IMPORT = "import type { DefineComponent } from 'vue';";

// ============================================================================
// SVELTE
// ============================================================================

/** `import type { … } from 'svelte'` — the `SvelteImportCollector` set (module + sidecar). */
export const SVELTE_TYPE_IMPORTS = ['Snippet'] as const;

/** `.d.rozie.ts` sidecar of a slot-bearing component. */
export const SVELTE_SNIPPET_TYPE_IMPORT = "import type { Snippet } from 'svelte';";

/** `import { … } from 'svelte'` — lifecycle / `$watch` / context value imports. */
export const SVELTE_IMPORTS = [
  'onMount',
  'onDestroy',
  'untrack',
  'getContext',
  'setContext',
] as const;

/** `import { … } from '@rozie/runtime-svelte'` — template-walk helper imports. */
export const SVELTE_RUNTIME_IMPORTS = [
  'applyListeners',
  'keynav',
  'rozieAttr',
  'rozieClass',
  'rozieDisplay',
  'roziePortal',
  'rozieStyle',
] as const;

/** Portal-slot primitive (Spike 003) — `mount`/`unmount` plus the host components. */
export const SVELTE_PORTAL_MOUNT_IMPORT = "import { mount, unmount } from 'svelte';";
export const SVELTE_PORTAL_HOST_IMPORT =
  "import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';";
export const SVELTE_PORTAL_HOST_REACTIVE_IMPORT =
  "import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';";

// ============================================================================
// ANGULAR
// ============================================================================

/** `import { … } from '@angular/core'` — the `AngularImportCollector` core set. */
export const ANGULAR_CORE_IMPORTS = [
  'Component',
  'ViewEncapsulation',
  'signal',
  'computed',
  'effect',
  'model',
  'input',
  'output',
  'viewChild',
  'ElementRef',
  'inject',
  'DestroyRef',
  'Renderer2',
  'ContentChild',
  'TemplateRef',
  /**
   * Phase 80 Plan 04 (R3/R5): `contentChildren` — the SIGNAL content-query
   * form (not the decorator `@ContentChildren`) that collects `[rozieSlot]`
   * marker-directive fills on a producer declaring at least one key-fillable
   * (record-only) slot. Added by emitScript alongside `computed` and
   * `TemplateRef` whenever `ir.slots.some(isRecordOnlySlotDecl)` is true.
   */
  'contentChildren',
  /**
   * Bug B fix (260519 linechart-watch-recreate): `untracked` — wraps the
   * $watch callback invocation inside the watcher `effect()` so the
   * callback's reactive reads (and transitive helper reads) don't join the
   * effect's dependency set. Added by emitScript alongside `effect` whenever
   * the IR declares at least one watcher.
   */
  'untracked',
  /**
   * Phase 07.2 Plan 04 (R5 dynamic-name): `ViewChild` — captures the
   * synthetic `<ng-template #__dynSlot_<N>>` declared inside a consumer's
   * component-tag body so the templates getter can resolve it for
   * `*ngTemplateOutlet` dispatch.
   */
  'ViewChild',
  /**
   * Phase 06.2 P2 (RESEARCH Pitfall 5): `forwardRef` — required for the
   * self-reference idiom `imports: [forwardRef(() => Self)]` in standalone
   * Angular components. emitAngular adds it via `imports.add('forwardRef')`
   * when `tagKind: 'self'` appears anywhere in the template.
   */
  'forwardRef',
  /**
   * Phase 14.1 / WR-A1: `afterRenderEffect` — the post-render-phase reactive
   * subscriber that drives the `$attrs` / `r-bind` spread's `__rozieApplyAttrs`
   * call. Replaces the original `effect()` for spreadBinding because a plain
   * effect schedules during change detection and Angular's `[ngClass]` /
   * `ɵɵstyleMap` bindings re-fire AFTER the effect within the same CD pass,
   * clobbering the consumer-merged class / style declarations. Running in the
   * post-render phase guarantees the merge wins the last-write race for R6
   * always-merge consumer-style override.
   */
  'afterRenderEffect',
  /**
   * Phase 36 ($provide/$inject context primitive): `InjectionToken` — the token
   * type the inline `globalThis`-backed `rozieToken` helper mints + dedups
   * (D-1/REQ-28). Added by emitScript whenever the component uses `$provide` or
   * `$inject` (paired with `inject`). The provider's `useFactory` + the
   * consumer's `inject(rozieToken('k'))` both resolve against this token.
   */
  'InjectionToken',
  // Portal-slot primitive (Spike 003) — `emitPortals.ts` adds these with
  // `TemplateRef` / `viewChild` / `inject` / `DestroyRef` when the component
  // declares a `<slot portal>`.
  'ViewContainerRef',
  'EmbeddedViewRef',
  'contentChild',
] as const;

/** `import { … } from '@angular/forms'`. */
export const ANGULAR_FORMS_IMPORTS = ['FormsModule', 'NG_VALUE_ACCESSOR'] as const;

/** `import { … } from '@angular/common'`. */
export const ANGULAR_COMMON_IMPORTS = ['NgTemplateOutlet', 'NgClass', 'NgStyle'] as const;

/** `import { … } from '@rozie/runtime-angular'` (see `ANGULAR_RUNTIME_LOCAL_ALIAS`). */
export const ANGULAR_RUNTIME_IMPORTS = [
  'RozieSlot',
  'rozieDisplay',
  'rozieAttr',
  'rozieToken',
  'createRozieAttrApplier',
  'createRozieHostAttrsReader',
] as const;

/**
 * Local aliases for runtime-import specifiers whose exported name collides
 * with a same-named delegating class method the emitter synthesizes
 * elsewhere (`DISPLAY_CLASS_METHOD` / `ATTR_CLASS_METHOD` in
 * `emitAngular.ts`). Rendered as `` `${name} as ${alias}` `` in the import
 * specifier list; omitted members render as the bare exported name. The
 * ALIAS is the module-scope binding (what ROZ025 reserves).
 */
export const ANGULAR_RUNTIME_LOCAL_ALIAS: Partial<
  Record<(typeof ANGULAR_RUNTIME_IMPORTS)[number], string>
> = {
  rozieDisplay: '__rozieDisplay',
  rozieAttr: '__rozieAttr',
};

/** `r-keynav` (Phase 71/77) — `import { … } from '@rozie/runtime-keynav-core'`. */
export const ANGULAR_KEYNAV_CORE_IMPORTS = [
  'createKeynavStateMachine',
  'KeynavStateMachine',
  'focusIsWithinScope',
  'normalizeClassTokens',
] as const;

// ============================================================================
// LIT
// ============================================================================

/** `import { … } from 'lit'` — the `LitImportCollector` set (sidecar: `LitElement`). */
export const LIT_IMPORTS = [
  'LitElement',
  'html',
  'css',
  'nothing',
  'render',
  'svg',
  'PropertyValues',
] as const;

/** `import { … } from 'lit/decorators.js'`. */
export const LIT_DECORATOR_IMPORTS = [
  'customElement',
  'property',
  'state',
  'query',
  'queryAsync',
  'queryAssignedElements',
  // D-LIT-14 (2026-05-13 correction): queryAssignedNodes is intentionally
  // EXCLUDED from this union — whitespace text-nodes between elements yield
  // false-positive presence detection, breaking $slots.X presence checks.
  // Always use queryAssignedElements with `flatten: true` instead.
  'eventOptions',
] as const;

/** `import { … } from '@lit-labs/preact-signals'`. */
export const LIT_PREACT_SIGNALS_IMPORTS = [
  'SignalWatcher',
  'signal',
  'computed',
  'effect',
  /**
   * Bug B fix (260519 linechart-watch-recreate): `untracked` — wraps the
   * effect-route $watch callback so its reactive reads (and transitive helper
   * reads) don't join the `effect()` dependency set. `@lit-labs/preact-signals`
   * re-exports `untracked` via `export * from '@preact/signals-core'`.
   */
  'untracked',
  'batch',
] as const;

/** `import { … } from '@rozie/runtime-lit'`. */
export const LIT_RUNTIME_IMPORTS = [
  'createLitControllableProperty',
  'observeRozieSlotCtx',
  'attachOutsideClickListener',
  'injectGlobalStyles',
  'adoptConsumerStyles',
  // Item 3 (engine-CSS shadow bridge) — `adoptDocumentStyles` clones the
  // document's same-origin stylesheets into the shadow root. Added by emitLit
  // conditionally when the `<rozie adopt-document-styles>` envelope attr is set.
  'adoptDocumentStyles',
  'debounce',
  'throttle',
  /**
   * Plan 14-05 / D-02 — `rozieSpread` lit-html element-position directive,
   * shipped from `@rozie/runtime-lit`. Added by emitLit conditionally when
   * `EmitTemplateResult.rozieSpreadUsed` is true (i.e., at least one
   * `r-bind`/`$attrs` `spreadBinding` was lowered to `${rozieSpread(...)}`).
   */
  'rozieSpread',
  /**
   * Plan 15-05 / D-12 — `rozieListeners` lit-html element-position
   * AsyncDirective, shipped from `@rozie/runtime-lit`. Added by emitLit
   * conditionally when `EmitTemplateResult.rozieListenersUsed` is true (i.e.,
   * at least one `r-on`/`$listeners` `ListenerSpreadIR` was lowered to
   * `${rozieListeners(...)}`). Extends `AsyncDirective` (NOT regular
   * `Directive` — Pitfall 7 / A2 LOCKED) so `disconnected()` removes every
   * attached listener (T-15-V5-04 leak defense).
   */
  'rozieListeners',
  /**
   * Pre-Phase-16 cleanup Item 3 — `__rozieReconcileAfterDomMutation` runtime
   * helper, shipped from `@rozie/runtime-lit`. Added by `rewriteScript` when
   * the user calls the `$reconcileAfterDomMutation()` sigil from a
   * `<script>` or listener-callback body. Tears down lit-html's part tree
   * and schedules a fresh update — the engine-wrapper escape hatch for
   * third-party DOM mutations (SortableJS, FullCalendar, …) that
   * desynchronise lit-html's sentinel-comment-keyed `oldParts` cache.
   * No-op on every non-Lit target.
   */
  '__rozieReconcileAfterDomMutation',
  /**
   * Phase 26 (D-01/D-06) — portable display helper, shipped from
   * `@rozie/runtime-lit`. Added by the template emitters ONLY when a
   * `wrapForDisplay` interpolation actually wraps, so a primitive-only
   * component's `@rozie/runtime-lit` import line stays byte-identical to
   * pre-phase (SPEC-3). A non-primitive value renders portable pretty-printed
   * JSON instead of lit-html's `[object Object]` auto-coercion.
   */
  'rozieDisplay',
  /**
   * 260608-sya — attribute-position display helper, shipped from
   * `@rozie/runtime-lit`. Added by the attribute emitter ONLY on the wrapped
   * whole-value generic-attr binding branch. Returns lit's `nothing` sentinel
   * on a nullish value so the attribute is DROPPED (matching Vue's `:attr`
   * binding), instead of rendering `attr=""`.
   */
  'rozieAttr',
  /**
   * 260620-kby — clsx-style `:class` normalizer, shipped from
   * `@rozie/runtime-lit`. Added by the class-binding emitter ONLY on a
   * non-provably-string (`wrapForDisplay=true`) plain `:class` binding, so a
   * provably-string / object-literal class component's `@rozie/runtime-lit`
   * import line stays byte-identical. Replaces the prior `rozieDisplay` wrap on
   * the plain-class branch (which JSON-stringified an array class value).
   */
  'rozieClass',
  /**
   * 260620-rta — string|object `:style` normalizer, shipped from
   * `@rozie/runtime-lit`. Added by the template emitter ONLY when a dynamic
   * (non-literal-object) `:style` lowers, so a literal-object-styleMap /
   * string-only / styleless component's `@rozie/runtime-lit` import line stays
   * byte-identical. Routes a dynamic OBJECT `:style` through `styleMap` (real
   * CSS, not `[object Object]`) and a string value through verbatim.
   */
  'rozieStyle',
  /**
   * Phase 71 (r-keynav, Plan 71-08) — the `KeynavController` ReactiveController,
   * shipped from `@rozie/runtime-lit`. Added by `emitKeynav.ts`'s
   * `buildKeynavFieldDecls` ONLY when the component has an `r-keynav` root, so
   * a non-keynav component's `@rozie/runtime-lit` import line stays
   * byte-identical (SPEC §11 — no corpus rebless).
   */
  'KeynavController',
  /**
   * command-palette-portal-overlay phase — the `RoziePortalController`
   * ReactiveController, shipped from `@rozie/runtime-lit`. Added by
   * `emitTemplate.ts` ONLY when the component has at least one `r-portal`
   * element, so a non-portal component's `@rozie/runtime-lit` import line
   * stays byte-identical (mirrors `KeynavController`'s identical gate).
   */
  'RoziePortalController',
  /**
   * Quick 260808-iyh (D5) — the `RozieSlotDistributor` ReactiveController,
   * shipped from `@rozie/runtime-lit`. Added by `emitLit.ts` ONLY when
   * `shouldDistributeSlots(ir)` trips (a duplicated slot name, or a slot
   * nested under `r-for`), so a non-gated component's `@rozie/runtime-lit`
   * import line stays byte-identical (mirrors `KeynavController`'s /
   * `RoziePortalController`'s identical gate shape).
   */
  'RozieSlotDistributor',
  /**
   * command-palette-portal-through-portal cluster (BUG A) —
   * `rozieResolvePortalledRef`, shipped from `@rozie/runtime-lit`. Added by
   * `emitScript.ts`'s `emitRefField` ONLY when the component has at least
   * one `r-portal` element AND at least one author `ref="x"` (the SAME
   * `hasElementPortal` gate `RoziePortalController` itself uses), so a
   * non-portal component's `@rozie/runtime-lit` import line stays
   * byte-identical.
   */
  'rozieResolvePortalledRef',
  /**
   * Quick 260828-sdw — `rozieMemo`, the dep-keyed memoization helper for
   * `$computed`, shipped from `@rozie/runtime-lit`. Added by `emitScript.ts`'s
   * `classBodyFromStatements` ONLY when at least one `$computed` declaration
   * is memoizable (its `SignalRef[]` deps can all be rendered as reads — see
   * the `renderComputedDeps` bail rule for `closure`/`slots`/`slotted`), so a
   * component with no `$computed` (or with only bailed computeds) keeps a
   * byte-identical `@rozie/runtime-lit` import line.
   */
  'rozieMemo',
  /**
   * Quick 260930-814 — `rozieNumberOrStringAttr`, the Lit attribute converter
   * for a Number+String union prop, shipped from `@rozie/runtime-lit`. Added by
   * `emitScript.ts` ONLY when at least one prop (model or non-model) classifies
   * as `number-string` under `classifyUnionAttr`, so every other component's
   * `@rozie/runtime-lit` import line stays byte-identical.
   */
  'rozieNumberOrStringAttr',
] as const;

/**
 * Phase 36 (R10) — `@lit/context` value imports for the cross-component context
 * primitive emit (`emitContext.ts`). `createContext` (identity-on-key, used with
 * `Symbol.for('rozie:'+key)` for native cross-file identity), `ContextProvider`
 * (`$provide`), `ContextConsumer` (`$inject`). The import line is emitted ONLY
 * when the component has at least one `$provide`/`$inject`.
 */
export const LIT_CONTEXT_IMPORTS = ['createContext', 'ContextProvider', 'ContextConsumer'] as const;

/** Template directive imports — one line each, added only when used. */
export const LIT_REPEAT_IMPORT = "import { repeat } from 'lit/directives/repeat.js';";
export const LIT_STYLE_MAP_IMPORT = "import { styleMap } from 'lit/directives/style-map.js';";
export const LIT_REF_IMPORT = "import { ref } from 'lit/directives/ref.js';";
export const LIT_KEYED_IMPORT = "import { keyed } from 'lit/directives/keyed.js';";
export const LIT_UNSAFE_HTML_IMPORT = "import { unsafeHTML } from 'lit/directives/unsafe-html.js';";
/** `.d.rozie.ts` sidecar. */
export const LIT_SIDECAR_LIT_ELEMENT_IMPORT = "import type { LitElement } from 'lit';";

// ============================================================================
// Reserved-name derivation (ROZ025)
// ============================================================================

export type TargetLabel = 'React' | 'Vue' | 'Svelte' | 'Angular' | 'Solid' | 'Lit';

interface CatalogEntry {
  target: TargetLabel;
  /** A list of named imports from `from`… */
  from?: string;
  names?: readonly string[];
  /** …or a literal import line (one or more statements) the emitter prints verbatim. */
  line?: string;
}

const CATALOG: readonly CatalogEntry[] = [
  { target: 'React', from: 'react', names: REACT_IMPORTS },
  { target: 'React', from: '@rozie/runtime-react', names: REACT_RUNTIME_IMPORTS },
  { target: 'React', line: REACT_NODE_TYPE_IMPORT },
  { target: 'React', line: REACT_PORTAL_ROOT_IMPORTS },
  { target: 'React', line: REACT_ELEMENT_PORTAL_IMPORT },
  { target: 'React', line: REACT_SIDECAR_FORWARD_REF_IMPORTS },
  { target: 'Solid', from: 'solid-js', names: SOLID_IMPORTS },
  { target: 'Solid', from: '@rozie/runtime-solid', names: SOLID_RUNTIME_IMPORTS },
  { target: 'Solid', line: SOLID_JSX_TYPE_IMPORT },
  { target: 'Solid', line: SOLID_WEB_RENDER_IMPORT },
  { target: 'Solid', line: SOLID_WEB_PORTAL_IMPORT },
  { target: 'Solid', line: SOLID_KEYED_IMPORT },
  { target: 'Vue', from: 'vue', names: VUE_IMPORTS },
  { target: 'Vue', from: '@rozie/runtime-vue', names: VUE_RUNTIME_IMPORTS },
  { target: 'Vue', line: VUE_SIDECAR_DEFINE_COMPONENT_IMPORT },
  { target: 'Svelte', from: 'svelte', names: SVELTE_TYPE_IMPORTS },
  { target: 'Svelte', from: 'svelte', names: SVELTE_IMPORTS },
  { target: 'Svelte', from: '@rozie/runtime-svelte', names: SVELTE_RUNTIME_IMPORTS },
  { target: 'Svelte', line: SVELTE_SNIPPET_TYPE_IMPORT },
  { target: 'Svelte', line: SVELTE_PORTAL_MOUNT_IMPORT },
  { target: 'Svelte', line: SVELTE_PORTAL_HOST_IMPORT },
  { target: 'Svelte', line: SVELTE_PORTAL_HOST_REACTIVE_IMPORT },
  { target: 'Angular', from: '@angular/core', names: ANGULAR_CORE_IMPORTS },
  { target: 'Angular', from: '@angular/forms', names: ANGULAR_FORMS_IMPORTS },
  { target: 'Angular', from: '@angular/common', names: ANGULAR_COMMON_IMPORTS },
  {
    target: 'Angular',
    from: '@rozie/runtime-angular',
    names: ANGULAR_RUNTIME_IMPORTS.map((n) => ANGULAR_RUNTIME_LOCAL_ALIAS[n] ?? n),
  },
  { target: 'Angular', from: '@rozie/runtime-keynav-core', names: ANGULAR_KEYNAV_CORE_IMPORTS },
  { target: 'Lit', from: 'lit', names: LIT_IMPORTS },
  { target: 'Lit', from: 'lit/decorators.js', names: LIT_DECORATOR_IMPORTS },
  { target: 'Lit', from: '@lit-labs/preact-signals', names: LIT_PREACT_SIGNALS_IMPORTS },
  { target: 'Lit', from: '@rozie/runtime-lit', names: LIT_RUNTIME_IMPORTS },
  { target: 'Lit', from: '@lit/context', names: LIT_CONTEXT_IMPORTS },
  { target: 'Lit', line: LIT_REPEAT_IMPORT },
  { target: 'Lit', line: LIT_STYLE_MAP_IMPORT },
  { target: 'Lit', line: LIT_REF_IMPORT },
  { target: 'Lit', line: LIT_KEYED_IMPORT },
  { target: 'Lit', line: LIT_UNSAFE_HTML_IMPORT },
  { target: 'Lit', line: LIT_SIDECAR_LIT_ELEMENT_IMPORT },
];

/** One module-scope binding an emitter may import. */
export interface TargetImportBinding {
  target: TargetLabel;
  /** The local (module-scope) name. */
  name: string;
  from: string;
}

/** The local bindings a literal import line introduces (parsed, not re-listed). */
function bindingsOfLine(line: string): Array<{ name: string; from: string }> {
  const out: Array<{ name: string; from: string }> = [];
  const program = parse(line, { sourceType: 'module', plugins: ['typescript'] }).program;
  for (const stmt of program.body) {
    if (stmt.type !== 'ImportDeclaration') continue;
    for (const sp of stmt.specifiers) out.push({ name: sp.local.name, from: stmt.source.value });
  }
  return out;
}

let cached: readonly TargetImportBinding[] | null = null;

/**
 * Every module-scope import binding any emitter may introduce, in catalog
 * order. Literal lines are parsed, so the names come from the exact text the
 * emitters print.
 *
 * @experimental — added in typed-surface P1 (follow-up)
 */
export function targetModuleImportBindings(): readonly TargetImportBinding[] {
  if (cached !== null) return cached;
  const out: TargetImportBinding[] = [];
  for (const entry of CATALOG) {
    if (entry.line !== undefined) {
      for (const b of bindingsOfLine(entry.line)) out.push({ target: entry.target, ...b });
    } else {
      for (const name of entry.names ?? [])
        out.push({ target: entry.target, name, from: entry.from! });
    }
  }
  cached = out;
  return out;
}

/**
 * Reserved name → a human description of every emitter import that binds it
 * (`React's \`ReactNode\` import from 'react'`, joined when several targets
 * import the same name).
 *
 * @experimental — added in typed-surface P1 (follow-up)
 */
export function reservedTargetImportNames(): Map<string, string> {
  const grouped = new Map<string, string[]>();
  for (const b of targetModuleImportBindings()) {
    const what = `${b.target}'s \`${b.name}\` import from '${b.from}'`;
    const list = grouped.get(b.name) ?? [];
    if (!list.includes(what)) list.push(what);
    grouped.set(b.name, list);
  }
  const out = new Map<string, string>();
  for (const [name, list] of grouped) {
    out.set(
      name,
      list.length === 1 ? list[0]! : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`,
    );
  }
  return out;
}
