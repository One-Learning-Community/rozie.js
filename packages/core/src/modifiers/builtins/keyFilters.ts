/**
 * Key + button filter modifiers.
 *
 * Covers KeyboardEvent.key matchers (`escape`, `enter`, `tab`, `delete`,
 * `space`, arrow keys `up`/`down`/`left`/`right`, `home`/`end`/`pageUp`/
 * `pageDown`) plus the mouse-only `middle` button matcher. The shared
 * names `left` / `right` are disambiguated at emit time via `ctx.event`
 * (keydown/keyup → ArrowLeft/ArrowRight; click/mousedown → button === 0/2).
 *
 * Pipeline kind: `filter` — each emitter inserts an early-return guard
 * matching the relevant key/button.
 *
 * `registerKeyFilters(registry)` is the only function in this module that
 * mutates the registry; it is intended to be called from
 * `registerBuiltins(registry)`. Importing this module by itself has NO
 * module-import side effects per D-22.
 */
import type { ModifierImpl, ModifierRegistry } from '../ModifierRegistry.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

/**
 * The full set of key/button filter names recognized by the default
 * registry. Keep this list deterministic — it locks the public surface
 * via `fixtures/modifiers/registry-builtins.snap`.
 */
export const KEY_FILTER_NAMES = [
  'escape',
  'enter',
  'tab',
  'delete',
  'space',
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'pageUp',
  'pageDown',
  'middle',
] as const;

export type KeyFilterName = (typeof KEY_FILTER_NAMES)[number];

function makeFilter(name: KeyFilterName): ModifierImpl {
  return {
    name,
    arity: 'none',
    resolve(args, ctx) {
      if (args.length !== 0) {
        const diagnostics: Diagnostic[] = [
          {
            code: RozieErrorCode.MODIFIER_ARITY_MISMATCH,
            severity: 'error',
            message: `'.${name}' takes no arguments (got ${args.length})`,
            loc: ctx.sourceLoc,
          },
        ];
        return { entries: [], diagnostics };
      }
      return {
        entries: [
          {
            kind: 'filter',
            modifier: name,
            args: [],
            sourceLoc: ctx.sourceLoc,
          },
        ],
        diagnostics: [],
      };
    },
  };
}

/**
 * Pre-built ModifierImpl objects for every key/button filter name.
 * Order matches KEY_FILTER_NAMES.
 */
export const keyFilters: readonly ModifierImpl[] = KEY_FILTER_NAMES.map(makeFilter);

/**
 * Register all 14 key/button filters into the given registry. Called
 * from registerBuiltins(registry); third-party callers may use directly
 * if building a custom registry that wants the default key set.
 */
export function registerKeyFilters(registry: ModifierRegistry): void {
  for (const impl of keyFilters) {
    registry.register(impl);
  }
}
