/**
 * `.stop` — calls `event.stopPropagation()` before invoking the user handler.
 *
 * Pipeline kind: `filter` — emitter inserts the side-effect call in the
 * wrapper.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const stop: ModifierImpl = {
  name: 'stop',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.stop' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'filter',
          modifier: 'stop',
          args: [],
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
};
