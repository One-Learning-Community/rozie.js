# @rozie/runtime-vue

Tree-shakable runtime helpers consumed by Vue SFCs emitted by `@rozie/target-vue`. Implements the non-native modifier behaviors that don't have a 1:1 Vue equivalent — outside-click detection, debounce/throttle wrappers, and key filters — so the emitter can stay declarative and the runtime cost stays minimal.

## Status

Phase 3: shipped. Used end-to-end by the Phase 3 reference examples (notably `Dropdown.rozie`'s `.outside($refs.triggerEl, $refs.panelEl)` and `SearchInput.rozie`'s `@input.debounce(300)`). Marked `@experimental` until v1.0.

## Install

Internal-only, not yet published (version `0.0.0`). It is declared as a peer dependency of `@rozie/unplugin`, so projects using the unplugin must install both.

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/runtime-vue": "workspace:*",
    "vue": "^3.4"
  }
}
```

## Usage

You normally do not import this package by hand — `@rozie/target-vue` injects the imports it needs into emitted SFCs. The published shape, for reference:

```ts
import {
  useOutsideClick,
  debounce,
  throttle,
  isEnter,
  isEscape,
} from '@rozie/runtime-vue';

// Inside a <script setup> block emitted from a .rozie file:
useOutsideClick(
  [triggerEl, panelEl],
  (event) => close(),
  () => props.open && props.closeOnOutsideClick,
);
```

## Public exports

- **Helpers:** `useOutsideClick`, `debounce`, `throttle`
- **Key filters:** `isEnter`, `isEscape`, `isTab`, `isSpace`, `isDelete`, `isUp`, `isDown`, `isLeft`, `isRight`, `isCtrl`, `isAlt`, `isShift`, `isMeta`
- **Types:** `OutsideClickOptions`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../../.planning/PROJECT.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
