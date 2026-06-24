/**
 * @rozie/target-lit — top-level emitter orchestrator.
 *
 * Plan 06.4-02 (P2) replaces the P1 stub with a working Lit class emitter:
 *
 *   1. Build collectors (lit / lit-decorators / preact-signals / runtime-lit).
 *   2. emitStyle  → static-styles field + optional injectGlobalStyles call.
 *   3. emitSlotDecl → slot-presence @state + @queryAssignedElements per slot.
 *   4. emitScript → @property fields + signal fields for $data + lifecycle methods.
 *   5. emitListeners → firstUpdated() body wiring (addEventListener + outside + debounce/throttle).
 *   6. emitTemplate → render() body emitting html`` with Lit sigils.
 *   7. buildShell composes imports + decorator + class + injectGlobalStyles call
 *      + customElements.define registration.
 *
 * IMPORTANT INVARIANTS (Plan 06.4-02):
 *   - Uses @queryAssignedElements; the legacy Nodes variant is intentionally
 *     excluded per D-LIT-14 (2026-05-13 correction).
 *   - Invariant (T-06.4-03 mitigation; enforced by emitLit-shape.test.ts):
 *     the `unsafeHTML` escape-bypass directive is imported ONLY CONDITIONALLY —
 *     when a component uses `r-html` (Phase 24 req 2), gated by the
 *     `unsafeHtmlUsed` flag. Components that do NOT use `r-html` never import
 *     `lit/directives/unsafe-html.js`; for all other template expressions
 *     lit-html's `html`` auto-escape remains the only escaping surface.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import {
  deconflictReservedComputedInjectNames,
  reservedClassMembers,
} from '../../../core/src/rewrite/deconflict.js';
// NOTE: SourceMap import removed (WR-08); EmitLitResult.map is null until Phase 7.
import {
  LitImportCollector,
  LitDecoratorImportCollector,
  PreactSignalsImportCollector,
  RuntimeLitImportCollector,
  LitContextImportCollector,
} from './rewrite/collectLitImports.js';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitSlotDecl } from './emit/emitSlotDecl.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { emitTagName, toKebabCase } from './emit/emitDecorator.js';
import { computeScopeHash } from './emit/scopeHash.js';

export interface EmitLitOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available.
   */
  blockOffsets?: BlockMap;
}

export interface EmitLitResult {
  code: string;
  /**
   * WR-08: Source map is always null in v1. `composeSourceMap` in
   * `packages/targets/lit/src/sourcemap/compose.ts` is implemented but not
   * wired — it is dead code until Phase 7 connects it here.
   * TODO(Phase 7): wire composeSourceMap here and emit base64 sourceMappingURL
   * trailer (matching the Angular path in emitRozieTsToDisk).
   */
  map: null;
  diagnostics: Diagnostic[];
}

