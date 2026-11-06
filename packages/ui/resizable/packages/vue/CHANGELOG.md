# @rozie-ui/resizable-vue

## 0.1.7

### Patch Changes

- cd0956c: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

- cd0956c: First npm release of the React, Vue, Svelte, Angular and Lit packages. The Solid package has been on npm since September 2026; this version brings all six targets to the same component revision.
- cd0956c: Regenerated with the Vue string-ARIA fix: a nullable value bound to a string ARIA attribute (for example `aria-label`) on an HTML element is emitted with an `undefined` fallback, so a strict TypeScript consumer compiling the component's `.vue` source typechecks. Rendered markup is unchanged.

## 0.1.1

### Patch Changes

- @rozie/runtime-vue@0.2.0
