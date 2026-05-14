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
  vue() {
    // D-39 native pass-through: Vue's `.stop` matches Rozie verbatim.
    return { kind: 'native', token: 'stop' };
  },
  react() {
    // D-65 inlineGuard: React JSX has no native modifier syntax for stop —
    // emitter inserts the side-effect call before the user handler runs.
    return { kind: 'inlineGuard', code: 'e.stopPropagation();' };
  },
  svelte() {
    // Phase 5 inlineGuard: Svelte 5 dropped both `on:click` syntax AND
    // `|preventDefault` shorthand (RESEARCH.md Pitfall 4) — template @event
    // modifiers MUST inlineGuard.
    return { kind: 'inlineGuard', code: 'e.stopPropagation();' };
  },
  angular() {
    // Phase 5 inlineGuard: Angular has no template modifier sugar
    // (no [(click).stop] equivalent), so inlineGuard is the path.
    return { kind: 'inlineGuard', code: 'e.stopPropagation();' };
  },
  solid() {
    // Phase 07.1 inlineGuard: Solid JSX has no native modifier syntax for
    // stop — emitter inserts the side-effect call before the user handler runs.
    return { kind: 'inlineGuard', code: 'e.stopPropagation();' };
  },
  lit() {
    // Phase 07.1 inlineGuard: Lit has no template modifier sugar; inlineGuard
    // is the path.
    return { kind: 'inlineGuard', code: 'e.stopPropagation();' };
  },
};
