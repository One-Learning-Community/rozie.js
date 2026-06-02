// Phase 22 (REQ-1/R2/R3/R9): this demo now consumes the per-module
// `<Name>.d.rozie.ts` sidecars emitted by @rozie/unplugin's buildStart hook —
// each gives a consumer `import Foo, { type FooProps } from './Foo.rozie'`
// REAL React types (props interface, event callbacks, `$expose` handle).
//
// The former broad `declare module '*.rozie'` wildcard is DEMOTED (deleted for
// this demo, which migrates 100% cleanly — every `.rozie` here has a sidecar).
// A broad active wildcard would SHADOW the per-module sidecars (TS2614 / silent
// type-lying — REQ-6's exact concern; verified: with the wildcard present the
// typo-probe's prop access resolves to the wildcard's `Record<string,unknown>`
// and the `@ts-expect-error` is reported UNUSED). See SPIKE-FINDINGS.md.
//
// If a `.rozie` file ever lacks a sidecar at typecheck time, run the demo's
// `build` first (the buildStart hook emits all sidecars) — do NOT re-add a
// broad wildcard fallback, which reintroduces the shadowing.
export {};
