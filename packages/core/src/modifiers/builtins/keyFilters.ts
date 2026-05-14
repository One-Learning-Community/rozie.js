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

/**
 * Rozie key/button name → Vue native modifier token map (Phase 3 D-39).
 *
 * Most names match Vue verbatim; the divergence is `escape → esc` per
 * `[CITED: vuejs.org/guide/essentials/event-handling#event-modifiers]` and
 * RESEARCH.md line 583. Vue's recognized list: `.enter .tab .delete .esc
 * .space .up .down .left .right .ctrl .alt .shift .meta`. Mouse buttons
 * `.left .middle .right` overlap with the arrow keys by name; Vue
 * disambiguates by event (`@click.left` vs `@keydown.left`) — the same
 * Rozie modifier token therefore covers both interpretations and the
 * vue token stays equal to the Rozie name.
 */
const VUE_KEY_TOKEN_MAP: Record<KeyFilterName, string> = {
  escape: 'esc',
  enter: 'enter',
  tab: 'tab',
  delete: 'delete',
  space: 'space',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  home: 'home',
  end: 'end',
  pageUp: 'pageUp',
  pageDown: 'pageDown',
  middle: 'middle',
};

/**
 * Rozie key/button name → React KeyboardEvent.key value map (Phase 4 D-65).
 *
 * React uses the standard DOM `KeyboardEvent.key` strings (NOT Vue's short
 * tokens). Notable divergences:
 *   - Rozie's `escape` → React `'Escape'` (Vue uses `'esc'`)
 *   - Rozie's `space`  → React `' '` (literal space character per the
 *     KeyboardEvent.key spec)
 *   - Rozie's `up/down/left/right` → React `'ArrowUp'/'ArrowDown'/...` when
 *     the surrounding event is a keyboard event. Mouse-button overlap on
 *     `left/middle/right` is disambiguated by the emitter via ctx.event;
 *     this map covers the keyboard interpretation only.
 *   - Rozie's `pageUp/pageDown` → React `'PageUp'/'PageDown'` (Pascal-cased
 *     vs Vue's camelCase token)
 *
 * `middle` has no keyboard interpretation; the Phase 4 emitter is expected
 * to consult ctx.event and route to a mouse-button guard (e.button === 1)
 * for click-style events. Plan 04-03 will add the disambiguation; for v1
 * this map provides the keyboard fallback only.
 */
const REACT_KEY_NAME_MAP: Record<KeyFilterName, string> = {
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  delete: 'Delete',
  space: ' ',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageUp: 'PageUp',
  pageDown: 'PageDown',
  middle: 'Middle', // keyboard-fallback — emitter overrides for mouse events
};

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
    vue() {
      // D-39 native pass-through with Rozie → Vue name remap (escape → esc).
      return { kind: 'native', token: VUE_KEY_TOKEN_MAP[name] };
    },
    react() {
      // D-65 inlineGuard: React JSX has no native key-filter modifiers —
      // emitter inserts an early-return guard checking KeyboardEvent.key
      // against the standard DOM string for this Rozie name.
      const reactKey = REACT_KEY_NAME_MAP[name];
      return {
        kind: 'inlineGuard',
        code: `if (e.key !== '${reactKey}') return;`,
      };
    },
    svelte() {
      // Phase 5 inlineGuard: Svelte 5 has no key-modifier syntax (RESEARCH.md
      // Pattern 4 — Svelte 5 dropped both `on:click|preventDefault` shorthand
      // AND key modifiers). Emitter inserts an early-return guard checking
      // KeyboardEvent.key — identical pattern to React side.
      const reactKey = REACT_KEY_NAME_MAP[name];
      return {
        kind: 'inlineGuard',
        code: `if (e.key !== '${reactKey}') return;`,
      };
    },
    angular() {
      // Phase 5 inlineGuard: Angular's `(keydown.escape)` syntax is legacy
      // and incompatible with `(keydown)="h($event)"` arrow form (RESEARCH.md
      // Pattern 9). Emitter inserts an early-return guard checking
      // KeyboardEvent.key — identical pattern to React side.
      const reactKey = REACT_KEY_NAME_MAP[name];
      return {
        kind: 'inlineGuard',
        code: `if (e.key !== '${reactKey}') return;`,
      };
    },
    solid() {
      // Phase 07.1 inlineGuard: Solid JSX has no native key-filter modifiers —
      // emitter inserts an early-return guard checking KeyboardEvent.key
      // against the standard DOM string for this Rozie name.
      const reactKey = REACT_KEY_NAME_MAP[name];
      return {
        kind: 'inlineGuard',
        code: `if (e.key !== '${reactKey}') return;`,
      };
    },
    lit() {
      // Phase 07.1 inlineGuard: Lit has no key-modifier syntax — emitter
      // inserts an early-return guard checking KeyboardEvent.key against the
      // standard DOM string for this Rozie name.
      const reactKey = REACT_KEY_NAME_MAP[name];
      return {
        kind: 'inlineGuard',
        code: `if (e.key !== '${reactKey}') return;`,
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
