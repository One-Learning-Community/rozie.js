/**
 * registerBuiltins(registry) — populate a ModifierRegistry with the full
 * default set of first-party modifiers.
 *
 * Per D-22: explicit call required. Importing this module does NOT
 * register anything by itself; the caller must invoke registerBuiltins(reg)
 * (or use the createDefaultRegistry() factory below). This gives:
 *   - Tree-shaking-friendly imports
 *   - Each test gets a fresh registry (no shared global state)
 *   - Symmetric pattern for first-party builtins and third-party plugins
 *
 * @public — SemVer-stable per D-22b. The set of modifiers registered
 * here is part of the public API; ADDING modifiers is additive (safe);
 * REMOVING or RENAMING is a breaking change.
 */
import { ModifierRegistry } from './ModifierRegistry.js';
import { outside } from './builtins/outside.js';
import { self } from './builtins/self.js';
import { stop } from './builtins/stop.js';
import { prevent } from './builtins/prevent.js';
import { once } from './builtins/once.js';
import { capture } from './builtins/capture.js';
import { passive } from './builtins/passive.js';
import { debounce } from './builtins/debounce.js';
import { throttle } from './builtins/throttle.js';
import { registerKeyFilters } from './builtins/keyFilters.js';

/**
 * Register the 9 composition modifiers (outside/self/stop/prevent/once/
 * capture/passive/debounce/throttle) plus the 14 key/button filter names
 * (escape/enter/tab/delete/space/up/down/left/right/home/end/pageUp/
 * pageDown/middle) into `registry`.
 *
 * Throws if any name is already registered (programmer-error path —
 * re-running registerBuiltins on a populated registry is a bug).
 *
 * @public — SemVer-stable per D-22b.
 */
export function registerBuiltins(registry: ModifierRegistry): void {
  registry.register(outside);
  registry.register(self);
  registry.register(stop);
  registry.register(prevent);
  registry.register(once);
  registry.register(capture);
  registry.register(passive);
  registry.register(debounce);
  registry.register(throttle);
  registerKeyFilters(registry);
}

/**
 * Convenience factory: returns a ModifierRegistry pre-populated with the
 * full builtin set. Phase 2 Plan 02-05 lowerToIR uses this when no
 * registry is provided in opts.
 *
 * Each call returns an INDEPENDENT registry — no shared state.
 *
 * @public — SemVer-stable per D-22b.
 */
export function createDefaultRegistry(): ModifierRegistry {
  const registry = new ModifierRegistry();
  registerBuiltins(registry);
  return registry;
}
