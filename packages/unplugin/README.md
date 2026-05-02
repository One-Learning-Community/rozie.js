# @rozie/unplugin

The universal build-tool plugin for Rozie.js, authored once via `unplugin` v3 and exposed as Vite, Rollup, Webpack, esbuild, Rolldown, and Rspack adapters. Wires `import Foo from './Foo.rozie'` directly into any of those build pipelines — no codegen ceremony, full HMR, source maps back to the original `.rozie` file.

## Status

Phase 3: shipped — the **Vite** entry (`@rozie/unplugin/vite`) is fully wired and CI-tested against the five reference examples in `examples/consumers/vue-vite/`. The other entries (`/rollup`, `/webpack`, `/esbuild`, `/rolldown`, `/rspack`) exist for symmetry but are not CI-tested until Phase 6 (DIST distribution hardening). Marked `@experimental` until v1.0.

The plugin currently dispatches to `@rozie/target-vue` only; React/Svelte/Angular dispatch lands as their target emitters ship in Phases 4-5. Today, calling `Rozie({ target: 'react' })` (or `'svelte'`, `'angular'`) throws `ROZ402` synchronously at config-load.

## Install

Internal-only, not yet published (version `0.0.0`). Inside the monorepo:

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/unplugin": "workspace:*",
    "@rozie/runtime-vue": "workspace:*",
    "@vitejs/plugin-vue": "^6",
    "vue": "^3.4"
  }
}
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  // Rozie() MUST come BEFORE vue() — it rewrites Foo.rozie -> Foo.rozie.vue
  // via resolveId so vite-plugin-vue can pick up the synthetic id naturally.
  plugins: [Rozie({ target: 'vue' }), vue()],
});
```

```vue
<!-- Then anywhere in your app: -->
<script setup lang="ts">
import Counter from './Counter.rozie';
</script>
<template><Counter /></template>
```

## Public exports

From the package root (`@rozie/unplugin`):
- `unplugin` — the `createUnplugin` v3 factory (default export + named)
- `validateOptions` — synchronous `RozieOptions` validator (throws `ROZ400`/`ROZ401`/`ROZ402`)
- Type: `RozieOptions` (`{ target: 'vue' | 'react' | 'svelte' | 'angular' }`)

From subpath entries:
- `@rozie/unplugin/vite` — `vitePlugin` (default + named); CI-tested in Phase 3
- `@rozie/unplugin/rollup`, `/webpack`, `/esbuild`, `/rolldown`, `/rspack` — present for symmetry, not CI-tested until Phase 6

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../.planning/PROJECT.md)
- Roadmap: [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
