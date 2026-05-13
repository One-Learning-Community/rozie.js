/**
 * Key-filter predicates for `@rozie/runtime-lit`.
 *
 * Pure functions (NOT class members or signals) — mirror @rozie/runtime-react's
 * keyFilter.ts. The compiler's `inlineGuard` codepath usually handles `.escape`
 * / `.enter` etc. by inlining the comparison directly in the handler body —
 * these exports exist for the rare consumer that wants a named predicate.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
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
