/**
 * ModifierRegistry — public extensibility surface for v1 (D-22 / D-22b).
 *
 * Per RESEARCH.md §"Modifier registry contract" lines 683-803 and ARCHITECTURE.md
 * §"Plugin extensibility for v1": this is the marquee public extensibility point.
 * Phase 4's React emitter is the dogfooding consumer that proves the SemVer-stable
 * shape frozen here.
 *
 * Per D-22 (NO module-import side effects): importing this module does NOT
 * register any modifiers. Consumers must explicitly construct a registry and
 * call `registerBuiltins(registry)` to populate the default set, OR build their
 * own registry from scratch using `registerModifier(...)`. This gives:
 *   - Tree-shaking-friendly imports
 *   - Each test gets a fresh registry (no shared global state)
 *   - Symmetric pattern for first-party builtins and third-party plugins
 */
import type { ModifierArg } from '../modifier-grammar/parseModifierChain.js';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

/**
 * Resolved modifier pipeline entry consumed by every target emitter.
 * Discriminator (`kind`) tells the emitter HOW to wire the modifier:
 *
 *   - 'listenerOption' — addEventListener option flag (capture/passive/once)
 *   - 'wrap'           — wrap the handler in a higher-order function
 *                        (debounce/throttle/outside)
 *   - 'filter'         — early-return guard or side-effect call before
 *                        invoking the handler (self/stop/prevent/key filters)
 *
 * Each emitter (Phase 3+) maps these target-agnostic instructions into
 * idiomatic per-target code.
 *
 * @public — SemVer-stable per D-22b. Frozen in Phase 2 Plan 02-04.
 */
export type ModifierPipelineEntry =
  | {
      kind: 'listenerOption';
      option: 'capture' | 'passive' | 'once';
      sourceLoc: SourceLoc;
    }
  | {
      kind: 'wrap';
      modifier: string;
      args: ModifierArg[];
      sourceLoc: SourceLoc;
    }
  | {
      kind: 'filter';
      modifier: string;
      args: ModifierArg[];
      sourceLoc: SourceLoc;
    };

/**
 * Context passed to ModifierImpl.resolve(). Provides the surrounding
 * `<listeners>` block vs `@event=` template binding distinction (some
 * modifiers behave differently — e.g., `.left` is a key when in
 * keydown context, a mouse-button when in click context) and the
 * source location of the parent modifier-chain for diagnostic anchoring.
 *
 * @public — SemVer-stable per D-22b.
 */
export interface ModifierContext {
  /** Where the modifier appears (for diagnostics + target-specific behavior). */
  source: 'listeners-block' | 'template-event';
  /** The event name (e.g., 'click' for `@click.outside(...)`). */
  event: string;
  sourceLoc: SourceLoc;
}

/**
 * VueEmissionDescriptor — D-40 tagged union returned by ModifierImpl.vue?(...)
 * for the Vue 3 target emitter (Phase 3+).
 *
 * - 'native' — pass through to Vue's native modifier syntax (.stop, .esc, etc.)
 *   The `token` is what Vue expects (NOT necessarily the Rozie modifier name —
 *   e.g. Rozie's `escape` maps to Vue's `esc` per vuejs.org event-modifiers).
 * - 'helper' — emit an import from `@rozie/runtime-vue` and a helper call.
 *   `listenerOnly: true` flags modifiers (only `.outside` in v1) that are
 *   only meaningful in <listeners> blocks; emitter rejects them on template @event.
 * - 'inlineGuard' — Plan 04-06 SemVer-additive amendment. Emit a code fragment
 *   inline in the synthesized handler body BEFORE the user handler runs.
 *   Mirrors ReactEmissionDescriptor.inlineGuard (Plan 04 / D-65). Used by
 *   third-party modifiers (MOD-05 swipe dogfood) that have no native Vue
 *   modifier representation. The `code` string is inserted verbatim;
 *   emitter MUST guarantee `e` is the bound event-arg name (Phase 3
 *   emitListeners + emitTemplateEvent normalise this — see Plan 04-06
 *   integration). NO Phase 3 builtin emits this kind, so the v1 Vue
 *   fixtures remain byte-identical post-extension. Example:
 *     { kind: 'inlineGuard', code: "if (e.key !== 'Tab') return;" }
 *
 * @public — SemVer-stable per D-22b. The `inlineGuard` case is additive in
 * Plan 04-06 — third-party plugins implementing both `vue?` and `react?` is
 * the MOD-05 acceptance via tests/plugins/swipe/.
 */
