// Phase 22 (REQ-1/R3/R4/R9): this demo consumes the per-module
// `<Name>.d.rozie.ts` sidecars emitted by @rozie/unplugin's buildStart hook —
// `import Foo, { type FooProps } from './Foo.rozie'` gets REAL Solid types
// (`Component<FooProps>` + event callbacks). Resolution requires
// `allowArbitraryExtensions: true` (set in tsconfig.json): TS resolves
// `./Foo.rozie` → `Foo.d.rozie.ts`.
//
// DEMOTED FALLBACK (SPEC deprecate-don't-delete): the broad `*.rozie` wildcard
// below is retained ONLY as the migration fallback for this demo's CROSS-ROOT
// `.rozie` imports (`src/pages/*.tsx` import `../../../../Foo.rozie` from the
// repo-level `examples/` dir, which is OUTSIDE this demo's sidecar-generation
// roots and therefore has no per-module sidecar). With
// `allowArbitraryExtensions: true` set, a present per-module sidecar TAKES
// PRECEDENCE over this wildcard (verified — the typo-probe's `@ts-expect-error`
// is genuinely consumed, NOT shadowed; see SPIKE-FINDINGS.md "the wildcard can
// remain as the documented migration fallback"). It is NOT type-lying for the
// in-`src` sidecar'd files; it only types the un-sidecar'd cross-root imports.
//
// @deprecated — remove once the cross-root example imports gain sidecars.
declare module '*.rozie' {
  import type { Component } from 'solid-js';
  const component: Component<Record<string, unknown>>;
  export default component;
}
