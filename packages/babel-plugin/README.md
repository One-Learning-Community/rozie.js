# @rozie/babel-plugin

A Babel 7+ plugin that detects `.rozie` imports and replaces them with the compiled per-target module by calling into `@rozie/core`'s `compile()` function. Provides functional parity with `@rozie/unplugin` for non-Vite Babel pipelines (e.g., Babel-driven library builds, Metro / React Native, custom toolchains).

## Status

Phase 1: placeholder, no implementation yet. The package is scaffolded so the workspace topology is stable; the real plugin lands in **Phase 6** of the roadmap. It is intentionally thin — the plan calls for ~50 LOC because the heavy lifting lives in `@rozie/core.compile()`. Phase 6 ships a snapshot test that gates byte-identical output across the Vite plugin, Babel plugin, and CLI entrypoints.

The current `src/index.ts` exports only a placeholder symbol (`__rozieBabelPluginPlaceholder`).

## Install

Internal-only, not yet published (version `0.0.0`). There is nothing useful to install yet.

## Usage

Not yet implemented. Once Phase 6 ships, the typical Babel config will look like:

```jsonc
// babel.config.json — anticipated Phase 6 shape, not yet available.
{
  "plugins": [
    ["@rozie/babel-plugin", { "target": "vue" }]
  ]
}
```

For the Vite-plugin path (which works today for Vue), see [`@rozie/unplugin`](../unplugin) instead.

## Public exports

- `__rozieBabelPluginPlaceholder` (placeholder constant; will be replaced in Phase 6)

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../.planning/PROJECT.md)
- Roadmap (Phase 6 plan for this package): [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
