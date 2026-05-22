/**
 * `.number` — built-in r-model MODEL modifier (Phase 12 / D-03).
 *
 * Coerces the bound value to a number, mirroring Vue's `v-model.number`
 * (`looseToNumber`): parse the value as a float and fall back to the raw
 * string when the result is `NaN`. The descriptor's `valueTransform` is a
 * single self-contained JS expression — an IIFE over the `$v` placeholder,
 * which each target emitter substitutes with its own extracted-value access
 * expression.
 *
 * Per D-07 `.number` is ALWAYS TERMINAL in the fixed Vue-canonical compose
 * pipeline (`.trim` -> custom string-transforms -> `.number`), because it
 * produces a non-string value: any transform composed after it would
 * operate on a number, which is out of scope for v1.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModelModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

/**
 * Vue `looseToNumber`-equivalent inline fragment. A single JS expression
 * (an IIFE — no block statements) so it is usable verbatim as a
 * value-transform fragment by both the AST-based and string-based emitters.
 * `$v` is the placeholder each emitter substitutes.
 */
const NUMBER_VALUE_TRANSFORM = '((__v) => { const __n = parseFloat(__v); return isNaN(__n) ? __v : __n; })($v)';

export const number: ModelModifierImpl = {
  kind: 'model',
  name: 'number',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.number' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { descriptor: {}, diagnostics };
    }
    return {
      descriptor: { valueTransform: NUMBER_VALUE_TRANSFORM },
      diagnostics: [],
    };
  },
};