export type VueEmissionDescriptor =
  | { kind: 'native'; token: string }
  | {
      kind: 'helper';
      importFrom: '@rozie/runtime-vue';
      helperName: 'useOutsideClick' | 'debounce' | 'throttle';
      args: ModifierArg[];
      listenerOnly?: true;
    }
  | { kind: 'inlineGuard'; code: string };

/**
 * ReactEmissionDescriptor — D-65 tagged union returned by ModifierImpl.react?(...)
 * for the React 18+ target emitter (Phase 4+).
 *
 * Three discriminants (parallels VueEmissionDescriptor with one addition):
 *
 * - 'native' — addEventListener option flag (capture/passive/once). React has
 *   NO native modifier syntax (no .stop, .prevent, etc. on JSX events) — the
 *   only "native" pass-through is the addEventListener option flag set, used
 *   when emitting `addEventListener('click', h, { capture: true })`.
 *
 * - 'helper' — emit an import from `@rozie/runtime-react` and a helper call.
 *   Helpers are React hooks (useOutsideClick, useDebouncedCallback,
 *   useThrottledCallback) — NOT bare functions like the Vue side. React-side
 *   helpers manage their own useEffect lifecycle internally.
 *   `listenerOnly: true` flags modifiers (only `.outside` in v1) that are only
 *   meaningful in <listeners> blocks; emitter rejects them on template @event.
 *
 * - 'inlineGuard' — NEW vs Vue. Emit a code-fragment guard expression inline
 *   in the handler body, BEFORE the user handler runs. Used for filter-style
 *   modifiers that have no native React equivalent (.stop, .prevent, .self,
 *   key-filters .escape/.enter/.tab/etc.). The `code` string is inserted
 *   verbatim into the emitted .tsx; emitter MUST guarantee the surrounding
 *   handler has `(e)` as the event-arg name (Plan 04-03 emitTemplateEvent
 *   normalises this) so `e.stopPropagation()` / `e.key !== 'Escape'` etc.
 *   resolve. Example:
 *     { kind: 'inlineGuard', code: 'e.stopPropagation();' }
 *     { kind: 'inlineGuard', code: 'if (e.target !== e.currentTarget) return;' }
 *     { kind: 'inlineGuard', code: "if (e.key !== 'Escape') return;" }
 *
 * SemVer-stable v1 per D-22b. Phase 4 freezes the registry shape; third-party
 * plugins implementing both `vue?` and `react?` is the MOD-05 acceptance via
 * tests/plugins/swipe/.
 *
 * @public — SemVer-stable per D-22b.
 */
export type ReactEmissionDescriptor =
  | { kind: 'native'; token: 'capture' | 'passive' | 'once' }
  | {
      kind: 'helper';
      importFrom: '@rozie/runtime-react';
      helperName: 'useOutsideClick' | 'useDebouncedCallback' | 'useThrottledCallback';
      args: ModifierArg[];
      listenerOnly?: true;
    }
  | { kind: 'inlineGuard'; code: string };

/**
 * SvelteEmissionDescriptor — Phase 5 tagged union returned by ModifierImpl.svelte?(...).
 *
 * Three discriminants — DIVERGENCE FROM Vue: 'native' is ONLY valid for the
 * `<listeners>`-block context (where addEventListener option flags
 * capture/passive/once meet Svelte's template-event surface). Per RESEARCH.md
 * Pitfall 4 + Pattern 4, Svelte 5 dropped both `on:click` syntax AND
 * `|preventDefault` modifier shorthand — template @event modifiers MUST
 * inlineGuard. Emitter rejects 'native' descriptors in template-event
 * context (ctx.source === 'template-event') with ROZ621-class diagnostic.
 *
 * @public — SemVer-stable per D-22b. Phase 5 freezes the registry shape;
 * third-party plugins implementing svelte?+angular? is the path-to-Phase-6+
 * MOD-05 dogfood expansion (Phase 4's swipe plugin can add svelte?/angular?
 * hooks in Phase 6 without breaking).
 */
