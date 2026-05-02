# @rozie/target-svelte

Svelte 5+ emitter for Rozie.js. Will turn a framework-neutral `RozieIR` from `@rozie/core` into a `.svelte` file using runes (`$state`, `$derived`, `$effect`, `$bindable`), `{#each}` blocks for `r-for`, and `{#snippet}` parameters for named slots consumed via `{@render trigger?.(ctx)}`.

## Status

Phase 1: placeholder, no implementation yet. The package is scaffolded so the workspace topology is stable; the real emitter lands in **Phase 5** of the roadmap (in parallel with `@rozie/target-angular`).

The current `src/index.ts` exports only a placeholder symbol (`__rozieTargetSveltePlaceholder`).

## Install

Internal-only, not yet published (version `0.0.0`). There is nothing useful to install yet.

## Usage

Not yet implemented. Once Phase 5 ships, the public surface will mirror `@rozie/target-vue`:

```ts
// Anticipated Phase 5 shape — not yet available.
import { emitSvelte } from '@rozie/target-svelte';
const { code, map, diagnostics } = emitSvelte(ir, { filename, source });
```

Consumers will typically use `@rozie/unplugin` rather than calling this package directly.

## Public exports

- `__rozieTargetSveltePlaceholder` (placeholder constant; will be replaced in Phase 5)

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../../.planning/PROJECT.md)
- Roadmap (Phase 5 plan for this package): [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
