/**
 * Ambient module declaration so the emitted `SortableList.tsx` can
 * `import './SortableList.css'` (a side-effect import) without tripping TS2307
 * under `tsc --noEmit`.
 *
 * Phase 25: the React target no longer routes scoped `<style>` through a sibling
 * CSS-Modules file — `[data-rozie-s-HASH]` attribute scoping is the sole
 * isolation layer, so the emit is a plain `className="x"` + a side-effect
 * `import './SortableList.css'`. This leaf's typecheck gate hands the generated
 * `.tsx` to tsc directly with no CSS-aware bundler in the loop, so the
 * side-effect `.css` import needs this ambient declaration. The old CSS-Modules
 * default-export ambient block was removed (dead after the de-CSS-Modules
 * change; keeping it would mask a stray CSS-Modules import regression). Mirrors
 * tests/react-typecheck/css-modules.d.ts.
 */
declare module '*.css';
