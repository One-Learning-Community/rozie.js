---
"@rozie-ui/select-react": patch
"@rozie-ui/select-vue": patch
"@rozie-ui/select-svelte": patch
"@rozie-ui/select-angular": patch
"@rozie-ui/select-solid": patch
"@rozie-ui/select-lit": patch
---

New family: `@rozie-ui/select`, the simple select. It replaces `@rozie-ui/listbox` (only `listbox-solid` was ever published; it will be deprecated in favour of `select-solid` after this release).

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
