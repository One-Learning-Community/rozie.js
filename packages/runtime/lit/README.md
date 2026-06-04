# @rozie/runtime-lit

Tree-shakable runtime helpers consumed by Lit components emitted by `@rozie/target-lit`. Implements the modifier and binding behaviors that don't have a 1:1 Lit equivalent — controllable (`model: true`) properties, outside-click detection, debounce/throttle wrappers, key filters, spread/listener application, shadow-DOM style bridging, post-DOM-mutation reconciliation, and crash-safe interpolation — so the emitter can stay declarative and the runtime cost stays minimal.

## Status

Shipped. Used end-to-end by the Lit reference examples and engine-wrapper demos, and validated through the Lit visual-regression matrix. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). It is declared as a peer dependency of `@rozie/unplugin`, so projects using the unplugin must install both.

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/runtime-lit": "workspace:*",
    "lit": "^3.2.0",
    "@lit-labs/preact-signals": "^1.0.0",
    "@preact/signals-core": "^1.3.0"
  }
}
```

## Usage

You normally do not import this package by hand — `@rozie/target-lit` injects the imports it needs into emitted components. The published shape, for reference:

```ts
import {
  createLitControllableProperty,
  attachOutsideClickListener,
  rozieDisplay,
} from '@rozie/runtime-lit';
```

## Public exports

- **Reactive properties / lifecycle:** `createLitControllableProperty`, `observeRozieSlotCtx`, `attachOutsideClickListener`, `__rozieReconcileAfterDomMutation`
- **Spread / listeners:** `rozieSpread`, `rozieListeners`
- **Timing:** `debounce`, `throttle`
- **Style bridging:** `injectGlobalStyles`, `adoptConsumerStyles`
- **Interpolation:** `rozieDisplay` (Phase 26 safe non-primitive interpolation — `toDisplayString` semantics, crash-safe)
- **Key filters:** `isEnter`, `isEscape`, `isTab`, `isSpace`, `isUp`, `isDown`, `isLeft`, `isRight`, `isCtrl`, `isAlt`, `isShift`, `isMeta`
- **Types:** `LitControllableProperty`, `DebouncedFn`, `ReconcilableHost`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
