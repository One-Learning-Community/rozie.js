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
 * ModifierImpl — what a modifier plugin author implements.
 *
 * `resolve()` validates args + emits diagnostics for malformed input
 * (D-08 collected-not-thrown applies — never throw on user input). On
 * success, returns one or more ModifierPipelineEntry objects describing
 * how the target emitter should wire the modifier.
 *
 * @public — SemVer-stable per D-22b. Phase 4 React emitter is the dogfooding consumer.
 */
export interface ModifierImpl {
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
}
