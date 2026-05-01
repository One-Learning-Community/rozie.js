/**
 * `.once` — addEventListener({ once: true }). The browser auto-removes
 * the listener after first invocation.
 *
 * Pipeline kind: `listenerOption` — surfaces directly as the third
 * argument to `addEventListener`. Each emitter handles per-target
 * (e.g., React synthetic events have no native `once` option, so the
 * React emitter implements `once` as a one-shot wrapper instead).
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const once: ModifierImpl = {
  name: 'once',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.once' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'listenerOption',
          option: 'once',
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
};
