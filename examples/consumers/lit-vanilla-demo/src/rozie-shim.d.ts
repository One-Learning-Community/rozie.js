// Lit-vanilla-demo .rozie module shim — Phase 22 (REQ-1/R4/R9).
//
// This demo now consumes the per-module `<Name>.d.rozie.ts` sidecars emitted
// by @rozie/unplugin's buildStart hook. For Lit the payoff is the
// `declare global { interface HTMLElementTagNameMap { 'rozie-<name>': <Name> } }`
// entry each sidecar carries: `import './rozie/Counter.rozie'` (a side-effect
// import that registers the custom element) ALSO loads that global
// augmentation, so `document.querySelector('rozie-counter')` is typed as the
// `Counter` element (NOT `Element | null`). Resolution requires
// `allowArbitraryExtensions: true` (set in tsconfig.json): TS resolves
// `./rozie/Foo.rozie` → `rozie/Foo.d.rozie.ts`.
//
// The former bare `declare module '*.rozie';` wildcard is DEMOTED (deleted —
// this demo migrates 100% cleanly; every `.rozie` import here is in-`src` and
// has a sidecar). A broad active wildcard SHADOWS the per-module sidecars,
// suppressing the `HTMLElementTagNameMap` typing (the typo-probe's
// `@ts-expect-error` would be reported UNUSED — T-22-06-01). Do NOT re-add it.
export {};
