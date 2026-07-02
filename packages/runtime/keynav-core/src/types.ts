/**
 * Shared config/host types for `@rozie/runtime-keynav-core`.
 *
 * These are the framework-neutral shapes every per-target `r-keynav`
 * controller (React/Vue/Svelte/Solid/Lit hooks + the Angular inline
 * controller) builds its host adapter against. Nothing here imports a
 * framework or the DOM lib — `KeynavKeyboardEvent` is a structural
 * duck-type that a real `KeyboardEvent` satisfies without this package
 * ever depending on `lib.dom.d.ts` (SPEC §8, Phase 71 Plan 03 Task 1).
 *
 * @public — runtime API consumed by all six per-target keynav controllers.
 */

/** `r-keynav:<focus-model>` — the directive argument (SPEC §3). */
export type KeynavFocusModel = 'tabindex' | 'activedescendant';

/** `.vertical` (default) / `.horizontal` / `.both` (SPEC §3). */
export type KeynavOrientation = 'vertical' | 'horizontal' | 'both';

/** Resolved `r-keynav:<focus-model>[.<modifier>…]` configuration. */
export interface KeynavConfig {
  focusModel: KeynavFocusModel;
  orientation: KeynavOrientation;
  /** `.loop` — wrap past the ends (default: clamp). */
  loop: boolean;
  /** `.typeahead` — printable chars jump to a matching item by label. */
  typeahead: boolean;
  /** `.skipdisabled` — skip `disabled` items on arrow moves (default: on). */
  skipDisabled: boolean;
}

/** Per-item metadata resolved from `r-keynav-item="{ label?, disabled? }"`. */
export interface KeynavItemMeta {
  label?: string;
  disabled?: boolean;
}

/**
 * A structural duck-type for the subset of `KeyboardEvent` the state machine
 * reads. A real DOM `KeyboardEvent` satisfies this without importing
 * `lib.dom.d.ts`; a fake in-memory test double does too.
 */
export interface KeynavKeyboardEvent {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  preventDefault(): void;
}

/**
 * The host adapter surface a per-target controller implements to drive
 * `createKeynavStateMachine`. `getSource()` returns the `:source` array (or
 * an equivalent), `getActive()`/`setActive()` bridge to the controller's
 * reactive active-index state, and `commit()` fires `@keynav-commit`
 * (SPEC §6 — active only, never selection).
 */
export interface KeynavHost {
  getSource(): unknown[];
  getActive(): number;
  setActive(i: number): void;
  commit(i: number): void;
  /** Optional full-dataset addressing for virtualized lists (SPEC §10). */
  windower?: import('./windower.js').KeynavWindower;
}
