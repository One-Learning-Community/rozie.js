# @rozie/target-react

React 18+ functional-component emitter for Rozie.js. Will turn a framework-neutral `RozieIR` from `@rozie/core` into a `.tsx` component using `useState`, statically-computed `useEffect` dep arrays (computed from auto-tracked signal reads), `useControllableState` for `model: true` props, and lifted slot-fallback `renderX` function props.

## Status

Phase 1: placeholder, no implementation yet. The package is scaffolded so the workspace topology is stable; the real emitter lands in **Phase 4** of the roadmap. Phase 4 is the project's marquee technical bet — proving auto-tracked signals can statically compute the React `exhaustive-deps` set — and locks the cross-target slot IR.

The current `src/index.ts` exports only a placeholder symbol (`__rozieTargetReactPlaceholder`).

## Install

Internal-only, not yet published (version `0.0.0`). There is nothing useful to install yet.

## Usage

Not yet implemented. Once Phase 4 ships, the public surface will mirror `@rozie/target-vue`:

```ts
// Anticipated Phase 4 shape — not yet available.
import { emitReact } from '@rozie/target-react';
const { code, map, diagnostics } = emitReact(ir, { filename, source });
```

Consumers will typically use `@rozie/unplugin` rather than calling this package directly.

## Public exports

- `__rozieTargetReactPlaceholder` (placeholder constant; will be replaced in Phase 4)

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../../.planning/PROJECT.md)
- Roadmap (Phase 4 plan for this package): [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
