/**
 * `.passive` — addEventListener({ passive: true }). Promises NOT to call
 * `preventDefault()`, allowing browsers to optimize scroll/touch handlers.
 *
 * Pipeline kind: `listenerOption`.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const passive: ModifierImpl = {
  name: 'passive',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.passive' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'listenerOption',
          option: 'passive',
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
  vue() {
    // D-39 native pass-through: Vue's `.passive` matches Rozie verbatim.
    return { kind: 'native', token: 'passive' };
  },
  react() {
    // D-65 native: addEventListener({ passive: true }) option flag — emitter
    // switches to raw addEventListener call style when this descriptor appears.
    return { kind: 'native', token: 'passive' };
  },
  svelte() {
    // Phase 5 native: addEventListener({ passive: true }) option flag — valid
    // ONLY for <listeners>-block context.
    return { kind: 'native', token: 'passive' };
  },
  angular() {
    // Phase 5 native: addEventListener({ passive: true }) option flag.
    return { kind: 'native', token: 'passive' };
  },
};
