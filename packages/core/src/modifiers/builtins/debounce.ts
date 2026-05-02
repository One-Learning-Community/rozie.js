/**
 * `.debounce(ms)` — wraps the handler in a debouncer that delays
 * invocation until `ms` milliseconds elapse without further events.
 *
 * Pipeline kind: `wrap` — emitter wraps the handler in a higher-order
 * function (per-target debouncing implementation).
 *
 * Args validation:
 *   - exactly 1 arg → ROZ111 if 0 or 2+
 *   - arg must be a numeric literal → ROZ112 if refExpr or non-numeric literal
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const debounce: ModifierImpl = {
  name: 'debounce',
  arity: 'one',
  resolve(args, ctx) {
    if (args.length !== 1) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.debounce' requires exactly 1 numeric argument (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    const arg = args[0]!;
    if (arg.kind !== 'literal' || typeof arg.value !== 'number') {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARG_SHAPE,
          severity: 'error',
          message: `'.debounce' expects a numeric literal (e.g., 300), got ${arg.kind}`,
          loc: arg.loc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'wrap',
          modifier: 'debounce',
          args,
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
  vue(args) {
    // D-40: dispatched through @rozie/runtime-vue debounce. Valid in BOTH
    // <listeners> and template @event — no listenerOnly flag.
    return {
      kind: 'helper',
      importFrom: '@rozie/runtime-vue',
      helperName: 'debounce',
      args,
    };
  },
};
