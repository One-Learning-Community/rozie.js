/**
 * `.capture` — addEventListener({ capture: true }). Listener runs on the
 * capture phase before bubble.
 *
 * Pipeline kind: `listenerOption`.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const capture: ModifierImpl = {
  name: 'capture',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.capture' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'listenerOption',
          option: 'capture',
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
  vue() {
    // D-39 native pass-through: Vue's `.capture` matches Rozie verbatim.
    return { kind: 'native', token: 'capture' };
  },
  react() {
    // D-65 native: addEventListener({ capture: true }) option flag — emitter
    // switches to raw addEventListener call style when this descriptor appears.
    return { kind: 'native', token: 'capture' };
  },
  svelte() {
    // Phase 5 native: addEventListener({ capture: true }) option flag — valid
    // ONLY for <listeners>-block context. Template @event context with
    // ctx.source === 'template-event' is rejected via ROZ621.
    return { kind: 'native', token: 'capture' };
  },
  angular() {
    // Phase 5 native: addEventListener({ capture: true }) option flag — Angular
    // <listeners> block emits raw addEventListener with this option set.
    return { kind: 'native', token: 'capture' };
  },
  solid() {
    // Phase 07.1 native: addEventListener({ capture: true }) option flag — the
    // Solid emitter switches to raw addEventListener call style for this flag.
    return { kind: 'native', token: 'capture' };
  },
  lit() {
    // Phase 07.1 native: addEventListener({ capture: true }) option flag —
    // valid ONLY for <listeners>-block context.
    return { kind: 'native', token: 'capture' };
  },
};
