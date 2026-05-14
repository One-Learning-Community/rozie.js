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
  vue() {
    // D-39 native pass-through: Vue's `.once` matches Rozie verbatim.
    return { kind: 'native', token: 'once' };
  },
  react() {
    // D-65 native: addEventListener({ once: true }) option flag — emitter
    // switches to raw addEventListener call style when this descriptor appears.
    // (React synthetic events have no native `once` option; using the option
    // flag means the emitter falls back to a one-shot raw addEventListener.)
    return { kind: 'native', token: 'once' };
  },
  svelte() {
    // Phase 5 native: addEventListener({ once: true }) option flag — valid
    // ONLY for <listeners>-block context where addEventListener option flags
    // make sense. Svelte 5 template @event context will have
    // ctx.source === 'template-event' — emitter rejects via ROZ621.
    return { kind: 'native', token: 'once' };
  },
  angular() {
    // Phase 5 native: addEventListener({ once: true }) option flag — Angular
    // emitter uses Renderer2.listen for <listeners> blocks; this flag selects
    // a one-shot wrapper that auto-unbinds via DestroyRef.
    return { kind: 'native', token: 'once' };
  },
  solid() {
    // Phase 07.1 native: addEventListener({ once: true }) option flag — the
    // Solid emitter switches to raw addEventListener call style for this flag.
    return { kind: 'native', token: 'once' };
  },
  lit() {
    // Phase 07.1 native: addEventListener({ once: true }) option flag — valid
    // ONLY for <listeners>-block context where addEventListener option flags
    // make sense.
    return { kind: 'native', token: 'once' };
  },
};
