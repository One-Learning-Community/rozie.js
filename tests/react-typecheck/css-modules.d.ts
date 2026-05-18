/**
 * Ambient module declarations so emitted .tsx files can `import styles from
 * './Foo.module.css'` and `import './Foo.global.css'` without tripping TS2307.
 *
 * The React target emits CSS module bindings as part of every component (it's
 * the same path Vue/Svelte/Angular/Solid/Lit use), but our gate test doesn't
 * actually run a CSS-aware bundler — it just hands the .tsx files to tsc.
 * Without these declarations tsc treats the import as a missing module.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
