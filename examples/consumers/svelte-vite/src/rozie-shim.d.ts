// TypeScript shim for `.rozie` imports — informs svelte-check / tsc that a
// `.rozie` import resolves to a Svelte component. The actual compiled SFC
// type-checks via svelte-check against the synthesized `.rozie.svelte`
// virtual module produced by @rozie/unplugin's resolveId. This shim exists
// for the consumer-side `import Counter from '../../../../Counter.rozie'`
// syntax to type-check.
//
// @rozie/unplugin's path-virtual chain rewrites the `.rozie` id to a
// `.svelte` id at build-time, but TS-only typecheck (svelte-check) does not
// run the resolveId hook — so we declare the module shape here. Plan 05-02
// finalises this to a more useful Component<Props> shape via Phase 6
// TYPES-01..03.
declare module '*.rozie' {
  import type { Component } from 'svelte';
  const component: Component;
  export default component;
}