export function emitLit(ir: IRComponent, opts: EmitLitOptions = {}): EmitLitResult {
  const litImports = new LitImportCollector();
  const decoratorImports = new LitDecoratorImportCollector();
  const signalsImports = new PreactSignalsImportCollector();
  const runtimeImports = new RuntimeLitImportCollector();
  // Phase 36 (R10) — `@lit/context` imports for the cross-component context
  // primitive. Rendered ONLY when emitScript's emitContext adds symbols (i.e.
  // the component has `$provide`/`$inject`) — byte-identical otherwise.
  const contextImports = new LitContextImportCollector();

  // Every Lit class extends SignalWatcher(LitElement); always needs these.
  litImports.add('LitElement');
  litImports.add('html');
  signalsImports.add('SignalWatcher');
  decoratorImports.add('customElement');

  const diagnostics: Diagnostic[] = [];

  // Phase 07.6 — producer-side CSS scope token. Derived the same way as
  // react/solid (basename + componentName via FNV-1a-32) so the hash is
  // stable across the four emit entrypoints (compile / CLI / babel / unplugin)
  // and dist-parity strict-bytes assertions don't drift.
  const scopeHash = computeScopeHash(ir.name, opts.filename);

  // Modifier registry — caller may pass a shared registry (tests / unplugin
  // layer); otherwise construct a fresh default registry per call. Mirrors
  // emitVue's pattern. emitListeners requires a non-optional registry for
  // its Plan 07.1-02 registry-driven modifier dispatch.
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // 0. Reserved-member deconfliction for `$computed` names + `$inject` local
  //    bindings (Phase 61 Plan 03 — SC-2, R-NEW-1 + R-NEW-5). Both become PUBLIC
  //    class members on the Lit class (a `$computed` → `get X()` getter; a
  //    `$inject` local → a `get X()` ContextConsumer read accessor). When that
  //    name is a reserved class member (inherited HTMLElement/Element/Node member,
  //    `Object.prototype`, or a Lit lifecycle name) the getter SHADOWS the
  //    inherited member → gate-3 TS2611/TS2416. These names are INTERNAL
  //    (template/method-referenced, never consumer-facing), so we auto-rename them
  //    to `X$local` at the IR level BEFORE any emitter reads them — this is the
  //    only site that fixes BOTH the getter emission AND the template-binding
  //    propagation in one shot (the per-target program-clone rename in
  //    rewriteScript cannot, because the getter + template sites read the name
  //    back from the IR, not from the clone). Lit-only: each `compile()` lowers a
  //    fresh IR per target, so mutating THIS IR never leaks to the other five.
  //    Only-on-collision: a non-reserved computed/inject name is byte-identical.
  //    Public-contract names (props / $expose verbs) are never renamed (D-02).
  deconflictReservedComputedInjectNames(
    ir,
    reservedClassMembers('lit'),
    new Set<string>([
      ...(ir.expose ?? []).map((e) => e.name),
      ...ir.props.map((p) => p.name),
    ]),
  );

  // 1. Slot declarations — must come early because emitTemplate may reference slot fields.
  const slotResult = emitSlotDecl(ir, { decorators: decoratorImports });
  diagnostics.push(...slotResult.diagnostics);

  // 2. Style emission.
  const styleResult = emitStyle(ir.styles, opts.source ?? '', {
    componentName: ir.name,
    lit: litImports,
    runtime: runtimeImports,
    scopeHash,
  });
  diagnostics.push(...styleResult.diagnostics);

  // 3. Script emission (props, state, refs, computed, lifecycle, user methods).
  // Spike 004 — reuse the per-component `scopeHash` for the `@portal` closure
  // setAttribute so it matches the emitted `@portal` CSS selectors.
  const scriptResult = emitScript(ir, {
    decorators: decoratorImports,
    signals: signalsImports,
    runtime: runtimeImports,
    lit: litImports,
    context: contextImports,
    portalScopeHash: scopeHash,
  });
  diagnostics.push(...scriptResult.diagnostics);

  // 4. Listeners emission (returns firstUpdated body + cleanup pushes).
  const listenersResult = emitListeners(ir, {
    decorators: decoratorImports,
    runtime: runtimeImports,
    lit: litImports,
  }, registry);
  diagnostics.push(...listenersResult.diagnostics);

  // 5. Template emission (returns html`...` body + hostListenerWiring lines).
  //    Thread the shared modifier registry so buildEventParts can
  //    registry-dispatch template-event modifiers (Plan 07.1-03).
  const templateResult = emitTemplate(ir, {
    lit: litImports,
    decorators: decoratorImports,
    runtime: runtimeImports,
    modifierRegistry: registry,
    scopeHash,
  });
  diagnostics.push(...templateResult.diagnostics);

  // Plan 14-05 / D-02 — register the `rozieSpread` directive import from
  // `@rozie/runtime-lit` when emitTemplate lowered at least one `spreadBinding`
  // via `${rozieSpread(<expr>)}`. The runtimeImports collector renders the
  // single import line; mirrors the styleMap/repeat conditional pattern.
  if (templateResult.rozieSpreadUsed) {
    runtimeImports.add('rozieSpread');
  }

  // Plan 15-05 / D-12 — register the `rozieListeners` AsyncDirective import
  // from `@rozie/runtime-lit` when emitTemplate lowered at least one dynamic
  // `ListenerSpreadIR` via `${rozieListeners(<expr>)}`. Mirrors the rozieSpread
  // conditional plumbing above. The directive extends `AsyncDirective` (NOT
  // regular `Directive`) so `disconnected()` removes listeners on element
  // disposal (T-15-V5-04 leak defense — Pitfall 7 / A2 LOCKED).
  if (templateResult.rozieListenersUsed) {
    runtimeImports.add('rozieListeners');
  }

  // Item 3 (engine-CSS shadow bridge) — register the `adoptDocumentStyles`
  // import when the `<rozie adopt-document-styles>` envelope attr is set; the
  // call is emitted into firstUpdated() (composeClassBody). Mirrors the
  // rozieSpread/rozieListeners conditional-import plumbing.
  if (ir.adoptDocumentStyles) {
    runtimeImports.add('adoptDocumentStyles');
  }

  // Plan 14-05 — `$attrs` getter for Lit. Lit has no native template-side
  // `$attrs` proxy (cf. Vue's magic accessor); the consumer's attributes land
  // on the host custom element (`<rozie-foo id="x">`) and we re-project them
  // onto the TEMPLATE-ROOT element (CONTEXT.md A1) via `${rozieSpread($attrs)}`.
  // Synthesise a getter that reads `this.attributes` on each call so a
  // consumer-side bound attribute (`?disabled=${...}`) flows through on the
  // next render. Emitted whenever at least one `spreadBinding` was lowered —
  // either via auto-fallthrough synthesis OR via an explicit author-written
  // `r-bind="$attrs"` (Phase 14.1 WR-fix: `inherit-attrs="false"` only opts
  // out of auto-fallthrough; it must not strip the getter when the author
  // references `$attrs` manually, otherwise the `${rozieSpread(this.$attrs)}`
  // call site would resolve `this.$attrs` to `undefined` and the directive
  // would throw at render time, aborting the lit-html render and leaving the
  // shadow root empty).
  //
  // Phase 15 follow-up Bug A — filter declared-prop attribute names out of the
  // `$attrs` getter result so it returns "rest after declared props" (semantic
  // parity with React/Vue/Svelte/Solid/Angular). Without this filter the
  // ${rozieSpread(this.$attrs)} call duplicates every reflected `@property`
  // attribute (`value`, `step`, `min`, `max`, etc.) onto the inner template
  // root, breaking consumers that rely on element uniqueness.
  //
  // Both attribute-name forms are folded into the skip set so the filter
  // catches the two Lit attribute-naming paths:
  //   - model props: explicit `attribute: '${toKebabCase(propName)}'`
  //   - non-model props: Lit's default = property name lowercased
  // For single-word props the two forms collapse to the same string; for
  // multi-word props (e.g. `onClick`) we skip both `on-click` AND `onclick`.
  // Empty-prop components fall through to the no-skip fast path so existing
  // dist-parity fixtures with zero declared props (e.g. ROnProbe) stay
  // byte-identical to the pre-fix output.
  const declaredAttrSkipNames = Array.from(
    new Set(
      ir.props.flatMap((p) => [toKebabCase(p.name), p.name.toLowerCase()]),
    ),
  ).filter((n) => n.length > 0);
  const litAttrsGetter =
    templateResult.rozieSpreadUsed
      ? (declaredAttrSkipNames.length > 0
          ? [
              '  /**',
              '   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the',
              '   * host custom element\'s attributes on each call so a consumer-side bound',
              '   * attribute flows through on every render. The `rozieSpread` directive',
              '   * (D-02) does the cross-render diff downstream.',
              '   *',
              '   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered',
              '   * out so `$attrs` returns "rest after declared props" (semantic parity',
              '   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming',
              '   * forms are folded into the skip set: kebab-case for model props',
              '   * (explicit `attribute:`) AND lowercased property name (Lit\'s default).',
              '   */',
              '  private get $attrs(): Record<string, string> {',
              `    const __skip = new Set<string>([${declaredAttrSkipNames.map((n) => `'${n}'`).join(', ')}]);`,
              '    const out: Record<string, string> = {};',
              '    for (const a of Array.from(this.attributes)) {',
              '      if (__skip.has(a.name)) continue;',
              '      out[a.name] = a.value;',
              '    }',
              '    return out;',
              '  }',
            ].join('\n')
          : [
              '  /**',
              '   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the',
              '   * host custom element\'s attributes on each call so a consumer-side bound',
              '   * attribute flows through on every render. The `rozieSpread` directive',
              '   * (D-02) does the cross-render diff downstream.',
              '   */',
              '  private get $attrs(): Record<string, string> {',
              '    const out: Record<string, string> = {};',
              '    for (const a of Array.from(this.attributes)) out[a.name] = a.value;',
              '    return out;',
              '  }',
            ].join('\n'))
      : '';

  // Phase 15 D-19 — `$listeners` magic-accessor declaration for Lit.
  //
  // Lit custom-element consumers attach event listeners via
  // `addEventListener` from OUTSIDE the element (a `<my-elem
  // @click=${...}>` lit-html binding compiles to an addEventListener on the
  // host element). Unlike React/Solid/Vue/Svelte's props rest binding, Lit
  // has no per-instance bag of "consumer-passed listeners" — the bare
  // `$listeners` Identifier in the synthesized auto-fallthrough lowers to
  // undefined at render time, and the `rozieListeners` directive's nullish
  // coercion (`obj ?? {}`) handles undefined as a clean no-op.
  //
  // Without this declaration, TS reports TS2304 (Cannot find name
  // '$listeners') on every default-fallthrough single-root component when
  // the typed-fixture lit-typecheck gate runs `tsc --noEmit`. The
  // dist-parity byte-equality gate doesn't tsc-check the emit so the bug
  // hid until the consumer-side typecheck gate caught it.
  //
  // Synthesise the getter whenever `rozieListenersUsed` is true — covers
  // both the synthesized auto-fallthrough push (which emits a bare
  // `$listeners` Identifier in the spread expression) AND author-written
  // `r-on="$listeners"`. Dynamic `r-on="someObj"` does NOT trigger the
  // getter (its emit shape is `${rozieListeners(this.someObj)}` — no
  // bare `$listeners` reference).
  const litListenersGetter =
    templateResult.rozieListenersUsed
      ? [
          '  /**',
          '   * Phase 15 D-19 — consumer-passed listener cluster placeholder.',
          '   * Lit attaches event listeners directly on the host element via',
          '   * `addEventListener` (no per-instance prop rest binding), so the',
          '   * runtime value is undefined; the `rozieListeners` directive\'s',
          '   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.',
          '   * The declaration exists to satisfy `tsc --noEmit` on consumer',
          '   * projects with strict mode — bare `$listeners` in `render()`',
          '   * would otherwise raise TS2304 (Cannot find name).',
          '   */',
          '  private get $listeners(): Record<string, EventListener> | undefined {',
          '    return undefined;',
          '  }',
        ].join('\n')
      : '';

  // 6. Compose class body.
  // Insertion order:
  //   - static styles field
  //   - @property/@state fields + signal fields
  //   - @query / @queryAssignedElements fields
  //   - private _disconnectCleanups: Array<() => void> = [];
  //   - constructor(): forwards to super (Lit handles attribute reflection).
  //   - firstUpdated(): listeners + outside + slotchange wiring + host listeners
  //   - disconnectedCallback(): drains _disconnectCleanups, runs $onUnmount hooks
  //   - updated(): runs $onUpdate hooks
  //   - render(): returns html``
  //   - user methods (rewritten from <script>)
  //   - attributeChangedCallback (for model props)
  // D-SH-02: separate the re-armable listener wiring (addEventListener,
  // outside-click, slotchange, host listeners — all push to
  // _disconnectCleanups, all drained on disconnect) from the user `$onMount`
  // hook body (mount-once semantics — must NOT re-run on reconnect). The
  // listener wiring goes into `_armListeners()`, called from `firstUpdated()`
  // the first time AND from `connectedCallback()` on every subsequent connect;
  // the `$onMount` body stays first-render-only in `firstUpdated()`.
  const listenerWiring = combineListenerWiring(
    listenersResult.firstUpdatedBody,
    templateResult.hostListenerWiring,
    slotResult.slotChangeWiring,
  );
  // Phase 07.3.1 Blocker #3 (D-03) — compose the consumer-side slot-filler
  // updated() re-attempt fragment with the user $onUpdate hook body so both
  // surface inside the single emitted `updated()` method. The slot-filler
  // re-attempt runs FIRST so a successful retry's `requestUpdate()` is
  // observed by user hooks on the very next update cycle.
  const slotFillerUpdatedBody = templateResult.slotFillerUpdatedBody.join('\n');
  const composedUpdatedBody = [
    slotFillerUpdatedBody,
    scriptResult.updateHookBody,
  ].filter((s) => s.trim().length > 0).join('\n\n');

  const classBody = composeClassBody({
    staticStylesField: styleResult.staticStylesField,
    fieldDecls: scriptResult.fieldDecls,
    debouncedFieldDecls: templateResult.debouncedFieldDecls.join('\n'),
    hoistedLiteralFieldDecls: templateResult.hoistedLiteralFieldDecls.join('\n'),
    slotFillerClassFields: templateResult.slotFillerClassFields
      .map((f) => '  ' + f)
      .join('\n'),
    slotFields: slotResult.fields,
    cleanupField:
      '  private _disconnectCleanups: Array<() => void> = [];\n' +
      '  // Re-parenting guard: set true once the deferred teardown has actually\n' +
      '  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.\n' +
      '  private _rozieTornDown = false;',
    // `r-external` engine-wrapper marker — `_rozieReconcileSeq` is the
    // cache-invalidation counter consumed by `keyed(seq, …)` wrappers
    // emitted around marked-element children. Bumped by
    // `__rozieReconcileAfterDomMutation`; declared ONLY when the template
    // actually uses an `r-external` marker so unmarked components stay
    // byte-identical to the pre-change emit. Emitted WITHOUT `private` so the
    // component instance satisfies the runtime `ReconcilableHost` interface
    // (TS forbids a `private` member from satisfying an interface member);
    // surfaced by the @rozie-ui/sortable-list-lit strict typecheck gate.
    reconcileSeqField: templateResult.keyedUsed
      ? '  _rozieReconcileSeq = 0;'
      : '',
    listenerWiringBody: listenerWiring,
    mountHookBody: scriptResult.mountHookBody,
    adoptDocumentStyles: ir.adoptDocumentStyles,
    disconnectedBody: scriptResult.unmountHookBody,
    slotFillerDisconnectReset: templateResult.slotFillerDisconnectReset.join('\n'),
    updatedBody: composedUpdatedBody,
    renderBody: templateResult.renderBody,
    userMethods: [scriptResult.methodDecls, litAttrsGetter, litListenersGetter]
      .filter((s) => s.trim().length > 0)
      .join('\n\n'),
    attributeChangedBody: scriptResult.attributeChangedBody,
    // Phase 07.3.1 D-LIT-15 — light-DOM pre-seed of `_hasSlot<X>` so the very
    // first render reflects consumer fill presence and conditionally-rendered
    // slot wrappers are not deadlocked.
    slotPreSeedLines: slotResult.preSeedLines,
  });

  // 7. Component side-effect imports for cross-component composition (D-LIT).
  // Filter out self-references — class self-registers via @customElement decorator.
  const components = ir.components ?? [];
  const componentImportsBlock = buildComponentImportsBlock(components, ir.name);

  // 8. Build shell.
  const allImports = [
    litImports.render(),
    decoratorImports.render(),
    signalsImports.render(),
    runtimeImports.render(),
    // Phase 36 (R10) — `@lit/context` import line; empty (and thus dropped by
    // the `.filter` below) when the component has no `$provide`/`$inject`.
    contextImports.render(),
    // CR-06 fix: read repeatUsed from templateResult instead of module-level singleton.
    templateResult.repeatUsed ? `import { repeat } from 'lit/directives/repeat.js';\n` : '',
    // Quick-task 260518-e2t (Spike 004 Lit subset) — conditional styleMap
    // import. Threaded the SAME way as `repeat`: emitTemplate marks
    // `styleMapUsed` on EmitTemplateResult when any literal-object `:style`
    // was lowered via styleMap(); we add the side-effect-free value import
    // only when actually used, so unused-import noise is avoided.
    templateResult.styleMapUsed ? `import { styleMap } from 'lit/directives/style-map.js';\n` : '',
    // Phase 07.6 — consumer-side property-fill bridge (see
    // emitTemplate's `refUsed` plumbing). When any property-fill is emitted
    // onto a producer component's open tag, we wrap that tag with a `ref()`
    // directive that propagates the consumer's stylesheets across the
    // producer's shadow boundary via `adoptedStyleSheets`. Same conditional
    // pattern as `repeat`/`styleMap`.
    templateResult.refUsed ? `import { ref } from 'lit/directives/ref.js';\n` : '',
    // `r-external` engine-wrapper marker — when at least one marked element
    // was emitted, wire `import { keyed } from 'lit/directives/keyed.js';`.
    // `keyed(this._rozieReconcileSeq ?? 0, …)` lets
    // `__rozieReconcileAfterDomMutation` (runtime helper) dispose stale
    // child DOM via a seq bump while preserving the marked element itself,
    // so third-party DOM-mutating engines (SortableJS, TipTap, …) stay
    // attached across reconciliations.
    templateResult.keyedUsed ? `import { keyed } from 'lit/directives/keyed.js';\n` : '',
    // Phase 24 (req 2) — conditional `unsafeHTML` import. emitTemplate marks
    // `unsafeHtmlUsed` on EmitTemplateResult when any `r-html` was lowered to
    // `${unsafeHTML(<expr>)}`. `lit/directives/unsafe-html.js` is a subpath of
    // the already-present `lit` dependency — no new package. Threaded the SAME
    // way as `keyed`/`repeat` (concurrency-safe — read off templateResult, no
    // module singleton).
    templateResult.unsafeHtmlUsed ? `import { unsafeHTML } from 'lit/directives/unsafe-html.js';\n` : '',
  ].filter((s) => s.length > 0).join('');

  // Phase 9 Plan 09-04 — author-declared `<script lang="ts">` `interface`/`type`
  // declarations (hoisted out of the class body by emitScript) are emitted at
  // MODULE scope, above the class. They go FIRST so user-authored types read at
  // the top of the file; the synthesized per-slot context interfaces follow.
  // Both share the shell's `interfaceDecls` bucket. `hoistedTypeDecls` is empty
  // for an untyped `<script>`, so untyped emit stays byte-identical.
  const moduleScopeDecls = [
    ...scriptResult.hoistedTypeDecls,
    // Phase 36 (R10) — module-scope `const __rozieCtx_<key> =
    // createContext(Symbol.for('rozie:<key>'));` decls. They sit above the class
    // so a provider + an in-module consumer over the same key share one context
    // object. Empty (no entries) for a non-context component (byte-identical).
    ...scriptResult.moduleContextDecls,
    ...slotResult.ctxInterfaces,
  ];

  const shell = buildShell({
    importLines: allImports,
    componentImportsBlock,
    userImports: scriptResult.userImports,
    interfaceDecls: moduleScopeDecls,
    customElementDecorator: `@customElement('${emitTagName(ir.name)}')`,
    componentName: ir.name,
    baseClassExpression: 'SignalWatcher(LitElement)',
    classBody,
    globalStyleIife: styleResult.globalStyleCall,
    rozieSource: opts.source ?? '',
    blockOffsets: opts.blockOffsets ?? {},
  });

  return {
    code: shell.ms.toString(),
    map: null,
    diagnostics,
  };
}

