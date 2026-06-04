# @rozie/runtime-react

Tree-shakable runtime helpers consumed by React components emitted by `@rozie/target-react`. Implements the modifier and binding behaviors that don't have a 1:1 React equivalent — controllable (`model: true`) state, outside-click detection, debounce/throttle wrappers, key filters, attribute/listener normalization, and crash-safe interpolation — so the emitter can stay declarative and the runtime cost stays minimal.

## Status

Shipped. Used end-to-end by the React reference examples and engine-wrapper demos, and validated under `<React.StrictMode>` by the React consumer e2e suite. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). It is declared as a peer dependency of `@rozie/unplugin`, so projects using the unplugin must install both.

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/runtime-react": "workspace:*",
    "react": "^18.2 || ^19"
  }
}
```

## Usage

You normally do not import this package by hand — `@rozie/target-react` injects the imports it needs into emitted components. The published shape, for reference:

```ts
import {
  useControllableState,
  useOutsideClick,
  rozieDisplay,
} from '@rozie/runtime-react';

// Inside a component emitted from a .rozie file:
const [value, setValue] = useControllableState({ prop, defaultValue, onChange });
```

## Public exports

- **Hooks:** `useControllableState`, `useOutsideClick`, `useDebouncedCallback`, `useThrottledCallback`
- **Interpolation:** `rozieDisplay` (Phase 26 safe non-primitive interpolation — `toDisplayString` semantics, crash-safe)
- **Class names:** `clsx`
- **Style/attr/listener normalization:** `parseInlineStyle`, `toStyleObjectKey`, `normalizeAttrs`, `REACT_ATTR_KEY_MAP`, `normalizeListeners`, `REACT_LISTENER_KEY_MAP`, `mergeListeners`
- **Key filters:** `isEnter`, `isEscape`, `isTab`, `isSpace`, `isUp`, `isDown`, `isLeft`, `isRight`, `isCtrl`, `isAlt`, `isShift`, `isMeta`
- **Types:** `UseControllableStateOpts`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
