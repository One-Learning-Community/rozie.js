# @rozie/runtime-solid

Tree-shakable runtime helpers consumed by Solid components emitted by `@rozie/target-solid`. Implements the modifier and binding behaviors that don't have a 1:1 Solid equivalent — controllable (`model: true`) signals, outside-click detection, debounce/throttle wrappers, key filters, attribute/listener normalization, runtime style injection, and crash-safe interpolation — so the emitter can stay declarative and the runtime cost stays minimal.

## Status

Shipped. Used end-to-end by the Solid reference examples and engine-wrapper demos, and validated through the Solid visual-regression matrix. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). It is declared as a peer dependency of `@rozie/unplugin`, so projects using the unplugin must install both.

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/runtime-solid": "workspace:*",
    "solid-js": "^1.8"
  }
}
```

## Usage

You normally do not import this package by hand — `@rozie/target-solid` injects the imports it needs into emitted components. The published shape, for reference:

```ts
import {
  createControllableSignal,
  createOutsideClick,
  rozieDisplay,
} from '@rozie/runtime-solid';

// Inside a component emitted from a .rozie file:
const [value, setValue] = createControllableSignal({ prop, defaultValue, onChange });
```

## Public exports

- **Reactive primitives:** `createControllableSignal`, `createOutsideClick`, `createDebouncedHandler`, `createThrottledHandler`
- **Interpolation:** `rozieDisplay` (Phase 26 safe non-primitive interpolation — `toDisplayString` semantics, crash-safe)
- **Style/attr/listener normalization:** `parseInlineStyle`, `toStyleObjectKey`, `normalizeAttrs`, `SOLID_ATTR_KEY_MAP`, `normalizeListeners`, `SOLID_LISTENER_KEY_MAP`, `mergeListeners`, `__rozieInjectStyle`
- **Key filters:** `isEnter`, `isEscape`, `isTab`, `isSpace`, `isUp`, `isDown`, `isLeft`, `isRight`, `isCtrl`, `isAlt`, `isShift`, `isMeta`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
