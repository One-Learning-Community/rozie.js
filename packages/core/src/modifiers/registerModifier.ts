/**
 * Public registration helper. Symmetric with the third-party plugin pattern
 * — first-party builtins (registerBuiltins) and third-party plugins use the
 * same call.
 *
 * @example
 *   const registry = new ModifierRegistry();
 *   registerBuiltins(registry);
 *   registerModifier(registry, 'swipe', {
 *     arity: 'none',
 *     resolve(args, ctx) { ... return { entries, diagnostics }; },
 *   });
 *
 * @public — SemVer-stable per D-22b. Phase 4 React emitter is the dogfooding consumer.
 */
import type { ModifierImpl, ModifierRegistry } from './ModifierRegistry.js';

export function registerModifier(
  registry: ModifierRegistry,
  name: string,
  impl: Omit<ModifierImpl, 'name'>,
): void {
  registry.register({ name, ...impl });
}
