/**
 * `.self` — fires only when `event.target === event.currentTarget`
 * (the event originated on the bound element itself, not a descendant).
 *
 * Pipeline kind: `filter` — emitter inserts an early-return guard before
 * the user handler.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const self: ModifierImpl = {
  name: 'self',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.self' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'filter',
          modifier: 'self',
          args: [],
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
  vue() {
    // D-39 native pass-through: Vue's `.self` matches Rozie verbatim.
    return { kind: 'native', token: 'self' };
  },
};
