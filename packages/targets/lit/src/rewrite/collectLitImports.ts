/**
 * Collect lit + lit/decorators.js + @lit-labs/preact-signals + @rozie/runtime-lit
 * imports needed by emitted code.
 *
 * Mirrors the three-builder pattern of @rozie/target-angular's
 * collectAngularImports — except Lit splits its imports across THREE source
 * packages: `lit` (value imports of `LitElement` / `html` / `css` / `nothing`),
 * `lit/decorators.js` (decorator imports — `customElement`, `property`,
 * `state`, `query`, `queryAssignedElements`), and `@lit-labs/preact-signals`
 * (the `SignalWatcher` mixin + `signal` / `computed` / `effect`). A fourth
 * builder tracks `@rozie/runtime-lit` runtime helpers.
 *
 * P1 stub: collectors accept `add(name)` and `render()` returning a single
 * sorted import statement per source. P2 wires up which symbols are added
 * for each emit step.
 *
 * @experimental — shape may change before v1.0
 */

export type LitImport =
  | 'LitElement'
  | 'html'
  | 'css'
  | 'nothing'
  | 'render'
  | 'svg'
  | 'PropertyValues';

export class LitImportCollector {
  private symbols = new Set<LitImport>();

  add(name: LitImport): void {
    this.symbols.add(name);
  }

  has(name: LitImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'lit';\n`;
  }
}

export type LitDecoratorImport =
  | 'customElement'
  | 'property'
  | 'state'
  | 'query'
  | 'queryAsync'
  | 'queryAssignedElements'
  // D-LIT-14 (2026-05-13 correction): queryAssignedNodes is intentionally
  // EXCLUDED from this union — whitespace text-nodes between elements yield
  // false-positive presence detection, breaking $slots.X presence checks.
  // Always use queryAssignedElements with `flatten: true` instead.
  | 'eventOptions';

export class LitDecoratorImportCollector {
  private symbols = new Set<LitDecoratorImport>();

  add(name: LitDecoratorImport): void {
    this.symbols.add(name);
  }

  has(name: LitDecoratorImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'lit/decorators.js';\n`;
  }
}

export type PreactSignalsImport =
  | 'SignalWatcher'
  | 'signal'
  | 'computed'
  | 'effect'
  /**
   * Bug B fix (260519 linechart-watch-recreate): `untracked` — wraps the
   * effect-route $watch callback so its reactive reads (and transitive helper
   * reads) don't join the `effect()` dependency set. `@lit-labs/preact-signals`
   * re-exports `untracked` via `export * from '@preact/signals-core'`.
   */
  | 'untracked'
  | 'batch';

export class PreactSignalsImportCollector {
  private symbols = new Set<PreactSignalsImport>();

  add(name: PreactSignalsImport): void {
    this.symbols.add(name);
  }

  has(name: PreactSignalsImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@lit-labs/preact-signals';\n`;
  }
}

export type RuntimeLitImport =
  | 'createLitControllableProperty'
  | 'observeRozieSlotCtx'
  | 'attachOutsideClickListener'
  | 'injectGlobalStyles'
  | 'adoptConsumerStyles'
  // Item 3 (engine-CSS shadow bridge) — `adoptDocumentStyles` clones the
  // document's same-origin stylesheets into the shadow root. Added by emitLit
  // conditionally when the `<rozie adopt-document-styles>` envelope attr is set.
  | 'adoptDocumentStyles'
  | 'debounce'
  | 'throttle'
  /**
   * Plan 14-05 / D-02 — `rozieSpread` lit-html element-position directive,
   * shipped from `@rozie/runtime-lit`. Added by emitLit conditionally when
   * `EmitTemplateResult.rozieSpreadUsed` is true (i.e., at least one
   * `r-bind`/`$attrs` `spreadBinding` was lowered to `${rozieSpread(...)}`).
   */
  | 'rozieSpread'
  /**
   * Plan 15-05 / D-12 — `rozieListeners` lit-html element-position
   * AsyncDirective, shipped from `@rozie/runtime-lit`. Added by emitLit
   * conditionally when `EmitTemplateResult.rozieListenersUsed` is true (i.e.,
   * at least one `r-on`/`$listeners` `ListenerSpreadIR` was lowered to
   * `${rozieListeners(...)}`). Extends `AsyncDirective` (NOT regular
   * `Directive` — Pitfall 7 / A2 LOCKED) so `disconnected()` removes every
   * attached listener (T-15-V5-04 leak defense).
   */
  | 'rozieListeners'
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
  | '__rozieReconcileAfterDomMutation'
  /**
   * Phase 26 (D-01/D-06) — portable display helper, shipped from
   * `@rozie/runtime-lit`. Added by the template emitters ONLY when a
   * `wrapForDisplay` interpolation actually wraps, so a primitive-only
   * component's `@rozie/runtime-lit` import line stays byte-identical to
   * pre-phase (SPEC-3). A non-primitive value renders portable pretty-printed
   * JSON instead of lit-html's `[object Object]` auto-coercion.
   */
  | 'rozieDisplay'
  /**
   * 260608-sya — attribute-position display helper, shipped from
   * `@rozie/runtime-lit`. Added by the attribute emitter ONLY on the wrapped
   * whole-value generic-attr binding branch. Returns lit's `nothing` sentinel
   * on a nullish value so the attribute is DROPPED (matching Vue's `:attr`
   * binding), instead of rendering `attr=""`.
   */
  | 'rozieAttr';

export class RuntimeLitImportCollector {
  private symbols = new Set<RuntimeLitImport>();

  add(name: RuntimeLitImport): void {
    this.symbols.add(name);
  }

  has(name: RuntimeLitImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@rozie/runtime-lit';\n`;
  }
}