export type SvelteEmissionDescriptor =
  | { kind: 'native'; token: 'capture' | 'passive' | 'once' }
  | {
      kind: 'helper';
      importFrom: '@rozie/runtime-svelte';
      helperName: 'useOutsideClick' | 'debounce' | 'throttle';
      args: ModifierArg[];
      listenerOnly?: true;
    }
  | { kind: 'inlineGuard'; code: string };

/**
 * AngularEmissionDescriptor — Phase 5 tagged union returned by ModifierImpl.angular?(...).
 *
 * Mirrors ReactEmissionDescriptor structure: 'native' for addEventListener
 * option flags in <listeners> blocks, 'helper' for @rozie/runtime-angular
 * imports (ONLY if Plan 05-04 decides to create the runtime package — see
 * RESEARCH.md A8: v1 default is inline emission, no runtime package), and
 * 'inlineGuard' for filter-style modifiers (.stop, .prevent, .self, key
 * filters). Angular's effect((onCleanup) => ...) callback supplies the
 * cleanup binding; the emitter wires inlineGuard fragments at the top of
 * the synthesized handler arrow.
 *
 * @public — SemVer-stable per D-22b.
 */
export type AngularEmissionDescriptor =
  | { kind: 'native'; token: 'capture' | 'passive' | 'once' }
  | {
      kind: 'helper';
      importFrom: '@rozie/runtime-angular';
      helperName: 'outsideClick' | 'debounce' | 'throttle';
      args: ModifierArg[];
      listenerOnly?: true;
    }
  | { kind: 'inlineGuard'; code: string };

/**
 * SolidEmissionDescriptor — Phase 07.1 tagged union returned by ModifierImpl.solid?(...).
 *
 * Mirrors ReactEmissionDescriptor's three-discriminant shape (RESEARCH A2):
 *
 * - 'native' — addEventListener option flag (capture/passive/once). Solid has
 *   NO native template-modifier syntax (no `.stop`/`.prevent` on JSX events) —
 *   the only "native" pass-through is the addEventListener option flag set,
 *   used when emitting `addEventListener('click', h, { capture: true })`.
 *
 * - 'helper' — emit an import from `@rozie/runtime-solid` and a helper call.
 *   Helpers are Solid primitives (createOutsideClick, createDebouncedHandler,
 *   createThrottledHandler) — the union members match the verified exports of
 *   `@rozie/runtime-solid`. `listenerOnly: true` flags modifiers (only
 *   `.outside` in v1) that are only meaningful in <listeners> blocks; emitter
 *   rejects them on template @event.
 *
 * - 'inlineGuard' — emit a code-fragment guard expression inline in the handler
 *   body, BEFORE the user handler runs. Used for filter-style modifiers that
 *   have no native Solid equivalent (.stop, .prevent, .self, key-filters). The
 *   `code` string is inserted verbatim; emitter MUST guarantee the surrounding
 *   handler has `e` as the event-arg name (the Solid emitter normalises this).
 *   Example:
 *     { kind: 'inlineGuard', code: 'e.stopPropagation();' }
 *
 * @public — SemVer-stable per D-22b. Additive in Phase 07.1; third-party
 * plugins implementing `solid?` (and `lit?`) extends the MOD-05 swipe dogfood
 * to the 6-target matrix. Third-party plugins MAY omit; emitter falls back to
 * a ROZ813-class diagnostic.
 */
