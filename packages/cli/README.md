# @rozie/cli

The Rozie codegen CLI. Will let component-library authors run `rozie build src/components/ --target react,vue,svelte,angular --out dist/` to emit per-framework source artifacts (plus `.d.ts` and `.map` files) for libraries that prefer to ship pre-compiled per-framework npm packages rather than rely on consumer-side build plugins.

## Status

Phase 1: placeholder, no implementation yet. The package is scaffolded so the workspace topology is stable; the real CLI lands in **Phase 6** of the roadmap, alongside the Babel plugin and `.d.ts` emission hardening. Phase 6 also finalizes `@rozie/core`'s public `compile()` API and a snapshot test gates byte-identical output across all three entrypoints (Vite plugin / Babel plugin / CLI).

The current `src/index.ts` exports only a placeholder symbol (`__rozieCliPlaceholder`).

## Install

Internal-only, not yet published (version `0.0.0`). There is nothing useful to install yet.

## Usage

Not yet implemented. Once Phase 6 ships, the CLI will be invoked as:

```bash
# Anticipated Phase 6 shape — not yet available.
pnpm dlx @rozie/cli build src/components/ \
  --target react,vue,svelte,angular \
  --out dist/
```

For the build-plugin path (which works today for Vue), see [`@rozie/unplugin`](../unplugin) instead.

## Public exports

- `__rozieCliPlaceholder` (placeholder constant; will be replaced in Phase 6)

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../.planning/PROJECT.md)
- Roadmap (Phase 6 plan for this package): [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
