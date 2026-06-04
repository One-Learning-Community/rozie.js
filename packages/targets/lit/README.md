# @rozie/target-lit

Lit 3+ web-component emitter for Rozie.js. Turns a framework-neutral `RozieIR` from `@rozie/core` into a `LitElement` `.ts` component using reactive `@property` declarations, the `repeat()` directive for keyed lists, and `createLitControllableProperty` for `model: true` props. Styles are scoped through the shadow DOM and bridged to consumer stylesheets via `adoptedStyleSheets`.

## Status

Shipped. Reference examples and engine-wrapper demos are validated through the Lit visual-regression matrix, and the emitter is exercised by the target-lit snapshot suite. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Most consumers should depend on [`@rozie/unplugin`](../../unplugin) (or [`@rozie/cli`](../../cli)) instead of calling this package directly.

## Usage

`@rozie/unplugin` handles the parse → lower → emit chain transparently when you `import Foo from './Foo.rozie'`. Call `emitLit` directly only if you are building a custom pipeline:

```ts
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitLit } from '@rozie/target-lit';

const { ast } = parse(source, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });

const { code, map, diagnostics } = emitLit(ir!, { filename: 'Counter.rozie', source });
// `code` is a LitElement .ts component; `map` references the original .rozie file.
```

## Public exports

- `emitLit(ir, opts?) => { code, map, diagnostics }`
- `emitLitTypes(...)` — `.d.rozie.ts` synthesis (element class + `HTMLElementTagNameMap`)
- Types: `EmitLitOptions`, `EmitLitResult`, `EmitLitTypesOptions`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
