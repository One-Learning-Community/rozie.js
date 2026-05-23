// @rozie/runtime-vue — D-41 tree-shakable named exports for non-native
// modifier helpers consumed by emitted Vue SFCs.
//
// Plan 01 (P0) shipped a placeholder. Plan 04 (P3) replaces it with real
// helpers per D-40..D-45.
export { useOutsideClick, type OutsideClickOptions } from './useOutsideClick.js';
export { debounce } from './debounce.js';
export { throttle } from './throttle.js';
export {
  isEnter,
  isEscape,
  isTab,
  isSpace,
  isDelete,
  isUp,
  isDown,
  isLeft,
  isRight,
  isCtrl,
  isAlt,
  isShift,
  isMeta,
} from './keyFilter.js';
// Phase 15 (listener fallthrough) — Vue native-element `v-on="<obj>"` helper.
// FORBIDDEN_KEYS-skipping identity over a null-prototype object (A1 / Pitfall 8
// lock — Vue native-element v-on keys stay lowercase, no per-target key remap).
export { normalizeListeners } from './normalizeListeners.js';
