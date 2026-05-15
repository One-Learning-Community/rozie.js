# Install

## Requirements

- Node 20 or newer
- TypeScript 5.6 or newer (if your project uses TypeScript)
- A package manager (pnpm, npm, or yarn — examples below use pnpm)

## Inside a Vite project (recommended)

Rozie ships as an `unplugin` so it works with Vite, Rollup, Webpack, esbuild, Rolldown, and Rspack from one package.

```bash
pnpm add -D @rozie/unplugin
```

Then in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    Rozie({ target: 'vue' }), // or 'react' | 'svelte' | 'angular' | 'solid' | 'lit'
    vue(),
  ],
});
```

Import `.rozie` files as normal components:

```ts
import Counter from './Counter.rozie';
```

## Standalone CLI

For one-shot codegen (CI, doc builds, ahead-of-time emit):

```bash
pnpm add -D @rozie/cli
pnpm rozie build src/Counter.rozie --target vue --out dist/Counter.vue
```

The CLI accepts `--target vue | react | svelte | angular | solid | lit` and supports `--source-map` for emitting sourcemaps alongside the output file.

## Versions

| Target | Supported version |
| --- | --- |
| React | 18+ |
| Vue | 3.4+ |
| Svelte | 5+ (runes mode) |
| Angular | 19+ (signals era) |
| Solid | 1.8+ |
| Lit | 3.2+ |
| TypeScript (consumer) | 5.6+ |

The Solid target additionally requires [`vite-plugin-solid`](https://www.npmjs.com/package/vite-plugin-solid) `^2.0` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'solid'` is selected.

The Lit target has **no host Vite plugin** — Lit components are plain ES modules that self-register via `customElements.define()`, so Rozie's unplugin handles the `.rozie` → custom-element transform directly and Vite's standard `.ts` pipeline takes it from there. Emitted components depend on [`lit`](https://www.npmjs.com/package/lit) `^3.2`, [`@lit-labs/preact-signals`](https://www.npmjs.com/package/@lit-labs/preact-signals), and `@rozie/runtime-lit`.

The Angular target additionally requires [`@analogjs/vite-plugin-angular`](https://www.npmjs.com/package/@analogjs/vite-plugin-angular) `^2.5` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'angular'` is selected. Angular 19's own `peerDependencies.typescript` is `>=5.5.0 <5.9.0`, which sits comfortably within our TS 5.6+ floor.

### TypeScript floor

Rozie's emitted code (`.tsx`, `.svelte`, `.vue` with `<script lang="ts">`, Angular standalone components, Solid `.tsx`, Lit class fields) resolves cleanly under TypeScript 5.6+. The floor is set by the lowest TS version we actively type-check our emitted output against. Older versions may work for some targets but aren't tested — in particular, TS ≤5.4 ships its CJS-to-ESM namespace shape (`default`-wrapped only, no flat names) that breaks upstream tooling we depend on (notably `@analogjs/vite-plugin-angular`'s phantom `import * as ts from 'typescript'`). If you're stuck on an older TS for legacy reasons, file an issue; we'll consider a deliberate compatibility bump if a real need emerges.
