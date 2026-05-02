/**
 * Key-filter predicates for `@rozie/runtime-vue`.
 *
 * Mirrors Phase 2's `KEY_FILTER_NAMES` set (`packages/core/src/modifiers/
 * builtins/keyFilters.ts`) — these predicates are emitted as guard checks
 * inside `watchEffect`-wrapped global listeners (`<listeners>` block) when
 * the listener has a key-filter modifier such as `keydown.escape`.
 *
 * Vue's native `@event.<modifier>` form is reserved for template @event
 * listeners (D-39 native passthrough) where Vue's runtime applies the
 * filter automatically. For `<listeners>`-block entries (which compile
 * into raw `addEventListener` registrations inside `watchEffect`), the
 * emitter generates `if (!isEscape(e)) return;` guards using these
 * predicates instead.
 *
 * `isCtrl/isAlt/isShift/isMeta` are modifier-key predicates — generally
 * combined with another key check (e.g. `if (!(isCtrl(e) && isEnter(e)))
 * return;`).
 *
 * @public — runtime API consumed by emitted Vue SFCs.
 */
export const isEnter = (e: KeyboardEvent): boolean => e.key === 'Enter';
export const isEscape = (e: KeyboardEvent): boolean => e.key === 'Escape';
export const isTab = (e: KeyboardEvent): boolean => e.key === 'Tab';
export const isSpace = (e: KeyboardEvent): boolean => e.key === ' ';
export const isDelete = (e: KeyboardEvent): boolean =>
  e.key === 'Delete' || e.key === 'Backspace';
export const isUp = (e: KeyboardEvent): boolean => e.key === 'ArrowUp';
export const isDown = (e: KeyboardEvent): boolean => e.key === 'ArrowDown';
export const isLeft = (e: KeyboardEvent): boolean => e.key === 'ArrowLeft';
export const isRight = (e: KeyboardEvent): boolean => e.key === 'ArrowRight';
export const isCtrl = (e: KeyboardEvent): boolean => e.ctrlKey;
export const isAlt = (e: KeyboardEvent): boolean => e.altKey;
export const isShift = (e: KeyboardEvent): boolean => e.shiftKey;
export const isMeta = (e: KeyboardEvent): boolean => e.metaKey;
