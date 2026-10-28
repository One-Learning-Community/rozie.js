# @rozie-ui/select-vue

## 0.1.2

### Patch Changes

- 05cb9db: Regenerated with the Vue string-ARIA fix: a nullable value bound to a string ARIA attribute (for example `aria-label`) on an HTML element is emitted with an `undefined` fallback, so a strict TypeScript consumer compiling the component's `.vue` source typechecks. Rendered markup is unchanged.
  - @rozie/runtime-vue@0.10.1

## 0.1.1

### Patch Changes

- cf49212: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

- d20d282: New family: `@rozie-ui/select`, the simple select. It replaces `@rozie-ui/listbox` (only `listbox-solid` was ever published; it will be deprecated in favour of `select-solid` after this release).

  Compared with `listbox-solid`:
  - The component is `Select`, the element `rozie-select`, classes `.rozie-select-*`, tokens `--rozie-select-*`.
  - The popup is positioned by `@rozie-ui/popover` (a required peer): `placement`, `offset`, `disableFlip`, `disableShift`, `block`.
  - `@tanstack/virtual-core` is now a required peer (it was optional on `listbox-solid`, but the component imports it whether or not `virtual` is set).
  - Option groups: `groups` and a `groupHeading` slot.
  - `clearable` (with `clearLabel`), and multi-select values shown as removable chips with a `chip` slot.
  - `nativePicker`: opt-in OS picker on touch devices.
  - `hideEmpty` and `selectOnTab`.
  - The `id` prop is now `idBase`.
  - Token names follow Combobox's vocabulary (for example `--rozie-select-border-color`, `--rozie-select-list-shadow`, `--rozie-select-option-active-bg`), with the same defaults.
  - The trigger is a `div[role="combobox"]` inside `.rozie-select-control` (was a `button`).
  - The `search` event is no longer part of the surface.
  - @rozie/runtime-vue@0.10.0
