/**
 * `.prevent` — calls `event.preventDefault()` before invoking the user handler.
 *
 * Pipeline kind: `filter` — emitter inserts the side-effect call in the
 * wrapper.
 *
 * Per D-22: this module has NO module-import side effects.
 */
import type { ModifierImpl } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

export const prevent: ModifierImpl = {
  name: 'prevent',
  arity: 'none',
  resolve(args, ctx) {
    if (args.length !== 0) {
      const diagnostics: Diagnostic[] = [
        {
          code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
          severity: 'error',
          message: `'.prevent' takes no arguments (got ${args.length})`,
          loc: ctx.sourceLoc,
        },
      ];
      return { entries: [], diagnostics };
    }
    return {
      entries: [
        {
          kind: 'filter',
          modifier: 'prevent',
          args: [],
          sourceLoc: ctx.sourceLoc,
        },
      ],
      diagnostics: [],
    };
  },
  vue() {
    // D-39 native pass-through: Vue's `.prevent` matches Rozie verbatim.
    return { kind: 'native', token: 'prevent' };
  },
  react() {
    // D-65 inlineGuard: React JSX has no native modifier syntax for prevent —
    // emitter inserts the side-effect call before the user handler runs.
    return { kind: 'inlineGuard', code: 'e.preventDefault();' };
  },
  svelte() {
    // Phase 5 inlineGuard: Svelte 5 dropped `|preventDefault` shorthand
    // (RESEARCH.md Pitfall 4) — template @event modifiers MUST inlineGuard.
    return { kind: 'inlineGuard', code: 'e.preventDefault();' };
  },
  angular() {
    // Phase 5 inlineGuard: Angular has no template modifier sugar; inlineGuard
    // is the path.
    return { kind: 'inlineGuard', code: 'e.preventDefault();' };
  },
  solid() {
    // Phase 07.1 inlineGuard: Solid JSX has no native modifier syntax for
    // prevent — emitter inserts the side-effect call before the user handler.
    return { kind: 'inlineGuard', code: 'e.preventDefault();' };
  },
  lit() {
    // Phase 07.1 inlineGuard: Lit has no template modifier sugar; inlineGuard
    // is the path.
    return { kind: 'inlineGuard', code: 'e.preventDefault();' };
  },
};
