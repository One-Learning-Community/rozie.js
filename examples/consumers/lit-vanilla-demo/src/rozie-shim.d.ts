// Lit-vanilla-demo .rozie module shim.
//
// `src/main.ts` imports each `./rozie/Foo.rozie` for its side effect — the
// compiled Lit class's `@customElement('rozie-foo')` decorator runs at module
// load and registers the custom element via `customElements.define`. Without
// this ambient declaration `tsc --noEmit` reports "Cannot find module
// './rozie/Foo.rozie'" because TypeScript's bundler-mode resolver can't
// follow the unplugin's `.rozie → Foo.rozie.ts → Lit class` chain at
// pure-typecheck time (no Vite plugin pipeline runs).
//
// Empty declaration is enough: main.ts uses these as side-effect imports only;
// they don't expose a default export that consumers reference by type. The
// equivalent shim for the Lit type-check fixture workspace lives at
// `examples/consumers/lit-ts/fixtures/rozie-shim.d.ts`.
declare module '*.rozie';
