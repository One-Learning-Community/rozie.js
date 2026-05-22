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

/**
 * Distributive `Omit` — applied member-by-member across the `ModifierImpl`
 * discriminated union so each variant's `kind`↔`resolve` correlation survives
 * (a non-distributive `Omit<ModifierImpl, 'name'>` would collapse the union
 * and break the `EventModifierImpl | ModelModifierImpl` discriminant, Phase 12
 * / D-01).
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never;

export function registerModifier(
  registry: ModifierRegistry,
  name: string,
  impl: DistributiveOmit<ModifierImpl, 'name'>,
): void {
  registry.register({ name, ...impl } as ModifierImpl);
}
