/**
 * MOD-05 dogfood: the swipe modifier.
 *
 * Plan 04-06 / D-22b SemVer-stability proof: a third-party plugin author can
 * ship a modifier that compiles correctly across BOTH Phase 3 emitVue AND
 * Phase 4 emitReact WITHOUT any change to @rozie/core (other than the additive
 * Plan 04-06 inlineGuard discriminant on VueEmissionDescriptor — itself a
 * SemVer-additive amendment proven byte-identical to Phase 3 fixtures).
 *
 * Public-API surface used (all SemVer-stable v1 per D-22b):
 *   - ModifierImpl, ModifierContext, ModifierArg
 *   - VueEmissionDescriptor, ReactEmissionDescriptor, SvelteEmissionDescriptor,
 *     AngularEmissionDescriptor, SolidEmissionDescriptor, LitEmissionDescriptor
 *     (all six `inlineGuard` kind)
 *
 * Usage in a .rozie file:
 *   <template>
 *     <div @touchstart.swipe('left')="$data.swiped = true" />
 *   </template>
 *
 * Compiles to (all 6 targets via the same inlineGuard descriptor):
 *   - Vue: @touchstart="(e) => { if (!e.touches || e.touches.length === 0) return; ...; (e) => { ... swiped = true; }(e); }"
 *   - React: onTouchStart={(e) => { if (!e.touches || e.touches.length === 0) return; ...; ...; }}
 *   - Svelte / Angular / Solid / Lit: the same inlineGuard code spliced into each target's synthesized handler.
 */
import type {
  ModifierImpl,
  ModifierContext,
  ModifierArg,
  VueEmissionDescriptor,
  ReactEmissionDescriptor,
  SvelteEmissionDescriptor,
  AngularEmissionDescriptor,
  SolidEmissionDescriptor,
  LitEmissionDescriptor,
} from '@rozie/core';
import type { Diagnostic } from '@rozie/core';

type SwipeDirection = 'left' | 'right' | 'up' | 'down';
const VALID_DIRECTIONS: ReadonlyArray<SwipeDirection> = ['left', 'right', 'up', 'down'];

/**
 * Build the inline guard code for a given swipe direction. The guard runs at
 * the start of the touch handler; if the touch start position is wrong for
 * the requested direction, the user handler is short-circuited via `return;`.
 *
 * The emitter guarantees `e` is the bound event-arg name (Plan 04 React side
 * normalises this in emitTemplateEvent / emitListenerNative; Plan 04-06 Vue
 * side does the same in emitTemplateEvent's synthesized arrow).
 *
 * Note: this v1 guard is intentionally minimal — production swipe libraries
 * track touchend deltas. For MOD-05 dogfood purposes the guard simply asserts
 * a touch is present + has a non-degenerate axis position; the surrounding
 * user handler is expected to do the real direction logic via touchend.
 */
function buildGuardCode(direction: SwipeDirection): string {
  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  return `if (!e.touches || e.touches.length === 0) return; if ((e.touches[0]?.client${axis} ?? 0) < 0) return; /* swipe ${direction} guard */`;
}

/**
 * The swipe modifier. Exported as a named const so the test suite can register
 * it onto a fresh ModifierRegistry per test.
 *
 * Per D-22 (NO module-import side effects): importing this module does NOT
 * register anything; consumers must explicitly call
 * `registry.register(swipeModifier)`.
 */
export const swipeModifier: ModifierImpl = {
  name: 'swipe',
  arity: 'one',
  resolve(args: ModifierArg[], ctx: ModifierContext) {
    const diagnostics: Diagnostic[] = [];
    if (
      args.length !== 1 ||
      args[0]?.kind !== 'literal' ||
      typeof args[0].value !== 'string' ||
      !VALID_DIRECTIONS.includes(args[0].value as SwipeDirection)
    ) {
      diagnostics.push({
        // Reuse the generic modifier-arity error code as a bare string.
        // Third-party plugins do NOT reach for the first-party-only diagnostic
        // code type (those entries are reserved for first-party diagnostics
        // per D-08 surface stability); `Diagnostic.code` is plain `string`, so
        // a bare string literal is the canary's only error-code dependency.
        code: 'ROZ111',
        severity: 'error',
        message: `swipe modifier expects one argument: 'left' | 'right' | 'up' | 'down' (got ${JSON.stringify(args.map((a) => (a.kind === 'literal' ? a.value : `$refs.${a.ref}`)))})`,
        loc: ctx.sourceLoc,
      });
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'filter' as const,
          modifier: 'swipe',
          args,
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics,
    };
  },
  vue(args: ModifierArg[]): VueEmissionDescriptor {
    // resolve() guarantees args[0] is a literal string in VALID_DIRECTIONS by
    // the time this runs (the emitter only invokes vue() for entries returned
    // from a successful resolve()).
    const dir = (args[0] as Extract<ModifierArg, { kind: 'literal' }>).value as SwipeDirection;
    return { kind: 'inlineGuard', code: buildGuardCode(dir) };
  },
  react(args: ModifierArg[]): ReactEmissionDescriptor {
    const dir = (args[0] as Extract<ModifierArg, { kind: 'literal' }>).value as SwipeDirection;
    return { kind: 'inlineGuard', code: buildGuardCode(dir) };
  },
  svelte(args: ModifierArg[]): SvelteEmissionDescriptor {
    const dir = (args[0] as Extract<ModifierArg, { kind: 'literal' }>).value as SwipeDirection;
    return { kind: 'inlineGuard', code: buildGuardCode(dir) };
  },
  angular(args: ModifierArg[]): AngularEmissionDescriptor {
    const dir = (args[0] as Extract<ModifierArg, { kind: 'literal' }>).value as SwipeDirection;
    return { kind: 'inlineGuard', code: buildGuardCode(dir) };
  },
  solid(args: ModifierArg[]): SolidEmissionDescriptor {
    const dir = (args[0] as Extract<ModifierArg, { kind: 'literal' }>).value as SwipeDirection;
    return { kind: 'inlineGuard', code: buildGuardCode(dir) };
  },
  lit(args: ModifierArg[]): LitEmissionDescriptor {
    const dir = (args[0] as Extract<ModifierArg, { kind: 'literal' }>).value as SwipeDirection;
    return { kind: 'inlineGuard', code: buildGuardCode(dir) };
  },
};
