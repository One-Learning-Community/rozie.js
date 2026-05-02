// TypeScript shim for `.rozie` imports — informs vue-tsc that a `.rozie`
// import resolves to a Vue component. The actual compiled SFC type-checks
// via vue-tsc against the synthesized `.rozie.vue` virtual module produced
// by @rozie/unplugin's resolveId. This shim exists for the consumer-side
// `import Counter from '../../../../Counter.rozie'` syntax to type-check.
//
// @rozie/unplugin's path-virtual chain rewrites the `.rozie` id to a `.vue`
// id at build-time, but TS-only typecheck (vue-tsc --noEmit) does not run
// the resolveId hook — so we declare the module shape here.
declare module '*.rozie' {
  import type { DefineComponent } from 'vue';
  // biome-ignore lint/suspicious/noExplicitAny: per-component prop/slot/event types are emitted by the Rozie compiler in Phase 6 (TYPES-01..03); Phase 3 ships a permissive shim.
  const Component: DefineComponent<any, any, any>;
  export default Component;
}
