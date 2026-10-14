---
"@rozie-ui/dialog-angular": patch
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-svelte": patch
"@rozie-ui/dialog-vue": patch
"@rozie-ui/lexical-lit": patch
"@rozie-ui/maplibre-angular": patch
"@rozie-ui/maplibre-lit": patch
"@rozie-ui/maplibre-react": patch
"@rozie-ui/maplibre-svelte": patch
"@rozie-ui/maplibre-vue": patch
"@rozie-ui/number-field-angular": patch
"@rozie-ui/number-field-react": patch
"@rozie-ui/number-field-vue": patch
"@rozie-ui/pagination-angular": patch
"@rozie-ui/pagination-react": patch
"@rozie-ui/pagination-vue": patch
"@rozie-ui/resizable-angular": patch
"@rozie-ui/resizable-react": patch
"@rozie-ui/resizable-vue": patch
"@rozie-ui/slider-angular": patch
"@rozie-ui/slider-react": patch
"@rozie-ui/slider-vue": patch
"@rozie-ui/switch-angular": patch
"@rozie-ui/switch-react": patch
"@rozie-ui/switch-vue": patch
---

Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:

- Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
- Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
- React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
- Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
- Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.