export type SolidEmissionDescriptor =
  | { kind: 'native'; token: 'capture' | 'passive' | 'once' }
  | {
      kind: 'helper';
      importFrom: '@rozie/runtime-solid';
      helperName: 'createOutsideClick' | 'createDebouncedHandler' | 'createThrottledHandler';
      args: ModifierArg[];
      listenerOnly?: true;
    }
  | { kind: 'inlineGuard'; code: string };

/**
 * LitEmissionDescriptor — Phase 07.1 tagged union returned by ModifierImpl.lit?(...).
 *
 * Mirrors SvelteEmissionDescriptor/AngularEmissionDescriptor's three-discriminant
 * shape (RESEARCH A2):
 *
 * - 'native' — addEventListener option flag (capture/passive/once), valid in the
 *   <listeners>-block context where addEventListener option flags meet Lit's
 *   event surface.
 *
 * - 'helper' — emit an import from `@rozie/runtime-lit` and a helper call. The
 *   `helperName` union members match the verified exports of `@rozie/runtime-lit`
 *   (attachOutsideClickListener, debounce, throttle). `listenerOnly: true` flags
 *   modifiers (only `.outside` in v1) that are only meaningful in <listeners>
 *   blocks; emitter rejects them on template @event.
 *
 * - 'inlineGuard' — emit a code fragment inline in the synthesized handler body
 *   BEFORE the user handler runs. Used for filter-style modifiers (.stop,
 *   .prevent, .self, key filters) that have no native Lit representation. The
 *   `code` string is inserted verbatim; emitter MUST guarantee `e` is the bound
 *   event-arg name.
 *
 * @public — SemVer-stable per D-22b. Third-party plugins MAY omit; emitter
 * falls back to a ROZ832-class diagnostic.
 */
export type LitEmissionDescriptor =
  | { kind: 'native'; token: 'capture' | 'passive' | 'once' }
  | {
      kind: 'helper';
      importFrom: '@rozie/runtime-lit';
      helperName: 'attachOutsideClickListener' | 'debounce' | 'throttle';
      args: ModifierArg[];
      listenerOnly?: true;
    }
  | { kind: 'inlineGuard'; code: string };

/**
 * EventModifierImpl — what an EVENT modifier plugin author implements.
 *
 * `resolve()` validates args + emits diagnostics for malformed input
 * (D-08 collected-not-thrown applies — never throw on user input). On
 * success, returns one or more ModifierPipelineEntry objects describing
 * how the target emitter should wire the modifier.
 *
 * Phase 12 / D-01 — `ModifierImpl` became a discriminated union
 * `EventModifierImpl | ModelModifierImpl`. This interface is the original
 * event-shaped contract verbatim, plus an OPTIONAL `kind?: 'event'`
 * discriminant. The field is SemVer-additive: absent ⇒ `'event'`, so the
 * 25 builtin event modifiers AND the `tests/plugins/swipe` dogfood plugin
 * need ZERO change and stay byte-identical post-extension. This mirrors the
 * `inlineGuard` SemVer-additive precedent on `VueEmissionDescriptor` (above,
 * "NO Phase 3 builtin emits this kind, so the v1 Vue fixtures remain
 * byte-identical"). The flat shared registry namespace (D-05) is what lets a
 * found-but-`kind:'event'` lookup yield the precise "event modifier, not a
 * model modifier" misuse diagnostic (D-02).
 *
 * @public — SemVer-stable per D-22b. Phase 4 React emitter is the dogfooding consumer.
 */
