/**
 * Ambient module declaration so emitted .tsx files can side-effect-import
 * `import './Foo.css'` (and `import './Foo.global.css'`) without tripping
 * TS2307.
 *
 * Phase 25 de-CSS-Modules: React now emits plain `className="x"` strings + a
 * side-effect `import './Foo.css'` — it NO LONGER emits a CSS-Modules default
 * binding. The former CSS-Modules ambient default-export shim is therefore
 * removed: keeping it would mask a stray CSS-Modules import regression (a
 * surviving stale import would resolve against the dead shim instead of
 * failing). The `*.css` side-effect declaration is all the emitted output
 * needs. Our gate test hands the .tsx files to tsc without a CSS-aware
 * bundler, so without this declaration tsc treats the import as missing.
 */
declare module '*.css';