/**
 * D-SH-02: combine the re-armable listener wiring (listeners, host listeners,
 * slotchange) — but NOT the `$onMount` hook body, which has mount-once
 * semantics and must stay first-render-only. The combined body is emitted into
 * a private `_armListeners()` method that both `firstUpdated()` and
 * `connectedCallback()` (on reconnect) call.
 */
function combineListenerWiring(
  listenerWiring: string,
  hostListenerWiring: string[],
  slotChangeWiring: string,
): string {
  const parts: string[] = [];
  if (listenerWiring.trim().length > 0) parts.push(listenerWiring);
  for (const wiring of hostListenerWiring) {
    if (wiring.trim().length > 0) parts.push(wiring);
  }
  if (slotChangeWiring.trim().length > 0) parts.push(slotChangeWiring);
  return parts.join('\n\n');
}

interface ComposeClassBodyParts {
  staticStylesField: string;
  fieldDecls: string;
  /**
   * Class-field declarations for template-event `.debounce`/`.throttle`
   * wrappers (WR-15). Emitted alongside the other field decls so the wrapper
   * identity is stable across render() calls.
   */
  debouncedFieldDecls: string;
  /**
   * Item 1 (pure-literal component-prop hoist) — per-instance class-field
   * declarations for inline Array/Object literals bound to a child component
   * prop, hoisted to render-stable fields (breaks the Lit `model:true`
   * reference-equality re-dispatch loop). Empty string when none were hoisted
   * (byte-identical to pre-change output).
   */
  hoistedLiteralFieldDecls: string;
  /**
   * Phase 07.2 Plan 03 — class-field declarations storing captured scoped-
   * slot fill ctx (e.g. `private _headerCtx?: { close: unknown };`). Spliced
   * in alongside the other field decls so firstUpdated()'s
   * observeRozieSlotCtx callback can assign into them.
   */
  slotFillerClassFields: string;
  slotFields: string;
  cleanupField: string;
  /**
   * `r-external` engine-wrapper marker — class-field decl for the seq
   * counter consumed by emitted `keyed(seq, …)` wrappers. Empty string
   * when no `r-external` is in use (no field emitted, byte-identical to
   * pre-change output).
   */
  reconcileSeqField: string;
  /**
   * D-SH-02: re-armable listener wiring (listeners + host listeners +
   * slotchange). Emitted into `_armListeners()`, called from `firstUpdated()`
   * and from `connectedCallback()` on reconnect.
   */
  listenerWiringBody: string;
  /** User `$onMount` hook body — mount-once, stays in `firstUpdated()`. */
  mountHookBody: string;
  /**
   * Item 3 (engine-CSS shadow bridge) — `true` when `<rozie
   * adopt-document-styles>` is set. Emits `adoptDocumentStyles(this);` as the
   * FIRST statement in `firstUpdated()` (before the user $onMount builds the
   * engine), so the cloned document stylesheets are present when the engine's
   * shadow DOM is created. `false` → no firstUpdated change (byte-identical).
   */
  adoptDocumentStyles: boolean;
  disconnectedBody: string;
  /**
   * Phase 07.3.1 Blocker #3 (D-03, Landmine 2) — per-filler
   * `_slotCtxWired_<name>` flag reset lines appended to
   * `disconnectedCallback()` AFTER the `_disconnectCleanups` drain so a
   * re-mount cycle re-attempts wiring cleanly.
   */
  slotFillerDisconnectReset: string;
  updatedBody: string;
  renderBody: string;
  userMethods: string;
  attributeChangedBody: string;
  /**
   * Phase 07.3.1 D-LIT-15 — pre-seed assignments threaded from emitSlotDecl.
   * Spliced inside `connectedCallback()` BEFORE `super.connectedCallback();`
   * so the first render reflects actual consumer fill presence. Empty string
   * when the component has no slots.
   */
  slotPreSeedLines: string;
}

