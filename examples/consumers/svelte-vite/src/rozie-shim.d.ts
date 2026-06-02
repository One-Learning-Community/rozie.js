// Phase 22 (REQ-1/R3/R4/R9): this demo now consumes the per-module
// `<Name>.d.rozie.ts` sidecars emitted by @rozie/unplugin's buildStart hook —
// `import Foo, { type FooProps } from './Foo.rozie'` gets REAL Svelte types
// (`Component<FooProps>` + event callbacks).
//
// The former broad `declare module '*.rozie'` wildcard is DEMOTED (deleted for
// this demo, which migrates 100% cleanly — every `.rozie` import here is
// in-`src` and has a sidecar). Per SPIKE-FINDINGS, Svelte (`tsc` + svelte-check)
// honors the sidecar ONLY with `allowArbitraryExtensions: true` (set in
// tsconfig.json); WITHOUT the flag the wildcard SHADOWS the sidecar (TS2614 /
// silent type-lying — REQ-6's concern, the typo-probe's `@ts-expect-error`
// would be reported UNUSED). The flag flip + wildcard demotion land together.
// Do NOT re-add a broad wildcard — it reintroduces the shadowing.
export {};
