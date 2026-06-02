// Phase 22 (REQ-1/R3/R4/R9): this demo consumes the per-module
// `<Name>.d.rozie.ts` sidecars emitted by @rozie/unplugin's buildStart hook —
// `import Foo, { type FooProps } from './Foo.rozie'` gets REAL Vue types
// (`DefineComponent<FooProps>` + event callbacks). Per SPIKE-FINDINGS, vue-tsc
// honors the sidecar under the `moduleResolution: bundler` DEFAULT — NO
// `allowArbitraryExtensions` flag is needed for Vue (unlike svelte/angular), and
// the sidecar TAKES PRECEDENCE over the wildcard below.
//
// DEMOTED FALLBACK (SPEC deprecate-don't-delete): the broad `*.rozie` wildcard
// is retained ONLY as the migration fallback for this demo's CROSS-ROOT
// `.rozie` imports (`src/pages/*.vue` import `../../../../Foo.rozie` from the
// repo-level `examples/` dir, OUTSIDE this demo's sidecar-generation roots, so
// they have no per-module sidecar). For the in-`src` sidecar'd files
// (Modal/ModalConsumer/WrapperModal/SourceMapTrigger) the sidecar wins — the
// typo-probe's `@ts-expect-error` is genuinely consumed (verified), NOT
// shadowed. It is NOT type-lying for sidecar'd files; it only types the
// un-sidecar'd cross-root imports.
//
// @deprecated — remove once the cross-root example imports gain sidecars.
declare module '*.rozie' {
  import type { DefineComponent } from 'vue';
  // biome-ignore lint/suspicious/noExplicitAny: fallback-only — per-module sidecars carry the real per-component prop/slot/event types and take precedence (REQ-1..R3).
  const Component: DefineComponent<any, any, any>;
  export default Component;
}