export interface EventModifierImpl {
  /**
   * Phase 12 / D-01 — OPTIONAL discriminant. Absent ⇒ `'event'`. SemVer-additive:
   * existing event-modifier impls omit it and stay byte-identical. Present-and-
   * `'event'` is also accepted (explicit form).
   */
  kind?: 'event';
  /** Modifier name, e.g., 'outside'. Must match the registered key. */
  name: string;
  /**
   * Documented arity for arg-count validation. 'none' = zero args expected;
   * 'one' = exactly one; 'one-or-more' = at least zero (e.g., `.outside()` valid).
   */
  arity: 'none' | 'one' | 'one-or-more';
  /**
   * Resolve the modifier into one or more pipeline entries. Most modifiers
   * produce exactly one entry; key filter groupings (e.g., `.ctrl.shift`)
   * may produce multiple. Implementations validate arg count/shape and emit
   * Diagnostic[] for mismatches (ROZ110..ROZ112 sub-range).
   */
  resolve(
    args: ModifierArg[],
    ctx: ModifierContext,
  ): { entries: ModifierPipelineEntry[]; diagnostics: Diagnostic[] };
  /**
   * Phase 3 D-40 — Vue target emission descriptor. Optional for Phase 1/2
   * compatibility; Phase 3 emitter REQUIRES every builtin to implement it.
   * Third-party plugins MAY omit; emitter falls back to ROZ420.
   */
  vue?(args: ModifierArg[], ctx: ModifierContext): VueEmissionDescriptor;
  /**
   * Phase 4 D-65 — React target emission descriptor. Optional for Phase 1/2/3
   * compatibility; Phase 4 emitter REQUIRES every builtin to implement it.
   * Third-party plugins MAY omit; emitter falls back to ROZ520-class diagnostic.
   */
  react?(args: ModifierArg[], ctx: ModifierContext): ReactEmissionDescriptor;
  /**
   * Phase 5 — Svelte target emission descriptor. Optional for Phase 1-4
   * compatibility; Phase 5 emitter REQUIRES every builtin to implement it.
   * Third-party plugins MAY omit; emitter falls back to ROZ621-class diagnostic.
   */
  svelte?(args: ModifierArg[], ctx: ModifierContext): SvelteEmissionDescriptor;
  /**
   * Phase 5 — Angular target emission descriptor. Optional for Phase 1-4
   * compatibility; Phase 5 emitter REQUIRES every builtin to implement it.
   * Third-party plugins MAY omit; emitter falls back to ROZ722-class diagnostic.
   */
  angular?(args: ModifierArg[], ctx: ModifierContext): AngularEmissionDescriptor;
  /**
   * Phase 07.1 — Solid target emission descriptor. Optional for Phase 1-6
   * compatibility; the Solid emitter REQUIRES every builtin to implement it.
   * Third-party plugins MAY omit; emitter falls back to a ROZ813-class diagnostic.
   */
  solid?(args: ModifierArg[], ctx: ModifierContext): SolidEmissionDescriptor;
  /**
   * Phase 07.1 — Lit target emission descriptor. Optional for Phase 1-6
   * compatibility; the Lit emitter REQUIRES every builtin to implement it.
   * Third-party plugins MAY omit; emitter falls back to a ROZ832-class diagnostic.
   */
  lit?(args: ModifierArg[], ctx: ModifierContext): LitEmissionDescriptor;
}

/**
 * ModelModifierDescriptor — Phase 12 / D-03. The single, target-agnostic
 * descriptor a `ModelModifierImpl.resolve()` returns.
 *
 * Unlike event modifiers — which carry six per-target `vue()/react()/...`
 * methods because event wiring genuinely diverges per target — a model
 * modifier's value transform is the SAME everywhere: `.trim` is `v.trim()`
 * on every target, `.number` is a `looseToNumber` coercion everywhere, a
 * custom `.phone` is one regex everywhere. So a model modifier declares ONE
 * descriptor; the per-target emitter handles the small `change`-vs-`input`
 * event divergence itself (D-08).
 *
 * @public — SemVer-stable per D-22b.
 */
