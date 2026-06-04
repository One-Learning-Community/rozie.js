# @rozie/target-react

React 18+ functional-component emitter for Rozie.js. Turns a framework-neutral `RozieIR` from `@rozie/core` into a `.tsx` component using `useState`, statically-computed `useEffect` dependency arrays (derived from auto-tracked signal reads, so output passes `eslint-plugin-react-hooks/exhaustive-deps`), `useControllableState` for `model: true` props, and lifted slot-fallback render-prop function props. Styles are emitted as a plain `.css` file scoped by a `[data-rozie-s-<hash>]` attribute (no CSS Modules, no class-name hashing).

## Status

Shipped. Reference examples and engine-wrapper demos are validated under `<React.StrictMode>`, and the emitter is exercised by the React consumer e2e suite. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Most consumers should depend on [`@rozie/unplugin`](../../unplugin) (or [`@rozie/cli`](../../cli)) instead of calling this package directly.

## Usage

`@rozie/unplugin` handles the parse → lower → emit chain transparently when you `import Foo from './Foo.rozie'`. Call `emitReact` directly only if you are building a custom pipeline:

```ts
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitReact } from '@rozie/target-react';

const { ast } = parse(source, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });

const { code, map, diagnostics } = emitReact(ir!, { filename: 'Counter.rozie', source });
// `code` is a .tsx component; `map` references the original .rozie file.
```

## Public exports

- `emitReact(ir, opts?) => { code, map, diagnostics }`
- `emitReactTypes(...)` — `.d.ts` synthesis for the emitted component
- Types: `EmitReactOptions`, `EmitReactResult`, `EmitReactTypesOptions`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- React-team guide: [`docs/guide/for-react-teams.md`](../../../docs/guide/for-react-teams.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