function composeClassBody(parts: ComposeClassBodyParts): string {
  const sections: string[] = [];

  if (parts.staticStylesField.trim().length > 0) {
    sections.push(parts.staticStylesField);
  }
  if (parts.fieldDecls.trim().length > 0) {
    sections.push(parts.fieldDecls);
  }
  if (parts.debouncedFieldDecls.trim().length > 0) {
    sections.push(parts.debouncedFieldDecls);
  }
  if (parts.hoistedLiteralFieldDecls.trim().length > 0) {
    sections.push(parts.hoistedLiteralFieldDecls);
  }
  if (parts.slotFillerClassFields.trim().length > 0) {
    sections.push(parts.slotFillerClassFields);
  }
  if (parts.slotFields.trim().length > 0) {
    sections.push(parts.slotFields);
  }
  sections.push(parts.cleanupField);
  if (parts.reconcileSeqField.trim().length > 0) {
    sections.push(parts.reconcileSeqField);
  }

  const hasListenerWiring = parts.listenerWiringBody.trim().length > 0;
  const hasMountHook = parts.mountHookBody.trim().length > 0;
  const hasSlotPreSeed = parts.slotPreSeedLines.trim().length > 0;

  // D-SH-02: re-armable listener wiring lives in `_armListeners()`, called
  // from `firstUpdated()` (first render) AND `connectedCallback()` (reconnect).
  // `disconnectedCallback()` already drains `_disconnectCleanups`, so a
  // disconnect → reconnect cycle now correctly RE-ARMS every listener instead
  // of leaving the element with zero listeners.
  if (hasListenerWiring) {
    sections.push(
      [
        '  private _armListeners(): void {',
        indent(parts.listenerWiringBody, 4),
        '  }',
      ].join('\n'),
    );
  }

  // connectedCallback is emitted whenever there is listener wiring (for the
  // reconnect re-arm path) OR pre-seed lines (Phase 07.3.1 D-LIT-15 — the
  // pre-seed runs on EVERY connect so re-mount cycles also see correct
  // initial slot presence). The two surfaces compose: pre-seed lines run
  // first (so `super.connectedCallback()` and downstream reactive updates see
  // the seeded state), then super, then re-arm.
  if (hasListenerWiring || hasSlotPreSeed) {
    const ccParts: string[] = [];
    if (hasSlotPreSeed) {
      // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first
      // render isn't deadlocked.
      ccParts.push(
        '    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn\'t deadlocked.',
      );
      ccParts.push('    ' + parts.slotPreSeedLines);
    }
    ccParts.push('    super.connectedCallback();');
    if (hasListenerWiring) {
      // Re-arm only after a genuine un-mount actually tore listeners down. A
      // bare re-parent (DOM move) leaves them attached — the deferred teardown
      // saw the reconnect and skipped — so re-arming there would double them.
      ccParts.push(
        '    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }',
      );
    }
    sections.push(
      ['  connectedCallback(): void {', ...ccParts, '  }'].join('\n'),
    );
  }

  // firstUpdated(): first-render document-style adoption + listener arming +
  // user $onMount hooks (the latter mount-once — never re-run on reconnect).
  if (hasListenerWiring || hasMountHook || parts.adoptDocumentStyles) {
    const firstUpdatedParts: string[] = [];
    // Item 3 — adopt document stylesheets into the shadow root FIRST, before
    // the engine builds its shadow DOM in the $onMount hook, so the engine
    // chrome is styled the moment it appears.
    if (parts.adoptDocumentStyles)
      firstUpdatedParts.push('adoptDocumentStyles(this);');
    if (hasListenerWiring) firstUpdatedParts.push('this._armListeners();');
    if (hasMountHook) firstUpdatedParts.push(parts.mountHookBody);
    sections.push(
      [
        '  firstUpdated(): void {',
        indent(firstUpdatedParts.join('\n\n'), 4),
        '  }',
      ].join('\n'),
    );
  }

  if (parts.updatedBody.trim().length > 0) {
    sections.push(
      [
        '  updated(changedProperties: Map<string, unknown>): void {',
        indent(parts.updatedBody, 4),
        '  }',
      ].join('\n'),
    );
  }

  // Always emit disconnectedCallback to drain cleanup pushes; even if no
  // user $onUnmount hooks exist, listeners often push cleanups.
  // Teardown body — the actual resource disposal. Deferred to a microtask
  // (below) so a re-parent survives. `super.disconnectedCallback()` still runs
  // synchronously (Lit's own reactive bookkeeping must see the disconnect; a
  // synchronous reconnect re-establishes it via `super.connectedCallback()`).
  const teardownParts: string[] = [];
  teardownParts.push('this._rozieTornDown = true;');
  if (parts.disconnectedBody.trim().length > 0) {
    teardownParts.push(parts.disconnectedBody);
  }
  teardownParts.push('for (const fn of this._disconnectCleanups) fn();');
  teardownParts.push('this._disconnectCleanups = [];');
  // Phase 07.3.1 Blocker #3 (D-03, Landmine 2) — reset per-filler
  // `_slotCtxWired_<name>` flags after cleanup drain so a re-mount cycle
  // re-attempts wiring. Without this, a re-mounted consumer carries the
  // stale `true` flag and skips both the microtask retry and the
  // `updated()` re-attempt forever.
  if (parts.slotFillerDisconnectReset.trim().length > 0) {
    teardownParts.push(parts.slotFillerDisconnectReset);
  }
  // Re-parenting survival: a DOM move (SortableJS reordering a nested list, a
  // node hopping containers) fires disconnectedCallback THEN a synchronous
  // connectedCallback. Draining teardown synchronously would destroy live
  // resources the immediate reconnect relies on — event listeners, $watch
  // effects, a wrapped SortableJS instance; tearing down a nested SortableJS
  // mid-drag even nulls SortableJS's shared drag globals and crashes the
  // ancestor drag. Defer the drain and skip it when the element has reconnected
  // by then (it was only moved); a genuine un-mount stays disconnected and
  // tears down one microtask later.
  const disconnectParts: string[] = [
    'super.disconnectedCallback();',
    'queueMicrotask(() => {',
    '  if (this.isConnected || this._rozieTornDown) return;',
    indent(teardownParts.join('\n'), 2),
    '});',
  ];
  sections.push(
    [
      '  disconnectedCallback(): void {',
      indent(disconnectParts.join('\n'), 4),
      '  }',
    ].join('\n'),
  );

  if (parts.attributeChangedBody.trim().length > 0) {
    sections.push(
      [
        '  attributeChangedCallback(name: string, old: string | null, value: string | null): void {',
        '    super.attributeChangedCallback(name, old, value);',
        indent(parts.attributeChangedBody, 4),
        '  }',
      ].join('\n'),
    );
  }

  // render() always present.
  sections.push(
    [
      '  render() {',
      `    return html\`${parts.renderBody}\`;`,
      '  }',
    ].join('\n'),
  );

  if (parts.userMethods.trim().length > 0) {
    sections.push(parts.userMethods);
  }

  return sections.join('\n\n');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

function buildComponentImportsBlock(
  components: ReadonlyArray<{ localName: string; importPath: string }>,
  selfName: string,
): string | undefined {
  if (components.length === 0) return undefined;
  const lines: string[] = [];
  for (const decl of components) {
    if (decl.localName === selfName) continue; // self-registers via @customElement
    // Side-effect-only import: the imported module's @customElement decorator
    // runs at module load and registers `customElements.define(tag, Class)`.
    // No symbol bind — the parent template references the registered tag.
    lines.push(`import '${decl.importPath}';`);
  }
  if (lines.length === 0) return undefined;
  return lines.join('\n') + '\n';
}