export interface ModelModifierDescriptor {
  /**
   * D-03 — a code-fragment string containing the literal `$v` placeholder.
   * Each emitter substitutes `$v` with its own extracted-value access
   * expression (e.g. `e.target.value` for the AST-based react/solid/lit
   * emitters, the bound-value string for vue/svelte/angular). This mirrors
   * the event side's `inlineGuard.code` precedent, so the fragment is
   * consumable by BOTH the AST-based emitters and the string-based ones.
   * Absent ⇒ the modifier performs no value transform (e.g. `.lazy`).
   */
  valueTransform?: string;
  /**
   * The TS type the composed `valueTransform` is CONTRACTUALLY understood to
   * produce, regardless of its runtime fallback. `.number` is Vue's
   * `looseToNumber` — it returns the raw string when `parseFloat` yields `NaN`,
   * so the transform's true runtime result is `string | number`. But the author
   * asked for numeric coercion, and Vue itself types a `v-model.number` model as
   * `number` (trusting the declared type). The TS-expression-context emitters
   * (react/solid/lit/svelte) wrap the committed value in `(<transform> as
   * <valueTransformResultType>)` so the `string | number` result is assignable
   * to the typed setter — a pure type assertion, byte-runtime-neutral, matching
   * Vue's stance. Angular splices the transform into a TEMPLATE binding (where
   * `as` is illegal and `$event` is untyped anyway → already clean) and Vue uses
   * the native `v-model.number` (no spliced transform), so both IGNORE this.
   * Absent ⇒ no cast (the transform's inferred type flows through unchanged, e.g.
   * `.trim` stays `string`). Spike-012 R7-2.
   */
  valueTransformResultType?: string;
  /**
   * D-03 / D-08 — a flag. `'change'` means the bound input should commit on
   * the `change` event instead of `input`. Each target emitter wires its own
   * event; the per-target divergence (`change` vs `input`, React's
   * uncontrolled `defaultValue`+`onBlur` quirk) stays the emitter's job, not
   * the modifier's. Absent ⇒ no event swap (the default `input` binding).
   */
  eventSwap?: 'change';
}

/**
 * ModelModifierImpl — what a MODEL modifier plugin author implements
 * (Phase 12 / D-01, D-03, D-04).
 *
 * Parallels `EventModifierImpl`'s authoring surface — `name`, `arity`, and a
 * `resolve(args, ctx)` returning the same collected-not-thrown shape — but
 * with the REQUIRED `kind: 'model'` discriminant and a `resolve()` that
 * returns ONE target-agnostic `ModelModifierDescriptor` instead of
 * `entries[]` + six per-target methods (D-03). Model modifiers are
 * target-agnostic by construction, so they carry no
 * `vue()/react()/svelte()/angular()/solid()/lit()` methods.
 *
 * @public — SemVer-stable per D-22b.
 */
export interface ModelModifierImpl {
  /** Phase 12 / D-01 — REQUIRED discriminant. Always `'model'`. */
  kind: 'model';
  /** Modifier name, e.g., 'trim'. Must match the registered key. */
  name: string;
  /**
   * Documented arity for arg-count validation. 'none' = zero args expected;
   * 'one' = exactly one; 'one-or-more' = at least zero.
   */
  arity: 'none' | 'one' | 'one-or-more';
  /**
   * Resolve the modifier into a single target-agnostic descriptor.
   * Implementations validate arg count/shape and emit Diagnostic[] for
   * mismatches (collected-not-thrown — never throw on user input).
   */
  resolve(
    args: ModifierArg[],
    ctx: ModifierContext,
  ): { descriptor: ModelModifierDescriptor; diagnostics: Diagnostic[] };
}

/**
 * ModifierImpl — Phase 12 / D-01 discriminated union.
 *
 * A registered modifier is EITHER an event modifier OR a model modifier,
 * never both (D-06). The discriminant is the `kind` field: absent or
 * `'event'` ⇒ `EventModifierImpl`, `'model'` ⇒ `ModelModifierImpl`. Because
 * `EventModifierImpl.kind` is optional, the 25 builtin event modifiers and
 * the `tests/plugins/swipe` plugin compile unchanged (SemVer-additive).
 *
 * @public — SemVer-stable per D-22b.
 */
export type ModifierImpl = EventModifierImpl | ModelModifierImpl;

