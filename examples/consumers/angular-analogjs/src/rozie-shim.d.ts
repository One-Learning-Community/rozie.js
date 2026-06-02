// Phase 22 (REQ-1/R3/R4/R9): this demo now consumes the per-module
// `<Name>.d.rozie.ts` sidecars emitted by @rozie/unplugin's buildStart hook —
// `import Foo, { type FooProps } from './Foo.rozie'` gets REAL Angular types
// (a typed `declare class Foo` + named `FooProps` + `$expose` handle methods).
//
// The former broad `declare module '*.rozie'` wildcard is DEMOTED (deleted for
// this demo, which migrates 100% cleanly — every `.rozie` import here is
// in-`src` and has a sidecar). Per SPIKE-FINDINGS, Angular (`tsc`, typescript
// ~5.9.3) honors the sidecar ONLY with `allowArbitraryExtensions: true` (set in
// tsconfig.json); WITHOUT the flag the wildcard SHADOWS the sidecar (TS2614).
//
// CROSS-ROZIE COMPOSITION (Card → CardHeader, ModalConsumer → Modal/WrapperModal):
// the unplugin's prebuild emits a `<Name>.ts` re-export shim that now points at
// the disk-cache `<Name>.rozie.ts` via its `.rozie.js` specifier — NOT the bare
// `./<Name>.rozie` — so the `.d.rozie.ts` sidecar does NOT shadow the runtime
// VALUE class the `imports: [...]` metadata needs (this closes the Plan-05
// known-red TS2614 entry condition). The sidecar adds the named Props/handle
// type exports the disk-cache lacks; the disk-cache provides the value class.
// Do NOT re-add a broad wildcard — it reintroduces the shadowing.
export {};
