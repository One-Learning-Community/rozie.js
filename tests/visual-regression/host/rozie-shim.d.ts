// Ambient module declaration for `.rozie` imports in the visual-regression host.
//
// Unlike the per-demo consumers (each of which shims `.rozie` to ONE framework's
// component type), this host imports `.rozie` files across all 6 targets — the
// same source path resolves to a Vue SFC, a React component, a Svelte component,
// an Angular class, a Solid component, or a Lit custom-element module depending
// on which `Rozie({ target })` sub-build is compiling it. A single static type
// cannot describe all six, so the shim is intentionally permissive; each
// `host/entry.<target>.ts` casts the dynamic-import result to the shape that
// target's runtime mount API expects.
declare module '*.rozie' {
  // biome-ignore lint/suspicious/noExplicitAny: the same .rozie path compiles to six different framework component types across the per-target sub-builds; the entry files cast per target.
  const Component: any;
  export default Component;
}