/**
 * isEventModifier — Phase 12 / D-01 narrowing predicate.
 *
 * Returns `true` when the modifier is an `EventModifierImpl` (its `kind` is
 * absent or `'event'`). Event-context consumers (`<listeners>` / `@event`
 * emitters) use this to narrow a `ModifierImpl` looked up from the flat
 * registry down to the event-shaped variant before touching event-only
 * fields (`vue()/react()/...`, `resolve().entries`). A `kind: 'model'`
 * modifier appearing in event context is a cross-context misuse.
 *
 * @public — SemVer-stable per D-22b.
 */
export function isEventModifier(impl: ModifierImpl): impl is EventModifierImpl {
  return impl.kind === undefined || impl.kind === 'event';
}

/**
 * isModelModifier — Phase 12 / D-01 narrowing predicate.
 *
 * Returns `true` when the modifier is a `ModelModifierImpl` (its `kind` is
 * `'model'`). The r-model lowering path uses this to narrow a registry
 * lookup before consuming the model-shaped `resolve().descriptor`.
 *
 * @public — SemVer-stable per D-22b.
 */
export function isModelModifier(impl: ModifierImpl): impl is ModelModifierImpl {
  return impl.kind === 'model';
}

/**
 * Modifier registry. Constructed empty; populate via `registerBuiltins(registry)`
 * for the 25 default modifiers, then optionally `registerModifier(registry, ...)`
 * for third-party plugins.
 *
 * Per D-22 — NO module-import side effects: importing this class does NOT
 * register anything; the consumer must explicitly call registerBuiltins. This
 * keeps the module tree-shaking-friendly and ensures each test gets a fresh
 * registry.
 *
 * @public — SemVer-stable per D-22b.
 */
export class ModifierRegistry {
  private map = new Map<string, ModifierImpl>();

  /**
   * WR-04 (12-REVIEW) — memoized sorted list of registered MODEL-modifier
   * names. `resolveModelModifiers` (in `lowerTemplate.ts`) needs this list
   * for every `r-model` attribute's did-you-mean candidate set; recomputing
   * it (a `list()` sort + per-name `get()` + `isModelModifier()` filter) on
   * each call is wasted work in the compiler hot path. The cache is
   * invalidated on every `register()` — registration is the only mutation
   * path — so it can never go stale.
   */
  private modelModifierNamesCache: readonly string[] | null = null;

  /**
   * Register a modifier implementation. THROWS on duplicate name —
   * this is a programmer-error path during compiler setup (NOT a
   * user-input validation), so throwing is correct here. The conflict
   * is an explicit signal: third-party plugin authors must use unique
   * namespaced names to avoid clobbering builtins.
   */
  register(impl: ModifierImpl): void {
    if (this.map.has(impl.name)) {
      throw new Error(`Modifier '${impl.name}' is already registered`);
    }
    this.map.set(impl.name, impl);
    // WR-04 — invalidate the model-modifier-name cache; the next
    // listModelModifiers() call recomputes it.
    this.modelModifierNamesCache = null;
  }

  /** Look up a modifier by name. Returns undefined if not registered. */
  get(name: string): ModifierImpl | undefined {
    return this.map.get(name);
  }

  /** Check whether a modifier name is registered. */
  has(name: string): boolean {
    return this.map.has(name);
  }

  /**
   * Sorted list of registered modifier names — deterministic for snapshot
   * fixtures and developer-facing introspection.
   */
  list(): readonly string[] {
    return [...this.map.keys()].sort();
  }

  /**
   * WR-04 (12-REVIEW) — sorted list of registered MODEL-modifier names only
   * (`kind: 'model'`). Memoized: computed once and reused until the next
   * `register()` invalidates it. `resolveModelModifiers` calls this once per
   * `r-model` attribute for its ROZ960 did-you-mean candidate set, so the
   * memoization removes a per-attribute `list()` sort + full-registry filter
   * from the compiler hot path.
   */
  listModelModifiers(): readonly string[] {
    if (this.modelModifierNamesCache === null) {
      this.modelModifierNamesCache = [...this.map.entries()]
        .filter(([, impl]) => isModelModifier(impl))
        .map(([name]) => name)
        .sort();
    }
    return this.modelModifierNamesCache;
  }
}
