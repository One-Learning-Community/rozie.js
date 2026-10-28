---
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/pagination-angular": patch
"@rozie-ui/pagination-react": patch
"@rozie-ui/pagination-vue": patch
---

Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:

- Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
- Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
- React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
- Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
- Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.
