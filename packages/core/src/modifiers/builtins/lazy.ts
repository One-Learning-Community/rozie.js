/**
 * `.lazy` — built-in r-model MODEL modifier (Phase 12 / D-03, D-07, D-08).
 *
 * Defers the bound value's commit until the `change` event instead of
 * `input`, mirroring Vue's `v-model.lazy`. The descriptor carries only
 * `eventSwap: 'change'` — `.lazy` has NO `valueTransform`.
 *
 * Per D-07 `.lazy` is ORTHOGONAL to the value-transform compose pipeline:
 * it is an event-binding swap, not a value transform, so it sits outside
 * the `.trim` -> custom -> `.number` ordering entirely.
 *
 * Per D-08 each target emitter wires its own event for the swap. React is
 * the one special case — it has no true `change` event, so it emits `.lazy`
 * as an uncontrolled `defaultValue` + `onBlur` input (a documented parity
 * edge case); the other five targets simply swap their event name.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModelModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const lazy: ModelModifierImpl = {
  kind: 'model',
  name: 'lazy',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.lazy' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { descriptor: {}, diagnostics };
    }
    return {
      descriptor: { eventSwap: 'change' },
      diagnostics: [],
    };
  },
};
