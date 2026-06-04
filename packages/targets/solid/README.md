# @rozie/target-solid

Solid 1.x component emitter for Rozie.js. Turns a framework-neutral `RozieIR` from `@rozie/core` into a `.tsx` Solid component using `createSignal`, `createMemo`, the `<For>` control-flow component, and `createControllableSignal` for `model: true` props. Styles are emitted as a scoped string and applied at runtime via a `__rozieInjectStyle` style-injection helper rather than CSS Modules or class-name hashing.

## Status

Shipped. Reference examples and engine-wrapper demos are validated through the Solid visual-regression matrix, and the emitter is exercised by the target-solid snapshot suite. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Most consumers should depend on [`@rozie/unplugin`](../../unplugin) (or [`@rozie/cli`](../../cli)) instead of calling this package directly.

## Usage

`@rozie/unplugin` handles the parse → lower → emit chain transparently when you `import Foo from './Foo.rozie'`. Call `emitSolid` directly only if you are building a custom pipeline:

```ts
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitSolid } from '@rozie/target-solid';

const { ast } = parse(source, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });

const { code, map, diagnostics } = emitSolid(ir!, { filename: 'Counter.rozie', source });
// `code` is a .tsx Solid component; `map` references the original .rozie file.
```

## Public exports

- `emitSolid(ir, opts?) => { code, map, diagnostics }`
- `emitSolidTypes(...)` — `.d.rozie.ts` synthesis for typed `.rozie` imports
- Types: `EmitSolidOptions`, `EmitSolidResult`, `EmitSolidTypesOptions`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
