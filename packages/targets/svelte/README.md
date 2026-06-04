# @rozie/target-svelte

Svelte 5+ emitter for Rozie.js. Turns a framework-neutral `RozieIR` from `@rozie/core` into a `.svelte` file using runes (`$state`, `$derived`, `$effect`, `$bindable`), `{#each}` blocks for `r-for`, and `{#snippet}` parameters for named slots consumed via `{@render trigger?.(ctx)}`. Styles are scoped via Rozie's `[data-rozie-s-<hash>]` rewrite (with a `:global { … }` opt-out for cross-component rules).

## Status

Shipped. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Most consumers should depend on [`@rozie/unplugin`](../../unplugin) (or [`@rozie/cli`](../../cli)) instead of calling this package directly.

## Usage

`@rozie/unplugin` handles the parse → lower → emit chain transparently when you `import Foo from './Foo.rozie'`. Call `emitSvelte` directly only if you are building a custom pipeline:

```ts
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitSvelte } from '@rozie/target-svelte';

const { ast } = parse(source, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });

const { code, map, diagnostics } = emitSvelte(ir!, { filename: 'Counter.rozie', source });
```

## Public exports

- `emitSvelte(ir, opts?) => { code, map, diagnostics }`
- `emitSvelteTypes(...)` — declaration synthesis for the emitted component
- Types: `EmitSvelteOptions`, `EmitSvelteResult`, `EmitSvelteTypesOptions`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
