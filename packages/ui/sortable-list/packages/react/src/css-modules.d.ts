/**
 * Ambient module declarations so the emitted `SortableList.tsx` can
 * `import styles from './SortableList.module.css'` (and bare `.css` side-effect
 * imports) without tripping TS2307 under `tsc --noEmit`.
 *
 * The React target emits CSS-module bindings as part of every component — the
 * same path Vue/Svelte/Angular/Solid/Lit use — but this leaf's typecheck gate
 * hands the generated `.tsx` to tsc directly, with no CSS-aware bundler in the
 * loop. Without these declarations tsc treats the import as a missing module.
 * Mirrors tests/react-typecheck/css-modules.d.ts.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
