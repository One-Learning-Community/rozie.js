/**
 * Key-filter predicates for `@rozie/runtime-solid`.
 *
 * Pure functions (NOT reactive) — copy of @rozie/runtime-react's keyFilter.ts.
 * Zero framework coupling; copied verbatim per PATTERNS.md.
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
