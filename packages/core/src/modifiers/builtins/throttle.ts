/**
 * `.throttle(ms)` — wraps the handler with a throttle window of `ms`
 * milliseconds between invocations.
 *
 * Pipeline kind: `wrap` — emitter wraps the handler in a higher-order
 * function (per-target throttle implementation).
 *
 * Args validation: mirror of debounce.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const throttle: ModifierImpl = {
  name: 'throttle',
  arity: 'one',
  resolve(args, ctx) {
    if (args.length !== 1) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.throttle' requires exactly 1 numeric argument (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    const [arg] = args;
    if (arg.kind !== 'literal' || typeof arg.value !== 'number') {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARG_SHAPE,
          severity: 'error',
          message: `'.throttle' expects a numeric literal (e.g., 100), got ${arg.kind}`,
          loc: arg.loc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'wrap',
          modifier: 'throttle',
          args,
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
};
