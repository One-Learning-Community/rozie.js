/**
 * Key-filter predicates for `@rozie/runtime-react`.
 *
 * Pure functions (NOT hooks) — mirror the subset of `@rozie/runtime-vue`'s
 * keyFilter.ts that have direct React `KeyboardEvent.key` equivalents. The
 * compiler's `inlineGuard` codepath usually handles `.escape` / `.enter` etc.
 * by inlining the comparison directly in the handler body — these exports
 * exist for the rare consumer that wants a named predicate (or to dogfood
 * the runtime helper from hand-written JSX).
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
export const isEnter = (e: KeyboardEvent): boolean => e.key === 'Enter';
export const isEscape = (e: KeyboardEvent): boolean => e.key === 'Escape';
export const isTab = (e: KeyboardEvent): boolean => e.key === 'Tab';
export const isSpace = (e: KeyboardEvent): boolean => e.key === ' ';
export const isUp = (e: KeyboardEvent): boolean => e.key === 'ArrowUp';
export const isDown = (e: KeyboardEvent): boolean => e.key === 'ArrowDown';
export const isLeft = (e: KeyboardEvent): boolean => e.key === 'ArrowLeft';
export const isRight = (e: KeyboardEvent): boolean => e.key === 'ArrowRight';
export const isCtrl = (e: KeyboardEvent): boolean => e.ctrlKey;
export const isAlt = (e: KeyboardEvent): boolean => e.altKey;
export const isShift = (e: KeyboardEvent): boolean => e.shiftKey;
export const isMeta = (e: KeyboardEvent): boolean => e.metaKey;
