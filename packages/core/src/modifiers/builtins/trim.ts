/**
 * `.trim` — built-in r-model MODEL modifier (Phase 12 / D-03).
 *
 * Trims leading/trailing whitespace from the bound value before it is
 * committed to state, mirroring Vue's `v-model.trim`. The descriptor's
 * `valueTransform` is the code fragment `$v.trim()` — each target emitter
 * substitutes the `$v` placeholder with its own extracted-value access
 * expression.
 *
 * Per D-07 `.trim` is a whitespace-strip transform and runs FIRST in the
 * fixed Vue-canonical compose pipeline (`.trim` -> custom -> `.number`).
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModelModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const trim: ModelModifierImpl = {
  kind: 'model',
  name: 'trim',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.trim' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { descriptor: {}, diagnostics };
    }
    return {
      descriptor: { valueTransform: '$v.trim()' },
      diagnostics: [],
    };
  },
};
